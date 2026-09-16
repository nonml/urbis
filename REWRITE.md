# Rewrite Charter — Project Neon Rebirth (working title)

The old game is archived on branch `archive/pre-rewrite` (commit `955d662`).
This document governs the rewrite. It outranks all prior roadmaps for new code.

## Why we burned it down

Evidence, not taste (captured 2026-09-16):
- Noon god-view screenshot: dark, muddy, toy-like. Flat unlit boxes, cone trees,
  washed-out fog. Q9/Q10 claimed PBR/HDR/bloom/SSAO/volumetrics — none of it readable.
- Real measurement: `medium+120-NPCs` on High = **18,648 draws vs 2,000 budget (9.3x)**;
  `large+200-NPCs` = **29,325 vs 3,000**. The celebrated "1,029 draws" baseline was fiction.
- Root causes: no art direction (tech stacked without a look), estimated-not-measured
  budgets, thousands of individual meshes instead of instancing/merging from day one.

## Visual target (locked until vetoed)

**Neon-noir rain.** Night, wet streets, neon signage, dark towers with lit windows.
It serves the cyberpunk fantasy (Watch Dogs × GTA at street level), flatters low-poly
geometry with light instead of punishing it, and every element is cheap: emissive +
bloom + env reflections + fog. If a feature doesn't serve neon-noir rain, it waits.

## Non-negotiable laws

1. **Beauty is the gate.** Every slice must prove itself in a screenshot before merge.
   No screenshot, no tick. No exceptions.
2. **Honest numbers.** Draw calls, fps, ms — measured from the running game only.
   Estimates, hand-patched baselines, and formula audits are banned. The live draw
   counter stays on screen from slice 001.
3. **Budget from birth.** Whole frame ≤ 175 draws (re-baselined from 150 when the block became a district in re-005 — measured, not wished). Each feature declares
   its draw cost in its commit message. Over budget = slice fails, no debate.
4. **Instance or merge.** No feature lands that adds per-object draws for repeated
   things (poles, windows, trees, cars, decals). InstancedMesh / merged geometry only.
5. **Sim/render boundary from birth.** `src/re/sim/` = pure logic, zero three.js.
   `src/re/render/` = three.js only. The old codebase proved this boundary is what
   lets a renderer be replaced without losing the game.
6. **No dead tech.** No post pass, light, or system that isn't visible in a screenshot.
   If you can't see it, delete it.

## Repo strategy

- Old game (`index.html`, `src/`) is **frozen** — no edits except deletion at cutover.
- New game lives at `re.html` + `src/re/`, sharing the Three.js/Vite install.
- `vite.config.js` builds both entries until cutover; `re.html` must never break
  `index.html`'s build.
- Cutover (delete old, `re.html` → `index.html`) happens only when the rewrite
  completes a playable vertical slice (street → hack → drive). Not before.

## Slice roadmap

- [x] `re-001` Neon block (done in `088722e`, evidence `docs/re-shots/re-001.png`, 42 draws / 150): one rain-slicked street block at night. Acceptance: screenshot
      looks AAA-indie, ≤ 150 draws, boots < 3s, orbit + WASD-streetcam, live draw/fps HUD.
- [x] `re-002` Living street (done in `7d22df1`, evidence `re-002-lit.png` + `re-002-blackout.png`, 55 draws / 150)
      (streetlight blackout with visible cause→effect). Acceptance: hack feels like conducting.
- [x] `re-003` Player on foot (done in `9dea1cb`, evidence `re-003-profiler.png` + `re-003-secret.png`, 60 draws / 150)
- [x] `re-004` Drive (done in `2b5e267`, evidence `re-004-drive.png`, 64 draws / 150)
- [x] `re-005` District (done in `69cffa3`, evidence `re-005-district.png` + `re-005-east.png`, 81 draws / 150)
- [x] `re-006` Craft pass (done in `ce5ef87`, evidence `re-006-craft.png`, 82 draws / 150)
- [x] `re-007` Pressure (done in `c53be0c`, evidence `re-007-pursuit/busted/chained.png`, ~104 draws / 150)
- [x] `re-008` World beauty (done in `b91a8a8`+`a808c97`, evidence `re-008-beauty.png`, 92 draws / 150, 180fps RTX)
- [x] `re-009` Day shift (done in `3ce3331`, evidence `re-009-day.png` + `re-009-valley.png`, 127 draws / 150, 180fps RTX)
- [ ] `re-010` Cutover review (REHEARSED in `eb74e80`: scripted 10/10 pass, evidence `re-010-rehearsal.png`; awaiting operator play — old-game deletion needs their word)
- [x] `re-011` Content engine (done in `193d393`: signs.json + missions.json + validator green + 12/12 runner asserts, evidence `re-011-market.png`)
- [x] `re-012` Hacking depth (done in `b406d64`: honest per-zone dark + collapse/relight cascade + pulse/sparks/substations + steam gag + threat pull 20m→2m, evidence `re-012-dying/dark/sparks.png`, gate 973/973)
- [ ] `re-013` Wanted (salvage Q4): police tiers — roadblocks, helicopter, spikes, dispatch chatter.
- [ ] `re-014` Arc + radio (salvage Q7): 6-mission narrative skeleton, 3-channel radio structure.
- [ ] `re-015` Verticality (salvage Q3/Q13): interiors (shop/safehouse), accessible rooftops.

## Salvage map (old 2Y plan → rewrite)

The old code on `archive/pre-rewrite` is frozen, but its plan was mostly specs.
Rules: copy the design, never the code. Read the old sim as reference, never import it.
No save migration — clean break between world models.

- Q5 template freeze → `re-011` (schemas + validators are renderer-agnostic)
- Q6 hack chains / combat hacks / camera net → `re-012`
- Q4 police tiers / cover / behavior tree → `re-013` (tiers first, cover+BT with combat)
- Q7 mission arc / radio / TTS approach → `re-014`
- Q3 interiors / Q13 rooftops+underground → `re-015`
- Q2 tutorial beats → onboarding spec for the `re-010` review checklist
- Gate philosophy / perf harness / honest budgets → already charter law (#2, #3)
- Superseded, do not salvage: Q9–Q11 renderer-bound passes, date-driven quarters, old saves.

## Harvest log (fable-cities, 2026-09-16 — decision: harvest, don't fork)

- `public/re-assets/`: 6 CC0 texture sets (asphalt, paving slabs, 2 glass facades incl.
  night emission map, concrete, metal plates) + `CREDITS.md`. ~18 MB, not 208 MB.
- Adopted method: measured look-targets (their LOOK_TARGET.md diagnoses our old disease —
  everything at 3x lightness, no black floor); builder/critic screenshot loop with scores;
  texture discipline (sRGB albedo/emissive, linear data maps, max anisotropy);
  night via `emissiveIntensity` driven by time of day.
- Deliberately NOT taken: whole-repo fork (wrong genre — god-view painter, no
  player/combat/hacking; 873 draws for terrain+veg alone; their own critics score 6–7.5/10).

## Working agreements

- Commits: `<type>(re): <title>` + `Why:` + `Slice: re-00N`. No checklist trailers;
  this file's boxes tick via commit hash noted beside the box.
- Old `npm run gate` does not govern new code (it audits the frozen game).
  New-code gate: `npm run build` green + screenshot attached + draws ≤ budget.
  (A dedicated `re` gate script lands when slice 002 does.)
- Verification runs GPU-backed headless (ANGLE/D3D11) at 960×540 for iteration, full-res only for final evidence. SwiftShader is banned — it melts CPUs and its fps numbers are meaningless.
