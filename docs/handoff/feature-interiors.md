# Feature: four more interiors you can walk into

Written 2026-10-02 by Claude. You own this whole feature. Work like a developer, not a
form-filler: read, build, run the tests, look at the numbers, fix, and repeat as many
times as you need. Stop only when every finish line below is met, or when you are
truly blocked.

Read `AGENTS.md` (all of it), then `docs/INTERIORS.md`, which is the pattern every
interior copies. Then read `src/sim/interior.js`, its render half, and
`tests/interior.spec.js` / `tests/interior-gate.spec.js`. The noodle bar (RAMEN) and
the roof (ROOF) are the two existing spaces. Copy how they work.

## The outcome

A player walking the avenues can enter four new places through a door in a
street-wall building, walk around inside, and walk back out:

1. **Corner shop**: shelves, a counter, a fridge wall.
2. **Office floor**: desks in rows, a meeting room partition, a water cooler.
3. **Club**: a bar, a dance floor, a DJ booth, low light.
4. **Safehouse**: a bed, a desk with screens, a kitchenette. This is the player's own
   place.

Each one is grounded and modern, real-world in feel. Never neon or cyberpunk, and never
toy boxes (see AGENTS.md on the look).

## Rules

- **Doors hang off buildings, not coordinates.** `src/sim/landmarks.js` shows how: a
  space's frame derives from its host tower's data. Pick host towers from the street
  wall the game already builds, using a rule (for example "the first row building on
  avenue N, side S, whose front is at least W wide"), not a hand-typed x/z. The city
  will soon be generated from a seed (`docs/PROCGEN.md`). A space whose host cannot be
  found must simply not exist; it must not crash.
- Each interior's furniture is merged or instanced (law 4). Inside any interior,
  `draws` stays ≤ 175 (the existing tests print `inside draws:`; add one line for each
  new space).
- The sim stays pure (law 5): `npm run check:boundary` passes.

## Finish lines (all must hold)

- `tests/interior.spec.js` gets one test per new space. It walks in through the door,
  touches at least one solid, and walks out. Use the existing tests as the pattern.
- `tests/interior-gate.spec.js` (browser) gets one test per new space. It enters,
  asserts `isIndoors`, asserts draws ≤ 175, and prints `<name> draws: N / 175`.
- `GATE_PORT=4173 npm run gate` is fully green. The street `draws:` line must not rise
  by more than 4.
- Evidence: `npm run build`, then one `scripts/shot.mjs` call
  (`SHOT_PORT=4191`, prefix `docs/shots/slice-061-interiors`) with one pose inside
  each new space. Report the draw lines. Do not open or judge the PNGs; the
  orchestrator does.
- Update `docs/INTERIORS.md` with the four spaces.

## Do not

Do not touch the street wall's generation, `citygen.js`, `world.js` road data, or
`check_overlap.mjs`, because another worker owns those. Do not commit, push, stash or
check out. At the end, report: the files changed, every finish line with its number,
and anything you could not do.
