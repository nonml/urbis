# Agent Tooling — making the coding agent self-sufficient

This game is visual and interactive, so the agent's biggest weakness is that it
can't *see* what it built or *play* it. These tools close that loop. Three layers,
fastest to slowest:

| Layer | Tool | Answers | Cost |
|-------|------|---------|------|
| Logic | `npm test` (headless smoke) | Did the systems stay correct? | ms |
| Cascade | `npm run scenario` | Did the world *remember* what I did? | ms |
| Feel/look | Playwright MCP | Does it actually run and look right? | seconds |

---

## 1. Playwright MCP — eyes and hands on the running game

`@playwright/mcp` gives the agent live browser control: launch the game, send
WASD/click input, take screenshots, read the console for `pageerror`, and query
`window.game` state. This is the loop that lets the agent verify "does it feel
good / does it look good" — exactly what `CLAUDE.md` demands.

**Config:** [.mcp.json](../.mcp.json) at the repo root, standard MCP format:

```json
{ "mcpServers": { "playwright": { "command": "npx",
  "args": ["-y", "@playwright/mcp@latest", "--browser", "chromium",
           "--caps", "vision", "--viewport-size", "1280,720"] } } }
```

**Pointing pi at it:** pi runs on llama.cpp, so its MCP config may live somewhere
other than `.mcp.json` (check pi's own config). The server invocation above is
client-agnostic — copy the `command`/`args` into whatever MCP block pi reads. The
`vision` cap matters here: pi already has vision via its VLM, so it can act on the
screenshots the server returns (coordinate clicks, "is the HUD visible", etc.).

**Prerequisites (one time):**

```bash
npx playwright install chromium   # browser binary
```

**Typical agent loop:**
1. Start the game: `npm run dev` (serves on `http://localhost:5173`).
2. Navigate, then click `#start-btn` (the "SOLO CAMPAIGN" button).
3. Wait for `#message-log` to contain `3D renderer ready`.
4. Screenshot + read console; inspect `window.game.state` / `window.game.ui.renderer3d`.

See [scripts/capture_screenshot.mjs](../scripts/capture_screenshot.mjs) for the
exact selectors and the headless WebGL flags (`--use-gl=swiftshader`) if the
agent needs to drive Chromium directly instead of via MCP.

---

## 2. Scenario runner — proving consequence cascades headlessly

`npm run scenario` runs a deterministic sequence of game actions against the
headless game and prints a before/after world-state diff. Same seed + same steps
=> same diff, every time. Use it to prove a hack/build/heat change actually
ripples, without paying for a browser.

```bash
npm run scenario                                  # built-in demo
node scripts/scenario.mjs scenarios/blackout_ripples.json
node scripts/scenario.mjs scenarios/blackout_ripples.json --json   # machine-readable
```

A scenario is JSON ([scenarios/blackout_ripples.json](../scenarios/blackout_ripples.json)):

```json
{ "name": "...", "seed": 130130, "mapPreset": "CITY", "mode": "standard",
  "steps": [
    { "op": "ticks", "n": 3 },
    { "op": "hack", "nodeType": "POWER_SUBSTATION", "success": true },
    { "op": "hack", "nodeIndex": 0, "success": false },
    { "op": "ticks", "n": 5 } ] }
```

Ops map 1:1 to real `Game` methods in
[src/headless_game.js](../src/headless_game.js): `ticks`, `build`, `hack`,
`spawnCase`, `setHeat`, `modifyRep`. The diff reports gold/food/heat/heatState,
faction reputation, and world effects (blackouts, traffic switches, unlocked
doors, anomalies, faction encounters, cases). An empty diff prints a warning —
that means no cascade happened, which is usually a bug.

---

## 3. CI gate — verification outside the agent's machine

[.github/workflows/ci.yml](../.github/workflows/ci.yml) runs the canonical gate
on every push/PR: `lint:basic` → `check:no-math-random` → `validate` → `test` →
`check:pbr`, then builds and runs the Playwright e2e suite (with its visual
baselines). This catches anything the agent's local run missed, especially visual
regressions, before it reaches `main`.
