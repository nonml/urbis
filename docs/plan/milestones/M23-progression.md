# M23 — Progression

From: `docs/plan/features/mechanics.md` GAP-11-003 to GAP-11-023 (GAP-11-002 and
GAP-11-004 are M14's; GAP-11-013 and GAP-11-024 are M33's); `docs/plan/CAPABILITIES.md`
C7 and G22, and D9's combat skills. M11's cred stays: it is the street's standing and
unlocks gigs and hacks. M23 adds what the three street games and Skylines II grow beside
it: a level, five attributes, perk trees, skills that grow with use, a body that changes
with how it is used, upgrades, a city that earns development points, a completion list,
and a new game that keeps what was earned. Pillars: every tool is expressive; the long
game (poke the city and watch) has things to grow.

Needs first: M11-5 (cred), M13 (weapons and the gym), M17 (moves, stamina), M18
(driving, flying), M20 (hacks), M21-10 (dialogue checks), M5-12 (the city's milestones).
Lane: street, with M23-7 in lane: city.

## Keys

- **P** opens the character screen: level, attributes, perks, skills, body, stats and the
  completion list. Esc closes it.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M23-1 | **Level:** the player has a level from 1 to 60 and experience from every act in `PROGRESSION.md` (missions, gigs, hacks, fights, races, crimes stopped); an objective done unseen gives 25% more. Each level gives an attribute point and a perk point. Enemies' health and aim and loot's grade scale with the player's level within a band set by the district, so a poor district stays easy *(provisional)* | `tests/m23-level.test.js` | red: cred only (M11-5) | GAP-11-016, GAP-11-017, GAP-11-022 |
| M23-2 | **Attributes:** five (body, reflexes, technical, intelligence, cool), each 3 to 20, raised with points or training manuals found in the city. Each changes numbers in `PROGRESSION.md` (body: health and melee; reflexes: aim and dodge; technical: gadgets and doors; intelligence: hacks and battery; cool: stealth and nerve). Checks in dialogue (M21-10) and doors use them: a body door is forced, a technical door is wired; other doors need a keycard (carried by a guard or found) or a code (in a note, an email or footage). A full reset refunds every point once per game day | `tests/m23-attributes.test.js`, `tests/accept/m23-doors.spec.js` | red | GAP-11-019, GAP-20-013 |
| M23-3 | **Perk trees:** one tree per attribute, 15-20 perks each, laid out by discipline (pistols, shotguns, rifles, automatic weapons, blades, explosives; Focus; stealth; driving; hacking; the body's adrenaline and landings; movement). Each perk names its number in `PROGRESSION.md`, and a Node test checks each against B. A perk can be refunded | `tests/m23-perks.test.js` | red | GAP-11-018 |
| M23-4 | **Skills grow with use:** swimming, lung capacity, stamina, strength, driving, riding, flying, shooting per weapon class, and stealth each rise 0-100 as the player does them, and each raises its own numbers (lung capacity: M17-8's breath from 30 s to 90 s; driving: grip and recovery; flying: steadiness; per weapon: recoil and reload). Gym equipment raises strength and stamina in sessions. Respect rises with reputation (M21-5) and changes how gangs answer | `tests/m23-skills.test.js` | red | GAP-11-007, GAP-11-020, GAP-13-001 |
| M23-5 | **The body changes:** food and drink raise fat; running, swimming and cycling burn it; gym work raises muscle. Fat and muscle change the player's body shape (M25's body) and their speed and strength; a sex-appeal score from clothes, body and car changes partners' answers (M21-8) | `tests/m23-body.test.js`, `tests/accept/m23-body.spec.js` | red | — |
| M23-6 | **Upgrades and gates:** cred and points buy upgrades: battery capacity in tiers, more ₡ from hacked ATMs, longer disabling of a hijacked helicopter, and others in `PROGRESSION.md`. Some upgrades stay locked until a side activity is done or a hidden data stash is found (M24's collectibles), and the lock says which | `tests/m23-upgrades.test.js` | red: cred tiers unlock hacks (M11-5) | GAP-11-009, GAP-11-010, GAP-11-011, GAP-11-012 |
| M23-7 | **The city's development points:** the city earns experience from growth, and each building earns its own as it is used; points are spent on an unlock tree of services, roads and policies in branches (M5-12's milestones become its spine). A/B: two branches give different tool sets after the same growth | `tests/m23-devtree.test.js` | red: population tiers unlock tools (M5-12) | GAP-11-003, GAP-11-005 |
| M23-8 | **Streaks and adrenaline:** 3 kills within 10 s give a stacking buff (faster reload, less spread) for 8 s; an adrenaline bar fills with hits taken and given and is spent with Caps Lock (M13-21); body perks make it heal | `tests/accept/m23-streak.spec.js` | red | GAP-11-021 |
| M23-9 | **Uprisings:** each district has a meter that fills with small defiance jobs (a poster, a hacked screen, a rescued person) and the player's acts against the gang or security firm that holds it (M19); full, it unlocks an uprising mission (M24) whose win frees the district: their checkpoints go and the people greet the player | `tests/accept/m23-uprising.spec.js` | red | GAP-11-014, GAP-12-036, GAP-12-077 |
| M23-10 | **Completion and stats:** the character screen lists every task that counts toward 100% (missions, gigs kinds, collectibles, schools, races, businesses, the city's milestones) and its percentage; lifetime counters keep distance on foot and in each vehicle, shots, kills, ₡ earned and spent, buildings built, and 30 more in `PROGRESSION.md` | `tests/accept/m23-completion.spec.js` | red | GAP-11-006, GAP-11-008, GAP-15-003 |
| M23-11 | **After the end:** after the arc's ending (M24) the player returns to the city before the last mission, keeping every reward; a new game plus starts a new city from a new seed and keeps level, perks, skills, weapons and ₡ | `tests/accept/m23-ngplus.spec.js` | red | GAP-11-015, GAP-11-023 |
| M23-12 | A saved game keeps level, attributes, perks, skills, body, upgrades, the city's points and tree, every district's meter, completion and stats, and continues the same | `tests/accept/m23-save.spec.js` | red | — |
| M23-13 | The sweep of the character screen, level-ups, the body's shapes and the city's tree has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M23.T1 | **Checks, red.** `m23-level.test.js`, `m23-attributes.test.js`, `m23-doors.spec.js`, `m23-perks.test.js`, `m23-skills.test.js`, `m23-body.test.js`, `m23-body.spec.js` | new `tests/m23-level.test.js`, new `tests/m23-attributes.test.js`, new `tests/accept/m23-doors.spec.js`, new `tests/m23-perks.test.js`, new `tests/m23-skills.test.js`, new `tests/m23-body.test.js`, new `tests/accept/m23-body.spec.js` | M11.T15 | M23-1 to M23-5 red | S |
| M23.T2 | **Checks, red.** `m23-upgrades.test.js`, `m23-devtree.test.js`, `m23-streak.spec.js`, `m23-uprising.spec.js`, `m23-completion.spec.js`, `m23-ngplus.spec.js`, `m23-save.spec.js` | new `tests/m23-upgrades.test.js`, new `tests/m23-devtree.test.js`, new `tests/accept/m23-streak.spec.js`, new `tests/accept/m23-uprising.spec.js`, new `tests/accept/m23-completion.spec.js`, new `tests/accept/m23-ngplus.spec.js`, new `tests/accept/m23-save.spec.js` | M23.T1 | M23-6 to M23-12 red | S |
| M23.T3 | **`PROGRESSION.md`.** Every experience source, attribute effect, perk, skill, upgrade and counter, with its number | new `docs/PROGRESSION.md` | M23.T1 | M23-1 (part), M23-2 (part), M23-3 (part) | M |
| M23.T4 | **Level and experience.** Sources, the unseen bonus, points per level, scaling by district band | new `src/sim/progression.js`, `src/sim/combatai.js`, `src/sim/arsenal.js` | M23.T3, M13.T28 | M23-1 | M |
| M23.T5 | **Attributes.** Points, manuals, effects, dialogue and door checks, the reset | `src/sim/progression.js`, `src/sim/talk.js`, `src/sim/interior.js` | M23.T4, M21.T14 | M23-2 | M |
| M23.T6 | **Perk trees.** Five trees in `perks.json`; each perk's hook; refunds; `m23-perks.test.js` passes | new `src/content/perks.json`, `src/sim/progression.js`, `src/sim/weapons.js`, `src/sim/vehicle.js`, `src/sim/hackables.js` | M23.T5 | M23-3 | M |
| M23.T7 | **Skills by use and the gym.** Nine skills and their effects; gym sessions; respect | new `src/sim/skills.js`, `src/sim/player.js`, `src/sim/gym.js`, `src/sim/reputation.js` | M23.T4, M17.T14 | M23-4 | M |
| M23.T8 | **The body.** Fat and muscle from food and exercise; shape, speed and strength; sex appeal | `src/sim/skills.js`, `src/render/player.js` | M23.T7, M25.T3 | M23-5 | M |
| M23.T9 | **Upgrades and gates.** Battery tiers, ATM, helicopter, the rest; locks by side activities and stashes | `src/sim/progression.js`, `src/sim/battery.js`, `src/sim/hackables.js` | M23.T2, M24.T2 | M23-6 | S |
| M23.T10 | **The city's development points.** City and building experience; the tree in `devtree.json`; M5-12's milestones as its spine; the panel | new `src/sim/devtree.js`, new `src/content/devtree.json`, `src/sim/milestones.js`, `src/ui/cityview.js` | M23.T2, M5.T30 | M23-7 | M |
| M23.T11 | **Streaks and adrenaline.** The kill-streak buff; the adrenaline bar's fill and its perks | `src/sim/weapons.js`, `src/sim/health.js`, `src/sim/progression.js` | M23.T6 | M23-8 | S |
| M23.T12 | **Uprisings.** The district meter; the uprising mission's unlock; a freed district | `src/sim/gangs.js`, `src/sim/guards.js`, `src/sim/mission.js` | M23.T2, M19.T15 | M23-9 | M |
| M23.T13 | **The character screen.** Level, attributes, perks, skills, body, stats, completion; P opens it | new `src/ui/character.js`, `src/game/input.js` | M23.T6, M23.T7 | M23-10 (part) | M |
| M23.T14 | **Completion and counters.** The 100% list and its percentage; 35 lifetime counters | new `src/sim/completion.js`, `src/sim/progression.js` | M23.T13 | M23-10 | M |
| M23.T15 | **After the end.** Back before the last mission with rewards; new game plus on a new seed | `src/sim/arc.js`, `src/sim/newgame.js`, `src/sim/save.js` | M23.T14, M24.T8 | M23-11 | M |
| M23.T16 | **Save** keeps everything in M23-12 | `src/sim/save.js` | M23.T15 | M23-12 | S |
| M23.T17 | **Close.** The sweep of the character screen, level-ups, the body and the city's tree; one commit per defect; P in the hints | the sweep, `content/hints.json` | all of the above | M23-13 | M |

## Decisions for the operator

None.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M23-1 | WD-10-002, CP-08-018, CP-08-019 |
| M23-2 | CP-08-003 to CP-08-007, CP-08-009 to CP-08-012, CP-08-015, CP-08-037, CP-01-025, CP-01-026, CP-14-026 |
| M23-3 | WD-10-003 to WD-10-007, WD-10-009 to WD-10-016, WD-10-017, WD-10-018, WD-10-019, WD-10-020, WD-10-022, WD-10-024 to WD-10-028, WD-10-047, WD-10-053 to WD-10-064, CP-01-033, CP-02-012, CP-02-034, CP-06-027, CP-08-013, CP-08-014, CP-08-022, CP-08-023, CP-08-026, CP-08-027, CP-08-028, CP-08-030 to CP-08-036, CP-08-053, CP-08-054, CP-08-055 |
| M23-4 | GTA-01-021, GTA-01-022, GTA-03-044, GTA-05-051, GTA-08-011, GTA-12-019 to GTA-12-026, GTA-12-030, GTA-12-031 |
| M23-5 | GTA-12-027, GTA-12-028, GTA-12-029 |
| M23-8 | CP-08-024, CP-08-025, CP-08-047 |
| M23-10 | CP-15-041 |
