# M30 — Online

From: `docs/plan/features/mechanics.md` GAP-18-001 and GAP-20-011;
`docs/plan/CAPABILITIES.md` G28 (GTA Online, Watch Dogs' online modes and Legion Online,
233 features). When it closes, up to 16 players share one Urbis city: free roam with
events, co-op missions and heists, races, fights and hacker duels, organisations with
businesses and properties, crews, a creator for jobs, progress that lasts, and servers the
community can host. **Urbis's own turn on it:** a session can run on a player's own
saved city, and its owner can build in the city view while friends live in the street:
build it, live in it, together. Everything stays grounded: no glowing trails, super
powers or orbital weapons; where a mode has one, it gets a real-world form. Pillars:
build it, live in it; chaos has an author (now several).

Needs first: every street milestone (M10-M13, M16-M27), M29 (saves, the companion page,
platforms), M9.T2 (the Steam binding: accounts, friends, lobbies). Lane: online, new.

## Keys

- **M held** opens the interaction menu (tap M is still the map; the tap-and-hold rule).
- **Enter** opens text chat; **\`** held talks on voice chat.
- Every mode's own controls are the street's; the creator uses the city view's mouse.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M30-1 | **Online characters:** each account has two slots; a character is made in M25-1's creator, with a heritage (a face blended from two parents) and a lifestyle that sets the starting attributes (M23-2); its looks change later at a surgeon for a fee. Online progress is kept apart from the story's; cheats are off online. The account's profile keeps stats, photos (M27-4) and friends. Legion-style crews (M21) and gear carry into online; story packs stay offline | `tests/accept/m30-character.spec.js` | red: no online code | GAP-18-001 |
| M30-2 | **Sessions:** public, invite, friends, crew and solo sessions of up to 16 players, matched by Steam lobbies, joined from the friends list or the phone, with online switched on or off at any time; passive mode; a bad-sport lobby for those reported often; vote kick and report; text and voice chat with mute; a player list and a kill feed; spectating a friend; an idle player is warned, then dropped; Windows, Mac and Linux players play together | `tests/accept/m30-session.spec.js` | red | — |
| M30-3 | **Whose city:** a session runs on the host's saved city, or a new seed for a public session; the owner opens the city view while others are in the street, and every build reaches every player within 1 s; the owner can give friends building rights; the city's sim keeps running for everyone | `tests/accept/m30-city.spec.js` | red | — |
| M30-4 | **Netcode:** a host or a dedicated server runs `src/sim` (pure) in Node; players send inputs, and see each other within 100 ms on a 50 ms link; a dropped player rejoins into the same state within 10 s; the server checks every change of money and items, so a modified client cannot make money or items | `tests/m30-net.test.js`, `tests/accept/m30-cheat.spec.js` | partial: the sim is pure and deterministic (`src/sim`) | — |
| M30-5 | **The interaction menu and the online HUD:** M held opens it: style and walk, snacks and armour from the inventory, quick GPS, services, the organisation, passive mode; map icons filter by kind and crew members show in the crew's colour; a rank and its experience bar; business notifications; the phone lists jobs and services and has an online app | `tests/accept/m30-menu.spec.js` | red | — |
| M30-6 | **Co-op:** every story-like mission kind (M24) can be played by 2-4; sync takedowns when two players act at once; friendly fire off by default; short co-op strands for 2; hard raids for 4 with elite challenges | `tests/accept/m30-coop.spec.js` | red | — |
| M30-7 | **Heists online:** M24-6's heists for 2-4 players, with roles and the leader's cuts, setups and preps, bonuses for a full set done by the same crew and for elite challenges, and a hard mode; seven heists made from the seed's places: a small bank, a prison break, a lab raid, a big bank vault, a three-act heist on a military site, a casino, and an island compound reached by sea with scouting, approaches, extra loot and a solo run | `tests/m30-heists.test.js`, `tests/accept/m30-heists.spec.js` | red | — |
| M30-8 | **Races online:** land, sea, air, stunt (on ramps and tubes built in the creator), transform (the vehicle changes at a checkpoint), special vehicle, open wheel, oval, races with weapons on, a weekly premium race, and a top-down race of small remote cars; slipstream and catch-up are lobby settings | `tests/accept/m30-races.spec.js` | red | — |
| M30-9 | **Fights online:** deathmatch (free, team, vehicle), captures, last team standing, survival in waves, an arena with points and sponsors, and 20 grounded adversary modes (a hunter in the dark with a torch, runners against riders, one bullet each, a truck chased by cyclists, a bomb truck with escorts, a runner in a classic car chased by police cars, platforms that drop, a protected target, a tank against the rest, revival of downed teammates, one armoured player against a team, cars shoving off a platform, cars launched at a target, power-ups that cut rivals' weapons or radar, a runner with a ball, teams that swap weapons, an air strike called from a console, a shrinking zone with armed vehicles) | `tests/accept/m30-fights.spec.js` | red | — |
| M30-10 | **Hacker modes:** hacking into another player's game to steal data while hiding among the crowd; tailing another player unseen; a bounty on a player that others hunt; team fights over an encrypted file; teams with hacks against each other; an arena for small robots (M20-9); and a phone challenge: a player on M29-12's companion page works traffic lights and traps against a player in a car | `tests/accept/m30-hackmodes.spec.js` | red | — |
| M30-11 | **Free roam:** events that pop up for all (hold a spot, carry a parcel, checkpoints), challenges (longest wheelie, highest fall survived), business battles over a crate, time trials, bounties players put on each other, bets on jobs, gang hideouts that fight back, security vans to rob, kill streaks, and a hospital bill when wasted | `tests/accept/m30-freeroam.spec.js` | red | — |
| M30-12 | **Organisations:** a player registers a company (CEO) or a motorcycle club (president) and others join as associates or prospects; each has abilities (go dark, bribe the police to drop a wanted level, drop ammo, call a ride), VIP work and an app; a contact clears the wanted level for a fee; going off the radar costs ₡ | `tests/accept/m30-org.spec.js` | red | — |
| M30-13 | **Businesses:** warehouses for special cargo and for stolen cars (source and sell), a hangar for air cargo, a bunker with research and a shooting range, motorcycle-club businesses with supply and sell runs, a lab, a nightclub with a warehouse and technicians, a garment factory, laundering fronts, a salvage yard with robberies, a car workshop with contracts, and special vehicles for their own jobs; rivals raid them; each charges utility and staff fees | `tests/m30-business.test.js`, `tests/accept/m30-business.spec.js` | red | — |
| M30-14 | **Properties and services:** apartments that friends can be invited into; an office, a clubhouse, a facility with a strike console (an air strike, a strike team, a small drone), a mobile command truck, a hacker's van with a terminal, an arcade, a casino penthouse, an agency, a body shop, a bail office, a yacht; property sites on the city's internet (M27-2) sell them; owned aircraft, boats and armoured vehicles are delivered to a pickup on call; a car meet where crews paint their colours; night-vision and thermal goggles and a hazmat suit | `tests/accept/m30-property.spec.js` | red | — |
| M30-15 | **Contract strands:** 14 mission strands for online, each from a contact: an agency's celebrity case, security contracts, payphone hits, the casino's story, a drug ring, errands for a street crew, a war on a private army, mercenary jobs, dispatch calls for a deputy, a strand against an arms dealer, client jobs from the hacker's van, the yacht's missions, the lowrider club's, and a visit to a recording studio | `tests/accept/m30-strands.spec.js` | red | — |
| M30-16 | **Progress that lasts:** a rank from experience; career progress per kind of work; a career start that picks a line of work and gives its first property; discounts unlocked by doing the work; awards; daily objectives, weekly bonuses, seasonal events and a news feed of them; leaderboards; platform challenges | `tests/accept/m30-progress.spec.js` | red | — |
| M30-17 | **Crews:** a crew with ranks, an emblem and colours, its members' blips and cars in its colour | `tests/accept/m30-crews.spec.js` | red | — |
| M30-18 | **The creator:** players build races, deathmatches and captures in the city view's creator, publish them, and the best are marked verified; playlists, bookmarks, a job list, quick join, and a lobby with its settings | `tests/accept/m30-creator.spec.js` | red | — |
| M30-19 | **Paid items:** packs of in-game ₡, a monthly membership with daily rewards, a starter pack and casino chips, each only if the operator decides (below); without the decision, none of them exists in the build | `tests/accept/m30-store.spec.js` | red | GAP-20-011 |
| M30-20 | **Community servers:** a server package anyone can run, with its own scripts and mods, listed in a server browser | `tests/accept/m30-community.spec.js` | red | — |
| M30-21 | **Draws:** other players are drawn from the people pool with their clothes merged (M25-16), their vehicles from M18's pools; a full session of 16 holds the frame at or under 175 | the ledger | — | — |
| M30-22 | **Soak:** 16 bots play a dedicated server for 2 hours: no desync, no lost money, memory flat within 10% | `scripts/soak.mjs` | red | — |
| M30-23 | The server keeps each online character's progress, money, properties, businesses and crew; a crash loses at most 1 minute | `tests/accept/m30-save.spec.js` | red | — |
| M30-24 | The sweep of every online mode, menu, business and property with real players on two machines has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M30.T1 | **Checks, red: the frame.** `m30-character.spec.js`, `m30-session.spec.js`, `m30-city.spec.js`, `m30-net.test.js`, `m30-cheat.spec.js`, `m30-menu.spec.js`, `soak.mjs`, `m30-save.spec.js` | new `tests/accept/m30-character.spec.js`, new `tests/accept/m30-session.spec.js`, new `tests/accept/m30-city.spec.js`, new `tests/m30-net.test.js`, new `tests/accept/m30-cheat.spec.js`, new `tests/accept/m30-menu.spec.js`, new `scripts/soak.mjs`, new `tests/accept/m30-save.spec.js` | M29.T18 | M30-1 to M30-5, M30-22, M30-23 red | S |
| M30.T2 | **The server.** `src/sim` running in Node; inputs in, state out; a package (below) for the socket | new `server/index.js`, new `server/session.js`, `package.json` | M30.T1 | M30-4 (part) | M |
| M30.T3 | **The client's link.** Inputs sent, state applied, other players smoothed, rejoining | new `src/net/client.js`, new `src/net/remote.js`, `src/main.js` | M30.T2 | M30-4 (part) | M |
| M30.T4 | **Server checks.** Every money and item change checked; a modified client's attempts refused and logged | `server/session.js`, new `server/checks.js` | M30.T3 | M30-4 | M |
| M30.T5 | **Accounts and characters.** Steam sign-in, two slots, heritage and lifestyle, the profile, the store of progress | new `server/accounts.js`, `src/ui/creator.js`, new `src/ui/online.js` | M30.T2, M9.T2, M25.T4 | M30-1 | M |
| M30.T6 | **Sessions.** Lobbies and matchmaking; kinds; invites; passive mode; bad sport; kick and report; idle drop | `server/session.js`, `src/net/client.js`, `src/ui/online.js` | M30.T3 | M30-2 (part) | M |
| M30.T7 | **Chat and the list.** Text and voice chat with mute; the player list; the kill feed; spectating | new `src/net/chat.js`, `src/ui/feed.js`, `src/game/camera.js` | M30.T6 | M30-2 | M |
| M30.T8 | **Whose city.** A session on a saved city; the owner's city view; builds to all within 1 s; building rights | `server/session.js`, `src/sim/ops.js`, `src/sim/cityview.js` | M30.T6 | M30-3 | M |
| M30.T9 | **The interaction menu and HUD.** M held; filters; crew colours; rank bar; business notes; the phone's lists and app | new `src/ui/interaction.js`, `src/ui/minimap.js`, `src/game/hud.js`, `src/ui/phone.js` | M30.T6 | M30-5 | M |
| M30.T10 | **Server saves.** Characters, money, properties, businesses and crews on the server; at most 1 minute lost | new `server/store.js` | M30.T5 | M30-23 | M |
| M30.T11 | **Checks, red: play.** `m30-coop.spec.js`, `m30-heists.test.js`, `m30-heists.spec.js`, `m30-races.spec.js`, `m30-fights.spec.js`, `m30-hackmodes.spec.js`, `m30-freeroam.spec.js` | new `tests/accept/m30-coop.spec.js`, new `tests/m30-heists.test.js`, new `tests/accept/m30-heists.spec.js`, new `tests/accept/m30-races.spec.js`, new `tests/accept/m30-fights.spec.js`, new `tests/accept/m30-hackmodes.spec.js`, new `tests/accept/m30-freeroam.spec.js` | M30.T1 | M30-6 to M30-11 red | S |
| M30.T12 | **Co-op.** Missions for 2-4; sync takedowns; friendly fire; short strands; hard raids and elite challenges | `src/sim/mission.js`, `server/session.js`, new `content/online/coop.json` | M30.T11, M24.T2 | M30-6 | M |
| M30.T13 | **Heists online.** Roles, cuts, setups, bonuses, hard mode; seven heists by place | `src/sim/heists.js`, new `content/online/heists.json`, `src/ui/heistboard.js` | M30.T12 | M30-7 | M |
| M30.T14 | **Races online.** Ten race kinds; the weekly race; lobby settings | `src/sim/races.js`, new `content/online/races.json` | M30.T11, M24.T17 | M30-8 | M |
| M30.T15 | **Fights online.** Deathmatch kinds, captures, last team standing, survival, the arena | new `src/sim/modes.js`, new `content/online/modes.json` | M30.T11, M13.T7 | M30-9 (part) | M |
| M30.T16 | **Adversary modes.** Twenty modes, each grounded | `src/sim/modes.js`, `content/online/modes.json` | M30.T15 | M30-9 | M |
| M30.T17 | **Hacker modes.** Invading, tailing, bounties, the file fight, team hacks, the robot arena, the phone challenge | `src/sim/modes.js`, `src/sim/hackables.js`, `src/platform/companion.js` | M30.T11, M20.T13 | M30-10 | M |
| M30.T18 | **Free roam.** Events, challenges, battles, trials, bounties, bets, hideouts, vans, streaks, bills | new `src/sim/freeroam.js`, `server/session.js` | M30.T11 | M30-11 | M |
| M30.T19 | **Checks, red: owning.** `m30-org.spec.js`, `m30-business.test.js`, `m30-business.spec.js`, `m30-property.spec.js`, `m30-strands.spec.js`, `m30-progress.spec.js`, `m30-crews.spec.js`, `m30-creator.spec.js`, `m30-store.spec.js`, `m30-community.spec.js` | new `tests/accept/m30-org.spec.js`, new `tests/m30-business.test.js`, new `tests/accept/m30-business.spec.js`, new `tests/accept/m30-property.spec.js`, new `tests/accept/m30-strands.spec.js`, new `tests/accept/m30-progress.spec.js`, new `tests/accept/m30-crews.spec.js`, new `tests/accept/m30-creator.spec.js`, new `tests/accept/m30-store.spec.js`, new `tests/accept/m30-community.spec.js` | M30.T11 | M30-12 to M30-20 red | S |
| M30.T20 | **Organisations.** Registering, members, abilities, VIP work, apps; the wanted-level contact; off the radar | new `src/sim/orgs.js`, `src/ui/phone.js`, `src/sim/wanted.js` | M30.T19 | M30-12 | M |
| M30.T21 | **Cargo businesses.** Special cargo, stolen cars, air cargo; source and sell; raids | new `src/sim/onlinebiz.js`, new `content/online/business.json` | M30.T20, M22.T7 | M30-13 (part) | M |
| M30.T22 | **Production businesses.** The bunker and research, the range, club businesses, the lab, the nightclub, the factory, fronts, the salvage yard, the workshop, special vehicles; fees | `src/sim/onlinebiz.js`, `content/online/business.json` | M30.T21 | M30-13 | M |
| M30.T23 | **Properties and services.** Apartments and invites; each property and its use; the strike console; the sites; deliveries; the car meet; goggles and the hazmat suit | new `src/sim/onlineprops.js`, `src/sim/property.js`, `src/sim/sites.js` | M30.T20 | M30-14 | M |
| M30.T24 | **Contract strands** (lane: story). Fourteen strands in `content/online/strands/` | new `content/online/strands/`, `src/sim/mission.js` | M30.T23 | M30-15 | M |
| M30.T25 | **Progress.** Rank; career progress and the career start; discounts; awards; dailies, weeklies, seasons and their feed; leaderboards; challenges | new `server/progress.js`, `src/ui/online.js` | M30.T19, M30.T10 | M30-16 | M |
| M30.T26 | **Crews.** Ranks, emblem, colours on blips and cars | new `server/crews.js`, `src/render/traffic.js` | M30.T19 | M30-17 | S |
| M30.T27 | **The creator.** Building and publishing races, deathmatches and captures; verified; playlists, bookmarks, the job list, quick join, the lobby | new `src/ui/creator-jobs.js`, new `server/jobs.js` | M30.T19, M30.T14, M30.T15 | M30-18 | M |
| M30.T28 | **Paid items,** only if the operator decides; otherwise the check proves none exist | new `server/store-items.js`, `src/ui/online.js` | M30.T19 | M30-19 | S |
| M30.T29 | **Community servers.** The package, scripts, mods, the browser | `server/`, new `docs/SERVER.md`, `src/ui/online.js` | M30.T19, M30.T4 | M30-20 | M |
| M30.T30 | **Close.** The ledger (M30-21); the soak (M30-22); the sweep on two machines; one commit per defect; M held, Enter and \` in the hints | the sweep, the ledger, `scripts/soak.mjs`, `content/hints.json` | all of the above | M30-21, M30-22, M30-24 | M |

## Decisions for the operator

- **Servers:** where they run and what they cost a month (a cloud host for matchmaking,
  saves and dedicated sessions).
- **Packages:** a WebSocket server package (`ws`) and, for voice, WebRTC support.
- **Paid items** (M30-19): sell in-game money, a membership and packs, or not at all.
- **Moderation:** who handles reports, and the age rating's online notice.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M30-1 | GTA-12-013 to GTA-12-018, GTA-16-003, GTA-19-022, GTA-20-016, WD-18-016, WD-18-020 |
| M30-2 | GTA-14-023, GTA-14-024, GTA-15-022, GTA-15-023, GTA-16-088, GTA-16-090, GTA-16-091, GTA-16-094, GTA-16-095, GTA-16-096, GTA-16-128, GTA-16-133, GTA-20-019, GTA-20-025, WD-18-004, WD-18-009, WD-18-010, WD-18-011, WD-18-015 |
| M30-4 | GTA-19-035 |
| M30-5 | GTA-12-011, GTA-13-012, GTA-13-013, GTA-14-010, GTA-14-035, GTA-14-041, GTA-14-042, GTA-14-049, GTA-16-113, WD-17-025 |
| M30-6 | GTA-16-038, GTA-16-063, WD-12-031, WD-12-036, WD-18-007, WD-18-012, WD-18-013, WD-18-017, WD-18-019 |
| M30-7 | GTA-07-101, GTA-16-041 to GTA-16-059, GTA-16-120, GTA-16-129 |
| M30-8 | GTA-16-007, GTA-16-008, GTA-16-010 to GTA-16-014, GTA-16-027, GTA-16-117, GTA-16-118, GTA-16-119 |
| M30-9 | GTA-16-015 to GTA-16-019, GTA-16-021 to GTA-16-026, GTA-16-028 to GTA-16-034, GTA-16-036, GTA-16-037, GTA-16-039, GTA-16-040, GTA-16-121 to GTA-16-127 |
| M30-10 | WD-18-001, WD-18-002, WD-18-003, WD-18-005, WD-18-006, WD-18-008, WD-18-014, WD-18-021, WD-18-022 |
| M30-11 | GTA-07-050, GTA-07-060, GTA-11-051, GTA-16-084 to GTA-16-087, GTA-16-089, GTA-16-092, GTA-16-111, GTA-16-112, WD-18-018 |
| M30-12 | GTA-06-037, GTA-06-038, GTA-06-039, GTA-11-020, GTA-11-026, GTA-13-014, GTA-13-015, GTA-16-079 to GTA-16-083 |
| M30-13 | GTA-04-041, GTA-04-042, GTA-04-043, GTA-11-021 to GTA-11-025, GTA-11-027 to GTA-11-031, GTA-11-036, GTA-11-039, GTA-11-040, GTA-11-043, GTA-11-044, GTA-16-064, GTA-16-065, GTA-16-073, GTA-16-074, GTA-16-130, GTA-16-131 |
| M30-14 | GTA-04-040, GTA-04-044, GTA-04-057, GTA-04-059, GTA-11-032 to GTA-11-035, GTA-11-037, GTA-11-038, GTA-11-041, GTA-11-042, GTA-12-035, GTA-12-037, GTA-13-021, GTA-13-022, GTA-16-075, GTA-16-076, GTA-16-077, GTA-16-115 |
| M30-15 | GTA-11-050, GTA-16-060, GTA-16-061, GTA-16-062, GTA-16-066 to GTA-16-072, GTA-16-078, GTA-16-110, GTA-16-116 |
| M30-16 | GTA-11-048, GTA-16-004, GTA-16-105, GTA-16-106, GTA-16-107, GTA-16-108, GTA-16-132, GTA-20-004, GTA-20-027, WD-21-016 |
| M30-17 | GTA-16-097, GTA-16-098, GTA-16-099 |
| M30-18 | GTA-14-025, GTA-16-005, GTA-16-093, GTA-16-100 to GTA-16-104 |
| M30-19 | GTA-11-045, GTA-11-046, GTA-11-047, GTA-20-017, GTA-20-018 |
| M30-20 | GTA-19-030, GTA-19-031, GTA-19-032, GTA-19-033 |
