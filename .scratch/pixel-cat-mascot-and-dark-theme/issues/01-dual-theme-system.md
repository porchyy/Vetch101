# 01: Dual Theme System (Dark/Light Mode) with Header Toggle and Persistence

**What to build:** An end-to-end theme management system supporting Light Theme (terracotta cream) and Dark Theme (charcoal/dark slate). Includes a responsive header toggle button (☀️ / 🌙) with instant transitions, persistent local storage synchronization, and operating system dark mode fallback on initial run.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Define CSS variables for dark theme under `[data-theme="dark"]` in `src/App.css` covering background, card, borders, text, and accessible terracotta accents.
- [ ] Implement `src/theme-manager.ts` exposing pure functions for initial theme resolution, toggle calculation, and storage persistence.
- [ ] Add theme toggle control in `src/App.tsx` header toolbar using Lucide Sun / Moon icons.
- [ ] Ensure initial page load applies the active theme synchronously to document element to eliminate theme flashing.
- [ ] Write unit tests in `tests/theme.test.mjs` verifying fallback logic, toggling, and storage recovery.
