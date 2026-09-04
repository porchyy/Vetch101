use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone)]
pub struct BinaryPaths {
    pub ytdlp_path: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub use_python_module: bool,
}

pub fn check_command_works(cmd: &str, args: &[&str]) -> bool {
    let mut command = Command::new(cmd);
    command.args(args);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    match command.output() {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

pub fn detect_ffmpeg() -> Option<String> {
    // 1. Direct in PATH
    if check_command_works("ffmpeg", &["-version"]) {
        return Some("ffmpeg".to_string());
    }

    // 2. WinGet package paths
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let winget_dir = PathBuf::from(local_appdata).join("Microsoft").join("WinGet").join("Packages");
        if winget_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&winget_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let name = path.file_name().unwrap_or_default().to_string_lossy();
                    if name.contains("FFmpeg") {
                        // Check nested bin/ffmpeg.exe
                        let candidate1 = path.join("ffmpeg.exe");
                        if candidate1.exists() {
                            return Some(candidate1.to_string_lossy().to_string());
                        }
                        if let Ok(sub_entries) = std::fs::read_dir(&path) {
                            for sub_entry in sub_entries.flatten() {
                                let sub_path = sub_entry.path();
                                let candidate2 = sub_path.join("bin").join("ffmpeg.exe");
                                if candidate2.exists() {
                                    return Some(candidate2.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

pub fn detect_ytdlp() -> (Option<String>, bool) {
    // 1. Direct in PATH
    if check_command_works("yt-dlp", &["--version"]) {
        return (Some("yt-dlp".to_string()), false);
    }

    // 2. WinGet package paths
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let winget_dir = PathBuf::from(local_appdata).join("Microsoft").join("WinGet").join("Packages");
        if winget_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&winget_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let name = path.file_name().unwrap_or_default().to_string_lossy();
                    if name.contains("yt-dlp") {
                        let candidate = path.join("yt-dlp.exe");
                        if candidate.exists() {
                            return (Some(candidate.to_string_lossy().to_string()), false);
                        }
                    }
                }
            }
        }
    }

    // 3. Fallback: python -m yt_dlp
    if check_command_works("python", &["-m", "yt_dlp", "--version"]) {
        return (Some("python".to_string()), true);
    }

    (None, false)
}

pub fn get_binaries() -> BinaryPaths {
    let (ytdlp_path, use_python) = detect_ytdlp();
    let ffmpeg_path = detect_ffmpeg();

    BinaryPaths {
        ytdlp_path,
        ffmpeg_path,
        use_python_module: use_python,
    }
}
