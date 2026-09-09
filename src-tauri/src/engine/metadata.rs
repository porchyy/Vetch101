use crate::engine::detector::get_binaries;
use crate::models::{QualityOption, VideoMetadata};
use serde_json::Value;
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn fetch_video_metadata(url: &str) -> Result<VideoMetadata, String> {
    let url = super::validate_url(url)?;
    let binaries = get_binaries();
    let ytdlp = binaries
        .ytdlp_path
        .ok_or("ไม่พบโปรแกรม yt-dlp ในระบบ กรุณาตรวจสอบหรืออัปเดตเครื่องมือ")?;

    let mut cmd = Command::new(&ytdlp);
    cmd.env("PYTHONIOENCODING", "utf-8");
    cmd.env("PYTHONUTF8", "1");

    if binaries.use_python_module {
        cmd.args(["-m", "yt_dlp"]);
    }

    cmd.args([
        "--ignore-config",
        "--encoding",
        "utf-8",
        "--dump-single-json",
        "--no-playlist",
        "--playlist-items",
        "1",
        "--no-warnings",
        "--socket-timeout",
        "25",
        "--retries",
        "3",
    ]);

    // Pass ffmpeg location safely if absolute path exists
    if let Some(ffmpeg) = &binaries.ffmpeg_path {
        let p = Path::new(ffmpeg);
        if p.is_absolute() && p.exists() {
            if let Some(parent) = p.parent() {
                cmd.arg("--ffmpeg-location").arg(parent);
            } else {
                cmd.arg("--ffmpeg-location").arg(p);
            }
        }
    }

    cmd.arg("--").arg(&url);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("ไม่สามารถเรียกใช้งาน yt-dlp: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        let trimmed = err_msg.trim();
        let display_err = if trimmed.contains("Private video") {
            "วิดีโอนี้เป็นวิดีโอส่วนตัว ไม่สามารถเข้าถึงได้"
        } else if trimmed.contains("Sign in") || trimmed.contains("confirm your age") {
            "วิดีโอนี้ต้องเข้าสู่ระบบหรือยืนยันอายุจากต้นทาง"
        } else if trimmed.contains("Video unavailable") {
            "ไม่พบวิดีโอนี้ หรือวิดีโอถูกลบไปแล้ว"
        } else if trimmed.contains("DRM") {
            "วิดีโอนี้ได้รับการปกป้องด้วยลิขสิทธิ์ดิจิทัล (DRM) ไม่สามารถดาวน์โหลดได้"
        } else if !trimmed.is_empty() {
            trimmed
        } else {
            "ไม่สามารถดึงข้อมูลวิดีโอจากลิงก์นี้ได้"
        };
        return Err(format!("yt-dlp: {}", display_err));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let v: Value = serde_json::from_str(&stdout_str)
        .map_err(|e| format!("ไม่สามารถอ่านข้อมูล JSON จาก yt-dlp: {}", e))?;

    let id = v["id"].as_str().unwrap_or("").to_string();
    let title = v["title"].as_str().unwrap_or("ไม่มีชื่อคลิป").to_string();
    let thumbnail = v["thumbnail"].as_str().unwrap_or("").to_string();
    let duration = v["duration"].as_f64();
    let channel = v["channel"]
        .as_str()
        .or_else(|| v["uploader"].as_str())
        .map(|s| s.to_string());

    if v["is_live"].as_bool() == Some(true) {
        return Err("ยังไม่รองรับการดาวน์โหลดขณะกำลังถ่ายทอดสด (Live)".into());
    }

    let has_ffmpeg = binaries.ffmpeg_path.is_some();
    let qualities = determine_qualities(&v, has_ffmpeg);

    if qualities.is_empty() {
        return Err("ไม่พบรูปแบบที่สามารถดาวน์โหลดได้จากคลิปนี้".into());
    }

    Ok(VideoMetadata {
        id,
        title,
        thumbnail,
        duration,
        channel,
        qualities,
    })
}

fn format_spec_for_dim(dim: u64) -> String {
    format!(
        "bestvideo[height<={0}]+bestaudio/bestvideo[width<={0}]+bestaudio/best[height<={0}]/best[width<={0}]/best",
        dim
    )
}

pub fn determine_qualities(v: &Value, has_ffmpeg: bool) -> Vec<QualityOption> {
    let mut qualities = Vec::new();

    // Determine max available video dimension using the shorter edge min(width, height)
    // to accurately represent resolution for both landscape (16:9) and portrait/vertical (9:16) videos.
    let (has_video, max_dim) = if let Some(formats) = v["formats"].as_array() {
        let has_v = formats.iter().any(|f| f["vcodec"].as_str() != Some("none"));
        let max_d = formats
            .iter()
            .filter_map(|f| {
                let h = f["height"].as_u64();
                let w = f["width"].as_u64();
                match (w, h) {
                    (Some(w), Some(h)) if w > 0 && h > 0 => Some(w.min(h)),
                    (_, Some(h)) if h > 0 => Some(h),
                    (Some(w), _) if w > 0 => Some(w),
                    _ => None,
                }
            })
            .max()
            .unwrap_or(0);
        (has_v, max_d)
    } else {
        (true, 1080)
    };

    if has_ffmpeg {
        // High to low resolution presets
        if has_video {
            if max_dim >= 2160 {
                qualities.push(QualityOption {
                    id: "2160".into(),
                    label: "4K UHD (2160p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(2160),
                });
            }
            if max_dim >= 1440 {
                qualities.push(QualityOption {
                    id: "1440".into(),
                    label: "2K QHD (1440p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(1440),
                });
            }
            if max_dim >= 1080 {
                qualities.push(QualityOption {
                    id: "1080".into(),
                    label: "Full HD (1080p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(1080),
                });
            }
            if max_dim >= 720 {
                qualities.push(QualityOption {
                    id: "720".into(),
                    label: "HD (720p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(720),
                });
            }
            if max_dim >= 480 {
                qualities.push(QualityOption {
                    id: "480".into(),
                    label: "SD (480p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(480),
                });
            }
            if max_dim >= 360 && max_dim < 480 {
                qualities.push(QualityOption {
                    id: "360".into(),
                    label: "SD (360p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(360),
                });
            }

            // Always offer Best Quality option
            qualities.push(QualityOption {
                id: "best".into(),
                label: "ความละเอียดสูงสุดที่มี (Best)".into(),
                ext: "mp4".into(),
                format_spec: "bestvideo+bestaudio/best".into(),
            });
        }

        // Audio option (always MP3 if FFmpeg is available)
        qualities.push(QualityOption {
            id: "audio".into(),
            label: "เสียงเท่านั้น (MP3)".into(),
            ext: "mp3".into(),
            format_spec: "bestaudio/best".into(),
        });
    } else {
        // Without FFmpeg, can only download pre-merged progressive MP4
        qualities.push(QualityOption {
            id: "best".into(),
            label: "ต้นฉบับ MP4 (ไม่ต้องใช้ FFmpeg)".into(),
            ext: "mp4".into(),
            format_spec: "best[ext=mp4]/best".into(),
        });
    }

    qualities
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_tiktok_vertical_resolution_does_not_overestimate_and_has_fallbacks() {
        let v = json!({
            "formats": [
                {"format_id": "audio", "vcodec": "none", "acodec": "aac"},
                {"format_id": "h264_540p", "width": 576, "height": 1024, "vcodec": "h264", "acodec": "aac"}
            ]
        });

        let qualities = determine_qualities(&v, true);
        assert!(!qualities.iter().any(|q| q.id == "720"), "576x1024 vertical video must not offer 720p");
        assert!(qualities.iter().any(|q| q.id == "480"), "576x1024 vertical video should offer 480p");
        assert!(qualities.iter().any(|q| q.id == "best"));
        assert!(qualities.iter().any(|q| q.id == "audio"));

        let q480 = qualities.iter().find(|q| q.id == "480").unwrap();
        assert_eq!(
            q480.format_spec,
            "bestvideo[height<=480]+bestaudio/bestvideo[width<=480]+bestaudio/best[height<=480]/best[width<=480]/best"
        );
    }

    #[test]
    fn test_vertical_shorts_720p_correctly_classified() {
        let v = json!({
            "formats": [
                {"format_id": "a1", "vcodec": "none", "acodec": "opus"},
                {"format_id": "v720", "width": 720, "height": 1280, "vcodec": "vp9", "acodec": "none"}
            ]
        });

        let qualities = determine_qualities(&v, true);
        assert!(!qualities.iter().any(|q| q.id == "1080"), "720x1280 vertical video must not offer 1080p despite height 1280");
        assert!(qualities.iter().any(|q| q.id == "720"), "720x1280 vertical video must offer 720p");
    }

    #[test]
    fn test_no_ffmpeg_fallback() {
        let v = json!({
            "formats": [
                {"format_id": "v720", "width": 1280, "height": 720, "vcodec": "h264", "acodec": "aac"}
            ]
        });

        let qualities = determine_qualities(&v, false);
        assert_eq!(qualities.len(), 1);
        assert_eq!(qualities[0].id, "best");
        assert_eq!(qualities[0].format_spec, "best[ext=mp4]/best");
    }
}

