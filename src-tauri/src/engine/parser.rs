use crate::models::DownloadProgressPayload;
use regex::Regex;
use std::sync::OnceLock;

static RE_STANDARD: OnceLock<Regex> = OnceLock::new();
static RE_DESTINATION: OnceLock<Regex> = OnceLock::new();

pub fn parse_stdout_line(line: &str) -> Option<DownloadProgressPayload> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Case 0: Final destination path marker emitted by yt-dlp --print after_move:FINAL_OUTPUT:%(filepath)s
    if trimmed.starts_with("FINAL_OUTPUT:") {
        let path = trimmed["FINAL_OUTPUT:".len()..].trim();
        let fname = std::path::Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string());

        return Some(DownloadProgressPayload {
            progress: 100.0,
            speed: "-".to_string(),
            eta: "00:00".to_string(),
            status: "completed".to_string(),
            message: "บันทึกไฟล์เรียบร้อยแล้ว".to_string(),
            filename: fname,
        });
    }

    // Case 1: Custom template `download: <percent>| <speed>| <eta>`
    if trimmed.starts_with("download:") {
        let content = &trimmed[9..];
        let parts: Vec<&str> = content.split('|').collect();
        if parts.len() >= 3 {
            let percent_raw = parts[0].trim().replace('%', "");
            let percent: f32 = percent_raw.parse().unwrap_or(0.0);
            let speed = parts[1].trim();
            let eta = parts[2].trim();

            let speed_clean = if speed.is_empty() || speed == "NA" {
                "-".to_string()
            } else {
                speed.to_string()
            };

            let eta_clean = if eta.is_empty() || eta == "NA" {
                "-".to_string()
            } else {
                eta.to_string()
            };

            return Some(DownloadProgressPayload {
                progress: percent,
                speed: speed_clean,
                eta: eta_clean,
                status: "downloading".to_string(),
                message: format!("กำลังดาวน์โหลด... {:.1}%", percent),
                filename: None,
            });
        }
    }

    // Case 2: Standard fallback `[download]  67.4% of ... at 8.20MiB/s ETA 00:15`
    if trimmed.starts_with("[download]") {
        let re = RE_STANDARD.get_or_init(|| {
            Regex::new(r"\[download\]\s+([0-9.]+)%.*?at\s+([^\s]+)\s+ETA\s+([^\s]+)").unwrap()
        });

        if let Some(caps) = re.captures(trimmed) {
            let percent: f32 = caps
                .get(1)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0.0);
            let speed = caps
                .get(2)
                .map(|m| m.as_str().to_string())
                .unwrap_or_else(|| "-".into());
            let eta = caps
                .get(3)
                .map(|m| m.as_str().to_string())
                .unwrap_or_else(|| "-".into());

            return Some(DownloadProgressPayload {
                progress: percent,
                speed,
                eta,
                status: "downloading".to_string(),
                message: format!("กำลังดาวน์โหลด... {:.1}%", percent),
                filename: None,
            });
        }

        if trimmed.contains("100%") {
            return Some(DownloadProgressPayload {
                progress: 100.0,
                speed: "-".to_string(),
                eta: "00:00".to_string(),
                status: "downloading".to_string(),
                message: "ดาวน์โหลดครบแล้ว กำลังจัดเก็บไฟล์...".to_string(),
                filename: None,
            });
        }

        if trimmed.contains("has already been downloaded") {
            let re_dest = RE_DESTINATION.get_or_init(|| {
                Regex::new(r"\[download\]\s+(.*?)\s+has already been downloaded").unwrap()
            });
            let fname = re_dest
                .captures(trimmed)
                .and_then(|c| c.get(1))
                .map(|m| std::path::Path::new(m.as_str()).file_name().unwrap_or_default().to_string_lossy().to_string());

            return Some(DownloadProgressPayload {
                progress: 100.0,
                speed: "-".to_string(),
                eta: "00:00".to_string(),
                status: "completed".to_string(),
                message: "ไฟล์นี้เคยดาวน์โหลดไว้แล้ว".to_string(),
                filename: fname,
            });
        }
    }

    // Case 3: Merger / FFmpeg postprocess
    if trimmed.contains("[Merger]") || trimmed.contains("Merging formats into") {
        return Some(DownloadProgressPayload {
            progress: 99.0,
            speed: "-".to_string(),
            eta: "-".to_string(),
            status: "merging".to_string(),
            message: "กำลังรวมภาพและเสียงด้วย FFmpeg...".to_string(),
            filename: None,
        });
    }

    // Case 4: ExtractAudio / Transcode
    if trimmed.contains("[ExtractAudio]") {
        return Some(DownloadProgressPayload {
            progress: 99.0,
            speed: "-".to_string(),
            eta: "-".to_string(),
            status: "merging".to_string(),
            message: "กำลังแปลงเป็นไฟล์เสียง...".to_string(),
            filename: None,
        });
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_custom_template_parser() {
        let line = "download:  67.4%|  8.20MiB/s|  00:15";
        let parsed = parse_stdout_line(line).expect("Should parse custom template");
        assert!((parsed.progress - 67.4).abs() < 0.01);
        assert_eq!(parsed.speed, "8.20MiB/s");
        assert_eq!(parsed.eta, "00:15");
        assert_eq!(parsed.status, "downloading");
    }

    #[test]
    fn test_standard_output_parser() {
        let line = "[download]  35.0% of ~ 20.00MiB at  4.50MiB/s ETA 00:08";
        let parsed = parse_stdout_line(line).expect("Should parse standard output");
        assert!((parsed.progress - 35.0).abs() < 0.01);
        assert_eq!(parsed.speed, "4.50MiB/s");
        assert_eq!(parsed.eta, "00:08");
    }

    #[test]
    fn test_merger_parser() {
        let line = "[Merger] Merging formats into \"C:\\Downloads\\video.mp4\"";
        let parsed = parse_stdout_line(line).expect("Should parse merger line");
        assert_eq!(parsed.status, "merging");
        assert!((parsed.progress - 99.0).abs() < 0.01);
    }

    #[test]
    fn test_final_output_parser() {
        let line = "FINAL_OUTPUT:C:\\Downloads\\video [aqz-KE-bpKQ].mp4";
        let parsed = parse_stdout_line(line).expect("Should parse final output");
        assert_eq!(parsed.status, "completed");
        assert_eq!(parsed.filename, Some("video [aqz-KE-bpKQ].mp4".to_string()));
    }
}
