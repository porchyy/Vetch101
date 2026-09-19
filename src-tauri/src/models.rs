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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct QualityOption {
    pub id: String,
    pub label: String,
    pub ext: String,
    pub format_spec: String,
    #[serde(default)]
    pub filesize_approx: Option<u64>,
}

/// Discriminated media detail for standard video items (YouTube, TikTok video, etc.)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VideoDetails {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    #[serde(default)]
    pub duration: Option<f64>,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub filesize_approx: Option<u64>,
    #[serde(default)]
    pub qualities: Vec<QualityOption>,
}

/// Discriminated media detail for photo posts / carousels (TikTok photo albums)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PhotoAlbumDetails {
    pub id: String,
    pub title: String,
    pub cover_url: String,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub images: Vec<PhotoImage>,
}

/// Tagged discriminated union crossing the IPC seam between Rust backend and TypeScript frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MediaDetails {
    #[serde(rename = "video")]
    Video(VideoDetails),
    #[serde(rename = "photo_album")]
    PhotoAlbum(PhotoAlbumDetails),
}

impl MediaDetails {
    pub fn id(&self) -> &str {
        match self {
            MediaDetails::Video(v) => &v.id,
            MediaDetails::PhotoAlbum(p) => &p.id,
        }
    }

    pub fn title(&self) -> &str {
        match self {
            MediaDetails::Video(v) => &v.title,
            MediaDetails::PhotoAlbum(p) => &p.title,
        }
    }

    pub fn channel(&self) -> Option<&str> {
        match self {
            MediaDetails::Video(v) => v.channel.as_deref(),
            MediaDetails::PhotoAlbum(p) => p.channel.as_deref(),
        }
    }

    pub fn thumbnail_or_cover(&self) -> &str {
        match self {
            MediaDetails::Video(v) => &v.thumbnail,
            MediaDetails::PhotoAlbum(p) => &p.cover_url,
        }
    }
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

impl From<MediaDetails> for VideoMetadata {
    fn from(details: MediaDetails) -> Self {
        match details {
            MediaDetails::Video(v) => VideoMetadata {
                id: v.id,
                title: v.title,
                thumbnail: v.thumbnail,
                duration: v.duration,
                channel: v.channel,
                filesize_approx: v.filesize_approx,
                qualities: v.qualities,
                post_type: PostType::Video,
                images: vec![],
            },
            MediaDetails::PhotoAlbum(p) => VideoMetadata {
                id: p.id,
                title: p.title,
                thumbnail: p.cover_url,
                duration: None,
                channel: p.channel,
                filesize_approx: None,
                qualities: vec![],
                post_type: PostType::PhotoPost,
                images: p.images,
            },
        }
    }
}

impl From<VideoMetadata> for MediaDetails {
    fn from(meta: VideoMetadata) -> Self {
        if meta.post_type == PostType::PhotoPost || !meta.images.is_empty() {
            MediaDetails::PhotoAlbum(PhotoAlbumDetails {
                id: meta.id,
                title: meta.title,
                cover_url: meta.thumbnail,
                channel: meta.channel,
                images: meta.images,
            })
        } else {
            MediaDetails::Video(VideoDetails {
                id: meta.id,
                title: meta.title,
                thumbnail: meta.thumbnail,
                duration: meta.duration,
                channel: meta.channel,
                filesize_approx: meta.filesize_approx,
                qualities: meta.qualities,
            })
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoDownloadResult {
    pub total: usize,
    pub succeeded: usize,
    pub failed_indices: Vec<u32>,
    pub saved_files: Vec<String>,
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DownloadOutcome {
    Video {
        file_path: String,
        file_name: String,
    },
    PhotoAlbum {
        total: usize,
        succeeded: usize,
        failed_indices: Vec<u32>,
        saved_files: Vec<String>,
        folder_path: String,
        primary_file_path: Option<String>,
    },
}

impl DownloadOutcome {
    pub fn primary_file_path(&self) -> Option<&str> {
        match self {
            DownloadOutcome::Video { file_path, .. } => Some(file_path),
            DownloadOutcome::PhotoAlbum { primary_file_path, .. } => primary_file_path.as_deref(),
        }
    }

    pub fn primary_file_name(&self) -> Option<&str> {
        match self {
            DownloadOutcome::Video { file_name, .. } => Some(file_name),
            DownloadOutcome::PhotoAlbum { saved_files, .. } => saved_files.first().map(|s| s.as_str()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_and_deserialize_video_media_details() {
        let video = MediaDetails::Video(VideoDetails {
            id: "vid123".to_string(),
            title: "Test Video".to_string(),
            thumbnail: "https://example.com/thumb.jpg".to_string(),
            duration: Some(120.5),
            channel: Some("Test Channel".to_string()),
            filesize_approx: Some(15_000_000),
            qualities: vec![QualityOption {
                id: "1080p".to_string(),
                label: "1080p Full HD".to_string(),
                ext: "mp4".to_string(),
                format_spec: "bestvideo+bestaudio".to_string(),
                filesize_approx: Some(15_000_000),
            }],
        });

        let json = serde_json::to_string(&video).expect("serialize video");
        assert!(json.contains(r#""type":"video""#));
        assert!(json.contains(r#""duration":120.5"#));

        let deserialized: MediaDetails = serde_json::from_str(&json).expect("deserialize video");
        assert_eq!(deserialized, video);
        assert_eq!(deserialized.id(), "vid123");
        assert_eq!(deserialized.title(), "Test Video");
        assert_eq!(deserialized.channel(), Some("Test Channel"));
    }

    #[test]
    fn test_serialize_and_deserialize_photo_album_media_details() {
        let album = MediaDetails::PhotoAlbum(PhotoAlbumDetails {
            id: "album456".to_string(),
            title: "Photo Slideshow".to_string(),
            cover_url: "https://example.com/cover.jpg".to_string(),
            channel: Some("Photographer".to_string()),
            images: vec![
                PhotoImage {
                    index: 1,
                    preview_url: "https://example.com/img1_thumb.jpg".to_string(),
                    download_url: "https://example.com/img1_full.jpg".to_string(),
                    width: Some(1080),
                    height: Some(1920),
                },
                PhotoImage {
                    index: 2,
                    preview_url: "https://example.com/img2_thumb.jpg".to_string(),
                    download_url: "https://example.com/img2_full.jpg".to_string(),
                    width: Some(1080),
                    height: Some(1920),
                },
            ],
        });

        let json = serde_json::to_string(&album).expect("serialize photo album");
        assert!(json.contains(r#""type":"photo_album""#));
        assert!(!json.contains("duration"));
        assert!(!json.contains("qualities"));

        let deserialized: MediaDetails = serde_json::from_str(&json).expect("deserialize album");
        assert_eq!(deserialized, album);
        assert_eq!(deserialized.id(), "album456");
        assert_eq!(deserialized.title(), "Photo Slideshow");
        assert_eq!(deserialized.thumbnail_or_cover(), "https://example.com/cover.jpg");
    }

    #[test]
    fn test_roundtrip_conversion_between_metadata_and_details() {
        let original_album = PhotoAlbumDetails {
            id: "album789".to_string(),
            title: "My Photos".to_string(),
            cover_url: "https://example.com/thumb.jpg".to_string(),
            channel: Some("Artist".to_string()),
            images: vec![PhotoImage {
                index: 1,
                preview_url: "https://example.com/1.jpg".to_string(),
                download_url: "https://example.com/1.jpg".to_string(),
                width: None,
                height: None,
            }],
        };

        let details = MediaDetails::PhotoAlbum(original_album.clone());
        let meta: VideoMetadata = details.clone().into();
        assert_eq!(meta.post_type, PostType::PhotoPost);
        assert_eq!(meta.images.len(), 1);

        let roundtrip: MediaDetails = meta.into();
        assert_eq!(roundtrip, details);
    }

    #[test]
    fn test_download_outcome_serialization() {
        let video_outcome = DownloadOutcome::Video {
            file_path: "C:\\Downloads\\video.mp4".to_string(),
            file_name: "video.mp4".to_string(),
        };
        let json = serde_json::to_string(&video_outcome).unwrap();
        assert!(json.contains(r#""kind":"video""#));
        assert_eq!(video_outcome.primary_file_name(), Some("video.mp4"));
        assert_eq!(video_outcome.primary_file_path(), Some("C:\\Downloads\\video.mp4"));

        let photo_outcome = DownloadOutcome::PhotoAlbum {
            total: 3,
            succeeded: 3,
            failed_indices: vec![],
            saved_files: vec!["img_01.jpg".to_string(), "img_02.jpg".to_string()],
            folder_path: "C:\\Downloads".to_string(),
            primary_file_path: Some("C:\\Downloads\\img_01.jpg".to_string()),
        };
        let json_photo = serde_json::to_string(&photo_outcome).unwrap();
        assert!(json_photo.contains(r#""kind":"photo_album""#));
        assert_eq!(photo_outcome.primary_file_name(), Some("img_01.jpg"));
        assert_eq!(photo_outcome.primary_file_path(), Some("C:\\Downloads\\img_01.jpg"));
    }
}
