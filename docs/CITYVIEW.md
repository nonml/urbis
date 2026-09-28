# City view — the player zones the city

Read `AGENTS.md` first, then `docs/ZONING.md`; this document assumes both.

Since slice 046 ten lots grow and decline on their own, but their use was a random
roll. City view is the builder's hand: **`Z` lifts the camera off the street to an
oblique overview of the district, and up there the player zones lots.** `Z` again
brings it back down to the player. Same world, same frame loop, no loading screen:
the sim keeps ticking the whole way up and down, and the player's body stays where it
stood.

## Controls

| Where | Input | Does |
|---|---|---|
| street | `Z` | rise to the overview (1.6 s) |
| overview | `Z` | come back down to the player (1.6 s) |
| overview | `R` `C` `I` `X` | brush: residential, commercial, industrial, unzone |
| overview | click a lot | paint it with the brush |
| overview | hover a lot | readout: zoning, what stands there, what it is doing |
| overview | drag | sideways orbits, up/down tilts (oblique band only) |
| overview | wheel | zoom, 60–220 m from the point it looks at |
| overview | `WASD` (+`Shift`) | pan, relative to the way the overview faces |

The palette rows are clickable too. At street level `R C I X` do nothing and a click
paints nothing; the brush is live only once the camera has finished rising.

## The rule: what zoning does to a lot

A parcel carries two uses now:

- `use` — what stands on the lot, or what it is breaking ground as. Render reads this
  (glass for commercial, warm concrete for homes, cool concrete for works).
- `zoned` — what the lot is zoned for: `'res' | 'com' | 'ind'`, or `null` (unzoned).
  The outlines and the readout read this.

**Every lot boots zoned for the use it already rolled** (`zoned = use` in
`makeParcel()`), so an untouched city grows exactly as it did before the player could
zone. That is measured, not assumed: ten simulated minutes, two blackouts included,
are bit-identical to `69ff023`, and `tests/zoning.spec.js` and the gate's idle test
keep their claims unchanged.

Each tick, in `tickZoning()`:

- **`use === zoned`** — the lot is settled and `tickParcel()` runs exactly as before:
  growth and decline follow that use's demand.
- **anything else** — the lot is *clearing* (`clearLot()`, `src/sim/zoning.js`):
  - A **built lot that is rezoned** comes down a stage every `CLEAR_SECS` (15 s),
    continuously, the same way it went up — no pop. It stays the old use the whole
    way down: **a building never changes use standing.** Only when it reaches an
    empty lot does `use` take the new zoning, and from the next tick the lot is
    settled again and breaks ground as the new use — when that use's market is there
    (the usual `BREAK_GROUND_AT` bar in `tickParcel()`).
  - An **empty lot that is rezoned** has nothing to take down, so it takes the new use
    on its next tick. Its invisible planning progress restarts at zero: permits for
    homes are not permits for a warehouse.
  - An **unzoned lot** clears the same way and then **stays empty for good**: its
    `use` becomes `null` and `tickParcel()` is never called on it again, so it can
    never break ground. Zone it again and it grows again.
  - A clearing is site work like any other, so **a blackout stops it** (the
    `isDark()` skip in `tickZoning()` comes first).
  - Painting a lot back to what stands on it mid-clearing calls the demolition off:
    the lot is settled again and grows from whatever height it had come down to.

Why a demolition is faster than a slump (15 s a stage against `DECLINE_SECS` 60):
the slump is a market giving up, slowly, on its own; the clearing is an order the
player just gave and is watching the answer to (pillar 5).

Why the rule is expressed as parcel state and not inside `tickParcel()`: wave 2 had
three tracks in `zoning.js` at once — economy owns `updateDemand()`, decline owns
`tickParcel()`. City view owns `makeParcel()`'s `use`, `zoned`, `zoneParcel()` and
`clearLot()`, and touches `tickZoning()` in one line (the `use === zoned` branch).
`tickParcel()` is never called with a null use, so nothing downstream of it has to
guard one.

**Merge note for anything that reads `p.use`:** it is `null` on an unzoned lot once it
has cleared. Render only reads it when something stands (`builtHeight > 0`), and the
readout handles it; a demand or economy model that counts lots by `use` must skip
`null`.

## The readout (pillar 5)

Hovering a lot shows three lines: what it is **zoned** for (with its paint), what
**stands** there (`empty lot`, or `site · residential`, `mid-rise · commercial` …), and
what it is **doing**:

| Status | Means |
|---|---|
| `▲ growing` | its level (stage + progress) rose this frame |
| `▼ declining` | its level fell this frame, on its own market |
| `■ stalled — no power` | its power zone is blacked out, so no work happens |
| `◆ clearing for …` / `◆ clearing — unzoned` | its building is coming down to match its zoning |
| `● complete` | a finished tower, holding |
| `· waiting for demand` | zoned, but its market is not there yet |
| `· unzoned — nothing will be built` | cleared and unzoned |

Growing and declining are **observed**, not predicted: `tickCityView()` compares each
lot's `stage + progress` with the frame before. That keeps city view from duplicating
the growth thresholds, which belong to `tickParcel()` and the decline and economy
tracks are free to change. The street-level *why* of a decline is the decline track's
work; the district numbers are the economy track's. This readout is deliberately the
minimum a player needs to know that their click did something.

## The camera

`render/cityview.js` never cuts the camera. Every frame `main.js` places the street rig
as it always has; city view then blends from that pose to the overview by the eased
lift: the point looked at slides from the player to the overview pivot, the tilt swings
up, and the distance grows geometrically (4.5 m to 200 m reads as one steady climb,
not a slow start and a lurch). At lift 0 it does nothing at all, so the street frame is
exactly the frame it was.

- The overview starts over the centre of the ten lots, facing the way the street camera
  faced, 200 m out and tilted 1 rad (≈57°): oblique, a Cities: Skylines distance, far
  enough that all ten lots fit on screen from most headings. The wheel zooms between
  60 m and 220 m; at 220 m every lot is on screen from every heading. The tilt band is
  0.9–1.25 rad. Both ends are set so the top of the frame stays inside the camera's
  400 m far plane — past it the world's edge would show.
- While the camera is up it owns the street rig's heading and parks its tilt and
  dolly, so a drag or a wheel meant for the overview does not leave the player's camera
  somewhere odd. It lands facing the way the overview faced.
- Street fog is tuned to eat the frame at 200 m, which from the overview is the whole
  district. It thins in proportion to the camera's distance (`FOG_REACH` = 30 m): the
  point the overview looks at always stands in as much haze as the street camera sees
  30 m away, day or night. The near plane backs off from 0.1 m to 4 m with the lift,
  or the road paint shimmers against the tarmac from 200 m.
- The player cannot walk or drive while the camera is up (`footInput()` /
  `driveInput()` return nothing); WASD pans the overview instead. The pan is clamped
  to the district floor (`WALK_BOUNDS`).

The outlines are one `InstancedMesh` of low kerbs, four per lot, just outside the
hoarding line: leaf green (residential), slate blue (commercial), ochre (industrial),
grey (unzoned) — the palette swatches' colours. The material is unlit and outside the
fog, so a zone reads the same at noon and at midnight: it is the planner's overlay, not
part of the weather. Their width follows the camera's distance, so they keep the same few pixels
zoomed in or out. The hovered lot's kerbs widen and lighten. They rise out of the ground
with the lift instead of popping in.

## Draw budget

Measured with one instrument throughout: `renderer.info.render.calls` read on **every
`requestAnimationFrame`** (never a sampler), SwiftShader, default spawn (the gate pose),
the untouched build (`69ff023`) loaded twice and this build once in the same browser
session. The two baseline loads agree exactly.

| Frame | `69ff023` | city view |
|---|---|---|
| street, night, lit | 147 steady, 152 on mirror frames | 147 / 152 — **+0** |
| street, blackout | 168 peak | — |
| rise and descent (night) | — | 152–160 |
| overview, night, 200 m, eight headings | — | 155 steady, 160 on mirror frames |

The street frame is untouched because nothing city view draws exists at lift 0: the
kerbs are hidden and the camera code returns before touching anything. The overview
costs +8 over the street's steady 147: +1 for the kerbs (one instanced mesh, no shadow)
and +7 for instanced groups the street camera culls and the overview cannot. Any
frame over 160 cannot also re-shoot a mirror face: `main.js` only lets a face in when
the previous frame left room for it.

Still to be swept at this commit: the overview by day, at its widest reach and lowest
tilt, panned, and during a blackout seen from above.

## Files

| File | Owns |
|---|---|
| `src/sim/zoning.js` | `zoned`, `zoneParcel()`, `clearLot()`, the one `tickZoning()` branch |
| `src/sim/cityview.js` | the tool's state machine: mode, lift, pivot, orbit, zoom, brush, hover, per-lot trend, `lotStatus()` |
| `src/render/cityview.js` | camera blend, fog and near-plane, kerb outlines, lot picking |
| `src/ui/cityview.js` | palette, lot readout, pointer/wheel input, parking the street rig |
| `src/main.js` | imports, construction, the `Z R C I X` line in `keydown`, one tick line, two frame lines, the held inputs, `__game.cityview` |
| `tests/cityview.spec.js` | the rule and the tool, headless |

## Probe

`window.__game.cityview` — `state()` (mode, lift, pivot, yaw, tilt, reach, brush,
hover, trend), `lots()` (use, zoned, stage, building), `screen(i)` (lot `i` in
normalised device coordinates, to aim a real pointer at it), `pick(x, y)` (the lot
under a device-coordinate point). Behind `?capture=1` only: `advance(secs)`, which runs
the district's sim ahead in the frame loop's own steps (`tickStreet`, `tickZoning`,
`tickCityView` at 0.05 s) without drawing them. It exists because a software
rasteriser draws about a frame a second, and the half-minute a zoned lot takes to
break ground would otherwise be ten minutes of frames; on a GPU, wait instead.

## Not done here

- **No new lots.** The ten measured `LOTS` stay the list; ZONING.md explains why every
  coordinate has to be verified from the street first.
- **No district numbers in the overview.** Demand, jobs and wealth are the economy
  track's to expose; the palette has room for them.
- **No painting by drag** (sweeping a brush over several lots). Ten lots do not need
  it, and a drag is the orbit.
