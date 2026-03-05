# City Builder (3rd‑Person Prototype)

This is a lightweight **third-person city-builder** prototype with:

- **Seeded procedural maps** (repeatable runs)
- **Small → Mega** map sizes (40×40, 96×96, 256×256)
- **Citizen simulation** (jobs, happiness, births/deaths)
- **Dynamic crisis events** with player choices
- **3D instanced rendering** for performance on large maps

## Run

Because this uses ES modules + dynamic imports, run it via a local web server (not `file://`).

### Recommended (most reliable): Vite dev server

This path installs **Three.js locally** (no CDN required) and avoids firewall/adblock issues.

```bash
npm install
npm run dev
```

Then open the URL printed in your terminal (usually `http://localhost:5173`).

### Alternative: simple static server (may require CDN access)

If you don't want Vite, you can serve the directory directly. In this mode the game will try:
1) local `three` (will fail without a bundler), then
2) CDN fallbacks (unpkg/jsdelivr/cdnjs).

**Prerequisites**: Node.js or Python 3.x, and a modern WebGL-capable browser.

Example (Node.js):

```bash
npx serve .
# or
npm install -g serve && serve .
```

Example (Python):

```bash
python -m http.server 8000
# or for a custom port:
python -m http.server 9000
```

Then open `http://localhost:8000/index.html` (or `http://localhost:9000/index.html` for the custom port).

> **Note**: Opening the file directly via `file://` fails because ES modules enforce CORS policies that block local file access. Also, ensure you are using a modern browser as ES Modules are not fully supported in legacy environments.

### Expected Behavior

Upon successful launch, your browser should display a 3D viewport with a procedurally generated map. Use **WASD** to move the camera and **Left Click** to interact with tiles.

## Controls

- **WASD**: move
- **Shift**: sprint
- **Right mouse drag**: rotate camera
- **Left click**: build / inspect tile
- **P**: pause
- **Ctrl+S**: save
- **Ctrl+L**: load

## Notes

- Three.js loads via **local dependency** when using Vite; otherwise it falls back to CDNs.
- Crises are deterministic under the same seed (for a given play pattern).
