use crate::engine::{detector::get_binaries, parser::parse_stdout_line, validate_url};
use std::{
    path::Path,
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
        .map_err(|_| "มีงานดาวน์โหลดกำลังทำงานอยู่")?;
    let url = validate_url(&url)?;
    if !matches!(
        format_spec.as_str(),
        "bestvideo[height<=1080]+bestaudio/best[height<=1080]"
            | "bestvideo[height<=720]+bestaudio/best[height<=720]"
            | "bestvideo[height<=480]+bestaudio/best[height<=480]"
            | "bestvideo+bestaudio/best"
            | "bestaudio/best"
            | "best[ext=mp4]"
    ) {
        return Err("รูปแบบไฟล์ไม่ถูกต้อง".into());
    }
    let binaries = tokio::task::spawn_blocking(get_binaries)
        .await
        .map_err(|e| e.to_string())?;
    let ytdlp = binaries.ytdlp_path.ok_or("ไม่พบ yt-dlp ในระบบ")?;
    if format_spec == "bestaudio/best" && binaries.ffmpeg_path.is_none() {
        return Err("ต้องติดตั้ง FFmpeg เพื่อแปลง MP3".into());
    }
    if !Path::new(&download_dir).is_absolute() {
        return Err("กรุณาเลือกโฟลเดอร์ปลายทาง".into());
    }
    tokio::fs::create_dir_all(&download_dir)
        .await
        .map_err(|e| format!("สร้างโฟลเดอร์ไม่ได้: {e}"))?;
    let template = Path::new(&download_dir).join("%(title).150B [%(id)s].%(ext)s");
    let mut cmd = Command::new(ytdlp);
    cmd.env("PYTHONIOENCODING", "utf-8");
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
        "--no-playlist",
        "--playlist-items",
        "1",
        "--socket-timeout",
        "20",
        "--retries",
        "2",
        "--js-runtimes",
        "node",
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
    if let Some(ffmpeg) = binaries.ffmpeg_path {
        if ffmpeg != "ffmpeg" {
            cmd.args(["--ffmpeg-location", &ffmpeg]);
        }
    }
    cmd.arg("--")
        .arg(url)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    #[cfg(unix)]
    cmd.process_group(0);
    let mut child = cmd.spawn().map_err(|e| format!("เริ่ม yt-dlp ไม่ได้: {e}"))?;
    let stdout = child.stdout.take().ok_or("เปิด stdout ไม่ได้")?;
    let stderr = child.stderr.take().ok_or("เปิด stderr ไม่ได้")?;
    let out_app = app.clone();
    let reader = tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(payload) = parse_stdout_line(&line) {
                let _ = out_app.emit("download-progress", payload);
            }
        }
    });
    let err_app = app;
    let errors = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        let mut last_error = String::new();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(payload) = parse_stdout_line(&line) {
                let _ = err_app.emit("download-progress", payload);
            }
            if line.contains("ERROR:") {
                last_error = line.chars().take(1000).collect();
            }
        }
        last_error
    });
    manager.active.store(true, Ordering::SeqCst);
    let result = tokio::select! {
        status = child.wait() => status.map_err(|e| e.to_string()),
        _ = manager.cancelled.notified() => {
            if let Some(pid) = child.id() {
                #[cfg(target_os = "windows")]
                { let _ = Command::new("taskkill").args(["/F", "/T", "/PID", &pid.to_string()]).creation_flags(0x08000000).output().await; }
                #[cfg(unix)]
                { let _ = Command::new("kill").args(["-KILL", "--", &format!("-{pid}")]).output().await; }
            }
            let _ = child.kill().await;
            Err("ยกเลิกการดาวน์โหลดแล้ว".into())
        }
    };
    manager.active.store(false, Ordering::SeqCst);
    // Consume a cancellation racing with normal completion, so the next job starts cleanly.
    let _ = tokio::time::timeout(
        std::time::Duration::from_millis(1),
        manager.cancelled.notified(),
    )
    .await;
    let _ = reader.await;
    let message = errors.await.unwrap_or_default();
    if result?.success() {
        Ok(())
    } else {
        Err(if message.is_empty() {
            "ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่".into()
        } else {
            message
        })
    }
}
