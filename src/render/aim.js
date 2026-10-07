// Aim highlight (M6.T2, M6-1): the panel over the thing the sim's aimTarget
// picks — its name and its default hack's cost. Reads sim state, never writes
// it (law 5); DOM only, 0 draws. M6.T3 hands it the frame's target.
import * as THREE from 'three';

const MARK_Y = 1.6;    // the aim point a thing's label hangs from, metres
const MARK_LIFT = 10;  // px above the projected point
const EDGE = 1.05;     // NDC margin before a label counts as off screen

let panel = null;

export function buildAim() {
  panel = document.createElement('div');
  panel.id = 'aim';
  panel.style.cssText = [
    'position:fixed', 'display:none', 'pointer-events:none', 'z-index:5',
    'transform:translate(-50%,-100%)', 'white-space:nowrap',
    'font:11px/1.65 ui-monospace,Menlo,monospace', 'letter-spacing:0.08em',
    'color:#ffe9c7', 'background:rgba(3,10,18,0.82)',
    'border:1px solid rgba(255,177,78,0.55)', 'border-left:3px solid #ffb14e',
    'padding:5px 10px', 'border-radius:4px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
  ].join(';');
  document.body.appendChild(panel);
  return panel;
}

// The exact text the highlight shows: name and cost, never empty.
export function aimLabel(entry) {
  return `${entry.name} · ₡${entry.cost}`;
}

const proj = new THREE.Vector3();
// Where the label pins in CSS pixels for a w × h viewport, and whether the
// point is in front of the camera. Pure: the Node check drives this (M6.T2).
export function aimScreen(camera, entry, w, h) {
  proj.set(entry.x, entry.y ?? MARK_Y, entry.z).project(camera);
  const onScreen = proj.z <= 1 && Math.abs(proj.x) <= EDGE && Math.abs(proj.y) <= EDGE;
  return { x: (proj.x * 0.5 + 0.5) * w, y: (-proj.y * 0.5 + 0.5) * h - MARK_LIFT, onScreen };
}

// Pin the label to the frame's target ({ entry, dist }, or null); returns the
// readout the HUD can pass on, null when hidden.
export function updateAim(camera, target, w = window.innerWidth, h = window.innerHeight) {
  if (!panel) return null;
  const s = target && aimScreen(camera, target.entry, w, h);
  if (!s || !s.onScreen) { panel.style.display = 'none'; return null; }
  panel.textContent = aimLabel(target.entry);
  panel.style.left = `${s.x}px`;
  panel.style.top = `${s.y}px`;
  panel.style.display = 'block';
  return { name: target.entry.name, cost: target.entry.cost, dist: +target.dist.toFixed(1) };
}
