# City Builder (3rd‑Person Prototype)

This is a lightweight **third-person city-builder** prototype with:

- **Seeded procedural maps** (repeatable runs)
- **Small → Mega** map sizes (40×40, 96×96, 256×256)
- **Citizen simulation** (jobs, happiness, births/deaths)
- **Dynamic crisis events** with player choices
- **3D instanced rendering** for performance on large maps

## Run

Because this uses ES modules, serve it via a local web server (not `file://`).

Example (Python):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

- **WASD**: move
- **Shift**: sprint
- **Right mouse drag**: rotate camera
- **Left click**: build / inspect tile
- **P**: pause
- **Ctrl+S**: save
- **Ctrl+L**: load

## Notes

- Three.js is loaded from an ESM CDN.
- Crises are deterministic under the same seed (for a given play pattern).
