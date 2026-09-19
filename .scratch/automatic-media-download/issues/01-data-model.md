# 01: Prefactor — Widen data model & IPC contract for post type

**What to build:** Add a `PostType` discriminator (`video` | `photo_post`) to the metadata returned by `fetch_metadata`. Extend the IPC shape so photo posts can carry an ordered list of images with preview URLs and pixel dimensions. Widen the TypeScript types to match. No behaviour changes — video flow is unchanged, photo fields are simply absent/empty for now.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `PostType` enum in `models.rs` (`Video`, `PhotoPost`)
- [ ] `PhotoImage` struct: `index`, `preview_url`, `width?`, `height?`
- [ ] `MediaMetadata` struct replaces `VideoMetadata` on the wire; both Rust & TS share the same shape
- [ ] `video-input.ts` types updated; `videoInputReducer` unchanged logic
- [ ] Existing Node tests and Rust tests still pass
