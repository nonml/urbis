# M32 — Cheats

From: `docs/plan/features/mechanics.md` GAP-20-002 to GAP-20-010. M17-12, M18's cheats and
M26-10 add cheats for moves, vehicles and the world, each dialled on M27's phone; M32
adds the other two ways the street games take cheats (typed words and pad sequences) and
the player cheats GTA has had since its first games. Pillar: chaos has an author.

Needs first: M17-12 (the first cheats and their rule), M13 (weapons, armour, damage),
M27-1 (the phone's dialler), M29-13 (achievements). Lane: street.

## Keys

None new. A cheat is typed as a word on the keyboard during play, entered as a sequence on
a pad, or dialled on the phone; the game takes the last 20 keys and matches them.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M32-1 | **Three ways in:** every cheat (M17-12, M18, M26-10 and here) has a word, a pad sequence and a phone number, listed in `content/cheats.json`; entering one shows its name and "cheat on"; each word typed during play is matched without opening anything; a cheat found is added to a list in the pause menu | `tests/m32-cheats.test.js`, `tests/accept/m32-entry.spec.js` | partial: M17-12 plans phone numbers | GAP-20-002 |
| M32-2 | **Player cheats:** bulletproof for 5 minutes; full health and armour; every weapon slot filled with ammo; explosive bullets; bullets that set targets alight; punches and melee hits that explode; running and swimming twice as fast; slow motion for the world around the player while they move at normal speed | `tests/accept/m32-player.spec.js` | red | GAP-20-003, GAP-20-004, GAP-20-005, GAP-20-006, GAP-20-007, GAP-20-008, GAP-20-009, GAP-20-010 |
| M32-3 | **The rule:** any cheat turns achievements off until the next load (M29-13) and the save says so; cheats are off online (M30-1) | `tests/accept/m32-rule.spec.js` | partial: M17-12 states it | — |
| M32-4 | The sweep of every cheat, each way in, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M32.T1 | **Checks, red.** `m32-cheats.test.js`, `m32-entry.spec.js`, `m32-player.spec.js`, `m32-rule.spec.js` | new `tests/m32-cheats.test.js`, new `tests/accept/m32-entry.spec.js`, new `tests/accept/m32-player.spec.js`, new `tests/accept/m32-rule.spec.js` | M17.T16 | M32-1 to M32-3 red | S |
| M32.T2 | **Entry.** Words, pad sequences and numbers for every cheat; the matcher; the found list | `src/sim/cheats.js`, `content/cheats.json`, `src/game/input.js`, `src/ui/pause.js` | M32.T1 | M32-1 | S |
| M32.T3 | **Player cheats.** The eight, through the weapons, health and clock | `src/sim/cheats.js`, `src/sim/weapons.js`, `src/sim/health.js`, `src/sim/clock.js` | M32.T2, M13.T3, M13.T7 | M32-2 | M |
| M32.T4 | **The rule** and **close.** Achievements off and the save's note; off online; the sweep; one commit per defect | `src/sim/achievements.js`, `src/sim/save.js`, the sweep | M32.T3, M29.T17 | M32-3, M32-4 | S |

## Decisions for the operator

None.
