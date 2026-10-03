# M24 — The story, missions and things to do

From: `docs/plan/features/mechanics.md` GAP-12-001 to GAP-12-087 (GAP-12-006, -007,
-009, -020, -022, -034, -036, -050, -076 and -077 are done where they belong: M13, M19,
M21, M22, M23); `docs/plan/CAPABILITIES.md` C1, C17, C18, G13, G14, G15 and G29. When it
closes, Urbis has a full campaign with heists, endings and three ways to start; fixers,
strangers and events across the city; every race, sport, bar game, arcade game, show and
job the three street games have; investigations; and collectibles in every district.
**Everything is placed from the seed** (`AGENTS.md`): a mission names the kind of place
it needs (a bank, a roof over 40 m, a road by the river), and each new city finds one.
Pillars: live in it; the city lives; chaos has an author.

Needs first: M10-M13 (the street, combat), M16-M23 (transport, on foot, vehicles, police,
hacking, people, money, progression), M20-14 (footage), M27 (phone, map), M33 (the
interiors). Lane: story, with the activities in lane: street.

## Keys

None new. A mission's prompts use the keys each act already has; sports and games use the
mouse and W, A, S and D, shown on screen; **Space held** skips a scene (Space is the
mode's own action in a scene, as in a conversation, M21-10).

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M24-1 | **The mission frame:** a failed mission shows a screen naming why (busted, wasted, the target got away, the cargo was lost), with retry from the last checkpoint at once or quit; a mission has a checkpoint at each stage; after 3 fails of a stage the player can skip it; a passed mission gives gold, silver or bronze for its time, accuracy, damage and its own goal; any passed mission can be replayed from the phone with a fixed loadout; Space held skips a scene | `tests/accept/m24-frame.spec.js` | partial: busted rewinds the arc to just past the last choice with a note (`sim/arc.js`) | GAP-12-035, GAP-12-051, GAP-12-052, GAP-12-068, GAP-12-069, GAP-12-070, GAP-12-074, GAP-17-024, GAP-17-052 |
| M24-2 | **The campaign:** 60 story missions in three acts, in `content/story/`, each naming the places it needs by kind and placed from the seed; on all five seeds every mission finds its places. The arc's six missions are its first act's start. Some missions switch the player between two or three of the cast (M21-15) mid-mission. The last mission warns that it locks open jobs first. A side character the player failed earlier is dead later, and says so in the story | `tests/m24-campaign.test.js`, `tests/accept/m24-campaign.spec.js` | partial: a six-mission arc with four paths (`ARC.md`, `content/missions.json`) | GAP-12-039, GAP-12-043, GAP-12-082, GAP-12-083 |
| M24-3 | **Scenes:** every story scene is directed: shots, cuts, the cast's moves and faces from M2's people, lines as subtitles and, if the operator decides, voices. A scene plays in under 90 s or can be skipped | `tests/accept/m24-scenes.spec.js` | partial: dialogue, objective line and journal as plain UI | GAP-12-040 |
| M24-4 | **Endings:** at least five endings, chosen in the last mission from what the player has done (choices, the companion's regard M21-9, side jobs finished, friends kept); each has its own last mission and scene, a montage of the player's game, and messages from the cast after; the player then returns before the last mission (M23-11) | `tests/m24-endings.test.js` | partial: two choices make four end states, not named endings | GAP-12-005 |
| M24-5 | **Three starts:** a new game picks a background (a local, a company insider, an outsider who arrives by the road from outside), each with its own first mission, a few lines in talk only they have, and a starting bonus | `tests/accept/m24-starts.spec.js` | red | — |
| M24-6 | **Heists:** 5 heists per city on the seed's bank, jewellers, casino, armoured depot and a guarded site; each is planned on a board: loud or quiet, a crew hired from cards with skills and a cut each (the player sets the cuts), setup missions for gear, vehicles and plans, then the raid; the take is split by the cuts | `tests/m24-heists.test.js`, `tests/accept/m24-heists.spec.js` | red | GAP-12-012, GAP-12-045, GAP-12-060, GAP-12-072, GAP-12-073 |
| M24-7 | **Fixers:** one fixer per district group (3-5 per city) calls and texts with jobs made from the sim as M11's gigs are: thefts of listed cars driven to a drop, deliveries that turn into ambushes, guarded supply drops, assassinations that move a firm's shares (M22-6), captures alive for more pay, and a bonus for no killing. Each fixer's jobs show by district on the map | `tests/m24-fixers.test.js`, `tests/accept/m24-fixers.spec.js` | partial: a paid board with two jobs (M11 plans six kinds) | GAP-12-010, GAP-12-011, GAP-12-027, GAP-12-041, GAP-12-047, GAP-12-048, GAP-12-049, GAP-12-053 |
| M24-8 | **Strangers and events:** 12 strangers per city, each a person with a 3-5 mission chain (a paparazzo, a conspiracy believer, a collector, a tow-truck driver, an activist, a border vigilante, a rich widow, a doctor, a hippy, an old soldier, a psychologist, a woman who sells secrets); 12 kinds of random events near the player (a cash-truck raid, a mugging, a hitchhiker, a shop robbery, a car theft, a crash rescue, a drunk driver, a deal gone wrong, escaped convicts, a domestic row, an ATM robbery, a kidnap) about one an hour of game time; small stories in flats and on roofs found by walking in | `tests/m24-strangers.test.js`, `tests/accept/m24-events.spec.js` | red | — |
| M24-9 | **Vehicle jobs:** in the right vehicle, a key on the vehicle wheel starts its job: taxi fares, towing, hitchhikers to a camp, firefighting, paramedic runs, quarry work with diggers and dumpers, escort driving (by M13's rating), cargo hauling between depots, valet parking for tips, pizza on a scooter; each has 12 levels of rising pay | `tests/accept/m24-jobs.spec.js` | red | GAP-12-025, GAP-12-026, GAP-12-030, GAP-12-031, GAP-12-032, GAP-12-033, GAP-12-044, GAP-12-054, GAP-12-071 |
| M24-10 | **Street races:** street races on closed streets with checkpoints, time trials with leaderboards, checkpoint races against the clock, and races against rivals on bikes and trucks off road, 6 of each per city routed from the seed; races repeat for money and discounts, and some story races offer a choice (win, throw it, crash a rival) that changes the reward and the story | `tests/m24-races.test.js`, `tests/accept/m24-races.spec.js` | red | GAP-12-002, GAP-12-008, GAP-12-061, GAP-12-062, GAP-12-080, GAP-12-081 |
| M24-11 | **Track and water races:** a stadium (M14-19) holds stock-car races on an oval, stunt events and a demolition derby; a drift course is scored; sea races for boats and jet skis run on the river or coast; a triathlon swims, cycles and runs against rivals | `tests/accept/m24-trackraces.spec.js` | red | GAP-12-023, GAP-12-063, GAP-12-064, GAP-12-065, GAP-12-066, GAP-12-067 |
| M24-12 | **Sports:** basketball at a court, golf (a 9-hole course on the seed's open land, a swing meter), tennis with serve and score, bowling with spin and power, darts and pool in bars, yoga on a mat, keepie-uppie with a ball, arm wrestling; each against a person of a skill, each played with the mouse and keys shown | `tests/accept/m24-sports.spec.js` | red | GAP-12-004, GAP-12-013, GAP-12-017, GAP-12-037, GAP-12-038, GAP-12-056, GAP-12-057, GAP-12-058, GAP-12-059 |
| M24-13 | **Bar and street games:** a drinking contest, the cups and ball on a street table, chess endgames on boards in parks, dancing to the beat in a club, bouncing a lowrider to a rhythm, and fights in an arena (M13-5's ring at a bigger venue) | `tests/accept/m24-bargames.spec.js` | red | GAP-12-003, GAP-12-014, GAP-12-015, GAP-12-021, GAP-12-028, GAP-12-046 |
| M24-14 | **Arcades and phone games:** arcade cabinets in bars and an arcade the player can own (M22-5), and games on M27's phone: a bouncing-flower track, a demon-car chase, a spot-the-agent crowd game, a stealth game in a dark city and a zombie-wave shooter. Each keeps high scores; the zombie game is the only place zombies exist | `tests/accept/m24-arcade.spec.js` | red | GAP-12-001, GAP-12-016, GAP-12-029, GAP-12-078, GAP-12-079, GAP-12-087, GAP-15-048 |
| M24-15 | **Shows:** a cinema plays films (short pieces made for Urbis) for a ticket; a theatre or club has a live act to watch; in the city view, concert venues stage concerts, festivals are set up with ticket prices, a line-up and security, and the stadium holds match events, each drawing visitors (M14-20) and traffic, A/B | `tests/m24-events.test.js`, `tests/accept/m24-shows.spec.js` | red | GAP-12-018, GAP-12-019, GAP-12-084, GAP-12-085, GAP-12-086 |
| M24-16 | **Investigations:** 8 short investigations per city made from the sim's crimes: a body, a theft, a missing person; the player reads footage (M20-14), profiles and places to find who did it, and accuses; a wrong accusation has a cost. Hacked home cameras show private scenes from residents' lives, some of which start a job | `tests/m24-investigations.test.js`, `tests/accept/m24-investigate.spec.js` | red | GAP-12-042, GAP-12-075 |
| M24-17 | **Collectibles:** 12 sets per city, placed from the seed in places of the right kind (hidden packages, letters, playing cards, action figures, signal jammers, ship and plane wrecks under the river or sea, media sticks, masks, audio logs, burner phones, posters with codes, film props), 20-50 each; finishing a set gives a reward (₡, an item, a story scene); 50 stunt jumps and 10 unique jumps from the map's ramps and roofs; three treasure hunts with clues; a murder mystery; a painted mural whose picture hints at a hidden mystery; easter eggs (a hidden supercar, M18-20's prototypes, and hidden jokes and references to other games and films across the city); counters on the character screen | `tests/m24-collect.test.js`, `tests/accept/m24-collect.spec.js` | red | GAP-12-024, GAP-14-021, GAP-14-030, GAP-20-012 |
| M24-18 | **Photographs:** a tourist board lists 20 animals (M26) and 30 views to photograph with the phone (M27); a photo of the right one within 30 m pays | `tests/accept/m24-photos.spec.js` | red | GAP-12-055 |
| M24-19 | A saved game keeps the campaign's state, heists, fixers' standing, strangers, events done, every race, sport and game record, investigations and collectibles, and continues the same | `tests/accept/m24-save.spec.js` | red | — |
| M24-20 | The sweep of every mission kind and activity on five seeds has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M24.T1 | **Checks, red: the story.** `m24-frame.spec.js`, `m24-campaign.test.js`, `m24-campaign.spec.js`, `m24-scenes.spec.js`, `m24-endings.test.js`, `m24-starts.spec.js`, `m24-heists.test.js`, `m24-heists.spec.js` | new `tests/accept/m24-frame.spec.js`, new `tests/m24-campaign.test.js`, new `tests/accept/m24-campaign.spec.js`, new `tests/accept/m24-scenes.spec.js`, new `tests/m24-endings.test.js`, new `tests/accept/m24-starts.spec.js`, new `tests/m24-heists.test.js`, new `tests/accept/m24-heists.spec.js` | M11.T15 | M24-1 to M24-6 red | S |
| M24.T2 | **The mission frame.** Failure reasons and screen, checkpoints, retry, skip after 3 fails, medals, replay from the phone, skipping scenes | `src/sim/mission.js`, new `src/ui/missionend.js`, `src/sim/arc.js` | M24.T1 | M24-1 | M |
| M24.T3 | **Places by kind.** A mission names its places as kinds; the map finds one on each seed; `m24-campaign.test.js` checks all 60 on five seeds | new `src/sim/casting.js`, `src/sim/map.js` | M24.T1 | M24-2 (part) | M |
| M24.T4 | **Act one** (lane: story). 20 missions written in `content/story/act1.json`, the arc's six among them | new `content/story/act1.json`, `src/sim/arc.js` | M24.T3 | M24-2 (part) | M |
| M24.T5 | **Act two** (lane: story). 20 missions, with the switches between the cast | new `content/story/act2.json` | M24.T4, M21.T20 | M24-2 (part) | M |
| M24.T6 | **Act three** (lane: story). 20 missions, the point-of-no-return warning, the fates of side characters | new `content/story/act3.json`, `src/sim/arc.js` | M24.T5 | M24-2 | M |
| M24.T7 | **Scenes.** A scene player: shots, cuts, moves, faces, subtitles, a voice track if decided | new `src/game/scene.js`, `src/game/camera.js`, `src/render/npcs.js` | M24.T1, M2.T4 | M24-3 | M |
| M24.T8 | **Endings.** Five endings from the game's state; their missions, scenes, the montage, messages after | new `content/story/endings.json`, `src/sim/arc.js`, `src/game/scene.js` | M24.T6, M24.T7 | M24-4 | M |
| M24.T9 | **Three starts.** Backgrounds on the new-game screen, three first missions, talk lines, bonuses | `src/sim/newgame.js`, `src/ui/title.js`, new `content/story/starts.json`, `src/sim/talk.js` | M24.T4, M7.T8 | M24-5 | M |
| M24.T10 | **Heists.** Five from the seed's places; the board, approach, crew cards, cuts, setups, the raid and the split | new `src/sim/heists.js`, new `src/ui/heistboard.js`, `src/sim/casting.js` | M24.T3, M19.T2 | M24-6 | M |
| M24.T11 | **Checks, red: the city's jobs.** `m24-fixers.test.js`, `m24-fixers.spec.js`, `m24-strangers.test.js`, `m24-events.spec.js`, `m24-jobs.spec.js`, `m24-races.test.js`, `m24-races.spec.js`, `m24-trackraces.spec.js` | new `tests/m24-fixers.test.js`, new `tests/accept/m24-fixers.spec.js`, new `tests/m24-strangers.test.js`, new `tests/accept/m24-events.spec.js`, new `tests/accept/m24-jobs.spec.js`, new `tests/m24-races.test.js`, new `tests/accept/m24-races.spec.js`, new `tests/accept/m24-trackraces.spec.js` | M24.T1 | M24-7 to M24-11 red | S |
| M24.T12 | **Fixers.** Fixers by district group; their calls and texts; six job kinds from the sim; the bonuses; the map's marks | new `src/sim/fixers.js`, `src/sim/gigs.js`, `src/ui/phone.js` | M24.T11, M27.T2 | M24-7 | M |
| M24.T13 | **Strangers.** Twelve strangers placed from the seed with their chains in `content/story/strangers.json` | new `content/story/strangers.json`, `src/sim/casting.js` | M24.T11 | M24-8 (part) | M |
| M24.T14 | **Random events and small stories.** Twelve kinds near the player at about one an hour; stories in flats and on roofs | new `src/sim/randomevents.js`, `src/sim/street.js`, `src/sim/interior.js` | M24.T11 | M24-8 | M |
| M24.T15 | **Vehicle jobs.** Ten jobs on the vehicle wheel with 12 levels each | new `src/sim/vehiclejobs.js`, `src/ui/vehiclewheel.js` | M24.T11, M18.T2, M18.T11 | M24-9 | M |
| M24.T16 | **Street races.** Routes from the seed for four race kinds; leaderboards; repeats; the story races' choices | new `src/sim/races.js`, `src/render/overlays.js` | M24.T11 | M24-10 | M |
| M24.T17 | **Track and water races.** The oval, stunts, the derby, the drift course, sea races, the triathlon | `src/sim/races.js`, `src/sim/boat.js`, `src/sim/player.js` | M24.T16 | M24-11 | M |
| M24.T18 | **Checks, red: games and finds.** `m24-sports.spec.js`, `m24-bargames.spec.js`, `m24-arcade.spec.js`, `m24-events.test.js`, `m24-shows.spec.js`, `m24-investigations.test.js`, `m24-investigate.spec.js`, `m24-collect.test.js`, `m24-collect.spec.js`, `m24-photos.spec.js`, `m24-save.spec.js` | new `tests/accept/m24-sports.spec.js`, new `tests/accept/m24-bargames.spec.js`, new `tests/accept/m24-arcade.spec.js`, new `tests/m24-events.test.js`, new `tests/accept/m24-shows.spec.js`, new `tests/m24-investigations.test.js`, new `tests/accept/m24-investigate.spec.js`, new `tests/m24-collect.test.js`, new `tests/accept/m24-collect.spec.js`, new `tests/accept/m24-photos.spec.js`, new `tests/accept/m24-save.spec.js` | M24.T11 | M24-12 to M24-19 red | S |
| M24.T19 | **Ball sports.** Basketball, golf, tennis: rules, the opponent, controls | new `src/sim/sports.js`, new `src/ui/sports.js` | M24.T18 | M24-12 (part) | M |
| M24.T20 | **Indoor sports.** Bowling, darts, pool, yoga, keepie-uppie, arm wrestling | `src/sim/sports.js`, `src/ui/sports.js` | M24.T19, M33.T3 | M24-12 | M |
| M24.T21 | **Bar and street games.** Drinking contest, cups and ball, chess endgames, dancing, car bouncing, the arena | new `src/sim/bargames.js`, `src/ui/sports.js` | M24.T18 | M24-13 | M |
| M24.T22 | **Arcades and phone games.** Cabinets and the arcade; five phone games with high scores | new `src/ui/arcade.js`, `src/ui/phone.js` | M24.T18, M27.T2 | M24-14 | M |
| M24.T23 | **Shows.** Cinema, the live act; concert venues, festivals with tickets, line-up and security; match events; visitors and traffic | new `src/sim/shows.js`, `src/sim/tourism.js`, `src/sim/areas.js`, `src/ui/cityview.js` | M24.T18, M14.T33 | M24-15 | M |
| M24.T24 | **Investigations.** Eight from the sim's crimes; reading footage, profiles and places; accusing; home-camera scenes | new `src/sim/investigations.js`, `src/sim/footage.js`, `src/sim/crime.js` | M24.T18, M20.T4, M20.T18 | M24-16 | M |
| M24.T25 | **Collectibles.** Twelve sets, jumps, treasure hunts, the murder mystery, easter eggs, set rewards; placed by kind from the seed | new `src/sim/collectibles.js`, new `src/content/collectibles.json`, `src/sim/casting.js`, `src/render/props.js` | M24.T18 | M24-17 | M |
| M24.T26 | **Photographs.** The tourist board's 50 subjects; a photo checks subject and distance | `src/sim/collectibles.js`, `src/ui/phone.js` | M24.T25, M26.T10, M27.T6 | M24-18 | S |
| M24.T27 | **Save** keeps everything in M24-19 | `src/sim/save.js` | M24.T26 | M24-19 | M |
| M24.T28 | **Close.** The sweep of every mission kind and activity on five seeds; one commit per defect | the sweep, `content/hints.json` | all of the above | M24-20 | M |

## Decisions for the operator

- **Voices** for the cast (M24-3): voice actors (paid), a speech service (paid, and an
  account), or subtitles only.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M24-4 | CP-09-026 to CP-09-031, CP-09-083, CP-09-094, CP-09-095, CP-09-098 |
| M24-5 | CP-08-059, CP-09-001, CP-09-002, CP-09-003, CP-10-006, CP-14-025 |
| M24-8 | GTA-07-051 to GTA-07-059, GTA-07-109, GTA-07-110, GTA-07-111, CP-13-036, CP-16-023, GTA-07-061 to GTA-07-066, GTA-07-069 to GTA-07-074, GTA-07-112 |
| M24-17 | GTA-10-050, GTA-10-051, GTA-10-053, GTA-10-056 to GTA-10-072, GTA-10-089, GTA-14-046, WD-12-019, WD-12-020, WD-12-021, WD-15-011, WD-16-022, WD-17-006, CP-02-064, CP-11-042, CP-12-045, CP-16-005, CP-16-017, CP-16-019, CP-19-008 |
| M24-18 | WD-12-030 |
