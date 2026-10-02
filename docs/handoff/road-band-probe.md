# Road-band probe: brief for the next agent

Written 2026-10-02 by Claude. Read `AGENTS.md` first, at least **The six laws**. This is
an investigation. **You change no source file.** You produce screenshots and one report.

## The claim to check

A probe on 2026-09-29 (`docs/handoff/VGA-084-1.md`, "A separate finding") computed that
some building footprints stand inside the road plus walkway bands (road half-width
3.5 m + 3 m walkway, from `src/sim/world.js`):

1. `SOUTH_TOWERS` (`src/render/block.js`) reach about 10 m into the `south` crossing,
   at z = -64.
2. `TOWERS` rows 4, 9 and 10 cross the `plaza` crossing, at z = 40, by up to 8 m.
3. The wide towers poke 0.1 m onto the avenue walkway.

Nobody has looked at it. Your job is to look, and to say for each claim whether a
building visibly stands on the road or the walkway in the play frame.

## Steps

1. Read `SOUTH_TOWERS` and `TOWERS` in `src/render/block.js`. For claims 1 and 2,
   write down each named tower's footprint as x-range and z-range. A box is
   `box(w, h, d, x, y, z)`, centred, with `w` along x and `d` along z. Check the
   setback lines just below each table to get its real z for south and x for avenues.
   Then write down the band: road centre-line ± 6.5 m.
2. `npm run build`, then take these shots:

   ```sh
   SHOT_PORT=4491 node scripts/shot.mjs docs/shots/probe-plaza '[{"name":"night"},{"name":"day","keys":["t"],"wait":2500}]' '&spawn=cross'
   SHOT_PORT=4491 node scripts/shot.mjs docs/shots/probe-south '[{"name":"night"},{"name":"day","keys":["t"],"wait":2500}]' '&spawn=edge-s'
   SHOT_PORT=4491 node scripts/shot.mjs docs/shots/probe-city '[{"name":"city","keys":["z"],"wait":3000},{"name":"day","keys":["t"],"wait":2500}]'
   ```

3. Open every PNG. For each claim, answer: in which shot, is a building wall standing
   on the asphalt or across the walkway? Describe only what is visible, for example
   "the tower left of centre covers the right half of the crossing's footway". If a
   claim cannot be seen in any shot, say "not visible in these shots", and do not guess.

## Report

Write `docs/handoff/road-band-probe-report.md` with:

- One table per claim: tower, footprint (x and z ranges), band, overlap in metres.
- For each claim: **visible / not visible**, the shot filename, and one sentence on
  what the shot shows.
- At the end, a three-line summary for the operator.

## Do not

- Edit any file except the new report and the new PNGs.
- Run `npm run gate` (you change no code).
- Propose or make a fix. The operator decides.
- Commit, push, stash or checkout.
