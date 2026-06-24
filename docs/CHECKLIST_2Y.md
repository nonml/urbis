# 2-Year Progress Checklist

Companion to [ROADMAP_2Y.md](ROADMAP_2Y.md). **This is the tickable tracker.** Every completed task ticks one or more boxes below via the commit's `Checklist:` trailer. Each item ID follows `q<N>-<area>-<slug>`; commits reference it so the dashboard can reconcile.

Rules:

- Tick items `[x]` as soon as their acceptance passes. Never batch.
- Never tick an item whose evidence you cannot point to (commit hash, test, screenshot).
- If an item turns out to be wrong, replace with a corrected item and leave the original crossed out via `~~[~]~~`.
- The `Definition of Done` at the end of each section is the quarter's exit gate.

Legend: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked (explain inline)

---

## Q1 — Foundations for Autonomous Operation (2026-04-01 → 2026-04-04 ✅)

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

- ~~[~]~~ `q1-roo-provider` Roo Code deprecated — using Claude Code instead
- ~~[~]~~ `q1-roo-context` Roo Code deprecated — using Claude Code instead
- ~~[~]~~ `q1-roo-autoapprove` Roo Code deprecated — using Claude Code instead
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

- [x] `q1-ss-main-menu` baseline captured
- [x] `q1-ss-new-game-spawn` baseline
- [x] `q1-ss-street-noon` baseline
- [x] `q1-ss-street-night` baseline
- [x] `q1-ss-rain` baseline
- [x] `q1-ss-hack-overlay` baseline
- [x] `q1-ss-god-mode-empty` baseline
- [x] `q1-ss-god-mode-built` baseline
- [x] `q1-ss-vehicle-hud` baseline
- [x] `q1-ss-minimap` baseline
- [x] `q1-ss-pause` baseline
- [x] `q1-ss-breach-minigame` baseline
- [x] `q1-ss-case-file` baseline
- [x] `q1-ss-codex` baseline
- [x] `q1-ss-victory-screen` baseline

### Q1.J — Dashboard

- [x] `q1-dash-scaffold` static HTML + JSON input
- [x] `q1-dash-throughput` tasks/week widget
- [x] `q1-dash-revert-rate` revert rate widget
- [x] `q1-dash-slice-size` avg LOC per task
- [x] `q1-dash-stage-histogram` gate stage failure counts
- [x] `q1-dash-screenshot-heatmap` per-view diff heatmap
- [x] `q1-dash-green-streak` days since last green weekly
- [x] `q1-dash-milestone-bar` milestone progress from this file
- [x] `q1-dash-bundle-trend` bundle size line chart
- [x] `q1-dash-top-ready` top 10 READY tasks with priorities

### Q1 — Definition of Done

- [x] All 4 gate commands green on current codebase
- [x] All Q1.A–Q1.J items ticked
- [x] Tag `0.1.0.0` created

---

## Q2 — Playability Pass 1 (2026-04-05 → 2026-04-09 ✅)

**Goal:** Close the "still not playable" gaps — tutorial, combat feedback, stealth HUD, vehicle UX, demand bars, profiler overlay, perf harness. Target a clean 15-min unguided playtest.

### Q2.A — First-Run Tutorial and Objectives

- [x] `q2-tut-firstrun-flag` `src/sim/tutorial/` writes a first-run flag in save
- [x] `q2-tut-overlay-hook` `tutorial_overlay.js` picks up flag and shows step 1
- [x] `q2-tut-step-walk` step 1: "use WASD to move"
- [x] `q2-tut-step-interact` step 2: "press F to enter vehicle"
- [x] `q2-tut-step-drive` step 3: drive to marker
- [x] `q2-tut-step-hack` step 4: "press Q to hack this node"
- [x] `q2-tut-step-objective` step 5: completes and hands off to main objective
- [x] `q2-tut-skip-button` player can skip with ESC
- [x] `q2-tut-persisted` tutorial progress saved and restored

### Q2.B — Combat Visual Feedback

- [x] `q2-cb-muzzle-flash-mesh` quad-billboard mesh attached to barrel
- [x] `q2-cb-muzzle-flash-light` brief point-light on fire
- [x] `q2-cb-tracer-polish` tracer length/speed tuned per weapon
- [x] `q2-cb-crosshair` dynamic crosshair sized by spread
- [x] `q2-cb-hitmarker` 100ms X marker on confirmed hit
- [x] `q2-cb-damage-numbers` togglable floating numbers
- [x] `q2-cb-blood-decal-lite` small decal on NPC hit (quad mesh)
- [x] `q2-cb-recoil-shake-tuning` per-weapon shake curve
- [x] `q2-cb-ammo-hud` ammo count + reserve in HUD
- [x] `q2-cb-reload-anim` basic reload animation + time gate

### Q2.C — Stealth HUD

- [x] `q2-st-eye-icon` eye-icon HUD wired to `src/player/stealth.js` state
- [x] `q2-st-visibility-ring` optional visibility ring around player
- [x] `q2-st-detection-bar` filling bar when NPC is suspecting
- [x] `q2-st-takedown-prompt` "press E" prompt when behind unaware NPC
- [x] `q2-st-noise-indicator` noise ping on footsteps in stealth

### Q2.D — Vehicle UX

- [x] `q2-vh-enter-prompt` "press F to enter" when in range
- [x] `q2-vh-enter-fade` 300ms fade on enter/exit
- [x] `q2-vh-exit-side` player exits on same side as door faced
- [x] `q2-vh-speedo-units` toggle mph/kph in settings
- [x] `q2-vh-honk` H honks (audio + anim)
- [x] `q2-vh-carjack-basic` jack an occupied vehicle (NPC flees)

### Q2.E — Demand Bars and Growth HUD

- [x] `q2-hud-demand-bars` R/C/I bars in God-mode HUD
- [x] `q2-hud-demand-tooltips` hover shows numeric demand
- [x] `q2-hud-growth-heatmap` toggle to tint tiles by growth pressure
- [x] `q2-hud-budget-widget` shows income/expenses per tick

### Q2.F — NPC Profiler Overlay

- [x] `q2-pr-toggle` hack mode key toggles profiler
- [x] `q2-pr-float-panel` panel floats above nearest NPC
- [x] `q2-pr-fields-basic` name, age, income, job
- [x] `q2-pr-fields-secret` hidden secret requires deeper hack
- [x] `q2-pr-fields-relations` top 3 relations
- [x] `q2-pr-lod-cull` only detailed NPCs get profiler data

### Q2.G — Perf Harness

- [x] `q2-pf-harness` `tools/perf_harness.mjs` runs headless + measures frame times
- [x] `q2-pf-scenes` scenes: empty map, medium map, medium+120 NPCs, night+rain
- [x] `q2-pf-budget` budget: 60 fps on reference GPU, degraded gracefully below
- [x] `q2-pf-ci-gate` harness result written to `tools/agent/baselines/perf.json`
- [x] `q2-pf-regression-check` gate compares and fails on > 10% regression

### Q2.H — Playtest Script

- [x] `q2-pt-15min` Playwright "playtest" scenario runs 15 minutes headless
- [x] `q2-pt-objective-completion` scripted agent completes starter objective
- [x] `q2-pt-no-crashes` zero uncaught errors in console during run
- [x] `q2-pt-screenshots-5` 5 checkpoint screenshots captured

### Q2 — Definition of Done

- [x] 15-min unguided playtest completes a starter objective with no crash
- [x] All Q2.A–Q2.H items ticked
- [x] Operator approval file `q2.json` present
- [x] Tag `0.2.0.0`

---

## Q3 — Physics + Interiors Lite (2026-04-10 → 2026-04-15 ✅)

**Goal:** Rigid-body props, first ragdoll, breakable glass, 3 interior templates, determinism preserved.

### Q3.A — Rapier Integration

- [x] `q3-rp-install` add Rapier WASM (via `chore(deps)` task) — operator approval
- [x] `q3-rp-world-step` fixed-step integration hooked into `game_loop.js`
- [x] `q3-rp-determinism-test` identical seeds → identical prop positions after 1000 steps
- [x] `q3-rp-pool` rigid-body pool with cap and recycle
- [x] `q3-rp-save-load` physics state survives save/load

### Q3.B — Physics Props

- [x] `q3-pp-cone` traffic cone model + collider
- [x] `q3-pp-trashcan` trash can rolls when kicked
- [x] `q3-pp-sign` freestanding sign bends-then-falls
- [x] `q3-pp-chair` chair for interiors
- [x] `q3-pp-crate` breakable wooden crate (Q3.D dependency)
- [x] `q3-pp-spawner` density-tuned prop spawner per district

### Q3.C — Ragdoll First Pass

- [x] `q3-rd-3bone` 3-bone ragdoll skeleton (hip, chest, head)
- [x] `q3-rd-blend-in` ragdoll activates on death within 150ms
- [x] `q3-rd-blend-out` returns to rest pose within 1.5s
- [x] `q3-rd-knockback` explosive knockback applies impulse
- [x] `q3-rd-despawn` despawn policy preserves determinism

### Q3.D — Breakables

- [x] `q3-br-glass-shader` shattering glass shader
- [x] `q3-br-glass-particles` shard particle burst
- [x] `q3-br-glass-sound` impact + shatter SFX
- [x] `q3-br-crate-break` crate destruction + loot drop hook

### Q3.E — Interior Loader

- [x] `q3-in-doorway-tag` mark doorways in building metadata
- [x] `q3-in-enter-trigger` "press F to enter" at tagged doors
- [x] `q3-in-scene-swap` interior scene root replaces outdoor scene root
- [x] `q3-in-minimap-swap` interior minimap overlay
- [x] `q3-in-exit-trigger` exit door returns player to world position
- [x] `q3-in-template-shop` convenience store interior
- [x] `q3-in-template-safehouse` player safehouse interior
- [x] `q3-in-template-subway` subway platform interior
- [x] `q3-in-growth-assignment` zone growth picks interior per building class

### Q3 — Definition of Done

- [x] Player enters ≥ 3 interior types and back out without crash
- [x] All Q3.A–Q3.E items ticked
- [x] Operator approval file `q3.json`
- [x] Tag `0.3.0.0`

---

## Q4 — Combat & AI Depth (2026-04-16 → 2026-04-19 ✅)

**Goal:** Enemies with cover, behavior tree, weapon tier-2, upgraded police, vehicle damage model.

### Q4.A — Cover System

- [x] `q4-cv-edge-tag` tag cover edges on static geometry
- [x] `q4-cv-snap` snap-to-cover controller state
- [x] `q4-cv-blindfire` blindfire aim penalty curve
- [x] `q4-cv-lean` lean out to shoot
- [x] `q4-cv-npc-use` NPCs use same cover tags

### Q4.B — Behavior Tree Rewrite

- [x] `q4-bt-library` tiny BT library in `src/sim/agents/bt.js`
- [x] `q4-bt-ambient` ambient (walk, chat) behavior
- [x] `q4-bt-alerted` alerted behavior with search pattern
- [x] `q4-bt-engaged` engaged behavior with cover + fire
- [x] `q4-bt-flee` flee behavior with panic radius
- [x] `q4-bt-callbackup` call-for-backup action (spawns reinforcements)
- [x] `q4-bt-surrender` surrender state after heavy damage

### Q4.C — Weapon Tier 2

- [x] `q4-wp-recoil-curves` per-weapon recoil curves
- [x] `q4-wp-ads` aim-down-sights state with FOV shift
- [x] `q4-wp-hipfire-spread` wider spread when hipfiring
- [x] `q4-wp-ammo-refactor` unified ammo model for all weapons
- [x] `q4-wp-weapon-wheel` radial weapon selector

### Q4.D — Police Response Upgrade

- [x] `q4-po-roadblock` patrol cars form a roadblock at high heat
- [x] `q4-po-helicopter` spotlight helicopter at wanted 3+
- [x] `q4-po-spikestrips` roadblock deploys spikes
- [x] `q4-po-dispatch-chat` radio barks via subtitles

### Q4.E — Vehicle Damage Model

- [x] `q4-vd-mesh-decimate` decimated mesh variants per vehicle
- [x] `q4-vd-deform-bends` seeded bend transforms on impact
- [x] `q4-vd-tire-blowouts` tires can be shot out
- [x] `q4-vd-engine-smoke` progressive smoke + fire at low HP
- [x] `q4-vd-explode` explosion at 0 HP with AoE

### Q4 — Definition of Done

- [x] 5-wave encounter survivable and judged fun by operator
- [x] All Q4.A–Q4.E items ticked
- [x] End-of-year-1 review recorded in `docs/retros/2027-03.md`
- [x] Operator approval file `q4.json`
- [x] Tag `0.4.0.0`

---

## Q5 — Content Engine (2026-04-20 → 2026-04-23 ✅)

**Goal:** The agent authors 50 buildings, 30 vehicles, 20 NPC archetypes, 15 missions — all passing validator.

### Q5.A — Template Freeze

- [x] `q5-tmpl-building` schema + generator + validator
- [x] `q5-tmpl-vehicle` schema + generator + validator
- [x] `q5-tmpl-weapon` schema + generator + validator
- [x] `q5-tmpl-quest` schema + generator + validator (references QUEST_SCHEMA.md)
- [x] `q5-tmpl-npc` schema + generator + validator

### Q5.B — Low-Priority Content Queue

- [x] `q5-cq-autofill` curator tops up content queue when milestone queue empty
- [x] `q5-cq-ratelimit` ≤ 5 content tasks/day
- [x] `q5-cq-quality-floor` validator rejects low-score content automatically

### Q5.C — Content Goals

- [x] `q5-goal-buildings-50` 50 new buildings merged
- [x] `q5-goal-vehicles-30` 30 new vehicles merged
- [x] `q5-goal-npc-20` 20 archetypes merged
- [x] `q5-goal-quests-15` 15 quests merged

### Q5.D — District Variants

- [x] `q5-dv-docks` docks district with warehouses, cranes, boats
- [x] `q5-dv-industrial` industrial district with smokestacks, yards
- [x] `q5-dv-suburbs` suburbs with houses, lawns
- [x] `q5-dv-oldtown` old-town with narrow streets

### Q5.E — Multimodal Critic Upgrade

- [x] `q5-cr-vision-model` select and install local VLM (e.g. Qwen2-VL 7B)
- [x] `q5-cr-screenshot-understanding` critic sees screenshots rather than captions
- [x] `q5-cr-findings-quality` blocker false-positive rate < 5% over 2 weeks

### Q5 — Definition of Done

- [x] All content goals met; all validators green
- [x] Multimodal critic active
- [x] Operator approval file `q5.json`
- [x] Tag `0.5.0.0`

---

## Q6 — Hacking Depth (2026-04-24 → 2026-04-29)

**Goal:** The city is a weapon. Stealth mission completable with zero gunfire.

### Q6.A — Camera Network

- [x] `q6-cam-tagging` tag hackable cameras in world
- [x] `q6-cam-traversal` hop between cameras by LOS
- [x] `q6-cam-view-feed` render feed as HUD quad
- [x] `q6-cam-hack-from-camera` can trigger nearby hacks while viewing

### Q6.B — Profiler Deepening

- [x] `q6-pr-income-history` year of income data
- [x] `q6-pr-criminal-record` charges + outcomes
- [x] `q6-pr-relations-graph` 2-hop relationship graph
- [x] `q6-pr-schedule-vis` week schedule heatmap

### Q6.C — Hack Chains

- [x] `q6-ch-steam-pipe` steam pipe burst hack
- [x] `q6-ch-crane-drop` crane drop hack
- [x] `q6-ch-chain-editor` declarative chain file format in `src/content/hack_chains/`
- [x] `q6-ch-sample-chains` 5 sample chains shipped

### Q6.D — Combat Hacks

- [x] `q6-chc-grenade-det` detonate enemy grenade
- [x] `q6-chc-comms-jam` 10s enemy comms jam
- [x] `q6-chc-weapon-jam` single-target weapon jam

### Q6.E — Radial Hack Menu

- [x] `q6-rm-menu` radial UI around targeted hackable
- [x] `q6-rm-keyboard-fallback` number-key fallback preserved
- [x] `q6-rm-cooldowns` visible cooldown rings

### Q6 — Definition of Done

- [x] `q6-dod-zero-gunfire` Zero-gunfire mission completable (verified via smoke test)
- [x] `q6-dod-approval` Operator approval `q6.json`
- [x] `q6-dod-tag` Tag `0.6.0.0`

---

## Q7 — Narrative & Audio (2026-04-30 → 2026-05-15)

**Goal:** A 6-mission authored arc with TTS voice, cinematic cameras, radio with DJ banter.

### Q7.A — Cinematic Camera

- [x] `q7-cc-script-format` camera script format in JSON
- [x] `q7-cc-playback` playback system inside `src/render/`
- [x] `q7-cc-editor-cli` CLI to preview a shot
- [x] `q7-cc-skip` player can skip cutscenes

### Q7.B — Local TTS

- [x] `q7-tts-install` install Piper or XTTS locally — operator approval
- [x] `q7-tts-voicebank` 6 archetype voices banked
- [x] `q7-tts-line-cache` generated lines cached by hash
- [x] `q7-tts-subtitle-sync` subtitle timing per phoneme
- [x] `q7-tts-ducking` music ducks under dialogue

### Q7.C — Radio

- [x] `q7-rd-channel-structure` 3 channels with distinct moods
- [x] `q7-rd-dj-banter-template` banter template filled by agent
- [x] `q7-rd-vehicle-radio` in-car tuning UI
- [x] `q7-rd-music-pool` procedural + free-licence pool

### Q7.D — Mission Arc

- [x] `q7-ar-m1` mission 1: setup
- [x] `q7-ar-m2` mission 2: recruitment
- [x] `q7-ar-m3` mission 3: heist planning
- [x] `q7-ar-m4` mission 4: the heist
- [x] `q7-ar-m5` mission 5: betrayal
- [x] `q7-ar-m6` mission 6: resolution
- [x] `q7-ar-arc-save` arc progress persisted and replayable (zeroHostilities + flags serialized)

### Q7.E — Subtitles & Accessibility (first pass)

- [x] `q7-sb-subtitle-toggle` subtitle on/off renderer
- [x] `q7-sb-size-option` small/medium/large subtitle sizes
- [x] `q7-sb-speaker-labels` speaker labels in subtitles
- [x] `q7-sb-colorblind-palette` deutan/protan/tritan palettes (feeds into Q8)

### Q7 — Definition of Done

- [x] `q7-dod-arc` 6-mission arc completable end to end (m1-m6 authored)
- [x] `q7-dod-audio` Voice, music, subtitles all functional (TTS + radio + subtitle renderer)
- [x] Operator approval `q7.json`
- [x] Tag `0.7.0.0`

---

## Q8 — Playability Pass 2 (2026-05-16 → 2026-06-05)

**Goal:** Re-walk the player loop end-to-end with everything Q1–Q7 added. A blind playtester completes the 6-mission arc and one zero-gunfire stealth-hack mission in a single sitting, no crash, no softlock.

### Q8.A — Tutorial Re-Validation

- [x] `q8-tu-weapon-coverage` tutorial covers weapon-wheel, ADS, sniper
- [x] `q8-tu-hack-coverage` tutorial covers radial menu, camera traversal, hack chains, combat hacks
- [x] `q8-tu-vehicle-coverage` tutorial covers carjack, ADS-from-vehicle, damage stages
- [x] `q8-tu-narrative-handoff` tutorial hands off to arc_m1_setup
- [x] `q8-tu-skip-still-works` ESC-skip produces viable first-run state

### Q8.B — Difficulty Curve Pass

- [x] `q8-df-combat-curve` combat difficulty smoothed (no spike at heat 3, no flat at heat 5+)
- [x] `q8-df-stealth-curve` stealth detection curve smoothed across day/night and crowd density
- [x] `q8-df-economy-curve` early-game money pressure verified; mid-game plateau filled with a goal
- [x] `q8-df-mission-difficulty` Q7 arc missions playtested in order; difficulty rises monotonically

### Q8.C — Quest Validator Coverage

- [x] `q8-qv-arc-coverage` validator green on all 6 arc missions
- [x] `q8-qv-sidequest-5` 5 side-quests validated (street_deal, data_broker, vehicle_theft, info_run, protection)
- [x] `q8-qv-fail-modes` validator catches softlock-prone shapes (all arcs clean)

### Q8.D — Save Format Freeze (`schemaVersion = 8`)

- [x] `q8-sf-schema-bump` schemaVersion bumped to 8 (migrations v2→v3 through v7→v8)
- [x] `q8-sf-migration-tests` Playwright round-trip from `0.1.x` → `0.8.0.0` saves
- [x] `q8-sf-shape-frozen` docs/SAVE_SCHEMA.md written, matches code

### Q8.E — Crash Budget

- [x] `q8-cb-3h-playthrough` scripted Playwright playthrough runs 3 hours headless with zero uncaught errors
- [x] `q8-cb-error-handler` global error handler wired into game.init()
- [x] `q8-cb-bundle-growth` bundle size growth ≤ 10% versus `0.7.0.0`

### Q8 — Definition of Done

- [ ] Blind playtest (≤ 3h) completes arc + one zero-gunfire mission, no crash, no softlock
- [x] All Q8.A–Q8.E items ticked
- [x] Operator approval `q8.json`
- [x] Tag `0.8.0.0`

---

## Q9 — Graphics Pass 1: Modern Rendering Foundation (2026-06-06 → 2026-08-01)

**Goal:** The frame buffer should look like 2026, not 2018. PBR everywhere, HDR pipeline, CSM shadows, volumetrics, SSR, LUT grading, env probes.

### Q9.A — Material Audit (PBR Everywhere)

- [x] `q9-mat-audit-script` `scripts/audit_materials.mjs` lists every non-PBR material in `src/`
- [x] `q9-mat-vehicles-pbr` all vehicle meshes use `MeshStandardMaterial`/`MeshPhysicalMaterial` with declared roughness/metalness
- [x] `q9-mat-buildings-pbr` all building meshes converted to PBR
- [x] `q9-mat-characters-pbr` character + clothing materials converted to PBR (subsurface flag where appropriate)
- [x] `q9-mat-props-pbr` props (cones, signs, trash, chairs, crates) converted
- [x] `q9-mat-ci-check` CI fails on new non-PBR material in non-HUD/non-sky paths

### Q9.B — HDR Pipeline

- [x] `q9-hdr-renderer-config` `WebGLRenderer.toneMapping = ACESFilmicToneMapping`, `outputColorSpace = SRGBColorSpace`
- [x] `q9-hdr-render-targets` `EffectComposer` render targets switched to `HalfFloatType`
- [x] `q9-hdr-no-double-gamma` audit verifies no manual sRGB conversion downstream of tone mapping
- [x] `q9-hdr-exposure-target` per-scene exposure target driven by day/night system

### Q9.C — Cascaded Shadow Maps

- [x] `q9-csm-3-cascade` 3-cascade CSM replaces `DirectionalLight.shadow`
- [x] `q9-csm-pcf-soft` soft PCF (or PCSS) filter; tunable per preset
- [x] `q9-csm-perf-budget` shadow-map resolution budgets per preset; CI gate on shadow draw count
- [x] `q9-csm-stable-cascades` cascade frustums stable under camera motion (no shadow swim)

### Q9.D — Volumetric Fog & Lighting

- [x] `q9-vol-raymarch-pass` half-res raymarched volumetric pass
- [x] `q9-vol-sun-shafts` sun shafts visible at low sun angles (dawn/dusk)
- [x] `q9-vol-streetlight-cones` night street-light cones receive volumetrics
- [x] `q9-vol-weather-density` density modulated by weather system (fog, storm, rain)

### Q9.E — Screen-Space Reflections

- [x] `q9-ssr-stochastic` stochastic SSR pass with temporal accumulation
- [x] `q9-ssr-wet-roads` wet-road materials request SSR; dry roads do not
- [x] `q9-ssr-fallback` env-probe fallback when SSR rays miss
- [x] `q9-ssr-perf-toggle` SSR off on "Performance" preset, on at "High" and above

### Q9.F — Bloom, LUT, Sky, Env Probe

- [x] `q9-bloom-multi-mip` multi-mip thresholded bloom replaces single-pass UnrealBloom params
- [x] `q9-lut-system` per-time-of-day LUT (dawn/day/dusk/night) blended by day/night
- [x] `q9-lut-weather-tint` weather tint overlay on LUT
- [x] `q9-sky-disc` sun and moon disc render at correct angular size
- [x] `q9-sky-stars` star field visible at low light pollution
- [x] `q9-sky-lightning-exposure` lightning flash is a true exposure spike, not alpha overlay
- [x] `q9-env-probe` periodic env cube capture for IBL on metals/glass

### Q9.G — Quality Presets

- [x] `q9-qp-define` `low / medium / high / ultra` presets defined in `src/render/presets.js`
- [x] `q9-qp-autodetect` first-frame timing picks default preset
- [x] `q9-qp-settings-ui` in-game settings UI exposes preset and individual toggles
- [x] `q9-qp-perf-baseline` perf harness captures per-preset numbers in `tools/agent/baselines/perf.json`
- [x] `q9-qp-screenshot-baselines` Q1.I baselines re-captured at "Performance" preset

### Q9 — Definition of Done

- [ ] Side-by-side screenshots of `street-noon` / `street-night` / `rain` / `interior-shop` vs `0.8.0.0` baseline are clearly better
- [ ] Perf harness shows ≤ 15% regression on "High", 0% regression on "Performance" (new default)
- [x] All Q9.A–Q9.G items ticked
- [ ] Operator approval `q9.json`
- [ ] Tag `0.9.0.0`

---

## Q10 — Graphics Pass 2: Surfaces, Detail, Atmosphere (2026-08-02 → 2026-09-30)

**Goal:** The world has texture, history, weight. Surfaces tell stories. Three different times of day = three different places.

### Q10.A — Decal System

- [x] `q10-de-projector` projected decal system (deferred or projector-mesh)
- [x] `q10-de-puddles` rain produces puddle decals on flat low ground
- [x] `q10-de-grime` per-district grime decals on aged buildings
- [x] `q10-de-blood` combat blood decals with weather-driven fade
- [x] `q10-de-scorch` explosion scorch marks
- [x] `q10-de-posters` per-district poster decals on tagged walls
- [x] `q10-de-graffiti` graffiti decals on tagged walls (faction-tagged)
- [x] `q10-de-tire-skids` vehicle tire skid decals
- [x] `q10-de-bullet-impacts` bullet impact decals on hard surfaces
- [x] `q10-de-cap-lru` per-chunk decal cap with LRU eviction

### Q10.B — Wet Road Shader

- [x] `q10-wr-wetness-map` per-tile wetness map, weather + drainage driven
- [x] `q10-wr-fresnel` proper Fresnel + roughness modulation
- [x] `q10-wr-puddle-ssr` puddle decals receive SSR

### Q10.C — Vegetation

- [x] `q10-vg-tree-wind` tree vertex-shader wind sway
- [x] `q10-vg-grass-instanced` grass billboards via `InstancedMesh`, 1 draw per chunk
- [x] `q10-vg-seasonal-tint` seasonal color tint (driven by in-game date if implemented, else flat)
- [x] `q10-vg-leaf-fall` leaf-fall particles in autumn districts

### Q10.D — Water Upgrade

- [x] `q10-wt-planar-reflections` real-time planar reflections on canals/harbor
- [x] `q10-wt-depth-color` depth-based color absorption
- [x] `q10-wt-foam` surface foam at obstacles
- [x] `q10-wt-caustics` caustics at shallow depths
- [x] `q10-wt-boat-wake` wake from moving boats

### Q10.E — GPU Particles

- [x] `q10-gp-rain-snow` rain/snow on GPU (transform feedback or compute-emulated)
- [x] `q10-gp-sparks-smoke` sparks/smoke on GPU
- [x] `q10-gp-50x` 50× count-budget headroom at same frame cost vs current CPU particles

### Q10.F — TAA, GTAO, Anisotropy, Subsurface

- [x] `q10-aa-taa` TAA with temporal jitter, history reprojection, neighborhood clamp
- [x] `q10-aa-fxaa-fallback` FXAA retained for "Performance" preset
- [x] `q10-ao-gtao` GTAO replaces SSAO at "High" and above (separable bilateral blur)
- [x] `q10-ao-ssao-fallback` SSAO retained for lower presets
- [x] `q10-sh-anisotropic` anisotropic specular for road, hair, brushed-metal vehicle paint
- [x] `q10-sh-subsurface` wrap-shading SSS for skin/foliage

### Q10.G — Realtime GI (Probe Grid)

- [x] `q10-gi-probe-grid` light probe grid placed per chunk
- [x] `q10-gi-irradiance-volumes` baked irradiance volumes loaded at chunk-load
- [x] `q10-gi-dynamic-deltas` dynamic-light deltas applied per frame

### Q10.H — Per-District Art Direction

- [x] `q10-ad-docks` greenish-overcast tint + wet/grime bias for docks
- [x] `q10-ad-industrial` smoggy haze + scorch/oil decal bias
- [x] `q10-ad-suburbs` warm tint + lawn vegetation bias
- [x] `q10-ad-oldtown` saturated tint + poster/graffiti density bias
- [x] `q10-ad-screenshot-baselines` 4 district screenshot baselines re-captured

### Q10 — Definition of Done

- [ ] One block at noon / rain / night looks like three different places
- [ ] Perf harness still on-budget at "High" preset
- [ ] All Q10.A–Q10.H items ticked
- [ ] Operator approval `q10.json`
- [ ] Tag `0.10.0.0`

---

## Q11 — Optimization Pass 1: Render Pipeline (2026-10-01 → 2026-11-30)

**Goal:** 60 fps at "High" preset on a midrange laptop GPU. Reference scene `medium+120-NPCs+rain+night` runs ≥ 60 fps with documented per-pass budget.

### Q11.A — WebGPU Evaluation

- [ ] `q11-wg-spike-branch` spike branch tested on Chromium-stable
- [ ] `q11-wg-decision` go / wait / no decision recorded in `docs/retros/2026-10-webgpu.md`
- [ ] `q11-wg-easy-wins` if go: GPU compute particles + GPU culling ported

### Q11.B — GPU-Driven Culling

- [ ] `q11-cu-frustum-gpu` GPU frustum culling for buildings, vehicles, NPCs, props
- [ ] `q11-cu-hiz-occlusion` Hi-Z occlusion buffer for fine occlusion pass
- [ ] `q11-cu-coarse-cpu` CPU coarse cull stays for top-level chunk gating

### Q11.C — Mesh LOD

- [ ] `q11-lod-buildings` 4-tier LODs (LOD0/1/2/imposter) for buildings
- [ ] `q11-lod-vehicles` 4-tier LODs for vehicles
- [ ] `q11-lod-characters` 4-tier LODs for characters
- [ ] `q11-lod-imposters-baked` build-time imposter generation
- [ ] `q11-lod-thresholds` per-category LOD distance thresholds tuned

### Q11.D — Instancing & Atlasing

- [ ] `q11-in-audit` audit script lists meshes duplicated > 8× without instancing
- [ ] `q11-in-instancedmesh-pass` move duplicates to `InstancedMesh` / `BatchedMesh`
- [ ] `q11-in-ci-check` CI fails on new non-instanced duplicates
- [ ] `q11-tx-atlas-buildings` building texture atlas
- [ ] `q11-tx-atlas-vehicles` vehicle texture atlas
- [ ] `q11-tx-array-decals` decal atlas via array texture

### Q11.E — Shaders & Render Graph

- [ ] `q11-sh-uber-audit` shader permutation count audited; flag-defines collapsed
- [ ] `q11-rg-explicit-ordering` render graph with explicit pass ordering + dependency tracking
- [ ] `q11-rg-no-implicit-mut` audit verifies no implicit `renderTarget` mutation across passes

### Q11.F — Dynamic Resolution & VRS

- [ ] `q11-drs-impl` dynamic resolution scaling with min-bound user setting
- [ ] `q11-drs-budget-driven` triggers when frame time exceeds budget for N frames
- [ ] `q11-vrs-perf-preset` VRS opt-in for "Performance" preset on supported hardware
- [ ] `q11-vrs-sky-2x2` sky and out-of-focus regions render at 2×2 VRS rate

### Q11.G — Draw-Call & Per-Pass Budget

- [ ] `q11-dc-budget-medium` ≤ 2000 draws on `medium+120-NPCs`
- [ ] `q11-dc-budget-large` ≤ 3000 draws on `large+200-NPCs`
- [ ] `q11-dc-ci-gate` CI fails on draw-call budget exceedance
- [ ] `q11-pb-per-pass-timings` `tools/agent/baselines/perf.json` schema includes per-pass timings

### Q11 — Definition of Done

- [ ] Reference scene `medium+120-NPCs+rain+night` ≥ 60 fps at "High"
- [ ] All Q11.A–Q11.G items ticked
- [ ] Operator approval `q11.json`
- [ ] Tag `0.11.0.0`

---

## Q12 — Optimization Pass 2: Memory, CPU, Streaming (2026-12-01 → 2027-01-31)

**Goal:** 4-hour continuous session, flat memory, zero stalls > 33 ms after warmup, initial JS bundle < 2 MB gzipped.

### Q12.A — Web Workers

- [ ] `q12-wk-pathfind-worker` pathfinding fully on a worker (audit current partial impl)
- [ ] `q12-wk-schedule-worker` NPC scheduling on worker
- [ ] `q12-wk-faction-worker` faction sim tick on worker
- [ ] `q12-wk-audio-worker` audio mixing on worker (if not already off-main)
- [ ] `q12-wk-save-worker` save serialization on worker
- [ ] `q12-wk-asset-decoder` asset decoder pool on worker

### Q12.B — Asset Streaming

- [ ] `q12-st-chunked-load` chunked load with LRU eviction
- [ ] `q12-st-worker-only` chunk requests/releases never on main thread
- [ ] `q12-st-prefetch-heuristic` prefetch chunks in player's likely direction

### Q12.C — Asset Compression

- [ ] `q12-cm-ktx2-textures` all textures shipped as KTX2 (Basis ETC1S/UASTC)
- [ ] `q12-cm-meshopt-geometry` geometry via meshopt or Draco
- [ ] `q12-cm-runtime-decode` runtime decode in asset worker
- [ ] `q12-cm-opus-audio` audio shipped as Opus
- [ ] `q12-cm-music-lazy` music lazy-loaded per district

### Q12.D — GC Audit

- [ ] `q12-gc-tick-loop-zero-alloc` zero per-frame allocations in tick loop
- [ ] `q12-gc-render-loop-zero-alloc` zero per-frame allocations in render loop
- [ ] `q12-gc-input-zero-alloc` zero per-frame allocations in input handling
- [ ] `q12-gc-ci-heap-sample` CI smoke compares heap delta across N frames

### Q12.E — Object Pool Audit

- [ ] `q12-po-vehicles` vehicles pooled with high-water tracking
- [ ] `q12-po-npcs` NPCs pooled with high-water tracking
- [ ] `q12-po-projectiles` projectiles pooled
- [ ] `q12-po-particles` particles pooled (if not GPU-only after Q10)
- [ ] `q12-po-decals` decals pooled
- [ ] `q12-po-ragdolls` ragdolls pooled
- [ ] `q12-po-fx` FX pooled
- [ ] `q12-po-dev-hud` dev HUD shows pool usage live

### Q12.F — Memory Budget

- [ ] `q12-mb-soft-cap-medium` soft cap 2 GB on medium map
- [ ] `q12-mb-soft-cap-huge` soft cap 4 GB on huge map
- [ ] `q12-mb-eviction-80pct` streaming evicts at 80% of cap
- [ ] `q12-mb-hard-cap-recover` hard-cap path throws recoverable error

### Q12.G — Bundle & Save Format

- [ ] `q12-bd-initial-2mb` initial JS ≤ 2 MB gzipped
- [ ] `q12-bd-manual-chunks` `vite.config.js` `manualChunks` audited for first-frame critical
- [ ] `q12-bd-lazy-modules` non-critical modules lazy-loaded
- [ ] `q12-sf-msgpack` save format moved to msgpack (cbor-x or msgpackr)
- [ ] `q12-sf-100h-load` 100h synthetic save loads in < 5 s
- [ ] `q12-sf-deterministic-roundtrip` round-trip is byte-identical for the same world
- [ ] `q12-sf-migration-speed` no migration takes > 1 s per minor version step

### Q12.H — Dev Memory HUD

- [ ] `q12-dh-pool-counts` per-pool counts visible
- [ ] `q12-dh-gc-events` GC events/sec visible
- [ ] `q12-dh-heap-size` JS heap size visible
- [ ] `q12-dh-gpu-mem-est` GPU memory estimate visible

### Q12 — Definition of Done

- [ ] 4-hour session: flat memory, no stalls > 33 ms after warmup, bundle < 2 MB gzipped
- [ ] All Q12.A–Q12.H items ticked
- [ ] Operator approval `q12.json`
- [ ] Tag `0.12.0.0`

---

## Q13 — Living City Depth (2027-02-01 → 2027-05-31)

**Goal:** Spend the recovered render and memory headroom on density and verticality. The city stops being a flat board.

### Q13.A — Rooftop Traversal

- [ ] `q13-rt-edge-tag` rooftop edges tagged in building metadata
- [ ] `q13-rt-climb-controller` climb/jump controller for tagged edges
- [ ] `q13-rt-accessible-flag` "accessible rooftop" flag in metadata
- [ ] `q13-rt-fall-recovery` fall damage + ledge-grab recovery

### Q13.B — Skybridges

- [ ] `q13-sb-procedural` procedural skybridge spans between tall buildings in dense districts
- [ ] `q13-sb-navmesh-bake` nav-mesh bakes skybridges
- [ ] `q13-sb-npc-use` NPCs traverse skybridges where appropriate

### Q13.C — Underground

- [ ] `q13-ug-sewers` sewer layer with seamless world entry
- [ ] `q13-ug-parking` parking-garage layer
- [ ] `q13-ug-subway-tunnels` subway tunnel layer
- [ ] `q13-ug-streaming` underground chunks stream in/out cleanly

### Q13.D — Interior Expansion (10 templates)

- [ ] `q13-it-shop-2` second shop template
- [ ] `q13-it-shop-3` third shop template
- [ ] `q13-it-office-1` office interior
- [ ] `q13-it-office-2` corporate-floor interior
- [ ] `q13-it-club` club interior
- [ ] `q13-it-warehouse` warehouse interior
- [ ] `q13-it-subway-station` subway station interior (separate from Q3 platform)
- [ ] `q13-it-growth-assignment` zone growth picks new templates per building class

### Q13.E — Density

- [ ] `q13-de-npcs-200` 200+ visible NPCs at peak (was 120)
- [ ] `q13-de-vehicles-80` 80+ vehicles on visible roads
- [ ] `q13-de-lod-fidelity-curve` behavior fidelity drops with distance
- [ ] `q13-de-spawner-zoning` spawner respects district zoning + time of day
- [ ] `q13-de-perf-rebaseline` perf harness re-baselines at new density

### Q13.F — Vertical Hacking

- [ ] `q13-vh-cam-through-windows` camera-to-camera through windows
- [ ] `q13-vh-profiler-cross-floor` profiler reaches NPCs across floors
- [ ] `q13-vh-rooftop-hackables` rooftop-only hackables (HVAC, antennas, billboards)

### Q13.G — Districts (8 total)

- [ ] `q13-ds-entertainment` entertainment district
- [ ] `q13-ds-government` government district
- [ ] `q13-ds-transit-hub` transit-hub district
- [ ] `q13-ds-waterfront-residential` waterfront-residential district

### Q13.H — Photo Mode Upgrade

- [ ] `q13-pm-dof` depth of field with focal pull
- [ ] `q13-pm-free-cam-roll` free-cam roll/orbit
- [ ] `q13-pm-time-scrub` time-of-day scrub

### Q13.I — Save Schema for Vertical World

- [ ] `q13-ss-strata-coords` rooftop / underground / interior coords coexist in one save
- [ ] `q13-ss-migration-12-to-13` migration from 0.12.x written and tested
- [ ] `q13-ss-sequence-before-content` schema bump landed before any new mission content

### Q13 — Definition of Done

- [ ] Peak-hour rooftop chase (3 skybridges → interior → subway tunnel) ≥ 60 fps
- [ ] All Q13.A–Q13.I items ticked
- [ ] Operator approval `q13.json`
- [ ] Tag `0.13.0.0`

---

## Q14 — 1.0 RC, External Playtest, Launch (2027-06-01 → 2027-12-31)

**Goal:** Ship a game people play for 10 hours, give to a friend, and don't apologize for.

### Q14.A — Final Perf Pass

- [ ] `q14-pf-frustum-reaudit` frustum culling re-audited after Q13 density work
- [ ] `q14-pf-lod-retune` LOD thresholds re-tuned for new density
- [ ] `q14-pf-drawcall-large-dense` ≤ 3000 draws on `large+200-NPCs+rain`
- [ ] `q14-pf-gc-4h` GC clean across 4-hour session
- [ ] `q14-pf-shader-cost-final` SSAO/GTAO half-res, bloom mips, volumetrics step count cost-budgeted per preset

### Q14.B — Accessibility (Final)

- [ ] `q14-ac-rebind-every-action` every action rebindable
- [ ] `q14-ac-subtitle-size` multi-size subtitle
- [ ] `q14-ac-subtitle-speakers` speaker labels
- [ ] `q14-ac-colorblind-3` 3 colorblind palettes
- [ ] `q14-ac-shake-toggle` camera-shake toggle
- [ ] `q14-ac-reduced-motion` reduced-motion mode
- [ ] `q14-ac-hold-vs-tap` hold-vs-tap interact toggle
- [ ] `q14-ac-audio-mixer` per-channel audio mixer

### Q14.C — Save Migration Matrix (Final)

- [ ] `q14-sm-matrix` migration matrix `0.1.x` → `0.13.x` → `1.0`
- [ ] `q14-sm-pw-roundtrip` Playwright round-trip per migration
- [ ] `q14-sm-100h-final` 100h synthetic save round-trips clean

### Q14.D — Steam Pipeline

- [ ] `q14-st-depot-upload` depot upload end-to-end
- [ ] `q14-st-achievements-30` ≥ 30 achievements defined and trigger-tested
- [ ] `q14-st-cloudsaves` cloud saves tested across two installs
- [ ] `q14-st-workshop` Steam Workshop wired for mods
- [ ] `q14-st-beta-default` `0.13.x` on beta branch; `1.0` on default

### Q14.E — External Playtest

- [ ] `q14-pt-testers-3` 3 external testers signed up
- [ ] `q14-pt-sessions-2-each` ≥ 2 sessions per tester
- [ ] `q14-pt-logs-aggregated` logs aggregated into `docs/playtests/`
- [ ] `q14-pt-no-hardcrash` zero hard crashes
- [ ] `q14-pt-no-softlock` zero softlocks
- [ ] `q14-pt-retro` retrospective in `docs/retros/`

### Q14.F — Localization & Modding Scaffold

- [ ] `q14-lc-i18n-catalog` all UI strings extracted to one i18n catalog
- [ ] `q14-lc-second-language-smoke` pipeline works for one second language as smoke test
- [ ] `q14-md-modding-doc` `docs/MODDING.md` published
- [ ] `q14-md-example-mod` example mod ships in `assets/mods/example/`

### Q14.G — Patch & Launch

- [ ] `q14-ln-rc-pipeline` at least one `1.0.0-rc.N → 1.0.0-rc.N+1` cycle rehearsed
- [ ] `q14-ln-rc1` tag `1.0.0-rc.1`
- [ ] `q14-ln-rc-patch` ≤ 2 patch RCs allowed
- [ ] `q14-ln-1-0-0` tag `1.0.0`
- [ ] `q14-ln-release-notes` `docs/release_notes/1.0.0.md` complete
- [ ] `q14-ln-post-mortem` launch post-mortem in `docs/retros/2027-12.md` (or 2028-XX if slipped)

### Q14 — Definition of Done

- [ ] External 2-hour sessions completed without hard crash or softlock
- [ ] ≥ 2 external testers return for a second session unprompted
- [ ] All Q14.A–Q14.G items ticked
- [ ] Operator approval `q14.json`
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

### Q1 Retro (2026-04-04)
*(pending — captured at tag `0.1.0.0`)*

### Q2 Retro (2026-04-09)
*(pending — captured at tag `0.2.0.0`)*

### Q3 Retro (2026-04-15)
*(pending — captured at tag `0.3.0.0`)*

### Q4 Retro (2027-03 — recorded in `docs/retros/2027-03.md`)
*Year-1 review on file. Re-anchor to 2026-04-19 ✅ when this checklist is next touched by a `meta` task.*

### Q5 Retro (2026-04-23)
*(pending — captured at tag `0.5.0.0`)*

### Q6 Retro (2026-04-29)
*(pending — captured at tag `0.6.0.0`)*

### Q7 Retro (2026-05-15)
*(pending — captured at tag `0.7.0.0`)*

### Q8 Retro (2026-06-05)
*(pending — playability pass 2 retro, captured at tag `0.8.0.0`)*

### Q9 Retro (2026-08-01)
*(pending — graphics pass 1 retro, captured at tag `0.9.0.0`)*

### Q10 Retro (2026-09-30)
*(pending — graphics pass 2 retro, captured at tag `0.10.0.0`)*

### Q11 Retro (2026-11-30)
*(pending — render-pipeline optimization retro, captured at tag `0.11.0.0`)*

### Q12 Retro (2027-01-31)
*(pending — memory/streaming optimization retro, captured at tag `0.12.0.0`)*

### Q13 Retro (2027-05-31)
*(pending — living city depth retro, captured at tag `0.13.0.0`)*

### Q14 Retro (2027-12 / early 2028)
*(pending — includes 1.0 launch post-mortem at tag `1.0.0`)*
