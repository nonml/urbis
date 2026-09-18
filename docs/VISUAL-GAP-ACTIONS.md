# VISUAL GAP ACTIONS — every gap becomes a buildable item

Source: `docs/VISUAL-GAPS.md` (186 gaps, 5 sections, 13 evidence frames).
Reference IDs (`VGA-###`) are for tracking, **not a ranking** — no priority implied.
Each action: what changes, what it touches, done-when (evidence + metric), draw cost.
Global rules still apply: sim/render boundary, seeded RNG only, gate green,
screenshot-or-it-didn't-happen. Play-angle rule (added 2026-09-17 after the
first audit caught lab-only proofs): DONE requires evidence shot at the normal
play camera — close-up/top-down lab angles alone cap an item at PARTIAL.
Coverage footer at the bottom proves no gap was dropped.

---

## External review triage — 2026-09-18

An external model was handed `docs/shots/` and returned a long critique. `docs/shots/`
spans slice-008 to slice-023, so it reviewed a mix of current and long-superseded frames,
and most of its sharpest claims describe the slice-008–011 era that `VISUAL-GAPS.md` was
already built from on 2026-09-16. **Verified against the code before queueing anything.**

This is the useful half of the result: several complaints are things this project already
fixed, and that is worth recording — it is independent confirmation that slices 017–022
landed. Do not re-open them.

| Claim | Measured in code | Verdict |
|---|---|---|
| Edge lines ~40–50cm, cut to 10–15cm | `PlaneGeometry(0.10, …)` — 10cm | already correct |
| Dashes → 12–15cm, 3m long, 6–9m gap | 0.10 × 3m, 6m gap | already correct |
| Crosswalk stripes are thick slabs | 0.35m at 0.70m pitch | already correct |
| Lane 6–7m wide, narrow to 3.0–3.5m | `ROAD_HALF = 3.5` → a 7m **two-lane** road, 3.5m per lane, car 1.8m | misread: counted two lanes as one |
| Add an explicit 15cm vertical curb | `box(0.22, 0.15, …)` at y=0.075 | already there |
| "Clearly not using ACES tone mapping" | `ACESFilmicToneMapping`, exposure animated 0.75→1.10 | wrong |
| "Sky is absolute #000000" | amber light-pollution horizon band in the sky shader, night-weighted | wrong |
| "No manhole covers, no drains" | 15 manhole covers, 0.55m radius | wrong (drains still absent) |
| Camera too high, tilted down; put it at chest height | `lookAt` y = 1.7m on foot, rig base +0.6m, FOV 52 | already correct; matches the pre-slice-020 rig, not this one |

**The metric scale is right.** Anyone told to "fix the marking widths first, it takes ten
minutes" would spend ten minutes breaking correct values. Measure before you believe a
review — including this one.

### What survived, and where it goes

- **Featureless walls at eye level.** The biggest real finding. Tracks to **VGA-043**.
- **Fidelity mismatch** — flat-shaded trees against PBR cobblestone against box cars.
  Real, and an art-direction decision, not a shader fix. No single VGA item owns it.
- **No contact shadow under the car or the player.** Genuinely absent, genuinely cheap
  as a blob decal on the existing instanced path. Not currently a VGA item.
- **Street drains and grates.** Manholes exist; drains do not.
- **Camera lower still, tilted up.** Legitimate taste note on top of slice 020.

### Do not act on these

The review asks for **SSR, SSAO and volumetric light shafts**. All three were removed in
`56f1462` for cause: SSR declared a `tDepth` uniform that nothing bound, so it read 0.0,
`normalize(vec3(0.0))` produced NaN, and NaN blacked out **every pixel** while the HUD
still read 149fps — at **291 draws against a 175 budget**, with SSAO alone re-rendering
the whole scene for +138. Re-adding them as described re-creates that exact failure.

If wet-road reflections are the goal, that is **VGA-002**, and the answer there is
planar/decal work inside the budget — not a screen-space pass. Read `docs/CHARTER.md`
before reinstating anything that was removed.

---

## A. Street reflection & wetness (the founding image)

- **VGA-001 Neon-to-asphalt reflections.** ✅ DONE (VGA batch 1: static merged smears per zone for all signs + lamp heads, dynamic instanced streaks for hero + strobing pursuit, die per zone, day-subtle. Evidence `slice-013-streaks.png` + `slice-013-paintdark.png`.) Signs, lamps, and headlights smear on wet road (planar probe / SSR-lite / stretched sprite decals — implementer's choice, fixed cost). Touches: `src/render/*` + road material. Done when: night frame shows magenta/cyan smears under signs; re-shot angle matches `slice-011-market`. Draws: +2..4.
- **VGA-002 Puddle mirrors.** ✅ DONE (ac8d9f7, slice 024: the water is a real mirror. A basic material samples a city cube the street re-shoots only when the light changes, so puddles carry tower windows and sign wash at the play camera, go pale-sky by day, and die per zone in a blackout. Evidence `slice-024-night.png` + `slice-024-zoom-night.png` + `slice-024-day.png` + `slice-024-blackout.png`. Measured 156 draws steady (+1), 173 peak on the five re-shoot frames. Known limits: one cube for the whole city, so a distant puddle reflects a plausible block rather than its own; drying rings and the formation lifecycle stay with VGA-051.) Draws: +1.
- **VGA-003 Lane paint, done right.** ✅ DONE (VGA batch 1 + play-angle audit 2026-09-17: zebra dies per zone 99→11 so it no longer shines through blackouts; day frame reads as paint at 44. Evidence `slice-013-daypaint.png` + `slice-013-paintdark.png` + `slice-016-audit-day/dark.png`.) Retroreflective paint: bright under direct light, quiet between; zebra stops glowing white-hot by day and stops shining through blackouts. Touches: markings material/merge. Done when: `slice-009-day` + `slice-002-blackout` angles re-shot, paint reads as paint. Draws: +0.
- **VGA-004 Headlight pools with throw.** ✅ DONE (slice 025: every lens lays a trapezoid throw — narrow at the bumper, spreading downroad, hot a few metres out — that rides the heading of the car and stretches with its speed. The heading was the bug: connector traffic used to throw its light across the street it was crossing, because the pool was pinned to the world Z axis. Hero and pursuit cars now ride the same instanced pool set, so three meshes became three instances. Evidence `slice-025-avenue.png` + `slice-025-cross.png` + `slice-025-dark.png`. Measured 156 draws steady, 172 peak — one draw under what the same sweep cost before. Still weak past ~30 m, where a car reads by its glow sprite alone; that distance read belongs to VGA-019/023.) Draws: -1.
- **VGA-005 Wetness response materials.** ✅ DONE (VGA batch 2: wet-grade scalar pass — road/paving/curb/podium/metal/paint roughness down + env up, road darkened. Zero draws. Evidence `slice-014-puddle.png`. Per-material animated wetness values wait on VGA-051.) Per-material 0–1 wetness driving darkening/gloss on asphalt, paving, concrete, metal, car bodies, awnings, cans. Touches: materials lib + all maps. Done when: dry/wet split frame shows the ramp. Draws: +0.
- **VGA-006 Oil-rainbow & joint water.** ⏳ PARTIAL (thin-film iridescence proven in lab `slice-014-rainbow.png`; play-angle audit 2026-09-17: fringe invisible at play distance. Slice 024 then traded the physical puddle material for a basic mirror, so the iridescence term is gone outright — the rainbow has to come back as texture or shader work on the mirror, not as a material flag. Reopen until it reads in the play frame. Full per-slab water simulation waits on VGA-051.) Rainbow sheen in old puddles under neon; pooled water darkening paving joints. Touches: puddle shader, paving. Done when: close-up night frame. Draws: +0..1.

## B. Blackout theater (the signature hack)

- **VGA-007 Blackout honesty.** ✅ DONE (`b406d64`, slice 012; play-angle audit 2026-09-17 `slice-016-audit-dark.png` holds: shop awning 94→15, road 77→37, facade band 57→20, zebra 99→11 — the zone actually dies in the play frame). Fixes: windows blazing, BAR glowing, zebra shining, stray cones. Touches: `street.js` zones, facade/sign/pool materials. Draws: +0.
- **VGA-008 Death & rebirth cascade.** ✅ DONE (`b406d64`, slice 012). Flicker-and-die rolling down the block, staggered per-fixture; relight staggers back. Lamp pop/buzz visual (flash scale + sprite kick). Touches: lamp/sign update fns. Done when: 3-frame sequence (lit → dying → dark). Draws: +0.
- **VGA-009 Hack origin.** ✅ DONE (`b406d64`, slice 012). Pulse leaves the player (or substation flashes first), wavefront rolls down the street; transformer/substation prop with spark burst at the source. Touches: new VFX + one prop mesh. Done when: H-press sequence shows cause → effect. Draws: +2.
- **VGA-010 Reflections die with the lights.** ⏳ PARTIAL (`b406d64`: pools/signs/facades die per zone; slice 024 added the puddle mirrors themselves — reflectivity follows zone glow, so the water goes matte the moment its zone drops, `slice-024-blackout.png`; lightning-as-only-source waits on VGA-051). Mirror street to matte black the instant a zone drops (depends on VGA-001). Lightning becomes the only source during blackout rain. Done when: blackout-in-rain frame with lightning reveal. Draws: +0.

## C. People (the city lives — screen-true)

- **VGA-011 Body system v2.** ⏳ PARTIAL (slice 017 + slice 027. Slice 027 answered the ball-head note: skull and hair cap merge into one head geometry and the cap rides a vertex-colour multiplier, so each walker's own skin tone darkens to hair with no second draw and no second material. Coats got the same squash-and-yoke as the hero, hems narrowed 0.40→0.31, shoes merged into the leg mesh. +0 draws. The 5-silhouette sidewalk close-up is still open. Slice 030 gave every walker the hero's two fixes: coats squashed 1.22→1.02 across (three head-widths of shoulder was most of the pawn read at crowd distance) and the same baked vertical shade, which multiplies against each walker's instance tint so the palette survives. +0 draws, no new material.) Touches: `npcs.js` (+ walkers), sim spawn data. Draws: +1..3 (instanced parts).
- **VGA-012 Fashion & cyberware.** ⏳ PARTIAL (slice 017: instanced hats on ~42%, glowing visors on ~25%, 5 skin tones, widened coat palette — all in sim data and rendering; not yet readable at play distance, close-up proof still open). Draws: +1 (atlas).
 Slice 035 fixed the fidelity mismatch underneath all of this: every surface in the city carried a normal map except the one the player looks at for the entire game. Flat-colour coats next to PBR pavement and PBR walls read as a character from a cheaper game long before any shape problem does. A woven height field differenced into normals, 128x128, built once and shared by the hero and all 72 walkers — +0 draws, one texture.- **VGA-013 Night readability.** ⏳ PARTIAL (slice 017: hero key light +0 draws, coats brightened with env response up, walkers cast shadows by day; head-vs-coat contrast still strong at distance — heads need the VGA-011 close-up pass to fully land). Draws: +1 (hero light).
- **VGA-014 Poses & tableaus.** Sit, lean, smoke (glow tip), gesture, argue, queue, perform — plus staged frozen moments (deal, arrest, busk) at fixed corners. Done when: 3 tableau frames. Draws: +1..2.
- **VGA-015 Rain silhouettes.** Umbrellas (colors/patterns), hoods, hunched runs, shelter clustering, density thinning at peak, wet shoulders, footstep splashes. Depends on VGA-040. Done when: storm-peak vs drizzle frames differ. Draws: +2 (umbrella instancing).
- **VGA-016 Hands carry things.** Phones (hero raised-phone pose + screen glow on face; NPC handsets), courier parcels, vendor goods, instruments for buskers, laptops. Done when: profiler job + carried prop match in one frame. Draws: +1..2.
- **VGA-017 Drivers & foot cops.** Driver silhouette + cabin in every car; uniformed officer NPCs, patrol pairs, corner standing. Done when: chase-cam shows a driver; corner shows patrol. Draws: +1.
- **VGA-018 Crowd density.** ⏳ PARTIAL (slice 019: 60→72 walkers, 14 curb-parked cars riding the same instanced meshes for +0 draws — streets read occupied in `slice-019-street/north.png`; true market/crossing crush + LOD discipline still open). Touches: spawn counts + VGA-011 variety. Draws: 0 (instances), +perf watch.

## D. Cars (photographable traffic)

- **VGA-019 Body variants.** ⏳ PARTIAL (slice 032: a second vehicle mesh costs four draws — paint, glass, trim, wheels — and the street did not need four more models, it needed to stop being one model repeated twenty-six times. The shared body now stretches per instance into five silhouettes: saloon, van, compact, wagon, low coupe. The greenhouse and the glass canopy ride the same numbers, so the roofline changes with the body instead of floating on it, and wheels take the width but never the height, because an ellipse where a tyre should be is worse than no variety. `shape` lives in sim car data beside `paint`, so a car keeps its body for life instead of changing shape when its render slot is reused. Evidence `slice-032-traffic-day.png` + `slice-032-traffic-night.png`. 156 peak, +0 draws. Taxi, bus and bike are still missing, and these are all stretches of one saloon — a genuinely different mesh still belongs here.) Draws: +3..5.
- **VGA-020 Close-up detail.** ⏳ PARTIAL (slice 026: cars had no windows. The painted greenhouse box in `bodyGeo` enclosed the glass canopy on every side and the windshield was painted body colour too, so the whole fleet — traffic, hero, pursuit — rendered as one moulded lump. The greenhouse is now a frame: belt, roof and four pillars in paint, one glass shell holding cabin + raked windshield in the openings. Bumpers, mirrors, pillars, rocker sills and wheel-arch flares moved to a shared dark trim mesh, one instanced draw for all traffic. Evidence `slice-026-street-night.png` + `slice-026-street-day.png` + `slice-026-profile-night.png`. Measured 158 draws steady, 164 peak — +2 over the same sweep before. Slice 029 finished the job the chase camera exposed: the roof overhang hid the backlight from above, so the roof was shortened and a raked rear window added — the view the player holds all game was a slab of paint. The glass was also mirroring `scene.environment` (a PMREM of RoomEnvironment, far brighter than 1.0) into a blank white block at envMapIntensity 2.2; bisected against 0, it now sits at 0.22 and reads as tinted glass. Tyre and rim merged into one vertex-coloured mesh, which also removed a pair of exactly-coincident z-fighting hub cylinders. Evidence `slice-029-drive-night.png`. Wiper arcs, plates, panel gaps and liveries still open.) Done when: hero-car orbit close-up survives. Draws: +2, then -3 reclaimed.
- **VGA-021 Paint that answers neon.** ⏳ PARTIAL (slice 034: the paint was metalness 0.6 at envMapIntensity 1.9, which is not car paint, it is bare metal. Every up-facing panel mirrored the sky, so from the chase camera a parked car was one blown-out white slab with no colour left in it — the worst-reading object in the daylight frame. Car paint is pigment under clearcoat: metalness 0.14, env 1.05, roughness 0.32. The colour survives and there is still enough gloss for sign wash to land. True clearcoat and the maroon-under-magenta check are still open.) Draws: +0.
- **VGA-022 Police build.** Push bar, livery + POLICE lettering, spotlight, alternating red/blue wash thrown on street and facades; wipers on all fleets. Done when: pursuit frame paints the towers red/blue. Draws: +1..2.
- **VGA-023 Light language.** Headlight/taillight/brake behavior on traffic (brakes flare), night bodies catch light (no more ghost cars). Done when: night traffic reads mass + intent. Draws: +0.
- **VGA-024 Cabs & glass.** Cabins, driver figures (VGA-017), windshield wiper motion in rain. Done when: windshield close-up in rain. Draws: +1.

## E. Crash & impact (dent the world)

- **VGA-025 Impact theater.** Debris, glass shards, spark bursts, bumper parts, skid marks, impact decals that persist; damage states on cars (dents/dirt). Done when: post-crash frame shows evidence. Draws: +2..3 (pooled).
- **VGA-026 Camera impact language.** Shake, FOV kick, speed lines — parked and 22 km/h must never read identically again. Done when: drive frame shows speed. Draws: +0.

## F. Streets (furniture, signs of life)

- **VGA-027 Intersections, complete.** ⏳ PARTIAL (city-grid slice: zebra crossings over the z=40 connector at all 3 avenues + west-avenue dashes/edges/manholes + cross-street curbs + live E-W traffic/peds; hackable traffic lights, stop lines, walk boxes, signal poles still open). Traffic lights (hackable — feeds VGA-047), stop lines, ped walk/don't-walk boxes, turn arrows, signal poles. Done when: connector crossing re-shot dressed. Draws: +3..4.
- **VGA-028 Road wear pass.** Patches, cracks, oil stains, drain grates, manholes readable at play distance, lane arrows, bus lanes. Done when: road close-up shows age. Draws: +1 (decal merge).
- **VGA-029 Paving identity.** Downtown concrete/granite replacing old-town cobble; slab joints, grime gradients, tree grates. Done when: `slice-005-east` re-shot reads downtown. Draws: +0.
- **VGA-030 Civic furniture set.** ⏳ PARTIAL (slice 034: the pavement had bollards, grates and two bins for a whole block, which is a model of a street rather than a street. Added parking meters with a lit face along every kerb, bike hoops, stacked timber crates by the back doors, and two-leaf A-boards — plus, on the podium walls themselves, downpipes with hoppers and shoes, and bracketed condenser units above head height. The wall pieces matter as much as the pavement ones: a podium wall with nothing on it is a painted plane at any distance. Everything merges into the curb-clutter mesh that already existed and rides a per-channel vertex tint, so warm timber and cold steel come out of one material — a street of furniture for +0 draws. Evidence `slice-034-pavement-day.png` + `slice-034-street-day.png` + `slice-034-street-night.png`. 153 peak, unchanged. Post boxes, ATMs, shelters, clocks, banners and street-name blades still open. Slice 036 found why the city had its bins and hydrants in identical pairs a metre apart on every corner: both Poly Haven props ship as showcase pairs — a clean copy and an aged copy side by side on X — and instancing the file as one object planted both at every position. Split by which side of the model each material sits on, recentred per variant, and the placements dealt out between them. Same material count, same draws, and now there are two bins in the city instead of one bin twice.) Meters, post boxes, ATMs, shelters, clocks, flags, banners, phone boxes (WD), street-name blades, addresses. Draws: +2..3.
- **VGA-031 Commerce clutter.** Carts, crates, pallets, A-frames, overflowing bins, parked bikes, newsstands, food carts, vending machines (glowing). Done when: shopfront frame spills onto pavement. Draws: +2..3.
- **VGA-032 Paper on walls.** Flyers, posters, protest signs, ramen menus taped to glass, stickers, tags. Touches: decal merge + content file. Done when: wall close-up carries paper. Draws: +1.
- **VGA-033 Grime & litter.** Stains, gum, runoff trails, litter scatter, hydrant-cluster mess. Done when: hero-can frame (`slice-008-beauty` angle) has a dirty neighborhood. Draws: +1.
- **VGA-034 Transit identity.** Subway entrance(s), bus-lane paint, taxi rank, tram/bus wires. Done when: one unmistakable transit moment. Draws: +2..3.
- **VGA-035 Construction site.** Scaffolding, barriers, crane silhouette, half-built floor, work lights. Done when: skyline frame shows something becoming. Draws: +2..3.
- **VGA-036 Pole hardware.** Base cabinets, access panels, banner arms, footings; lamp heads as fixtures, not floating bars. Done when: lamp close-up. Draws: +0..1.
- **VGA-037 Street art set.** Murals, graffiti pieces, gang tags, faction paint (feeds consequence-cascade readability). Touches: decal merge + content file. Done when: alley/pod wall carries art. Draws: +1.

## G. Buildings (architecture with memory)

- **VGA-038 Podium program.** ⏳ PARTIAL (slice 028: every podium was a 4.2m plaster box with one narrow door, and the door faced +Z on every tower regardless of which way the street ran. Podiums now get a dark stone plinth, corner pilasters in podium plaster so the lamps rake them, a sill course and an awning band — all merged into meshes that already existed, +0 draws — and the dressed face is now the one the avenue actually sees. Evidence `slice-028-shopfront-night.png` + `slice-028-street-night.png`. Lobbies with depth, steps and address numbers still open.) Draws: +0.
- **VGA-039 Window system v2.** Per-tower palettes (dark tower, hotel band, office grid), crown lighting, aviation beacons, day/night/dawn states, floor-by-floor change over time. Kills twin-pattern repeat. Done when: two-tower frame shows siblings, not clones. Draws: +1..2.
- **VGA-040 Daylight facade balance.** Shade faces hold detail, sunlit faces stop blowing out (exposure discipline, not more lights). Done when: valley + noon frames hold both sides. Draws: +0.
- **VGA-041 Second/third skins.** ⏳ PARTIAL (slice 023: poured concrete with punched windows is now a real second architecture — `concrete_wall_008` via the new Poly Haven ARM loader, every third tower, per-zone twins so it dies in a blackout like the glass does. Evidence `slice-023-day.png` (matte slabs beside reflective glass), `slice-023-night.png`, `slice-023-blackout.png`. Still two architectures, not three — A and B glass differ only by tint, so this stays open until a third lands.) Two more facade materials so the district isn't one glass. Done when: skyline shows 3+ architectures. Draws: +2.
- **VGA-042 Rooftop furniture.** Water towers, AC farms, antennas, billboards, parapets with craft, gardens. Done when: looking-up frame ends in interest. Draws: +2.
- **VGA-043 Shopfronts that live.** ⏳ PARTIAL (slice 028: the external review's biggest surviving finding. Ground-floor glazing now runs every dressed podium face, split into ~3.6m tenancies with solid piers between and mullions inside each bay, so the block reads as four shops rather than one ribbon of light. Each pane carries a baked interior — bright ceiling strip, graded wash, dark shelving verticals, a figure at the counter — so it is a room, not a lightbox. Warm spill lands on the pavement in front of every bay, riding the existing per-zone pool mesh for +0. The glazing is zoned, so a blackout kills the shops and their spill together: `slice-028-blackout.png`. Evidence `slice-028-shopfront-night.png` + `slice-028-shopfront-day.png` + `slice-028-street-night.png`. Measured 160 draws steady, 166 peak — +2, one glazing mesh per power zone. Moving silhouettes and real interior depth still open. Slice 030 gave the glazing a daylight floor: a tower's windows go dark at noon but a shop's do not, and without it every dressed ground floor read as a black hole punched in a sunlit wall. Still zoned, so a daytime blackout kills it honestly. Slice 031: the giveaway was never one pane, it was twenty identical amber panes in a row — one canvas, one colour temperature, the whole district lit by a single bulb. The interior is now a 256x128 four-cell atlas (grocery, noodle bar, laundromat, boutique), each with its own wash, its own stock — gondola aisles, a counter with a cook and pendant stems, washer drums, mannequins — and its own pavement spill colour. Bays pick a cell by `(blockIndex * 3 + bayIndex) % 4`, so no two neighbours match and no block repeats the one before it. Pure UV offsets into one texture: +0 draws, no new material. Pane floors lifted off black, and the shared trim material went 0x0b0d12 to 0x1b1f27 because an awning at that value is a hole in the frame, not a thing. Evidence `slice-031-shopfront-night.png` + `slice-031-shopfront-day.png` + `slice-031-street-night.png`. 156 peak, unchanged. Slice 036 answered the other half: only the avenue-facing podium face was ever dressed, so from any cross street a building was a four-metre flat plaster slab — a grey void where a frontage should be. Every face now carries the rhythm: three pilasters at the same width and height the dressed face uses, a downpipe with hopper and shoe on each of the four corners, and a bracketed condenser on the back-of-house walls. All merged into the podium and trim meshes that already existed, +0 draws.) Draws: +2.

## H. Signage (excess, layered)

- **VGA-044 Animated & holographic signs.** ⏳ PARTIAL (slice 033: the six setdress shopfronts were flat planes painting a fake shopfront — sign band plus four fake lit windows — hung on a wall that had since grown real glazing with real interiors behind it. A sticker of a shop stuck over an actual shop, at one draw each. Replaced with signage that has depth: a fascia board over the door, and a blade projecting across the pavement so the trade reads side-on from the far end of the block, which is the whole point of a projecting sign and the thing the street was most missing. One 256x200 atlas of three trade bands plus a black strip every non-sign face points at, merged per power zone — six materials became two, and the blackout still takes a zone's trade names out with its lamps (`slice-033-signs-blackout.png`). Evidence `slice-033-signs-night.png` + `slice-033-signs-day.png`. 156 peak to 153 on the same sweep: -3. Flicker, scanlines, chase bulbs and holograms still open.) Draws: +2..4.
- **VGA-045 Sign water & mist behavior.** Sheeting faces, dripping arms, halos fattening in mist (needs VGA-040 storm values). Done when: downpour sign close-up. Draws: +0.

## I. Nature & valley (a place, not a rim)

- **VGA-046 Trees v2.** ⏳ PARTIAL (slice 027: the canopy was three big displaced icosahedra, and a convex green outline at play distance reads as a boulder, not a tree. It is now ten small leaf clumps on an asymmetric shell, so the silhouette has notches; a baked sky-occlusion gradient down the canopy darkens the underside to 0.42; per-instance leaf colour across five greens kills the clone row, and the east avenue turns to four autumn ochres — the seasonal block this item asked for. Trunks lightened 1a1410→2c251c, non-uniform per-tree scale. Evidence `slice-027-trees-day.png` + `slice-027-street-night.png`. 158 draws steady, 164 peak — +0, all three tree meshes stayed instanced. Species count still one, no sway, no backlit translucency.) Draws: +0.
- **VGA-047 Grass v2.** Tufts that read as grass (not scribbles), wind streaks, wet flattening, dirt blend strips at every concrete edge. Done when: bank close-up. Draws: +0..1.
- **VGA-048 Mountains v2.** Strata, snow, transmission towers, foothill blend, tree-line, mist snagging peaks. Done when: promenade vista shows a range, not stamps. Draws: +1.
- **VGA-049 River v2.** Foam lines, rocks, reeds, muddy waterline, rain pitting, faster flow texture in storm; docks, buoys, one boat. Done when: river close-up + vista. Draws: +2..3.
- **VGA-050 Seam extermination.** River↔bank, grass↔concrete, mountain↔grass — every razor boundary gets a blend (dirt, scree, wet edge, overgrowth). Done when: 3 seam close-ups. Draws: +1.

## J. Sky & storm (weather as a system)

- **VGA-051 Storm lifecycle.** Dry state → buildup → drizzle/shower/downpour → clearing → drying, with wind (angle, gusts, sway, spray drift), lightning + facade wash, cloud darkening/movement, post-storm light shift. The foundation VGA-005/015/045/049 stand on. Done when: 4-frame weather sequence, same angle. Draws: +1..2.
- **VGA-052 Living sky.** Clouds (with drifting cloud shadows!), birds, planes, night stars/moon polish. Done when: noon frame has weather overhead; sky timelapse reads alive. Draws: +2..3.
- **VGA-053 Golden & blue hour.** Dawn/dusk grades with long shadows — T stops being binary noon/midnight. Done when: magic-hour frame. Draws: +0.
- **VGA-054 Horizon promise.** ⏳ PARTIAL (city-grid slice: skyline ring + north terminus caps close the avenue vistas + 16 mid-block infill towers fill the inter-avenue voids, all merged +0 draws; second-street AV paths/blimps/ad drones still open). Skyline backdrop ring beyond the rim + second-street sky traffic (AV paths, blimps, ad drones). Done when: vista frames show more city. Draws: +2..3.
- **VGA-055 Valley weather.** Fog banking in downpour, runoff threads, mist in the vale, brown banks. Done when: storm valley frame. Draws: +0..1.

## K. Splashes, drainage & fire (water goes somewhere)

- **VGA-056 Splash system.** Drop crowns + rings on puddles scaled by intensity, micro-mist kick-up, neon sparkle in spray, footstep/tire splashes, hydroplaning walls, car mist trails. Done when: downpour close-ups at boot, tire, and awning height. Draws: +2 (pooled particles).
- **VGA-057 Drainage theater.** Drip lines off every edge, gutter rivers, corner waterfalls, water visibly entering grates, splashback speckle bands, puddle-to-drain threads. Done when: curb-line frame in rain. Draws: +1..2.
- **VGA-058 Steam overhaul.** ⏳ PARTIAL (`b406d64`: eruption-on-zone-death + scale discipline; day-plume readability + rain response still open). Day-readable plumes (no more smoke blobs), pressure bursts as hack gags, rain flattening + cloudburst bursts off hot grates. Done when: noon + gag frames. Draws: +1.
- **VGA-059 Barrel fires.** Fire drums with flicker light + ember particles — warm points for alleys and the market. Done when: night alley frame breathes. Draws: +1..2.

## L. Camera (never lies, always feels)

- **VGA-060 Collision & awareness.** No wall interiors, no traffic pass-throughs, occlusion-aware framing. Done when: re-shot of `slice-011-market` angle contains no black wall. Draws: +0.
- **VGA-061 Speed & impact language.** (With VGA-026.) FOV, shake, lines, road blur states. Done when: drive frames read velocity. Draws: +0.

## M. HUD & information (fiction, not terminal)

- **VGA-062 Real HUD + minimap.** Game UI replacing the debug overlay (dev stats behind a flag): minimap with blips + wanted cones + objective, districts labeled. Done when: screenshot with zero terminal text. Draws: +1..2 (DOM/canvas).
- **VGA-063 Tool identity.** Hack icons with charge/cooldown states (blackout, profile pulse, gags). Done when: H-ready and H-spent read without text. Draws: +0.
- **VGA-064 Profiler dossier v2.** AR styling, income/occupation iconography, waveform signal meter, secret with object anchor. Done when: profile frame looks hacked, not typed. Draws: +0..1.
- **VGA-065 Contract wayfinding.** 3D waypoint, route ribbon, destination glow; payout animation (chips, not arithmetic). Done when: GRID RUN navigates without the panel. Draws: +1..2.
- **VGA-066 Heat/busted screen language.** Edge pulse + desaturation creep with heat; busted with fade/slow-mo weight; scanner-eye/breach tint for cyberware moments. Done when: heat-3 and busted frames feel dangerous. Draws: +0 (post/DOM).

## N. Hero (the back you stare at)

- **VGA-067 The back.** ⏳ PARTIAL (slice 027: the hero was a lathe cone with a bare ball on top — a chess pawn, and it is dead centre of every frame. The coat now squashes to 1.24×0.80 so it is wide across and thin front-to-back, carries a merged shoulder yoke and collar, and the hem narrowed 0.38→0.30. Hair cap merged into the backpack mesh, boots merged into the leg mesh, so both cost nothing and the boots ride the walk cycle. Head squashed off-sphere. Evidence `slice-027-sidewalk-day.png` + `slice-027-street-night.png`. +0 draws. Phone pose, weapon and night rim still open. Slice 030 found the real reason the hero never read as a back: `tickPlayer` kept steering while the player coasted to a stop, and `atan2(0, 0)` is 0 — so releasing the key spun the avatar round to face world +Z, which from the chase camera is straight at the player. Every stationary frame in this repo was a front view of a faceless man. Fixed in sim: steer only while there is input. With the back actually facing the camera the rest landed — shoulders in from 2.9 head-widths to 2.1, the hem under the shoulder line instead of flaring wider than it (that flare was the chess-pawn read), arms outboard of the silhouette so the walk cycle is visible, and the backpack out past the coat with straps and a lid on vertex-shade multipliers. The coat carries a baked vertical gradient — sky on the shoulders, a break at the waist, dark at the hem — so cloth is no longer one flat value. Visor deleted: it was punching through the skull because the 10-segment hair cap sagged inside the 12-segment head, and a glowing bar across a face is a toy tell anyway. Evidence `slice-030-back-day.png` + `slice-030-back-night.png` + `slice-030-street-day.png`. Measured 156 peak against 157 on the same sweep of the previous commit — one draw cheaper.) Draws: +0.

## O. Police & pursuit (the net that closes)

- **VGA-068 Search language.** Vision cones, search rings, patrol scan sweeps, heli + night spotlight cone, police drone quad. Done when: evasion frame shows the machine hunting. Draws: +3..4.
- **VGA-069 Roadblock theater.** (Per slice 013 scope.) Lit barricades, spike strips, alternating wash on facades. Done when: heat-3 frame. Draws: +1..2.

## P. Hacking visuals (conduct the orchestra)

- **VGA-070 Hackable affordances.** Junction boxes, camera housings with tally LEDs, router nodes, glowing weak points, camera-head lamp posts, traffic-light targets, phone boxes as nodes. Done when: pre-hack frame offers instruments. Draws: +2..3.
- **VGA-071 AR layer.** Scan sweep, X-ray outlines, data trails between devices, network graph over the block. Done when: hack frame leaves residue. Draws: +1..2 (post/sprites).
- **VGA-072 Gags with theater.** ⏳ PARTIAL (`b406d64`: steam-burst gag on zone death; bollard pops, roadblock flips, camera-feed view still open). Steam bursts, bollard pops, roadblock flips, camera-feed view on breach. Done when: one gag, three frames. Draws: +1..2.

## Q. Life dressing (places, not geometry)

- **VGA-073 Market density.** Stalls, awnings, tables, hanging signs, bodies, steam — one choked Night-City block. Done when: market frame overflows. Draws: +2..3.
- **VGA-074 Alleys as places.** Walkable gaps, dumpsters with stories, fire escapes, overhead cables, art, barrel fire, paper. Done when: alley frame invites entry. Draws: +2..3.
- **VGA-075 District identity.** ⏳ PARTIAL (city-grid slice: north terminus caps kill the end-of-street black void, mid-block infill gives avenues real blocks; palette/gateway/lamp variants + termini landmarks still open). Connector vs east vs promenade vs park: palettes, gateways, lamp/tree/curb variants, termini landmarks killing the black voids. Done when: 4 frames, 4 moods. Draws: +1..2.
- **VGA-076 Job & secret objects.** Stalls, instruments, parcels, terminals, dead drops, maps — every dossier line gets geometry. Done when: MILO OKAFOR holds his livelihood. Draws: +1..2.
- **VGA-077 Faction paint.** Tags, turf marks, colors, uniforms, livery — cascades leave evidence. Done when: post-action frame shows who answered. Draws: +1.
- **VGA-078 Interiors v1 + verticality.** One enterable shop (shelves, keeper, steam, stools) + first accessible rooftop (stairwell fade, vista, beacon). (Charter: Verticality.) Done when: inside + above frames. Draws: +3..4.
- **VGA-079 Park & promenade, furnished.** Paths, beds, fountain, playground, lighting design; promenade benches, bins, railing craft, lamp pools that land. Done when: day leisure frames. Draws: +2..3.

## R. Grade & post (cinema, not viewport)

- **VGA-080 Filmic identity.** ✅ DONE (slice 029: the post chain was RenderPass → bloom → OutputPass, with no grade at all — the day frame was grey soup, every value crowded round 0.5. A ShaderPass now runs after OutputPass, on display-referred pixels rather than linear HDR: contrast lift, split tone (cool shadows against warm highlights), a quiet vignette heavier at night, and fine animated grain. All four scale on the same nightFactor the rest of the world reads. Evidence `slice-029-street-day.png` + `slice-029-street-night.png` + `slice-029-shopfront-day.png`. +1 draw, one fullscreen quad. Halation and a dedicated DoF still belong to VGA-081.) Draws: +1.
- **VGA-081 Depth & lens.** DoF/bokeh option, lens droplets + runs in rain, highlight fringing, spray blur at speed. Done when: photo framescene. Draws: +1..2.
- **VGA-082 Light discipline.** ⏳ PARTIAL (slice 018 + slice 029. Slice 029 found the hero and the hero car each owned a private contact-shadow plane sitting on top of the instanced blob mesh that was already drawing both — double-darkened ground under a parked car, and two draws for nothing. The shared mesh now holds a permanent slot for each. True occluding soft volumes + bloom-threshold tuning still open). Done when: `slice-003-secret` angle re-shot — no pyramids. Draws: +1.

---

## Coverage — all 186 gaps, mapped

- GTA (36): VGA-062, 019, 020+025, 011, 011, 067, 027, 028, 003, 030+031, 078(Q-v1), 060, 062, 054, 052, 049, 022, 021, 067, 027, 030, 035, 034, 039, 024+017, 017+068, 011+014, 014+074, 032, 030, 025, 031, 042, 029, 075, 060.
- Watch Dogs (23): VGA-008+009, 070, 071, 064, 027+070, 016, 070, 068, 058+072, 008, 001, 068, 007, 009, 007, 067+016, 070, 070, 064, 015, 011, 063, 030.
- Cyberpunk (19): VGA-078(Q-vert), 012, 044, 018, 078, 032+037, 019+022, 054, 066, 073, 046+047, 048, 056+051, 021, 044, 059, 081, 080, 031.
- Repo (45): VGA-062, 001, 060, 011, 008, 038, 039, 040, 049+050, 079, 079, 075, 074, 078, 051, 039, 033, 058, 013, 023, 067, 082(R-ground), 082, 051+081, 046, 030(F-scale), 048, 050, 039, 039, 043+078, 065, 066, 066, 065, 077, 076, 076, 053, 052, 061+026, 082, 036, 004, 046.
- Rain matrix (63): VGA-051 (meta ×6 + atmosphere ×6 + valley-weather), 081 (lens ×2), 005 (surfaces, with 003/004/044/049), 057 (movement ×7), 056 (splashes ×5), 015+C (people ×6), 024+004+056 (traffic ×5), 010 (blackout×rain ×3), 049+055 (valley ×4).
