use crate::engine::detector::get_binaries;
use crate::engine::downloader::{DownloadManager, Operation};
use crate::engine::photo_extractor::fetch_tiktok_photo_details;
use crate::engine::validate_url;
use crate::models::{DownloadOutcome, DownloadProgressPayload};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tokio::io::AsyncReadExt;
use tokio::sync::watch;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// RAII Guard ensuring temporary directory cleanup upon exit or early return.
struct TempDirGuard(PathBuf);

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

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

    // Limit length to avoid exceeding Windows MAX_PATH
    if cleaned.chars().count() > 80 {
        cleaned = cleaned.chars().take(80).collect();
    }
    cleaned
}

/// Checks asynchronously if a file starts with JPEG SOI magic bytes (FF D8 FF).
pub async fn is_jpeg_file(path: &Path) -> bool {
    if let Ok(mut file) = tokio::fs::File::open(path).await {
        let mut buf = [0u8; 3];
        if file.read_exact(&mut buf).await.is_ok() {
            return buf == [0xFF, 0xD8, 0xFF];
        }
    }
    false
}

/// Downloads an image from a URL to a target path asynchronously using curl.exe with instant cancellation support.
pub async fn fetch_image_to_path_cancellable(
    url: &str,
    target: &Path,
    cancelled: &mut watch::Receiver<bool>,
) -> Result<(), String> {
    if *cancelled.borrow() {
        return Err("ยกเลิกการดาวน์โหลดแล้ว".into());
    }

    let mut cmd = tokio::process::Command::new("curl.exe");
    cmd.kill_on_drop(true);
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

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("ไม่สามารถเรียกใช้งาน curl.exe: {}", e))?;

    tokio::select! {
        biased;
        _ = async { let _ = cancelled.wait_for(|c| *c).await; } => {
            let _ = crate::engine::downloader::terminate_process_tree(&mut child).await;
            Err("ยกเลิกการดาวน์โหลดแล้ว".into())
        }
        status_res = child.wait() => {
            let status = status_res.map_err(|e| format!("curl error: {}", e))?;
            if !status.success() {
                return Err("ดาวน์โหลดรูปภาพไม่สำเร็จ (curl exit failure)".into());
            }
            let meta = tokio::fs::metadata(target)
                .await
                .map_err(|e| format!("ไม่พบไฟล์ที่ดาวน์โหลด: {}", e))?;

            if meta.len() == 0 {
                return Err("ไฟล์รูปภาพที่ดาวน์โหลดมีขนาด 0 ไบต์".into());
            }

            Ok(())
        }
    }
}

pub async fn fetch_image_to_path(url: &str, target: &Path) -> Result<(), String> {
    let (_tx, mut rx) = watch::channel(false);
    fetch_image_to_path_cancellable(url, target, &mut rx).await
}

/// Converts an input image to the requested format (jpg or png) asynchronously.
/// Preserves original JPEG bytes if input is already JPEG and target is jpg.
pub async fn process_and_save_image_cancellable(
    ffmpeg_path: Option<&str>,
    temp_input: &Path,
    dest_output: &Path,
    format: &str,
    cancelled: Option<&mut watch::Receiver<bool>>,
) -> Result<(), String> {
    let target_ext = format.to_lowercase();

    if target_ext == "jpg" || target_ext == "jpeg" {
        // If the source is already valid JPEG, preserve original bytes directly without recompression
        if is_jpeg_file(temp_input).await {
            tokio::fs::copy(temp_input, dest_output)
                .await
                .map_err(|e| format!("ไม่สามารถคัดลอกไฟล์รูปภาพ: {}", e))?;
            return Ok(());
        }
    }

    // Otherwise, transcode via FFmpeg
    let ffmpeg = ffmpeg_path.ok_or("ต้องการ FFmpeg เพื่อแปลงรูปแบบรูปภาพ แต่ไม่พบในระบบ")?;
    let mut cmd = tokio::process::Command::new(ffmpeg);
    cmd.kill_on_drop(true);
    cmd.arg("-y");
    cmd.arg("-i");
    cmd.arg(temp_input);

    if target_ext == "jpg" || target_ext == "jpeg" {
        cmd.args(["-q:v", "2"]); // High quality JPEG
    }

    cmd.arg(dest_output);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("ไม่สามารถเรียกใช้งาน FFmpeg: {}", e))?;

    if let Some(c) = cancelled {
        tokio::select! {
            biased;
            _ = async { let _ = c.wait_for(|cancelled| *cancelled).await; } => {
                let _ = crate::engine::downloader::terminate_process_tree(&mut child).await;
                return Err("ยกเลิกการดาวน์โหลดแล้ว".into());
            }
            status_res = child.wait() => {
                let status = status_res.map_err(|e| format!("FFmpeg error: {}", e))?;
                if !status.success() {
                    return Err("FFmpeg แปลงรูปภาพไม่สำเร็จ".into());
                }
            }
        }
    } else {
        let status = child
            .wait()
            .await
            .map_err(|e| format!("ไม่สามารถเรียกใช้งาน FFmpeg: {}", e))?;
        if !status.success() {
            return Err("FFmpeg แปลงรูปภาพไม่สำเร็จ".into());
        }
    }

    let meta = tokio::fs::metadata(dest_output)
        .await
        .map_err(|e| format!("ไม่พบไฟล์ผลลัพธ์หลังแปลง: {}", e))?;

    if meta.len() == 0 {
        return Err("ไฟล์ผลลัพธ์หลังแปลงมีขนาด 0 ไบต์".into());
    }

    Ok(())
}

pub async fn process_and_save_image(
    ffmpeg_path: Option<&str>,
    temp_input: &Path,
    dest_output: &Path,
    format: &str,
) -> Result<(), String> {
    process_and_save_image_cancellable(ffmpeg_path, temp_input, dest_output, format, None).await
}

/// Generates an output filename that doesn't overwrite existing non-identical files.
pub fn generate_unique_filename(dir: &Path, base_name: &str, index: u32, ext: &str) -> PathBuf {
    let initial_name = format!("{}_{:02}.{}", base_name, index, ext);
    let initial_path = dir.join(&initial_name);
    if !initial_path.exists() {
        return initial_path;
    }

    for counter in 1..1000 {
        let candidate = dir.join(format!("{}_{:02}_{}.{}", base_name, index, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
    }

    dir.join(format!("{}_{:02}_{}.{}", base_name, index, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis(), ext))
}

pub async fn run_photo_download(
    app: AppHandle,
    manager: Arc<DownloadManager>,
    url: String,
    download_dir: String,
    format: String,
    indices: Option<Vec<usize>>,
) -> Result<DownloadOutcome, String> {
    let job = manager.begin()?;
    run_photo_download_with_job(app, manager, job, url, download_dir, format, indices).await
}

pub async fn run_photo_download_with_job(
    app: AppHandle,
    _manager: Arc<DownloadManager>,
    job: Operation,
    url: String,
    download_dir: String,
    format: String,
    indices: Option<Vec<usize>>,
) -> Result<DownloadOutcome, String> {
    let clean_url = validate_url(&url)?;
    let target_dir = PathBuf::from(&download_dir);

    if !target_dir.is_dir() {
        return Err("ไม่พบโฟลเดอร์สำหรับบันทึกไฟล์".into());
    }

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

    let photo_meta = fetch_tiktok_photo_details(&clean_url)?
        .ok_or("ลิงก์นี้ไม่ใช่โพสต์รูปภาพ TikTok".to_string())?;

    if photo_meta.images.is_empty() {
        return Err("ไม่พบรูปภาพในโพสต์นี้".into());
    }

    let target_images: Vec<(usize, &crate::models::PhotoImage)> = if let Some(ref selected) = indices {
        photo_meta
            .images
            .iter()
            .enumerate()
            .filter(|(i, _)| selected.contains(i))
            .collect()
    } else {
        photo_meta.images.iter().enumerate().collect()
    };

    if target_images.is_empty() {
        return Err("ไม่พบรูปภาพที่เลือก หรือไม่ได้เลือกรูปภาพใดๆ".into());
    }

    let total = target_images.len();
    let safe_title = sanitize_filename(&photo_meta.title);
    let target_ext = if format.to_lowercase() == "png" { "png" } else { "jpg" };

    let timestamp_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_dir_path = std::env::temp_dir().join(format!("vetch101_photos_{}_{}", std::process::id(), timestamp_id));
    let _ = tokio::fs::create_dir_all(&temp_dir_path).await;
    let _guard = TempDirGuard(temp_dir_path.clone());

    let mut succeeded = 0;
    let mut failed_indices = Vec::new();
    let mut saved_files = Vec::new();
    let mut last_saved_filename = None;

    for (step_idx, &(orig_idx, img)) in target_images.iter().enumerate() {
        job.check_cancelled()?;

        let current_num = (step_idx + 1) as u32;
        let progress_pct = (step_idx as f32 / total as f32) * 100.0;

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

        let temp_file = temp_dir_path.join(format!("temp_img_{}.tmp", orig_idx + 1));
        let dest_file = generate_unique_filename(&target_dir, &safe_title, img.index, target_ext);

        let mut image_ok = false;
        let mut cancelled_rx = job.cancelled.clone();
        if fetch_image_to_path_cancellable(&img.download_url, &temp_file, &mut cancelled_rx).await.is_ok() {
            let mut ffmpeg_cancelled_rx = job.cancelled.clone();
            if process_and_save_image_cancellable(ffmpeg_str, &temp_file, &dest_file, target_ext, Some(&mut ffmpeg_cancelled_rx)).await.is_ok() {
                image_ok = true;
                succeeded += 1;
                let fname = dest_file
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                last_saved_filename = Some(fname.clone());
                saved_files.push(fname);
            }
            let _ = tokio::fs::remove_file(&temp_file).await;
        }

        if !image_ok {
            if job.check_cancelled().is_err() {
                return Err("ยกเลิกการดาวน์โหลดแล้ว".into());
            }
            failed_indices.push(current_num);
        }
    }

    job.check_cancelled()?;

    if succeeded == 0 {
        return Err("ไม่สามารถดาวน์โหลดรูปภาพได้เลยสักรูป".into());
    }

    let completion_msg = if failed_indices.is_empty() {
        format!("ดาวน์โหลดครบทั้ง {} รูปเรียบร้อยแล้ว", total)
    } else {
        format!(
            "ดาวน์โหลดสำเร็จ {}/{} รูป (รูปที่ {:?} ไม่สำเร็จ)",
            succeeded, total, failed_indices
        )
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

    let primary_file_path = saved_files.first().map(|f| format!("{}\\{}", download_dir, f));

    Ok(DownloadOutcome::PhotoAlbum {
        total,
        succeeded,
        failed_indices,
        saved_files,
        folder_path: download_dir,
        primary_file_path,
    })
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

    #[tokio::test]
    async fn test_is_jpeg_file_with_mock_bytes() {
        let temp = std::env::temp_dir().join(format!("test_jpeg_magic_{}.tmp", std::process::id()));
        std::fs::write(&temp, [0xFF, 0xD8, 0xFF, 0xE0]).unwrap();
        assert!(is_jpeg_file(&temp).await);

        std::fs::write(&temp, [0x89, 0x50, 0x4E, 0x47]).unwrap(); // PNG magic
        assert!(!is_jpeg_file(&temp).await);

        let _ = std::fs::remove_file(&temp);
    }
}
