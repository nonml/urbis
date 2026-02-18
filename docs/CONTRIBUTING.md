# Contributing to Dynamic City Builder

Thank you for your interest in contributing! This document describes how to work in this codebase.

## Quick Start

1. Clone the repo
2. Run a local static server (e.g., `npx serve .` or `python3 -m http.server`)
3. Open `http://localhost:8080` in your browser
4. Make changes and submit a PR

## Branch Naming

- **Feature branches:** `feature/your-feature-name`
- **Bug fixes:** `fix/issue-description`
- **Docs:** `docs/what-youre-documenting`
- **Milestone work:** `milestone-a/ticket-number`

Example:
```
git checkout -b feature/city-districts
git checkout -b fix/crash-save-load
git checkout -b docs/adding-components
```

## PR Checklist

Before submitting a PR:

- [ ] Code follows existing conventions (see Coding Style below)
- [ ] No `Math.random()` in gameplay code (use `game.rng` or `rng.next()`)
- [ ] No `Date.now()` in sim logic (only for UI display)
- [ ] Any randomness uses deterministic RNG with seed
- [ ] Tests pass (run smoke test: `node scripts/smoke_test.mjs`)
- [ ] Documentation updated if needed
- [ ] PR title follows convention: `type: description`

## Coding Style

### Files
- **Vanilla JS + ES modules** (no build step, no frameworks)
- **Three.js via ESM CDN** (loaded in `index.html`)
- Each module exports a single class or related functions

### Naming Conventions
- **Classes:** `PascalCase` (e.g., `Game`, `CitizenManager`, `Renderer3D`)
- **Functions:** `camelCase` (e.g., `updateAll`, `isValidPlacement`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `TERRAIN_WATER`, `MAP_PRESETS`)
- **Variables:** `camelCase` (e.g., `currentTile`, `nextId`)

### Module Structure
```js
// src/module_name.js
import { Helper } from './helper.js';

export class ModuleName {
    constructor(game) {
        this.game = game;
        this.items = [];
    }

    update() {
        // Implementation
    }
}
```

### State Management
- All serializable state should be in `GameState` (see ARCHITECTURE.md)
- Systems read/write through `game.state`, not free-floating fields
- No duplicated state across `Game` class and `state`

### Determinism Requirements
- **All randomness must go through RNG:**
  ```js
  // BAD
  const rand = Math.random();

  // GOOD
  const rand = this.game.rng.next();
  const choice = this.game.rng.int(0, 10);
  const pick = this.game.rng.pick(['a', 'b', 'c']);
  ```

- **No Date.now() in sim logic:**
  ```js
  // BAD
  if (Date.now() % 2 === 0) { ... }

  // GOOD
  if (this.game.resources.day % 2 === 0) { ... }
  ```

- **Stable iteration order:** When iterating collections, use stable ID order
  ```js
  // Sort by ID before iteration
  this.citizens.sort((a, b) => a.id - b.id);
  for (const citizen of this.citizens) { ... }
  ```

## Testing

### Automated Smoke Test
Run before committing:
```bash
node scripts/smoke_test.mjs
```

This checks:
- Resources stay non-negative
- No NaNs in citizen stats
- Tile bounds are valid

### Manual Testing
Test each change with:
1. **Small map** (40×40) - quick iteration
2. **City map** (96×96) - typical usage
3. **MEGA map** (256×256) - performance check
4. **Save/Load** - verify state persistence

## Performance Considerations

- **MEGA maps (256×256 = 65,536 tiles)** must stay at 30 FPS
- Use instanced rendering (Three.js `InstancedMesh`)
- Chunk terrain/buildings to avoid full rebuilds
- Profile with F3 overlay enabled

## Questions?

- Check `docs/ARCHITECTURE.md` for system design
- Check `docs/TEST_CHECKLIST.md` for testing procedures
- File an issue if something is unclear