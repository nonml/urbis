# Shot review log

Every shot is judged here before it counts as evidence (AGENTS.md, "How to work",
step 5). One entry per shot: the slice, the verdict, and each defect by id. Open
defects stay in the table at the bottom until a commit fixes them.

## 2026-10-03 — retro-review of slices 074–077: all FAIL

These shipped as "done" without a real review. The operator found the problems.

| Shot | Verdict | Defects |
|---|---|---|
| slice-074-newgame-s7-boot / -grown | FAIL | D1, D3, D10 |
| slice-075-chase-s7-tier3 | FAIL | D1, D2, D3, D5, D10 |
| slice-076-chase-s7-hack / -tier2 | FAIL | D1, D2, D3, D5, D10 |
| slice-077-freeland-s7-cityview | FAIL | D6, D7, D8, D9 |

074–076 are the same pose on the same spawn: four slices of one broken frame.

## 2026-10-03 — slice-078, a new game opens on a clear street

| Shot | Verdict | Defects |
|---|---|---|
| slice-078-clearview-s7-street | FAIL (D1 fixed) | D3, D4, D10 |
| slice-078-clearview-s7-day | FAIL (D1 fixed) | D3, D10 |

Shows the feature: yes, the avenue, crossing and shopfronts are visible where the
parked car's roof was. `frameCheck(2)` 0.177 → 0 on seeds 7 and 2.

## Defects

| Id | Defect | Where | Status |
|---|---|---|---|
| D1 | A parked car's roof fills 15% of a new game's opening frame, 1.4 m from the lens | seeds 2, 7: the kerb slot behind the spawn | **fixed** slice-078; gate checks 4 seeds |
| D2 | The chase shots have no police car in them; nothing in frame shows a chase | 075, 076 | open |
| D3 | A grey box with a yellow band hangs on a facade 10 m up | seed 7 spawn, right side; instanced box near (-11, 10–11.7, 8) | open, not yet identified |
| D4 | A hard-edged bright rectangle lies on the road under the player at night | seed 7 spawn, night | open |
| D5 | Puddle reflections break into scattered glass-like shards | 076 tier2, lower left | open |
| D6 | Mountains stand at fixed hand-map coordinates: a range rises inside the city on 127 of 300 seeds (94 m over the road on seed 73), and 99% of their slope is steeper than 55°, so they read as blue spikes | 077 city view, left; seed 73 street | queued: `m5-mountains` (OpenCode), test `tests/landscape-place.todo.js` |
| D7 | The outer towers are giant boxes with a TV-static window texture | 077 city view, right | open |
| D8 | Crane jibs reach out over neighbouring roofs and off their lot | 077 city view | open |
| D9 | The free land the slice added cannot be picked out in its own shot | 077 city view | open |
| D10 | The player and the hero car are raw boxes | every street shot | open (VGA-084) |
