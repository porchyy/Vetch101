use crate::models::AppUpdateInfo;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::Read,
    path::{Path, PathBuf},
    process::Command,
};

#[cfg(target_os = "windows")]
use std::os::windows::{fs::OpenOptionsExt, process::CommandExt};

const CREATE_NO_WINDOW: u32 = 0x08000000;
const RELEASE_API: &str = "https://api.github.com/repos/porchyy/Vetch101/releases/latest";

#[derive(Default)]
pub struct AppUpdater {
    pub release: Option<Release>,
    pub staged: Option<StagedInstaller>,
}

pub struct Release {
    pub info: AppUpdateInfo,
    pub digest: Option<String>,
    pub size: u64,
    pub portable_digest: Option<String>,
    pub portable_size: u64,
}

pub struct StagedInstaller {
    pub directory: PathBuf,
    pub file_path: PathBuf,
    pub digest: Option<String>,
    pub size: u64,
    pub is_installed: bool,
}

impl Drop for StagedInstaller {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.directory);
    }
}

fn version_parts(version: &str) -> Option<Vec<u32>> {
    version
        .trim()
        .strip_prefix(['v', 'V']).unwrap_or(version.trim())
        .split('.')
        .map(str::parse)
        .collect::<Result<Vec<_>, _>>()
        .ok()
}

pub fn is_newer_version(remote: &str, current: &str) -> bool {
    let (Some(mut remote), Some(mut current)) = (version_parts(remote), version_parts(current))
    else {
        return false;
    };
    let len = remote.len().max(current.len());
    remote.resize(len, 0);
    current.resize(len, 0);
    remote > current
}

pub fn is_running_installed() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join("uninstall.exe").is_file()))
        .unwrap_or(false)
}

fn parse_release(json: &str, current_version: &str) -> Result<Release, String> {
    let val: Value =
        serde_json::from_str(json).map_err(|e| format!("Invalid GitHub release: {e}"))?;
    let tag = val["tag_name"]
        .as_str()
        .filter(|tag| version_parts(tag).is_some())
        .ok_or("Invalid release tag")?;
    if val["draft"].as_bool() == Some(true) || val["prerelease"].as_bool() == Some(true) {
        return Err("Release is not stable".into());
    }
    let assets = val["assets"].as_array().ok_or("Missing release assets")?;
    let version = tag.trim_start_matches(['v', 'V']);
    let setup_name = format!("Vetch101_{version}_x64-setup.exe");
    let portable_name = format!("Vetch101_{version}_x64-portable.zip");
    let mut setup_url = None;
    let mut portable_url = None;
    let mut digest = None;
    let mut size = 0;
    let mut portable_digest = None;
    let mut portable_size = 0;
    for asset in assets {
        let name = asset["name"].as_str().unwrap_or("");
        if name != setup_name && name != portable_name {
            continue;
        }
        let url = asset["browser_download_url"]
            .as_str()
            .ok_or("Missing asset URL")?;
        if url != format!("https://github.com/porchyy/Vetch101/releases/download/{tag}/{name}") {
            return Err("Asset URL does not match release tag".into());
        }
        let asset_digest = asset["digest"]
            .as_str()
            .and_then(|v| v.strip_prefix("sha256:"))
            .filter(|v| v.len() == 64 && v.bytes().all(|b| b.is_ascii_hexdigit()))
            .map(str::to_ascii_lowercase);
        let asset_size = asset["size"].as_u64().unwrap_or(0);

        if name == setup_name {
            setup_url = Some(url.to_owned());
            digest = asset_digest;
            size = asset_size;
        } else {
            portable_url = Some(url.to_owned());
            portable_digest = asset_digest;
            portable_size = asset_size;
        }
    }
    if setup_url.is_none() && portable_url.is_none() {
        return Err("Missing compatible release assets".into());
    }
    Ok(Release {
        info: AppUpdateInfo {
            available: is_newer_version(tag, current_version),
            current_version: current_version.to_owned(),
            latest_version: tag.to_owned(),
            release_notes: val["body"].as_str().unwrap_or("").to_owned(),
            setup_url,
            portable_url,
            is_installed: is_running_installed(),
        },
        digest,
        size,
        portable_digest,
        portable_size,
    })
}

pub fn parse_release_json(json: &str, current_version: &str) -> Result<AppUpdateInfo, String> {
    parse_release(json, current_version).map(|release| release.info)
}

fn curl() -> Command {
    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        "--connect-timeout",
        "10",
        "--max-time",
        "300",
        "-H",
        "User-Agent: Vetch101",
    ]);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

pub fn check_github_release(current_version: &str) -> Result<Release, String> {
    let output = curl()
        .args(["--max-time", "30", RELEASE_API])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "GitHub: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    parse_release(&String::from_utf8_lossy(&output.stdout), current_version)
}

pub fn verify_installer(path: &Path, digest: &str, size: u64) -> Result<File, String> {
    let mut options = File::options();
    options.read(true);
    // Keep a read-only sharing handle alive through launch to prevent replacement after verification.
    #[cfg(target_os = "windows")]
    options.share_mode(1);
    let mut file = options.open(path).map_err(|e| e.to_string())?;
    if size < 2 || file.metadata().map_err(|e| e.to_string())?.len() != size {
        return Err("Installer size mismatch".into());
    }
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    let mut first = true;
    loop {
        let len = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if len == 0 {
            break;
        }
        if first {
            let is_zip = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("zip"))
                .unwrap_or(false);
            if is_zip {
                if !buffer[..len].starts_with(b"PK") {
                    return Err("Invalid Portable ZIP archive".into());
                }
            } else if !buffer[..len].starts_with(b"MZ") {
                return Err("Invalid Windows installer".into());
            }
        }
        first = false;
        hash.update(&buffer[..len]);
    }
    if digest.is_empty() || format!("{:x}", hash.finalize()) != digest {
        return Err("Installer checksum mismatch".into());
    }
    Ok(file)
}

pub fn download_installer(release: &Release) -> Result<StagedInstaller, String> {
    download_installer_with_progress(release, |_, _, _| {})
}

pub fn calculate_progress_pct(downloaded: u64, target_size: u64) -> u32 {
    if target_size == 0 {
        return 0;
    }
    ((downloaded as f64 / target_size as f64) * 100.0).clamp(0.0, 99.0) as u32
}

pub fn download_installer_with_progress<F>(
    release: &Release,
    mut on_progress: F,
) -> Result<StagedInstaller, String>
where
    F: FnMut(u64, u64, u32) + Send + 'static,
{
    if !release.info.available {
        return Err("This distribution cannot install an update".into());
    }

    let (url, digest, size, filename) = if release.info.is_installed {
        let url = release
            .info
            .setup_url
            .as_deref()
            .ok_or("Missing installer asset")?;
        let digest = release
            .digest
            .clone()
            .ok_or("GitHub release has no SHA-256 checksum for setup installer; cannot safely install")?;
        (url, digest, release.size, "Vetch101_Update_Setup.exe")
    } else {
        let url = release
            .info
            .portable_url
            .as_deref()
            .ok_or("Missing portable asset")?;
        let digest = release
            .portable_digest
            .clone()
            .ok_or("GitHub release has no SHA-256 checksum for portable archive; cannot safely install")?;
        (url, digest, release.portable_size, "Vetch101_Update_Portable.zip")
    };

    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let directory =
        std::env::temp_dir().join(format!("Vetch101-update-{}-{unique}", std::process::id()));
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let path = directory.join(filename);

    let staged = StagedInstaller {
        directory,
        file_path: path.clone(),
        digest: Some(digest),
        size,
        is_installed: release.info.is_installed,
    };

    let mut cmd = curl();
    cmd.arg("--output").arg(&path).arg(url);
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    let target_size = if size > 0 { size } else { 1 };
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(format!("Download failed with status: {status}"));
                }
                break;
            }
            Ok(None) => {
                if let Ok(meta) = std::fs::metadata(&path) {
                    let current = meta.len();
                    let pct = calculate_progress_pct(current, target_size);
                    on_progress(current, size, pct);
                }
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
            Err(e) => return Err(format!("Download monitor error: {e}")),
        }
    }

    verify_installer(&path, staged.digest.as_deref().unwrap_or(""), staged.size)?;
    on_progress(size, size, 100);
    Ok(staged)
}

pub fn launch_installer_and_exit(staged: &StagedInstaller) -> Result<(), String> {
    if staged.is_installed {
        let digest = staged.digest.as_deref().ok_or("Missing staged installer checksum")?;
        let _verified = verify_installer(&staged.file_path, digest, staged.size)?;
        let mut cmd = Command::new(&staged.file_path);
        cmd.args(["/S", "/UPDATE", "/R"]);
        // Explicit breakaway keeps only the installer alive when the app's Job Object closes.
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW | 0x01000000);
        cmd.spawn()
            .map_err(|e| format!("Cannot start installer: {e}"))?;
        std::process::exit(0);
    } else {
        let digest = staged.digest.as_deref().ok_or("Missing staged portable checksum")?;
        let _verified = verify_installer(&staged.file_path, digest, staged.size)?;
        let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let target_dir = current_exe
            .parent()
            .ok_or("Cannot determine application directory")?;
        let pid = std::process::id();
        let bat_path = staged.directory.join("apply-portable.bat");

        let bat_content = format!(
            "@echo off\r\n\
            set PID={pid}\r\n\
            set ARCHIVE={archive}\r\n\
            set TARGET_DIR={target_dir}\r\n\
            \r\n\
            :wait_loop\r\n\
            tasklist /fi \"PID eq %PID%\" 2>nul | find \"%PID%\" >nul\r\n\
            if not errorlevel 1 (\r\n\
                timeout /t 1 /nobreak >nul\r\n\
                goto wait_loop\r\n\
            )\r\n\
            \r\n\
            tar -xf \"%ARCHIVE%\" -C \"%TARGET_DIR%\"\r\n\
            start \"\" /D \"%TARGET_DIR%\" \"%TARGET_DIR%\\Vetch101.exe\"\r\n\
            del /f /q \"%ARCHIVE%\" 2>nul\r\n\
            (goto) 2>nul & rmdir /s /q \"%~dp0\" 2>nul\r\n",
            pid = pid,
            archive = staged.file_path.display(),
            target_dir = target_dir.display(),
        );

        std::fs::write(&bat_path, bat_content).map_err(|e| e.to_string())?;

        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/C", &bat_path.to_string_lossy()]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW | 0x01000000);
        cmd.spawn()
            .map_err(|e| format!("Cannot spawn portable update script: {e}"))?;
        std::process::exit(0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_progress_pct() {
        assert_eq!(calculate_progress_pct(0, 1000), 0);
        assert_eq!(calculate_progress_pct(500, 1000), 50);
        assert_eq!(calculate_progress_pct(990, 1000), 99);
        assert_eq!(calculate_progress_pct(1000, 1000), 99);
        assert_eq!(calculate_progress_pct(1200, 1000), 99);
        assert_eq!(calculate_progress_pct(500, 0), 0);
    }

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
    #[test]
    fn release_rejects_missing_assets_and_wrong_tag_urls() {
        assert!(parse_release_json(r#"{"tag_name":"v0.3.0","assets":[]}"#, "0.2.0").is_err());
        assert!(parse_release_json(r#"{"tag_name":"v0.3.0","assets":[{"name":"Vetch101_0.3.0_x64-setup.exe","browser_download_url":"https://evil.example/setup.exe"}]}"#, "0.2.0").is_err());
        assert!(!is_newer_version("1.invalid.0", "0.2.0"));
    }

    #[test]
    fn installer_verification_rejects_corruption_and_truncation() {
        let path = std::env::temp_dir().join(format!("vetch101-verify-{}.exe", std::process::id()));
        std::fs::write(&path, b"MZtest installer").unwrap();
        let digest = "d4bf57ea81194aad20e43c6739aaa2ddb03717cf35ef9fa07caa0915514265d7";
        assert!(verify_installer(&path, digest, 17).is_err());
        assert!(verify_installer(&path, digest, 16).is_ok());
        std::fs::write(&path, b"MZfake installer").unwrap();
        assert!(verify_installer(&path, digest, 16).is_err());
        std::fs::write(&path, b"<html>bad data!").unwrap();
        assert!(verify_installer(&path, digest, 15).is_err());
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn release_rejects_invalid_schema_and_preserves_checksum() {
        for json in [
            "not json",
            "null",
            "{}",
            r#"{"tag_name":"v0.3.0","assets":{}}"#,
        ] {
            assert!(parse_release_json(json, "0.2.0").is_err());
        }
        let release = parse_release(r#"{"tag_name":"v0.3.0","assets":[{
            "name":"Vetch101_0.3.0_x64-setup.exe",
            "browser_download_url":"https://github.com/porchyy/Vetch101/releases/download/v0.3.0/Vetch101_0.3.0_x64-setup.exe",
            "digest":"sha256:d4bf57ea81194aad20e43c6739aaa2ddb03717cf35ef9fa07caa0915514265d7", "size":15
        }]}"#, "0.2.0").unwrap();
        assert_eq!(
            release.digest.as_deref(),
            Some("d4bf57ea81194aad20e43c6739aaa2ddb03717cf35ef9fa07caa0915514265d7")
        );
        assert_eq!(release.size, 15);
    }

    #[test]
    fn portable_verification_verifies_zip_header_and_checksum() {
        let path = std::env::temp_dir().join(format!("vetch101-verify-{}.zip", std::process::id()));
        let payload = b"PK\x03\x04portable test zip archive";
        let size = payload.len() as u64;
        std::fs::write(&path, payload).unwrap();
        let mut hasher = Sha256::new();
        hasher.update(payload);
        let digest = format!("{:x}", hasher.finalize());
        assert!(verify_installer(&path, &digest, size).is_ok());
        // Wrong size
        assert!(verify_installer(&path, &digest, size + 1).is_err());
        // Non-zip header with .zip extension
        std::fs::write(&path, b"MZfake zip content").unwrap();
        assert!(verify_installer(&path, &digest, 18).is_err());
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn parse_release_captures_both_setup_and_portable_assets() {
        let sample = r#"{
            "tag_name": "v0.3.0",
            "body": "Fixed critical issues",
            "assets": [
                {
                    "name": "Vetch101_0.3.0_x64-setup.exe",
                    "browser_download_url": "https://github.com/porchyy/Vetch101/releases/download/v0.3.0/Vetch101_0.3.0_x64-setup.exe",
                    "digest": "sha256:d4bf57ea81194aad20e43c6739aaa2ddb03717cf35ef9fa07caa0915514265d7",
                    "size": 4200000
                },
                {
                    "name": "Vetch101_0.3.0_x64-portable.zip",
                    "browser_download_url": "https://github.com/porchyy/Vetch101/releases/download/v0.3.0/Vetch101_0.3.0_x64-portable.zip",
                    "digest": "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                    "size": 135000000
                }
            ]
        }"#;

        let release = parse_release(sample, "0.2.0").unwrap();
        assert!(release.info.available);
        assert_eq!(
            release.digest.as_deref(),
            Some("d4bf57ea81194aad20e43c6739aaa2ddb03717cf35ef9fa07caa0915514265d7")
        );
        assert_eq!(release.size, 4200000);
        assert_eq!(
            release.portable_digest.as_deref(),
            Some("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
        );
        assert_eq!(release.portable_size, 135000000);
    }
}
