# 02: Browser Session Handoff & Target Selection

**What to build:** Allow users to toggle browser session handoff and select a target browser (Chrome, Edge, Brave, Firefox). Pass the selected browser target through IPC to the metadata inspector and media downloader, appending `--cookies-from-browser <target>` to yt-dlp commands. Persist choices in local storage.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Browser session state and persistence helpers in frontend
- [x] UI control bar below URL input with toggle switch, target dropdown, and privacy note
- [x] IPC seam extension to accept optional `browser: Option<String>` in `fetch_metadata` and `start_download`
- [x] Backend argument construction appends `--cookies-from-browser <target>` safely
- [x] Unit tests for browser target validation and command argument formatting
