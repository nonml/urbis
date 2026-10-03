# Stage 3: mark every feature against Urbis (DeepSeek, two agents per game)

# Mark every GAME feature against Urbis: categories FROM to TO

You are in the Urbis repo, a three.js browser game. `docs/plan/features/FILE` lists
every feature of GAME, by category. For every row in categories FROM to TO, find
whether Urbis has it, and write one row per feature to `docs/plan/features/OUT`.

## Where to look, in this order

1. `docs/plan/CAPABILITIES.md`: an earlier check of about 140 features against the plan.
2. `docs/ROADMAP.md` (milestones M0-M12, criteria IDs like `M5-14`) and
   `docs/plan/TASKS.md` (tasks like `M10.T7`): what is planned.
3. `src/`: what is built. `src/sim` is the simulation, `src/render` drawing, `src/game`
   input and HUD, `src/ui` panels, `src/main.js` the game loop and keys. `content/` holds data.
4. Other `docs/*.md` (`WANTED.md` police, `ARC.md` story, `ECONOMY.md`, `ZONING.md`, ...).

## Marks

| Mark | Means | Evidence (required) |
|---|---|---|
| built | Urbis does this today | `src/<path>.js:<line>` of the code that does it |
| partial | Urbis does some of it | the `file:line`, then what is missing, in a few words |
| planned | not built; a milestone or task builds it | the criterion or task ID (`M10-3`, `M10.T7`) |
| later | the plan puts it after the sell check | the CAPABILITIES row ID, or the ROADMAP line |
| out | the plan rules it out | the CAPABILITIES row ID, or the ROADMAP line |
| missing | not built and not in the plan | the words you searched for |
| skip | the input row's Where cell says WRONG or DUPLICATE | none |

## Rules

1. No evidence, no mark: then it is `missing`. Docs can be out of date; only the code
   decides `built`.
2. A grep hit is not evidence. Open the line and check that it does the thing. A comment
   such as `// No collision yet` means NOT built.
3. Before marking a control or key missing, search `src/main.js` and `src/game/input.js`
   for it.
4. Search each feature with several words ("wanted", "heat", "stars"; "car", "vehicle").
5. Mark facts, not fit. A feature that is wrong for Urbis (guns, magic) still gets the
   true mark, usually `missing` or `out`.
6. One output row per input row, same ID, same order:
   `| ID | Feature | Mark | Evidence |`
7. Work one category at a time. Your first action creates the output file with a `#`
   heading and the table header. Then for each category: search, append that category's
   rows to the file with one edit, go to the next. Never draft more than one category
   before writing it.
8. Edit only your output file. Do not change any other file, do not run git, the game,
   the build or the tests.
9. When done, print the count per mark and stop.
