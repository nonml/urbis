# South row off the connector: brief for the next agent

Written 2026-10-02 by Claude. Read `AGENTS.md` first, at least **The six laws**. After
that, this file is all you need.

## Where it stands

`docs/handoff/road-band-probe-report.md`, claim 1: the five `SOUTH_TOWERS` podiums
(`src/render/block.js`, at z = -66, depth 10 + 1.2) cover z -71.6…-60.4. That is the
whole 7 m carriageway of the `south` connector (z = -64), so the road is walled shut
from end to end (`docs/shots/probe-x-south-row-day.png`). The play area ends at
z = -68, so the row belongs just south of the road band (z < -70.5). There it still
closes the avenues' southern vista, the way `TERMINUS_TOWERS` close the northern one.

## Numeric pass/fail

`npm run check:overlap` must print `overlap: 0`, `road: 7 towers on a road or walkway`
and the same `frontage: worst row` as `main`. The 7 are the three `TERMINUS_TOWERS`
and `SOUTH_TOWERS` 0, 1, 3 and 4 standing on the avenues' ends past the play area, as
vista caps. Each line it prints for `road south` must be gone. Set `MAX_ROAD = 7` in
`scripts/check_overlap.mjs`, and change nothing else there.

`GATE_PORT=4973 npm run gate` must be fully green, with `draws:` no higher than on
`main`.

## The edits (exactly these)

1. `src/render/block.js`, in `buildTowers()`: the south row is emitted with
   `emitTower(x, -66, w, h, 10, ...)`. Change `-66` to `SOUTH_ROW_Z` and add, beside the
   `SOUTH_TOWERS` table:

   ```js
   // Just south of the connector's road-and-walkway band (z -64 ± 6.5): the
   // podium's north face sits on the band edge, past the end of the play area.
   const SOUTH_ROW_Z = -76.1;
   ```

   Fix the table's comment: the front face is now at z = -71.1, not -61.
2. `src/content/signs.json`: the `PARK` sign has `"z": -59.9`, 1.1 m proud of the old
   shaft face at -61. Set it to `-70` (1.1 m proud of -71.1).
3. Nothing else. The connector's lamp poles (z -68.2) and trees (z -69.5) were standing
   inside the old podiums. They now stand on the pavement in front of the new ones,
   which is correct.

## Evidence

`npm run build`, then:

```sh
SHOT_PORT=4991 node scripts/shot.mjs docs/shots/slice-059-south '[{"name":"city","keys":["z"],"wait":3000}]'
```

Report the draw lines it prints. Do not open or judge the PNGs. The orchestrator does.

## Do not

- Touch any other table, `LOTS`, or the checker's logic.
- Commit, push, stash or checkout.

Two failed retries: stop and report BLOCKED with the output.
