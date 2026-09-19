# 07: Regression, packaging & desktop verification

**What to build:** Confirm all existing video flows still work unchanged, run full regression suite, and verify the Windows packaged build (portable + NSIS) includes any new tools, launches correctly, and completes both a video download and a photo download without dev environment.

**Blocked by:** Tickets 2, 6

**Status:** blocked

- [ ] All Node tests pass (video-input, video-url, history, updater)
- [ ] All Rust unit tests pass (metadata, downloader, parser, process_job, updater)
- [ ] Video download flow: quality selection, MP3, cover thumbnail, cancel, history, updater unaffected
- [ ] Frontend build succeeds (`vite build`)
- [ ] Windows portable build packages any new binary (gallery-dl or yt-dlp) correctly
- [ ] Desktop: paste video URL → auto-inspect → download video ✓
- [ ] Desktop: paste TikTok photo URL → auto-inspect → download album (JPG and PNG) ✓
- [ ] Desktop: partial album failure handled gracefully
- [ ] Live smoke test results documented with yt-dlp version + date
