# Context and Craft Notes

## Context budget (hard limit)

Keep each task's total context (files you load) under **64k tokens**. If the files exceed this, pick the most relevant files and note what you skipped.

## How to approach a task well

**Start with the data, not the logic.** This codebase is data-first. Before writing a function, define the data structure it operates on. Look at how similar structures are already defined (`WEAPONS`, `VEHICLE_TYPES`, `GROWTH_STAGE`).

**Look at one existing example before writing anything new.** Adding a weapon? Read the `pistol` entry. Adding a hack? Read `hackTrafficLights`. Adding a test? Read one passing spec. Copy the shape, change the values.

**The simplest correct solution wins.** A 20-line addition that slots into an existing pattern beats a 150-line "clean architecture" rewrite every time. The codebase has momentum. Work with it, not against it.

**Taste test before committing.** Player-facing changes: mentally walk through the user experience. Is the feedback instant? Is the effect visible? Does it feel satisfying or mechanical?

## Common failure modes to avoid

- **Importing `three` into `src/sim/`** — breaks the architecture boundary. Check before saving.
- **Using `Math.random()`** — fails CI immediately. Use `rngStreams.<stream>.next()`.
- **Large rewrites** — scope creep kills quality. Touch only what the task specifies.
- **Inventing APIs** — if you're not sure a method exists, read the file first. Don't guess.
- **Forgetting the tick** — new simulation systems that aren't called from `game.tickOnce()` are dead code. Wire it up.
- **DOM mutations in sim code** — sim is pure logic. If you find yourself touching `document` in `src/sim/`, stop.
