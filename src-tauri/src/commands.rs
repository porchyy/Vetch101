use crate::engine::detector::{get_binaries, update_ytdlp_tool};
use crate::engine::downloader::{run_download, DownloadManager};
use crate::engine::metadata::fetch_video_metadata;
use crate::models::{DependencyStatus, VideoMetadata};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub async fn check_dependencies() -> Result<DependencyStatus, String> {
    let binaries = tokio::task::spawn_blocking(get_binaries)
        .await
        .map_err(|e| e.to_string())?;

    Ok(DependencyStatus {
        ytdlp_available: binaries.ytdlp_path.is_some(),
        ffmpeg_available: binaries.ffmpeg_path.is_some(),
        ffprobe_available: binaries.ffprobe_path.is_some(),
        ytdlp_path: binaries.ytdlp_path,
        ffmpeg_path: binaries.ffmpeg_path,
        ffprobe_path: binaries.ffprobe_path,
        ytdlp_version: binaries.ytdlp_version,
        app_bin_dir: binaries.app_bin_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn update_ytdlp(state: State<'_, Arc<DownloadManager>>) -> Result<String, String> {
    let job = state.inner().begin()?;
    tokio::task::spawn_blocking(move || {
        let binaries = get_binaries();
        job.check_cancelled()?;
        update_ytdlp_tool(&binaries)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn get_default_download_dir() -> String {
    dirs::download_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub async fn select_folder(default_dir: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::AsyncFileDialog::new();
    if let Some(dir) = default_dir {
        dialog = dialog.set_directory(dir);
    }
    let folder = dialog.pick_folder().await;
    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).is_dir() {
        return Err("ไม่พบโฟลเดอร์ปลายทาง".into());
    }
    open::that(&path).map_err(|e| format!("ไม่สามารถเปิดโฟลเดอร์ {}: {}", path, e))
}

#[tauri::command]
pub async fn fetch_metadata(url: String) -> Result<VideoMetadata, String> {
    tokio::task::spawn_blocking(move || fetch_video_metadata(&url))
        .await
        .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    state: State<'_, Arc<DownloadManager>>,
    url: String,
    format_spec: String,
    download_dir: String,
) -> Result<(), String> {
    let manager = state.inner().clone();
    run_download(app.clone(), manager, url, format_spec, download_dir).await?;
    // Notification failure must not turn a verified download into a failed job.
    if let Err(error) = app
        .notification()
        .builder()
        .title("Vetch101 — ดาวน์โหลดเสร็จแล้ว")
        .body("บันทึกไฟล์เรียบร้อยแล้ว เปิดโฟลเดอร์ปลายทางได้จากแอป")
        .show()
    {
        eprintln!("Could not show download notification: {error}");
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_download(state: State<'_, Arc<DownloadManager>>) -> Result<(), String> {
    state.inner().cancel().await
}
