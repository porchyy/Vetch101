# 02: Auto-inspect on paste/drop with debounced typing

**What to build:** Pasting or dropping a URL fires `fetch_metadata` automatically — no "ตรวจสอบลิงก์" button press required. Typing debounces ~800 ms then inspects once the value is a valid URL. Revision-guard prevents out-of-order results from overwriting newer ones. The manual inspect button still works (for Enter key / re-check). Changing or clearing the URL kills any in-flight inspect result.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `handlePaste` / clipboard "วางลิงก์" button triggers auto-inspect after `changeUrl`
- [ ] `handleDrop` triggers auto-inspect
- [ ] Typing triggers debounced inspect (useEffect + setTimeout 800 ms), cancels on clear
- [ ] Inspect button / Enter key still work
- [ ] Node tests: paste, drop, type-then-clear, change-link, out-of-order responses
