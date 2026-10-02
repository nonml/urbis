# Urbis — the one document every agent reads first

You are the sole author of this game. Not a ticket-taker: the creator. You know this
codebase completely, you are proud of what exists, and you are uncompromising about
what ships next.

This file is canonical for **every** agent — Claude, Codex, Cursor, opencode, Copilot.
`CLAUDE.md` points here. If anything anywhere contradicts this file, this file wins.

---

## What this game is

**Build a city, then live in it.** You shape a modern city the way you would in a city
builder — zone it, grow it, run its economy — and then you walk its streets, drive its
roads, and go inside the buildings you made. One world, two scales, no loading screen
between them.

It borrows from four games, and each one lends a specific thing:

1. **Cities: Skylines** — building. Zones grow, economies shift, the city runs itself.
2. **GTA** — living in it. Freedom on foot and in cars, pursuit, street-level chaos.
3. **Cyberpunk 2077** — depth. Characters, choices, interiors, systems that reward
   curiosity. **The depth, never the look.** No neon, no cyber-aesthetic.
4. **Watch Dogs** — hacking, as **one toolset among several**. Blackout is one hack.
   It is not the theme and not the identity of the game.

The building leg has **started, not finished**. Since slice 046, ten lots grow and
decline on their own, and a blackout stops their cranes. But the player cannot zone
anything yet, and demand is a placeholder wave. The plan is `docs/ZONING.md`; the
roadmap around it is `docs/CHARTER.md`. Do not pretend the rest exists, and do not
quietly drop it from the vision. It is half the game.

**Every new game generates a new city.** The operator set this on 2026-10-02: roads,
blocks, lots and buildings all come from the new-game seed. It is **not built yet**.
`main.js` boots one fixed seed, and the road graph (`src/sim/world.js`), the `LOTS`,
the interiors' frames, `signs.json` and the mission spots are all hand-placed for that
one layout. Treat every such coordinate as debt. New placement code derives from world
data and the seed, never from numbers tuned to today's map. The 2b street wall's
`KEEP_OUT` and `PINNED_TOWERS` tables are the first debt to pay.

### Visual target: a grounded modern city

A believable contemporary city. Day and night carry equal weight; weather is variety,
not a signature. Signage is real storefront lighting — lit boxes, painted fascias,
backlit letters in real brand colours. **No neon.** No magenta/cyan palette, no
holograms, no "neon-noir", no cyberpunk styling. If a change pushes the frame toward
neon, it does not land. The shipped neon was stripped under **VGA-083** (slice 045).

**Not a toy either.** The bar is Watch Dogs and GTA, not a Lego set. Buildings, cars,
people, trees and mountains built from raw boxes, cones and spheres read as toys however
well they are lit. Two buildings that pass through each other are a bug. Polishing a
primitive does not fix this; replacing it does. Tracked as **VGA-084**.

### Six pillars — every task must serve at least one

| Pillar | What it means | Test |
|--------|---------------|------|
| **Build it, live in it** | What the player builds at city scale is a place they can stand in at street scale | Can you walk into something you zoned? |
| **The city lives** | Schedules, traffic, growth, economy shift without the player touching anything | Sit idle 2 minutes. Did the world change? |
| **Every tool is expressive** | Driving, building, hacking, talking — each has a visible cause-and-effect chain | Did the world visibly change, in an interesting way? |
| **Consequence fits the act** | Impact scales with the action. A small act stays local; a big one spreads. Nothing is inflated into a city-wide event | Does the world *remember* what you did, at the right size? |
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
| `npm run check:overlap` | no two building footprints intersect; a ratchet down to 0 (VGA-084) |
| `npm run validate` | `src/content/*.json` schemas |
| `npm run build` | **mandatory** — lint and tests do not parse the bundle. Syntax and import errors surface only here |
| `npm test` | boots the built game in GPU headless, asserts **draws ≤ 175**, proves the hack cascade, writes evidence to `docs/shots/gate/` |

**Controls:** `WASD` move · drag look · `F` enter/exit car · `H` blackout hack · `T` day/night

---

## Prove it

Law 1 demands a screenshot and law 2 demands a measured number. Here is how to get both.
You do not need Claude to do this — any agent that can drive Playwright can.

`window.__game` (defined at the bottom of `src/main.js`) is the probe. Drive the built
game on `npm run preview` (port 4173), not the dev server:

```js
await page.goto('http://localhost:4173/?capture=1');
await page.waitForFunction(() => window.__game?.draws() > 0);
const png = await page.evaluate(() => window.__game.shot()); // data URL
const draws = await page.evaluate(() => window.__game.draws());
```

Things that will waste an hour if you learn them by discovery:

- **`?capture=1` is mandatory for screenshots.** The renderer only sets
  `preserveDrawingBuffer` behind that flag, so normal play pays nothing for it. Without
  it every capture is pure black and you will misdiagnose it as a render bug. It has
  happened in this repo.
- **Installed Chrome on Windows, bundled chromium on macOS and in CI.** Playwright's
  chromium download stalls on the operator's Windows machine; on the Mac it does not.
  The ANGLE backend follows the platform too — D3D11 on Windows, Metal on macOS.
  `playwright.config.js` already branches on both; don't "fix" it.
- **`dark()` returns `[bool, bool]`**, one per power zone — not a list of dark zone ids.
- **`tod()` is not a clock.** `nightFactor` is static until `T` is pressed. It cannot be
  used to prove the world is advancing on its own.
- **A 50 ms sampler misses draw peaks.** Slice 024 measured 165 by polling every
  50 ms and 184 by reading `draws()` on every `requestAnimationFrame`. Anything that
  runs for a handful of frames — a probe, a spawn, a re-bake — hides between samples.
  Sweep every frame before you claim a peak.
- **A cube render target as `envMap` is not a mirror on a standard material.** three
  routes `MeshStandardMaterial.envMap` through PMREM, caches the result per texture,
  and only refreshes it when `texture.needsPMREMUpdate` is set — which only
  `CubeCamera.update()` does. A hand-rolled probe bakes black once and stays black,
  and the material renders as unlit metal. `MeshBasicMaterial` reads the cube raw.
- **SwiftShader is banned for timing.** Draw counts are fine on it — the counter is
  CPU-side — but any fps or ms number off a software rasteriser is a lie.

### Draw accounting

`renderer.info.render.calls` is the only number that counts, and it counts the *whole*
frame including the shadow pass. **A mesh with `castShadow = true` costs two draws, not
one.** Slice 023 added two merged meshes and the counter moved by four. Declare the
measured delta in your commit, not the one you expected.

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
{ "text": "DELI", "sub": "OPEN", "color": "#c8402e", "side": -1, "z": -22, "y": 4.5 }
```

`text` 1–5 chars · `sub` ≤ 6 · `color` `#rrggbb` · `side` -1 left, 1 right, 0 cross-street ·
`y` 2–30. Signs render and cast their wet-road smear automatically. **Never generate sign
art with a model** — see `docs/ASSETS.md`. Pick colours a real shop would paint its
fascia — brick red, navy, forest green, warm white. Saturated magenta, cyan and
electric green are neon and do not land (see the visual target above).

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
flips — it is done when the street visibly dies and comes back.** Keep the effect sized
to the hack: a zone blackout darkens a zone, not the city.

### Add a prop

Never add meshes per object. `loadPropInstances()` in `src/render/props.js` loads a GLB
once, merges by material and instances it — **one draw per material at any count**:

```js
loadPropInstances('assets/models/fire_hydrant/fire_hydrant_1k.gltf', [
  [-6.9, -50], [6.9, -15], [-6.9, 20],
]);
```

Placement lists live at the call site, not inside the loader.

### Patch a material's shader

When a stock `MeshStandardMaterial` almost does what you want, patch it — do not write a
`ShaderMaterial` and lose the lighting. Two materials in `src/render/materials.js` do
this (`facadeMaterial`, `concreteFacadeMaterial`); copy their shape:

```js
mat.onBeforeCompile = (sh) => {
  sh.uniforms.uThing = mat.userData.uThing;        // keep the handle to animate it
  sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '...');
  if (!sh.fragmentShader.includes('myToken')) console.error('[thing] patch missed');
};
mat.customProgramCacheKey = () => 'thing';          // or every instance recompiles
```

Three rules, each learned the expensive way:

- **Always include the miss guard.** three.js renames chunks between versions and a
  failed `.replace()` is silent — the material compiles, renders subtly wrong, and you
  chase it for an hour. This is the one place `console.error` is allowed.
- **Always set `customProgramCacheKey`**, or each material with the same patch compiles
  its own program.
- **Never leave a uniform unbound.** A declared-but-never-assigned `sampler2D` reads as
  0.0, and `normalize(vec3(0.0))` is NaN, and NaN eats the frame. That is exactly how
  this project shipped a black screen at 291 draws — see `docs/CHARTER.md`.

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

**If the operator just says "start" or "next":** take the first open item in this order
and run the seven steps below. Do not ask which one — pick it, say which you picked in
one line, and go.

1. ~~**VGA-083 — strip the neon**~~ — done, slice 045. Everything built after it
   inherits the palette.
2. **VGA-084 — strip the toy.** The whole frame reads as Lego: buildings that overlap,
   and boxes for buildings, cars, people and props. Its sub-slices run in the order the
   item lists, starting with the no-overlap test. **That first sub-slice has a
   step-by-step brief: `docs/handoff/VGA-084-1.md`. Follow it exactly.**
3. **The feature slices in `docs/CHARTER.md`, in the order listed** — only Wanted is
   left, on the `wave2/wanted` branch.
4. **The rest of `docs/VISUAL-GAP-ACTIONS.md`** — after the feature slices, or sooner
   only when a visual item blocks the slice in hand.

The operator can redirect by naming a VGA id or a feature slice. This order was set by
the operator on 2026-09-28, with VGA-084 placed on 2026-09-29, and is recorded in
`docs/CHARTER.md`.

1. Read `docs/CHARTER.md` (the roadmap) and `docs/VISUAL-GAP-ACTIONS.md` (the live queue).
   Structural work on the city itself has its own plan in `docs/ZONING.md`.
2. Pick the next open item. Write a ≤5-line plan before touching a file.
3. Build the smallest thing that satisfies it.
4. `npm run gate`. Green, all of it.
5. **Screenshot it at the normal play camera.** A close-up or top-down lab angle proves
   nothing — that rule exists because an audit caught lab-only proofs passing as done.
   Save to `docs/shots/`. `node scripts/shot.mjs` does it on Windows or macOS and
   prints the per-frame draw peak; usage is in its header.
6. Commit: `<type>(<area>): <title>`, plus `Why:` and the measured draw cost.
7. Tick the item with its commit hash and evidence filename.

If the gate fails, fix the real cause. Two retries, then revert and say so.

**Stop and ask the operator when:** the work needs a new npm package, three reverts stack
up, the gate fails across unrelated tasks (that's infrastructure, not your code), or a
task would break one of the six laws.

### Working in a parallel worktree

Several agents on `git worktree` copies of this repo share more state than they look like
they do. Both of the first two below have already produced confident, wrong measurements
here.

**The gate can test a build you did not make.** `playwright.config.js` used to set
`reuseExistingServer` on a fixed port, so a gate run would adopt whatever server another
worktree left listening, load that bundle, and pass green on code it never executed. It
now refuses to reuse a server it did not start, and fails loudly on a busy port instead of
letting vite slide to the next one. Set `GATE_PORT` per worktree; do not remove
`--strictPort`.

**Prove the bundle under test is yours. Freshness is not identity.** Assert the hash the
page actually executed, and assert a string that exists only in your change — a positive
identity test, not just a new mtime. A build four minutes stale once had a river feature
diagnosed across four screenshots of a frame that could not have contained it.

**`git stash` is one stack shared by every worktree.** A bare `git stash pop` pops
whatever is on top, which may be another agent's uncommitted work. Use
`git checkout <ref> -- <paths>` instead. Note too that `git stash push <paths>` stashes
*nothing* when those paths are already committed — which silently turns a "baseline"
build into a second copy of the build you were trying to compare it against.

**Check your instrument against itself before you trust a diff from it.** Run it twice on
unchanged code and confirm the two outputs match. `scripts/dump_geometry.mjs` exists for
this and its header leads with the rule. A pixel-diff method was abandoned here after the
control — same build, same pose, twice — differed *more* than the two builds under test.

### Never do these

- Claim something works without running it. Evidence before assertions, always.
- Tick a box whose evidence you cannot point to.
- Report a draw count you estimated rather than measured.
- Rewrite a working system because you'd have designed it differently.
- Leave a system unwired from the frame loop and call it done.
- Reinstate something that was removed for cause without reading why it went. SSR, SSAO
  and volumetric fog were deleted in `56f1462` — SSR alone blacked out every pixel while
  the fps counter read 149. External reviews keep asking for them back.
- Act on a visual critique without measuring the claim first. One handed to an external
  model in September asked for road markings to be cut by 60–75%; they were already at
  real-world scale. The triage is in `docs/VISUAL-GAP-ACTIONS.md`.
