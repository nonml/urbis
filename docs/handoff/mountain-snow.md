# Mountain snow on the steep faces

Written 2026-10-02 by Claude. Read `AGENTS.md` (at least **The six laws**). After that,
this file is all you need.

## Where it stands

`paintMountains()` in `src/render/landscape.js` (~line 200) blends snow with
`smoothstep(52, 64, y) * smoothstep(0.45, 0.7, normal.y)`. The peaks are steep, so
most high vertices fail the slope term, and the summits read as bare rock with only a
few white flecks.

## Measure first

Write a scratch Node script in `/tmp` (not in the repo) that does
`import('three')` and `buildMountains()` from `src/render/landscape.js`, then walks the
mesh's position, normal and colour attributes. It reports:

- **A:** of the vertices with `y > 70`, the share whose snow weight is ≥ 0.5.
- **B:** of the vertices with `y < 45`, the share with any snow weight > 0.

Compute the weight with the same expression `paintMountains` uses. If `buildMountains`
returns a Group, find the Mesh inside it. Record A and B before your edit.

## The edit

Change only the snow expression (and its constants) in `paintMountains`. The slope
term should let steep high faces hold snow, so ease it as height rises: for example,
blend the slope threshold toward 0 above the snowline. Keep the rock noise as it is.

## Numeric pass/fail

- A ≥ 0.6 and B = 0.
- `GATE_PORT=4373 npm run gate` is fully green, and `draws:` is unchanged.
- Then `npm run build` and
  `SHOT_PORT=4391 node scripts/shot.mjs docs/shots/slice-060-snow '[{"name":"city","keys":["z"],"wait":3000}]'`.
  Report the draw lines it prints.

Report A and B before and after your edit.

## Do not

Do not commit, push, stash or check out. Do not open PNGs. If it fails after two
retries, stop and report BLOCKED with the output.
