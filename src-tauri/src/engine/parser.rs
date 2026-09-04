use crate::models::DownloadProgressPayload;
use regex::Regex;
use std::sync::OnceLock;

static RE_STANDARD: OnceLock<Regex> = OnceLock::new();

pub fn parse_stdout_line(line: &str) -> Option<DownloadProgressPayload> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Case 1: Custom template `download: <percent>| <speed>| <eta>| <total_size>`
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
            });
        }
    }

    // Case 2: Standard fallback `[download]  67.4% of ... at 8.20MiB/s ETA 00:15`
    if trimmed.starts_with("[download]") {
        let re = RE_STANDARD.get_or_init(|| {
            Regex::new(r"\[download\]\s+([0-9.]+)%.*?at\s+([^\s]+)\s+ETA\s+([^\s]+)").unwrap()
        });

        if let Some(caps) = re.captures(trimmed) {
            let percent: f32 = caps.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0.0);
            let speed = caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_else(|| "-".into());
            let eta = caps.get(3).map(|m| m.as_str().to_string()).unwrap_or_else(|| "-".into());

            return Some(DownloadProgressPayload {
                progress: percent,
                speed,
                eta,
                status: "downloading".to_string(),
                message: format!("กำลังดาวน์โหลด... {:.1}%", percent),
            });
        }

        if trimmed.contains("100%") {
            return Some(DownloadProgressPayload {
                progress: 100.0,
                speed: "-".to_string(),
                eta: "00:00".to_string(),
                status: "downloading".to_string(),
                message: "ดาวน์โหลดเสร็จสิ้น กำลังประมวลผล...".to_string(),
            });
        }

        if trimmed.contains("has already been downloaded") {
            return Some(DownloadProgressPayload {
                progress: 100.0,
                speed: "-".to_string(),
                eta: "00:00".to_string(),
                status: "completed".to_string(),
                message: "ไฟล์นี้เคยดาวน์โหลดไว้แล้ว".to_string(),
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
        });
    }

    // Case 4: ExtractAudio / Transcode
    if trimmed.contains("[ExtractAudio]") {
        return Some(DownloadProgressPayload {
            progress: 99.0,
            speed: "-".to_string(),
            eta: "-".to_string(),
            status: "merging".to_string(),
            message: "กำลังแปลงไฟล์เสียง...".to_string(),
        });
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_custom_template_parser() {
        let line = "download:  67.4%|  8.20MiB/s|  00:15|  150.2MiB";
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
}
