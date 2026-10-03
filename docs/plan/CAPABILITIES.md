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
| **Later** | It adds depth or breadth. It waits for the sell check (ROADMAP, "After the sell check") |
| **Out** | It breaks the look (no neon, no cyber styling), fails pillar 1's test (nothing to stand in at street scale), or belongs to a different game. The reason is given |
| **Operator** | A matter of taste or tone, not engineering: the operator decides |

## Cities: Skylines (I and II): building

| # | Capability | Urbis today | Decision | Where |
|---|---|---|---|---|
| S1 | Zone homes, shops, works | R C I brushes on the generated lots (`CITYVIEW.md`) | Built | — |
| S2 | Density and office zones | Lots grow EMPTY → HIGH; three uses, no office | M5: a height cap is the density choice. Office: later | M5-4 |
| S3 | Demand bars per use | The sim has demand; the city view shows only "waiting for demand" on a lot | **M5, added** | M5-8 |
| S4 | Buildings level up with land value | Stages EMPTY → HIGH, district wealth (`ECONOMY.md`) | Built | — |
| S5 | Abandonment with a reason | Decline with a reason (`ZONING.md`) | Built | — |
| S6 | Draw roads | None | M5 (on the grid) | M5-1 |
| S7 | Road types (2 or 4 lanes, one-way) and upgrading a road in place | None | **M5, added**: capacity follows the type in M3's traffic | M5-10 |
| S8 | Curved roads, free angles | Grid only | Later (D2) | — |
| S9 | Highways, interchanges, elevated roads, tunnels | None | Later (world-scale plank 2) | — |
| S10 | Traffic lights, stop signs, roundabouts | None | M3: a light at every junction. **M5, added:** lights, stop or yield per junction. Roundabouts: later (D2) | M3-6, M5-14 |
| S11 | Bulldoze anything | Lots only | M5 | M5-2, M5-3 |
| S12 | Undo | None | **M5, added**: Ctrl+Z within 10 game seconds, full refund | M5-7 |
| S13 | Electricity: plants, lines, coverage | Power by district; the blackout hack | **M12:** plants make MW, districts use it by floor area, substations carry it; a shortfall darkens blocks through the blackout's own code. Cables are not drawn: they run under every road | M5-5, M12-1 |
| S14 | Water and sewage pipes | None | **M12:** a pumping station on the river and a treatment plant, both buildings with doors; pipes are not drawn, they run under every road (a second network under the first has nothing to see at street scale) | M12-2 |
| S15 | Garbage collection | None | **M12:** a depot's trucks collect; uncollected bags pile on the pavement and lower land value | M12-3 |
| S16 | Police | None as a service | M5: police station | M5-5 |
| S17 | Fire: stations, burning buildings | None | M5: the station. **M12:** buildings catch fire and a truck drives out. Fires that spread: later | M5-5, M12-4 |
| S18 | Health: clinic, hospital, ambulances | None | M5: clinic. **M12:** ambulances. Hospital: later | M5-5, M12-5 |
| S19 | Deathcare | None | Later, with ageing (S28): a city where people age needs somewhere for them to end. The earlier "out" contradicted S28 | — |
| S20 | Education levels that gate jobs | None | M5: school (wealth recovery). Education levels: later | M5-5 |
| S21 | Parks and plazas | None | M5 | M5-5 |
| S22 | Public transport (bus, tram, metro, train, taxi, ferry, air) | None | Bus, tram, metro: later. Train: later, on M4's road in from outside. Taxi: later (G25). Ferry: later, on M4's river. Air: out (G5) | — |
| S23 | Budget: taxes, service budgets, loans | None | M5: taxes and upkeep. Service sliders and loans: later | M5-6 |
| S24 | City and district policies | None | Later | — |
| S25 | Paint and name districts | Districts are generated and named by the map (M3, M4) | Painting: later | — |
| S26 | Info views | None | M5: six overlays and **a coverage view per service** | M5-8 |
| S27 | Pollution and noise | None | **M5, added:** works pollute and busy roads make noise (edge load from M3's commute flow); home demand and land value fall | M5-11 |
| S28 | Citizens with homes, jobs and a life | Residents with homes and jobs (`people.js`) | Built. Ageing and births: later, with deathcare (S19) | — |
| S29 | Goods trucks, import and export | None | Later: goods from works to shops by van, and imports on M4's road in from outside | — |
| S30 | Milestones that unlock tools as the city grows | None | **M5, added**: population tiers unlock services and road types | M5-12 |
| S31 | Unique buildings and landmarks | Pinned towers | Later | — |
| S32 | Natural disasters | None | **Out**: chaos in Urbis comes from the player; a disaster is an act with no actor (pillar 4) | — |
| S33 | Terraforming, placing water | Generated terrain (M4) | **Out**: M4 makes terrain the authority every placement asks; editing it undoes that | — |
| S34 | More land to build on | The outskirts | M4 and M5: open land around the town | M5-1 |
| S35 | Chirper | The news line (`news.js`) | Built | — |
| S36 | Day, night, weather | A 12-minute day; one rain state (`render/rain.js`); the storm lifecycle, VGA-051, is open | Built: day and night. Weather that changes: later (VGA-051) | — |
| S37 | Industry chains (raw goods → processing → products) | None | **Out:** a second economy; Urbis's is jobs, homes and firms by district | — |
| S38 | Parking | None | Later: the kerbs are lined with parked cars today; car parks and a parking policy are a Skylines II loop worth having after the sell check. The earlier "out" gave no reason | — |
| S39 | Asset editor, mods | None | Later (`BACKLOG.md`) | — |
| S40 | Mixed use (homes over shops, Skylines II) | One use per lot | Later: the row buildings already look it, shopfronts under flats; the economy counts one use per parcel until then | — |
| S41 | A highway in from outside | None: the town is an island | **M4, added:** one regional road enters at the map's edge; through-traffic and commuters from outside use it | M4-9 |
| S42 | Tourism | Three HOTEL signs (`content/signs.json`), the arc's hotel | Later: visitors on the road from outside, spending in shops near hotels and landmarks; a demand on shops, not a second economy | — |
| S43 | Specialised industry and natural resources | Farmland and mountains past the edge | Later: farmland and forest feeding works districts | — |
| S44 | Telecom and network coverage | None | Later. Worth noting for then: in Urbis the network could be what a hack travels on, tying building to hacking | — |
| S45 | Seasons, snow, heating, road gritting | One rain state | Later, after VGA-051's weather | — |
| S46 | **Service fleets** (fire trucks, garbage trucks, ambulances) | Police cruisers only | **M12** | M12-5 |
| S47 | **Services with a catchment and a capacity** | None: M5 had each service lift a whole district, which pillar 4 forbids | **M5, changed** | M5-5, M5-8 |
| S48 | Statistics and graphs over time | The latest value only | **M5, added:** a history panel | M5-15 |
| S49 | Happiness and well-being | Wealth and demand per district | Later: it needs the catchments (S47) to be about a building, not a district | — |
| S50 | City crime rate and prisons | Police answer the player's heat only (`WANTED.md`) | Later | — |
| S51 | Service building upgrades and extensions | None | Later | — |
| S52 | Bicycles, cycle and foot paths | Bike hoops are drawn | Later | — |
| S53 | Decoration: trees, plazas, fences placed by hand | None | Later | — |
| S54 | Road wear and maintenance | Wear is drawn (VGA-028), not simulated | Later | — |
| S55 | Traffic accidents with no player in them | None | Later, with tow trucks and the fleets | — |
| S56 | Rent, affordability, homelessness | `decline.js` reserves "rents" as a cause | Later | — |
| S57 | Post | None | Later, with the fleets | — |
| S58 | Scenarios, challenges, climates | One climate | Later | — |

## GTA (V): living in it

| # | Capability | Urbis today | Decision | Where |
|---|---|---|---|---|
| G1 | Walk, run | Walk, and Shift runs at 6 m/s against 3.4 (`sim/player.js:5-6`) | Built. A stamina limit: out, a limit with nothing to decide | — |
| G2 | Jump, climb, vault | None | Later | — |
| G3 | Swim; a car in the water | No water yet | **M10**: once M4 makes a river, the player and cars need a rule for it | M10-5 |
| G4 | Drive | The hero car | Built | — |
| G5 | Other vehicles: motorbikes, trucks, buses, boats, aircraft | Cars only | Motorbike, truck, bus, boat: later. Aircraft: **out**, because a player in the air sees the whole city at once, which breaks street scale and the 175-draw frame | — |
| G6 | **Take any car**: break into a parked one, pull a driver out | Only the hero car (`nearHero()`) | **M10** | M10-1 |
| G7 | Car damage, wrecks | No car collision: `vehicle.js:1` says "No collision yet — road-clamped only"; only the roadblock collides (`response.js`) | **M10**: collision first, then damage | M10-3 |
| G8 | Customise, store and own cars | None | Later | — |
| G9 | Wanted levels that escalate | ★ to ★★★: cruisers, spikes, roadblock, helicopter, search ring, dispatch (`WANTED.md`) | Built. ★4-5 depend on D9 | — |
| G10 | Busted, wasted | Busted restarts the mission (`arc.js`); no health | Built (busted). Wasted depends on D9 | — |
| G11 | **Fight: melee, guns, cover** | None | **Operator (D9)** | — |
| G12 | People react: flee, call the police | Walkers never react | **M10** | M10-4 |
| G13 | Ambient events (an argument, an arrest, a busker) | None | Later (`VISUAL-GAPS.md`) | — |
| G14 | Story missions | Six-mission arc (`ARC.md`) | Built. More: later | — |
| G15 | Side jobs and activities | None | **M11**: gigs | M11-1 |
| G16 | **Minimap, map screen, waypoint, GPS route** | A mission marker only (`mission.js`) | **M10**: a 600 m town (M4) cannot be crossed without one | M10-2 |
| G17 | Phone: contacts, texts | The journal (`ARC.md`) | Later, with Watch Dogs 2's apps (car on demand, music, scout) | — |
| G18 | **Money to spend** | ₡ from the arc on the HUD; nothing buys | **M11** | M11-4 |
| G19 | Buy property and businesses that pay | None | **M11**: the player buys any grown building; its trade pays them | M11-4 |
| G20 | Shops: clothes, food, barber | The noodle bar (`INTERIORS.md`) | Later (the next nine interiors) | — |
| G21 | Character customisation | None | Later | — |
| G22 | Body stats (stamina, driving skill) | None | **Out**: growth lives in M11's cred (hacks and gigs), not a stat sheet | — |
| G23 | Car radio | None (`ARC.md` defers it until there is audio) | Later: needs music and voices with a licence the operator approves (ROADMAP M7) | — |
| G24 | Physics: ragdolls, lamp posts knocked flat | None | Later | — |
| G25 | Taxi, fast travel | None | Later | — |
| G26 | Photo mode | None | Later (`BACKLOG.md`) | — |
| G27 | Stock market moved by the player's acts | None | Later: firms already move between districts | — |
| G28 | Online | None | Out | — |
| G29 | Collectibles (hidden packages, letter scraps) | None | Later: hand-placed content; generated ones need the next interiors to hide in | — |
| G30 | First-person camera | None | Later: it puts every model at arm's length, so it waits for M2's models | — |
| G31 | Parachutes | None | Out, with aircraft (G5) | — |
| G32 | Animals: dogs, pigeons, deer | None | Later: street life after M2's people pipeline | — |
| G33 | TV, internet, in-world media | The news line | Later, after the radio | — |

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
| W8 | Car hack | None | M6: brake, swerve, floor it. Remote drive: later | M6-4 |
| W9 | Camera hopping | None | M6 | M6-4 |
| W10 | Jam the police radio | None | M6 | M6-4 |
| W11 | Jam the helicopter | The police helicopter exists (`render/heli.js`) | Later | — |
| W12 | Listen to calls and texts | None | M6: eavesdrop | M6-4 |
| W13 | Empty a bank account | None | M6 | M6-4 |
| W14 | Distract, lure, report someone | None | Later (M6's later rows) | — |
| W15 | Overload a junction box against enemies | None | Later; depends on D9 | — |
| W16 | Gates, garage doors, forklifts, lifts | None | Later (vertical hacking) | — |
| W17 | **Unlock new hacks as you go** | None | **M11**: cred tiers | M11-5 |
| W18 | Drones, RC cars | None | Later | — |
| W19 | Hacking puzzles | None | Later: M6's break-in is hold E for 3 s | — |
| W20 | Crime prediction: the profiler flags a crime about to happen | None | Later | — |
| W21 | Mass vehicle hack | None | Later (M6) | — |
| W22 | Contracts from fixers | None | **M11**: gigs | M11-1 |
| W23 | Billboards | None | Later (M6) | — |
| W24 | Play as anyone (Legion) | None | **Out**: one protagonist, the arc's cast | — |
| W25 | Online invasion | None | Out | — |
| W26 | Craft gadgets | None | **Out**: loot and crafting are not in the pillars | — |
| W27 | Stealth past guards | None | Depends on D9 | — |
| W28 | **Focus**: slow time for a chase or a hack | None | **M6, added**: hold Q, 0.3 times speed for up to 4 s, spends battery | M6-3 |

## Cyberpunk 2077: depth, never the look

| # | Capability | Urbis today | Decision | Where |
|---|---|---|---|---|
| C1 | A story with branching choices | Six missions, two choices that change the street (`ARC.md`) | Built. More: later | — |
| C2 | Characters with a voice and an attitude | Three people (`ARC.md`) | Built | — |
| C3 | **Side jobs from fixers, with a second way to do them** | None | **M11**: gigs built from what the sim has queued; three kinds have a second way | M11-1 to M11-3 |
| C4 | Many interiors | The noodle bar, a roof, a room behind every grown lot's door, except a home lot's flat: its lobby is enterable, the flat behind it is not (`INTERIORS.md`) | Built. Six service rooms in M5; the next nine: later | M5-5 |
| C5 | Scanning | The profiler | Built | — |
| C6 | Quickhacks on people | None | M6: eavesdrop, bank | M6-4 |
| C7 | **Character progression** | None | **M11**: cred tiers that unlock hacks and better gigs. No attribute sheet (G22) | M11-5 |
| C8 | Street cred, reputation | None | **M11** | M11-5 |
| C9 | Factions, gangs, territory | None | Later: firms by district are the seed of it | — |
| C10 | **A home: apartment, stash** | None | **M11**: a building the player owns is a safehouse | M11-4 |
| C11 | Gear, loot, crafting, cyberware | None | **Out**: loot is the genre, not the depth; cyberware is the look | — |
| C12 | Call your car | None | Later | — |
| C13 | Romance | None | Out | — |
| C14 | Braindance investigations | None | Out | — |
| C15 | Crimes in progress to stop | None | Later (with W20) | — |
| C16 | Radio | None | Later (G23) | — |
| C17 | Several endings | The arc's two choices change the street | Later | — |
| C18 | Life paths | None | Out | — |
| C19 | Combat | None | **Operator (D9)** | — |
| C20 | Netrunning in cyberspace | None | **Out:** a separate virtual space; Urbis's hacking happens in the street | — |
| C21 | **Talking to anyone** (`AGENTS.md` names talking as one of the four tools) | Only the arc's three people talk; the profiler reads, never talks | **M11, added:** tap E at a walker: lines from their sim state, a gig lead, short answers where the player has hurt their district | M11-8 |

## What this adds to the plan

- **M5 gains four criteria.** Road types and upgrades (M5-10), pollution (M5-11),
  milestones that unlock tools (M5-12), and undo and demand bars, which go into M5-7 and
  M5-8. The sweep moves to M5-13. That adds 7 tasks.
- **M10 Living in it, new**: take any car, map and route, collision and damage, walkers
  who react, water. 14 tasks.
- **M12 The city runs on something, new**: power with supply and demand, water,
  garbage, fire, the fleets. 14 tasks.
- **M11 Something to play for, new**: gigs from the sim, money that buys buildings
  that pay, a safehouse, cred that unlocks, talking to anyone. 14 tasks.
- **D9 for the operator**: combat.
- Every "later" line joins ROADMAP's "After the sell check". Every "out" line stays
  out until the operator overturns it.

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
