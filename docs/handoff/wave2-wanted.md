# Wave 2 handoff: wanted (police tiers)

Branch `wave2/wanted`, based on `69ff023`. **Not merged.** The sim is done and
tested. The frames do not yet prove the features, so it fails law 1 as it stands.
Read `AGENTS.md`, then `docs/WANTED.md` (the tier table and design), then this file.

## Goal

Feature slice 4 in `docs/CHARTER.md`. Pursuit becomes a net that closes in tiers
sized to the act: more cruisers, stingers, a roadblock ahead, and a helicopter
with a searchlight. When the player breaks line of sight, the police visibly
search the last known position. Dispatch calls show as radio subtitles. All of
it is instanced, deterministic, and within the 175-draw frame.

## State

**Done and proven (headless):**
- `tests/wanted.spec.js`: 9/9 pass, covering tier escalation and de-escalation,
  search, heli light, stingers, roadblock, busted, `lose_heat`, and dispatch
  determinism. Run `npx playwright test tests/wanted.spec.js`; it launches no browser.
- Sim: `src/sim/wanted.js` (tiers), `src/sim/patrol.js` (street line of sight,
  road-graph routing), `src/sim/response.js` (roadblock, stingers, heli),
  `src/sim/dispatch.js` + `src/content/dispatch.json` (validated).
- Draws measured every rAF on SwiftShader against `69ff023`, before the reclaim
  merge:
  - clean night: 152 → 152
  - blackout at spawn: 160 → 154 (the old per-car pursuit rig cost 8)
  - worst pursuit pose: 143, against 139 clean at that pose
  - The whole frame is well under 175.
- Dispatch subtitles read well at the play camera (`docs/shots/wave2-wanted-*.png`).

**Written but not proven visually (why this didn't merge):**
- **Police lights don't read.** `wave2-wanted-roadblock.png` and
  `-roadblock-blue.png` are the same frame: no red or blue shows on the bars,
  barricades or facades. The last commit cut lamp intensity (`LAMP` in
  `src/render/police.js`) so ACES wouldn't bleach them white. Now they don't read
  at all. Check the wig-wag phase in the capture and the lamp colour path end to end.
- **The cruisers read as beige boxes**, not police. Livery and the bar need to read
  at chase-cam distance (VGA-022).
- **The search ring doesn't show** from the chase camera (`wave2-wanted-search.png`).
  `RING_WIDTH` went 0.32 → 0.7 in the last commit; that still wasn't enough, or the
  ring was faded out at capture time. Verify with the `__game` capture probe.
- **The helicopter body isn't in any frame**, only its beam (`wave2-wanted-heli.png`).
- **The frame washes out to white** in the pursuit shots: the hero car's headlight
  throw (VGA-004) plus the searchlight pool. `SEARCHLIGHT` went 450 → 220. The
  headlight part is pre-existing; the arc track's frames show it too. Decide
  whether the searchlight pool should lower exposure locally or cut further.

**Broken:** nothing known in the sim. The browser gate was never run on this branch.

## Next steps

1. Rebase onto `claude/focused-brown-vsuxvr` (wave 2 merged there: reclaim,
   economy, decline, cityview, interiors, arc). Expect conflicts in `src/main.js`
   (tick, render and `__game` lines), `index.html` (HUD elements),
   `src/sim/mission.js` and `scripts/validate_content.mjs` (the arc also adds verbs).
   Also `src/render/police.js`: the reclaim track changed materials and zone
   lighting (`zoneLit()` in `src/render/materials.js`).
2. Fix the four visual items above, one capture at a time, at the play camera.
3. Re-measure on the merged base: every rAF, worst pursuit pose, day, night and
   blackout. Keep it at or under +4 over the same pose clean.
4. Run the full gate (`npm run gate`). The only allowed failure is
   `the world changes while the player stands still`, and only on a software-GL
   machine (see Gotchas).

## Gotchas

- **Software GL runs at a few fps.** Loading the game takes about 25 s; an every-rAF
  sweep of N game-seconds takes a long time. Batch everything into one browser
  session. `?capture=1` is mandatory or captures are black.
- **The idle gate test** times out on SwiftShader, because `dt` is clamped at 50 ms
  and the city's clock runs slower than wall time. It is an environment failure,
  not a code one. It passes on a GPU.
- `__game.cooldown()` throws; it calls `hackCooldownLeft` without a zone. This is
  pre-existing.
- Playwright on this container image: point `PLAYWRIGHT_BROWSERS_PATH` at a shim
  whose `chromium-1208/chrome-linux64` links to `/opt/pw-browsers/chromium-1194/chrome-linux`.

## How to verify

- Headless: `npx playwright test tests/wanted.spec.js`
- Capture probes live behind `?capture=1` on `window.__game`; see `docs/WANTED.md`,
  "Capture probe", which forces a tier and a pose.
- Evidence shots: the frames in `docs/shots/wave2-wanted-*.png` are from bundle
  `index-CDUqF3qF.js`, which is this branch's tree.
