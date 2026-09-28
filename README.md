# Urbis

**Build a city, then live in it.**

Urbis is one world at two scales. At city scale you shape a modern city the way you
would in a city builder — zone it, grow it, run its economy. At street scale you walk
its pavements, drive its roads, and go inside the buildings you made. No loading screen
between the two.

Built in Three.js, running in a browser.

## What it's reaching for

| From | It takes |
|---|---|
| **Cities: Skylines** | Building — zones grow, the economy shifts, the city runs itself |
| **GTA** | Living in it — freedom on foot and in cars, pursuit, street-level chaos |
| **Cyberpunk 2077** | Depth — characters, choices, interiors, systems that reward curiosity |
| **Watch Dogs** | Hacking — one toolset among several |

The look is a **grounded modern city**: believable streets and towers, day and night,
real weather, real storefronts.

Consequences are sized to what you did. A small act stays on its block; a big one
spreads further. The city remembers either way.

## What's in it today

This is an early build. Honestly, today:

- **One district** you can walk and drive — blocks, avenues, cross traffic, a river valley
- **A day/night cycle** and rain, with wet-road reflections and lit windows
- **Traffic and pedestrians**, parked cars, street furniture
- **Pursuit and heat** — police respond, chase, and can bust you
- **Hacking** — one hack so far: black out a power zone and watch its lights die
- **Missions** — data-driven, from a small verb set

**Not built yet:** the city-building half (zoning, growth, economy — planned in
`docs/ZONING.md`), enterable interiors, and the narrative arc. See `docs/CHARTER.md`.

## Run it

Requires Node 20+ and a WebGL2 browser.

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`).

## Controls

| Key | Action |
|---|---|
| `WASD` | Move |
| Mouse drag | Look |
| `F` | Enter / exit car |
| `H` | Blackout hack |
| `T` | Toggle day / night |

## Checks

```bash
npm run gate
```

Runs lint, the seeded-RNG check, the sim/render boundary check, content validation,
the production build, and a GPU-headless test that boots the real game and asserts the
whole frame stays within its **175 draw call** budget. All of it must pass before a commit.

## How it's built

```
src/sim/      pure logic — no three.js, no DOM, deterministic under a seed
src/render/   three.js only — reads sim state, never mutates it
src/content/  signs and missions as schema-validated JSON
```

That boundary is enforced by `npm run check:boundary`, not by good intentions. It exists
so the renderer can be replaced without losing the game.

Every visual feature proves itself in a screenshot under the draw budget before it lands.
Evidence lives in `docs/shots/`, one set per slice.

## Docs

| File | What's in it |
|---|---|
| `AGENTS.md` | **Start here.** The concept, the laws, the architecture, how to work |
| `docs/CHARTER.md` | The game, the visual target, what shipped, what's next |
| `docs/ZONING.md` | The city-building half — the plan |
| `docs/VISUAL-GAP-ACTIONS.md` | The live visual work queue |
| `docs/BACKLOG.md` | Long-horizon engineering and content work |
| `docs/ASSETS.md` | Where art, audio and models come from |

## Credits

Bundled textures and models are CC0 — see `public/assets/CREDITS.md`.
Code is MIT.
