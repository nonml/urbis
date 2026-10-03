# M18 — Every vehicle

From: `docs/plan/features/mechanics.md` GAP-05-002 to GAP-05-084 (GAP-05-019 and
GAP-05-052 are M13-20's, GAP-05-038 is M17-1's); `docs/plan/CAPABILITIES.md` G5, G8 and
C12. When it closes, the player drives, rides, sails and flies every class of vehicle the
three street games have, from a compact to a cargo plane; owns, stores, insures, calls,
tunes, paints and sells them; and passes driving, riding, boat and flying schools. Every
vehicle is a real-world kind with an invented maker. Pillars: live in it; every tool is
expressive.

Needs first: M10 (any car, collision, damage, handbrake), M13 (weapons, explosions), M16
(transit, airports, freight, trails), M17 (first person, ragdolls, parachutes), M2's model
pipeline, M11-4 (property). Lane: street, with the models in lane: assets.

**The grounded rule holds** (`AGENTS.md`): a flying car is a helicopter; a car with
missiles, a jetpack or a submarine car is one prototype hidden in the city as an easter
egg (M18-20); military vehicles stand at the National Guard depot and come out at ★5
(M19).

## Keys

In a vehicle (rebindable on M7.T11's screen):

- **L** headlights: tap on or off, hold for full beam; set to automatic by default.
- **V** cycles four views: far, near, bonnet, first person (M17-1); **hold V** is the
  cinematic camera. **C** looks behind. The mouse looks around and the view stays where
  it was put until the mouse moves again.
- **Shift** fires nitrous when fitted (on foot Shift runs: both mean "faster").
- **K** held, with W, A, S and D, works the hydraulics when fitted.
- **E** is the horn (M7-1); in a police car, ambulance or fire engine, tap E switches the
  siren and lights.
- **Tab, hold:** the vehicle wheel, with the drive-by weapon above (M13-20) and the
  vehicle's options below: roof, autopilot, change seat, put passengers out, the boot,
  engine off, unhitch, call a mechanic.
- **F** gets out; at over 15 km/h it jumps out and rolls.
- **On two wheels:** **Ctrl** held leans back (a wheelie under throttle), **Alt** held
  leans forward (a stoppie under brake); **Space** on a bicycle hops.
- **In the air:** W and S throttle, or lift for a helicopter; the mouse pitches and rolls;
  A and D yaw; **G** raises or lowers the landing gear; **E** fires countermeasures where
  fitted; left mouse drops bombs or fires where fitted; **F** bails out (M17-6).

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M18-1 | **Cars, every class:** compacts, sedans, coupes, muscle cars, sports cars, classic sports cars, supercars, tuned performance cars, SUVs and open-wheel race cars, at least 3 models a class (2 for race cars), each with its own top speed, acceleration, grip, mass and sound in `vehicles.json`, under eight invented makers. On a test track: a supercar laps at least 25% faster than a compact, a muscle car out-accelerates a sedan in a straight line, and a compact parks in a gap 1 m shorter than a sedan needs. The traffic mix follows a district's wealth (more supercars in rich districts, more compacts in poor) | `tests/m18-classes.test.js`, `tests/accept/m18-cars.spec.js` | red: five body shapes, one handling (`render/traffic.js` `CAR_SHAPES`) | GAP-05-007, GAP-05-008, GAP-05-014, GAP-05-016, GAP-05-037, GAP-05-042, GAP-05-043, GAP-05-073, GAP-05-079, GAP-05-015 |
| M18-2 | **Working vehicles:** cargo and passenger vans, pickups, tow trucks, flatbeds, box trucks and rigs, buses, taxis and garbage trucks, ambulances and fire engines, dumpers, cement mixers and forklifts, off-road trucks and buggies, and the National Guard's armoured vehicles. Each is in traffic or parked where its trade is (a forklift at a warehouse, a mixer at a building site), and F enters every one (M10-1). An off-road truck crosses M16-19's trails at 70% of its road speed and a sedan at 25% | `tests/accept/m18-work.spec.js` | partial: police cruisers drive; no other working vehicle (searched "forklift", "ambulance" in src: none) | GAP-05-013, GAP-05-020, GAP-05-022, GAP-05-025, GAP-05-033, GAP-05-035, GAP-05-036, GAP-05-062, GAP-05-077 |
| M18-3 | **Two wheels and four:** motorbikes steer by leaning; Ctrl and Alt make wheelies and stoppies; a helmet goes on by itself; a bike crash throws the rider off as a ragdoll (M17-5). Quad bikes slide and tip over above 40° of slope. Pedal bicycles (road, BMX, mountain) use stamina (M17-10) and hop with Space. Fists and melee weapons strike from a bike, and throwing knives can be thrown (M13) | `tests/accept/m18-bikes.spec.js` | red: none | GAP-05-044, GAP-05-048, GAP-05-051, GAP-05-060, GAP-05-066, GAP-05-080 |
| M18-4 | **Handling:** throttle with the handbrake held spins the rear wheels and smokes (a burnout). A car on its roof stays there until the player pushes it upright from beside it with E. Shooting a tyre flattens it; slashing a parked car's tyre with a blade does too; a flat tyre driven on for 30 s shreds to the rim, and the car pulls to its side. Off-road tyres grip 30% better off the road and 10% worse on it. Q in a car slows time to 0.3 times for up to 4 s (M6-3's Focus) for a tight corner | `tests/m18-handling.test.js`, `tests/accept/m18-handling.spec.js` | partial: spike strips flatten tyres (`sim/response.js:193`) | GAP-05-010, GAP-05-018, GAP-05-027, GAP-05-056, GAP-05-072 |
| M18-5 | **In the car:** L headlights (automatic at dusk by default, full beam held); wipers sweep in rain and snow; a convertible's roof goes up or down from the wheel in 3 s; the siren and lights with E in emergency vehicles; hydraulics with K; V's four views and the cinematic camera; C looks behind; the mouse's view holds where it was put. Each plate shows a regional name and colour; a custom plate is typed at the mod shop (M18-17) | `tests/accept/m18-controls.spec.js` | partial: headlights always on; police light bars flash (`render/police.js`); the view snaps back after 2 s | GAP-05-002, GAP-05-021, GAP-05-041, GAP-05-045, GAP-05-063, GAP-05-064, GAP-05-070, GAP-05-076, GAP-05-084 |
| M18-6 | **Damage, seen:** panels dent where a car is hit, glass cracks and then shatters, lights break; at 60% damage it smokes (M10), at 90% it burns, and 8 s later it explodes (M13's blast). In a crash above 70 km/h with no seat belt (a setting in the wheel, on by default for missions off), the player goes through the windscreen as a ragdoll | `tests/accept/m18-damage.spec.js` | red: M10 plans damage 0-1 with smoke and a darkened wreck | GAP-05-005, GAP-05-047 |
| M18-7 | **Getting in and out:** a locked parked car is hotwired in 2 s after breaking in, and half of them sound an alarm for 30 s that draws the police if anyone hears; F at over 15 km/h jumps out and rolls. In a stopped car the player changes seat from the wheel and puts passengers out. The player can ride as a passenger when someone else drives (a taxi, a friend, a mission), and a passenger who is a friend (M21) talks about the city on the way. Engine off and crouched in a car, the player is hidden from a search unless an officer comes within 3 m. A driver whose car is taken chases the player on foot for 10 s, or rams them if in another car | `tests/accept/m18-getin.spec.js` | partial: F exits at any speed with no roll; carjacking is M10-1 | GAP-05-006, GAP-05-009, GAP-05-023, GAP-05-024, GAP-05-029, GAP-05-034, GAP-05-054, GAP-05-065, GAP-05-078 |
| M18-8 | **Autopilot:** from the wheel, a car with autopilot (any car bought new from the top two makers) drives itself to the map's waypoint along M3's routes, obeying lights; the player can take over with any key. A self-driving taxi service runs (M16-13); one taxi's AI is a story event (M24), not a hazard in traffic | `tests/accept/m18-autopilot.spec.js` | red | GAP-05-004 |
| M18-9 | **Boats:** speedboats, jet skis, a sailboat that goes with the wind, a hovercraft that crosses water and flat land, and an amphibious truck that drives into the river and floats; each handled on M4-2's water with a wake. A mini-submarine at the harbour dives to the river's bed with a light and a sonar ping that shows things on the bottom (M24's hidden things); an armed submarine at the naval yard fires torpedoes at boats on the surface and at other submarines | `tests/accept/m18-boats.spec.js` | red: no boat | GAP-05-017, GAP-05-050, GAP-05-082, GAP-05-083, GAP-08-006 |
| M18-10 | **Helicopters:** light, news, police, cargo and an attack helicopter at the National Guard depot; entered with F at a helipad or the airfield; flown with the keys above; damage, smoke and a crash that ragdolls the crew; a cargo hook lifts a car or a container; bailing out with a parachute. A private air-ambulance plan, bought at a hospital, lands a helicopter by the player within 60 s when they are down (M13-1) and takes them to hospital instead of the respawn's fee | `tests/accept/m18-heli.spec.js` | partial: the police helicopter flies itself (`render/heli.js`); nobody can fly one | — |
| M18-11 | **Planes:** a passenger plane, a cargo plane, a stunt plane, a seaplane that lands on the river, a small jet, and fighter jets at the National Guard depot. Throttle, landing gear, flaps and brakes; a plane stalls under its stall speed; landing over 4 m/s down breaks the gear. Flying into the depot's airspace gives ★4 in 10 s after a warning. Flares, released with E, pull a missile off the plane or the attack helicopter; flares and bombs only on the military ones. A blimp flies slowly over the city | `tests/accept/m18-planes.spec.js` | red: none | GAP-08-030 |
| M18-12 | **Schools:** a driving school (8 tests: parking, slaloms, emergency stops, a handbrake turn), a motorbike school (6), a boat school (6) and a flight school (10 lessons, planes and helicopters, including flying under a bridge and knife flight between towers), each scored gold, silver, bronze; gold in all of a school gives a licence and a vehicle | `tests/m18-schools.test.js` | red | GAP-05-030, GAP-05-057, GAP-05-058 |
| M18-13 | **Air races and dogfights:** 6 air races per city, routed from the seed between its towers, bridges and hills, with rings; a dogfight against 3 pilots at the airfield ends when one side's planes are down | `tests/accept/m18-airraces.spec.js` | red | — |
| M18-14 | **Trailers:** backing a truck within 0.5 m of a trailer's hitch couples it; the trailer swings behind and can jackknife at speed; unhitched from the wheel; owned trailers (a car carrier, a boat trailer, a horsebox, a flatbed) are kept at the player's garage | `tests/accept/m18-trailers.spec.js` | red | GAP-05-049, GAP-05-075 |
| M18-15 | **Owning:** cars the player buys, or drives into a garage they own (M11-4), are theirs. A garage holds 2, 6 or 10 by size; the player calls any owned car from M27's phone and a mechanic drives it to them within 60 s, or it waits in a garage; an owned car left on the street goes back to its garage after 10 game minutes. A stolen car left on the street is towed to the impound, which charges a fee to get it out. A destroyed owned car comes back at its garage after an insurance fee; without insurance it is gone. The boot of an owned car holds items (M25) | `tests/accept/m18-own.spec.js` | partial: one hero car with a finder (`render/traffic.js:493`) | GAP-05-031, GAP-05-059, GAP-05-061, GAP-05-069, GAP-05-074, GAP-05-081 |
| M18-16 | **Buying and selling:** three dealers in the city (cheap used, new, luxury) with cars on the floor; four sites on M27's phone (super cars, motorbikes, military-surplus, aircraft) that deliver by truck, or by a cargo helicopter's sling to an open place within 200 m; prices in ₡ and some unlocked by M11's cred; selling any owned or stolen car at a garage for a share of its value (stolen cars only after a respray); some vehicles come as mission rewards | `tests/accept/m18-buy.spec.js` | red | GAP-05-026 |
| M18-17 | **The mod shop:** three per city (a body shop, a tuner, a lowrider shop). Respray (40 colours, matte, metallic, pearl, a two-tone, copying another car's colour), repair, armour (5 grades), brakes, engine, gearbox, turbo, suspension and stance, tyres, wheels (40), exhaust, horn, lights, an LED underglow (white or one colour, as street kits are), tint, body parts, liveries, tyre smoke, hydraulics, nitrous, lettered tyres, plates, and conversions of some models. Each part changes the numbers in `vehicles.json`, A/B. A respray while wanted drops heat to 0 if no officer sees the car go in | `tests/m18-mods.test.js`, `tests/accept/m18-modshop.spec.js` | red | — |
| M18-18 | **Work-shop builds:** a black-market workshop in the industrial district fits ram bars, armour plates, bulletproof tyres, a roof machine gun or a rocket pod on pickups, vans and armoured cars, caltrops dropped behind, a car bomb (ignition or remote, M13's blast) and a boost. A large truck converts into a mobile workshop where the player fits these anywhere. A mounted gun is fired by the player from the back (the camera behind it, the mouse aiming) or by a passenger while the player drives. A vehicle with a mounted weapon shows a mark on the map | `tests/accept/m18-workshop.spec.js` | red | GAP-05-011, GAP-05-039, GAP-05-040, GAP-05-053, GAP-05-067, GAP-08-005 |
| M18-19 | **Dirt and washes:** a car gathers grime over game days and off-road at once; rain cleans it slowly and a car wash at once, for ₡ | `tests/accept/m18-dirt.spec.js` | red | GAP-05-046 |
| M18-20 | **Prototypes:** one each per city, hidden in a place from the seed and found by a trail of clues (M24): a car that dives and drives under water, a jet suit that flies for 60 s, a car with missiles, and a school bus armoured by a crew in a story mission. Each is a known easter egg, not a class | `tests/accept/m18-prototypes.spec.js` | red | GAP-05-012, GAP-05-032 |
| M18-21 | **Cheats:** M17-12's dial pad spawns a car, a bike, a helicopter or a plane in front of the player, from 10 numbers in `cheats.json` | `tests/accept/m18-cheats.spec.js` | red | GAP-05-028 |
| M18-22 | **Bodies and draws** (lane: assets): every model from M2's pipeline, with the vehicle atlas; at most 8 kinds in the traffic pools at once, chosen by the district's mix and swapped as the player moves; M18 adds at most 8 draws at the busiest pose, which stays at or under 175 | the ledger | — | — |
| M18-23 | A saved game keeps every owned vehicle, its mods, damage, dirt, garage, trailer and insurance, licences and school medals, and continues the same | `tests/accept/m18-save.spec.js` | red | — |
| M18-24 | The sweep of every vehicle class, driven and seen in traffic, day and night, in rain, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M18.T1 | **Checks, red: driving.** `m18-classes.test.js`, `m18-cars.spec.js`, `m18-work.spec.js`, `m18-bikes.spec.js`, `m18-handling.test.js`, `m18-handling.spec.js`, `m18-controls.spec.js`, `m18-damage.spec.js`, `m18-getin.spec.js`, `m18-autopilot.spec.js` | new `tests/m18-classes.test.js`, new `tests/accept/m18-cars.spec.js`, new `tests/accept/m18-work.spec.js`, new `tests/accept/m18-bikes.spec.js`, new `tests/m18-handling.test.js`, new `tests/accept/m18-handling.spec.js`, new `tests/accept/m18-controls.spec.js`, new `tests/accept/m18-damage.spec.js`, new `tests/accept/m18-getin.spec.js`, new `tests/accept/m18-autopilot.spec.js` | M10.T22 | M18-1 to M18-8 red | S |
| M18.T2 | **The vehicle table.** `vehicles.json`: every class and model, its numbers, maker and sound; `vehicle.js` reads them; `check_vehicles.mjs` checks every entry has every number | new `src/content/vehicles.json`, new `scripts/check_vehicles.mjs`, `src/sim/vehicle.js` | M18.T1 | M18-1 (part), M18-2 (part) | M |
| M18.T3 | **The traffic mix.** Classes by district wealth; working vehicles where their trade is | `src/sim/traffic.js`, `src/sim/parking.js`, `src/sim/dressing.js` | M18.T2, M16.T3 | M18-1 (part), M18-2 (part) | S |
| M18.T4 | **Car bodies, first half** (lane: assets). Compacts, sedans, coupes, muscle, sports, classic sports from M2's pipeline into the atlas | `tools/models/clean_car.py`, `public/assets/models/` | M18.T2, M2.T6 | M18-1 (part) | M |
| M18.T5 | **Car bodies, second half** (lane: assets). Supercars, tuned cars, SUVs, race cars | `public/assets/models/` | M18.T4 | M18-1 | M |
| M18.T6 | **Working bodies** (lane: assets). Vans, pickups, tow trucks, flatbeds, trucks, rigs, buses, taxis, garbage trucks, ambulances, fire engines, dumpers, mixers, forklifts, off-roaders, buggies, armoured vehicles | `public/assets/models/` | M18.T4 | M18-2 (part) | M |
| M18.T7 | **Off-road.** Grip and speed by surface; trails, grass, sand | `src/sim/vehicle.js`, `src/sim/terrain.js` | M18.T2 | M18-2 | S |
| M18.T8 | **Two wheels, sim.** Leaning, wheelies, stoppies, quads tipping, bicycles on stamina, hops | `src/sim/vehicle.js`, new `src/sim/bike.js`, `src/game/input.js` | M18.T2 | M18-3 (part) | M |
| M18.T9 | **Two wheels, drawn.** Bikes, quads and bicycles from the pipeline; riders posed with lean; helmets; the crash ragdoll | `public/assets/models/`, `src/render/player.js`, `src/render/traffic.js` | M18.T8, M17.T9 | M18-3 | M |
| M18.T10 | **Handling.** Burnouts, rollovers and pushing upright, shot and slashed tyres, shredding to the rim, tyre types, Focus in a car | `src/sim/vehicle.js`, `src/sim/collide.js` | M18.T2, M6.T22 | M18-4 | M |
| M18.T11 | **In the car, sim.** Headlights automatic and manual, wipers, the roof, the siren, hydraulics, plates; the vehicle wheel | `src/sim/vehicle.js`, new `src/ui/vehiclewheel.js`, `src/game/input.js` | M18.T2 | M18-5 (part) | M |
| M18.T12 | **In the car, drawn.** Beams, wipers, roof, lights, hydraulic stance, plates' text; the four views, cinematic, look behind, held free look | `src/render/traffic.js`, `src/game/camera.js` | M18.T11, M17.T4 | M18-5 | M |
| M18.T13 | **Damage, seen.** Dents by hit point (vertex offsets in the instance), glass states, lights out, fire at 90%, the blast; the windscreen ejection | `src/render/traffic.js`, `src/sim/vehicle.js`, `src/render/explosions.js`, `src/sim/ragdoll.js` | M18.T2, M13.T8, M17.T9 | M18-6 | M |
| M18.T14 | **Getting in and out.** Hotwiring, alarms heard, the bail-out roll, seats, putting passengers out, riding as a passenger, a friend's talk, hiding with the engine off, the owner who chases | `src/sim/vehicle.js`, `src/sim/street.js`, `src/sim/wanted.js`, `src/sim/talk.js` | M18.T11, M21.T11 | M18-7 | M |
| M18.T15 | **Autopilot.** To the waypoint on M3's routes, lights obeyed, any key takes over | `src/sim/vehicle.js`, `src/sim/traffic.js` | M18.T11 | M18-8 | S |
| M18.T16 | **Checks, red: water and air.** `m18-boats.spec.js`, `m18-heli.spec.js`, `m18-planes.spec.js`, `m18-schools.test.js`, `m18-airraces.spec.js`, `m18-trailers.spec.js` | new `tests/accept/m18-boats.spec.js`, new `tests/accept/m18-heli.spec.js`, new `tests/accept/m18-planes.spec.js`, new `tests/m18-schools.test.js`, new `tests/accept/m18-airraces.spec.js`, new `tests/accept/m18-trailers.spec.js` | M18.T1 | M18-9 to M18-14 red | S |
| M18.T17 | **Boats, sim.** Hull physics on M4-2's water: speedboat, jet ski, sailboat with the wind, hovercraft, amphibious truck; the mini-sub and its sonar | new `src/sim/boat.js`, `src/sim/vehicle.js`, `src/sim/weather.js` | M18.T16, M16.T15 | M18-9 (part) | M |
| M18.T18 | **Boats, drawn.** Bodies from the pipeline; wakes; the sub's light under water | `public/assets/models/`, `src/render/river.js`, `src/render/traffic.js` | M18.T17 | M18-9 | M |
| M18.T19 | **Flight, sim.** Helicopter and plane flight models; stall, gear, flaps, brakes; damage and crashes; the cargo hook; restricted airspace; countermeasures and bombs; the blimp | new `src/sim/flight.js`, `src/sim/vehicle.js`, `src/sim/wanted.js` | M18.T16, M16.T16 | M18-10 (part), M18-11 (part) | M |
| M18.T20 | **Flight, drawn.** Helicopter and plane bodies from the pipeline; rotors; gear; the air-ambulance landing | `public/assets/models/`, `src/render/heli.js`, new `src/render/aircraft.js` | M18.T19 | M18-10, M18-11 | M |
| M18.T21 | **The air ambulance.** The plan bought at a hospital; the landing within 60 s; hospital instead of the respawn fee | `src/sim/respawn.js`, `src/sim/flight.js` | M18.T19, M13.T4 | M18-10 (part) | S |
| M18.T22 | **Schools.** The four schools' 30 tests from the map, scoring, licences and prizes | new `src/sim/schools.js`, new `src/content/schools.json`, `src/render/overlays.js` | M18.T19 | M18-12 | M |
| M18.T23 | **Air races and dogfights.** Six races routed from the seed; the dogfight's three pilots | new `src/sim/airraces.js`, `src/sim/combatai.js` | M18.T22 | M18-13 | M |
| M18.T24 | **Trailers.** Coupling, swing, jackknife, unhitching; four owned trailer kinds | `src/sim/vehicle.js`, new `src/sim/trailer.js`, `src/render/traffic.js` | M18.T16 | M18-14 | M |
| M18.T25 | **Checks, red: owning.** `m18-own.spec.js`, `m18-buy.spec.js`, `m18-mods.test.js`, `m18-modshop.spec.js`, `m18-workshop.spec.js`, `m18-dirt.spec.js`, `m18-prototypes.spec.js`, `m18-cheats.spec.js`, `m18-save.spec.js` | new `tests/accept/m18-own.spec.js`, new `tests/accept/m18-buy.spec.js`, new `tests/m18-mods.test.js`, new `tests/accept/m18-modshop.spec.js`, new `tests/accept/m18-workshop.spec.js`, new `tests/accept/m18-dirt.spec.js`, new `tests/accept/m18-prototypes.spec.js`, new `tests/accept/m18-cheats.spec.js`, new `tests/accept/m18-save.spec.js` | M18.T16 | M18-15 to M18-21, M18-23 red | S |
| M18.T26 | **Owning.** Owned cars, garages of three sizes, calling a car, the mechanic, the return home, the impound, insurance, the boot | new `src/sim/garage.js`, `src/sim/property.js`, `src/sim/vehicle.js` | M18.T25, M11.T7, M27.T2 | M18-15 | M |
| M18.T27 | **Buying and selling.** Three dealers, four phone sites, truck and sling delivery, prices and cred unlocks, selling, rewards | new `src/sim/dealers.js`, `src/sim/garage.js`, `src/ui/phone.js` | M18.T26 | M18-16 | M |
| M18.T28 | **The mod shop, sim.** Every part's numbers; resprays and heat | new `src/sim/modshop.js`, new `src/content/carparts.json`, `src/sim/wanted.js` | M18.T25 | M18-17 (part) | M |
| M18.T29 | **The mod shop, shown.** The garage interior, the parts menu with the car on a turntable, paints, wheels and bodies drawn | new `src/ui/modshop.js`, `src/render/traffic.js`, `src/render/interior.js` | M18.T28 | M18-17 | M |
| M18.T30 | **The workshop.** Ram bars, plates, tyres, the roof gun, caltrops, car bombs, boost, the mobile workshop, the map mark | `src/sim/modshop.js`, `src/sim/weapons.js`, `src/render/explosions.js` | M18.T28, M13.T7, M13.T43 | M18-18 | M |
| M18.T31 | **Dirt and washes.** Grime per car, rain and car washes | `src/sim/vehicle.js`, `src/render/traffic.js` | M18.T25 | M18-19 | S |
| M18.T32 | **Prototypes.** Four hidden vehicles, their places from the seed, their clue trails | new `src/sim/prototypes.js`, `src/sim/vehicle.js`, `src/sim/flight.js` | M18.T25, M24.T25 | M18-20 | M |
| M18.T33 | **Cheats.** Ten vehicle numbers in `cheats.json` | `src/content/cheats.json`, `src/sim/cheats.js` | M18.T25, M17.T16 | M18-21 | S |
| M18.T34 | **The draw cost.** At most 8 kinds pooled at once by the district mix; swaps as the player moves; the ledger at the busiest pose | `src/render/traffic.js`, `src/render/models.js`, `perf.json` | M18.T20 | M18-22 | M |
| M18.T35 | **Save** keeps everything in M18-23 | `src/sim/save.js` | M18.T34 | M18-23 | M |
| M18.T36 | **Close.** The sweep of every class, driven and in traffic; one commit per defect; the vehicle keys in the hints | the sweep, `content/hints.json` | all of the above | M18-24 | M |

## Decisions for the operator

None.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M18-1 | CP-02-065, CP-02-066 |
| M18-2 | WD-07-005, WD-07-006 |
| M18-3 | WD-07-007, CP-02-002, CP-02-023, CP-02-053, CP-02-055 |
| M18-8 | CP-12-038 |
| M18-9 | GTA-03-026, GTA-03-027, WD-07-008, WD-07-023 |
| M18-10 | GTA-03-001, GTA-03-005, GTA-03-015, GTA-03-016, GTA-03-017, GTA-03-035, GTA-03-041, GTA-03-042, GTA-15-007, CP-12-042 |
| M18-11 | GTA-03-002, GTA-03-003, GTA-03-004, GTA-03-007 to GTA-03-014, GTA-06-012, GTA-20-010, CS-11-050, CS-15-033 |
| M18-12 | GTA-10-009, GTA-10-043, GTA-10-054, GTA-10-055, GTA-10-082 |
| M18-13 | GTA-10-007, GTA-16-009, GTA-16-035 |
| M18-15 | GTA-04-002 to GTA-04-006, GTA-04-009, GTA-04-010, CP-02-015, WD-07-014, WD-07-021, WD-17-003, CP-02-013, CP-02-070 |
| M18-16 | GTA-04-045, GTA-13-023, GTA-13-024, GTA-13-025, GTA-13-026, GTA-13-027, GTA-13-029, WD-07-015, WD-15-004, CP-02-038 to CP-02-041, CP-02-063, CP-02-067 |
| M18-17 | GTA-04-011 to GTA-04-024, GTA-04-026, GTA-04-027, GTA-04-029, GTA-04-031 to GTA-04-034, GTA-04-039, GTA-04-046, GTA-04-049, GTA-04-050, GTA-04-051, GTA-04-060, WD-07-024, WD-16-021, CP-02-056 to CP-02-059, CP-07-025, GTA-04-030 |
| M18-18 | CP-02-025, CP-02-026, CP-02-042, GTA-04-035 |
| M18-20 | GTA-03-018, GTA-03-019, GTA-03-045, WD-07-022 |
