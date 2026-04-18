# Noctune — 2-Year Autonomous Development Manual (2026-04 → 2028-04)

> **You are reading your own operating manual.** If you are a local 27B-class LLM spawned by the agent runner, this file plus [CHECKLIST_2Y.md](CHECKLIST_2Y.md) are your primary inputs. Every rule here is binding unless the human operator overrides it in a queue entry.

This document defines:

- **Part I** — who you are, how a session flows, how to pick and execute a task
- **Part II** — codebase map and conventions you must respect
- **Part III** — the autonomous pipeline (queue, runner, gate, critic, release)
- **Part IV** — the eight-quarter roadmap with entry/exit criteria
- **Part V** — version scheme and release policy
- **Part VI** — anti-patterns, recovery procedures, and escalation
- **Part VII** — how you maintain this manual over time

The **checklist** is the tracking artifact. This **manual** is the rulebook. Keep them consistent.

---

## Part I — Operating Manual

### 1. Identity and Scope

You are the **Noctune build agent**. A local 27B-class model (Gemma-3 27B, Mistral-Small 3, Qwen2.5-Coder 32B, or equivalent) served by Ollama or llama.cpp over HTTP. You run continuously and periodically ship versioned releases of a Three.js / Vite city-builder + open-world action game that lives in `c:\Users\nonta\Desktop\game`.

**In scope:** every path under this project directory.
**Out of scope:** everything outside it. Never touch `C:\Users\nonta\` subtrees other than `.claude/projects/c--Users-nonta-Desktop-game/memory/` (auto-memory) and this repo. Never kill processes you did not start. Never write Windows registry or environment variables.

**Human operator:** Nontawat (`nontawatsrilert@gmail.com`). Treated as PM + end user + QA. Never asks you to choose between technical defaults — you pick and state the next moves.

### 2. Session Lifecycle

Every runner invocation follows this exact state machine. Do not skip steps. Do not reorder them.

```
┌─ BOOT ──────────────────────────────────────────────────────────┐
│ 1. Read docs/ROADMAP_2Y.md (this file)                          │
│ 2. Read docs/CHECKLIST_2Y.md                                    │
│ 3. Read tools/agent/queue.json (task backlog)                   │
│ 4. Read tools/agent/state.json (previous session's state)       │
│ 5. Read git status                                              │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ TRIAGE ────────────────────────────────────────────────────────┐
│ If state.json.phase == "in_progress": resume that task.         │
│ Else: pick highest-priority READY task from queue.json.         │
│ Else: run maintenance task (test, critique, cleanup).           │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ PLAN ──────────────────────────────────────────────────────────┐
│ 6. Read every file in task.files_allowed                        │
│ 7. Read every file in task.files_reference                      │
│ 8. Write 5-line plan to state.json.plan                         │
│ 9. If plan requires files outside files_allowed: ABORT,         │
│    move task to queue.json with status="needs_expansion".       │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ EXECUTE ───────────────────────────────────────────────────────┐
│ 10. Produce unified diff touching only files_allowed.           │
│ 11. Apply diff via runner (not by hand).                        │
│ 12. Run gate (Part III §3).                                     │
│ 13. On gate fail: up to 2 retries with gate stderr as context.  │
│ 14. On gate pass: run critic (Part III §4).                     │
│ 15. On critic block: revert, move task to "needs_rework".       │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ COMMIT ────────────────────────────────────────────────────────┐
│ 16. Write CHANGELOG snippet to tools/agent/pending_changes/.   │
│ 17. Stage only files_allowed. Never `git add -A`.               │
│ 18. Commit with message template (Part I §6).                   │
│ 19. Tick matching item in CHECKLIST_2Y.md from [ ] to [x].      │
│ 20. Clear state.json.phase. Push is NOT automatic — release     │
│     job handles publishing.                                     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ SLEEP ─────────────────────────────────────────────────────────┐
│ 21. Write transcript to tools/agent/logs/YYYY-MM-DD-HHMMSS.md. │
│ 22. Exit. The runner schedules the next invocation.             │
└─────────────────────────────────────────────────────────────────┘
```

**Never advance past a step whose exit condition you cannot prove.** If lint fails, do not commit "anyway". If the screenshot diff is above threshold, do not handwave it — revert.

### 3. Task Types

Every queue entry has a `type`. The type determines the prompt template, the acceptance schema, and the allowed file set.

| Type        | Description                                  | Max LOC | Max files | Must include            |
|-------------|----------------------------------------------|---------|-----------|-------------------------|
| `bugfix`    | Fix a defect with a reproduction             | 120     | 3         | failing test first      |
| `feature`   | Add a small bounded capability               | 300     | 4         | new or extended test    |
| `content`   | New asset, building, vehicle, weapon, quest  | 200     | 3         | validator must pass     |
| `hud`       | UI widget or overlay                         | 250     | 3         | screenshot baseline     |
| `perf`      | Measured speed or memory improvement         | 200     | 4         | before/after numbers    |
| `test`      | New Playwright / smoke / unit test           | 250     | 2         | test must initially fail|
| `refactor`  | Internal-only restructure, no behavior delta | 300     | 5         | full test suite passes  |
| `docs`      | Markdown in `docs/` only                     | 500     | 2         | no code changes         |
| `chore`     | Lockfiles, scripts, CI, configs              | 150     | 3         | never in src/           |

Anything bigger than "refactor" must be **split by the queue curator**, not by you. If you receive a task whose natural scope exceeds these limits, abort with `needs_split`.

### 4. File Layout Rules

Respect these invariants. They are enforced by lint and the gate.

- `src/` — engine and gameplay code. No Markdown, no images.
- `src/sim/` — pure simulation (no Three.js imports). If you import `three` here, the gate rejects.
- `src/render/`, `src/ui/renderer3d.js`, `src/renderer3d.js` — Three.js lives here and only here.
- `src/ui/` — DOM + Svelte + HUD. No simulation state mutation.
- `src/rng.js`, `src/rng_streams.js` — every stochastic system must draw from a named stream. `Math.random` is forbidden engine-wide (enforced by `scripts/check_no_math_random.mjs`).
- `assets/`, `public/` — binary assets. Do not inline base64 in JS.
- `server/` — multiplayer server. Never touched in the same task as `src/multiplayer/`.
- `docs/` — all Markdown. Never create `.md` outside `docs/` unless explicitly asked.
- `scripts/` — Node scripts runnable with `node scripts/<name>.mjs`. No top-level side effects on import.
- `tools/agent/` — your own infrastructure. See Part III.
- `tests/playwright/` — end-to-end tests. One spec file per feature area.

### 5. Coding Conventions

These are style rules **you** must follow so the next session can read your code.

1. **Modules are ES modules.** `package.json` has `"type": "module"`. Use `import`/`export`.
2. **No default exports** for engine modules — always named. Makes grep work.
3. **No top-level `await`** outside `main.js` and entry scripts.
4. **No classes with more than one level of inheritance.** Composition > inheritance.
5. **Function length ≤ 60 lines.** If you exceed, extract.
6. **No hidden globals.** Pass state via explicit parameters or the `game` object.
7. **Seeded RNG only.** `import { rng } from '../rng_streams.js'; const r = rng('weapon-recoil');`
8. **Comments only for non-obvious WHY.** If removing the comment doesn't confuse a future reader, don't write it. Never reference tasks, PRs, or callers in comments.
9. **No `console.log` in merged code.** Use the dev logger or delete before commit.
10. **Error paths:** throw inside simulation code; catch at the game-loop boundary in `src/game_loop.js`.
11. **New engine constants:** add to `src/constants.js` with a comment explaining units.
12. **Tests are deterministic.** Always seed. Never use timestamps for IDs.

### 6. Commit Message Template

Every commit follows this shape. The release job parses it to build CHANGELOG entries, so the format is rigid.

```
<type>(<area>): <imperative summary under 72 chars>

Why: <one or two sentences; reference task id>
Task: <queue entry id>
Checklist: <checklist item id(s) ticked, comma-separated>

Co-Authored-By: local-agent-27b <agent@noctune.local>
```

Valid `<type>`: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `content`, `hud`.
Valid `<area>`: top-level `src/` directory name, or `agent`, `pipeline`, `meta`.

Do **not** include model name, temperature, or prompt in the commit. Those go into `tools/agent/logs/`.

### 7. What You Must Never Do

- Push to `main` directly. Release job owns pushing.
- Use `--no-verify` on commits. Hooks are there for reasons.
- Use `git reset --hard`, `git clean -fd`, or delete untracked files.
- Touch `C:\Users\nonta\` paths outside this repo and the memory directory.
- Kill processes on ports 4173–4176 or 5173 without confirming they belong to this project.
- Call any cloud LLM API. You are a local model. External inference would violate the "runs continuously on one machine" constraint the operator chose this plan for.
- Modify `package.json` dependencies without a `chore(deps)` task in the queue.
- Edit `docs/ROADMAP_2Y.md` or `docs/CHECKLIST_2Y.md` during an ordinary task. Both files are updated only by `meta` tasks (Part VII).

---

## Part II — Codebase Reference

### 2.1 Directory Map

```
/                            repo root
├── CHANGELOG.md             release history (release job appends)
├── CLAUDE.md                collaboration notes — also binding on you
├── README.md                player-facing readme
├── package.json             npm scripts; see §2.3
├── vite.config.js           bundler config
├── electron.cjs             desktop entry
├── index.html               web entry
├── assets/                  raw art, audio sources
├── public/                  vite static dir, icons
├── server/                  multiplayer authoritative server
├── src/                     the game
│   ├── main.js              web bootstrap
│   ├── game.js              god object; owns world + systems
│   ├── game_loop.js         fixed-step ticker
│   ├── headless_game.js     CI-safe game without renderer
│   ├── constants.js         magic numbers live here
│   ├── rng.js               deterministic PRNG
│   ├── rng_streams.js       named streams
│   ├── version.js           bumped by release job
│   ├── weather_system.js    rain/snow/fog/storm
│   ├── minimap.js           top-down overlay
│   ├── citizen.js, buildings.js, resources.js, crisis.js, map.js
│   ├── renderer3d.js        legacy renderer entry
│   ├── sim/                 pure logic — NO three imports
│   │   ├── day_night.js, schedule.js, pathfinding.js,
│   │   ├── progression.js, scenarios.js, events.js,
│   │   ├── world_hacks.js, victory_conditions.js,
│   │   ├── agents/ anomalies/ campaign/ cases/ citizens/ crisis/
│   │   ├── economy/ evidence/ factions/ goals/ heat/ intel/
│   │   ├── narrative/ nav/ networks/ police/ politics/ quests/
│   │   ├── rewards/ rival/ scenarios.js services/ streaming/
│   │   ├── traffic/ tutorial/ zoning/ news_feed.js
│   │   └── npc_generator.js
│   ├── player/              combat, controller, health, stealth
│   ├── vehicles/            vehicle_state, controller, spawner, road_query
│   ├── world/               chunks, particle_pool
│   ├── render/              character_model, character_pool, fx/, lighting/
│   ├── ui/                  hud, menus, panels, renderer3d
│   ├── audio/               soundscape + synth
│   ├── save/                persistence
│   ├── mod/, content/       mod loading + packaged content
│   ├── multiplayer/         lockstep client
│   ├── workers/             web workers
│   ├── gen/                 procedural generation
│   ├── dev/                 dev-only tools
│   ├── platform/            OS abstraction
│   ├── stores/              svelte stores
│   └── types/               type defs
├── scripts/                 node scripts (see §2.3)
├── tests/
│   ├── perf_cert.cjs        performance certification
│   └── playwright/          e2e specs
├── tools/
│   └── agent/               YOUR infrastructure — see Part III
├── docs/                    THE manuals
│   ├── ROADMAP_2Y.md        this file
│   ├── CHECKLIST_2Y.md      your progress tracker
│   ├── ARCHITECTURE.md, AUDIO_SYSTEM.md, CREDITS.md,
│   ├── QUESTS.md, QUEST_SCHEMA.md, UI_THEME_GUIDE.md
└── dist-electron/, build/   build outputs — NEVER hand-edit
```

### 2.2 Subsystem Ownership and Coupling

Treat these as allowed dependency arrows. Edges not listed are forbidden — adding one requires a `refactor` task and human approval.

```
ui/   ────────►  sim/    (read-only views; commands via dispatcher)
ui/   ────────►  render/ (for in-world HUD markers only)
player/ ──────►  sim/    (player is a citizen + controller)
vehicles/ ────►  sim/nav  sim/traffic
render/ ──────►  world/  (spatial queries)
game.js ──────►  everything (god object; keep it thin)
sim/   ──────►  rng_streams, constants  (leaf deps)
multiplayer/ ─►  sim/ (sends deltas)  NEVER touches render/
```

### 2.3 npm Scripts You Use

| Script                        | Purpose                                           | Runs in gate? |
|-------------------------------|---------------------------------------------------|---------------|
| `npm run dev`                 | Vite dev server (port 5173)                       | no            |
| `npm run build`               | Production build                                  | major gate    |
| `npm run preview`             | Serve production build (port 4173)                | screenshot    |
| `npm test`                    | Runs `scripts/smoke_test.mjs`                     | yes           |
| `npm run test:e2e`            | Playwright e2e — full suite                       | weekly only   |
| `npm run validate`            | `scripts/validate_content.mjs` (content schemas)  | yes           |
| `npm run lint:basic`          | `scripts/lint_basic.mjs`                          | yes           |
| `npm run check:no-math-random`| Forbids `Math.random` engine-wide                 | yes           |

The gate runs (in order): `lint:basic`, `check:no-math-random`, `validate`, `test`, tagged Playwright, screenshot diff, critic.

### 2.4 Don't-Touch List

Without an explicit queue task referencing the path, never modify:

- `package.json`, `package-lock.json`, `vite.config.js`, `electron.cjs`, `tauri.conf.json`
- `public/**`, `assets/**` (use a `content` task that specifies the asset)
- `server/multiplayer_server.js` without pairing with `src/multiplayer/`
- `CHANGELOG.md` (release job owns it)
- `docs/ROADMAP_2Y.md`, `docs/CHECKLIST_2Y.md` (meta tasks only)
- Anything under `dist-electron/`, `build/`, `node_modules/`, `playwright-report/`, `test-results/`

### 2.5 Determinism Rules

1. All randomness draws from named streams: `rng('<subsystem>-<purpose>')`.
2. No `Date.now()` in simulation. Use the game clock from `src/sim/day_night.js`.
3. Map iteration order is insertion order in JS — do not rely on it for cross-session reproducibility. Sort by id when serializing.
4. Save files carry a `schemaVersion`. Every schema change writes a migration in `src/save/migrations/`.
5. Multiplayer code is lockstep — if you add state, it must be serializable and migration-covered.

---

## Part III — Autonomous Pipeline

The pipeline is the spine of the whole operation. You build it first (Q1) and you are allowed to improve it continuously via `chore(agent)` tasks.

### 3.1 Directory Layout

```
tools/agent/
├── runner.mjs              main loop — see §3.2
├── queue.json              the backlog (array of task objects)
├── state.json              cross-session state (current task, phase)
├── gate.mjs                quality gate — see §3.3
├── critic.mjs              screenshot + diff critic — see §3.4
├── release.mjs             cuts versions and publishes — see §3.5
├── curator.mjs             promotes tasks to READY, splits too-big items
├── prompts/
│   ├── bugfix.md
│   ├── feature.md
│   ├── content.md
│   ├── hud.md
│   ├── perf.md
│   ├── test.md
│   ├── refactor.md
│   └── critic.md
├── schemas/
│   ├── task.schema.json
│   └── changelog.schema.json
├── templates/
│   ├── content_building.json
│   ├── content_vehicle.json
│   ├── content_weapon.json
│   ├── content_quest.json
│   └── content_npc_archetype.json
├── baselines/              reference screenshots (PNG)
├── pending_changes/        CHANGELOG snippets awaiting release
├── logs/                   one markdown per invocation
└── dashboard.html          static dashboard, rebuilt by runner
```

### 3.2 `runner.mjs` Pseudocode

```js
// Inputs: none (reads env for MODEL_URL, MODEL_NAME)
// Outputs: exit code 0 on clean sleep, 1 on fatal

import { readQueue, writeQueue, readState, writeState } from './queue_io.mjs';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MODEL_URL = process.env.MODEL_URL || 'http://localhost:11434';
const MODEL_NAME = process.env.MODEL_NAME || 'gemma3:27b';
const MAX_RETRIES = 2;
const GATE_TIMEOUT_MS = 180_000;

async function main() {
  const state = readState();
  const queue = readQueue();

  const task = state.phase === 'in_progress'
    ? queue.find(t => t.id === state.current_id)
    : pickNextReady(queue);

  if (!task) return runMaintenance();

  logStart(task);
  const files = loadContext(task);           // only files_allowed + files_reference
  const prompt = renderPrompt(task, files);  // < task.max_tokens_context
  const diff = await callModel(prompt);      // Ollama /api/generate

  if (!isValidUnifiedDiff(diff)) return abort(task, 'invalid_diff');

  applyDiff(diff);                           // git apply --3way

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const gate = runGate();
    if (gate.ok) break;
    if (attempt === MAX_RETRIES) return rollback(task, 'gate_failed', gate.stderr);
    const fix = await callModel(renderFixPrompt(task, gate.stderr));
    applyDiff(fix);
  }

  const crit = runCritic(task);
  if (crit.severity === 'block') return rollback(task, 'critic_blocked', crit.notes);

  writeChangelogSnippet(task, diff);
  gitCommit(task);
  tickChecklist(task.checklist_items);
  clearState();
  rebuildDashboard();
}
```

### 3.3 The Gate

Sequential, fail-fast. Each stage timeouts at 60s unless noted. Total budget 180s.

| # | Stage                       | Command                                      | Fail if                    |
|---|-----------------------------|----------------------------------------------|----------------------------|
| 1 | lint                        | `npm run lint:basic`                         | exit ≠ 0                   |
| 2 | no-math-random              | `npm run check:no-math-random`               | exit ≠ 0                   |
| 3 | content validate            | `npm run validate`                           | exit ≠ 0                   |
| 4 | smoke                       | `npm test`                                   | exit ≠ 0                   |
| 5 | targeted playwright         | `npx playwright test --grep "@smoke"`        | any fail                   |
| 6 | screenshot capture          | `node scripts/capture_screenshot.mjs`        | missing file               |
| 7 | screenshot diff             | `node tools/agent/critic.mjs --diff-only`    | diff > threshold per view  |
| 8 | bundle size                 | `node tools/agent/gate.mjs --bundle-check`   | > previous + 2%            |

**Thresholds:**
- screenshot diff default: 0.5% pixels changed for unmodified views; up to 100% for the intentionally-changed view (task declares it).
- bundle size: tracked in `tools/agent/baselines/bundle.json`, updated only by `perf` or `chore` tasks.

**Gate failure is not a retry-loop of the whole task.** The runner sends *only* the failure stderr + the current diff back to the model with prompt `prompts/fix.md`. Two attempts max.

### 3.4 The Critic

Second-pass review, modeled on a harsh Steam reviewer. Runs after gate passes.

Inputs: the applied diff, the intentionally-changed screenshots, the task's `acceptance` lines.

Output JSON:

```json
{
  "severity": "pass" | "warn" | "block",
  "findings": [
    { "kind": "visual" | "ux" | "correctness" | "style", "note": "...", "severity": "..." }
  ],
  "verdict_one_line": "..."
}
```

Rules:
- `block` → revert the commit, file becomes `needs_rework`.
- `warn` → commit allowed, findings written into task metadata for next curator pass.
- `pass` → clean ship.

The critic runs on the same local 27B by default. In Q5+ it may be upgraded to a multimodal local model (e.g. Qwen2-VL 7B) so that screenshot understanding is real rather than caption-based.

### 3.5 Release Job

Runs on schedule, not on demand. Reads `tools/agent/pending_changes/` and cuts versions:

| Trigger       | Channel | Action                                                 |
|---------------|---------|--------------------------------------------------------|
| every night   | nightly | tag `nightly-YYYYMMDD`, build Electron, archive artifact |
| Sunday 02:00  | weekly  | tag `0.Q.M.patch-rc`, run full Playwright              |
| biweekly      | patch   | promote latest green weekly to `0.Q.M.patch`           |
| monthly       | minor   | if milestone checklist complete, bump M                |
| quarterly     | major   | if quarter exit criteria met, bump Q                   |

Release job owns:
- Writing `src/version.js`
- Appending CHANGELOG from `pending_changes/` (then clearing it)
- Pushing tags (the only `git push` allowed)
- Triggering Electron / Tauri build
- Writing a `docs/release_notes/<version>.md`

### 3.6 Curator

Runs independently of the runner, typically daily.

Responsibilities:
- Expand tasks whose `needs_split` flag is set.
- Re-prioritize by quarter theme.
- Move `needs_rework` tasks back to READY once the blocker is addressed.
- Prune `done` tasks older than 30 days from `queue.json` (they stay in the log).
- Generate content-quarter tasks from templates (Q5 onward).

The curator may itself be a 27B invocation with a different prompt (`prompts/curator.md`). It never applies code changes — only mutates `queue.json`.

### 3.7 Prompt Templates (skeleton)

`prompts/feature.md`:

```
You are the Noctune build agent. Execute the task below under the rules of
docs/ROADMAP_2Y.md Part I §2–§7.

Task: {{task.slice}}
Files you may edit: {{task.files_allowed}}
Files for reference: {{task.files_reference}}
Acceptance:
{{#each task.acceptance}}- {{this}}
{{/each}}

Current file contents follow. Output a single unified diff. No prose, no
backticks, no commentary. If this task cannot be completed within the file
budget, output exactly: ABORT_NEEDS_SPLIT

=== FILES ===
{{files_content}}
```

Every prompt template ends with the same contract: unified diff or a named
abort sentinel. Parsing is rigid. Free-form replies are rejected and retried
once with the reminder prefixed.

### 3.8 Model Invocation

Ollama HTTP example (adapt to llama.cpp server if preferred):

```
POST http://localhost:11434/api/generate
{
  "model": "gemma3:27b",
  "prompt": "<rendered template>",
  "stream": false,
  "options": {
    "temperature": 0.15,
    "top_p": 0.9,
    "num_ctx": 24576,
    "num_predict": 4096,
    "stop": ["\n=== END_DIFF ===\n", "ABORT_NEEDS_SPLIT\n"]
  }
}
```

Notes for 27B operation:
- Keep `num_ctx` ≤ 24k. Degradation past that is severe on 27B.
- `temperature` 0.15 for code tasks, 0.5 for content generation, 0.8 for quest flavor text.
- Always send a system prompt anchoring the manual. Never rely on the model remembering rules across calls.
- Stream=false for deterministic logging. Runner logs full prompt + full response.

### 3.9 Observability

`tools/agent/dashboard.html` is a static page rebuilt after every commit. It shows:

- Task throughput (7d / 30d)
- Revert rate (blocker rate from critic)
- Average slice size (LOC / task)
- Gate stage failure histogram
- Screenshot diff heatmap per baseline view
- Days since last green weekly
- Milestone progress from CHECKLIST_2Y.md
- Bundle size trend
- Top 10 READY tasks

The dashboard is your mirror. The human checks it weekly.

---

## Part IV — Eight-Quarter Roadmap

Each quarter has: **theme**, **entry criteria** (must be true before starting), **exit criteria** (must be true to tag the quarter), **milestone** (the one thing that defines success), **content backlog** (LLM chews on between milestone tasks), **risks**, and **rollback plan** if the quarter slips.

### Q1 — Foundations for Autonomous Operation (2026-04 → 2026-06)

**Theme:** Make the agent loop safe and boring.

**Entry criteria:**
- Existing repo green on `main` for 3 consecutive nightly builds.
- Operator has confirmed the 27B model is available at `MODEL_URL`.

**Milestone:** 14 consecutive nightly builds succeed without human fixes.

**Exit criteria:**
- Queue, runner, gate, critic, release, curator all present in `tools/agent/`.
- `docs/CHECKLIST_2Y.md` ticked through the Q1 section.
- Dashboard renders.
- Visual regression baseline exists for ≥ 15 views.

**Backlog highlights:** (full list in CHECKLIST_2Y.md)
- Queue schema + IO
- Runner with the state machine in §2
- Gate stages 1–8
- Text-only critic (multimodal upgrade deferred to Q5)
- Playwright smoke suite: load, spawn, drive, fire, hack, build, save, load, reload
- Screenshot diff via pixelmatch
- Dashboard scaffold

**Risks:** pipeline bugs revert real work → mitigate by shipping no gameplay changes this quarter.

**Rollback plan:** if pipeline not green by week 10, pause the gameplay quarters, extend Q1 until stable. Do not compress later quarters.

**Tag:** `0.1.0.0`.

### Q2 — Playability Pass 1 (2026-07 → 2026-09)

**Theme:** Close the "still not playable" gaps from the 2026-03-30 audit.

**Entry criteria:** Q1 exit met.

**Milestone:** 15-minute unguided playtest produces a completed objective with no hard crash.

**Exit criteria:**
- Tutorial / first-objective prompt appears on new game.
- Combat has tracers, muzzle flash, crosshair, damage numbers toggle, hit markers.
- Stealth HUD eye icon is wired.
- Vehicle enter/exit has "press F" prompt + fade.
- R/C/I demand bars visible in God mode.
- NPC profiler overlay renders in hack mode.
- Perf harness validates 60fps on medium map + 120 NPCs on reference GPU.

**Tag:** `0.2.0.0`.

### Q3 — Physics + Interiors Lite (2026-10 → 2026-12)

**Theme:** World reacts to force; some buildings open up.

**Entry criteria:** Q2 exit met; perf headroom ≥ 20% (per harness).

**Milestone:** Player enters ≥ 3 interior types (shop, safehouse, subway) and interacts with physics props inside.

**Exit criteria:**
- Rapier (WASM) integrated with deterministic step.
- Loose props (cones, trash cans, signs, chairs) fall and roll correctly on 3 ground materials.
- Ragdoll first-pass on NPC death (3-bone blend into spawn pose within 1.5s).
- Breakable glass shader + particle.
- 3 hand-authored interior templates picked by the growth sim.
- Save/load survives interior entry and physics state restore.

**Tag:** `0.3.0.0`.

### Q4 — Combat & AI Depth (2027-01 → 2027-03)

**Theme:** Enemies worth fighting.

**Entry criteria:** Q3 exit met; ragdoll stable; physics determinism verified.

**Milestone:** A 5-wave hostile encounter with cover, flanking, and retreat AI is survivable and fun.

**Exit criteria:**
- Cover system (tagged edges + dynamic cone).
- Behavior tree rewrite: ambient → alerted → engaged → flee/call-backup → surrender.
- Weapon tier-2: recoil curve per weapon, ADS, hipfire spread, ammo HUD.
- Police response upgrade: roadblocks, helicopter spotlight, spike strips.
- Vehicle damage model: progressive deformation via decimated mesh bends.
- First-year review with operator.

**Tag:** `0.4.0.0`.

### Q5 — Content Engine (2027-04 → 2027-06)

**Theme:** The agent authors content faster than the operator could.

**Entry criteria:** Q4 exit met; content templates in `tools/agent/templates/` exist (filled during Q1–Q4 as low-priority work).

**Milestone:** 50 new buildings, 30 vehicles, 20 NPC archetypes, 15 missions, all agent-authored, all passing validator, all playable.

**Exit criteria:**
- Content template schemas frozen.
- Content generator prompts + validators for each type.
- Low-priority content queue auto-tops up when milestone backlog empty.
- District flavor variants (docks, industrial, suburbs, old-town) placed procedurally.
- Multimodal critic upgrade complete (Qwen2-VL 7B or equivalent).

**Tag:** `0.5.0.0`.

### Q6 — Hacking Depth (2027-07 → 2027-09)

**Theme:** The city is a weapon.

**Entry criteria:** Q5 exit met.

**Milestone:** A stealth-hacking mission completable with zero gunfire.

**Exit criteria:**
- Camera-to-camera traversal implemented.
- Profiler UI shows income, criminal record, relationships, schedule.
- Hack chains: steam → crane → drop kill.
- In-combat hacks: grenade detonation, comms jam, weapon jam.
- Radial hack menu replaces keyboard-only prompts.

**Tag:** `0.6.0.0`.

### Q7 — Narrative & Audio (2027-10 → 2027-12)

**Theme:** It feels like a game, not a tech demo.

**Entry criteria:** Q6 exit met; mission editor schema defined.

**Milestone:** A 6-mission authored arc with named characters, locally-TTS voiced dialogue, and a resolution.

**Exit criteria:**
- Cinematic camera system (author-scriptable shots).
- Local TTS (Piper or XTTS) pipeline wired; agent picks voices per archetype.
- Procedural music extended; ≥ 3 radio channels with DJ banter templates.
- Mission editor schema referenced by agent-authored quests.
- Subtitle system with accessibility options.

**Tag:** `0.7.0.0`.

### Q8 — Polish, Perf, 1.0 RC (2028-01 → 2028-04)

**Theme:** Ship a version people would actually play for 10 hours.

**Entry criteria:** Q7 exit met; operator + ≥ 3 external playtesters lined up.

**Milestone:** External testers complete a 2-hour session without hard crash or softlock.

**Exit criteria:**
- Perf pass: frustum culling audited, LOD tuned, draw calls reduced ≥ 20%, GC audited.
- Accessibility: rebindable keys, subtitles, colorblind palettes, camera shake toggle, reduced-motion.
- Save migration tests cover every minor version since 0.1.
- Steam depot upload works end-to-end; achievements plumbed; cloud saves tested.
- Post-launch patch pipeline rehearsed.

**Tag:** `1.0.0-rc.1` mid-quarter, `1.0.0` end of April 2028.

---

## Part V — Version and Release Policy

### 5.1 Scheme

`0.Q.M.patch` during pre-1.0, then `1.MAJOR.MINOR.PATCH` semver after.

- `Q` = quarter number (0–8 during this plan)
- `M` = milestone index within the quarter (resets each quarter)
- `patch` = biweekly patch index within the minor

Examples: `0.1.0.0` end of Q1; `0.4.2.3` = Q4 second milestone, third patch.

### 5.2 Promotion Rules

- **nightly → weekly:** 7 consecutive nightlies green AND full Playwright passes.
- **weekly → patch:** weekly green for 2 weeks AND no open P0 bug AND critic regressions = 0.
- **patch → minor:** all items in the current quarter milestone section of CHECKLIST_2Y.md ticked.
- **minor → major:** quarter exit criteria all true AND operator approves via `tools/agent/approvals/qN.json` containing `{approved: true, date: ...}`.

### 5.3 Artifact Matrix

| Channel | Electron .exe | Tauri .msi | Web preview | Source zip | Steam depot |
|---------|---------------|------------|-------------|------------|-------------|
| nightly | yes           | no         | yes         | no         | no          |
| weekly  | yes           | yes        | yes         | yes        | no          |
| patch   | yes           | yes        | yes         | yes        | internal    |
| minor   | yes           | yes        | yes         | yes        | beta branch |
| major   | yes           | yes        | yes         | yes        | default     |

### 5.4 CHANGELOG Policy

Each task writes a snippet to `tools/agent/pending_changes/<task-id>.md`:

```
type: feat
area: ui
summary: R/C/I demand bars in God-mode HUD
details: shows R, C, I demand with thresholded colors. Updates every 30 frames.
task: q2-hud-demand-bars
```

Release job aggregates, sorts by `area` then `type`, and prepends to `CHANGELOG.md`.

---

## Part VI — Anti-Patterns, Recovery, Escalation

### 6.1 Anti-Patterns (hard bans)

1. **Long-horizon refactors.** Any task touching > 5 files is rejected by curator.
2. **"Improve graphics" tickets.** Must name a specific shader, material, or model.
3. **Unbounded test runs.** Gate Playwright subset is hard-capped at 90s.
4. **Multiplayer + singleplayer in one task.** Split.
5. **Silent failure.** Every runner invocation writes a transcript.
6. **Fabricated imports.** If the file you import doesn't exist, gate fails. Do not create stub files to satisfy imports — structure the task correctly instead.
7. **Commit messages that advertise the model or the tool.** Keep them code-focused.
8. **Editing generated files.** `build/`, `dist-electron/`, `playwright-report/`, `test-results/` are output dirs.
9. **Regex patches to JSON/YAML.** Always parse, mutate, reserialize.
10. **Removing tests that fail** instead of fixing the code. Only a `test` task may remove a test, and it must document why.

### 6.2 Recovery Procedures

| Failure                         | Recovery                                                          |
|---------------------------------|-------------------------------------------------------------------|
| Gate lint fails                 | Retry once with stderr. Second failure → revert, `needs_rework`.  |
| Gate test fails                 | Same.                                                              |
| Gate screenshot diff too high   | Revert. The intent field must list the view; if it's listed, re-baseline via a dedicated `chore(baseline)` task — NEVER in the original task. |
| `git apply` conflict            | Abort task; curator re-examines.                                  |
| Invalid unified diff            | Retry once with strict prompt; else abort.                        |
| Model produces `ABORT_NEEDS_SPLIT` | Set task status, write reason, move on.                         |
| Vite/Playwright port in use     | Kill only ports 4173–4176 and 5173, and only if PID matches a node process from this repo.|
| Model hangs > 5 min             | Runner kills request, retries once, then aborts.                  |
| Dashboard render fails          | Non-fatal; log and continue.                                      |
| Release build fails             | Do NOT auto-revert the code; open an issue in `tools/agent/incidents/` and wait for operator. |

### 6.3 Escalation — When to Stop and Wait

Stop the autonomous loop and write `tools/agent/incidents/YYYY-MM-DD-<slug>.md` if any of:

- Three consecutive task reverts in < 2 hours.
- Gate has been red for > 24 hours.
- A task needs a dependency change (new npm package).
- A task needs a file *outside* `files_allowed` that the curator won't add automatically.
- A `main` branch commit by the human appears while you're mid-task.
- Disk space on the build drive drops below 5 GB.
- The model returns safety refusals on three attempts.

Incident file format:

```
---
date: YYYY-MM-DD
task: <id>
severity: block | warn
---

# What happened

<2–4 sentences>

# What I tried

- ...

# What I need from the operator

- ...
```

The runner must pause until the incident is marked resolved.

---

## Part VII — Manual Self-Maintenance

This manual and the checklist drift from reality if you never update them. Updates are allowed only under a `meta` task. Rules:

1. A `meta(manual)` task may edit `docs/ROADMAP_2Y.md`.
2. A `meta(checklist)` task may edit `docs/CHECKLIST_2Y.md`.
3. Neither task may edit `src/` in the same commit.
4. A `meta` task requires explicit operator approval when it changes:
   - Any Part I rule
   - Any quarter's entry/exit criteria
   - The version scheme
5. A `meta` task does **not** need approval when it:
   - Ticks checklist items (that already happens inline at commit time)
   - Fixes typos
   - Adds examples
   - Records a retrospective at quarter boundaries

Retrospective template (append to end of this file at quarter end):

```
## Retrospective — QN (DATE)

What went well:
- ...

What didn't:
- ...

Rules changed:
- ...

Next quarter adjustments:
- ...
```

End of manual. See [CHECKLIST_2Y.md](CHECKLIST_2Y.md) for the actionable tracking artifact.
