# 01: Direct Stream Ingestion (.m3u8 & .mpd)

**What to build:** Ingest raw `.m3u8` (HLS) and `.mpd` (DASH) direct stream links without scraper errors. Recognize stream manifest extensions, synthesize an automatic timestamp fallback title (e.g. `Stream_YYYYMMDD_HHmmss`) when metadata is absent, and download the stream directly via the backend pipeline.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Recognize `.m3u8` and `.mpd` URLs in validation and detection logic
- [x] Provide synthetic title and stream quality representation when upstream JSON metadata is minimal or absent
- [x] Frontend detects direct stream manifests and permits immediate download
- [x] Unit tests pass for direct stream URL detection and fallback title synthesis
