# Urbis roadmap

Owner: Claude, game director. Last set 2026-10-03 with the operator. Every worker reads
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
| 2 | **A whole city to build on:** New Game makes a full city of streets and lots, not one district of 10 hand-placed lots | 2a, 2b, 2c done 2026-10-02 (`?gen=1&seed=N`: lots, caps and ring, the noodle-bar and roof towers off the roads; seeds 1-8 have 0 overlaps); 2d done 2026-10-03: lamps, parked cars and kerb clutter follow the generated roads, no more NaN on two-avenue seeds (`slice-067`). 2e done: a generated world starts on its own main avenue beside the car (`slice-068`). 2f done: the RAMEN board hangs on the noodle bar wherever the seed puts it, shopfronts sit on real building fronts, puddles and steam follow the avenues (`slice-069`). 2g done: the substations the hack needs, the chase cars and every story place stand on a generated world's own streets (`slice-071`). 2i done: blade signs and zebras follow a generated city's own streets (`slice-073`). 2j done: generated streets have names (Main, East, the rest by the seed), so a lot reads 'Main & Bridge'. 2h done: a player's New Game boots a generated city from its own seed, and a generated city offers 16-28 lots, not 6-12 (`slice-074`). Gap: it is still one district (two power zones); "a whole city" needs more than one |
| 3 | **The city lives on its own:** days pass, people commute from real homes to real jobs, population and money shift; leave it 10 minutes and it is different | 3a done 2026-10-02: the clock runs (a 12-minute day, on the HUD), every pedestrian you profile is a resident with a home and a job (shot `slice-066`). 3b save done: a continued game has the same people and hour. 3c done: walkers follow the clock, seed 7 has 15 of 72 out at 3am and all 72 at the 8am rush, and commuters head to their real job or home (`slice-070`). 3d done: a news line top right says what just changed (lots breaking ground, topping out and coming down, firms moving jobs, power cuts, people moving in and out). Probe: ten minutes left alone on seed 7, lots rise and fall and firms move jobs in and out, so the city is different; the economy swings hard (a district can lose most of its firms in two minutes) |
| 4 | **Poke it and watch:** a blackout, a chase, a zoning change each set off a chain you can watch spread, sized to the act | 4a done 2026-10-03: a power cut drives a firm out of the dark district, sized to how long it was dark; one hack halves the district's office demand (0.82 to 0.40) and its office lots stop growing, and the news says so. 4b done: that line ends 'after the power cut' (seed 7: '47 office jobs left the north district after the power cut'). 4c chase: the police tiers (sight, search, stingers, roadblock, heli, radio) run on a generated city (`slice-075`) and the radio names its streets by their own names; a chase scaring a firm out of its district is with the crew. Zoning chain blocked: rezoning a lot for workshops does not make flats grow (seeds 1-8: often less than leaving it alone), because the lot comes down before it rebuilds and one firm moving swings a district's demand by 0.2-0.45, more than any lot. Next: calm the market so a poke reads above it, and leave a new city some free land to zone |
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
