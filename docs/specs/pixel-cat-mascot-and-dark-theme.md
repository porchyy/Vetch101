# Specification: Pixel Cat Companion & Dark/Light Theme System

## Problem Statement

Users of Vetch101 interact with a functional media downloader that currently features a single, static light-cream visual palette and purely textual status feedback. During extended night-time usage or low-light room sessions, the bright background can cause eye strain and glare. Additionally, media inspection and multi-gigabyte video downloading processes run without visual charm or playful life; users must interpret technical spinners and progress percentages rather than experiencing a delightful, emotionally rewarding companion presence. Furthermore, users have diverse visual preferences and need the flexibility to choose between high-contrast daylight clarity and a cozy, nocturnal aesthetic, with full control to show or hide non-essential visual elements as desired.

## Solution

Vetch101 will introduce a coordinated visual enhancement system comprising two integrated features:
1. **Dark & Light Visual Themes**: A dual-theme system allowing instant switching between the signature warm terracotta light theme and a meticulously balanced dark slate/charcoal nocturnal theme. The active theme persists across application restarts and defaults intelligently to the operating system's color scheme preference on initial launch.
2. **Cozy Pixel Cat Mascot Companion**: An interactive, animated 16-bit pixel art cat anchored as a floating companion in the lower-right corner of the application. The mascot synchronizes dynamically with the media pipeline lifecycle across five expressive emotional moods (`Idle`, `Inspecting`, `Downloading`, `Success`, and `Error`), bringing personality and instantaneous visual status awareness. A dedicated header toggle allows users to show or hide the mascot at will.

## User Stories

1. As a night-time user, I want to switch the application into a dark charcoal theme, so that I can use the downloader comfortably in a dim room without blinding screen glare.
2. As a daytime user, I want to switch the application back into the signature warm terracotta light theme, so that text and interface elements remain sharp and easy to read in bright sunlight.
3. As a frequent user, I want my selected theme to be automatically saved, so that the application reopens in my preferred theme every time without manual re-selection.
4. As a first-time user whose operating system is set to dark mode, I want the application to automatically start in dark mode, so that it matches my system environment seamlessly from the first launch.
5. As a user, I want to click a sun/moon icon toggle in the top header, so that I can immediately flip between dark and light modes with an intuitive, single click.
6. As a user, I want the theme transition to be instantaneous and free of unstyled flashes, so that switching themes feels smooth, polished, and pleasant.
7. As a user downloading media, I want a cute pixel-art cat companion in the corner of my screen, so that the application feels lively, friendly, and fun to use.
8. As a user with no active downloads, I want the cat mascot to sleep or blink peacefully in an idle state, so that the companion provides calm ambient warmth without being distracting.
9. As a user pasting or dragging a video link, I want the cat mascot to display an inspecting mood with inquisitive eyes or a magnifying glass, so that I immediately know the app is actively analyzing my link.
10. As a user waiting for a large video or album to finish, I want the cat mascot to energetically run and carry download cargo, so that the waiting period feels engaging and clearly conveys ongoing work.
11. As a user whose download completes successfully, I want the cat mascot to celebrate with joy and celebratory sparkles/hearts, so that I receive an immediate and heartwarming visual reward.
12. As a user encountering a network failure or invalid link, I want the cat mascot to display a gentle, dizzy or sweating error expression, so that problems feel less frustrating and immediately noticeable.
13. As a user who values a strictly minimalist or compact interface, I want a paw-icon toggle button in the header toolbar, so that I can hide or show the mascot companion at any time.
14. As a user who hid the mascot, I want my preference remembered across restarts, so that the mascot remains hidden until I explicitly choose to bring it back.
15. As a high-DPI or 4K monitor user, I want the pixel art cat to render with razor-sharp pixelated edges rather than blurry interpolation, so that the authentic retro aesthetic is preserved.
16. As a dark mode user, I want the cat mascot to feature clear contrast or subtle ambient separation, so that dark fur and outlines remain easily distinguishable against dark slate backgrounds.
17. As an interactive user, I want to hover or click on the mascot companion, so that the cat playfully reacts with a cheerful bounce or tail wag.
18. As a power user managing multiple downloads, I want the mascot's mood updates to be strictly passive and lightweight, so that animation logic consumes negligible CPU and never interferes with download speeds.

## Implementation Decisions

### 1. Theme Architecture & Tokenization
- **Theme Attribute Modeling**: The active theme will be declared on the root DOM element using a dedicated dataset attribute supporting two canonical values: `light` and `dark`.
- **Palette Tokens**:
  - `Light Theme`: Retains existing warm cream surfaces, terracotta orange accent, neutral stone borders, and dark charcoal text.
  - `Dark Theme`: Utilizes deep slate/charcoal surface backgrounds, elevated card layers with subtle depth borders, brightened terracotta accent for contrast accessibility, and high-readability off-white typography.
- **Persistence & Synchronization**: A dedicated theme management module will persist the user's explicit theme preference in local storage. When no saved preference exists, it will resolve against the window media match query for system dark mode.
- **No-Flash Guarantee**: The initial theme will be resolved synchronously before initial layout rendering to avoid theme flickering during startup.

### 2. Companion Mascot State & Lifecycle
- **State Decomposition**: The mascot lifecycle will be modeled as a pure state derivation function that consumes core session status, download state, and error signals to produce exactly one of five canonical moods:
  - `idle`: Session is idle or ready, no active inspection or download.
  - `inspecting`: Media link inspection is underway.
  - `downloading`: Active download progress stream is running.
  - `success`: Media download or inspection completed successfully within a recent celebratory time window.
  - `error`: Inspection or download resulted in a terminal error.
- **Visual Presentation & Rendering**: The pixel cat will be rendered using crisp CSS pixelated image scaling (`image-rendering: pixelated`) with SVG/frame vector definition to ensure zero asset bloat, instant loading, and sharp rendering on all screen scaling factors (100% to 200%+).
- **Placement & Layout Isolation**: The mascot companion will be positioned fixed at the bottom-right corner of the application view. It will be layered with pointer-events configured so that it never traps mouse events or blocks access to history action buttons.
- **Visibility Persistence**: The mascot visibility state will be persisted in local storage and toggled via a dedicated paw icon button (`Mascot Toggle`) situated in the header action bar alongside update checks.

### 3. Concurrency & Performance
- **Zero Runtime Overhead**: All mascot animations will leverage pure CSS keyframe animations running on the compositor thread with hardware acceleration. JavaScript will only be responsible for transitioning the state class string when the application lifecycle status changes.
- **Accessibility & Motion Preferences**: Animations will respect operating system `prefers-reduced-motion` queries, switching to gentle static poses when reduced motion is requested.

## Testing Decisions

### Good Test Principles
- Tests must verify external observable behavior and state contracts, never internal CSS strings or private component details.
- Theme tests must verify that selecting themes correctly updates the active state, persists to storage, and falls back to system preferences.
- Mascot tests must verify that lifecycle state transitions (e.g. going from idle -> inspecting -> downloading -> success -> idle) correctly map to the corresponding mood states without regression or stuck moods.

### Modules Under Test
- **Theme Manager Module**: Unit test suite verifying initial fallback, explicit switching, storage persistence, and recovery from missing or corrupt storage entries.
- **Mascot State Derivation Module**: Pure reducer/derivation unit tests validating that each media pipeline state produces the correct mood, and that transient states (like success celebration) transition predictably.

### Prior Art
- Existing frontend tests in `tests/*.test.mjs` using Node.js built-in test runner (`node --test`), specifically `updater-state.test.mjs` and `session-state.test.mjs` which test pure state transitions and lifecycle safety.

## Out of Scope

- User-customizable cat color skins or clothing accessories.
- Audio sound effects or meowing noises (can be revisited in future updates if requested).
- Mascot physics dragging across the screen (floating corner placement provides ideal ergonomics without cluttering controls).
- More than two visual color themes (e.g., custom RGB accent color pickers are excluded to maintain design cohesion).

## Further Notes

- The Mascot SVG sprites and animations will be embedded directly in the frontend bundle, adding less than 10 KB to the package size with zero external network dependencies.
- The Terracotta brand color (`#c85a32`) remains the unified accent anchor across both light and dark themes, maintaining strong product identity.
