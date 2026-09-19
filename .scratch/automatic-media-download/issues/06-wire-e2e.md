# 06: Wire photo pipeline end-to-end (inspect → preview → download → result)

**What to build:** Full vertical path for TikTok photo posts: paste URL → auto-inspect detects photo_post → `fetch_metadata` populates `images[]` → PhotoResultCard renders preview → user picks PNG or JPG → clicks download → Rust `download_photo_post` command streams per-image progress → success shows file count / partial failure shows which failed → open folder. History records the album.

**Blocked by:** Tickets 3, 4, 5

**Status:** blocked

- [ ] `fetch_metadata` calls photo extractor for TikTok photo posts and returns populated `images[]`
- [ ] New Tauri command `download_photo_post(url, download_dir, format)` registered in lib.rs
- [ ] Progress events include per-image counter (current/total)
- [ ] Partial success: PhotoResultCard shows which images succeeded vs failed
- [ ] Retry without overwriting already-downloaded images
- [ ] History item for album download (ext = chosen format, filepath = folder)
- [ ] Desktop smoke test: real TikTok photo URL (single image + multi-image)
