# Codebase Architecture Deepening & Consolidation

## Problem Statement

As Vetch101 expanded to support photo album downloading alongside video downloading, architectural friction accumulated across three main surfaces:

1. **Backend Media Engine Duplication & Seam Asymmetry**: Video downloads and photo album downloads run through two parallel, shallow modules that duplicate mutual-exclusion locks, URL validation, and progress reporting. Photo album downloads lack robust process-tree termination during network hangs, and saved file names are communicated out-of-band via asynchronous event streams rather than through the command's return interface, creating a race condition for history persistence.
2. **Overloaded Polymorphic Media Model**: A single data structure is forced to represent both videos and photo albums, requiring dummy `null` durations and empty quality arrays for photo posts. Callers must inspect string flags to guess which fields are populated.
3. **Frontend State Fragmentation**: The primary application component choreographs over ten disjoint state hooks, references, and debounced timers across hundreds of lines of procedural code. The pure input reducer is too shallow to govern the actual download and cancellation lifecycle, forcing arbitrary state patches.
4. **Duplicate and Orphaned History Persistence**: An entire history persistence module exists with zero callers, while the application component directly accesses local storage with a separate key and unencapsulated logic.
5. **Component Duplication**: Presentation cards for videos and photo albums duplicate folder selection, progress monitoring, and completion banners while passing ten identical properties across branching views.

From the user's perspective, this architectural fragmentation risks sluggish cancellation during network stalls, potential discrepancies in download history, and increased likelihood of regressions when new media sources or formats are introduced.

## Solution

Deepen the core modules of the application to provide clear leverage for callers and high locality for maintainers:

1. **Unified Backend Media Pipeline**: Consolidate all download execution behind a single deep pipeline module that manages concurrency, universal process-tree cancellation, progress streaming, and returns a verified, synchronous outcome containing saved file paths.
2. **Discriminated Media Inspection Seam**: Separate video metadata and photo album metadata into an explicit discriminated union crossing the IPC seam, making invalid states unrepresentable.
3. **Cohesive Download Session Controller**: Encapsulate all frontend lifecycle management—URL debouncing, IPC event listeners, concurrency guards, and status transitions—inside a single, robust session controller module.
4. **Authoritative History Repository**: Retain a single, authoritative history repository module with automatic persistence, deduplication, and LRU eviction, eliminating all duplicate inline storage logic.
5. **Composite Result Card Shell**: Unify the presentation shell for folder selection, progress indication, and completion status, providing dedicated slots for media-specific controls (video resolution picker vs. photo strip preview).

## User Stories

1. As a user downloading media, I want all download tasks (whether video or photo albums) to run through a unified, reliable pipeline so that the application behavior is consistent regardless of media type.
2. As a user downloading a multi-image photo album, I want cancelling the download to immediately terminate any active network transfers so that my connection and disk are not tied up.
3. As a user who cancels a download, I want files that have already finished downloading to remain intact on my disk so that I do not lose progress already made.
4. As a user with slow or intermittent internet, I want the cancellation button to respond instantaneously even when external transfer tools are waiting for packets.
5. As a user downloading a video, I want the history entry to record the exact final file name on disk reliably without missing information caused by event timing delays.
6. As a user downloading an image album, I want the history entry to allow opening the downloaded folder or primary file directly from the history drawer.
7. As a user inspecting a photo album link, I want the application to present a clear, photo-focused model without misleading placeholder video resolutions or zero-duration labels.
8. As a user inspecting a video link, I want the application to present audio and video options cleanly without confusing photo-specific format toggles.
9. As a user entering or pasting a URL, I want typing and pasting to be handled by a single state controller so that rapid input or clipboard actions never trigger duplicate inspection requests or race conditions.
10. As a user who encounters a network error while downloading, I want concurrency locks to be released automatically so that I can immediately retry or download another link without refreshing the app.
11. As a user reviewing download history, I want history items to persist reliably across application restarts using a single, unified storage format.
12. As a user clearing my history, I want all history entries to be removed completely from local storage without leaving ghost entries or orphaned keys.
13. As a user with hundreds of downloads, I want history to automatically evict the oldest entries beyond the capacity limit so that application memory and local storage remain efficient.
14. As a keyboard-only user, I want full focus navigation across the input field, format toggles, action buttons, and history list with clear, visible focus rings.
15. As a user switching between video and photo downloads, I want the folder picker, progress bar, and completion feedback to look and feel completely uniform.
16. As a user choosing where to save downloads, I want changing the destination folder once to apply universally to both video and photo downloads.
17. As a developer maintaining the codebase, I want media downloads to sit behind a small, deep interface so that adding new extractors or media types requires changing only the pipeline implementation without touching UI orchestration.
18. As a developer writing tests, I want to test the entire download lifecycle without needing live network access or compiling mock executable binaries.
19. As a developer testing metadata inspection, I want to supply test fixtures across an execution adapter seam so that error parsing and schema handling can be verified in milliseconds.
20. As a developer maintaining frontend views, I want the main application component to focus purely on rendering layout rather than coordinating ten disjoint state hooks and lock references.

## Implementation Decisions

### Decision 1: Unified Backend Media Pipeline Module
- Replace separate video and photo download execution modules with a unified `MediaPipeline` deep module.
- The interface accepts a typed `DownloadRequest` (`Video` or `PhotoAlbum`) and returns a synchronous `DownloadOutcome` containing verified primary and secondary file paths.
- Concurrency locks (`DownloadManager`), destination directory validation, and process-tree supervision are centralized inside this module.
- All child subprocesses (`yt-dlp`, `curl`, `ffmpeg`) are monitored under a universal cancellation watcher using asynchronous selection, ensuring instant termination via Windows Job Objects and process tree kills.

### Decision 2: Discriminated Union for Media Inspection
- Replace the overloaded `VideoMetadata` struct with a tagged discriminated union `MediaDetails`:
  - `MediaDetails::Video` contains title, channel, duration, thumbnail, and resolution/quality options.
  - `MediaDetails::PhotoAlbum` contains title, channel, cover image, and an ordered list of image URLs.
- The IPC seam returns this discriminated union, ensuring that the frontend type system statically prevents referencing video qualities on photo posts or image strips on video posts.

### Decision 3: Subprocess Execution Adapter Port
- Define an internal `CommandRunner` port in the backend engine to abstract process execution and HTTP requests.
- The production adapter executes platform tools (`yt-dlp`, `curl`, `ffmpeg`) with hidden-window flags.
- The test adapter returns predetermined stdout strings and exit codes, allowing end-to-end pipeline and inspection tests to run in-process without network access or precompiled fixture binaries.

### Decision 4: Cohesive Frontend Download Session Controller
- Consolidate all download lifecycle management from the top-level application component into a `useDownloadSession` hook module.
- The hook interface exposes guarded actions: setting the URL, triggering inspection, initiating download, and cancelling.
- The hook internally encapsulates debounce timing, IPC progress event subscription, cancellation cleanup, and concurrency lock release in a `finally` block.
- The top-level application component becomes a declarative view layer that simply binds session properties to UI elements.

### Decision 5: Authoritative History Repository
- Consolidate all history persistence into the dedicated history module.
- Eliminate all duplicate inline local storage reads, writes, and interfaces from the application component.
- The history module manages LRU capacity limits, deduplication by file path or identifier, and provides a clean hook interface for the presentation layer.

### Decision 6: Composite Media Result Card Shell
- Extract common presentation logic (folder selection, progress indicators, completion actions) into a single result card shell.
- The shell hosts a content slot that renders either the video quality selector or the photo strip preview based on the media type.
- This reduces property passing from twenty-four individual properties across branch cards to four structured properties.

## Testing Decisions

1. **Seam Placement**:
   - Backend tests will target the `MediaPipeline` and `MediaInspector` interfaces using the `CommandRunner` test adapter seam.
   - Frontend tests will target the `useDownloadSession` and `HistoryRepository` interfaces using mock transport adapters for Tauri IPC.
2. **Behavior Over Implementation**: Tests will assert that requests initiate the expected state transitions, that cancellations reap processes, that successful downloads emit verified outcomes, and that storage deduplication behaves correctly. Tests will not assert private internal helper functions.
3. **Prior Art in Codebase**:
   - `tests/video-input.test.mjs` and `tests/history.test.mjs` provide patterns for Node.js unit tests.
   - `src-tauri/src/engine/downloader.rs` tests provide patterns for concurrent job exclusion and cancellation assertion.

## Out of Scope

- Adding support for new platforms outside of YouTube and TikTok.
- Implementing a multi-download simultaneous queue (the application intentionally enforces single-job concurrency).
- Cloud storage synchronization or remote history backup.
- Native mobile builds or non-desktop window managers.

## Further Notes

- All changes adhere strictly to the `codebase-design` vocabulary: modules, interfaces, depth, seams, adapters, leverage, and locality.
- Existing user-facing features, keyboard navigation, and Thai language labels remain completely preserved throughout the refactoring.
