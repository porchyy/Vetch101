# 06: Integration Verification & Legacy Cleanup

**What to build:** Full integration test verification across the unified codebase and elimination of deprecated duplicate modules and dead types.

**Blocked by:** 05: Cohesive Download Session Controller

**Status:** done

- [x] All Rust tests pass (`cargo test`).
- [x] All frontend tests pass (`npm test`).
- [x] TypeScript typecheck passes cleanly (`npm run build` / `npx tsc`).
- [x] Obsolete/dead code, superseded duplicate files (e.g. redundant `PhotoResultCard` or dead models), and orphaned types are cleanly deleted.
- [x] Git working tree is clean and ready for review.
