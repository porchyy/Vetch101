# 03: TikTok photo extraction proof-of-concept

**What to build:** A Rust module that determines if a TikTok URL is a photo post vs video, extracts the ordered list of full-resolution image URLs with pixel dimensions, and returns them as `Vec<PhotoImage>`. Proven against real TikTok photo posts (single + multi-image). Decision on extraction strategy (gallery-dl, direct API, or yt-dlp slideshow) must be made and recorded here.

**Blocked by:** Ticket 1

**Status:** done

- [x] `engine::photo_extractor` module with `parse_tiktok_photo_json` and `fetch_tiktok_photo_metadata`
- [x] Strategy decision documented: Direct TikWM / TikTok CDN API (avoids heavy Python gallery-dl binary dependency, verified 2160x2880 full resolution JPEG download)
- [x] `is_photo_post` detection reliable (checks presence of multi-image array in API response, distinct from video)
- [x] Unit tests with fixture JSON (offline: 5 unit tests passing)
- [x] Live smoke test against real public TikTok photo post URL verified
