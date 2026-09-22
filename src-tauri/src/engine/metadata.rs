use crate::engine::detector::get_binaries;
use crate::models::{MediaDetails, QualityOption, VideoDetails};
use serde_json::Value;
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn fetch_media_details(url: &str, browser: Option<&str>) -> Result<MediaDetails, String> {
    let url = super::validate_url(url)?;

    // If it's a TikTok URL, check if it is a photo post (carousel/slideshow)
    if super::photo_extractor::is_tiktok_url(&url) {
        match super::photo_extractor::fetch_tiktok_photo_details(&url) {
            Ok(Some(photo_meta)) => return Ok(MediaDetails::PhotoAlbum(photo_meta)),
            Ok(None) => {
                // Not a photo post, fall through to standard video extraction
            }
            Err(e) => {
                // If it explicitly has "/photo/" in the URL and failed, report the error directly
                if url.contains("/photo/") {
                    return Err(e);
                }
                // Otherwise fall through to yt-dlp
            }
        }
    }

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

    if let Some(target) = super::get_browser_cookie_target(browser) {
        cmd.args(["--cookies-from-browser", target]);
    }

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
    let raw_title = v["title"].as_str().unwrap_or("").trim();
    let is_direct_stream = super::is_direct_stream_url(&url);

    let title = if (raw_title.is_empty()
        || raw_title == "ไม่มีชื่อคลิป"
        || raw_title == "master"
        || raw_title == "index"
        || raw_title == "live"
        || raw_title == "playlist")
        && is_direct_stream
    {
        let epoch = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("Stream_{epoch}")
    } else if raw_title.is_empty() {
        "ไม่มีชื่อคลิป".to_string()
    } else {
        raw_title.to_string()
    };
    let thumbnail = v["thumbnails"]
        .as_array()
        .and_then(|arr| arr.iter().filter_map(|t| t["url"].as_str()).last())
        .map(|s| s.to_string())
        .or_else(|| v["thumbnail"].as_str().map(|s| s.to_string()))
        .unwrap_or_default();
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

    let filesize_approx = qualities.iter().find_map(|q| q.filesize_approx);

    Ok(MediaDetails::Video(VideoDetails {
        id,
        title,
        thumbnail,
        duration,
        channel,
        filesize_approx,
        qualities,
    }))
}

fn format_spec_for_dim(dim: u64) -> String {
    format!(
        "bestvideo[height<={0}]+bestaudio/bestvideo[width<={0}]+bestaudio/best[height<={0}]/best[width<={0}]/best",
        dim
    )
}

fn estimate_filesize(formats: &[Value], duration: Option<f64>, target_dim: Option<u64>, is_audio: bool) -> Option<u64> {
    if is_audio {
        let audio_f = formats.iter().find(|f| f["vcodec"].as_str() == Some("none") && f["acodec"].as_str() != Some("none"));
        if let Some(f) = audio_f {
            if let Some(size) = f["filesize"].as_u64().or_else(|| f["filesize_approx"].as_u64()) {
                return Some(size);
            }
            if let (Some(tbr), Some(dur)) = (f["tbr"].as_f64().or_else(|| f["abr"].as_f64()), duration) {
                return Some((tbr * 1000.0 / 8.0 * dur) as u64);
            }
        }
    } else if let Some(dim) = target_dim {
        let video_f = formats.iter().find(|f| {
            let h = f["height"].as_u64().unwrap_or(0);
            let w = f["width"].as_u64().unwrap_or(0);
            let d = if w > 0 && h > 0 { w.min(h) } else { h.max(w) };
            d <= dim && f["vcodec"].as_str() != Some("none")
        });
        if let Some(f) = video_f {
            if let Some(size) = f["filesize"].as_u64().or_else(|| f["filesize_approx"].as_u64()) {
                if f["acodec"].as_str() == Some("none") {
                    let audio_size = duration.map(|d| (128_000.0 / 8.0 * d) as u64).unwrap_or(0);
                    return Some(size + audio_size);
                }
                return Some(size);
            }
            if let (Some(tbr), Some(dur)) = (f["tbr"].as_f64(), duration) {
                return Some((tbr * 1000.0 / 8.0 * dur) as u64);
            }
        }
    } else {
        let best_f = formats
            .iter()
            .filter(|f| f["vcodec"].as_str() != Some("none"))
            .max_by_key(|f| f["tbr"].as_f64().unwrap_or(0.0) as u64);
        if let Some(f) = best_f {
            if let Some(size) = f["filesize"].as_u64().or_else(|| f["filesize_approx"].as_u64()) {
                return Some(size);
            }
            if let (Some(tbr), Some(dur)) = (f["tbr"].as_f64(), duration) {
                return Some((tbr * 1000.0 / 8.0 * dur) as u64);
            }
        }
    }
    None
}

pub fn determine_qualities(v: &Value, has_ffmpeg: bool) -> Vec<QualityOption> {
    let mut qualities = Vec::new();
    let duration = v["duration"].as_f64();
    let empty_formats = Vec::new();
    let formats = v["formats"].as_array().unwrap_or(&empty_formats);

    // Determine max available video dimension using the shorter edge min(width, height)
    // to accurately represent resolution for both landscape (16:9) and portrait/vertical (9:16) videos.
    let (has_video, max_dim) = if !formats.is_empty() {
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
                    filesize_approx: estimate_filesize(formats, duration, Some(2160), false),
                });
            }
            if max_dim >= 1440 {
                qualities.push(QualityOption {
                    id: "1440".into(),
                    label: "2K QHD (1440p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(1440),
                    filesize_approx: estimate_filesize(formats, duration, Some(1440), false),
                });
            }
            if max_dim >= 1080 {
                qualities.push(QualityOption {
                    id: "1080".into(),
                    label: "Full HD (1080p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(1080),
                    filesize_approx: estimate_filesize(formats, duration, Some(1080), false),
                });
            }
            if max_dim >= 720 {
                qualities.push(QualityOption {
                    id: "720".into(),
                    label: "HD (720p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(720),
                    filesize_approx: estimate_filesize(formats, duration, Some(720), false),
                });
            }
            if max_dim >= 480 {
                qualities.push(QualityOption {
                    id: "480".into(),
                    label: "SD (480p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(480),
                    filesize_approx: estimate_filesize(formats, duration, Some(480), false),
                });
            }
            if max_dim >= 360 && max_dim < 480 {
                qualities.push(QualityOption {
                    id: "360".into(),
                    label: "SD (360p)".into(),
                    ext: "mp4".into(),
                    format_spec: format_spec_for_dim(360),
                    filesize_approx: estimate_filesize(formats, duration, Some(360), false),
                });
            }

            // Always offer Best Quality option
            qualities.push(QualityOption {
                id: "best".into(),
                label: "ความละเอียดสูงสุดที่มี (Best)".into(),
                ext: "mp4".into(),
                format_spec: "bestvideo+bestaudio/best".into(),
                filesize_approx: estimate_filesize(formats, duration, None, false),
            });
        }

        // Audio conversion requires FFmpeg.
        qualities.push(QualityOption {
            id: "audio".into(),
            label: "เสียงเท่านั้น (MP3)".into(),
            ext: "mp3".into(),
            format_spec: "bestaudio/best".into(),
            filesize_approx: estimate_filesize(formats, duration, None, true),
        });
        qualities.push(QualityOption {
            id: "audio-wav".into(),
            label: "เสียงเท่านั้น (WAV)".into(),
            ext: "wav".into(),
            format_spec: "audio-wav".into(),
            filesize_approx: None,
        });
    } else {
        // Without FFmpeg, can only download pre-merged progressive MP4
        qualities.push(QualityOption {
            id: "best".into(),
            label: "ต้นฉบับ MP4 (ไม่ต้องใช้ FFmpeg)".into(),
            ext: "mp4".into(),
            format_spec: "best[ext=mp4]/best".into(),
            filesize_approx: estimate_filesize(formats, duration, None, false),
        });
    }

    // High-resolution image/thumbnail download option
    qualities.push(QualityOption {
        id: "thumbnail".into(),
        label: "รูปภาพปกความละเอียดสูงสุด (Image)".into(),
        ext: "jpg".into(),
        format_spec: "thumbnail".into(),
        filesize_approx: None,
    });

    qualities
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn audio_download_choices_require_ffmpeg_and_offer_mp3_and_wav() {
        let media = json!({"formats": []});
        let choices = determine_qualities(&media, true);
        for (ext, preset) in [("mp3", "bestaudio/best"), ("wav", "audio-wav")] {
            let choice = choices.iter().find(|q| q.ext == ext).expect("audio choice");
            assert_eq!(choice.format_spec, preset);
            assert!(crate::engine::downloader::is_valid_format_spec(&choice.format_spec));
        }
        assert!(!determine_qualities(&media, false).iter().any(|q| q.ext == "mp3" || q.ext == "wav"));
    }

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
        assert_eq!(qualities.len(), 2);
        assert_eq!(qualities[0].id, "best");
        assert_eq!(qualities[0].format_spec, "best[ext=mp4]/best");
        assert_eq!(qualities[1].id, "thumbnail");
    }

    #[test]
    fn test_thumbnail_option_and_filesize_estimation() {
        let v = json!({
            "duration": 120.0,
            "formats": [
                {"format_id": "audio", "vcodec": "none", "acodec": "aac", "filesize": 2_000_000},
                {"format_id": "v720", "width": 1280, "height": 720, "vcodec": "h264", "acodec": "none", "filesize": 10_000_000}
            ]
        });

        let qualities = determine_qualities(&v, true);
        assert!(qualities.iter().any(|q| q.id == "thumbnail" && q.format_spec == "thumbnail"));

        let q_audio = qualities.iter().find(|q| q.id == "audio").unwrap();
        assert_eq!(q_audio.filesize_approx, Some(2_000_000));

        let q_720 = qualities.iter().find(|q| q.id == "720").unwrap();
        assert!(q_720.filesize_approx.is_some());
    }
}


