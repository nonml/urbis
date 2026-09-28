// One line naming the lot the player is beside or looking at, what it is doing
// and why (sim/decline.js). Its own element, low on the left: #hud is the
// instrument panel, and this is the street talking. Painted colours on the edge
// — the trend, never a glow.
import { describe } from '../sim/decline.js';

const EDGE = { growing: '#6f9a5c', stalled: '#c49a3c', declining: '#c0513f' };

export function buildLotNote() {
  const el = document.createElement('div');
  el.id = 'lotnote';
  el.style.cssText = [
    'position:fixed', 'left:12px', 'bottom:40px', 'max-width:min(560px, 60vw)', 'display:none',
    'pointer-events:none', 'z-index:5',
    'font:12px/1.6 ui-monospace,Menlo,monospace', 'letter-spacing:0.04em',
    'color:#e4e1da', 'background:rgba(4,8,16,0.62)',
    'border:1px solid rgba(255,255,255,0.14)', 'border-left:3px solid #c49a3c',
    'padding:6px 12px', 'border-radius:4px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

// Writes the DOM only when the line changes; the frame loop calls it every frame.
export function showLotNote(el, parcel) {
  const line = (parcel && describe(parcel)) || '';
  if (line === el.textContent) return;
  el.textContent = line;
  el.style.display = line ? 'block' : 'none';
  if (line) el.style.borderLeftColor = EDGE[parcel.trend];
}
