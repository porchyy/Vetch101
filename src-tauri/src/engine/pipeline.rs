use crate::engine::downloader::{self, DownloadManager};
use crate::engine::photo_downloader;
use crate::models::DownloadOutcome;
use std::sync::Arc;
use tauri::AppHandle;

/// Typed request for downloading media through the unified media pipeline.
#[derive(Debug, Clone)]
pub enum DownloadRequest {
    Video {
        url: String,
        format_spec: String,
        download_dir: String,
        browser: Option<String>,
    },
    PhotoAlbum {
        url: String,
        format: String,
        download_dir: String,
        indices: Option<Vec<usize>>,
    },
}

/// Media pipeline coordinator responsible for destination pre-validation,
/// acquiring concurrency lock on DownloadManager, and dispatching requests
/// to the appropriate download engine (video or photo album).
pub struct MediaPipeline {
    manager: Arc<DownloadManager>,
}

impl MediaPipeline {
    pub fn new(manager: Arc<DownloadManager>) -> Self {
        Self { manager }
    }

    pub fn manager(&self) -> &Arc<DownloadManager> {
        &self.manager
    }

    pub async fn execute(
        &self,
        app: AppHandle,
        request: DownloadRequest,
    ) -> Result<DownloadOutcome, String> {
        let dir = match &request {
            DownloadRequest::Video { download_dir, .. } => download_dir,
            DownloadRequest::PhotoAlbum { download_dir, .. } => download_dir,
        };

        let trimmed_dir = dir.trim();
        if trimmed_dir.is_empty() {
            return Err("กรุณาระบุโฟลเดอร์สำหรับบันทึกไฟล์".into());
        }
        let dest_path = std::path::Path::new(trimmed_dir);
        if !dest_path.exists() {
            return Err(format!("ไม่พบโฟลเดอร์ปลายทาง: {}", trimmed_dir));
        }

        // Centralized concurrency lock acquisition
        let job = self.manager.begin()?;

        match request {
            DownloadRequest::Video {
                url,
                format_spec,
                download_dir,
                browser,
            } => {
                downloader::run_download_with_job(
                    app,
                    self.manager.clone(),
                    job,
                    url,
                    format_spec,
                    download_dir,
                    browser,
                )
                .await
            }
            DownloadRequest::PhotoAlbum {
                url,
                format,
                download_dir,
                indices,
            } => {
                photo_downloader::run_photo_download_with_job(
                    app,
                    self.manager.clone(),
                    job,
                    url,
                    download_dir,
                    format,
                    indices,
                )
                .await
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pipeline_concurrency_lock_prevents_simultaneous_jobs() {
        let manager = Arc::new(DownloadManager::new());
        let pipeline = MediaPipeline::new(manager.clone());
        let _op1 = pipeline.manager().begin().unwrap();

        // Attempting to begin second operation through manager or pipeline fails
        assert!(
            pipeline.manager().begin().is_err(),
            "second operation must be rejected while first is active"
        );
    }

    #[test]
    fn test_download_request_variants() {
        let req_video = DownloadRequest::Video {
            url: "https://example.com/video".into(),
            format_spec: "best".into(),
            download_dir: "C:\\Downloads".into(),
            browser: None,
        };
        assert!(matches!(req_video, DownloadRequest::Video { .. }));

        let req_photos = DownloadRequest::PhotoAlbum {
            url: "https://example.com/photos".into(),
            format: "jpg".into(),
            download_dir: "C:\\Downloads".into(),
            indices: Some(vec![0, 2]),
        };
        assert!(matches!(req_photos, DownloadRequest::PhotoAlbum { .. }));
    }
}

