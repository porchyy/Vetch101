pub mod commands;
pub mod engine;
pub mod models;

use commands::*;
use engine::downloader::DownloadManager;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let download_manager = Arc::new(DownloadManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(download_manager)
        .invoke_handler(tauri::generate_handler![
            check_dependencies,
            get_default_download_dir,
            select_folder,
            open_folder,
            fetch_metadata,
            start_download,
            cancel_download
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
