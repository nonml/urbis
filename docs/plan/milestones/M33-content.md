# M33 — The city's places, people, story and packs

From: the 261 rows the four games' triage files mark `content` (their own cities,
landmarks, casts, missions, packs and brands, `docs/plan/features/triage-*.md`);
`docs/plan/features/mechanics.md` GAP-11-013, GAP-11-024 and GAP-20-001; the roadmap's
"next nine interiors" and world-scale plank 2 (the subway, sewers and skybridges); and
CAPABILITIES' last later rows (clubs, bars, the metro on foot, storm drains, ad screens).
Those games are made of their places and people; Urbis cannot copy them, and does not
need to. **Each one becomes a kind Urbis generates or writes for itself**: Los Santos'
pier, Chicago's elevated railway and London's clock tower become kinds of place the seed
puts where its land allows; Michael, Aiden and Judy become kinds of character in Urbis's
own cast; the Big Score becomes a kind of set piece in Urbis's own story. No real city,
brand or person is used. Pillars: the city lives; live in it.

Needs first: M14-19 (landmarks), M16 (rail, metro, air), M21 (people), M24 (the
campaign), M25 (looks), M26-3 (the land), M29-11 (editions). Other milestones need its
interiors early (M33.T3). Lane: story, with M33-1, M33-2, M33-9 and M33-10 in lane: city.

## Keys

None new.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M33-1 | **Places from the seed:** 48 kinds of place, each with a name made from the seed and placed where the land allows (`content/places.json`): a downtown of towers with the city's tallest; a shopping avenue; old squares with a column, a fountain or a circus of signs; docks and a container port; old working wards; poor tower blocks; a tech campus; a canal quarter; a pier with a wheel; an observatory on a hill; a hill of villas with the city's name in letters; a dam; a lake; a mountain; a desert or badlands with a wind farm; a canyon with a creek; a small farm town; a beach and its ocean road; a prison, and one on an island where the coast allows; an airport; a stadium; a mall; a night market; a red-light street; a columbarium; a capital quarter (a parliament with a clock tower, a palace, a cathedral, an old fortress); a big public sculpture and a statue; a crooked hill street; a ferry building; a city hall; a TV mast; the elevated railway; a hotel tower on a plaza; a military base with a radio dish; a firm's headquarters for each of the city's big firms; ad screens on towers and squares (screens, not holograms). On five seeds, each kind the land allows is found | `tests/m33-places.test.js`, `tests/accept/m33-places.spec.js` | partial: grown lots, one river and outskirts | — |
| M33-2 | **The region:** around the home city, a county of farms, desert and badlands to the map's edge; two neighbouring cities generated from the seed's neighbours (a coastal city of beaches and nightlife, a desert city of casinos) with their own climate and style (M14-24, M14-25), across a bay or down a highway, reached by road, rail, ferry and plane (M16); a small snowy town where the story starts | `tests/m33-region.test.js`, `tests/accept/m33-region.spec.js` | red: one city | — |
| M33-3 | **The cast** (`docs/CAST.md`): three leads (an ageing professional with a family, a young driver from the wards, a dangerous drifter), a hacker crew and its members, 24 supporting characters (a fixer, a planner, an old friend, a crooked agent, a gang boss, a rival, a producer, a tycoon, a celebrity musician as a cameo, four partners with their own chains) and 6 antagonists; each has a look (M25), a voice (M24-3), a home and a day (M21), and a chain of side missions | `tests/m33-cast.test.js` | partial: three people with attitudes (`ARC.md`) | — |
| M33-4 | **The story's set pieces** (in M24-2's 60 missions, `docs/STORY.md`): a prologue robbery in the snowy town, a jewellers' job, a raid on a private army's ship, a federal bureau raid, a small-town bank score, a gold vault score; a bank job prologue for the hacker crew, operations against a surveillance firm, a drone project that targets people before they act, a raid on a trafficking ring's auction; a rescue, a pickup, a hotel heist, a funeral, a chase with a deal gone wrong; a choice of whom to side with at each act's end, and the fates of 8 side characters that follow from them | `tests/m33-story.test.js` | partial: the six-mission arc | — |
| M33-5 | **Side stories:** 30 written side jobs, from street jobs (a gig turned to a hunt, a car that spies on its drivers, a clinic selling bad drugs, a polluting firm, a dating app that sells its users, a foreign spy, a copycat killer) to the partners' chains and the cast's own errands | `tests/m33-side.test.js` | red | — |
| M33-6 | **Story packs:** two episodes in the same city at the same time as the main story, each with a new lead (a biker club's member, a nightlife fixer's bodyguard), new missions, vehicles and weapons; a prequel with the hacker crew's founder, paid in its own currency; a spy thriller in a walled district held by a private army, with its own perks (M23-3) and achievements (M29-13); each pack's own clothes | `tests/accept/m33-packs.spec.js` | red | GAP-11-013, GAP-11-024 |
| M33-7 | **The editions' content** (M29-11): what each edition, pass, pre-order and bundle holds, listed in `docs/EDITIONS.md`; a garage of cars for the collector's edition; extra items for players with a save from an earlier release; a free anniversary update each year with a pack | `tests/accept/m33-editions.spec.js` | red | GAP-20-001 |
| M33-8 | **Institutions, brands and references:** a cybercrime unit, a private security force, the movement (M22-8) and its robes, the burnout that overuse of stim pens (M25-9) brings, told in the news and a side chain; brands for cars, guns, clothes, phones, food, drink, banks and firms in `docs/BRANDS.md`, all invented; easter-egg references to other worlds (M24-17) | `tests/m33-brands.test.js` | red | — |
| M33-9 | **The interiors:** every kind of room the plan sends the player into, made from the interior kit with people who move inside: three shops (a 24/7, a clothes shop, a chemist), two offices and a corporate floor, a bar, a club with a DJ booth and a back room, a strip club (behind M13's age rating), a warehouse, a subway station, a safehouse for each lead and the hacker crew's base, a gym, a barber and a tattoo parlour, a fitter's back room, a bank, a casino, a police station, a hospital, a cinema, an arcade, a garage, a lab, flats by wealth, and the five famous bars of the city (one per district group) | `tests/accept/m33-interiors.spec.js` | partial: the noodle bar, a roof and a room behind every grown door (`INTERIORS.md`) | — |
| M33-10 | **Under and above:** metro stations and their tunnels walkable (M16-7's metro); a sewer and storm-drain network under the main roads, entered by manholes and river outfalls, used by chases and missions; overpasses, underpasses and skybridges between towers walkable | `tests/accept/m33-under.spec.js` | red | — |
| M33-11 | **Draws:** the busiest new place (a capital quarter at night, a club full) holds the frame at or under 175 | the ledger | — | — |
| M33-12 | A saved game keeps the region's state, the story's and packs' progress, the cast's fates and each edition's items, and continues the same | `tests/accept/m33-save.spec.js` | red | — |
| M33-13 | The sweep of every place kind, the region, every interior and every story and pack mission on five seeds has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M33.T1 | **Checks, red.** `m33-places.test.js`, `m33-places.spec.js`, `m33-region.test.js`, `m33-region.spec.js`, `m33-cast.test.js`, `m33-story.test.js`, `m33-side.test.js`, `m33-packs.spec.js`, `m33-editions.spec.js`, `m33-brands.test.js`, `m33-interiors.spec.js`, `m33-under.spec.js`, `m33-save.spec.js` | new `tests/m33-places.test.js`, new `tests/accept/m33-places.spec.js`, new `tests/m33-region.test.js`, new `tests/accept/m33-region.spec.js`, new `tests/m33-cast.test.js`, new `tests/m33-story.test.js`, new `tests/m33-side.test.js`, new `tests/accept/m33-packs.spec.js`, new `tests/accept/m33-editions.spec.js`, new `tests/m33-brands.test.js`, new `tests/accept/m33-interiors.spec.js`, new `tests/accept/m33-under.spec.js`, new `tests/accept/m33-save.spec.js` | M11.T15 | M33-1 to M33-12 red | S |
| M33.T2 | **The interior kit, extended.** Counters, booths, stages, lockers, machines and beds as kit pieces; people who move inside | `src/render/interiorkit.js`, `src/sim/interior.js`, `src/sim/furniture.js` | M33.T1 | M33-9 (part) | M |
| M33.T3 | **The interiors.** Every room in M33-9 from the kit, by kind | `src/render/interiorsets.js`, `src/sim/interior.js`, `INTERIORS.md` | M33.T2 | M33-9 | M |
| M33.T4 | **Places, sim.** Forty-eight kinds in `places.json` with their land needs; names from the seed; placing | new `content/places.json`, `src/sim/landmarks.js`, `src/sim/citygen.js`, `src/sim/streetnames.js` | M33.T1, M26.T6 | M33-1 (part) | M |
| M33.T5 | **Places, drawn.** Towers, bridges, the wheel, the clock tower, the sculpture, the letters, the dish, the screens; pooled by kind | `src/render/block.js`, `src/render/landscape.js`, new `src/render/landmarks.js` | M33.T4 | M33-1 | M |
| M33.T6 | **The region.** The county; two neighbours from the seed's neighbours; links by road, rail, ferry and air; the snowy town | `src/sim/citygen.js`, new `src/sim/region.js`, `src/sim/transit.js` | M33.T4, M16.T13, M16.T16 | M33-2 | M |
| M33.T7 | **The cast** (lane: story). `CAST.md`; each character's look, voice, home, day and chain | new `docs/CAST.md`, new `content/story/cast.json`, `src/sim/people.js` | M33.T1, M21.T2, M25.T3 | M33-3 | M |
| M33.T8 | **The set pieces** (lane: story). `STORY.md`; the prologue, the six scores, the crew's operations, the act-end choices and the fates | new `docs/STORY.md`, `content/story/act1.json`, `content/story/act2.json`, `content/story/act3.json` | M33.T7, M24.T6 | M33-4 | M |
| M33.T9 | **Side stories** (lane: story). Thirty side jobs | new `content/story/side.json` | M33.T7 | M33-5 | M |
| M33.T10 | **Two episodes** (lane: story). Their leads, missions, vehicles, weapons and clothes | new `content/packs/episode1/`, new `content/packs/episode2/` | M33.T8 | M33-6 (part) | M |
| M33.T11 | **The prequel and the walled district** (lane: story). The founder's pack and its currency; the district, its army, its perks and achievements | new `content/packs/prequel/`, new `content/packs/district/`, `src/content/perks.json`, `src/sim/achievements.js` | M33.T10, M23.T6 | M33-6 | M |
| M33.T12 | **Editions' content.** `EDITIONS.md`; the collector's garage; returning players' items; the anniversary pack | new `docs/EDITIONS.md`, `src/platform/editions.js` | M33.T1, M29.T16 | M33-7 | S |
| M33.T13 | **Institutions and brands.** The unit, the force, the movement, the burnout; `BRANDS.md` and every brand name in the game's content | new `docs/BRANDS.md`, `src/content/`, `src/sim/news.js` | M33.T1 | M33-8 | M |
| M33.T14 | **Under and above.** Walkable stations and tunnels; sewers and drains with manholes and outfalls; walkable overpasses, underpasses and skybridges | new `src/sim/underground.js`, `src/render/interiorsets.js`, `src/sim/map.js` | M33.T3, M16.T13 | M33-10 | M |
| M33.T15 | **Save** keeps everything in M33-12 | `src/sim/save.js` | M33.T14 | M33-12 | S |
| M33.T16 | **Close.** The ledger (M33-11); the sweep on five seeds; one commit per defect | the sweep, the ledger | all of the above | M33-11, M33-13 | M |

## Decisions for the operator

- **A celebrity cameo** (M33-3): a real musician playing themself (paid, and an agent),
  or an invented one.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M33-1 | GTA-07-003, GTA-07-004, GTA-07-005, GTA-07-006, GTA-07-007, GTA-07-008, GTA-07-010, GTA-07-011, GTA-07-012, GTA-07-014, GTA-07-015, GTA-07-018, GTA-07-022, GTA-07-025, GTA-07-091, GTA-07-104, WD-13-002 to WD-13-012, WD-13-018 to WD-13-025, WD-13-029 to WD-13-045, WD-13-049, WD-13-050, WD-13-056 to WD-13-060, CP-12-001 to CP-12-006, CP-12-012 to CP-12-017, CP-12-023 to CP-12-028, CP-12-039, CP-12-051 |
| M33-2 | GTA-07-001, GTA-07-002, GTA-07-016, GTA-07-019, GTA-07-020, GTA-07-021, GTA-07-024, GTA-07-114, WD-13-001, WD-13-013 to WD-13-017, WD-13-028, CP-12-007, CP-12-008, CP-12-009 |
| M33-3 | GTA-09-001, GTA-09-002, GTA-09-003, GTA-09-035 to GTA-09-061, GTA-09-064, WD-11-001, WD-11-002, WD-11-072, WD-11-073, WD-11-078, WD-11-080, CP-09-034 to CP-09-037 |
| M33-4 | GTA-09-020 to GTA-09-026, WD-12-001, WD-12-002, WD-12-027, WD-12-040 to WD-12-045, WD-12-050 to WD-12-053, WD-12-060, WD-12-061, WD-21-013, WD-21-014, CP-09-004 to CP-09-023, CP-09-025, CP-09-033, CP-09-051 to CP-09-058, CP-09-096 |
| M33-5 | WD-07-020, WD-12-026, WD-12-032 to WD-12-035, WD-12-037, WD-12-039, CP-09-038 to CP-09-041, CP-09-043 to CP-09-047, CP-09-049, CP-09-050, CP-09-072 to CP-09-082, CP-09-086, CP-09-087 |
| M33-6 | GTA-09-062, GTA-09-063, WD-12-024, WD-12-055, WD-12-056, WD-12-057, WD-12-059, WD-15-018, CP-12-010, CP-14-036 |
| M33-7 | GTA-20-007, GTA-20-008, GTA-20-011, WD-21-002, WD-21-003, WD-21-005 to WD-21-009, WD-21-018 to WD-21-021 |
| M33-8 | GTA-07-097, WD-09-032, CP-04-097, CP-13-027, CP-14-035, CP-19-010, CP-19-011 |
| M33-9 | GTA-07-079, GTA-07-080, GTA-16-109, WD-13-051, CP-12-018 to CP-12-022 |
| M33-10 | GTA-07-084, GTA-07-085 |
