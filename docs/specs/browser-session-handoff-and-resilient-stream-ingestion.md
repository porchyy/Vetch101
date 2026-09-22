# Spec: Browser Session Handoff & Resilient Stream Ingestion

## Problem Statement

Users encounter download failures and steep friction when attempting to download media from modern websites in two main scenarios:
1. **Anti-Bot & Authenticated Paywalls**: Websites protected by Cloudflare Turnstile, anti-bot challenges, or requiring user login (e.g. age-gated media, private social groups, streaming sites) return HTTP 403 Forbidden errors when inspected by automated scrapers. Even though users are already viewing and playing the video smoothly in their web browser (having already solved anti-bot challenges and logged in), Vetch101 operates in isolation without those browser credentials and fails with technical errors.
2. **Direct Manifest & Stream Rejection**: When users locate and paste raw stream manifests (such as `.m3u8` for HLS or `.mpd` for DASH) extracted via browser developer tools or video sniffer extensions, traditional scrapers fail because these URLs lack standard web page HTML, titles, and thumbnails. Users are left without an easy way to ingest and package these streams into standard MP4 files.

## Solution

Deliver a resilient, privacy-conscious session bridge and direct stream pipeline:
1. **Browser Session Handoff**: Provide an intuitive control allowing users to leverage active sessions from their installed web browsers (`Chrome`, `Edge`, `Brave`, or `Firefox`). When active, the download engine imports cookies directly from the selected browser without launching external windows or background browsers, bypassing Cloudflare anti-bot blocks and accessing authenticated content.
2. **One-Click Anti-Bot Fallback**: When an inspection or download encounters an HTTP 403 Forbidden or Cloudflare challenge while session handoff is disabled, the error banner presents an immediate action: "ลองใหม่อีกครั้งด้วย Cookies จากเบราว์เซอร์" (Retry with Browser Cookies), allowing instant recovery without manual URL re-entry.
3. **Browser Target Selection**: A compact selector allows users to choose their preferred browser target, defaulting intelligently to Chrome or Edge, with preferences persisted in local storage.
4. **Direct Stream Ingestion**: Detect raw HLS (`.m3u8`) and DASH (`.mpd`) stream URLs, bypass generic page scraping, automatically synthesize friendly fallback titles (e.g. `Stream_YYYYMMDD_HHmmss`), and stream segments directly into high-quality MP4/audio files via FFmpeg.
5. **Zero Idle Overhead**: All cookie extraction occurs strictly on-demand in milliseconds during command execution, ensuring zero ongoing memory or CPU overhead.

## User Stories

1. As a user viewing a video protected by Cloudflare anti-bot challenges in my browser, I want Vetch101 to reuse my browser session cookies, so that I can download the video without encountering HTTP 403 errors.
2. As a user downloading an age-restricted video or a video from a group I have joined, I want to enable browser session handoff, so that my existing login credentials are used without typing my password into the app.
3. As a user who primarily browses using Microsoft Edge, I want to select Edge as my browser target, so that Vetch101 reads cookies from the browser where I am actually logged in.
4. As a user who primarily browses using Google Chrome, Brave, or Firefox, I want to easily switch the browser target to match my daily browser, so that my session cookies are found accurately.
5. As a user who values privacy and simplicity, I want browser session handoff to be an explicit toggle that I can turn on or off at any time, so that cookies are only accessed when I intend.
6. As a user who forgot to enable browser session handoff and encountered a Cloudflare 403 error, I want to see an immediate one-click retry button with browser cookies, so that I do not have to re-copy or re-paste the link.
7. As a user pasting a direct `.m3u8` stream link obtained from developer tools or a sniffer extension, I want Vetch101 to recognize the stream immediately, so that I can download it without scraper errors.
8. As a user pasting a direct `.mpd` manifest link, I want Vetch101 to accept the link and convert it into a standard video container, so that I can play it anywhere offline.
9. As a user downloading a raw stream URL that has no HTML title tag, I want Vetch101 to automatically generate a clean, timestamped filename, so that the file saves reliably without errors.
10. As a user with limited computer hardware, I want the cookie reading process to be lightweight and fast, so that the application does not lag or consume excess RAM.
11. As a user who switches between dark and light themes, I want the browser selection dropdown and cookie toggle to match the visual theme seamlessly, so that the interface remains cohesive.
12. As a user downloading media, I want the mascot companion to accurately reflect the inspection and download phases when using browser session handoff, so that visual feedback remains consistent.
13. As a user whose browser database is temporarily locked by an open browser tab, I want Vetch101 to gracefully handle the temporary lock or guide me, so that the application never crashes.
14. As a user configuring my preferred browser target, I want my choice to be remembered across application restarts, so that I do not have to re-select it every time I launch Vetch101.
15. As a user pasting a normal public video link (e.g. YouTube, TikTok), I want normal downloads to work smoothly whether browser session handoff is turned on or off, so that general workflows are never disrupted.
16. As a user downloading an audio-only version of a stream protected by anti-bot verification, I want WAV and MP3 extraction to work seamlessly with browser session handoff, so that audio workflows remain fully functional.

## Implementation Decisions

1. **Browser Session Configuration Model**:
   - Introduce a structured model representing the browser handoff configuration:
     - `enabled`: boolean indicating whether browser session handoff is active.
     - `browser`: string enum representing the selected target (`chrome`, `edge`, `brave`, `firefox`).
   - Persist user preferences in local storage (`vetch101_browser_handoff_enabled` and `vetch101_browser_target`) with sensible defaults (`enabled: false`, `browser: "chrome"` or `"edge"`).

2. **Backend IPC Contracts & Engine Command Integration**:
   - Extend the media inspection seam (`fetch_metadata`) and download execution seam (`start_download`) to accept an optional browser target parameter.
   - When a browser target is provided:
     - The engine appends `--cookies-from-browser <target>` to the `yt-dlp` arguments during both metadata inspection and payload downloading.
   - When no browser target is provided or disabled, argument assembly remains completely untouched, preserving existing lightweight behavior.

3. **Direct Stream Manifest Interception**:
   - In the metadata extraction pipeline, inspect the incoming URL before or during generic extraction:
     - If the URL path terminates in `.m3u8` or contains common HLS/DASH manifest patterns (`.m3u8`, `.mpd`), bypass strict page structure checks.
     - Provide a default synthetic title (e.g. `Stream_YYYYMMDD_HHmmss`) and default quality tier representation if upstream metadata extraction returns minimal payload.
     - Allow immediate video format selection and pipeline execution.

4. **UI Placement & Hybrid Fallback Interaction**:
   - Embed a compact control bar immediately beneath the primary URL input card:
     - A toggle switch: "ใช้ Cookies จากเบราว์เซอร์" (Use Browser Cookies).
     - An adjacent compact dropdown selector enabling choice of browser (`Chrome`, `Edge`, `Brave`, `Firefox`) when the toggle is active.
     - An informational tooltip explaining that cookies are read locally on-demand solely for media authentication without remote transmission.
   - In the `ErrorBanner` / session error state:
     - If an error includes `HTTP Error 403`, `Cloudflare`, or `anti-bot challenge` and the cookie toggle is currently off, render a dedicated action button: "ลองใหม่อีกครั้งด้วย Cookies จากเบราว์เซอร์".
     - Clicking the button automatically toggles the setting on and immediately re-triggers inspection for the current URL.

5. **Concurrency & Execution Safety**:
   - Cookie argument injection must strictly adhere to the existing download lock and concurrency guard: parameter changes cannot be injected into an active in-flight download operation.

## Testing Decisions

- **Seam Selection**:
  - Test at the highest possible seams:
    1. **Frontend Session & Controller Seam (`tests/browser-session.test.mjs`)**: Unit tests using Node test runner verifying state transitions, storage persistence, fallback trigger detection on 403 error messages, and URL stream pattern detection.
    2. **Engine IPC & Argument Builder Seam (`src-tauri/src/engine/`)**: Unit tests in Rust verifying that `fetch_media_details` and `MediaPipeline` correctly assemble `--cookies-from-browser` flags and that direct stream URLs produce valid `MediaDetails` structures without panic.
- **Testing Criteria**:
  - Test only observable external behavior: flag presence, state transitions, fallback availability, and stream ingestion outcomes. Avoid testing internal subprocess hooks directly.
- **Prior Art**:
  - Follow patterns established in `tests/updater.test.mjs`, `tests/history.test.mjs`, and `src-tauri/tests/metadata_network.rs`.

## Out of Scope

- Automated bypass of hardware-level DRM (e.g. Widevine L1/L3, FairPlay, PlayReady).
- Headless browser rendering or automated CAPTCHA solving server infrastructure (Selenium, FlareSolverr microservices).
- Modifying browser profile files on disk; reading is strictly non-destructive.
- Storing or transmitting user cookies or passwords outside the local host environment.

## Further Notes

- Browser SQLite cookie files on Windows are protected via Windows DPAPI; running under the active user account allows `yt-dlp` to decrypt and access sessions seamlessly without administrator escalation.
- Edge is universally pre-installed on Windows 10/11, ensuring a guaranteed fallback browser target is always available on any Windows host machine.
