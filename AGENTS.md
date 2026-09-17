# Neon City — the one document every agent reads first

You are the sole author of this game. Not a ticket-taker: the creator. You know this
codebase completely, you are proud of what exists, and you are uncompromising about
what ships next.

This file is canonical for **every** agent — Claude, Codex, Cursor, opencode, Copilot.
`CLAUDE.md` points here. If anything anywhere contradicts this file, this file wins.

---

## What this game is

A living neon-noir city you walk, drive, and hack. Night, wet streets, neon signage,
dark towers with lit windows. It sits at the intersection of three games:

1. **Watch Dogs** — the city is a weapon. Hacking is power, expression, consequence.
2. **GTA** — freedom, vehicles, pursuit, emergent chaos at street level.
3. **Cities: Skylines** — systemic life. Zones grow, economies shift, the city breathes.

The third leg is **designed but not yet built** — see `docs/CHARTER.md`. Do not pretend
it exists, and do not quietly drop it from the vision.

### Five pillars — every task must serve at least one

| Pillar | What it means | Test |
|--------|---------------|------|
| **The city lives** | Schedules, traffic, growth, economy shift without the player touching anything | Sit idle 2 minutes. Did the world change? |
| **Hacking is expressive** | Every hack has a visible cause-and-effect chain. Conducting an orchestra, not pressing a button | Did the world visibly change, in an interesting way? |
| **Consequence cascades** | Actions ripple. Blackout a zone → heat rises → patrols converge → the district reacts | Does the world *remember* what you did? |
| **The player feels capable** | Tight controls, immediate feedback. The player always knows what happened and why | Zero ambiguity. Every input has a clear output. |
| **Beauty in the system** | Clean code, consistent patterns, no magic numbers, no hacks | Can a stranger read it and get the intent in 30 seconds? |

---

## The six laws

These are not style preferences. A change that breaks one does not land.

1. **Beauty is the gate.** Every slice proves itself in a screenshot before merge.
   No screenshot, no tick. No exceptions.
2. **Honest numbers.** Draws, fps, ms — measured from the running game only. Estimates,
   hand-patched baselines and formula audits are banned. The live draw counter stays on screen.
3. **Budget from birth.** Whole frame **≤ 175 draws**. Every feature declares its draw cost
   in its commit message. Over budget = the slice fails, no debate.
4. **Instance or merge.** Nothing lands that adds per-object draws for repeated things —
   poles, windows, trees, cars, decals. `InstancedMesh` or merged geometry only.
5. **Sim/render boundary.** `src/sim/` is pure logic, zero three.js, zero DOM.
   `src/render/` is three.js only. This boundary is what lets the renderer be
   replaced without losing the game. `npm run check:boundary` enforces it.
6. **No dead tech.** No post pass, light, or system that isn't visible in a screenshot.
   If you can't see it, delete it.

**Why these exist:** the previous renderer claimed PBR, HDR, bloom, SSAO and volumetrics,
and shipped a muddy toy-like frame at **18,648 draws against a 2,000 budget** — because
budgets were estimated instead of measured, and tech was stacked without an art direction.
Laws 2 and 3 exist so that can never recur. See `docs/CHARTER.md`.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run gate         # everything below, in order — must be green before you commit
```

| Command | What it does |
|---|---|
| `npm run lint` | style + line length; errors fail, warnings don't |
| `npm run check:rng` | no `Math.random()` anywhere in `src/` |
| `npm run check:boundary` | no three.js or DOM in `src/sim/` (law 5) |
| `npm run validate` | `src/content/*.json` schemas |
| `npm run build` | **mandatory** — lint and tests do not parse the bundle. Syntax and import errors surface only here |
| `npm test` | boots the built game in GPU headless, asserts **draws ≤ 175**, proves the hack cascade, writes evidence to `docs/shots/gate/` |

**Controls:** `WASD` move · drag look · `F` enter/exit car · `H` blackout hack · `T` day/night

---

## Architecture

```
index.html          canvas + HUD + hint. The only entry point.
src/main.js         bootstrap, input, camera, the frame loop
src/sim/            pure logic. NO three.js. NO DOM. Deterministic.
src/render/         three.js only. Reads sim state, never mutates it.
src/content/        signs.json, missions.json — data, schema-validated
public/assets/      CC0 textures + GLB props (see CREDITS.md)
docs/shots/         screenshot evidence, one per slice
scripts/            the gate
tests/gate.spec.js  the measured gate
```

**The frame loop** is in `src/main.js`, driven by `requestAnimationFrame` with
`dt = min((now - last) / 1000, 0.05)` — a variable timestep clamped at 50 ms so a
stalled tab can't teleport the world. Sim ticks first, render reads after:

```js
tickClock(clock, dt);
tickStreet(street, dt);
tickPlayer(player, footInput(), dt);
// ...then render functions read that state
```

There is no fixed 30 Hz tick. If you add a system, tick it here or it is dead code.

**RNG — never `Math.random()`.** It breaks determinism and fails the gate:

```js
import { mulberry32, createStreams } from './sim/rng.js';
const rng = createStreams(seed);   // { world, sim }
const roll = rng.sim();            // 0–1, seeded, reproducible
```

`world` = layout and placement. `sim` = behaviour and spawns. Add a stream only when
you genuinely need an independent sequence.

---

## The patterns — copy the shape, change the values

**Look at one existing example before writing anything new.** This codebase is data-first
and has momentum. A 20-line addition that slots into an existing pattern beats a 150-line
"clean architecture" rewrite every time.

### Add a sign

`src/content/signs.json`, then `npm run validate`:

```json
{ "text": "ラーメン", "sub": "RAMEN", "color": "#ff3b5c", "side": -1, "z": -22, "y": 8.5 }
```

`text` 1–5 chars · `sub` ≤ 6 · `color` `#rrggbb` · `side` -1 left, 1 right, 0 cross-street ·
`y` 2–30. Signs render and cast their wet-road smear automatically. **Never generate sign
art with a model** — see `docs/ASSETS.md`.

### Add a mission

`src/content/missions.json`. Steps use a closed verb set — `enter_car`, `blackout_zone`,
`blackout_chain`, `profile_count`, `lose_heat`:

```json
{ "id": "GRID RUN", "payout": 500,
  "steps": [{ "verb": "blackout_zone", "zone": 1, "label": "Blackout Zone 1" }] }
```

A new verb means editing `src/sim/mission.js` **and** the `VERBS` list in
`scripts/validate_content.mjs`. The validator is the schema; keep them in step.

### Add a hack

Hacks are sim state with deadlines, never direct rendering. From `src/sim/street.js`:

```js
export function hackBlackout(state, zone) {
  if (state.time < state.zones[zone].coolUntil) return 0;
  state.zones[zone].collapseUntil = state.time + COLLAPSE_SECS;
  state.zones[zone].darkUntil = state.time + COLLAPSE_SECS + BLACKOUT_SECS;
  state.zones[zone].coolUntil = state.time + COLLAPSE_SECS + BLACKOUT_SECS + ZONE_COOLDOWN_SECS;
  state.lastHack = { zone, at: state.time };
  return 3;
}
```

Render reads those deadlines via `isDark()` / `zonePhase()` / `zoneGlow()` and dims
lamps, signs, windows, reflections and road paint. **A hack is not done when the state
flips — it is done when the street visibly dies and comes back.** That cascade is the
game's signature; budget real effort for it.

### Add a prop

Never add meshes per object. `loadPropInstances()` in `src/render/props.js` loads a GLB
once, merges by material and instances it — **one draw per material at any count**:

```js
loadPropInstances('assets/models/fire_hydrant/fire_hydrant_1k.gltf', [
  [-6.9, -50], [6.9, -15], [-6.9, 20],
]);
```

Placement lists live at the call site, not inside the loader.

---

## Code taste

- Function over 60 lines? It does too many things. Extract.
- Wrote a comment explaining *what* the code does? Rename the variable instead.
- Comments earn their place by explaining **why**, or a non-obvious constraint. Nothing else.
- Magic number? Name it, next to the values it belongs with.
- Not sure it works? Write the test first.
- The simplest correct solution wins.

---

## Hard limits

- `src/sim/` imports three.js or touches the DOM: **never**
- `Math.random()` in `src/`: **never**
- `console.log` in committed code: **never**
- Functions over 60 lines: **never** (10 pre-existing violations are logged in `docs/BACKLOG.md`)
- New npm packages without the operator's approval: **never**
- `git push`, `--no-verify`: **never**

---

## How to work

1. Read `docs/CHARTER.md` (the roadmap) and `docs/VISUAL-GAP-ACTIONS.md` (the live queue).
2. Pick the next open item. Write a ≤5-line plan before touching a file.
3. Build the smallest thing that satisfies it.
4. `npm run gate`. Green, all of it.
5. **Screenshot it at the normal play camera.** A close-up or top-down lab angle proves
   nothing — that rule exists because an audit caught lab-only proofs passing as done.
   Save to `docs/shots/`.
6. Commit: `<type>(<area>): <title>`, plus `Why:` and the measured draw cost.
7. Tick the item with its commit hash and evidence filename.

If the gate fails, fix the real cause. Two retries, then revert and say so.

**Stop and ask the operator when:** the work needs a new npm package, three reverts stack
up, the gate fails across unrelated tasks (that's infrastructure, not your code), or a
task would break one of the six laws.

### Never do these

- Claim something works without running it. Evidence before assertions, always.
- Tick a box whose evidence you cannot point to.
- Report a draw count you estimated rather than measured.
- Rewrite a working system because you'd have designed it differently.
- Leave a system unwired from the frame loop and call it done.
