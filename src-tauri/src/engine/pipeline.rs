use crate::engine::downloader::{self, DownloadManager};
use crate::engine::photo_downloader;
use crate::models::DownloadOutcome;
use std::sync::Arc;
use tauri::AppHandle;

/// Port abstraction for running external subprocess commands.
pub trait CommandRunner: Send + Sync {
    fn run(&self, program: &str, args: &[&str]) -> Result<String, String>;
}

/// Production implementation running real system commands with hidden windows on Windows.
pub struct SystemCommandRunner;

impl CommandRunner for SystemCommandRunner {
    fn run(&self, program: &str, args: &[&str]) -> Result<String, String> {
        let mut cmd = std::process::Command::new(program);
        cmd.args(args);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        let output = cmd.output().map_err(|e| format!("Failed to run {}: {}", program, e))?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}

/// Typed request for downloading media through the unified media pipeline.
#[derive(Debug, Clone)]
pub enum DownloadRequest {
    Video {
        url: String,
        format_spec: String,
        download_dir: String,
    },
    PhotoAlbum {
        url: String,
        format: String,
        download_dir: String,
    },
}

/// Unified media pipeline deep module coordinating concurrency, process supervision,
/// and synchronous verified outcome return across all media types.
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
            } => downloader::run_download_with_job(app, self.manager.clone(), job, url, format_spec, download_dir).await,
            DownloadRequest::PhotoAlbum {
                url,
                format,
                download_dir,
            } => photo_downloader::run_photo_download_with_job(app, self.manager.clone(), job, url, download_dir, format).await,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    pub struct MockCommandRunner {
        responses: Mutex<HashMap<String, Result<String, String>>>,
    }

    impl MockCommandRunner {
        pub fn new() -> Self {
            Self {
                responses: Mutex::new(HashMap::new()),
            }
        }

        pub fn set_response(&self, key: &str, response: Result<String, String>) {
            self.responses.lock().unwrap().insert(key.to_string(), response);
        }
    }

    impl CommandRunner for MockCommandRunner {
        fn run(&self, program: &str, _args: &[&str]) -> Result<String, String> {
            let guard = self.responses.lock().unwrap();
            guard.get(program).cloned().unwrap_or_else(|| {
                Err(format!("Mock command not found: {}", program))
            })
        }
    }

    #[test]
    fn test_mock_command_runner_returns_configured_stdout() {
        let runner = MockCommandRunner::new();
        runner.set_response("yt-dlp", Ok(r#"{"title":"Mock Video"}"#.to_string()));
        let res = runner.run("yt-dlp", &["--dump-json"]);
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), r#"{"title":"Mock Video"}"#);
    }

    #[test]
    fn test_mock_command_runner_returns_configured_error() {
        let runner = MockCommandRunner::new();
        runner.set_response("yt-dlp", Err("Mock failure".to_string()));
        let res = runner.run("yt-dlp", &["--dump-json"]);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), "Mock failure");
    }

    #[tokio::test]
    async fn test_pipeline_concurrency_lock_prevents_simultaneous_jobs() {
        let manager = Arc::new(DownloadManager::new());
        let pipeline = MediaPipeline::new(manager.clone());
        let _op1 = pipeline.manager().begin().unwrap();

        // Attempting to begin second operation through manager or pipeline fails
        assert!(pipeline.manager().begin().is_err(), "second operation must be rejected while first is active");
    }
}
