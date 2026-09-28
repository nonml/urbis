# Charter — the roadmap and the record

`AGENTS.md` holds the laws and the patterns. This file holds **what we're building,
in what order, and what's already proven.**

---

## The game (locked until vetoed)

**Urbis — build a city, then live in it.** City-builder scale (zoning, growth, economy)
and street scale (on foot, in cars, inside buildings) in one world. GTA's freedom,
Cyberpunk 2077's depth, Watch Dogs' hacking as one toolset among several. The full
statement and the pillars are in `AGENTS.md`.

## Visual target (locked until vetoed)

**A grounded modern city.** Believable contemporary streets and towers. Day and night
carry equal weight; weather is variety. Signage is real storefront lighting — painted
fascias, lit boxes, backlit letters in real brand colours.

**No neon.** No magenta/cyan palette, no holograms, no cyberpunk styling. If a feature
pushes the frame toward neon, it does not land.

**Why this changed (2026-09-28).** The original target was "neon-noir rain", chosen when
the game was still being pitched as a cyberpunk street game. That was never the
operator's concept: the Cyberpunk reference is about *depth*, not *look*, and the core
of the game is building a city and living in it. The neon palette, the "NEON" signs and
the Neon City name were all downstream of that mistake. **VGA-083** strips what shipped.
The lighting craft itself — wet-road reflections, lamp pools, the blackout cascade,
lit windows — stays; it just stops being tinted magenta and cyan.

---

## Why the budget laws exist

Captured 2026-09-16, before the renderer was rebuilt:

- The noon god-view frame was dark, muddy and toy-like — flat unlit boxes, cone trees,
  washed-out fog. PBR, HDR, bloom, SSAO and volumetrics were all claimed. None were readable.
- Measured: `medium+120-NPCs` on High = **18,648 draws against a 2,000 budget (9.3×)**.
  `large+200-NPCs` = **29,325 against 3,000**. The celebrated "1,029 draws" baseline was fiction.
- Root causes: no art direction (tech stacked without a look), budgets estimated instead
  of measured, and thousands of individual meshes instead of instancing from day one.

Laws 2 and 3 in `AGENTS.md` exist so this cannot recur. `npm test` now measures the
draw count from the running game on every gate run — it is no longer a promise.

The pre-rebuild codebase is preserved on branch `archive/pre-rewrite` (`955d662`).
**Read it for design reference; never import from it.** There is no save migration —
the world models are unrelated.

---

## Shipped

Each slice proved itself in a screenshot under budget. Evidence in `docs/shots/`.

| Slice | What landed | Draws | Evidence |
|---|---|---|---|
| 001 | Neon block — one rain-slicked street at night | 42 | `slice-001.png` |
| 002 | Living street — streetlight blackout, visible cause→effect | 55 | `slice-002-lit/-blackout.png` |
| 003 | Player on foot + profiler | 60 | `slice-003-profiler/-secret.png` |
| 004 | Drive | 64 | `slice-004-drive.png` |
| 005 | District — the block became a neighbourhood | 81 | `slice-005-district/-east.png` |
| 006 | Craft pass | 82 | `slice-006-craft.png` |
| 007 | Pressure — pursuit, busted, chained heat | ~104 | `slice-007-pursuit/-busted/-chained.png` |
| 008 | World beauty | 92 | `slice-008-beauty.png` |
| 009 | Day shift | 127 | `slice-009-day/-valley.png` |
| 010 | Cutover rehearsal — scripted 10/10 pass | — | `slice-010-rehearsal.png` |
| 011 | Content engine — signs.json + missions.json + validator | — | `slice-011-market.png` |
| 012 | Hacking depth — honest dark, collapse/relight cascade, sparks | — | `slice-012-dying/-dark/-sparks.png` |
| 013 | Reflection streaks + lane-paint discipline (VGA-001/003) | — | `slice-013-streaks/-daypaint/-paintdark.png` |
| 014 | Puddle mirrors, wet grade, oil-rainbow (VGA-002/005/006) | — | `slice-014-puddle/-rainbow.png` |
| 015 | Open-world city grid — blocks, cross traffic, termini | — | `slice-015-north/-west/-valleyday.png` |
| 016 | Play-angle audit — added the evidence rule, downgraded lab-only proofs | — | `slice-016-audit-*.png` |
| 017 | Anti-toy pass — human proportions, car detail, grounding | — | `slice-017-street/-north.png` |
| 018 | Gradient lamp shafts + hero head | — | `slice-018-street/-north.png` |
| 019 | Parked cars + sidewalk crowd, +0 draws | — | `slice-019-street/-north.png` |
| 020 | Paint discipline, skyglow lift, closer camera | — | `slice-020-street/-north.png` |
| 021 | Repo unified, measured gate, black-frame fix | **151** | `slice-021-fixed-frame.png` |
| 022 | Shop canopies wear metalplates006 | **151** (+0) | `slice-022-canopy-day.png` |
| 023 | Poly Haven ARM loader; concrete towers as a second architecture | **155** (+4) | `slice-023-day/-night/-blackout.png` |
| 024 | Puddle mirrors — baked city cube, per-zone water (VGA-002) | **156** (+1, 173 peak) | `slice-024-night/-day/-blackout.png` |
| 025 | Headlight throw — heading-aligned, speed-stretched, instanced (VGA-004) | **156** (−1, 172 peak) | `slice-025-avenue/-cross/-dark.png` |

**Bookkeeping note.** Slices 013–015 were originally planned as Wanted / Arc+Radio /
Verticality. An operator redirect sent visual-gap work first, and those numbers were
consumed by it. The three features were never built — they are listed below by name.
**Slices are numbered by what ships, in the order it ships. Never reserve a number.**

---

## Next

Two tracks run in parallel. `docs/VISUAL-GAP-ACTIONS.md` is the **near-term queue**
(82 items, most still open) and closes first per operator redirect. The feature slices
below are the **structural** work.

Next free slice number: **026**.

**First, before any other visual item: VGA-083 — strip the neon.** See the visual target
above.

### Feature slices, in order

1. **Zoning + growth** — the building half of the game, currently missing. Zones grow
   through a staged pipeline; the skyline changes because the city decided it, not
   because an artist placed a tower. **Planned in `docs/ZONING.md`**, which also records
   why the existing 68 towers stay merged and static. (Its internal slice numbers
   predate this reorder — number by what ships, per the bookkeeping note above.)
2. **District economy** — jobs, wealth and demand per district, feeding growth and
   giving consequences something real to move (VGA-077 faction paint reads it).
3. **Verticality** — interiors (shop, safehouse, homes) and accessible rooftops. This is
   where the two halves meet: you walk into what you zoned. Pairs with VGA-078.
   Salvages old Q3/Q13.
4. **Wanted** — police tiers: roadblocks, helicopter, spike strips, dispatch chatter.
   Pairs with VGA-068/069. Salvages the old Q4 design.
5. **Arc + radio** — 6-mission narrative skeleton, 3-channel radio structure.
   Salvages old Q7. Radio audio comes from the local pipeline in `docs/ASSETS.md`.

**Why this order (reordered 2026-09-28 by the operator).** The game is *build a city,
then live in it* — building is half of it, and it was scheduled fourth. So: build it
(1–2), then make what you built a place you can enter (3), then layer street pressure
and story on top (4–5). Police and narrative on a city that can't grow would be polish
on a claim.

Longer-horizon engineering and content work — streaming, KTX2/meshopt, zero-alloc loops,
sewers, skybridges, accessibility, launch readiness — is in `docs/BACKLOG.md`.

---

## Salvage rules

The pre-rebuild plan was mostly specs, and specs survive a renderer change.

- **Copy the design, never the code.** Read the old sim as reference; never import it.
- Renderer-bound work from the old plan is superseded — do not salvage it.
- No save migration. Clean break between world models.

---

## Asset harvest log

**2026-09-16 — fable-cities. Decision: harvest, don't fork.**

- Taken: 6 CC0 texture sets in `public/assets/` (asphalt, paving slabs, two glass facades
  including a night emission map, concrete, metal plates) + `CREDITS.md`. ~18 MB, not 208 MB.
- Adopted method: measured look-targets (their diagnosis — everything at 3× lightness with
  no black floor — was exactly our disease); builder/critic screenshot loop with scores;
  texture discipline (sRGB albedo/emissive, linear data maps, max anisotropy); night driven
  by `emissiveIntensity` against time of day.
- Refused: the whole-repo fork. Wrong genre (god-view painter, no player, combat or hacking),
  873 draws for terrain and vegetation alone, and their own critics scored it 6–7.5/10.

Generation of new assets is covered in `docs/ASSETS.md`.

---

## Working agreements

- **Commits:** `<type>(<area>): <title>`, plus a `Why:` line and the measured draw cost.
  Slices tick in this file with their commit hash and evidence filename.
- **Verification:** GPU-backed headless (ANGLE/D3D11) at 960×540 for iteration, full
  resolution for final evidence. **SwiftShader is banned** — it melts CPUs and its fps
  numbers are meaningless.
- **Evidence:** the play camera, always. A close-up or top-down lab angle caps an item at
  PARTIAL — that rule was added 2026-09-17 after an audit caught lab-only proofs passing as done.
