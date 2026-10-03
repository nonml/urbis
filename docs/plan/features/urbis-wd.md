# Watch Dogs: every feature against Urbis

Marks: built, partial, planned, later, out, missing, skip (the list marks the row wrong or a duplicate).

| ID | Feature | Mark | Evidence |
|---|---|---|---|
| WD-01-001 | Traffic light control | planned | M6-4, task M6.T7 "All-green at a junction; cars brake and jam" |
| WD-01-002 | Timed traffic light takedown | planned | M6.T7 all-green causes brake/bump/jam; the timed trigger is not named |
| WD-01-003 | Bollard (blocker) control | planned | M6-4, task M6.T8 "Posts rise across a junction" |
| WD-01-004 | Timed bollard takedown | planned | M6.T8 "a car that hits them stops dead" |
| WD-01-005 | Road spike control | partial | police spikes built `src/sim/response.js:156-178`; no player raise/lower (searched spike, bollard in src/) |
| WD-01-006 | Timed road spike takedown | partial | spike strips burst tyres `src/sim/response.js:188-205`, but police-laid, no player timing |
| WD-01-007 | Drawbridge control | planned | M6-4, task M6.T10 bridge hack (waits on M4-2 river) |
| WD-01-008 | Steam pipe explosion | planned | M6-4, task M6.T9 steam pipe shuts a street |
| WD-01-009 | Timed steam pipe takedown | planned | M6.T9 steam column; the timed vehicle launch is not named |
| WD-01-010 | Transformer overload | partial | blackout blacks out a zone `src/sim/street.js:234-243`; no transformer or electrical explosion (searched transformer in src/) |
| WD-01-011 | Gate and garage control | later | CAPABILITIES W16 "Gates, garage doors, forklifts, lifts" |
| WD-01-012 | L-Train control | later | CAPABILITIES S22 (train later) |
| WD-01-013 | Junction box overload | later | CAPABILITIES W15, depends on D9 |
| WD-01-014 | ctOS box | planned | M6-2, task M6.T5 "One per district... breaking in is holding E for 3 s" |
| WD-01-015 | Traffic light control (ctOS 2.0) | skip | — |
| WD-01-016 | Auto takedown: gates | later | CAPABILITIES W16 |
| WD-01-017 | Auto takedown: steam pipes | skip | — |
| WD-01-018 | Massive System Crash | partial | blackout built `src/sim/street.js:234-243`; lights and trade only, no infrastructure shutdown |
| WD-01-019 | Blackout upgrade | built | lights out `src/render/lamps.js:186-193`, `src/main.js:1068-1098`; sight shrinks `src/sim/patrol.js:41-46` (cover) |
| WD-01-020 | Security system shutdown | missing | searched security, alarm, camera in src/sim/; no building security system |
| WD-01-021 | Forklift remote control | later | CAPABILITIES W16 |
| WD-01-022 | Scissor lift remote control | later | CAPABILITIES W16 (lifts) |
| WD-01-023 | Crane remote control | planned | M6-4, task M6.T18 crane: stop the site or drop its load |
| WD-01-024 | Traffic light control (Legion) | skip | — |
| WD-01-025 | Bollard control (Legion) | skip | — |
| WD-01-026 | Steam pipe explosion (Legion) | skip | — |
| WD-01-027 | Junction box shock | skip | — |
| WD-01-028 | Blackout | built | `src/sim/street.js:234-243` hackBlackout; H key `src/main.js:442`, cooldown HUD `:500` |
| WD-01-029 | Auto takedown: traffic lights | skip | — |
| WD-01-030 | Transformer overload (WD2) | skip | — |
| WD-01-031 | Video billboard hack | later | CAPABILITIES W23 "Billboards | None | Later (M6)" |
| WD-01-032 | Advertising screen propaganda | later | CAPABILITIES W14/W23 (distract, billboards later) |
| WD-01-033 | Triangular road blockers | missing | searched blocker, ramp, wedge in src/; only the police roadblock `src/sim/response.js:209` |
| WD-01-034 | City hack lure mode | later | CAPABILITIES W14 "Distract, lure, report someone | None | Later" |
| WD-02-001 | Profiler scan | built | `src/sim/street.js:250-264` profilerTarget; name/age/home/work/income/secret panel `src/render/profiler.js:41-53` |
| WD-02-002 | Bank account hack | planned | M6-4, task M6.T17 "A person's balance drains into the player's" |
| WD-02-003 | ATM hack | planned | M6.T17 person's bank transfer; no ATM object is planned |
| WD-02-004 | Call eavesdropping | planned | M6-4, tasks M6.T15 calls, M6.T16 eavesdrop |
| WD-02-005 | Text message snooping | planned | CAPABILITIES W12 "Listen to calls and texts | None | M6: eavesdrop"; M6.T15/T16 |
| WD-02-006 | Music download | skip | — |
| WD-02-007 | Report a criminal | later | CAPABILITIES W14; M6 "later" table "Call it in" |
| WD-02-008 | High value target flag | missing | searched flag, high value, vault in src/; profiler shows income only `src/render/profiler.js:46` |
| WD-02-009 | System key hack | missing | searched system key, key, secure door in src/; none |
| WD-02-010 | Vehicle unlock hack | missing | searched unlock, key in src/sim; M10-1 takes parked cars with F, no key hack on a person |
| WD-02-011 | Phone distraction | later | CAPABILITIES W14 "Distract, lure, report someone | None | Later" |
| WD-02-012 | Improved profiler flag | missing | searched flag, optimize in src/; no automatic mark of rich targets |
| WD-02-013 | Mass communication disruption | later | CAPABILITIES W14; M6's later rows |
| WD-02-014 | Gang attack | later | CAPABILITIES C9 "Factions, gangs, territory | None | Later" |
| WD-02-015 | Gang skirmish | later | CAPABILITIES C9 |
| WD-02-016 | Gang war | later | CAPABILITIES C9 |
| WD-02-017 | False APB: suspect | later | CAPABILITIES W14; M6 "later" table "Call it in" |
| WD-02-018 | False APB: wanted criminal | missing | searched APB, wanted criminal in src/; M6's "Call it in" is a true report, no advisory tier |
| WD-02-019 | Deep profiler | partial | `src/render/profiler.js:44-46` shows home, work and current task (`src/sim/commute.js:55`); no full schedule, relationships or dislikes |
| WD-02-020 | ETO hack | skip | — |
| WD-02-021 | Shock hack | later | ROADMAP D9 (combat after the sell check); CAPABILITIES C19 |
| WD-02-022 | Key steal | missing | searched key steal, keys in src/sim; M10-1 enters any car with F, no key taken from a person |
| WD-02-023 | Viral hacking | missing | searched viral, spread, chain in src/sim; M6's registry has no chain |
| WD-02-024 | Phone distraction (WD1) | later | CAPABILITIES W14 |
| WD-02-025 | Cancel 911 call | later | CAPABILITIES W14 (phone manipulation); M10.T11 adds witness calls, no cancel |
| WD-02-026 | Disrupt enemy comms | skip | — |
| WD-02-027 | Disable reinforcement calls | skip | — |
| WD-02-028 | Botnet refill | planned | M6-3 battery `docs/HACKING.md` refills over time; hacking a passer-by to refill is not planned |
| WD-03-001 | Engine kill | planned | M6-4, task M6.T11 car hijack "brakes, swerves or floors it" |
| WD-03-002 | Steering hack | planned | M6.T11 "swerves" |
| WD-03-003 | Accelerate hack | planned | M6.T11 "floors it" |
| WD-03-004 | Brake hack | planned | M6.T11 "brakes hard" |
| WD-03-005 | Car alarm hack | missing | searched alarm, car alarm in src/; only the planned fire alarm M5.T14 |
| WD-03-006 | Vehicle directional hack | later | CAPABILITIES W8 "Remote drive: later" |
| WD-03-007 | Engine override | planned | M6.T11 "floors it"; the batter spend is M6-3 |
| WD-03-008 | Massive vehicle hack | later | CAPABILITIES W21; M6 "later" table "Mass vehicle hack" |
| WD-03-009 | Lock hacking | missing | searched lock, unlock in src/sim; M10-1 enters cars with F and no notice rule |
| WD-03-010 | Chopper retreat exploit | later | CAPABILITIES W11 "Jam the helicopter | Later" |
| WD-03-011 | Quadcopter control | later | CAPABILITIES W18 "Drones, RC cars | None | Later" |
| WD-03-012 | Quadcopter wall scan | later | CAPABILITIES W18 |
| WD-03-013 | Quadcopter speed boost | later | CAPABILITIES W18 |
| WD-03-014 | Jumper control | later | CAPABILITIES W18 |
| WD-03-015 | Jumper taunt | later | CAPABILITIES W18/W14 |
| WD-03-016 | Enhanced spring | later | CAPABILITIES W18 |
| WD-03-017 | Jumper speed boost | later | CAPABILITIES W18 |
| WD-03-018 | Remote gadget drop | later | CAPABILITIES W18/W26 |
| WD-03-019 | Robot distraction | later | CAPABILITIES W18 |
| WD-03-020 | Spiderbot | later | CAPABILITIES W18 |
| WD-03-021 | Infiltrator Spiderbot | later | CAPABILITIES W18 |
| WD-03-022 | Combat Spiderbot | later | CAPABILITIES W18 |
| WD-03-023 | Cargo drone hijack | later | CAPABILITIES W18 |
| WD-03-024 | Riot drone | later | CAPABILITIES W18 |
| WD-03-025 | Kamikaze drone | later | CAPABILITIES W18 |
| WD-03-026 | Seeker spider | later | CAPABILITIES W18 |
| WD-03-027 | Turret spider | later | CAPABILITIES W18 |
| WD-03-028 | Missile drone | later | CAPABILITIES W18 |
| WD-03-029 | Shock drone | later | CAPABILITIES W18 |
| WD-03-030 | Camera drone | later | CAPABILITIES W18 |
| WD-03-031 | News drone | later | CAPABILITIES W18 |
| WD-03-032 | Drone betray hack | later | CAPABILITIES W18 |
| WD-03-033 | Dive bomb | later | CAPABILITIES W18 |
| WD-03-034 | Enemy drone hijack | later | CAPABILITIES W18 |
| WD-03-035 | Turret hack | missing | searched turret in src/; no fixed turrets exist or are planned |
| WD-03-036 | Car movement hack | planned | M6.T11 (brake, swerve, floor it) |
| WD-03-037 | Delivery drone | later | CAPABILITIES W18 |
| WD-03-038 | Disable helicopter | skip | — |
| WD-03-039 | RC remote hacking | later | CAPABILITIES W18 |
| WD-04-001 | ctOS camera hack | planned | M6-4; tasks M6.T12 (cut a camera) and M6.T13 (view jumps into it) |
| WD-04-002 | Camera hopping | planned | M6.T13 "jump to any camera in view" |
| WD-04-003 | ctOS tower | planned | M6.T5 district control box, broken into at street level on foot; no tower climb |
| WD-04-004 | ctOS control centre | missing | searched mainframe, control centre, server in src/; none |
| WD-04-005 | ctOS Breach | planned | M6-2, task M6.T5 "breaking in is holding E for 3 s" |
| WD-04-006 | NetHack view | planned | M6.T2 highlights the thing aimed at; M6.T13 camera view (no drone view) |
| WD-04-007 | ctOS box | planned | M6.T5 control box opens the district's hacks; map activities are not named |
| WD-04-008 | Network Bypass minigame | later | CAPABILITIES W19 "Hacking puzzles | None | Later: M6's break-in is hold E for 3 s" |
| WD-04-009 | ctOS node | later | CAPABILITIES W16 "Gates, garage doors, forklifts, lifts | Later (vertical hacking)" |
| WD-04-010 | Data centre | missing | searched data centre, server, mainframe in src/; M6.T20 is a district planning office |
| WD-04-011 | Nethack upgrade | missing | searched nethack, through wall, x-ray in src/; M6-1 keeps aim line-of-sight |
| WD-04-012 | Armed camera | missing | searched armed camera, fire in src/; cameras are not built and no weapon system is planned |
| WD-04-013 | Hacker vision | planned | M6-1/M6.T2 highlights the thing aimed at, not every device in range |
| WD-04-014 | Camera tagging | missing | searched tag in src/; M10.T5's map shows police, not tagged people or cars |
| WD-04-015 | Hack from camera view | planned | M6.T13 profiles from the camera; firing hacks from inside it is not named |
| WD-05-001 | Lure | skip | — |
| WD-05-002 | Jam Coms | planned | CAPABILITIES W10; task M6.T14 "for 20 s the police cannot raise the tier or call units" |
| WD-05-003 | Blackout | built | `src/sim/street.js:234-243`, H key `src/main.js:442` |
| WD-05-004 | ctOS Scan | missing | searched scan, tag in src/; M6.T2 highlights one aimed thing, no area scan |
| WD-05-005 | Focus Boost | out | CAPABILITIES W26 "Craft gadgets | Out: loot and crafting are not in the pillars" |
| WD-05-006 | Frag grenade | out | CAPABILITIES W26 (crafted gadget) |
| WD-05-007 | IED | out | CAPABILITIES W26 (crafted gadget) |
| WD-05-008 | Proximity IED | out | CAPABILITIES W26 |
| WD-05-009 | Eugene | later | CAPABILITIES W18 (drone, RC cars later) |
| WD-05-010 | 3D printer | out | CAPABILITIES W26 (crafting out) |
| WD-05-011 | Electro shock device | out | CAPABILITIES W26 (crafted device) |
| WD-05-012 | Explosive device | out | CAPABILITIES W26 |
| WD-05-013 | Shock zapper | later | CAPABILITIES W18 (jumper/quadcopter later) |
| WD-05-014 | AR Cloak | later | CAPABILITIES W27 stealth, depends on D9 |
| WD-05-015 | Gun Jam | later | ROADMAP D9 (combat after the sell check) |
| WD-05-016 | Uniformed Access | later | CAPABILITIES W27 (stealth depends on D9) |
| WD-05-017 | Smoke grenade | out | CAPABILITIES W26 (thrown gadget) |
| WD-05-018 | Tear gas | out | CAPABILITIES W26 (thrown gadget) |
| WD-05-019 | Bee swarm | missing | searched bee, swarm, sting in src/; none |
| WD-05-020 | Paintball rifle | later | ROADMAP D9 (non-lethal weapon, combat after the sell check) |
| WD-05-021 | Paint bomb | out | CAPABILITIES W26 (thrown gadget) |
| WD-05-022 | Megaphone | missing | searched megaphone, crowd, rally in src/; no crowd system |
| WD-05-023 | Spy Watch | missing | searched spy, watch in src/; none |
| WD-05-024 | Pocketwatch | later | CAPABILITIES W14 (misdirect/distract later) |
| WD-05-025 | Grappler | later | ROADMAP D9 (fist-fight move, combat after the sell check) |
| WD-05-026 | Kinetic charger | later | ROADMAP D9 |
| WD-05-027 | Shockwave strike | later | ROADMAP D9 |
| WD-05-028 | Explosive shield | later | ROADMAP D9 |
| WD-05-029 | AR medical shield | missing | searched medical, shield, heal in src/; no health system |
| WD-05-030 | Aiden's blackout | built | `src/sim/street.js:234-243` blackout; sight shrinks `src/sim/patrol.js:41-46` |
| WD-05-031 | Wrench Jr. | later | CAPABILITIES W18 (companion drone) |
| WD-05-032 | Hologram clone | later | ROADMAP D9 (combat decoy) |
| WD-06-001 | Walking | built | `src/sim/player.js:5` WALK_SPEED 3.4; WASD `src/main.js:972-975` |
| WD-06-002 | Sprint | built | Shift sets `hurry` `src/main.js:977`; `src/sim/player.js:6` HURRY_SPEED 6.0 |
| WD-06-003 | Crouch | later | CAPABILITIES W27 stealth, depends on D9; searched crouch, sneak in src/ |
| WD-06-004 | Cover | later | CAPABILITIES G11 "Fight: melee, guns, cover | None | Operator (D9)" |
| WD-06-005 | Vault | later | CAPABILITIES G2 "Jump, climb, vault | None | Later" |
| WD-06-006 | Ledge climb | later | CAPABILITIES G2 |
| WD-06-007 | Ladder climbing | later | CAPABILITIES G2; BACKLOG verticality |
| WD-06-008 | Window entry | later | CAPABILITIES G2 (climb); no window entry built |
| WD-06-009 | Swimming | planned | M10-5 "the player swims at 1 m/s to the nearest bank and climbs out" |
| WD-06-010 | Combat roll | later | ROADMAP D9 (combat after the sell check) |
| WD-06-011 | Ride the L-Train | later | CAPABILITIES S22 (train later) |
| WD-06-012 | Drainpipe climb | later | CAPABILITIES G2 (climb) |
| WD-06-013 | Ledge drop | later | CAPABILITIES G2 (ledge moves wait with climbing) |
| WD-06-014 | Slide into cover | later | ROADMAP D9 (cover combat) |
| WD-06-015 | Crowd push | missing | searched push, shove, crowd in src/; walkers never react (M10-4 is flee) |
| WD-06-016 | Jump | later | CAPABILITIES G2 |
| WD-06-017 | Fall damage | missing | no player health; searched fall, damage in `src/sim/player.js`; none |
| WD-06-018 | Operative movement differences | out | CAPABILITIES W24 "Play as anyone (Legion) | None | Out: one protagonist" |
| WD-06-019 | Building entry | built | E at a door `src/main.js:411-420`; rooms `src/sim/interior.js` (CAPABILITIES C4) |
| WD-07-001 | Budget cars | planned | M10-1 takes any parked or traffic car; no car classes (traffic shapes `src/sim/street.js:53`) |
| WD-07-002 | Muscle cars | missing | searched muscle, class in src/; one car type, five body shapes |
| WD-07-003 | Sports cars | missing | searched sports, class in src/; one car type |
| WD-07-004 | Performance cars | missing | searched performance, tuned in src/; none |
| WD-07-005 | Trucks | later | CAPABILITIES G5 "Motorbike, truck, bus, boat: later" |
| WD-07-006 | Heavy vehicles | later | CAPABILITIES G5 (bus later) |
| WD-07-007 | Motorcycles | later | CAPABILITIES G5 (motorbike later) |
| WD-07-008 | Boats | later | CAPABILITIES G5 (boat later) |
| WD-07-009 | Emergency vehicles | planned | M10-1 any car; police cruisers exist `src/sim/wanted.js`, no ambulance or fire truck |
| WD-07-010 | Handbrake | missing | searched handbrake, drift in src/; none |
| WD-07-011 | Horn | missing | searched horn in src/; none (no audio until M7) |
| WD-07-012 | Headlight control | partial | always on, no toggle: traffic `src/render/traffic.js:2`, hero spot `:492-515` |
| WD-07-013 | Hide in car | missing | searched hide, engine off in src/; none |
| WD-07-014 | Car on Demand | later | CAPABILITIES C12 "Call your car | None | Later" |
| WD-07-015 | Car dealership | later | CAPABILITIES G8 "Customise, store and own cars | None | Later" |
| WD-07-016 | Ramming | planned | M10-3 collision and damage "hits other cars, buildings and street furniture" |
| WD-07-017 | Auto-drive | missing | searched auto-drive, self-driving, autonomous in src/; none |
| WD-07-018 | Driver SF | skip | — |
| WD-07-019 | Bertha | missing | searched bertha in src/; no vehicle roster or ownership |
| WD-07-020 | CyruX | missing | searched cyrux, biometric in src/; none |
| WD-07-021 | Getaway car | later | CAPABILITIES C12 (call your car later) |
| WD-07-022 | Spy car | later | ROADMAP D9 (mounted weapons, combat after the sell check) |
| WD-07-023 | Boat driving on the Thames | later | CAPABILITIES G5 (boat later) |
| WD-07-024 | Vehicle paint jobs | later | CAPABILITIES G8 |
| WD-07-025 | Auto-taxis | later | CAPABILITIES G25 (taxi, fast travel later) |
| WD-07-026 | Vehicle damage states | partial | spike strips burst tyres and flats pull `src/sim/response.js:188-205`; smoke, fire, wreck are M10-3/M10-8, no collision `src/sim/vehicle.js:1` |
| WD-07-027 | Drive-by shooting | later | ROADMAP D9 (combat after the sell check) |
| WD-07-028 | Carjacking | planned | M10-1, task M10.T3 "the driver gets out and runs off as a walker" |
| WD-07-029 | Parked car theft | planned | M10-1, task M10.T2 "F at one puts the player in it" |
| WD-08-001 | Focus | planned | M6-3, task M6.T22 "holding Q (Focus) slows the game to 0.3 times speed for up to 4 s" |
| WD-08-002 | Melee takedown | later | ROADMAP D9 (combat after the sell check) |
| WD-08-003 | Cover takedown | later | ROADMAP D9 |
| WD-08-004 | Stealth takedown | later | ROADMAP D9; CAPABILITIES W27 |
| WD-08-005 | Pistols | later | ROADMAP D9 |
| WD-08-006 | Submachine guns | later | ROADMAP D9 |
| WD-08-007 | Assault rifles | later | ROADMAP D9 |
| WD-08-008 | Shotguns | later | ROADMAP D9 |
| WD-08-009 | Sniper rifles | later | ROADMAP D9 |
| WD-08-010 | Grenade launchers | later | ROADMAP D9 |
| WD-08-011 | Light machine guns | later | ROADMAP D9 |
| WD-08-012 | Taser | later | ROADMAP D9 |
| WD-08-013 | Stun gun | later | ROADMAP D9 |
| WD-08-014 | Air shotgun | later | ROADMAP D9 |
| WD-08-015 | Sniper stun rifle | later | ROADMAP D9 |
| WD-08-016 | Melee combos | later | ROADMAP D9 |
| WD-08-017 | Non-lethal fists | later | ROADMAP D9 |
| WD-08-018 | Lethal or non-lethal toggle | later | ROADMAP D9 |
| WD-08-019 | LTL stun gun | later | ROADMAP D9 |
| WD-08-020 | LTL dart gun | later | ROADMAP D9 |
| WD-08-021 | LTL MP7 | later | ROADMAP D9 |
| WD-08-022 | Named handguns | later | ROADMAP D9 |
| WD-08-023 | Named SMGs | later | ROADMAP D9 |
| WD-08-024 | Named rifles | later | ROADMAP D9 |
| WD-08-025 | Named shotguns | later | ROADMAP D9 |
| WD-08-026 | Launchers (Legion) | later | ROADMAP D9 |
| WD-08-027 | K.O. punch | later | ROADMAP D9 |
| WD-08-028 | Strong counters | later | ROADMAP D9 |
| WD-08-029 | Gunkata | later | ROADMAP D9 |
| WD-08-030 | Detection meter | later | CAPABILITIES W27 stealth, depends on D9; police heat stars exist `src/sim/wanted.js` |
| WD-08-031 | Focus (Aiden) | planned | M6-3 Focus is the one system, no separate Aiden version |
| WD-08-032 | Shockwave punch | later | ROADMAP D9 |
| WD-08-033 | Silent pistol | later | ROADMAP D9 |
| WD-08-034 | Non-lethal takedown from cover | later | ROADMAP D9 |
| WD-08-035 | Health regeneration | later | ROADMAP D9; no player health today (searched health in src/sim) |
| WD-08-036 | Alarm states | later | ROADMAP D9/W27; police tiers exist `src/sim/wanted.js:44-47`, no per-enemy alert state |
| WD-08-037 | Weapon selection | later | ROADMAP D9 |
| WD-08-038 | Drop takedown | later | ROADMAP D9 |
| WD-08-039 | Enforcer combat takedown | skip | — |
| WD-08-040 | Stealth sprint | skip | — |
| WD-09-001 | Wanted heat | built | TIERS `src/sim/wanted.js:43-48`, `raise` `:126-130`; crimes `:134-141` blackout, `:176-192` speeding |
| WD-09-002 | ctOS phone tracking | missing | searched phone, track, ctOS in src/; the search ring follows the last known position, not a phone (`src/sim/wanted.js:88-94`) |
| WD-09-003 | Search circle | built | `src/sim/wanted.js:84-94` startSearch and widening radius; `docs/WANTED.md` "Search language" |
| WD-09-004 | Patrol cars | built | `src/sim/wanted.js:96-114` syncUnits, `:239-257` steerUnits; `src/sim/response.js:209-229` contact |
| WD-09-005 | Police SUVs | missing | searched SUV, heavy unit in src/; one cruiser body `src/render/policekit.js` |
| WD-09-006 | SWAT response | missing | searched SWAT, armed unit in src/; none |
| WD-09-007 | Police helicopter | built | `src/sim/response.js:60-88`, `src/render/heli.js`, sight `src/sim/wanted.js:205` |
| WD-09-008 | Roadblocks | built | `src/sim/response.js:11-38` layout, `:133-141` placeRoadblock; tier 3 `wanted.js:47` |
| WD-09-009 | Escape on foot | built | `src/sim/wanted.js:202-218` judgeSight, `:265-270` searchOn tiers out (14/20/25 s) |
| WD-09-010 | Escape by vehicle | built | same search state machine; blackout is cover `src/sim/patrol.js:41-46`, spikes to dodge `response.js:180-205` |
| WD-09-011 | Crime Prediction System | later | CAPABILITIES W20 "Crime prediction | None | Later" |
| WD-09-012 | Intervene in a crime | later | CAPABILITIES W20/C15 |
| WD-09-013 | Citizen reputation | missing | searched reputation, hero, villain in src/; none |
| WD-09-014 | Reputation reaction | missing | searched reputation in src/; none |
| WD-09-015 | Chicago South Club | later | CAPABILITIES C9 "Factions, gangs, territory | None | Later" |
| WD-09-016 | Fixers | planned | CAPABILITIES W22 "Contracts from fixers | None | M11: gigs"; M11-1/M11.T2 |
| WD-09-017 | Pawnee Militia | later | CAPABILITIES C9 |
| WD-09-018 | Witness calls | planned | M10-4, task M10.T11 "calls it in after 5 s... heat rises with the cause witness" |
| WD-09-019 | Tezcas | later | CAPABILITIES C9 |
| WD-09-020 | Bratva | later | CAPABILITIES C9 |
| WD-09-021 | Prime_Eight | later | CAPABILITIES C9 |
| WD-09-022 | Gang retaliation | later | CAPABILITIES C9 |
| WD-09-023 | Albion patrols | later | CAPABILITIES C9 |
| WD-09-024 | Albion checkpoints | later | CAPABILITIES C9 |
| WD-09-025 | Albion alert | later | CAPABILITIES C9 |
| WD-09-026 | Albion grunts and rushers | later | CAPABILITIES C9 |
| WD-09-027 | Albion grenadiers | later | CAPABILITIES C9 |
| WD-09-028 | Albion overwatch | later | CAPABILITIES C9 |
| WD-09-029 | Albion captains | later | CAPABILITIES C9 |
| WD-09-030 | Clan Kelley crew | later | CAPABILITIES C9 |
| WD-09-031 | Metropolitan Police | partial | cruisers and pursuit built `src/sim/wanted.js`; no foot officers with stun guns (searched officer in src/) |
| WD-09-032 | SIRS guards | missing | searched SIRS, guard unit in src/; none |
| WD-09-033 | Defeated operative | out | CAPABILITIES W24 (play as anyone out) |
| WD-09-034 | Borough defiance | missing | searched borough, defiance, liberate in src/; districts exist but no control meter |
| WD-09-035 | Albion Vendetta | missing | searched vendetta, trait in src/; none |
| WD-09-036 | Rempart security | later | CAPABILITIES C9 (corporate faction later) |
| WD-09-037 | Police scanner audio | partial | dispatch chatter built as subtitles `src/sim/dispatch.js`, `src/ui/dispatch.js`; no audio until M7-1 |
| WD-09-038 | Black Viceroys | later | CAPABILITIES C9 |
| WD-09-039 | Umeni | later | CAPABILITIES C9 |
| WD-09-040 | Aggression level | partial | heat tiers bring heavier response `src/sim/wanted.js:43-48`; no attacks on civilians or drones |
| WD-09-041 | Enforcers | missing | searched enforcer, armoured security in src/; none (combat D9) |
| WD-10-001 | XP | planned | M11-5 "gigs and missions give cred" (CAPABILITIES C7) |
| WD-10-002 | Levels and skill points | out | CAPABILITIES C7/G22 "No attribute sheet" |
| WD-10-003 | Combat skill branch | out | CAPABILITIES C7/G22 (no skill tree); combat itself is D9 |
| WD-10-004 | Improved Focus | out | CAPABILITIES C7/G22 (no upgrade tree); base Focus is M6-3 |
| WD-10-005 | Slowed Focus | out | CAPABILITIES C7/G22 |
| WD-10-006 | Maximized Focus | out | CAPABILITIES C7/G22 |
| WD-10-007 | Critical Focus | out | CAPABILITIES C7/G22 |
| WD-10-008 | Stealth Sprint | later | CAPABILITIES W27 stealth depends on D9 |
| WD-10-009 | Quick Switch | out | CAPABILITIES C7/G22 (no perk sheet) |
| WD-10-010 | Pistol Expert | out | CAPABILITIES C7/G22 |
| WD-10-011 | Shotgun Expert | out | CAPABILITIES C7/G22 |
| WD-10-012 | Sniper Rifle Expert | out | CAPABILITIES C7/G22 |
| WD-10-013 | Auto Weapons Expert | out | CAPABILITIES C7/G22 |
| WD-10-014 | Steady Aim | out | CAPABILITIES C7/G22 |
| WD-10-015 | Demolitionist | out | CAPABILITIES C7/G22 |
| WD-10-016 | Expert Demolitionist | out | CAPABILITIES C7/G22 |
| WD-10-017 | Enforcer Combat Takedown | later | ROADMAP D9 (combat takedown) |
| WD-10-018 | Bullet Resistance | later | ROADMAP D9 (no player health until combat) |
| WD-10-019 | Blast Resistance | later | ROADMAP D9 |
| WD-10-020 | Rapid Reload | out | CAPABILITIES C7/G22 (weapon skills) |
| WD-10-021 | Crafted item skills | out | CAPABILITIES W26 "Craft gadgets | Out" |
| WD-10-022 | Driving skill branch | out | CAPABILITIES G22 "Body stats (stamina, driving skill) | None | Out" |
| WD-10-023 | Car Unlock | planned | M10-1 F opens any car; no alarm or lock mechanic is planned |
| WD-10-024 | Defensive Driver | out | CAPABILITIES G22 (driving stats out) |
| WD-10-025 | Precision Driver | out | CAPABILITIES G22 |
| WD-10-026 | Escape Artist | out | CAPABILITIES G22 |
| WD-10-027 | Off-Road Driver | out | CAPABILITIES G22 |
| WD-10-028 | Offensive Driver | out | CAPABILITIES G22 |
| WD-10-029 | Hacking skill branch | planned | M11-5 cred tiers unlock hacks (CAPABILITIES W17) |
| WD-10-030 | Extra Battery I | planned | M11-5 "a bigger battery"; battery itself M6-3 |
| WD-10-031 | Extra Battery II | missing | searched battery slot in src/; M11-5 names one bigger battery only |
| WD-10-032 | Extra Battery III | missing | same; no third tier of battery |
| WD-10-033 | ATM Hack Boost | missing | no ATMs; M6.T17 is a person's account |
| WD-10-034 | ATM Hack Boost Plus | missing | same |
| WD-10-035 | Disrupt Enemy Comms | later | ROADMAP D9 (enemy headset); the police radio jam is M6.T14 |
| WD-10-036 | Disable Reinforcement Calls | planned | M6-4, task M6.T14 "the police cannot raise the tier or call more units" for 20 s |
| WD-10-037 | Disable Helicopter | later | CAPABILITIES W11 "Jam the helicopter | Later" |
| WD-10-038 | Improved Disable Helicopter | missing | searched disable helicopter in src/; W11 names no duration upgrade |
| WD-10-039 | Activity unlock requirements | missing | searched activity, unlock requirement in src/; no activity system (M11 gigs only) |
| WD-10-040 | Bad Blood perks | missing | searched perk in src/; none |
| WD-10-041 | Followers | planned | M11-5 cred from gigs and missions (CAPABILITIES C8) |
| WD-10-042 | DedSec level | planned | M11-5 cred tiers |
| WD-10-043 | Research Points | planned | M11-5 cred tiers are the spend; no Research app |
| WD-10-044 | Key Data | missing | searched key data, laptop, stash in src/; none |
| WD-10-045 | Botnet resources | planned | M6-3 battery meter `docs/HACKING.md` |
| WD-10-046 | City Disruption branch | planned | M11-5 cred tiers; the hacks are M6-4 |
| WD-10-047 | Marksmanship branch | later | ROADMAP D9 |
| WD-10-048 | Remote CTRL branch | later | CAPABILITIES W18 (drones, RC cars later) |
| WD-10-049 | Social Engineering branch | later | CAPABILITIES W14 (phone tricks later) |
| WD-10-050 | Tinkering branch | out | CAPABILITIES W26 (crafted devices out) |
| WD-10-051 | Vehicle Hacking branch | planned | M6-4 car hijack; cred M11-5/W17 |
| WD-10-052 | Botnets branch | planned | M6-3 battery; M11-5 "a bigger battery" |
| WD-10-053 | Sleight of Hand | out | CAPABILITIES C7/G22 (weapon skill sheet out) |
| WD-10-054 | Advanced Sleight of Hand | out | CAPABILITIES C7/G22 |
| WD-10-055 | Steady Hands | out | CAPABILITIES C7/G22 |
| WD-10-056 | Keen Eye | out | CAPABILITIES C7/G22 |
| WD-10-057 | Strong Grip | out | CAPABILITIES C7/G22 |
| WD-10-058 | Target Weakness | out | CAPABILITIES C7/G22 |
| WD-10-059 | Steady Aim (WD2) | out | CAPABILITIES C7/G22 |
| WD-10-060 | Fast Trigger Finger | out | CAPABILITIES C7/G22 |
| WD-10-061 | Stun Amp Up | out | CAPABILITIES C7/G22 |
| WD-10-062 | Botnet Savings: City Hacking | out | CAPABILITIES C7/G22 (no skill tree) |
| WD-10-063 | Botnet Savings: Personal Devices | out | CAPABILITIES C7/G22 |
| WD-10-064 | Botnet Savings: Vehicle Hacks | out | CAPABILITIES C7/G22 |
| WD-10-065 | Expert RC Engineering | later | CAPABILITIES W18 |
| WD-10-066 | Expert Tinkering | out | CAPABILITIES W26 |
| WD-10-067 | Electro Shock Optimization | out | CAPABILITIES W26 |
| WD-10-068 | Explosive Optimization | out | CAPABILITIES W26 |
| WD-10-069 | Tweaked Blast | out | CAPABILITIES W26 |
| WD-10-070 | Tech points | planned | M11-5 cred from gigs and missions |
| WD-10-071 | Tech menu | planned | M11-5 cred unlocks, HUD shows the next |
| WD-10-072 | Spiderbot upgrades | later | CAPABILITIES W18 |
| WD-10-073 | Counter-drone upgrade | later | CAPABILITIES W18 |
| WD-10-074 | Deep profiler upgrade | out | CAPABILITIES W24 (recruits out) |
| WD-10-075 | Fast hacking upgrade | planned | M11-5 "a faster break-in" |
| WD-10-076 | 6G data plan | planned | M11-5 "a hack range of 60 m instead of 40" |
| WD-10-077 | AR Cloak unlock | later | CAPABILITIES W27 depends on D9 |
| WD-10-078 | Gun Jam unlock | later | ROADMAP D9 |
| WD-10-079 | Missile Drone unlock | later | CAPABILITIES W18 |
| WD-10-080 | ETO | partial | ₡ on the HUD `src/main.js:1254`, arc pays `src/sim/arc.js:129-133`; buys nothing until M11-4 |
| WD-10-081 | Defiance meter | missing | searched defiance, borough in src/; none |
| WD-10-082 | New Game+ | missing | searched new game plus in src/; N starts a fresh game `src/main.js:445` |
| WD-10-083 | Operative levels | out | CAPABILITIES W24 (play as anyone out) |
| WD-11-001 | Aiden Pearce | missing | searched aiden, pearce, baton, phone in `src/`; one unnamed fixed protagonist only (`src/sim/player.js:8`), no character identity |
| WD-11-002 | Marcus Holloway | missing | searched marcus, holloway, dedsec in `src/`; one unnamed fixed protagonist only (`src/sim/player.js:8`) |
| WD-11-003 | Play as anyone | out | CAPABILITIES W24 (play as anyone: out; one protagonist, the arc's cast) |
| WD-11-004 | Recruitment offer | out | CAPABILITIES W24 |
| WD-11-005 | Recruitment job | out | CAPABILITIES W24 |
| WD-11-006 | Deep profile recruit hunt | out | CAPABILITIES W24 |
| WD-11-007 | Team roster | out | CAPABILITIES W24 |
| WD-11-008 | Swapping operatives | out | CAPABILITIES W24 |
| WD-11-009 | Permadeath | out | CAPABILITIES W24 (no operative team to lose) |
| WD-11-010 | Injury and recovery | out | CAPABILITIES W24 |
| WD-11-011 | Operative traits | out | CAPABILITIES W24 |
| WD-11-012 | Operative lives | out | CAPABILITIES W24 |
| WD-11-013 | Combat class | out | CAPABILITIES W24; combat is operator decision D9 (`docs/ROADMAP.md:696`) |
| WD-11-014 | Stealth class | out | CAPABILITIES W24 |
| WD-11-015 | Hacking class | out | CAPABILITIES W24 |
| WD-11-016 | Defiant recruit | out | CAPABILITIES W24 (borough liberation not in the plan) |
| WD-11-017 | DudSec recruit | out | CAPABILITIES W24 |
| WD-11-018 | Bare Knuckle champion | out | CAPABILITIES W24; melee combat is D9 |
| WD-11-019 | Retire operative | out | CAPABILITIES W24 |
| WD-11-020 | Albion Affiliate | out | CAPABILITIES W24 |
| WD-11-021 | Albion Captain | out | CAPABILITIES W24 |
| WD-11-022 | Albion Grenadier | out | CAPABILITIES W24 |
| WD-11-023 | Albion Grunt | out | CAPABILITIES W24 |
| WD-11-024 | Albion Overwatch | out | CAPABILITIES W24 |
| WD-11-025 | Albion Rusher | out | CAPABILITIES W24 |
| WD-11-026 | Clan Kelley Affiliate | out | CAPABILITIES W24 |
| WD-11-027 | Clan Kelley Captain | out | CAPABILITIES W24 |
| WD-11-028 | Clan Kelley Grenadier | out | CAPABILITIES W24 |
| WD-11-029 | Clan Kelley Grunt | out | CAPABILITIES W24 |
| WD-11-030 | Clan Kelley Overwatch | out | CAPABILITIES W24 |
| WD-11-031 | Clan Kelley Rusher | out | CAPABILITIES W24 |
| WD-11-032 | Police Officer | out | CAPABILITIES W24 |
| WD-11-033 | Retired Police Officer | out | CAPABILITIES W24 |
| WD-11-034 | Anarchist | out | CAPABILITIES W24 |
| WD-11-035 | Bare Knuckle | out | CAPABILITIES W24; melee is D9 |
| WD-11-036 | Beekeeper | out | CAPABILITIES W24 |
| WD-11-037 | Construction Worker | out | CAPABILITIES W24 |
| WD-11-038 | Drone Expert | out | CAPABILITIES W24; drones are later (W18) |
| WD-11-039 | Football Hooligan | out | CAPABILITIES W24 |
| WD-11-040 | Getaway Driver | out | CAPABILITIES W24 |
| WD-11-041 | Hacker | out | CAPABILITIES W24 |
| WD-11-042 | Livestreamer | out | CAPABILITIES W24 |
| WD-11-043 | Living Statue | out | CAPABILITIES W24 |
| WD-11-044 | Paramedic | out | CAPABILITIES W24 |
| WD-11-045 | Professional Hitman | out | CAPABILITIES W24; combat is D9 |
| WD-11-046 | Protest Leader | out | CAPABILITIES W24 |
| WD-11-047 | Royal Guard | out | CAPABILITIES W24 |
| WD-11-048 | Spy | out | CAPABILITIES W24 |
| WD-11-049 | Stage Magician | out | CAPABILITIES W24 |
| WD-11-050 | Street Artist | out | CAPABILITIES W24 |
| WD-11-051 | DJ | out | CAPABILITIES W24 |
| WD-11-052 | First Responder | out | CAPABILITIES W24 |
| WD-11-053 | Activist | out | CAPABILITIES W24 |
| WD-11-054 | Artist | out | CAPABILITIES W24 |
| WD-11-055 | Driver | out | CAPABILITIES W24 |
| WD-11-056 | Entertainer | out | CAPABILITIES W24 |
| WD-11-057 | Finance worker | out | CAPABILITIES W24 |
| WD-11-058 | Gun Owner | out | CAPABILITIES W24; no guns (D9) |
| WD-11-059 | Illicit | out | CAPABILITIES W24 |
| WD-11-060 | Law worker | out | CAPABILITIES W24 |
| WD-11-061 | Mechanic | out | CAPABILITIES W24 |
| WD-11-062 | Media worker | out | CAPABILITIES W24 |
| WD-11-063 | Medical worker | out | CAPABILITIES W24 |
| WD-11-064 | Melee specialist | out | CAPABILITIES W24; melee is D9 |
| WD-11-065 | Military | out | CAPABILITIES W24 |
| WD-11-066 | Retail worker | out | CAPABILITIES W24 |
| WD-11-067 | Science worker | out | CAPABILITIES W24 |
| WD-11-068 | Sports player | out | CAPABILITIES W24 |
| WD-11-069 | Tech worker | out | CAPABILITIES W24 |
| WD-11-070 | Transient | out | CAPABILITIES W24 (walkers exist but are not playable; `src/sim/street.js` npcs) |
| WD-11-071 | Vehicle owner | out | CAPABILITIES W24 |
| WD-11-072 | Aiden Pearce (expansion) | missing | searched aiden, bloodline, expansion in `src/`; no named protagonist (arc's three people are NPCs, `src/content/arc.json`) |
| WD-11-073 | Wrench (expansion) | missing | searched wrench in `src/`; none |
| WD-11-074 | Mina Sidhu | missing | searched mina, sidhu in `src/`; none |
| WD-11-075 | Darcy Clarkson | missing | searched darcy, clarkson, assassin in `src/`; none |
| WD-11-076 | Helen Dashwood | out | CAPABILITIES W24 (a recruit) |
| WD-11-077 | Lynx | missing | searched lynx, parkour in `src/`; none |
| WD-11-078 | Stormzy | missing | searched stormzy, musician in `src/`; none |
| WD-11-079 | Unique recruits | out | CAPABILITIES W24 |
| WD-11-080 | T-Bone | missing | searched t-bone, kenney, raymond in `src/`; none |
| WD-12-001 | The Bank Job prologue | missing | searched heist, prologue, vault in `src/`; the arc opens on a blackout job, LIVE WIRE (`src/content/arc.json`) |
| WD-12-002 | Main campaign | partial | six-mission campaign built (`src/sim/arc.js:25`; `src/content/arc.json`); it is not Aiden's revenge story |
| WD-12-003 | Gang Hideouts | later | CAPABILITIES C9 (factions/gangs later); combat is operator decision D9 (`docs/ROADMAP.md:696`) |
| WD-12-004 | Criminal Convoys | later | CAPABILITIES C9; combat is D9 |
| WD-12-005 | Fixer Contracts | partial | paid contracts board `src/sim/mission.js:77-87` with 2 defs (`src/content/missions.json`); no fixer clients — M11-1 gigs |
| WD-12-006 | Alone digital trip | missing | searched digital trip, dream, minigame in `src/`; none |
| WD-12-007 | Madness digital trip | missing | searched digital trip, demon, minigame in `src/`; none |
| WD-12-008 | Spider-Tank digital trip | missing | searched spider, tank, minigame in `src/`; none |
| WD-12-009 | Psychedelic digital trip | missing | searched psychedelic, flower, minigame in `src/`; none |
| WD-12-010 | Conspiracy! digital trip | missing | searched conspiracy, cyborg, minigame in `src/`; none |
| WD-12-011 | Chess Puzzles | missing | searched chess, puzzle in `src/`; only the "chess pawn" shape comments (`src/render/npcs.js:60`) |
| WD-12-012 | Cash Run | missing | searched cash run, arcade, timer challenge in `src/`; none |
| WD-12-013 | Drinking game | missing | searched drinking, bar game in `src/`; the Tavern on Main is a story place (`src/content/arc.json`) |
| WD-12-014 | NVZN | missing | searched alien, shooter, minigame in `src/`; none |
| WD-12-015 | Poker | missing | searched poker, cards in `src/`; none |
| WD-12-016 | Shell Game | missing | searched shell game, cup, bet in `src/`; none |
| WD-12-017 | Slot machines | missing | searched slot, machine, gamble in `src/`; none |
| WD-12-018 | Privacy Invasion | missing | searched privacy, home camera in `src/`; street cameras are planned M6.T12-M6.T13, not home cams |
| WD-12-019 | QR code hunt | later | CAPABILITIES G29 (collectibles wait for the sell check) |
| WD-12-020 | Burner phones | later | CAPABILITIES G29 (collectibles) |
| WD-12-021 | Audio logs | later | CAPABILITIES G29 (collectibles) |
| WD-12-022 | City Hotspots | later | CAPABILITIES S42 (tourism later) |
| WD-12-023 | Investigations | missing | searched investigation, mystery, case in `src/`; none |
| WD-12-024 | Bad Blood story | missing | searched bad blood, expansion in `src/`; no expansion content |
| WD-12-025 | Street Sweep | missing | searched street sweep, co-op, contract in `src/`; the contracts board is not co-op |
| WD-12-026 | Fox Hunt | missing | searched fox hunt, side mission in `src/`; none |
| WD-12-027 | Main DedSec operations | partial | the six-mission campaign is built (`src/sim/arc.js:25`); no DedSec, Blume, Nudle or Prime_Eight |
| WD-12-028 | Side operations | planned | M11-1: gigs made from the sim's queued state; M11.T2 |
| WD-12-029 | Driver SF jobs | planned | M11-1 (Delivery gig: bring a car to a place by a time); M11.T4 |
| WD-12-030 | ScoutX spots | later | CAPABILITIES G26 (photo mode later); no photo activities today |
| WD-12-031 | Mayhem co-op missions | out | CAPABILITIES G28 / W25 (online out) |
| WD-12-032 | Automata | missing | searched automata, cyrux, human conditions in `src/`; no DLC content |
| WD-12-033 | Bad Medicine | missing | searched bad medicine, hospital, bratva in `src/`; none |
| WD-12-034 | Caustic Progress | missing | searched caustic, rensense, nanotech in `src/`; none |
| WD-12-035 | Off the Hook | missing | searched off the hook, dedsec operation in `src/`; none |
| WD-12-036 | Elite co-op challenges | out | CAPABILITIES G28 (online out) |
| WD-12-037 | Moscow Gambit | missing | searched moscow, bratva in `src/`; none |
| WD-12-038 | Race time trials | missing | searched race, time trial, leaderboard in `src/`; none (`src/sim/vehicle.js` is arcade handling, no racing) |
| WD-12-039 | Zodiac Killer | missing | searched zodiac, serial killer, root access in `src/`; none |
| WD-12-040 | Main story: Zero Day | partial | the six-mission campaign is built (`src/sim/arc.js:25`); no Zero Day or DedSec |
| WD-12-041 | Operation Westminster | missing | searched westminster, safehouse, bagley in `src/`; none |
| WD-12-042 | Bloody Mary Kelley | missing | searched kelley, traffick in `src/`; none |
| WD-12-043 | Falling From Grace | missing | searched skye larsen, broca in `src/`; none |
| WD-12-044 | London's Protectors | missing | searched albion, nigel cass in `src/`; none |
| WD-12-045 | Hard Reset | missing | searched hard reset, zero day in `src/`; none |
| WD-12-046 | Borough uprising mission | missing | searched borough, uprising, defiance in `src/`; none (painting districts is later, S25) |
| WD-12-047 | Defiant activities | missing | searched defiant, resistance activity in `src/`; none |
| WD-12-048 | Bare-knuckle league | missing | searched bare knuckle, boxing, league in `src/`; melee combat is D9 |
| WD-12-049 | Kick-up | missing | searched kick-up, football, keepie in `src/`; none |
| WD-12-050 | Not In Our Name | missing | searched not in our name, dedsec story in `src/`; none |
| WD-12-051 | Guardian Protocol | missing | searched guardian protocol in `src/`; none |
| WD-12-052 | Swipe Right | missing | searched swipe right in `src/`; none |
| WD-12-053 | Fall On My Enemies | missing | searched stormzy, fall on my enemies in `src/`; none |
| WD-12-054 | Legion of the Dead | missing | searched zombie, legion of the dead in `src/`; none |
| WD-12-055 | Bloodline story | missing | searched bloodline, aiden, wrench in `src/`; none |
| WD-12-056 | BrocaBridge job | missing | searched brocabridge, broca in `src/`; none |
| WD-12-057 | Aiden's Resistance missions | missing | searched aiden, resistance in `src/`; none |
| WD-12-058 | Wrench's Fixer Contracts | planned | M11-1 gigs are side contracts for clients (M11.T2); the Wrench/Jordi framing is not in the plan |
| WD-12-059 | Rempart robot fights | missing | searched rempart, robot fight in `src/`; none |
| WD-12-060 | Project THEMIS | missing | searched themis, drone project in `src/`; none |
| WD-12-061 | Slave auction raid | missing | searched slave, auction, traffick in `src/`; none |
| WD-12-062 | Darts | missing | searched darts, pub board in `src/`; none |
| WD-13-001 | Chicago map | missing | searched chicago, loop, elevated in `src/`; the city is generated from a seed (`src/sim/citygen.js`), not Chicago |
| WD-13-002 | The Loop | missing | searched loop, downtown in `src/`; districts are generated, not modelled on Chicago |
| WD-13-003 | Mad Mile | missing | searched mad mile, shopping district in `src/`; none |
| WD-13-004 | Parker Square | missing | searched parker square, residential district in `src/`; none |
| WD-13-005 | Brandon Docks | missing | searched brandon docks, docks, warehouses in `src/`; none |
| WD-13-006 | The Wards | missing | searched wards, housing projects in `src/`; none |
| WD-13-007 | Pawnee | missing | searched pawnee, rural, woods in `src/`; farmland and mountains are drawn past the edge (`src/render/outskirts.js`) but are not a walkable district |
| WD-13-008 | Cloud Gate | missing | searched cloud gate, bean, sculpture in `src/`; none |
| WD-13-009 | Willis Tower | missing | searched willis, sears in `src/`; towers are generated, not landmark models |
| WD-13-010 | Chicago River | missing | searched chicago river in `src/`; an east-west river is planned M4-2, not Chicago's |
| WD-13-011 | The L | missing | searched elevated train, the l, rail in `src/`; none |
| WD-13-012 | The Silo | missing | searched silo, t-bone in `src/`; none |
| WD-13-013 | San Francisco Bay Area map | missing | searched san francisco, oakland, marin in `src/`; one generated town per seed |
| WD-13-014 | San Francisco | missing | searched san francisco, mission district in `src/`; none |
| WD-13-015 | Oakland | missing | searched oakland in `src/`; none |
| WD-13-016 | Marin | missing | searched marin, hills in `src/`; hills are planned M4-3, not Marin |
| WD-13-017 | Silicon Valley | missing | searched silicon valley, campus in `src/`; none |
| WD-13-018 | Golden Gate Bridge | missing | searched golden gate, suspension bridge in `src/`; bridges are planned M4-2, not landmark models |
| WD-13-019 | Bay Bridge | missing | searched bay bridge in `src/`; none |
| WD-13-020 | Transamerica Pyramid | missing | searched transamerica, pyramid in `src/`; none |
| WD-13-021 | Coit Tower | missing | searched coit in `src/`; none |
| WD-13-022 | Alcatraz | missing | searched alcatraz, island prison in `src/`; none |
| WD-13-023 | Lombard Street | missing | searched lombard, switchback in `src/`; roads are grid-only (D2) |
| WD-13-024 | Ferry Building | missing | searched ferry building, pier in `src/`; none |
| WD-13-025 | City Hall | missing | searched city hall in `src/`; none |
| WD-13-026 | Restricted areas | later | CAPABILITIES C9 (factions/territory later); guards need combat, D9 |
| WD-13-027 | DedSec hackerspace | planned | M11-4 / M11.T8 (an owned building's room is a safehouse); the 3D printer is out, CAPABILITIES W26 |
| WD-13-028 | London map | missing | searched london, camden, newham in `src/`; one generated town per seed |
| WD-13-029 | Camden | missing | searched camden in `src/`; none |
| WD-13-030 | City of London | missing | searched city of london, financial district in `src/`; none |
| WD-13-031 | Islington | missing | searched islington in `src/`; none |
| WD-13-032 | Lambeth | missing | searched lambeth in `src/`; none |
| WD-13-033 | Newham | missing | searched newham in `src/`; none |
| WD-13-034 | Southwark | missing | searched southwark in `src/`; none |
| WD-13-035 | Tower Hamlets | missing | searched tower hamlets in `src/`; none |
| WD-13-036 | Westminster | missing | searched westminster in `src/`; none |
| WD-13-037 | Elizabeth Tower and Big Ben | missing | searched big ben, elizabeth tower in `src/`; none |
| WD-13-038 | Tower Bridge | missing | searched tower bridge, bascule in `src/`; bridges are planned M4-2 |
| WD-13-039 | London Eye | missing | searched london eye, observation wheel in `src/`; none |
| WD-13-040 | St Paul's Cathedral | missing | searched st paul, cathedral, dome in `src/`; none |
| WD-13-041 | Buckingham Palace | missing | searched buckingham, palace in `src/`; none |
| WD-13-042 | Piccadilly Circus | missing | searched piccadilly, billboard junction in `src/`; billboards are later (W23) |
| WD-13-043 | Trafalgar Square | missing | searched trafalgar, square, fountain in `src/`; none |
| WD-13-044 | The Shard | missing | searched shard, glass tower in `src/`; none |
| WD-13-045 | Tower of London | missing | searched tower of london, fortress in `src/`; none |
| WD-13-046 | London Underground | later | CAPABILITIES S22 (metro later); ROADMAP after the sell check (`docs/ROADMAP.md:706`) |
| WD-13-047 | River Thames | planned | M4-2 (a river at least 25 m wide with at least 2 drive-over bridges); boats are later (CAPABILITIES G5) |
| WD-13-048 | DedSec Safehouse | planned | M11-4 / M11.T8 (owned building's room is a save point) |
| WD-13-049 | Skye Larsen's house | missing | searched skye larsen, laboratory, upload in `src/`; none |
| WD-13-050 | Broca Tech | missing | searched broca, robotics campus in `src/`; none |
| WD-13-051 | Wrench's safehouse | missing | searched brixton, barrier block in `src/`; none |
| WD-13-052 | Day and night cycle | built | 12-minute day `src/sim/clock.js:8` DAY_SECS, `tickClock` advances hour (`src/sim/clock.js:34`); T jumps time `src/main.js:444` |
| WD-13-053 | Weather | partial | one GPU rain state `src/render/rain.js:18`; thunder, storms and fog are missing (CAPABILITIES S36: weather that changes is later, VGA-051) |
| WD-13-054 | ctOS surveillance grid | partial | the profiler reads people `src/sim/street.js:250`; street cameras and camera hopping are planned M6-4 (M6.T12, M6.T13); no drones |
| WD-13-055 | Borough change after uprising | missing | searched borough, uprising, albion control in `src/`; none |
| WD-13-056 | Navy Pier | missing | searched navy pier, ferris wheel in `src/`; none |
| WD-13-057 | Nudle campus | missing | searched nudle, campus in `src/`; none |
| WD-13-058 | Hackney | missing | searched hackney in `src/`; none |
| WD-13-059 | Sutro Tower | missing | searched sutro, radio tower in `src/`; none |
| WD-13-060 | Wrigley Field | missing | searched wrigley, ballpark in `src/`; none |
| WD-14-001 | Profile details | built | name, age, job, income in `src/sim/street.js:66` makeProfile; shown by the profiler `src/render/profiler.js:48` (real residents' home/work `src/render/profiler.js:46`) |
| WD-14-002 | Relationships | missing | searched partner, relationship, family, friend in `src/`; profiles carry secrets, not relationships (`src/sim/street.js:60`) |
| WD-14-003 | Criminal record | missing | searched criminal record, police record in `src/`; none (a secret may name a crime, `src/sim/street.js:60`) |
| WD-14-004 | Criminal in action | missing | searched crime in action, ctos crime in `src/`; CAPABILITIES W20 (crime prediction later) |
| WD-14-005 | Potential victim | missing | searched victim, crime about to happen in `src/`; CAPABILITIES W20 (later) |
| WD-14-006 | Street crime | later | CAPABILITIES C15 (crimes in progress to stop: later, with W20) |
| WD-14-007 | Witness reaction | planned | M10-4 (walkers within 20 m run from a car on the pavement; M10.T10) |
| WD-14-008 | Calling 911 | planned | M10-4 (a walker who saw a crime calls it in; heat cause "witness"; M10.T11) |
| WD-14-009 | Daily routines | partial | homes and jobs assigned `src/sim/people.js:54` and `:76`; commuters steer to job/home on the clock `src/sim/commute.js:47`; shopping and drinking routines are missing (interiors have no people) |
| WD-14-010 | Job descriptions | built | job list `src/sim/street.js:56`; a real resident's work is their lot `src/sim/people.js:111` |
| WD-14-011 | Street performers | missing | searched busker, performer, entertain in `src/`; "busker" is only a job label (`src/sim/street.js:58`), no performance |
| WD-14-012 | Protest crowds | missing | searched protest, crowd, gather in `src/`; none |
| WD-14-013 | Gang on turf | missing | searched gang, turf in `src/`; CAPABILITIES C9 (factions/territory later) |
| WD-14-014 | Homeless Londoners | missing | searched homeless, transient, sleep rough in `src/`; none |
| WD-14-015 | Street chatter | missing | searched chatter, conversation, ambient say in `src/`; dialogue exists only in the arc (`src/sim/arc.js`) |
| WD-14-016 | Crowd by time of day | built | walkers out by hour `src/sim/commute.js:18` SHARE and `:73` tickCommute, wired `src/main.js:1031`; render hides them `src/render/npcs.js:168` |
| WD-14-017 | Shop and cafe life | missing | searched browse, cafe, sit in `src/`; interiors are furnished but hold no people (`docs/INTERIORS.md`) |
| WD-14-018 | Commuters | missing | people walk toward home/job (`src/sim/commute.js:47`), but there are no trains or Underground (CAPABILITIES S22) |
| WD-14-019 | Drone reaction | missing | searched drone reaction, point in `src/`; no drones — CAPABILITIES W18 (later) |
| WD-14-020 | Fame reaction | missing | searched fame, recognised, crowd in `src/`; none |
| WD-14-021 | Traffic behaviour | planned | signals and stopping in M3-6 (M3.T31); traffic brakes for the player's car in M10-3 (M10.T7); car hijack reactions in M6-4 (M6.T11); no horn |
| WD-14-022 | Citizens help or hinder | missing | searched bystander, cheer, interfere in `src/`; walkers never react (ROADMAP "Living in it") |
| WD-14-023 | Armed threat reaction | missing | searched gun, weapon, cower, hands up in `src/`; combat is operator decision D9 |
| WD-15-001 | Cash | partial | ₡ paid on contract completion `src/sim/mission.js:81` and by the arc `src/sim/arc.js:172`, shown `src/main.js:1254`; no bank hacks (planned M6.T17) or minigames |
| WD-15-002 | Clothing shops | later | CAPABILITIES G20 (shops: clothes, food, barber later) |
| WD-15-003 | Weapon shop | out | CAPABILITIES C11 (gear/loot/crafting out); weapons are operator decision D9 |
| WD-15-004 | Car dealership | later | CAPABILITIES G8 (customise, store and own cars later) |
| WD-15-005 | Contract payouts | built | contracts board pays on completion `src/sim/mission.js:77-87`; the arc pays per mission `src/sim/arc.js:129-130` |
| WD-15-006 | Money | partial | contract ₡ (`src/sim/mission.js:81`) and arc ₡ (`src/sim/arc.js:172`); bank hacks are M6.T17 and side jobs M11-1 — neither built |
| WD-15-007 | Weapon purchase | out | CAPABILITIES C11 (gear out); no weapons (D9) |
| WD-15-008 | Printing costs | out | CAPABILITIES W26 (craft gadgets: out) |
| WD-15-009 | Driver SF pay | planned | M11-1 Delivery gig pays its ₡ (M11.T4) |
| WD-15-010 | ETO | partial | one currency, ₡, from contracts and missions (`src/sim/mission.js:81`, `src/sim/arc.js:172`); hacks pay nothing and no caches exist |
| WD-15-011 | ETO caches | later | CAPABILITIES G29 (collectibles after the sell check) |
| WD-15-012 | Crypto skimming | out | CAPABILITIES W24 (operative traits out); no passive income in `src/` |
| WD-15-013 | Skilled investor | out | CAPABILITIES W24 (operative traits out) |
| WD-15-014 | Signing bonuses | out | CAPABILITIES W24 (operative traits out) |
| WD-15-015 | Shopaholic | out | CAPABILITIES W24; shops are later (G20) |
| WD-15-016 | Vehicle detailing | out | CAPABILITIES W24 |
| WD-15-017 | Tech points as a separate currency | planned | M11-5 cred tiers unlock a bigger battery, hack range and better gigs (`docs/ROADMAP.md:563`); cred is not money |
| WD-15-018 | Bloodline payments | missing | searched bloodline, expansion, eto in `src/`; none |
| WD-15-019 | VIP status | missing | searched vip, deluxe, season pass in `src/`; none |
| WD-15-020 | No in-game purchases of power | built | no store or purchase code in `src/` (searched buy, purchase, iap, microtransaction); `package.json` has no payment dependency |
| WD-15-021 | Crime prevention reward | later | CAPABILITIES W20 (crime prediction later) |
| WD-16-001 | Coats and jackets | later | CAPABILITIES G21 (character customisation later); the player is one fixed avatar (`src/render/player.js`) |
| WD-16-002 | Hats and caps | later | CAPABILITIES G21 |
| WD-16-003 | Masks and scarves | later | CAPABILITIES G21 |
| WD-16-004 | Shoes | later | CAPABILITIES G21 |
| WD-16-005 | Glasses | later | CAPABILITIES G21 |
| WD-16-006 | Outfit sets | later | CAPABILITIES G21 |
| WD-16-007 | Digital trip outfits | missing | searched digital trip, outfit in `src/`; no digital trips and no customisation (G21 later) |
| WD-16-008 | T-Bone outfits | later | CAPABILITIES G21; no expansion content or T-Bone |
| WD-16-009 | Tops and jackets (Marcus) | later | CAPABILITIES G21 |
| WD-16-010 | Pants | later | CAPABILITIES G21 |
| WD-16-011 | Shoes (Marcus) | later | CAPABILITIES G21 |
| WD-16-012 | Hats (Marcus) | later | CAPABILITIES G21 |
| WD-16-013 | Glasses (Marcus) | later | CAPABILITIES G21 |
| WD-16-014 | Outfit sets (Marcus) | later | CAPABILITIES G21 |
| WD-16-015 | T-Bone clothing set | later | CAPABILITIES G21; no expansion content |
| WD-16-016 | Service clothing | later | CAPABILITIES G21 |
| WD-16-017 | Root Access outfits | later | CAPABILITIES G21; no bundle content |
| WD-16-018 | Operative clothing | out | CAPABILITIES W24 (no operatives); customisation is later (G21) |
| WD-16-019 | Aiden's outfit | later | CAPABILITIES G21; no Aiden |
| WD-16-020 | Wrench's masks | later | CAPABILITIES G21; no Wrench |
| WD-16-021 | DedSec car skin | later | CAPABILITIES G8 (customise, store and own cars later) |
| WD-16-022 | Mask collectibles | later | CAPABILITIES G29 (collectibles after the sell check) |
| WD-16-023 | DedSec mask | later | CAPABILITIES G21 |
| WD-17-001 | Smartphone | later | CAPABILITIES G17 (phone later, with WD2's apps); no phone code in `src/` |
| WD-17-002 | Profiler app | partial | reads name, age, job, income `src/render/profiler.js:48`; cannot act on the profile — call it in is later (M6 table), bank transfer is M6.T17 |
| WD-17-003 | Car on Demand app | later | CAPABILITIES C12 (call your car later) |
| WD-17-004 | Music app | later | CAPABILITIES G23 (radio waits for audio) |
| WD-17-005 | Digital Trips app | missing | searched digital trip, dream app in `src/`; no trips and no phone (G17 later) |
| WD-17-006 | QR scanner | later | CAPABILITIES G29 (collectibles after the sell check) |
| WD-17-007 | Map app | planned | M10-2 / M10.T6 (map screen, click a waypoint, route along the graph) |
| WD-17-008 | Health bar | later | CAPABILITIES G10 (no health today; Wasted depends on D9) |
| WD-17-009 | Ammo counter | later | CAPABILITIES G11 / D9 (no weapons) |
| WD-17-010 | Battery meter | planned | M6-3 / M6.T4 (one meter, refills over time, HUD shows it) |
| WD-17-011 | Focus meter | planned | M6-3 / M6.T22 (Focus spends battery while held) |
| WD-17-012 | Minimap | planned | M10-2 / M10.T5 (2D-canvas overlay, roads within 150 m, heading, marker, police) |
| WD-17-013 | Search circle display | partial | the search ring is drawn in the world `src/render/heli.js:156`; no minimap to show it on (M10-2) |
| WD-17-014 | Objective marker | built | amber column over the place in hand `src/render/arc.js:194`, objective line and distance `src/render/arcui.js`; contract steps `src/main.js` missionPanel |
| WD-17-015 | Enemy marking | missing | searched tag, outline, enemy mark in `src/`; no enemies — combat is D9 |
| WD-17-016 | Hack prompts | planned | M6-1 / M6.T2 (nearest hackable in sight highlights with name and cost); no timing diamond is planned |
| WD-17-017 | Reputation display | missing | searched reputation, hero, villain in `src/`; citizen reputation is not in the plan (cred is M11-5) |
| WD-17-018 | DedSec phone | later | CAPABILITIES G17 (phone hub later) |
| WD-17-019 | DedSec map | planned | M10-2 (the map of the town with a waypoint and route; no DedSec activities) |
| WD-17-020 | Operations app | planned | M11-1 / M11.T2 (gig board shown in the journal with a marker) |
| WD-17-021 | Research app | planned | M11-5 (cred tiers unlock hacks and gigs; no research-points system) |
| WD-17-022 | ScoutX app | later | CAPABILITIES G26 (photo mode later) |
| WD-17-023 | Driver SF app | planned | M11-1 / M11.T4 (Delivery gig offered on the board, paid on completion) |
| WD-17-024 | Media player app | later | CAPABILITIES G23 (audio later) |
| WD-17-025 | Multiplayer app | out | CAPABILITIES G28 / W25 (online out) |
| WD-17-026 | Botnet resource meter | planned | M6-3 / M6.T4 (battery meter; hacks spend it) |
| WD-17-027 | Follower counter | missing | searched follower, dedsec level in `src/`; not in the plan (cred is M11-5) |
| WD-17-028 | Tailing progress meter | missing | searched tailing, tail progress in `src/`; the Tail gig is planned M11-1, no meter named |
| WD-17-029 | Bagley interface | missing | searched bagley, ai assistant in `src/`; none |
| WD-17-030 | Team menu | out | CAPABILITIES W24 (no operatives) |
| WD-17-031 | Tech menu | planned | M11-5 (cred and the next unlock on the HUD; no named menu) |
| WD-17-032 | Mission journal | built | J toggles the journal `src/render/arcui.js:54`, content `src/render/arcui.js:110`; contract steps in the mission panel `src/main.js:1252` |
| WD-17-033 | Weapon mode indicator | later | CAPABILITIES G11 / D9 (no weapons) |
| WD-17-034 | Operative portrait | out | CAPABILITIES W24 |
| WD-17-035 | Alert indicator | partial | police heat stars on the HUD `src/main.js:1254`; no enemy-group alert state (combat D9) and no minimap (M10-2) |
| WD-17-036 | Defiance progress | missing | searched defiance, borough progress in `src/`; none |
| WD-17-037 | Currency readouts | built | ₡ on the HUD `src/main.js:1254` and earned in the journal `src/render/arcui.js:122`; cred is planned M11-5 |
| WD-17-038 | Spiderbot HUD | missing | searched spiderbot, camera view in `src/`; drones are later (W18) |
| WD-17-039 | Drone HUD | missing | searched drone hud, hijack in `src/`; CAPABILITIES W18 (later) |
| WD-17-040 | Profiler overlay | built | live panel for the target person `src/render/profiler.js:13`, updated each frame `src/main.js:1190` |
| WD-17-041 | Underground fast travel map | later | CAPABILITIES S22 (metro later) |
| WD-17-042 | Weapon wheel | later | CAPABILITIES G11 / D9 (no weapons) |
| WD-17-043 | Gadget wheel | later | CAPABILITIES W26 (crafted gadgets out); nothing to select |
| WD-17-044 | Hack battery (Legion) | planned | M6-3 / M6.T4 (one battery meter for every hack) |
| WD-17-045 | Map legend | missing | searched map legend, icon list in `src/`; M10-2's map covers roads, the player and the mission marker only |
| WD-17-046 | SongSneak app | missing | searched songsneak, song, recognise in `src/`; radio is later (G23) |
| WD-18-001 | Online Hacking | out | CAPABILITIES G28 (Online: out); W25 (online invasion: out) |
| WD-18-002 | Online Tailing | out | CAPABILITIES G28 |
| WD-18-003 | ctOS Mobile Challenge | out | CAPABILITIES G28 |
| WD-18-004 | Online free roam (WD1) | out | CAPABILITIES G28 |
| WD-18-005 | Hacking Invasion (WD2) | out | CAPABILITIES G28 / W25 |
| WD-18-006 | Bounty Hunter | out | CAPABILITIES G28 |
| WD-18-007 | Co-op missions (WD2) | out | CAPABILITIES G28 |
| WD-18-008 | Showd0wn | out | CAPABILITIES G28 |
| WD-18-009 | Online free roam (WD2) | out | CAPABILITIES G28 |
| WD-18-010 | Online invite and toggle | out | CAPABILITIES G28 |
| WD-18-011 | Legion Online free roam | out | CAPABILITIES G28 |
| WD-18-012 | Legion Online co-op missions | out | CAPABILITIES G28 |
| WD-18-013 | Tactical Ops | out | CAPABILITIES G28 |
| WD-18-014 | Spiderbot Arena | out | CAPABILITIES G28 |
| WD-18-015 | Online mode toggle (Legion) | out | CAPABILITIES G28 |
| WD-18-016 | Team carried online | out | CAPABILITIES G28 / W24 (no operative team) |
| WD-18-017 | Co-op sync actions | out | CAPABILITIES G28 |
| WD-18-018 | Online event pop-ups | out | CAPABILITIES G28 |
| WD-18-019 | Friendly fire off | out | CAPABILITIES G28 (no co-op partners) |
| WD-18-020 | No online in Bloodline | out | CAPABILITIES G28 (the game has no online at all) |
| WD-18-021 | Online Decryption | out | CAPABILITIES G28 |
| WD-18-022 | Invasion (Legion) | out | CAPABILITIES G28 / W25 |
| WD-19-001 | Licensed soundtrack | later | CAPABILITIES G23 (radio waits for licensed music); no audio code anywhere in `src/` |
| WD-19-002 | Original score | missing | searched score, music in `src/`; M7 builds sound, not a score (M7-1) |
| WD-19-003 | Car radio | later | CAPABILITIES G23 |
| WD-19-004 | Combat music | missing | no audio in `src/`; combat is D9 and no score is planned |
| WD-19-005 | City ambience | planned | M7-1 / M7.T3 (street ambience by hour and district) |
| WD-19-006 | Profiled phone audio | missing | calls are planned as subtitles only (M6.T15, M6.T16); no voice audio in `src/` |
| WD-19-007 | Licensed soundtrack (WD2) | later | CAPABILITIES G23 |
| WD-19-008 | Original score (WD2) | missing | searched score, hudson mohawke in `src/`; none |
| WD-19-009 | Car radio (WD2) | later | CAPABILITIES G23 |
| WD-19-010 | Haum and shop music | later | CAPABILITIES G23 (needs audio and licensed music) |
| WD-19-011 | Original score (Legion) | missing | searched score, stephen barton in `src/`; none |
| WD-19-012 | Car radio (Legion) | later | CAPABILITIES G23 |
| WD-19-013 | Bagley voice | missing | searched bagley, voice in `src/`; none |
| WD-19-014 | Protest soundscape | missing | searched protest, chant, megaphone in `src/`; none |
| WD-19-015 | Subtitle sound cues | missing | only dispatch subtitles exist (`src/ui/dispatch.js`); no sound-cue subtitles |
| WD-19-016 | Hack audio cues | planned | M7-1 / M7.T7 (the blackout's sound dies and comes back); scan and fail cues are not named |
| WD-20-001 | Difficulty settings | missing | searched difficulty, easy, hard in `src/`; none |
| WD-20-002 | Aim assist | missing | searched aim assist in `src/`; no aiming (combat is D9) |
| WD-20-003 | Aim sensitivity | planned | M7-4 / M7.T10 (mouse speed and invert settings); no aiming today (D9) |
| WD-20-004 | Invert Y axis | planned | M7-4 / M7.T10 (mouse invert) |
| WD-20-005 | Vibration | missing | searched vibration, rumble in `src/`; M7.T15 adds a gamepad but no rumble is named |
| WD-20-006 | Subtitles | planned | M7-4 / M7.T10 (subtitle size); on/off and language are not named — dispatch and arc subtitles are always on |
| WD-20-007 | HUD toggles | missing | searched hud toggle, hide hud in `src/`; none in the plan |
| WD-20-008 | Language | missing | searched language, localization in `src/`; localization waits for after the sell check (`docs/ROADMAP.md:712`) |
| WD-20-009 | Brightness | missing | searched brightness, gamma, calibration in `src/`; none |
| WD-20-010 | Audio sliders | planned | M7-4 / M7.T10 (volumes), M7.T1 (master, effects and ambience buses) |
| WD-20-011 | Controller layout | missing | searched controller layout, button preset in `src/`; M7.T15 maps a standard pad, no layout presets |
| WD-20-012 | Checkpoint restart | partial | busted resets the contract in hand `src/main.js:1156` and the arc rewinds to the last choice (`docs/ARC.md`); no checkpoints |
| WD-20-013 | Manual save | partial | `writeSave` via `saveNow` and autosave `src/main.js:472`; one slot `src/savestore.js:4`; three named slots are planned M7-7 |
| WD-20-014 | Autosave | built | every 30 s `src/main.js:465-466` and on the tab going away `src/main.js:487-489` |
| WD-20-015 | Difficulty settings (WD2) | missing | searched difficulty in `src/`; none |
| WD-20-016 | Extended HUD options | missing | no HUD settings anywhere in `src/` |
| WD-20-017 | Mission replay | missing | searched mission replay, replay mission in `src/`; the only replay is input replay for tests (`?replay=`) |
| WD-20-018 | Difficulty settings (Legion) | missing | searched difficulty in `src/`; none |
| WD-20-019 | Resistance Mode toggle | out | CAPABILITIES W24 (no operative system); permadeath is not in the plan |
| WD-20-020 | Photo mode | later | CAPABILITIES G26 (photo mode later) |
| WD-20-021 | Photo filters | later | CAPABILITIES G26 |
| WD-20-022 | Photo field of view | later | CAPABILITIES G26 |
| WD-20-023 | Photo time of day | later | CAPABILITIES G26; play has T alone (`src/main.js:444`) |
| WD-20-024 | Photo poses | later | CAPABILITIES G26 |
| WD-20-025 | Photo mode in Bloodline | later | CAPABILITIES G26; no expansion content is planned |
| WD-20-026 | Colorblind support | missing | searched colorblind in `src/`; accessibility waits for after the sell check (`docs/ROADMAP.md:712`) |
| WD-20-027 | Subtitle size | planned | M7-4 / M7.T10 (subtitle size) |
| WD-20-028 | Performance and quality modes | planned | M7-4 / M7.T10 (quality: shadow distance, resolution scale), M7-6 (60 fps target) |
| WD-20-029 | Cross-generation upgrade | missing | searched cross-gen, upgrade, save transfer in `src/`; none |
| WD-20-030 | Tutorial prompts | planned | M7-5 / M7.T12 (one hint per key, gone once done; `content/hints.json`) |
| WD-20-031 | PC graphics options | planned | M7-4 / M7.T10 (shadow distance, resolution scale); vsync and resolution are not named |
| WD-21-001 | Trophies and achievements | planned | M9-6 (at least 10 Steam achievements from an event tape; M9.T7) |
| WD-21-002 | Season Pass (WD1) | missing | searched season pass, bad blood in `src/`; no store or DLC code exists |
| WD-21-003 | Pre-order packs | missing | searched pre-order, bonus pack in `src/`; none |
| WD-21-004 | Uplay rewards | missing | searched uplay, club points in `src/`; none |
| WD-21-005 | Watch Dogs Complete Edition | missing | searched complete edition in `src/`; none |
| WD-21-006 | Legion season pass | missing | searched season pass, bloodline in `src/`; none |
| WD-21-007 | Deluxe Edition | missing | searched deluxe, dissident, vip in `src/`; none |
| WD-21-008 | Ultimate Edition | missing | searched ultimate edition in `src/`; none |
| WD-21-009 | Collector's Edition | missing | searched collector, steelbook in `src/`; none |
| WD-21-010 | Statistics page | missing | searched statistics, play time, takedown count in `src/`; the HUD shows draws/fps/tris `src/main.js:1249`, but no player statistics |
| WD-21-011 | Easter eggs | missing | searched easter egg, reference in `src/`; none |
| WD-21-012 | Fallen operative memorial | out | CAPABILITIES W24 (no operatives) |
| WD-21-013 | Skye Larsen choice | missing | searched skye larsen, mind upload in `src/`; none |
| WD-21-014 | Dog in a spiderbot | missing | searched dog, spiderbot in `src/`; none |
| WD-21-015 | Wrench's news drone argument | skip | input row says WRONG (the scene is WD2, not Bloodline) |
| WD-21-016 | Ubisoft Connect challenges | out | CAPABILITIES G28 (online out) |
| WD-21-017 | In-game credits | missing | searched credits, credits roll in `src/`; none |
| WD-21-018 | Watch Dogs 2 season pass | missing | searched season pass, human conditions in `src/`; none |
| WD-21-019 | Root Access Bundle | missing | searched root access, zodiac in `src/`; none |
| WD-21-020 | DedSec stories bundles | missing | searched dedsec stories, story pack in `src/`; none |
| WD-21-021 | Single-player DLC packs | missing | searched untouchables, palace, signature shot in `src/`; none |
