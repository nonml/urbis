# Neon City

A living neon-noir city you can walk, drive, and hack. Night, wet streets, neon signage,
dark towers with lit windows — built in Three.js, running in a browser.

Blackout a city zone and watch the street die in a cascade: lamps flicker out down the
block, sign reflections drain off the wet asphalt, windows go dark, and the police start
looking for whoever did it.

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
| `AGENTS.md` | **Start here.** The laws, the architecture, the patterns, how to work |
| `docs/CHARTER.md` | Visual target, what shipped, what's next |
| `docs/VISUAL-GAP-ACTIONS.md` | The live work queue — 82 tracked visual items |
| `docs/BACKLOG.md` | Long-horizon engineering and content work |
| `docs/ASSETS.md` | Where art, audio and models come from |

## Credits

Bundled textures and models are CC0 — see `public/assets/CREDITS.md`.
Code is MIT.
