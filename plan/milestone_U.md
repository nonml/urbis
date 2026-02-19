# Milestone U — Release 1.0.0 (Ship, Support, Post-Launch Plan) (target: 1.0.0)

## Objective 🎯
- Finalize quality, performance, content, and packaging for a public 1.0 release.
- Lock save schema, publish release notes, and define post-launch support.
- Deliver a build that is stable across Small → MEGA for typical sessions.

---

## Milestone Exit Criteria (Acceptance)
- ✅ 0 S0 (crash) bugs open; S1 < 2 with documented workarounds.
- ✅ MEGA 60-minute soak test passes without memory leak or severe perf collapse.
- ✅ Core promise is met: dual-mode (God/Street), procedural cities, emergent crises, influence layer, and campaign/cases.
- ✅ Build artifacts include licenses/credits and show version 1.0.0 in UI.


## Definition of Done (DoD)
- Release checklist completed and stored with build artifact.
- Save schema locked; migration path documented for future patches.
- Post-launch patch plan created (1.0.1 hotfix scope).


---

## Phases
1) Release candidate hardening
2) Final QA + compliance
3) Launch packaging
4) Post-launch readiness


---

## Tickets

### U-01 — Release candidate checklist + final bug triage
**Objective:** Turn beta into release quality.

**Design**
- Define RC gates and freeze rules.
- Only bug fixes allowed; no new features.


**Specs**
- `docs/RELEASE_CHECKLIST.md` (final)
- `docs/RC_GATES.md`


**Implementation details**
1. Run RC gate checklist on 3 presets and 5 seeds.
2. Triage remaining issues and fix S0/S1 first.
3. Lock branches/tags for RC.


**Acceptance**
- All RC gates pass on at least 2 browsers.
- No new regressions introduced during freeze.


**DoD**
- Checklist results archived with version tag.


---

### U-02 — Final performance certification (Small/City/Mega)
**Objective:** Ensure minimum playable performance on target hardware.

**Design**
- Define budgets and collect measurements using perf overlay and telemetry.
- Provide graphics settings that scale down cleanly.


**Specs**
- `docs/PERF_TARGETS.md`
- Settings presets: Low/Medium/High


**Implementation details**
1. Benchmark presets and record results.
2. Tune LOD and sim chunking thresholds.
3. Fix remaining hot spots discovered.


**Acceptance**
- Performance targets met or documented with settings guidance.
- No frame-time spikes that break controls in normal play.


**DoD**
- Perf targets referenced in release notes.


---

### U-03 — Legal/credits/licenses packaging
**Objective:** Ship responsibly and avoid asset/license issues.

**Design**
- Credits screen lists contributors and third-party libs.
- Licenses included in build artifact.


**Specs**
- `CREDITS.md`
- `LICENSES/` folder in build
- `src/ui/credits.js`


**Implementation details**
1. Generate third-party license list (manual ok).
2. Add credits UI screen from main menu.
3. Verify all assets have license notes in manifest.


**Acceptance**
- Credits screen accessible and complete.
- License files included in distribution.


**DoD**
- No unknown-license assets shipped.


---

### U-04 — Release notes + changelog finalization
**Objective:** Communicate what 1.0 is and set expectations.

**Design**
- Keep a Changelog format; add 'Known Issues' section.
- Include concept statement: dual-mode city builder + influence sim.


**Specs**
- `CHANGELOG.md` updated for 1.0.0
- `docs/KNOWN_ISSUES.md` final


**Implementation details**
1. Write 1.0.0 notes with feature list and limitations.
2. Summarize content counts and performance guidance.
3. Include troubleshooting section.


**Acceptance**
- Release notes match shipped feature set.
- Known issues list is accurate.


**DoD**
- Notes reviewed by at least 2 devs (process requirement).


---

### U-05 — Post-launch plan (1.0.1 hotfix + 1.1 roadmap)
**Objective:** Be ready for inevitable bugs and feedback.

**Design**
- Define hotfix scope: crashers, save corruption, major perf regressions.
- Define triage timeline and versioning scheme.


**Specs**
- `docs/POST_LAUNCH.md`
- Issue labels and severity guidelines referenced.


**Implementation details**
1. Create hotfix checklist and quick RC process.
2. Define telemetry/bug report intake workflow.
3. Draft 1.1 feature candidates (not committed to).


**Acceptance**
- Team can ship a 1.0.1 hotfix in a predictable process.
- Roadmap exists and is realistic.


**DoD**
- Post-launch doc included in repo.


---
