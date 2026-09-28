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

## Not done at wrap-up (the operator stopped the wave)

- **No combined worst-case sweep on the merged build.** No run has measured blackout,
  city view, inside the shop and the marker together, every rAF. Each track measured
  its own worst case on its branch, and none came near 175. The merged gate pose is
  118. Measure before trusting the headroom.
- **No new play-camera shots of the merged build.** The evidence above was shot on each
  branch.
- **Known environment failure:** `the world changes while the player stands still`
  times out on SwiftShader. `dt` is clamped at 50 ms and the frame rate is a few fps,
  so the city's clock runs slower than wall time. It should pass on a GPU; verify there.

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
