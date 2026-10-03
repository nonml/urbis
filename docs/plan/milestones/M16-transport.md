# M16 — Transport

From: `docs/plan/features/mechanics.md` GAP-03-001 to GAP-03-035 (GAP-03-031 is M15-20's);
`docs/plan/CAPABILITIES.md` S22, S29's freight and trade, S38, S42's tours, S52 and G25.
When it closes, the city has every way of moving that Cities: Skylines has: buses,
trolleybuses, trams, metro, trains, monorail, cable cars, ferries, blimps, helicopters,
airports, taxis, freight by road, rail, sea and air, bikes, foot paths and parking; people
pick how to travel each trip; and in the street the player rides every one of them,
drives a train, takes a taxi and travels fast between stations, as in GTA, Watch Dogs and
Cyberpunk. Pillars: build it, live in it; the city lives.

Needs first: M3-6 (routed traffic), M4-9 (the road in from outside), M4-2 (river), M5-10
(road types), M10-1 (any car), M14-4 (levels and tunnels). Lane: city, with the street
parts in lane: street.

## Keys

- **City view:** every transit tool sits in the tool bar. The line tool: click stops in
  order, click the first again to close the line; right click puts it down (M5-7).
- **On foot:** at a stop, a station gate or a taxi, **E** boards (E uses what is in front).
  Riding, **E** gets off at the next stop. **Space** while riding skips to the next stop
  (Space is the mode's own action; riding is its own mode). In a station, **M** opens the
  network map and a click on a station travels there.
- **A train cab:** **F** gets in or out (F is the car key); W and S are throttle and
  brake, as in a car.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M16-1 | **Routes by lane:** a car picks its lane for its next turn 60 m before the junction, changes lanes in gaps, and finds a new route when its road is jammed for 20 s. Each road type's speed limit (M14's `roads.json`) caps it. Emergency vehicles on a call drive 30% faster, take the emptiest lane, and others pull over. A/B: closing one road of a busy route moves at least half its traffic to the next quickest route within 1 game minute | `tests/m16-routing.test.js` | partial: M3-6 plans A* trips with lanes and signals; no lane choice before turns, no reroute, no priority | GAP-03-002, GAP-03-016, GAP-03-020 |
| M16-2 | **Trips:** each household owns 0-2 cars by wealth, shared by its members. Every trip picks walk, cycle, transit, taxi or car by distance, time, cost and what the household owns; the share of each shows in the transport panel. Car traffic swells at 07:00-09:00 and 17:00-19:00 to at least twice the midday count. A jam lasting 2 game minutes on a main road makes a news line and an icon | `tests/m16-trips.test.js` | partial: walker share follows the rushes; car traffic loops all day | GAP-03-003, GAP-03-021, GAP-03-022, GAP-03-023, GAP-03-025 |
| M16-3 | **The line tool:** every transit mode uses one tool: place stops, draw a line through them, edit stops, set the vehicle count with a slider, name it and pick its colour and vehicle model. The line overview lists every line with riders, income and upkeep. Fares go to the budget. The transit view shows every line, and each vehicle carries a set number of riders (bus 30, tram 90, metro 180, train 240 *(provisional)*), counted as they board | `tests/m16-lines.test.js`, `tests/accept/m16-lines.spec.js` | red: none | GAP-03-024 |
| M16-4 | **Freight:** goods trucks run between works, warehouses and shops (M14-14) and to and from the outside on the regional road; imports fill what the city lacks and exports sell its surplus, shown in a trade panel. Freight trains haul goods between a rail freight yard and the outside; a cargo port takes freighters at its quays; a cargo airport takes cargo planes; a freight interchange moves goods between truck, train and ship. Courier vans make deliveries to homes along the routes. A/B: a city with a cargo port and rail yard has at least 40% fewer trucks on the regional road | `tests/m16-freight.test.js` | red: none (works make nothing) | GAP-03-005, GAP-03-006, GAP-03-008, GAP-03-030 |
| M16-5 | **Buses and trolleybuses:** stops, a depot, a terminal, an intercity bus station whose line runs to the outside; trolleybus stops and lines on roads with wires strung over them; school buses fetch children to M15-10's schools; a sightseeing bus line and walking tours visit M14-19's landmarks and M14-20's attractions. Bus lanes on the road types that have them let buses pass jams. Buses pull into stops and kneel; people board and alight from the walker pool | `tests/accept/m16-buses.spec.js` | red: none | GAP-03-014, GAP-03-018, GAP-03-019 |
| M16-6 | **Trams:** roads with tracks (two, four and six lanes, one-way), separate tracks, a depot and stops. Trams share the road with cars and stop at lights. Tracks are part of the road pool, at 0 more draws | `tests/accept/m16-trams.spec.js` | red | — |
| M16-7 | **Metro:** stations with entrances in the street; tracks in tunnels, at ground and elevated (M14-4); a depot. The player walks down the stairs to a platform. Riders take the metro by M16-2's choice | `tests/accept/m16-metro.spec.js` | red: none | — |
| M16-8 | **Trains:** passenger stations, track (two-way and one-way), a depot; intercity trains to the outside. A level crossing lowers its gates 10 s before a train and holds cars until it passes; a car on the track when the train comes is hit (M10's crash) | `tests/accept/m16-trains.spec.js` | red | GAP-03-001 |
| M16-9 | **Monorail and cable cars:** a monorail runs on an elevated beam with stations and a depot; cable cars ride between two stations over streets, river or hills | `tests/accept/m16-cable.spec.js` | red | GAP-03-004, GAP-03-009 |
| M16-10 | **On the water:** ferry docks, a ferry line and depot on the river or coast; passenger ferries; fishing boats that work routes out of a fishing harbour and sell fish through M14-14's goods | `tests/accept/m16-water.spec.js` | red | GAP-03-011 |
| M16-11 | **In the air:** passenger helicopter stops and lines; an advertising blimp line; an aviation club, a small airport, an international airport and a metropolitan airport, built with the airport area tool from terminal, concourse, runway, taxiway and control tower pieces. Airlines arrive as the airport grows; the airport joins metro, train and bus lines. A hangar at a small airfield can be the player's base (M22) | `tests/m16-air.test.js`, `tests/accept/m16-air.spec.js` | red: a police helicopter only (`render/heli.js`) | GAP-03-029 |
| M16-12 | **Hubs:** ready-made stations join several modes (train and metro, bus and metro, ferry and bus, metro and intercity bus) so riders change between them; extra station designs per mode | `tests/m16-hubs.test.js` | red | GAP-03-010, GAP-03-017 |
| M16-13 | **Taxis:** a taxi depot and stands; taxis carry residents (M16-2). In the street, the player hails one with E at the kerb or a stand, picks a place on the map, and rides: a fare per km shows and is paid on arrival; Space skips the ride. A driverless taxi service runs in districts with high-tech housing (M14-18) | `tests/accept/m16-taxi.spec.js` | red | — |
| M16-14 | **Riding:** the player boards any bus, tram, metro, train, monorail, cable car or ferry with E, rides seated with the view out of the window, gets off at the next stop with E, and Space skips to the next stop. Every metro and train station the player has walked into joins a network map; a click on one travels there in the ride's time, for its fare | `tests/accept/m16-ride.spec.js` | red | GAP-03-027 |
| M16-15 | **Driving a train:** at a freight yard or depot the player enters a cab with F and drives the train with W and S along the track; signals show red and green; running a red against another train crashes. A hack (M6) on a metro train stops it or sends it on | `tests/accept/m16-drivetrain.spec.js` | red | GAP-03-026 |
| M16-16 | **Bikes and paths:** roads with bike lanes (two, four, six lanes); pedestrian streets and paths in four styles, placed freely; buildings can face a path; pedestrian zones where only service vehicles enter, unloading at the edge; bike parking. Cyclists ride bike lanes first and paths second; walkers take shortcuts across paths and walk 20% faster on a path than on grass. Cycling policies raise the cycle share, A/B. A bike shop sells bikes to the player (M18) | `tests/m16-bikes.test.js`, `tests/accept/m16-bikes.spec.js` | partial: bike hoops are drawn (`render/props.js`); no cyclist, no path | GAP-03-012, GAP-04-006 |
| M16-17 | **Parking:** car parks, garages and parking roads; drivers look for a space near their goal and add search traffic when none is free; parking fees and roadside fees go to the budget. The parking view shows free spaces. In the street, parked cars come and go from the kerbs and car parks | `tests/m16-parking.test.js` | partial: kerbs are lined with parked cars that never move | — |
| M16-18 | **Road options:** toll booths charge every vehicle passing, and drivers avoid them if a free route is under 20% longer; street trees are picked by species and side, and cut noise within 30 m by 30% (M14-2's tree-lined road); a new game sets left- or right-hand traffic, which flips lanes, doors and junction rules everywhere | `tests/m16-roadopts.test.js`, `tests/accept/m16-lefthand.spec.js` | partial: avenue trees line the roads; the driving side is fixed | GAP-03-007, GAP-03-013, GAP-03-015 |
| M16-19 | **Trails:** dirt trails from the seed cross the open country and hills beyond the town (M4), drivable by off-road vehicles (M18) and walkable | `tests/accept/m16-trails.spec.js` | red: the outskirts have no trails (`render/outskirts.js`) | GAP-03-028 |
| M16-20 | **Road devices and road rage:** the player hacks (M6) a spike strip in a road to rise under a fleeing car, bursting its tyres; road blockers (angled slabs) rise or drop by hack. A driver the player cuts off within 3 m honks; one in four shouts, and one in ten gets out to fight (M13) | `tests/accept/m16-devices.spec.js` | partial: police-laid spike strips burst tyres by themselves | GAP-03-032, GAP-03-033, GAP-03-035 |
| M16-21 | **The draw cost:** every transit vehicle kind joins the traffic pools; with every mode on screen at the busiest pose the frame is at or under 175 draws, M16 adding at most 10 | the ledger | — | — |
| M16-22 | A saved game keeps every line, stop, station, airport, toll, path and parking place, and continues the same | `tests/accept/m16-save.spec.js` | red | — |
| M16-23 | The sweep of every mode, from the street and the city view, day and night, riding and watching, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M16.T1 | **Checks, red: roads and trips.** `m16-routing.test.js`, `m16-trips.test.js`, `m16-lines.test.js`, `m16-lines.spec.js`, `m16-freight.test.js`, `m16-roadopts.test.js`, `m16-lefthand.spec.js`, `m16-parking.test.js` | new `tests/m16-routing.test.js`, new `tests/m16-trips.test.js`, new `tests/m16-lines.test.js`, new `tests/accept/m16-lines.spec.js`, new `tests/m16-freight.test.js`, new `tests/m16-roadopts.test.js`, new `tests/accept/m16-lefthand.spec.js`, new `tests/m16-parking.test.js` | M3.T29 | M16-1 to M16-4, M16-17, M16-18 red | S |
| M16.T2 | **Lanes and rerouting.** Lane choice before turns, gap changes, rerouting after 20 s of jam, speed limits from `roads.json`, emergency priority and pulling over | `src/sim/traffic.js` | M16.T1, M14.T6 | M16-1 | M |
| M16.T3 | **Trips and modes.** Household cars; the mode choice per trip; the rush-hour car curve; jam news and icon | `src/sim/commute.js`, `src/sim/people.js`, `src/sim/traffic.js`, `src/sim/news.js` | M16.T2 | M16-2 | M |
| M16.T4 | **The line tool, sim.** Stops, lines, vehicle counts, names and colours, riders and fares, the line overview's numbers | new `src/sim/transit.js`, `src/sim/budget.js`, `src/sim/ops.js` | M16.T3 | M16-3 (part) | M |
| M16.T5 | **The line tool, shown.** The tool, the overview panel, the transit view | `src/sim/cityview.js`, `src/ui/cityview.js`, new `src/ui/lines.js`, `src/render/overlays.js` | M16.T4 | M16-3 | M |
| M16.T6 | **Freight.** Trucks between works, warehouses, shops and the outside; imports and exports; the trade panel; courier vans | `src/sim/goods.js`, `src/sim/traffic.js`, new `src/sim/freight.js`, `src/ui/cityview.js` | M16.T3, M14.T25 | M16-4 (part) | M |
| M16.T7 | **Freight by rail, sea and air.** The freight yard and trains, the cargo port and freighters, the cargo airport and the interchange | `src/sim/freight.js`, `src/sim/transit.js` | M16.T6, M16.T13 | M16-4 | M |
| M16.T8 | **Parking.** Car parks, garages, parking roads; the space search; fees; the view; kerb cars that come and go | new `src/sim/parking.js`, `src/sim/traffic.js`, `src/render/traffic.js`, `src/render/overlays.js` | M16.T3 | M16-17 | M |
| M16.T9 | **Road options.** Toll booths and avoiding them; street tree species and sides; left- or right-hand traffic set by the new game | `src/sim/traffic.js`, `src/sim/map.js`, `src/sim/newgame.js`, `src/render/landscape.js` | M16.T2 | M16-18 | M |
| M16.T10 | **Checks, red: modes.** `m16-buses.spec.js`, `m16-trams.spec.js`, `m16-metro.spec.js`, `m16-trains.spec.js`, `m16-cable.spec.js`, `m16-water.spec.js`, `m16-air.test.js`, `m16-air.spec.js`, `m16-hubs.test.js` | new `tests/accept/m16-buses.spec.js`, new `tests/accept/m16-trams.spec.js`, new `tests/accept/m16-metro.spec.js`, new `tests/accept/m16-trains.spec.js`, new `tests/accept/m16-cable.spec.js`, new `tests/accept/m16-water.spec.js`, new `tests/m16-air.test.js`, new `tests/accept/m16-air.spec.js`, new `tests/m16-hubs.test.js` | M16.T1 | M16-5 to M16-12 red | S |
| M16.T11 | **Buses and trolleybuses.** Stops, depots, terminals, intercity; trolleybus wires; school buses; sightseeing line and walking tours; bus lanes; kneeling, boarding and alighting | `src/sim/transit.js`, `src/sim/walkers.js`, `src/content/roads.json` | M16.T5 | M16-5 (part) | M |
| M16.T12 | **Trams.** Track roads and separate track, depot, stops; trams at lights | `src/sim/transit.js`, `src/sim/traffic.js`, `src/content/roads.json`, `src/render/roads.js` | M16.T5 | M16-6 | M |
| M16.T13 | **Metro and trains.** Stations with street entrances and platforms; tracks at three levels; depots; intercity trains; level crossings | `src/sim/transit.js`, new `src/sim/rail.js`, `src/sim/map.js`, `src/sim/traffic.js` | M16.T5, M14.T8 | M16-7, M16-8 | M |
| M16.T14 | **Monorail and cable cars.** Beams, cables, stations | `src/sim/rail.js`, `src/sim/transit.js` | M16.T13 | M16-9 (part) | S |
| M16.T15 | **On the water.** Ferry docks, lines and depots; fishing harbour and boats; fish into goods | new `src/sim/boats.js`, `src/sim/transit.js`, `src/sim/goods.js` | M16.T5 | M16-10 (part) | M |
| M16.T16 | **In the air.** Helicopter stops and lines; the blimp; the airport area tool and its pieces; airlines; links to other lines; the hangar base | new `src/sim/airport.js`, `src/sim/transit.js`, `src/sim/ops.js` | M16.T5 | M16-11 (part) | M |
| M16.T17 | **Hubs.** Multi-mode stations and extra designs | `src/sim/transit.js`, `src/content/services.json` | M16.T13 | M16-12 | S |
| M16.T18 | **Transit bodies** (lane: assets). Bus, trolleybus, tram, metro, train, monorail, cable car, ferry, fishing boat, freighter, blimp, helicopter and plane models from M2's pipeline, in the traffic pools | `public/assets/models/`, `src/render/traffic.js`, new `src/render/transit.js` | M16.T11, M2.T6 | M16-5, M16-6, M16-9, M16-10, M16-11 | M |
| M16.T19 | **Stations and track, drawn.** Stops, stations, entrances, platforms, rails, wires, beams, cables, docks, runways, as pooled pieces | `src/render/transit.js`, `src/render/roads.js` | M16.T18 | M16-7, M16-8, M16-21 (part) | M |
| M16.T20 | **Checks, red: the player rides.** `m16-taxi.spec.js`, `m16-ride.spec.js`, `m16-drivetrain.spec.js`, `m16-bikes.test.js`, `m16-bikes.spec.js`, `m16-trails.spec.js`, `m16-devices.spec.js`, `m16-save.spec.js` | new `tests/accept/m16-taxi.spec.js`, new `tests/accept/m16-ride.spec.js`, new `tests/accept/m16-drivetrain.spec.js`, new `tests/m16-bikes.test.js`, new `tests/accept/m16-bikes.spec.js`, new `tests/accept/m16-trails.spec.js`, new `tests/accept/m16-devices.spec.js`, new `tests/accept/m16-save.spec.js` | M16.T10 | M16-13 to M16-20, M16-22 red | S |
| M16.T21 | **Taxis.** Depot and stands; taxi trips; hailing with E, the destination on the map, the meter, Space skips; driverless taxis | new `src/sim/taxi.js`, `src/sim/traffic.js`, `src/game/input.js`, `src/ui/mapscreen.js` | M16.T20, M10.T4 | M16-13 | M |
| M16.T22 | **Riding.** Boarding with E, the seated view, getting off, Space skips; the station network map and fast travel for the fare | new `src/game/ride.js`, `src/game/camera.js`, `src/sim/transit.js`, `src/ui/mapscreen.js` | M16.T20, M16.T19 | M16-14 | M |
| M16.T23 | **Driving a train.** The cab with F, throttle and brake on the track, signals, crashes; the metro hack | `src/sim/rail.js`, `src/sim/vehicle.js`, `src/sim/hackables.js`, `src/game/input.js` | M16.T22, M6 | M16-15 | M |
| M16.T24 | **Bikes and paths.** Bike-lane roads; free paths in four styles; path frontage; pedestrian zones; bike parking; cyclists and shortcuts; cycling policies; the bike shop | `src/content/roads.json`, `src/sim/map.js`, `src/sim/walkers.js`, `src/sim/traffic.js`, `src/sim/policies.js` | M16.T20, M14.T6, M14.T31 | M16-16 | M |
| M16.T25 | **Trails.** Dirt trails across the outskirts from the seed, on the terrain | `src/sim/citygen.js`, `src/sim/terrain.js`, `src/render/outskirts.js` | M16.T20 | M16-19 | S |
| M16.T26 | **Road devices and road rage.** Hackable spike strips and road blockers; honking, shouting and drivers who get out to fight | `src/sim/hackables.js`, `src/sim/traffic.js`, `src/sim/street.js`, `src/render/props.js` | M16.T20, M6, M13.T21 | M16-20 | M |
| M16.T27 | **The draw cost.** Every mode on screen at the busiest pose; trim pools until the ledger is at or under 175 | `src/render/transit.js`, `src/render/traffic.js`, `perf.json` | M16.T19 | M16-21 | S |
| M16.T28 | **Save** keeps everything in M16-22 | `src/sim/save.js` | M16.T27 | M16-22 | M |
| M16.T29 | **Close.** The sweep of every mode, riding and watching; one commit per defect; the riding keys in the hints | the sweep, `content/hints.json` | all of the above | M16-23 | M |

## Decisions for the operator

None.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M16-3 | CS-06-059 to CS-06-067, CS-07-031, CS-09-033, CS-15-012 |
| M16-4 | CS-06-020, CS-07-010, CS-07-011, CS-09-020, CS-09-021 |
| M16-5 | CS-02-023 to CS-02-027, CS-02-042, CS-06-001 to CS-06-006, CS-06-034, CS-06-035, CS-06-036, CS-12-016, CS-12-017 |
| M16-6 | CS-02-028 to CS-02-035, CS-02-043, CS-02-081, CS-02-082, CS-06-007, CS-06-008, CS-06-009 |
| M16-7 | CS-06-010, CS-06-011, CS-06-012, CS-06-074, CP-01-029 |
| M16-8 | CS-06-013 to CS-06-016 |
| M16-10 | CS-06-026, CS-06-027, CS-06-028, CS-06-072 |
| M16-11 | CS-06-029 to CS-06-031, CS-06-037 to CS-06-047, CS-06-058, CS-06-077 |
| M16-12 | CS-06-048 to CS-06-057 |
| M16-13 | CS-06-032, CS-06-033, CS-06-073, CS-06-075, GTA-02-056, GTA-10-017, GTA-10-090, WD-07-025 |
| M16-14 | WD-06-011, WD-13-046, WD-17-041, CP-01-028, CP-01-030, CP-01-031, CP-01-019, CP-01-020, CP-01-021, CP-11-044 |
| M16-15 | WD-01-012 |
| M16-16 | CS-02-020, CS-02-021, CS-02-022, CS-02-039, CS-02-040, CS-05-050, CS-07-019, CS-07-020, CS-07-021, CS-07-024, CS-11-038, CS-11-047, CS-12-004, CS-12-005, CS-12-013, GTA-13-028 |
| M16-17 | CS-02-041, CS-07-017, CS-07-018, CS-07-035, CS-07-039, CS-11-064, CS-15-037 |
