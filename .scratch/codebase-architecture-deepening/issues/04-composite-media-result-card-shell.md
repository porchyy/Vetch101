# 04: Composite Media Result Card Shell

**What to build:** A composite media result card shell that unifies folder picking, progress bar display, cancel button, and completion status into one cohesive component with swappable preview slots for video vs photo albums.

**Blocked by:** 02: Discriminated Media Inspection Seam

**Status:** done

- [x] Folder picker, progress bar, cancel button, and completion alert are consolidated into a single reusable shell `MediaResultCard`.
- [x] Swappable media-specific slots render either video resolution selector or photo thumbnail strip.
- [x] Reduces component prop signature from twenty-four individual props across branching cards to four structured properties.
- [x] Full keyboard navigation (focus rings, Enter/Space activation) is preserved.
- [x] Visual regression test or component tests verify identical look and feel.
