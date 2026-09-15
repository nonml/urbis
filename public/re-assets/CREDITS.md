# Harvested asset credits (`public/re-assets/`)

Subset vendored 2026-09-16 from [fable-cities](https://github.com/rawprogress/fable-cities)
(MIT code; assets below are public-domain CC0 as listed). Only the maps re-001 needs
were copied (no preview renders). Each folder keeps its upstream `info.json`.

- ambientCG Asphalt010 — CC0 — https://ambientcg.com/view?id=Asphalt010 — wet road surface
- ambientCG PavingStones070 — CC0 — https://ambientcg.com/view?id=PavingStones070 — sidewalks
- ambientCG Facade001 — CC0 — https://ambientcg.com/view?id=Facade001 — day glass facade
- ambientCG Facade009 — CC0 — https://ambientcg.com/view?id=Facade009 — night facade
  (color + emission maps: lit windows via `emissiveMap`, intensity driven by time of day)
- ambientCG Concrete034 — CC0 — https://ambientcg.com/view?id=Concrete034 — curbs, walls
- ambientCG MetalPlates006 — CC0 — https://ambientcg.com/view?id=MetalPlates006 — props, shutters

Technique mined alongside (from their `AssetLoader.js` + buildings materials):
albedo/emissive maps in sRGB, data maps (normal/rough/metal) linear, RepeatWrapping,
renderer-max anisotropy; night lighting via `emissiveIntensity 0 → up` on lamps/signs/windows.
