# What Skylines, GTA, Watch Dogs and Cyberpunk have

Made 2026-10-03/04 by OpenCode agents, for the plan in `docs/plan/`. The operator asked for
every feature of the four games, listed without looking at Urbis's code, before the plan
is checked against them.

| File | What it is |
|---|---|
| `cities-skylines.md`, `gta.md`, `watch-dogs.md`, `cyberpunk-2077.md` | Every feature of each game, by category. DeepSeek wrote each list from its own knowledge and the games' wikis; GLM reviewed it, added what was missing and marked wrong rows `WRONG:` and repeats `DUPLICATE of` (Watch Dogs had a second review by DeepSeek) |
| `urbis-<game>.md` | Every feature marked against Urbis: built or partial (with the `file:line`), planned (criterion or task ID), later or out (the CAPABILITIES row), or missing |
| `triage-<game>.md` | Every missing or partial row sorted: `system` (a mechanic any game could have) or `content` (that game's own story, places and brands), with a section and a generic name |
| `mechanics.md` | The `system` rows merged across the four games: 809 distinct mechanics Urbis lacks, each with the games that have it and its source rows. Mechanics the games share are mostly not here: `CAPABILITIES.md` had already put them in the plan, later or out, so this is mostly each game's long tail (736 of the 809 come from one game) |

| Game | List | Rows | Built | Partial | Planned | Later | Out | Missing | Mechanics lacking |
|---|---|---|---|---|---|---|---|---|---|
| Cities: Skylines | `cities-skylines.md` | 911 | 26 | 54 | 138 | 320 | 80 | 280 | 334 |
| Grand Theft Auto | `gta.md` | 1133 | 23 | 37 | 48 | 255 | 280 | 474 | 443 |
| Watch Dogs | `watch-dogs.md` | 765 | 26 | 26 | 89 | 217 | 163 | 226 | 152 |
| Cyberpunk 2077 | `cyberpunk-2077.md` | 945 | 29 | 26 | 50 | 216 | 320 | 265 | 198 |

**How far to trust it.** The lists come from models, not from playing the games: the
reviews caught 53 invented or misplaced rows, and more will remain. A script checked
that every row is marked exactly once, that every cited file exists, and that every merged
ID is accounted for; 10 cited lines were read by hand and matched. Whether a mechanic
belongs in Urbis is decided in the plan, not here: `docs/plan/CAPABILITIES.md`, "Checked
against the feature lists", gives every row of `mechanics.md` its verdict (decision D14). Since D15 (2026-10-04)
nothing is later or out: every mechanic, every feature marked later or out here and every
`content` row of `triage-*.md` is in exactly one criterion of M13 to M34
(`docs/plan/milestones/`); the "Later" and "Out" columns above are the first pass's marks.

## What the reviews caught

In the reviewers' own words:

- **Cities: Skylines.** the CS1 oil/advanced wind/advanced coal/solar updraft/OTEC plants and Snowfall's snow dump were missing; Bridges & Ports' ferries, piers, lighthouses, drawbridges and CS2 fishing/offshore oil were missing; CS1's policy list was short by about a dozen confirmed policies and the whole CS2 policy set. Flagged as wrong: vanilla CS1 turn restrictions, a CS2 roundabout drawing tool, a player-built hydro dam, and tax-by-education. A few understated Where cells (CS2 hydro plant, CS2 water tower, CS2 ferry confirmation, After Dark's Old Town, Parklife-update library) were corrected in place.
- **GTA.** rideable trains/trams and on-foot phone radio in V (invented), no VTOL jets in V story, Oppressor Mk II's wrong update, LSC respray clearing wanted in V, Josh/Mary-Ann stranger descriptions swapped, two mixed-up collectible rows, plus missing features from the SA jetpack and San Andreas swimming stats to HSW-era content.
- **Watch Dogs (first review, GLM).** WD-02-020 (Legion ETO hack) is marked wrong, WD-07-018 (Driver SF) is marked a duplicate of WD-12-029. I also corrected four under-inclusive Where cells without adding rows: WD-05-001 (Lure exists in WD2), WD-08-004 (WD1 stealth takedown), WD-09-018 (WD1 witness calls), WD-17-008 (health bar in all three).
- **Watch Dogs (second review, DeepSeek).** Added 26 rows, marked 3 wrong and 13 duplicates. Five of the duplicates are rows it had just added, folded into skills rows that already held them.
- **Cyberpunk 2077.** no stamina bar for movement (CP-01-003), no LMG/HMG classes anywhere (CP-03-007, CP-03-037, CP-08-008, CP-08-029), Ba Xing Chong is base-game not PL, Sovereign is a double-barrel shotgun not a revolver, no roadblocks or spike strips in chases, and the Carhacker perk + vehicle quickhacks are 2.0, not PL (verified via wiki, 3 searches used of 15).

## Where the lists came from

The models' own knowledge, plus these pages and searches. The GTA list used none.

- **Cities: Skylines:** <https://cities-skylines.fandom.com/wiki/Downloadable_content>, <https://cities-skylines.fandom.com/wiki/Roads>, <https://skylines.paradoxwikis.com/Policies>, <https://skylines.paradoxwikis.com/Roads>, <https://skylines.paradoxwikis.com/index.php?title=Policies&action=raw>, <https://skylines.paradoxwikis.com/index.php?title=Roads&action=raw>, search "Cities Skylines II updates list 2024 2025 features added patches signs bicycles pedestrian streets mixed-use zoning Bridges and Ports", search "Cities Skylines Natural Disasters list earthquake sinkhole tsunami meteor tornado thunderstorm forest fire avalanche flood", search "Cities Skylines Snowfall heating boiler station heating pipes how heating works freezing buildings", search "Cities Skylines Sunset Harbor features list intercity bus trolleybus passenger helicopter fishing wastewater inland water treatment", search "Cities Skylines every DLC features list After Dark Snowfall Natural Disasters Mass Transit Green Cities Parklife Industries Campus Sunset Harbor Airports Plazas Promenades Financial Districts Hotels Retreats summary", search "Cities Skylines info views list electricity water pollution noise garbage crime fire healthcare education population traffic routes resources land value", search "Cities Skylines policies list ", search "Cities Skylines road types list basic road one-way four-lane six-lane gravel bus lanes tram tracks bicycle lanes", search "Cities Skylines update 1.7 Natural Disasters tunnels added free update road tunnels"
- **Watch Dogs:** <https://watchdogs.fandom.com/wiki/Bloodline>, <https://watchdogs.fandom.com/wiki/Category:Operatives>, <https://watchdogs.fandom.com/wiki/Category:Watch_Dogs_2_DLCs>, <https://watchdogs.fandom.com/wiki/Digital_Trips>, <https://watchdogs.fandom.com/wiki/Human_Conditions>, <https://watchdogs.fandom.com/wiki/Minigames>, <https://watchdogs.fandom.com/wiki/No_Compromise>, <https://watchdogs.fandom.com/wiki/Skills_Tree>, <https://watchdogs.fandom.com/wiki/T-Bone_Content_Bundle>, <https://watchdogs.fandom.com/wiki/Watch_Dogs:_Bad_Blood>, <https://watchdogs.fandom.com/wiki/Watch_Dogs:_Legion>
- **Cyberpunk 2077:** <https://cyberpunk.fandom.com/wiki/Cyberpunk_2077_Cyberware>, <https://cyberpunk.fandom.com/wiki/Cyberpunk_2077_Perks>, <https://cyberpunk.fandom.com/wiki/Cyberpunk_2077_Quickhacks>, <https://cyberpunk.fandom.com/wiki/Update_2.0>, <https://cyberpunk.fandom.com/wiki/Update_2.1>, <https://cyberpunk.fandom.com/wiki/Update_2.2>, <https://cyberpunk.fandom.com/wiki/Vehicles_in_Cyberpunk_2077>

The briefs each stage was given are in `briefs/`. The lists before review are commit
`60a587b`: `git diff 60a587b -- docs/plan/features/gta.md` shows what the reviews changed.
