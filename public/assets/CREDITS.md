# Harvested asset credits (`public/assets/`)

Subset vendored 2026-09-16 from [fable-cities](https://github.com/rawprogress/fable-cities)
(MIT code; assets below are public-domain CC0 as listed). Only the maps slice 001 needed
were copied (no preview renders). Each folder keeps its upstream `info.json`.

- ambientCG Asphalt010 — CC0 — https://ambientcg.com/view?id=Asphalt010 — wet road surface
- ambientCG PavingStones070 — CC0 — https://ambientcg.com/view?id=PavingStones070 — sidewalks
- ambientCG Facade001 — CC0 — https://ambientcg.com/view?id=Facade001 — day glass facade
- ambientCG Facade009 — CC0 — https://ambientcg.com/view?id=Facade009 — night facade
  (color + emission maps: lit windows via `emissiveMap`, intensity driven by time of day)
- ambientCG Concrete034 — CC0 — https://ambientcg.com/view?id=Concrete034 — curbs, walls
- ambientCG MetalPlates006 — CC0 — https://ambientcg.com/view?id=MetalPlates006 — props, shutters
- ambientCG Plaster003 — CC0 — https://ambientcg.com/view?id=Plaster003 — tower podiums A
- ambientCG PaintedPlaster017 — CC0 — https://ambientcg.com/view?id=PaintedPlaster017 — tower podiums B
- Poly Haven Concrete Wall 008 — CC0 — https://polyhaven.com/a/concrete_wall_008 — vendored, unwired (needs linear-workflow loader for Diffuse/nor_gl/arm naming)
- Poly Haven Red Brick — CC0 — https://polyhaven.com/a/red_brick — tower facade (VGA-084.2a)
- Poly Haven Yellow Brick — CC0 — https://polyhaven.com/a/yellow_brick — tower facade (VGA-084.2a)
- Poly Haven Sandstone Blocks 08 — CC0 — https://polyhaven.com/a/sandstone_blocks_08 — tower facade (VGA-084.2a)
- Poly Haven Street Lamp 01 / fire hydrant / metal trash can (GLTF, CC0, Josh Dean + authors in per-folder info.json) — vendored under models/, unwired: GLB→instanced pipeline lands in its own slice

Technique mined alongside (from their `AssetLoader.js` + buildings materials):
albedo/emissive maps in sRGB, data maps (normal/rough/metal) linear, RepeatWrapping,
renderer-max anisotropy; night lighting via `emissiveIntensity 0 → up` on lamps/signs/windows.

## Sounds (`public/assets/sounds/`)

The M7-1 sound set (M7.T2), all CC0. `tools/sounds/fetch.sh` downloads each from the
page below and checks its pinned sha256; `--check` verifies the committed bytes.

- `ambience_street.mp3` — Seamless City Loop by qubodup — CC0 — https://freesound.org/people/qubodup/sounds/223093/
- `engine_loop.mp3` — engine_idle_loop_1 by RichieMcMullen — CC0 — https://freesound.org/people/RichieMcMullen/sounds/386793/
- `horn.mp3` — Car Horn Honk by DeVern — CC0 — https://freesound.org/people/DeVern/sounds/349922/
- `crane_site.mp3` — crane load at construction site by bruno.auzet — CC0 — https://freesound.org/people/bruno.auzet/sounds/524579/
- `siren_police.mp3` — Police Siren by TitanKaempfer — CC0 — https://freesound.org/people/TitanKaempfer/sounds/746302/
- `sting_complete.mp3` — You've succeeded (game jingle) by Rolly-SFX — CC0 — https://freesound.org/people/Rolly-SFX/sounds/626259/
- `hum_district.mp3` — Hum Loop by Smice_6 — CC0 — https://freesound.org/people/Smice_6/sounds/536527/
- `traffic_pass.mp3` — TRANSPORTATION CAR PASS BY 01 by sengjinn — CC0 — https://freesound.org/people/sengjinn/sounds/176215/
