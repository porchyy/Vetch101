# 03: Subprocess Execution Adapter & Unified Backend Media Pipeline

**What to build:** A single deep backend media pipeline that coordinates concurrency, destination directory validation, instant process-tree cancellation via `tokio::select!` and Windows Job Objects, and returns a verified synchronous `DownloadOutcome` with an internal `CommandRunner` port for fast offline unit testing.

**Blocked by:** 02: Discriminated Media Inspection Seam

**Status:** done

- [x] Consolidates video download execution and photo album download execution into a unified `MediaPipeline`.
- [x] Cancelling a photo or video download immediately aborts all child processes (`curl`, `yt-dlp`, `ffmpeg`) without hanging.
- [x] Download command synchronously returns `DownloadOutcome` containing verified primary and secondary paths.
- [x] Concurrency lock (`DownloadManager`) guarantees only one active download at a time across all media formats.
- [x] An internal `CommandRunner` port allows unit testing download workflows and error branches without launching external executables.
