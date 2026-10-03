# The pillar scorecard

`npm run build && npm run scorecard` (configurable via `SCORE_PORT`, default 4991)
boots the built game headless the same way `scripts/shot.mjs` does — `?capture=1` on
vite preview — and drives the six pillar tests from `AGENTS.md` as bots
(`scripts/scorecard.mjs`). Every probe it needs lives behind the capture flag in
`window.__game.scorecard` and `window.__game.enterLot`, so no player-facing code
changes. It is a meter, not a gate: it always exits 0.

Runs: seed 20260916 both ways (the hand-preset map and `?gen=1`), plus four extra
seeds from `--seeds=<n,...>` (default 11, 22, 33, 44), all generated. Output:
`latest.json`, `latest.md` (one row per pillar, one column per run, ✅/❌ with the
measured number), and a `<run>-<pose>.png` contact sheet at 1280×720 in the
`street`, `day` and `city` poses.

## The bots

One bot per pillar; each returns ✅/❌ with the number it measured.

**Build it, live in it** — Zones the first `EMPTY` lot `com` (pinning com demand so
the market allows the zone), fast-forwards up to 180 s of sim until stage LOW, then
uses the door (`enterLot`) on the grown building. ✅ when `isIndoors` is true;
❌ "no door on zoned buildings" if the interior never offers a door for the lot.

**The city lives** — Snapshots parcels, economy, NPC and car positions, fast-forwards
120 s of sim with no input, snapshots again. ✅ when ≥ 1 parcel stage/progress changed
*and* ≥ 50% of NPCs moved more than 5 m.

**Every tool is expressive** — Poses the player at spawn, reads every zone's
`zonePhase`, fires `__game.hack()`, advances 2 s and reads again. ✅ when some zone's
phase went lit → dark (the hack visibly did something).

**Consequence fits the act** — The same hack, re-read for reach: counts how many
zones changed phase. ✅ when exactly one zone changed (the effect stayed local, not
city-wide).

**The player feels capable** — Gets the avenue edges from `world.js` via
`scorecard.edges()`; for each, teleports to its start and holds forward toward its
end with `walkEdge` (20 s cap, sampled camera checks). ✅ when ≥ 95% reached their
end, zero frames had the camera inside a building footprint
(`scorecard.footprints()`, the same list `check_overlap.mjs` reads), and every
sampled `frameCheck(2)` had ≤ 0.02 blocked. Also drives one car loop with
`simDrive` and reports the metres moved.

**Beauty in the system** — Runs `npm run lint` and a brace-matched line-span scan of
`src/`. ✅ when lint errors are 0; the value reports lint errors/warnings and how
many functions exceed 60 lines.
