// City view's hands and face: the pointer and wheel in the overview, the brush
// palette, and the readout for the lot under the cursor. DOM and input only —
// the state is sim/cityview.js, the camera and outlines render/cityview.js.
import { isDark } from '../sim/street.js';
import { STAGE } from '../sim/zoning.js';
import {
  TOOLS, chooseTool, hoverLot, layDownTool, lotStatus, orbitCityView, paintLot, toolOf,
  zoomCityView,
} from '../sim/cityview.js';
import { paintOf } from '../render/cityview.js';

// Radians of orbit and tilt per pixel of drag, and zoom per wheel unit.
const ORBIT_PER_PX = 0.005;
const TILT_PER_PX = 0.003;
const ZOOM_PER_WHEEL = 0.001;
// A press that travels less than this many pixels is a click, not a drag.
const CLICK_SLOP = 6;

// Use names come from the tools themselves (M5.T1), so the frame stays the one
// place a tool is described. The eraser has no use to name here.
const USE_NAME = Object.fromEntries(
  Object.values(TOOLS).filter((tool) => tool.use).map((tool) => [tool.use, tool.name]),
);
const STAGE_NAME = ['empty lot', 'site', 'low-rise', 'mid-rise', 'tower'];
// What the lot is doing, and the one word of why when there is one.
const STATUS_LINE = {
  growing: '▲ growing',
  declining: '▼ declining',
  stalled: '■ stalled — no power',
  complete: '● complete',
  waiting: '· waiting for demand',
  unzoned: '· unzoned — nothing will be built',
};

const PANEL = [
  'position:fixed', 'left:12px', 'bottom:12px', 'z-index:5', 'display:none',
  'font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace', 'letter-spacing:0.04em',
  'color:#e4e1da', 'background:rgba(4,8,16,0.72)', 'border:1px solid rgba(255,255,255,0.16)',
  'padding:8px 10px', 'border-radius:6px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
  'user-select:none',
].join(';');
const CARD = [
  'position:fixed', 'display:none', 'pointer-events:none', 'z-index:6',
  'font:11px/1.65 ui-monospace,Menlo,monospace', 'letter-spacing:0.05em',
  'color:#e4e1da', 'background:rgba(4,8,16,0.82)', 'border:1px solid rgba(255,255,255,0.16)',
  'padding:6px 10px', 'border-radius:4px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
  'white-space:nowrap',
].join(';');

function swatch(use) {
  return `<span style="display:inline-block;width:9px;height:9px;margin-right:6px;`
    + `background:${paintOf(use)};border-radius:2px"></span>`;
}

// A tool row names what the tool does and what it costs before it is used;
// hovering one says the same in the help line (M5-7's half that lives here).
const PUT_DOWN = 'right click or Esc puts the tool down';

function toolLine(tool, city) {
  return `${tool.name} — ${tool.blurb} · $${tool.cost(city, null)}`;
}

function buildPalette(view, city) {
  const panel = document.createElement('div');
  panel.id = 'cityview';
  panel.style.cssText = PANEL;
  const title = document.createElement('div');
  title.innerHTML = '<b style="color:#fff">CITY VIEW</b> <span style="opacity:0.6">· z · street</span>';
  panel.appendChild(title);
  const rows = Object.values(TOOLS).map((tool) => {
    const row = document.createElement('div');
    row.id = `tool-${tool.id}`;
    row.dataset.tool = tool.id;
    row.dataset.key = tool.key;
    row.dataset.cost = `${tool.cost(city, null)}`;
    row.title = toolLine(tool, city);
    row.style.cssText = 'cursor:pointer;padding:0 8px 0 6px;border-left:3px solid transparent;border-radius:2px';
    row.innerHTML = `<b style="color:#fff">${tool.key.toUpperCase()}</b> &nbsp;${swatch(tool.use)}`
      + `${tool.name} <span style="opacity:0.65">$${tool.cost(city, null)}</span>`;
    row.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      chooseTool(view, tool);
    });
    panel.appendChild(row);
    return { row, tool };
  });
  const help = document.createElement('div');
  help.id = 'toolhelp';
  help.style.cssText = 'margin-top:3px;opacity:0.7;max-width:230px;white-space:normal';
  help.textContent = PUT_DOWN;
  panel.appendChild(help);
  document.body.appendChild(panel);
  return { panel, rows, help };
}

// What the held tool will do to the lot under the cursor, or why it refuses:
// the cost shows before the click, not after it (M5-7).
function toolNote(view, city, at) {
  const tool = toolOf(view);
  if (!tool) return '';
  const why = tool.refuse(city, at);
  if (why) return `<br><span style="color:#e8977d">✕ ${why}</span>`;
  return `<br>◆ ${tool.preview(at).kind} · $${tool.cost(city, at)}`;
}

function readout(view, city, street, index) {
  const p = city.parcels[index];
  const status = lotStatus(view, city, index, isDark(street, p.powerZone));
  const standing = p.stage === STAGE.EMPTY ? 'empty lot' : `${STAGE_NAME[p.stage]} · ${USE_NAME[p.use]}`;
  const line = status === 'clearing'
    ? `◆ clearing${p.zoned ? ` for ${USE_NAME[p.zoned]}` : ' — unzoned'}`
    : STATUS_LINE[status];
  return `${swatch(p.zoned)}<b style="color:#fff">${(USE_NAME[p.zoned] ?? 'unzoned').toUpperCase()}</b>`
    + `<br>${standing}<br>${line}${toolNote(view, city, p)}`;
}

// A press on the canvas in the overview is a click if it barely moves, and a
// drag — orbit sideways, tilt up and down — once it travels. The wheel zooms.
// The right button, or Esc, sets the tool down (M5.T1).
function bindPointer(ui) {
  const { canvas, view, city } = ui;
  window.addEventListener('contextmenu', (e) => {
    if (view.mode !== 'city') return;
    e.preventDefault();
    layDownTool(view);
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (view.mode !== 'city') return;
    if (e.button === 2) {
      layDownTool(view);
      ui.press = null;
      return;
    }
    if (e.button === 0) ui.press = { lastX: e.clientX, lastY: e.clientY, travel: 0 };
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view.mode === 'city') layDownTool(view);
  });
  window.addEventListener('pointermove', (e) => {
    ui.pointer = { x: e.clientX, y: e.clientY };
    const { press } = ui;
    if (!press) return;
    const dx = e.clientX - press.lastX;
    const dy = e.clientY - press.lastY;
    press.travel += Math.hypot(dx, dy);
    press.lastX = e.clientX;
    press.lastY = e.clientY;
    if (press.travel > CLICK_SLOP) orbitCityView(view, -dx * ORBIT_PER_PX, dy * TILT_PER_PX);
  });
  window.addEventListener('pointerup', () => {
    if (ui.press && ui.press.travel <= CLICK_SLOP) paintLot(view, city);
    ui.press = null;
  });
  canvas.addEventListener('wheel', (e) => {
    if (view.mode === 'city') zoomCityView(view, 1 + e.deltaY * ZOOM_PER_WHEEL);
  }, { passive: true });
}

// `cam` is main.js's street rig. While the camera is up the overview owns its
// heading and parks its tilt and dolly, so a drag or a wheel meant for the
// overview does not leave the player's camera somewhere else when it comes
// back down — and it lands facing the way the overview faced.
function holdStreetRig(ui) {
  const { cam, view } = ui;
  if (view.lift === 0) {
    ui.parked = null;
    return;
  }
  ui.parked = ui.parked ?? { pitch: cam.pitch, dist: cam.dist };
  cam.yaw = view.yaw;
  cam.pitch = ui.parked.pitch;
  cam.dist = ui.parked.dist;
}

function hover({ view, pointer, rig, camera }) {
  if (view.mode !== 'city' || view.lift < 1 || !pointer) return hoverLot(view, -1);
  const x = (pointer.x / window.innerWidth) * 2 - 1;
  const y = -(pointer.y / window.innerHeight) * 2 + 1;
  return hoverLot(view, rig.pick(camera, x, y));
}

function showPalette({ view, city, panel, rows, help, hoverTool }) {
  panel.style.display = view.mode === 'city' ? 'block' : 'none';
  const tool = toolOf(view);
  for (const { row, tool: entry } of rows) {
    const on = entry === tool;
    row.style.borderLeftColor = on ? paintOf(entry.use) : 'transparent';
    row.style.background = on ? 'rgba(255,255,255,0.08)' : 'transparent';
  }
  const shown = hoverTool ?? tool;
  help.textContent = shown ? toolLine(shown, city) : PUT_DOWN;
  // The street's own prompts point at things too small to see from up here.
  for (const id of ['profiler', 'prompt']) {
    const el = document.getElementById(id);
    if (el && view.lift > 0) el.style.display = 'none';
  }
}

function showCard({ view, city, street, pointer, card }) {
  if (view.hover < 0 || !pointer) {
    card.style.display = 'none';
    return;
  }
  card.innerHTML = readout(view, city, street, view.hover);
  card.style.display = 'block';
  card.style.left = `${pointer.x + 16}px`;
  card.style.top = `${pointer.y + 16}px`;
}

// Wires the overview's input and HUD. Returns the per-frame update, which runs
// after render/cityview.js has placed the camera.
export function bindCityView({ canvas, cam, camera, city, street, view, rig }) {
  const card = document.createElement('div');
  card.id = 'lotcard';
  card.style.cssText = CARD;
  document.body.appendChild(card);
  const ui = {
    canvas, cam, camera, city, street, view, rig, card, ...buildPalette(view, city),
    pointer: null, press: null, parked: null, hoverTool: null,
  };
  for (const { row, tool } of ui.rows) {
    row.addEventListener('pointerenter', () => { ui.hoverTool = tool; });
    row.addEventListener('pointerleave', () => { ui.hoverTool = null; });
  }
  bindPointer(ui);
  function update() {
    holdStreetRig(ui);
    hover(ui);
    showPalette(ui);
    showCard(ui);
  }
  return { update };
}
