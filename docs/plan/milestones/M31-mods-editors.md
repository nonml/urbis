# M31 — Editors, mods and director mode

From: `docs/plan/features/mechanics.md` GAP-19-001, GAP-19-002, GAP-19-003 and GAP-19-012
to GAP-19-014 (GAP-19-004 to -011 are M29-9's); `docs/plan/CAPABILITIES.md` S39, S58,
D9's director mode, and CP-19-003. When it closes, players make their own land, buildings,
props, vehicles, trees, roads, themes and scenarios in the game's own editors, write code
mods against a stated API, share all of it through Steam Workshop, and play director:
anyone in the city, any weather, anything on cue. Skylines lives on its modders, and GTA
on its script mods; Urbis is built for both from the start. Pillars: every tool is
expressive; the city never ends.

Needs first: M14 (the city builder's tools), M26-3 (land themes), M27-11 (the cameras),
M29 (the editor, saves, platforms), M30-20 (community servers), M9.T2 (the Steam
binding). Lane: tools.

## Keys

None new. The editors open from the title screen, director mode from the pause menu; both
use the city view's mouse and keys (M14, M27-11).

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M31-1 | **The map editor:** from the title screen's editor menu: start from a seed (M26-3) or a height image; raise, lower, smooth and level the land; paint water, rivers and the sea level; place the roads, rail, sea and air links in from outside; pick the land theme; save a map that a new game can start on | `tests/accept/m31-mapeditor.spec.js` | red | — |
| M31-2 | **The asset editor:** a building, a prop, a vehicle or a tree made from a glTF model with its textures, or from M2's building kit; its numbers set (cost, upkeep, homes or jobs, its zone, its size) and the milestone that unlocks it; the result placed in the city view like any asset and drawn within the draw budget (pooled by kind) | `tests/m31-assets.test.js`, `tests/accept/m31-asseteditor.spec.js` | red | — |
| M31-3 | **The theme and road editors:** a land theme's ground, cliff, water and light (a new theme file, M26-3); a road type's lanes, widths, markings, props and speed (a new entry for `roads.json`, M14-2) | `tests/accept/m31-theme-road.spec.js` | red | — |
| M31-4 | **The scenario editor:** a scenario (M14-24) made on a map: starting money and buildings, goals, loss conditions, time limits and triggers (a population reached, a disaster at a time, a budget fall) that start events and messages; shared like a map | `tests/m31-scenario.test.js`, `tests/accept/m31-scenario.spec.js` | partial: M14-24 plans eight built-in scenarios | — |
| M31-5 | **Code mods:** a mod is a folder with a manifest and JavaScript that uses the game's mod API (`docs/MODDING.md`): it listens to the event tape (M9.T7), adds tools, panels, policies, vehicles, people's behaviour, missions and menus, and keeps its own data in the save. Three sample mods ship (a trainer menu, a police patrol mode played as an officer, a new policy), and the built-in options (M29-7) are written as mods. A mod cannot read other mods' data or the player's files | `tests/m31-modapi.test.js`, `tests/accept/m31-mods.spec.js` | red | — |
| M31-6 | **File mods:** a vehicle, a building, a map patch or a graphics preset replaces or adds to the game's own by a file in a mod folder; a pack tool lists and opens the game's packs; the game's own content files are in plain formats a modder can read | `tests/accept/m31-filemods.spec.js` | red | — |
| M31-7 | **Workshop and the mod browser:** maps, scenarios, assets, themes and mods are uploaded to and downloaded from Steam Workshop; an in-game browser finds, rates and subscribes; a content manager turns each on or off and sets the load order; loading a save offers to subscribe to the assets it uses; one switch plays with or without mods | `tests/accept/m31-workshop.spec.js` | red | GAP-19-001 |
| M31-8 | **Packs:** three free regional packs of building styles (M14-25: a Mediterranean, a Nordic and an East Asian city), each with its props and vehicles; paid packs made by creators, only if the operator decides | `tests/accept/m31-packs.spec.js` | red | GAP-19-002, GAP-19-003 |
| M31-9 | **Director mode:** from the pause menu, the world pauses and the player picks anyone to play: any resident, an animal (M26), or a character they have met; they set the weather, the time and the radio; they place and trigger explosions, vehicles, crowds and animals on cue; settings for no wanted level, no damage and invincibility; the editor (M29-9) and cameras (M27-11) film it | `tests/accept/m31-director.spec.js` | red | GAP-19-012, GAP-19-013, GAP-19-014 |
| M31-10 | **Mods are safe:** a mod that throws is turned off with a message, and the save still loads without it; after a crash the next start offers to start with mods off; online sessions run mods only if their server allows (M30-20); achievements stay on with mods that change only looks | `tests/accept/m31-safe.spec.js` | red | — |
| M31-11 | A saved game keeps which mods and assets it used and each mod's own data; maps, scenarios and assets survive a new release of the game | `tests/accept/m31-save.spec.js` | red | — |
| M31-12 | The sweep of every editor, the workshop, the samples and director mode has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M31.T1 | **Checks, red: the editors.** `m31-mapeditor.spec.js`, `m31-assets.test.js`, `m31-asseteditor.spec.js`, `m31-theme-road.spec.js`, `m31-scenario.test.js`, `m31-scenario.spec.js` | new `tests/accept/m31-mapeditor.spec.js`, new `tests/m31-assets.test.js`, new `tests/accept/m31-asseteditor.spec.js`, new `tests/accept/m31-theme-road.spec.js`, new `tests/m31-scenario.test.js`, new `tests/accept/m31-scenario.spec.js` | M14.T39 | M31-1 to M31-4 red | S |
| M31.T2 | **The map editor.** The editor menu; land, water and links; themes; saving a map a new game starts on | new `src/editor/map.js`, new `src/ui/editors.js`, `src/sim/terrain.js`, `src/sim/water.js` | M31.T1, M26.T7 | M31-1 | M |
| M31.T3 | **The asset editor.** glTF import, the building kit, numbers, unlocks; placing and pooling | new `src/editor/asset.js`, `src/render/block.js`, `src/sim/zoning.js` | M31.T1 | M31-2 | M |
| M31.T4 | **The theme and road editors.** Theme files; road entries | new `src/editor/theme.js`, new `src/editor/road.js`, `content/lands/`, `src/content/roads.json` | M31.T2 | M31-3 | M |
| M31.T5 | **The scenario editor.** Starts, goals, losses, limits, triggers | new `src/editor/scenario.js`, `src/sim/scenario.js` | M31.T2 | M31-4 | M |
| M31.T6 | **Checks, red: mods and director.** `m31-modapi.test.js`, `m31-mods.spec.js`, `m31-filemods.spec.js`, `m31-workshop.spec.js`, `m31-packs.spec.js`, `m31-director.spec.js`, `m31-safe.spec.js`, `m31-save.spec.js` | new `tests/m31-modapi.test.js`, new `tests/accept/m31-mods.spec.js`, new `tests/accept/m31-filemods.spec.js`, new `tests/accept/m31-workshop.spec.js`, new `tests/accept/m31-packs.spec.js`, new `tests/accept/m31-director.spec.js`, new `tests/accept/m31-safe.spec.js`, new `tests/accept/m31-save.spec.js` | M31.T1 | M31-5 to M31-11 red | S |
| M31.T7 | **The mod API.** The loader, the manifest, the hooks, mods' own save data, the walls between mods; `MODDING.md` | new `src/mods/loader.js`, new `src/mods/api.js`, new `docs/MODDING.md`, `src/sim/save.js` | M31.T6, M9.T7 | M31-5 (part) | M |
| M31.T8 | **Sample mods.** A trainer menu, an officer's patrol mode, a policy; the built-in options as mods | new `mods/trainer/`, new `mods/patrol/`, new `mods/policy/`, `src/sim/newgame.js` | M31.T7 | M31-5 | M |
| M31.T9 | **File mods.** Replacing and adding by file; the pack tool; plain formats | `src/mods/loader.js`, new `tools/packs.mjs` | M31.T7 | M31-6 | M |
| M31.T10 | **Workshop.** Upload and download; the browser; the content manager and order; subscribing from a save; the switch | new `src/mods/workshop.js`, new `src/ui/mods.js`, `electron.cjs` | M31.T9, M9.T2 | M31-7 | M |
| M31.T11 | **Packs.** Three regional styles with props and vehicles; paid packs if decided | new `content/packs/`, `src/render/block.js` | M31.T3, M14.T40 | M31-8 | M |
| M31.T12 | **Director mode.** Playing anyone; weather, time and radio; cues; the settings | new `src/game/director.js`, `src/sim/player.js`, `src/ui/pause.js` | M31.T6, M27.T17, M26.T2 | M31-9 | M |
| M31.T13 | **Safety and save.** A throwing mod off; mods-off start after a crash; the online rule; achievements; save and release survival | `src/mods/loader.js`, `src/sim/save.js`, `src/main.js` | M31.T10 | M31-10, M31-11 | M |
| M31.T14 | **Close.** The sweep of every editor, the workshop, the samples and director mode; one commit per defect | the sweep | all of the above | M31-12 | M |

## Decisions for the operator

- **Paid creator packs** (M31-8): whether to sell packs made by other creators, and their
  share.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M31-1 | CS-18-001, CS-18-002, CS-18-003, CS-18-004, CS-18-023, CS-18-024 |
| M31-2 | CS-18-005 to CS-18-011, CS-18-025 |
| M31-3 | CS-18-014, CS-18-033 |
| M31-4 | CS-17-023, CS-18-012, CS-18-013 |
| M31-5 | CS-18-016, CS-18-021, CS-18-022, CS-18-026, GTA-19-023, GTA-19-024, GTA-19-029, GTA-19-034, CP-19-003 |
| M31-6 | GTA-19-025, GTA-19-026, GTA-19-027, GTA-19-028 |
| M31-7 | CS-18-015, CS-18-017 to CS-18-020, CS-18-028 |
| M31-9 | GTA-18-046 |
