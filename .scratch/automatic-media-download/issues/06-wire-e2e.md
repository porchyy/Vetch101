# 06: Wire photo pipeline end-to-end (inspect → preview → download → result)

**What to build:** Full vertical path for TikTok photo posts: paste URL → auto-inspect detects photo_post → `fetch_metadata` populates `images[]` → PhotoResultCard renders preview → user picks PNG or JPG → clicks download → Rust `download_photo_post` command streams per-image progress → success shows file count / partial failure shows which failed → open folder. History records the album.

**Blocked by:** Tickets 3, 4, 5

**Status:** done

- [x] `fetch_metadata` calls `photo_extractor` for TikTok photo posts and returns populated `images[]`
- [x] New Tauri command `download_photo_post(url, download_dir, format)` registered in lib.rs
- [x] Progress events include per-image counter (current/total) and percentage
- [x] Completion & download again support in PhotoResultCard
- [x] History item for album download (ext = chosen format, filepath = folder)
- [x] Real TikTok photo post integration tested
