use crate::engine::detector::{get_binaries, stage_engine_update, update_ytdlp_tool};
use crate::engine::downloader::{run_download, DownloadManager};
use crate::engine::metadata::fetch_video_metadata;
use crate::engine::updater::{check_github_release, download_installer, launch_installer_and_exit, AppUpdater};
use crate::models::{AppUpdateInfo, DependencyStatus, PhotoDownloadResult, VideoMetadata};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
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
pub async fn update_ytdlp(state: State<'_, Arc<DownloadManager>>, background: Option<bool>) -> Result<String, String> {
    static ENGINE_UPDATE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    let _engine = ENGINE_UPDATE.try_lock().map_err(|_| "Engine update already running")?;
    if background.unwrap_or(false) {
        let staged = tokio::task::spawn_blocking(stage_engine_update).await.map_err(|e| e.to_string())??;
        let job = state.inner().begin_when_idle().await?;
        job.check_cancelled()?;
        staged.publish()?;
        return Ok(staged.message.clone());
    }
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
pub fn open_file(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("ไม่พบไฟล์ดังกล่าวในเครื่อง".into());
    }
    open::that(p).map_err(|e| format!("ไม่สามารถเปิดไฟล์ {}: {}", path, e))
}

#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("ไม่พบไฟล์หรือโฟลเดอร์ดังกล่าว".into());
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("explorer.exe");
        cmd.arg(format!("/select,{}", path));
        cmd.creation_flags(0x08000000);
        cmd.spawn().map_err(|e| format!("ไม่สามารถเปิด Explorer: {}", e))?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let folder = if p.is_dir() { p } else { p.parent().unwrap_or(p) };
        open::that(folder).map_err(|e| format!("ไม่สามารถเปิดโฟลเดอร์: {}", e))
    }
}

#[tauri::command]
pub async fn fetch_metadata(url: String, state: State<'_, Arc<DownloadManager>>) -> Result<VideoMetadata, String> {
    let job = state.inner().begin()?;
    tokio::task::spawn_blocking(move || {
        job.check_cancelled()?;
        fetch_video_metadata(&url)
    })
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
pub async fn download_photo_post(
    app: AppHandle,
    state: State<'_, Arc<DownloadManager>>,
    url: String,
    download_dir: String,
    format: String,
) -> Result<PhotoDownloadResult, String> {
    let manager = state.inner().clone();
    crate::engine::photo_downloader::run_photo_download(app, manager, url, download_dir, format).await
}

#[tauri::command]
pub async fn cancel_download(state: State<'_, Arc<DownloadManager>>) -> Result<(), String> {
    state.inner().cancel().await
}

#[tauri::command]
pub async fn check_app_update(updater: State<'_, Arc<Mutex<AppUpdater>>>) -> Result<AppUpdateInfo, String> {
    let updater = updater.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut updater = updater.try_lock().map_err(|_| "Update already in progress")?;
        let release = check_github_release(env!("CARGO_PKG_VERSION"))?;
        let info = release.info.clone();
        updater.release = Some(release);
        Ok(info)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn stage_app_update(
    state: State<'_, Arc<DownloadManager>>,
    updater: State<'_, Arc<Mutex<AppUpdater>>>,
) -> Result<(), String> {
    // Admission check only: staging writes a separate file and need not block later media work.
    let admission = state.inner().begin()?;
    drop(admission);
    let updater = updater.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut updater = updater.try_lock().map_err(|_| "Update already in progress")?;
        let release = updater.release.as_ref().ok_or("Check for updates first")?;
        let staged = download_installer(release)?;
        updater.staged = Some(staged);
        Ok(())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn install_app_update(
    state: State<'_, Arc<DownloadManager>>,
    updater: State<'_, Arc<Mutex<AppUpdater>>>,
) -> Result<(), String> {
    let job = state.inner().begin()?;
    let updater = updater.inner().clone();
    tokio::task::spawn_blocking(move || {
        let updater = updater.try_lock().map_err(|_| "Update already in progress")?;
        let staged = updater.staged.as_ref().ok_or("Installer is not staged")?;
        job.check_cancelled()?;
        launch_installer_and_exit(staged)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("ไม่สามารถเปิดลิงก์ {}: {}", url, e))
}

