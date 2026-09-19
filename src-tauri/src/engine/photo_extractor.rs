use crate::models::{PhotoImage, PostType, VideoMetadata};
use serde_json::Value;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Pure parser that extracts photo post metadata from TikWM / TikTok JSON response.
/// Returns `Ok(Some(VideoMetadata))` if the response represents an image/photo post with images.
/// Returns `Ok(None)` if the response represents a standard video post (no images),
/// allowing the caller to fall through to yt-dlp.
pub fn parse_tiktok_photo_json(json_str: &str, original_url: &str) -> Result<Option<VideoMetadata>, String> {
    let root: Value = serde_json::from_str(json_str)
        .map_err(|e| format!("ไม่สามารถอ่านข้อมูล JSON จากเซิร์ฟเวอร์ได้: {}", e))?;

    let code = root["code"].as_i64().unwrap_or(-1);
    if code != 0 {
        let msg = root["msg"].as_str().unwrap_or("Unknown error");
        return Err(format!("ไม่สามารถดึงข้อมูลจาก TikTok ได้: {}", msg));
    }

    let data = &root["data"];
    if data.is_null() {
        return Ok(None);
    }

    // If "images" is an array with at least one element, this is a photo post.
    let image_urls = match data["images"].as_array() {
        Some(arr) if !arr.is_empty() => arr,
        _ => return Ok(None),
    };

    let id = data["id"].as_str().unwrap_or_default().to_string();
    let raw_title = data["title"].as_str().unwrap_or_default().trim();
    let author_nickname = data["author"]["nickname"].as_str().unwrap_or_default();
    let author_id = data["author"]["unique_id"].as_str().unwrap_or_default();

    let channel_display = if !author_nickname.is_empty() {
        Some(author_nickname.to_string())
    } else if !author_id.is_empty() {
        Some(format!("@{}", author_id))
    } else {
        None
    };

    let title = if !raw_title.is_empty() {
        raw_title.to_string()
    } else if let Some(ref ch) = channel_display {
        format!("โพสต์รูปภาพของ {}", ch)
    } else {
        "โพสต์รูปภาพ TikTok".to_string()
    };

    let cover_url = data["cover"]
        .as_str()
        .or_else(|| data["origin_cover"].as_str())
        .unwrap_or_default()
        .to_string();

    let mut images = Vec::with_capacity(image_urls.len());
    for (idx, item) in image_urls.iter().enumerate() {
        if let Some(url_str) = item.as_str() {
            images.push(PhotoImage {
                index: (idx + 1) as u32,
                preview_url: url_str.to_string(),
                download_url: url_str.to_string(),
                width: None,
                height: None,
            });
        }
    }

    if images.is_empty() {
        return Ok(None);
    }

    let thumbnail = if !cover_url.is_empty() {
        cover_url
    } else {
        images[0].preview_url.clone()
    };

    Ok(Some(VideoMetadata {
        id: if !id.is_empty() { id } else { original_url.to_string() },
        title,
        thumbnail,
        duration: None,
        channel: channel_display,
        filesize_approx: None,
        qualities: vec![],
        post_type: PostType::PhotoPost,
        images,
    }))
}

/// Checks if a given URL is a legitimate TikTok domain URL.
pub fn is_tiktok_url(url: &str) -> bool {
    if let Ok(parsed) = tauri::Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            let h = host.to_lowercase();
            return h == "tiktok.com"
                || h.ends_with(".tiktok.com")
                || h == "tiktokv.com"
                || h.ends_with(".tiktokv.com");
        }
    }
    false
}

/// Attempts to fetch TikTok photo post metadata via TikWM API.
/// If successful and the post is a photo post, returns `Ok(Some(meta))`.
/// If the post is a video post, returns `Ok(None)`.
/// If the request fails or is not TikTok, returns `Err(msg)` or `Ok(None)`.
pub fn fetch_tiktok_photo_metadata(url: &str) -> Result<Option<VideoMetadata>, String> {
    if !is_tiktok_url(url) {
        return Ok(None);
    }

    let mut api_url = tauri::Url::parse("https://www.tikwm.com/api/")
        .map_err(|e| format!("Invalid base API URL: {}", e))?;
    api_url.query_pairs_mut().append_pair("url", url);
    let api_url_str = api_url.to_string();

    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "-s",
        "-L",
        "-A",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--connect-timeout",
        "10",
        "--max-time",
        "20",
        &api_url_str,
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("ไม่สามารถเชื่อมต่อเพื่อดึงข้อมูลรูปภาพ: {}", e))?;

    if !output.status.success() {
        return Err("ไม่สามารถเชื่อมต่อกับบริการดึงรูปภาพ TikTok ได้".into());
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    parse_tiktok_photo_json(&stdout_str, url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_tiktok_url() {
        assert!(is_tiktok_url("https://www.tiktok.com/@user/photo/123456789"));
        assert!(is_tiktok_url("https://vt.tiktok.com/ZSabc123/"));
        assert!(is_tiktok_url("https://m.tiktok.com/v/123.html"));
        assert!(!is_tiktok_url("https://www.youtube.com/watch?v=123"));
        assert!(!is_tiktok_url("https://instagram.com/p/123"));
    }

    #[test]
    fn test_parse_photo_post_with_multiple_images() {
        let json = r#"{
            "code": 0,
            "msg": "success",
            "data": {
                "id": "7338943586698054958",
                "title": "Summer vacation photo dump",
                "cover": "https://cdn.example.com/cover.jpg",
                "author": {
                    "nickname": "Alice",
                    "unique_id": "alice_travel"
                },
                "images": [
                    "https://cdn.example.com/img1.jpg",
                    "https://cdn.example.com/img2.jpg",
                    "https://cdn.example.com/img3.jpg"
                ]
            }
        }"#;

        let result = parse_tiktok_photo_json(json, "https://tiktok.com/@alice/photo/7338943586698054958").unwrap();
        assert!(result.is_some());
        let meta = result.unwrap();
        assert_eq!(meta.post_type, PostType::PhotoPost);
        assert_eq!(meta.id, "7338943586698054958");
        assert_eq!(meta.title, "Summer vacation photo dump");
        assert_eq!(meta.channel, Some("Alice".to_string()));
        assert_eq!(meta.images.len(), 3);
        assert_eq!(meta.images[0].index, 1);
        assert_eq!(meta.images[0].preview_url, "https://cdn.example.com/img1.jpg");
        assert_eq!(meta.images[2].index, 3);
        assert_eq!(meta.images[2].download_url, "https://cdn.example.com/img3.jpg");
    }

    #[test]
    fn test_parse_video_post_returns_none() {
        let json = r#"{
            "code": 0,
            "msg": "success",
            "data": {
                "id": "7106594312292453675",
                "title": "Funny cat video",
                "play": "https://cdn.example.com/video.mp4",
                "images": null
            }
        }"#;

        let result = parse_tiktok_photo_json(json, "https://tiktok.com/@cat/video/7106594312292453675").unwrap();
        assert!(result.is_none(), "Video post should return None so caller falls through to yt-dlp");
    }

    #[test]
    fn test_parse_api_error_returns_err() {
        let json = r#"{
            "code": -1,
            "msg": "Post not found or private"
        }"#;

        let result = parse_tiktok_photo_json(json, "https://tiktok.com/@private/photo/123");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Post not found or private"));
    }

    #[test]
    fn test_fallback_title_when_blank() {
        let json = r#"{
            "code": 0,
            "msg": "success",
            "data": {
                "id": "12345",
                "title": "",
                "author": {
                    "nickname": "Bob",
                    "unique_id": "bob123"
                },
                "images": ["https://cdn.example.com/photo.jpg"]
            }
        }"#;

        let meta = parse_tiktok_photo_json(json, "https://tiktok.com/@bob/photo/12345").unwrap().unwrap();
        assert_eq!(meta.title, "โพสต์รูปภาพของ Bob");
    }
}
