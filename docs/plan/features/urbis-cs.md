# Cities: Skylines: every feature against Urbis

Marks: built, partial, planned, later, out, missing, skip (the list marks the row wrong or a duplicate).

| ID | Feature | Mark | Evidence |
|---|---|---|---|
| CS-01-001 | Free camera pan | partial | WASD pans the city overview (`src/sim/cityview.js:120-130`) and moves the player (`src/main.js:964-978`); no arrow keys or middle-mouse pan (searched "arrow", "middle") |
| CS-01-002 | Edge-of-screen panning | missing | searched "edge pan", "screen edge", "pointer edge" in src; none |
| CS-01-003 | Camera rotation | partial | pointer drag turns the camera (`src/main.js:270-277`); no Q/E rotation (Q is planned Focus, M6-3) |
| CS-01-004 | Camera tilt | built | drag sets pitch, clamped 0.08-1.2 (`src/main.js:273`) |
| CS-01-005 | Mouse-wheel zoom | built | wheel dollies the camera, clamped 3-14 m (`src/main.js:279-281`) |
| CS-01-006 | Zoom toward pointer | partial | wheel dollies the follow cam (`src/main.js:279`); the pivot is the player, not the pointer |
| CS-01-007 | First-person camera | partial | street-level third-person walk/drive cam (`src/main.js:964-978`, `src/main.js:1170-1184`); first-person is later (CAPABILITIES G30) |
| CS-01-008 | First-person follow | missing | searched "follow", "spectate"; only a profiler target lock (`src/main.js:989-1000`), no camera follow |
| CS-01-009 | Cinematic camera | missing | searched "cinematic" in src; none |
| CS-01-010 | Photo mode | later | CAPABILITIES G26; `docs/BACKLOG.md:91` |
| CS-01-011 | Photo mode filters | later | CAPABILITIES G26 (photo mode unbuilt; no filter code) |
| CS-01-012 | Depth-of-field slider | later | CAPABILITIES G26; searched "dof", "bokeh", "depthOfField" in src, none |
| CS-01-013 | Field-of-view slider | later | CAPABILITIES G26; camera FOV fixed at 52 (`src/main.js:82`) |
| CS-01-014 | Photo mode time slider | later | CAPABILITIES G26; only the T day/night flip (`src/main.js:444`) |
| CS-01-015 | Hide interface | missing | searched "toggle hud", "hide interface"; no UI toggle (city view only hides its prompts, `src/ui/cityview.js:140-144`) |
| CS-01-016 | Screenshot capture | partial | `captureFrame` probe and `__game.shot()` (`src/main.js:544-547`, `src/render/capture.js:5`); dev-only, no player photo mode (G26) |
| CS-01-017 | Bulldoze tool | partial | X clears a lot's building (`src/sim/zoning.js:180-204`); lots only, no row building, tower or road until M5-2 |
| CS-01-018 | Marquee bulldoze | missing | searched "marquee", "rectangle demolish"; none |
| CS-01-019 | Underground bulldoze | later | ROADMAP "After the sell check": underpasses, subway, sewers (`docs/ROADMAP.md:706`) |
| CS-01-020 | Upgrade tool | planned | M5-10 (M5.T24-T25): click a road to upgrade it in place |
| CS-01-021 | Replace tool | planned | M5-10 (M5.T24-T25) upgrades a road in place; no drag-replace in the plan |
| CS-01-022 | Rotate while placing | missing | no placement tool exists; searched "rotate" in sim/ui cityview; none |
| CS-01-023 | Info view menu | planned | M5-8 (M5.T20-T21): overlays cycled by a key |
| CS-01-024 | Object info panel | partial | hover lot card (`src/ui/cityview.js:147-156`) and the profiler name/home/job (`src/render/profiler.js`); no click panel for roads/vehicles |
| CS-01-025 | Pause | planned | M7-3 (M7.T9): Esc holds the fixed-step loop |
| CS-01-026 | Game speed controls | missing | searched "game speed", "fast forward"; only the dev flag `?speed=N` planned in M0-2 |
| CS-01-027 | Tool hotkeys | partial | Z view and R/C/I/X brushes (`src/sim/cityview.js:30,83-91`); 1/2 are story choices (`src/main.js:451`); service keys planned M5.T1 |
| CS-01-028 | Right-click cancel | missing | no contextmenu handling; drag starts on any pointerdown (`src/main.js:269`) |
| CS-01-029 | Build cost tooltip | planned | M5-7 (M5.T19): every tool shows its cost before it acts |
| CS-01-030 | Service radius preview | planned | M5-5 (M5.T11) catchments; M5-8 coverage overlay |
| CS-01-031 | Auto-pause on load | missing | searched "auto-pause", "start paused"; the loop starts running (`src/main.js:1021`) |
| CS-01-032 | Road name labels toggle | partial | street names exist for notes and news (`src/sim/streetnames.js:53-55`); no map label and no toggle |
| CS-01-033 | Show/hide vehicle routes | missing | searched "route line", "vehicle route"; none |
| CS-01-034 | Toolbar building categories | missing | only the four-row brush palette (`src/ui/cityview.js:50-70`); no toolbar or categories |
| CS-01-035 | Free camera mode | missing | searched "free camera"; none (first-person is later, CAPABILITIES G30) |
| CS-01-036 | Underground view | later | ROADMAP "After the sell check": subway, sewers (`docs/ROADMAP.md:706`) |
| CS-01-037 | Bulldoze trees and props | later | CAPABILITIES S53 (hand-placed decoration: Later) |
| CS-01-038 | CS2 cinematic camera | missing | searched "cinematic"; none |
| CS-01-039 | Move tool | missing | searched "relocat", "move tool"; none |
| CS-01-040 | Drag-bulldoze trees | later | CAPABILITIES S53 |
| CS-01-041 | Speed hotkeys | missing | 1/2 are story choices (`src/main.js:451`); no speed keys |
| CS-02-001 | Two-lane road | partial | Generated 2-lane avenues and crossings are driveable (`src/sim/world.js:31-37`, `src/sim/vehicle.js:19-48`); no road types or build tool until M5-1/M5-10 |
| CS-02-002 | Two-lane one-way road | planned | M5-10 (M5.T24-T25): a one-way type in the road tool |
| CS-02-003 | One-lane one-way road | missing | searched "one-way", "oneWay"; no single-lane type in `src/sim/world.js` or the plan |
| CS-02-004 | Gravel road | missing | searched "gravel", "unpaved", "dirt road"; none |
| CS-02-005 | Gravel one-way road | missing | searched "gravel"; none |
| CS-02-006 | Four-lane road | planned | M5-10 (M5.T24-T25): a 4-lane avenue type with capacity A/B |
| CS-02-007 | Four-lane one-way road | missing | searched "one-way", "4-lane"; no such type in code or plan |
| CS-02-008 | Small four-lane road | missing | searched "4-lane", "narrow road"; none |
| CS-02-009 | Six-lane road | missing | searched "six-lane", "6-lane"; none |
| CS-02-010 | Six-lane one-way road | missing | searched "one-way", "6-lane"; none |
| CS-02-011 | Six-lane asymmetric road | missing | searched "asymmetric"; none |
| CS-02-012 | Seven-lane asymmetric road | missing | searched "asymmetric", "7-lane"; none |
| CS-02-013 | Four-lane asymmetric road | missing | searched "asymmetric"; none |
| CS-02-014 | Asymmetric highways | missing | searched "asymmetric", "highway"; none |
| CS-02-015 | Highway | later | CAPABILITIES S9 (highways: world-scale plank 2, after the sell check) |
| CS-02-016 | Four-lane highway | later | CAPABILITIES S9 |
| CS-02-017 | Highway ramp | later | CAPABILITIES S9 |
| CS-02-018 | Alley | missing | searched "alley"; only an "alley washes" render comment (`src/main.js:203`), no road type |
| CS-02-019 | One-way alley | missing | searched "alley", "one-way"; none |
| CS-02-020 | Two-lane road with bicycle lanes | later | CAPABILITIES S52 (bicycles, cycle and foot paths: Later) |
| CS-02-021 | Four-lane road with bicycle lanes | later | CAPABILITIES S52 |
| CS-02-022 | Six-lane road with bicycle lanes | later | CAPABILITIES S52 |
| CS-02-023 | Road with bus lanes | later | CAPABILITIES S22 (bus lines: later) |
| CS-02-024 | Small four-lane road with bus lanes | later | CAPABILITIES S22 |
| CS-02-025 | Large avenue with bus lanes | later | CAPABILITIES S22 |
| CS-02-026 | Six-lane road with median trees and bus lanes | later | CAPABILITIES S22 |
| CS-02-027 | Three-lane one-way road with bus lane | later | CAPABILITIES S22 |
| CS-02-028 | Two-lane road with tram tracks | later | CAPABILITIES S22 (tram: later) |
| CS-02-029 | Four-lane road with tram tracks | later | CAPABILITIES S22 |
| CS-02-030 | Six-lane road with tram tracks | later | CAPABILITIES S22 |
| CS-02-031 | One-way street with tram tracks | later | CAPABILITIES S22 |
| CS-02-032 | Separate tram track | later | CAPABILITIES S22 |
| CS-02-033 | One-way tram track | later | CAPABILITIES S22 |
| CS-02-034 | Road with bicycle lanes and tram tracks | later | CAPABILITIES S22, S52 |
| CS-02-035 | Six-lane road with tram, bus and bike lanes | later | CAPABILITIES S22 |
| CS-02-036 | Monorail on a road | missing | searched "monorail"; none |
| CS-02-037 | Roads with trolleybus wires | missing | searched "trolleybus"; none (`TROLLEY_AT` is a crane hook, `src/render/zoning.js:47`) |
| CS-02-038 | Roads with decorative trees | missing | searched "tree-lined", "roadside tree"; no road variant |
| CS-02-039 | Pedestrian street | later | CAPABILITIES S52 (foot paths: Later) |
| CS-02-040 | Small pedestrian street | later | CAPABILITIES S52 |
| CS-02-041 | Parking roads | later | CAPABILITIES S38 (parking: Later) |
| CS-02-042 | Bus lanes by upgrade | later | CAPABILITIES S22 |
| CS-02-043 | Tram tracks by upgrade | later | CAPABILITIES S22 |
| CS-02-044 | Elevated road building | later | CAPABILITIES S9 (world-scale plank 2, after the sell check) |
| CS-02-045 | Road tunnels | later | CAPABILITIES S9 |
| CS-02-046 | Automatic bridges | planned | M4-2 (M4.T7): a road crossing the river becomes kind `bridge`, drawn in M4.T8 |
| CS-02-047 | Gravel road bridges | missing | searched "gravel", "covered bridge"; none |
| CS-02-048 | Straight road drawing | planned | M5-1 (M5.T3): press a road node and drag a grid-snapped segment |
| CS-02-049 | Curved road drawing | later | CAPABILITIES S8; ROADMAP D2 (curves after the sell check) |
| CS-02-050 | Angle snapping | planned | M5-1 (M5.T3): grid-snapped preview; right angles only (D2), no 45° setting |
| CS-02-051 | Snap settings panel | missing | searched "snap settings", "snap to"; only M5.T3's grid rule, no panel |
| CS-02-052 | Drawing guide lines | missing | searched "guide line", "alignment guide"; none |
| CS-02-053 | Length and angle readout | planned | M5-1 (M5.T3): the preview shows length and cost; angle not planned |
| CS-02-054 | One-way direction arrows | planned | M5-10 (M5.T25): the road pools draw one-way arrows |
| CS-02-055 | Rename a road | missing | searched "rename"; names are generated (`src/sim/streetnames.js:53-55`) with no editor |
| CS-02-056 | Junction settings panel | planned | M5-14 (M5.T31): click a junction for lights, stop or yield |
| CS-02-057 | Traffic lights toggle | planned | M5-14 (M5.T31) |
| CS-02-058 | Stop signs | planned | M5-14 (M5.T31) |
| CS-02-059 | Turn restrictions | skip | WRONG (input row: needs a traffic mod; not vanilla) |
| CS-02-060 | Crosswalk tool | missing | searched "crosswalk"; stripes are drawn (`src/render/block.js:216`) but there is no tool |
| CS-02-061 | Roundabout tool | skip | WRONG (input row: pre-built assets, no drawing tool) |
| CS-02-062 | Roundabout decorations | later | CAPABILITIES S10 (roundabouts: later, D2) |
| CS-02-063 | Cul-de-sac tool | missing | searched "cul-de-sac"; none |
| CS-02-064 | Quay tool | missing | searched "quay"; only a street name (`src/sim/streetnames.js:19`) |
| CS-02-065 | Outside road connections | planned | M4-9 (M4.T17): one regional road enters at the map edge |
| CS-02-066 | Automatic junctions | partial | Generated crossings meet avenues at graph nodes (`src/sim/world.js:90-101`); no player road joins until M5-1 |
| CS-02-067 | Elevated and tunnel connectors | later | CAPABILITIES S9 |
| CS-02-068 | Slope limits | planned | M5-1 (M5.T3): the drag refuses "up too steep, saying which" |
| CS-02-069 | Bridges & Ports bridge types | missing | searched "drawbridge", "lift bridge"; none |
| CS-02-070 | Freeform road drawing | later | CAPABILITIES S8 (D2) |
| CS-02-071 | Pre-built road assets | missing | searched "road asset", "interchange"; none |
| CS-02-072 | Toll booths | missing | searched "toll"; none |
| CS-02-073 | Upgrade keeps zoning | planned | M5-10 (M5.T24): `upgradeRoad(edge, type)` is an op with undo; M3.T20 keeps untouched parcels |
| CS-02-074 | Rail level crossings | missing | searched "rail", "level crossing"; no rail before the sell check |
| CS-02-075 | Asymmetric roads | missing | searched "asymmetric"; none |
| CS-02-076 | Two-way highways | later | CAPABILITIES S9 |
| CS-02-077 | Small two-way highway | missing | searched "two-way highway"; none |
| CS-02-078 | Wide-sidewalk roads | missing | searched "wide sidewalk"; none |
| CS-02-079 | Industry road | missing | searched "industry road"; none |
| CS-02-080 | Bridge road assets | missing | searched "truss bridge", "stone bridge"; none |
| CS-02-081 | Roads with tram tracks | later | CAPABILITIES S22 |
| CS-02-082 | Roads with tram stops | later | CAPABILITIES S22 |
| CS-02-083 | Drawbridges and lift bridges | missing | searched "drawbridge", "lift bridge"; only M6's bridge hack lifts a span (M6.T10), not a bridge type |
| CS-02-084 | Signature bridges | missing | searched "suspension bridge", "extradosed"; none |
| CS-02-085 | Quays with driving lanes | missing | searched "quay"; none |
| CS-02-086 | Roadside tree selector | skip | DUPLICATE of CS-13-013 (input row) |
| CS-02-087 | Stop signs and give-way | planned | M5-14 (M5.T31): stop signs and yield per junction |
| CS-02-088 | Driving side | partial | Lane side exists but is fixed and inconsistent (`src/sim/world.js:167-182`: N-S right, E-W left); no left-hand-traffic option |
| CS-03-001 | Zoning tool | partial | R/C/I brushes paint one derived lot per click (`src/sim/cityview.js:113-116`, `src/sim/zoning.js:199-204`); no cell painting or drag until M5-1/M5-4 |
| CS-03-002 | De-zoning | built | X brush sets a lot unzoned (`src/sim/cityview.js:30,113-116`; `zoneParcel(..., null)` at `src/sim/zoning.js:199-204`) |
| CS-03-003 | Low-density residential zone | partial | `res` is a growth use (`src/sim/zoning.js:13`); no density choice until the M5-4 height cap |
| CS-03-004 | High-density residential zone | partial | Lots grow to HIGH towers (`src/sim/zoning.js:11,147-172`); no separate high-density zone until M5-4 |
| CS-03-005 | Medium-density residential zone | missing | searched "medium density", "row house"; none |
| CS-03-006 | Low-density commercial zone | partial | `com` is a growth use (`src/sim/zoning.js:13`); no density types |
| CS-03-007 | High-density commercial zone | partial | `com` lots grow to HIGH (`src/sim/zoning.js:11,147-172`); no density types |
| CS-03-008 | Office zone | later | CAPABILITIES S2: "Office: later" |
| CS-03-009 | Industry zone | built | `ind` use grows factory lots (`src/sim/zoning.js:13,147-172`; "Workshops", `src/sim/decline.js:73`) |
| CS-03-010 | Mixed-use medium density zone | later | CAPABILITIES S40 (one use per parcel; mixed use later) |
| CS-03-011 | Automatic building growth | built | `tickParcel` grows lots from demand each tick (`src/sim/zoning.js:147-172,206-223`) |
| CS-03-012 | Zone demand bars | planned | M5-8 (M5.T27 three bars per district); CAPABILITIES S3 |
| CS-03-013 | Building levels | built | Five stages EMPTY, SITE, LOW, MID, HIGH (`src/sim/zoning.js:11,157-171`) |
| CS-03-014 | Level-up conditions | partial | Demand and power gate growth (`src/sim/zoning.js:147-172`, `src/sim/decline.js:42-57`); land value, services, education, taxes wait for M5 |
| CS-03-015 | Land value effect | planned | M5-8 land-value overlay (M5.T21) and M5-11 pollution lowering it (M5.T28) |
| CS-03-016 | Building abandonment | partial | Lots empty with letting boards and lose stages (`src/sim/decline.js:59-69`); causes are market and power, not services/workers/taxes, and it is not a permanent abandoned state |
| CS-03-017 | Abandoned building removal | partial | X clears a lot's building (`src/sim/zoning.js:180-204`); decline removes stages on its own; no abandoned state to bulldoze |
| CS-03-024 | Building styles | missing | searched "European", "American"; styles are generated per building (`src/render/block.js:307,476-486`), no style setting |
| CS-03-025 | District styles | missing | searched "district style"; none |
| CS-03-026 | European wall-to-wall buildings | missing | searched "European", "wall-to-wall"; none |
| CS-03-027 | Signature buildings | later | CAPABILITIES S31 (unique buildings and landmarks: Later) |
| CS-03-028 | Zone unlocks by milestone | planned | M5-12 (M5.T30): population tiers unlock tools and zones |
| CS-03-030 | Lot sizing to roads | built | Derived lots are cut along avenue sides from the seed (`src/sim/layout.js:167-194,201-212`) |
| CS-03-031 | No zoning on large roads | partial | Zones exist only on the derived lots set back from roads (`src/sim/layout.js:192-194`); zoning along roads starts with M5-1, no highways exist |
| CS-03-032 | Under-construction state | built | SITE stage is a construction site with crane (`src/sim/zoning.js:11`; `src/render/zoning.js` cranes) |
| CS-03-033 | Unlocking density through growth | planned | M5-12 (M5.T30) population tiers per `docs/ZONING.md` |
| CS-03-034 | Self-sufficient residential buildings | missing | searched "eco house", "self-sufficient"; none |
| CS-03-035 | Organic commercial buildings | missing | searched "organic"; none |
| CS-03-036 | IT cluster offices | later | CAPABILITIES S2 (Office: later) |
| CS-03-037 | Construction deliveries | later | CAPABILITIES S29 (goods trucks: Later) |
| CS-03-038 | Waterfront business zone | missing | searched "waterfront"; none |
| CS-03-039 | Beach houses | missing | searched "beach"; none |
| CS-04-001 | Power grid radiance | planned | M12-1 (M12.T2): districts use MW by floor area; a shortfall darkens blocks; CAPABILITIES S13 |
| CS-04-002 | Power grid coverage | planned | M12-1: substations carry a district's share through the same road network; CAPABILITIES S13 |
| CS-04-003 | Power lines | out | CAPABILITIES S13: cables are not drawn, they run under every road |
| CS-04-004 | High-voltage connections | out | CAPABILITIES S13 (no drawn cables or outside grid) |
| CS-04-005 | Power meter | planned | M12-1/M12-3: the power overlay shows supply against demand per district |
| CS-04-006 | Blackout | partial | H hack blacks out a district and stalls its lots (`src/sim/street.js:227-240`; stall cause "no power", `src/sim/decline.js:46`); no power grid and no warning icon |
| CS-04-007 | Wind turbine | planned | M12-3 places "a plant"; the type set is not specified; CAPABILITIES S13 |
| CS-04-008 | Coal power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-009 | Solar power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-010 | Hydro power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-011 | Hydroelectric dam | skip | WRONG (input row: no player-built dam in either game) |
| CS-04-012 | Nuclear power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-013 | Gas power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-014 | Geothermal power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-015 | Fusion power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-016 | Turbine siting | missing | searched "wind", "turbine siting"; no wind map (weather later, CAPABILITIES S36/S45) |
| CS-04-017 | Power plant pollution | missing | searched "plant pollution"; M5-11 covers works lots, not plants |
| CS-04-018 | Water pumping station | planned | M12-2 (M12.T4): a pumping station on a river bank |
| CS-04-019 | Water tower | missing | searched "water tower"; M12 names a river pump only |
| CS-04-020 | Larger water tower | missing | searched "water tower"; none |
| CS-04-021 | Groundwater pumping station | missing | searched "groundwater"; none |
| CS-04-022 | Water pipes tool | out | CAPABILITIES S14: pipes are not drawn, they run under every road |
| CS-04-023 | Automatic water distribution | planned | M12-2: every parcel on a road joined to the pump and plant has water |
| CS-04-024 | Sewage outlet | planned | M12-2: the treatment plant's outflow shows downstream on the pollution overlay |
| CS-04-025 | Sewage treatment plant | planned | M12-2 (M12.T4) |
| CS-04-026 | Eco water treatment plant | missing | searched "eco treatment"; none |
| CS-04-027 | Inland water treatment plants | missing | searched "inland water"; none |
| CS-04-028 | Water availability meter | planned | M12-2 proves per-parcel water; the city-view service overlays (M5-8) are the meter |
| CS-04-029 | Sewage accumulation | missing | searched "sewage"; M12 has supply and outflow, not accumulation |
| CS-04-030 | Water pollution from sewage | planned | M12-2 (M12.T5): outflow shows downstream on the pollution overlay |
| CS-04-031 | Heating demand | later | CAPABILITIES S45 (seasons, snow, heating: later) |
| CS-04-032 | Boiler station | later | CAPABILITIES S45 |
| CS-04-033 | Geothermal heating plant | later | CAPABILITIES S45 |
| CS-04-034 | Heating pipes | later | CAPABILITIES S45 |
| CS-04-035 | Garbage accumulation | planned | M12-3 (M12.T6): every building makes garbage by stage |
| CS-04-036 | Garbage trucks | planned | M12-3/M12-5: a depot's trucks collect along the roads |
| CS-04-037 | Landfill | missing | searched "landfill"; none |
| CS-04-038 | Incinerator | missing | searched "incinerator"; none |
| CS-04-039 | Recycling centre | missing | searched "recycling"; none |
| CS-04-040 | Waste transfer facility | missing | searched "transfer facility"; none |
| CS-04-041 | Waste processing complex | missing | searched "waste processing"; none |
| CS-04-042 | Garbage piling warning | planned | M12-3: bags pile on the pavement and land value falls |
| CS-04-043 | Telecom coverage | later | CAPABILITIES S44 (telecom later) |
| CS-04-044 | Cell tower | later | CAPABILITIES S44 |
| CS-04-045 | Network capacity | later | CAPABILITIES S44 |
| CS-04-046 | Utility building upgrades | later | CAPABILITIES S51 (service building upgrades: Later) |
| CS-04-047 | Oil power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-048 | Advanced wind turbine | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-049 | Advanced coal power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-050 | Solar updraft tower | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-051 | Ocean thermal energy plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-052 | Small coal power plant | planned | M12-3 places "a plant"; the type set is not specified |
| CS-04-053 | Transformer station | planned | M5-5 substation halves blackout time (M5.T12); M12-1 substations carry a district's share |
| CS-04-054 | Battery facility | missing | searched "battery"; only the M6 hack battery is planned (`src/sim/battery.js`, M6.T4) |
| CS-04-055 | Utility trade | missing | searched "utility trade", "buy electricity"; none |
| CS-04-056 | Snow dump | later | CAPABILITIES S45 |
| CS-04-057 | Snow plows | later | CAPABILITIES S45 |
| CS-04-058 | Sewage export | missing | searched "sewage export"; none |
| CS-05-001 | Medical clinic | planned | M5-5 (M5.T15): clinic speeds wealth recovery |
| CS-05-002 | Hospital | later | CAPABILITIES S18 (hospital: later) |
| CS-05-003 | Medical Center | missing | searched "medical center"; none |
| CS-05-004 | Ambulances | planned | M12-5 (M12.T10): ambulances drive M3's road graph; CAPABILITIES S18 |
| CS-05-005 | Sickness and recovery | missing | searched "sickness", "ill", "recover"; no health sim |
| CS-05-006 | Health stat | missing | searched "health"; none |
| CS-05-007 | Cemetery | later | CAPABILITIES S19 (deathcare later, with ageing) |
| CS-05-008 | Crematorium | later | CAPABILITIES S19 |
| CS-05-009 | Hearses | later | CAPABILITIES S19 |
| CS-05-010 | Dead body pile-up | later | CAPABILITIES S19 |
| CS-05-011 | Fire House | planned | M5-5 (M5.T14): a fire alarm clears in half the time within 300 m of a station |
| CS-05-012 | Fire Station | planned | M5-5 (M5.T14) |
| CS-05-013 | Fire helicopter depot | missing | searched "fire helicopter"; none |
| CS-05-014 | Firewatch tower | missing | searched "firewatch"; none |
| CS-05-015 | Building fires | planned | M12-4 (M12.T8): buildings catch fire by use and stage |
| CS-05-016 | Fire engines | planned | M12-4/M12-5 (M12.T10): a truck drives from the nearest station |
| CS-05-017 | Fire coverage | planned | M5-5 fire station catchment (M5.T11/T14); M12-4 for the truck |
| CS-05-018 | Police station | planned | M5-5 (M5.T13): cruisers start from the nearest station |
| CS-05-019 | Police headquarters | missing | searched "headquarters"; none |
| CS-05-020 | Prison | later | CAPABILITIES S50 (crime rate and prisons: Later) |
| CS-05-021 | Crime rate | later | CAPABILITIES S50 |
| CS-05-022 | Patrol cars | built | Pursuit cruisers chase by heat (`src/sim/wanted.js:44-47,60-66`; `src/render/police.js:65,212`) |
| CS-05-023 | Criminals caught and jailed | partial | Busted ends the chase (`src/main.js:1155-1158`); the "criminal" is the player, no station or jail (S50 later) |
| CS-05-024 | Elementary school | planned | M5-5 (M5.T15): school speeds wealth recovery |
| CS-05-025 | High school | missing | searched "high school"; only the one M5 school exists in the plan |
| CS-05-026 | University | missing | searched "university"; education levels are later (CAPABILITIES S20) |
| CS-05-027 | College | missing | searched "college"; none |
| CS-05-028 | Library | missing | searched "library"; none |
| CS-05-029 | Education coverage | planned | M5-8 (M5.T21) coverage overlay per service, school included; no school-type tabs |
| CS-05-030 | Post office | later | CAPABILITIES S57 (post: Later, with the fleets) |
| CS-05-031 | Post sorting facility | later | CAPABILITIES S57 |
| CS-05-032 | Mail delivery | later | CAPABILITIES S57 |
| CS-05-033 | Road maintenance depot | later | CAPABILITIES S54 (road wear and maintenance: Later) |
| CS-05-034 | Snow dump | skip | DUPLICATE of CS-04-056 (input row) |
| CS-05-035 | Snowplows | skip | DUPLICATE of CS-04-057 (input row) |
| CS-05-036 | Disaster Response Unit | out | CAPABILITIES S32 (natural disasters: Out) |
| CS-05-037 | Emergency shelter | out | CAPABILITIES S32 |
| CS-05-038 | Weather radar | out | CAPABILITIES S32 |
| CS-05-039 | Earthquake sensor | out | CAPABILITIES S32 |
| CS-05-040 | Deep space radar | out | CAPABILITIES S32 |
| CS-05-041 | Tsunami warning buoy | out | CAPABILITIES S32 |
| CS-05-042 | Park maintenance | missing | searched "park maintenance"; parks are M5-5, maintenance is not planned |
| CS-05-043 | Service building panel | planned | M5-5 services as parcels with catchment and capacity (M5.T11); upkeep in M5-6 |
| CS-05-044 | Emergency vehicle priority | missing | searched "emergency priority", "give way"; none |
| CS-05-045 | Disaster response helicopters | out | CAPABILITIES S32 |
| CS-05-046 | Welfare and care services | missing | searched "welfare", "care home"; none |
| CS-05-047 | Service coverage radius | planned | M5-5 (M5.T11): each service reaches only parcels in its catchment |
| CS-05-048 | School capacity | planned | M5-5 (M5.T11): capacity in patients, pupils, cells, trucks |
| CS-05-049 | Hospital capacity | later | CAPABILITIES S18 (hospital: later) |
| CS-05-050 | Pedestrian zone services | later | CAPABILITIES S52 (pedestrian paths: Later) |
| CS-05-051 | Shelter capacity | out | CAPABILITIES S32 |
| CS-05-052 | Service building upgrades | later | CAPABILITIES S51 (service building upgrades: Later) |
| CS-05-053 | Service buildings need staff | missing | searched "staff", "workers"; no staffing sim |
| CS-05-054 | Police helicopter | built | Tier 3 response flies the helicopter (`src/sim/wanted.js:44-47`; `src/render/heli.js`) |
| CS-05-055 | Evacuation buses | out | CAPABILITIES S32 |
| CS-06-001 | Bus stop | later | CAPABILITIES S22 (bus: later); ROADMAP M5 "later" row: bus lines |
| CS-06-002 | Bus depot | later | CAPABILITIES S22 |
| CS-06-003 | Bus line tool | later | CAPABILITIES S22; ROADMAP M5 "later" row: bus lines |
| CS-06-004 | Bus terminal | later | CAPABILITIES S22 |
| CS-06-005 | Intercity bus station | later | CAPABILITIES S22 |
| CS-06-006 | Intercity bus line | later | CAPABILITIES S22 |
| CS-06-007 | Tram stop | later | CAPABILITIES S22 (tram: later) |
| CS-06-008 | Tram depot | later | CAPABILITIES S22 |
| CS-06-009 | Tram line tool | later | CAPABILITIES S22 |
| CS-06-010 | Metro station | later | CAPABILITIES S22 (metro: later) |
| CS-06-011 | Metro track tool | later | CAPABILITIES S22; ROADMAP "After the sell check" |
| CS-06-012 | Metro depot | later | CAPABILITIES S22 |
| CS-06-013 | Passenger train station | later | CAPABILITIES S22 (train: later, on M4's road in from outside) |
| CS-06-014 | Train track tool | later | CAPABILITIES S22 |
| CS-06-015 | One-way train track | later | CAPABILITIES S22 |
| CS-06-016 | Train depot | later | CAPABILITIES S22 |
| CS-06-017 | Cargo train terminal | missing | searched "cargo train", "freight"; S29 is goods trucks only |
| CS-06-018 | Cargo harbor | missing | searched "cargo harbor"; none |
| CS-06-019 | Cargo hub | missing | searched "cargo hub"; none |
| CS-06-020 | Cargo airport terminal | out | CAPABILITIES S22 (air: out, G5) |
| CS-06-021 | Monorail station | missing | searched "monorail"; none |
| CS-06-022 | Monorail line tool | missing | searched "monorail"; none |
| CS-06-023 | Monorail depot | missing | searched "monorail"; none |
| CS-06-024 | Cable car station | missing | searched "cable car"; none |
| CS-06-025 | Cable car line | missing | searched "cable car"; none |
| CS-06-026 | Ferry dock | later | CAPABILITIES S22 (ferry: later, on M4's river) |
| CS-06-027 | Ferry line | later | CAPABILITIES S22 |
| CS-06-028 | Ferry depot | later | CAPABILITIES S22 |
| CS-06-029 | Blimp stop | out | CAPABILITIES S22 (air: out, G5) |
| CS-06-030 | Blimp line | out | CAPABILITIES S22 |
| CS-06-031 | Blimp depot | out | CAPABILITIES S22 |
| CS-06-032 | Taxi stand | later | CAPABILITIES S22 (taxi: later, G25) |
| CS-06-033 | Taxis | later | CAPABILITIES S22 |
| CS-06-034 | Trolleybus stop | later | CAPABILITIES S22 (bus: later) |
| CS-06-035 | Trolleybus line | later | CAPABILITIES S22 |
| CS-06-036 | Trolleybus depot | later | CAPABILITIES S22 |
| CS-06-037 | Passenger helicopter stop | out | CAPABILITIES S22 (air: out, G5) |
| CS-06-038 | Passenger helicopter line | out | CAPABILITIES S22 |
| CS-06-039 | Aviation Club | out | CAPABILITIES S22 |
| CS-06-040 | Small airport | out | CAPABILITIES S22 |
| CS-06-041 | International Airport | out | CAPABILITIES S22 |
| CS-06-042 | Airport area tool | out | CAPABILITIES S22 |
| CS-06-043 | Modular airport terminal | out | CAPABILITIES S22 |
| CS-06-044 | Runways and taxiways | out | CAPABILITIES S22 |
| CS-06-045 | Control tower | out | CAPABILITIES S22 |
| CS-06-046 | Airline progression | out | CAPABILITIES S22 |
| CS-06-047 | Airport transit connections | out | CAPABILITIES S22 |
| CS-06-048 | Transport Hub | later | CAPABILITIES S22 (bus, tram, metro: later) |
| CS-06-049 | Multiplatform train and metro station | later | CAPABILITIES S22 |
| CS-06-050 | End-of-line train and metro station | later | CAPABILITIES S22 |
| CS-06-051 | Ferry and bus stop | later | CAPABILITIES S22 |
| CS-06-052 | Monorail and bus hub | missing | searched "monorail"; none |
| CS-06-053 | Monorail, train and metro hub | missing | searched "monorail"; none |
| CS-06-054 | Metro and intercity bus hub | later | CAPABILITIES S22 |
| CS-06-055 | Bus and intercity bus hub | later | CAPABILITIES S22 |
| CS-06-056 | Train and metro hub | later | CAPABILITIES S22 |
| CS-06-057 | Bus and metro hub | later | CAPABILITIES S22 |
| CS-06-058 | Metropolitan Airport | out | CAPABILITIES S22 |
| CS-06-059 | Line creation | later | CAPABILITIES S22 (bus lines: later) |
| CS-06-060 | Editing stops | later | CAPABILITIES S22 |
| CS-06-061 | Line vehicle count slider | later | CAPABILITIES S22 |
| CS-06-062 | Line overview panel | later | CAPABILITIES S22 |
| CS-06-063 | Line name and colour | later | CAPABILITIES S22 |
| CS-06-064 | Vehicle model choice | later | CAPABILITIES S22 |
| CS-06-065 | Intercity station toggle | later | CAPABILITIES S22 |
| CS-06-066 | Transport line overlay | later | CAPABILITIES S22 (overlays are M5-8; transit lines later) |
| CS-06-067 | Passenger counters | later | CAPABILITIES S22 |
| CS-06-068 | Ports | missing | searched "port"; none |
| CS-06-069 | Cargo stations and harbours | missing | searched "cargo"; S29 is trucks only |
| CS-06-070 | City Stations pack | missing | searched "station pack"; none |
| CS-06-071 | Cargo ships | missing | searched "cargo ship"; none |
| CS-06-072 | Passenger ferries | later | CAPABILITIES S22 (ferry: later) |
| CS-06-073 | Taxi depot | later | CAPABILITIES S22 (taxi: later, G25) |
| CS-06-074 | Metro without depot | later | CAPABILITIES S22 (metro: later) |
| CS-06-075 | Taxi depot | later | CAPABILITIES S22 |
| CS-06-076 | Sightseeing bus line | missing | searched "sightseeing"; S42 names visitors spending, not a bus line |
| CS-06-077 | Airport concourse pieces | out | CAPABILITIES S22 |
| CS-06-078 | School buses | missing | searched "school bus"; none |
| CS-07-001 | Lane-based pathfinding | partial | Cars hold a lane and wrap (`src/sim/street.js:124-156,291-304`); police route the graph (`src/sim/patrol.js:68`); lane choice and turns planned M3-6 |
| CS-07-002 | Fastest-route pathfinding | partial | Police A* to the suspect (`src/sim/patrol.js:68`); traffic loops straight; full routing planned M3-6 (M3.T30) |
| CS-07-003 | Turn-based lane choice | planned | M3-6 (M3.T29): cars hold an edge, lane and route and turn at nodes |
| CS-07-004 | Speed limits per road | missing | searched "speed limit"; one road kind, no limits |
| CS-07-007 | Congestion | planned | M3-6 (M3.T29 car following) and M5-14 junction waits (M5.T31); no queues today |
| CS-07-008 | Rush hour | partial | Walker share and direction follow the rushes (`src/sim/commute.js:8-25,73-82`); cars loop all day (`src/sim/street.js:291-304`) |
| CS-07-009 | Commuting routes | partial | Residents have homes/jobs and walk to their goal (`src/sim/commute.js:50-63,73-82`); no routes along the graph until M3-6 |
| CS-07-010 | Freight routing | later | CAPABILITIES S29 (goods trucks: Later) |
| CS-07-011 | Import and export trucks | later | CAPABILITIES S29; outside road M4-9 |
| CS-07-012 | Cargo transfers | missing | searched "cargo transfer"; none |
| CS-07-013 | Household car ownership | missing | searched "car ownership"; none |
| CS-07-014 | Travel mode choice | missing | searched "travel mode"; no transit yet (S22 later) |
| CS-07-015 | Parked cars | built | Parked cars sit in kerb slots (`src/sim/street.js:36,176-187`) |
| CS-07-016 | Roadside parking | built | Kerbside parked cars (`src/sim/street.js:176-187`); no parking space system |
| CS-07-017 | Parking lots and garages | later | CAPABILITIES S38 (parking: Later) |
| CS-07-018 | Parking halls and service parking | later | CAPABILITIES S38 |
| CS-07-019 | Cyclists | later | CAPABILITIES S52 (bicycles: Later) |
| CS-07-020 | Bike lane preference | later | CAPABILITIES S52 |
| CS-07-021 | Bike parking | later | CAPABILITIES S52 (bike hoops are only drawn, `src/render/block.js:550`) |
| CS-07-022 | Pedestrian walking | built | Walkers stroll sidewalks (`src/sim/street.js:96-122,274-290`); the player walks (`src/sim/player.js:19-60`) |
| CS-07-023 | Pedestrian crossings | partial | Walkers use kerb lines and footways (`src/sim/street.js:96-122`) and crosswalk stripes are drawn (`src/render/block.js:216`); no crossing rule on the graph |
| CS-07-024 | Walking shortcuts | later | CAPABILITIES S52 (foot paths: Later) |
| CS-07-025 | Traffic accidents | later | CAPABILITIES S55 (accidents with no player: Later) |
| CS-07-026 | Road wear | later | CAPABILITIES S54 (road wear: Later) |
| CS-07-027 | Snow and slush | later | CAPABILITIES S45 (seasons, snow: Later) |
| CS-07-028 | One-way flow rules | planned | M5-10 (M5.T24): edges get `oneWay` and traffic uses it |
| CS-07-030 | Gridlock at junctions | planned | M6-4 (M6.T7): the signals hack jams a junction; no queues today |
| CS-07-031 | Transit in traffic | later | CAPABILITIES S22 |
| CS-07-032 | Freight trains | missing | searched "freight train"; none |
| CS-07-033 | Route to school and work | partial | Work commute only (`src/sim/commute.js:50-63`); school routing waits on M5-5 and education later (S20) |
| CS-07-034 | Pathfinding by time and cost | planned | M3-6 (M3.T30): A* routes between parcels; ticket cost and comfort are not planned |
| CS-07-035 | Parking search traffic | later | CAPABILITIES S38 |
| CS-07-036 | Rail level crossings | skip | DUPLICATE of CS-02-074 (input row) |
| CS-07-037 | Vehicle loading | missing | searched "passengers per", "cargo load"; no buses, trucks or trains exist |
| CS-07-038 | Walking speed by path | missing | searched "walk speed"; the player has one speed (`src/sim/player.js:5-6`) |
| CS-07-039 | Parking fees | later | CAPABILITIES S38 |
| CS-07-040 | Accident aftermath cleanup | later | CAPABILITIES S55 |
| CS-08-001 | Individual citizens | built | Named residents with age, home and job (`src/sim/people.js:35-47,106-113`) |
| CS-08-002 | Citizen portraits | partial | Profiler panel shows text only (`src/render/profiler.js:36-49`); no portrait art |
| CS-08-003 | Age groups | partial | Everyone is a working-age adult, 18-66 (`src/sim/people.js:23-24,45`); no children, teens or seniors |
| CS-08-004 | Ageing | later | CAPABILITIES S28 (ageing later, with deathcare S19) |
| CS-08-005 | Births | later | CAPABILITIES S28/S19 |
| CS-08-006 | Deaths | later | CAPABILITIES S28/S19 |
| CS-08-007 | Immigration | built | `moveHomes` adds residents to lots short of people (`src/sim/people.js:49-67`) |
| CS-08-008 | Emigration | partial | A shrinking lot loses its newest residents, "they leave the city" (`src/sim/people.js:49-66`); keyed to lot capacity, not happiness |
| CS-08-009 | Households | missing | searched "household", "family"; people share a home parcel but no family unit exists |
| CS-08-011 | Education levels | later | CAPABILITIES S20 (education levels: later) |
| CS-08-012 | Elementary schooling | later | CAPABILITIES S20 |
| CS-08-013 | High schooling | later | CAPABILITIES S20 |
| CS-08-014 | Higher education | later | CAPABILITIES S20 |
| CS-08-015 | Graduation | later | CAPABILITIES S20 |
| CS-08-016 | Dropouts | missing | searched "dropout"; none |
| CS-08-017 | Employment | built | `matchJobs` fills job places from the unemployed (`src/sim/people.js:70-93`) |
| CS-08-018 | Specific workplaces | partial | A job is a parcel index (`src/sim/people.js:35-36,76-92`), not a named company (CS2) |
| CS-08-019 | Unemployment | partial | `census` counts the out-of-work (`src/sim/people.js:100-103`); no HUD figure and no crime (S50 later) |
| CS-08-020 | Commuting | built | At the rushes residents walk between home and job parcels (`src/sim/commute.js:50-63,73-82`) |
| CS-08-021 | Happiness | missing | searched "happiness"; none |
| CS-08-022 | Happiness factors | later | CAPABILITIES S49 (happiness later, needs catchments S47) |
| CS-08-023 | Health | missing | searched "health"; none |
| CS-08-024 | Sickness and treatment | missing | searched "sick", "treatment"; none |
| CS-08-025 | Wealth | partial | Wealth is per district (`src/sim/economy.js:54-58,242-243`), not held by households |
| CS-08-026 | Rent | later | CAPABILITIES S56 (rent, affordability, homelessness: Later) |
| CS-08-027 | Homelessness | later | CAPABILITIES S56 |
| CS-08-028 | Tourists | later | CAPABILITIES S42 (tourism: Later) |
| CS-08-029 | Tourist arrival routes | later | CAPABILITIES S42; outside road M4-9 |
| CS-08-030 | Tourist attractions | later | CAPABILITIES S42/S31 |
| CS-08-032 | Tourist spending | later | CAPABILITIES S42 |
| CS-08-033 | Leisure visits | missing | searched "leisure"; none |
| CS-08-034 | Shopping for goods | later | CAPABILITIES S29 (goods: Later) |
| CS-08-035 | Service use | missing | searched "attend school", "visit clinic"; services are M5-5 but citizens do not visit them |
| CS-08-036 | Chirper panel | built | The news line (`src/sim/news.js:1-12`, `src/render/news.js`; HUD at `src/main.js:1250`) |
| CS-08-037 | Chirper problem posts | built | News lines name the change and its cause, e.g. "after the power cut", "after the police chase" (`src/sim/news.js:24,48-56`) |
| CS-08-038 | Chirper hats | missing | searched "hat", "chirper"; none |
| CS-08-039 | Citizen info panel | partial | Profiler shows name, age, home and work (`src/sim/people.js:106-113`); no education, wealth or happiness |
| CS-08-040 | Follow a citizen | missing | searched "follow", "track citizen"; none |
| CS-08-041 | Citizens flee danger | out | CAPABILITIES S32 (natural disasters: Out) |
| CS-08-042 | Citizen needs | missing | searched "needs"; none |
| CS-08-043 | Jobs match education | later | CAPABILITIES S20 |
| CS-08-044 | Citizens give feedback | missing | searched "mood", "bubble"; none |
| CS-08-045 | Criminal citizens | later | CAPABILITIES S50 (crime rate and prisons: Later) |
| CS-09-001 | City cash balance | planned | M5-6 (M5.T17-T18): city money, taxes and upkeep in the city view; CAPABILITIES S23 |
| CS-09-002 | Weekly budget cycle | planned | M5-6: income and upkeep settle each game minute, not a weekly report |
| CS-09-003 | Budget income tab | planned | M5-6 (M5.T18): tax per use and the money line; not a full income tab |
| CS-09-004 | Budget expense tab | planned | M5-6: upkeep per road metre and service |
| CS-09-005 | Residential tax slider | planned | M5-6 (M5.T17) |
| CS-09-006 | Commercial tax slider | planned | M5-6 |
| CS-09-007 | Industrial tax slider | planned | M5-6 |
| CS-09-008 | Office tax slider | later | CAPABILITIES S2 (office: later) |
| CS-09-009 | Taxes by education | skip | WRONG (input row: taxes are per zone type only) |
| CS-09-010 | Tax effects | planned | M5-6: a higher tax lowers that use's demand |
| CS-09-011 | Over-taxed abandonment | planned | M5-6: lower demand feeds M1's decline path |
| CS-09-012 | Loans | later | CAPABILITIES S23 (service sliders and loans: later) |
| CS-09-013 | Loan repayment | later | CAPABILITIES S23 |
| CS-09-014 | Service budget sliders | later | CAPABILITIES S23 |
| CS-09-015 | Budget effects on services | later | CAPABILITIES S23 |
| CS-09-016 | Bankruptcy warning | planned | M5-6: in debt, services shut farthest first and the news says so |
| CS-09-017 | Building upkeep | planned | M5-6 charges upkeep per road metre and service; per-building upkeep is not named |
| CS-09-018 | Land value | planned | M5-8 (M5.T21) land-value formula and overlay; M5-11 pollution lowers it |
| CS-09-020 | Imports and exports | later | CAPABILITIES S29 (goods: Later) |
| CS-09-021 | Trade and commodities panel | later | CAPABILITIES S29 |
| CS-09-022 | Market prices | missing | searched "market price", "supply and demand price"; none |
| CS-09-023 | Company profits | missing | searched "profit"; firms move but do not keep books |
| CS-09-024 | Office and industry revenue | partial | District economy models jobs, homes, firms and wealth (`src/sim/economy.js:1-8,98-120`); taxes are M5-6; goods chain is out (S37) |
| CS-09-025 | Tourism income | later | CAPABILITIES S42 (tourism: Later) |
| CS-09-026 | Starting funds | planned | M5-6 budget frame (M5.T17); the starting sum is not written yet |
| CS-09-027 | Loan availability | later | CAPABILITIES S23 |
| CS-09-028 | Household economy | later | CAPABILITIES S56 (rent, affordability: Later) |
| CS-09-029 | Economy rework | missing | searched "economy rework"; CS2 patch feature, not in the plan |
| CS-09-030 | Industry area profit | later | CAPABILITIES S43 (specialised industry: Later) |
| CS-09-031 | Unique factory goods | later | CAPABILITIES S43 |
| CS-09-032 | Oil and ore sale | later | CAPABILITIES S43 |
| CS-09-033 | Fares income | later | CAPABILITIES S22 (public transport: later) |
| CS-09-034 | Budget roadmap | planned | M5-7 (M5.T19) shows a tool's cost before it acts; a full budget forecast is not planned |
| CS-09-035 | Demolition refund | planned | M5-7 (M5.T26): Ctrl+Z refunds the act's cost in full; bulldoze refund not named |
| CS-09-036 | Service fees | missing | searched "service fee", "fee"; none |
| CS-09-037 | Toll income | missing | searched "toll"; none |
| CS-09-038 | Company rent | later | CAPABILITIES S56 (rent: Later) |
| CS-10-001 | Generic industry | partial | `ind` lots grow and hold workers (`src/sim/zoning.js:13`, `src/sim/people.js:30-33`); no goods produced (S37 out) |
| CS-10-002 | Industry building levels | built | Industry lots grow EMPTY, SITE, LOW, MID, HIGH by demand (`src/sim/zoning.js:11,147-172`) |
| CS-10-003 | Farming specialisation | later | CAPABILITIES S43 (farmland and forest feeding works districts: Later) |
| CS-10-004 | Forestry specialisation | later | CAPABILITIES S43 |
| CS-10-005 | Oil specialisation | later | CAPABILITIES S43 |
| CS-10-006 | Ore specialisation | later | CAPABILITIES S43 |
| CS-10-007 | Resource depletion | missing | searched "depletion", "deposit"; S43 names no deposits |
| CS-10-008 | Renewable resources | missing | searched "renewable", "regrow"; none |
| CS-10-009 | Goods for shops | later | CAPABILITIES S29 (goods from works to shops: Later) |
| CS-10-010 | No-goods warning | later | CAPABILITIES S29 |
| CS-10-011 | No-customers warning | missing | searched "customers"; shops do not track trade that way |
| CS-10-012 | Offices | later | CAPABILITIES S2 (Office: later) |
| CS-10-013 | IT Cluster | later | CAPABILITIES S2 |
| CS-10-014 | Financial offices | later | CAPABILITIES S2 |
| CS-10-015 | Office Evolution pack | missing | searched "office pack"; none |
| CS-10-016 | Low-density commerce | partial | `com` lots grow shops (`src/sim/zoning.js:13`); no density types |
| CS-10-017 | High-density commerce | partial | `com` lots grow to HIGH (`src/sim/zoning.js:11,147-172`); no density types |
| CS-10-018 | Tourism commercial specialisation | later | CAPABILITIES S42 (tourism: Later) |
| CS-10-019 | Leisure commercial specialisation | missing | searched "nightlife", "leisure"; none |
| CS-10-020 | Organic produce | skip | DUPLICATE of CS-03-035 (input row) |
| CS-10-021 | Industry area tool | later | CAPABILITIES S43 |
| CS-10-022 | Industry area main building | later | CAPABILITIES S43 |
| CS-10-023 | Industry area levels | later | CAPABILITIES S43 |
| CS-10-024 | Extractors | later | CAPABILITIES S43 |
| CS-10-025 | Processors | out | CAPABILITIES S37 (industry chains: Out, a second economy) |
| CS-10-026 | Industry auxiliary buildings | later | CAPABILITIES S43 |
| CS-10-027 | Warehouses | out | CAPABILITIES S37 |
| CS-10-028 | Warehouse storage modes | out | CAPABILITIES S37 |
| CS-10-029 | Unique factories | out | CAPABILITIES S37 |
| CS-10-030 | Production chains | out | CAPABILITIES S37 |
| CS-10-031 | Fishing industry | missing | searched "fish"; none |
| CS-10-032 | Fishing harbour | missing | searched "fish", "harbour"; none |
| CS-10-033 | Fishing boats and routes | missing | searched "fish"; none |
| CS-10-034 | Fish farms | missing | searched "fish farm"; none |
| CS-10-035 | Fish factory | missing | searched "fish"; none |
| CS-10-036 | Fish market | missing | searched "fish"; none |
| CS-10-037 | Fish types | missing | searched "fish"; none |
| CS-10-038 | Tourism support buildings | later | CAPABILITIES S42 |
| CS-10-039 | Specialised industry zones | later | CAPABILITIES S43 |
| CS-10-040 | Extractors and processors | later | CAPABILITIES S43 (extractors); processors are out (S37) |
| CS-10-041 | Industrial companies | missing | searched "company", "profit"; firms move but keep no books |
| CS-10-042 | Commercial companies | missing | searched "company"; none |
| CS-10-043 | Central bank and stock exchange | missing | searched "bank", "stock exchange"; the M6 bank hack is planned (M6.T17), not a building |
| CS-10-044 | Refined and unique goods names | out | CAPABILITIES S37 |
| CS-10-045 | Office workers by education | later | CAPABILITIES S2 (office) and S20 (education levels: later) |
| CS-10-046 | Night-time leisure | missing | searched "nightlife", "leisure"; none |
| CS-10-047 | Fishing industry | missing | searched "fish"; none |
| CS-10-048 | Offshore oil | missing | searched "offshore", "oil rig"; none |
| CS-11-001 | District painting tool | later | S25: districts generated and named by the map; painting after the sell check |
| CS-11-002 | District renaming | later | S25 (districts named by the map; player rename after the sell check) |
| CS-11-003 | District info panel | partial | `src/render/economy.js:80-96` district table (jobs, homes, wealth, demand, firms); missing population, land value, specialisations, policies, click-select |
| CS-11-004 | Area naming | missing | searched "area name", "park area", "campus area": no area system in `src/` or the plan |
| CS-11-005 | Area main building | missing | searched "area main", "main building": no area system in `src/` or the plan |
| CS-11-006 | Area levels | missing | searched "area level", "park level": no area system in `src/` or the plan |
| CS-11-007 | Area info panel | missing | searched "area info", "area panel": no area system in `src/` or the plan |
| CS-11-008 | Park area tool | planned | M5-5 places a park service on a lot; no painted park area tool |
| CS-11-009 | Campus area tool | missing | searched "campus": no campus system; education levels later (S20) |
| CS-11-010 | Pedestrian zone tool | missing | searched "pedestrian zone": nothing in `src/` or the plan |
| CS-11-011 | Pedestrian zone service points | missing | searched "pedestrian zone", "service point": nothing in `src/` or the plan |
| CS-11-012 | City policies panel | later | S24: city and district policies after the sell check |
| CS-11-013 | District policies panel | later | S24: city and district policies after the sell check |
| CS-11-014 | Policy unlocks | later | S24: city and district policies after the sell check |
| CS-11-015 | Policy upkeep | later | S24: city and district policies after the sell check |
| CS-11-016 | Free Public Transport | later | S24; public transport itself later (S22) |
| CS-11-017 | School's Out | later | S24; education levels later (S20) |
| CS-11-018 | Education Boost | later | S24; education levels later (S20) |
| CS-11-019 | Heavy Traffic Ban | later | S24: city and district policies after the sell check |
| CS-11-020 | Highrise Ban | later | S24; M5-4 has a per-lot height cap, not a district policy |
| CS-11-021 | Old Town | later | S24: city and district policies after the sell check |
| CS-11-022 | Industry 4.0 | later | S24; industry production chains are out (S37) |
| CS-11-023 | Smoke Detector Distribution | later | S24; fire itself planned at M12-4 |
| CS-11-024 | Smoking Ban | later | S24: city and district policies after the sell check |
| CS-11-025 | Recreational Use | later | S24: city and district policies after the sell check |
| CS-11-026 | Combustion Engine Ban | later | S24: city and district policies after the sell check |
| CS-11-027 | Electric Cars | later | S24: city and district policies after the sell check |
| CS-11-028 | Energy Saving | later | S24; power with supply and demand planned at M12-1 |
| CS-11-029 | Green policy set | later | S24: city and district policies after the sell check |
| CS-11-030 | Only Electricity for Heating | skip | WRONG: no such policy in the input |
| CS-11-031 | Ban Electricity for Heating | later | S24; seasons/heating later (S45) |
| CS-11-032 | Park city policies | later | S24; parks arrive as a service in M5 (S21) |
| CS-11-033 | Animal Ethics | later | S24: city and district policies after the sell check |
| CS-11-034 | Fireworks | skip | WRONG: Parklife has no Fireworks policy in the input |
| CS-11-035 | Mass Transit policy set | skip | WRONG: Mass Transit added no policies in the input |
| CS-11-036 | Sunset Harbor policy set | later | S24: city and district policies after the sell check |
| CS-11-037 | Policies panel | later | S24: city and district policies after the sell check |
| CS-11-038 | Cycling policies | later | S52: bicycles and cycle paths after the sell check |
| CS-11-039 | District-scoped rules | later | S24: city and district policies after the sell check |
| CS-11-040 | High Tech Housing | later | S24: city and district policies after the sell check |
| CS-11-041 | Industrial Space Planning | later | S24; industry production chains are out (S37) |
| CS-11-042 | Small Business Enthusiast | later | S24: city and district policies after the sell check |
| CS-11-043 | Filter Industrial Waste | later | S24; pollution planned at M5-11 |
| CS-11-044 | Studded Tires | later | S24; snow and seasons later (S45) |
| CS-11-045 | VIP shelters | out | S32: natural disasters are out |
| CS-11-046 | Fast Recovery | out | S32: natural disasters are out |
| CS-11-047 | Encourage Biking | later | S52: bicycles and cycle paths after the sell check |
| CS-11-048 | Educational Blimps | later | S24; blimps are Mass Transit content, transport later (S22) |
| CS-11-049 | For-Profit Education | later | S24; education levels later (S20) |
| CS-11-050 | Airplane Tours | out | G5: aircraft are out |
| CS-11-051 | Dolphin-Safe Fishing | missing | searched "fishing", "fish": no fishing system in `src/` or the plan |
| CS-11-052 | Sustainable Fishing | missing | searched "fishing", "fish": no fishing system in `src/` or the plan |
| CS-11-053 | Boost Connections | later | S24; the outside road arrives in M4-9 |
| CS-11-054 | Even More Fun | later | S24; parks arrive as a service in M5 (S21) |
| CS-11-055 | Come One Come All | missing | searched "stadium", "match day": no stadium or event system in `src/` or the plan |
| CS-11-056 | Festival policies | missing | searched "festival", "concert": no festival or concert system in `src/` or the plan |
| CS-11-057 | Campus and varsity policies | missing | searched "campus policy", "varsity": no campus system in `src/` or the plan |
| CS-11-058 | Import City Services | later | S24; buying services from outside is not planned before the sell check |
| CS-11-059 | Pre-Release Programs | later | S50: city crime rate and prisons after the sell check (S24) |
| CS-11-060 | City Promotion | later | S42: tourism after the sell check (S24) |
| CS-11-061 | High-Speed Highways | later | S9: highways after the sell check (S24) |
| CS-11-062 | Energy Consumption Awareness | later | S24; power with supply and demand planned at M12-1 |
| CS-11-063 | Recycling policy | later | S24; garbage collection planned at M12-3 (S15) |
| CS-11-064 | Roadside Parking Fee | later | S38: parking after the sell check (S24) |
| CS-11-065 | Speed Bumps | later | S24: city and district policies after the sell check |
| CS-11-066 | Gated Community | later | S24: city and district policies after the sell check |
| CS-11-067 | Building policies | later | S24: city and district policies after the sell check |
| CS-12-001 | Small parks | planned | M5-5: a park service placed on a lot (S21) |
| CS-12-002 | Playgrounds | missing | searched "playground", "park props": no playground in `src/` or the plan |
| CS-12-003 | Plazas | planned | M5-5: parks and plazas arrive as services/places (S21) |
| CS-12-004 | Pedestrian paths | later | S52: foot paths after the sell check |
| CS-12-005 | Path styles | later | S52: cycle and foot paths after the sell check |
| CS-12-006 | City Park area | missing | searched "park area", "parklife": no painted park areas; M5-5 is one park building |
| CS-12-007 | Amusement Park area | missing | searched "amusement": nothing in `src/` or the plan |
| CS-12-008 | Nature Reserve area | missing | searched "nature reserve": nothing in `src/` or the plan |
| CS-12-009 | Zoo area | missing | searched "zoo": nothing in `src/` or the plan |
| CS-12-010 | Park gate | missing | searched "park gate", "ticket": nothing in `src/` or the plan |
| CS-12-011 | Park ticket price | missing | searched "park ticket", "admission": nothing in `src/` or the plan |
| CS-12-012 | Park props anywhere | later | S53: hand-placed decoration after the sell check |
| CS-12-013 | Buildings beside paths | later | S52/S53: paths and decoration after the sell check |
| CS-12-014 | Park levels | missing | searched "park level", "park area": nothing in `src/` or the plan |
| CS-12-015 | Sightseeing bus | skip | DUPLICATE of CS-06-076 in the input |
| CS-12-016 | Walking tours | later | S42: tourism after the sell check |
| CS-12-017 | Sightseeing tours | later | S42: tourism after the sell check |
| CS-12-018 | Amusement rides | missing | searched "amusement", "ride": nothing in `src/` or the plan |
| CS-12-019 | Castle of Lord Chirpwick | missing | searched "Chirpwick", "monument": no monument content in `src/` or the plan |
| CS-12-020 | Unique buildings | later | S31: unique buildings and landmarks after the sell check |
| CS-12-021 | Eden Project | later | S31: unique buildings and landmarks after the sell check |
| CS-12-022 | Hadron Collider | later | S31: unique buildings and landmarks after the sell check |
| CS-12-024 | Space Elevator | later | S31: unique buildings and landmarks after the sell check |
| CS-12-025 | Doomsday Vault | out | S32: natural disasters are out |
| CS-12-026 | Mass Transit landmarks | later | S31: unique buildings and landmarks after the sell check |
| CS-12-027 | Deluxe landmarks | later | S31: unique buildings and landmarks after the sell check |
| CS-12-028 | Concert venues | missing | searched "concert", "venue": nothing in `src/` or the plan |
| CS-12-029 | Concert management | missing | searched "concert", "ticket": nothing in `src/` or the plan |
| CS-12-030 | Hotels | later | S42: tourism after the sell check; HOTEL signs and the arc's hotel exist as scenery (`src/content/signs.json:3`) |
| CS-12-031 | Hotel star ratings | missing | searched "hotel rating", "star": only a sign subtitle `★★★`, no hotel system |
| CS-12-032 | Hotel variety | missing | searched "hotel", "resort": no hotel gameplay in `src/` or the plan |
| CS-12-033 | Hotel locations | missing | searched "hotel location", "attract": no hotel gameplay in `src/` or the plan |
| CS-12-034 | Beach properties | missing | searched "beach", "coast": no coast; M4 plans a river only |
| CS-12-036 | Parks and recreation service | planned | M5-5: the park service (S21) |
| CS-12-037 | Pocket parks | missing | searched "pocket park": a pocket park is generated scenery (`src/sim/world.js:40`), not ploppable |
| CS-12-040 | Landmark buildings | later | S31: unique buildings and landmarks after the sell check |
| CS-12-041 | Decoration menu | later | S53: hand-placed decoration after the sell check |
| CS-12-042 | Decals | missing | searched "decal", "ground markings": no player decals in `src/` or the plan |
| CS-12-043 | Surface painting | missing | searched "surface paint", "paving": nothing in `src/` or the plan (terraforming is out, S33) |
| CS-12-044 | Statues and fountains | later | S53: hand-placed decoration after the sell check |
| CS-12-045 | Leisure piers | missing | searched "pier", "leisure pier": no pier content in `src/` or the plan |
| CS-12-046 | Lighthouses | missing | searched "lighthouse": nothing in `src/` or the plan |
| CS-12-047 | City attractiveness | later | S42: tourism after the sell check |
| CS-13-001 | Raise and lower terrain | out | S33: terraforming is out; M4's terrain is the placement authority |
| CS-13-002 | Level terrain | out | S33: terraforming is out |
| CS-13-003 | Soften terrain | out | S33: terraforming is out |
| CS-13-004 | Water source tool | out | S33: placing water is out |
| CS-13-005 | Sewage outlet tool | planned | M12-2: pumping station and treatment plant, outflow downstream |
| CS-13-006 | Remove water | out | S33: placing water is out |
| CS-13-007 | Canals | missing | searched "canal", "waterway": only a street name (`src/sim/streetnames.js:19`) |
| CS-13-008 | Plant a single tree | later | S53: hand-placed decoration after the sell check |
| CS-13-009 | Tree brush | later | S53: hand-placed decoration after the sell check |
| CS-13-010 | Tree species | missing | searched "species", "palm", "pine": trees are procedural, no species choice |
| CS-13-011 | Tree age stages | missing | searched "tree age", "sapling": no tree tool in `src/` or the plan |
| CS-13-012 | Line tool | later | S53: hand-placed decoration after the sell check |
| CS-13-013 | Roadside tree selector | partial | `src/render/props.js:117` street trees already line the avenues; no species/side selector |
| CS-13-014 | Day and night cycle | built | `src/sim/clock.js:8-16,39` 12-minute day; `src/main.js:1027` ticks it every frame |
| CS-13-015 | Day/night option | partial | `src/main.js:444` T jumps to day or night (`clock.js:51`); no options switch to stop the cycle |
| CS-13-016 | Night lighting | built | `src/main.js:1069-1092` lamps, signs, windows, interiors and road paint answer night; `src/render/lamps.js` |
| CS-13-017 | Rain | built | `src/render/rain.js:18`; `src/main.js:251,1102-1107`; wet streets via `src/render/setdress.js:144` puddles (always on; one rain state, VGA-051 later) |
| CS-13-018 | Snowfall | later | S45: seasons, snow and heating after VGA-051's weather |
| CS-13-019 | Fog | partial | `src/render/atmosphere.js:88,156-158` day/night distance fog; no weather fog |
| CS-13-020 | Seasons | later | S45: seasons after VGA-051's weather |
| CS-13-021 | Snow cover | later | S45: snow after VGA-051's weather |
| CS-13-022 | Cold snaps | later | S45: heating and cold after VGA-051's weather |
| CS-13-023 | Winter maps | later | S45: seasons and snow after the sell check (S58) |
| CS-13-024 | Ground pollution | planned | M5-11: works lots pollute by stage |
| CS-13-025 | Water pollution | planned | M12-2: treatment outflow shows downstream on the pollution overlay |
| CS-13-026 | Noise pollution | planned | M5-11: busy roads make noise by their edge load |
| CS-13-027 | Air pollution | missing | searched "air pollution", "air quality": nothing in `src/` or the plan |
| CS-13-028 | Pollution sickness | missing | searched "sickness", "health": no health system (hospital later, S18) |
| CS-13-029 | Pollution and land value | planned | M5-11: home demand and land value fall within 60 m |
| CS-13-030 | Pollution sources | planned | M5-11/M5-28; per-building reach shown by the M5-29 overlay |
| CS-13-031 | Water current pollution spread | planned | M12-2: the treatment plant's outflow shows downstream |
| CS-13-032 | Resource deposits | later | S43: farmland and forest feeding works districts after the sell check (drawn today as outskirts) |
| CS-13-033 | Wind | missing | searched "wind", "turbine": only rain's wind slant (`src/render/rain.js:49`) |
| CS-13-034 | Water flow | planned | M12-2: downstream is the one direction modelled; the M4 river itself is static |
| CS-13-035 | Climate zones | later | S58: scenarios, challenges and climates after the sell check |
| CS-13-036 | Tree-lined roads | partial | `src/render/props.js:117` street trees line the avenues; no noise effect and no variant choice |
| CS-13-037 | Groundwater | missing | searched "groundwater": nothing in `src/` or the plan |
| CS-13-038 | Water simulation | missing | searched "water simulation", "waves", "flood": the M4 river (M4-2) is static, no wave or flood sim |
| CS-13-039 | Remove trees | later | S53: hand-placed decoration (and its removal) after the sell check |
| CS-13-040 | Weather effects on power | missing | searched "weather power", "solar", "wind": no weather-driven output in `src/` or the plan |
| CS-13-041 | Thunderstorms | out | S32: natural disasters are out (lightning fires); changing weather is later (S36/VGA-051) |
| CS-13-042 | Groundwater pollution | missing | searched "groundwater", "seep": nothing in `src/` or the plan |
| CS-14-001 | Meteor strike | out | S32: natural disasters are out, "a disaster is an act with no actor" |
| CS-14-002 | Earthquake | out | S32: natural disasters are out |
| CS-14-003 | Tornado | out | S32: natural disasters are out |
| CS-14-004 | Thunderstorm | out | S32: natural disasters are out |
| CS-14-005 | Forest fire | out | S32: natural disasters are out (building fire is M12-4, not wildfire) |
| CS-14-006 | Sinkhole | out | S32: natural disasters are out |
| CS-14-007 | Tsunami | out | S32: natural disasters are out |
| CS-14-008 | City fire disaster | out | S32: natural disasters are out |
| CS-14-009 | Structural collapse | out | S32: natural disasters are out |
| CS-14-010 | Disaster panel | out | S32: natural disasters are out |
| CS-14-011 | Disaster severity | out | S32: natural disasters are out |
| CS-14-012 | Disaster warning | out | S32: natural disasters are out |
| CS-14-013 | Early warning coverage | out | S32: natural disasters are out |
| CS-14-014 | Evacuation order | out | S32: natural disasters are out |
| CS-14-015 | Release citizens | out | S32: natural disasters are out |
| CS-14-016 | Disaster response deployment | out | S32: natural disasters are out |
| CS-14-017 | Fire spread | later | S17: buildings catch fire in M12-4; fires that spread are after the sell check |
| CS-14-018 | Lightning fires | out | S32: natural disasters are out |
| CS-14-019 | Tornado damage trail | out | S32: natural disasters are out |
| CS-14-020 | Tsunami flooding | out | S32: natural disasters are out |
| CS-14-021 | Terrain scars | out | S32: natural disasters are out |
| CS-14-022 | Underground damage | out | S32: natural disasters are out |
| CS-14-023 | Rubble and ruin | out | S32: natural disasters are out; a bulldozed building leaves an empty lot (M5-2), not rubble |
| CS-14-024 | Blocked roads | out | S32: natural disasters are out |
| CS-14-028 | Chirper disaster posts | out | S32: natural disasters are out; the news line itself is built (S35, `src/sim/news.js`) |
| CS-14-029 | Lightning rod | out | S32: natural disasters are out |
| CS-14-030 | Collapsed roads | out | S32: natural disasters are out |
| CS-14-031 | Disasters off | out | S32: natural disasters are out |
| CS-15-001 | Electricity info view | planned | M5-8 power overlay; M12-1 supply/demand per district |
| CS-15-002 | Water and sewage info view | planned | M12-2 water and outflow; M5-8 overlays |
| CS-15-003 | Ground pollution info view | planned | M5-11 pollution; M5-29 pollution overlay |
| CS-15-004 | Water pollution info view | planned | M12-2: outflow downstream on the pollution overlay |
| CS-15-005 | Air pollution info view | missing | searched "air pollution", "air quality": nothing in `src/` or the plan |
| CS-15-006 | Noise pollution info view | planned | M5-28 road noise; M5-29 pollution overlay |
| CS-15-007 | Garbage info view | planned | M12-3: uncollected bags and lowered land value |
| CS-15-008 | Crime info view | later | S50: city crime rate after the sell check |
| CS-15-009 | Fire safety info view | planned | M5-8 service coverage; M12-4 fires and the truck |
| CS-15-010 | Healthcare info view | planned | M5-8 clinic coverage; M12-5 ambulances |
| CS-15-011 | Education info view | planned | M5-5 school; M5-8 coverage overlay per service |
| CS-15-012 | Public transport info view | later | S22: bus, tram, metro and train after the sell check |
| CS-15-013 | Traffic info view | planned | M5-8/M5-21 traffic overlay from the commute flow |
| CS-15-014 | Traffic routes view | missing | searched "route view", "routes": M10-2 routes only the player's waypoint, no citizen/vehicle route view |
| CS-15-016 | Population info view | later | S28: ageing and births later, with deathcare (S19); today all people are 18-66 (`src/sim/people.js:24`) |
| CS-15-017 | Land value info view | planned | M5-8/M5-21 land value overlay (formula in M5.T21) |
| CS-15-018 | Rent info view | later | S56: rent and affordability after the sell check |
| CS-15-019 | Natural resources info view | later | S43: farmland and forest after the sell check |
| CS-15-020 | Wind info view | missing | searched "wind", "wind view": nothing in `src/` or the plan |
| CS-15-021 | Building levels info view | missing | searched "building level", "levels view": lot stages exist (`src/sim/zoning.js`) but no view |
| CS-15-022 | District info view | later | S25: painting and outlining districts after the sell check |
| CS-15-023 | Happiness info view | later | S49: happiness after the sell check |
| CS-15-024 | Recreation info view | planned | M5-8 coverage overlay per service, park included (M5-5) |
| CS-15-025 | Commodities info view | later | S29: goods, imports and exports after the sell check |
| CS-15-026 | Weather info view | later | S36/VGA-051: changing weather after the sell check |
| CS-15-027 | Heating info view | later | S45: heating after VGA-051's weather |
| CS-15-028 | Radio coverage view | out | S32: natural disasters are out |
| CS-15-029 | Disaster risk view | out | S32: natural disasters are out |
| CS-15-030 | Park area view | missing | searched "park area", "park view": no painted park areas in `src/` or the plan |
| CS-15-031 | Industry area view | out | S37: industry production chains are out |
| CS-15-032 | Campus area view | missing | searched "campus": nothing in `src/` or the plan |
| CS-15-033 | Airport area view | out | G5: aircraft are out |
| CS-15-034 | Pedestrian zone view | missing | searched "pedestrian zone": nothing in `src/` or the plan |
| CS-15-035 | Tourism view | later | S42: tourism after the sell check |
| CS-15-036 | Telecom info view | later | S44: telecom and network coverage after the sell check |
| CS-15-037 | Parking info view | later | S38: parking after the sell check |
| CS-15-038 | Postal info view | later | S57: post after the sell check |
| CS-15-039 | Groundwater info view | missing | searched "groundwater": nothing in `src/` or the plan |
| CS-15-040 | Company profits view | missing | searched "profit", "company view": firms exist (`src/sim/economy.js`) but no view |
| CS-15-041 | Production and trade view | later | S29: goods, imports and exports after the sell check (chains are out, S37) |
| CS-15-042 | Info view legend | planned | M5-8: the overlay system (M5.T20-M5.T21) |
| CS-15-043 | Info view meters | partial | `src/render/economy.js:39-90` bars for jobs, homes, wealth and demand; no traffic, power, water or sewage meters |
| CS-15-044 | Info view tabs | missing | searched "tabs", "sub-view": no tabs in `src/`; per-service coverage is planned (M5-8), not tabs |
| CS-15-045 | Automatic service view | planned | M5-8: a coverage overlay per service (M5.T21); auto-opening it is not specified |
| CS-15-046 | Notification popups | partial | `src/sim/news.js:97-116` + `src/render/news.js:21-31` show up to four lines, top right; no icon and no click-to-jump |
| CS-15-047 | Building warning icons | partial | `src/render/lotnote.js:25` shows the focused parcel's reason (`src/sim/decline.js`); no icons over buildings |
| CS-15-048 | Traffic jam alert | missing | searched "jam", "congestion": no jam sim and no alert |
| CS-15-049 | Statistics panel | planned | M5-15: history panel over the last 5 game days |
| CS-15-050 | Notification history | missing | searched "history", "notification log": the news keeps only 4 live lines (`src/sim/news.js:13`) |
| CS-15-051 | Roads info view | later | S54: road wear after the sell check |
| CS-16-001 | Milestones | planned | M5-12/M5.T30: population tiers unlock tools |
| CS-16-002 | Population requirements | planned | M5-12/M5.T30: tiers set by population |
| CS-16-003 | Milestone rewards | planned | M5-12: reaching a tier unlocks tools (no cash reward specified) |
| CS-16-004 | Building unlocks | planned | M5-12/M5.T30: locked tools unlock at tiers |
| CS-16-005 | Milestone panel | planned | M5-12: "the panel shows the next tier" (M5.T30) |
| CS-16-006 | Unlock popup | missing | searched "unlock popup", "unlocked": no popup; a locked tool refuses with a line (M5-12) |
| CS-16-007 | Map tiles | missing | searched "map tile", "tile purchase": no tiles in `src/` or the plan; open land instead (S34, M5-1) |
| CS-16-008 | Tile purchase | missing | searched "tile purchase", "buy tile": nothing in `src/` or the plan |
| CS-16-009 | Tile cost | missing | searched "tile cost", "tile price": nothing in `src/` or the plan |
| CS-16-010 | Buildable area limit | missing | searched "buildable area", "bounds": the world edge is fixed (`src/sim/world.js`) but there is no designed buildable-area system |
| CS-16-011 | Tile unlocking | missing | searched "tile unlock": nothing in `src/` or the plan |
| CS-16-012 | First road unlock | planned | M5-12: road types unlock at population tiers (M5.T30) |
| CS-16-013 | Service unlocks by milestone | planned | M5-12: police station, clinic, fire station and school unlock at tiers |
| CS-16-014 | Development points | missing | searched "development point", "progression point": nothing in `src/` or the plan |
| CS-16-015 | Progression trees | missing | searched "progression tree", "unlock tree": nothing in `src/` or the plan |
| CS-16-016 | Signature building unlocks | later | S31: unique buildings and landmarks after the sell check |
| CS-16-017 | Achievements | planned | M9.T7/M9-6: at least 10 Steam achievements in the packaged build |
| CS-16-018 | Building XP | missing | searched "XP", "experience": nothing in `src/` or the plan |
| CS-17-001 | Map selection | planned | M7.T8: New Game shows the seed with a reroll and takes a typed seed (by seed, not a map list) |
| CS-17-002 | Base game maps | missing | searched "map list", "starting map": every game generates one city from a seed (`src/sim/newgame.js:45`), no map list |
| CS-17-003 | Map themes | later | S58: scenarios, challenges and climates after the sell check |
| CS-17-005 | Outside connections | planned | M4-9: one regional road enters at the map edge |
| CS-17-006 | Expansion maps | missing | searched "expansion map": no expansions in the plan |
| CS-17-007 | CS2 maps | missing | searched "map set": no map content in the plan |
| CS-17-008 | CS2 map themes | missing | searched "map theme": no map themes in `src/` or the plan |
| CS-17-009 | Free update maps | missing | searched "free map", "update map": no map content in the plan |
| CS-17-010 | Scenario mode | later | S58: scenarios and challenges after the sell check |
| CS-17-011 | Scenario win conditions | later | S58: scenarios after the sell check |
| CS-17-012 | Scenario loss conditions | later | S58: scenarios after the sell check |
| CS-17-013 | Scenario time limits | later | S58: scenarios after the sell check |
| CS-17-014 | Scenario starting conditions | later | S58: scenarios after the sell check |
| CS-17-015 | Scenario packs | later | S58: scenarios after the sell check |
| CS-17-016 | Scenario list | later | S58: scenarios after the sell check |
| CS-17-017 | New game setup | partial | `src/main.js:445,479-485` N starts a fresh generated city (`src/sim/newgame.js:45`); no map choice and no city naming |
| CS-17-018 | Unlimited money | missing | searched "unlimited money", "sandbox": no player-money economy (the ₡ is the arc's, `src/main.js:1254`) |
| CS-17-019 | Unlock all | missing | searched "unlock all": no unlock system yet (M5-12 planned) |
| CS-17-020 | Random disasters | out | S32: natural disasters are out |
| CS-17-021 | Disaster frequency | out | S32: natural disasters are out |
| CS-17-022 | Sandbox start | missing | searched "sandbox": nothing in `src/` or the plan |
| CS-17-023 | Scenario editor sharing | later | S58/S39: scenarios and editors after the sell check |
| CS-17-024 | Bridges & Ports maps | missing | searched "bridges and ports", "waterfront map": nothing in `src/` or the plan |
| CS-18-001 | Map editor | later | S39: asset editor and mods after the sell check (`BACKLOG.md`, "Localization & modding") |
| CS-18-002 | Map terrain and water tools | later | S39; terraforming itself is out of the game (S33) |
| CS-18-003 | Map outside connections | later | S39: editors after the sell check |
| CS-18-004 | Map theme settings | later | S39: editors after the sell check |
| CS-18-005 | Asset editor | later | S39: asset editor and mods after the sell check |
| CS-18-006 | Custom props | later | S39: modding after the sell check |
| CS-18-007 | Custom vehicles | later | S39: modding after the sell check |
| CS-18-008 | Custom trees | later | S39: modding after the sell check |
| CS-18-009 | Custom asset import | later | S39: modding after the sell check |
| CS-18-010 | Asset values | later | S39: asset editor after the sell check |
| CS-18-011 | Asset unlock milestone | later | S39: asset editor after the sell check |
| CS-18-012 | Scenario editor | later | S58/S39: scenarios and editors after the sell check |
| CS-18-013 | Scenario triggers | later | S58/S39: scenarios and editors after the sell check |
| CS-18-014 | Theme editor | later | S39: editors after the sell check |
| CS-18-015 | Steam Workshop | later | S39: modding after the sell check |
| CS-18-016 | Code mods | later | S39: mods after the sell check (`BACKLOG.md`) |
| CS-18-017 | Workshop assets | later | S39: modding after the sell check |
| CS-18-018 | Workshop maps and scenarios | later | S39/S58: modding after the sell check |
| CS-18-019 | Content Manager | later | S39: mods after the sell check (`BACKLOG.md`) |
| CS-18-020 | Subscribe from a save | later | S39: mods after the sell check |
| CS-18-021 | Built-in mods | later | S39: mods after the sell check |
| CS-18-022 | Citizen modding | later | S39: mods after the sell check |
| CS-18-023 | Editor menu | later | S39: editors after the sell check |
| CS-18-024 | CS2 map editor | later | S39: editors after the sell check |
| CS-18-025 | CS2 asset editor | later | S39: asset editor after the sell check |
| CS-18-026 | Modding Wavelet | later | S39: mod support after the sell check |
| CS-18-027 | Paradox Mods | missing | searched "paradox mods": Urbis's ship path is Steam (M9), no Paradox platform in the plan |
| CS-18-028 | Play with mods toggle | later | S39: mods after the sell check |
| CS-18-029 | Content Creator Packs | missing | searched "creator pack": no paid content packs in the plan |
| CS-18-030 | CS2 creator packs | missing | searched "creator pack": no paid content packs in the plan |
| CS-18-031 | Map packs | missing | searched "map pack": no map content in the plan |
| CS-18-032 | Vehicles of the World | missing | searched "vehicle pack": no paid vehicle content in the plan |
| CS-18-033 | Road editor | later | S39: editors after the sell check |
| CS-19-001 | Main menu | planned | M7-2/M7.T8: title screen (New Game, Continue, Settings) |
| CS-19-002 | Continue city | built | `src/main.js:149-152` restores the saved world at boot (`src/sim/newgame.js:45-55`, `src/savestore.js`) |
| CS-19-003 | New game | built | `src/main.js:445,479-485` N clears the save and reboots a fresh generated city |
| CS-19-004 | Load game list | planned | M7-7/M7.T14 three named save slots; a load list is not specified |
| CS-19-005 | Named save slots | planned | M7-7/M7.T14: three slots named by seed, population and save time |
| CS-19-006 | Save thumbnails | missing | searched "thumbnail", "save preview": nothing in `src/` or the plan |
| CS-19-007 | Autosave | built | `src/main.js:465,1231-1234` every 30 s, plus save on `visibilitychange` (`main.js:487-489`) |
| CS-19-008 | Autosave settings | missing | searched "autosave interval": no settings screen (M7.T10 lists mouse, volume, quality, subtitles) |
| CS-19-009 | Cloud saves | planned | M9-6/M9.T8: Steam Cloud sync between Mac and Windows |
| CS-19-010 | Pause menu | planned | M7-3/M7.T9: Esc holds the loop and shows a menu |
| CS-19-011 | Quit options | planned | M7.T8/M7.T9 front door; no quit action is specified (browser build) |
| CS-19-012 | City name display | partial | `src/main.js:1249-1250` HUD shows URBIS and the in-game clock; no city name and no date |
| CS-19-013 | Money counter | partial | `src/main.js:1254` HUD shows ₡ (the arc's balance); city budget is planned (M5-6) |
| CS-19-014 | Population counter | partial | `src/render/economy.js:57-59` homes count per district in the panel; no total residents or trend on the HUD |
| CS-19-015 | Happiness meter | later | S49: happiness after the sell check |
| CS-19-016 | Health indicator | missing | searched "health indicator", "health meter": no health system (hospital later, S18) |
| CS-19-017 | Advisor | missing | searched "advisor", "assistant": nothing in `src/` or the plan |
| CS-19-018 | Tooltips | partial | `src/ui/cityview.js:72-81,147-156` hover card for lots with status and reason; no tool/building/icon tooltips (cost display planned, M5-7) |
| CS-19-019 | Options menu | planned | M7-4/M7.T10 settings screen |
| CS-19-020 | Graphics quality settings | planned | M7.T10/M7.T13 (shadow distance, resolution scale) |
| CS-19-021 | Resolution and display mode | missing | searched "resolution", "fullscreen": the canvas follows the window (`src/main.js:260`); no display options |
| CS-19-022 | Shadow settings | planned | M7.T10 shadow distance in settings |
| CS-19-023 | Water and texture quality | missing | searched "texture quality", "water quality": nothing in `src/` or the plan |
| CS-19-024 | Field of view setting | missing | searched "field of view", "fov": the camera FOV is fixed (`src/main.js:82`) |
| CS-19-025 | Gameplay options | planned | M7.T10 settings; M8.T4 licence/game-option checks |
| CS-19-026 | Language | later | ROADMAP "After the sell check": localization |
| CS-19-027 | Key mapping | planned | M7-4/M7.T11 rebinding screen |
| CS-19-028 | Interface scale | missing | searched "interface scale", "HUD scale": nothing in `src/` or the plan |
| CS-19-029 | Tutorial hints | planned | M7-5/M7.T12 one hint per key, gone once done |
| CS-19-030 | Save compatibility warning | planned | M3-8: a v2 save starts a new game with a one-line message (version, not missing mods) |
| CS-19-031 | Delete or overwrite saves | planned | M7-7/M7.T14: New Game and N ask before replacing a save |
| CS-19-032 | Notification settings | missing | searched "notification settings", "filter": nothing in `src/` or the plan |
| CS-19-033 | Build menu search | missing | searched "search", "build menu": the city-view palette has five rows and no search (`src/ui/cityview.js:50-70`) |
| CS-19-034 | Build menu filters | missing | searched "filter", "road list": no menu filters in `src/` or the plan |
| CS-19-035 | What's New panel | missing | searched "what's new", "patch notes": nothing in `src/` or the plan |
| CS-20-001 | Game soundtrack | later | ROADMAP "After the sell check": the radio waits for music and voices; no audio code today (`BACKLOG.md:48`) |
| CS-20-002 | Radio panel | later | ROADMAP "After the sell check": the radio waits for the sell check (G23) |
| CS-20-003 | Station switching | later | ROADMAP "After the sell check" (G23) |
| CS-20-004 | DJs and ads | later | ROADMAP "After the sell check" (G23) |
| CS-20-005 | Radio volume | later | ROADMAP "After the sell check" radio; volume sliders arrive in M7.T10 without a radio |
| CS-20-006 | Natural Disasters radio | out | S32: natural disasters are out |
| CS-20-007 | Relaxation Station | missing | searched "Relaxation Station", "music station": the radio system is later, no station content planned |
| CS-20-008 | Rock City Radio | missing | searched "Rock City", "music station": no station content in the plan |
| CS-20-009 | All That Jazz | missing | searched "All That Jazz", "music station": no station content in the plan |
| CS-20-010 | Country Road Radio | missing | searched "Country Road", "music station": no station content in the plan |
| CS-20-011 | Synthetic Dawn Radio | missing | searched "Synthetic Dawn", "music station": no station content in the plan |
| CS-20-012 | Campus Radio | missing | searched "Campus Radio": no campus or station content in the plan |
| CS-20-013 | Deep Focus Radio | missing | searched "Deep Focus", "music station": no station content in the plan |
| CS-20-014 | Downtown Radio | missing | searched "Downtown Radio", "music station": no station content in the plan |
| CS-20-015 | Coast to Coast Radio | missing | searched "Coast to Coast": no station content in the plan |
| CS-20-016 | Rail Hawk Radio | missing | searched "Rail Hawk": no station content in the plan |
| CS-20-017 | Sunny Breeze Radio | missing | searched "Sunny Breeze": no station content in the plan |
| CS-20-018 | On Air Radio | missing | searched "On Air Radio": no station content in the plan |
| CS-20-019 | Calm the Mind Radio | missing | searched "Calm the Mind": no station content in the plan |
| CS-20-020 | K-Pop Station | missing | searched "K-Pop": no station content in the plan |
| CS-20-021 | 80's Downtown Beat | missing | searched "Downtown Beat": no station content in the plan |
| CS-20-022 | African Vibes | missing | searched "African Vibes": no station content in the plan |
| CS-20-023 | JADIA Radio | missing | searched "JADIA": no station content in the plan |
| CS-20-024 | 80's Movie Tunes | missing | searched "Movie Tunes": no station content in the plan |
| CS-20-025 | Pop Punk Radio | missing | searched "Pop Punk": no station content in the plan |
| CS-20-026 | Shoreline Radio | missing | searched "Shoreline": no station content in the plan |
| CS-20-027 | Paradise Radio | missing | searched "Paradise Radio": no station content in the plan |
| CS-20-028 | 90's Pop Radio | missing | searched "90's Pop": no station content in the plan |
| CS-20-029 | Piano Tunes Radio | missing | searched "Piano Tunes": no station content in the plan |
| CS-20-030 | Deluxe Edition soundtrack | missing | searched "deluxe", "soundtrack": no special edition in the plan |
| CS-20-031 | CS2 radio stations | missing | searched "radio station": no station content in the plan |
| CS-20-032 | Deluxe Relax Station | missing | searched "Deluxe Relax": no station content in the plan |
| CS-20-033 | Ambient sound | planned | M7-1/M7.T3: street ambience by hour and district kind, traffic hum, crowd |
| CS-20-034 | Sirens and effects | planned | M7-1/M7.T4-M7.T6: sirens, engines, site sounds (`src/audio/` is created there) |
| CS-20-035 | Custom music | missing | searched "custom music", "import track": nothing in `src/` or the plan |
| CS-20-036 | Music packs | missing | searched "music pack": the radio is later, no packs planned |
| CS-20-037 | Harvest Harmony Radio | missing | searched "Harvest Harmony": no station content in the plan |
| CS-20-038 | 8 Gear Radio | missing | searched "8 Gear": no station content in the plan |
| CS-20-039 | Harumi Nights FM | missing | searched "Harumi": no station content in the plan |
| CS-21-001 | City naming | missing | searched "city name", "name the city": M7.T8 shows the seed only; no name anywhere |
| CS-21-002 | Deluxe Edition | missing | searched "deluxe", "edition": no special editions in the plan |
| CS-21-003 | Deluxe Upgrade Pack | missing | searched "deluxe", "upgrade pack": no special editions in the plan |
| CS-21-004 | Pre-order bonus | missing | searched "pre-order", "bonus": no storefront content in the plan |
| CS-21-005 | Platforms | partial | browser/Electron build runs on macOS today; `package.json` targets a Windows NSIS package; Windows/macOS packaging planned at M9-2/M9.T3-M9.T4; Linux unmentioned |
| CS-21-006 | Console editions | missing | searched "console", "PlayStation", "Switch": no console work in `src/` or the plan |
| CS-21-007 | Remastered console edition | missing | searched "console edition": no console work in the plan |
| CS-21-008 | CS2 platforms | missing | searched "console": no console work in the plan |
| CS-21-009 | CS2 Ultimate Edition | missing | searched "ultimate edition": no special editions in the plan |
| CS-21-010 | San Francisco Set | missing | searched "San Francisco", "content set": no content set in the plan |
| CS-21-011 | Region packs | missing | searched "region pack", "building style": modding is later (S39), no region packs planned |
| CS-21-012 | Controllers | planned | M7-8/M7.T15: standard gamepad plays the street; the city view stays mouse and keys (D13) |
| CS-21-013 | Save sharing | missing | searched "save sharing", "subscribe save": nothing in `src/` or the plan |
| CS-21-014 | Anniversary content | missing | searched "anniversary": nothing in `src/` or the plan |
| CS-21-015 | Bundle editions | missing | searched "bundle": no commercial bundles in the plan |
| CS-21-016 | Waterfronts Expansion Pass | missing | searched "expansion pass", "waterfronts": nothing in `src/` or the plan |
