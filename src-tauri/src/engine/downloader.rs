use crate::engine::detector::get_binaries;
use crate::engine::parser::parse_stdout_line;
use crate::models::DownloadProgressPayload;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct DownloadManager {
    pub current_pid: Arc<Mutex<Option<u32>>>,
    pub is_cancelled: Arc<AtomicBool>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            current_pid: Arc::new(Mutex::new(None)),
            is_cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn cancel(&self) -> Result<(), String> {
        self.is_cancelled.store(true, Ordering::SeqCst);
        let mut pid_guard = self.current_pid.lock().await;
        if let Some(pid) = *pid_guard {
            // Use taskkill on Windows to terminate process tree (yt-dlp + ffmpeg)
            #[cfg(target_os = "windows")]
            {
                let mut kill_cmd = std::process::Command::new("taskkill");
                kill_cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    kill_cmd.creation_flags(CREATE_NO_WINDOW);
                }
                let _ = kill_cmd.output();
            }

            *pid_guard = None;
            Ok(())
        } else {
            Err("ไม่มีการดาวน์โหลดที่กำลังทำงานอยู่".to_string())
        }
    }
}

pub async fn run_download(
    app: AppHandle,
    manager: Arc<DownloadManager>,
    url: String,
    format_spec: String,
    download_dir: String,
) -> Result<(), String> {
    manager.is_cancelled.store(false, Ordering::SeqCst);

    let binaries = get_binaries();
    let ytdlp = binaries.ytdlp_path.ok_or("ไม่พบโปรแกรม yt-dlp ในระบบ")?;

    let output_template = format!("{}/%(title)s.%(ext)s", download_dir.replace('\\', "/"));

    // Ensure output directory exists
    if !Path::new(&download_dir).exists() {
        let _ = std::fs::create_dir_all(&download_dir);
    }

    let mut cmd = TokioCommand::new(&ytdlp);

    if binaries.use_python_module {
        cmd.args(["-m", "yt_dlp"]);
    }

    cmd.args([
        "--newline",
        "--progress-template",
        "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_estimate_str)s",
        "--no-playlist",
        "-f",
        &format_spec,
        "-o",
        &output_template,
    ]);

    // If audio-only format chosen, extract audio or merge
    if format_spec == "bestaudio/best" {
        cmd.args(["-x", "--audio-format", "mp3"]);
    } else {
        cmd.args(["--merge-output-format", "mp4"]);
    }

    if let Some(ffmpeg) = &binaries.ffmpeg_path {
        cmd.args(["--ffmpeg-location", ffmpeg]);
    }

    cmd.arg(&url);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Emit initial preparing status
    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            progress: 0.0,
            speed: "-".to_string(),
            eta: "-".to_string(),
            status: "preparing".to_string(),
            message: "กำลังเตรียมการดาวน์โหลด...".to_string(),
        },
    );

    let mut child = cmd.spawn().map_err(|e| format!("ไม่สามารถเริ่ม yt-dlp: {}", e))?;

    if let Some(pid) = child.id() {
        let mut pid_guard = manager.current_pid.lock().await;
        *pid_guard = Some(pid);
    }

    let stdout = child.stdout.take().ok_or("ไม่สามารถเปิด stdout pipe")?;
    let mut reader = BufReader::new(stdout).lines();

    let app_clone = app.clone();
    let is_cancelled_clone = manager.is_cancelled.clone();

    while let Ok(Some(line)) = reader.next_line().await {
        if is_cancelled_clone.load(Ordering::SeqCst) {
            break;
        }

        if let Some(payload) = parse_stdout_line(&line) {
            let _ = app_clone.emit("download-progress", payload);
        }
    }

    let status = child.wait().await.map_err(|e| format!("รอ process ล้มเหลว: {}", e))?;

    // Clear active PID
    {
        let mut pid_guard = manager.current_pid.lock().await;
        *pid_guard = None;
    }

    if is_cancelled_clone.load(Ordering::SeqCst) {
        let _ = app.emit(
            "download-progress",
            DownloadProgressPayload {
                progress: 0.0,
                speed: "-".to_string(),
                eta: "-".to_string(),
                status: "cancelled".to_string(),
                message: "ยกเลิกการดาวน์โหลดแล้ว".to_string(),
            },
        );
        return Ok(());
    }

    if status.success() {
        let _ = app.emit(
            "download-progress",
            DownloadProgressPayload {
                progress: 100.0,
                speed: "-".to_string(),
                eta: "00:00".to_string(),
                status: "completed".to_string(),
                message: "ดาวน์โหลดเสร็จสมบูรณ์ 100%".to_string(),
            },
        );
        Ok(())
    } else {
        let err_msg = format!("การดาวน์โหลดสิ้นสุดด้วยรหัสข้อผิดพลาด: {:?}", status.code());
        let _ = app.emit(
            "download-progress",
            DownloadProgressPayload {
                progress: 0.0,
                speed: "-".to_string(),
                eta: "-".to_string(),
                status: "error".to_string(),
                message: err_msg.clone(),
            },
        );
        Err(err_msg)
    }
}
