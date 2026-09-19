# 01: Authoritative History Repository

**What to build:** A unified download history repository that persists downloaded items across app restarts with automatic LRU capacity eviction and deduplication, eliminating duplicate inline storage logic.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] All download history operations (load, save, clear, remove) go through `src/history.ts`.
- [x] History items preserve all required metadata (id, title, channel, timestamp, thumbnail, file path, media type, format).
- [x] Adding an existing downloaded path or URL updates the timestamp rather than duplicating entries.
- [x] Capacity is capped at the configured LRU limit (e.g. 50 items) with oldest items evicted first.
- [x] Unit tests verify storage serialization, deduplication, and eviction in isolation.
