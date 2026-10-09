// City view's hands and face: the pointer and wheel in the overview, the brush
// palette, and the readout for the lot under the cursor. DOM and input only —
// the state is sim/cityview.js, the camera and outlines render/cityview.js.
import { isDark } from '../sim/street.js';
import { PROBLEM, describe } from '../sim/decline.js';
import { STAGE } from '../sim/zoning.js';
import { TAX_MAX, budgetReport, raiseTax } from '../sim/budget.js';
import {
  TOOLS, affordTool, chooseTool, confirmRoad, dismissRoad, hoverLot, hoverPick, layDownTool,
  lotStatus, moveRoad, orbitCityView, paintLot, pressRoad, releaseRoad, roadPreview,
  toolOf, zoomCityView,
} from '../sim/cityview.js';
import { paintOf } from '../render/cityview.js';
import { buildProblems } from '../render/problems.js';

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
// The road ask (M5.T5), in the page: the browser's confirm is never used.
const ASK = [
  'position:fixed', 'left:50%', 'top:46%', 'transform:translate(-50%,-50%)', 'z-index:7',
  'display:none', 'text-align:center', 'font:12px/1.7 ui-monospace,Menlo,monospace',
  'color:#e4e1da', 'background:rgba(4,8,16,0.94)', 'border:1px solid rgba(208,86,63,0.6)',
  'padding:12px 16px', 'border-radius:6px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
].join(';');

function swatch(use) {
  return `<span style="display:inline-block;width:9px;height:9px;margin-right:6px;`
    + `background:${paintOf(use)};border-radius:2px"></span>`;
}

// Demand bars (M5.T27): three rows — res, com, ind — for the district under the
// cursor, straight off the economy's own demand (sim/economy.js). With no
// district under it the strip reads the city's mean, named CITY. Each row keeps
// the raw value on `data-demand` so the acceptance check can compare it with
// window.__game.economy() instead of reading a rounded bar.
const DEMAND_USES = ['res', 'com', 'ind'];
const DEMAND_WIDTH = 64;
const DEMAND_CITY = 'DEMAND · CITY';

function demandRow(use) {
  const row = document.createElement('div');
  row.id = `demand-${use}`;
  row.dataset.use = use;
  row.style.cssText = 'display:flex;align-items:center;gap:6px';
  const label = document.createElement('span');
  label.textContent = use;
  label.style.cssText = 'width:2.4em;opacity:0.75';
  const track = document.createElement('span');
  track.style.cssText = `position:relative;display:inline-block;width:${DEMAND_WIDTH}px;height:6px;`
    + 'background:rgba(255,255,255,0.12);border-radius:2px;overflow:hidden';
  const fill = document.createElement('span');
  fill.style.cssText = `display:block;height:100%;width:0;background:${paintOf(use)}`;
  track.appendChild(fill);
  const value = document.createElement('span');
  value.style.cssText = 'min-width:3.2em;text-align:right;opacity:0.9';
  row.append(label, track, value);
  return { row, fill, value };
}

function buildDemand() {
  const el = document.createElement('div');
  el.id = 'demand-bars';
  el.style.cssText = 'margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.14)';
  const head = document.createElement('div');
  head.id = 'demand-zone';
  head.style.cssText = 'opacity:0.7;letter-spacing:0.06em';
  head.textContent = DEMAND_CITY;
  const bars = Object.fromEntries(DEMAND_USES.map((use) => [use, demandRow(use)]));
  el.append(head, ...DEMAND_USES.map((use) => bars[use].row));
  return { el, head, bars };
}

function showDemand({ view, city, demand }) {
  if (view.mode !== 'city' || view.lift <= 0) return;
  const parcel = view.hover >= 0 ? city.parcels[view.hover] : view.pick?.parcel;
  const district = parcel ? city.economy?.districts?.[parcel.powerZone] : null;
  const values = district ? district.demand : city.demand;
  if (!values) return;
  demand.el.dataset.zone = district ? `${district.id}` : '';
  demand.head.textContent = district ? `DEMAND · ${district.name.toUpperCase()}` : DEMAND_CITY;
  for (const use of DEMAND_USES) {
    const { row, fill, value } = demand.bars[use];
    const v = Math.max(0, Math.min(1, values[use] ?? 0));
    row.dataset.demand = `${v}`;
    fill.style.width = `${Math.round(v * DEMAND_WIDTH)}px`;
    value.textContent = `${Math.round(v * 100)}%`;
  }
}

// The city's books, in the page (M5.T18, M5-6): the treasury, what the last game
// minute netted it, and the tax each use is charged a point at a time
// (sim/budget.js). The money line and every rate keep their own numbers on
// `data-*` the way the demand bars keep theirs, so a check reads the books
// without parsing a rounded badge. Raising the homes tax by ten points moves
// the demand bars below it (economy.js price) — the bite is visible here.
const TAX_STEP = 1;
const NUDGE = 'width:15px;padding:0;margin:0;font:11px/1.6 ui-monospace,Menlo,monospace;'
  + 'color:#e4e1da;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);'
  + 'border-radius:2px;cursor:pointer';

// Credits as a player reads them: a treasury is never shown to a decimal.
function credits(n) {
  const whole = Math.round(n);
  return `${whole < 0 ? '−' : ''}$${Math.abs(whole).toLocaleString('en-US')}`;
}

function taxRow(budget, use) {
  const row = document.createElement('div');
  row.id = `tax-${use}`;
  row.dataset.use = use;
  row.style.cssText = 'display:flex;align-items:center;gap:5px';
  const label = document.createElement('span');
  label.style.cssText = 'opacity:0.75';
  label.innerHTML = `${swatch(use)}${use}`;
  const rate = document.createElement('span');
  rate.style.cssText = 'min-width:2em;text-align:right';
  const nudge = (points) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = NUDGE;
    b.textContent = points > 0 ? '+' : '−';
    b.title = `${points > 0 ? 'raise' : 'cut'} the ${use} tax by ${TAX_STEP} point`;
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      raiseTax(budget, use, points);
    });
    return b;
  };
  const less = nudge(-TAX_STEP);
  const more = nudge(TAX_STEP);
  row.append(label, rate, less, more);
  return { row, rate, less, more };
}

function buildBooks(budget) {
  const money = document.createElement('span');
  money.id = 'money';
  const net = document.createElement('span');
  net.id = 'net';
  net.style.cssText = 'opacity:0.8;margin-left:7px';
  const head = document.createElement('div');
  head.append(money, net);
  const taxes = Object.fromEntries(DEMAND_USES.map((use) => [use, taxRow(budget, use)]));
  const el = document.createElement('div');
  el.id = 'books';
  el.style.cssText = 'margin:5px 0 4px;padding-top:5px;'
    + 'border-top:1px solid rgba(255,255,255,0.14)';
  el.append(head, ...DEMAND_USES.map((use) => taxes[use].row));
  return { el, money, net, taxes };
}

function showBooks(city, books) {
  const budget = city.economy?.budget;
  if (!budget) return;
  const r = budgetReport(budget);
  books.money.textContent = credits(r.money);
  books.money.style.color = r.debt ? '#e8977d' : '#fff';
  const shut = r.closed > 0
    ? ` · ${r.closed} service${r.closed === 1 ? '' : 's'} shut`
    : '';
  books.net.textContent = `${r.net < 0 ? '▼' : '▲'} ${credits(r.net)}/min${shut}`;
  books.el.dataset.money = `${r.money}`;
  books.el.dataset.net = `${r.net}`;
  for (const use of DEMAND_USES) {
    const t = books.taxes[use];
    const at = r.tax[use] ?? 0;
    t.row.dataset.tax = `${at}`;
    t.rate.textContent = `${at}`;
    // A rate at a bound can go no further: the nudge dims rather than lies.
    t.less.style.opacity = at <= 0 ? 0.3 : 1;
    t.more.style.opacity = at >= TAX_MAX ? 0.3 : 1;
  }
}

// A tool row names what the tool does and what it costs before it is used;
// hovering one says the same in the help line (M5-7's half that lives here). A
// price per metre names its unit (ROAD_TOOL), and a tool the treasury cannot
// pay for says that instead of the number.
const PUT_DOWN = 'right click or Esc puts the tool down';

function toolLine(tool, city) {
  const cost = tool.cost(city, null);
  const poor = affordTool(city, tool);
  return `${tool.name} — ${tool.blurb} · `
    + (poor ?? `$${cost}${tool.unit ?? ''}`);
}

function buildPalette(view, city) {
  const panel = document.createElement('div');
  panel.id = 'cityview';
  panel.style.cssText = PANEL;
  const title = document.createElement('div');
  title.innerHTML = '<b style="color:#fff">CITY VIEW</b> <span style="opacity:0.6">· z · street</span>';
  panel.appendChild(title);
  const demand = buildDemand();
  // The books sit under the title and above the demand bars, so a tax moved a
  // point at a time is answered by the demand it prices, in the same panel.
  const books = city.economy?.budget ? buildBooks(city.economy.budget) : null;
  if (books) panel.appendChild(books.el);
  panel.appendChild(demand.el);
  const rows = Object.values(TOOLS).map((tool) => {
    const row = document.createElement('div');
    row.id = `tool-${tool.id}`;
    row.dataset.tool = tool.id;
    row.dataset.key = tool.key ?? '';
    row.dataset.cost = `${tool.cost(city, null)}`;
    row.style.cssText = 'cursor:pointer;padding:0 8px 0 6px;border-left:3px solid transparent;border-radius:2px';
    // The road tool has no key yet (the palette picks it up): no key badge.
    const key = tool.key ? `<b style="color:#fff">${tool.key.toUpperCase()}</b> &nbsp;` : '';
    row.innerHTML = `${key}${swatch(tool.use)}`
      + `${tool.name} <span style="opacity:0.65">$${row.dataset.cost}${tool.unit ?? ''}</span>`;
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
  return { panel, rows, help, demand, books };
}

// What the held tool will do to the lot under the cursor (M5-7). A drag tool
// has no lot under its cursor — its card is dragCard() while it is held.
function toolNote(view, city, at) {
  const tool = toolOf(view);
  if (!tool || tool.drag) return '';
  const why = tool.refuse(city, at);
  if (why) return `<br><span style="color:#e8977d">✕ ${why}</span>`;
  return `<br>◆ ${tool.preview(at).kind} · $${tool.cost(city, at)}`;
}

// The held road drag: its snapped length and cost, or why it cannot land.
function dragCard(view) {
  const p = roadPreview(view);
  const line = `${p.length.toFixed(1)} m · $${p.cost}`;
  const why = p.reason ? `<br><span style="color:#e8977d">✕ ${p.reason}</span>` : '';
  return `${swatch('road')}<b style="color:#fff">NEW STREET</b><br>${line}${why}`;
}

// The bulldozer's cursor (M5.T5): what is under it, what it costs, or why not.
function targetCard(view, city) {
  const tool = toolOf(view);
  const pick = view.pick;
  const why = tool.refuse(city, pick);
  if (why) {
    return `${swatch('bulldoze')}<b style="color:#fff">BULLDOZE</b>`
      + `<br><span style="color:#e8977d">✕ ${why}</span>`;
  }
  const what = pick.kind === 'road'
    ? `road · ${pick.length.toFixed(0)} m`
    : pick.parcel.kind === 'lot'
      ? `lot · ${STAGE_NAME[pick.parcel.stage]}`
      : `${pick.parcel.kind} · ${USE_NAME[pick.parcel.use] ?? 'building'}`;
  return `${swatch('bulldoze')}<b style="color:#fff">BULLDOZE</b>`
    + `<br>${what}<br>◆ demolish · $${tool.cost(city, pick)}`;
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

// The ground point under a canvas pixel, through the renderer's own ray.
function groundAt({ rig, camera }, x, y) {
  const ndcX = (x / window.innerWidth) * 2 - 1;
  const ndcY = -(y / window.innerHeight) * 2 + 1;
  return rig.ground(camera, ndcX, ndcY);
}

// The held-back lot whose problem icon stands under a canvas pixel (M5.T34),
// or -1: the render layer's own pick, the same ray the pointer draws with.
function problemAt({ problems, camera }, x, y) {
  const ndcX = (x / window.innerWidth) * 2 - 1;
  const ndcY = -(y / window.innerHeight) * 2 + 1;
  return problems.pick(camera, ndcX, ndcY);
}

// A press is a click if it barely moves and a drag — orbit or tilt — once it
// travels. With the road tool held a press on a road node starts a road drag
// (M5.T3); the right button or Esc sets the tool down (M5.T1).
function bindPointer(ui) {
  const { canvas, view, city, camera } = ui;
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
    if (e.button !== 0) return;
    dismissRoad(view);   // a new click answers any ask still standing
    // A click on a problem icon opens its reason card; anywhere else closes
    // one and paints as before (M5.T34).
    const problem = problemAt(ui, e.clientX, e.clientY);
    view.problem = problem >= 0 ? problem : null;
    view.problemAt = problem >= 0 ? { x: e.clientX, y: e.clientY } : null;
    const press = { lastX: e.clientX, lastY: e.clientY, travel: 0, road: false, problem };
    const at = problem < 0 ? groundAt(ui, e.clientX, e.clientY) : null;
    if (toolOf(view)?.drag && at && pressRoad(view, at.x, at.z)) press.road = true;
    ui.press = press;
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view.mode === 'city') { view.problem = null; layDownTool(view); }
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
    if (press.road) {
      const at = groundAt(ui, e.clientX, e.clientY);
      if (at) moveRoad(view, at.x, at.z);
      return;
    }
    if (press.travel > CLICK_SLOP) orbitCityView(view, -dx * ORBIT_PER_PX, dy * TILT_PER_PX);
  });
  window.addEventListener('pointerup', () => {
    const { press } = ui;
    if (press?.problem >= 0) { /* the reason card is already open */ }
    else if (press?.road) releaseRoad(view);
    else if (press && press.travel <= CLICK_SLOP) paintLot(view, city);
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

function hover({ view, city, pointer, rig, camera }) {
  const nothing = () => { hoverLot(view, -1); hoverPick(view, city, null); };
  if (view.mode !== 'city' || view.lift < 1 || !pointer) return nothing();
  // A road drag is not about a lot: no lot under its cursor to read out.
  if (view.drag || toolOf(view)?.drag) return nothing();
  const x = (pointer.x / window.innerWidth) * 2 - 1;
  const y = -(pointer.y / window.innerHeight) * 2 + 1;
  // The bulldozer holds a whole parcel or a road (M5.T5); a brush holds a lot.
  if (toolOf(view)?.id === 'bulldoze') return hoverPick(view, city, rig.pickTarget(camera, x, y));
  hoverPick(view, city, null);
  return hoverLot(view, rig.pick(camera, x, y));
}

function showPalette({ view, city, panel, rows, help, hoverTool }) {
  panel.style.display = view.mode === 'city' ? 'block' : 'none';
  const tool = toolOf(view);
  for (const { row, tool: entry } of rows) {
    const on = entry === tool;
    row.style.borderLeftColor = on ? paintOf(entry.use) : 'transparent';
    row.style.background = on ? 'rgba(255,255,255,0.08)' : 'transparent';
    // A tool the treasury cannot pay for stands dimmed and says why, the same
    // words the card gives the cursor (M5-7): the money is never a surprise.
    const poor = affordTool(city, entry);
    row.dataset.afford = poor ? 'no' : 'yes';
    row.title = toolLine(entry, city);
    row.style.opacity = poor ? 0.45 : 1;
  }
  const shown = hoverTool ?? tool;
  help.textContent = shown ? toolLine(shown, city) : PUT_DOWN;
  // The street's own prompts point at things too small to see from up here.
  for (const id of ['profiler', 'prompt']) {
    const el = document.getElementById(id);
    if (el && view.lift > 0) el.style.display = 'none';
  }
}

// Today's reason for the lot whose problem icon was clicked (M5.T34): the
// cause's own line from decline.js's table, and the decline line the street
// already speaks when it is that same cause.
function reasonCard(p, cause) {
  const label = PROBLEM[cause]?.label ?? 'problem';
  const line = p.why === cause ? describe(p) : null;
  return `<b style="color:#fff">PROBLEM · ${label.toUpperCase()}</b>`
    + (line ? `<br>${line}` : '')
    + '<br><span style="opacity:0.65">click elsewhere to close</span>';
}

function showCard({ view, city, street, pointer, card, problems }) {
  if (view.problem != null && view.mode === 'city') {
    const cause = problems.causeOf(view.problem);
    card.dataset.cause = cause ?? '';
    card.dataset.lot = `${view.problem}`;
    card.innerHTML = reasonCard(city.parcels[view.problem], cause);
    card.style.display = 'block';
    const at = view.problemAt ?? pointer ?? { x: 20, y: 20 };
    card.style.left = `${at.x + 16}px`;
    card.style.top = `${at.y + 16}px`;
    return;
  }
  card.dataset.cause = '';
  card.dataset.lot = '';
  if (!pointer || (view.hover < 0 && !view.drag && !view.pick)) {
    card.style.display = 'none';
    return;
  }
  card.innerHTML = view.drag ? dragCard(view)
    : toolOf(view)?.id === 'bulldoze' ? targetCard(view, city)
      : readout(view, city, street, view.hover);
  card.style.display = 'block';
  card.style.left = `${pointer.x + 16}px`;
  card.style.top = `${pointer.y + 16}px`;
}

// The page's own ask before a road that would strand buildings goes (M5.T5):
// a centred panel, not the browser's confirm.
function showAsk({ view, ask }) {
  if (!view.confirm) {
    ask.style.display = 'none';
    return;
  }
  const n = view.confirm.cuts;
  ask.querySelector('#askline').textContent = `${n} building${n === 1 ? '' : 's'} would lose their only road.`;
  ask.style.display = 'block';
}

// Wires the overview's input and HUD. Returns the per-frame update, which runs
// after render/cityview.js has placed the camera.
export function bindCityView({ canvas, cam, camera, city, street, view, rig }) {
  const card = document.createElement('div');
  card.id = 'lotcard';
  card.style.cssText = CARD;
  document.body.appendChild(card);
  // The road ask (M5.T5) is built once; its buttons are wired once.
  const ask = document.createElement('div');
  ask.id = 'cityask';
  ask.style.cssText = ASK;
  ask.innerHTML = '<b style="color:#fff">Demolish this road?</b>'
    + '<div id="askline" style="opacity:0.8;margin:2px 0 8px"></div>'
    + '<button id="ask-yes">Demolish it</button> <button id="ask-no">Keep the road</button>';
  document.body.appendChild(ask);
  ask.querySelector('#ask-yes').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    confirmRoad(view, city);
  });
  ask.querySelector('#ask-no').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dismissRoad(view);
  });
  const ui = {
    canvas, cam, camera, city, street, view, rig, card, ask,
    ...buildPalette(view, city),
    // The problem-icon layer (M5.T34) rides the city view's own group: built
    // once, framed each update from the sim's cause list.
    problems: buildProblems(city, { dark: (zone) => isDark(street, zone) }),
    pointer: null, press: null, parked: null, hoverTool: null,
  };
  rig.mesh.add(ui.problems.mesh);
  for (const { row, tool } of ui.rows) {
    row.addEventListener('pointerenter', () => { ui.hoverTool = tool; });
    row.addEventListener('pointerleave', () => { ui.hoverTool = null; });
  }
  bindPointer(ui);
  function update() {
    holdStreetRig(ui);
    if (view.mode !== 'city') view.problem = null;
    hover(ui);
    showPalette(ui);
    showDemand(ui);
    if (ui.books) showBooks(city, ui.books);
    ui.problems.frame(camera, view.lift);
    showCard(ui);
    showAsk(ui);
  }
  return { update };
}
