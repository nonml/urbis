# Cyberpunk 2077: every feature against Urbis

Marks: built, partial, planned, later, out, missing, skip (the list marks the row wrong or a duplicate).

| ID | Feature | Mark | Evidence |
|---|---|---|---|
| CP-01-001 | Walking | built | `src/sim/player.js:5` WALK_SPEED 3.4, WASD in `src/main.js:972-975` |
| CP-01-002 | Sprinting | built | `src/sim/player.js:6` HURRY_SPEED 6.0, Shift in `src/main.js:977` (CAPABILITIES G1) |
| CP-01-003 | Movement stamina | skip | — |
| CP-01-004 | Crouching | missing | searched crouch, sneak, squat in src/; none |
| CP-01-005 | Sliding | missing | searched crouch, slide in src/; the slide hits are road dashes and point clamping, no player move |
| CP-01-006 | Jumping | later | CAPABILITIES G2 (jump, climb, vault) |
| CP-01-007 | Automatic mantling | later | CAPABILITIES G2 |
| CP-01-008 | Climbing ladders | later | CAPABILITIES G2 (climb); `docs/BACKLOG.md:77` verticality |
| CP-01-009 | Dodge | later | CAPABILITIES C19/D9 (combat waits for the sell check) |
| CP-01-010 | Dash | later | CAPABILITIES C19/D9 |
| CP-01-011 | Air dash | skip | — |
| CP-01-012 | Double jump | later | CAPABILITIES G2 (jump family) |
| CP-01-013 | Charged jump | later | CAPABILITIES G2 (jump family) |
| CP-01-014 | Quiet footsteps (Lynx Paws) | missing | searched footstep, sneak in src/; none (W27 depends on D9) |
| CP-01-016 | Falling damage | missing | no player health; searched fall, damage in `src/sim/player.js`; none |
| CP-01-017 | Swimming | planned | M10-5 (swims to the nearest bank and climbs out) |
| CP-01-018 | Diving underwater | missing | M10-5 is surface swimming only; searched dive, underwater in src/; none |
| CP-01-019 | Fast travel dataterms | later | CAPABILITIES G25 (taxi, fast travel) |
| CP-01-020 | Dataterm discovery | later | CAPABILITIES G25 |
| CP-01-021 | Fast travel from map | later | CAPABILITIES G25; M10-2 builds the map, not travel |
| CP-01-022 | Sitting down | missing | searched sit, bench, chair in src/sim; furniture geometry only, no interaction |
| CP-01-023 | Passing time | skip | — |
| CP-01-024 | Elevators | later | ROADMAP after sell check (vertical hacking; `docs/BACKLOG.md:89`) |
| CP-01-025 | Body doors | out | CAPABILITIES C7/G22 (no attribute sheet) |
| CP-01-026 | Technical doors | out | CAPABILITIES C7/G22 (no attribute sheet) |
| CP-01-027 | Vaulting cover | later | CAPABILITIES G2 (vault) |
| CP-01-028 | NCART metro ride | later | CAPABILITIES S22 (bus, tram, metro later) |
| CP-01-029 | Metro stations | later | CAPABILITIES S22 |
| CP-01-030 | Metro travel and time skip | later | CAPABILITIES S22 |
| CP-01-031 | Metro seats and views | later | CAPABILITIES S22 |
| CP-01-033 | Movement perks (Reflexes) | out | CAPABILITIES C7/G22 (no attribute or perk sheet) |
| CP-01-035 | Fence and railing hops | later | CAPABILITIES G2 |
| CP-01-036 | Water edge climbing | planned | M10-5 (climbs out at the nearest bank) |
| CP-01-038 | Rooftop routes | later | `docs/BACKLOG.md:77` verticality, ROADMAP after sell check |
| CP-01-039 | Sandevistan slow time | skip | — |
| CP-01-040 | Kerenzikov | skip | — |
| CP-01-041 | Charge + double jump stack | later | CAPABILITIES G2 (jump family) |
| CP-02-001 | Driving cars | built | `src/sim/vehicle.js:19-48` tickPlayerCar; F `src/main.js:443` |
| CP-02-002 | Driving motorcycles | later | CAPABILITIES G5 (motorbike later) |
| CP-02-003 | Handbrake drift | missing | searched handbrake, drift in src/; only prose about market drift |
| CP-02-004 | Reverse and braking | built | `src/sim/vehicle.js:23-29` (throttle < 0 brakes then reverses) |
| CP-02-005 | Vehicle horn | missing | searched horn in src/; the only hit is the name Thorn |
| CP-02-006 | Vehicle headlights | partial | headlight pools `src/render/traffic.js:251`, hero spot `:492`; no toggle, no night switch |
| CP-02-007 | Cockpit camera | missing | searched cockpit, first person in src/; none |
| CP-02-008 | Chase camera | built | `src/main.js:1043-1045` auto-follow yaw, `:1170-1184` third-person rig |
| CP-02-009 | Vehicle camera options | skip | — |
| CP-02-010 | Free look while driving | built | drag look `src/main.js:270-277` works while driving, re-centres at `:1043` |
| CP-02-011 | Exit moving vehicle | partial | `src/main.js:429-436` F works at any speed; no roll or bail |
| CP-02-012 | Quick vehicle exit perk | out | CAPABILITIES C7 (no perk sheet) |
| CP-02-013 | Calling owned vehicles | later | CAPABILITIES C12 (call your car later) |
| CP-02-014 | Vehicle list on phone | later | CAPABILITIES G17 (phone later) |
| CP-02-015 | Vehicle insurance | later | CAPABILITIES G8 |
| CP-02-016 | Vehicle stash | missing | searched trunk, stash in src/; C10's stash is a safehouse room (M11-4), not a car |
| CP-02-017 | Stealing an occupied car | planned | M10-1 (F pulls the driver out) |
| CP-02-018 | Breaking into parked cars | planned | M10-1 (walk to a parked car, press F, drive it) |
| CP-02-019 | Stolen cars despawn | missing | M10-6 keeps the taken car instead; searched despawn, stolen in src/; none |
| CP-02-020 | Aggressive hijack reactions | missing | M10-3 has the driver run off, not fight; searched fight, attack in `src/sim/vehicle.js`; none |
| CP-02-021 | Vehicle combat | later | CAPABILITIES C19/D9 |
| CP-02-022 | Sidearms in vehicles | out | CAPABILITIES C11 (gear) |
| CP-02-023 | Motorcycle melee | later | CAPABILITIES G5 (bikes later), C11 weapons |
| CP-02-024 | Fallback pistol | out | CAPABILITIES C11 (gear) |
| CP-02-025 | Mounted machine guns | out | CAPABILITIES C11 (gear) |
| CP-02-026 | Mounted rockets | out | CAPABILITIES C11 (gear) |
| CP-02-027 | Tire damage | missing | searched tire, shoot in src/sim/vehicle.js; none |
| CP-02-028 | Vehicle durability | skip | — |
| CP-02-029 | Vehicle destruction | planned | M10-3/M10-8 (wreck, smoke, tow; no explosion named) |
| CP-02-030 | Health items while driving | out | CAPABILITIES C11 (loot and consumables) |
| CP-02-031 | Passenger shooting | later | CAPABILITIES C19/D9 |
| CP-02-033 | Sandevistan driving perks | out | CAPABILITIES C11 (cyberware) |
| CP-02-034 | Vehicle collision perks | out | CAPABILITIES C7 (no perk sheet) |
| CP-02-035 | Off-road vs street tires | missing | searched offroad, dirt, surface in src/; one ground only |
| CP-02-036 | Speed-sensitive steering | partial | `src/sim/vehicle.js:33-34` turn scales with speed up to 4 m/s; traffic never steers |
| CP-02-037 | Torque curve handling | skip | — |
| CP-02-038 | Buying vehicles at AUTOFIXER | later | CAPABILITIES G8 |
| CP-02-039 | AUTOFIXER gas station terminals | later | CAPABILITIES G8 |
| CP-02-040 | AUTOFIXER map filter | later | CAPABILITIES G8 |
| CP-02-041 | Street Cred vehicle unlocks | later | CAPABILITIES G8 (M11-5 cred is hacks and gigs only) |
| CP-02-042 | Armed vehicle icon | later | CAPABILITIES G8 |
| CP-02-046 | Gang car chases | later | CAPABILITIES C9 (factions, gangs later) |
| CP-02-047 | Ambient faction chases | later | CAPABILITIES C9/G13 |
| CP-02-048 | Traffic lane switching | missing | M3.T29 keeps a gap and turns, never changes lane; searched lane change, swerve; none |
| CP-02-049 | Pedestrian avoidance | planned | M10-4 (walkers within 20 m run from a car on the pavement) |
| CP-02-050 | Traffic density by time | skip | — |
| CP-02-051 | Hit-and-run gore | missing | `src/sim/wanted.js` crimes are blackout, speeding only; searched run over, ped; none |
| CP-02-053 | Motorcycle leaning | later | CAPABILITIES G5 |
| CP-02-054 | Motorcycle wheelies and flips | skip | — |
| CP-02-055 | Knife throwing while riding | later | CAPABILITIES G5, C11 weapons |
| CP-02-056 | CrystalCoat paint | later | CAPABILITIES G8 |
| CP-02-057 | CrystalCoat and NCPD heat | later | CAPABILITIES G8 |
| CP-02-058 | TWINTONE color cloning | later | CAPABILITIES G8 |
| CP-02-059 | Spray can icon | later | CAPABILITIES G8 |
| CP-02-060 | Johnny as passenger | missing | no companion or passenger system; searched passenger in src/; none |
| CP-02-061 | New highway | later | CAPABILITIES S9 (highways later) |
| CP-02-063 | Quest reward vehicles | later | CAPABILITIES G8 |
| CP-02-064 | Hidden free supercar | later | CAPABILITIES G29 (collectibles later), G8 |
| CP-02-065 | Vehicle manufacturers | later | CAPABILITIES G5/G8 |
| CP-02-066 | Vehicle classes | later | CAPABILITIES G5 |
| CP-02-067 | 2.2 Autofixer additions | later | CAPABILITIES G8 |
| CP-02-068 | Vehicle radio | later | CAPABILITIES G23 (radio later) |
| CP-02-069 | Entering stolen traffic cars | skip | — |
| CP-02-070 | Summon range | later | CAPABILITIES C12/G8 |
| CP-02-071 | Delamain cab AI | missing | searched delamain, taxi in src/; none |
| CP-02-072 | Mandatory driving missions | built | `src/content/arc.json:47,154` enter_car steps; `src/sim/mission.js:211` |
| CP-02-073 | Delivery timer contracts | skip | — |
| CP-02-074 | Carhacker vehicle hacks | planned | M6-4/M6.T11 (a car brakes, swerves or floors it) |
| CP-02-075 | Trivial tow hack | skip | — |
| CP-03-001 | Pistols | out | CAPABILITIES C11 (gear out) |
| CP-03-002 | Revolvers | out | CAPABILITIES C11 (gear out) |
| CP-03-003 | Assault rifles | out | CAPABILITIES C11 (gear out) |
| CP-03-004 | Precision rifles | out | CAPABILITIES C11 (gear out) |
| CP-03-005 | Submachine guns | out | CAPABILITIES C11 (gear out) |
| CP-03-006 | Shotguns | out | CAPABILITIES C11 (gear out) |
| CP-03-007 | Light machine guns | skip | — |
| CP-03-091 | Heavy machine guns | skip | — |
| CP-03-008 | Sniper rifles | out | CAPABILITIES C11 (gear out) |
| CP-03-009 | Bladed melee | out | CAPABILITIES C11 (gear out) |
| CP-03-010 | Blunt melee | out | CAPABILITIES C11 (gear out) |
| CP-03-011 | Unarmed combat | later | CAPABILITIES C19/D9 (combat waits for the sell check) |
| CP-03-012 | Power weapons | out | CAPABILITIES C11 (gear out) |
| CP-03-013 | Ricochet | later | CAPABILITIES C19/D9 |
| CP-03-014 | Tech weapons | out | CAPABILITIES C11 (gear out) |
| CP-03-015 | Tech charge shot | later | CAPABILITIES C19/D9 |
| CP-03-016 | Smart weapons | out | CAPABILITIES C11 (gear out) |
| CP-03-017 | Smart target lock | later | CAPABILITIES C19/D9 |
| CP-03-018 | Bolt shots | later | CAPABILITIES C19/D9 |
| CP-03-019 | Aiming down sights | later | CAPABILITIES C19/D9 |
| CP-03-020 | Hip fire | later | CAPABILITIES C19/D9 |
| CP-03-021 | Recoil and spread | later | CAPABILITIES C19/D9 |
| CP-03-022 | Headshots | later | CAPABILITIES C19/D9 |
| CP-03-023 | Weak spots | later | CAPABILITIES C19/D9 (the built scanner `src/render/profiler.js` reads names, not weak spots) |
| CP-03-024 | Critical hits | later | CAPABILITIES C19/D9 |
| CP-03-025 | Armor penetration | later | CAPABILITIES C19/D9 |
| CP-03-026 | Reloading | later | CAPABILITIES C19/D9 |
| CP-03-027 | Ammo types | out | CAPABILITIES C11 (gear out) |
| CP-03-028 | Ammo pickups | out | CAPABILITIES C11 (loot out) |
| CP-03-029 | Weapon tiers | out | CAPABILITIES C11 (gear out) |
| CP-03-030 | Old rarity levels | out | CAPABILITIES C11 (gear out) |
| CP-03-031 | Iconic weapons | out | CAPABILITIES C11 (gear out) |
| CP-03-032 | Reworked Iconic effects | out | CAPABILITIES C11 (gear out) |
| CP-03-033 | Scope mods | out | CAPABILITIES C11 (crafting out) |
| CP-03-034 | Suppressor mods | out | CAPABILITIES C11 (crafting out) |
| CP-03-035 | Muzzle mods | out | CAPABILITIES C11 (crafting out) |
| CP-03-036 | Permanent mods | out | CAPABILITIES C11 (crafting out) |
| CP-03-037 | Mod slot removals | skip | — |
| CP-03-038 | Weapon mod crafting | skip | — |
| CP-03-039 | Two-slot crafted weapons | out | CAPABILITIES C11 (crafting out) |
| CP-03-040 | Mod drops | out | CAPABILITIES C11 (loot out) |
| CP-03-041 | Pax mod | out | CAPABILITIES C11 (gear out) |
| CP-03-042 | Weapon quick slots | out | CAPABILITIES C11 (gear out) |
| CP-03-043 | Holster and draw | later | CAPABILITIES C19/D9 |
| CP-03-044 | First-equip animation | out | CAPABILITIES C11 (gear out) |
| CP-03-045 | Gun bashing | later | CAPABILITIES C19/D9 |
| CP-03-046 | Melee blocking | later | CAPABILITIES C19/D9 |
| CP-03-047 | Melee parry | later | CAPABILITIES C19/D9 |
| CP-03-048 | Melee combos | later | CAPABILITIES C19/D9 |
| CP-03-049 | Heavy melee attacks | skip | — |
| CP-03-050 | Sprint attacks | later | CAPABILITIES C19/D9 |
| CP-03-051 | Melee finishers | later | CAPABILITIES C19/D9 |
| CP-03-052 | Frag grenades | out | CAPABILITIES C11 (gear out) |
| CP-03-053 | Flashbang grenades | out | CAPABILITIES C11 (gear out) |
| CP-03-054 | EMP grenades | out | CAPABILITIES C11 (gear out) |
| CP-03-055 | Incendiary grenades | out | CAPABILITIES C11 (gear out) |
| CP-03-056 | Smoke grenades | out | CAPABILITIES C11 (gear out) |
| CP-03-057 | Grenade charges | out | CAPABILITIES C11 (gear out) |
| CP-03-058 | Throwing knives | out | CAPABILITIES C11 (gear out) |
| CP-03-059 | Throwing axes | out | CAPABILITIES C11 (gear out) |
| CP-03-060 | Skippy | out | CAPABILITIES C11 (gear out) |
| CP-03-061 | Comrade's Hammer | out | CAPABILITIES C11 (gear out) |
| CP-03-062 | Widow Maker | out | CAPABILITIES C11 (gear out) |
| CP-03-063 | Overwatch | out | CAPABILITIES C11 (gear out) |
| CP-03-064 | Moron Labe | out | CAPABILITIES C11 (gear out) |
| CP-03-065 | Divided We Stand | out | CAPABILITIES C11 (gear out) |
| CP-03-066 | Psalm 11:6 | out | CAPABILITIES C11 (gear out) |
| CP-03-067 | Yinglong | out | CAPABILITIES C11 (gear out) |
| CP-03-068 | Ba Xing Chong | skip | — |
| CP-03-069 | Malorian Arms 3516 | out | CAPABILITIES C11 (gear out) |
| CP-03-070 | Archangel | out | CAPABILITIES C11 (gear out) |
| CP-03-071 | Amnesty | out | CAPABILITIES C11 (gear out) |
| CP-03-072 | Crash | out | CAPABILITIES C11 (gear out) |
| CP-03-073 | Lizzie | out | CAPABILITIES C11 (gear out) |
| CP-03-074 | Genjiroh | out | CAPABILITIES C11 (gear out) |
| CP-03-075 | Jinchu-Maru | out | CAPABILITIES C11 (gear out) |
| CP-03-076 | Satori | out | CAPABILITIES C11 (gear out) |
| CP-03-077 | Scalpel | out | CAPABILITIES C11 (gear out) |
| CP-03-078 | Byakko | out | CAPABILITIES C11 (gear out) |
| CP-03-079 | Thermal katana | skip | — |
| CP-03-080 | Fenrir | out | CAPABILITIES C11 (gear out) |
| CP-03-081 | Buzzsaw | out | CAPABILITIES C11 (gear out) |
| CP-03-082 | Hypercritical | out | CAPABILITIES C11 (gear out) |
| CP-03-083 | The Headsman | out | CAPABILITIES C11 (gear out) |
| CP-03-084 | La Chingona Dorada | out | CAPABILITIES C11 (gear out) |
| CP-03-085 | Sovereign | skip | — |
| CP-03-086 | Osprey | out | CAPABILITIES C11 (gear out) |
| CP-03-087 | Iconic stash wall | out | CAPABILITIES C11 (gear out) |
| CP-03-088 | Weapon vendor scaling | out | CAPABILITIES C11 (gear out) |
| CP-03-089 | Tier damage scaling | out | CAPABILITIES C11 (gear out) |
| CP-03-090 | Smart weapon rebalance | out | CAPABILITIES C11 (gear out) |
| CP-03-092 | Kongou | out | CAPABILITIES C11 (gear out) |
| CP-03-093 | Chaos | out | CAPABILITIES C11 (gear out) |
| CP-03-094 | Cottonmouth | out | CAPABILITIES C11 (gear out) |
| CP-03-095 | Dying Night | out | CAPABILITIES C11 (gear out) |
| CP-03-096 | Breakthrough | out | CAPABILITIES C11 (gear out) |
| CP-03-097 | Sir John Phallustiff | out | CAPABILITIES C11 (gear out) |
| CP-03-098 | Tsumetogi | out | CAPABILITIES C11 (gear out) |
| CP-03-099 | Gold-Plated Baseball Bat | out | CAPABILITIES C11 (gear out) |
| CP-03-100 | Plan B | out | CAPABILITIES C11 (gear out) |
| CP-03-101 | Guts | out | CAPABILITIES C11 (gear out) |
| CP-03-102 | Errata | out | CAPABILITIES C11 (gear out) |
| CP-03-103 | Throwing knife class | out | CAPABILITIES C11 (gear out) |
| CP-04-001 | Cyberware body slots | out | CAPABILITIES C11 (cyberware is the look, out) |
| CP-04-002 | Frontal Cortex slots | out | CAPABILITIES C11 |
| CP-04-003 | Operating System slot | out | CAPABILITIES C11 |
| CP-04-004 | Arms slot | out | CAPABILITIES C11 |
| CP-04-005 | Face slot | out | CAPABILITIES C11 |
| CP-04-006 | Second Face slot | out | CAPABILITIES C11 |
| CP-04-007 | Skeleton slots | out | CAPABILITIES C11 |
| CP-04-008 | Hands slots | out | CAPABILITIES C11 |
| CP-04-009 | Nervous System slots | out | CAPABILITIES C11 |
| CP-04-010 | Circulatory System slots | out | CAPABILITIES C11 |
| CP-04-011 | Integumentary System slots | out | CAPABILITIES C11 |
| CP-04-012 | Legs slot | out | CAPABILITIES C11 |
| CP-04-013 | Full Body Conversion | out | CAPABILITIES C11 |
| CP-04-014 | Cyberware Capacity | out | CAPABILITIES C11 |
| CP-04-020 | Chrome Compressor | out | CAPABILITIES C11 |
| CP-04-022 | Cyberware tiers | out | CAPABILITIES C11 |
| CP-04-023 | Cyberware upgrades | out | CAPABILITIES C11 |
| CP-04-024 | Attribute attunement | out | CAPABILITIES C11 |
| CP-04-025 | Ripperdoc bonus rolls | out | CAPABILITIES C11 |
| CP-04-026 | Driver Update perk | out | CAPABILITIES C11 |
| CP-04-027 | Chipware Connoisseur perk | out | CAPABILITIES C11 |
| CP-04-028 | Operating chair | out | CAPABILITIES C11 |
| CP-04-029 | Iconic cyberware airdrops | out | CAPABILITIES C11 |
| CP-04-030 | Berserk | out | CAPABILITIES C11 |
| CP-04-031 | BioDyne Berserk | out | CAPABILITIES C11 |
| CP-04-032 | Militech Berserk | out | CAPABILITIES C11 |
| CP-04-033 | Moore Tech Berserk | out | CAPABILITIES C11 |
| CP-04-034 | Zetatech Berserk | out | CAPABILITIES C11 |
| CP-04-035 | Sandevistan | planned | M6-3 Focus (hold Q, 0.3 times speed, spends battery; not an implant) |
| CP-04-036 | Dynalar Sandevistan | out | CAPABILITIES C11 |
| CP-04-037 | Militech Apogee | out | CAPABILITIES C11 |
| CP-04-038 | Militech Falcon | out | CAPABILITIES C11 |
| CP-04-039 | Cyberdecks | out | CAPABILITIES C11; M6 is street hacking, not a deck |
| CP-04-040 | Arasaka cyberdecks | out | CAPABILITIES C11 |
| CP-04-041 | Biotech Sigma decks | out | CAPABILITIES C11 |
| CP-04-042 | Militech Paraline | out | CAPABILITIES C11 |
| CP-04-043 | Militech Canto Mk.6 | out | CAPABILITIES C11 |
| CP-04-044 | NetWatch Netdriver | out | CAPABILITIES C11 |
| CP-04-045 | Raven Microcyber decks | out | CAPABILITIES C11 |
| CP-04-046 | Tetratronic Rippler decks | out | CAPABILITIES C11 |
| CP-04-047 | Axolotl | out | CAPABILITIES C11 |
| CP-04-048 | Bioconductor | out | CAPABILITIES C11 |
| CP-04-049 | COX-2 Cybersomatic Optimizer | out | CAPABILITIES C11 |
| CP-04-050 | Camillo RAM Manager | out | CAPABILITIES C11 |
| CP-04-051 | Ex-Disk | out | CAPABILITIES C11 |
| CP-04-052 | Kerenzikov Boost System | out | CAPABILITIES C11 |
| CP-04-053 | Mechatronic Core | out | CAPABILITIES C11 |
| CP-04-054 | Memory Boost | out | CAPABILITIES C11 |
| CP-04-055 | Newton Module | out | CAPABILITIES C11 |
| CP-04-056 | Quantum Tuner | out | CAPABILITIES C11 |
| CP-04-057 | RAM Reallocator | out | CAPABILITIES C11 |
| CP-04-058 | RAM Upgrade | out | CAPABILITIES C11 |
| CP-04-059 | Self-ICE | out | CAPABILITIES C11 |
| CP-04-060 | Kiroshi Optics | partial | scanner built `src/render/profiler.js`; no implant, no threat or loot marking |
| CP-04-061 | Behavioral Imprint Faceplate | out | CAPABILITIES C11 |
| CP-04-062 | Mantis Blades | out | CAPABILITIES C11 |
| CP-04-063 | Gorilla Arms | out | CAPABILITIES C11 |
| CP-04-064 | Monowire | out | CAPABILITIES C11 |
| CP-04-065 | Projectile Launch System | out | CAPABILITIES C11 |
| CP-04-066 | Bionic Joints | out | CAPABILITIES C11 |
| CP-04-067 | Dense Marrow | out | CAPABILITIES C11 |
| CP-04-068 | Epimorphic Skeleton | out | CAPABILITIES C11 |
| CP-04-069 | Feen-X | out | CAPABILITIES C11 |
| CP-04-070 | Microrotors | out | CAPABILITIES C11 |
| CP-04-071 | Smart Link | out | CAPABILITIES C11 |
| CP-04-072 | Ballistic Coprocessor | out | CAPABILITIES C11 |
| CP-04-073 | Handle Wrap | out | CAPABILITIES C11 |
| CP-04-074 | Microgenerator | out | CAPABILITIES C11 |
| CP-04-075 | Peripheral Inverse | out | CAPABILITIES C11 |
| CP-04-076 | Kerenzikov | planned | M6-3 Focus (a time slow, not a dodge implant) |
| CP-04-077 | Synaptic Accelerator | out | CAPABILITIES C11 |
| CP-04-078 | Reflex Tuner | out | CAPABILITIES C11 |
| CP-04-079 | Defenzikov | out | CAPABILITIES C11 |
| CP-04-080 | Adreno-Trigger | out | CAPABILITIES C11 |
| CP-04-081 | Blood Pump | out | CAPABILITIES C11 |
| CP-04-082 | Biomonitor | out | CAPABILITIES C11 |
| CP-04-083 | Second Heart | out | CAPABILITIES C11 |
| CP-04-084 | Subdermal Armor | out | CAPABILITIES C11 |
| CP-04-085 | Optical Camo | skip | — |
| CP-04-086 | Nano-Plating | out | CAPABILITIES C11 |
| CP-04-087 | Cogito Lattice | out | CAPABILITIES C11 |
| CP-04-088 | Shock-N-Awe | out | CAPABILITIES C11 |
| CP-04-093 | Leeroy Ligament System | out | CAPABILITIES C11 |
| CP-04-094 | Rara Avis | out | CAPABILITIES C11 |
| CP-04-095 | Universal Booster | out | CAPABILITIES C11 |
| CP-04-096 | Cellular Adapter | out | CAPABILITIES C11 |
| CP-04-097 | Cyberpsychosis (fiction) | missing | searched cyberpsycho, chrome, psychosis in src/; none |
| CP-04-098 | Capacity from Technical Ability | out | CAPABILITIES C11 |
| CP-04-099 | Implant capacity costs | out | CAPABILITIES C11 |
| CP-05-001 | RAM | out | CAPABILITIES C11 (cyberdeck is cyberware, out) |
| CP-05-002 | Max RAM | out | CAPABILITIES C11 |
| CP-05-003 | RAM regeneration | out | CAPABILITIES C11 |
| CP-05-004 | Overclock mode | out | CAPABILITIES C11 |
| CP-05-005 | Quickhack queue | out | CAPABILITIES C11 |
| CP-05-006 | Upload time | out | CAPABILITIES C11 |
| CP-05-007 | Quickhack duration | out | CAPABILITIES C11 |
| CP-05-008 | Trace progress | out | CAPABILITIES C11 |
| CP-05-009 | Untraceable quickhacks | out | CAPABILITIES C11 |
| CP-05-010 | Reduction of trace | out | CAPABILITIES C11 |
| CP-05-011 | Quickhack tiers | out | CAPABILITIES C11 |
| CP-05-012 | Quickhack crits | out | CAPABILITIES C11 |
| CP-05-013 | Combat quickhacks | out | CAPABILITIES C11 |
| CP-05-014 | Control quickhacks | out | CAPABILITIES C11 |
| CP-05-015 | Covert quickhacks | out | CAPABILITIES C11 |
| CP-05-016 | Ultimate quickhacks | out | CAPABILITIES C11 |
| CP-05-017 | Device quickhacks | skip | — |
| CP-05-018 | Vehicle quickhacks | planned | M6-4/M6.T11 (a car brakes, swerves or floors it) |
| CP-05-019 | Overheat | out | CAPABILITIES C11 |
| CP-05-020 | Short Circuit | out | CAPABILITIES C11 |
| CP-05-021 | Contagion | out | CAPABILITIES C11 |
| CP-05-022 | Synapse Burnout | out | CAPABILITIES C11 |
| CP-05-023 | Reboot Optics | out | CAPABILITIES C11 |
| CP-05-024 | Cyberware Malfunction | out | CAPABILITIES C11 |
| CP-05-025 | Cripple Movement | out | CAPABILITIES C11 |
| CP-05-026 | Weapon Glitch | out | CAPABILITIES C11 |
| CP-05-027 | Ping | out | CAPABILITIES C11 |
| CP-05-028 | Bait | out | CAPABILITIES C11 |
| CP-05-029 | Request Backup | out | CAPABILITIES C11 |
| CP-05-030 | Memory Wipe | out | CAPABILITIES C11 |
| CP-05-031 | Sonic Shock | out | CAPABILITIES C11 |
| CP-05-032 | Cyberpsychosis | out | CAPABILITIES C11 |
| CP-05-033 | Suicide | out | CAPABILITIES C11 |
| CP-05-034 | System Collapse | skip | — |
| CP-05-035 | Detonate Grenade | out | CAPABILITIES C11 |
| CP-05-036 | Blackwall Gateway | out | CAPABILITIES C11 |
| CP-05-037 | Distract Enemies | later | ROADMAP M6 hack table (Distract: later) |
| CP-05-038 | Initiate Overload | missing | no device-overload system; searched overload, device in src/; only the substation sparks |
| CP-05-039 | Friendly Mode | missing | no turrets, no enemies; searched turret, friendly in src/; none |
| CP-05-040 | Assist Mode | missing | no turrets; searched turret, assist in src/; none |
| CP-05-041 | Take Control | missing | no turrets or drones; searched remote, turret in src/; none |
| CP-05-042 | Remote Deactivation | later | ROADMAP M6 later rows (lifts, garage doors) |
| CP-05-043 | Quickhack vendors | out | CAPABILITIES C11 (gear shops out) |
| CP-05-044 | Quickhack loot | out | CAPABILITIES C11 (loot out) |
| CP-05-045 | Breach Protocol quickhack | out | CAPABILITIES C20 (netrunning in cyberspace out) |
| CP-05-046 | Breach minigame | out | CAPABILITIES C20 |
| CP-05-048 | Breach daemons | out | CAPABILITIES C20 |
| CP-05-049 | Access points | missing | M6.T5's control boxes are the nearest analogue, no eddies or components; searched access point, breach in src/; none |
| CP-05-050 | Breach on enemies removed | out | CAPABILITIES C20 |
| CP-05-051 | Netrunner enemies | missing | no enemies (D9); searched netrunner, enemy in src/; none |
| CP-05-052 | Self-ICE defense | skip | — |
| CP-05-053 | Hacking through cameras | planned | M6-4/M6.T13 (view and profile from the camera; not a quickhack upload) |
| CP-05-054 | Monowire quickhacks | out | CAPABILITIES C11 |
| CP-05-055 | Quickhack RAM cost scaling | out | CAPABILITIES C11 |
| CP-05-056 | Cyberdeck requirement | out | CAPABILITIES C11 |
| CP-05-057 | Trace completes | missing | no enemy netrunners or trace; searched trace in src/; none |
| CP-06-001 | Crouch stealth | later | CAPABILITIES W27 (stealth past guards depends on D9) |
| CP-06-002 | Detection meter | later | CAPABILITIES W27/D9 |
| CP-06-003 | Awareness icons | later | CAPABILITIES W27/D9 |
| CP-06-004 | Vision cones | later | CAPABILITIES W27/D9; no minimap before M10-2 |
| CP-06-005 | Footstep noise | later | CAPABILITIES W27/D9; searched footstep, noise in src/; none |
| CP-06-006 | Silenced shots | out | CAPABILITIES C11 (weapons and mods out) |
| CP-06-007 | Bullet impact investigation | later | CAPABILITIES W27/D9 |
| CP-06-008 | Stealth takedowns | later | CAPABILITIES W27/D9 |
| CP-06-009 | Non-lethal takedowns | later | CAPABILITIES W27/D9 |
| CP-06-010 | Body containers | later | CAPABILITIES W27/D9 |
| CP-06-014 | Security cameras | planned | M6-4/M6.T12 (cut one and the police are blind in that street) |
| CP-06-017 | Locked doors | missing | every door is open, E; searched lock, keycard in src/; none |
| CP-06-018 | Loot safes | out | CAPABILITIES C11 (loot out) |
| CP-06-020 | Non-lethal blunt weapons | out | CAPABILITIES C11 (weapons out) |
| CP-06-023 | Cyberpsycho capture | missing | no cyberpsychos; searched cyberpsycho in src/; none |
| CP-06-024 | Stealth XP | missing | no XP system; CAPABILITIES C7 is cred from gigs (M11-5) |
| CP-06-025 | Enemy search behavior | built | `src/sim/wanted.js:239-257` units search their side of the last known position |
| CP-06-026 | Combat escape | built | `src/sim/wanted.js:202-218` lose sight, `:265-270` tier decays |
| CP-06-027 | Stealth perks | out | CAPABILITIES C7 (no perk sheet) |
| CP-06-030 | System Reset | missing | removed in 2.0; no non-lethal ultimate in src/ |
| CP-06-031 | Hacking from cover | missing | M6-1 needs line of sight; searched cover in src/; none |
| CP-06-032 | Non-lethal job bonuses | missing | M11 gig kinds have no non-lethal objective; searched non-lethal in src/; none |
| CP-06-033 | Body discovery | later | CAPABILITIES W27/D9 |
| CP-07-001 | NCPD Wanted Level | partial | `src/sim/wanted.js:16` MAX_HEAT 3, HUD stars `src/main.js:1245`; no levels 4-5 |
| CP-07-002 | Unit escalation | partial | `src/sim/wanted.js:43-48` TIERS add cruisers, spikes, roadblock, helicopter; no MaxTac |
| CP-07-003 | NCPD patrol officers | missing | police are cruisers only; searched officer, patrol on foot in src/; none |
| CP-07-004 | NCPD Enforcers | missing | no armed officers; searched enforcer, shotgun in src/; none (D9) |
| CP-07-005 | NCPD drones | missing | searched drone, air unit in src/; only the helicopter |
| CP-07-006 | Police vehicles | built | `src/sim/wanted.js:96-113,239-257` cruisers chase; `src/sim/response.js:120` roadblock boxes |
| CP-07-007 | Roadblocks | skip | — |
| CP-07-008 | MaxTac | missing | searched maxtac, swat in src/; none |
| CP-07-009 | MaxTac AV insertion | missing | searched maxtac, drop in src/; none |
| CP-07-010 | MaxTac composition | missing | searched maxtac, netrunner in src/; none |
| CP-07-011 | On-foot chases | missing | pursuit units drive only; searched foot, sprint in `src/sim/wanted.js`; none |
| CP-07-012 | Vehicle chases | partial | `src/sim/wanted.js:239-257` chase and box in; officers never shoot (no combat, D9) |
| CP-07-013 | Crime scene responders | missing | no crime scenes; the blackout site draws units (`wanted.js:134-141`) but no scene officers |
| CP-07-014 | Shooting in public | later | CAPABILITIES C19/D9 (no guns yet) |
| CP-07-015 | Killing civilians | later | CAPABILITIES C19/D9 |
| CP-07-016 | Attacking police | later | CAPABILITIES C19/D9 |
| CP-07-017 | Running people over | missing | `src/sim/wanted.js` crimes are blackout, speeding, evading; searched run over in src/; none |
| CP-07-018 | Vehicle collisions | partial | roadblock ram handled `src/sim/response.js:231-233`; no heat added, no civilian cars |
| CP-07-019 | Explosions in public | out | CAPABILITIES C11 (grenades and explosives out) |
| CP-07-020 | Stealing in view | planned | M10-1 (a unit that sees the theft raises heat, cause "theft") |
| CP-07-021 | Citizen reporting | planned | M10-4 (a walker who saw a crime calls it in, cause "witness") |
| CP-07-022 | Losing the police | built | `src/sim/wanted.js:43-48` search times shed tiers, `:265-270` |
| CP-07-023 | Hiding from pursuit | built | `src/sim/patrol.js:41-46` sight needs the same street or 12 m; dark is cover (WANTED.md) |
| CP-07-024 | Outrunning in a vehicle | built | `src/sim/wanted.js:176-192` speeding/evading raises heat; tiers decay unseen |
| CP-07-025 | CrystalCoat disguise | later | CAPABILITIES G8 (CrystalCoat later) |
| CP-07-026 | NCPD radio chatter | partial | dispatch subtitles `src/sim/dispatch.js`, `src/ui/dispatch.js`; no audio, no vehicle radio |
| CP-07-027 | Quickhacking police | out | CAPABILITIES C11 (cyberdeck out) |
| CP-07-028 | Wanted respawn | built | `src/sim/wanted.js:143-150` busted clears heat; `src/main.js:1155-1157` resets the contract |
| CP-07-029 | Old police system | missing | removed in 2.0; no legacy system in src/ |
| CP-07-030 | BARGHEST law in Dogtown | missing | no Dogtown; searched barghest in src/; none |
| CP-07-031 | Dogtown wanted level | missing | no Dogtown; searched dogtown in src/; none |
| CP-07-033 | MaxTac cyberpsycho response | missing | no cyberpsychos or sightings; searched cyberpsycho in src/; none |
| CP-07-034 | Trauma Team response | missing | searched trauma, ambulance in src/; none |
| CP-07-035 | No arrest mechanic | built | `src/sim/wanted.js:287-293` busted, never jailed; G10 |
| CP-07-036 | Flashing wanted stars | partial | stars drawn `src/main.js:1245`; steady always, no flash-versus-search state |
| CP-08-001 | Level 1 to 60 | missing | no XP or level; progression is M11-5 cred only (C7); searched level, xp in src/; none |
| CP-08-002 | XP sources | planned | M11-5 (gigs and missions give cred, not XP) |
| CP-08-003 | Attribute points | out | CAPABILITIES C7/G22 (no attribute sheet) |
| CP-08-004 | Five attributes | out | CAPABILITIES C7/G22 |
| CP-08-005 | Attribute cap | out | CAPABILITIES C7/G22 |
| CP-08-006 | Attribute checks | out | CAPABILITIES C7/G22 |
| CP-08-007 | Body level checks | out | CAPABILITIES C7/G22 |
| CP-08-008 | Body effects | skip | — |
| CP-08-009 | Reflexes effects | out | CAPABILITIES C7/G22 |
| CP-08-010 | Technical Ability effects | out | CAPABILITIES C7/G22 |
| CP-08-011 | Intelligence effects | out | CAPABILITIES C7/G22 |
| CP-08-012 | Cool effects | out | CAPABILITIES C7/G22 |
| CP-08-013 | Perk trees | out | CAPABILITIES C7 (no perk sheet) |
| CP-08-014 | Perk refunds | out | CAPABILITIES C7 |
| CP-08-015 | Attribute reset | out | CAPABILITIES C7/G22 |
| CP-08-016 | Old perk trees | missing | removed in 2.0; no perk code in src/ |
| CP-08-017 | Old full perk reset | missing | removed in 2.0; no perk code in src/ |
| CP-08-018 | New skill system | out | CAPABILITIES C7 (progression is cred, not skills) |
| CP-08-019 | Skill levels | out | CAPABILITIES C7 |
| CP-08-020 | Old skill trees | missing | removed in 2.0; searched skill in src/; none |
| CP-08-021 | Cold Blood | missing | removed in 2.0; searched cold blood in src/; none |
| CP-08-022 | Body perks: health | out | CAPABILITIES C7 |
| CP-08-023 | Fury Road perk | out | CAPABILITIES C7 |
| CP-08-024 | Adrenaline Rush | out | CAPABILITIES C7 |
| CP-08-025 | Adrenaline perks | out | CAPABILITIES C7 |
| CP-08-026 | Quake | out | CAPABILITIES C7 |
| CP-08-027 | Superhero Landing | out | CAPABILITIES C7 |
| CP-08-028 | Savage Sling finisher | out | CAPABILITIES C7 |
| CP-08-029 | Obliterate | skip | — |
| CP-08-030 | Bullet Ballet | out | CAPABILITIES C7 |
| CP-08-031 | Overclock perk | out | CAPABILITIES C7, C11 |
| CP-08-032 | Bolt perk | out | CAPABILITIES C7, C11 |
| CP-08-033 | Carhacker perk | out | CAPABILITIES C7; the M6.T11 vehicle hack is a tool, not a perk |
| CP-08-034 | Cyberware perks | out | CAPABILITIES C7, C11 |
| CP-08-035 | Edgerunner perk | out | CAPABILITIES C7 |
| CP-08-036 | Renaissance Punk perk | out | CAPABILITIES C7 |
| CP-08-037 | Attribute Shards | out | CAPABILITIES C7/G22 |
| CP-08-038 | Carrying Capacity Shards | out | CAPABILITIES C11 (gear and loot out) |
| CP-08-039 | Cyberware Capacity Shards | out | CAPABILITIES C11 |
| CP-08-040 | Street Cred | planned | M11-5 (gigs and missions give cred) |
| CP-08-041 | Street Cred unlocks | planned | M11-5 (tiers unlock hacks and better-paid gigs) |
| CP-08-042 | Street Cred discounts | missing | M11-5 has no vendor discounts; searched discount in src/; none |
| CP-08-043 | Health | later | G10/C19, D9 (no health today; wasted depends on D9) |
| CP-08-044 | Health regen | later | G10/C19, D9 |
| CP-08-045 | Stamina | skip | — |
| CP-08-046 | Out-of-combat stamina | skip | — |
| CP-08-047 | Adrenaline | out | CAPABILITIES C7 |
| CP-08-048 | Status effects on V | later | C19/D9 (no damage or status system) |
| CP-08-050 | Level scaling NPCs | missing | no levels; searched level scaling, enemy in src/; none |
| CP-08-051 | Enemy threat tiers | missing | no scanned enemies; searched threat in src/; none |
| CP-08-052 | Level-up feedback | missing | no level-ups; cred HUD is M11-5, not this |
| CP-08-053 | Relic skill tree | out | CAPABILITIES C7 |
| CP-08-054 | Relic points | out | CAPABILITIES C7 |
| CP-08-055 | Relic scanning perks | out | CAPABILITIES C7 |
| CP-08-056 | Emergency Cloaking | out | CAPABILITIES C11 (cyberware out) |
| CP-08-057 | Jailbreak nodes | out | CAPABILITIES C11 (cyberware out) |
| CP-08-058 | Death and reload | later | G10/C19, D9 (busted restarts a contract, no death) |
| CP-08-059 | Lifepath bonuses | out | CAPABILITIES C18 (life paths out) |
| CP-09-001 | Nomad prologue | out | CAPABILITIES C18 (life paths out) |
| CP-09-002 | Streetkid prologue | out | CAPABILITIES C18 |
| CP-09-003 | Corpo prologue | out | CAPABILITIES C18 |
| CP-09-004 | The Rescue | missing | no Sandra Dorsett or Scavengers; searched scavenger, Dorsett in src/; none |
| CP-09-005 | The Pickup | missing | no Maelstrom or Royce; searched maelstrom, Royce in src/; none |
| CP-09-006 | The Information | missing | no Evelyn or braindance; searched evelyn, braindance in src/; none |
| CP-09-007 | The Heist | missing | no Konpeki Plaza; searched konpeki, heist in src/; none |
| CP-09-008 | Love Like Fire | missing | no Johnny Silverhand; searched johnny, silverhand in src/; none |
| CP-09-009 | Playing for Time | missing | no relic; searched relic, arasaka in src/; none |
| CP-09-010 | Automatic Love | missing | no Clouds or Evelyn; searched Clouds, evelyn in src/; none |
| CP-09-011 | The Space in Between | missing | no Fingers; searched fingers, evelyn in src/; none |
| CP-09-012 | Disasterpiece | missing | no Scavenger braindance; searched scavenger, braindance in src/; none |
| CP-09-013 | Double Life | missing | no Evelyn recording; searched evelyn, braindance in src/; none |
| CP-09-014 | M'ap Tann Pèlen | missing | no Voodoo Boys; searched voodoo, Placide in src/; none |
| CP-09-015 | I Walk the Line | missing | no Grand Imperial Mall; searched voodoo, mall in src/; none |
| CP-09-016 | Transmission | missing | no Brigitte or cyberspace; searched brigitte, cyberspace in src/; none |
| CP-09-017 | Ghost Town | missing | no Panam; searched panam, Raffen in src/; none |
| CP-09-018 | Lightning Breaks | missing | no Hellman or Kang Tao; searched hellman, Kang Tao in src/; none |
| CP-09-019 | Life During Wartime | missing | no Saul or Wraiths; searched saul, wraith in src/; none |
| CP-09-020 | Gimme Danger | missing | no Takemura; searched takemura, arasaka in src/; none |
| CP-09-021 | Play It Safe | missing | no parade job; searched parade, takemura in src/; none |
| CP-09-022 | Search and Destroy | missing | no hideout attack; searched takemura, arasaka in src/; none |
| CP-09-023 | The Hunt | missing | no River Ward quest; searched river ward, Randy; only driver/toward words |
| CP-09-024 | Tapeworm | missing | no Johnny conversations; searched johnny, relic in src/; none |
| CP-09-025 | Nocturne Op55N1 | missing | no Mikoshi; searched mikoshi, arasaka in src/; none |
| CP-09-026 | The Sun ending | later | CAPABILITIES C17 (several endings later; Urbis's arc endings are its own) |
| CP-09-027 | The Star ending | later | CAPABILITIES C17 |
| CP-09-028 | The Devil ending | later | CAPABILITIES C17 |
| CP-09-029 | Temperance ending | later | CAPABILITIES C17 |
| CP-09-030 | Path of Least Resistance | later | CAPABILITIES C17 |
| CP-09-031 | Don't Fear the Reaper | later | CAPABILITIES C17 |
| CP-09-032 | Johnny affinity | missing | no Johnny; searched johnny, affinity in src/; none |
| CP-09-033 | Heroes | missing | no Jackie funeral; searched jackie, funeral in src/; none |
| CP-09-034 | Judy's chain | missing | searched judy, Mox in src/; none |
| CP-09-035 | Panam's chain | missing | searched panam, Aldecaldos in src/; none |
| CP-09-036 | Kerry's chain | missing | searched kerry, Samurai in src/; none |
| CP-09-037 | River's chain | missing | searched River Ward; only driver/toward words |
| CP-09-038 | Chippin' In | missing | searched Rogue, silverhand in src/; none |
| CP-09-039 | Blistering Love | missing | searched Rogue, drive-in in src/; none |
| CP-09-040 | Epistrophy | missing | searched delamain, cab in src/; none |
| CP-09-041 | Don't Lose Your Mind | missing | searched delamain, core in src/; none |
| CP-09-042 | Machine Gun | out | CAPABILITIES C11 (Skippy is iconic gear, out) |
| CP-09-043 | The Prophet's Song | missing | searched monk, signal in src/; none |
| CP-09-044 | I Fought the Law | missing | searched Ward, Red Queen in src/; none |
| CP-09-045 | Dream On | missing | searched Peralez, politician in src/; none |
| CP-09-046 | Sinnerman | missing | searched Stephenson, crucifixion in src/; none |
| CP-09-047 | Sweet Dreams | missing | searched braindance, bathtub in src/; none |
| CP-09-049 | Space Oddity | missing | searched capsule, orbita in src/; none |
| CP-09-050 | Killing in the Name | missing | searched broadcast, samurai in src/; none |
| CP-09-051 | The Pickup choice | missing | no credchip choice; searched credchip, Royce in src/; none |
| CP-09-052 | Meredith or Gilchrist | missing | searched Meredith, Militech in src/; none |
| CP-09-053 | Evelyn's fate | missing | searched evelyn in src/; none |
| CP-09-054 | Clouds outcome | missing | searched Maiko, Clouds in src/; none |
| CP-09-055 | Voodoo Boys outcome | missing | searched Placide, Brigitte in src/; none |
| CP-09-056 | Takemura lives or dies | missing | searched takemura in src/; none |
| CP-09-057 | Saul's fate | missing | searched saul, Aldecaldo in src/; none |
| CP-09-058 | Randy's rescue | missing | searched Randy, Hunt in src/; none |
| CP-09-059 | Skippy's owner | out | CAPABILITIES C11 (iconic weapon out) |
| CP-09-060 | Fixer jobs | planned | M11-1 (gigs from the sim, each with client, ask, pay, deadline) |
| CP-09-061 | Dexter DeShawn | missing | searched DeShawn, fixer in src/; only the street.js job list |
| CP-09-062 | Regina Jones | missing | searched regina in src/; none |
| CP-09-063 | Wakako Okada | missing | searched wakako in src/; none |
| CP-09-064 | Dino Dinovic | missing | searched dino in src/; none |
| CP-09-065 | Padre | missing | searched padre in src/; none |
| CP-09-066 | Dakota Smith | missing | searched dakota in src/; none |
| CP-09-067 | Muamar "El Capitán" Reyes | missing | searched muamar, capitan in src/; none |
| CP-09-068 | Mr. Hands | skip | — |
| CP-09-069 | Gig ratings and pay | planned | M11-2 (pay and deadline by kind; no rating or approval) |
| CP-09-070 | Gig types | planned | M11-1 (six kinds built from sim state, different from CP's list) |
| CP-09-071 | Phantom Liberty start | missing | searched phantom, dogtown in src/; none |
| CP-09-072 | Dog Eat Dog | missing | searched songbird, dogtown in src/; none |
| CP-09-073 | Hole in the Sky | missing | searched sapphire, myers in src/; none |
| CP-09-074 | Spider and the Fly | missing | searched myers, songbird in src/; none |
| CP-09-075 | Lucretia My Reflection | missing | searched reed, myers in src/; none |
| CP-09-076 | The Damned | missing | searched reed, stadium in src/; none |
| CP-09-077 | Get It Together | missing | searched hands, heavy hearts in src/; none |
| CP-09-078 | You Know My Name | missing | searched cassel, matrix in src/; none |
| CP-09-079 | Black Steel in the Hour of Chaos | missing | searched hansen, dogtown in src/; none |
| CP-09-080 | Firestarter | missing | searched songbird, reed in src/; none |
| CP-09-081 | The Killing Moon | missing | searched songbird, spaceport in src/; none |
| CP-09-082 | Somewhat Damaged | missing | searched reed, neural in src/; none |
| CP-09-083 | The Tower ending | later | CAPABILITIES C17 (endings later; PL content is not planned) |
| CP-09-084 | Reed vs Songbird | missing | searched reed, songbird in src/; none |
| CP-09-085 | Alex's fate | missing | searched alex, dogtown; no such character |
| CP-09-086 | Balls to the Wall | missing | searched hostage, negotiation in src/; none |
| CP-09-087 | Things Done Changed | missing | searched soldier, cure in src/; none |
| CP-09-088 | Braindance playback | out | CAPABILITIES C14 (braindance investigations out) |
| CP-09-089 | BD editor scrub | out | CAPABILITIES C14 |
| CP-09-090 | BD layers | out | CAPABILITIES C14 |
| CP-09-091 | BD scanning | out | CAPABILITIES C14 |
| CP-09-092 | BD fast forward | out | CAPABILITIES C14 |
| CP-09-093 | BD quests | out | CAPABILITIES C14 |
| CP-09-094 | Endings montage | later | CAPABILITIES C17 |
| CP-09-095 | Post-ending messages | later | CAPABILITIES C17 |
| CP-09-096 | Down on the Street | missing | searched takemura, heist in src/; none |
| CP-09-097 | Point of no return | missing | no quest lock or warning; searched lock, warning in src/sim/arc.js; none |
| CP-09-098 | Endings from side jobs | later | CAPABILITIES C17 (M11 gigs exist, no ending unlock) |
| CP-10-001 | Conversation camera | missing | searched: "conversation camera", "over-the-shoulder", "cutscene" in src/ |
| CP-10-002 | Dialogue choices | built | `src/sim/arc.js:195` arcChoose → missionOnChoice; options rendered `src/render/arcui.js:100` |
| CP-10-003 | Blue check options | missing | searched: "lifepath", "attribute check", "blue option" in src/; no attributes exist (CAPABILITIES G22 out, C18 out) |
| CP-10-004 | Timed dialogue | missing | searched: "timed", "countdown" around dialogue in src/; a line just auto-closes (`src/sim/arc.js:161`) |
| CP-10-005 | Attribute dialogue checks | missing | searched: "attribute" in dialogue paths in src/ |
| CP-10-006 | Lifepath dialogue | out | CAPABILITIES C18 life paths out |
| CP-10-007 | Johnny interjections | missing | searched: "interject", "companion", "johnny" in src/ |
| CP-10-008 | Question options | missing | searched: "question", "ask" in `src/sim/arc.js`; choices only |
| CP-10-009 | Skip dialogue | partial | `src/render/arcui.js:103` "1 · continue" advances a line; no skip key, no voice to skip |
| CP-10-011 | Phone calls | later | CAPABILITIES G17 |
| CP-10-012 | Outgoing calls | later | CAPABILITIES G17 |
| CP-10-013 | Holocalls | missing | searched: "holocall", "video call", "portrait" in src/ |
| CP-10-014 | Text messages | later | CAPABILITIES G17 |
| CP-10-015 | Message replies | missing | searched: "message", "reply", "text" in src/ |
| CP-10-016 | Message attachments | missing | searched: "attachment", "shard" in src/ |
| CP-10-017 | Street talk prompts | planned | M11-8 |
| CP-10-018 | Johnny commentary | missing | searched: "commentary", "reacts" in a companion sense in src/ |
| CP-10-019 | Romance: Panam | out | CAPABILITIES C13 romance out |
| CP-10-020 | Romance: Judy | out | CAPABILITIES C13 romance out |
| CP-10-021 | Romance: River | out | CAPABILITIES C13 romance out |
| CP-10-022 | Romance: Kerry | out | CAPABILITIES C13 romance out |
| CP-10-023 | Flirt options | out | CAPABILITIES C13 romance out |
| CP-10-024 | Romance scenes | out | CAPABILITIES C13 romance out |
| CP-10-025 | Partner hangouts | out | CAPABILITIES C13 romance out |
| CP-10-026 | Breakup lines | out | CAPABILITIES C13 romance out |
| CP-10-027 | Fixer briefings | partial | `src/sim/arc.js:60` plays a mission brief; fixer calls/texts and gig briefings are M11-1 |
| CP-10-028 | Subtitled ambient talk | missing | searched: "ambient talk", "crowd chatter", "subtitle" in src/; only dispatch subtitles exist (`src/ui/dispatch.js`) |
| CP-10-029 | Choice memory | built | `src/sim/arc.js:64` holds() and `:70` linesFor() filter later lines on flags; `src/render/arcui.js:116` lists choices |
| CP-10-030 | Joytoy services | missing | searched: "joytoy" in src/ and docs/ |
| CP-10-031 | Shorthand romance texts | out | CAPABILITIES C13 romance out |
| CP-11-001 | Eddies | partial | `src/sim/mission.js:81` pays ₡ on mission complete, shown `src/main.js:1254`; no gigs, loot or selling yet (CAPABILITIES G18 → M11) |
| CP-11-002 | Gig payments | partial | `src/sim/arc.js:129` records each mission's payout; fixer gigs and their bonuses are M11-2 |
| CP-11-003 | Weapon vendors | out | CAPABILITIES C11 gear/loot/crafting out |
| CP-11-004 | Wilson's shop | out | CAPABILITIES C11 gear/loot/crafting out |
| CP-11-005 | Clothing vendors | later | CAPABILITIES G20 shops later |
| CP-11-006 | Clothing is cosmetic | later | CAPABILITIES G20 shops later; no clothing system or stats today |
| CP-11-008 | Ripperdocs | out | CAPABILITIES C11 cyberware out; C20 netrunning out |
| CP-11-009 | Viktor Vektor | out | CAPABILITIES C11 cyberware out |
| CP-11-011 | Netrunner vendors | missing | searched: "netrunner vendor", "quickhack shop", "ripperdoc" in src/; hacks come from cred tiers (W17 → M11-5), no vendors |
| CP-11-012 | Drop points | out | CAPABILITIES C11 loot out |
| CP-11-013 | Food vendors | partial | noodle bar interior has a keeper/diner set (`src/render/interiorsets.js:180`); no ordering or payment; shops are later (G20) |
| CP-11-014 | Vending machines | missing | searched: "vending machine" in src/ |
| CP-11-015 | Food and drink effects | out | CAPABILITIES C11 loot/gear out |
| CP-11-016 | Black market vendor | out | CAPABILITIES C11 gear out |
| CP-11-017 | Vendor stock tiers | missing | searched: "vendor stock", "stock tier" in src/ |
| CP-11-018 | Shop reset | missing | searched: "shop reset", "restock" in src/ |
| CP-11-019 | Selling loot | out | CAPABILITIES C11 loot out |
| CP-11-020 | Dismantling | out | CAPABILITIES C11 crafting/loot out |
| CP-11-021 | Crafting components | out | CAPABILITIES C11 crafting out |
| CP-11-022 | Single component type | out | CAPABILITIES C11 crafting out |
| CP-11-023 | Crafting menu | out | CAPABILITIES C11 crafting out |
| CP-11-024 | Weapon crafting specs | out | CAPABILITIES C11 crafting out |
| CP-11-025 | Iconic upgrading | out | CAPABILITIES C11 gear out |
| CP-11-026 | Mod crafting | skip | input row says WRONG |
| CP-11-027 | Quickhack crafting specs | missing | searched: "quickhack spec", "crafting spec" in src/; no crafting (C11 out) |
| CP-11-028 | Loot containers | out | CAPABILITIES C11 loot out |
| CP-11-029 | Loot tiers | out | CAPABILITIES C11 loot out |
| CP-11-031 | Loot scaling | out | CAPABILITIES C11 loot out |
| CP-11-032 | Reduced clutter loot | out | CAPABILITIES C11 loot out |
| CP-11-034 | Shard selling | missing | searched: "shard", "sell" in src/ |
| CP-11-035 | Apartment purchases | planned | M11-4 (CAPABILITIES C10) buys a grown building as a safehouse |
| CP-11-036 | Apartment prices | planned | M11-4 price from stage and district wealth (`docs/ECONOMY.md`) |
| CP-11-037 | Apartment buffs | missing | searched: "apartment buff", "passive buff" in src/ |
| CP-11-038 | Stash | planned | M11-4 (CAPABILITIES C10 lists apartment, stash) |
| CP-11-039 | Ammo buying | out | CAPABILITIES C11 gear out |
| CP-11-040 | Ripperdoc stock themes | out | CAPABILITIES C11 cyberware out |
| CP-11-041 | Iconic vendor stock | out | CAPABILITIES C11 gear out |
| CP-11-042 | Treasure hunts | later | CAPABILITIES G29 collectibles later |
| CP-11-043 | Eddie counter | built | `src/main.js:1254` shows `₡${mission.balance}` on the HUD |
| CP-11-044 | Free fast travel | later | CAPABILITIES G25 taxi/fast travel later |
| CP-11-045 | Crafting ammo | out | CAPABILITIES C11 crafting/gear out |
| CP-11-046 | Loot rarity names | skip | input row says DUPLICATE of CP-11-029 |
| CP-12-001 | Watson | missing | searched: "Watson" in src/; generated districts only (`src/sim/economy.js:9`) |
| CP-12-002 | Westbrook | missing | searched: "Westbrook" in src/ |
| CP-12-003 | City Center | missing | searched: "City Center", "Corpo Plaza" in src/ |
| CP-12-004 | Heywood | missing | searched: "Heywood" in src/ |
| CP-12-005 | Santo Domingo | missing | searched: "Santo Domingo", "Arroyo" in src/ |
| CP-12-006 | Pacifica | missing | searched: "Pacifica" in src/ |
| CP-12-007 | Badlands | missing | searched: "Badlands", "nomad camp" in src/; outskirts are farmland and mountains (`src/render/outskirts.js`) |
| CP-12-008 | Rocky Ridge | missing | searched: "Rocky Ridge" in src/ |
| CP-12-009 | Sierra Sonora | missing | searched: "Sierra Sonora", "solar array" in src/ |
| CP-12-010 | Dogtown | missing | searched: "Dogtown" in src/ |
| CP-12-011 | Dogtown gate | missing | searched: "Dogtown", "checkpoint" in src/ |
| CP-12-012 | Black Sapphire | missing | searched: "Black Sapphire" in src/ |
| CP-12-013 | EBM Petrochem Stadium | missing | searched: "stadium", "Petrochem" in src/ |
| CP-12-014 | Golden Pacific | missing | searched: "Golden Pacific" in src/ |
| CP-12-015 | Longshore Stacks | missing | searched: "Longshore" in src/ |
| CP-12-016 | Luxor Heights | missing | searched: "Luxor" in src/ |
| CP-12-017 | Terra Cognita | missing | searched: "Terra Cognita" in src/ |
| CP-12-018 | Afterlife | missing | searched: "Afterlife" in src/; the arc has a Tavern on Main (`src/content/arc.json`) |
| CP-12-019 | Lizzie's Bar | missing | searched: "Lizzie" in src/ |
| CP-12-020 | El Coyote Cojo | missing | searched: "Coyote" in src/ |
| CP-12-021 | Totentanz | missing | searched: "Totentanz" in src/ |
| CP-12-022 | Clouds | missing | searched: "Clouds" in src/ |
| CP-12-023 | Grand Imperial Mall | missing | searched: "Grand Imperial", "mall" in src/ |
| CP-12-024 | Megabuilding H10 | missing | searched: "Megabuilding", "H10" in src/ |
| CP-12-025 | Megabuilding H8 | missing | searched: "Megabuilding", "H8" in src/ |
| CP-12-026 | Cherry Blossom Market | missing | searched: "Cherry Blossom" in src/ |
| CP-12-027 | Jig-Jig Street | missing | searched: "Jig-Jig" in src/ |
| CP-12-028 | Columbarium | missing | searched: "Columbarium" in src/ |
| CP-12-029 | Apartments | planned | M11-4, CAPABILITIES C10 safehouse |
| CP-12-030 | Apartment interiors | planned | M11-4, CAPABILITIES C10; a room behind each grown lot's door is built (`INTERIORS.md`) but no owned apartment layout |
| CP-12-031 | Day and night cycle | built | `src/sim/clock.js:8` `DAY_SECS = 720`; `src/sim/clock.js:17` nightOf(hour) |
| CP-12-032 | Night lighting | built | `src/render/lamps.js:194` lamps take their lit colour by night, `:212` daylight dims heads and glows |
| CP-12-033 | Time-based events | missing | searched: "night only", "at night", "time-based" in src/; the clock drives lighting and commutes only |
| CP-12-034 | Weather system | later | CAPABILITIES S36 / VGA-051; one rain state today (`src/render/rain.js`) |
| CP-12-035 | Sandstorms | missing | searched: "sandstorm", "dust storm" in src/ |
| CP-12-036 | Wet streets | built | `src/render/streaks.js:1` wet-road reflection streaks; mirror puddles `src/render/setdress.js:144` |
| CP-12-037 | Traffic system | partial | `src/sim/street.js:266` tickStreet loops cars along lanes; routed trips with signals are M3-6 |
| CP-12-038 | AV traffic | out | CAPABILITIES G5 aircraft out (a player in the air breaks street scale) |
| CP-12-039 | Holo ads | out | AGENTS.md visual target: no neon, no holograms; VGA-083 stripped it |
| CP-12-040 | N54 News | partial | `src/render/news.js:1` a news line top right; not broadcasts on screens |
| CP-12-041 | Gang shootouts | later | CAPABILITIES C9 factions/gangs later; combat none before the sell check (D9) |
| CP-12-042 | Trauma Team landings | out | CAPABILITIES G5 aircraft out; no medics planned |
| CP-12-043 | Street preachers | later | CAPABILITIES G13 ambient events later |
| CP-12-044 | Sightseeing binoculars | missing | searched: "binocular", "viewpoint" in src/ |
| CP-12-045 | City secrets | later | CAPABILITIES G29 collectibles/hidden content later |
| CP-12-046 | Map districts | planned | M4-1 districts as areas; M10-2 map screen names them; today two halves (`src/sim/economy.js:9`) |
| CP-12-047 | Weather and quests | later | CAPABILITIES S36 / VGA-051 weather later |
| CP-12-048 | Badlands camps | missing | searched: "nomad camp", "gas station", "motel" in src/ |
| CP-12-049 | Waterside locations | planned | M4-2 river with bridges; no water today |
| CP-12-050 | NCART network | skip | input row says DUPLICATE of CP-01-028 |
| CP-12-051 | Konpeki Plaza | missing | searched: "Konpeki" in src/ |
| CP-13-001 | Crowd density | partial | `src/sim/commute.js:36` shareOut(hour) thins the walkers by hour; not by area |
| CP-13-002 | Crowd panic | planned | M10-4 walkers run from a car and report crimes; gunfire/explosions wait on D9 |
| CP-13-004 | Phone recording | missing | searched: "phone", "recording", "film" in src/ |
| CP-13-005 | Weapon reactions | later | D9 combat is after the sell check; no weapons exist |
| CP-13-006 | Bumping reactions | missing | searched: "bump", "shove" in src/; walkers have no collision |
| CP-13-007 | Civilian fragility | later | D9 combat after the sell check; no health or damage |
| CP-13-008 | Street vendors | partial | `src/render/interiorsets.js:180` a keeper behind the noodle-bar counter; no call-out or sale; G20 later |
| CP-13-009 | Functional kiosk vendors | later | CAPABILITIES G20 shops later |
| CP-13-010 | Bar sitting | missing | searched: "sit", "bar stool", "bench" in src/; no sitting anywhere (CP-01-022) |
| CP-13-011 | Buskers and performers | later | CAPABILITIES G13 ambient events later (names a busker) |
| CP-13-012 | Joytoys | missing | searched: "joytoy" in src/ and docs/ |
| CP-13-013 | Homeless and addicts | missing | searched: "homeless", "tent", "trash fire" in src/ |
| CP-13-014 | Maelstrom | later | CAPABILITIES C9 factions/gangs later |
| CP-13-015 | Valentinos | later | CAPABILITIES C9 factions/gangs later |
| CP-13-016 | Tyger Claws | later | CAPABILITIES C9 factions/gangs later |
| CP-13-017 | 6th Street | later | CAPABILITIES C9 factions/gangs later |
| CP-13-018 | Animals | later | CAPABILITIES C9 factions/gangs later |
| CP-13-019 | Voodoo Boys | later | CAPABILITIES C9 factions/gangs later |
| CP-13-020 | Scavengers | later | CAPABILITIES C9 factions/gangs later |
| CP-13-021 | The Mox | later | CAPABILITIES C9 factions/gangs later |
| CP-13-022 | Aldecaldos | later | CAPABILITIES C9 factions/gangs later |
| CP-13-023 | Raffen Shiv | later | CAPABILITIES C9 factions/gangs later |
| CP-13-024 | BARGHEST | later | CAPABILITIES C9 factions/gangs later |
| CP-13-025 | Corporate security | missing | searched: "corporate security", "Arasaka", "Militech" in src/ |
| CP-13-026 | Trauma Team | planned | M12-5 adds ambulances; corporate AVs are out (CAPABILITIES G5) |
| CP-13-027 | NetWatch | missing | searched: "NetWatch" in src/ |
| CP-13-028 | Scav hideout raids | later | D9 combat after the sell check; M11's gig kinds include no raid |
| CP-13-029 | Gang ambushes | later | CAPABILITIES C9 factions/gangs later |
| CP-13-030 | Cats | later | CAPABILITIES G32 animals later |
| CP-13-031 | Iguana pet | missing | searched: "iguana", "pet" in src/ |
| CP-13-032 | NPC routines | partial | `src/sim/commute.js:14` AM/PM rush windows move walkers between home and job; vendors never open or close |
| CP-13-034 | NPC vehicle aggression | missing | searched: "honk", "ram", "road rage" in src/ |
| CP-13-035 | Enemies join fights | later | D9 combat after the sell check |
| CP-13-036 | Police escort scenes | later | CAPABILITIES G13 ambient events later (names an arrest) |
| CP-14-001 | Character creator | later | CAPABILITIES G21 character customisation later; no creator exists |
| CP-14-002 | Body type | later | CAPABILITIES G21 |
| CP-14-003 | Voice choice | later | CAPABILITIES G21; no audio at all yet (`ARC.md`, M7) |
| CP-14-004 | Genitals choice | later | CAPABILITIES G21 |
| CP-14-005 | Skin tone | later | CAPABILITIES G21; walker skin tones are generated (`src/sim/street.js:47`), not chosen |
| CP-14-006 | Hairstyles and colours | later | CAPABILITIES G21 |
| CP-14-007 | Eye options | later | CAPABILITIES G21 |
| CP-14-008 | Eye colours expanded | later | CAPABILITIES G21 |
| CP-14-009 | Facial feature sliders | later | CAPABILITIES G21 |
| CP-14-010 | Eyebrow shapes | later | CAPABILITIES G21 |
| CP-14-011 | Teeth | later | CAPABILITIES G21 |
| CP-14-012 | Lip makeup | later | CAPABILITIES G21 |
| CP-14-013 | Eye makeup | later | CAPABILITIES G21 |
| CP-14-014 | Cheek makeup | later | CAPABILITIES G21 |
| CP-14-015 | Nail colours | later | CAPABILITIES G21 |
| CP-14-016 | Face scars | later | CAPABILITIES G21 |
| CP-14-017 | Face tattoos | later | CAPABILITIES G21 |
| CP-14-018 | Body tattoos | later | CAPABILITIES G21 |
| CP-14-019 | Tattoos and piercings | later | CAPABILITIES G21 |
| CP-14-020 | Cosmetic face cyberware | out | CAPABILITIES C11 cyberware is the look |
| CP-14-021 | Chest and body sliders | later | CAPABILITIES G21 |
| CP-14-022 | Randomiser | later | CAPABILITIES G21; the player avatar is fixed code (`src/render/player.js:125`) |
| CP-14-023 | Plain-to-Punk slider | later | CAPABILITIES G21 |
| CP-14-024 | Presets | later | CAPABILITIES G21 |
| CP-14-025 | Lifepath choice | out | CAPABILITIES C18 life paths out |
| CP-14-026 | Attribute allocation | out | CAPABILITIES G22 body stats out; no attribute sheet (C7 uses cred) |
| CP-14-027 | Appearance is fixed | later | CAPABILITIES G21; there is no appearance to change yet |
| CP-14-028 | Ripperdoc tattoos | out | CAPABILITIES C11 cyberware out |
| CP-14-029 | Wardrobe | later | CAPABILITIES G21 character customisation later |
| CP-14-030 | Transmog | later | CAPABILITIES G21 |
| CP-14-031 | Wardrobe slots | later | CAPABILITIES G21 |
| CP-14-032 | Wardrobe access | later | CAPABILITIES G21 |
| CP-14-033 | Clothing collection | later | CAPABILITIES G20 shops later; no gear or loot (C11 out) |
| CP-14-034 | Cyberware appearance | out | CAPABILITIES C11 cyberware is the look |
| CP-14-035 | Edgerunners gear | missing | searched: "edgerunners" in src/ and docs/ |
| CP-14-036 | Phantom Liberty clothing | missing | searched: "Phantom Liberty" in src/; PL content is not planned |
| CP-14-037 | Outfit colour variety | later | CAPABILITIES G20 clothing shops later |
| CP-14-038 | Mirror | missing | searched: "mirror" in src/; only puddle cube mirrors (`src/render/setdress.js:144`) |
| CP-14-039 | Phantom Liberty creator items | missing | searched: "Phantom Liberty" in src/ |
| CP-14-040 | Starting outfits | later | CAPABILITIES G21 character customisation later |
| CP-15-001 | Health bar | later | D9 combat after the sell check; no health exists (CAPABILITIES G10: busted only) |
| CP-15-002 | Stamina bar | out | CAPABILITIES G1: a stamina limit is out, nothing to decide |
| CP-15-003 | RAM meter | planned | M6-3 battery meter spends per hack and refills; no RAM pool (no cyberdeck, C11 out) |
| CP-15-004 | Adrenaline bar | later | D9 combat after the sell check |
| CP-15-005 | Cyberware status icons | out | CAPABILITIES C11 cyberware out |
| CP-15-006 | Minimap | planned | M10-2 |
| CP-15-007 | Dynamic minimap zoom | missing | searched: "zoom" in the M10-2 map plan; minimap zooms not specified |
| CP-15-008 | Quest tracker | built | `src/render/arcui.js:75` objectiveHtml shows the step, `:83` the metres to its place |
| CP-15-009 | Route line | partial | `src/render/arc.js:15` an amber column marks the place; a route line along roads is M10-2 |
| CP-15-010 | Damage indicators | later | D9 combat after the sell check |
| CP-15-011 | Hit markers and damage numbers | later | D9 combat after the sell check |
| CP-15-012 | Enemy health bars | later | D9 combat after the sell check |
| CP-15-013 | Boss health bars | later | D9 combat after the sell check |
| CP-15-014 | Threat indicators | later | D9 combat after the sell check |
| CP-15-015 | Dynamic crosshair | later | D9 combat after the sell check; no aiming or weapons |
| CP-15-016 | Grenade indicator | later | D9 combat after the sell check |
| CP-15-017 | Obstacle marker | missing | searched: "off-screen", "obstacle marker" in src/; the arc marker is a world column |
| CP-15-018 | XP and loot notifications | missing | searched: "xp", "loot" in src/; no XP or loot (G22 out, C11 out) |
| CP-15-019 | Scanner mode | partial | `src/main.js:988` a sticky profiler lock by facing cone within 14 m; no scan key or mode, no mark-threats |
| CP-15-020 | Scanner info panel | partial | `src/render/profiler.js:45` name, age, home and job; no level, health, weaknesses or loot |
| CP-15-021 | Quickhack menu | planned | M6-3 hold-to-open menu of a thing's hacks |
| CP-15-022 | Phone | later | CAPABILITIES G17 phone later |
| CP-15-023 | Phone tabs | later | CAPABILITIES G17 phone later |
| CP-15-024 | World map | planned | M10-2 |
| CP-15-025 | Map filters | missing | searched: "map filter" in src/; the M10-2 map has no filter row |
| CP-15-026 | Custom waypoint | planned | M10-2 |
| CP-15-027 | Map legend | missing | searched: "legend" in src/ |
| CP-15-028 | Journal | built | `src/render/arcui.js:110` journalHtml, opened with J (`src/main.js:450`) |
| CP-15-029 | Journal tabs and distances | partial | `src/render/arcui.js:110` one list of in-hand/done/choices/people; no tabs, distance only on the objective line |
| CP-15-030 | Untrack job | missing | searched: "untrack", "track" in src/; the arc always tracks its one step |
| CP-15-031 | Shards menu | missing | searched: "shard" in src/ |
| CP-15-032 | Tarot menu | missing | searched: "tarot" in src/ |
| CP-15-033 | Gallery | missing | searched: "gallery" in src/ |
| CP-15-034 | Database | missing | searched: "database", "codex" in src/ |
| CP-15-035 | Driving Manual | missing | searched: "driving manual", "tutorial" in src/ |
| CP-15-036 | Inventory | out | CAPABILITIES C11 gear/loot out |
| CP-15-037 | Inventory filters | out | CAPABILITIES C11 gear/loot out |
| CP-15-038 | Item tooltips | out | CAPABILITIES C11 gear/loot out |
| CP-15-039 | Item comparison | out | CAPABILITIES C11 gear/loot out |
| CP-15-040 | Item preview | out | CAPABILITIES C11 gear/loot out |
| CP-15-041 | Character screen | out | CAPABILITIES G22 body stats out; progression is cred (C7) |
| CP-15-042 | Ripperdoc screen | out | CAPABILITIES C11 cyberware out |
| CP-15-043 | Crafting screen | out | CAPABILITIES C11 crafting out |
| CP-15-044 | Stash screen | planned | M11-4, CAPABILITIES C10 apartment/stash |
| CP-15-045 | Tutorial pop-ups | planned | M7-5 first hints, one per key, gone once done |
| CP-15-046 | Interaction prompts | built | `src/main.js:218` prompt element (F · DRIVE at `:226`); door prompt `src/render/doorhud.js` |
| CP-15-047 | Quest banners | built | `src/sim/mission.js:86` contract-complete banner; arc objective line `src/render/arcui.js:85` |
| CP-15-048 | Notification queue | partial | `src/sim/news.js:13` NEWS_MAX 4 news lines and arc notes stack; no XP or loot toasts (none exist) |
| CP-15-049 | Photo mode filters and poses | skip | input row says DUPLICATE of CP-15-052 |
| CP-15-050 | Subtitle settings in game | skip | input row says DUPLICATE of CP-18-019 |
| CP-15-051 | Main menu | planned | M7-2 title screen with New Game, Continue, Settings |
| CP-15-052 | Photo mode | later | CAPABILITIES G26 photo mode later (ROADMAP "After the sell check") |
| CP-15-053 | Photo mode camera | later | CAPABILITIES G26 photo mode later |
| CP-15-054 | Photo mode characters | later | CAPABILITIES G26 photo mode later |
| CP-15-055 | Photo mode lighting | later | CAPABILITIES G26 photo mode later |
| CP-15-056 | SmartFrames | missing | searched: "SmartFrame", "picture frame" in src/ |
| CP-15-057 | Photo mode aspect ratios | later | CAPABILITIES G26 photo mode later |
| CP-15-058 | Effect intensity slider | later | CAPABILITIES G26 photo mode later |
| CP-16-001 | NCPD scanner hustles | later | CAPABILITIES G15 side activities come as M11 gigs; scanner-style crime clears need D9 combat |
| CP-16-002 | Assault in Progress | later | D9 combat after the sell check |
| CP-16-003 | Reported Crime | later | D9 combat after the sell check |
| CP-16-004 | Suspected Organized Crime Activity | later | D9 combat after the sell check |
| CP-16-005 | Hidden Gem | later | CAPABILITIES G29 hidden content later; loot is out (C11) |
| CP-16-006 | Scanner hustle rewards | later | CAPABILITIES G15; M11-2 gigs pay ₡ |
| CP-16-007 | Cyberpsycho sightings | later | D9 combat after the sell check; CAPABILITIES C9 |
| CP-16-008 | Non-lethal cyberpsychos | later | D9 combat after the sell check |
| CP-16-009 | Beat on the Brat | later | D9 combat after the sell check |
| CP-16-010 | Boxing opponents | later | D9 combat after the sell check |
| CP-16-011 | The Beast in Me | missing | searched: "race", "racing" in src/ and the plan |
| CP-16-012 | Race outcomes | missing | searched: "race" in src/ |
| CP-16-013 | Replayable races | missing | searched: "race" in src/ |
| CP-16-014 | Airdrops | missing | searched: "airdrop", "supply crate" in src/ |
| CP-16-015 | Airdrop weapons | out | CAPABILITIES C11 gear out |
| CP-16-016 | Black market backup | out | CAPABILITIES C11 gear out |
| CP-16-017 | Tarot cards | later | CAPABILITIES G29 collectibles later |
| CP-16-018 | Tarot turn-in | missing | searched: "tarot" in src/ |
| CP-16-019 | Shards | later | CAPABILITIES G29 collectibles later |
| CP-16-020 | Roach Race | missing | searched: "arcade", "roach" in src/ |
| CP-16-021 | Trauma Drama | missing | searched: "arcade", "minigame" in src/ |
| CP-16-022 | Arcade high scores | missing | searched: "high score", "arcade" in src/ |
| CP-16-023 | Mini-world stories | later | CAPABILITIES G13 ambient events later |
| CP-16-024 | Post-ending rewards | missing | searched: "post-ending", "epilogue" in src/ |
| CP-16-026 | Vehicle contracts | planned | M11-2 Delivery gig kind (bring a car to a place by a time) |
| CP-16-031 | Just Another Story repeat job | missing | searched: "repeat job", "AUTOFIXER" in src/; repeat gigs exist as client memory (M11-3), vehicle unlocks do not |
| CP-16-032 | Contract chases | missing | searched: "chase" in gig planning (M11); no delivery ambush |
| CP-16-027 | Dogtown data terminals | skip | input row says DUPLICATE of CP-08-054 |
| CP-16-028 | Stadium fights | missing | searched: "stadium", "arena" in src/ |
| CP-16-029 | Shooting range challenge | missing | searched: "shooting range", "range" in src/ |
| CP-17-001 | 89.7 Growl FM | later | CAPABILITIES G23 car radio later (no audio today, `ARC.md`) |
| CP-17-002 | 99.9 Impulse | later | CAPABILITIES G23 car radio later |
| CP-17-003 | 107.5 Dark Star | later | CAPABILITIES G23 car radio later |
| CP-17-004 | 96.1 Ritual FM | later | CAPABILITIES G23 car radio later |
| CP-17-005 | 98.7 Body Heat Radio | later | CAPABILITIES G23 car radio later |
| CP-17-006 | 101.9 The Dirge | later | CAPABILITIES G23 car radio later |
| CP-17-007 | 103.5 Radio Pebkac | later | CAPABILITIES G23 car radio later |
| CP-17-008 | 106.9 Radio Vexelstrom | later | CAPABILITIES G23 car radio later |
| CP-17-009 | 107.3 Morro Rock Radio | later | CAPABILITIES G23 car radio later |
| CP-17-010 | 91.9 Royal Blue Radio | later | CAPABILITIES G23 car radio later |
| CP-17-011 | 92.9 Night FM | later | CAPABILITIES G23 car radio later |
| CP-17-012 | Pacific Dreams | later | CAPABILITIES G23 car radio later |
| CP-17-013 | Station switching | later | CAPABILITIES G23 car radio later |
| CP-17-014 | Track display | later | CAPABILITIES G23 car radio later |
| CP-17-015 | Radio volume control | later | CAPABILITIES G23 car radio later; game volume sliders are M7-4 |
| CP-17-016 | Radioport | later | CAPABILITIES G23 car radio later |
| CP-17-017 | Station ads and idents | later | CAPABILITIES G23 car radio later |
| CP-17-018 | SAMURAI songs | later | CAPABILITIES G23 car radio later (needs licensed/generated music, `ARC.md`) |
| CP-17-019 | A Like Supreme concert | missing | searched: "concert", "band" in src/ |
| CP-17-020 | Dynamic combat music | missing | searched: "combat music", "music" in src/; no combat (D9) and no music |
| CP-17-021 | Quest music override | missing | searched: "music override", "score" in src/ |
| CP-17-022 | Bar and club music | missing | searched: "club music", "bar music" in src/; M7 ambience is street only |
| CP-17-023 | City ambience | planned | M7-3 street ambience by hour and district kind |
| CP-17-024 | Streamer mode | missing | searched: "streamer mode" in src/ |
| CP-17-025 | Radio off switch | later | CAPABILITIES G23 car radio later |
| CP-17-026 | Radio in Phantom Liberty | skip | input row says WRONG |
| CP-17-027 | Phantom Liberty soundtrack | missing | searched: "Phantom Liberty" in src/ |
| CP-18-001 | Difficulty levels | missing | searched: "difficulty" in src/ |
| CP-18-002 | Very Hard tuning | missing | searched: "difficulty" in src/ |
| CP-18-003 | Gameplay settings | planned | M7-4 settings screen; hints M7-5 |
| CP-18-004 | Graphics presets | planned | M7-4 quality settings (shadow distance, resolution scale); M7-13 sets defaults |
| CP-18-005 | Ray tracing | missing | searched: "ray trac", "raytrac" in src/ and the plan |
| CP-18-006 | Path tracing | missing | searched: "path trac" in src/ and the plan |
| CP-18-007 | DLSS Ray Reconstruction | missing | searched: "DLSS" in src/ and the plan |
| CP-18-008 | Upscaling options | missing | searched: "upscal", "DLSS", "FSR" in src/ |
| CP-18-009 | AMD SMT switch | missing | searched: "SMT", "threading" in src/ |
| CP-18-010 | Crowd density setting | missing | searched: "crowd density" in src/; NPC_COUNT is fixed (`src/sim/street.js:7`) |
| CP-18-011 | FOV slider | missing | searched: "fov", "field of view" in src/ |
| CP-18-012 | Motion blur toggle | missing | searched: "motion blur" in src/ |
| CP-18-013 | Film grain toggle | missing | searched: "film grain" in src/ |
| CP-18-014 | Chromatic aberration toggle | missing | searched: "chromatic" in src/ |
| CP-18-015 | Lens flare toggle | missing | searched: "lens flare" in src/; law 6 bans effects not visible in a shot |
| CP-18-016 | VSync and frame cap | missing | searched: "vsync", "frame cap" in src/ |
| CP-18-017 | HDR | missing | searched: "HDR" in src/; only a colorist mention (`src/render/atmosphere.js:169`) |
| CP-18-018 | Audio volumes | planned | M7-4 volumes (master, effects, ambience); no audio until M7 |
| CP-18-019 | Subtitles | planned | M7-4 subtitle size; dispatch subtitles already render (`src/ui/dispatch.js:1`) |
| CP-18-020 | Speaker names | built | `src/ui/dispatch.js:30` writes `line.speaker` into the subtitle |
| CP-18-021 | Voice language | missing | searched: "language", "voice" in src/; no voices (M7 sound only planned) |
| CP-18-022 | Text language | missing | searched: "language", "localis" in src/; ROADMAP puts localization after the sell check |
| CP-18-023 | Controller sensitivity | planned | M7-4 mouse speed and invert; pad bindings M7-8 |
| CP-18-024 | Invert Y axis | planned | M7-4 settings ("mouse speed and invert") |
| CP-18-025 | Vibration | missing | searched: "vibration", "rumble" in src/ |
| CP-18-026 | Control schemes | missing | searched: "control scheme" in src/; M7-8 uses the standard pad mapping |
| CP-18-027 | Key rebinding | planned | M7-11 rebinding screen |
| CP-18-028 | Vehicle key rebinding | planned | M7-11 (every action rebindable; `input.js` reads the bindings) |
| CP-18-029 | Hold or toggle | missing | searched: "hold or toggle", "toggle" for crouch/sprint/aim in src/ |
| CP-18-030 | Aim assist | missing | searched: "aim assist" in src/; no aiming (D9) |
| CP-18-031 | Colourblind modes | missing | searched: "colourblind", "colorblind" in src/ |
| CP-18-032 | Accessibility tab | later | ROADMAP "After the sell check": the rest of accessibility; M7-4 is the first slice |
| CP-18-033 | Larger interface font | later | ROADMAP "After the sell check": the rest of accessibility |
| CP-18-034 | HUD adjustment options | later | ROADMAP "After the sell check": the rest of accessibility |
| CP-18-035 | HUD safe zone | later | ROADMAP "After the sell check": the rest of accessibility |
| CP-18-036 | Breach timer toggle | missing | searched: "breach" in src/; no breach minigame (C20 out) |
| CP-18-037 | Arm cyberware cycling toggle | out | CAPABILITIES C11 cyberware out |
| CP-18-038 | Reduce camera motion | missing | searched: "camera shake", "camera motion" in src/ |
| CP-18-039 | Manual saves | planned | M7-7 three named save slots; pause menu M7-3 |
| CP-18-040 | Quick save | missing | searched: "quick save", "quicksave" in src/ |
| CP-18-041 | Autosaves | built | `src/main.js:465` `AUTOSAVE_SECS = 30`, written at `:1231`; also on tab hide (`:487`) |
| CP-18-042 | Load and delete saves | partial | `src/boot.js:14` loads the one slot on boot; no menu, no delete (M7-7) |
| CP-18-043 | Continue | built | `src/boot.js:14` `loadSave()` feeds pickWorld, so a saved game continues (`src/sim/newgame.js:52`) |
| CP-18-044 | Old saves on 2.0 | missing | version mismatch starts fresh (`src/sim/save.js:110`); M3-8 only promises a one-line message, not a load |
| CP-18-045 | New game | built | `src/main.js:479` newGame() on N (`:445`) wipes the save and boots a fresh seed |
| CP-19-001 | Achievements and trophies | planned | M9-6 at least 10 Steam achievements from an event tape (M9.T7) |
| CP-19-002 | Phantom Liberty achievements | missing | searched: "Phantom Liberty" in src/; PL content is not planned |
| CP-19-003 | REDmod tools | later | ROADMAP "After the sell check": modding waits |
| CP-19-004 | V's computer | missing | searched: "computer", "terminal" in src/ |
| CP-19-006 | Netpages | missing | searched: "netpage", "website" in src/ |
| CP-19-007 | Terminal emails | missing | searched: "email", "terminal" in src/ |
| CP-19-008 | Easter eggs | later | CAPABILITIES G29 hidden content later |
| CP-19-010 | Witcher reference | missing | searched: "witcher", "ciri" in src/ |
| CP-19-011 | Edgerunners references | missing | searched: "edgerunners" in src/ |
| CP-19-012 | Johnny apartment scenes | missing | searched: "apartment", "johnny" in src/; no companion (C13 out) |
| CP-19-013 | Console performance modes | missing | searched: "console", "performance mode" in src/; M9 ships Windows and macOS only |
| CP-19-014 | Console ray tracing mode | missing | searched: "console", "ray trac" in src/ |
| CP-19-015 | PS5 haptics | missing | searched: "haptic", "dualsense" in src/ |
| CP-19-016 | Razer Chroma support | missing | searched: "chroma", "razer" in src/ |
| CP-19-017 | Steam Deck support | missing | searched: "steam deck" in src/ and the plan |
| CP-19-018 | SSD requirement | missing | searched: "SSD" in src/; no storage requirement is declared |
| CP-19-019 | Photo mode screenshots | later | CAPABILITIES G26 photo mode later |
| CP-19-020 | Ultimate Edition | missing | searched: "Ultimate Edition" in src/ and the plan |
| CP-19-021 | Database lore entries | skip | input row says DUPLICATE of CP-15-034 |
| CP-19-022 | Credits | missing | searched: "credits" in src/ |
| CP-19-023 | Third-party overlays | missing | searched: "overlay", "steam overlay" in src/ |
