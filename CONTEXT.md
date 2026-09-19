# Vetch101 Domain Glossary (CONTEXT.md)

## Media Engine & Inspection
- **Media Inspection**: Analysis of a remote URL to determine media category, stream qualities, and post attributes.
- **Video Media**: Single video stream consisting of metadata and available audio/video quality tiers.
- **Photo Album**: Multi-image post (e.g. TikTok photo carousels) containing an ordered sequence of images.
- **Media Pipeline**: Unified backend supervision engine coordinating subprocess execution, concurrency locks, and synchronous outcomes.
- **Download Outcome**: Authoritative synchronous result structure returned across the IPC seam containing verified filesystem paths upon download completion.

## Auto-Update System
- **Auto-Update**: Automatic background discovery, staging, and lifecycle coordination of newer software releases.
- **App Update**: Update process targeting the Vetch101 desktop GUI application binary.
- **Engine Dependency Update**: Update process targeting external tools (`yt-dlp`, `ffmpeg`) bundled or installed in the host environment.
- **Installed Distribution**: App instance installed via NSIS installer with uninstaller metadata in the application directory.
- **Portable Distribution**: App instance executed directly from an arbitrary directory or archive without system installation.
- **Update Staging**: Silent background download of the verified installer payload while the application remains fully interactive.
- **Ready State**: State where the update payload is fully staged on disk, awaiting user confirmation to apply and restart.
- **Concurrency Guard**: Protection ensuring application updates or restarts are strictly rejected while media downloads are active.
- **All-in-One Distribution**: Complete self-contained distribution packaging the Vetch101 GUI alongside external engine dependencies (`ffmpeg`, `ffprobe`, `yt-dlp`) in a single payload.
  _Avoid_: standalone installer, monolithic bundle
- **In-App Update Staging**: Real-time downloading of update assets directly within the application client without delegating to external web browsers.
  _Avoid_: manual download, browser redirect
- **Update Progress Stream**: Continuous progress telemetry reporting byte count, total size, and percentage during update downloads.
  _Avoid_: silent wait, indeterminate spinner
