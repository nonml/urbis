# Assets — where art, audio and models come from

The bottleneck on this game is not rendering. It is **authoring**: the open visual-gap
items call for 60–100 distinct street props, a radio, dispatch chatter and a full SFX bed,
and none of that exists yet.

This document is the strategy for producing them. It is a ladder — **always take the
cheapest rung that works.**

---

## Rung 1 — CC0 libraries (take these first)

Free, high quality, immediately usable, no GPU time, no licence risk.

| Source | What it's good for |
|---|---|
| [ambientCG](https://ambientcg.com) | PBR material sets. Everything in `public/assets/` today |
| [Poly Haven](https://polyhaven.com) | HDRIs, models, materials. All CC0 |
| [Kenney](https://kenney.nl) | Low-poly prop and vehicle kits, CC0 |
| [fable-cities](https://github.com/rawprogress/fable-cities) | A **curated, in-engine-proven** subset of the above — same Three.js conventions, already known to load correctly here |

`fable-cities` is where the current texture set came from (harvest log in
`docs/CHARTER.md`). It is worth re-visiting before generating anything: its assets
are CC0, its loader conventions match ours, and it carries ~160 MB of textures of which
we took 18 MB. **Harvest more; do not fork it.** It is a god-view city painter with no
player, combat or hacking — the wrong genre, and 873 draws for terrain and vegetation alone.

Record every addition in `public/assets/CREDITS.md` with its licence and URL. No exceptions.

### Already harvested and still unused

Audited 2026-09-17. Most of the harvest **is** wired. Note that `loadPBRMaps(texLoader,
maxAniso, '<dir>', ...)` builds paths from a directory argument, so grepping for literal
`assets/...` strings undercounts badly — do not audit that way. Wired today: asphalt,
paving_slabs and concrete in `buildGround()`; plaster_rough and plaster_painted as tower
podiums A and B; both facade glass sets.

Two items are genuinely unused (`metalplates006` was wired onto shop canopies in slice 022):

| Unused asset | Size | What it could answer |
|---|---|---|
| `models/street_lamp_01/` | 2.1 MB | **VGA-036** "lamp heads as fixtures, not floating bars". Not a texture swap: `buildLamps()` returns `heads` and `poolsByZone`, both load-bearing for the blackout cascade |
| `concrete_wall_008/` | 2.0 MB | A second wall material. Blocked on a loader gap: Poly Haven ships `Diffuse`/`nor_gl`/`arm` (packed occlusion-roughness-metalness) and `loadPBRMaps` expects ambientCG's separate maps |

**VGA-041** ("two more facade materials so the district isn't one glass") is still open,
but it needs *new* textures — the plaster sets are already spoken for by the podiums.
Harvest for it rather than assuming something spare is lying around.

---

## Rung 2 — Local generation

For what the libraries genuinely do not have: game-specific props, the radio, NPC voices.

Everything below runs **locally, offline, on permissively-licensed models**. This matters
for a game that intends to ship — see `steam_appid.txt`.

### The toolchain

[pwilkin](https://github.com/pwilkin) ported the key models to GGML/C++, which removes the
Python dependency hell and the giant-VRAM requirement. All three ship CUDA + Vulkan + ROCm.

| Tool | Does | Feeds |
|---|---|---|
| [trellis.cpp](https://github.com/pwilkin/trellis.cpp) | Trellis.2 image→3D + background removal | Props: civic furniture, commerce clutter, rooftop units, market stalls, job objects |
| [AceStep.cpp](https://github.com/pwilkin/AceStep.cpp) | Music generation | The 3-channel radio |
| [OpenMOSS](https://github.com/pwilkin/openmoss) | TTS with voice cloning | Police dispatch chatter, NPC barks, profiler dossier voices |
| [thinksound.cpp](https://github.com/pwilkin/thinksound.cpp) | SFX generation | Rain, sparks, transformer collapse, crashes, footsteps |
| [Lemonade](https://github.com/lemonade-sdk/lemonade/issues/2529) | Bundles the above, cascades text→image→3D in one call | Convenience layer over all of it |

For **hard-surface and parametric** geometry — AC farms, scaffolding, barriers, signage
housings — an LLM writing Blender Python often beats image→3D outright: clean topology
instead of decimated soup, editable afterwards because it *is* code, and near-zero VRAM.

Setup ([source](https://projects.blender.org/lab/blender_mcp)):

```bash
git clone https://projects.blender.org/lab/blender_mcp
cd blender_mcp
uv --directory ./mcp/ pip uninstall mcp
uv --directory ./mcp/ add mcp==1.29.1          # v2 breaks the server
uv --directory ./mcp/ run blender-mcp --transport http --port 9191
```

Then `llama-server --ui-mcp-proxy`, add `http://127.0.0.1:9191` as an MCP server in the
webui, and install `addon/blender_mcp_addon` in Blender (System → allow online access;
keep the addon on its default port 9876).

### Hardware

This machine has **2× RTX 3060 12 GB and 128 GB RAM**. That runs the GGML tools above
comfortably. It does **not** run [asset-studio](https://github.com/zorrobyte/asset-studio),
the other well-known pipeline, which states an RTX 5090 32 GB as mandatory — its
architecture is worth reading, but do not try to install it here.

None of the toolchain is currently installed. Nothing in `npm run gate` depends on it,
and nothing should: **generation is an offline authoring step, never a build step.**
Generated output is committed as ordinary asset files.

---

## Rules for generated assets

These are not suggestions. A generated asset that breaks one does not land.

1. **Never generate signage or lettering.** The models cannot spell — you get garbled
   glyphs. Signs are data (`src/content/signs.json`) rendered as text. This is also why
   sign content stays editable and localisable.
2. **Never generate NPCs or the hero.** Generated meshes have decimated topology, no rig
   and no animation-friendly edge flow. The body system (VGA-011) is hand-built.
3. **One object, plain background.** The matting step fails on scenes, pairs, or objects
   sitting on a base plate.
4. **Instanceable or it doesn't ship.** Single material where possible, so
   `loadPropInstances()` gives **one draw per material at any count**. A prop that costs
   a draw per instance breaks law 3 and will be rejected.
5. **Budget the triangles, but know it's not the constraint.** Draws are. A 6k-triangle
   prop instanced 40 times is fine; 40 separate meshes are not.
6. **Metres, Y-up, origin at the base.** Matches the existing GLB props.
7. **Credit it.** Even self-generated assets get a `CREDITS.md` line naming the model and
   its licence, because the *model's* licence flows through to the output.
8. **It still has to survive a screenshot.** Law 1 does not exempt generated content.
   An asset that looks wrong at the play camera is not done, however cheap it was to make.

The real risk of bulk generation is not quality per asset — it is **coherence**. Eighty
props from a generator can read as eighty different games. Our look is carried by light,
not by prop detail, which helps; but every batch needs a play-camera frame before it lands.

---

## Order of attack

1. Re-harvest for **VGA-041** (two more facade materials) — the highest-value gap that
   needs only a download.
2. Teach `loadPBRMaps` the Poly Haven ARM layout, which unlocks `concrete_wall_008`
   and the rest of that library.
3. Stand up `trellis.cpp` + Blender for the props that genuinely don't exist —
   VGA-030 civic furniture, VGA-031 commerce clutter, VGA-042 rooftop furniture,
   VGA-073 market density, VGA-076 job objects.
4. Audio last, with the Arc + Radio slice — there is no audio system in the game yet, so
   generating audio before there is anything to play it would be dead tech (law 6).
