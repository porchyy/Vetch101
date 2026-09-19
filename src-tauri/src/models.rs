use serde::{Deserialize, Serialize};

/// Discriminates between a video post and a photo/image post.
/// Defaults to `Video` for backward compatibility.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PostType {
    #[default]
    Video,
    PhotoPost,
}

/// A single image in a photo post / album, in display order.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoImage {
    /// 1-based index within the post.
    pub index: u32,
    /// URL suitable for displaying a preview (may be lower-res).
    pub preview_url: String,
    /// Full-resolution download URL.
    pub download_url: String,
    /// Pixel width, if known.
    #[serde(default)]
    pub width: Option<u32>,
    /// Pixel height, if known.
    #[serde(default)]
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityOption {
    pub id: String,
    pub label: String,
    pub ext: String,
    pub format_spec: String,
    #[serde(default)]
    pub filesize_approx: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub duration: Option<f64>,
    pub channel: Option<String>,
    #[serde(default)]
    pub filesize_approx: Option<u64>,
    pub qualities: Vec<QualityOption>,
    /// Whether this post is a video or a photo/album post.
    #[serde(default)]
    pub post_type: PostType,
    /// Ordered list of images for photo posts. Empty for video posts.
    #[serde(default)]
    pub images: Vec<PhotoImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub progress: f32,  // 0.0 - 100.0
    pub speed: String,  // e.g. "8.2 MB/s"
    pub eta: String,    // e.g. "00:15"
    pub status: String, // "preparing" | "downloading" | "merging" | "completed" | "cancelled" | "error"
    pub message: String,
    pub filename: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub ytdlp_available: bool,
    pub ffmpeg_available: bool,
    pub ffprobe_available: bool,
    pub ytdlp_path: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub ytdlp_version: Option<String>,
    pub app_bin_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub setup_url: Option<String>,
    pub portable_url: Option<String>,
    pub is_installed: bool,
}
