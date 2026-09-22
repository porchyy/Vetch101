pub mod detector;
pub mod downloader;
pub mod metadata;
pub mod parser;
pub mod photo_downloader;
pub mod photo_extractor;
pub mod pipeline;
pub mod updater;
#[cfg(windows)]
pub mod process_job;

pub fn validate_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("กรุณาระบุลิงก์วิดีโอ".into());
    }

    if trimmed.chars().any(|c| c.is_whitespace()) {
        return Err("ลิงก์ต้องไม่มีช่องว่าง".into());
    }

    // Detect multiple concatenated URLs (e.g. https://...https://...)
    let lower = trimmed.to_ascii_lowercase();
    let http_count = lower.match_indices("http://").count() + lower.match_indices("https://").count();
    if http_count > 1 {
        return Err("พบลิงก์ซ้อนกัน กรุณาวางลิงก์วิดีโอเพียงอันเดียว".into());
    }

    let url = tauri::Url::parse(trimmed).map_err(|_| "ลิงก์ไม่ถูกต้อง")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("กรุณาใช้ลิงก์ http:// หรือ https:// ที่ไม่มีข้อมูลเข้าสู่ระบบ".into());
    }

    Ok(url.to_string())
}

pub const SUPPORTED_BROWSERS: &[&str] = &["chrome", "edge", "brave", "firefox"];

pub fn get_browser_cookie_target(browser: Option<&str>) -> Option<&'static str> {
    if let Some(b) = browser {
        let trimmed = b.trim();
        for &s in SUPPORTED_BROWSERS {
            if s.eq_ignore_ascii_case(trimmed) {
                return Some(s);
            }
        }
    }
    None
}

pub fn is_direct_stream_url(url: &str) -> bool {
    let clean = url.split(['?', '#']).next().unwrap_or("").to_ascii_lowercase();
    clean.ends_with(".m3u8") || clean.ends_with(".mpd")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_urls() {
        assert!(validate_url("https://www.youtube.com/watch?v=aqz-KE-bpKQ").is_ok());
        assert!(validate_url("https://youtu.be/aqz-KE-bpKQ").is_ok());
        assert!(validate_url("http://example.com/video.mp4").is_ok());
    }

    #[test]
    fn test_rejects_concatenated_urls() {
        let double_url = "https://www.youtube.com/watch?v=123https://www.youtube.com/watch?v=456";
        assert_eq!(
            validate_url(double_url),
            Err("พบลิงก์ซ้อนกัน กรุณาวางลิงก์วิดีโอเพียงอันเดียว".into())
        );

        let double_http = "http://site.com/ahttps://site.com/b";
        assert!(validate_url(double_http).is_err());
    }

    #[test]
    fn test_rejects_whitespace_and_invalid_schemes() {
        assert!(validate_url("https://youtube.com /watch").is_err());
        assert!(validate_url("--exec=calc").is_err());
        assert!(validate_url("file:///etc/passwd").is_err());
        assert!(validate_url("https://user:pass@example.com/video").is_err());
    }

    #[test]
    fn test_is_direct_stream_url() {
        assert!(is_direct_stream_url("https://example.com/live/playlist.m3u8"));
        assert!(is_direct_stream_url("https://example.com/live/playlist.M3U8?token=abc#seg"));
        assert!(is_direct_stream_url("https://example.com/manifest.mpd?sign=1"));
        assert!(!is_direct_stream_url("https://example.com/watch?v=123"));
        assert!(!is_direct_stream_url("https://example.com/page.html"));
    }

    #[test]
    fn test_get_browser_cookie_target() {
        assert_eq!(get_browser_cookie_target(Some("chrome")), Some("chrome"));
        assert_eq!(get_browser_cookie_target(Some("EDGE")), Some("edge"));
        assert_eq!(get_browser_cookie_target(Some("Brave")), Some("brave"));
        assert_eq!(get_browser_cookie_target(Some("firefox")), Some("firefox"));
        assert_eq!(get_browser_cookie_target(Some("unknown_browser")), None);
        assert_eq!(get_browser_cookie_target(None), None);
    }
}
