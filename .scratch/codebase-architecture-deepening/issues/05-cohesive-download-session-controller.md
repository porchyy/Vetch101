# 05: Cohesive Download Session Controller

**What to build:** A cohesive React hook controller `useDownloadSession` that encapsulates all frontend lifecycle management—URL debouncing, IPC event listeners, concurrency guards, and status transitions—allowing `App.tsx` to become a declarative view layer.

**Blocked by:** 01: Authoritative History Repository, 03: Subprocess Execution Adapter & Unified Backend Media Pipeline, 04: Composite Media Result Card Shell

**Status:** done

- [x] `useDownloadSession` manages full lifecycle: URL inspection, download start/cancel, progress events, and history saving.
- [x] Concurrency lock state is reliably guarded with cleanup guaranteed in `finally` blocks.
- [x] Removes 10+ disjoint hooks and refs from `App.tsx`, shrinking `App.tsx` by over 300 lines.
- [x] History is recorded via `history.ts` synchronously using the verified `DownloadOutcome` returned from IPC.
- [x] Unit tests for `useDownloadSession` verify state transitions (idle -> inspecting -> inspected -> downloading -> finished/error).
