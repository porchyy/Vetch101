pub mod detector;
pub mod downloader;
pub mod metadata;
pub mod parser;

pub fn validate_url(value: &str) -> Result<String, String> {
    let url = tauri::Url::parse(value.trim()).map_err(|_| "ลิงก์ไม่ถูกต้อง")?;
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
    #[test]
    fn url_boundary() {
        assert!(super::validate_url("https://www.youtube.com/watch?v=test").is_ok());
        for value in [
            "--exec=calc",
            "file:///etc/passwd",
            "https://user:password@example.com",
        ] {
            assert!(super::validate_url(value).is_err());
        }
    }
}
