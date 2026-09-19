# 02: Discriminated Media Inspection Seam

**What to build:** An explicit, type-safe discriminated union for media inspection crossing the Tauri IPC seam between Rust and TypeScript (`MediaDetails::Video` vs `MediaDetails::PhotoAlbum`), making invalid combinations unrepresentable.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Rust IPC commands return a tagged discriminated union `MediaDetails` instead of overloaded `VideoMetadata`.
- [x] `MediaDetails::Video` contains video metadata, durations, and resolution options; `MediaDetails::PhotoAlbum` contains album title, cover, and list of image items without dummy durations or empty formats.
- [x] TypeScript models in `src/models.ts` mirror the discriminated union with exhaustive type narrowing.
- [x] Existing TikTok photo album links and YouTube/TikTok video links parse cleanly into their respective variants.
- [x] Rust tests verify correct variant deserialization and response payloads.
