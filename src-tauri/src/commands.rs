use crate::engine::detector::get_binaries;
use crate::engine::downloader::{run_download, DownloadManager};
use crate::engine::metadata::fetch_video_metadata;
use crate::models::{DependencyStatus, VideoMetadata};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn check_dependencies() -> DependencyStatus {
    let binaries = get_binaries();
    DependencyStatus {
        ytdlp_available: binaries.ytdlp_path.is_some(),
        ffmpeg_available: binaries.ffmpeg_path.is_some(),
        ytdlp_path: binaries.ytdlp_path,
        ffmpeg_path: binaries.ffmpeg_path,
    }
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
    tokio::spawn(async move {
        let _ = run_download(app, manager, url, format_spec, download_dir).await;
    });
    Ok(())
}

#[tauri::command]
pub async fn cancel_download(state: State<'_, Arc<DownloadManager>>) -> Result<(), String> {
    state.inner().cancel().await
}
