# 03: TikTok photo extraction proof-of-concept

**What to build:** A Rust module that determines if a TikTok URL is a photo post vs video, extracts the ordered list of full-resolution image URLs with pixel dimensions, and returns them as `Vec<PhotoImage>`. Proven against real TikTok photo posts (single + multi-image). Decision on extraction strategy (gallery-dl, direct API, or yt-dlp slideshow) must be made and recorded here.

**Blocked by:** Ticket 1

**Status:** ready-for-agent

- [ ] `engine::photo_extractor` module with `extract_tiktok_photos(url) -> Result<Vec<PhotoImage>, String>`
- [ ] Strategy decision documented (ADR or inline comment): gallery-dl vs direct API vs yt-dlp
- [ ] `is_photo_post` detection reliable (not thumbnail-based)
- [ ] Unit tests with fixture JSON (offline)
- [ ] Live smoke test against a real public TikTok photo post URL
