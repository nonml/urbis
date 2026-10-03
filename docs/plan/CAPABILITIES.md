# Capabilities: the four games, line by line

On 2026-10-03 the operator asked: "Are you sure you cover all capabilities from Cities:
Skylines + Watch Dogs + GTA + Cyberpunk?" No, the plan did not. It covered the core
of each leg and said nothing about the rest. A player of those games would have
noticed the gaps within minutes:

- the player can drive only their own car (`main.js` `toggleVehicle` checks `nearHero()`);
- there is no minimap and no waypoint;
- walkers never react to anything;
- the ₡ the arc pays out shows on the HUD (`main.js:1254`) and buys nothing.

This file goes through what each game lets a player do, every line, and gives each a
decision. Claude wrote it as director. The operator can veto any line.

## How a line is decided

| Decision | When it applies |
|---|---|
| **Built** | It exists today; the source is named |
| **M#** | It is in a milestone before the sell check, with its criterion. A capability goes here when a player of that game misses it in their **first 20 minutes** and it passes a pillar's test (`AGENTS.md`) |
| **M13 to M34** | Everything else, since D15 (2026-10-04): every capability of the four games is planned. The line names its criterion, and what it was before (later, out or the operator's) with the old reason, which still says what the grounded form must avoid |
| **Operator** | A matter of taste or tone, not engineering: the operator decides |

## Cities: Skylines (I and II): building

| # | Capability | Urbis today | Decision | Where |
|---|---|---|---|---|
| S1 | Zone homes, shops, works | R C I brushes on the generated lots (`CITYVIEW.md`) | Built | — |
| S2 | Density and office zones | Lots grow EMPTY → HIGH; three uses, no office | M5: a height cap is the density choice. Office: M14-10 (D15) | M5-4, M14-10 |
| S3 | Demand bars per use | The sim has demand; the city view shows only "waiting for demand" on a lot | **M5, added** | M5-8 |
| S4 | Buildings level up with land value | Stages EMPTY → HIGH, district wealth (`ECONOMY.md`) | Built | — |
| S5 | Abandonment with a reason | Decline with a reason (`ZONING.md`) | Built | — |
| S6 | Draw roads | None | M5 (on the grid) | M5-1 |
| S7 | Road types (2 or 4 lanes, one-way) and upgrading a road in place | None | **M5, added**: capacity follows the type in M3's traffic | M5-10 |
| S8 | Curved roads, free angles | Grid only | **M14 (D15)**, was later (D2) | M14-1 |
| S9 | Highways, interchanges, elevated roads, tunnels | None | **M14 (D15)**, was later (world-scale plank 2) | M14-4, M14-5 |
| S10 | Traffic lights, stop signs, roundabouts | None | M3: a light at every junction. **M5, added:** lights, stop or yield per junction. Roundabouts: M14-5 (D15) | M3-6, M5-14, M14-5 |
| S11 | Bulldoze anything | Lots only | M5 | M5-2, M5-3 |
| S12 | Undo | None | **M5, added**: Ctrl+Z within 10 game seconds, full refund | M5-7 |
| S13 | Electricity: plants, lines, coverage | Power by district; the blackout hack | **M12:** plants make MW, districts use it by floor area, substations carry it; a shortfall darkens blocks through the blackout's own code. Cables are not drawn: they run under every road | M5-5, M12-1 |
| S14 | Water and sewage pipes | None | **M12:** a pumping station on the river and a treatment plant, both buildings with doors; pipes are not drawn, they run under every road (a second network under the first has nothing to see at street scale) | M12-2 |
| S15 | Garbage collection | None | **M12:** a depot's trucks collect; uncollected bags pile on the pavement and lower land value | M12-3 |
| S16 | Police | None as a service | M5: police station | M5-5 |
| S17 | Fire: stations, burning buildings | None | M5: the station. **M12:** buildings catch fire and a truck drives out. Fires that spread: M15-9 (D15) | M5-5, M12-4, M15-9 |
| S18 | Health: clinic, hospital, ambulances | None | M5: clinic. **M12:** ambulances. Hospital: M15-5 (D15) | M5-5, M12-5, M15-5 |
| S19 | Deathcare | None | **M15 (D15)**, was later: Later, with ageing (S28): a city where people age needs somewhere for them to end. The earlier "out" contradicted S28 | M15-8 |
| S20 | Education levels that gate jobs | None | M5: school (wealth recovery). Education levels: M15-10 (D15) | M5-5, M15-10 |
| S21 | Parks and plazas | None | M5 | M5-5 |
| S22 | Public transport (bus, tram, metro, train, taxi, ferry, air) | None | **M16 (D15)**, was later: Bus, tram, metro: later. Train: later, on M4's road in from outside. Taxi: later (G25). Ferry: later, on M4's river. Air: out (G5) | M16-5 to M16-14 |
| S23 | Budget: taxes, service budgets, loans | None | M5: taxes and upkeep. Service sliders and loans: M15-13 (D15) | M5-6, M15-13 |
| S24 | City and district policies | None | **M14 (D15)**, was later | M14-18 |
| S25 | Paint and name districts | Districts are generated and named by the map (M3, M4) | **M14 (D15)**, was later: Painting: later | M14-7 |
| S26 | Info views | None | M5: six overlays and **a coverage view per service** | M5-8 |
| S27 | Pollution and noise | None | **M5, added:** works pollute and busy roads make noise (edge load from M3's commute flow); home demand and land value fall | M5-11 |
| S28 | Citizens with homes, jobs and a life | Residents with homes and jobs (`people.js`) | Built. Ageing and births: M15-8 (D15), with deathcare (S19) | M15-8 |
| S29 | Goods trucks, import and export | None | **M14, M16 (D15)**, was later: goods from works to shops by van, and imports on M4's road in from outside | M16-4, M14-14 |
| S30 | Milestones that unlock tools as the city grows | None | **M5, added**: population tiers unlock services and road types | M5-12 |
| S31 | Unique buildings and landmarks | Pinned towers | **M14 (D15)**, was later | M14-19 |
| S32 | Natural disasters | None | **M15 (D15)**, was out: chaos in Urbis comes from the player; a disaster is an act with no actor (pillar 4) | M15-23 to M15-25 |
| S33 | Terraforming, placing water | Generated terrain (M4) | **M14 (D15)**, was out: M4 makes terrain the authority every placement asks; editing it undoes that | M14-22 |
| S34 | More land to build on | The outskirts | M4 and M5: open land around the town | M5-1 |
| S35 | Chirper | The news line (`news.js`) | Built | — |
| S36 | Day, night, weather | A 12-minute day; rain in every outdoor frame (`main.js:1102`); the storm lifecycle, VGA-051, is open | Built: day and night. **Weather that changes: M2-7, changed** (always raining makes rain the signature `AGENTS.md` says weather is not). Storms, lightning, fog: M26-1, and their look (VGA-051) M34-9 (D15) | M2-7, M26-1, M34-9 |
| S37 | Industry chains (raw goods → processing → products) | None | **M14 (D15)**, was out: a second economy; Urbis's is jobs, homes and firms by district | M14-14, M14-15 |
| S38 | Parking | None | **M16 (D15)**, was later: the kerbs are lined with parked cars today; car parks and a parking policy are a Skylines II loop worth having after the sell check. The earlier "out" gave no reason | M16-17 |
| S39 | Asset editor, mods | None | **M31 (D15)**, was later (`BACKLOG.md`) | M31-2, M31-5 |
| S40 | Mixed use (homes over shops, Skylines II) | One use per lot | **M14 (D15)**, was later: the row buildings already look it, shopfronts under flats; the economy counts one use per parcel until then | M14-10 |
| S41 | A highway in from outside | None: the town is an island | **M4, added:** one regional road enters at the map's edge; through-traffic and commuters from outside use it | M4-9 |
| S42 | Tourism | Three HOTEL signs (`content/signs.json`), the arc's hotel | **M14 (D15)**, was later: visitors on the road from outside, spending in shops near hotels and landmarks; a demand on shops, not a second economy | M14-20 |
| S43 | Specialised industry and natural resources | Farmland and mountains past the edge | **M14 (D15)**, was later: farmland and forest feeding works districts | M14-15 |
| S44 | Telecom and network coverage | None | **M15 (D15)**, was later. Worth noting for then: in Urbis the network could be what a hack travels on, tying building to hacking | M15-17 |
| S45 | Seasons, snow, heating, road gritting | One rain state | **M15, M26 (D15)**, was later: Later, after VGA-051's weather | M15-18, M26-2 |
| S46 | **Service fleets** (fire trucks, garbage trucks, ambulances) | Police cruisers only | **M12** | M12-5 |
| S47 | **Services with a catchment and a capacity** | None: M5 had each service lift a whole district, which pillar 4 forbids | **M5, changed** | M5-5, M5-8 |
| S48 | Statistics and graphs over time | The latest value only | **M5, added:** a history panel | M5-15 |
| S49 | Happiness and well-being | Wealth and demand per district | **M15 (D15)**, was later: it needs the catchments (S47) to be about a building, not a district | M15-14 |
| S50 | City crime rate and prisons | Police answer the player's heat only (`WANTED.md`) | **M19 (D15)**, was later | M19-4 |
| S51 | Service building upgrades and extensions | None | **M15 (D15)**, was later | M15-21 |
| S52 | Bicycles, cycle and foot paths | Bike hoops are drawn | **M16 (D15)**, was later | M16-16 |
| S53 | Decoration: trees, plazas, fences placed by hand | None | **M14 (D15)**, was later | M14-21 |
| S54 | Road wear and maintenance | Wear is drawn (VGA-028), not simulated | **M15 (D15)**, was later | M15-19 |
| S55 | Traffic accidents with no player in them | None | **M15 (D15)**, was later: Later, with tow trucks and the fleets | M15-20 |
| S56 | Rent, affordability, homelessness | `decline.js` reserves "rents" as a cause | **M15 (D15)**, was later | M15-15 |
| S57 | Post | None | **M15 (D15)**, was later: Later, with the fleets | M15-16 |
| S58 | Scenarios, challenges, climates | One climate | **M14, M31 (D15)**, was later | M14-24, M31-4 |
| S59 | Drag a zone brush across many lots | One lot per click | **M5, added (D14)** | M5-4 |
| S60 | Problem icons over buildings | Only the lot under the cursor shows its reason | **M5, added (D14)**: one icon per held-back building, its first cause | M5-16 |
| S61 | Pause and game speed | `?speed` is a test flag (M0-2) | **M5, added (D14)**: Space pauses the city view; 1, 2 and 4 times | M5-17 |
| S62 | Name the city | The seed only | **M7, added (D14)**: a name from the seed, which the player can change | M7-2 |
| S63 | Population on screen; unlocks announced; unemployment | Homes per district in a panel; the jobless counted, not shown | **M5, added (D14)** | M5-12, M5-15 |
| S64 | Tool tooltips; right click puts a tool down | Brush keys only | **M5, added (D14)** | M5-7 |

## GTA (V): living in it

| # | Capability | Urbis today | Decision | Where |
|---|---|---|---|---|
| G1 | Walk, run | Walk, and Shift runs at 6 m/s against 3.4 (`sim/player.js:5-6`) | Built. A stamina limit: M17-10 (D15), first out as a limit with nothing to decide | M17-10 |
| G2 | Jump, climb, vault | None: Space does nothing | **Jump: M10, changed (D14):** a GTA player presses Space in the first seconds. Climb and vault: M17-2 (D15) | M10-9, M17-2 |
| G3 | Swim; a car in the water | No water yet | **M10**: once M4 makes a river, the player and cars need a rule for it | M10-5 |
| G4 | Drive | The hero car | Built | — |
| G5 | Other vehicles: motorbikes, trucks, buses, boats, aircraft | Cars only | **M18 (D15)**, was later: Motorbike, truck, bus, boat: later. Aircraft: **out**, because a player in the air sees the whole city at once, which breaks street scale and the 175-draw frame | M18-2, M18-3, M18-9 to M18-11 |
| G6 | **Take any car**: break into a parked one, pull a driver out | Only the hero car (`nearHero()`) | **M10** | M10-1 |
| G7 | Car damage, wrecks | No car collision: `vehicle.js:1` says "No collision yet — road-clamped only"; only the roadblock collides (`response.js`) | **M10**: collision first, then damage | M10-3 |
| G8 | Customise, store and own cars | None | **M18 (D15)**, was later | M18-15 to M18-17 |
| G9 | Wanted levels that escalate | ★ to ★★★: cruisers, spikes, roadblock, helicopter, search ring, dispatch (`WANTED.md`) | Built. ★4-5 depend on D9 | — |
| G10 | Busted, wasted | Busted restarts the mission (`arc.js`); no health | Built (busted). Wasted depends on D9 | — |
| G11 | **Fight: melee, guns, cover** | None | **M13 (D15)**, was the operator's (D9) | M13-2 to M13-13 |
| G12 | People react: flee, call the police | Walkers never react | **M10** | M10-4 |
| G13 | Ambient events (an argument, an arrest, a busker) | None | **M21, M24 (D15)**, was later (`VISUAL-GAPS.md`) | M21-3, M24-8 |
| G14 | Story missions | Six-mission arc (`ARC.md`) | Built. More: the 60-mission campaign, M24-2 (D15) | M24-2 |
| G15 | Side jobs and activities | None | **M11**: gigs | M11-1 |
| G16 | **Minimap, map screen, waypoint, GPS route** | A mission marker only (`mission.js`) | **M10**: a 600 m town (M4) cannot be crossed without one | M10-2 |
| G17 | Phone: contacts, texts | The journal (`ARC.md`) | **M21, M27 (D15)**, was later: Later, with Watch Dogs 2's apps (car on demand, music, scout) | M27-1, M21-11 |
| G18 | **Money to spend** | ₡ from the arc on the HUD; nothing buys | **M11** | M11-4 |
| G19 | Buy property and businesses that pay | None | **M11**: the player buys any grown building; its trade pays them | M11-4 |
| G20 | Shops: clothes, food, barber | The noodle bar (`INTERIORS.md`) | **M22, M25 (D15)**, was later (the next nine interiors) | M22-1, M25-3, M25-4 |
| G21 | Character customisation | None | **M25 (D15)**, was later | M25-1 |
| G22 | Body stats (stamina, driving skill) | None | **M23 (D15)**, was out: growth lives in M11's cred (hacks and gigs), not a stat sheet | M23-4, M23-5 |
| G23 | Car radio | None (`ARC.md` defers it until there is audio) | **Music: M7, changed (D14):** two stations of CC0 instrumental music, and a score under missions and chases; all four games have music from the title screen on. DJs, talk and news voices: M28-2 and M28-4 (D15), with the voices the operator decides (M24) | M7-10, M28-2, M28-4 |
| G24 | Physics: ragdolls, lamp posts knocked flat | None | **M17 (D15)**, was later | M17-5 |
| G25 | Taxi, fast travel | None | **M16 (D15)**, was later | M16-13, M16-14 |
| G26 | Photo mode | None | **M27 (D15)**, was later (`BACKLOG.md`) | M27-4 |
| G27 | Stock market moved by the player's acts | None | **M22 (D15)**, was later: firms already move between districts | M22-6 |
| G28 | Online | None | **M30 (D15)**, was out | M30 |
| G29 | Collectibles (hidden packages, letter scraps) | None | **M24 (D15)**, was later: hand-placed content; generated ones need the next interiors to hide in | M24-17 |
| G30 | First-person camera | None | **M17 (D15)**, was later: it puts every model at arm's length, so it waits for M2's models | M17-1 |
| G31 | Parachutes | None | **M17 (D15)**, was out, with aircraft (G5) | M17-6 |
| G32 | Animals: dogs, pigeons, deer | None | **M26 (D15)**, was later: street life after M2's people pipeline | M26-5, M26-6 |
| G33 | TV, internet, in-world media | The news line | **M27 (D15)**, was later: Later, after the radio | M27-2, M27-3 |
| G34 | Handbrake; steering that eases with speed | Neither (`vehicle.js:33-34`) | **M10, added (D14)**: all three street games have it | M10-8 |
| G35 | Horn | None | **M7, added (D14)**: E in a car | M7-1 |
| G36 | Police chase on foot | Cruisers only (`WANTED.md`) | **M10, added (D14)**; armed from ★3 (M13) | M10-10 |
| G37 | Police ram; traffic goes round a stopped car | Neither | **M10, added (D14)**, once M10-3 has collision | M10-3 |
| G38 | Nobody walks or drives through anybody | Walkers have no body to stop against | **M10, added (D14)**: a bump, a dive clear, a knock-down and up again; a fast hit wounds or kills (M13) | M10-4 |
| G39 | Busted costs money | A bust rewinds the arc and takes nothing | **M11, added (D14)** | M11-4 |
| G40 | A map legend; the district named on arrival | Street names in the news only | **M10, added (D14)** | M10-2 |
| G41 | Field of view, full screen, save now | None; one autosave slot | **M7, added (D14)** | M7-4, M7-7 |

## Watch Dogs (1, 2, Legion): hacking

| # | Capability | Urbis today | Decision | Where |
|---|---|---|---|---|
| W1 | Profiler | Name, home, job (`street.js` `profilerTarget`) | Built. Aim is generalised in M6 | M6-1 |
| W2 | Aim at anything hackable | None | M6 | M6-1 |
| W3 | Districts opened by a ctOS box | None | M6: control boxes | M6-2 |
| W4 | Battery | None | M6 | M6-3 |
| W5 | Blackout | Built (H) | Built | — |
| W6 | Traffic lights | None | M6 | M6-4 |
| W7 | Bollards, steam pipes, bridges | None | M6 | M6-4 |
| W8 | Car hack | None | M6: brake, swerve, floor it. Remote drive: M20-9 (D15) | M6-4, M20-9 |
| W9 | Camera hopping | None | M6 | M6-4 |
| W10 | Jam the police radio | None | M6 | M6-4 |
| W11 | Jam the helicopter | The police helicopter exists (`render/heli.js`) | **M20 (D15)**, was later | M20-7 |
| W12 | Listen to calls and texts | None | M6: eavesdrop | M6-4 |
| W13 | Empty a bank account | None | M6 | M6-4 |
| W14 | Distract, lure, report someone | None | **M20 (D15)**, was later (M6's later rows) | M20-6 |
| W15 | Overload a junction box against enemies | None | **M20 (D15)**, was later; depends on D9 | M20-1 |
| W16 | Gates, garage doors, forklifts, lifts | None | **M20 (D15)**, was later (vertical hacking) | M20-2 |
| W17 | **Unlock new hacks as you go** | None | **M11**: cred tiers | M11-5 |
| W18 | Drones, RC cars | None | **M20 (D15)**, was later | M20-8, M20-9 |
| W19 | Hacking puzzles | None | **M20 (D15)**, was later: M6's break-in is hold E for 3 s | M20-11 |
| W20 | Crime prediction: the profiler flags a crime about to happen | None | **M19 (D15)**, was later | M19-5 |
| W21 | Mass vehicle hack | None | **M20 (D15)**, was later (M6) | M20-5 |
| W22 | Contracts from fixers | None | **M11**: gigs | M11-1 |
| W23 | Billboards | None | **M20 (D15)**, was later (M6) | M20-6 |
| W24 | Play as anyone (Legion) | None | **M21 (D15)**, was out: one protagonist, the arc's cast | M21-13 to M21-15 |
| W25 | Online invasion | None | **M30 (D15)**, was out | M30-10 |
| W26 | Craft gadgets | None | **M20 (D15)**, was out: loot and crafting are not in the pillars | M20-13 |
| W27 | Stealth past guards | None | **M13 (D15)**, was later: Depends on D9 | M13-16 |
| W28 | **Focus**: slow time for a chase or a hack | None | **M6, added**: hold Q, 0.3 times speed for up to 4 s, spends battery | M6-3 |

## Cyberpunk 2077: depth, never the look

| # | Capability | Urbis today | Decision | Where |
|---|---|---|---|---|
| C1 | A story with branching choices | Six missions, two choices that change the street (`ARC.md`) | Built. More: the campaign, its endings and three starts, M24-2, M24-4, M24-5 (D15) | M24-2, M24-4, M24-5 |
| C2 | Characters with a voice and an attitude | Three people (`ARC.md`) | Built | — |
| C3 | **Side jobs from fixers, with a second way to do them** | None | **M11**: gigs built from what the sim has queued; three kinds have a second way | M11-1 to M11-3 |
| C4 | Many interiors | The noodle bar, a roof, a room behind every grown lot's door, except a home lot's flat: its lobby is enterable, the flat behind it is not (`INTERIORS.md`) | Built. Six service rooms in M5; the next nine and every other room: M33-9 (D15) | M5-5, M33-9 |
| C5 | Scanning | The profiler | Built | — |
| C6 | Quickhacks on people | None | M6: eavesdrop, bank | M6-4 |
| C7 | **Character progression** | None | **M11**: cred tiers that unlock hacks and better gigs. No attribute sheet (G22) | M11-5 |
| C8 | Street cred, reputation | None | **M11** | M11-5 |
| C9 | Factions, gangs, territory | None | **M19 (D15)**, was later: firms by district are the seed of it | M19-9 to M19-11 |
| C10 | **A home: apartment, stash** | None | **M11**: a building the player owns is a safehouse | M11-4 |
| C11 | Gear, loot, crafting, cyberware | None | **M25 (D15)**, was out: loot is the genre, not the depth; cyberware is the look | M25-8 to M25-14 |
| C12 | Call your car | None | **M18 (D15)**, was later | M18-15 |
| C13 | Romance | None | **M21 (D15)**, was out | M21-8 |
| C14 | Braindance investigations | None | **M20, M24 (D15)**, was out | M24-16, M20-14 |
| C15 | Crimes in progress to stop | None | **M19 (D15)**, was later (with W20) | M19-5 |
| C16 | Radio | None | Music: M7-10. Voices: M28-4 (D15) | M7-10, M28-4 |
| C17 | Several endings | The arc's two choices change the street | **M24 (D15)**, was later | M24-4 |
| C18 | Life paths | None | **M24 (D15)**, was out | M24-5 |
| C19 | Combat | None | **M13 (D15)**, was the operator's (D9) | M13 |
| C20 | Netrunning in cyberspace | None | **M20 (D15)**, was out: a separate virtual space; Urbis's hacking happens in the street | M20-11 |
| C21 | **Talking to anyone** (`AGENTS.md` names talking as one of the four tools) | Only the arc's three people talk; the profiler reads, never talks | **M11, added:** tap E at a walker: lines from their sim state, a gig lead, short answers where the player has hurt their district | M11-8 |

## What this adds to the plan

- **M5 gains four criteria.** Road types and upgrades (M5-10), pollution (M5-11),
  milestones that unlock tools (M5-12), and undo and demand bars, which go into M5-7 and
  M5-8. The sweep moves to M5-13. That adds 7 tasks.
- **M10 Living in it, new**: take any car, map and route, collision and damage, walkers
  who react, water. 14 tasks, and 8 more from the feature lists (D14).
- **M12 The city runs on something, new**: power with supply and demand, water,
  garbage, fire, the fleets. 14 tasks.
- **M11 Something to play for, new**: gigs from the sim, money that buys buildings
  that pay, a safehouse, cred that unlocks, talking to anyone. 14 tasks.
- **D9 for the operator**: combat.
- Every "later" and "out" line is now a criterion of M13 to M34 (D15, 2026-10-04).

## Checked by OpenCode, 2026-10-03

The operator had OpenCode audit the plan. Its 25 findings were checked against the code;
24 held and changed the plan (ROADMAP's decisions table lists where). It added W28, S40,
G29 and G30 here and corrected S36 and C4. Its overpass finding did not hold; the reason
is in ROADMAP under M4. Claude's own check of the findings corrected G1: running exists,
so M10 lost its sprint criterion.

**Rounds two and three** (findings 26-72) were checked against the code the same way.
They changed the Skylines lines most. Water, garbage, fire, the fleets and power as
supply and demand are now M12 (D12). S14's and S19's "out" were wrong, and so was S38's
missing reason. G7 was wrong too: `vehicle.js` has no car collision, so M10 builds one
first. Talking (C21) is in M11 because the pillars name it.

## Checked against the feature lists, 2026-10-04

The operator asked for every feature of the four games, listed without looking at
Urbis, before the plan was settled. OpenCode wrote, reviewed and marked them
(`docs/plan/features/README.md`): 3,754 features, each marked built, partial, planned,
later, out or missing against Urbis, and the missing systems merged into
`docs/plan/features/mechanics.md`, 809 rows. Claude read every row and applied D10 to
each (decision D14 in ROADMAP).

**What went in.** 37 mechanics, and jumping, which G2 had left for later:

| Change | Mechanics | Where |
|---|---|---|
| Drag a brush across lots | GAP-01-017 | M5-4 |
| Tool tooltips; a right click puts a tool down | GAP-15-016, GAP-15-055 | M5-7 |
| The population and the next tier on screen; an unlock is announced | GAP-15-064, GAP-11-001 | M5-12 |
| The jobless in the history | GAP-09-014 | M5-15 |
| Problem icons over buildings | GAP-15-070, GAP-02-002 | M5-16 |
| Pause and game speed | GAP-15-043 | M5-17 |
| Weather that changes | GAP-14-020, GAP-14-026 | M2-7 |
| Name the city | GAP-01-037, GAP-17-044, GAP-15-011 | M7-2 |
| The horn; a sting when a job completes | GAP-05-003, GAP-16-011 | M7-1 |
| Field of view and full screen | GAP-17-001, GAP-17-010 | M7-4 |
| Save now | GAP-17-013 | M7-7 |
| Music and the car radio | GAP-16-001, GAP-16-002, GAP-16-004 | M7-10 |
| A map legend; district names on arrival | GAP-15-002, GAP-15-018 | M10-2 |
| Police ram; traffic goes round a stopped car | GAP-06-004, GAP-03-034 | M10-3 |
| Nobody passes through anybody; a car knocks a walker down | GAP-04-017, GAP-09-005, GAP-05-068, GAP-06-042 | M10-4 |
| Handbrake and steering | GAP-05-001, GAP-05-055, GAP-05-071 | M10-8 |
| Jump | G2 | M10-9 |
| Police on foot | GAP-06-003 | M10-10 |
| A bust costs money | GAP-06-008, GAP-10-011 | M11-4 |
| A gig's time left on the HUD | GAP-15-021 | M11-1 |

That is 7 new criteria, 16 changed ones (three of them M12's, for M5-16's icons) and 16 new tasks: M2 +2, M5 +3, M7 +2,
M10 +8, M11 +1, 236 in all.

**Where the rest went, by section.** The other 772 rows of `mechanics.md` were first
left later or out. Since D15 every one is in exactly one criterion of M13 to M34; each
milestone file lists them in its criteria's Covers column.

| Section | Rows | Milestones (rows) |
|---|---|---|
| 1 Building the city | 66 | M14 (65), M17 (1) |
| 2 Utilities and services | 30 | M15 (30) |
| 3 Traffic and transport | 34 | M16 (33), M15 (1) |
| 4 On foot | 20 | M17 (18), M16 (1), M14 (1) |
| 5 Driving and vehicles | 79 | M18 (76), M13 (2), M17 (1) |
| 6 Police and crime | 41 | M19 (39), M13 (2) |
| 7 Hacking | 21 | M20 (21) |
| 8 Combat and weapons | 66 | M13 (63), M18 (3) |
| 9 People and talking | 58 | M21 (53), M15 (4), M14 (1) |
| 10 Money, property and shops | 36 | M22 (34), M14 (1), M13 (1) |
| 11 Progression | 23 | M23 (19), M33 (2), M14 (2) |
| 12 Missions and activities | 87 | M24 (77), M19 (3), M22 (2), M23 (2), M13 (2), M21 (1) |
| 13 Character | 10 | M25 (8), M21 (1), M23 (1) |
| 14 World, weather, nature | 33 | M26 (27), M15 (2), M14 (2), M24 (2) |
| 15 Interface and map | 63 | M27 (61), M24 (1), M23 (1) |
| 16 Audio and radio | 16 | M28 (16) |
| 17 Settings and platform | 60 | M29 (56), M24 (2), M20 (1), M13 (1) |
| 18 Online | 1 | M30 (1) |
| 19 Modding and editors | 14 | M29 (8), M31 (6) |
| 20 Other | 14 | M32 (9), M27 (1), M30 (1), M33 (1), M24 (1), M23 (1) |

**The decided lines were checked too.** 1,851 features were marked later or out
through a line above: loot and cyberware (C11, 255 features), online (G28, 233), playing
as anyone (W24, 86), body stats (G22, 67), disasters (S32, 46), aircraft (G5, 44),
transit (S22, 75), policies (S24, 43) and the rest. Two went into the slice: jumping
(G2, 17 features) and the radio (G23, 78), above. Since D15 the other 1,851 are each in
one criterion of M13 to M34, listed in the milestone file's last table, "What each
criterion delivers from the four games". What breaks the look takes a grounded form:
cyberware is worn gear, quickhacks are programs on a rig, braindance is recorded footage,
cyberspace is a puzzle on a real device, and no neon or holograms anywhere.
