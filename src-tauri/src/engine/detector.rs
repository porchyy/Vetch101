use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone)]
pub struct BinaryPaths {
    pub ytdlp_path: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub use_python_module: bool,
    pub ytdlp_version: Option<String>,
    pub app_bin_dir: PathBuf,
}

pub fn get_app_bin_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Vetch101")
        .join("bin")
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

pub fn get_tool_version(cmd: &str, args: &[&str]) -> Option<String> {
    let mut command = Command::new(cmd);
    command.args(args);

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    if let Ok(output) = command.output() {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !s.is_empty() {
                return Some(s);
            }
        }
    }
    None
}

pub fn find_bundled_tool(tool_name: &str) -> Option<PathBuf> {
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            for sub in ["bin", "resources/bin"] {
                let candidate = exe_dir.join(sub).join(tool_name);
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }
    None
}

pub fn detect_ffmpeg_and_ffprobe(app_bin_dir: &Path) -> (Option<String>, Option<String>) {
    // 1. App local bin directory
    let local_ffmpeg = app_bin_dir.join("ffmpeg.exe");
    let local_ffprobe = app_bin_dir.join("ffprobe.exe");
    if local_ffmpeg.exists() {
        let ffmpeg_str = local_ffmpeg.to_string_lossy().to_string();
        let ffprobe_str = if local_ffprobe.exists() {
            Some(local_ffprobe.to_string_lossy().to_string())
        } else {
            None
        };
        return (Some(ffmpeg_str), ffprobe_str);
    }

    // 2. Adjacent or bundled with current executable (portable and installed distributions)
    if let Some(ffmpeg) = find_bundled_tool("ffmpeg.exe") {
        let ffprobe = find_bundled_tool("ffprobe.exe").map(|p| p.to_string_lossy().to_string());
        return (Some(ffmpeg.to_string_lossy().to_string()), ffprobe);
    }

    // 3. WinGet package paths
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let winget_dir = PathBuf::from(local_appdata)
            .join("Microsoft")
            .join("WinGet")
            .join("Packages");
        if winget_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&winget_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let name = path.file_name().unwrap_or_default().to_string_lossy();
                    if name.contains("FFmpeg") {
                        // Check direct or nested bin
                        let cand_bin = path.join("ffmpeg.exe");
                        let probe_bin = path.join("ffprobe.exe");
                        if cand_bin.exists() {
                            return (
                                Some(cand_bin.to_string_lossy().to_string()),
                                if probe_bin.exists() {
                                    Some(probe_bin.to_string_lossy().to_string())
                                } else {
                                    None
                                },
                            );
                        }
                        if let Ok(sub_entries) = std::fs::read_dir(&path) {
                            for sub in sub_entries.flatten() {
                                let sub_path = sub.path();
                                let sub_cand = sub_path.join("bin").join("ffmpeg.exe");
                                let sub_probe = sub_path.join("bin").join("ffprobe.exe");
                                if sub_cand.exists() {
                                    return (
                                        Some(sub_cand.to_string_lossy().to_string()),
                                        if sub_probe.exists() {
                                            Some(sub_probe.to_string_lossy().to_string())
                                        } else {
                                            None
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Direct in PATH
    let ffmpeg_in_path = check_command_works("ffmpeg", &["-version"]);
    let ffprobe_in_path = check_command_works("ffprobe", &["-version"]);
    if ffmpeg_in_path {
        return (
            Some("ffmpeg".to_string()),
            if ffprobe_in_path {
                Some("ffprobe".to_string())
            } else {
                None
            },
        );
    }

    (None, None)
}

pub fn detect_ytdlp(app_bin_dir: &Path) -> (Option<String>, bool, Option<String>) {
    // 1. App local bin directory
    let local_ytdlp = app_bin_dir.join("yt-dlp.exe");
    if local_ytdlp.exists() {
        let path_str = local_ytdlp.to_string_lossy().to_string();
        let version = get_tool_version(&path_str, &["--version"]);
        return (Some(path_str), false, version);
    }

    // 2. Adjacent or bundled with current executable (portable and installed distributions)
    if let Some(bundled_ytdlp) = find_bundled_tool("yt-dlp.exe") {
        let path_str = bundled_ytdlp.to_string_lossy().to_string();
        let version = get_tool_version(&path_str, &["--version"]);
        return (Some(path_str), false, version);
    }

    // 3. WinGet package paths
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let winget_dir = PathBuf::from(local_appdata)
            .join("Microsoft")
            .join("WinGet")
            .join("Packages");
        if winget_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&winget_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let name = path.file_name().unwrap_or_default().to_string_lossy();
                    if name.contains("yt-dlp") {
                        let candidate = path.join("yt-dlp.exe");
                        if candidate.exists() {
                            let path_str = candidate.to_string_lossy().to_string();
                            let version = get_tool_version(&path_str, &["--version"]);
                            return (Some(path_str), false, version);
                        }
                    }
                }
            }
        }
    }

    // 4. Direct in PATH
    if check_command_works("yt-dlp", &["--version"]) {
        let version = get_tool_version("yt-dlp", &["--version"]);
        return (Some("yt-dlp".to_string()), false, version);
    }

    // 5. Fallback: python -m yt_dlp
    if check_command_works("python", &["-m", "yt_dlp", "--version"]) {
        let version = get_tool_version("python", &["-m", "yt_dlp", "--version"]);
        return (Some("python".to_string()), true, version);
    }

    (None, false, None)
}

pub fn get_binaries() -> BinaryPaths {
    let app_bin_dir = get_app_bin_dir();
    let _ = std::fs::create_dir_all(&app_bin_dir);

    let (ytdlp_path, use_python, ytdlp_version) = detect_ytdlp(&app_bin_dir);
    let (ffmpeg_path, ffprobe_path) = detect_ffmpeg_and_ffprobe(&app_bin_dir);

    BinaryPaths {
        ytdlp_path,
        ffmpeg_path,
        ffprobe_path,
        use_python_module: use_python,
        ytdlp_version,
        app_bin_dir,
    }
}

pub fn update_ytdlp_tool(binaries: &BinaryPaths) -> Result<String, String> {
    let ytdlp = binaries
        .ytdlp_path
        .as_ref()
        .ok_or("ไม่พบโปรแกรม yt-dlp ในระบบ ไม่สามารถอัปเดตได้")?;

    let mut cmd = Command::new(ytdlp);
    if binaries.use_python_module {
        cmd.args(["-m", "yt_dlp", "-U"]);
    } else {
        cmd.arg("-U");
    }

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("ไม่สามารถสั่งอัปเดต yt-dlp: {}", e))?;

    let stdout_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr_str = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        if stdout_str.is_empty() {
            Ok("ตรวจสอบอัปเดตเรียบร้อยแล้ว".into())
        } else {
            Ok(stdout_str)
        }
    } else {
        let err = if !stderr_str.is_empty() {
            stderr_str
        } else {
            stdout_str
        };
        Err(format!("การอัปเดตล้มเหลว: {}", err))
    }
}

// Update a private copy so users can keep inspecting/downloading with the active engine.
pub struct EngineUpdate {
    directory: PathBuf,
    target: PathBuf,
    pub message: String,
}

impl EngineUpdate {
    pub fn publish(&self) -> Result<(), String> {
        std::fs::rename(self.directory.join("yt-dlp.exe"), &self.target).map_err(|e| e.to_string())
    }
}

impl Drop for EngineUpdate {
    fn drop(&mut self) {
        for name in ["yt-dlp.exe", "yt-dlp.exe.old", "yt-dlp.exe.new"] {
            let _ = std::fs::remove_file(self.directory.join(name));
        }
        let _ = std::fs::remove_dir(&self.directory);
    }
}

pub fn stage_engine_update() -> Result<EngineUpdate, String> {
    let mut binaries = get_binaries();
    let source = binaries.ytdlp_path.as_ref().ok_or("yt-dlp unavailable")?;
    if binaries.use_python_module {
        return Err("Automatic update requires a standalone yt-dlp executable".into());
    }
    let source = resolve_standalone_engine(source, &std::env::var_os("PATH").unwrap_or_default())
        .ok_or("Cannot locate standalone yt-dlp executable")?;
    std::fs::create_dir_all(&binaries.app_bin_dir).map_err(|e| e.to_string())?;
    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let directory = binaries
        .app_bin_dir
        .join(format!("update-{}-{unique}", std::process::id()));
    std::fs::create_dir(&directory).map_err(|e| e.to_string())?;
    let mut staged = EngineUpdate {
        directory,
        target: binaries.app_bin_dir.join("yt-dlp.exe"),
        message: String::new(),
    };
    let copy = staged.directory.join("yt-dlp.exe");
    std::fs::copy(&source, &copy).map_err(|e| e.to_string())?;
    binaries.ytdlp_path = Some(copy.to_string_lossy().into_owned());
    staged.message = update_ytdlp_tool(&binaries)?;
    get_tool_version(&copy.to_string_lossy(), &["--version"])
        .ok_or("Updated engine verification failed")?;
    Ok(staged)
}

fn resolve_standalone_engine(source: &str, search_path: &std::ffi::OsStr) -> Option<PathBuf> {
    let path = Path::new(source);
    if path.is_file() {
        return Some(path.to_owned());
    }
    std::env::split_paths(search_path)
        .map(|directory| directory.join(source).with_extension("exe"))
        .find(|candidate| candidate.is_file())
}

#[cfg(test)]
mod update_tests {
    use super::*;

    #[test]
    fn resolves_standalone_engine_available_only_through_path() {
        let directory =
            std::env::temp_dir().join(format!("vetch101-engine-path-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let executable = directory.join("yt-dlp.exe");
        std::fs::write(&executable, b"MZ").unwrap();
        let search_path = std::env::join_paths([&directory]).unwrap();
        assert_eq!(
            resolve_standalone_engine("yt-dlp", &search_path),
            Some(executable.clone())
        );
        assert_eq!(resolve_standalone_engine("missing", &search_path), None);
        std::fs::remove_file(executable).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
}
