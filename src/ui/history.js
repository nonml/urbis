// The city's history (M5-15, M5.T32): population, jobs, the jobless, the city's
// money and demand per use over the last five game days. It reads one series —
// the economy's own, one sample a closed game day (sim/economy.js) — and paints
// it on a 2D canvas, so nothing here is a second idea of the sim's numbers
// (law 2) and no WebGL draw is spent on it (law 3).
import { HISTORY_DAYS } from '../sim/economy.js';

// Every series the criterion names, in the order the panel paints them. One row
// of the panel each: money is thousands and demand is 0..1, so a row scales to
// its own series and the small ones stay readable.
export const PANEL_SERIES = [
  { key: 'population', label: 'POP' },
  { key: 'jobs', label: 'JOBS' },
  { key: 'jobless', label: 'JOBLESS' },
  { key: 'money', label: 'MONEY' },
  { key: 'demand', use: 'res', label: 'HOMES' },
  { key: 'demand', use: 'com', label: 'SHOPS' },
  { key: 'demand', use: 'ind', label: 'WORKS' },
];

// The panel's own size, in css pixels, and the room a row needs for its line.
export const PANEL_W = 236;
const PAD = 10, ROW_H = 16, GAP = 4;
const PANEL_H = PAD * 2 + ROW_H * PANEL_SERIES.length;
// Twice the pixels of the css box, so the readout is crisp on a hidpi screen.
const DPR = 2;
const INK = '#e4e1da', DIM = 'rgba(228,225,218,0.30)';
// Left column above the radio subtitles, clear of #hud and the mission panel.
const BOX = [
  'position:fixed', 'left:12px', 'bottom:96px', 'pointer-events:none', 'z-index:4',
  `width:${PANEL_W}px`, `height:${PANEL_H}px`,
  'background:rgba(4,8,16,0.55)', 'border:1px solid rgba(255,255,255,0.16)',
  'border-radius:6px', 'padding:0', 'display:block',
].join(';');

const valueOf = (row, s) => (s.use ? row.demand[s.use] : row[s.key]);
const readout = (row, s) => {
  const v = valueOf(row, s);
  return `${s.label} ${s.use ? v.toFixed(2) : String(Math.round(v))}`;
};

// The panel's one paint: the window the economy holds, one line per series, each
// scaled to its own high and low so a flat series reads as a middle line.
export function paintHistory(ctx, rows) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, PANEL_W, PANEL_H);
  ctx.font = '9px ui-monospace, Menlo, monospace';
  ctx.lineWidth = 1;
  const last = rows[rows.length - 1];
  PANEL_SERIES.forEach((s, i) => {
    const top = PAD + i * ROW_H;
    const values = rows.map((r) => valueOf(r, s));
    const lo = Math.min(...values), hi = Math.max(...values);
    const span = Math.max(hi - lo, 1e-9);
    ctx.strokeStyle = DIM;
    ctx.beginPath();
    values.forEach((v, k) => {
      const x = PAD + (k * (PANEL_W - PAD * 2)) / Math.max(1, values.length - 1);
      const y = top + ROW_H - GAP - ((v - lo) / span) * (ROW_H - GAP * 2);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(readout(last, s), PAD, top + 8);
  });
}

// The panel, mounted on a host DOM node beside the HUD. `frame(economy)` is the
// per-frame call: it paints the series the economy holds, which is the last
// HISTORY_DAYS game days of it.
export function buildHistoryPanel(host) {
  const canvas = document.createElement('canvas');
  canvas.width = PANEL_W * DPR;
  canvas.height = PANEL_H * DPR;
  canvas.style.cssText = BOX;
  host.appendChild(canvas);
  return {
    el: canvas,
    frame(economy) { paintHistory(canvas.getContext('2d'), economy.history.rows); },
  };
}
