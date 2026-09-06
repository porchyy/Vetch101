use crate::engine::{detector::get_binaries, parser::parse_stdout_line, validate_url};
use std::{
    path::{Path, PathBuf},
    process::Stdio,
    sync::{Arc, Mutex as StdMutex},
};
use tauri::{AppHandle, Emitter};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
    sync::{watch, Mutex, OwnedMutexGuard},
};

pub struct DownloadManager {
    running: Arc<Mutex<()>>,
    control: StdMutex<Control>,
}

#[derive(Default)]
struct Control {
    closing: bool,
    cancel: Option<watch::Sender<bool>>,
}

pub struct Operation {
    manager: Arc<DownloadManager>,
    pub cancelled: watch::Receiver<bool>,
    _lock: OwnedMutexGuard<()>,
}

impl Operation {
    pub fn check_cancelled(&self) -> Result<(), String> {
        if *self.cancelled.borrow() {
            Err("ยกเลิกการดาวน์โหลดแล้ว".into())
        } else {
            Ok(())
        }
    }
}

impl Drop for Operation {
    fn drop(&mut self) {
        self.manager.control.lock().unwrap().cancel = None;
    }
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            running: Arc::new(Mutex::new(())),
            control: StdMutex::new(Control::default()),
        }
    }

    pub fn begin(self: &Arc<Self>) -> Result<Operation, String> {
        let mut control = self.control.lock().unwrap();
        if control.closing {
            return Err("แอปกำลังปิด ไม่สามารถเริ่มงานใหม่ได้".into());
        }
        let lock = self
            .running
            .clone()
            .try_lock_owned()
            .map_err(|_| "มีงานดาวน์โหลดหรืออัปเดตกำลังทำงานอยู่")?;
        let (sender, cancelled) = watch::channel(false);
        control.cancel = Some(sender);
        Ok(Operation {
            manager: self.clone(),
            cancelled,
            _lock: lock,
        })
    }

    pub async fn cancel(&self) -> Result<(), String> {
        let control = self.control.lock().unwrap();
        let cancel = control.cancel.as_ref().ok_or("ไม่มีงานที่กำลังทำงานอยู่")?;
        cancel.send_replace(true);
        Ok(())
    }

    pub async fn shutdown(&self) {
        {
            let mut control = self.control.lock().unwrap();
            control.closing = true;
            if let Some(cancel) = &control.cancel {
                cancel.send_replace(true);
            }
        }
        let _idle = self.running.lock().await;
    }
}

pub async fn run_download(
    app: AppHandle,
    manager: Arc<DownloadManager>,
    url: String,
    format_spec: String,
    download_dir: String,
) -> Result<(), String> {
    let mut job = manager.begin()?;

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
    job.check_cancelled()?;

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

    job.check_cancelled()?;
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

    let result = tokio::select! {
        biased;
        _ = async { let _ = job.cancelled.wait_for(|cancelled| *cancelled).await; } => {
            if let Err(error) = terminate_download(&mut child).await {
                manager.control.lock().unwrap().closing = true;
                Err(format!("{error} กรุณาปิดและเปิดแอปใหม่เพื่อเก็บกวาด process ที่เหลือ"))
            } else {
                Err("ยกเลิกการดาวน์โหลดแล้ว".into())
            }
        }
        status = child.wait() => status.map_err(|e| e.to_string()),
    };

    if result.is_err() {
        stdout_reader.abort();
        stderr_reader.abort();
    }
    let _ = stdout_reader.await;
    let message = stderr_reader.await.unwrap_or_default();

    let exit_status = result?;
    if exit_status.success() {
        let final_path_guard = final_path_arc.lock().await;
        verify_output(final_path_guard.as_deref().map(Path::new))
    } else {
        Err(if message.is_empty() {
            "ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง".into()
        } else {
            message
        })
    }
}

async fn terminate_download(child: &mut tokio::process::Child) -> Result<(), String> {
    let tree_result: Result<(), String> = async {
        if let Some(pid) = child.id() {
            #[cfg(target_os = "windows")]
            {
                let mut kill = Command::new("taskkill");
                kill.args(["/F", "/T", "/PID", &pid.to_string()])
                    .creation_flags(0x08000000)
                    .kill_on_drop(true);
                let output = tokio::time::timeout(std::time::Duration::from_secs(5), kill.output())
                    .await
                    .map_err(|_| "หยุด process tree เกินเวลาที่กำหนด")?
                    .map_err(|e| format!("หยุด process tree ไม่ได้: {e}"))?;
                if !output.status.success() {
                    return Err(format!(
                        "หยุด process tree ไม่สำเร็จ: {}",
                        String::from_utf8_lossy(&output.stderr)
                    ));
                }
            }
        }
        Ok(())
    }
    .await;
    // Reap the immediate child even when tree termination fails. Keep the error visible;
    // the app-level Job Object is the final cleanup boundary on close/crash.
    if child.try_wait().map_err(|e| e.to_string())?.is_none() {
        child
            .kill()
            .await
            .map_err(|e| format!("หยุด process ไม่ได้: {e}"))?;
    }
    tree_result
}

fn verify_output(path: Option<&Path>) -> Result<(), String> {
    let path = path.ok_or("ไม่พบตำแหน่งไฟล์ผลลัพธ์จาก yt-dlp")?;
    let metadata = std::fs::metadata(path).map_err(|e| format!("ตรวจสอบไฟล์ผลลัพธ์ไม่ได้: {e}"))?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Err("ไฟล์ผลลัพธ์ไม่ใช่ไฟล์ปกติหรือมีขนาด 0 ไบต์".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{verify_output, DownloadManager};
    use std::sync::Arc;

    #[cfg(windows)]
    #[tokio::test]
    async fn cancel_reaps_child_and_terminates_its_descendant() {
        use tokio::io::{AsyncBufReadExt, BufReader};
        use windows_sys::Win32::{
            Foundation::{CloseHandle, WAIT_OBJECT_0},
            System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE},
        };
        let mut child = tokio::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", "$p = Start-Process ping.exe -ArgumentList '-n 60 127.0.0.1' -WindowStyle Hidden -PassThru; Write-Output $p.Id; Start-Sleep -Seconds 60"])
            .creation_flags(0x08000000).stdout(std::process::Stdio::piped())
            .kill_on_drop(true).spawn().unwrap();
        let mut pid = String::new();
        BufReader::new(child.stdout.take().unwrap())
            .read_line(&mut pid)
            .await
            .unwrap();
        let handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, pid.trim().parse().unwrap()) };
        assert!(!handle.is_null());
        let result = super::terminate_download(&mut child).await;
        let descendant = unsafe { WaitForSingleObject(handle, 5000) };
        unsafe {
            CloseHandle(handle);
        }
        result.unwrap();
        assert!(child.try_wait().unwrap().is_some());
        assert_eq!(descendant, WAIT_OBJECT_0);
    }

    #[tokio::test]
    async fn operations_exclude_each_other_and_cancel_during_preparation() {
        let manager = Arc::new(DownloadManager::new());
        let download = manager.begin().unwrap();
        assert!(
            manager.begin().is_err(),
            "updater must not overlap preparation"
        );
        manager.cancel().await.unwrap();
        assert!(download.check_cancelled().is_err());
        drop(download);
        let update = manager.begin().unwrap();
        assert!(
            update.check_cancelled().is_ok(),
            "old cancellation must not leak"
        );
        assert!(
            manager.begin().is_err(),
            "download must not overlap updater"
        );
        let closing_manager = manager.clone();
        let closing = tokio::spawn(async move { closing_manager.shutdown().await });
        tokio::task::yield_now().await;
        assert!(!closing.is_finished(), "close must wait for cleanup");
        assert!(update.check_cancelled().is_err());
        drop(update);
        closing.await.unwrap();
        assert!(manager.begin().is_err(), "no new work after close");
    }

    #[test]
    fn success_requires_a_nonempty_output_file() {
        let dir = std::env::temp_dir().join(format!("vetch101-output-{}", std::process::id()));
        std::fs::create_dir(&dir).unwrap();
        let file = dir.join("ทดสอบ ภาษาไทย.mp4");
        assert!(verify_output(None).is_err());
        assert!(verify_output(Some(&file)).is_err());
        assert!(verify_output(Some(&dir)).is_err());
        std::fs::write(&file, []).unwrap();
        assert!(verify_output(Some(&file)).is_err());
        std::fs::write(&file, [1]).unwrap();
        assert!(verify_output(Some(&file)).is_ok());
        std::fs::remove_file(file).unwrap();
        std::fs::remove_dir(dir).unwrap();
    }
}
