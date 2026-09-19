# 03: Theme Adaptation, Motion Accessibility & Full Verification

**What to build:** Visual polish ensuring high-contrast visibility for the pixel cat in dark mode, adherence to operating system reduced motion preferences, and comprehensive test verification across Node unit tests, TypeScript typechecks, and Rust cargo tests.

**Blocked by:** 01: Dual Theme System (Dark/Light Mode) with Header Toggle and Persistence, 02: Cozy Pixel Cat Mascot Component with 5 Lifecycle Moods & Header Toggle.

**Status:** ready-for-agent

- [ ] Add dark-mode outline/glow styling for the pixel cat to maintain clear contrast against dark slate surfaces.
- [ ] Add `@media (prefers-reduced-motion: reduce)` rules for mascot animations to ensure gentle static poses.
- [ ] Run `npx tsc --noEmit` and ensure 0 TypeScript diagnostics.
- [ ] Run `npm test` and ensure all test suites pass.
- [ ] Run `cargo test --lib` in `src-tauri` and ensure all Rust tests pass.
