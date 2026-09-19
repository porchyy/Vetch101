# Spec: All-in-One Distribution & Unified In-App Auto-Update

## Problem Statement

Users of Vetch101 currently encounter friction in two critical areas:
1. **Incomplete Initial Setup**: While the Portable distribution bundles `ffmpeg`, `ffprobe`, and `yt-dlp`, the Installed (NSIS) distribution only includes the application executable and webview runtime, leaving users without media extraction engines unless they already have them installed in their system environment or manual paths. New users expecting a ready-to-run desktop application encounter media download failures on fresh installations.
2. **Fragmented & Disconnected Update Experiences**: When an application update is released:
   - Users running the Portable distribution are forced out of the application into an external web browser to manually find, download, and unzip release archives from GitHub, having to manually copy files over their existing installation.
   - Users running the Installed distribution experience silent background downloads without visible progress, making it unclear whether an update is downloading, completed, or failed.
   - Users across all distributions lack real-time visibility into the update download progress (e.g., progress bar, percentage, throughput).

## Solution

Deliver a completely unified, self-contained, and seamless distribution and update architecture:
1. **All-in-One Distribution Packaging**: Both the Installed distribution (NSIS installer) and Portable distribution (.zip) bundle all necessary media engine dependencies (`ffmpeg.exe`, `ffprobe.exe`, `yt-dlp.exe`) out of the box. Users install or extract the application once and can immediately download videos and photos with zero external tool installation or configuration.
2. **Unified In-App Update Staging**: Update downloads for both Installed and Portable distributions occur directly inside the Vetch101 application without redirecting users to external browsers.
3. **Live Update Progress Telemetry**: The application updater streams download progress in real time, displaying a visual progress bar with percentage and status in the update banner.
4. **Distribution-Aware One-Click Application**:
   - For Installed distributions: Once staged, users click "รีสตาร์ตเพื่ออัปเดต" (Restart & Update) to launch the installer in silent upgrade mode and restart the app.
   - For Portable distributions: Once staged, users click "รีสตาร์ตเพื่ออัปเดต" to trigger an atomic in-place replacement helper that safely replaces portable application binaries and relaunches the updated application seamlessly.
5. **Strict Concurrency Guard Preservation**: Update application and restart operations remain strictly guarded against ongoing media inspection or download tasks.

## User Stories

1. As a new user installing Vetch101 via the Windows setup installer, I want the installer to bundle `ffmpeg`, `ffprobe`, and `yt-dlp`, so that I can download any supported video immediately after installation without manually installing third-party command-line utilities.
2. As a portable user extracting Vetch101 to a flash drive or personal folder, I want all required binaries bundled in the archive, so that the application works anywhere without host environment dependencies.
3. As a user working in the application, I want the system to check for new releases on startup without freezing or slowing down the user interface, so that my workflow remains responsive.
4. As a user running either the Installed or Portable distribution, I want the application to notify me when a newer version is available directly within the app, so that I stay informed of improvements.
5. As a portable user, I want the application to download the update directly inside the app, so that I do not have to leave the app or download zip files manually from GitHub in a browser.
6. As an installed application user, I want the update download to happen within the application, so that I do not need external download tools.
7. As a user with an available update, I want to see a visual progress bar and percentage indicator while the update is downloading, so that I know the download is actively proceeding.
8. As a user on a slow or metered connection, I want clear feedback if an update download encounters a network error, so that I can retry when connection improves.
9. As a user downloading media files, I want the application to prevent starting or applying an update until my media download finishes, so that my active downloads are never interrupted or corrupted.
10. As a user inspecting a media URL, I want update installations to be temporarily blocked while extraction is occurring, so that the inspector process is not aborted mid-operation.
11. As a user whose update download has finished, I want to see the update banner transition to a ready state with a clear "รีสตาร์ตเพื่ออัปเดต" button, so that I can apply the update at my own convenience.
12. As a user reviewing an available update, I want to read formatted release notes, so that I understand what new features or bug fixes are included before updating.
13. As a user who wants to postpone updating, I want to dismiss the update banner, so that it does not distract me while I finish my current tasks.
14. As a user running the Portable distribution who clicks "รีสตาร์ตเพื่ออัปเดต", I want the application to smoothly close, replace the portable binaries, and relaunch the new version, so that my portable setup is updated without any manual file management.
15. As an installed user who clicks "รีสตาร์ตเพื่ออัปเดต", I want the installer to run smoothly and reopen Vetch101, so that I am quickly running the latest version.
16. As a user whose update just finished and relaunched, I want my download history, settings, and destination folders preserved intact, so that I do not have to reconfigure my preferences.
17. As a user who manually clicks the "ตรวจหาอัปเดต" button in the header, I want an immediate check that updates the banner or confirms that I am on the latest version, so that I have complete control over checking for releases.

## Implementation Decisions

1. **Packaging & Distribution Unification**:
   - The desktop packaging pipeline must bundle the engine dependency directory (`bin/ffmpeg.exe`, `bin/ffprobe.exe`, `bin/yt-dlp.exe`) into the NSIS bundle resources in addition to the existing portable archive.
   - When installed, the installer places these dependencies into the application directory or `%LOCALAPPDATA%/Vetch101/bin`, guaranteeing that `check_dependencies` detects all required tools immediately on first launch.

2. **Frontend Updater State Machine Enhancement**:
   - The `UpdaterState` model will be updated to include streaming progress telemetry:
     ```ts
     export type UpdaterState =
       | { status: 'idle' }
       | { status: 'checking' }
       | ({ status: 'available' } & UpdateMetadata)
       | ({ status: 'downloading'; progress: number; downloadedBytes?: number; totalBytes?: number } & UpdateMetadata)
       | ({ status: 'applying' } & UpdateMetadata)
       | ({ status: 'ready' } & UpdateMetadata)
       | { status: 'error'; message: string }
       | { status: 'dismissed'; version: string };
     ```
   - The restriction preventing Portable distributions from invoking `UpdaterAction.startDownload` will be removed. Both `isInstalled === true` and `isInstalled === false` transition to `downloading` when an update is initiated.

3. **In-App Streaming Download & Event Seam**:
   - The backend staging command (`stage_app_update`) will utilize an asynchronous streaming HTTP client that computes SHA-256 digests in-flight and broadcasts periodic progress events over the Tauri event seam (`update-progress`).
   - The frontend updater hook listens to `update-progress` events, dispatching `UpdaterAction.progress(state, percentage)` to update the live progress bar.

4. **Portable In-Place Replacement Engine**:
   - In Portable distributions, replacing a running executable on Windows requires an out-of-process handoff due to mandatory Windows executable file locks.
   - Staging for Portable distributions downloads and verifies the portable archive payload into an isolated temporary directory.
   - On `install_app_update` for Portable distributions, the backend generates an atomic self-terminating updater helper script (e.g. `vetch101-portable-apply.bat` or detached helper process) that:
     1. Waits for the current parent PID to terminate.
     2. Extracts/replaces updated binaries (`Vetch101.exe`, `WebView2Loader.dll`, and engine tools) into the portable application folder.
     3. Cleans up temporary staged files and helper scripts.
     4. Relaunches `Vetch101.exe`.
   - The main Vetch101 process then exits cleanly with code 0.

5. **Concurrency Lock Integrity**:
   - The concurrency guard remains strictly enforced across all update phases: update staging cannot block media downloads, but applying an update and restarting is forbidden while `isDownloading`, `isInspecting`, or `downloadLockActive` is true.

## Testing Decisions

1. **High-Seam State Machine Testing (`tests/updater.test.mjs`)**:
   - A good test verifies visible domain state transitions rather than implementation minutiae.
   - Test transitions: `available` (both installed and portable) -> `startDownload` -> `progress(n)` -> `ready` -> `apply`.
   - Test that portable distributions are no longer rejected from starting update downloads.
   - Test that progress updates clamp between 0% and 100% and correctly preserve update metadata.
   - Test that concurrency guards (`canStartUpdate`) reject update initiation while inspection or downloads are ongoing.

2. **Backend Updater Logic & Release Parsing Tests (`engine::updater`)**:
   - Unit tests covering release payload resolution: correctly extracting setup installer URL and digest for installed distributions, and portable archive URL and digest for portable distributions.
   - Stream progress calculator tests verifying accurate percentage emission and SHA-256 digest validation.
   - Prior art: Existing unit tests in `src-tauri/src/engine/updater.rs`.

3. **Packaging Artifact Verification**:
   - Verify that the NSIS installer output includes `bin/` executables and that `scripts/test-portable.ps1` verifies portable launch without regression.

## Out of Scope

- Hosting proprietary or private update CDN servers; GitHub Releases remains the sole distribution origin.
- Paid EV code-signing certificates; checksum verification and HTTPS transport guarantee binary integrity.
- Delta/binary-diff patching (e.g., Courgette/bsdiff); updates will download full replacement binaries to maintain simplicity and reliability.

## Further Notes

- Staged files in temporary directories are safely scoped and dropped on abnormal termination to prevent disk pollution.
- All UI text in the update banner adheres to the existing clean Thai localization ("กำลังดาวน์โหลดอัปเดต…", "รีสตาร์ตเพื่ออัปเดต", "พร้อมติดตั้งแล้ว").
