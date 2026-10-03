# M3.S1 — Can this Mac draw the city?

Measured 2026-10-03 on the operator's Mac (Apple M3, ANGLE Metal, 60 Hz). Rerun:
`npx playwright test --config spikes/m3-render/playwright.config.mjs` — headed
bundled chromium on the real GPU, 600 frames after a 60-frame warmup, writing
`spikes/m3-render/results.json`. Three runs; draws (14/8) matched exactly every
time and no page errored. The table is the worse of the two clean runs — the
third, taken while other worktrees loaded this machine, is in the watch item.
Draws are `renderer.info.render.calls` with `autoReset = false` and a manual reset before
`render()` so the shadow pass counts (0.160 resets info *after* it). `workP95` is
the frame's render serialised by `gl.finish()`; p95 is the rAF interval.

The rig (`spikes/m3-render/main.js`) builds 2,000 buildings on a 40 × 50 grid at
40 m pitch, six architectures matching the game's six tower materials
(`facadeMaterial` ×2, `concreteFacadeMaterial` ×4), unit box shells in
per-architecture pools, each instance carrying its `zone` for `zoneLit` (the
M3.T22 form); 300 road pieces in one `InstancedMesh`; a ground plane and one
2048² shadow sun. Day: sun 2.3 with the map updating each frame. Night: sun 0,
map held, zone windows 0.75 through `zoneView` — the game's own rules. The
batched path is one `BatchedMesh` per architecture, one geometry per building
(0.160 has no per-instance zone attribute). Pixel ratio 1 and 2.

## Numbers (worst of the two clean runs)

| mesh | cam | dpr | night | backing | draws | p95 ms | workP95 ms | late>20ms /1200 |
|---|---|---|---|---|---|---|---|---|
| instanced | play | ×1 | day | 1280×720 | 14 | 18.2 | 0.5 | 0 |
| instanced | play | ×1 | night | 1280×720 | 8 | 18.3 | 0.4 | 0 |
| instanced | play | ×2 | day | 2560×1440 | 14 | 17.9 | 1.1 | 0 |
| instanced | play | ×2 | night | 2560×1440 | 8 | 18.2 | 0.6 | 0 |
| instanced | city | ×1 | day | 1280×720 | 14 | 18.1 | 0.4 | 0 |
| instanced | city | ×1 | night | 1280×720 | 8 | 17.2 | 0.7 | 0 |
| instanced | city | ×2 | day | 2560×1440 | 14 | 17.8 | 1.2 | 3 |
| instanced | city | ×2 | night | 2560×1440 | 8 | 17.4 | 0.9 | 2 |
| batched | play | ×1 | day | 1280×720 | 14 | 16.0 | 2.6 | 0 |
| batched | play | ×1 | night | 1280×720 | 8 | 16.9 | 1.3 | 4 |
| batched | play | ×2 | day | 2560×1440 | 14 | 19.0 | 8.0 | 29 |
| batched | play | ×2 | night | 2560×1440 | 8 | 17.0 | 1.1 | 0 |
| batched | city | ×1 | day | 1280×720 | 14 | 15.7 | 2.5 | 2 |
| batched | city | ×1 | night | 1280×720 | 8 | 16.4 | 1.7 | 0 |
| batched | city | ×2 | day | 2560×1440 | 14 | 16.1 | 6.9 | 15 |
| batched | city | ×2 | night | 2560×1440 | 8 | 16.2 | 2.2 | 3 |

## What this decides

1. **Pools fit with room to spare.** Day is 14 draws: 6 building pools × (main +
   shadow) + road pool + ground. Night is 8, because the game holds the shadow map
   still once the sun is down. Draws do not move with camera or city size; the
   law-3 budget is 175.
2. **60 Hz holds on the instanced path on an idle machine.** p50 16.0–16.4 ms
   (vsync), p95 ≤ 18.3 ms, 14 of 16 configs never missed a 20 ms frame (worst: 3
   of 1200), and work p95 ≤ 1.2 ms — about 14× inside a 16.7 ms frame.
3. **`BatchedMesh` buys nothing.** Same draws, work p95 up to 8.0 ms, up to 29
   late frames, and no per-instance zone attribute in 0.160 without a geometry
   copy per building. **D5: no three.js upgrade — M3.T22–T27 proceed as planned
   on per-architecture `InstancedMesh` pools.** M3.T26's 300 road pieces are one
   draw.

Watch item: this machine shares worktrees and frame pacing swings with load. On
the loaded run the same rig (same 14/8 draws, work p95 still ≤1.5 ms) threw
12–65 late frames per instanced config, the Retina city view worst; the other two
runs were clean. Re-measure the M8 frame target on an idle machine.
