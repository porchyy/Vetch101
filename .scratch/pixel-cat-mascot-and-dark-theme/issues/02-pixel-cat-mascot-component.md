# 02: Cozy Pixel Cat Mascot Component with 5 Lifecycle Moods & Header Toggle

**What to build:** An interactive 16-bit pixel-art cat companion floating in the lower-right corner of the application view. The cat reacts dynamically to media pipeline states across 5 moods (`idle`, `inspecting`, `downloading`, `success`, `error`). Users can toggle the mascot visibility using a paw icon button in the header, with visibility saved to local storage.

**Blocked by:** 01: Dual Theme System (Dark/Light Mode) with Header Toggle and Persistence.

**Status:** done

- [x] Implement `src/mascot-state.ts` providing pure derivation function `deriveMascotMood(status, isDownloading, isInspecting, downloadProgress, error, recentSuccess)` producing the active mood.
- [x] Create `src/components/PixelCat.tsx` rendering pixel-crisp SVG/frame sprite art for all 5 moods (`idle`, `inspecting`, `downloading`, `success`, `error`).
- [x] Style the floating companion container in `src/App.css` with non-blocking pointer events and smooth entrance/exit animations.
- [x] Add mascot toggle button (Paw icon) in `src/App.tsx` header toolbar with local storage persistence.
- [x] Write unit tests in `tests/mascot.test.mjs` verifying mood mapping and edge cases.
