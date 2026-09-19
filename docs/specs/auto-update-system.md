# Spec: Seamless Auto-Update System for App & Engine

## Problem Statement

Users of Vetch101 face two distinct update friction points:
1. External streaming platforms (YouTube, TikTok, Instagram, Facebook) continually revise their internal media APIs. When this happens, `yt-dlp` breaks until updated. Currently, users must notice the breakage, find the small "อัปเดต yt-dlp" button in the header, and manually trigger an update. Many users assume the application is permanently broken instead of simply needing an engine update.
2. When a new version of the Vetch101 desktop application is released on GitHub, users must notice the update banner, manually click to download, wait for the file to finish downloading in the foreground, and manually guide the installation. Furthermore, users running portable builds are not guided clearly on how to update their portable files without losing settings.

## Solution

A seamless, dual-tier background auto-update system that handles both the core application and engine dependencies intelligently:
1. **Silent Background Engine Auto-Update**: Upon startup, Vetch101 silently queries and updates `yt-dlp` in the background if an update is available, ensuring media inspection and downloads work reliably without requiring manual user intervention.
2. **Silent Staging with One-Click Relaunch for Application Updates**: For installed distributions, when a new GitHub release is published, the application automatically stages the verified installer in the background without blocking ongoing user operations. Once downloaded, it presents a clear, polite notification with a single "รีสตาร์ตเพื่ออัปเดต" (Restart & Update) action that executes silent installation and relaunches the app in seconds.
3. **Distribution-Aware Handling**: Portable distributions are detected automatically and presented with a direct portable archive download link and instructions, preventing destructive filesystem overwrites.
4. **Strict Concurrency Protection**: Any update execution or application relaunch is strictly locked out while a media download is in progress, preventing data corruption or interrupted downloads.

## User Stories

1. As a user launching Vetch101, I want the application to automatically check for `yt-dlp` updates in the background, so that I can download videos from fast-changing platforms without encountering unexpected extraction failures.
2. As a user, I want background `yt-dlp` updates to execute silently without blocking my ability to type URLs or start downloads, so that my workflow remains uninterrupted.
3. As a user, I want to see the updated version of `yt-dlp` reflected in the status bar once a silent update completes, so that I have visibility into my active engine version.
4. As a user with limited or unstable internet, I want background engine update failures to fail gracefully without crashing the app or showing intrusive error popups, so that my existing downloaded tools remain usable.
5. As a user, I want the application to check for new Vetch101 releases on GitHub automatically shortly after launching, so that I never miss new features, bug fixes, or performance enhancements.
6. As a user running an installed copy of Vetch101, I want new application versions to be downloaded and staged in the background automatically, so that I do not have to sit and watch a download progress bar before deciding to update.
7. As a user with an active media download in progress, I want the application update process to wait or be disabled until my download finishes, so that my ongoing video or photo download is not corrupted.
8. As a user whose background update has completed staging, I want to see a clear notification banner stating that the update is ready, so that I know a new version is waiting for me.
9. As a user reviewing a staged update, I want to see formatted release notes highlighting what changed, so that I can decide whether to update now or later.
10. As a user ready to apply a staged update, I want a single "รีสตาร์ตเพื่ออัปเดต" button that closes the app, applies the update silently, and relaunches the new version automatically, so that the process is completely effortless.
11. As a user who is busy working, I want the ability to dismiss or snooze the update notification, so that it does not obstruct my workspace.
12. As a user running Vetch101 in portable mode, I want the application to recognize that it is running portably, so that it does not attempt to run an NSIS system installer that could modify my registry or install into Program Files.
13. As a portable user, I want the update notification to offer a direct "ดาวน์โหลดไฟล์ Portable .zip" button opening the GitHub release asset in my browser, so that I can easily download and replace my portable folder.
14. As a user, I want manual update check buttons to remain available in the header, so that I can force an immediate check at any time if I suspect an update was just released.
15. As a user triggering a manual update check when already up to date, I want a clear confirmation message informing me that I am on the latest version, so that I know my software is current.
16. As a user encountering network issues during update checks, I want a friendly technical error summary, so that I understand why the check could not connect to GitHub.

## Implementation Decisions

1. **Dual-Tier Update Architecture**:
   - Engine dependency update (`yt-dlp`) and application executable update (`Vetch101`) are governed by separate lifecycles to reflect their distinct update frequencies and execution mechanisms.
   - `yt-dlp` updates in-place via CLI invocations (`--update-to nightly` / `--update`), whereas application updates stage external installer binaries.

2. **Automated Startup Triggers**:
   - On application startup, after resolving system directories and verifying existing binaries, the frontend triggers background verification for both engine tools and application releases.
   - Initial application release query is delayed by 2 to 3 seconds after startup to prioritize UI responsiveness and input focus.

3. **Silent Installer Staging Lifecycle**:
   - The application updater state machine transitions through: `idle` -> `checking` -> `available` -> `downloading (silent staging)` -> `ready (staged)` -> `applying (relaunching)`.
   - For installed distributions, upon receiving `available`, the client immediately initiates background staging into the OS temporary directory (`%TEMP%/Vetch101_Update_Setup.exe`).
   - The user interface does not display a disruptive modal during staging; instead, it transitions to `ready` when the installer is fully written and verified on disk.

4. **Distribution Detection & Forking**:
   - The backend inspects its runtime executable directory for installer artifacts (`uninstall.exe`).
   - If installed: automated silent staging and silent NSIS execution (`/S`) followed by executable exit.
   - If portable: automated staging is bypassed; the UI renders a direct portable ZIP link opening the default browser.

5. **Concurrency Safety & Guard Rails**:
   - All update initiation points, staging commands, and relaunch actions check active download and inspection states (`isDownloading`, `isInspecting`, and concurrency locks).
   - If a download is active, update checks may discover versions, but applying updates and relaunching is strictly blocked until download completion.

## Testing Decisions

- **State Machine Transitions (`updater.test.mjs`)**:
  - Test all state transitions of the updater state machine: `idle` -> `checking` -> `available` -> `downloading` -> `ready` -> `error` / `dismissed`.
  - Verify semantic version comparison rules (`isNewerVersion`) including semver prefixes (`v1.0.0` vs `1.0.0`), equal versions, and older versions.
  - Verify concurrency blocking (`canStartUpdate`) correctly permits or rejects updates based on active download flags.
- **Backend Release Parsing & Installer Verification (`updater.rs`)**:
  - Unit tests for GitHub release JSON parsing (`parse_release_json`) verifying extraction of tag names, setup URLs, portable URLs, and release notes.
  - Tests ensuring missing assets or invalid JSON schemas return structured errors rather than panicking.
- **Good Test Quality**:
  - Tests verify observable inputs and outputs (version strings, state shapes, lock outcomes) without mocking internal timers or trivial variables.

## Out of Scope

- Self-hosting custom update server infrastructure; updates will rely solely on public GitHub Releases API.
- Code-signing certificates with paid certificate authorities; the application continues using standard open-source NSIS bundles and checksum/tag validation.
- In-place differential patching of the portable archive while the portable executable is currently running in memory (Windows file locking prevents active executable self-replacement without an external helper process).

## Further Notes

- GitHub Releases API has a public rate limit of 60 requests per hour per IP for unauthenticated requests. The updater limits automated checks to once per application session with manual fallback to stay well within rate limits.
