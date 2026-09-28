# Wave 2: what landed, and what is left to pick up

Seven tracks ran in parallel on 2026-09-28, on a cloud container with no GPU (the
browser gate ran on SwiftShader). Six merged into `claude/focused-brown-vsuxvr`.
One is on its own branch.

## Merged (slices 047–052, in merge order)

| Slice | Track | Merge | Evidence |
|---|---|---|---|
| 047 | reclaim: draw ledger, night shadow pass off, faded draws skipped, one material for both zones, single-pass billboards, the mirror waits for a zone to settle | `9b5f131` | `wave2-reclaim-{day,night,blackout}-{before,after}.png`, `docs/DRAWS.md` |
| 048 | economy: jobs, homes, wealth and demand per district | `04305a6` | `wave2-economy-*.png`, `docs/ECONOMY.md` |
| 049 | decline: trend and cause codes, vacancy, TO LET boards, the reason line | `bd1b0c1` | `wave2-decline-*.png`, `docs/ZONING.md` |
| 050 | cityview: Z overview; R, C, I, X zone lots | `ad67e3b` | `wave2-cityview-*.png`, `docs/CITYVIEW.md` |
| 051 | interiors: a noodle bar and a roof, E at the door | `6837f5a` | `wave2-interiors-*.png`, `docs/INTERIORS.md` |
| 052 | arc: six missions, three contacts, two choices (radio deferred: no audio exists) | `58ba12a` | `wave2-arc-*.png`, `docs/ARC.md` |

**Gate on the merged build** (SwiftShader, bundle built from `58ba12a`): 75 passed,
1 failed, and that failure is the known environment one below. Draws: 118 / 175 at the
gate pose, 109 inside the shop, 110 on the roof.

## Closed out on a GPU (2026-09-29)

The operator stopped the wave before three checks were done. All three were then run
locally on the merged build (`9f846cd`), in Chrome on a real GPU.

- **Gate: 76 of 76 pass**, including `the world changes while the player stands
  still`. Its SwiftShader timeout was the container, not the code. Draws: 123 at the
  gate pose, 109 in the shop, 110 on the roof.
- **Combined worst-case sweep: 149 / 175.** The worst frame is city view by day in a
  blackout, with the marker, decline, growth and an ordered clearing all on, read on
  every frame. The full table is in `docs/DRAWS.md`, "Worst case on the merged build".
- **Play-camera shots of the merged build:** `wave2-merged-*.png`, covering the
  street by night, by day and in a blackout, the drive, city view, the shop lit and
  dark, and the roof.

## Unfinished: `wave2/wanted` (police tiers, feature slice 4)

Pushed as its own branch, **not merged**. The sim, dispatch and 9 headless tests are
done. The frames don't prove it yet: the police lights don't show red or blue, the
search ring isn't visible from the chase camera, and the helicopter body isn't in frame.
Start with `docs/handoff/wave2-wanted.md` on that branch. Merge
`claude/focused-brown-vsuxvr` into it first. Expect conflicts in `src/main.js`,
`index.html`, `src/sim/mission.js` and `scripts/validate_content.mjs`.

## Worth a look next

- A lot being cleared for a new use (city view) shows no reason line yet; decline's
  `describe()` doesn't know about demolitions the player ordered.
- The hint line is long enough to wrap at 1280 px.
- `__game.cooldown()` throws (it calls `hackCooldownLeft` without a zone). Pre-existing.
- In the foreground of the gate pose, the puddle mirror renders as a jagged white and
  blue shape (bottom left of `wave2-merged-street-*.png`). This is pre-existing:
  `wave2-reclaim-night-before.png`, shot on `69ff023`, shows it too.
- At its widest reach, city view shows pale spiked mountains down one side and the
  nearest towers as black slabs (`wave2-merged-cityview-day.png`). The track's own
  `wave2-cityview-zone.png` shows the same. Both are now in **VGA-084**, along with the
  48 intersecting buildings the operator spotted after this wave.
