# Skyline Design System

The game's visual identity. **Not cyberpunk.** Think *Cities: Skylines* — a clean,
modern, professional city-management sim with its own calm identity: slate panels,
a friendly sky-blue accent, natural greens, soft neutral shadows, and a clean
humanist sans-serif. No neon glows. No near-black voids. No sci-fi display fonts.

This file is the **single source of truth** for color, type, and shape. Every UI
surface, the minimap, and the world lighting should align to it.

---

## Fonts (system fonts only — no new dependencies)

```
--font-display: 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', sans-serif;
--font-body:    'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', sans-serif;
--font-mono:    'Consolas', ui-monospace, 'SF Mono', monospace;   /* data/code readouts only */
```

Drop `Orbitron`, `Rajdhani`, `Share Tech Mono` everywhere.

## Color palette

Accent (primary action / highlight / selection) — replaces neon cyan:
```
--accent:        #2f9be0;   --accent-light: #5bb5ee;   --accent-dark: #1f7ab8;
```
Semantic:
```
--success: #57b894;   /* sage green   (was neon green)   */
--warning: #e0a13a;   /* warm amber   (was neon amber)   */
--danger:  #df5a5a;   /* soft red     (was neon red)     */
--info:    #4a86c8;   /* muted blue                       */
--special: #b06fc4;   /* muted purple (was neon magenta) */
```
Backgrounds — neutral slate, NOT cyan-tinted near-black:
```
--bg-void:         #11151c;
--bg-panel:        rgba(24, 30, 40, 0.92);
--bg-panel-solid:  #1a212c;
--bg-panel-hover:  rgba(32, 40, 52, 0.95);
--bg-glass:        rgba(255, 255, 255, 0.04);
--bg-glass-hover:  rgba(255, 255, 255, 0.08);
```
Borders — subtle, neutral, NO neon glow:
```
--border:        rgba(255, 255, 255, 0.10);
--border-bright: rgba(255, 255, 255, 0.22);
```
Shadows — soft neutral drop shadows replace glows:
```
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.25);
--shadow-soft: 0 4px 16px rgba(0, 0, 0, 0.30);
--shadow-pop:  0 8px 28px rgba(0, 0, 0, 0.40);
```
Text:
```
--text:        #e6ebf0;
--text-dim:    #9aa6b2;
--text-faint:  #6b7682;
--text-bright: #ffffff;
--text-accent: #5bb5ee;
```
Shape:
```
--radius:    6px;
--radius-lg: 10px;
--panel-blur: blur(12px);
```

### Back-compat
The legacy `--neon-*` variable NAMES may stay (lots of code references them), but
their VALUES must be remapped to the palette above (e.g. `--neon-cyan: #2f9be0`,
`--neon-green: #57b894`). Prefer the new semantic names for any new code.

---

## Minimap (canvas-drawn)
Clean cartographic look, like a real city map — readable at a glance:
- Water: `#a9c6dd` · Land/grass: `#c9d3c0` · Roads: `#8d96a2`
- Zones: residential `#8fc7a0`, commercial `#7fb0d8`, industrial `#e0bd7a`
- Player marker: `--accent` (#2f9be0); viewport rectangle: thin `--text-bright` outline
- Soft rounded frame using `--radius-lg`, `--shadow-soft`, `--border`. No neon ring.

## World lighting (day/night presets)
Three times of day must read as three different moods:
- **Day:** bright, natural. Clear sky ~`#8fbce4`, high ambient + sun, neutral tint.
- **Dawn/Dusk:** warm orange-pink tint, low warm sun.
- **Night:** genuinely DARK. Deep-navy sky ~`#0a1222`, LOW ambient/sun intensity so
  the ground is dim, cool blue tint, window/streetlight emission visible.
