# Milestone D — Rival AI + Progression + Win/Lose (target: 0.10.x / pre-1.0)

## Objective 🤖
Add the “adversarial city controller” and define the actual game:
- Rival AI applies pressure and counters your strategy
- Progression/unlocks give long-term goals
- Multiple victory conditions (economic / stability / influence)
- Failure states (collapse, takeover, runaway crisis)

---

## Milestone Exit Criteria (Acceptance)
- ✅ Rival AI exists and acts at least every N ticks
- ✅ Rival actions are readable (telegraphed to player) and counterable
- ✅ Player can win/lose a run with clear screens and stats
- ✅ Difficulty scaling works across Small → MEGA

## DoD
- Rival does not soft-lock the game (always counterplay)
- Rival decisions deterministic per seed (plus your actions)

---

## Phases
1) Rival model + telemetry
2) Counter-systems (heat, security, public opinion)
3) Progression & win/lose
4) Balance

---

## Tickets

### D-01 — Rival AI model (goals + budget + actions)
**Phase:** 1 — Rival model + telemetry
**Objective:** A consistent “opponent” that reacts.

**Design**
- Rival has:
  - `influence`, `budget`, `heat`, `intel`
- Chooses one action from a deck based on city state.

**Specs**
- `state.rival = { influence, budget, heat, lastActionTick, ... }`
- `src/sim/rival/rival_ai.js`

**Implementation details**
1. Define action catalog:
  - sabotage grid, spread propaganda, poach workers, trigger gang activity
2. Action selection uses weighted utility:
  - respond to your strengths (if economy booming → sabotage trade)
3. Apply action with clear player notification.

**Acceptance**
- Rival performs at least 3 distinct actions in a 15-min run.

**DoD**
- Rival actions logged to history with timestamps and causes.

---

### D-02 — Heat / Wanted / Exposure system
**Phase:** 2 — Counter-systems
**Objective:** Give consequences to hacking + aggressive play.

**Design**
- Player generates “heat” by hacking frequently or choosing extreme options.
- High heat increases:
  - police presence (movement penalty)
  - rival aggression
  - chance of certain crises.

**Specs**
- `state.player.heat`
- Decay over time; reduced by certain buildings/policies.

**Implementation details**
1. Add heat gain to hacking nodes and case outcomes.
2. Add UI meter + warnings.

**Acceptance**
- Heat changes gameplay (not just a number).

**DoD**
- Heat is deterministic and saved/loaded.

---

### D-03 — Security & countermeasures
**Phase:** 2 — Counter-systems
**Objective:** Counterplay to rival.

**Design**
- Buildings/policies that reduce vulnerabilities:
  - CCTV upgrades
  - grid redundancy
  - social programs
  - anti-corruption offices

**Specs**
- Add building upgrades: `level 1..3`
- `BUILDING_TYPES` extended with upgrade effects.

**Implementation details**
1. Implement upgrade costs + effects.
2. Rival action success chance reduced by defenses.

**Acceptance**
- Player can meaningfully reduce impact of at least 2 rival actions.

**DoD**
- Upgrade UI and save schema updated.

---

### D-04 — Progression & unlocks
**Phase:** 3 — Progression & win/lose
**Objective:** Long-term motivation within a run.

**Design**
- Unlocks triggered by:
  - district stability
  - completed case files
  - tech tree points

**Specs**
- `state.progression = { unlocked: [], points: ... }`
- UI screen “Tech” toggle: `T`

**Implementation details**
1. Define unlock catalog in content JSON.
2. Apply unlock effects to available buildings/hacks.

**Acceptance**
- Completing a case unlocks a new capability.

**DoD**
- Unlocks persist through save/load and are deterministic.

---

### D-05 — Win/Lose conditions + end screens
**Phase:** 3 — Progression & win/lose
**Objective:** Define “what is a run”.

**Design**
- Victory conditions (choose at run start):
  - Economic: reach X income and keep stability for Y days
  - Influence: complete main case + reach influence threshold
  - Stability: survive Z days with low crisis severity
- Failure:
  - bankruptcy, population collapse, takeover by rival

**Specs**
- `state.runGoals`
- `src/sim/run_conditions.js`

**Implementation details**
1. Add goal picker UI at start.
2. Evaluate each tick; if met, pause and show end screen.

**Acceptance**
- A run can end with clear “You Win/You Lose” and stats summary.

**DoD**
- End screens show replay seed and major choices.

---

### D-06 — Balance pass (economy, crisis, rival)
**Phase:** 4 — Balance
**Objective:** Make the game “playable”, not chaotic.

**Design**
- Tune:
  - production rates
  - citizen needs
  - crisis thresholds
  - rival pacing
- Use 10 fixed seeds for regression.

**Specs**
- `docs/BALANCE_SEEDS.md` with 10 seeds and expected outcomes.

**Implementation details**
1. Add a “simulate 5 minutes fast” dev tool.
2. Adjust constants iteratively.

**Acceptance**
- Small and Mega both feel fair and winnable.

**DoD**
- Balance changes documented with rationale.
