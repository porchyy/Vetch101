use crate::models::AppUpdateInfo;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn clean_version(s: &str) -> &str {
    s.trim().trim_start_matches(['v', 'V'])
}

pub fn is_newer_version(remote: &str, current: &str) -> bool {
    let r_parts: Vec<u32> = clean_version(remote)
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let c_parts: Vec<u32> = clean_version(current)
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();

    if r_parts.is_empty() || c_parts.is_empty() {
        return false;
    }

    let max_len = r_parts.len().max(c_parts.len());
    for i in 0..max_len {
        let r = r_parts.get(i).copied().unwrap_or(0);
        let c = c_parts.get(i).copied().unwrap_or(0);
        if r > c {
            return true;
        }
        if r < c {
            return false;
        }
    }
    false
}

pub fn is_running_installed() -> bool {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if parent.join("uninstall.exe").exists() {
                return true;
            }
        }
    }
    false
}

pub fn parse_release_json(json_str: &str, current_version: &str) -> Result<AppUpdateInfo, String> {
    let val: Value = serde_json::from_str(json_str)
        .map_err(|e| format!("ไม่สามารถแปลงข้อมูลเวอร์ชันจาก GitHub: {}", e))?;

    let tag_name = val["tag_name"]
        .as_str()
        .ok_or("ไม่พบ tag_name ในข้อมูล Release")?;
    let release_notes = val["body"].as_str().unwrap_or("").to_string();

    let mut setup_url = None;
    let mut portable_url = None;

    if let Some(assets) = val["assets"].as_array() {
        for asset in assets {
            let name = asset["name"].as_str().unwrap_or("");
            let download_url = asset["browser_download_url"].as_str().unwrap_or("");

            if name.ends_with("-setup.exe") || (name.contains("setup") && name.ends_with(".exe")) {
                setup_url = Some(download_url.to_string());
            } else if name.ends_with("-portable.zip") || (name.contains("portable") && name.ends_with(".zip")) {
                portable_url = Some(download_url.to_string());
            }
        }
    }

    let available = is_newer_version(tag_name, current_version);
    let is_installed = is_running_installed();

    Ok(AppUpdateInfo {
        available,
        current_version: current_version.to_string(),
        latest_version: tag_name.to_string(),
        release_notes,
        setup_url,
        portable_url,
        is_installed,
    })
}

pub fn check_github_release(current_version: &str) -> Result<AppUpdateInfo, String> {
    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "-s",
        "--connect-timeout",
        "10",
        "-H",
        "User-Agent: Vetch101",
        "https://api.github.com/repos/porchyy/Vetch101/releases/latest",
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("ไม่สามารถเชื่อมต่อเพื่อตรวจสอบอัปเดต: {}", e))?;

    if !output.status.success() {
        return Err("ไม่สามารถเรียกดูข้อมูลอัปเดตจาก GitHub ได้".into());
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    parse_release_json(&json_str, current_version)
}

pub fn download_installer(url: &str) -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir();
    let target_file = temp_dir.join("Vetch101_Update_Setup.exe");

    if target_file.exists() {
        let _ = std::fs::remove_file(&target_file);
    }

    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "-L",
        "--connect-timeout",
        "15",
        "-o",
        &target_file.to_string_lossy(),
        url,
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("ไม่สามารถเริ่มการดาวน์โหลดตัวติดตั้ง: {}", e))?;

    if !output.status.success() || !target_file.exists() {
        return Err("ดาวน์โหลดตัวติดตั้งไม่สำเร็จ".into());
    }

    Ok(target_file)
}

pub fn launch_installer_and_exit(installer_path: &Path) -> Result<(), String> {
    let mut cmd = Command::new(installer_path);
    // Silent install if possible, or standard interactive setup
    cmd.arg("/S");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.spawn()
        .map_err(|e| format!("ไม่สามารถเริ่มโปรแกรมติดตั้ง: {}", e))?;

    // Exit current process so files can be replaced
    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_newer_version() {
        assert!(is_newer_version("0.2.1", "0.2.0"));
        assert!(is_newer_version("v0.3.0", "0.2.0"));
        assert!(is_newer_version("1.0.0", "0.2.0"));
        assert!(!is_newer_version("0.2.0", "0.2.0"));
        assert!(!is_newer_version("v0.2.0", "0.2.0"));
        assert!(!is_newer_version("0.1.9", "0.2.0"));
        assert!(!is_newer_version("v0.1.0", "0.2.0"));
        assert!(!is_newer_version("invalid", "0.2.0"));
    }

    #[test]
    fn test_parse_release_json() {
        let sample = r#"{
            "tag_name": "v0.3.0",
            "body": "Fixed critical issues",
            "assets": [
                {
                    "name": "Vetch101_0.3.0_x64-setup.exe",
                    "browser_download_url": "https://github.com/porchyy/Vetch101/releases/download/v0.3.0/Vetch101_0.3.0_x64-setup.exe"
                },
                {
                    "name": "Vetch101_0.3.0_x64-portable.zip",
                    "browser_download_url": "https://github.com/porchyy/Vetch101/releases/download/v0.3.0/Vetch101_0.3.0_x64-portable.zip"
                }
            ]
        }"#;

        let info = parse_release_json(sample, "0.2.0").unwrap();
        assert!(info.available);
        assert_eq!(info.latest_version, "v0.3.0");
        assert_eq!(info.current_version, "0.2.0");
        assert_eq!(info.release_notes, "Fixed critical issues");
        assert_eq!(
            info.setup_url,
            Some("https://github.com/porchyy/Vetch101/releases/download/v0.3.0/Vetch101_0.3.0_x64-setup.exe".to_string())
        );
        assert_eq!(
            info.portable_url,
            Some("https://github.com/porchyy/Vetch101/releases/download/v0.3.0/Vetch101_0.3.0_x64-portable.zip".to_string())
        );
    }
}
