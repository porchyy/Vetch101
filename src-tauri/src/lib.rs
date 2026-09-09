pub mod commands;
pub mod engine;
pub mod models;

use commands::*;
use engine::downloader::DownloadManager;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    if let Err(error) = engine::process_job::bind_process_tree() {
        rfd::MessageDialog::new()
            .set_title("Vetch101")
            .set_description(format!("ตั้งค่าการดูแล process ไม่สำเร็จ: {error}"))
            .set_level(rfd::MessageLevel::Error)
            .show();
        return;
    }
    let download_manager = Arc::new(DownloadManager::new());
    let closing = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(download_manager)
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if closing.swap(true, Ordering::SeqCst) { return; }
                let manager = window.state::<Arc<DownloadManager>>().inner().clone();
                let app = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    // Give cancel/readers time to finish. A stuck updater/probe is bounded by
                    // this deadline; the process-lifetime Job Object kills remaining children.
                    let result = tokio::time::timeout(std::time::Duration::from_secs(15), manager.shutdown()).await;
                    if result.is_err() {
                        eprintln!("Cleanup timed out; Windows Job Object will terminate remaining processes");
                    }
                    app.exit(if result.is_ok() { 0 } else { 1 });
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            check_dependencies,
            update_ytdlp,
            get_default_download_dir,
            select_folder,
            open_folder,
            open_file,
            reveal_in_folder,
            fetch_metadata,
            start_download,
            cancel_download
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
