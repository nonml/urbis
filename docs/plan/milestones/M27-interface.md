# M27 — The phone, the screens and the interface

From: `docs/plan/features/mechanics.md` GAP-15-001 to GAP-15-072 (GAP-15-003 is M23-10's,
GAP-15-048 is M24-14's); `docs/plan/CAPABILITIES.md` G17, G26 and G33. When it closes,
the player carries a phone that holds the game's apps, reads the city's internet, emails
and feeds, watches its TV, takes photos with a full photo mode, and plays with a HUD that
shows everything the four games show; and the builder has Skylines' whole interface:
panels, info views, cameras, search and an advisor. Most of the plan already names "M27's
phone"; this is where it is built. Pillars: live in it; the city lives (its feeds and
news are made from the sim).

Needs first: M10-2 (minimap and map), M11 (the journal and gigs), M20 (profiles, drones),
M21 (calls and messages), M5 (the city view's tools and overlays), M7 (menus, settings).
Lane: street, with M27-10 and M27-11 in lane: city.

## Keys

- **Street:** **↑ (up arrow)** takes out the phone; the mouse or the arrow keys pick an
  app; Esc puts it away. **E** at a viewpoint looks through binoculars (E uses what is in
  front). The phone's camera app and the pause menu open photo mode; no new key.
- **City view:** the **arrow keys**, the **middle mouse** held and the **screen edges** pan;
  **Q and E** turn the camera (the street's Q and E are off in the city view, as its WASD
  are); the **mouse wheel** zooms toward the pointer; **3 to 0** open the tool bar's eight
  panels (1 and 2 stay the arc's choices); **/** opens the tool search.
- **Both:** **F1** hides the interface and shows it again.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M27-1 | **The phone:** ↑ shows it in the player's hand and on screen; its home has tabs of apps: contacts (call anyone the player knows; M21-11's calls and messages run here, in and out), messages, email, the camera, the map, the job board (M11), the bank and the market (M22), the calendar (M26), the clothes shop (M25), the vehicle list that calls an owned car (M18-15), the dog (M26), the crew (M21), the profiler (M20), the browser, games (M24-14), the dialler for cheats, and settings (ringtone, theme, silent). From a profile the player calls the person, reports them to the police (M20-6) or takes money from their account into the bank (M22-4) | `tests/accept/m27-phone.spec.js` | red: profiles and dispatch only | GAP-15-050 |
| M27-2 | **The city's internet:** a browser with a portal and 40 sites: shops that deliver, the bank, the market, the city's paper and news site (written from the sim and the builder's acts, M5's news), a short-post feed where residents post about the city and the player's acts, a profile site where people show their lives, a dating site, a conspiracy site, the fixers' and gangs' pages, and job ads; an email inbox with story mail, jobs and spam. Computers in flats, offices and internet cafés open the same browser and their owner's mail | `tests/m27-sites.test.js`, `tests/accept/m27-internet.spec.js` | partial: the news ticker (`render/news.js`) | GAP-15-034, GAP-15-053, GAP-15-054 |
| M27-3 | **TV:** televisions in homes, bars and shops play six channels: the news (from the sim's events of the day), two of shows, adverts for the city's own firms, sport (M24-12), and a film; each with its own sound (M28); a screen is a texture on an existing mesh, not a draw | `tests/accept/m27-tv.spec.js` | red | — |
| M27-4 | **Photos and photo mode:** the phone's camera takes photos and selfies (with an expression); photo mode pauses the game and frees the camera within 30 m of the player, with field of view, depth of field (focus distance and aperture), time of day, 12 filters with their strength, 3 lights to place, poses for the player and anyone in the shot, aspect ratios, frames and the interface hidden; pictures go to the gallery tab, can be saved as a PNG on the computer, and posted on the city's feed where residents react. A photo app gives jobs to photograph places for followers | `tests/accept/m27-photo.spec.js` | partial: a developer screenshot (`render/capture.js`) | GAP-15-031, GAP-15-049 |
| M27-5 | **The street HUD:** health, armour, the ability bars (Focus, the rig's charge, stamina, adrenaline) that drain and refill; cash and the bank with a rising or falling arrow; wanted stars that flash while the police search and stay lit while they see the player; the guards' alert state (calm, curious, searching, combat); counters for the crew and their level, the district's uprising (M23-9) and the player's reputation; a feed of short messages with icons (₡ earned, items found, experience, the news) and its history in the pause menu, each message clicked to jump to its place; the name of a vehicle just entered for 2 s; a race's place, lap and checkpoint; a tail's progress meter; full-screen "wasted" and "busted" overlays; a remote view's prompts (M20-8, M20-9); and the crew wheel (M21-15) showing where each member is and what they do | `tests/accept/m27-hud.spec.js` | partial: four stacked news lines, ₡, steady stars, a BUSTED banner | GAP-15-001, GAP-15-004, GAP-15-020, GAP-15-023, GAP-15-025, GAP-15-027, GAP-15-028, GAP-15-029, GAP-15-039, GAP-15-042, GAP-15-051, GAP-15-058, GAP-15-069, GAP-15-071 |
| M27-6 | **Marks and scanning:** a marker at the screen's edge points to an objective out of sight; tagged enemies are outlined through walls; the scan (Q, Focus, M20-4) shows each person's level, health, weak spot and what they carry | `tests/accept/m27-marks.spec.js` | partial: a scanner and a profiler lock (M6) | GAP-15-032, GAP-15-038, GAP-15-061 |
| M27-7 | **The map, more:** the route to a waypoint shows its distance under the minimap; the map's icons filter by kind; the minimap turns with the player or stays north-up, in two sizes, and zooms out as the player goes faster; the police's search circle shows on it; road names show on the map and can be hidden; at a viewpoint, binoculars zoom 8× and tag what they see | `tests/accept/m27-map.spec.js` | partial: M10-2 plans the minimap, map and waypoint | GAP-15-005, GAP-15-033, GAP-15-040, GAP-15-041, GAP-15-060, GAP-15-063, GAP-15-068 |
| M27-8 | **The journal and the menus:** the journal puts each job on its own tab with its distance and can untrack it; notes and letters found are kept in a notes tab; collected cards and sets have a tab (M24-17); a codex explains each system, character, gang, firm and vehicle met; credits roll after an ending (M24-4); loading shows art from the game with a tip; when the player is idle for 60 s the camera orbits and shows what happens nearby | `tests/accept/m27-journal.spec.js` | partial: one combined journal list (J) | GAP-15-019, GAP-15-022, GAP-15-026, GAP-15-030, GAP-15-035, GAP-15-052, GAP-15-066, GAP-15-067, GAP-20-014 |
| M27-9 | **The assistant:** a voice on the phone (its lines as subtitles, M24-3's decision for its voice) comments on what the player does, gives a tip when they are stuck for 5 minutes, and, in the city view, is the advisor: it says what the city needs next (power short, no school in a district, traffic at a junction) and points to the place | `tests/m27-advisor.test.js`, `tests/accept/m27-assistant.spec.js` | red | GAP-15-015, GAP-15-024 |
| M27-10 | **The city view's panels:** the tool bar is in categories, 3 to 0 open them, a search box (/) finds any tool, and roads filter by type; clicking a resident shows their portrait, education, wealth, happiness, home and work; clicking a road, a vehicle or a building shows its own panel, and a "route" button draws the trip it is on; a district's panel adds population, land value and its policies; a painted area shows its level and income; the HUD shows the city's health and meters for traffic, power, water and sewage; info views for every field (pollution, wind, building level, district type, and each service); a "what's new" panel lists the latest update | `tests/accept/m27-cityui.spec.js` | partial: a hover lot card, a district table, bars for jobs, homes, wealth and demand | GAP-15-009, GAP-15-010, GAP-15-012, GAP-15-013, GAP-15-014, GAP-15-017, GAP-15-044, GAP-15-045, GAP-15-046, GAP-15-047, GAP-15-056, GAP-15-057, GAP-15-065 |
| M27-11 | **The city view's cameras:** the arrow keys, middle mouse and edges pan, Q and E turn, the wheel zooms toward the pointer; a free camera flies anywhere with smoothing and a speed setting; a click on a resident follows them; a street camera drops to first person at any point (the player stays where they are); keyframed camera paths are saved and played to film the city; F1 hides the interface | `tests/accept/m27-citycam.spec.js` | partial: pointer drag turns, WASD pans, the wheel dollies around the player | GAP-15-006, GAP-15-007, GAP-15-008, GAP-15-036, GAP-15-037, GAP-15-059, GAP-15-062, GAP-15-072 |
| M27-12 | **Draws:** the phone, HUD, panels, map and menus are DOM or 2D canvas (0 draws); photo mode's lights add at most 3 while it is open; screens are textures; the frame stays at or under 175 | the ledger | — | — |
| M27-13 | A saved game keeps the phone's contacts, messages and mail, the gallery, the journal's tracking, notes, the codex, the minimap's options, the city view's saved camera paths and every setting here, and continues the same | `tests/accept/m27-save.spec.js` | red | — |
| M27-14 | The sweep of every app, site, channel, HUD element, menu, panel and camera has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M27.T1 | **Checks, red: the phone and media.** `m27-phone.spec.js`, `m27-sites.test.js`, `m27-internet.spec.js`, `m27-tv.spec.js`, `m27-photo.spec.js` | new `tests/accept/m27-phone.spec.js`, new `tests/m27-sites.test.js`, new `tests/accept/m27-internet.spec.js`, new `tests/accept/m27-tv.spec.js`, new `tests/accept/m27-photo.spec.js` | M10.T5 | M27-1 to M27-4 red | S |
| M27.T2 | **The phone.** The phone in hand and on screen; home, tabs, every app's frame; contacts, messages and calls; settings; profile actions | new `src/ui/phone.js`, `src/render/player.js`, `src/game/input.js`, `src/sim/talk.js` | M27.T1 | M27-1 | M |
| M27.T3 | **Sites, sim.** Forty sites from `sites.json` and the sim; the feed's posts from residents and the news; the inbox | new `src/sim/sites.js`, new `src/content/sites.json`, `src/sim/news.js` | M27.T1 | M27-2 (part) | M |
| M27.T4 | **The browser and computers.** The browser on the phone, in flats, offices and cafés; owners' mail | new `src/ui/browser.js`, `src/sim/interior.js` | M27.T3, M27.T2 | M27-2 | M |
| M27.T5 | **TV.** Six channels; the news from the day; screens as textures; their sound | new `src/sim/tv.js`, new `src/render/screens.js`, `src/render/interior.js` | M27.T3 | M27-3 | M |
| M27.T6 | **The phone's camera.** Photos and selfies; the gallery; saving as PNG; posting to the feed; the photo app's jobs | new `src/ui/gallery.js`, `src/ui/phone.js`, `src/sim/sites.js` | M27.T2 | M27-4 (part) | M |
| M27.T7 | **Photo mode.** Pause, the free camera within 30 m, the sliders, filters, lights, poses, ratios, frames | new `src/game/photomode.js`, `src/render/atmosphere.js`, `src/render/player.js` | M27.T6 | M27-4 | M |
| M27.T8 | **Checks, red: the HUD and menus.** `m27-hud.spec.js`, `m27-marks.spec.js`, `m27-map.spec.js`, `m27-journal.spec.js`, `m27-advisor.test.js`, `m27-assistant.spec.js` | new `tests/accept/m27-hud.spec.js`, new `tests/accept/m27-marks.spec.js`, new `tests/accept/m27-map.spec.js`, new `tests/accept/m27-journal.spec.js`, new `tests/m27-advisor.test.js`, new `tests/accept/m27-assistant.spec.js` | M27.T1 | M27-5 to M27-9 red | S |
| M27.T9 | **The HUD's bars and money.** Health, armour, ability bars, cash and bank with trend, flashing stars, alert state, the counters | `src/game/hud.js`, `src/render/arcui.js` | M27.T8 | M27-5 (part) | M |
| M27.T10 | **The feed and overlays.** Messages with icons, history and jumps; vehicle names; race and tail displays; wasted and busted; remote prompts; the crew wheel | `src/game/hud.js`, new `src/ui/feed.js`, `src/render/news.js` | M27.T9 | M27-5 | M |
| M27.T11 | **Marks and scanning.** Edge markers; outlines through walls; the scan's readout | `src/render/hackfx.js`, `src/game/hud.js`, `src/render/profiler.js` | M27.T8, M20.T4 | M27-6 | M |
| M27.T12 | **The map, more.** Route distance; filters; minimap rotation, size and speed zoom; the search circle; road names; binoculars | `src/ui/minimap.js`, `src/ui/mapscreen.js`, new `src/game/binoculars.js` | M27.T8, M10.T6 | M27-7 | M |
| M27.T13 | **The journal and the menus.** Tabs and distances; untracking; notes; the collection tab; the codex; credits; loading art and tips; the idle camera | `src/render/arcui.js`, new `src/ui/codex.js`, `src/ui/pause.js`, new `src/ui/loading.js`, `src/game/camera.js` | M27.T8 | M27-8 | M |
| M27.T14 | **The assistant.** Its comments, tips when stuck, the advisor's needs and pointers | new `src/sim/advisor.js`, `src/ui/phone.js`, `src/ui/cityview.js` | M27.T8 | M27-9 | M |
| M27.T15 | **Checks, red: the city view.** `m27-cityui.spec.js`, `m27-citycam.spec.js`, `m27-save.spec.js` | new `tests/accept/m27-cityui.spec.js`, new `tests/accept/m27-citycam.spec.js`, new `tests/accept/m27-save.spec.js` | M27.T1 | M27-10, M27-11, M27-13 red | S |
| M27.T16 | **The city view's panels.** Categories, number keys, search, road filters; resident, road, vehicle, building, district and area panels; routes; meters; info views; what's new | `src/ui/cityview.js`, `src/render/cityview.js`, `src/render/overlays.js` | M27.T15, M14.T6 | M27-10 | M |
| M27.T17 | **The city view's cameras.** Pan, turn, pointer zoom; the free camera; following a resident; the street camera; camera paths; F1 | `src/game/camera.js`, `src/sim/cityview.js`, new `src/game/campaths.js` | M27.T15 | M27-11 | M |
| M27.T18 | **Save** keeps everything in M27-13 | `src/sim/save.js` | M27.T17 | M27-13 | S |
| M27.T19 | **Close.** The ledger (M27-12); the sweep of every app, site, channel, HUD element, panel and camera; one commit per defect; ↑ and F1 in the hints | the sweep, the ledger, `content/hints.json` | all of the above | M27-12, M27-14 | M |

## Decisions for the operator

None beyond M24-3's voices, which also covers the assistant's.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M27-1 | GTA-13-001, GTA-13-002, GTA-13-004, GTA-13-011, GTA-14-045, WD-17-001, WD-17-018, CP-02-014, CP-10-011, CP-10-012, CP-10-014, CP-15-022, CP-15-023 |
| M27-2 | GTA-13-005, GTA-13-016, GTA-13-017, GTA-13-032, GTA-13-033, GTA-13-040 |
| M27-3 | GTA-13-034, GTA-13-035, GTA-13-036, GTA-13-037, GTA-17-042 |
| M27-4 | CS-01-010 to CS-01-014, GTA-13-006, GTA-13-007, GTA-13-008, GTA-13-009, GTA-18-048, GTA-18-049, GTA-20-005, WD-17-022, WD-20-020 to WD-20-025, CP-15-052, CP-15-053, CP-15-054, CP-15-055, CP-15-057, CP-15-058, CP-19-019 |
