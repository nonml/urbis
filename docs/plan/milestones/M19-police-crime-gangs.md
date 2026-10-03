# M19 — Police, crime and gangs

From: `docs/plan/features/mechanics.md` GAP-06-001 to GAP-06-045 (GAP-06-005 is M13-1's,
GAP-06-022 is M13-17's); `docs/plan/CAPABILITIES.md` G9's ★4-5, G11's robberies, C9, C15,
W20, S50 and D9's crimes in progress. When it closes, heat climbs to five stars with
every police force the three street games send, the city has a crime rate, jails and a
prison, crimes happen in the street without the player and can be stopped, every shop,
bank and armoured truck can be robbed, and gangs made from the seed hold turf, fight each
other and the player, and lose it. Pillars: the city lives; chaos has an author; every
tool is expressive.

Needs first: `src/sim/wanted.js`'s TIERS (★1-3, merged from wave 2), M10-10 (police on
foot), M13 (combat, armed police at ★3, enemies who fight), M18 (police vehicles, boats,
helicopters, the National Guard depot), M5-5 (police stations). Lane: street.

**Gangs are generated** (`AGENTS.md`): every new city makes 6-10 gangs from twelve
archetypes, with names, colours, cars and turf from the seed, never a fixed list.

## Keys

None new. Arrests, bounties and robberies use M13's keys: aim at a shopkeeper to rob;
non-lethal takedowns capture alive. The police computer is an option on M18's vehicle
wheel in a police car.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M19-1 | **Five stars:** heat runs ★1 to ★5. What raises it is in `WANTED.md`: an assault on a civilian or a drone, a ram in a chase, a police car taken, a shop's alarm, a shot fired near an officer. ★4 brings tactical teams in armoured vans and federal agents in unmarked SUVs; ★5 brings the National Guard (soldiers, armoured vehicles, attack helicopters and jets) and an elite squad that ropes down from a helicopter at the player's place. A/B per step: heat never rises without a seen crime | `tests/m19-heat.test.js`, `tests/accept/m19-stars.spec.js` | partial: ★1-3 with cruisers, spikes, roadblock, helicopter (`sim/wanted.js:16` `MAX_HEAT = 3`) | GAP-06-001, GAP-06-002, GAP-06-010, GAP-06-027, GAP-06-036, GAP-06-037, GAP-06-041 |
| M19-2 | **Every force:** interceptors join chases over 120 km/h; police motorbikes thread between lanes; police boats on the river; a prisoner van brings a tactical team; a riot van blocks a road and takes 20 hits; the helicopter's marksman fires from ★3; drones find the player from the air and hold them on the minimap; officers lean out of moving cars and fire; sheriffs and rangers patrol the outskirts and trails | `tests/accept/m19-forces.spec.js` | partial: cruisers and a helicopter with a searchlight; officers never shoot | GAP-06-012, GAP-06-013, GAP-06-014, GAP-06-024, GAP-06-030, GAP-06-031, GAP-06-032, GAP-06-033, GAP-06-040 |
| M19-3 | **Losing them:** out of sight, the search ring holds (built); crouching in bushes, going into a tunnel, a metro station or an interior breaks line of sight; a respray (M18-17) unseen clears heat; a fixer's number on the phone clears it for ₡ that rise with the stars; starting a mission clears it; switching the phone off stops the police tracking it, which they do from ★3; a cheat number clears or adds a star | `tests/accept/m19-lose.spec.js` | partial: the search ring and blackout cover (`WANTED.md`) | GAP-06-009, GAP-06-019, GAP-06-025, GAP-06-034, GAP-06-035, GAP-06-045 |
| M19-4 | **The city's crime:** every resident has a chance of crime from unemployment, education and happiness (M15); crimes happen without the player and the crime rate shows by district. Police take criminals to stations' cells; a full station sends them to a prison (a building with a capacity); a police headquarters widens coverage; a pre-release programme lowers repeat crime. In the street, officers question and arrest people. A/B: a district with high unemployment and no station has at least twice the crime of B | `tests/m19-crime.test.js` | red: police answer the player's heat only (`WANTED.md`) | GAP-06-017, GAP-06-039, GAP-06-044 |
| M19-5 | **Crimes in the street:** about 6 crimes an hour of game time near the player *(provisional)*: muggings, carjackings (a criminal drags a driver out), assaults, break-ins and shootouts, made from the city's crime rate. The profiler flags a person about to commit one and their victim (Focus shows it); the police radio flags a crime in progress on the minimap. Stopping it pays cred and ₡; a crime scene's guards join a chase | `tests/accept/m19-streetcrime.spec.js` | red | GAP-06-011, GAP-06-018, GAP-06-020, GAP-06-021, GAP-12-050 |
| M19-6 | **Persons in crisis:** a rare event, 1 in 3 game days *(provisional)*: an armed person in a mental crisis fires in a public place; the police cordon it; the player can talk them down (M21), subdue them without killing for a bonus, or not | `tests/accept/m19-crisis.spec.js` | red | — |
| M19-7 | **Bounties and the database:** the police computer in a police car or a station looks up any plate or person and lists the 10 most wanted, made from the city's criminals; a bounty office pays for each one brought in, double alive (M13-7). A hack (M20) puts a false advisory on a person and sends the police after them | `tests/accept/m19-bounty.spec.js` | red | GAP-06-016, GAP-06-023, GAP-06-028, GAP-12-020 |
| M19-8 | **Robberies:** aiming a gun at a shopkeeper (a shop, a petrol station, a bank teller, a jeweller) makes them fill a bag for 10-20 s while the alarm rings; ₡ by the shop's takings; heat from the alarm. A bank's vault and a jewellery store's cases are robbed through their interiors (M33); an armoured cash truck on its round can be stopped and opened. At night, a house's door is broken (hold E) and items are taken from its rooms while the family sleeps; a noise wakes them | `tests/accept/m19-robbery.spec.js` | red: none | GAP-06-015, GAP-06-038 |
| M19-9 | **Gangs:** 6-10 per city from twelve archetypes (corner crew, motorcycle club, crime family, triad-style syndicate, cartel, street racers, militia, scavengers, hacker crew, private military, travellers' clan, old-money mob), each with a name, colours, cars, weapons and turf of 1-4 districts from the seed. Members stand on corners and drive their streets; they attack the player on sight in their turf if the player is hostile to them (M21's standing); gang cars chase the player | `tests/m19-gangs.test.js`, `tests/accept/m19-gangs.spec.js` | red: none (searched "gang" in src: none) | GAP-06-007 |
| M19-10 | **Gang life:** gangs fight each other where turfs meet (a skirmish every game day), ambush the player, take revenge for a member killed, run convoys between hideouts and guard 2-3 hideouts each. A hideout (M13-15) cleared turns the gang's turf weaker | `tests/accept/m19-ganglife.spec.js` | red | — |
| M19-11 | **Turf wars:** the player starts a war in a gang's turf by killing members there; three waves come; surviving them takes the district for the player's own crew or an allied gang (M21). The police and locals who patrol it change with who holds it. A/B: a district taken from a gang has 40% less street crime | `tests/m19-turf.test.js`, `tests/accept/m19-turf.spec.js` | red | GAP-06-029, GAP-12-022 |
| M19-12 | **Guarded places:** private security firms guard a campus, a data centre and a port (M14, M15, M16) with patrols, checkpoints, an alert level, riflemen, grenadiers, a marksman on a roof and captains; a checkpoint at a district's gate checks who passes; the National Guard depot is fenced and fires on intruders. Entering a restricted area raises heat after a warning | `tests/accept/m19-guarded.spec.js` | red | GAP-06-006, GAP-06-026, GAP-06-043 |
| M19-13 | **Views:** the crime view and the gang turf view in the city view, at most 2 draws each, matching the sim on 5 lots | `tests/accept/m19-views.spec.js` | red | — |
| M19-14 | **Bodies:** police kinds, gang members, guards and soldiers come from the walker pool with outfit tints; police and gang vehicles from M18's pools; M19 adds at most 3 draws | the ledger | — | — |
| M19-15 | A saved game keeps heat, every gang's turf and standing, the city's criminals, jails and prison, bounties, and continues the same | `tests/accept/m19-save.spec.js` | red | — |
| M19-16 | The sweep of every M19 shot, at every star, every gang's turf, day and night, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M19.T1 | **Checks, red: police.** `m19-heat.test.js`, `m19-stars.spec.js`, `m19-forces.spec.js`, `m19-lose.spec.js`, `m19-crime.test.js`, `m19-streetcrime.spec.js`, `m19-crisis.spec.js`, `m19-bounty.spec.js` | new `tests/m19-heat.test.js`, new `tests/accept/m19-stars.spec.js`, new `tests/accept/m19-forces.spec.js`, new `tests/accept/m19-lose.spec.js`, new `tests/m19-crime.test.js`, new `tests/accept/m19-streetcrime.spec.js`, new `tests/accept/m19-crisis.spec.js`, new `tests/accept/m19-bounty.spec.js` | M13.T30 | M19-1 to M19-7 red | S |
| M19.T2 | **★4 and ★5.** Tiers 4 and 5 in TIERS; what raises heat in `WANTED.md`; tactical teams, agents, the Guard, the elite squad's drop | `src/sim/wanted.js`, `src/sim/response.js`, `src/sim/dispatch.js`, `docs/WANTED.md` | M19.T1 | M19-1 | M |
| M19.T3 | **Every force, sim.** Interceptors, motorbikes, boats, the prisoner van, the riot van, the marksman, drones, firing from cars, sheriffs and rangers | `src/sim/response.js`, `src/sim/patrol.js`, `src/sim/combatai.js`, `src/sim/flight.js` | M19.T2, M18.T2, M18.T17, M18.T19 | M19-2 (part) | M |
| M19.T4 | **Every force, drawn.** Drones as one pooled kind; the marksman in the helicopter; officers leaning out | `src/render/police.js`, `src/render/heli.js`, new `src/render/drones.js` | M19.T3 | M19-2 | M |
| M19.T5 | **Losing them.** Bushes, tunnels, stations and interiors break sight; the fixer's call; missions clear heat; phone tracking from ★3; the heat cheats | `src/sim/wanted.js`, `src/sim/stealth.js`, `src/sim/cheats.js`, `src/ui/phone.js` | M19.T2, M27.T2 | M19-3 | M |
| M19.T6 | **The city's crime.** Crime chance per resident; the crime rate; cells, the prison, headquarters, pre-release; arrests in the street | new `src/sim/crime.js`, `src/sim/people.js`, `src/sim/patrol.js` | M19.T1, M15.T14, M15.T19 | M19-4 | M |
| M19.T7 | **Crimes in the street.** Muggings, carjackings, assaults, break-ins, shootouts near the player; flags on the person and victim; the radio's flag; the pay | `src/sim/crime.js`, `src/sim/street.js`, `src/sim/dispatch.js`, `src/render/overlays.js` | M19.T6 | M19-5 | M |
| M19.T8 | **Persons in crisis.** The event, the cordon, talking down, subduing | `src/sim/crime.js`, `src/sim/talk.js`, `src/sim/combatai.js` | M19.T7, M21.T14 | M19-6 | S |
| M19.T9 | **Bounties and the database.** The police computer; the 10 most wanted; the bounty office; the false advisory | new `src/sim/bounties.js`, `src/sim/crime.js`, `src/ui/vehiclewheel.js`, `src/sim/hackables.js` | M19.T7 | M19-7 | M |
| M19.T10 | **Checks, red: robberies and gangs.** `m19-robbery.spec.js`, `m19-gangs.test.js`, `m19-gangs.spec.js`, `m19-ganglife.spec.js`, `m19-turf.test.js`, `m19-turf.spec.js`, `m19-guarded.spec.js`, `m19-views.spec.js`, `m19-save.spec.js` | new `tests/accept/m19-robbery.spec.js`, new `tests/m19-gangs.test.js`, new `tests/accept/m19-gangs.spec.js`, new `tests/accept/m19-ganglife.spec.js`, new `tests/m19-turf.test.js`, new `tests/accept/m19-turf.spec.js`, new `tests/accept/m19-guarded.spec.js`, new `tests/accept/m19-views.spec.js`, new `tests/accept/m19-save.spec.js` | M19.T1 | M19-8 to M19-13, M19-15 red | S |
| M19.T11 | **Robberies.** Aim at a shopkeeper; the bag, the alarm, the takings; vaults and cases through the interiors; the cash truck; night burglary and waking | new `src/sim/robbery.js`, `src/sim/interior.js`, `src/sim/traffic.js` | M19.T10, M33.T3 | M19-8 | M |
| M19.T12 | **Gangs from the seed.** Twelve archetypes in `gangs.json`; 6-10 per city with names, colours, cars, weapons and turf; corners and patrols; hostility by standing | new `src/sim/gangs.js`, new `src/content/gangs.json`, `src/sim/citygen.js` | M19.T10 | M19-9 (part) | M |
| M19.T13 | **Gangs, drawn.** Colours as outfit tints in the walker pool; gang cars from M18's pools with liveries | `src/render/npcs.js`, `src/render/traffic.js` | M19.T12 | M19-9, M19-14 (part) | S |
| M19.T14 | **Gang life.** Skirmishes, ambushes, revenge, convoys, hideouts | `src/sim/gangs.js`, `src/sim/combatai.js`, `src/sim/hideouts.js` | M19.T12 | M19-10 | M |
| M19.T15 | **Turf wars.** Starting a war, three waves, taking a district, patrols that change | `src/sim/gangs.js`, `src/sim/patrol.js`, `src/sim/crime.js` | M19.T14 | M19-11 | M |
| M19.T16 | **Guarded places.** Security firms' patrols, checkpoints, alert levels and roles; district gates; the Guard depot; restricted areas | new `src/sim/guards.js`, `src/sim/combatai.js`, `src/sim/wanted.js` | M19.T10, M13.T28 | M19-12 | M |
| M19.T17 | **Views and draws.** The crime and turf views; the ledger at the busiest gang fight | `src/render/overlays.js`, `src/ui/cityview.js`, `perf.json` | M19.T15 | M19-13, M19-14 | S |
| M19.T18 | **Save** keeps everything in M19-15 | `src/sim/save.js` | M19.T17 | M19-15 | M |
| M19.T19 | **Close.** The sweep at every star and in every turf; one commit per defect | the sweep, `content/hints.json` | all of the above | M19-16 | M |

## Decisions for the operator

None.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M19-4 | CS-05-020, CS-05-021, CS-08-045, CS-11-059 |
| M19-5 | WD-14-006, WD-09-011, WD-09-012, WD-15-021, CP-16-002, CP-16-003, CP-16-004, CP-16-001, CP-16-006 |
| M19-6 | CP-16-007, CP-16-008 |
| M19-8 | GTA-11-006, GTA-11-007, GTA-11-008 |
| M19-9 | GTA-07-044 to GTA-07-048, GTA-07-113, GTA-08-037, WD-09-015, WD-09-017, WD-09-019, WD-09-020, WD-09-021, WD-09-030, WD-09-038, WD-09-039, CP-13-014 to CP-13-024, CP-02-046, CP-02-047 |
| M19-10 | WD-02-014, WD-02-015, WD-09-022, WD-12-003, WD-12-004, CP-12-041, CP-13-029 |
| M19-11 | GTA-07-049, WD-02-016 |
| M19-12 | WD-09-023 to WD-09-029, WD-09-036, WD-13-026 |
