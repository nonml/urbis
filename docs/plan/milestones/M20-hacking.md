# M20 — All of hacking

From: `docs/plan/features/mechanics.md` GAP-07-001 to GAP-07-021; `docs/plan/CAPABILITIES.md`
W8's remote drive, W11, W14, W15, W16, W18, W19, W21, W23, W26, C14 and C20, D9's combat
hacks, and M6's later rows (distract, remote deactivation). When it closes, every device
in the city can be hacked as in Watch Dogs and Cyberpunk: turrets and cameras turned on
their owners, buildings' alarms cut and their keys stolen, hacks that spread, drones and
remote cars flown and driven, gadgets printed, enemy hackers fought, and any street
camera's footage rewound to solve a crime. Cyberpunk's quickhacks are hacks on the
city's real devices; its braindance is recorded footage; its cyberspace is a puzzle on a
screen. Pillars: hack it; every tool is expressive; chaos has an author.

Needs first: M6 (the registry, aim, the hack key and menu, battery, control boxes,
cameras, Focus), M11-5 (cred unlocks), M13 (combat, guards, throwables, stealth), M15-17
(telecom: the network hacks travel on), M19 (guarded places, police forces). Lane: hack.

## Keys

- Every hack fires with M6's hack key and its menu; nothing new for the hacks themselves.
- **Gadgets** sit on the lower half of M13's Tab wheel; the chosen one deploys with **G**
  (G throws). Driving a drone or a remote car: W, A, S and D move it, the mouse turns it,
  **Space** rises and **C** falls (a drone), the hack key fires its own action, and **Esc**
  hands control back (Esc closes the innermost thing).
- **In a camera view** (M6), the mouse wheel scrubs the footage back up to 10 game
  minutes; **Space** plays and pauses it.
- **A hacking puzzle** is played with the mouse; a setting skips puzzles.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M20-1 | **Turn it on them:** a guarded place's turrets and cameras (M19-12) are hackable; a hacked turret fires on its owners for 20 s; the player can take one over and aim it with the mouse; a camera hacked to "alarm" sends its guards the wrong way. A junction box overloaded beside guards stuns them for 4 s. An overload hack destroys a device for good: it stays dead until repaired by a crew in 1 game day | `tests/accept/m20-turn.spec.js` | red: M6 plans street devices only | GAP-07-001, GAP-07-016, GAP-07-017 |
| M20-2 | **Buildings:** a building's alarm panel and cameras can be cut before going in, and then a break-in raises no heat; a guard or manager carries system keys a hack steals, which open its secure doors; gates, garage doors, forklifts and scissor lifts are hackable (a lift raises the player to a roof or a ledge); a guarded site's mainframe in its deepest room is hacked in person, after a puzzle (M20-11); every device in a room can be switched off at once. Hacking goes up a building too: a lift is hacked to stop at a floor; a node on a roof gives every camera on the block, looking down on the street | `tests/accept/m20-buildings.spec.js` | red | GAP-07-003, GAP-07-005, GAP-07-010 |
| M20-3 | **Profiles:** the profiler (built) gains each person's whole day from the sim (home, work, the places they visit and when), their friends, family and enemies (M21), and what they dislike; people with large balances or keys are marked as worth a look in Focus. A wrist watch (gear, M25) marks targets and calls an owned car (M18-15) | `tests/accept/m20-profile.spec.js` | partial: name, home and job (`street.js` `profilerTarget`) | GAP-07-004, GAP-07-007, GAP-07-014 |
| M20-4 | **Seeing:** in Focus, hackable things show through walls within 20 m; in a camera view, the player tags people and cars the camera sees and the tags stay on the minimap for 60 s; one scan (a cred unlock) tags every enemy within 30 m. The player hops from camera to camera and to drones (M20-8) within sight of each other | `tests/accept/m20-seeing.spec.js` | partial: M6 plans one camera view, M6-1 hides things behind walls | GAP-07-011, GAP-07-012, GAP-07-013, GAP-07-015 |
| M20-5 | **Hacks that spread and reach:** a spreading hack jumps from its target to up to 4 people or devices within 8 m; a mass hack makes every car within 40 m brake, swerve or floor it at once; a car can be steered left or right by hack; a parked car's locks open by hack, so taking it sets off no alarm (M18-7) and no witness calls it in; any hack can be fired at a thing seen through a camera, so the player stays in cover | `tests/accept/m20-spread.spec.js` | red: M6 hacks one car | GAP-07-006, GAP-07-008, GAP-07-021 |
| M20-6 | **Distract, lure and report:** a parked car's alarm, a person's phone, a speaker or a vending machine draws people within 15 m to it for 8 s; a lure brings one guard to a place; report a person as a criminal or put out a false all-points bulletin, and the police come for them; cancel an emergency call; cut a district's phone network for 30 s; a billboard or video screen shows what the player picks, and people stop to look | `tests/accept/m20-distract.spec.js` | red: M6's later rows | GAP-07-009 |
| M20-7 | **The helicopter:** the police helicopter can be jammed (its searchlight and marksman lose the player for 15 s) or, with a cred unlock, forced to go back to base | `tests/accept/m20-heli.spec.js` | red | — |
| M20-8 | **Drones:** the player's quadcopter flies 150 m from them for 3 minutes, scans walls for people, and boosts; a camera drone and a delivery drone can be flown; cargo drones are hijacked to lift a box or a person; police and enemy drones (riot, shock, camera, kamikaze) are hijacked and turned, or made to dive into a target. A counter-drone gadget downs drones within 20 m | `tests/accept/m20-drones.spec.js` | red: none | — |
| M20-9 | **Remote cars and robots:** an RC car with a spring jumps 3 m, taunts, and drops a gadget where it goes; a small legged robot crawls into vents; an RC tank shoots a paint round; RC races and time trials (6 per city) on courses from the map. A remote car can hack what it reaches | `tests/accept/m20-rc.spec.js` | red | — |
| M20-10 | **Enemy hackers:** in hacker-crew turf (M19-9) and at guarded sites, an enemy hacker traces the player: a ring fills over 8 s while they are in the hacker's sight, and a finished trace locks the player's hacks for 10 s and does a heavy hit; breaking sight or taking the hacker down stops it. Combat hacks: shock a person (2 s), jam a gun (5 s), cut a squad's radio, set off a grenade on a belt; a top-tier hack takes every enemy within 10 m down without killing them | `tests/accept/m20-enemyhack.spec.js` | red | GAP-07-019, GAP-07-020 |
| M20-11 | **The puzzle:** breaking into a guarded site's network is a code-matching puzzle on a grid, 3-6 codes long, against a timer; each matched sequence gives an effect (camera off, guards' radio off, cheaper hacks). Access points (public routers, ATMs) give ₡ and parts by the same puzzle. A setting skips puzzles for a 30% smaller reward; another turns the timer off | `tests/m20-puzzle.test.js`, `tests/accept/m20-puzzle.spec.js` | red: M6's break-in is hold E for 3 s | GAP-07-018, GAP-17-038 |
| M20-12 | **The city crash:** a story mission (M24) gives the player one crash a city: every light, signal, transit line, phone and camera in the city goes off for 3 game minutes; traffic jams, the police lose their radio, and the news runs on it for a game day. A/B against the blackout of one district | `tests/accept/m20-crash.spec.js` | partial: the blackout of one district (H) | GAP-07-002 |
| M20-13 | **Gadgets:** a 3D printer at any safehouse prints gadgets from parts (from access points, loot and shops): IEDs, proximity IEDs, a shock device, a paint bomb, smoke, tear gas, a phone that rings as a lure, a decoy speaker that plays the player's voice, a grappling launcher that pulls the player to a ledge 20 m away, a kinetic charger that stores a punch, a shockwave device; each costs parts and a print time; gadget skills (M23) cut costs and add effects | `tests/accept/m20-gadgets.spec.js` | red | — |
| M20-14 | **Footage:** any street, shop or building camera the player has hacked keeps its last 10 game minutes. In the camera view, the mouse wheel scrubs back; Space plays; layers show the picture, the sound (who said what nearby) and heat (a thermal camera where fitted); scanning a frame marks clues. Investigations (M24) need it: a crime is solved by finding its moment on the footage | `tests/accept/m20-footage.spec.js` | red | — |
| M20-15 | **Draws:** drones, remote cars and robots are one pooled kind each; hack lines and tags are the existing hack effects; M20 adds at most 3 draws | the ledger | — | — |
| M20-16 | A saved game keeps destroyed devices, stolen keys, parts, printed gadgets, the drones and remotes owned, and continues the same | `tests/accept/m20-save.spec.js` | red | — |
| M20-17 | The sweep of every M20 hack and gadget, at play distance and in the camera view, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M20.T1 | **Checks, red: devices and people.** `m20-turn.spec.js`, `m20-buildings.spec.js`, `m20-profile.spec.js`, `m20-seeing.spec.js`, `m20-spread.spec.js`, `m20-distract.spec.js`, `m20-heli.spec.js` | new `tests/accept/m20-turn.spec.js`, new `tests/accept/m20-buildings.spec.js`, new `tests/accept/m20-profile.spec.js`, new `tests/accept/m20-seeing.spec.js`, new `tests/accept/m20-spread.spec.js`, new `tests/accept/m20-distract.spec.js`, new `tests/accept/m20-heli.spec.js` | M6.T23 | M20-1 to M20-7 red | S |
| M20.T2 | **Turrets, cameras and junction boxes.** Registered at guarded places; turning, taking over and aiming; the overload stun; destroyed devices and their repair | `src/sim/hackables.js`, `src/sim/guards.js`, `src/sim/combatai.js`, `src/game/camera.js` | M20.T1, M19.T16 | M20-1 | M |
| M20.T3 | **Building security.** Alarm panels and cameras; system keys on guards; gates, doors, forklifts and lifts; the mainframe room; room-wide switch-off | `src/sim/hackables.js`, `src/sim/interior.js`, `src/sim/robbery.js` | M20.T1, M33.T3 | M20-2 | M |
| M20.T4 | **Profiles.** The whole day from the sim, the people around them, dislikes; the worth-a-look mark; the watch | `src/sim/street.js`, `src/sim/people.js`, `src/sim/talk.js`, `src/render/overlays.js` | M20.T1, M21.T2 | M20-3 | M |
| M20.T5 | **Seeing.** Things through walls in Focus; tags from cameras on the minimap; the area scan; hopping between cameras and drones | `src/sim/hackables.js`, `src/ui/minimap.js`, `src/render/hackfx.js` | M20.T1 | M20-4 | M |
| M20.T6 | **Spread and reach.** The spreading hack; the mass car hack; steering a car; hacks fired through a camera | `src/sim/hackables.js`, `src/sim/traffic.js`, `src/sim/vehicle.js` | M20.T5 | M20-5 | M |
| M20.T7 | **Distract, lure and report.** Alarms, phones, speakers, machines; the lure; reports and false bulletins; cancelled calls; the phone network cut; billboards and screens | `src/sim/hackables.js`, `src/sim/walkers.js`, `src/sim/response.js`, `src/render/signs.js` | M20.T1, M19.T7 | M20-6 | M |
| M20.T8 | **The helicopter.** Jamming and sending it home | `src/sim/response.js`, `src/sim/flight.js` | M20.T1 | M20-7 | S |
| M20.T9 | **Checks, red: machines and puzzles.** `m20-drones.spec.js`, `m20-rc.spec.js`, `m20-enemyhack.spec.js`, `m20-puzzle.test.js`, `m20-puzzle.spec.js`, `m20-crash.spec.js`, `m20-gadgets.spec.js`, `m20-footage.spec.js`, `m20-save.spec.js` | new `tests/accept/m20-drones.spec.js`, new `tests/accept/m20-rc.spec.js`, new `tests/accept/m20-enemyhack.spec.js`, new `tests/m20-puzzle.test.js`, new `tests/accept/m20-puzzle.spec.js`, new `tests/accept/m20-crash.spec.js`, new `tests/accept/m20-gadgets.spec.js`, new `tests/accept/m20-footage.spec.js`, new `tests/accept/m20-save.spec.js` | M20.T1 | M20-8 to M20-14, M20-16 red | S |
| M20.T10 | **Drones, sim.** The quadcopter's range, time, scan and boost; flying camera and delivery drones; hijacking cargo, police and enemy drones; dive; counter-drone | new `src/sim/drones.js`, `src/sim/hackables.js`, `src/game/input.js` | M20.T9 | M20-8 (part) | M |
| M20.T11 | **Remote cars and robots, sim.** The spring car, the legged robot in vents, the RC tank; RC races and trials from the map; hacking from a remote | new `src/sim/remotes.js`, `src/sim/hackables.js`, `src/sim/ledges.js` | M20.T10 | M20-9 (part) | M |
| M20.T12 | **Drones and remotes, drawn.** Models from M2's pipeline, one pool each; the drone camera | new `src/render/remotes.js`, `src/game/camera.js`, `public/assets/models/` | M20.T11 | M20-8, M20-9, M20-15 (part) | M |
| M20.T13 | **Enemy hackers and combat hacks.** The trace ring and lock; shock, gun jam, radio cut, the belt grenade; the top-tier takedown | new `src/sim/enemyhackers.js`, `src/sim/combatai.js`, `src/sim/hackables.js` | M20.T9, M13.T7, M13.T28 | M20-10 | M |
| M20.T14 | **The puzzle, sim.** The grid, codes, timer and effects; access points; the skip setting; `m20-puzzle.test.js` passes | new `src/sim/puzzle.js`, `src/sim/hackables.js` | M20.T9 | M20-11 (part) | M |
| M20.T15 | **The puzzle, shown.** The screen's grid, mouse play, the timer and effects | new `src/ui/puzzle.js` | M20.T14 | M20-11 | S |
| M20.T16 | **The city crash.** Every light, signal, line, phone and camera off for 3 game minutes; the jams, the radio, the news | `src/sim/power.js`, `src/sim/transit.js`, `src/sim/telecom.js`, `src/sim/news.js` | M20.T9, M15.T22, M16.T4 | M20-12 | M |
| M20.T17 | **Gadgets.** The printer, parts, print times; the twelve gadgets; skills from M23 | new `src/sim/gadgets.js`, new `src/content/gadgets.json`, `src/sim/throwables.js`, `src/ui/weaponwheel.js` | M20.T9, M13.T43 | M20-13 | M |
| M20.T18 | **Footage, sim.** A ring of 10 game minutes per hacked camera: people's and cars' tracks, lines heard, heat; clues marked by scanning | new `src/sim/footage.js`, `src/sim/hackables.js` | M20.T9 | M20-14 (part) | M |
| M20.T19 | **Footage, shown.** Scrubbing, playing, the three layers, clue marks; ghosts of past people drawn from the walker pool | `src/game/camera.js`, `src/render/npcs.js`, `src/render/hackfx.js`, `src/ui/hud.js` | M20.T18 | M20-14 | M |
| M20.T20 | **The draw cost.** The ledger with drones, remotes and footage ghosts at the busiest pose | `perf.json`, `src/render/remotes.js` | M20.T19 | M20-15 | S |
| M20.T21 | **Save** keeps everything in M20-16 | `src/sim/save.js` | M20.T20 | M20-16 | M |
| M20.T22 | **Close.** The sweep of every hack and gadget; one commit per defect; the new keys in the hints | the sweep, `content/hints.json` | all of the above | M20-17 | M |

## Decisions for the operator

None.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M20-1 | WD-01-013 |
| M20-2 | WD-01-011, WD-01-016, WD-01-021, WD-01-022, WD-04-009, CP-05-042 |
| M20-5 | WD-03-006, WD-03-008 |
| M20-6 | WD-01-031, WD-01-032, WD-01-034, WD-02-007, WD-02-011, WD-02-013, WD-02-017, WD-02-024, WD-02-025, WD-05-024, WD-10-049, CP-05-037 |
| M20-7 | WD-03-010, WD-10-037 |
| M20-8 | WD-03-011, WD-03-012, WD-03-013, WD-03-023 to WD-03-034, WD-03-037, WD-10-073, WD-10-079 |
| M20-9 | GTA-04-047, GTA-04-048, GTA-10-049, GTA-10-083, WD-03-014 to WD-03-022, WD-03-039, WD-05-009, WD-05-031, WD-10-048, WD-10-065, WD-10-072 |
| M20-10 | WD-02-021, WD-05-015, WD-10-035, WD-10-078 |
| M20-11 | WD-04-008, CP-05-045, CP-05-046, CP-05-048, CP-05-050 |
| M20-13 | WD-05-005 to WD-05-008, WD-05-010 to WD-05-013, WD-05-017, WD-05-018, WD-05-021, WD-05-025, WD-05-026, WD-05-027, WD-05-032, WD-10-021, WD-10-050, WD-10-066 to WD-10-069, WD-15-008, WD-17-043 |
| M20-14 | CP-09-088 to CP-09-093 |
