# 04: Photo download pipeline (fetch, convert PNG/JPG, ordered naming)

**What to build:** A Rust download path that takes `Vec<PhotoImage>` (from ticket 3), downloads each image, converts encoding to PNG or JPG correctly (not extension rename), preserves pixel dimensions, avoids double-compressing JPEG-to-JPG, names files with sequential index and collision avoidance, verifies each output, and reports partial success if some images fail.

**Blocked by:** Tickets 1, 3

**Status:** blocked

- [ ] `engine::photo_downloader::download_photo_post(images, dir, format) -> DownloadResult`
- [ ] PNG conversion: decode → re-encode as PNG (real format)
- [ ] JPG path: preserve original JPEG bytes when source is JPEG and target is JPG; otherwise re-encode at high quality
- [ ] Per-image progress events via `download-progress` Tauri event
- [ ] Sequential naming: `{title}_{index:02}.{ext}`, collision-safe
- [ ] Cancellation mid-album: stops remaining, does not overwrite completed files
- [ ] Partial-success: returns list of (index, ok/err) per image
- [ ] Rust unit tests: fixture images for PNG, JPG, and decode-verify
