# 04: Photo download pipeline (fetch, convert PNG/JPG, ordered naming)

**What to build:** A Rust download path that takes `Vec<PhotoImage>` (from ticket 3), downloads each image, converts encoding to PNG or JPG correctly (not extension rename), preserves pixel dimensions, avoids double-compressing JPEG-to-JPG, names files with sequential index and collision avoidance, verifies each output, and reports partial success if some images fail.

**Blocked by:** Tickets 1, 3

**Status:** done

- [x] `engine::photo_downloader::run_photo_download(app, manager, url, download_dir, format)`
- [x] PNG conversion: transcode via FFmpeg (real format encoding)
- [x] JPG path: preserve original JPEG bytes when source starts with `[FF D8 FF]` JPEG magic; otherwise re-encode via FFmpeg `-q:v 2`
- [x] Per-image progress events via `download-progress` Tauri event (`preparing`, `downloading`, `completed`)
- [x] Sequential naming: `{safe_title}_{index:02}.{ext}`, collision-safe unique filename resolution
- [x] Cancellation mid-album: checks `job.check_cancelled()` at each iteration, keeps completed files
- [x] Verification: verifies each output file exists and is > 0 bytes
- [x] Rust unit tests: `test_sanitize_filename`, `test_is_jpeg_file_with_mock_bytes`
