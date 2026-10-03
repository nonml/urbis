# Grand Theft Auto: every feature against Urbis

Marks: built, partial, planned, later, out, missing, skip (the list marks the row wrong or a duplicate).

| ID | Feature | Mark | Evidence |
|---|---|---|---|
| GTA-01-001 | Walking | built | `src/sim/player.js:5` WALK_SPEED 3.4; WASD in `src/main.js:972-977` |
| GTA-01-002 | Running | built | `src/main.js:977` Shift sets `hurry`; `src/sim/player.js:6` HURRY_SPEED 6.0 |
| GTA-01-003 | Sprinting | built | same one run state as running: hold Shift, `src/main.js:977` |
| GTA-01-004 | Stamina stat | out | G1: "A stamina limit: out, a limit with nothing to decide" |
| GTA-01-005 | Jumping | later | G2 "Jump, climb, vault | None | Later" |
| GTA-01-006 | Vaulting obstacles | later | G2 "Jump, climb, vault | None | Later" |
| GTA-01-007 | Ladder climbing | skip | Where says WRONG |
| GTA-01-008 | Surface swimming | planned | M10-5: "the player swims at 1 m/s to the nearest bank" |
| GTA-01-009 | Underwater diving | missing | searched "dive", "underwater", "seabed" in src/: none |
| GTA-01-010 | Breath/oxygen meter | missing | searched "oxygen", "breath", "air bar" in src/: none |
| GTA-01-011 | Drowning | missing | searched "drown", "health" in src/: none |
| GTA-01-012 | Scuba gear and rebreather | missing | searched "scuba", "rebreather", "tank" in src/: none |
| GTA-01-013 | Cover system | missing | D9 combat: not built; searched "cover", "aim" in src/: none |
| GTA-01-014 | Blind fire from cover | missing | D9 combat: not built; searched "blind fire", "shoot" in src/: none |
| GTA-01-015 | Stealth mode | missing | searched "stealth", "crouch" in src/: none; W27 depends on D9 |
| GTA-01-016 | Combat roll | missing | D9 combat: not built; searched "roll", "dive" in src/: none |
| GTA-01-017 | Ragdoll physics | later | G24 "Physics: ragdolls, lamp posts knocked flat | None | Later" |
| GTA-01-018 | Fall damage and limping | missing | searched "fall", "damage", "health" in src/: none; M10-3 is car damage only |
| GTA-01-019 | First-person mode | later | G30 "First-person camera | None | Later: it puts every model at arm's length" |
| GTA-01-020 | Climbing steep slopes | missing | searched "slope", "scramble", "climb" in src/: none (M4-3 hills only place movers) |
| GTA-01-021 | Swim skill stat | out | G22 "Body stats (stamina, driving skill) | None | Out" |
| GTA-01-022 | Lung capacity stat | out | G22 "Body stats ... Out" |
| GTA-01-023 | Walking on the seabed | missing | searched "seabed", "bottom", "underwater" in src/: none |
| GTA-01-024 | High dive into water | missing | searched "dive", "splash" in src/: none |
| GTA-01-025 | Weapons put away while swimming | missing | no weapons in src/ (searched "weapon", "holster"): missing |
| GTA-02-001 | Entering a vehicle | partial | hero car only: `src/main.js:397` nearHero, `:422-437` toggleVehicle; any car = M10-1 |
| GTA-02-002 | Carjacking | planned | M10-1; task M10.T3 "F at a traffic car stopped at a light: the driver gets out" |
| GTA-02-003 | Kicking out passengers | missing | no passengers in `src/sim/street.js`; searched "passenger", "eject" in src/: none |
| GTA-02-004 | Hotwiring | missing | searched "hotwire", "ignition" in src/: none |
| GTA-02-005 | Passenger seat | missing | no NPC driver; searched "passenger seat", "ride" in src/sim: none |
| GTA-02-006 | Accelerating and braking | built | `src/sim/vehicle.js:19-48`; W/S in `src/main.js:983` |
| GTA-02-007 | Handbrake | missing | searched "handbrake", "hand brake" in src/: none |
| GTA-02-008 | Burnouts | missing | searched "burnout", "smoke" (tyre) in src/: none |
| GTA-02-009 | Drifting | missing | only speed-scaled steering (`src/sim/vehicle.js:33`); searched "drift" in src/: none |
| GTA-02-010 | Horn | missing | searched "horn" in src/: none (no audio until M7) |
| GTA-02-011 | Headlights | partial | always on, no toggle: `src/render/traffic.js:2` (traffic), `:515` hero SpotLight |
| GTA-02-012 | Vehicle radio | later | G23 "Car radio | None | Later: needs music and voices" |
| GTA-02-013 | Radio wheel | later | G23 |
| GTA-02-014 | Cinematic camera | missing | searched "cinematic", "camera mode" in src/: none |
| GTA-02-015 | First-person driving | later | G30 "First-person camera | None | Later" |
| GTA-02-016 | Look behind | missing | searched "look back", "rear view" in src/: none |
| GTA-02-017 | Free-look in car | partial | drag-look works, snaps back after 2 s: `src/main.js:1043` |
| GTA-02-018 | Drive-by shooting | missing | D9 combat; searched "drive-by", "shoot" in src/: none |
| GTA-02-019 | 360-degree drive-by | missing | D9; searched "drive-by", "throw" in src/: none |
| GTA-02-020 | Drive-by melee | missing | D9; searched "melee", "punch" in src/: none |
| GTA-02-021 | Jumping from a moving car | missing | searched "bail", "jump out" in src/: none |
| GTA-02-022 | Vehicle deformation | missing | M10-3 plans damage and wreck, not panel deformation; searched "deform", "dent" in src/: none |
| GTA-02-023 | Tyre damage and deflation | partial | spike strips flatten: `src/sim/response.js:193`, `:198-205`; no shooting, no repair |
| GTA-02-024 | Shredded tyres | missing | searched "shred", "rim" in src/: none |
| GTA-02-025 | Engine damage | planned | M10-3: damage 0-1, smoke from 60%, wreck at 100% |
| GTA-02-026 | Vehicle fire and explosion | missing | searched "explode", "fire" (vehicle) in src/: none |
| GTA-02-027 | Ejecting through the windshield | missing | searched "windshield", "eject" in src/: none |
| GTA-02-028 | Rollover | missing | searched "rollover", "upright" in src/: none |
| GTA-02-029 | Vehicle dirt and car wash | missing | searched "dirt", "car wash" in src/: none |
| GTA-02-030 | Vehicle alarm | missing | searched "alarm" in src/: only M5/M6 fire alarm is planned |
| GTA-02-031 | Compacts class | missing | searched "class", "sedan" in src/: only five anonymous body shapes, `src/render/traffic.js:18-34` |
| GTA-02-032 | Sedans class | missing | searched "sedan", "four-door" in src/: none; shapes only, `src/render/traffic.js:18-34` |
| GTA-02-033 | Coupes class | missing | searched "coupe class" in src/: none; "coupe" is one body shape, `src/render/traffic.js:33` |
| GTA-02-034 | Muscle class | missing | searched "muscle" in src/: none |
| GTA-02-035 | Sports Classics class | missing | searched "sports classic", "classic car" in src/: none |
| GTA-02-036 | Sports class | missing | searched "sports car" in src/: none |
| GTA-02-037 | Super class | missing | searched "supercar", "super class" in src/: none |
| GTA-02-038 | SUVs class | missing | searched "SUV" in src/: none |
| GTA-02-039 | Vans class | missing | a "van" body shape exists (`src/render/traffic.js:22-24`) but no class system; searched "van class" |
| GTA-02-040 | Off-Road class | missing | searched "off-road", "offroad" in src/: none |
| GTA-02-041 | Motorcycles class | missing | searched "motorcycle", "bike" in src/: none |
| GTA-02-042 | Bicycles | missing | searched "bicycle", "BMX" in src/: none (bike hoops are static dressing, G52) |
| GTA-02-043 | Quad bikes | missing | searched "quad", "ATV" in src/: none |
| GTA-02-044 | Emergency class | partial | police cruisers and helicopter only (`src/render/policekit.js:17`, `src/sim/wanted.js:50`); not driveable, no ambulance/fire |
| GTA-02-045 | Military class | missing | searched "military", "armoured" in src/: none |
| GTA-02-046 | Service class | missing | searched "bus", "taxi", "garbage truck" in src/sim: none (G25 taxi later) |
| GTA-02-047 | Commercial class | missing | searched "truck", "mule" in src/: none |
| GTA-02-048 | Industrial class | missing | searched "forklift", "mixer" in src/: none |
| GTA-02-049 | Utility class | missing | searched "pickup", "tow truck" in src/: none |
| GTA-02-050 | Trailers | missing | searched "trailer", "hitch" in src/: none |
| GTA-02-051 | Open Wheel class | missing | searched "formula", "open wheel" in src/: none |
| GTA-02-052 | Riding the train | skip | Where says WRONG |
| GTA-02-053 | Tram travel | skip | Where says WRONG |
| GTA-02-054 | Motorcycle wheelies and stoppies | missing | searched "wheelie", "stoppie" in src/: none |
| GTA-02-055 | Falling off a bike | missing | searched "rider", "throw off" in src/: none |
| GTA-02-056 | Taxi passenger ride | later | G25 "Taxi, fast travel | None | Later" |
| GTA-02-057 | Lowrider hydraulics | missing | searched "hydraulics", "lowrider" in src/: none |
| GTA-02-058 | Horn-boosted vehicles | missing | searched "nitro", "jump ability" in src/: none |
| GTA-02-059 | Mobile radio while on foot | skip | Where says WRONG |
| GTA-02-060 | Siren and emergency lights | partial | police light bar flashes (`src/render/police.js:48` flashOn, `:115`); no player toggle, no ambulance/fire |
| GTA-02-061 | Train driving | missing | searched "train", "rail" in src/: none |
| GTA-02-062 | Switching seats inside a vehicle | missing | searched "back seat", "switch seat" in src/: none |
| GTA-02-063 | Convertible roof | missing | searched "convertible", "soft top" in src/: none |
| GTA-02-064 | Windscreen wipers | missing | searched "wiper" in src/ and `src/render/rain.js`: none |
| GTA-02-065 | Bike helmets | missing | searched "helmet" in src/: none |
| GTA-02-066 | Sinking cars | planned | M10-5: "a car driven into the river sinks within 3 s and is gone" |
| GTA-02-067 | Smashing street furniture | planned | M10-3: car hits "buildings and street furniture"; none built today (`src/sim/vehicle.js:1`) |
| GTA-02-068 | RC Bandito | skip | Where says DUPLICATE of GTA-04-047 |
| GTA-02-069 | Turret vehicles | missing | searched "turret", "machine gun" in src/: none |
| GTA-03-001 | Entering aircraft | out | G5: "Aircraft: out, because a player in the air sees the whole city at once" |
| GTA-03-002 | Plane flight controls | out | G5 (aircraft out) |
| GTA-03-003 | Landing gear | out | G5 (aircraft out) |
| GTA-03-004 | Engine and brake | out | G5 (aircraft out) |
| GTA-03-005 | Helicopter controls | out | G5 (aircraft out); the only helicopter is the police NPC, `src/render/heli.js` |
| GTA-03-006 | VTOL mode | skip | Where says WRONG |
| GTA-03-007 | Fixed-wing passenger planes | out | G5 (aircraft out) |
| GTA-03-008 | Fighter jets | out | G5 (aircraft out) |
| GTA-03-009 | Stunt planes | out | G5 (aircraft out) |
| GTA-03-010 | Cargo planes | out | G5 (aircraft out) |
| GTA-03-011 | Blimp | out | G5 (aircraft out) |
| GTA-03-012 | Seaplanes | out | G5 (aircraft out) |
| GTA-03-013 | Aircraft bombs | out | G5 (aircraft out) |
| GTA-03-014 | Aircraft countermeasures | out | G5 (aircraft out) |
| GTA-03-015 | Stealth helicopters | out | G5 (aircraft out) |
| GTA-03-016 | Attack helicopters | out | G5 (aircraft out) |
| GTA-03-017 | Cargobob hook | out | G5 (aircraft out) |
| GTA-03-018 | Jetpack | out | G5: a player in the air is out; searched "jetpack" in src/: none |
| GTA-03-019 | Avenger | out | G5 (aircraft out) |
| GTA-03-020 | Parachute deploy | out | G31 "Parachutes | None | Out, with aircraft (G5)" |
| GTA-03-021 | Parachute steering | out | G31 |
| GTA-03-022 | Parachute cut-away | out | G31 |
| GTA-03-023 | Skydiving freefall | out | G31 |
| GTA-03-024 | Base jumping | out | G31 (ROADMAP "parachute off it" is not built) |
| GTA-03-025 | Smoke trails | out | G31, with parachutes |
| GTA-03-026 | Boats | later | G5 "Motorbike, truck, bus, boat: later" |
| GTA-03-027 | Jet skis | later | G5 (boat later) |
| GTA-03-028 | Amphibious vehicles | missing | M10-5 sinks a car in water instead; searched "amphibious", "float" in src/: none |
| GTA-03-029 | Submersible | missing | searched "submersible", "dive" in src/: none |
| GTA-03-030 | Kraken submarine | missing | searched "submarine", "Kraken" in src/: none |
| GTA-03-031 | Kosatka submarine | missing | searched "Kosatka", "sonar", "periscope" in src/: none |
| GTA-03-032 | Torpedoes | missing | searched "torpedo" in src/: none |
| GTA-03-033 | Toreador | missing | searched "Toreador" in src/: none |
| GTA-03-034 | Stromberg | missing | searched "Stromberg", "submerge" in src/: none |
| GTA-03-035 | Deluxo flight | out | G5 (flying car is aircraft) |
| GTA-03-036 | Oppressor Mk II | skip | Where says WRONG |
| GTA-03-037 | Ruiner 2000 | missing | searched "Ruiner", "parachute car" in src/: none |
| GTA-03-038 | Rocket Voltic | missing | searched "rocket", "boost" in src/: none |
| GTA-03-039 | Scramjet | missing | searched "Scramjet", "jump" in src/: none |
| GTA-03-040 | Vigilante | missing | searched "Vigilante", "Batmobile" in src/: none |
| GTA-03-041 | Aircraft damage and crashes | out | G5 (aircraft out) |
| GTA-03-042 | Eject from aircraft | out | G5, G31 |
| GTA-03-043 | Ambush vehicle drops | missing | searched "air drop", "parachute crate" in src/: none |
| GTA-03-044 | Flying skill stat | out | G22 "Body stats ... Out" |
| GTA-03-045 | San Andreas jetpack | out | G5 (a player in the air is out) |
| GTA-03-046 | Hovercraft | missing | searched "hovercraft", "Vortex" in src/: none |
| GTA-03-047 | Sailboat | missing | searched "sail", "Marquis" in src/: none |
| GTA-04-001 | Personal vehicle | partial | one hero car with a finder beacon (`src/render/traffic.js:493` buildPlayerCar); no safehouse garage or return; G8 later |
| GTA-04-002 | Safehouse garages | later | G8 "Customise, store and own cars | None | Later" |
| GTA-04-003 | Purchased garages | later | G8 |
| GTA-04-004 | Special vehicle storage | later | G8 |
| GTA-04-005 | Vehicle impound | later | G8 (searched "impound" in src/: none) |
| GTA-04-006 | Paying impound fees | later | G8 (searched "impound fee" in src/: none) |
| GTA-04-007 | Mors Mutual Insurance | missing | searched "insurance", "Mors" in src/: none |
| GTA-04-008 | Calling a mechanic | missing | searched "mechanic", "deliver vehicle" in src/: none; M11's phone later (G17) |
| GTA-04-009 | Request personal vehicle | later | G8; C12 "Call your car | None | Later" |
| GTA-04-010 | Return to storage | later | G8 |
| GTA-04-011 | Los Santos Customs | later | G8 (searched "mod shop", "customise" in src/: none) |
| GTA-04-012 | Respray colours | later | G8 (searched "respray", "paint finish" in src/: none) |
| GTA-04-013 | Vehicle repair | later | G8 |
| GTA-04-014 | Armour upgrades | later | G8 |
| GTA-04-015 | Brake upgrades | later | G8 |
| GTA-04-016 | Engine upgrades | later | G8 |
| GTA-04-017 | Transmission upgrades | later | G8 |
| GTA-04-018 | Turbo tuning | later | G8 |
| GTA-04-019 | Suspension upgrades | later | G8 |
| GTA-04-020 | Tyre upgrades | later | G8 |
| GTA-04-021 | Wheel choice | later | G8 |
| GTA-04-022 | Exhaust upgrades | later | G8 |
| GTA-04-023 | Horn upgrades | later | G8 (no horn at all; M7 audio) |
| GTA-04-024 | Light upgrades | later | G8 |
| GTA-04-025 | Custom license plate | missing | searched "plate", "license" in src/: none |
| GTA-04-026 | Window tint | later | G8 |
| GTA-04-027 | Body part mods | later | G8 |
| GTA-04-028 | Vehicle bombs | missing | D9 combat; searched "bomb", "detonate" in src/: none |
| GTA-04-029 | Vehicle liveries | later | G8 |
| GTA-04-030 | Neon underglow | out | ROADMAP:47 "The look | No neon (VGA-083)"; AGENTS.md visual target bans neon |
| GTA-04-031 | Tyre smoke | later | G8 |
| GTA-04-032 | Benny's conversions | later | G8 |
| GTA-04-033 | Stance and low-grip tyres | later | G8 |
| GTA-04-034 | Hao's Special Works | later | G8 |
| GTA-04-035 | Aircraft workshop | out | G5 (aircraft out) |
| GTA-04-036 | Weaponised upgrades | missing | D9 combat; searched "mounted gun", "missile" in src/: none |
| GTA-04-037 | Arena upgrades | missing | searched "arena", "shunt" in src/: none |
| GTA-04-038 | Mobile vehicle workshop | missing | searched "workshop", "MOC" in src/: none |
| GTA-04-039 | Auto Shop upgrades | later | G8 (owning and customising cars) |
| GTA-04-040 | LS Car Meet | out | G28 "Online | None | Out" (Online-only activity) |
| GTA-04-041 | Vehicle warehouse | out | G28 (Online Import/Export business) |
| GTA-04-042 | Vehicle cargo sourcing | out | G28 (Online) |
| GTA-04-043 | Vehicle cargo selling | out | G28 (Online) |
| GTA-04-044 | Pegasus deliveries | out | G28 (Online) |
| GTA-04-045 | Selling a car | later | G8 |
| GTA-04-046 | Vehicle remote functions | later | G8 |
| GTA-04-047 | RC Bandito | later | W18 "Drones, RC cars | None | Later" |
| GTA-04-048 | RC Tank | later | W18 "Drones, RC cars | None | Later" |
| GTA-04-049 | SA mod shops | later | G8 |
| GTA-04-050 | Nitrous oxide | later | G8 (searched "nitrous" in src/: none) |
| GTA-04-051 | Hydraulics upgrade | later | G8 (searched "hydraulics" in src/: none) |
| GTA-04-052 | Sunshine Autos lists | missing | searched "Sunshine Autos", "import list" in src/: none |
| GTA-04-053 | Pay 'n' Spray | missing | searched "Pay", "respray" in src/: none |
| GTA-04-054 | Vehicle registration plates | missing | searched "plate" in src/: none |
| GTA-04-055 | Trailer ownership | missing | searched "trailer", "hitch" in src/: none |
| GTA-04-056 | Bicycle share | skip | Where says WRONG |
| GTA-04-057 | Vehicle delivery services | out | G28 (Online) |
| GTA-04-058 | Car stereo and bass boost | later | G23 "Car radio | None | Later: needs music" (no audio before M7) |
| GTA-04-059 | Crew colour paint | out | G28 (Online) |
| GTA-04-060 | Custom tyre lettering | later | G8 |
| GTA-04-061 | Story vehicle respawn | missing | searched "respawn vehicle", "safehouse garage" in src/: none |
| GTA-05-001 | Weapon wheel | missing | D9 combat not built; searched "weapon", "wheel slot" in src/: none |
| GTA-05-002 | Fists and unarmed combat | missing | D9; searched "punch", "fist", "melee" in src/: none |
| GTA-05-003 | Melee weapons | missing | D9; searched "bat", "crowbar", "knife" in src/: none |
| GTA-05-004 | Pistols | missing | D9; searched "pistol", "gun" in src/: none |
| GTA-05-005 | AP Pistol | missing | D9; searched "AP Pistol", "automatic" in src/: none |
| GTA-05-006 | Heavy revolver | missing | D9; searched "revolver" in src/: none |
| GTA-05-007 | Stun gun | missing | D9; searched "stun" in src/: none |
| GTA-05-008 | Submachine guns | missing | D9; searched "SMG", "submachine" in src/: none |
| GTA-05-009 | Shotguns | missing | D9; searched "shotgun" in src/: none |
| GTA-05-010 | Assault rifles | missing | D9; searched "rifle", "carbine" in src/: none |
| GTA-05-011 | Light machine guns | missing | D9; searched "machine gun" in src/: none |
| GTA-05-012 | Sniper rifles | missing | D9; searched "sniper", "scope" in src/: none |
| GTA-05-013 | RPG and rocket launchers | missing | D9; searched "RPG", "rocket" in src/: none |
| GTA-05-014 | Grenade launcher | missing | D9; searched "grenade" in src/: none |
| GTA-05-015 | Minigun | missing | D9; searched "minigun" in src/: none |
| GTA-05-016 | Homing launcher | missing | D9; searched "homing", "lock-on" in src/: none |
| GTA-05-017 | Railgun | missing | D9; searched "railgun" in src/: none |
| GTA-05-018 | Thrown grenades | missing | D9; searched "grenade", "throw" in src/: none |
| GTA-05-019 | Sticky bombs | missing | D9; searched "sticky bomb" in src/: none |
| GTA-05-020 | Molotov cocktails | missing | D9; searched "molotov" in src/: none |
| GTA-05-021 | Tear gas | missing | D9; searched "tear gas", "gas" in src/: none |
| GTA-05-022 | Smoke grenades | missing | D9; searched "smoke grenade" in src/: none |
| GTA-05-023 | Proximity mines | missing | D9; searched "proximity", "mine" in src/: none |
| GTA-05-024 | Flares | missing | D9; searched "flare" in src/: none |
| GTA-05-025 | Fire extinguisher | missing | D9; searched "extinguisher" in src/: none |
| GTA-05-026 | Jerry can | missing | D9; searched "jerry can", "petrol" in src/: none |
| GTA-05-027 | Snowballs | missing | D9 plus no snow; searched "snowball", "snow" in src/: none |
| GTA-05-028 | Free aim | missing | D9; searched "aim", "crosshair" in src/: none |
| GTA-05-029 | Assisted and lock-on aim | missing | D9; searched "lock-on", "reticle" in src/: none |
| GTA-05-030 | Target switching | missing | D9; searched "target switch" in src/: none |
| GTA-05-031 | Aiming down sights | missing | D9; searched "sights", "scope" in src/: none |
| GTA-05-032 | First-person aiming | missing | D9; G30 puts first person later; no aiming at all |
| GTA-05-033 | Shooting from cover | missing | D9; searched "cover", "shoot" in src/: none |
| GTA-05-034 | Stealth takedown | missing | D9; searched "takedown", "knockout" in src/: none |
| GTA-05-035 | Suppressed weapons | missing | D9; searched "suppressor" in src/: none |
| GTA-05-036 | Weapon mods | missing | D9; searched "extended magazine", "weapon mod" in src/: none |
| GTA-05-037 | Mk II weapons | missing | D9; searched "Mk II", "research bench" in src/: none |
| GTA-05-038 | Special ammo types | missing | D9; searched "ammo type", "hollow point" in src/: none |
| GTA-05-039 | Weapon tints and skins | missing | D9; searched "weapon tint", "skin" in src/: none |
| GTA-05-040 | Gun locker | missing | D9; searched "gun locker" in src/: none |
| GTA-05-041 | Ammu-Nation shops | missing | D9; no weapon shops; searched "Ammu", "gun shop" in src/: none |
| GTA-05-042 | Gun van | missing | D9; searched "gun van" in src/: none |
| GTA-05-043 | Weapon pickups | missing | D9; searched "pickup", "drop" in src/: none |
| GTA-05-044 | Health bar | missing | D9; searched "health" in src/sim: only Busted exists (`src/sim/wanted.js:143`) |
| GTA-05-045 | Health packs | missing | D9; searched "medkit", "health pack" in src/: none |
| GTA-05-046 | Snacks | missing | D9; searched "snack" in src/: none |
| GTA-05-047 | Body armour | missing | D9; searched "armour", "armor" in src/: none |
| GTA-05-048 | Armour tiers | missing | D9; searched "heavy armour" in src/: none |
| GTA-05-049 | Bulletproof helmet | missing | D9; searched "helmet" in src/: none |
| GTA-05-050 | Dual wielding | missing | D9; searched "dual wield" in src/: none |
| GTA-05-051 | Weapon skill levels | out | G22 "Body stats (stamina, driving skill) | None | Out" |
| GTA-05-052 | Combat shotgun knockdown | missing | D9; searched "knockdown", "shotgun" in src/: none |
| GTA-05-053 | Wasted screen | missing | G10 "no health | Built (busted). Wasted depends on D9"; searched "wasted" in src/: none |
| GTA-05-054 | Reloading | missing | D9; searched "reload", "magazine" in src/: none |
| GTA-05-055 | Fighting styles | missing | D9; searched "boxing", "karate" in src/: none |
| GTA-05-056 | Knuckle dusters | missing | D9; searched "knuckle" in src/: none |
| GTA-05-057 | Steady sniper aim | missing | D9; searched "hold breath", "steady" in src/: none |
| GTA-05-058 | Eating to heal | missing | D9; searched "eat", "hot dog" in src/: none |
| GTA-05-059 | Melee grabs and counters | missing | D9; searched "grapple", "counter" in src/: none |
| GTA-05-060 | Up-n-Atomizer | missing | D9; searched "Atomizer", "shockwave" in src/: none |
| GTA-06-001 | One-star wanted level | partial | ★1 sends one cruiser (`src/sim/wanted.js:43-48`); a crime is a blackout (`:134`) or speeding (`:24`), not violence (D9) |
| GTA-06-002 | Two-star wanted level | partial | ★2 adds a second cruiser and spike strips (`src/sim/wanted.js:45`, `src/sim/response.js:188`); no officers on foot or guns |
| GTA-06-003 | Three-star wanted level | partial | ★3 adds roadblock and helicopter (`src/sim/wanted.js:47`); no marksman on board (`src/sim/response.js:67`) |
| GTA-06-004 | Four-star wanted level | missing | `src/sim/wanted.js:16` MAX_HEAT 3; G9 "★4-5 depend on D9" |
| GTA-06-005 | Five-star wanted level | missing | `src/sim/wanted.js:16`; G9 "★4-5 depend on D9" |
| GTA-06-006 | Six-star wanted level | missing | `src/sim/wanted.js:16`; no army or jets |
| GTA-06-007 | Heat from shooting | missing | no shooting (D9); heat sources are blackout (`src/sim/wanted.js:134`) and speeding (`:24`) only |
| GTA-06-008 | Heat from killing police | missing | no combat (D9); searched "kill police" in src/sim: none |
| GTA-06-009 | Heat from stolen police cars | missing | only the hero car is enterable (`src/main.js:397` nearHero); cruisers are not |
| GTA-06-010 | Heat from explosions | missing | D9; searched "explosion" in src/sim: none |
| GTA-06-011 | Heat from store robbery | missing | searched "rob", "store" in src/sim: none |
| GTA-06-012 | Restricted airspace | out | G5 (aircraft out); searched "airspace" in src/: none |
| GTA-06-013 | Last known position | built | `src/sim/wanted.js:63` lkp, `:206-210` update on sight; `docs/WANTED.md:45-54` |
| GTA-06-014 | Search radius | built | `src/sim/wanted.js:84` searchRadius; `src/render/heli.js` search ring |
| GTA-06-015 | Cops on foot | missing | units are cruisers and the helicopter only (`src/sim/wanted.js:50`, `:96` syncUnits) |
| GTA-06-016 | Police roadblocks | built | `src/sim/response.js:105` layRoadblock; `src/sim/wanted.js:47` |
| GTA-06-017 | Police PIT and ramming | missing | cruisers do not bump; only the player can ram the roadblock (`src/sim/response.js:231`) |
| GTA-06-018 | Police helicopter spotlight | built | `src/sim/response.js:67-68` heliSees; `src/render/heli.js` beam and spot |
| GTA-06-019 | Police Cruiser | built | `src/render/policekit.js:17`; placed by `src/render/police.js` |
| GTA-06-020 | Police Interceptor | missing | searched "Interceptor" in src/: none (one cruiser shape) |
| GTA-06-021 | Police Riot | missing | searched "riot", "armoured van" in src/: none |
| GTA-06-022 | Police Transporter | missing | searched "transporter", "prisoner van" in src/: none |
| GTA-06-023 | Police Bike | missing | searched "police bike", "motorcycle" in src/: none |
| GTA-06-024 | NOOSE teams | missing | D9 (4-5 stars); searched "NOOSE" in src/: none |
| GTA-06-025 | FIB agents | missing | D9; searched "FIB" in src/: none |
| GTA-06-026 | Police Maverick | partial | helicopter with searchlight built (`src/render/heli.js`, `docs/WANTED.md:33-37`); no sharpshooter |
| GTA-06-027 | Police Predator boat | missing | searched "Predator", "patrol boat" in src/: none |
| GTA-06-028 | Sheriff and ranger units | missing | searched "sheriff", "ranger" in src/: none |
| GTA-06-029 | Army units | missing | searched "army", "soldier" in src/: none |
| GTA-06-030 | Rhino tank pursuit | missing | searched "Rhino", "tank" in src/: none |
| GTA-06-031 | Hydra and jet pursuit | missing | searched "Hydra", "jet" in src/: none |
| GTA-06-032 | Breaking line of sight | built | `src/sim/patrol.js:39-44` canSee (same street or close); `src/sim/wanted.js:200-210` |
| GTA-06-033 | Hiding out of the search zone | built | `src/sim/wanted.js:260-267` searchOn drops one tier per tier's searchSecs |
| GTA-06-034 | Respray to lose the cops | skip | Where says WRONG |
| GTA-06-035 | Hiding in tunnels and interiors | missing | searched "tunnel", "subway", "hide" in src/sim: none |
| GTA-06-036 | Stealth evasion | partial | blackout is cover: sight falls to 12 m (`src/sim/patrol.js:16`, `:44`); no crouch or bushes |
| GTA-06-037 | Lester removes wanted level | out | G28 "Online | None | Out" |
| GTA-06-038 | Bribe Authorities | out | G28 (Online CEO ability) |
| GTA-06-039 | Off the radar | out | G28 (Online) |
| GTA-06-040 | Police bribe pickup | missing | searched "bribe" in src/: none |
| GTA-06-041 | Busted | built | `src/sim/wanted.js:143-154` wantedOnBusted; `src/sim/arc.js:145-157` |
| GTA-06-042 | Weapon loss on bust | missing | no weapons (D9); searched "weapon loss" in src/: none |
| GTA-06-043 | Bail and fines | missing | busted costs nothing; searched "bail", "fine" in src/: none |
| GTA-06-044 | Wasted | missing | G10 "no health | Built (busted). Wasted depends on D9" |
| GTA-06-045 | Hospital respawn | missing | searched "hospital", "respawn" in src/: none |
| GTA-06-046 | Ambulance response | missing | searched "ambulance" in src/: none (M12-5 plans ambulances for fires, not crime scenes) |
| GTA-06-047 | Police computer | missing | searched "police computer", "plate search" in src/: none |
| GTA-06-048 | Vigilante justice | missing | searched "vigilante", "police radio" (criminal) in src/: none |
| GTA-06-049 | Wanted level cleared by missions | missing | missions wait for heat (`src/sim/mission.js:218` lose_heat); nothing clears it |
| GTA-06-050 | Lester clears wanted in story | missing | no phone (G17 later); searched "Lester" in src/: none |
| GTA-07-001 | City of Los Santos | partial | a generated town with named streets (`src/sim/world.js:52`, per-seed since slice 067); one district, 2-4 avenues of 200 m; M4-1 grows it to 4-6 districts |
| GTA-07-002 | Blaine County | partial | farmland and mountains past the edge (`src/render/outskirts.js:32`, `src/render/landscape.js:1`); no towns, no desert |
| GTA-07-003 | Mount Chiliad | partial | smooth mountain ranges (`src/render/landscape.js:203-221`); no trails, cable car or summit lookout |
| GTA-07-004 | Alamo Sea | missing | searched "Alamo", "lake" in src/: none |
| GTA-07-005 | Vinewood | missing | searched "Vinewood", "film" in src/: none |
| GTA-07-006 | Del Perro Pier | missing | searched "pier", "Ferris" in src/: none |
| GTA-07-007 | Port of Los Santos | missing | searched "port", "dock", "crane" (container) in src/: only construction cranes |
| GTA-07-008 | Los Santos International Airport | missing | searched "airport", "runway", "hangar" in src/: none |
| GTA-07-009 | Fort Zancudo | missing | searched "Zancudo", "military base" in src/: none |
| GTA-07-010 | Bolingbroke Penitentiary | missing | searched "prison", "penitentiary" in src/: none |
| GTA-07-011 | Galileo Observatory | missing | searched "observatory" in src/: none |
| GTA-07-012 | Land Act Dam | missing | searched "dam" in src/: none |
| GTA-07-013 | Palmer-Taylor Power Station | later | M12-1 builds plants that make MW; a coastal plant landmark is not named |
| GTA-07-014 | Senora Desert and wind farm | missing | searched "desert", "wind farm", "turbine" in src/: none |
| GTA-07-015 | Raton Canyon and Cassidy Creek | missing | searched "canyon", "creek" in src/: none |
| GTA-07-016 | Liberty City | missing | searched "Liberty City", "borough" in src/: none |
| GTA-07-017 | Broker Bridge and island crossings | planned | M4-2: "A river at least 25 m wide crosses the city, with at least 2 bridges you can drive over" |
| GTA-07-018 | Statue of Happiness | missing | searched "statue" in src/: none |
| GTA-07-019 | San Andreas state | missing | one town only; searched "San Fierro", "Las Venturas" in src/: none |
| GTA-07-020 | San Fierro | missing | searched "San Fierro" in src/: none |
| GTA-07-021 | Las Venturas | missing | searched "Las Venturas", "casino strip" in src/: none |
| GTA-07-022 | Area 69 and the Big Ear | missing | searched "Area 69", "telescope" in src/: none |
| GTA-07-023 | San Fierro tram ride | missing | searched "tram" in src/: none |
| GTA-07-024 | Vice City | missing | searched "Vice City" in src/: none |
| GTA-07-025 | Vice Beach and Ocean Drive | missing | searched "beach", "promenade" in src/: a paved promenade exists (`src/sim/world.js:237`) but no beach district |
| GTA-07-026 | Day and night cycle | built | `src/sim/clock.js:8` DAY_SECS 720 (12-minute day), `:9-14` dawn/dusk; T in `src/main.js:444` |
| GTA-07-027 | Clear and sunny weather | partial | day lighting in `src/render/atmosphere.js`; rain is always on (`src/main.js:1102`), no clear state chosen |
| GTA-07-028 | Cloudy and overcast weather | missing | searched "cloud", "overcast" in src/render/atmosphere.js: none |
| GTA-07-029 | Rain and thunderstorms | partial | rain always drawn, one state (`src/render/rain.js:1-2`, `src/main.js:1102`); no lightning, thunder or storm cycle |
| GTA-07-030 | Fog and smog | partial | distance fog only (`src/render/atmosphere.js:88`, `:156-158`); no weather haze |
| GTA-07-031 | Snow | later | S45 "Seasons, snow, heating, road gritting | Later, after VGA-051's weather" |
| GTA-07-032 | Dynamic weather changes | later | S36 "Weather that changes: later (VGA-051)" |
| GTA-07-033 | Wildlife: deer and elk | later | G32 "Animals: dogs, pigeons, deer | None | Later" |
| GTA-07-034 | Wildlife: coyotes | missing | searched "coyote" in src/: none |
| GTA-07-035 | Wildlife: mountain lions | missing | searched "cougar", "lion" in src/: none |
| GTA-07-036 | Wildlife: boars | missing | searched "boar" in src/: none |
| GTA-07-037 | Wildlife: rabbits and small animals | missing | searched "rabbit" in src/: none |
| GTA-07-038 | Wildlife: birds | later | G32 names pigeons; no birds today (searched "bird", "seagull" in src/: none) |
| GTA-07-039 | Wildlife: pigeons | later | G32 "Animals: dogs, pigeons, deer | None | Later" |
| GTA-07-040 | Wildlife: sharks | missing | no sea, river only planned (M4-2); searched "shark" in src/: none |
| GTA-07-041 | Wildlife: whales | missing | searched "whale" in src/: none |
| GTA-07-042 | Wildlife: rats | missing | searched "rat" in src/: none |
| GTA-07-043 | Pet dogs | later | G32 "Animals: dogs ... Later" |
| GTA-07-044 | Gang: Families | later | C9 "Factions, gangs, territory | None | Later" |
| GTA-07-045 | Gang: Ballas | later | C9 |
| GTA-07-046 | Gang: Vagos | later | C9 |
| GTA-07-047 | Gang: Lost MC | later | C9 |
| GTA-07-048 | Gang: Triads and Korean mob | later | C9 |
| GTA-07-049 | Gang territory war | later | C9 (territory) |
| GTA-07-050 | Gang attacks | out | G28 "Online | None | Out" (Online mode activity) |
| GTA-07-051 | Random event: armored truck | later | G13 "Ambient events (an argument, an arrest, a busker) | None | Later" |
| GTA-07-052 | Random event: purse snatch and mugging | later | G13 |
| GTA-07-053 | Random event: hitchhiker | later | G13 |
| GTA-07-054 | Random event: shop robbery | later | G13 |
| GTA-07-055 | Random event: stolen vehicle | later | G13 |
| GTA-07-056 | Random event: crash rescue | later | G13 |
| GTA-07-057 | Random event: drunk driver | later | G13 |
| GTA-07-058 | Random event: drug deal gone wrong | later | G13 |
| GTA-07-059 | Random event: escaped convicts | later | G13 |
| GTA-07-060 | Gatecrasher security vans | out | G28 (Online freemode event) |
| GTA-07-061 | Stranger: Beverly Felton | later | G14 "Story missions ... More: later"; ROADMAP "New missions after the six-mission arc" |
| GTA-07-062 | Stranger: Hao | later | G14 (more missions later) |
| GTA-07-063 | Stranger: Tonya | later | G14 |
| GTA-07-064 | Stranger: Maude | later | G14 |
| GTA-07-065 | Stranger: Barry | later | G14 |
| GTA-07-066 | Stranger: Epsilon Program | later | G14 |
| GTA-07-067 | Stranger: Josh Bernstein | skip | Where says WRONG |
| GTA-07-068 | Stranger: Mary-Ann | skip | Where says WRONG |
| GTA-07-069 | Stranger: Nigel and Mrs. Thornhill | later | G14 |
| GTA-07-070 | Stranger: Omega | later | G14 |
| GTA-07-071 | Stranger: Dreyfuss | later | G14 |
| GTA-07-072 | Stranger: Dr. Friedlander | later | G14 |
| GTA-07-073 | Stranger: The Last One | later | G14 |
| GTA-07-074 | Stranger: Civil Border Patrol | later | G14 |
| GTA-07-075 | 24/7 convenience stores | later | G20 "Shops: clothes, food, barber | The noodle bar | Later (the next nine interiors)" |
| GTA-07-076 | Ammu-Nation interiors | missing | D9 combat; searched "Ammu-Nation", "shooting range" in src/: none |
| GTA-07-077 | Clothing and barber interiors | later | G20 "Shops: clothes, food, barber ... Later" |
| GTA-07-078 | Tattoo parlours | later | G21 "Character customisation | None | Later" |
| GTA-07-079 | Strip clubs | later | ROADMAP "After the sell check": "a club" among the next nine interiors |
| GTA-07-080 | Bars and clubs | later | ROADMAP "After the sell check": "a club"; the noodle bar is the one food interior today |
| GTA-07-081 | Cinema interiors | missing | searched "cinema", "movie" in src/: none |
| GTA-07-082 | Banks and jewellery stores | missing | searched "bank", "jewellery" in src/: only M6-4's bank-transfer hack is planned |
| GTA-07-083 | Police stations and hospitals | planned | M5-5 builds a police station and a clinic as buildings with doors; no hospital |
| GTA-07-084 | Metro and subway | later | ROADMAP line 706: "Overpasses, underpasses, the subway, sewers ... after the sell check" |
| GTA-07-085 | Sewers and storm drains | later | ROADMAP line 706 (after the sell check) |
| GTA-07-086 | Los Santos Golf Club | missing | searched "golf" in src/: none |
| GTA-07-087 | Tennis courts | missing | searched "tennis" in src/: none |
| GTA-07-088 | Shooting range interiors | missing | D9 combat; searched "shooting range" in src/: none |
| GTA-07-089 | Gyms | missing | searched "gym", "work out" in src/: none |
| GTA-07-090 | Casinos | missing | searched "casino", "gambling" in src/: none |
| GTA-07-091 | Sherman Dam | missing | searched "dam" in src/: none |
| GTA-07-092 | Mount Chiliad mural | missing | searched "mural" in src/: none |
| GTA-07-093 | UFO sightings | missing | searched "UFO", "saucer" in src/: none |
| GTA-07-094 | Underwater UFO | missing | searched "UFO", "saucer" in src/: none |
| GTA-07-095 | Ghost of Mount Gordo | missing | searched "ghost" in src/: none |
| GTA-07-096 | Shipwrecks and plane wrecks | missing | searched "wreck", "shipwreck" in src/: none |
| GTA-07-097 | Epsilon robes | missing | searched "Epsilon", "robe" in src/: none |
| GTA-07-098 | Wilderness trails and off-road routes | missing | roads are a grid only (D2); searched "trail", "dirt track" in src/: none |
| GTA-07-099 | Freeway and highway network | planned | M4-9: "one regional road enters at an edge of the map and joins the arterials"; no freeway network |
| GTA-07-100 | Railway network | missing | searched "railway", "rail", "level crossing" in src/: none |
| GTA-07-101 | Cayo Perico | out | G28 (Online island) |
| GTA-07-102 | Altruist Cult camp | missing | searched "Altruist", "cult camp" in src/: none |
| GTA-07-103 | Maze Bank Tower rooftops | partial | a reachable roof interior exists (`src/sim/interior.js:149`, `docs/INTERIORS.md:6`); not a Downtown tower roof |
| GTA-07-104 | Vespucci Canals | missing | searched "canal" in src/: none |
| GTA-07-105 | Trevor's desert airstrip | missing | searched "airstrip", "runway" in src/: none |
| GTA-07-106 | Humane Labs and Research | missing | searched "Humane", "laboratory" in src/: none |
| GTA-07-107 | Wildlife: sea fish and dolphins | missing | searched "fish", "dolphin" in src/: none |
| GTA-07-108 | Peyote plants | skip | Where says DUPLICATE of GTA-10-059 |
| GTA-07-109 | Random event: domestic disturbance | later | G13 |
| GTA-07-110 | Random event: ATM robbery | later | G13 |
| GTA-07-111 | Random event: kidnap rescue | later | G13 |
| GTA-07-112 | Stranger: Abigail Mathers | later | G14 |
| GTA-07-113 | Gangs: Cubans and Haitians | later | C9 |
| GTA-07-114 | North Yankton prologue | missing | searched "North Yankton", "snow" in src/: none |
| GTA-08-001 | Pedestrian crowds | partial | 72 looped walkers (`src/sim/street.js:167-190`); same line, wrap at the end (`:266`); M3-6 gives them trips and district density |
| GTA-08-002 | Reaction to drawn weapons | missing | no weapons (D9); searched "scream", "hands up" in src/: none |
| GTA-08-003 | Reaction to violence | planned | M10-4: "walkers within 20 m run from it and come back 10 s after it has gone" |
| GTA-08-004 | Witnesses call police | planned | M10-4: "A walker who saw a crime calls it in after 5 s ... heat rises with the cause witness" |
| GTA-08-005 | Filming crimes | missing | searched "phone", "film", "record" (bystander) in src/: none |
| GTA-08-006 | Pedestrian fights | later | G13 "Ambient events (an argument, an arrest, a busker) | None | Later" |
| GTA-08-007 | Armed citizens fight back | missing | D9/G13; searched "armed", "return fire" in src/: none |
| GTA-08-008 | Peds bump and apologise | missing | no player-to-walker collision; searched "apolog", "bump" in src/sim: none |
| GTA-08-009 | Peds call out comments | missing | searched "comment", "remark" in src/sim: none |
| GTA-08-010 | Talking to pedestrians | planned | M11-8: "tap E at any walker ... say up to three lines" |
| GTA-08-011 | Respect from reputation | out | G22 "growth lives in M11's cred (hacks and gigs), not a stat sheet" |
| GTA-08-012 | Rain behaviour | missing | rain exists (`src/render/rain.js`) but walkers ignore it; searched "umbrella" in src/: none |
| GTA-08-013 | Ambient conversations | missing | searched "chat", "conversation" in src/: none |
| GTA-08-014 | Joggers and cyclists | missing | searched "jogger", "cyclist" in src/sim: none |
| GTA-08-015 | Dog walkers | later | G32 "Animals: dogs ... Later" |
| GTA-08-016 | Window shoppers and sitters | missing | searched "bench", "sit" (peds) in src/sim: none |
| GTA-08-017 | Phone users and ATM users | missing | searched "ATM", "phone" (ped action) in src/sim: none |
| GTA-08-018 | Tourists | missing | searched "tourist", "camera" (ped) in src/sim: none |
| GTA-08-019 | Paparazzi | missing | searched "paparazzi" in src/: none |
| GTA-08-020 | Street vendors | missing | searched "vendor", "hot dog" in src/: signs only |
| GTA-08-021 | Valet service | skip | Where says WRONG |
| GTA-08-022 | Prostitutes | missing | searched "prostitute", "streetwalker" in src/: none |
| GTA-08-023 | Strip club staff | missing | interiors later (G20/ROADMAP "a club"); searched "dancer", "bouncer" in src/: none |
| GTA-08-024 | Paramedics on scene | missing | searched "paramedic" in src/: none; M12-5's ambulance answers fires, not injured peds |
| GTA-08-025 | Firefighter response | planned | M12-4: "a truck drives from the nearest station and puts it out" |
| GTA-08-026 | Delivery workers and couriers | missing | occupations exist (`src/sim/street.js:57`) but no vehicles or routes; searched "courier" in src/sim: job name only |
| GTA-08-027 | Construction crews | partial | site cranes and netting animate (`src/render/zoning.js:33-35`); no worker people |
| GTA-08-028 | Homeless people | missing | searched "homeless", "beggar" in src/: none |
| GTA-08-029 | Muscle beach groups | missing | searched "bodybuilder", "tai chi" in src/: none |
| GTA-08-030 | Skaters and BMX riders | missing | searched "skate", "BMX" in src/: none |
| GTA-08-031 | Traffic law behaviour | planned | M3-6: "cars stop at a red light"; M5-14 sets lights, stop signs or yield per junction |
| GTA-08-032 | Road rage | missing | searched "road rage", "confront" in src/sim: none |
| GTA-08-033 | Peds dive clear of cars | planned | M10-4 (walkers run from a car driven onto the pavement) |
| GTA-08-034 | NPC carjacking | missing | searched "carjack" in src/: only M10 pulls a driver out for the player |
| GTA-08-035 | Injured peds | missing | D9/no health for peds; searched "injured", "wounded" in src/sim: none |
| GTA-08-036 | Passenger panic | missing | no passengers (searched "passenger" in src/sim: none) |
| GTA-08-037 | Gang members on corners | later | C9 "Factions, gangs, territory | None | Later" |
| GTA-08-038 | Ambient arrests | missing | searched "arrest" in src/sim: only busted (the player) |
| GTA-08-039 | Street preachers | missing | searched "preacher", "soapbox" in src/: none |
| GTA-08-040 | Epsilon cultists | missing | searched "Epsilon" in src/: none |
| GTA-08-041 | Celebrity sightings | missing | searched "celebrity" in src/: none |
| GTA-08-042 | Public events and film shoots | missing | searched "film shoot", "event" (public) in src/: none; G13 later |
| GTA-08-043 | Beach crowds | missing | no beach district; searched "beach", "sunbathe" in src/: none |
| GTA-08-044 | Drunks at night | missing | searched "drunk" in src/sim: none |
| GTA-08-045 | Ambient car accidents | missing | traffic is a loop with no collision (`src/sim/street.js:266`); M10-3 is the player's car only |
| GTA-08-046 | Rush hour | planned | M3-6: "at 8:00 at least 60% of visible walkers are residents heading to their job's parcel"; M3.T35 commute flow |
| GTA-08-047 | Peds in the boot | missing | searched "boot", "trunk" in src/sim: none |
| GTA-09-001 | Michael De Santa | missing | Urbis has no named playable protagonist; searched "Michael" in src/: none |
| GTA-09-002 | Franklin Clinton | missing | searched "Franklin" in src/: none |
| GTA-09-003 | Trevor Philips | missing | searched "Trevor" in src/: none |
| GTA-09-004 | Character switching | missing | one player character; searched "switch character" in src/: none |
| GTA-09-005 | Switch transitions | missing | searched "switch transition" in src/: none |
| GTA-09-006 | In-mission switching | missing | searched "in-mission switch" in src/: none |
| GTA-09-007 | Michael's special ability | missing | no special abilities; searched "special ability", "slow time" in src/: none |
| GTA-09-008 | Franklin's special ability | missing | searched "special ability" in src/: none |
| GTA-09-009 | Trevor's special ability | missing | searched "rage", "special ability" in src/: none |
| GTA-09-010 | Special ability meter | missing | searched "ability meter" in src/: none |
| GTA-09-011 | Story campaign | partial | a six-mission arc, four paths (`src/content/arc.json`, `src/sim/arc.js`); not GTA's 69 missions |
| GTA-09-012 | Cutscenes | partial | dialogue, objective line and journal are DOM (`src/sim/arc.js`, `docs/ARC.md:105-115`); no directed or voiced scenes |
| GTA-09-013 | Cutscene skipping | missing | no cutscenes; 1 only advances plain dialogue (`docs/ARC.md:120-124`) |
| GTA-09-014 | Mission Failed screen | partial | busted rewinds the arc with a note (`src/sim/arc.js:145-157`); no Mission Failed screen |
| GTA-09-015 | Mid-mission checkpoints | partial | busted rewinds to just past the last choice (`src/sim/arc.js:150`); no checkpoints within a mission |
| GTA-09-016 | Quick restart | missing | searched "restart mission" in src/: none |
| GTA-09-017 | Skip section | missing | searched "skip" (mission) in src/: none |
| GTA-09-018 | Mission medals | missing | searched "medal", "gold" in src/: none |
| GTA-09-019 | Mission replay | missing | searched "replay" (mission) in src/: the arc cannot be replayed |
| GTA-09-020 | Prologue heist | missing | the arc opens with LIVE WIRE, a blackout audition; searched "prologue", "heist" in src/: none |
| GTA-09-021 | Jewel Store Job | missing | searched "jewel", "heist" in src/: none |
| GTA-09-022 | Merryweather heist | missing | searched "Merryweather" in src/: none |
| GTA-09-023 | Blitz Play | missing | searched "Blitz", "armoured-car ambush" in src/: none |
| GTA-09-024 | Bureau Raid | missing | searched "Bureau", "FIB building" in src/: none |
| GTA-09-025 | Paleto Score | missing | searched "Paleto" in src/: none |
| GTA-09-026 | The Big Score | missing | searched "Union Depository" in src/: none |
| GTA-09-027 | Heist crew hiring | missing | searched "crew", "hire" in src/: none |
| GTA-09-028 | Crew cuts | missing | searched "cut", "percentage" in src/: none |
| GTA-09-029 | Heist setup missions | missing | searched "setup", "prep" in src/: none |
| GTA-09-030 | Heist approach choice | missing | choices exist (`docs/ARC.md:70-94`) but no heist approaches; searched "approach" in src/: none |
| GTA-09-031 | Three endings | partial | two choices make four endings (`docs/ARC.md:90-94`); not three named endings |
| GTA-09-032 | Story dialogue choices | built | keys 1 and 2 answer a choice (`src/main.js:451`); choices are data (`src/sim/arc.js:182`, `docs/ARC.md:96-101`) |
| GTA-09-033 | Safehouse progression | planned | M11-4: "Its room is a safehouse: a game saved there continues there" |
| GTA-09-034 | 100% completion | missing | searched "100%", "completion" in src/: none; G29 collectibles later |
| GTA-09-035 | Lester Crest | missing | searched "Lester" in src/: none |
| GTA-09-036 | Lamar Davis | missing | searched "Lamar" in src/: none |
| GTA-09-037 | Ron Jakowski | missing | searched "Ron" in src/: none |
| GTA-09-038 | Wade Herbert | missing | searched "Wade" in src/: none |
| GTA-09-039 | Amanda and the De Santas | missing | searched "Amanda", "De Santa" in src/: none |
| GTA-09-040 | Devin Weston | missing | searched "Weston" in src/: none |
| GTA-09-041 | Steve Haines | missing | searched "Haines" in src/: none |
| GTA-09-042 | Dave Norton | missing | searched "Norton" in src/: none |
| GTA-09-043 | Martin Madrazo | missing | searched "Madrazo" in src/: none |
| GTA-09-044 | Wei Cheng and the Triads | missing | searched "Wei Cheng", "Triad" in src/: none |
| GTA-09-045 | Stretch | missing | searched "Stretch" in src/: none |
| GTA-09-046 | Niko Bellic | missing | searched "Niko" in src/: none |
| GTA-09-047 | Roman Bellic | missing | searched "Roman" in src/: none |
| GTA-09-048 | Liberty City supporting cast | missing | searched "Little Jacob", "Brucie", "Packie" in src/: none |
| GTA-09-049 | IV antagonists | missing | searched "Dimitri", "Pegorino" in src/: none |
| GTA-09-050 | CJ | missing | searched "Carl Johnson", "CJ" in src/: none |
| GTA-09-051 | Sweet and Kendl | missing | searched "Sweet", "Kendl" in src/: none |
| GTA-09-052 | Big Smoke and Ryder | missing | searched "Big Smoke", "Ryder" in src/: none |
| GTA-09-053 | Tenpenny and Pulaski | missing | searched "Tenpenny" in src/: none |
| GTA-09-054 | Wu Zi Mu and the Triads | missing | searched "Wu Zi Mu" in src/: none |
| GTA-09-055 | The Truth | missing | searched "The Truth" in src/: none |
| GTA-09-056 | Mike Toreno | missing | searched "Toreno" in src/: none |
| GTA-09-057 | SA antagonists | missing | searched "Catalina", "Loco Syndicate" in src/: none |
| GTA-09-058 | Tommy Vercetti | missing | searched "Tommy", "Vercetti" in src/: none |
| GTA-09-059 | Lance Vance | missing | searched "Lance Vance" in src/: none |
| GTA-09-060 | Sonny Forelli and Diaz | missing | searched "Forelli", "Diaz" in src/: none |
| GTA-09-061 | VC allies | missing | searched "Cortez", "Kent Paul" in src/: none |
| GTA-09-062 | The Lost and Damned | missing | searched "Lost and Damned", "Klebitz" in src/: none |
| GTA-09-063 | The Ballad of Gay Tony | missing | searched "Gay Tony", "Luis Lopez" in src/: none |
| GTA-09-064 | Martin Madrazo | missing | duplicate of GTA-09-043; searched "Madrazo" in src/: none |
| GTA-10-001 | Golf | missing | searched "golf" in src/: none |
| GTA-10-002 | Tennis | missing | searched "tennis" in src/: none |
| GTA-10-003 | Yoga | missing | searched "yoga" in src/: none |
| GTA-10-004 | Triathlon | missing | searched "triathlon" in src/: none |
| GTA-10-005 | Street races | missing | searched "race", "checkpoint" in src/: none (M11 gigs are jobs, not races) |
| GTA-10-006 | Sea races | missing | no boats (G5 later); searched "sea race" in src/: none |
| GTA-10-007 | Air races | out | G5 (aircraft out) |
| GTA-10-008 | Off-road races | missing | searched "off-road race" in src/: none |
| GTA-10-009 | Flight school | out | G5 (aircraft out) |
| GTA-10-010 | Shooting range | missing | D9 combat; searched "shooting range" in src/: none |
| GTA-10-011 | Parachuting jobs | out | G31 "Parachutes ... Out, with aircraft (G5)" |
| GTA-10-012 | Hunting | later | G32 "Animals: dogs, pigeons, deer | None | Later" |
| GTA-10-013 | Wildlife photography | missing | searched "photo", "wildlife" in src/: none |
| GTA-10-014 | Bounty hunting | missing | searched "bounty", "fugitive" in src/: none |
| GTA-10-015 | Towing jobs | missing | searched "tow" in src/: none |
| GTA-10-016 | Taxi work | skip | Where says WRONG |
| GTA-10-017 | Taxi fares | later | G25 "Taxi, fast travel | None | Later" |
| GTA-10-018 | Paramedic missions | missing | M12-5's ambulance is an NPC fleet; searched "paramedic" in src/: none |
| GTA-10-019 | Firefighter missions | missing | M12-4's fire truck is an NPC fleet; searched "firefighter" in src/: none |
| GTA-10-020 | Pizza delivery | missing | searched "pizza" in src/: none |
| GTA-10-021 | Darts | missing | searched "dart" in src/: none |
| GTA-10-022 | Bowling | missing | searched "bowling" in src/: none |
| GTA-10-023 | Pool | missing | searched "pool table" in src/: none |
| GTA-10-024 | QUB3D arcade | missing | searched "arcade", "QUB3D" in src/: none |
| GTA-10-025 | Comedy club show | missing | searched "comedy" in src/: none |
| GTA-10-026 | Cabaret show | missing | searched "cabaret" in src/: none |
| GTA-10-027 | Most Wanted list | missing | searched "most wanted" in src/: none |
| GTA-10-028 | Vigilante | missing | searched "vigilante" in src/: none |
| GTA-10-029 | Rampages | missing | D9; searched "rampage" in src/: none |
| GTA-10-030 | Basketball | missing | searched "basketball" in src/: none |
| GTA-10-031 | Dancing minigame | missing | searched "dance" in src/: none |
| GTA-10-032 | Lowrider challenge | missing | searched "lowrider", "hydraulics" in src/: none |
| GTA-10-033 | Gym training | missing | searched "gym", "treadmill" in src/: none |
| GTA-10-034 | Burglary | missing | searched "burglary" in src/: none |
| GTA-10-035 | Trucking missions | missing | searched "trucking", "cargo" in src/: none |
| GTA-10-036 | Quarry missions | missing | searched "quarry", "digger" in src/: none |
| GTA-10-037 | Valet parking | missing | searched "valet" in src/: none |
| GTA-10-038 | Pimping missions | missing | searched "pimp" in src/: none |
| GTA-10-039 | Courier missions | missing | searched "courier" in src/sim: job name only (`src/sim/street.js:57`), no mission |
| GTA-10-040 | Driving school | missing | searched "driving school", "licence" in src/: none |
| GTA-10-041 | Bike school | missing | searched "bike school" in src/: none |
| GTA-10-042 | Boat school | missing | searched "boat school" in src/: none |
| GTA-10-043 | Pilot school | out | G5 (aircraft out) |
| GTA-10-044 | Stadium events | missing | searched "stadium", "8-Track" in src/: none |
| GTA-10-045 | Hotring and Bloodring | missing | searched "Hotring", "demolition derby" in src/: none |
| GTA-10-046 | BMX challenge | missing | searched "BMX" in src/: none |
| GTA-10-047 | NRG-500 challenge | missing | searched "NRG" in src/: none |
| GTA-10-048 | Chiliad Challenge | missing | searched "Chiliad", "mountain bike" in src/: none |
| GTA-10-049 | Top Fun RC missions | later | W18 "Drones, RC cars | None | Later" |
| GTA-10-050 | Collect letters | later | G29 "Collectibles (hidden packages, letter scraps) | None | Later" |
| GTA-10-051 | Spaceship parts | later | G29 |
| GTA-10-052 | Submarine pieces | skip | Where says WRONG |
| GTA-10-053 | Stunt jumps | later | G29 (hand-placed collectible content) |
| GTA-10-054 | Under the bridge | out | G5 (aircraft out) |
| GTA-10-055 | Knife flights | out | G5 (aircraft out) |
| GTA-10-056 | Hidden packages | later | G29 |
| GTA-10-057 | Oysters, horseshoes, snapshots and tags | later | G29 |
| GTA-10-058 | Unique jumps | later | G29 |
| GTA-10-059 | Peyote plants | later | G29 (collectible) and G32 (animal play) |
| GTA-10-060 | Murder Mystery | later | G29 (clue collectibles) |
| GTA-10-061 | Monkey mosaics | later | G29 |
| GTA-10-062 | Playing cards | later | G29 |
| GTA-10-063 | Action figures | later | G29 |
| GTA-10-064 | Signal jammers | later | G29 |
| GTA-10-065 | Shipwrecks and treasure | later | G29 |
| GTA-10-066 | LD Organics products | later | G29 |
| GTA-10-067 | Media sticks | later | G29 |
| GTA-10-068 | Movie props | later | G29 |
| GTA-10-069 | Snowmen | later | G29 (festive collectible) |
| GTA-10-070 | Treasure hunt | later | G29 |
| GTA-10-071 | Los Santos Slasher | later | G29 |
| GTA-10-072 | G's Cache | later | G29 |
| GTA-10-073 | Junk Energy Skydives | out | G31 (parachutes out) |
| GTA-10-074 | Casino games | missing | searched "blackjack", "roulette", "casino" in src/: none |
| GTA-10-075 | Inside Track betting | missing | searched "bet", "horse race" in src/: none |
| GTA-10-076 | Arcade cabinets | missing | searched "arcade cabinet" in src/: none |
| GTA-10-077 | Time trials | missing | searched "time trial" in src/: none |
| GTA-10-078 | Stock car racing | missing | searched "stock car" in src/: none |
| GTA-10-079 | Street racing (Tuners) | missing | searched "street race", "tuner" in src/: none |
| GTA-10-080 | Drift races | missing | searched "drift race" in src/: none |
| GTA-10-081 | Arm wrestling | missing | searched "arm wrestl" in src/: none |
| GTA-10-082 | Flight school lessons | out | G5 (aircraft out) |
| GTA-10-083 | RC time trials | later | W18 "Drones, RC cars | None | Later" |
| GTA-10-084 | Bounty target work | missing | searched "bounty" in src/: none |
| GTA-10-085 | Deliver exotic exports | missing | searched "export", "dock" (delivery) in src/: none |
| GTA-10-086 | Tow truck service | missing | searched "tow truck", "salvage" in src/: none |
| GTA-10-087 | Assassination missions | missing | searched "assassin" in src/: none |
| GTA-10-088 | Trevor's rampages | missing | D9; searched "rampage" in src/: none |
| GTA-10-089 | Nuclear waste barrels | later | G29 (diving collectible) |
| GTA-10-090 | Taxi fares in Liberty City | later | G25 "Taxi, fast travel | None | Later" |
| GTA-10-091 | Darts in Los Santos bars | missing | searched "dartboard", "darts" in src/: none |
| GTA-11-001 | Cash on hand | partial | ₡ balance on the HUD `src/main.js:1254`; no loss on bust — bust only resets the contract `src/main.js:1155` |
| GTA-11-002 | Bank account | missing | searched account, deposit, bank in `src/`; only the river bank `src/sim/player.js:46`, no account |
| GTA-11-003 | ATMs | missing | searched atm, withdraw, deposit in `src/`; none |
| GTA-11-004 | Phone banking | missing | no phone; searched phone, banking in `src/`; none |
| GTA-11-005 | Bank interiors | missing | searched bank, vault, teller in `src/`; after-sell interiors are 3 shops, 2 offices, corporate floor, club, warehouse, subway, safehouse — no bank (`docs/ROADMAP.md:701`) |
| GTA-11-006 | Robbing convenience stores | later | CAPABILITIES G11 (combat, operator D9); no guns or robbery in `src/` |
| GTA-11-007 | Robbing gas stations | later | CAPABILITIES G11/D9; searched petrol, gas, register in `src/`; none |
| GTA-11-008 | Armored truck robbery | later | CAPABILITIES G11/D9; no cash vans, explosives or weapons |
| GTA-11-009 | Assassination stock plays | later | CAPABILITIES G27 (stock market moved by the player's acts) |
| GTA-11-010 | LCN stock market | later | CAPABILITIES G27 |
| GTA-11-011 | BAWSAQ stock market | later | CAPABILITIES G27 |
| GTA-11-012 | Stock price manipulation | later | CAPABILITIES G27 |
| GTA-11-013 | Buying story properties | planned | M11-4: hold E at any grown building's door to buy it; M11.T7 |
| GTA-11-014 | Property weekly income | planned | M11-4: pays the owner's share of the lot's trade every game hour |
| GTA-11-015 | Property upgrades | missing | searched upgrade, staff, security in `src/sim`; M5 covers city services, not owned-property upgrades |
| GTA-11-016 | Safehouses for sale | planned | M11-4, M11.T8 (an owned building's room is a save point) |
| GTA-11-017 | Business asset missions | planned | M11-1: gigs made from the sim's queued state |
| GTA-11-018 | Vice City businesses | missing | VC content; searched business, Malibu, Kaufman in `src/`; none |
| GTA-11-019 | Apartment properties | planned | M11-4 safehouse; no garages or spawn picker in the plan |
| GTA-11-020 | CEO office | out | CAPABILITIES G28 (Online: out) |
| GTA-11-021 | Special Cargo warehouses | out | CAPABILITIES G28 (Online: out) |
| GTA-11-022 | Vehicle warehouse business | out | CAPABILITIES G28 (Online: out) |
| GTA-11-023 | Bunker | out | CAPABILITIES G28 (Online: out) |
| GTA-11-024 | Bunker research | out | CAPABILITIES G28 (Online: out) |
| GTA-11-025 | Hangar business | out | CAPABILITIES G28 (Online: out) |
| GTA-11-026 | MC clubhouse | out | CAPABILITIES G28 (Online: out) |
| GTA-11-027 | MC businesses | out | CAPABILITIES G28 (Online: out) |
| GTA-11-028 | MC supply and sell runs | out | CAPABILITIES G28 (Online: out) |
| GTA-11-029 | Nightclub | out | CAPABILITIES G28 (Online: out); a bar/club interior is later at `docs/ROADMAP.md:701` |
| GTA-11-030 | Nightclub warehouse | out | CAPABILITIES G28 (Online: out) |
| GTA-11-031 | Nightclub technicians | out | CAPABILITIES G28 (Online: out) |
| GTA-11-032 | Facility | out | CAPABILITIES G28 (Online: out) |
| GTA-11-033 | Terrorbyte | out | CAPABILITIES G28 (Online: out) |
| GTA-11-034 | Arcade | out | CAPABILITIES G28 (Online: out) |
| GTA-11-035 | Casino penthouse | out | CAPABILITIES G28 (Online: out) |
| GTA-11-036 | Auto Shop | out | CAPABILITIES G28 (Online: out) |
| GTA-11-037 | Agency | out | CAPABILITIES G28 (Online: out) |
| GTA-11-038 | Freakshop | out | CAPABILITIES G28 (Online: out) |
| GTA-11-039 | Acid lab | out | CAPABILITIES G28 (Online: out) |
| GTA-11-040 | Salvage yard | out | CAPABILITIES G28 (Online: out) |
| GTA-11-041 | Bail office | out | CAPABILITIES G28 (Online: out) |
| GTA-11-042 | Yacht | out | CAPABILITIES G28 (Online: out) |
| GTA-11-043 | Business raids | out | CAPABILITIES G28 (Online: out) |
| GTA-11-044 | Utility and staff fees | out | CAPABILITIES G28 (Online: out); city upkeep is M5-6 |
| GTA-11-045 | Shark Cards | out | CAPABILITIES G28 (Online: out) |
| GTA-11-046 | GTA+ membership | out | CAPABILITIES G28 (Online: out) |
| GTA-11-047 | Casino chips | out | CAPABILITIES G28 (Online: out) |
| GTA-11-048 | Daily objectives | out | CAPABILITIES G28 (Online: out) |
| GTA-11-049 | Epsilon donations | missing | searched epsilon, donation, cult in `src/`; none |
| GTA-11-050 | Payphone hit rewards | out | CAPABILITIES G28 (Online: out; The Contract) |
| GTA-11-051 | Freemode business battles | out | CAPABILITIES G28 (Online: out) |
| GTA-11-052 | Picking up dropped cash | later | D9 (cash drops from killed peds and robbed tills); only mission balances exist `src/sim/mission.js:81` |
| GTA-12-001 | Clothing stores | later | CAPABILITIES G20 (shops: clothes, food, barber later) |
| GTA-12-002 | Hairstyles | later | CAPABILITIES G21 (character customisation later) |
| GTA-12-003 | Facial hair | later | CAPABILITIES G21 |
| GTA-12-004 | Tattoos | later | CAPABILITIES G21 |
| GTA-12-005 | Masks | later | CAPABILITIES G21 |
| GTA-12-006 | Hats, helmets and glasses | later | CAPABILITIES G21 |
| GTA-12-007 | Jewellery | later | CAPABILITIES G21 |
| GTA-12-008 | Gloves and shoes | later | CAPABILITIES G21 |
| GTA-12-009 | Saved outfits | later | CAPABILITIES G21 |
| GTA-12-010 | Wardrobe at home | later | CAPABILITIES G21; a bought building is a safehouse at M11-4, no wardrobe |
| GTA-12-011 | Interaction Menu style | out | CAPABILITIES G28 (Online: out) |
| GTA-12-012 | Action emotes | missing | searched emote, gesture, dance in `src/`; none |
| GTA-12-013 | Character creator: heritage | out | CAPABILITIES G28 (Online: out) |
| GTA-12-014 | Character creator: sliders | out | CAPABILITIES G28 (Online: out) |
| GTA-12-015 | Character creator: lifestyle | out | CAPABILITIES G28 (Online: out) |
| GTA-12-016 | Change appearance | out | CAPABILITIES G28 (Online: out) |
| GTA-12-017 | Gender choice | out | CAPABILITIES G28 (Online: out) |
| GTA-12-018 | Makeup | out | CAPABILITIES G28 (Online: out) |
| GTA-12-019 | Stamina stat | out | CAPABILITIES G22 (no stat sheet; growth is M11 cred) |
| GTA-12-020 | Shooting stat | out | CAPABILITIES G22; combat is D9 |
| GTA-12-021 | Strength stat | out | CAPABILITIES G22 |
| GTA-12-022 | Stealth stat | out | CAPABILITIES G22 |
| GTA-12-023 | Flying stat | out | CAPABILITIES G22; aircraft out at G5 |
| GTA-12-024 | Driving stat | out | CAPABILITIES G22 |
| GTA-12-025 | Lung capacity stat | out | CAPABILITIES G22 |
| GTA-12-026 | Stats grow with use | out | CAPABILITIES G22 (M11-5 cred is the replacement) |
| GTA-12-027 | Fat stat | out | CAPABILITIES G22 |
| GTA-12-028 | Muscle stat | out | CAPABILITIES G22 |
| GTA-12-029 | Sex appeal stat | out | CAPABILITIES G22; romance is out at C13 |
| GTA-12-030 | Respect stat | out | CAPABILITIES G22 (cred at M11-5, no gang recruits) |
| GTA-12-031 | Per-weapon skills | out | CAPABILITIES G22; combat is D9 |
| GTA-12-032 | SA clothing brands | later | CAPABILITIES G20 |
| GTA-12-033 | Vice City outfits | later | CAPABILITIES G20 |
| GTA-12-034 | Liberty City clothing | later | CAPABILITIES G20 |
| GTA-12-035 | Gear: night and thermal vision | out | CAPABILITIES G28 (Online: out); no goggles in `src/` |
| GTA-12-036 | Gear: rebreather and scuba | missing | searched scuba, rebreather, tank in `src/`; water is surface swim only at M10-5 |
| GTA-12-037 | Gear: hazmat suit | out | CAPABILITIES G28 (Online heists: out) |
| GTA-12-038 | Heist outfits | missing | searched heist, boiler, disguise in `src/`; no heist system |
| GTA-12-039 | Parachute bag styles | out | CAPABILITIES G31 (parachutes out) |
| GTA-12-040 | Body armour look | later | CAPABILITIES G21 (customisation later); the protection waits on D9 |
| GTA-12-041 | Hair growth | missing | searched hair, beard, barber in `src/`; none |
| GTA-12-042 | Face paints | later | CAPABILITIES G21 |
| GTA-13-001 | iFruit phone | later | CAPABILITIES G17 (phone: contacts, texts later) |
| GTA-13-002 | Phone contacts | later | CAPABILITIES G17 |
| GTA-13-003 | Emergency calls | missing | searched 911, emergency, dial in `src/`; none |
| GTA-13-004 | Messages | later | CAPABILITIES G17 |
| GTA-13-005 | Email inbox | later | CAPABILITIES G33 (internet and in-world media later) |
| GTA-13-006 | Phone camera | later | CAPABILITIES G26 (photo mode later) |
| GTA-13-007 | Snapmatic | later | CAPABILITIES G26 |
| GTA-13-008 | Photo gallery | later | CAPABILITIES G26 |
| GTA-13-009 | Selfies | later | CAPABILITIES G26 |
| GTA-13-010 | Quick save | partial | autosave every 30 s `src/main.js:1232`; no phone, no manual save in play |
| GTA-13-011 | Phone settings | later | CAPABILITIES G17 |
| GTA-13-012 | Online Job List | out | CAPABILITIES G28 (Online: out) |
| GTA-13-013 | Online services list | out | CAPABILITIES G28 (Online: out) |
| GTA-13-014 | SecuroServ app | out | CAPABILITIES G28 (Online: out) |
| GTA-13-015 | Motorcycle Club app | out | CAPABILITIES G28 (Online: out) |
| GTA-13-016 | Internet browser | later | CAPABILITIES G33 |
| GTA-13-017 | Eyefind portal | later | CAPABILITIES G33 |
| GTA-13-018 | Maze Bank website | missing | searched account, balance, bank in `src/`; none (internet is later G33) |
| GTA-13-019 | LCN and BAWSAQ sites | later | CAPABILITIES G27 (stock market later) |
| GTA-13-020 | Dynasty 8 website | planned | M11-4 buys property at the door; no website in the plan |
| GTA-13-021 | Dynasty 8 Executive | out | CAPABILITIES G28 (Online: out) |
| GTA-13-022 | Maze Bank Foreclosures | out | CAPABILITIES G28 (Online: out) |
| GTA-13-023 | Legendary Motorsport | later | CAPABILITIES G8 (own and customise cars later) |
| GTA-13-024 | Southern San Andreas Super Autos | later | CAPABILITIES G8 |
| GTA-13-025 | Warstock Cache & Carry | later | CAPABILITIES G8; weaponised vehicles not planned |
| GTA-13-026 | Elitás Travel | out | CAPABILITIES G5 (aircraft out) |
| GTA-13-027 | Dock Tease | later | CAPABILITIES G5 (boats later) |
| GTA-13-028 | Pedal and Metal Motosport | later | CAPABILITIES S52 (bicycles later) |
| GTA-13-029 | Benny's website | later | CAPABILITIES G8 |
| GTA-13-030 | Ammu-Nation online store | later | CAPABILITIES G11 / D9 (combat waits) |
| GTA-13-031 | Online clothing stores | later | CAPABILITIES G20 |
| GTA-13-032 | Bleeter | later | CAPABILITIES G33 |
| GTA-13-033 | Lifeinvader | later | CAPABILITIES G33 |
| GTA-13-034 | Weazel News TV | later | CAPABILITIES G33 |
| GTA-13-035 | V TV channels | later | CAPABILITIES G33 |
| GTA-13-036 | IV TV channels | later | CAPABILITIES G33 |
| GTA-13-037 | Meltdown film | later | CAPABILITIES G33 |
| GTA-13-038 | Radio news bulletins | later | CAPABILITIES G23 (radio later); the news line is text only `src/sim/news.js:89` |
| GTA-13-039 | iFruit companion app | missing | searched companion, mobile, app in `src/`; none |
| GTA-13-040 | Internet cafes | later | CAPABILITIES G33 |
| GTA-14-001 | Minimap radar | planned | M10-2 (minimap over the game, 0 draws) |
| GTA-14-002 | Radar modes | missing | searched radar, minimap, rotate, north in `src/`; only the mission panel, no minimap to rotate |
| GTA-14-003 | Coloured blips | planned | M10-2: mission marker and police units on the minimap |
| GTA-14-004 | Map legend | missing | searched legend, filter in `src/`; none |
| GTA-14-005 | Waypoints | planned | M10-2 (a click on the map sets a waypoint) |
| GTA-14-006 | GPS route | planned | M10-2 (route along the road graph, redrawn within 1 s) |
| GTA-14-007 | Quick GPS | missing | searched nearest, quick gps in `src/`; none |
| GTA-14-008 | Distance readout | partial | objective distance in metres `src/render/arcui.js:83`; no waypoint distance under a minimap |
| GTA-14-009 | Pause map | planned | M10-2 (M opens a map of the whole town) |
| GTA-14-010 | Blip filters | out | CAPABILITIES G28 (Online: out) |
| GTA-14-011 | Health and armour rings | later | D9 (no health system; wasted depends on D9) |
| GTA-14-012 | Special ability bar | missing | no abilities; searched ability, meter in `src/`; none |
| GTA-14-013 | Wanted stars | built | stars in the HUD `src/main.js:1245`; tiers `src/sim/wanted.js:43` |
| GTA-14-014 | Cash display | built | ₡ balance `src/main.js:1254`; payout banner `src/sim/mission.js:86` |
| GTA-14-015 | Bank balance | missing | no bank account; searched bank in `src/`; none |
| GTA-14-016 | Weapon wheel HUD | later | CAPABILITIES G11 / D9 |
| GTA-14-017 | Ammo counter | later | CAPABILITIES G11 / D9 |
| GTA-14-018 | Radio wheel HUD | later | CAPABILITIES G23 (radio later) |
| GTA-14-019 | Objective text | built | arc objective panel `src/render/arcui.js:75`; contract steps `src/main.js:1255` |
| GTA-14-020 | Mission briefs | built | mission brief spoken on start `src/sim/arc.js:60`; shown `src/render/arcui.js:89`; marker `src/render/arc.js:194` |
| GTA-14-021 | Help text | built | control hint line `index.html:35`; M7-5 upgrades it |
| GTA-14-022 | Notification feed | partial | city news line `src/render/news.js:21`; no cash/RP/invite feed |
| GTA-14-023 | Kill feed | out | CAPABILITIES G28 (Online: out) |
| GTA-14-024 | Player list | out | CAPABILITIES G28 (Online: out) |
| GTA-14-025 | Job lobby | out | CAPABILITIES G28 (Online: out) |
| GTA-14-026 | Race HUD | missing | searched race, lap, checkpoint in `src/`; none |
| GTA-14-027 | Countdown timer | missing | searched countdown, deadline in `src/`; only the hack recharge line `src/main.js:1010` |
| GTA-14-028 | Character switch wheel | missing | one protagonist; searched switch, wheel in `src/`; none |
| GTA-14-029 | Street and district names | partial | street names exist for news/dispatch `src/sim/streetnames.js:31`; no corner area label on crossing |
| GTA-14-030 | Vehicle name | missing | cars carry no names; searched vehicle name in `src/`; none |
| GTA-14-031 | On-screen clock | built | clock in the HUD `src/main.js:1247-1250` |
| GTA-14-032 | Pause menu | planned | M7-3 (Esc pauses); map M10-2, slots M7-7, settings M7-4 |
| GTA-14-033 | Stats menu | missing | searched stats, kills, time played in `src/`; none |
| GTA-14-034 | 100% checklist | missing | searched completion, checklist in `src/`; none |
| GTA-14-035 | Interaction Menu | out | CAPABILITIES G28 (Online: out) |
| GTA-14-036 | Safe zone and HUD scale | later | ROADMAP after the sell check (`docs/ROADMAP.md:712`, accessibility) |
| GTA-14-037 | Tutorial pop-ups | planned | M7-5 (one hint per key, "when M7 closes") |
| GTA-14-038 | Button prompts | built | F prompt `src/main.js:1196-1204`; E door prompt `src/render/doorhud.js:29` |
| GTA-14-039 | Save and load menu | planned | M7-7 (three slots, named by seed and population) |
| GTA-14-040 | Autosave indicator | missing | searched spinner, indicator, saving in `src/`; autosave runs `src/main.js:1232` with no indicator |
| GTA-14-041 | RP bar and rank | out | CAPABILITIES G28 (Online: out) |
| GTA-14-042 | Business notifications | out | CAPABILITIES G28 (Online: out) |
| GTA-14-043 | Heist planning board | missing | searched heist, planning board in `src/`; none |
| GTA-14-044 | Crew stat cards | missing | searched crew, card, cut in `src/`; none |
| GTA-14-045 | Phone HUD | later | CAPABILITIES G17 |
| GTA-14-046 | Collectible counters | later | CAPABILITIES G29 (collectibles later) |
| GTA-14-047 | Wasted and Busted overlays | partial | BUSTED banner `src/main.js:1258`; wasted waits on D9 |
| GTA-14-048 | Police search zone display | built | widening search area `src/sim/wanted.js:28-93`; dashed ring and sweep `src/render/heli.js:75` |
| GTA-14-049 | Crew-coloured blips | out | CAPABILITIES G28 (Online: out) |
| GTA-15-001 | Friend calls | missing | no phone; searched call, friend, hangout in `src/`; none |
| GTA-15-002 | Friendship meter | partial | the arc's three contacts hold an attitude score `src/sim/arc.js:26`, moved by choices `src/sim/arc.js:179`; no hangouts |
| GTA-15-003 | Hangout activities | missing | searched hangout, bowling, darts in `src/`; none |
| GTA-15-004 | Friend perks | missing | searched perk, favour, service in `src/`; none |
| GTA-15-005 | Jacob's gun delivery | later | CAPABILITIES G11 / D9 (weapons wait) |
| GTA-15-006 | Packie's car bombs | later | CAPABILITIES G11 / D9 |
| GTA-15-007 | Brucie's helicopter | out | CAPABILITIES G5 (aircraft out) |
| GTA-15-008 | Dwayne's backup | later | CAPABILITIES G11 / D9 (armed backup needs combat) |
| GTA-15-009 | Friend requests and declines | missing | searched decline, ignore, call in `src/`; none |
| GTA-15-010 | Girlfriends | out | CAPABILITIES C13 (romance out) |
| GTA-15-011 | Dating activities | out | CAPABILITIES C13 |
| GTA-15-012 | Date conversation | out | CAPABILITIES C13 |
| GTA-15-013 | Gifts | out | CAPABILITIES C13 |
| GTA-15-014 | Girlfriend rewards | out | CAPABILITIES C13 |
| GTA-15-015 | Gang recruitment | missing | searched gang, recruit, crew in `src/`; none |
| GTA-15-016 | Recruit commands | missing | searched follow, hold position in `src/`; none |
| GTA-15-017 | Recruit drive-by | later | CAPABILITIES G11 / D9 |
| GTA-15-018 | Chop the dog | later | CAPABILITIES G32 (animals later) |
| GTA-15-019 | Chop training app | later | CAPABILITIES G32 |
| GTA-15-020 | Family phone calls | missing | no family characters; searched family, Amanda, Jimmy in `src/`; none |
| GTA-15-021 | Family missions | missing | searched family, sibling, relative in `src/`; the arc's three contacts are not family (`src/content/arc.json`) |
| GTA-15-022 | Online friend invites | out | CAPABILITIES G28 (Online: out) |
| GTA-15-023 | Friend spectating | out | CAPABILITIES G28 (Online: out) |
| GTA-15-024 | Hangout invitation texts | missing | searched invite, text, hangout in `src/`; none |
| GTA-15-025 | Dating website contacts | out | CAPABILITIES C13 (romance out) |
| GTA-15-026 | IV internet girlfriends | out | CAPABILITIES C13 |
| GTA-16-001 | Rank and RP | planned | M11-5 (cred tiers from gigs and missions; no RP name) |
| GTA-16-002 | Rank unlocks | planned | M11-5 (tiers unlock battery, range, faster break-in, better gigs) |
| GTA-16-003 | Two character slots | out | CAPABILITIES G28 (Online: out) |
| GTA-16-004 | Career Builder | out | CAPABILITIES G28 (Online: out) |
| GTA-16-005 | Quick join jobs | out | CAPABILITIES G28 (Online: out) |
| GTA-16-006 | Contact missions | planned | M11-1 (gigs from clients made from the sim's state; CAPABILITIES C3/W22) |
| GTA-16-007 | Land races | out | CAPABILITIES G28 (Online: out) |
| GTA-16-008 | Sea races | out | CAPABILITIES G28 (Online: out) |
| GTA-16-009 | Air races | out | CAPABILITIES G5 (aircraft out) |
| GTA-16-010 | Stunt races | out | CAPABILITIES G28 (Online: out) |
| GTA-16-011 | Transform races | out | CAPABILITIES G28 (Online: out) |
| GTA-16-012 | Special Vehicle races | out | CAPABILITIES G28 (Online: out) |
| GTA-16-013 | Open Wheel races | out | CAPABILITIES G28 (Online: out) |
| GTA-16-014 | Hotring races | out | CAPABILITIES G28 (Online: out) |
| GTA-16-015 | Deathmatches | out | CAPABILITIES G28 (Online: out) |
| GTA-16-016 | Vehicle deathmatches | out | CAPABILITIES G28 (Online: out) |
| GTA-16-017 | Captures | out | CAPABILITIES G28 (Online: out) |
| GTA-16-018 | Last Team Standing | out | CAPABILITIES G28 (Online: out) |
| GTA-16-019 | Survivals | out | CAPABILITIES G28 (Online: out) |
| GTA-16-020 | Parachuting jobs | out | CAPABILITIES G31 (parachutes out) |
| GTA-16-021 | Adversary modes | out | CAPABILITIES G28 (Online: out) |
| GTA-16-022 | Slasher | out | CAPABILITIES G28 (Online: out) |
| GTA-16-023 | Deadline | out | CAPABILITIES G28 (Online: out) |
| GTA-16-024 | Beast vs Slasher | out | CAPABILITIES G28 (Online: out) |
| GTA-16-025 | Hunting Pack | out | CAPABILITIES G28 (Online: out) |
| GTA-16-026 | Motor Wars | out | CAPABILITIES G28 (Online: out) |
| GTA-16-027 | Tiny Racers | out | CAPABILITIES G28 (Online: out) |
| GTA-16-028 | Sumo | out | CAPABILITIES G28 (Online: out) |
| GTA-16-029 | Overtime Rumble | out | CAPABILITIES G28 (Online: out) |
| GTA-16-030 | The Vespucci Job | out | CAPABILITIES G28 (Online: out) |
| GTA-16-031 | Trap Door | out | CAPABILITIES G28 (Online: out) |
| GTA-16-032 | Extraction | out | CAPABILITIES G28 (Online: out) |
| GTA-16-033 | Vehicle Vendetta | out | CAPABILITIES G28 (Online: out) |
| GTA-16-034 | Rhino Hunt | out | CAPABILITIES G28 (Online: out) |
| GTA-16-035 | Dogfight | out | CAPABILITIES G5 (aircraft out) |
| GTA-16-036 | Juggernaut | out | CAPABILITIES G28 (Online: out) |
| GTA-16-037 | Resurrection | out | CAPABILITIES G28 (Online: out) |
| GTA-16-038 | Short Trips | out | CAPABILITIES G28 (Online: out) |
| GTA-16-039 | Arena War modes | out | CAPABILITIES G28 (Online: out) |
| GTA-16-040 | Arena points and sponsorship | out | CAPABILITIES G28 (Online: out) |
| GTA-16-041 | The Fleeca Job | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-042 | Prison Break | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-043 | Humane Labs Raid | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-044 | Series A Funding | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-045 | Pacific Standard Job | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-046 | Heist roles and cuts | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-047 | Heist setup and prep missions | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-048 | Heist bonuses | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-049 | Criminal Mastermind | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-050 | Doomsday Heist acts | out | CAPABILITIES G28 (Online: out) |
| GTA-16-051 | Doomsday setups and preps | out | CAPABILITIES G28 (Online: out) |
| GTA-16-052 | Casino story missions | out | CAPABILITIES G28 (Online: out) |
| GTA-16-053 | Diamond Casino Heist | out | CAPABILITIES G28 (Online: out) |
| GTA-16-054 | Casino heist optional preps | out | CAPABILITIES G28 (Online: out) |
| GTA-16-055 | Casino heist hard mode | out | CAPABILITIES G28 (Online: out) |
| GTA-16-056 | Cayo Perico scoping | out | CAPABILITIES G28 (Online: out) |
| GTA-16-057 | Cayo Perico approaches | out | CAPABILITIES G28 (Online: out) |
| GTA-16-058 | Cayo Perico secondary loot | out | CAPABILITIES G28 (Online: out) |
| GTA-16-059 | Cayo Perico elite challenge | out | CAPABILITIES G28 (Online: out) |
| GTA-16-060 | Contract story missions | out | CAPABILITIES G28 (Online: out) |
| GTA-16-061 | Security contracts | out | CAPABILITIES G28 (Online: out) |
| GTA-16-062 | Payphone hits | out | CAPABILITIES G28 (Online: out) |
| GTA-16-063 | Short Trip co-op | out | CAPABILITIES G28 (Online: out) |
| GTA-16-064 | Auto Shop contracts | out | CAPABILITIES G28 (Online: out) |
| GTA-16-065 | Salvage yard robberies | out | CAPABILITIES G28 (Online: out) |
| GTA-16-066 | First Dose and Last Dose | out | CAPABILITIES G28 (Online: out) |
| GTA-16-067 | Fooligan jobs | out | CAPABILITIES G28 (Online: out) |
| GTA-16-068 | Project Overthrow | out | CAPABILITIES G28 (Online: out) |
| GTA-16-069 | LSA Operations | out | CAPABILITIES G28 (Online: out) |
| GTA-16-070 | Dispatch work | out | CAPABILITIES G28 (Online: out) |
| GTA-16-071 | Mobile Operations | out | CAPABILITIES G28 (Online: out) |
| GTA-16-072 | Client jobs | out | CAPABILITIES G28 (Online: out) |
| GTA-16-073 | Special vehicle work | out | CAPABILITIES G28 (Online: out) |
| GTA-16-074 | Bunker shooting range | out | CAPABILITIES G28 (Online: out) |
| GTA-16-075 | Orbital cannon | out | CAPABILITIES G28 (Online: out) |
| GTA-16-076 | Strike team | out | CAPABILITIES G28 (Online: out) |
| GTA-16-077 | Nano drone | out | CAPABILITIES G28 (Online: out) |
| GTA-16-078 | Yacht Life missions | out | CAPABILITIES G28 (Online: out) |
| GTA-16-079 | CEO registration | out | CAPABILITIES G28 (Online: out) |
| GTA-16-080 | CEO abilities | out | CAPABILITIES G28 (Online: out) |
| GTA-16-081 | VIP work | out | CAPABILITIES G28 (Online: out) |
| GTA-16-082 | MC registration | out | CAPABILITIES G28 (Online: out) |
| GTA-16-083 | MC contracts | out | CAPABILITIES G28 (Online: out) |
| GTA-16-084 | Freemode events | out | CAPABILITIES G28 (Online: out) |
| GTA-16-085 | Freemode challenges | out | CAPABILITIES G28 (Online: out) |
| GTA-16-086 | Business battles | out | CAPABILITIES G28 (Online: out) |
| GTA-16-087 | Time trials | out | CAPABILITIES G28 (Online: out) |
| GTA-16-088 | Passive mode | out | CAPABILITIES G28 (Online: out) |
| GTA-16-089 | Player bounties | out | CAPABILITIES G28 (Online: out) |
| GTA-16-090 | Bad Sport lobby | out | CAPABILITIES G28 (Online: out) |
| GTA-16-091 | Spectator mode | out | CAPABILITIES G28 (Online: out) |
| GTA-16-092 | Betting and wagers | out | CAPABILITIES G28 (Online: out) |
| GTA-16-093 | Job lobby settings | out | CAPABILITIES G28 (Online: out) |
| GTA-16-094 | Matchmaking | out | CAPABILITIES G28 (Online: out) |
| GTA-16-095 | Session types | out | CAPABILITIES G28 (Online: out) |
| GTA-16-096 | Text and voice chat | out | CAPABILITIES G28 (Online: out) |
| GTA-16-097 | Crews | out | CAPABILITIES G28 (Online: out) |
| GTA-16-098 | Crew ranks | out | CAPABILITIES G28 (Online: out) |
| GTA-16-099 | Crew emblem and colours | out | CAPABILITIES G28 (Online: out) |
| GTA-16-100 | Content Creator: races | out | CAPABILITIES G28 (Online: out; mods later is S39) |
| GTA-16-101 | Content Creator: deathmatches | out | CAPABILITIES G28 (Online: out) |
| GTA-16-102 | Content Creator: captures | out | CAPABILITIES G28 (Online: out) |
| GTA-16-103 | Verified jobs | out | CAPABILITIES G28 (Online: out) |
| GTA-16-104 | Playlists and bookmarks | out | CAPABILITIES G28 (Online: out) |
| GTA-16-105 | Awards | out | CAPABILITIES G28 (Online: out; Steam achievements are M9-6) |
| GTA-16-106 | Trade prices | out | CAPABILITIES G28 (Online: out) |
| GTA-16-107 | Weekly bonuses | out | CAPABILITIES G28 (Online: out) |
| GTA-16-108 | Seasonal events | out | CAPABILITIES G28 (Online: out; seasons later at S45) |
| GTA-16-109 | The Music Locker | later | ROADMAP after the sell check (`docs/ROADMAP.md:701`, a club interior) |
| GTA-16-110 | Record A Studios | out | CAPABILITIES G28 (Online: out) |
| GTA-16-111 | Getting wasted penalties | out | CAPABILITIES G28 (Online: out; wasted waits on D9) |
| GTA-16-112 | Session kill streaks | out | CAPABILITIES G28 (Online: out) |
| GTA-16-113 | Inventory snacks and armour | out | CAPABILITIES G28 (Online: out); combat is D9 |
| GTA-16-114 | Personal spawn point | planned | M11-4 / M11.T8 (a game saved in an owned building continues there) |
| GTA-16-115 | Invites to apartments | out | CAPABILITIES G28 (Online: out) |
| GTA-16-116 | Lowrider missions | out | CAPABILITIES G28 (Online: out) |
| GTA-16-117 | GTA Race | out | CAPABILITIES G28 (Online: out) |
| GTA-16-118 | Premium races | out | CAPABILITIES G28 (Online: out) |
| GTA-16-119 | Slipstream and catch-up toggles | out | CAPABILITIES G28 (Online: out) |
| GTA-16-120 | Heist elite challenges | out | CAPABILITIES G28 (Online heists: out) |
| GTA-16-121 | Come Out to Play | out | CAPABILITIES G28 (Online: out) |
| GTA-16-122 | Every Bullet Counts | out | CAPABILITIES G28 (Online: out) |
| GTA-16-123 | Hasta La Vista | out | CAPABILITIES G28 (Online: out) |
| GTA-16-124 | Power Play | out | CAPABILITIES G28 (Online: out) |
| GTA-16-125 | Offense Defense | out | CAPABILITIES G28 (Online: out) |
| GTA-16-126 | Trading Places | out | CAPABILITIES G28 (Online: out) |
| GTA-16-127 | Airstrike | out | CAPABILITIES G28 (Online: out) |
| GTA-16-128 | Vote kick and report | out | CAPABILITIES G28 (Online: out) |
| GTA-16-129 | Cayo Perico solo run | out | CAPABILITIES G28 (Online: out) |
| GTA-16-130 | Garment Factory and sabotage | out | CAPABILITIES G28 (Online: out) |
| GTA-16-131 | Money laundering fronts | out | CAPABILITIES G28 (Online: out) |
| GTA-16-132 | Career Progress | out | CAPABILITIES G28 (Online: out) |
| GTA-16-133 | Cross-play sessions | out | CAPABILITIES G28 (Online: out) |
| GTA-17-001 | Vehicle radio | later | CAPABILITIES G23 (radio later; needs licensed music and voices) |
| GTA-17-002 | Radio wheel and station switching | later | CAPABILITIES G23 |
| GTA-17-003 | West Coast Classics | later | CAPABILITIES G23 |
| GTA-17-004 | Radio Los Santos | later | CAPABILITIES G23 |
| GTA-17-005 | Non-Stop-Pop FM | later | CAPABILITIES G23 |
| GTA-17-006 | Los Santos Rock Radio | later | CAPABILITIES G23 |
| GTA-17-007 | Channel X | later | CAPABILITIES G23 |
| GTA-17-008 | Rebel Radio | later | CAPABILITIES G23 |
| GTA-17-009 | Blaine County Radio | later | CAPABILITIES G23 |
| GTA-17-010 | Blue Ark | later | CAPABILITIES G23 |
| GTA-17-011 | Space 103.2 | later | CAPABILITIES G23 |
| GTA-17-012 | The Lowdown 91.1 | later | CAPABILITIES G23 |
| GTA-17-013 | WorldWide FM | later | CAPABILITIES G23 |
| GTA-17-014 | FlyLo FM | later | CAPABILITIES G23 |
| GTA-17-015 | Soulwax FM | later | CAPABILITIES G23 |
| GTA-17-016 | East Los FM | later | CAPABILITIES G23 |
| GTA-17-017 | Vinewood Boulevard Radio | later | CAPABILITIES G23 |
| GTA-17-018 | Radio Mirror Park | later | CAPABILITIES G23 |
| GTA-17-019 | The Lab | later | CAPABILITIES G23 |
| GTA-17-020 | Self Radio | later | CAPABILITIES G23 |
| GTA-17-021 | Blonded Los Santos 97.8 | later | CAPABILITIES G23 |
| GTA-17-022 | Los Santos Underground Radio | later | CAPABILITIES G23 |
| GTA-17-023 | iFruit Radio | later | CAPABILITIES G23 |
| GTA-17-024 | Kult FM | later | CAPABILITIES G23 |
| GTA-17-025 | Still Slipping Los Santos | later | CAPABILITIES G23 |
| GTA-17-026 | MOTOMAMI Los Santos | later | CAPABILITIES G23 |
| GTA-17-027 | DJ chatter and idents | later | CAPABILITIES G23 |
| GTA-17-028 | News bulletins | later | CAPABILITIES G23; the news line is text only `src/sim/news.js:89` |
| GTA-17-029 | Commercials | later | CAPABILITIES G23 |
| GTA-17-030 | Dynamic mission score | later | CAPABILITIES G23 |
| GTA-17-031 | Wanted chase music | later | CAPABILITIES G23 |
| GTA-17-032 | Heist score | missing | no heists or score; searched heist, score in `src/`; none (radio is later G23) |
| GTA-17-033 | Nightclub DJ sets | later | CAPABILITIES G23; a club is after the sell check at `docs/ROADMAP.md:701` |
| GTA-17-034 | Music Locker sets | later | CAPABILITIES G23 |
| GTA-17-035 | Engine and exhaust audio | planned | M7-1 (engine pitch rises with speed; M7.T4) |
| GTA-17-036 | Sirens and horns | planned | M7-1 (police sirens; M7.T5); horns are not named in the plan |
| GTA-17-037 | Weapon audio | later | CAPABILITIES G11 / D9 (no weapons) |
| GTA-17-038 | Ambient soundscape | planned | M7-1 (street ambience by hour and district; M7.T3) |
| GTA-17-039 | Pedestrian speech | later | CAPABILITIES G23 (voices wait for the sell check; no voice code today `src/sim/dispatch.js:3`) |
| GTA-17-040 | Protagonist voices | later | CAPABILITIES G23; dialogue is text today `src/render/arcui.js:89` |
| GTA-17-041 | Phone ringtones | later | CAPABILITIES G23 (phone is later G17) |
| GTA-17-042 | TV and cinema audio | later | CAPABILITIES G33 |
| GTA-17-043 | Pause menu music | later | CAPABILITIES G23 |
| GTA-17-044 | Loading screen music | later | CAPABILITIES G23 |
| GTA-17-045 | Volume sliders | planned | M7-4 (volumes; M7.T10) |
| GTA-17-046 | Liberty City radio stations | later | CAPABILITIES G23 |
| GTA-17-047 | San Andreas radio stations | later | CAPABILITIES G23 |
| GTA-17-048 | Vice City radio stations | later | CAPABILITIES G23 |
| GTA-17-049 | Talk radio shows | later | CAPABILITIES G23 |
| GTA-18-001 | Manual save slots | planned | M7-7 (three slots named by seed and population; M7.T14) |
| GTA-18-002 | Autosave | built | every 30 s `src/main.js:1232`, on tab hide `src/main.js:487`; one slot |
| GTA-18-003 | Cloud saves | later | M9-6 / M9.T8 (Steam Cloud, after the sell check) |
| GTA-18-004 | Safehouse save point | planned | M11-4 / M11.T8 (an owned room is a save point) |
| GTA-18-005 | Brightness calibration | missing | searched brightness, calibration, gamma in `src/`; none; M7-4 has no brightness |
| GTA-18-006 | Safe zone | later | ROADMAP after the sell check (`docs/ROADMAP.md:712`, accessibility) |
| GTA-18-007 | Subtitles | partial | dispatch and arc lines are on-screen text `src/ui/dispatch.js:37`, `src/render/arcui.js:89`; always on, no toggle |
| GTA-18-008 | Subtitle language | later | ROADMAP after the sell check (`docs/ROADMAP.md:712`, localization) |
| GTA-18-009 | Game language | later | ROADMAP after the sell check (`docs/ROADMAP.md:712`, localization) |
| GTA-18-010 | Look sensitivity | planned | M7-4 (mouse speed; M7.T10) |
| GTA-18-011 | Aim sensitivity | later | CAPABILITIES G11 / D9 (no aiming before the sell check) |
| GTA-18-012 | Invert look | planned | M7-4 (mouse invert; M7.T10) |
| GTA-18-013 | Deadzone adjustment | missing | searched deadzone, stick, gamepad options in `src/`; M7-8 adds gamepad but names no deadzone setting |
| GTA-18-014 | Vibration | missing | searched vibration, rumble in `src/`; none; M7-8 does not name it |
| GTA-18-015 | Steering sensitivity | missing | searched steering, sensitivity in `src/`; none |
| GTA-18-016 | Toggle or hold aim | later | CAPABILITIES G11 / D9 |
| GTA-18-017 | Toggle or hold aim and crouch | skip | DUPLICATE of GTA-18-016 |
| GTA-18-018 | Auto-aim mode | later | CAPABILITIES G11 / D9 |
| GTA-18-019 | First or third person | later | CAPABILITIES G30 (first-person camera later) |
| GTA-18-020 | First-person vehicle options | later | CAPABILITIES G30 |
| GTA-18-021 | Head bobbing | later | CAPABILITIES G30 |
| GTA-18-022 | Control remapping | planned | M7-4 / M7.T11 (key bindings screen) |
| GTA-18-023 | Controller layouts | planned | M7-8 / M7.T15 (standard pad mapping, bindings screen) |
| GTA-18-024 | Graphics presets | planned | M7-4 (quality: shadow distance, resolution scale; M7.T10) |
| GTA-18-025 | Resolution and display mode | missing | searched resolution, fullscreen, display mode in `src/`; the canvas fills the window `src/main.js:260`, no setting |
| GTA-18-026 | Texture, shadow and water quality | planned | M7-4 (shadow distance, resolution scale; M7.T10); no texture or water setting named |
| GTA-18-027 | Anti-aliasing options | missing | searched antialias, MSAA, FXAA in `src/`; none |
| GTA-18-028 | Population density and variety | missing | searched density, population in `src/`; walker count is fixed by the sim |
| GTA-18-029 | Extended distance scaling | missing | searched distance, scaling in `src/`; streaming is fixed `src/render/chunks.js` |
| GTA-18-030 | Frame rate and V-Sync | missing | searched vsync, frame cap in `src/`; none |
| GTA-18-031 | Motion blur and depth of field | out | AGENTS.md law 6 (no post pass that is not visible in a screenshot); the old post stack was deleted |
| GTA-18-032 | Field of view | missing | searched fov, field of view in `src/`; camera FOV is fixed at 52 `src/main.js:82` |
| GTA-18-033 | Ray tracing modes | missing | searched ray tracing, raytrace in `src/` and docs/; not in the plan |
| GTA-18-034 | Haptics and adaptive triggers | missing | searched haptic, trigger in `src/`; none |
| GTA-18-035 | Rockstar Editor recording | missing | searched editor, clip, recording in `src/`; capture.js is the evidence tool only `src/render/capture.js` |
| GTA-18-036 | Editor timeline | missing | searched timeline, trim in `src/`; none (photo mode is later G26) |
| GTA-18-037 | Editor cameras | missing | searched editor camera in `src/`; none |
| GTA-18-038 | Editor depth of field and lens | missing | searched lens, focus, blur in `src/`; none |
| GTA-18-039 | Editor filters | missing | searched filter, grade in `src/`; only the fixed colour grade `src/render/atmosphere.js:173` |
| GTA-18-040 | Editor music and sound effects | missing | searched editor, music, effects in `src/`; none |
| GTA-18-041 | Editor text and titles | missing | searched title, credit in `src/`; none |
| GTA-18-042 | Editor export and upload | missing | searched export, render video in `src/`; none |
| GTA-18-043 | Director Mode | missing | searched director, actor, perform in `src/`; none |
| GTA-18-044 | Director Mode actor choice | missing | searched actor, model, cast in `src/`; none |
| GTA-18-045 | Director Mode weather and time | missing | searched director, weather control, time control in `src/`; T toggles the day `src/main.js:444`, no Director Mode |
| GTA-18-046 | Director Mode invincibility | later | D9 (no health or damage system) |
| GTA-18-047 | Director Mode cheats | missing | searched cheat, spawn in `src/`; none |
| GTA-18-048 | Snapmatic filters | later | CAPABILITIES G26 (photo mode later) |
| GTA-18-049 | Photo album upload | later | CAPABILITIES G26 |
| GTA-18-050 | Help text frequency | planned | M7-5 / M7.T12 (hints one per key); no frequency setting named |
| GTA-19-001 | Phone-number cheats | missing | searched cheat, code, dial in `src/`; none |
| GTA-19-002 | Invincibility cheat | missing | no cheat system and no health system; searched cheat, invincible in `src/`; none |
| GTA-19-003 | Max health and armour cheat | missing | searched health, armour, cheat in `src/`; none |
| GTA-19-004 | Weapon set cheat | missing | searched weapon, cheat in `src/`; none (weapons are D9) |
| GTA-19-005 | Explosive ammo cheat | missing | searched explosive, ammo, cheat in `src/`; none |
| GTA-19-006 | Flaming bullets cheat | missing | searched incendiary, bullet in `src/`; none |
| GTA-19-007 | Explosive melee cheat | missing | searched melee, punch in `src/`; none |
| GTA-19-008 | Fast run and swim cheats | missing | searched cheat, code in `src/`; shift run is a control `src/main.js:977`, no cheat codes |
| GTA-19-009 | Super jump cheat | missing | searched jump, cheat in `src/`; no player jump at all (G2) |
| GTA-19-010 | Skyfall cheat | missing | searched skyfall, cheat in `src/`; none |
| GTA-19-011 | Parachute cheat | missing | searched parachute, chute, cheat in `src/`; CAPABILITIES G31 (parachutes out), no cheats |
| GTA-19-012 | Vehicle spawn cheats | missing | searched spawn car, cheat in `src/`; no cheats |
| GTA-19-013 | Weather cheats | missing | searched weather cheat, rain code in `src/`; rain is one state `src/render/rain.js`, no cheat |
| GTA-19-014 | Moon gravity cheat | missing | searched gravity, cheat in `src/`; none |
| GTA-19-015 | Drunk mode cheat | missing | searched drunk, stagger in `src/`; none |
| GTA-19-016 | Wanted level cheats | missing | searched wanted cheat, heat code in `src/`; wanted.tier has a capture probe `src/main.js:589`, no cheat |
| GTA-19-017 | Button-combo cheats | missing | searched cheat, combo in `src/`; none |
| GTA-19-018 | SA cheat words | missing | searched cheat, code in `src/`; none |
| GTA-19-019 | SA vehicle and power cheats | missing | searched jetpack, hydra, naturaltalent in `src/`; none |
| GTA-19-020 | SA world cheats | missing | searched riot, flying cars, cheat in `src/`; none |
| GTA-19-021 | VC cheat codes | missing | searched cheat, panzer, aspirine in `src/`; none |
| GTA-19-022 | Cheats disabled in Online | out | CAPABILITIES G28 (Online: out) |
| GTA-19-023 | Script Hook V | later | CAPABILITIES S39 (asset editor, mods later) |
| GTA-19-024 | Trainer menus | later | CAPABILITIES S39 |
| GTA-19-025 | Vehicle mods | later | CAPABILITIES S39 |
| GTA-19-026 | Map mods | later | CAPABILITIES S39 |
| GTA-19-027 | Graphics mods | later | CAPABILITIES S39 |
| GTA-19-028 | OpenIV | later | CAPABILITIES S39 |
| GTA-19-029 | LSPDFR | later | CAPABILITIES S39 |
| GTA-19-030 | FiveM | out | CAPABILITIES G28 (Online multiplayer: out) |
| GTA-19-031 | SA-MP | out | CAPABILITIES G28 (Online multiplayer: out) |
| GTA-19-032 | MTA:SA | out | CAPABILITIES G28 (Online multiplayer: out) |
| GTA-19-033 | VC-MP | out | CAPABILITIES G28 (Online multiplayer: out) |
| GTA-19-034 | CLEO library | later | CAPABILITIES S39 (mods later) |
| GTA-19-035 | Online mod menus | out | CAPABILITIES G28 (Online: out) |
| GTA-19-036 | Slow motion cheat | missing | searched slowmo, cheat in `src/`; M6-3 Focus is a game tool, not a cheat |
| GTA-20-001 | Loading screens | missing | searched loading, splash, tips in `src/`; single page boot `src/boot.js`, only "booting…" in `index.html:34` |
| GTA-20-002 | Social Club | missing | searched social club, profile, account in `src/`; none |
| GTA-20-003 | In-game achievements and trophies | planned | M9-6 / M9.T7 (at least 10 Steam achievements from an event tape) |
| GTA-20-004 | Leaderboards | out | CAPABILITIES G28 (Online: out) |
| GTA-20-005 | Snapmatic sharing | later | CAPABILITIES G26 (photo mode later) |
| GTA-20-006 | Stats tracking | missing | searched stats, counter, lifetime in `src/`; none |
| GTA-20-007 | Special Edition content | missing | searched edition, special, bonus in `src/`; none |
| GTA-20-008 | Collector's Edition garage | missing | searched collector, garage, hotknife in `src/`; none |
| GTA-20-009 | Collector's Edition Director Mode cast | missing | searched director, cast, niko in `src/`; none |
| GTA-20-010 | Atomic Blimp | out | CAPABILITIES G5 (aircraft out) |
| GTA-20-011 | Returning player bonuses | missing | searched returning, bonus, dodo in `src/`; none |
| GTA-20-012 | Returning player stock car races | missing | searched stock car, race in `src/`; none |
| GTA-20-013 | Enhanced version features | missing | searched enhanced, version, first person in `src/`; none |
| GTA-20-014 | PC version features | missing | searched 4k, self radio, editor in `src/`; none |
| GTA-20-015 | Expanded & Enhanced version | missing | searched expanded, ray tracing in `src/`; none |
| GTA-20-016 | Online character transfer | out | CAPABILITIES G28 (Online: out) |
| GTA-20-017 | Criminal Enterprise Starter Pack | out | CAPABILITIES G28 (Online: out) |
| GTA-20-018 | Shark Card bundles | out | CAPABILITIES G28 (Online: out) |
| GTA-20-019 | Freemode invite system | out | CAPABILITIES G28 (Online: out) |
| GTA-20-020 | In-game brand products | partial | owned shop brands on the signs `src/content/signs.json`; no products or vending |
| GTA-20-021 | Vending machines | missing | searched vending, soda, drink in `src/`; none |
| GTA-20-022 | Mission Passed jingle | partial | COMPLETE banner and ₡ tally `src/sim/mission.js:86`, `src/main.js:1261`; no audio |
| GTA-20-023 | Wasted and Busted screens | partial | BUSTED banner `src/main.js:1258`; wasted waits on D9 |
| GTA-20-024 | Idle camera | missing | searched idle, orbit, attract in `src/`; none |
| GTA-20-025 | In-game internet death | out | CAPABILITIES G28 (Online: out) |
| GTA-20-026 | Platform cloud services | later | M9-6 / M9.T8 (Steam Cloud, after the sell check) |
| GTA-20-027 | Newswire events | out | CAPABILITIES G28 (Online: out) |
| GTA-20-028 | Game completion percentage | missing | searched completion, percentage, checklist in `src/`; none |
