use crate::engine::detector::get_binaries;
use crate::models::{QualityOption, VideoMetadata};
use serde_json::Value;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn fetch_video_metadata(url: &str) -> Result<VideoMetadata, String> {
    let binaries = get_binaries();
    let ytdlp = binaries.ytdlp_path.ok_or("ไม่พบโปรแกรม yt-dlp ในระบบ")?;

    let mut cmd = Command::new(&ytdlp);

    if binaries.use_python_module {
        cmd.args(["-m", "yt_dlp"]);
    }

    cmd.args(["--dump-json", "--no-playlist", "--no-warnings"]);

    // If ffmpeg was detected, give its directory/executable to yt-dlp
    if let Some(ffmpeg) = &binaries.ffmpeg_path {
        cmd.args(["--ffmpeg-location", ffmpeg]);
    }

    cmd.arg(url);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| format!("ไม่สามารถเรียกใช้งาน yt-dlp: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp ล้มเหลว: {}", err_msg.trim()));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let v: Value = serde_json::from_str(&stdout_str)
        .map_err(|e| format!("ไม่สามารถอ่านข้อมูล JSON จาก yt-dlp: {}", e))?;

    let id = v["id"].as_str().unwrap_or("").to_string();
    let title = v["title"].as_str().unwrap_or("ไม่มีชื่อคลิป").to_string();
    let thumbnail = v["thumbnail"].as_str().unwrap_or("").to_string();
    let duration = v["duration"].as_f64();
    let channel = v["channel"].as_str().or_else(|| v["uploader"].as_str()).map(|s| s.to_string());

    // Standard preset quality options
    let qualities = vec![
        QualityOption {
            id: "1080".to_string(),
            label: "1080p Full HD (MP4)".to_string(),
            format_spec: "bestvideo[height<=1080]+bestaudio/best[height<=1080]".to_string(),
        },
        QualityOption {
            id: "720".to_string(),
            label: "720p HD (MP4)".to_string(),
            format_spec: "bestvideo[height<=720]+bestaudio/best[height<=720]".to_string(),
        },
        QualityOption {
            id: "480".to_string(),
            label: "480p SD (MP4)".to_string(),
            format_spec: "bestvideo[height<=480]+bestaudio/best[height<=480]".to_string(),
        },
        QualityOption {
            id: "best".to_string(),
            label: "Best Quality (สูงสุดที่มี)".to_string(),
            format_spec: "bestvideo+bestaudio/best".to_string(),
        },
        QualityOption {
            id: "audio".to_string(),
            label: "Audio Only (เสียงเพลง)".to_string(),
            format_spec: "bestaudio/best".to_string(),
        },
    ];

    Ok(VideoMetadata {
        id,
        title,
        thumbnail,
        duration,
        channel,
        qualities,
    })
}
