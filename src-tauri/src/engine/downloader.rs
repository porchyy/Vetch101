use crate::engine::{detector::get_binaries, parser::parse_stdout_line, validate_url};
use std::{
    path::{Path, PathBuf},
    process::Stdio,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::{AppHandle, Emitter};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
    sync::{Mutex, Notify},
};

pub struct DownloadManager {
    running: Mutex<()>,
    active: AtomicBool,
    cancelled: Notify,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            running: Mutex::new(()),
            active: AtomicBool::new(false),
            cancelled: Notify::new(),
        }
    }

    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::SeqCst)
    }

    pub async fn cancel(&self) -> Result<(), String> {
        if !self.active.load(Ordering::SeqCst) {
            return Err("ไม่มีการดาวน์โหลดที่กำลังทำงานอยู่".into());
        }
        self.cancelled.notify_one();
        Ok(())
    }
}

pub async fn run_download(
    app: AppHandle,
    manager: Arc<DownloadManager>,
    url: String,
    format_spec: String,
    download_dir: String,
) -> Result<(), String> {
    let _job = manager
        .running
        .try_lock()
        .map_err(|_| "มีงานดาวน์โหลดกำลังทำงานอยู่ กรุณารอหรือกดยกเลิกงานเดิมก่อน")?;

    let url = validate_url(&url)?;

    // Allowed preset formats
    let valid_spec = matches!(
        format_spec.as_str(),
        "bestvideo[height<=2160]+bestaudio/best[height<=2160]"
            | "bestvideo[height<=1440]+bestaudio/best[height<=1440]"
            | "bestvideo[height<=1080]+bestaudio/best[height<=1080]"
            | "bestvideo[height<=720]+bestaudio/best[height<=720]"
            | "bestvideo[height<=480]+bestaudio/best[height<=480]"
            | "bestvideo[height<=360]+bestaudio/best[height<=360]"
            | "bestvideo+bestaudio/best"
            | "bestaudio/best"
            | "best[ext=mp4]"
    );
    if !valid_spec {
        return Err("รูปแบบไฟล์ที่เลือกไม่ถูกต้อง".into());
    }

    let binaries = tokio::task::spawn_blocking(get_binaries)
        .await
        .map_err(|e| e.to_string())?;

    let ytdlp = binaries.ytdlp_path.ok_or("ไม่พบ yt-dlp ในระบบ")?;
    if format_spec == "bestaudio/best" && binaries.ffmpeg_path.is_none() {
        return Err("ต้องมี FFmpeg เพื่อแปลงเป็นไฟล์ MP3".into());
    }

    let dest_path = PathBuf::from(&download_dir);
    if !dest_path.is_absolute() {
        return Err("กรุณาเลือกโฟลเดอร์ปลายทางที่ถูกต้อง".into());
    }

    tokio::fs::create_dir_all(&dest_path)
        .await
        .map_err(|e| format!("ไม่สามารถสร้างโฟลเดอร์ปลายทางได้: {e}"))?;

    let template = dest_path.join("%(title).150B [%(id)s].%(ext)s");

    let mut cmd = Command::new(ytdlp);
    cmd.env("PYTHONIOENCODING", "utf-8");
    cmd.env("PYTHONUTF8", "1");

    if binaries.use_python_module {
        cmd.args(["-m", "yt_dlp"]);
    }

    cmd.args([
        "--ignore-config",
        "--encoding",
        "utf-8",
        "--newline",
        "--progress",
        "--progress-template",
        "download:download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--print",
        "after_move:FINAL_OUTPUT:%(filepath)s",
        "--continue",
        "--no-playlist",
        "--playlist-items",
        "1",
        "--socket-timeout",
        "25",
        "--retries",
        "3",
        "--no-overwrites",
        "-f",
        &format_spec,
        "-o",
    ]);

    cmd.arg(template);

    if format_spec == "bestaudio/best" {
        cmd.args(["-x", "--audio-format", "mp3"]);
    } else if binaries.ffmpeg_path.is_some() {
        cmd.args(["--merge-output-format", "mp4", "--remux-video", "mp4"]);
    }

    // Safe FFmpeg location
    if let Some(ffmpeg) = &binaries.ffmpeg_path {
        let p = Path::new(ffmpeg);
        if p.is_absolute() && p.exists() {
            if let Some(parent) = p.parent() {
                cmd.arg("--ffmpeg-location").arg(parent);
            } else {
                cmd.arg("--ffmpeg-location").arg(p);
            }
        }
    }

    cmd.arg("--")
        .arg(url)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| format!("เริ่ม yt-dlp ไม่ได้: {e}"))?;

    let stdout = child.stdout.take().ok_or("ไม่สามารถเชื่อมต่อ stdout ได้")?;
    let stderr = child.stderr.take().ok_or("ไม่สามารถเชื่อมต่อ stderr ได้")?;

    let out_app = app.clone();
    let final_path_arc = Arc::new(tokio::sync::Mutex::new(None::<String>));
    let final_path_clone = final_path_arc.clone();

    // Raw byte stream reader for stdout: immune to UTF-8 decoding crashes and pipe deadlocks
    let stdout_reader = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut buf = Vec::new();

        while let Ok(n) = reader.read_until(b'\n', &mut buf).await {
            if n == 0 {
                break;
            }
            let line = String::from_utf8_lossy(&buf);
            let trimmed = line.trim();

            if trimmed.starts_with("FINAL_OUTPUT:") {
                let path = trimmed["FINAL_OUTPUT:".len()..].trim().to_string();
                let mut guard = final_path_clone.lock().await;
                *guard = Some(path);
            }

            if let Some(payload) = parse_stdout_line(trimmed) {
                let _ = out_app.emit("download-progress", payload);
            }
            buf.clear();
        }
    });

    let err_app = app.clone();
    let stderr_reader = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut buf = Vec::new();
        let mut last_error = String::new();

        while let Ok(n) = reader.read_until(b'\n', &mut buf).await {
            if n == 0 {
                break;
            }
            let line = String::from_utf8_lossy(&buf);
            let trimmed = line.trim();

            if let Some(payload) = parse_stdout_line(trimmed) {
                let _ = err_app.emit("download-progress", payload);
            }

            if trimmed.contains("ERROR:") {
                last_error = trimmed.chars().take(1000).collect();
            }
            buf.clear();
        }
        last_error
    });

    manager.active.store(true, Ordering::SeqCst);

    let result = tokio::select! {
        status = child.wait() => status.map_err(|e| e.to_string()),
        _ = manager.cancelled.notified() => {
            if let Some(pid) = child.id() {
                #[cfg(target_os = "windows")]
                {
                    let _ = Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .creation_flags(0x08000000)
                        .output()
                        .await;
                }
                #[cfg(unix)]
                {
                    let _ = Command::new("kill").args(["-KILL", "--", &format!("-{pid}")]).output().await;
                }
            }
            let _ = child.kill().await;
            Err("ยกเลิกการดาวน์โหลดแล้ว".into())
        }
    };

    manager.active.store(false, Ordering::SeqCst);

    // Consume any racing cancellation token
    let _ = tokio::time::timeout(
        std::time::Duration::from_millis(1),
        manager.cancelled.notified(),
    )
    .await;

    let _ = stdout_reader.await;
    let message = stderr_reader.await.unwrap_or_default();

    let exit_status = result?;
    if exit_status.success() {
        // Verify output file existence and non-empty size
        let final_path_guard = final_path_arc.lock().await;
        if let Some(saved_path) = final_path_guard.as_ref() {
            let p = Path::new(saved_path);
            if p.is_file() {
                if let Ok(meta) = std::fs::metadata(p) {
                    if meta.len() == 0 {
                        return Err("ไฟล์ที่บันทึกมีขนาด 0 ไบต์ (ไฟล์ว่างเปล่า)".into());
                    }
                }
            }
        }
        Ok(())
    } else {
        Err(if message.is_empty() {
            "ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง".into()
        } else {
            message
        })
    }
}
