# M25 — The character, clothes, gear and inventory

From: `docs/plan/features/mechanics.md` GAP-13-003 to GAP-13-010 (GAP-13-001 is M23-4's,
GAP-13-002 is M21-15's); `docs/plan/CAPABILITIES.md` C11, G20 and G21. When it closes,
the player makes their character, changes hair, tattoos and clothes in the city's shops,
keeps outfits in a wardrobe, wears gear that changes what they can do, carries a rig of
hack programs, loots, crafts, and manages it all on one inventory screen.

**Grounded, not chrome** (`AGENTS.md`, the look): Cyberpunk's cyberware becomes **worn
gear** in the same slots: smart glasses for the eyes, an earpiece, gloves, braces, armour
plates, a medical watch, stim pens. A cyberdeck becomes **the rig**, a hacking kit the
player carries; quickhacks become **programs** on real devices: phones, earpieces, radios,
smart guns, braces, cameras. Ripperdocs become **fitters**: back-room techs who fit and
tune gear. No implants, no glowing skin, no neon. Every item says what it does in plain
words, and its number lives in `docs/GEAR.md`. Pillars: every tool is expressive; live in it.

Needs first: M2-4 (one person, end to end: the body kit), M13 (weapons, armour, health
items), M20 (hacks), M22 (shops, selling), M23 (attributes, perks), M24-5 (the three
starts), M33 (the shop interiors). Lane: street.

## Keys

- **I** opens the inventory on foot (I is a brush only in the city view). Esc closes it.
- **Y held** opens the emote wheel; the mouse picks one (Z is the city view).
- **E** at a mirror opens the looks screen; E at a wardrobe opens the wardrobe (E uses
  what is in front).

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M25-1 | **The character creator:** a new game opens the creator after the start is picked (M24-5): body type and chest and body sliders, skin tone, 40 hairstyles in 20 colours, eyes and their colours, brows, face sliders (nose, jaw, cheeks, mouth, ears), teeth, lip, eye and cheek makeup, nail colour, scars, face and body tattoos and piercings, a voice (from M24-3's decision), a randomiser with a plain-to-loud slider, 8 presets and 3 starting outfits. The body is M2's people kit, so the player looks like the city's people. Nudity is a setting behind M13's age rating | `tests/accept/m25-creator.spec.js` | red: one fixed player body | GAP-13-008 |
| M25-2 | **Mirrors:** mirrors in flats, bathrooms, gyms and clothes shops show the player's reflection (a second view at quarter size, only within 4 m, inside the 175-draw budget); after creation the face changes only at a mirror at home, which reopens the creator for everything but body type | `tests/accept/m25-mirror.spec.js` | red | GAP-13-007 |
| M25-3 | **Barbers and tattoo parlours:** hair and beard grow over game days (3 lengths a week) and are cut and styled at a barber; a tattoo parlour inks tattoos by body zone, face paint and piercings; both have interiors with a chair, a keeper and a mirror; both are grown shops of their kind | `tests/m25-hair.test.js`, `tests/accept/m25-barber.spec.js` | red | GAP-13-005 |
| M25-4 | **Clothes:** clothes shops on grown lots sell by brand (6 brands from `clothes.json`: cheap, street, sport, smart, luxury, workwear; each district favours its own), in colour variants; slots are head (hats, caps, helmets), face (masks, scarves, glasses), top (shirts, jackets, coats), legs, shoes, gloves and jewellery; worn armour (M13) shows over the top; clothes are looks only unless they are gear (M25-8). The phone's clothes shop delivers to the home in 1 game hour. Hats found across the city (M24-17) dress the city's mascot on the feed and residents in the city view | `tests/m25-clothes.test.js`, `tests/accept/m25-clothes.spec.js` | red | GAP-13-010 |
| M25-5 | **Outfits and the wardrobe:** a wardrobe at the home and every safehouse holds what the player owns, saves 10 outfits, and puts any look over gear's stats (the look shows, the gear works); outfits are won by mini-games (M24-12 to M24-14), by the story and as easter eggs: the crew's mask, a mechanic's overalls, a long coat and cap, an LED party mask that shows the emote played; photos the player takes (M27) hang in frames at home | `tests/accept/m25-wardrobe.spec.js` | red | GAP-13-006, GAP-13-009 |
| M25-6 | **Disguises:** a work outfit (a courier, a guard, a cleaner, a site worker, a paramedic) taken from a locker or a downed worker lets the player walk where that worker may; guards look twice as long before they see through it, and up close (within 3 m) for 5 s they do; missions can ask for one | `tests/accept/m25-disguise.spec.js` | red | GAP-13-004 |
| M25-7 | **Emotes:** Y held opens a wheel of 20 emotes (wave, salute, shrug, point, clap, cheer, dance, rude gestures, sit, lean); people within 10 m react by their nature (M21-4) | `tests/accept/m25-emotes.spec.js` | red | GAP-13-003 |
| M25-8 | **Gear slots and load:** 12 slots: eyes, ears, face, head, torso, back, arms, hands, belt, legs, feet, and the watch; each item has a tier (common, good, rare, elite, named), a load cost against the player's load (raised by the body attribute and by found manuals, M23-2), an attunement to one attribute that adds to it, and up to 3 upgrades at a fitter. Gear shows on the body and its state (charging, spent, broken) shows as an icon by the health bar. Filling all 12 slots earns a mark on the character screen. Hand gear that holds a weapon can be cycled or held, a setting | `tests/m25-gear.test.js`, `tests/accept/m25-gear.spec.js` | red | — |
| M25-9 | **What gear does:** 40 items in `gear.json`, each with its effect and number in `GEAR.md`: stim pens (rage: more damage and less taken for 8 s; a reaction stim that stretches Focus, M6, also at the wheel; a dodge stim; a sprint stim), weighted and shock gloves, push blades and a weighted cable for melee, a belt launcher for tear-gas and stun rounds, ceramic and soft armour plates, braces for jumps and landings, a defibrillator vest that revives once, a medical watch that injects at low health, smart gloves that pair with smart guns, a voice-changer mask that helps in talk (M21-10), a capacity frame that carries more | `tests/m25-gearfx.test.js` | red | — |
| M25-10 | **The rig:** hacks (M20) run from a rig of 6 makers in 5 tiers, each with its own charge (the battery, M20), charge regained per second, slots for programs, and a bonus; modules raise charge, cut upload time, lower trace and reset cooldowns. Programs have tiers and a cost that scales by tier; up to 3 queue on one target; each takes an upload time; enemy hackers trace it (M20-10) unless it is quiet; a program can crit. Programs are bought from tech vendors and looted; an overload mode spends health when the charge is empty | `tests/m25-rig.test.js`, `tests/accept/m25-rig.spec.js` | partial: hacks spend the battery (M20) | — |
| M25-11 | **Programs:** each a hack on a real device: overheat (a phone in a pocket burns, damage over 6 s), shock (worn electronics), spread (M20-5), dazzle (a guard's smart glasses or night vision blinded for 5 s), gear fault (a guard's gear stops), lock brace (a guard's brace or ankle tag locks his legs), jam gun (M20-10), ping (shows the whole network), lure (M20-6), fake backup call, fake all-clear (a guard forgets the player), earpiece blast (deafens), false orders (a guard fires on his squad), surrender orders (a guard drops the gun and kneels), set off grenade (M20-10), and a top-tier worm that downs a whole site; police can be hacked at the cost of heat | `tests/m25-programs.test.js`, `tests/accept/m25-programs.spec.js` | partial: M20-10's combat hacks | — |
| M25-12 | **Fitters:** a fitter in a back room on grown lots, one per district group, each stocked by a theme (combat, stealth, hacking, body), fits, upgrades and sells gear on a fitting screen with the chair and the body shown; an upgrade can roll a bonus; the first fitter is a named character in act one (M24) with jobs of their own. Named gear is taken from guarded supply drops (M24-7) | `tests/accept/m25-fitter.spec.js` | red | — |
| M25-13 | **Loot:** bodies, crates, lockers, safes (opened by code, by M20 or by force) and car boots hold loot by the place and the district, in 5 grades that scale with the player's level (M23-1); junk is merged so a container holds at most 4 things. A smart pistol with a voice assistant is found on a body: it talks, has two modes, and its owner's job ends differently if it is returned or kept | `tests/m25-loot.test.js`, `tests/accept/m25-loot.spec.js` | red | — |
| M25-14 | **Crafting:** anything can be broken down to parts (one kind of part, in grades); a crafting screen makes ammo, health items, grenades and weapons from specs found or bought, and upgrades a weapon's grade; a crafted weapon has two mod slots | `tests/m25-craft.test.js`, `tests/accept/m25-craft.spec.js` | red | — |
| M25-15 | **The inventory:** I opens one screen with tabs (weapons, gear, clothes, health, parts, programs, junk, story), filters and sorting, a tooltip for every item with its numbers, a side-by-side compare with what is worn, and a turning preview of the body; weight against load slows the player when over | `tests/accept/m25-inventory.spec.js` | red | — |
| M25-16 | **Draws:** the player's body, hair and clothes are merged into at most 2 draws; worn gear is in that merge; the mirror's view counts in the budget; the frame stays at or under 175 | the ledger | — | — |
| M25-17 | A saved game keeps the character's look, hair length, tattoos, clothes and outfits, gear and its upgrades, the rig and programs, the inventory, parts and specs, and continues the same | `tests/accept/m25-save.spec.js` | red | — |
| M25-18 | The sweep of the creator, every shop, the wardrobe, gear on the body and the inventory has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M25.T1 | **Checks, red: looks.** `m25-creator.spec.js`, `m25-mirror.spec.js`, `m25-hair.test.js`, `m25-barber.spec.js`, `m25-clothes.test.js`, `m25-clothes.spec.js`, `m25-wardrobe.spec.js`, `m25-disguise.spec.js`, `m25-emotes.spec.js` | new `tests/accept/m25-creator.spec.js`, new `tests/accept/m25-mirror.spec.js`, new `tests/m25-hair.test.js`, new `tests/accept/m25-barber.spec.js`, new `tests/m25-clothes.test.js`, new `tests/accept/m25-clothes.spec.js`, new `tests/accept/m25-wardrobe.spec.js`, new `tests/accept/m25-disguise.spec.js`, new `tests/accept/m25-emotes.spec.js` | M2.T4 | M25-1 to M25-7 red | S |
| M25.T2 | **Looks, sim.** The character's look as data: body, face, hair, makeup, tattoos, piercings; hair growth | new `src/sim/appearance.js` | M25.T1 | M25-1 (part), M25-3 (part) | M |
| M25.T3 | **The body drawn from the look.** Sliders, hair, makeup and tattoos on M2's body kit; the merge into 2 draws | `src/render/player.js`, `src/render/npcs.js`, `tools/people/` | M25.T2 | M25-1 (part), M25-16 (part) | M |
| M25.T4 | **The creator.** Its screen after the start; randomiser, the plain-to-loud slider, presets, outfits, voices; the nudity setting | new `src/ui/creator.js`, `src/sim/newgame.js` | M25.T3, M24.T9 | M25-1 | M |
| M25.T5 | **Mirrors.** The quarter-size reflection within 4 m; the mirror at home reopens the creator | new `src/render/mirror.js`, `src/sim/interior.js` | M25.T4, M33.T3 | M25-2 | M |
| M25.T6 | **Barbers and tattoo parlours.** Their interiors and keepers; cutting, styling, inking, piercing | `src/sim/shops.js`, `src/render/interior.js`, `src/ui/creator.js` | M25.T4, M22.T3 | M25-3 | M |
| M25.T7 | **Clothes.** `clothes.json` (brands, slots, colours); clothes shops; the phone shop's delivery; armour over the top; hats for the mascot and residents | new `src/content/clothes.json`, new `src/sim/wardrobe.js`, `src/sim/shops.js`, `src/ui/phone.js`, `src/render/player.js` | M25.T3, M22.T3 | M25-4 | M |
| M25.T8 | **The wardrobe, outfits and disguises.** Saved outfits; looks over stats; outfits won; photo frames; work outfits and how guards see through them | `src/sim/wardrobe.js`, new `src/ui/wardrobe.js`, `src/sim/guards.js`, `src/sim/interior.js` | M25.T7 | M25-5, M25-6 | M |
| M25.T9 | **Emotes.** Twenty emotes on the Y wheel; reactions | new `src/ui/emotes.js`, `src/render/player.js`, `src/sim/reactions.js`, `src/game/input.js` | M25.T3, M21.T7 | M25-7 | S |
| M25.T10 | **Checks, red: gear and items.** `m25-gear.test.js`, `m25-gear.spec.js`, `m25-gearfx.test.js`, `m25-rig.test.js`, `m25-rig.spec.js`, `m25-programs.test.js`, `m25-programs.spec.js`, `m25-fitter.spec.js`, `m25-loot.test.js`, `m25-loot.spec.js`, `m25-craft.test.js`, `m25-craft.spec.js`, `m25-inventory.spec.js`, `m25-save.spec.js` | new `tests/m25-gear.test.js`, new `tests/accept/m25-gear.spec.js`, new `tests/m25-gearfx.test.js`, new `tests/m25-rig.test.js`, new `tests/accept/m25-rig.spec.js`, new `tests/m25-programs.test.js`, new `tests/accept/m25-programs.spec.js`, new `tests/accept/m25-fitter.spec.js`, new `tests/m25-loot.test.js`, new `tests/accept/m25-loot.spec.js`, new `tests/m25-craft.test.js`, new `tests/accept/m25-craft.spec.js`, new `tests/accept/m25-inventory.spec.js`, new `tests/accept/m25-save.spec.js` | M25.T1 | M25-8 to M25-17 red | S |
| M25.T11 | **`GEAR.md`.** Every slot, tier, item, module and program with its number | new `docs/GEAR.md` | M25.T10 | M25-9 (part), M25-11 (part) | M |
| M25.T12 | **Gear, sim.** Slots, tiers, load, attunement, upgrades; the 40 items' effects from `gear.json` | new `src/sim/gear.js`, new `src/content/gear.json`, `src/sim/health.js`, `src/sim/progression.js` | M25.T11, M23.T5 | M25-8 (part), M25-9 | M |
| M25.T13 | **Gear on the body.** Each item drawn in its slot; icons by the health bar; the cycling setting | `src/render/player.js`, `src/game/hud.js`, `src/ui/settings.js` | M25.T12, M25.T3 | M25-8 | M |
| M25.T14 | **The rig.** Makers, tiers, charge and regain, modules, program slots, queue, upload, quiet programs, crits, overload | new `src/sim/rig.js`, `src/sim/battery.js`, `src/sim/hackables.js` | M25.T11, M20.T13 | M25-10 | M |
| M25.T15 | **Programs.** Sixteen programs on real devices in `programs.json`; police at the cost of heat | new `src/content/programs.json`, `src/sim/rig.js`, `src/sim/combatai.js`, `src/sim/wanted.js` | M25.T14 | M25-11 | M |
| M25.T16 | **Fitters.** Their back rooms and themes; the fitting screen; bonus rolls; the named first fitter; named gear in supply drops | new `src/ui/fitter.js`, `src/sim/shops.js`, `src/sim/gear.js`, `content/story/act1.json` | M25.T12, M24.T4 | M25-12 | M |
| M25.T17 | **Loot.** Containers by place, safes, grades by level, merged junk; the talking smart pistol and its owner's job | new `src/sim/loot.js`, `src/sim/interior.js`, `content/story/strangers.json` | M25.T10, M23.T4 | M25-13 | M |
| M25.T18 | **Crafting.** Breaking down, parts, specs, the crafting screen, grade upgrades, two mod slots | new `src/sim/crafting.js`, new `src/ui/crafting.js`, `src/sim/weapons.js` | M25.T17 | M25-14 | M |
| M25.T19 | **The inventory.** The screen, tabs, filters, tooltips, compare, preview; weight and load; I opens it | new `src/sim/inventory.js`, new `src/ui/inventory.js`, `src/game/input.js` | M25.T12, M25.T17 | M25-15 | M |
| M25.T20 | **Save** keeps everything in M25-17 | `src/sim/save.js` | M25.T19 | M25-17 | M |
| M25.T21 | **Close.** The ledger (M25-16); the sweep of every look, shop, gear piece and screen; one commit per defect; I and Y in the hints | the sweep, the ledger, `content/hints.json` | all of the above | M25-16, M25-18 | M |

## Decisions for the operator

None beyond M13's age rating, which also covers M25-1's nudity setting.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M25-1 | CP-14-001 to CP-14-019, CP-14-021, CP-14-022, CP-14-023, CP-14-024, CP-14-040 |
| M25-2 | CP-14-027 |
| M25-3 | GTA-07-077, GTA-07-078, GTA-12-002, GTA-12-003, GTA-12-004, GTA-12-042, CP-14-020, CP-14-028 |
| M25-4 | GTA-12-001, GTA-12-005, GTA-12-006, GTA-12-007, GTA-12-008, GTA-12-032, GTA-12-033, GTA-12-034, GTA-12-040, GTA-13-031, WD-15-002, WD-16-001 to WD-16-005, WD-16-009 to WD-16-013, CP-11-005, CP-11-006, CP-14-033, CP-14-037 |
| M25-5 | GTA-12-009, GTA-12-010, WD-16-006, WD-16-008, WD-16-014, WD-16-015, WD-16-017, WD-16-019, WD-16-020, WD-16-023, CP-14-029 to CP-14-032 |
| M25-6 | WD-16-016 |
| M25-8 | CP-04-001 to CP-04-014, CP-04-020, CP-04-022, CP-04-023, CP-04-024, CP-04-094, CP-04-098, CP-04-099, CP-08-038, CP-08-039, CP-14-034, CP-15-005, CP-18-037 |
| M25-9 | CP-02-033, CP-04-030 to CP-04-034, CP-04-036, CP-04-037, CP-04-038, CP-04-052, CP-04-053, CP-04-061 to CP-04-075, CP-04-077 to CP-04-084, CP-04-086, CP-04-087, CP-04-088, CP-04-093, CP-04-095, CP-04-096 |
| M25-10 | CP-04-039 to CP-04-051, CP-04-054 to CP-04-059, CP-05-001 to CP-05-016, CP-05-043, CP-05-044, CP-05-054, CP-05-055, CP-05-056, CP-08-057 |
| M25-11 | CP-05-019 to CP-05-033, CP-05-035, CP-05-036, CP-07-027 |
| M25-12 | CP-04-025 to CP-04-029, CP-11-008, CP-11-009, CP-11-040, CP-15-042 |
| M25-13 | CP-06-018, CP-09-042, CP-09-059, CP-11-028, CP-11-029, CP-11-031, CP-11-032 |
| M25-14 | CP-03-039, CP-11-020 to CP-11-024, CP-11-045, CP-15-043 |
| M25-15 | CP-15-036 to CP-15-040 |
