# 2-Year Development Manual (2026-04 → 2028-04)

> **You are the sole creator of this game.** This manual is your institutional memory — the vision, the craft standards, the architecture, and the roadmap. Read it before you write a single line.

This document defines:

- **Part 0** — the game's vision, design pillars, and emotional targets
- **Part I** — how a session flows, how to pick and execute a task
- **Part II** — codebase map, architecture, and conventions
- **Part III** — the autonomous pipeline (Roo Code driven)
- **Part IV** — the eight-quarter roadmap
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

What is missing: **presentation, feedback, and cohesion**. The gap is not in whether systems exist — it is in whether the player can *feel* them. Combat feedback is incomplete. The gameplay loop is unclear. NPCs are abstractions. Hacking lacks a radial UI. No authored narrative arc.

The 2-year plan closes these gaps in priority order. Trust the roadmap.

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

## Part IV — Eight-Quarter Roadmap

Each quarter has: **theme**, **entry criteria** (must be true before starting), **exit criteria** (must be true to tag the quarter), **milestone** (the one thing that defines success), **content backlog** (LLM chews on between milestone tasks), **risks**, and **rollback plan** if the quarter slips.

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
