# 2-Year Progress Checklist

Companion to [ROADMAP_2Y.md](ROADMAP_2Y.md). **This is the tickable tracker.** Every completed task ticks one or more boxes below via the commit's `Checklist:` trailer. Each item ID follows `q<N>-<area>-<slug>`; commits reference it so the dashboard can reconcile.

Rules:

- Tick items `[x]` as soon as their acceptance passes. Never batch.
- Never tick an item whose evidence you cannot point to (commit hash, test, screenshot).
- If an item turns out to be wrong, replace with a corrected item and leave the original crossed out via `~~[~]~~`.
- The `Definition of Done` at the end of each section is the quarter's exit gate.

Legend: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked (explain inline)

---

## Q1 — Foundations for Autonomous Operation (2026-04 → 2026-06)

**Goal:** Establish a green baseline. Gate commands pass, Roo completes tasks end-to-end, and the Playwright smoke suite is written.

### Q1.A — Gate Health

Confirm all gate commands pass on the current codebase before any autonomous work begins.

- [x] `q1-gate-lint` `npm run lint:basic` exits 0
- [x] `q1-gate-mathrandom` `npm run check:no-math-random` exits 0
- [x] `q1-gate-validate` `npm run validate` exits 0
- [x] `q1-gate-tests` `npm test` exits 0 (all unit tests green)
- [x] `q1-gate-all-clean` all 4 gate commands pass in a single sequential run

### Q1.B — Roo First Cycle

Verify the autonomous Roo loop works end-to-end.

- [x] `q1-roo-first-task` first checklist item picked, changed, gate-passed, committed (commit 95035dc)
- [x] `q1-roo-three-tasks` 3 consecutive tasks completed without gate failure (commits 95035dc, 9030f0c, current)
- [x] `q1-roo-revert-recovery` deliberately introduced Math.random(), validate gate failed, fixed, recovered (commits: 95035dc, 9030f0c, 7841761, current)

### Q1.C — Roo Code Setup (operator does once, not coded)

- [ ] `q1-roo-provider` Roo Code configured: provider = llama.cpp, endpoint correct
- [ ] `q1-roo-context` context window set to 64k tokens in Roo settings
- [ ] `q1-roo-autoapprove` auto-approve ON for: read, write, `npm run lint:basic`, `npm run check:no-math-random`, `npm run validate`, `npm test`, `git status/diff/log/add/commit`, `node scripts/*.mjs`
- [x] `q1-roo-rules-load` confirm `.roo/rules/*.md` loads on every session (send "go", see `[boot]` line)
- [x] `q1-roo-first-cycle` first autonomous task cycle completes end-to-end (pick → edit → gate → commit) — 4 tasks completed

### Q1.H — Playwright Smoke Suite (acceptance baseline for the gate)

- [x] `q1-pw-load-game` game loads and reaches main menu < 10s
- [x] `q1-pw-new-game` start new game, player spawns, HUD renders
- [x] `q1-pw-walk` WASD moves the player ≥ 5 tiles
- [x] `q1-pw-drive` enter a car, drive 50m, exit
- [x] `q1-pw-fire-weapon` equip pistol, fire, impact registers
- [x] `q1-pw-hack-node` open hack, select node, complete breach
- [x] `q1-pw-build-road` god mode, place road tile
- [x] `q1-pw-build-building` god mode, place a residential building
- [x] `q1-pw-save` save to slot 1
- [x] `q1-pw-load` load slot 1 from menu
- [x] `q1-pw-reload` page reload preserves save continuity
- [x] `q1-pw-weather-rain` toggle rain, verify effect visible
- [x] `q1-pw-daynight-sweep` force night, force day, verify lighting
- [x] `q1-pw-minimap-open` open/close minimap
- [x] `q1-pw-pause` pause menu opens and closes

### Q1.I — Screenshot Baselines

- [ ] `q1-ss-main-menu` baseline captured
- [ ] `q1-ss-new-game-spawn` baseline
- [ ] `q1-ss-street-noon` baseline
- [ ] `q1-ss-street-night` baseline
- [ ] `q1-ss-rain` baseline
- [ ] `q1-ss-hack-overlay` baseline
- [ ] `q1-ss-god-mode-empty` baseline
- [ ] `q1-ss-god-mode-built` baseline
- [ ] `q1-ss-vehicle-hud` baseline
- [ ] `q1-ss-minimap` baseline
- [ ] `q1-ss-pause` baseline
- [ ] `q1-ss-breach-minigame` baseline
- [ ] `q1-ss-case-file` baseline
- [ ] `q1-ss-codex` baseline
- [ ] `q1-ss-victory-screen` baseline

### Q1.J — Dashboard

- [ ] `q1-dash-scaffold` static HTML + JSON input
- [ ] `q1-dash-throughput` tasks/week widget
- [ ] `q1-dash-revert-rate` revert rate widget
- [ ] `q1-dash-slice-size` avg LOC per task
- [ ] `q1-dash-stage-histogram` gate stage failure counts
- [ ] `q1-dash-screenshot-heatmap` per-view diff heatmap
- [ ] `q1-dash-green-streak` days since last green weekly
- [ ] `q1-dash-milestone-bar` milestone progress from this file
- [ ] `q1-dash-bundle-trend` bundle size line chart
- [ ] `q1-dash-top-ready` top 10 READY tasks with priorities

### Q1 — Definition of Done

- [ ] All 4 gate commands green on current codebase
- [ ] All Q1.A–Q1.J items ticked
- [ ] Tag `0.1.0.0` pushed

---

## Q2 — Playability Pass 1 (2026-07 → 2026-09)

**Goal:** Close the "still not playable" gaps — tutorial, combat feedback, stealth HUD, vehicle UX, demand bars, profiler overlay, perf harness. Target a clean 15-min unguided playtest.

### Q2.A — First-Run Tutorial and Objectives

- [ ] `q2-tut-firstrun-flag` `src/sim/tutorial/` writes a first-run flag in save
- [ ] `q2-tut-overlay-hook` `tutorial_overlay.js` picks up flag and shows step 1
- [ ] `q2-tut-step-walk` step 1: "use WASD to move"
- [ ] `q2-tut-step-interact` step 2: "press F to enter vehicle"
- [ ] `q2-tut-step-drive` step 3: drive to marker
- [ ] `q2-tut-step-hack` step 4: "press Q to hack this node"
- [ ] `q2-tut-step-objective` step 5: completes and hands off to main objective
- [ ] `q2-tut-skip-button` player can skip with ESC
- [ ] `q2-tut-persisted` tutorial progress saved and restored

### Q2.B — Combat Visual Feedback

- [ ] `q2-cb-muzzle-flash-mesh` quad-billboard mesh attached to barrel
- [ ] `q2-cb-muzzle-flash-light` brief point-light on fire
- [ ] `q2-cb-tracer-polish` tracer length/speed tuned per weapon
- [ ] `q2-cb-crosshair` dynamic crosshair sized by spread
- [ ] `q2-cb-hitmarker` 100ms X marker on confirmed hit
- [ ] `q2-cb-damage-numbers` togglable floating numbers
- [ ] `q2-cb-blood-decal-lite` small decal on NPC hit (quad mesh)
- [ ] `q2-cb-recoil-shake-tuning` per-weapon shake curve
- [ ] `q2-cb-ammo-hud` ammo count + reserve in HUD
- [ ] `q2-cb-reload-anim` basic reload animation + time gate

### Q2.C — Stealth HUD

- [ ] `q2-st-eye-icon` eye-icon HUD wired to `src/player/stealth.js` state
- [ ] `q2-st-visibility-ring` optional visibility ring around player
- [ ] `q2-st-detection-bar` filling bar when NPC is suspecting
- [ ] `q2-st-takedown-prompt` "press E" prompt when behind unaware NPC
- [ ] `q2-st-noise-indicator` noise ping on footsteps in stealth

### Q2.D — Vehicle UX

- [ ] `q2-vh-enter-prompt` "press F to enter" when in range
- [ ] `q2-vh-enter-fade` 300ms fade on enter/exit
- [ ] `q2-vh-exit-side` player exits on same side as door faced
- [ ] `q2-vh-speedo-units` toggle mph/kph in settings
- [ ] `q2-vh-honk` H honks (audio + anim)
- [ ] `q2-vh-carjack-basic` jack an occupied vehicle (NPC flees)

### Q2.E — Demand Bars and Growth HUD

- [ ] `q2-hud-demand-bars` R/C/I bars in God-mode HUD
- [ ] `q2-hud-demand-tooltips` hover shows numeric demand
- [ ] `q2-hud-growth-heatmap` toggle to tint tiles by growth pressure
- [ ] `q2-hud-budget-widget` shows income/expenses per tick

### Q2.F — NPC Profiler Overlay

- [ ] `q2-pr-toggle` hack mode key toggles profiler
- [ ] `q2-pr-float-panel` panel floats above nearest NPC
- [ ] `q2-pr-fields-basic` name, age, income, job
- [ ] `q2-pr-fields-secret` hidden secret requires deeper hack
- [ ] `q2-pr-fields-relations` top 3 relations
- [ ] `q2-pr-lod-cull` only detailed NPCs get profiler data

### Q2.G — Perf Harness

- [ ] `q2-pf-harness` `tools/perf_harness.mjs` runs headless + measures frame times
- [ ] `q2-pf-scenes` scenes: empty map, medium map, medium+120 NPCs, night+rain
- [ ] `q2-pf-budget` budget: 60 fps on reference GPU, degraded gracefully below
- [ ] `q2-pf-ci-gate` harness result written to `tools/agent/baselines/perf.json`
- [ ] `q2-pf-regression-check` gate compares and fails on > 10% regression

### Q2.H — Playtest Script

- [ ] `q2-pt-15min` Playwright "playtest" scenario runs 15 minutes headless
- [ ] `q2-pt-objective-completion` scripted agent completes starter objective
- [ ] `q2-pt-no-crashes` zero uncaught errors in console during run
- [ ] `q2-pt-screenshots-5` 5 checkpoint screenshots captured

### Q2 — Definition of Done

- [ ] 15-min unguided playtest completes a starter objective with no crash
- [ ] All Q2.A–Q2.H items ticked
- [ ] Operator approval file `q2.json` present
- [ ] Tag `0.2.0.0`

---

## Q3 — Physics + Interiors Lite (2026-10 → 2026-12)

**Goal:** Rigid-body props, first ragdoll, breakable glass, 3 interior templates, determinism preserved.

### Q3.A — Rapier Integration

- [ ] `q3-rp-install` add Rapier WASM (via `chore(deps)` task) — operator approval
- [ ] `q3-rp-world-step` fixed-step integration hooked into `game_loop.js`
- [ ] `q3-rp-determinism-test` identical seeds → identical prop positions after 1000 steps
- [ ] `q3-rp-pool` rigid-body pool with cap and recycle
- [ ] `q3-rp-save-load` physics state survives save/load

### Q3.B — Physics Props

- [ ] `q3-pp-cone` traffic cone model + collider
- [ ] `q3-pp-trashcan` trash can rolls when kicked
- [ ] `q3-pp-sign` freestanding sign bends-then-falls
- [ ] `q3-pp-chair` chair for interiors
- [ ] `q3-pp-crate` breakable wooden crate (Q3.D dependency)
- [ ] `q3-pp-spawner` density-tuned prop spawner per district

### Q3.C — Ragdoll First Pass

- [ ] `q3-rd-3bone` 3-bone ragdoll skeleton (hip, chest, head)
- [ ] `q3-rd-blend-in` ragdoll activates on death within 150ms
- [ ] `q3-rd-blend-out` returns to rest pose within 1.5s
- [ ] `q3-rd-knockback` explosive knockback applies impulse
- [ ] `q3-rd-despawn` despawn policy preserves determinism

### Q3.D — Breakables

- [ ] `q3-br-glass-shader` shattering glass shader
- [ ] `q3-br-glass-particles` shard particle burst
- [ ] `q3-br-glass-sound` impact + shatter SFX
- [ ] `q3-br-crate-break` crate destruction + loot drop hook

### Q3.E — Interior Loader

- [ ] `q3-in-doorway-tag` mark doorways in building metadata
- [ ] `q3-in-enter-trigger` "press F to enter" at tagged doors
- [ ] `q3-in-scene-swap` interior scene root replaces outdoor scene root
- [ ] `q3-in-minimap-swap` interior minimap overlay
- [ ] `q3-in-exit-trigger` exit door returns player to world position
- [ ] `q3-in-template-shop` convenience store interior
- [ ] `q3-in-template-safehouse` player safehouse interior
- [ ] `q3-in-template-subway` subway platform interior
- [ ] `q3-in-growth-assignment` zone growth picks interior per building class

### Q3 — Definition of Done

- [ ] Player enters ≥ 3 interior types and back out without crash
- [ ] All Q3.A–Q3.E items ticked
- [ ] Operator approval file `q3.json`
- [ ] Tag `0.3.0.0`

---

## Q4 — Combat & AI Depth (2027-01 → 2027-03)

**Goal:** Enemies with cover, behavior tree, weapon tier-2, upgraded police, vehicle damage model.

### Q4.A — Cover System

- [ ] `q4-cv-edge-tag` tag cover edges on static geometry
- [ ] `q4-cv-snap` snap-to-cover controller state
- [ ] `q4-cv-blindfire` blindfire aim penalty curve
- [ ] `q4-cv-lean` lean out to shoot
- [ ] `q4-cv-npc-use` NPCs use same cover tags

### Q4.B — Behavior Tree Rewrite

- [ ] `q4-bt-library` tiny BT library in `src/sim/agents/bt.js`
- [ ] `q4-bt-ambient` ambient (walk, chat) behavior
- [ ] `q4-bt-alerted` alerted behavior with search pattern
- [ ] `q4-bt-engaged` engaged behavior with cover + fire
- [ ] `q4-bt-flee` flee behavior with panic radius
- [ ] `q4-bt-callbackup` call-for-backup action (spawns reinforcements)
- [ ] `q4-bt-surrender` surrender state after heavy damage

### Q4.C — Weapon Tier 2

- [ ] `q4-wp-recoil-curves` per-weapon recoil curves
- [ ] `q4-wp-ads` aim-down-sights state with FOV shift
- [ ] `q4-wp-hipfire-spread` wider spread when hipfiring
- [ ] `q4-wp-ammo-refactor` unified ammo model for all weapons
- [ ] `q4-wp-weapon-wheel` radial weapon selector

### Q4.D — Police Response Upgrade

- [ ] `q4-po-roadblock` patrol cars form a roadblock at high heat
- [ ] `q4-po-helicopter` spotlight helicopter at wanted 3+
- [ ] `q4-po-spikestrips` roadblock deploys spikes
- [ ] `q4-po-dispatch-chat` radio barks via subtitles

### Q4.E — Vehicle Damage Model

- [ ] `q4-vd-mesh-decimate` decimated mesh variants per vehicle
- [ ] `q4-vd-deform-bends` seeded bend transforms on impact
- [ ] `q4-vd-tire-blowouts` tires can be shot out
- [ ] `q4-vd-engine-smoke` progressive smoke + fire at low HP
- [ ] `q4-vd-explode` explosion at 0 HP with AoE

### Q4 — Definition of Done

- [ ] 5-wave encounter survivable and judged fun by operator
- [ ] All Q4.A–Q4.E items ticked
- [ ] End-of-year-1 review recorded in `docs/retros/2027-03.md`
- [ ] Operator approval file `q4.json`
- [ ] Tag `0.4.0.0`

---

## Q5 — Content Engine (2027-04 → 2027-06)

**Goal:** The agent authors 50 buildings, 30 vehicles, 20 NPC archetypes, 15 missions — all passing validator.

### Q5.A — Template Freeze

- [ ] `q5-tmpl-building` schema + generator + validator
- [ ] `q5-tmpl-vehicle` schema + generator + validator
- [ ] `q5-tmpl-weapon` schema + generator + validator
- [ ] `q5-tmpl-quest` schema + generator + validator (references QUEST_SCHEMA.md)
- [ ] `q5-tmpl-npc` schema + generator + validator

### Q5.B — Low-Priority Content Queue

- [ ] `q5-cq-autofill` curator tops up content queue when milestone queue empty
- [ ] `q5-cq-ratelimit` ≤ 5 content tasks/day
- [ ] `q5-cq-quality-floor` validator rejects low-score content automatically

### Q5.C — Content Goals

- [ ] `q5-goal-buildings-50` 50 new buildings merged
- [ ] `q5-goal-vehicles-30` 30 new vehicles merged
- [ ] `q5-goal-npc-20` 20 archetypes merged
- [ ] `q5-goal-quests-15` 15 quests merged

### Q5.D — District Variants

- [ ] `q5-dv-docks` docks district with warehouses, cranes, boats
- [ ] `q5-dv-industrial` industrial district with smokestacks, yards
- [ ] `q5-dv-suburbs` suburbs with houses, lawns
- [ ] `q5-dv-oldtown` old-town with narrow streets

### Q5.E — Multimodal Critic Upgrade

- [ ] `q5-cr-vision-model` select and install local VLM (e.g. Qwen2-VL 7B)
- [ ] `q5-cr-screenshot-understanding` critic sees screenshots rather than captions
- [ ] `q5-cr-findings-quality` blocker false-positive rate < 5% over 2 weeks

### Q5 — Definition of Done

- [ ] All content goals met; all validators green
- [ ] Multimodal critic active
- [ ] Operator approval file `q5.json`
- [ ] Tag `0.5.0.0`

---

## Q6 — Hacking Depth (2027-07 → 2027-09)

**Goal:** The city is a weapon. Stealth mission completable with zero gunfire.

### Q6.A — Camera Network

- [ ] `q6-cam-tagging` tag hackable cameras in world
- [ ] `q6-cam-traversal` hop between cameras by LOS
- [ ] `q6-cam-view-feed` render feed as HUD quad
- [ ] `q6-cam-hack-from-camera` can trigger nearby hacks while viewing

### Q6.B — Profiler Deepening

- [ ] `q6-pr-income-history` year of income data
- [ ] `q6-pr-criminal-record` charges + outcomes
- [ ] `q6-pr-relations-graph` 2-hop relationship graph
- [ ] `q6-pr-schedule-vis` week schedule heatmap

### Q6.C — Hack Chains

- [ ] `q6-ch-steam-pipe` steam pipe burst hack
- [ ] `q6-ch-crane-drop` crane drop hack
- [ ] `q6-ch-chain-editor` declarative chain file format in `src/content/hack_chains/`
- [ ] `q6-ch-sample-chains` 5 sample chains shipped

### Q6.D — Combat Hacks

- [ ] `q6-chc-grenade-det` detonate enemy grenade
- [ ] `q6-chc-comms-jam` 10s enemy comms jam
- [ ] `q6-chc-weapon-jam` single-target weapon jam

### Q6.E — Radial Hack Menu

- [ ] `q6-rm-menu` radial UI around targeted hackable
- [ ] `q6-rm-keyboard-fallback` number-key fallback preserved
- [ ] `q6-rm-cooldowns` visible cooldown rings

### Q6 — Definition of Done

- [ ] Zero-gunfire mission completable
- [ ] Operator approval `q6.json`
- [ ] Tag `0.6.0.0`

---

## Q7 — Narrative & Audio (2027-10 → 2027-12)

**Goal:** A 6-mission authored arc with TTS voice, cinematic cameras, radio with DJ banter.

### Q7.A — Cinematic Camera

- [ ] `q7-cc-script-format` camera script format in JSON
- [ ] `q7-cc-playback` playback system inside `src/render/`
- [ ] `q7-cc-editor-cli` CLI to preview a shot
- [ ] `q7-cc-skip` player can skip cutscenes

### Q7.B — Local TTS

- [ ] `q7-tts-install` install Piper or XTTS locally — operator approval
- [ ] `q7-tts-voicebank` 6 archetype voices banked
- [ ] `q7-tts-line-cache` generated lines cached by hash
- [ ] `q7-tts-subtitle-sync` subtitle timing per phoneme
- [ ] `q7-tts-ducking` music ducks under dialogue

### Q7.C — Radio

- [ ] `q7-rd-channel-structure` 3 channels with distinct moods
- [ ] `q7-rd-dj-banter-template` banter template filled by agent
- [ ] `q7-rd-vehicle-radio` in-car tuning UI
- [ ] `q7-rd-music-pool` procedural + free-licence pool

### Q7.D — Mission Arc

- [ ] `q7-ar-m1` mission 1: setup
- [ ] `q7-ar-m2` mission 2: recruitment
- [ ] `q7-ar-m3` mission 3: heist planning
- [ ] `q7-ar-m4` mission 4: the heist
- [ ] `q7-ar-m5` mission 5: betrayal
- [ ] `q7-ar-m6` mission 6: resolution
- [ ] `q7-ar-arc-save` arc progress persisted and replayable

### Q7.E — Subtitles & Accessibility (first pass)

- [ ] `q7-sb-subtitle-toggle`
- [ ] `q7-sb-size-option`
- [ ] `q7-sb-speaker-labels`
- [ ] `q7-sb-colorblind-palette` (feeds into Q8)

### Q7 — Definition of Done

- [ ] 6-mission arc completable end to end
- [ ] Voice, music, subtitles all functional
- [ ] Operator approval `q7.json`
- [ ] Tag `0.7.0.0`

---

## Q8 — Polish, Perf, 1.0 RC (2028-01 → 2028-04)

**Goal:** Ship a game people would play for 10 hours.

### Q8.A — Perf Pass

- [ ] `q8-pf-frustum-audit` verify frustum culling on all instanced meshes
- [ ] `q8-pf-lod-tune` LOD thresholds tuned per category
- [ ] `q8-pf-drawcall-reduce` ≥ 20% draw-call reduction vs Q7
- [ ] `q8-pf-gc-audit` eliminate per-frame allocations in hot loops
- [ ] `q8-pf-shader-cost` shader cost audit (SSAO half-res, bloom mips)

### Q8.B — Accessibility

- [ ] `q8-ac-rebind-complete` all actions rebindable
- [ ] `q8-ac-subtitle-size` multi-size subtitle
- [ ] `q8-ac-colorblind-palettes` 3 colorblind palettes
- [ ] `q8-ac-shake-toggle` camera shake toggle
- [ ] `q8-ac-reduced-motion` reduced-motion mode
- [ ] `q8-ac-hold-vs-tap` toggle hold vs tap for interacts

### Q8.C — Save Migration

- [ ] `q8-sm-matrix` migration matrix covering 0.1.x → 0.7.x → 1.0
- [ ] `q8-sm-tests` Playwright round-trip per migration
- [ ] `q8-sm-100h-save` synthetic 100-hour save round-trips cleanly

### Q8.D — Steam Pipeline

- [ ] `q8-st-depot-upload` depot upload works end-to-end
- [ ] `q8-st-achievements` ≥ 20 achievements defined and trigger-tested
- [ ] `q8-st-cloudsaves` cloud saves tested across two installs
- [ ] `q8-st-beta-branch` `0.7.x` on beta branch; `1.0` on default

### Q8.E — External Playtest

- [ ] `q8-pt-testers-invited` 3 external testers signed up
- [ ] `q8-pt-session-logs` session logs aggregated into `docs/playtests/`
- [ ] `q8-pt-no-hardcrash` no hard crash in any session
- [ ] `q8-pt-no-softlock` no softlock in any session
- [ ] `q8-pt-retrospective` post-playtest retrospective in `docs/retros/`

### Q8.F — Launch

- [ ] `q8-ln-rc1` tag `1.0.0-rc.1`
- [ ] `q8-ln-rc-patch` ≤ 2 patch RCs allowed
- [ ] `q8-ln-1-0-0` tag `1.0.0` end of April 2028
- [ ] `q8-ln-post-mortem` launch post-mortem in `docs/retros/2028-04.md`

### Q8 — Definition of Done

- [ ] External 2-hour sessions completed without hard crash or softlock
- [ ] Operator approval `q8.json`
- [ ] Tag `1.0.0`

---

## Ongoing (cross-cutting, checked weekly)

These don't belong to any one quarter. The curator keeps them topped up.

- [ ] `ong-gate-green-streak` nightly green streak ≥ 7 days at all times from Q2 onward
- [ ] `ong-revert-rate` revert rate < 10% rolling 30d
- [ ] `ong-transcript-audit` operator spot-checks 1 transcript / week
- [ ] `ong-incident-backlog` incident backlog = 0 before starting new milestones
- [ ] `ong-manual-sync` `ROADMAP_2Y.md` and `CHECKLIST_2Y.md` never drift — meta task every quarter
- [ ] `ong-memory-hygiene` `MEMORY.md` index updated with progress notes each quarter
- [ ] `ong-bundle-size` bundle size growth < 2% per quarter
- [ ] `ong-perf-regress` zero un-acknowledged perf regressions
- [ ] `ong-dep-updates` `chore(deps)` task once a quarter for security patches only

---

## Retrospectives (append at quarter end)

### Q1 Retro (2026-06)
*(pending)*

### Q2 Retro (2026-09)
*(pending)*

### Q3 Retro (2026-12)
*(pending)*

### Q4 Retro (2027-03)
*(pending)*

### Q5 Retro (2027-06)
*(pending)*

### Q6 Retro (2027-09)
*(pending)*

### Q7 Retro (2027-12)
*(pending)*

### Q8 Retro (2028-04)
*(pending — includes 1.0 launch post-mortem)*
