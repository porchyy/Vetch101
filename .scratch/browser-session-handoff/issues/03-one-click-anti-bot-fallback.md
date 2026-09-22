# 03: One-Click Anti-Bot Fallback & Error Recovery

**What to build:** Detect HTTP 403 / Cloudflare anti-bot challenge errors during media inspection or download when browser session handoff is disabled. Present an interactive action button in the error notification allowing immediate one-click retry using browser cookies.

**Blocked by:** 02: Browser Session Handoff & Target Selection

**Status:** done

- [x] Helper function to detect anti-bot and 403 error patterns from error messages
- [x] Error UI component displays "ลองใหม่อีกครั้งด้วย Cookies จากเบราว์เซอร์" button when applicable
- [x] Clicking fallback action activates browser handoff and re-triggers inspection for the current URL
- [x] Unit tests for error pattern matching and fallback transition states
