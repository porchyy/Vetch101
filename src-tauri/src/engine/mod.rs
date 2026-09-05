pub mod detector;
pub mod downloader;
pub mod metadata;
pub mod parser;

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
}
