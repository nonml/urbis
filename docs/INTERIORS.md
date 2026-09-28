# Interiors — walking into the city

Feature slice 3 of `docs/CHARTER.md`, verticality v1. The player walks *into* the
city instead of past it: press `E` at the RAMEN shopfront on the main avenue and
you are standing in a noodle bar; press `E` at the neighbouring tower's stair door
and you are on its roof, 44 m up, looking down the avenue at the lots the city is
building on. One world, no loading screen. This file is the pattern the next nine
interiors copy (`docs/BACKLOG.md`, "Interiors": three shops, two offices, a
corporate floor, a club, a warehouse, a subway station, a safehouse).

## The idea in one paragraph

A **space** is a volume inside a building the city already has. The shipped towers
are merged, single-sided boxes, so from *inside* one every face of the city behind
you is culled and the only thing drawn is what the space brings with it: its own
inward-facing walls. Nothing is rebuilt, nothing streams, nothing is swapped out —
the street is still there, rendering, on the other side of a wall you made. A
**door** is two spots, one in each space; `E` within reach of one puts you at the
other. The cut is immediate, covered by a 320 ms fade (a stairwell is a fade, not a
load).

## Where things live

| File | Side | What it holds |
|---|---|---|
| `src/sim/interior.js` | sim, pure | `SPACES` (layout: room, floor, furniture footprints, camera rig), `DOORS`, the state (`space`, `near`), collision (`tickInterior`), `useDoor`, and `frameCamera` — where the follow cam may go |
| `src/render/interior.js` | render | light baking, the patched material, placement, `updateInteriors` (visibility, power, steam, key light) |
| `src/render/interiorsets.js` | render | one builder per furniture `kind`, and the light rig for each room |
| `src/render/interiorkit.js` | render | the painted atlas and the part helpers (`box`, `slab`, `panel`, `tiled`, `part`) |
| `src/render/doorhud.js` | DOM | the `E · …` prompt and the fade |
| `tests/interior.spec.js` | headless | enter/exit, walls hold, counter holds, sliding, roof bounds, camera stays in the room |
| `tests/interior-gate.spec.js` | browser | `E` in and out, the blackout darkens the room, the roof, both under 175 draws |

`src/main.js` only wires it: `tickInterior` after `tickPlayer`, `updateInteriors`
after the zone loop, `frameCamera` after the camera is placed, `E` in the keydown
handler, rain hidden indoors and lifted onto a roof, the hero's key light taken
over indoors, the car and the profiler refused off the street.

## Adding the next interior

1. **Pick a building and a face.** Find the tower in `block.js` (`TOWERS`,
   `INFILL_TOWERS`, …) and work out its podium face and the bay you want the door
   in. The face line and the outward normal are the space's `frame`:
   `{ x, z, out: [fx, fz] }`. Everything else is authored in that frame — `a`
   across the face (to the right walking in), `d` into the building — so a template
   works on any face of any tower.

2. **Keep the room inside the shaft.** A tower's shaft box stands 0.6 m inside its
   podium box. If the camera ever sits between the two, the shaft's outside face is
   in front of it and fills the frame. So the room's front wall is at `d ≥ 0.65`,
   and the camera box (the room, 0.2 m in) is inside the shaft by construction.
   Check the footprint for anything else the city buried in the podium: trees
   (`props.js` `treeSpots`), downpipes and condensers (`block.js`
   `pavementFurniture`), a plinth (its top is at 0.5 m — the floor datum goes above
   it). The RAMEN room stops at z = -15.4 because a street tree's canopy is buried
   in the podium past that.

3. **Write the space** in `SPACES`: `room` (a/d extents), `floor` (the datum — the
   render lays the boards `SLAB` above it, as the pavement sits above
   `heightAt()`), `height`, `items`, `rig`. Every item is a footprint plus a `top`;
   solid unless `solid: false`. The sim collides against the solids and keeps the
   camera out of them; the render builds each item by `kind`, so what you bump into
   is what you see.

4. **Write the door** in `DOORS`: a street end names the `face` its door hangs on
   (the spot is `DOOR_STEP` out from it), a space end names its spot `at: [a, d]`.
   Arrivals go a step clear of the spot, out of reach of the same door, and facing
   so the camera has room behind the player — the tests check that every spot and
   arrival is somewhere a person can stand.

5. **Build it** in `interiorsets.js`: a builder per new `kind`, a light rig
   (`lamp`, `flame`, `window`, `emergency`) and, for a street door, a hang
   function registered in `HANG` in `render/interior.js`.

6. **Budget.** The room is one merged mesh. Do not add a second material; add a
   cell to the atlas. Do not add a light; add a baked source to the rig.

## Light: baked, four channels, one uniform each

Every vertex carries `aLight = [lamp, flame, window, emergency]`: how much of each
light reaches it, baked once at build from point sources (wrapped Lambert, inverse
square with a reach) and, for the window, a falloff from the glass. The material is
a `MeshBasicMaterial` patched (materials.js shape: miss guard, cache key, every
uniform bound) so its colour is

    albedo × (ambient + lamp·uLamp + flame·uFlame + window·uWindow + emergency·uEmergency)

A part that *is* a light — a bulb, a lamp disc, the frosted glass, the fridge, the
burner — carries a fixed `glow` vector instead of a baked one, so it lights up in
the same channel as the light it gives.

Per frame `updateInteriors` sets the four uniforms from the world:

- `uLamp` = the zone's power, read exactly the way the street reads it
  (`zoneGlow` → full, dead, or `blink()` through the collapse and restore).
- `uFlame` = the gas under the stock pots: it flickers and it does **not** die in
  a blackout.
- `uWindow` = daylight by day; at night the street's lamps (which die with the
  zone) plus a trace of night sky.
- `uEmergency` = `1 − power`: the battery twin-spot over the door, dark until the
  mains fail.

That is the hack pattern (AGENTS.md, "Add a hack") carried indoors: the hack is
sim state with deadlines; the room reads it and visibly dies and comes back, sized
to the act — a zone blackout darkens the shop in that zone, not a shop across town.

The hero is lit by the city's lights, not the bake, so indoors main hands the
hero's key light to `updateInteriors` (the lamps' share times power, plus the
flame's flicker). Outside, the door and the roof are a `MeshStandardMaterial` lit
by the sun and moon with an emissive map for the lamps, the lantern and the signs,
scaled by the same power.

## The camera

`frameCamera(state, pivot, eye)` takes the eye the follow cam wanted and returns
the nearest point on the line from the player's head to it that is inside the
room, under the ceiling and outside every solid (0.2 m margin, so the 0.1 near
plane never cuts a wall). Backed into a wall with less than 1 m of room, it swings
up to look down over the shoulder instead. On a roof only the deck and the solids
bind: the camera may hang out past the parapet over the street — that is where a
person looks from. Each space has its own rig (`dist`, `pitch`), set when the
player comes through the door; the street rig comes back when they leave.

## Draws

The outside mesh (both doors and the roof dressing) is one draw on the street and
on the roof; inside, the room and the steam are two, while the outside mesh and the
rain (which would fall through the ceiling) are hidden. Hidden meshes cost nothing.
Nothing casts a shadow — a caster costs a second draw in the shadow pass.

Measured on every `requestAnimationFrame`, CPU-side counter, SwiftShader, base
`69ff023` against this branch at the same poses (`diag-session.mjs` in the
worktree, gitignored):

| Pose | Base | Interiors |
|---|---|---|
| Gate pose, night | 152 (two loads, two sessions) | 153 |
| Gate pose, blackout flip + mirror re-shoot | — | 164 peak |
| Street by the RAMEN door, night | 139 | 140 |
| By the stair door, night | 130 | — |
| Inside the shop, night | — | 137–138 |
| Inside, blackout flip + re-shoot | — | 148 peak |
| Inside, by day | — | 138 |
| On the roof, night / day | — | 129 / 130–151 |
| On the roof through the whole night→day turn | — | 149 peak |

Worst frame measured: **164**, the gate pose through a blackout, under 175.

## Evidence

`docs/shots/wave2-interiors-street-door.png` (the door, its lantern and noren, and
the `E · ENTER RAMEN` prompt), `-inside.png`, `-blackout.png` (the same framing,
lights dead, the gas still burning), `-roof.png` and `-roof-avenue.png` (by day,
from the crown; a crane on a growth lot shows over the east row).

## Not yet

- The keeper and the diner are merged into the room: they stand still.
- The shop's street glazing is still the painted atlas from `block.js`; you cannot
  see into the real room from the pavement, and from inside the front is frosted.
- From this roof the growth lots are mostly screened by the 26–46 m towers around
  it; the cranes show over the rooftops, the lots themselves barely. A lower roof
  nearer a lot (the east-row tower at z = -44, 26 m, looks straight down on the
  lot in the gap behind it and across at the south-west pair) is the better
  second roof.
- One shop, one roof. The next nine copy this file.

## Things learned the hard way

- A tower's podium stands on a solid plinth to 0.5 m. Put a floor below that and
  the plinth's top face covers it.
- The follow cam has no idea about walls on the street. Indoors it must, and the
  camera box, not the player's walk box, is what keeps it out of the facade.
- The blackout's first second is a flicker (`zoneGlow` 0.5, `blink`), not dark.
  Anything that measures "the room went dark" waits past the collapse.
- On the software renderer the frame loop's 50 ms clamp makes game time crawl:
  the day/night turn is ~140 frames and a blackout ~190, whatever the wall clock
  says.
