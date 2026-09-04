use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityOption {
    pub id: String,
    pub label: String,
    pub format_spec: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub duration: Option<f64>,
    pub channel: Option<String>,
    pub qualities: Vec<QualityOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub progress: f32,       // 0.0 - 100.0
    pub speed: String,       // e.g. "8.2 MB/s"
    pub eta: String,         // e.g. "00:15"
    pub status: String,      // "preparing" | "downloading" | "merging" | "completed" | "cancelled" | "error"
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub ytdlp_available: bool,
    pub ffmpeg_available: bool,
    pub ytdlp_path: Option<String>,
    pub ffmpeg_path: Option<String>,
}
