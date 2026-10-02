# Wanted — police tiers

Feature slice 4 in `docs/CHARTER.md`. Pairs with VGA-068 (search language) and
VGA-069 (roadblock theater), and does the wash half of VGA-022.

**The rule (pillar 4):** heat is the tier, and the tier is the size of the
response. A small crime draws one cruiser. Every crime on top of that adds a
*kind* of response rather than a bigger number, and nothing is inflated into a
city-wide event — there is no tier that sends the whole city after you.

## The tiers

| Tier | What it adds | What puts you there | How you drop out of it |
|---|---|---|---|
| ☆☆☆ 0 | Nothing. No unit, no draw. | — | — |
| ★☆☆ 1 | **One cruiser.** It responds to where the crime was and searches from there. | Any one crime: a blackout (`H`), or 8 s flat out (> 9.5 m/s) with no heat at all — a speed camera. | Stay out of sight for **14 s**. |
| ★★☆ 2 | **A second cruiser**, and **spike strips**: while you are driving and in sight, a stinger is thrown across *your* lane ~38 m ahead. The other lane is the dodge. | A second crime: another blackout, or 8 s flat out *in sight of a unit* (evading). | Out of sight for **20 s**. |
| ★★★ 3 | **A roadblock** ~55 m ahead of where you were last seen, on the heading you were last seen on, **and the helicopter**, whose searchlight tracks you at night. | A third crime. | Out of sight for **25 s**. |

Dropping a tier sheds exactly what that tier added: the helicopter breaks off and
climbs away, the roadblock packs up (only once you are out of sight of it — it
never vanishes in front of you), and the cruiser a lower tier no longer needs
drives off before it despawns. Going from ★★★ to clean is 25 + 20 + 14 = 59 s of
not being seen, which is what the contracts' `lose_heat` step waits for.

The table is `TIERS` in `src/sim/wanted.js`. That table is the design; this page
is its prose.

## Sight: what "out of sight" means

Sight is a street, not a radius (`src/sim/patrol.js`). Towers fill every block
between the roads, so an officer sees you when you are **in the same avenue or
crossing** and within 46 m, or when you are **within 12 m** — close enough to
look round a corner. A blackout is cover: in a dark zone only the 12 m look
works. The helicopter sees what it is looking at: at night that is its
searchlight's 5 m pool on the ground, by day a 10 m patch where the observer is
looking. Either way the spot it watches moves at 90% of a sprint.

That makes the escape legible (pillar 5): **turn off the street the cruiser is
in and it has lost you.** Walk and the light holds you; sprint or drive and you
slip out of it — at night you can watch yourself leave the pool.

## Search language (VGA-068)

When nobody has seen you for 1.5 s the units stop chasing you and start
searching the **last known position**:

- an amber dashed **search ring** is laid on the street around it, starting at
  8 m and widening 1.4 m/s to 30 m as the trail cools, with a brighter sweep
  running round it;
- each cruiser works its own side of the ring, by road;
- the helicopter orbits the last known position and its light sweeps the area.

The ring is the police's knowledge, drawn where you can read it: you are safe
outside it, and you understand why they found you when you were not.

## Roadblock theater (VGA-069)

Two cruisers nose-in across the carriageway make a V with a car-width gap
between their noses; a stinger covers the approach to the gap; lit type III
barricades — striped boards, amber lamps flashing on each post — close both
pavements. The whole line is solid, out past the building line, because nothing
else in the city stops a car at a facade yet. You can turn off before it,
thread the gap and take the strip, or hit it — a car that hits it stops dead,
and two and a half seconds within reach of those cruisers is busted.

The red/blue wash is a real light, not a decal: one point light parked on the
nearest police light source (the roadblock if the camera is near one, else the
nearest cruiser), taking that bar's colour of the moment, so the facades and
the wet road around it flash red and blue.

## Spike strips

A strip is a sim object with a footprint. Driving over it sets `car.flat` on
the player's car: the rims bleed the car down to 45% of its top speed and hold
it there with the pedal down, it pulls to one side and shimmies — you steer
against it — and it sits visibly lower on squashed tyres, throwing sparks from
the front wheels. Flats last until the heat is gone.

## Dispatch chatter

Radio lines as subtitles with a speaker label (`DISPATCH`, `UNIT 12`,
`UNIT 40` at the roadblock, `AIR 1`), bottom-left, in their own element. They
are generated from sim events — tier up and down, spotted, lost, strip down,
strip hit, roadblock up, rammed, air unit on scene or breaking off, busted,
clear — and the wording is data: `src/content/dispatch.json`, validated by
`npm run validate` against the list of calls the sim can make. One voice at a
time (1.6 s between lines), no repeat of the same call inside 6 s, and a line
not said within 5 s is dropped as stale. Variants are picked with the sim RNG
stream, so a replay says the same thing.

## Where it lives

| File | What |
|---|---|
| `src/sim/wanted.js` | heat/tier table, sight and search state machine, units, busted |
| `src/sim/patrol.js` | the road graph as the police use it: sight, routing, "ahead on the road" |
| `src/sim/response.js` | roadblock, spike strips, flats, the helicopter |
| `src/sim/dispatch.js` + `src/content/dispatch.json` | radio lines from sim events |
| `src/render/policekit.js` | every police body — cruiser, barricade, stinger, helicopter — in one instanced mesh |
| `src/render/police.js` | placing the kit, every police lamp, the red/blue wash, flats on the hero car |
| `src/render/heli.js` | searchlight beam and spot, search ring, helicopter lamps |
| `src/ui/dispatch.js` | the radio subtitles |
| `tests/wanted.spec.js` | headless: escalation, de-escalation, search, spikes, roadblock, busted, `lose_heat`, dispatch |

## Draw cost

Nothing draws while the city is clean. At full stretch the whole response is
four draws:

| Draw | What | When |
|---|---|---|
| kit | every cruiser, barricade, stinger and the helicopter, one instanced mesh; the vertex shader folds away the parts an instance is not | any unit out |
| kit shadow | the same, into the sun's shadow map | by day only — at night the sun is down and the pass would draw nothing anyone sees |
| lights | every head/tail lamp, light bar, barricade lamp, stinger reflector, helicopter lamp and search-ring dash, one instanced box mesh | any unit out |
| beam | the searchlight shaft | helicopter up, at night |

The red/blue wash and the searchlight pool are real lights, which cost no draw;
both sit in the scene from boot at zero intensity, because adding a light later
recompiles every lit material in the frame. The flat-tyre sparks reuse the hack
spark cloud. The two per-car pursuit meshes this replaced cost 8 draws a
cruiser — 16 at ★★.

Measured every `requestAnimationFrame` on SwiftShader (draw counts are a CPU-side
counter and valid there; nothing here is a timing), same page, same pose:

| Frame | Base `69ff023` | Wanted |
|---|---|---|
| Clean, night, spawn pose | 152 | 152 (+0) |
| Blackout at spawn (the hack also raises ★) | 160 median, 165 peak — its one ★ car cost 8 | 154 |
| Worst pursuit: ★★★, roadblock in view, helicopter up, search ring, flats sparking, night, blackout | — | 143 peak against 139 for the same pose clean: **+4** |

## Capture probe

Behind `?capture=1` only, `window.__game.police` can force a tier
(`tier(n)`), a lost suspect (`search(x, z, yaw)`), hold the pursuit still
(`hold(true)`), freeze the light-bar phase (`flash(t)`), pose the car, a
cruiser or the helicopter, and set flats. `window.__game.wanted()` is always on
and reports the tier, contact, units, roadblock, strip, heli, search ring and
the last radio lines.
