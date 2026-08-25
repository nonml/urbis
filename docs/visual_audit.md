# Visual Audit — Ground-Up Overhaul Baseline (2026-08-26)

> Source: manual code read + `screenshots/q11d_*.png` + `tests/playwright/baselines/*.png` + `tools/agent/baselines/perf.json`.
> This is the Phase 0 baseline for the ground-up pass. All grades are vs. the "clearly better than 0.8.0.0" bar in `CHECKLIST_2Y.md` Q9/Q10 DoD.

## Verdict

Q9/Q10 are ticked on paper, operator approvals `q9.json/q10.json` are still `[ ]` — correctly, because depth is shallow.
The framebuffer looks 2019, not 2026: flat terrain, coarse facade atlas, fake SSR/volumetrics, unstable shadows, no true LUT, identity split.

Screenshots `q11d_buildings.png / q11d_vehicles.png / q11d_closeup.png` (2026-08-11, post-instancing) are the base lit scene. They show the fix in progress: `freq 1.25` makes bricks resolve vs. prior `freq 3` washout, neutral slate roof, darker mortar. Closeup still reads slightly flat — box-projection itself needs hardening, not just frequency.

---

## 1. Ground Truth — What's Actually Rendering

### Terrain
- `src/renderer3d.js:827` `TERRAIN_TEXTURE_MAP` returns `{}` — all terrain is vertex-color `TERRAIN_COLORS` flat tiles (`#66cdaa/#4da6ff` `src/constants.js:31`). `public/assets/textures/terrain/` 6 MB JPEG/PNG exist but are unused, uncompressed, no KTX2.
- `visibleGround` `src/renderer3d.js:412` is a single `MeshStandardMaterial #3d5c3a` plane at `y=-0.3` — the only textured ground.
- Elevation `_baseElevation:2891` is rolling hills hash noise `amp 1.75` — correct, but shading is just vertex color, no slope tint, no cliff material.

### Buildings / Facades
- 45 types in `MODEL_MAP:690` map to Kenney `building-type-{a-u} + building-skyscraper-{a-e}`; many extended types reuse same GLB (`hotel→skyscraper-a`, `restaurant→type-f`) — repetition visible.
- Facade atlas `src/renderer3d.js:3420` `FACADE_ATLAS_GRID=4` 1024 canvas, 16 tiles (brick/concrete/glass/wood/stone…), box-projected UVs `freq 1.25` `src/renderer3d.js:3318`. Light base near-white so `instanceColor` tint reads — correct direction, but still canvas-procedural, not PBR (albedo/normal/roughness).
- Window glow `_getWindowTexture:3381` additive `CanvasTexture 128×256` 78% lit, `opacity 0.55` on `InstancedMesh` planes — reads at night, but is `MeshBasic` (exempted in `scripts/audit_materials.mjs:43`).
- Per-building scale jitter `src/renderer3d.js:2963` `0.90-1.10 × 0.82-1.37` — helps break stamping, but roofs are still flat boxes.

### Roads / Props / Vegetation
- Road models `ROAD_MODEL_MAP:638` 5 variants at `scale 0.5`, bright markings dimmed `lum>0.60*0.38` `src/renderer3d.js:955`. Still per-variant `InstancedMesh/chunk`, not `BatchedMesh`; kerb/lane definition weak (Gemini critique noted).
- Props `PROP_MODEL_MAP:647` `scale 0.45` — street lights ~40 ft per Gemini, `headH` clamp `src/renderer3d.js:2087` is fragile.
- Vegetation 3 models at `scale 1.4` — wind sway `q10-vg-tree-wind` exists but is single-axis, no trunk bend.

### Water
- Water `src/renderer3d.js:1628` `MeshPhysicalMaterial` `color #3aa0e0` `opacity 0.5` with 4-wave vertex displacement + caustics + shore foam (good). `Reflector` planar mirror `src/renderer3d.js:1767` `512×512` at `WATER_SURFACE_Y -0.18` + translucent wave `WATER_PLANE_Y -0.16` — correct layering, but `Reflector` re-renders full scene per frame (costly, off on low `planarReflections: false`).
- Boats `_buildAmbientBoats:1806` deterministic 1-2 hulls with `V-wake` shader — cosmetic only, not sim.

### Lighting / Sky / Shadows
- Lights `src/renderer3d.js:222` `HemisphereLight #b8e4ff/#6aaa60 1.1` + `AmbientLight #fff8f0 0.55` + 3-cascade CSM `src/renderer3d.js:475` `[1-25/1024, 25-75/512, 75-150/256]` `PCF radius 2`. **Bug:** `_updateCSM:515` follows `camera+sunDir` with no texel snapping → shadow swim. `q9-csm-stable-cascades` ticked but not implemented.
- Sky: always-on gradient dome `src/renderer3d.js:439` `top #2c6bb0 → horizon #bcd8ea exp 0.7` (`BackSide` sphere 480) + Preetham `Sky` `src/renderer3d.js:1446` `turbidity 3.2/rayleigh 2.6` street-only (`visible = cameraMode !== 'god'`). At night `sky.visible=false` relies on dome alone — dome does not shift to navy, so night sky is muted not deep.
- HDR `src/renderer3d.js:208` `ACESFilmic + SRGBColorSpace + HalfFloatType` correct, exposure `1.3` static, day `0.20/0.75 → night 0.55/0.40` bloom lerp exists but no per-scene target from `src/sim/day_night.js`.

### Post-Processing (in `_initPostProcessing:1071`)
- `EffectComposer` `HalfFloatType` + `RenderPass` — HDR correct.
- `SSAOPass half-res kernel 4` fallback, `GTAOPass full samples 16` at high+ — mutually exclusive via `applyPreset:123`, never doubled.
- Volumetric `src/renderer3d.js:1136` half-res `godRays() = noise2d(uv*4) * exp(-dist*1.5)` — 2D screen-space, not frustum march. Street cones `dot(col.rgb)` brightness heuristic.
- SSR `src/renderer3d.js:1242` stochastic `maxTrace 128 stepSize 0.02`, depth-derived normal `dR-dL`, fallback `mix(sky 0.1,0.12,0.15)` — noisy smear, disabled on Performance (where most players live).
- Bloom `UnrealBloomPass 0.25/0.4/0.75` + vignette `0.35/0.85, sat 1.08, contrast 1.05` + FXAA fallback `enabled=!taa` + TAA `Halton 8` clamp-only (no motion vectors) + star shader — all present but thresholds/bloom were day-tuned, night under-blooms.

### Materials Audit
- `scripts/audit_materials.mjs:17` flags `MeshBasic/Lambert/Phong`. All surface is PBR, exemptions in `CI_EXEMPTIONS:38` are true (invisible ground, FX, decals, god overlays, window glow) — pass is green; lod `MeshLambert` in `lod_system.js:25` was the earlier false positive, now instanced proxy uses `Standard`.
- No `three` in `src/sim/` — boundary holds.

### UI
- `src/style.css:8` Skyline theme: neutral slate `rgba(24,30,40,0.92)`, muted neon remap `#2f9be0/#57b894`, `Segoe UI`, `blur 12px`, `radius 6/10`. Clean, but `index.html:6` still `NEON CITY // Hack.Build.Rule.` + `glitch-text` + `crt-scanlines` (menu-only `dark_theme.css:35`). `hack_network.js` colors `#f44336/#9c27b0` still neon-cyber. `DESIGN_SYSTEM.md:1` says "Not cyberpunk" vs. `CLAUDE.md:8` says cyberpunk — split is real.

### Perf
- `tools/agent/baselines/perf.json:6` headless `low 38fps 25ms / medium-high-ultra 60fps 16.5ms` — clamped to tick, not GPU. No per-pass timings yet (`Q11.G q11-pb-per-pass-timings [ ]`), no `≤2000/3000 draws` gate, no DRS/VRS.

---

## 2. What's Wrong — Prioritized

| # | Symptom | Root | Impact on "looks terrible" |
|---|---------|------|---------------------------|
| 1 | Flat board | Terrain is vertex-color tiles, no albedo/normal/roughness | Highest — every pixel of ground |
| 2 | Screen-space depth reads fake | SSR/volumetrics are 2D hacks, shadows swim | Medium-high — motion reveals it |
| 3 | Washed facades at distance | Canvas atlas coarse, single box-projection freq | Medium — city silhouette |
| 4 | Night is not night | Night sky stays pale dome, bloom threshold too high | Medium — breaks time-of-day promise |
| 5 | Monolith | `renderer3d.js 348KB/7566 lines`, implicit `renderTarget` mutations, no graph | Blocks safe iteration (Q11.E) |
| 6 | No compressed pipeline | 6 MB PNG normals, `vite.config.js` no `manualChunks`, bundle >2 MB gz target | Perf headroom for detail |
| 7 | Identity clash | Skyline HUD vs Neon HTML/HUD | Coherence |

---

## 3. Decision — Hybrid Identity (Owner: Renderer)

**Chosen: C — Municipal by day / Cyberpunk by night.**

- Day (07-18): Skyline clean — slate panels, `LIGHTING_PRESETS.DAY sky #8fbce4 fog #bdd4f0 sat 1.0 bright 1.0`, dome zenith bright, bloom threshold high `0.75`, SSR subtle.
- Night (20-05): Neon city — dome shifts to deep navy `#0a1222`, `LIGHTING_PRESETS.NIGHT fog #070d18 ambient 0.05 bright 0.3 sat 0.7`, bloom threshold low `0.40 strength 0.55`, window glow `0.55→0.85`, street-light pools + wet SSR + volumetric haze. Hack affordances (camera feeds, profiler) stay cyan/magenta — they are the neon that belongs at night.
- Dawn/dusk: interpolated `tintStrength 0.28-0.32, sat 1.1-1.15` — the two palettes meet without a snap.

Rationale: keeps `DESIGN_SYSTEM.md` truth for UI, restores `CLAUDE.md` soul for world, fulfills `Q10 DoD` "one block at noon/rain/night looks like three places" and `Q10.H` per-district tints (`DISTRICT_GI_TINT:2859`).

---

## 4. Ground-Up Plan — 7 Phases (dependency order)

See master plan in conversation — summarized here for record:

0. **Foundation & Audit** — this document, freeze baselines.
1. **Render Graph & Split** — `src/render/graph/render_graph.js` explicit DAG + `csm.js / sky.js / env_probe.js`, per-pass GPU timers → `q11-pb-per-pass-timings`, close `Q11.E`.
2. **Material & Texture Pipeline** — KTX2/Basis + Draco in `src/workers/asset_decoder.js`, re-enable `TERRAIN_TEXTURE_MAP` as KTX2, box-parallax windows, decal `DataArrayTexture` `q11-tx-array-decals`.
3. **Lighting/Atmosphere** — stable CSM texel snap + PCSS, G-buffer SSR + Reflector hybrid, frustum raymarched volumetrics, true 3D LUT + `q9-hdr-exposure-target`, sky sun/moon disc + lightning exposure.
4. **Geometry/Streaming** — `BatchedMesh`, kerb/lane, cliff triplanar, Hi-Z wired, draw budgets `≤2000/3000` CI.
5. **Perf/Memory** — DRS/VRS, workers (`Q12.A`), chunk LRU+prefetch, bundle `manualChunks` → `q12-bd-initial-2mb`, GC audits.
6. **Identity & HUD Unification** — re-author `style.css / dark_theme.css / theme.js / DESIGN_SYSTEM.md`, capture `street-noon/night/rain/interior-shop + 4 district TOD` re-baselines, reopen `q9.json/q10.json/q11.json` for operator.

Each phase ends with Playwright `street-noon/night/rain/interior-shop` re-capture + `perf.json` check `≤15% High regression, 0% Performance`.

---

## 5. Phase 0 Exit Criteria

- [x] This document committed.
- [ ] `screenshots/q11d_*.png` and `tests/playwright/baselines/*.png` hashed as baseline in `tools/agent/baselines/`.
- [ ] `npm run gate` green on current `main` (beebb07) before Phase 1 cut — baseline for regression.

Next: Phase 1 graph scaffold + stable CSM (texel-snapped cascades) + `vite manualChunks`.
