# Procgen 6a: interiors hang off their towers, not coordinates

Written 2026-10-02 by Claude. Read `AGENTS.md` (at least **The six laws**) and
`docs/PROCGEN.md`. After that, this file is all you need.

## Where it stands

- `src/render/block.js` (~line 272) has
  `const PINNED_TOWERS = [[-1, -48, 12, 34, 10], [-1, -14, 14, 44, 11]];`. The format
  is `[side, z, w, h, d]` on the main avenue (`AVENUE_X[0]`). The towers stand at
  `x = AVENUE_X[0] + side*(BUILD_LINE + w/2)`.
- `src/sim/interior.js` (~line 72) hand-copies the result:
  `RAMEN_FRAME = { x: -6.9, z: -10.77, out: [1, 0] }` and
  `ROOF_FRAME = { x: -7.05, z: -48, out: [1, 0] }`.
  - -6.9 is tower 1's podium face, `centre + side*-(w + 1.2)/2`.
  - -7.05 is tower 0's crown lip, `centre + side*-(w + 0.9)/2`.
  - -10.77 is tower 1's z plus the noodle-bar bay offset, 3.23.

Under a generated city those numbers break silently.

## The edits

1. Create `src/sim/landmarks.js`, a pure module with no three and no DOM. Move the
   table there as named objects:
   ```js
   export const PINNED_TOWERS = [
     { id: 'roof',  side: -1, z: -48, w: 12, h: 34, d: 10 },
     { id: 'ramen', side: -1, z: -14, w: 14, h: 44, d: 11 },
   ];
   ```
   Move `BUILD_LINE` (7.5) there too, along with
   `towerCentreX(t) = AVENUE_X[0] + t.side*(BUILD_LINE + t.w/2)`. Export both helpers.
2. `block.js` imports `PINNED_TOWERS`, `BUILD_LINE` and `towerCentreX` from it, and
   deletes its own copies. Every use (~lines 306 and 823) reads the object fields.
   Order and `idx` stay the same, and so do the emitted towers. The checker must
   print the same numbers.
3. `interior.js` derives both frames from the towers:
   - RAMEN: `x = towerCentreX(ramen) - ramen.side*(ramen.w + PODIUM_LIP)/2`, where
     `PODIUM_LIP = 1.2`.
   - RAMEN `z = ramen.z + RAMEN_BAY_DZ`, where `RAMEN_BAY_DZ = 3.23`.
   - ROOF: same pattern with `CROWN_LIP = 0.9`, and `z = roof.z`.
   - `out: [-side, 0]`.

   Fix the comments that say "block.js PINNED_TOWERS" so they point at
   `landmarks.js`. If `scripts/check_overlap.mjs` imports or copies
   `PINNED_TOWERS`/`BUILD_LINE`, point it at `landmarks.js` as well.
4. Add a test to `tests/interior.spec.js`, in its existing style. It asserts that the
   derived RAMEN frame is `x ≈ -6.9, z ≈ -10.77` and ROOF is `x ≈ -7.05, z = -48`
   (`toBeCloseTo(…, 2)`).

## Numeric pass/fail

- `npm run check:overlap` prints exactly the same three lines as before your edit
  (record them first).
- `grep -n "\-6\.9\b\|-7\.05\|-10\.77" src/sim/interior.js` prints nothing.
- `GATE_PORT=4673 npm run gate` is fully green with the test count +1, and `draws:`
  is unchanged.

## Do not

Do not touch `ROW_RUNS`, `KEEP_OUT`, the street wall, `LOTS`, or the
`tests/interior-gate.spec.js` door coordinates. Do not commit, push, stash or check
out. Do not open PNGs. If it fails after two retries, stop and report BLOCKED with the
output.
