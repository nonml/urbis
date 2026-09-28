# Draws — where the frame goes

The budget is **175 draws, every frame** (law 3). This file says what those draws are
spent on, object by object, measured from the running game. Read it before you guess
where the budget went, and re-measure it when you change what the frame draws.

Measured 2026-09-28 by wave 2's reclaim track, at the default spawn with the ordinary
follow cam (the gate's pose: the gate and the street shots are the same camera at the
same 16:9 aspect). Base is `69ff023`; "now" is the tip of `wave2/reclaim`.

## Totals

| Frame | Base | Now | Change |
|---|---|---|---|
| Night | 152 | 122 | −30 |
| Day | 152 | 131 | −21 |
| Night blackout, peak | 168 | not recorded | — |
| Day blackout, peak | 168 | not recorded | — |

The reclaim track left its own blackout peaks unrecorded. The merged build's, read on
every frame of a whole blackout, are under "Worst case on the merged build" below.

A blackout frame is the ordinary frame plus a pursuit car (7 meshes, and its shadow by
day), the hack pulse, the spark burst and, on the frames that re-shoot the city mirror,
one cube face. The peak is always a mirror frame.

## How to measure

- **The ledger.** Behind `?capture=1`, `window.__game.ledger(n)` resolves with the next
  `n` whole frames, one array of rows per frame, one row per draw call: which pass drew
  it (`main`, `shadow`, `mirror` for a city-mirror cube face, `post` for a full-screen
  quad), the object's path in the scene, its type, material, colour, vertex and instance
  counts, whether it casts, and its opacity. A row is booked only when the call moved
  `renderer.info.render.calls`, so an instanced mesh at count 0 is not a draw.
  `src/render/ledger.js`.
- **Sweep every frame.** Read `__game.draws()` on every `requestAnimationFrame`. Start a
  ledger in the same evaluate as `__game.hack()` to catch the frames that re-shoot a
  mirror face.
- **Resolution does not matter; aspect does.** Culling depends on the camera frustum, and
  the post chain draws the same passes at any size. A 64x36 page draws what a 1280x720
  page draws (the evidence shots were taken mid-sweep, at 1280x720, and the count did not
  move). Measure at a postage stamp of the same 16:9 aspect; shoot at 1280x720.
- **SwiftShader is slow per frame, not per pixel.** Even at 64x36 this machine renders
  about one frame a second: the cost is vertex work (the prop GLBs alone are 1.3 M
  vertices a frame) and draw overhead, not fill. A whole blackout is 180 frames. Plan a
  session in frames, not seconds.
- **Skip the dusk.** `T` glides day and night over about 140 frames. `__game.night(n)`
  (capture only) sets the glide's end state at once: `night(0)` is noon, `night(1)`
  midnight.
- **One session, one server.** Serve every build under test from one directory
  (`/base/`, `/after/`: the bundle's paths are relative) and load each in turn from one
  browser. Check the bundle you loaded by its hash and by a string only that build has.

## Rules the ledger taught

- **A shadow caster costs two draws by day and one at full night.** The sun is the only
  light that casts. At `nightFactor` 1 its intensity is zero, so the shadow it would
  draw multiplies nothing, and `updateDaylight` holds its map still instead of
  re-rendering every caster into it. The day frame is where a caster's second draw is
  paid; measure it there.
- **A transparent draw at opacity 0 still costs its draw.** three culls on `visible`,
  never on opacity. `hideFaded` (`src/render/faded.js`) skips the pools, streaks, lamp
  shafts, stars and moon halo while they are fully faded: by day, and a dead zone's share
  of them in a blackout. A glow dimmed through its colour rather than its opacity still
  picks up fog, so it is still drawn.
- **A transparent double-sided material draws twice**, back faces then front, unless
  `forceSinglePass` is set. For a billboard (one face ever shows) or additive light
  (the sum does not care which face lands first) one pass gives the same pixels.
- **One material can light both power zones.** `zoneLit` (`src/render/materials.js`)
  reads each vertex's (or instance's) `zone` and picks that zone's colour and emissive
  from two-element uniforms. main.js drives each zone through `zoneView`, exactly as it
  drove the per-zone twin materials that used to cost a draw each. A mesh wearing a
  zone-lit material must carry the attribute, or WebGL reads 0 and it follows zone 0.
- **A lighter frame changes when the mirror fires.** The probe only shoots a face when
  the last frame left room for it. At 163 draws the blackout frame starved it through
  the whole collapse, so the water happened to be re-shot in the dark. Freed of that,
  it fired mid-flicker; it now waits for a zone to settle, dead or lit.

## The frame, by object

Draws per frame at the default spawn, lit. `+s` is the shadow pass.

| Group | Objects | Base night | Base day | Now night | Now day |
|---|---|---|---|---|---|
| Ground | road, pavements, kerbs, kerb clutter (casts), terrain, markings x2 zones, manholes | 8+1s | 8+1s | 8 | 8+1s |
| Towers | facades: 3 architectures x2 zones (cast), 2 podiums (cast), posters, caps (cast), shop glass x2 zones, silhouettes | 13+9s | 13+9s | 9 | 9+6s |
| Sky | sky dome, skyline ring, stars, moon halo, mountains x2, grass ground and tufts, aviation beacons | 9 | 9 | 9 | 7 |
| Outskirts | ground slab + 9 instance pools (not visible from here: `ad2b480`) | 10 | 10 | 10 | 10 |
| Trees | trunks, canopies, branches (cast) | 3+3s | 3+3s | 3 | 3+3s |
| Signs | faces, glows, arms, alley washes; light pools x2 zones | 6 | 6 | 6 | 4 |
| Lamps | poles, heads, shafts (2 passes), glows (2 passes); light pools x2 zones | 8 | 8 | 6 | 3 |
| Streaks | road streaks x2 zones, car streaks | 3 | 3 | 3 | 1 |
| Growth | shells: 2 architectures x2 zones (cast), site kit (casts) | 4+5s | 4+5s | 3 | 3+3s |
| Walkers | coats (cast), heads, legs L/R, arms L/R, hats, faces, glasses | 9+1s | 9+1s | 9 | 9+1s |
| Traffic | glows, bodies (cast), wheels, beams, tails, glass, trim, throw (2 passes) | 9+1s | 9+1s | 9 | 9+1s |
| Hero car | 2 headlight sprites, finder beacon, paint (casts), wheels, beams, tails, glass, trim | 9+1s | 9+1s | 9 | 9+1s |
| Player | coat (casts), head, legs L/R, arms L/R, pack | 7+1s | 7+1s | 7 | 7+1s |
| Shops | fascia and blade signs x2 zones, brackets | 3 | 3 | 3 | 3 |
| Puddles | mirror water x2 zones | 2 | 2 | 2 | 2 |
| Props | hydrants (2 materials), trash cans (3 variants) | 5 | 5 | 5 | 5 |
| FX | contact blobs, steam (2 of 3 in frame), substation slits, substation body (casts), rain | 6+1s | 6+1s | 6 | 6+1s |
| Post | bloom 13, output 1, grade 1 | 15 | 15 | 15 | 15 |
| **Total** | | **152** | **152** | **122** | **131** |

What went, and which commit took it:

- **Shadow pass at night**, 23 draws (24 with a pursuit car): `perf(render): the shadow
  pass sleeps through the night`.
- **Faded draws by day**, 10: lamp and sign pools x2 zones, road streaks x2, stars, moon
  halo, lamp shafts (both passes). In a blackout's dark phase, 3 more at night: the dead
  zone's pools and streak. `perf(render): a faded draw is skipped, not drawn clear`.
- **Per-zone twins**, 5 at night and 10 by day: facades 6 → 3 meshes, shop glass 2 → 1,
  growth shells 4 → 2, and the mirror proxy 2 → 1, so a cube face costs 4 instead of 5.
  `perf(render): one material lights both power zones`.
- **Second passes that drew nothing**, 2 (3 while the hack pulse is alive): lamp glows,
  lamp shafts, hack pulse. `perf(render): billboards and flat light stop drawing their
  back faces`.

## Peaks

A mirror face renders layer 1 only: the sky dome, the skyline ring, the facade proxy and
the alley washes, **4 draws** now (5 before the proxy merge; a face that looks straight
up misses the alley washes and costs 3). One face per frame, five faces per re-shoot, and
only when the last frame plus a face plus a 10-draw margin fits the budget. It fires
when a zone settles dead or lit, when the camera travels 20 m, and every 6 s of game
time regardless, so an ordinary night or day frame also peaks at +4.

### Worst case on the merged build

Measured 2026-09-29 on the merged wave 2 build (`9f846cd`, bundle `index-CfqULxPY.js`),
Chrome on a real GPU (ANGLE/D3D11), 1280x720. Every frame from the hack to the zone
lit again was read, about 2,250 frames at 180 fps. Everything wave 2 added was on at
once:

- the arc's marker was up (the player has taken the car);
- shops were pinned to a collapsed market and homes to a booming one for 14 s of sim,
  so TO LET boards, dark floors and cranes were all showing;
- in city view, a clearing was ordered with X at the widest reach.

On the same machine the gate pose reads 123. The container read 118 for the same build
on SwiftShader.

| Where | Night, lit | Night, blackout peak | Day, lit | Day, blackout peak |
|---|---|---|---|---|
| Street, gate pose | 125 | 136 | 134 | 147 |
| Driving, W held | 118 | 127 | 126 | 139 |
| City view, widest reach, a lot clearing | 127 | 138 | 136 | **149** |
| Inside the noodle bar | 111 | 120 | 121 | 131 |
| Roof | 115 | 119 | 124 | 130 |

**Worst frame: 149 / 175**, city view by day in a blackout. That is main 111, shadow
19, one mirror face 4 and post 15. Every peak but one includes a mirror face. The
outdoor day peaks land in the first second after the hack. The other peaks land 8.4 to
9.5 s after it, around the end of the blackout at 8.9 s. The exception is the night drive, which peaks
on the first frame after the hack, before the car pulls away, and has no mirror face.
Evidence: `wave2-merged-*.png`.

## What is still on the table

Measured costs a next wave could take, none of them free of risk to a shipped look:

- **More per-zone twins, 1 draw each:** road markings (they also dim `envMapIntensity`
  per zone, so the patch needs a third uniform), puddle mirrors (`reflectivity` per
  zone), shop fascia signs (a `MeshBasicMaterial`: the zone patch without the emissive
  line), and at night the lamp pools, sign pools and road streaks (per-zone opacity).
- **Limbs, 4 draws:** walkers and the player draw legs L/R and arms L/R as separate
  meshes of one geometry and material; one instanced mesh of each takes two instances.
- **The hero car, 2-3 draws:** two headlight sprites and a finder beacon, each a draw;
  beams and tails can share a vertex-coloured mesh the way the pursuit cars' do.
- **The traffic headlight throw, 1 draw:** additive and double-sided, so it pays the
  second pass the lamp shafts no longer do (`traffic.js`, left alone as the wanted
  track's file this wave).
- **Outskirts, 10 draws** that the tower rows hide completely from the street
  (`ad2b480`): an occlusion question, not an instancing one.
- **Bloom, 13 draws:** five mip levels of blur. It is the look; touch it only with a
  look review.
