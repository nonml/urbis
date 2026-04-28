# 2-Year Development Manual (2026-04 → 2028-04)

> **You are the sole creator of this game.** This manual is your institutional memory — the vision, the craft standards, the architecture, and the roadmap. Read it before you write a single line.

This document defines:

- **Part 0** — the game's vision, design pillars, and emotional targets
- **Part I** — how a session flows, how to pick and execute a task
- **Part II** — codebase map, architecture, and conventions
- **Part III** — the autonomous pipeline (Roo Code driven)
- **Part IV** — the fourteen-quarter roadmap (originally eight; extended after the 2026-04-28 pace recalibration)
- **Part V** — version scheme and release policy
- **Part VI** — anti-patterns, recovery, escalation
- **Part VII** — how to maintain this manual
- **Part VIII** — concrete craft playbooks per task type

The **checklist** (`CHECKLIST_2Y.md`) is what you work from. This **manual** is what you work by.

---

## Part 0 — Vision, Pillars, and Taste

### 0.1 What the game Is

the game is a **living city simulator** where the player is a ghost in the machine. It sits at the intersection of three genres:

- **Cities: Skylines** — systemic city growth, zoning, economy, transit. The city breathes without the player's hand.
- **Watch Dogs** — the city is an instrument. Hacking is power, expression, and consequence. Every connected object is a tool.
- **GTA** — player freedom, chaos, vehicles, combat, heat, factions. The world reacts to who you are and what you've done.

The game is not finished. It is approximately 20–30% of what it needs to be. The gap between where it is now and where it needs to go is large. That is fine — every great game started as a rough sketch. The job is to close that gap with patience, craft, and clear priorities.

### 0.2 Five Design Pillars

Every feature you ship must serve at least one of these. If it serves none, it does not belong.

**1. The city lives without the player.**
Zones grow. Factions conflict. Citizens have schedules. The economy shifts. Traffic follows demand. This should all happen regardless of what the player does. The player is a participant in a world that existed before them and continues after.

**2. Hacking is expression, not a button press.**
Every hack must have a visible, satisfying cause-and-effect. The world must visibly change. Traffic lights turn green — cars accelerate and collide. A steam pipe explodes — NPCs scatter, police respond, the district goes dark. The player should feel like a conductor.

**3. Consequence cascades through systems.**
Shoot a cop → heat rises → more patrols → citizens avoid the area → district economy dips → faction opportunity opens. The game should remember what the player did and make the world respond in kind. No action should be consequence-free.

**4. The player always feels capable.**
Controls are tight. Feedback is immediate. Every input produces a clear, readable output. The player never feels cheated. Failure should feel earned, not arbitrary.

**5. Systemic depth over scripted spectacle.**
Prefer systems that interact emergently over set-pieces that run once. A robbery mission that uses the traffic light hack, the police response system, and the vehicle physics is better than a scripted car chase cutscene.

### 0.3 Emotional Targets

These are the feelings the finished game should produce. Use them to evaluate whether a feature is good.

| Moment | Target feeling |
|--------|----------------|
| First five minutes | Curiosity — what is this city? What can I do? |
| First hack | Power — I control this place |
| First police chase | Exhilaration + urgency |
| Building a district | Satisfaction + ownership |
| Watching your city grow overnight | Pride |
| Getting caught after a long stealth run | Fair defeat — I made a mistake |
| Executing a complex hack chain | Flow — mastery |

### 0.4 Current State Honestly

The game has strong systemic bones: economy, factions, intel, politics, quests, hacking, vehicles, combat, stealth, weather, zoning, transit. Most systems exist and work.

The original 2-year plan was sized for a single human contributor. Actual throughput under autonomous operation has been roughly **1 quarter every 4–5 days**, ~20× the original budget. As of 2026-04-28: **Q1–Q5 are complete and tagged, Q6 is one definition-of-done check away from tag**, and the systemic foundations the original plan deferred to year 2 are already shipped.

What this changes: the gaps that matter now are **fidelity, performance, and depth**, not feature breadth. Materials are inconsistent. The renderer leans on 2018-era post (FXAA, basic SSAO, no TAA, no CSM, no SSR, no volumetrics, no GI). Draw calls and per-frame allocations have not been audited at scale. NPC density and verticality are conservative because the renderer can't carry more.

The roadmap has been **extended** to absorb that headroom: Q7–Q8 ship the original narrative + 1.0 polish targets on the new compressed cadence, then **Q9–Q14** are net-new — two graphics passes, two optimization passes, a city-depth pass, and a final 1.0 launch quarter. Trust the new shape; do not re-pad earlier quarters.

---

---

## Part I — Operating Manual

### 1. Identity and Scope

You are the **sole developer** of this game. A local model (Qwen 35B-A3B, or equivalent) running via Roo Code. You run continuously and periodically ship versioned releases of a Three.js / Vite city-builder + open-world action game at `c:\Users\nonta\Desktop\game`.

**In scope:** every path under this project directory.
**Out of scope:** everything outside it. Never touch `C:\Users\nonta\` subtrees other than `.claude/projects/c--Users-nonta-Desktop-game/memory/` (auto-memory) and this repo. Never kill processes you did not start. Never write Windows registry or environment variables.

**Human operator:** Nontawat (`nontawatsrilert@gmail.com`). Treated as PM + end user + QA. Never asks you to choose between technical defaults — you pick and state the next moves.

### 2. Session Lifecycle

Every Roo session follows this exact flow. Do not skip steps. Do not reorder them.

```
┌─ BOOT ──────────────────────────────────────────────────────────┐
│ 1. Read docs/ROADMAP_2Y.md (this file)                          │
│ 2. Read docs/CHECKLIST_2Y.md — find first unchecked [ ] item   │
│ 3. Print: [boot] next=<item-id>  open=<N remaining>             │
│ 4. Read git status                                              │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ PLAN ──────────────────────────────────────────────────────────┐
│ 5. Determine task type from item-id prefix (§3 table below)     │
│ 6. Read one existing example of the pattern you're implementing │
│ 7. Write 3-line plan: which files, what change, what test       │
│ 8. If scope exceeds task-type limits: split into two items,     │
│    add them to CHECKLIST, abandon this one with [~] note.       │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ EXECUTE ───────────────────────────────────────────────────────┐
│ 9. Make changes. Touch only files within task-type limits.      │
│ 10. Run gate: lint:basic → check:no-math-random → validate →    │
│     npm test — all must exit 0.                                 │
│ 11. On gate fail: fix root cause, retry up to 2×. No bypassing. │
│ 12. Visual task: capture screenshot, self-critique as harsh     │
│     Steam reviewer. Fix issues before continuing.               │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ COMMIT ────────────────────────────────────────────────────────┐
│ 13. Stage only changed files by name. Never `git add -A`.       │
│ 14. Commit with message template (Part I §6).                   │
│ 15. Tick matching item in CHECKLIST_2Y.md from [ ] to [x].      │
│ 16. Print: [done] <item-id>. Push is NOT automatic.             │
└─────────────────────────────────────────────────────────────────┘
```

**Never advance past a step whose exit condition you cannot prove.** If lint fails, do not commit "anyway". If the screenshot diff is above threshold, do not handwave it — revert.

### 3. Task Types

Every checklist item has a `type` encoded in its ID prefix. The type determines the allowed file set, max scope, and acceptance criteria.

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

Anything bigger than "refactor" must be **split before starting**. If a task's natural scope exceeds these limits, add two smaller items to the checklist and abandon the oversize one.

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
- `tools/agent/` — agent support files. `logs/` (gitignored) for session notes.
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

Every commit follows this shape. CHANGELOG tooling parses it, so the format is rigid.

```
<type>(<area>): <imperative summary under 72 chars>

Why: <one or two sentences explaining the change>
Checklist: <checklist item id(s) ticked, comma-separated>

Co-Authored-By: local-agent-World <agent@noctune.local>
```

Valid `<type>`: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `content`, `hud`.
Valid `<area>`: top-level `src/` directory name, or `agent`, `pipeline`, `meta`.

Do **not** include model name, temperature, or prompt in the commit.

### 7. What You Must Never Do

- Push to `main` directly. Release job owns pushing.
- Use `--no-verify` on commits. Hooks are there for reasons.
- Use `git reset --hard`, `git clean -fd`, or delete untracked files.
- Touch `C:\Users\nonta\` paths outside this repo and the memory directory.
- Kill processes on ports 4173–4176 or 5173 without confirming they belong to this project.
- Call any cloud LLM API. You are a local model. External inference would violate the "runs continuously on one machine" constraint the operator chose this plan for.
- Modify `package.json` dependencies without a `chore(deps)` checklist item.
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

**Roo Code is the runner.** There is no separate Node process. When you receive `go`, Roo reads `.roo/rules/`, finds the first `[ ]` in `CHECKLIST_2Y.md`, edits files natively, runs gate commands via its terminal, commits, ticks the item, and loops. No extra wiring.

### 3.1 How Roo Executes a Task

`.roo/rules/` files are loaded on every message. The loop:

```
1. Read CHECKLIST_2Y.md — find first [ ] item
2. Read one existing example of the pattern (context ≤ 64k tokens total)
3. Edit files natively
4. Run gate (§3.2) — all must exit 0
5. Self-review as harsh Steam reviewer (§3.3)
6. Commit + tick checklist item [x]
7. Return to step 1
```

See `.roo/rules/01-noctune-agent.md` for the binding 10-step per-task protocol.  
See `.roo/rules/02-loop-protocol.md` for the session-level loop.

### 3.2 The Gate

Sequential, fail-fast. All must exit 0 after every task.

| # | Command                           | Fail if   |
|---|-----------------------------------|-----------|
| 1 | `npm run lint:basic`              | exit ≠ 0  |
| 2 | `npm run check:no-math-random`    | exit ≠ 0  |
| 3 | `npm run validate`                | exit ≠ 0  |
| 4 | `npm test`                        | exit ≠ 0  |

On failure: diagnose root cause, fix, retry. Max 2 retries. Still failing → revert the edit, mark the checklist item `[~]` with a note, move to next item.

Full Playwright (`npm run test:e2e`) runs weekly only — too slow for every task.

### 3.3 Self-Critique Before Committing

After the gate passes, review your own work as a harsh Steam reviewer:

- Does the feature actually do what the checklist item asked?
- Does the code follow Part I §5 conventions?
- Any visible bugs, missing edge cases, or performance traps?

If you find a blocker: revert, mark item `[~]` with a one-line note. Move on.

### 3.4 Release

Release is triggered manually by the operator.

1. Bump `src/version.js` with a `chore(meta)` commit
2. Update `CHANGELOG.md` with a summary of the quarter's shipped items
3. Write `docs/release_notes/<version>.md`
4. Tag: `git tag 0.Q.M.0`
5. Operator pushes the tag manually (`git push --tags`)

---

## Part IV — Fourteen-Quarter Roadmap

Each quarter has: **theme**, **entry criteria** (must be true before starting), **exit criteria** (must be true to tag the quarter), **milestone** (the one thing that defines success), **content backlog** (LLM chews on between milestone tasks), **risks**, and **rollback plan** if the quarter slips.

### Pace Note (2026-04-28 recalibration)

The original Part IV was eight quarters across 2026-04 → 2028-04, sized for human-paced solo development. Autonomous operation is running at roughly **20× that budget** (one quarter every 4–5 days). Rather than declare the plan finished early and float, the timeline was **extended in place**: dates for Q1–Q8 are recalibrated to actual cadence, and **six new quarters (Q9–Q14)** were added covering graphics fidelity, optimization, world depth, and the genuine 1.0 launch.

Recalibrated calendar (target dates, not commitments):

| Q  | Theme                                | Original window           | Actual / planned window     | Tag       |
|----|--------------------------------------|---------------------------|-----------------------------|-----------|
| Q1 | Foundations for autonomous operation | 2026-04 → 2026-06         | 2026-04-01 → 2026-04-04 ✅  | `0.1.0.0` |
| Q2 | Playability pass 1                   | 2026-07 → 2026-09         | 2026-04-05 → 2026-04-09 ✅  | `0.2.0.0` |
| Q3 | Physics + interiors lite             | 2026-10 → 2026-12         | 2026-04-10 → 2026-04-15 ✅  | `0.3.0.0` |
| Q4 | Combat & AI depth                    | 2027-01 → 2027-03         | 2026-04-16 → 2026-04-19 ✅  | `0.4.0.0` |
| Q5 | Content engine                       | 2027-04 → 2027-06         | 2026-04-20 → 2026-04-23 ✅  | `0.5.0.0` |
| Q6 | Hacking depth                        | 2027-07 → 2027-09         | 2026-04-24 → 2026-04-29     | `0.6.0.0` |
| Q7 | Narrative & audio                    | 2027-10 → 2027-12         | 2026-04-30 → 2026-05-15     | `0.7.0.0` |
| Q8 | Playability pass 2 (was "1.0 RC")    | 2028-01 → 2028-04         | 2026-05-16 → 2026-06-05     | `0.8.0.0` |
| Q9 | **Graphics pass 1 — modern rendering**   | —                     | 2026-06-06 → 2026-08-01     | `0.9.0.0` |
| Q10| **Graphics pass 2 — surfaces & detail**  | —                     | 2026-08-02 → 2026-09-30     | `0.10.0.0`|
| Q11| **Optimization pass 1 — render pipeline**| —                     | 2026-10-01 → 2026-11-30     | `0.11.0.0`|
| Q12| **Optimization pass 2 — memory & streaming**| —                  | 2026-12-01 → 2027-01-31     | `0.12.0.0`|
| Q13| **Living city depth — verticality, density** | —                 | 2027-02-01 → 2027-05-31     | `0.13.0.0`|
| Q14| **1.0 RC, external playtest, launch**| —                         | 2027-06-01 → 2027-12-31     | `1.0.0`   |

The "2-year manual" name is preserved for git/operator continuity even though the calendar now stretches ~21 months from start. If actual pace stays at 4–5 days per quarter, Q14 lands much earlier and post-1.0 content (DLC, modding API, localization) becomes Q15+. Do not re-plan that yet.

**Re-baselining rules.**
- Q1–Q6 sections below show **original windows** for archival reasons. Their entry/exit criteria were already met; do not re-litigate.
- Q7+ sections use the new windows.
- A quarter is "in flight" once any of its `[ ]` items is `[~]`. Until then it's "queued".
- The exit criteria, milestone, and tag for any past quarter are frozen. Only the dates were changed.

### Q1 — Foundations for Autonomous Operation (2026-04 → 2026-06)

**Theme:** Make the agent loop safe and boring.

**Entry criteria:**
- Roo Code configured: provider = llama.cpp, context ≤ 64k, auto-approve on file ops + gate commands.
- All 4 gate commands pass on current `main`.

**Milestone:** 14 consecutive Roo-driven task cycles complete without human intervention.

**Exit criteria:**
- All 4 gate commands pass every cycle.
- Playwright smoke suite covers ≥ 15 scenarios and all pass.
- Screenshot baselines captured for ≥ 15 views.
- `docs/CHECKLIST_2Y.md` ticked through the Q1 section.

**Backlog highlights:** (full list in CHECKLIST_2Y.md)
- Gate health verification (all 4 commands green)
- Playwright smoke suite: load, spawn, drive, fire, hack, build, save, load, reload
- Screenshot baselines for all key views
- Dashboard scaffold (static HTML Roo writes and the operator checks weekly)

**Risks:** Roo drifts or halts on edge cases → do not ship gameplay changes until Q1.A–Q1.B are green.


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

### Q7 — Narrative & Audio (2026-04-30 → 2026-05-15)

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

### Q8 — Playability Pass 2 (2026-05-16 → 2026-06-05)

**Theme:** Re-walk the player loop end-to-end with everything Q1–Q7 added.

**Entry criteria:** Q7 exit met. Narrative arc shippable.

**Milestone:** A blind playtester completes the 6-mission arc + at least one zero-gunfire stealth-hack mission in one sitting (≤ 3h, no hard crash, no softlock).

**Exit criteria:**
- Tutorial path validated against every weapon, hack, and vehicle added since Q2.
- Difficulty pass: combat, stealth, and economy curves smoothed (no spikes, no flat sections).
- Quest validator covers every mission in the arc plus 5 generated side-quests.
- Save format frozen at `schemaVersion = 8`; migrations from `0.1.x` → `0.8.x` tested.
- Crash budget: zero uncaught errors across a 3-hour scripted Playwright playthrough.
- Bundle size growth ≤ 10% versus `0.7.0.0` (post-narrative bloat checked).

**Tag:** `0.8.0.0`. **This is not 1.0 anymore** — 1.0 moves to Q14, after the graphics, optimization, and depth quarters.

### Q9 — Graphics Pass 1: Modern Rendering Foundation (2026-06-06 → 2026-08-01)

**Theme:** The frame buffer should look like 2026, not 2018.

**Entry criteria:** Q8 exit met. Perf harness baseline captured at `0.8.0.0` for every reference scene — every Q9 task must compare against that baseline, not against itself.

**Milestone:** Side-by-side screenshots of `street-noon`, `street-night`, `rain`, and `interior-shop` versus the `0.8.0.0` baseline are unmistakably better in materials, shadows, and lighting — and the perf harness shows ≤ 15% frame-time regression on the reference GPU at the new "Quality" preset (and zero regression at the new "Performance" preset, which becomes the default).

**Exit criteria:**
- **Material audit:** every shipped mesh uses `MeshStandardMaterial` or `MeshPhysicalMaterial` with declared `roughness`, `metalness`, and (where appropriate) `clearcoat`. No `MeshLambert`, no `MeshPhong`, no `MeshBasic` outside HUD/sky billboards.
- **HDR pipeline:** `WebGLRenderer.toneMapping = ACESFilmicToneMapping`, `outputColorSpace = SRGBColorSpace`, render targets are `HalfFloatType` end-to-end. No double gamma.
- **Cascaded shadow maps:** 3-cascade CSM replaces the single `DirectionalLight.shadow` map, with per-cascade resolution budget and a soft PCF or PCSS filter.
- **Volumetric fog/lighting:** raymarched, half-res, sun-lit volumetrics that respond to weather density and night street-light cones.
- **Screen-space reflections (SSR):** stochastic SSR pass on wet roads, water, and metal materials, with a cheap fallback to env-probe reflections when SSR misses.
- **Bloom upgrade:** multi-mip thresholded bloom replacing the single-pass `UnrealBloomPass` parameters; per-scene exposure target.
- **Color grading LUT:** per-time-of-day LUT (dawn / day / dusk / night) blended by the day-night system, plus weather tint overlay.
- **Sky upgrade:** sun and moon disc with proper aerial perspective; star field visible at low light pollution; lightning flash is a proper exposure spike, not an alpha overlay.
- **Skylight env probe:** scene captures a low-res cube every N seconds for image-based lighting on metals and glass.
- Quality presets: `low / medium / high / ultra` defined; auto-detect picks based on first-frame timing.
- New screenshot baselines for all Q1.I views at the new default ("Performance") preset.

**Risks:** Three.js `three/addons` doesn't ship CSM or volumetrics out of the box — both will need bespoke shader passes. Budget one full task per pass for shader iteration. If browser GPU memory caps hit on a reference scene, drop the cube probe resolution before dropping shadow cascades.

**Tag:** `0.9.0.0`.

### Q10 — Graphics Pass 2: Surfaces, Detail, Atmosphere (2026-08-02 → 2026-09-30)

**Theme:** The world has texture, history, and weight. Surfaces tell stories.

**Entry criteria:** Q9 exit met. Material audit at 100%. Performance preset still on-budget.

**Milestone:** Walk a single block at noon, then in rain, then at night, and the city looks like three different places — not the same scene with different fog colors.

**Exit criteria:**
- **Decal system:** projected decals for puddles, oil stains, blood, scorch marks, posters, graffiti, tire skids, bullet impacts. Cap of N per chunk, LRU evicted.
- **Wet road shader:** per-tile wetness map driven by weather + drainage; proper Fresnel + roughness modulation; puddle decals receive SSR.
- **Vegetation system:** trees with vertex-shader wind sway, grass billboards (1 draw call per chunk via `InstancedMesh`), seasonal color tint, leaf-fall particles.
- **Water upgrade:** real-time planar reflections on canals/harbor, depth-based color absorption, surface foam at obstacles, caustics at shallow depths, wake from boats.
- **GPU particles:** rain/snow/sparks/smoke moved off CPU; transform feedback or compute-emulated; 50× the current count for the same frame budget.
- **TAA replaces FXAA:** temporal jitter, history reprojection, neighborhood clamp; FXAA stays as a fallback for "Performance" preset.
- **GTAO replaces SSAO:** ground-truth ambient occlusion at half-res with separable bilateral blur; SSAO retained as fallback.
- **Realtime GI:** light probe grid + irradiance volumes baked at chunk-load, dynamic-light deltas applied per frame. SDFGI or VXGI is out-of-scope for v1 — defer to post-1.0.
- **Subsurface scattering (lite):** wrap-shading on skin/foliage; cheap, no separable filter.
- **Anisotropic specular:** for road, hair, brushed metal vehicle paint.
- **Per-district art direction:** docks (greenish overcast), industrial (smoggy), suburbs (warm), old-town (saturated). Confirmed via screenshot diff.
- New screenshot baselines for all four district variants.

**Risks:** TAA ghosting on fast-moving NPCs and tracers; budget a tuning task per artifact class. Decal counts scale with combat duration — cap and prune aggressively.

**Tag:** `0.10.0.0`.

### Q11 — Optimization Pass 1: Render Pipeline (2026-10-01 → 2026-11-30)

**Theme:** 60 fps at "High" preset on a midrange laptop GPU. No exceptions.

**Entry criteria:** Q10 exit met. Perf harness shows where every millisecond goes.

**Milestone:** Reference scene `medium+120-NPCs+rain+night` runs ≥ 60 fps at "High" on the reference GPU, with a sustained 16 ms frame budget split documented per pass.

**Exit criteria:**
- **WebGPU evaluation:** spike branch tested on Chromium-stable; decision recorded — go / wait-for-three / no. If go, port the easy wins (compute particles, GPU culling) and leave the rest for Q12.
- **GPU-driven culling:** Hi-Z occlusion + frustum culling for buildings, vehicles, NPCs, and props. CPU does coarse cull, GPU does the fine pass.
- **Mesh LOD system:** 4-tier LODs (LOD0 hero, LOD1 mid, LOD2 silhouette, LOD3 imposter) for buildings, vehicles, characters. Imposters generated at build time.
- **Instancing audit:** every mesh duplicated more than 8× across a scene moves to `InstancedMesh` or `BatchedMesh`. New CI check counts non-instanced duplicates.
- **Texture atlas + array textures:** material count cut ≥ 50% by atlasing per category.
- **Uber-shader audit:** shader permutation count audited; defines collapsed where they branch on flags vs. types.
- **Dynamic resolution scaling (DRS):** when frame time exceeds budget, render at 0.85× for one frame, ramp back; bounded by user-set min.
- **Render graph:** explicit pass ordering with dependency tracking; no implicit `renderTarget` mutation across passes.
- **Draw-call budget:** ≤ 2000 draws on `medium+120-NPCs`, ≤ 3000 on `large+200-NPCs`. CI fails on exceedance.
- **VRS (variable rate shading):** opt-in for "Performance" preset on supported hardware; sky and out-of-focus regions render at 2×2.
- New `tools/agent/baselines/perf.json` schema includes per-pass timings, not just frame time.

**Risks:** WebGPU still maturing in Three.js; budget the spike to 5 days, not the full quarter. GPU culling needs scene authoring discipline — every new system added in Q9–Q10 must register its meshes for culling before Q11 audit, or it gets flagged.

**Tag:** `0.11.0.0`.

### Q12 — Optimization Pass 2: Memory, CPU, Streaming (2026-12-01 → 2027-01-31)

**Theme:** The game stays smooth across long sessions, big maps, and slow disks.

**Entry criteria:** Q11 exit met. Render-side budgets locked. Profile shifts to CPU and memory.

**Milestone:** A 4-hour continuous session on the reference machine has flat memory usage (no upward drift), zero stalls > 33 ms after the first 30 seconds, and bundle initial-load < 2 MB gzipped.

**Exit criteria:**
- **Web Workers** for: pathfinding (already partial), NPC scheduling, faction sim tick, audio mixing, save serialization, and the asset decoder pool.
- **Asset streaming:** chunked load with LRU eviction; world chunks request and release on the streaming worker, never on the main thread.
- **Asset compression:** all textures shipped as KTX2 (Basis ETC1S/UASTC); all geometry via meshopt or Draco. Build-time only; runtime decode in the asset worker.
- **Audio compression:** Opus pipeline; per-stream bitrate budget; music lazy-loaded per district.
- **GC audit:** zero per-frame allocations in the tick loop, the render loop, and the input-handling path. CI check via heap-sampling smoke.
- **Object pool audit:** vehicles, NPCs, projectiles, particles, decals, ragdolls, FX. Pool capacity and high-water tracked per pool, surfaced in dev HUD.
- **Memory budget enforcement:** soft cap 2 GB on medium, 4 GB on huge. Streaming evicts earliest-LRU when 80% reached. Hard cap throws a recoverable error to the operator.
- **Bundle initial JS:** ≤ 2 MB gzipped via dynamic imports; `vite.config.js` `manualChunks` audited; everything that's not first-frame critical is lazy.
- **Save format:** msgpack (cbor-x or msgpackr); 100h synthetic save loads in < 5 s and round-trips deterministically.
- **Save migration speed:** no migration takes longer than 1 s per minor version step on the synthetic save.
- **Dev memory HUD:** per-pool counts, GC events/sec, JS heap size, GPU memory estimate.

**Risks:** Worker boundaries leak structured-clone overhead — measure before assuming a copy is free. KTX2 toolchain on Windows may need pre-built binaries; budget a chore task for the Basis toolchain install.

**Tag:** `0.12.0.0`.

### Q13 — Living City Depth (2027-02-01 → 2027-05-31)

**Theme:** With render and memory headroom recovered, spend it on density and verticality. The city stops being a flat board.

**Entry criteria:** Q12 exit met. Perf headroom ≥ 30% at "High" preset on the reference GPU.

**Milestone:** A peak-hour rooftop chase across three skybridges, through one interior, and into a subway tunnel runs at 60 fps with 200+ visible NPCs and 80+ vehicles in view, no streaming hitches.

**Exit criteria:**
- **Rooftop traversal:** parkour-lite climb/jump on tagged rooftop edges; player can reach any rooftop labeled "accessible" in metadata.
- **Skybridges:** procedural skybridge spans connecting tall buildings in dense districts; nav-mesh bakes them; NPCs use them.
- **Underground:** sewer + parking-garage + subway tunnel layers, with seamless entry from world.
- **Interior expansion:** 10 hand-authored interior templates (was 3) covering shops, safehouses, offices, clubs, warehouses, subway stations.
- **Crowd density:** 200+ visible NPCs at peak (was 120). LOD tiers used aggressively; behavior fidelity drops with distance.
- **Traffic density:** 80+ vehicles on visible roads (was conservative); spawner respects district zoning + time of day.
- **Vertical hacking:** camera-to-camera traversal works through windows; profiler reaches NPCs across floors.
- **Districts:** 8 distinct flavors (was 4); the four new ones are entertainment, government, transit-hub, waterfront-residential.
- **Photo mode upgrade:** depth of field, focal pull, free-cam roll, time-scrub.
- **Save schema bump for new world strata:** rooftop, underground, and interior coords coexist in one save.
- **Perf re-baseline:** every reference scene re-captured at the new density.

**Risks:** Density expansion is the single biggest perf pressure release valve and the biggest regression risk; treat every density bump as a perf task. Save schema migration for vertical world is non-trivial — sequence it before any new mission content lands.

**Tag:** `0.13.0.0`.

### Q14 — 1.0 RC, External Playtest, Launch (2027-06-01 → 2027-12-31)

**Theme:** Ship a game people play for 10 hours, give to a friend, and don't apologize for.

**Entry criteria:** Q13 exit met. Operator + ≥ 3 external playtesters lined up. No P0 bugs open. Crash budget at zero across the scripted 3-hour playthrough.

**Milestone:** External testers complete a 2-hour blind session without hard crash, softlock, or "what am I supposed to be doing" moments, and at least 2 of them return for a second session unprompted.

**Exit criteria:**
- **Final perf pass:** frustum-culling re-audited after Q13 density work; LOD thresholds re-tuned; draw calls ≤ 3000 on `large+200-NPCs+rain`; GC clean across 4-hour session.
- **Final shader cost audit:** SSAO/GTAO half-res, bloom mips, volumetrics step count — all cost-budgeted per preset.
- **Accessibility complete:** rebindable keys (everything), subtitles (size, speaker labels), 3 colorblind palettes, camera-shake toggle, reduced-motion mode, hold-vs-tap interact toggle, audio mixer per channel.
- **Save migration matrix:** every minor version `0.1.x` → `0.13.x` → `1.0` covered by a Playwright round-trip; 100h synthetic save round-trips clean.
- **Steam pipeline:** depot upload end-to-end; ≥ 30 achievements defined and trigger-tested; cloud saves tested across two installs; Steam Workshop wired for mods.
- **External playtest complete:** ≥ 3 testers, ≥ 2 sessions each; logs aggregated in `docs/playtests/`; zero hard crashes; zero softlocks; retrospective in `docs/retros/`.
- **Patch pipeline rehearsed:** at least one `1.0.0-rc.N → 1.0.0-rc.N+1` cycle executed end-to-end before tagging final.
- **Localization scaffold:** all UI strings extracted to a single i18n catalog; English is the only shipped language but the pipeline works for at least one second language as a smoke test.
- **Mod API documentation:** `docs/MODDING.md` published; one example mod ships in `assets/mods/example/`.
- **Release notes:** `docs/release_notes/1.0.0.md` complete and honest.

**Tags:** `1.0.0-rc.1` mid-quarter; up to two patch RCs allowed; `1.0.0` end of December 2027 (target — slip to early 2028 acceptable).

---

## Part V — Version and Release Policy

### 5.1 Scheme

`0.Q.M.patch` during pre-1.0, then `1.MAJOR.MINOR.PATCH` semver after.

- `Q` = quarter number (0–14 during this extended plan)
- `M` = milestone index within the quarter (resets each quarter)
- `patch` = biweekly patch index within the minor

Examples: `0.1.0.0` end of Q1; `0.4.2.3` = Q4 second milestone, third patch; `0.10.0.0` end of Q10 (not "0.1.0.0" — leading zeros are not stripped, the field is the integer quarter index).

Quarter-to-tag mapping (canonical): Q1 → `0.1`, Q2 → `0.2`, …, Q9 → `0.9`, Q10 → `0.10`, Q11 → `0.11`, Q12 → `0.12`, Q13 → `0.13`, Q14 → `1.0`.

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

---

## Part VIII — Craft Playbooks

These are concrete step-by-step guides for the most common task types, grounded in how this codebase actually works. Before writing anything, read the relevant playbook.

### 8.1 Adding a New Weapon

**Files involved:** `src/player/combat.js` only.  
**Pattern:** This codebase is data-first. A weapon is a declarative object — the combat system reads it. You do not subclass, you do not create a new file. You add one entry.

```js
// src/player/combat.js — inside WEAPONS = { ... }
railgun: {
  name: 'Railgun',
  damage: 120,          // one-shot most NPCs
  range: 40,            // longest range in the game
  fireRate: 3000,       // very slow — every 3 seconds
  ammo: 1,              // single charge
  maxAmmo: 3,
  heatGain: 35,         // risky to use near civilians
  type: 'ranged',
  spread: 0.0,          // perfect accuracy
  pellets: 1,
  soundRadius: 40,      // heard across a district
}
```

**Design judgment:** Every weapon must have a clear identity — a situation where it's the right choice and situations where it's wrong. The railgun is for long-range sniping from a rooftop. If you add a weapon that's just "better pistol," you've made the game worse.

**Self-check:** Can you describe in one sentence *when* you'd choose this weapon over all others?

---

### 8.2 Adding a New Hack

**Files involved:** `src/sim/world_hacks.js` (main logic), optionally `src/ui/hack_list.js` (UI entry).  
**Pattern:** A hack is a method that modifies world state and sets a cooldown. Effects are stored as `{ x, y, untilTick }` objects in arrays that `update()` processes each tick.

```js
// 1. Add the method
hackDisableStreetlights(x, y) {
  if (this._cooldowns.get('streetlights') > this._tick) return false;
  this._setCooldown('streetlights', this._tick, 60); // 60-tick cooldown
  // Find all streetlight tiles in radius 5
  const affected = this._findNodesInRadius(x, y, 5, 'STREETLIGHT');
  affected.forEach(node => {
    this._world.darkenedLights.push({ x: node.x, y: node.y, untilTick: this._tick + 90 });
  });
  return true;
}

// 2. Process in update()
this._world.darkenedLights = this._world.darkenedLights.filter(e => e.untilTick > this._tick);
```

**Design judgment:** A hack should create a *situation*, not just trigger an effect. Darkened streetlights mean NPCs can't see as well, stealth improves, police response degrades — that's interesting. A hack that just plays a particle effect is empty.

**Self-check:** After this hack triggers, is the world meaningfully different for the next 10–60 seconds?

---

### 8.3 Adding a HUD Element

**Files involved:** `src/ui/action_hud.js`, `src/style.css` (or the relevant CSS file).  
**Pattern:** HUD elements are DOM `div`s. They are created once in `_buildHUD()`, updated every render via `textContent` or `classList.toggle()`.

```js
// In _buildHUD()
this._stealthEye = document.createElement('div');
this._stealthEye.className = 'stealth-eye';
this._stealthEye.innerHTML = '<span class="eye-icon">👁</span><div class="detection-bar"><div class="detection-fill"></div></div>';
this._container.appendChild(this._stealthEye);

// In update(state)
const stealthState = state.player?.stealthState;
this._stealthEye.classList.toggle('on', stealthState !== undefined);
this._stealthEye.querySelector('.detection-fill').style.width =
  `${(state.player?.detectionLevel ?? 0) * 100}%`;
```

```css
.stealth-eye { opacity: 0; transition: opacity 0.3s; }
.stealth-eye.on { opacity: 1; }
.detection-fill { height: 100%; background: #e8a020; transition: width 0.1s; }
```

**Design judgment:** Every HUD element takes up space in the player's attention. Ask: does the player need to see this *right now*? Show elements contextually (only in street mode, only when in a vehicle, only when in combat). Use `.on` toggling not `display:none`.

**Self-check:** Does this element disappear when it's not relevant?

---

### 8.4 Adding a Playwright Smoke Test

**Files involved:** `tests/playwright/<new_spec>.spec.js`, possibly `playwright.config.js`.  
**Pattern:** Copy the structure of an existing passing spec. Add `@smoke` to the test name so it runs in the gate. Use `page.evaluate()` to read game state when DOM isn't enough.

```js
import { test, expect } from '@playwright/test';

test('@smoke stealth crouching reduces detection radius', async ({ page }) => {
  await page.goto('http://localhost:4173/');
  await page.waitForSelector('#game-container', { timeout: 10000 });

  // Start game
  await page.click('#start-btn');
  await page.waitForTimeout(2000);

  // Trigger crouch
  await page.keyboard.press('c');

  // Check stealth state via game internals
  const isCrouching = await page.evaluate(() => window.game?.player?.stealth?.isCrouching);
  expect(isCrouching).toBe(true);
});
```

**Design judgment:** Smoke tests catch regressions. Write them for things that break silently — state changes, system wiring, save/load. Don't write tests for visual things you can't assert programmatically.

**Self-check:** If someone deleted the feature this test covers, would the test fail?

---

### 8.5 Adding a New Building Type

**Files involved:** `src/buildings_extended.js` (definition), `src/constants.js` (if new terrain/type enum needed).  
**Pattern:** Buildings are declarative objects in `BUILDING_EXTENDED`. The renderer, the economy system, and the UI all read from this definition.

```js
// In BUILDING_EXTENDED
{
  id: 'crypto_exchange',
  name: 'Crypto Exchange',
  category: 'Commerce',
  tab: 'City',
  cost: { money: 3000, steel: 50, silicon: 30 },
  upkeep: 80,
  effects: {
    incomeBonus: 120,
    hackableData: true,      // shows as hackable node
    criminalAttraction: 0.3, // draws criminal faction attention
  },
  unlockAt: { population: 150 },
  icon: '💱',
  description: 'High-yield, high-risk financial node. Hackable for large money transfers.',
}
```

**Design judgment:** Every building should have a reason to exist in the simulation. Income + upkeep alone is not enough. Add one system hook that makes it interact with at least one other system (hackability, faction attraction, service bonus, transit effect).

**Self-check:** What happens to the city when this building exists vs when it doesn't?

---

### 8.6 Fixing a Bug

**Pattern:** Reproduce it, understand it, fix only what's broken.

1. **Reproduce:** Write the smallest Playwright test or script that triggers the bug consistently.
2. **Understand:** Read the relevant system — don't guess. Trace the data flow from trigger to symptom.
3. **Fix the cause, not the symptom.** Adding `if (!thing) return` without understanding why `thing` is null is not a fix.
4. **Verify:** Run the test. Run `npm test`. No regressions.
5. **Clean up:** If you touched code around the bug, leave it cleaner than you found it.

**The most common bugs in this codebase:**
- System wired but `tickOnce` not calling it (system exists but never runs)
- `sim/` code importing Three.js (caught by lint immediately)
- `Math.random()` call breaking determinism (caught by `check:no-math-random`)
- State mutation in render path causing flicker
- Missing null check on `world.citizens.get(id)` after an NPC despawns

---

### 8.7 Performance Work

**Never optimize without measuring.** Use `tests/perf_cert.cjs` and the browser profiler before and after.

**Known hot paths (as of 2026-04):**
- Character rendering: 120 detailed NPCs with skeletal animation
- SSAO half-res pass
- Zone growth sim (capped at 20 lots/tick)
- Traffic pathfinding (BFS per vehicle per tick)

**Pattern for perf tasks:**
1. Add a `performance.mark()` + `performance.measure()` around the suspected hot path
2. Record baseline numbers in 3 test runs
3. Make one targeted change
4. Record post-change numbers
5. Only commit if improvement is ≥ 10% with no visual regression

---

### 8.8 The Quality Bar — What "Done" Actually Means

A feature is **done** when all of these are true:

| Check | How to verify |
|-------|---------------|
| It works correctly | `npm test` passes, targeted Playwright test passes |
| It doesn't break anything | Full smoke suite green |
| It feels good | You mentally simulated the player experiencing it |
| The code is clean | No magic numbers, no console.log, no functions > 60 lines |
| It serves a design pillar | You can name which pillar |
| A future developer could read it | Variable names are self-explanatory, no mystery logic |

If any row is false, it is not done. Partial credit does not ship.

---

End of manual. See [CHECKLIST_2Y.md](CHECKLIST_2Y.md) for the actionable tracking artifact.
