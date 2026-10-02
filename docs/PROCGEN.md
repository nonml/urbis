# Procedural city: the plan

Written 2026-10-02 by Claude. The operator's rule (AGENTS.md): every new game generates
the whole city layout from its seed, including roads, blocks, lots and buildings. Today
one hand-placed layout boots under one fixed seed. These stages get from here to there.
Each stage leaves the game playable and the gate green.

| Stage | What lands | Brief |
|---|---|---|
| 1 | The new game gets a seed: `?seed=N`, a fresh one otherwise, and 20260916 under test | `procgen-1-seed.md` |
| 2 | `src/sim/citygen.js`: seed → a district (avenues, crossings, bounds), proven by invariants | `procgen-2-roadgen.md` |
| 3 | The street wall's gaps derive from world data (lots, deck, crossings), with no tables | `procgen-3-streetwall.md` |
| 4 | `world.js` builds `DISTRICTS` from `generateDistrict(seed)`. The seed 20260916 keeps today's hand layout as a fixed preset until stages 5–7 land | later |
| 5 | Lots derive from the blocks between roads (replaces `LOTS`) | later |
| 6 | Pinned towers, interiors' frames, signs and mission spots attach to generated buildings | later |
| 7 | The preset is deleted, so every seed is generated | later |

Rules for every stage: no coordinate tuned to one map. Margins are named constants
derived from `ROAD_HALF_WIDTH`, `WALKWAY_WIDTH` and the like. The overlap checker
(`npm run check:overlap`) is the referee for every layout change.
