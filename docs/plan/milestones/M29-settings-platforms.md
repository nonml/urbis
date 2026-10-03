# M29 — Settings, accessibility, saves and platforms

From: `docs/plan/features/mechanics.md` GAP-17-002 to GAP-17-064 (GAP-17-007 is M13-2's,
GAP-17-024 and -052 are M24-1's, GAP-17-038 is M20-11's); `docs/plan/CAPABILITIES.md`
M7-4's accessibility tab, M9-6's cloud services, D13's pad in the city view, and the
four games' language and screen options. M7 brings the first settings, one gamepad
mapping and three save slots; M29 brings every option the four games give: graphics to
ray tracing, accessibility, languages, difficulty, pads, the builder's game options, a
full save menu, clips and an editor, the platforms, editions and a companion page.
Pillar: the front door (anyone can play it on what they have).

Needs first: M7 (settings, slots, the pad), M9.T2 (the Steam binding), M27 (the HUD and
menus), M28 (subtitles and the mixer). Lane: front door.

## Keys

- **F5** quick-saves to its own slot, in the street and the city view.
- **F8** keeps the last 60 s as a clip.
- With a pad: the street as M7-8, and the city view as M29-6 sets out.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M29-1 | **Graphics:** presets (low, medium, high, ultra) and each part on its own: frame cap (30, 60, 120, none) and vertical sync, anti-aliasing (off, FXAA, SMAA, TAA), draw distance for buildings and for detail, texture, water and shadow quality, crowd and traffic density and variety, a render scale with an upscaler (sharpened or temporal) and its quality, a performance or quality mode; toggles for motion blur, depth of field, lens flare, film grain, chromatic aberration, camera shake and head bob; brightness by a calibration picture; HDR output with a peak calibration on an HDR screen; the sim on its own worker thread or the main thread. Every setting changes the frame in a shot check, and low holds 60 fps on the operator's slowest machine | `tests/accept/m29-graphics.spec.js` | partial: M7-4 plans quality, resolution scale and field of view | GAP-17-004, GAP-17-006, GAP-17-008, GAP-17-022, GAP-17-025, GAP-17-026, GAP-17-030, GAP-17-034, GAP-17-037, GAP-17-039, GAP-17-043, GAP-17-045, GAP-17-055, GAP-17-056, GAP-17-058 |
| M29-2 | **Ray tracing:** where the browser has WebGPU, a top setting draws ray-traced reflections and shadows through three.js's WebGPU renderer with a denoiser, holding 30 fps on the operator's best machine; photo mode (M27-4) can render a path-traced still | `tests/accept/m29-rt.spec.js` | red | GAP-17-015, GAP-17-021, GAP-17-036 |
| M29-3 | **Accessibility:** a tab of its own: colour-blind filters for the interface and the world's marks (three kinds), interface scale (75-200%) and a larger font, the HUD's safe zone and size, each HUD element on or off, notification kinds filtered, subtitles on or off for speech and radio, their size and background, hold or toggle for every held action, and the M28-8 sound subtitles. Every option is reachable without a mouse | `tests/accept/m29-access.spec.js` | partial: M7-4 plans subtitle size | GAP-17-005, GAP-17-023, GAP-17-035, GAP-17-041, GAP-17-042, GAP-17-064 |
| M29-4 | **Languages:** every word the game shows is in a string table (a check fails on a hard-coded string); the interface and subtitles take one language and spoken lines another; English first, and the languages the operator picks, below | `tests/m29-strings.test.js`, `tests/accept/m29-lang.spec.js` | red: strings are in the code | GAP-17-011 |
| M29-5 | **Difficulty:** easy, normal, hard and very hard, changed at any time from the pause menu; each sets enemies' damage and health, the police's response time and the price of failure (stated in `BALANCE.md`); a story setting makes fights short and the police gentle | `tests/m29-difficulty.test.js` | red | GAP-17-009 |
| M29-6 | **Pads and devices:** a pad plays the city view too (move the cursor, pick tools from a wheel, place, rotate, zoom: D13's pad); three preset layouts and rebinding; vibration on or off, and trigger resistance on pads that have it; steering sensitivity and stick dead zones; on Windows, lit keyboards and mice follow the game (the wanted stars, low health) | `tests/accept/m29-pad.spec.js` | partial: M7-8 plans the street on a pad | GAP-17-002, GAP-17-014, GAP-17-019, GAP-17-020, GAP-17-050 |
| M29-7 | **The builder's game options:** a new city can start with unlimited money, all buildings unlocked, or as a sandbox with neither money nor milestones; the game can pause itself when a city loads; the day and night cycle can be stopped at any hour | `tests/accept/m29-options.spec.js` | partial: T jumps to day or night | GAP-17-046, GAP-17-047, GAP-17-048, GAP-17-049, GAP-17-063 |
| M29-8 | **Saves:** a save menu loads, overwrites and deletes, each slot with a picture and its details; F5 quick-saves; autosave every 5, 10 or 30 game minutes, or off, with an icon while it saves; a save from every earlier release loads in the latest (M9-3's migrations, tested on each); saves, maps and scenarios export to and import from files; saves, achievements and friends sync through Steam's cloud (M9-6) | `tests/accept/m29-saves.spec.js` | partial: one slot loads at boot (M7-7 plans three) | GAP-17-016, GAP-17-031, GAP-17-053, GAP-17-057, GAP-17-059, GAP-17-061 |
| M29-9 | **Clips and the editor:** F8 keeps the last 60 s of play, and a record button keeps longer takes, each into a project; the editor in the pause menu lays clips on a timeline, trims and orders them, sets each cut's camera (free, follow, fixed to a vehicle, the free camera of M27-11), its speed, focus, blur and lens effects, colour filters and grades, adds music (M28) and sound effects, titles, subtitles and credits, and renders and exports a video file | `tests/accept/m29-clips.spec.js` | red | GAP-17-040, GAP-19-004, GAP-19-005, GAP-19-006, GAP-19-007, GAP-19-008, GAP-19-009, GAP-19-010, GAP-19-011 |
| M29-10 | **Platforms:** Windows and macOS (M9), Linux, and the Steam Deck rated "verified": the pad covers everything and the text is readable at 1280 × 800; the Steam overlay opens for friends and screenshots; the stated system needs are measured on the operator's machines, and a city loads in 10 s from a solid-state drive. Consoles, if the operator signs with one: a port to its runtime, pad only, saves carried across by the cloud | `tests/accept/m29-deck.spec.js`, `scripts/ship-check.mjs` | partial: an Electron build for Mac; Windows planned (M9) | GAP-17-012, GAP-17-017, GAP-17-028, GAP-17-029, GAP-17-033, GAP-17-051 |
| M29-11 | **Editions:** the store sells a standard edition and a special edition (the soundtrack as files, 3 outfits, a car, a safehouse); a pre-order item; later packs (M33) as one-off buys, in bundles and in a pass; a jump-start that begins a pack's story with a set level (M23); reward points earned on achievements buy outfits and weapons across saves. Each is read from Steam's ownership (M9.T2) | `tests/accept/m29-editions.spec.js` | red | GAP-17-003, GAP-17-018, GAP-17-032, GAP-17-054, GAP-17-060, GAP-17-062 |
| M29-12 | **The companion page:** the game shows a code; the player's real phone opens a page on the same network to train the dog (M26-6), order a car to the player (M18-15) and see the map; changes reach the game within 2 s | `tests/accept/m29-companion.spec.js` | red | GAP-17-027 |
| M29-13 | **Achievements:** 60 in the game's own list and on Steam (M9-6 has 10), across the street and the city view; a cheat (M17-12, M26-10) or the builder's game options (M29-7) turn them off for that game | `tests/m29-achievements.test.js` | partial: M9-6 plans 10 | — |
| M29-14 | Every setting here survives a reload and a new release; the sweep of every settings tab, language, preset, platform and the editor has 0 open defects | `tests/accept/m29-persist.spec.js`, the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M29.T1 | **Checks, red: the screen.** `m29-graphics.spec.js`, `m29-rt.spec.js`, `m29-access.spec.js`, `m29-strings.test.js`, `m29-lang.spec.js`, `m29-difficulty.test.js` | new `tests/accept/m29-graphics.spec.js`, new `tests/accept/m29-rt.spec.js`, new `tests/accept/m29-access.spec.js`, new `tests/m29-strings.test.js`, new `tests/accept/m29-lang.spec.js`, new `tests/m29-difficulty.test.js` | M7.T10 | M29-1 to M29-5 red | S |
| M29.T2 | **Graphics, the parts.** Frame cap and sync, anti-aliasing, draw distances, qualities, density, the upscaler, the modes | new `src/render/quality.js`, `src/main.js`, `src/ui/settings.js` | M29.T1 | M29-1 (part) | M |
| M29.T3 | **Graphics, the effects.** The effect toggles, brightness calibration, HDR, the sim's worker | `src/render/atmosphere.js`, `src/render/quality.js`, new `src/sim/worker.js` | M29.T2 | M29-1 | M |
| M29.T4 | **Ray tracing.** The WebGPU path for reflections and shadows, the denoiser; the path-traced still (a package, below) | `src/render/quality.js`, new `src/render/raytrace.js`, `src/game/photomode.js` | M29.T3 | M29-2 | M |
| M29.T5 | **Accessibility.** The tab and its options; keyboard reach for every option | `src/ui/settings.js`, `src/game/hud.js`, `src/ui/feed.js`, `src/game/input.js` | M29.T1, M27.T13 | M29-3 | M |
| M29.T6 | **Strings.** Every shown word moved into `content/strings/en.json`; the check for hard-coded strings | new `content/strings/en.json`, new `src/i18n.js`, `src/` | M29.T1 | M29-4 (part) | M |
| M29.T7 | **Languages.** Separate text and voice languages; the operator's languages translated | new `content/strings/`, `src/i18n.js`, `src/audio/voices.js` | M29.T6 | M29-4 | M |
| M29.T8 | **Difficulty.** Four levels and story mode; the numbers in `BALANCE.md` | `src/sim/combatai.js`, `src/sim/wanted.js`, `src/ui/pause.js`, `docs/BALANCE.md` | M29.T1, M13.T3 | M29-5 | S |
| M29.T9 | **Checks, red: the rest.** `m29-pad.spec.js`, `m29-options.spec.js`, `m29-saves.spec.js`, `m29-clips.spec.js`, `m29-deck.spec.js`, `m29-editions.spec.js`, `m29-companion.spec.js`, `m29-achievements.test.js`, `m29-persist.spec.js` | new `tests/accept/m29-pad.spec.js`, new `tests/accept/m29-options.spec.js`, new `tests/accept/m29-saves.spec.js`, new `tests/accept/m29-clips.spec.js`, new `tests/accept/m29-deck.spec.js`, new `tests/accept/m29-editions.spec.js`, new `tests/accept/m29-companion.spec.js`, new `tests/m29-achievements.test.js`, new `tests/accept/m29-persist.spec.js` | M29.T1 | M29-6 to M29-14 red | S |
| M29.T10 | **Pads.** The city view on a pad; layouts; vibration and triggers; sensitivity and dead zones | `src/game/input.js`, `src/ui/cityview.js`, `src/ui/settings.js` | M29.T9, M7.T15 | M29-6 (part) | M |
| M29.T11 | **Lit devices.** Keyboards and mice lit by the game on Windows | `electron.cjs`, new `src/platform/lights.js` | M29.T10 | M29-6 | S |
| M29.T12 | **The builder's options.** Unlimited money, unlock all, sandbox; pause on load; stopping the cycle | `src/sim/newgame.js`, `src/sim/clock.js`, `src/sim/budget.js`, `src/ui/title.js` | M29.T9 | M29-7 | S |
| M29.T13 | **The save menu.** Pictures and details, overwrite, delete, F5, autosave and its icon, every old release's save, export and import, cloud sync | new `src/ui/saves.js`, `src/savestore.js`, `src/sim/save.js`, `electron.cjs` | M29.T9, M9.T8 | M29-8 | M |
| M29.T14 | **Clips and the editor.** The 60 s buffer, F8, the editor's cuts, cameras, speed and music, export | new `src/game/clips.js`, new `src/ui/editor.js`, `src/game/campaths.js` | M29.T9, M27.T7 | M29-9 | M |
| M29.T15 | **Platforms.** Linux; the Deck's checks; the overlay; system needs measured; load time | `electron.cjs`, `scripts/ship-check.mjs`, `package.json` | M29.T10, M9.T4 | M29-10 | M |
| M29.T16 | **Editions and the companion page.** Ownership from Steam; the edition items, pre-order item, packs, pass, jump-start, reward points; the page served on the network and its code | new `src/platform/editions.js`, new `src/platform/companion.js`, `electron.cjs` | M29.T15, M9.T2 | M29-11, M29-12 | M |
| M29.T17 | **Achievements.** Sixty, on the event tape; turned off by cheats and game options | `src/sim/achievements.js`, `src/sim/events.js` | M29.T9, M9.T7 | M29-13 | S |
| M29.T18 | **Close.** Settings through reload and a new release; the sweep of every tab, language, preset, platform and the editor; one commit per defect; F5 and F8 in the hints | the sweep, `content/hints.json` | all of the above | M29-14 | M |

## Decisions for the operator

- **Languages** (M29-4): which, beyond English, and who translates (a paid service or
  volunteers).
- **The path-traced still** (M29-2) needs a new npm package (three-gpu-pathtracer).
- **Consoles** (M29-10): whether to sign with a console maker (dev kits, a port).
- **Prices** (M29-11) of the editions, packs and pass.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M29-1 | GTA-18-031 |
| M29-3 | CP-18-032, CP-18-033, CP-18-034, CP-18-035, GTA-14-036, GTA-18-006 |
| M29-4 | CS-19-026, GTA-18-008, GTA-18-009 |
| M29-8 | GTA-18-003, GTA-20-026 |
