// The district readout: each district's jobs, homes and wealth, and what its
// market wants of each use, as short bars — the cause beside the effect the lots
// show. Every number is districtReport() (sim/economy.js); DOM only, reads the
// sim and never writes it.
//
// Bottom right (M5.R1), beside the news feed and the mission panel: the city's
// own numbers on one side and the street's own readouts on the other. It used
// to stand in the bottom-left column, where the city view's palette pushed the
// whole stack up over the status lines; ui/hudlayout.js places it in this
// column, above the history panel when that is open.
import { districtReport } from '../sim/economy.js';

// A person reads this, so it refreshes on their clock, not the sim's: when frames
// are slow the sim's dt is clamped, and a sim-timed panel would lag behind.
const REFRESH_MS = 250;
// Jobs and homes bars share one scale: the district at full build, its lots
// doubling what already stood. Wealth and demand are 0..1 already.
const FULL_BUILD = 2;
const BAR_PX = 58;
const COLOR = {
  jobs: '#d8b98a', homes: '#b7c0c8', wealth: '#d9ad5b', dark: '#e39b6a', demand: '#cfc6b4',
  rising: '#9fc48a', falling: '#e39b6a', dim: 'rgba(228,225,218,0.5)',
};
// What the lots of a use are doing right now: rising, holding, coming down.
const TREND = { 1: ['▲', COLOR.rising], 0: ['·', COLOR.dim], [-1]: ['▼', COLOR.falling] };
const FIRM = { com: 'office', ind: 'works' };
const USES = ['res', 'com', 'ind'];

export function buildEconomyPanel() {
  const panel = document.createElement('div');
  panel.id = 'districts';
  panel.style.cssText = [
    'position:fixed', 'left:auto', 'right:12px', 'bottom:12px', 'pointer-events:none', 'z-index:5',
    'font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace', 'letter-spacing:0.04em',
    'color:#e4e1da', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
    'background:rgba(4,8,16,0.6)', 'border:1px solid rgba(255,255,255,0.16)',
    'padding:6px 10px 7px', 'border-radius:6px',
  ].join(';');
  document.body.appendChild(panel);
  return { panel, next: 0 };
}

const dim = (text) => `<span style="color:${COLOR.dim}">${text}</span>`;

function bar(share, color) {
  const w = Math.round(Math.max(0, Math.min(1, share)) * BAR_PX);
  return `<span style="display:inline-block;width:${BAR_PX}px;height:6px;margin-right:5px;` +
    'background:rgba(255,255,255,0.1);vertical-align:1px">' +
    `<span style="display:block;width:${w}px;height:6px;background:${color}"></span></span>`;
}

// One line of the table: a label, then one cell per district.
function row(label, districts, render, indent = 0) {
  const cells = districts.map((d) => `<td style="padding:0 0 0 12px;white-space:nowrap">${render(d)}</td>`);
  return `<tr><td style="padding-left:${indent}ch;color:${COLOR.dim}">${label}</td>${cells.join('')}</tr>`;
}

function heading(d) {
  const name = `<b>${d.name.toUpperCase()}</b>`;
  return d.dark ? `${name} <span style="color:${COLOR.dark}">dark</span>` : name;
}

function people(key) {
  return (d) => bar(d[key] / (d.size * FULL_BUILD), COLOR[key]) + `<span data-${key}="${d[key]}">${d[key]}</span>`;
}

function wealth(d) {
  return bar(d.wealth, d.dark ? COLOR.dark : COLOR.wealth) + `${Math.round(d.wealth * 100)}%`;
}

function demand(use) {
  return (d) => {
    if (d.lots[use] === 0) return bar(d.demand[use], COLOR.demand) + dim('–');
    const [glyph, color] = TREND[d.trend[use]];
    return bar(d.demand[use], COLOR.demand) + `<span style="color:${color}">${glyph}</span>`;
  };
}

// The last firm to move, and how long ago: the market's latest word.
function firm(d) {
  if (!d.last) return '';
  const { use, jobs, ago } = d.last;
  return dim(`${FIRM[use]} ${jobs >= 0 ? 'in +' : 'out −'}${Math.abs(jobs)} · ${Math.round(ago)}s`);
}

function table(districts) {
  const demandRows = USES.map((use, i) => row(i === 0 ? `demand ${use}` : use, districts, demand(use), i && 7));
  return '<table style="border-collapse:collapse">' +
    row('economy', districts, heading) +
    row('jobs', districts, people('jobs')) +
    row('homes', districts, people('homes')) +
    row('wealth', districts, wealth) +
    demandRows.join('') +
    row('firms', districts, firm) +
    '</table>';
}

export function updateEconomyPanel(ui, city) {
  const now = performance.now();
  if (now < ui.next) return;
  ui.next = now + REFRESH_MS;
  ui.panel.innerHTML = table(districtReport(city));
}
