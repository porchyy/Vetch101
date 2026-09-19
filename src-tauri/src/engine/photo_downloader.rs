use crate::engine::detector::get_binaries;
use crate::engine::downloader::DownloadManager;
use crate::engine::photo_extractor::fetch_tiktok_photo_metadata;
use crate::engine::validate_url;
use crate::models::DownloadProgressPayload;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Sanitizes a string to be safely used as a Windows filename component.
pub fn sanitize_filename(name: &str) -> String {
    let forbidden = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let mut cleaned: String = name
        .chars()
        .map(|c| if forbidden.contains(&c) || c.is_control() { '_' } else { c })
        .collect();

    cleaned = cleaned.trim().trim_end_matches('.').to_string();
    if cleaned.is_empty() {
        cleaned = "TikTok_Photo".to_string();
    }

    // Limit length to avoid exceeding MAX_PATH
    if cleaned.chars().count() > 80 {
        cleaned = cleaned.chars().take(80).collect();
    }
    cleaned
}

/// Checks if a file starts with the JPEG SOI magic bytes (FF D8 FF).
pub fn is_jpeg_file(path: &Path) -> bool {
    if let Ok(mut file) = fs::File::open(path) {
        let mut buf = [0u8; 3];
        if file.read_exact(&mut buf).is_ok() {
            return buf == [0xFF, 0xD8, 0xFF];
        }
    }
    false
}

/// Downloads an image from a URL to a target local path using curl.exe.
pub fn fetch_image_to_path(url: &str, target: &Path) -> Result<(), String> {
    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "-s",
        "-L",
        "-A",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--connect-timeout",
        "10",
        "--max-time",
        "60",
        "-o",
    ]);
    cmd.arg(target);
    cmd.arg(url);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let status = cmd
        .status()
        .map_err(|e| format!("ไม่สามารถเรียกใช้งาน curl.exe: {}", e))?;

    if !status.success() {
        return Err("ดาวน์โหลดรูปภาพไม่สำเร็จ (curl exit failure)".into());
    }

    let meta = fs::metadata(target)
        .map_err(|e| format!("ไม่พบไฟล์ที่ดาวน์โหลด: {}", e))?;

    if meta.len() == 0 {
        return Err("ไฟล์รูปภาพที่ดาวน์โหลดมีขนาด 0 ไบต์".into());
    }

    Ok(())
}

/// Converts an input image to the requested format (jpg or png).
/// Preserves original JPEG bytes if input is already JPEG and target is jpg.
pub fn process_and_save_image(
    ffmpeg_path: Option<&str>,
    temp_input: &Path,
    dest_output: &Path,
    format: &str,
) -> Result<(), String> {
    let target_ext = format.to_lowercase();

    if target_ext == "jpg" || target_ext == "jpeg" {
        // If the source is already valid JPEG, preserve original bytes directly without recompressing
        if is_jpeg_file(temp_input) {
            fs::copy(temp_input, dest_output)
                .map_err(|e| format!("ไม่สามารถคัดลอกไฟล์รูปภาพ: {}", e))?;
            return Ok(());
        }
    }

    // Otherwise, transcode via FFmpeg
    let ffmpeg = ffmpeg_path.ok_or("ต้องการ FFmpeg เพื่อแปลงรูปแบบรูปภาพ แต่ไม่พบในระบบ")?;
    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-y");
    cmd.arg("-i");
    cmd.arg(temp_input);

    if target_ext == "jpg" || target_ext == "jpeg" {
        cmd.args(["-q:v", "2"]); // High quality JPEG
    }

    cmd.arg(dest_output);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("ไม่สามารถเรียกใช้งาน FFmpeg: {}", e))?;

    if !output.status.success() {
        let err_str = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg แปลงรูปภาพไม่สำเร็จ: {}", err_str.trim()));
    }

    let meta = fs::metadata(dest_output)
        .map_err(|e| format!("ไม่พบไฟล์ผลลัพธ์หลังแปลง: {}", e))?;

    if meta.len() == 0 {
        return Err("ไฟล์ผลลัพธ์หลังแปลงมีขนาด 0 ไบต์".into());
    }

    Ok(())
}

/// Generates an output filename that doesn't overwrite existing non-identical files.
pub fn generate_unique_filename(dir: &Path, base_name: &str, index: u32, ext: &str) -> PathBuf {
    let initial_name = format!("{}_{:02}.{}", base_name, index, ext);
    let initial_path = dir.join(&initial_name);
    if !initial_path.exists() {
        return initial_path;
    }

    // If collision, add counter
    for counter in 1..100 {
        let candidate = dir.join(format!("{}_{:02}_{}.{}", base_name, index, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
    }

    initial_path
}

/// Orchestrates the download of all photos in a TikTok photo post.
pub async fn run_photo_download(
    app: AppHandle,
    manager: Arc<DownloadManager>,
    url: String,
    download_dir: String,
    format: String,
) -> Result<usize, String> {
    let clean_url = validate_url(&url)?;
    let target_dir = PathBuf::from(&download_dir);

    if !target_dir.is_dir() {
        return Err("ไม่พบโฟลเดอร์สำหรับบันทึกไฟล์".into());
    }

    let job = manager.begin()?;
    job.check_cancelled()?;

    let binaries = get_binaries();
    let ffmpeg_str = binaries.ffmpeg_path.as_deref();

    // 1. Fetch metadata
    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            progress: 0.0,
            speed: "-".into(),
            eta: "-".into(),
            status: "preparing".into(),
            message: "กำลังอ่านข้อมูลอัลบั้มรูปภาพ...".into(),
            filename: None,
        },
    );

    let photo_meta = fetch_tiktok_photo_metadata(&clean_url)?
        .ok_or("ลิงก์นี้ไม่ใช่โพสต์รูปภาพ TikTok".to_string())?;

    if photo_meta.images.is_empty() {
        return Err("ไม่พบรูปภาพในโพสต์นี้".into());
    }

    let total = photo_meta.images.len();
    let safe_title = sanitize_filename(&photo_meta.title);
    let target_ext = if format.to_lowercase() == "png" { "png" } else { "jpg" };

    let temp_dir = std::env::temp_dir().join("vetch101_photos");
    let _ = fs::create_dir_all(&temp_dir);

    let mut successful_count = 0;
    let mut last_saved_filename = None;

    for (i, img) in photo_meta.images.iter().enumerate() {
        job.check_cancelled()?;

        let current_num = i + 1;
        let progress_pct = (i as f32 / total as f32) * 100.0;

        let _ = app.emit(
            "download-progress",
            DownloadProgressPayload {
                progress: progress_pct,
                speed: "-".into(),
                eta: "-".into(),
                status: "downloading".into(),
                message: format!("กำลังดาวน์โหลดรูปที่ {}/{}...", current_num, total),
                filename: None,
            },
        );

        let temp_file = temp_dir.join(format!("temp_img_{}_{}.tmp", std::process::id(), current_num));
        let dest_file = generate_unique_filename(&target_dir, &safe_title, img.index, target_ext);

        // Fetch to temp
        match fetch_image_to_path(&img.download_url, &temp_file) {
            Ok(()) => {
                // Convert and save
                match process_and_save_image(ffmpeg_str, &temp_file, &dest_file, target_ext) {
                    Ok(()) => {
                        successful_count += 1;
                        last_saved_filename = Some(
                            dest_file
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string(),
                        );
                    }
                    Err(e) => {
                        eprintln!("Error converting image {}: {}", current_num, e);
                    }
                }
                let _ = fs::remove_file(&temp_file);
            }
            Err(e) => {
                eprintln!("Error downloading image {}: {}", current_num, e);
                let _ = fs::remove_file(&temp_file);
            }
        }
    }

    let _ = fs::remove_dir_all(&temp_dir);

    job.check_cancelled()?;

    if successful_count == 0 {
        return Err("ไม่สามารถดาวน์โหลดรูปภาพได้".into());
    }

    let completion_msg = if successful_count == total {
        format!("ดาวน์โหลดครบทั้ง {} รูปเรียบร้อยแล้ว", total)
    } else {
        format!("ดาวน์โหลดสำเร็จ {} จากทั้งหมด {} รูป", successful_count, total)
    };

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            progress: 100.0,
            speed: "-".into(),
            eta: "-".into(),
            status: "completed".into(),
            message: completion_msg.clone(),
            filename: last_saved_filename,
        },
    );

    // Trigger desktop notification
    let _ = app
        .notification()
        .builder()
        .title("Vetch101 — ดาวน์โหลดรูปภาพเสร็จแล้ว")
        .body(completion_msg)
        .show();

    Ok(successful_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("hello:world/test?*"), "hello_world_test__");
        assert_eq!(sanitize_filename(""), "TikTok_Photo");
        assert_eq!(sanitize_filename("clean_filename"), "clean_filename");
    }

    #[test]
    fn test_is_jpeg_file_with_mock_bytes() {
        let temp = std::env::temp_dir().join("test_jpeg_magic.tmp");
        fs::write(&temp, [0xFF, 0xD8, 0xFF, 0xE0]).unwrap();
        assert!(is_jpeg_file(&temp));

        fs::write(&temp, [0x89, 0x50, 0x4E, 0x47]).unwrap(); // PNG magic
        assert!(!is_jpeg_file(&temp));

        let _ = fs::remove_file(&temp);
    }
}
