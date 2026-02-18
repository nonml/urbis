# Milestone H — 1.3.0: Replayability Boost (Challenges + Photo + Replay)

## Objective 🎥
Make runs more shareable and “Watch Dogs vibe” friendly:
- Weekly/rotating challenge framework (offline-first)
- Photo mode + cinematic camera tools
- Replay/ghost of your run (lightweight)
- More emergent moments surfaced (city “news feed”)

---

## Exit Criteria (Acceptance)
- ✅ Challenge mode exists with rotating presets (seed + rules)
- ✅ Photo mode can capture and export an image (client-side)
- ✅ Replay captures last N minutes of key events (not full deterministic replay)
- ✅ A “city news feed” surfaces notable events without spamming

## DoD
- No online services required (offline-first)
- Features are optional and do not affect core sim determinism
- MEGA performance not regressed

---

## Phases
1) **Challenges framework**
2) **Photo/cinematic tools**
3) **Replay/event capture**
4) **Presentation (news feed) + polish**

---

## Tickets

### H-01 — Challenge presets + rules engine
**Phase:** 1 — Challenges framework
**Objective:** Add structured replayable scenarios.

**Design**
- Challenge preset defines:
  - seed, preset, difficulty
  - starting resources
  - extra rules (e.g., “no farms”, “crisis rate x2”, “must reach pop 200 by day 40”)

**Specs**
- `src/challenges/challenges.json`
- `src/challenges/challenge_manager.js`

**Implementation details**
1. Implement rule checks that run each tick and produce pass/fail.
2. Add UI to select a challenge and start a run.
3. Store best results locally.

**Acceptance**
- At least 5 challenge presets ship.

**DoD**
- Challenges never modify RNG ordering; they only read state.

---

### H-02 — Local leaderboard + run summary
**Phase:** 1 — Challenges framework
**Objective:** Encourage replay without servers.

**Design**
- Save best run summaries per challenge:
  - day reached, population, resources, completion time
- Display top 10 locally.

**Specs**
- `src/challenges/leaderboard.js` (localStorage backed)

**Implementation details**
1. Implement serialization of run summary.
2. Implement UI list with sorting.

**Acceptance**
- Completing a challenge records a run and shows it in leaderboard.

**DoD**
- Leaderboard does not grow unbounded (cap entries).

---

### H-03 — Photo mode (free camera + hide HUD)
**Phase:** 2 — Photo/cinematic tools
**Objective:** Shareable visuals.

**Design**
- Photo mode:
  - toggles free camera controls
  - hide HUD toggle
  - field-of-view slider
  - screenshot button

**Specs**
- `src/ui/photo_mode.js`
- Screenshot uses `renderer.domElement.toDataURL()`.

**Implementation details**
1. Add keybind (e.g., `F9`) to toggle photo mode.
2. Disable sim input while in photo mode.
3. Provide a small UI panel for settings and capture.

**Acceptance**
- Player can export a PNG without dev tools.

**DoD**
- Photo mode exits cleanly and restores camera.

---

### H-04 — Cinematic camera presets (walk, orbit, follow)
**Phase:** 2 — Photo/cinematic tools
**Objective:** Make camera motion look intentional.

**Design**
- Presets:
  - slow follow
  - orbit around point
  - dolly path (simple spline)

**Specs**
- `src/camera/cinematic.js`

**Implementation details**
1. Implement a small state machine for camera modes.
2. Add UI to select and tweak parameters.

**Acceptance**
- Orbit preset works on any POI/building.

**DoD**
- Camera modes are deterministic given same inputs.

---

### H-05 — Event capture buffer (last N minutes)
**Phase:** 3 — Replay/event capture
**Objective:** Provide a “replay” feel without full deterministic playback.

**Design**
- Capture a ring buffer of:
  - player positions (downsampled)
  - key events (build, crisis, quest step)
  - screenshots optionally (disabled by default)

**Specs**
- `src/replay/event_buffer.js`
- Default: keep last 5 minutes.

**Implementation details**
1. Sample player transform every X frames.
2. Push discrete events from systems into buffer.
3. Add UI to scrub timeline and jump camera to recorded points.

**Acceptance**
- Player can review last 5 minutes and jump to major events.

**DoD**
- Buffer memory bounded and tested on MEGA.

---

### H-06 — City news feed (story surfacing)
**Phase:** 4 — Presentation (news feed) + polish
**Objective:** Surface emergent moments in a readable way.

**Design**
- News feed cards for:
  - major crisis triggered/resolved
  - case progress
  - district modifier changes
  - “citizen spotlight” (notable relationship event)

**Specs**
- `src/ui/news_feed.js`
- Rate limiting: max 1 card per in-game day (configurable).

**Implementation details**
1. Add event bus that emits “notable events”.
2. Feed subscribes and formats cards.
3. Add filters to hide categories.

**Acceptance**
- Feed provides useful context without spam.

**DoD**
- Feed formatting consistent and localizable later.

---

### H-07 — Shareable run summary export
**Phase:** 4 — Presentation (news feed) + polish
**Objective:** Make sharing runs easy.

**Design**
- Export a summary JSON:
  - seed, preset, mods, outcomes, screenshots list (optional)
- Provide “copy to clipboard” and “download summary”.

**Specs**
- `src/share/run_summary.js`

**Implementation details**
1. Implement serializer for run summary.
2. Add UI button in end screen.

**Acceptance**
- Exported summary can be imported to reproduce the run setup.

**DoD**
- Export respects privacy (no personal data).

---

### H-08 — Polish pass + QA gates
**Phase:** 4 — Presentation (news feed) + polish
**Objective:** Ship 1.3.0 cleanly.

**Design**
- Extend release checklist with:
  - photo mode
  - challenges
  - replay buffer
  - news feed

**Specs**
- `docs/RELEASE_CHECKLIST.md` updated
- Add 5 new reference seeds for challenge mode.

**Implementation details**
1. Run QA checklist across Small/City/MEGA.
2. Record results in `qa_runs/` and fix regressions.

**Acceptance**
- No crashes during 30-min MEGA challenge play.

**DoD**
- 1.3.0 patch notes prepared.