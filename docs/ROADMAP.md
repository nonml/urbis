# Urbis roadmap

Owner: Claude, game director. Last set 2026-10-02 with the operator. Every worker reads
this before `docs/handoff/` or `docs/tasks/`. A milestone is done when the player can
do the thing in its row, proven in the running game, never when a task list is empty.

## The game

Cities: Skylines you can walk around in, and it never ends. Watch Dogs and GTA stop
when their story runs out; this city keeps running: people move in and out, money
shifts, blocks rise and fall. The long game is **poke it and watch**: every tool sets
off a chain the player can watch spread. Story content is out of scope. Every new
game generates a new city (`AGENTS.md`).

## Milestones

| # | What the player can do when it is done | Status |
|---|---|---|
| 0 | Nothing new to play. The crew runs on its own: `scripts/crew.mjs run` hands out tasks, checks every answer with the gate, catches loops, moves stuck tasks up a model | done 2026-10-02 |
| 1 | **Walk into what you built:** zone a lot, watch it grow, walk through its door into a room that matches what grew | done 2026-10-02 (shots: `slice-063-framed-interiors-*`) |
| 2 | **A whole city to build on:** New Game makes a full city of streets and lots, not one district of 10 hand-placed lots | 2a done 2026-10-02 (`?gen=1`); 2b vistas, 2c pinned towers queued |
| 3 | **The city lives on its own:** days pass, people commute from real homes to real jobs, population and money shift; leave it 10 minutes and it is different | 3a queued: a running day, every person on the lots real |
| 4 | **Poke it and watch:** a blackout, a chase, a zoning change each set off a chain you can watch spread, sized to the act | |
| 5 | **Sell-or-not check:** 20 minutes of the whole loop; the operator decides. This is the finish line | |

Alongside all of them: **stop looking like a toy.** Real cars, people and buildings
replace boxes, one swap per task (VGA-084 in `docs/VISUAL-GAP-ACTIONS.md`).

## How the work runs

- **Claude** (a few sessions a week) plans each milestone as a skeleton: files, function
  signatures, data shapes, and a test per piece that fails until it is done, committed
  as `tests/<name>.todo.js` beside stubs that keep the game whole. Claude proves each
  test can pass before handing it out, reviews lane branches, merges, and fixes what
  the workers cannot: how systems fit together, the look, hard bugs.
- **DeepSeek v4.1 flash** fills one task at a time. **GLM 5.3 flash** takes what
  DeepSeek gets stuck on. Mimo is not used.
- **`scripts/crew.mjs run docs/tasks/<queue>.json...`** is the manager. Every lane is a
  developer and they all work at once, so a milestone is split into lanes that touch
  different files. It needs no
  judgement: the test and the gate decide. It commits passes to the lane's branch
  (`wt/<lane>`), never to main, and parks what neither model can finish.

## Rhythm

- **Every task:** the gate, run by the crew script.
- **Every Claude session:** review and merge the lane branches, look at the screenshots,
  write the next queue, start `run` before leaving.
- **Every milestone:** the operator hears in plain words what they can now do.
