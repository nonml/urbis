# Urbis roadmap

Owner: Claude, game director. Last set 2026-10-02. Every worker reads this before
`docs/handoff/`. A phase is done when its **exit test** passes, never when its task
list is empty.

The game: **build a city, then live in it.** Every new game generates a new city
(`AGENTS.md`). Quality is judged by the six pillars in `AGENTS.md`, played by bots
(`npm run scorecard`, `docs/scorecard/latest.md`). Nobody hand-tests.

## Phase 1: the loop works on any city (greybox)

Plain-box art is fine. No new art work starts until this exit test passes.

| Workstream | Owner brief | Pillar |
|---|---|---|
| New game generates the whole city: roads, lots, buildings, doors, signs | `procgen-*` (to be merged into one feature brief) | all |
| Walk into what you zoned | `feature-interiors.md` | Build it, live in it |
| Save, continue, New Game | `feature-saves.md` | The player feels capable |
| Bots play the pillars every round | `feature-scorecard.md` | all |

**Exit test:** the scorecard is all ✅ on 5 random seeds, `npm run check:layouts` reports
zero buildings overlapping or on a road across 20 seeds, and the gate is green.

## Phase 2: vertical slice

One generated district at final look: materials, props, lighting and sound (there is
no audio yet). Twenty minutes of the full loop: zone, watch it grow, walk, drive,
enter, hack, and save.

**Exit test:** the scorecard is all ✅, the contact sheet passes a director review
against `docs/VISUAL-GAPS.md`, and draws stay ≤ 175 everywhere.

## Phase 3: production

More districts (`docs/BACKLOG.md` "World depth"), more interior templates, missions
and arc content, verticality, underground.

**Exit test:** each new district or system enters with its own scorecard row green.

## Phase 4: alpha → beta → release

- **Alpha:** every feature exists.
- **Beta:** content complete, then bug fixing only.
- **Release:** accessibility, Steam (`docs/BACKLOG.md` "Ship readiness").

## Rhythm

- **Every change:** `npm run gate`.
- **Every merge round:** `npm run scorecard`. Workers are pointed at the ❌ rows, and
  the director reviews the contact sheet against the previous round.
- **Phase end:** the exit test above decides go or no-go. Nothing else does.
