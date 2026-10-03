# M26 — Weather, seasons, land and animals

From: `docs/plan/features/mechanics.md` GAP-14-001 to GAP-14-035 (GAP-14-015 and -019 are
M14-15's, GAP-14-021 and -030 are M24-17's, GAP-14-023 is M15-5's, GAP-14-024 is M15-2's);
`docs/plan/CAPABILITIES.md` G32, S36 and S45. M2 brings rain and wetness; M26 brings the
whole sky and year: storms, fog, snow and dust, four seasons, land of many shapes from the
seed, water that flows, animals from pigeons to cougars, the player's dog, hunting, the
city's calendar, its mysteries and the world's cheats. Pillars: the city lives; build it,
live in it (the weather the builder plans for is the weather the player drives in).

Needs first: M2-9 (rain and wetness, M2.T16 and M2.T17), M14-24 (climates), M15-1 (the
wind map), M17 (swimming), M13 (rifles), M27 (the phone). Lane: city, with M26-5 to
M26-7 in lane: street.

## Keys

None new. The dog's commands are on the vehicle and weapon wheel's pet page (**Tab**) when
the dog is with the player.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M26-1 | **The weather:** clear, cloudy, overcast, rain, storm, fog, snow, dust and wind come in fronts over hours, in the mix set by the climate (M14-24). A storm flashes lightning and its thunder comes later by distance (3 s a km); a strike can hit a tall building or a tree. Fog and haze cut sight to 80 m; a dust storm in the dry climate cuts it to 40 m. Weather changes grip (M18), people's clothes and shelter (M21), solar output by cloud, wind output by wind (M15-1) and hydro by rain. Air pollution from traffic and industry drifts downwind and rain washes it out. Missions can ask for a weather. `?weather=` pins any state | `tests/m26-weather.test.js`, `tests/accept/m26-weather.spec.js` | partial: rain is always drawn; distance fog by day and night | GAP-14-001, GAP-14-002, GAP-14-012, GAP-14-033, GAP-14-034 |
| M26-2 | **Seasons and snow:** a year of four seasons over 48 game days (a setting); temperature by season and climate; snow falls, builds on roofs, ground and trees, turns to slush on busy roads (M15-18 ploughs it) and melts above 0 °C; cold snaps come in winter; the boreal climate has a long winter. Trees turn and drop leaves in autumn. In snow the player throws snowballs and people nearby join in | `tests/m26-seasons.test.js`, `tests/accept/m26-snow.spec.js` | red | GAP-14-031 |
| M26-3 | **The land:** the seed shapes the land around the city as well as the city: a coast or none, bays, lakes, the river's course, hills and the wilds to the map's edge, so no two cities sit on the same land; the title screen offers 8 named land themes (with M14-24's climate) or any seed, and a theme is one content file, so updates add land without code. The roads out of the city carry fuel stops, diners, motels and, in the dry climate, roadside camps | `tests/m26-land.test.js`, `tests/accept/m26-land.spec.js` | partial: one river and outskirts (`render/outskirts.js`) | GAP-14-006, GAP-14-009, GAP-14-013, GAP-14-017, GAP-14-018 |
| M26-4 | **Water that flows:** river and sea water is a height field on the terrain that flows downhill; a dam (M15-1) raises it upstream; terraforming (M14) changes where it goes; a storm surge or a broken dam floods low ground, and buildings in the water close until it drains (M15-25) | `tests/m26-water.test.js` | red: the river is a fixed surface | GAP-14-028 |
| M26-5 | **Wild animals:** pigeons and gulls in flocks in the streets, rats in alleys and the metro, squirrels and rabbits in parks and fields, deer and elk in forests, boars that charge when startled, coyotes and cougars in the wilds that stalk and attack, fish and sea life in open water, sharks that attack swimmers in deep water; each lives where the seed's land suits it, flees the player and cars, and is drawn from one pooled body per size | `tests/m26-wildlife.test.js`, `tests/accept/m26-wildlife.spec.js` | red | GAP-14-003, GAP-14-010, GAP-14-011, GAP-14-025, GAP-14-027, GAP-14-029, GAP-14-035 |
| M26-6 | **Pets:** residents walk dogs on leads and cats sit on steps and walls; the player gets a dog in act one (M24) that follows, fetches, sniffs out collectibles and enemies, attacks on command, and is trained by a phone app (M27); a cat from a shelter or a kitten found in a box lives in the player's home and greets them | `tests/accept/m26-pets.spec.js` | red | GAP-14-022 |
| M26-7 | **Hunting:** in the wilds the player hunts with a rifle (M13) for meat and pelts sold at a hunting shop; a call draws deer; a hunting challenge ranks by kills and clean shots; hunting in a park or the city calls the police | `tests/accept/m26-hunt.spec.js` | red | — |
| M26-8 | **The city's calendar:** a market, a parade, a street fair and a film shoot each have their days and hours from the seed; each draws a crowd and closes its streets for the time; some jobs and activities (M24) only appear at set hours. A calendar on the phone lists them | `tests/m26-calendar.test.js`, `tests/accept/m26-calendar.spec.js` | red | GAP-14-014, GAP-14-016 |
| M26-9 | **Mysteries:** easter eggs placed from the seed: a ghost on a remote hill at 23:00 to 24:00, lights in the sky after the story ends, and a saucer on the sea or lake bed | `tests/accept/m26-mysteries.spec.js` | red | GAP-14-004, GAP-14-005 |
| M26-10 | **World cheats:** on M27's phone, as M17-12's: pick the weather, low gravity (jumps float), a city riot, cars that fly when driven fast, and crowds that turn on the player; each turns off achievements (M29) until the next load | `tests/accept/m26-cheats.spec.js` | red | GAP-14-007, GAP-14-008, GAP-14-032 |
| M26-11 | **Draws:** each weather reuses the rain's particle draw or the sky; animals are one pooled draw per size (small, medium, large, sea); snow cover is a material change, not a draw; M26 adds at most 5 draws and the frame stays at or under 175 | the ledger | — | — |
| M26-12 | A saved game keeps the weather, the season and the snow on the ground, the water's level, the player's pets, hunting records, the calendar and any cheat's state, and continues the same | `tests/accept/m26-save.spec.js` | red | — |
| M26-13 | The sweep of every weather in every climate and season, the land themes, the animals and the dog, day and night, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M26.T1 | **Checks, red: the sky and the land.** `m26-weather.test.js`, `m26-weather.spec.js`, `m26-seasons.test.js`, `m26-snow.spec.js`, `m26-land.test.js`, `m26-land.spec.js`, `m26-water.test.js` | new `tests/m26-weather.test.js`, new `tests/accept/m26-weather.spec.js`, new `tests/m26-seasons.test.js`, new `tests/accept/m26-snow.spec.js`, new `tests/m26-land.test.js`, new `tests/accept/m26-land.spec.js`, new `tests/m26-water.test.js` | M2.T16 | M26-1 to M26-4 red | S |
| M26.T2 | **Weather, sim.** Nine states in fronts by climate; lightning and its strikes; sight; grip; the outputs of solar, wind and hydro; air pollution downwind and washed out | `src/sim/weather.js`, `src/sim/power.js`, `src/sim/pollution.js`, `src/sim/vehicle.js` | M26.T1, M14.T39 | M26-1 (part) | M |
| M26.T3 | **Weather, drawn.** Storm clouds, lightning and the flash, thunder's delay, fog and haze, dust, wind in trees; people's umbrellas | `src/render/atmosphere.js`, `src/render/rain.js`, `src/render/npcs.js` | M26.T2 | M26-1 | M |
| M26.T4 | **Seasons and snow, sim.** The year; temperature; snow building and melting; slush; cold snaps | new `src/sim/seasons.js`, `src/sim/weather.js`, `src/sim/clock.js` | M26.T2 | M26-2 (part) | M |
| M26.T5 | **Seasons and snow, drawn.** Snow cover on roofs, ground and trees as a material; slush; autumn trees; snowballs | `src/render/materials.js`, `src/render/landscape.js`, `src/render/player.js` | M26.T4 | M26-2 | M |
| M26.T6 | **The land.** Coast, bays, lakes, the river's course, hills and wilds from the seed; eight themes in `content/lands/`; roadside stops and camps | `src/sim/citygen.js`, `src/sim/layout.js`, new `content/lands/`, `src/render/outskirts.js` | M26.T1 | M26-3 | M |
| M26.T7 | **Water that flows.** The height field, flow, dams, terraforming, surges and floods; closing flooded buildings | new `src/sim/water.js`, `src/render/river.js`, `src/sim/disasters.js` | M26.T6, M15.T4 | M26-4 | M |
| M26.T8 | **Checks, red: life and time.** `m26-wildlife.test.js`, `m26-wildlife.spec.js`, `m26-pets.spec.js`, `m26-hunt.spec.js`, `m26-calendar.test.js`, `m26-calendar.spec.js`, `m26-mysteries.spec.js`, `m26-cheats.spec.js`, `m26-save.spec.js` | new `tests/m26-wildlife.test.js`, new `tests/accept/m26-wildlife.spec.js`, new `tests/accept/m26-pets.spec.js`, new `tests/accept/m26-hunt.spec.js`, new `tests/m26-calendar.test.js`, new `tests/accept/m26-calendar.spec.js`, new `tests/accept/m26-mysteries.spec.js`, new `tests/accept/m26-cheats.spec.js`, new `tests/accept/m26-save.spec.js` | M26.T1 | M26-5 to M26-12 red | S |
| M26.T9 | **Wildlife, sim.** Twelve species by habitat from the land; fleeing; the dangerous ones stalk, charge and attack | new `src/sim/wildlife.js`, `src/content/animals.json` | M26.T8, M26.T6 | M26-5 (part) | M |
| M26.T10 | **Wildlife, drawn.** Four pooled bodies by size; flocks; walk, run and swim clips | new `src/render/animals.js`, `tools/people/` | M26.T9 | M26-5 | M |
| M26.T11 | **Pets.** Dog walkers and cats; the player's dog and its commands and app; the home's cat | `src/sim/wildlife.js`, new `src/sim/pet.js`, `src/ui/phone.js`, `src/sim/interior.js` | M26.T10, M27.T2 | M26-6 | M |
| M26.T12 | **Hunting.** The wilds' game, the call, pelts and meat, the challenge, police in the city | `src/sim/wildlife.js`, `src/sim/shops.js`, `src/sim/wanted.js` | M26.T10, M13.T7 | M26-7 | S |
| M26.T13 | **The calendar.** Events and set-hour jobs from the seed; crowds; closed streets; the phone's calendar | new `src/sim/calendar.js`, `src/sim/street.js`, `src/sim/traffic.js`, `src/ui/phone.js` | M26.T8 | M26-8 | M |
| M26.T14 | **Mysteries and world cheats.** The ghost, the lights and the saucer; five cheats on the phone | `src/sim/collectibles.js`, `src/sim/cheats.js`, `content/cheats.json` | M26.T8, M17.T16 | M26-9, M26-10 | S |
| M26.T15 | **Save** keeps everything in M26-12 | `src/sim/save.js` | M26.T14 | M26-12 | S |
| M26.T16 | **Close.** The ledger (M26-11); the sweep of every weather, season, land theme and animal; one commit per defect | the sweep, the ledger | all of the above | M26-11, M26-13 | M |

## Decisions for the operator

None.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M26-1 | GTA-07-032, CP-12-034, CP-12-047 |
| M26-2 | CS-07-027, CS-13-018, CS-13-020, CS-13-021, CS-13-022, CS-13-023, GTA-07-031 |
| M26-5 | GTA-07-033, GTA-07-038, GTA-07-039 |
| M26-6 | GTA-07-043, GTA-08-015, GTA-15-018, GTA-15-019, CP-13-030 |
| M26-7 | GTA-10-012 |
