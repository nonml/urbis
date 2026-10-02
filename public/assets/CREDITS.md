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
