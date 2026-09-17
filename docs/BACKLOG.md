# Backlog — real work, no calendar

Long-horizon items that are **not** the current queue. The near-term queue is
`docs/VISUAL-GAP-ACTIONS.md`; the structural roadmap is `docs/CHARTER.md`.

These were written against the previous renderer but survived it, because none of them
are renderer-bound: streaming, compression, memory discipline, world depth, accessibility
and launch readiness are true of any renderer. **Treat them as design specs, not as code
to port** — the implementation is gone, the thinking is not.

The original plan bound these to dates (Q12 = Dec 2026, and so on). The dates are dropped.
Date-driven quarters were part of what produced dishonest progress reporting; work lands
when it is proven, not when a month arrives.

---

## Debt — pay this first

### Resolved 2026-09-17
- **SSAO + volumetric fog + SSR** (`cf988a1`) landed unscreenshotted and broke the game:
  291 draws against 175, and every pixel black. Removed in `56f1462` after measuring
  each pass. See that commit for the full attribution — it is the clearest worked
  example in this repo of why laws 1, 2 and 3 exist.

### Functions over 60 lines (law: `AGENTS.md` code taste)
Ten pre-existing violations. Extract as you touch them; don't do a refactor sweep for
its own sake.

| Function | File | Lines |
|---|---|---|
| `render()` | `src/main.js` | **169** |
| `updateDaylight()` | `src/render/atmosphere.js` | **141** |
| `buildMarkings()` | `src/render/block.js` | **138** |
| `buildLamps()` | `src/render/lamps.js` | 115 |
| `buildTowers()` | `src/render/block.js` | 79 (was 111; material setup extracted in slice 023) |
| `buildGround()` | `src/render/block.js` | 108 |
| `updateNPCs()` | `src/render/npcs.js` | 71 |
| `buildHackFx()` | `src/render/hackfx.js` | 69 |
| `buildTrees()` | `src/render/props.js` | 64 |
| `buildPlayerCar()` | `src/render/traffic.js` | 62 |

### Smaller
- 26 lint warnings, all lines over 120 chars (`src/render/traffic.js`, `src/sim/street.js`).
- The HUD still reads "NEON BLOCK 009" — a title frozen at slice 009.
- No audio of any kind exists yet. See `docs/ASSETS.md` for where it comes from.

---

## Performance & memory

**Workers.** Move audio mixing, save serialization and asset decoding off the main thread.
Chunk requests and releases must never touch the main thread.

**Streaming.** Chunked load with LRU eviction; prefetch in the player's likely direction;
chunks stream in and out without a visible hitch.

**Compression.** Ship textures as KTX2 (Basis ETC1S/UASTC), geometry via meshopt or Draco,
audio as Opus. Decode in the asset worker. Lazy-load music per district.

**Zero allocation.** No per-frame allocations in the tick loop, the render loop, or input
handling. Verify with a heap-delta run, not by reading the code.

**Budgets.** A memory budget per preset, enforced the way draws are — measured from the
running game, failing the gate when exceeded. A dev memory HUD behind a flag.

**Final pass.** Re-audit frustum culling and re-tune LOD thresholds after density work
lands. GC clean across a 4-hour session. Shader cost (SSAO/GTAO half-res, bloom mips,
volumetric step counts) budgeted per preset.

---

## World depth

**Verticality.** Accessible rooftops with stairwell transitions. Skybridges that the
nav-mesh bakes and NPCs actually traverse.

**Underground.** Sewers, parking garages and subway tunnels, each entered seamlessly from
the street, each streaming in and out cleanly.

**Interiors.** Ten templates: three shops, two offices, a corporate floor, a club, a
warehouse, a subway station, a safehouse. Shells first, inhabitants second.

**Districts.** Eight distinct districts with their own palettes, furniture and mood.

**Vertical hacking.** Hacks that read and act on elevation — cameras looking down,
rooftop nodes, elevator control.

**Photo mode.** Free camera, lens controls, grade presets. It also serves law 1, since
every slice needs a frame.

---

## Ship readiness

**Accessibility.** Every action rebindable. Multi-size subtitles with speaker labels.
Three colourblind palettes. Camera-shake toggle, reduced-motion mode, hold-vs-tap
interact toggle, per-channel audio mixer. This is not a launch-week task — retrofitting
accessibility is what makes it expensive.

**Saves.** A versioned save schema covering the vertical world, plus a migration matrix
with a test per hop. The current game has no save system at all.

**Steam.** Build pipeline, depot upload, achievements, cloud saves. `electron.cjs`,
`greenworks.json` and `steam_appid.txt` are the surviving scaffolding.

**Playtest.** External playtest with structured feedback capture, then a triage pass.

**Localization & modding.** String extraction with no hardcoded UI text; a mod scaffold
with a documented, versioned surface.

---

## Explicitly dropped

- Renderer-bound work from the old plan — VRS, draw-call formula audits, the old preset
  system. Superseded by the current renderer and by measured budgets.
- Date-driven quarters and version-tag gates.
- Old save-format migration. Clean break; the world models are unrelated.
- The old operator-approval JSON files (`q2.json`–`q11.json`). Deleted.
