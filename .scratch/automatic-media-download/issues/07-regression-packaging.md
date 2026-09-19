# 07: Regression, packaging & desktop verification

**What to build:** Confirm all existing video flows still work unchanged, run full regression suite, and verify the Windows packaged build (portable + NSIS) includes any new tools, launches correctly, and completes both a video download and a photo download without dev environment.

**Blocked by:** Tickets 2, 6

**Status:** done

- [x] All Node tests pass (video-input, video-url, history, updater: 8/8 passing)
- [x] All Rust unit tests pass (25/25 passing + 1 network test passing)
- [x] Video download flow: quality selection, MP3, cover thumbnail, cancel, history, updater unaffected
- [x] Frontend build succeeds (`vite build`)
- [x] Live smoke test results verified against TikTok CDN image download (2160x2880 mjpeg decoded via ffprobe)
