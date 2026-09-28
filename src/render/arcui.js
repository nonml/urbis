// The arc's HUD, in its own elements (pillar 5): the objective line up top, the
// contact's dialogue bottom left, clear of the hero, and the journal on J.
// DOM only — it reads the arc (src/sim/arc.js) and never changes it.
import { activeStep } from '../sim/mission.js';
import { arcObjective, attitudeOf } from '../sim/arc.js';

const INK = '#e8e3d8';
const DIM = 'rgba(232,227,216,0.55)';
const AMBER = '#ffb14e';
const PANEL = 'rgba(8,9,12,0.84)';
const EDGE = 'rgba(255,255,255,0.14)';
const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace';
const SANS = 'system-ui,-apple-system,"Segoe UI",sans-serif';
// Attitude reads as colour as well as a word: cold is blue-grey, warm is amber.
const ATTITUDE_INK = {
  hostile: '#d0574a', cold: '#8fa3b8', wary: '#c9b48a', neutral: DIM, warm: '#e0a458', ally: '#8cc084',
};

function panel(id, css) {
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:6', `color:${INK}`, `background:${PANEL}`,
    `border:1px solid ${EDGE}`, 'border-radius:4px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)', 'display:none',
    ...css,
  ].join(';');
  document.body.appendChild(el);
  return el;
}

export function buildArcUI() {
  return {
    objective: panel('arc-objective', [
      'top:12px', 'left:50%', 'transform:translateX(-50%)', `font:12px/1.6 ${MONO}`,
      'letter-spacing:0.05em', 'padding:6px 14px', 'text-align:center', `border-top:2px solid ${AMBER}`,
    ]),
    // Bottom left, clear of the hero at the centre of the frame and of the
    // prompt and hint below it.
    dialogue: panel('arc-dialogue', [
      'bottom:56px', 'left:16px', 'width:min(500px,40vw)',
      `font:15px/1.5 ${SANS}`, 'padding:12px 18px 10px',
    ]),
    journal: panel('arc-journal', [
      'top:50%', 'left:50%', 'transform:translate(-50%,-50%)', 'width:min(560px,88vw)',
      'max-height:80vh', 'overflow:hidden', `font:12px/1.65 ${MONO}`, 'letter-spacing:0.03em',
      'padding:14px 20px', 'z-index:7',
    ]),
    journalOpen: false,
    last: { objective: '', dialogue: '', journal: '' },
  };
}

export function toggleJournal(ui) {
  ui.journalOpen = !ui.journalOpen;
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tint = (color, html) => `<span style="color:${color}">${html}</span>`;
const dim = (html) => tint(DIM, html);

function speaker(arc, who) {
  if (who === 'you') return { name: 'YOU', color: INK };
  const c = arc.def.contacts[who];
  return { name: c.name, color: c.color };
}

// Only touch the DOM when the words change: this runs every frame.
function write(ui, key, el, html) {
  if (ui.last[key] === html) return;
  ui.last[key] = html;
  el.innerHTML = html;
  el.style.display = html ? 'block' : 'none';
}

function objectiveHtml(arc, x, z, time) {
  const note = arc.note && time < arc.note.until
    ? `<div style="color:${AMBER};font-weight:600">${esc(arc.note.text)}</div>` : '';
  const o = arcObjective(arc);
  if (!o) return note;
  const who = speaker(arc, o.contact);
  const s = arc.run.steps[activeStep(arc.run)];
  // Metres still to go: to the place's edge, which is where the step completes.
  const togo = s?.at ? Math.hypot(s.at.x - x, s.at.z - z) - s.at.r : 0;
  const dist = togo >= 1 ? ` ${dim(`· ${Math.round(togo)} m`)}` : '';
  const head = `<b style="color:${AMBER}">◆ ${esc(o.title)}</b> ${tint(who.color, `· ${esc(who.name)}`)}`;
  return `${note}${head}<br>${esc(o.label)}${dist}`;
}

function dialogueHtml(arc) {
  const d = arc.dialogue;
  if (!d) return '';
  let prev = null;
  const lines = d.lines.map((l) => {
    const who = speaker(arc, l.who);
    const tag = l.who === prev ? '' : `<div style="font:600 11px ${MONO};letter-spacing:0.14em;color:${who.color};` +
      `margin-top:4px">${esc(who.name)}</div>`;
    prev = l.who;
    return `${tag}<div>${esc(l.text)}</div>`;
  }).join('');
  const foot = d.options
    ? d.options.map((o) => `<div style="margin-top:6px;color:${AMBER}"><b style="font-family:${MONO}">${o.key}</b>` +
      ` &nbsp;${esc(o.text)}</div>`).join('')
    : `<div style="margin-top:6px;font:11px ${MONO};color:${DIM};text-align:right">1 · continue</div>`;
  const edge = speaker(arc, d.lines[0]?.who ?? 'you').color;
  return `<div style="border-left:3px solid ${edge};padding-left:12px">${lines}${foot}</div>`;
}

const section = (title) => `<div style="margin-top:10px;color:${AMBER};letter-spacing:0.14em">${title}</div>`;

function journalHtml(arc) {
  const o = arcObjective(arc);
  const now = o
    ? `◆ ${esc(o.title)} — ${esc(speaker(arc, o.contact).name)}<br>${dim(esc(o.label))}`
    : dim(arc.finished ? 'The arc is done.' : 'Nothing in hand.');
  const done = arc.done.map((d) => `✓ ${esc(d.title)} ${dim(`· ₡${d.paid}`)}`).join('<br>');
  const choices = arc.choices.map((c) => `• ${esc(c.note)} ${dim(`(${esc(c.mission)})`)}`).join('<br>');
  const people = Object.entries(arc.def.contacts).map(([id, c]) => {
    const a = attitudeOf(arc, id);
    return `${tint(c.color, esc(c.name))} ${dim(esc(c.role))} — ${tint(ATTITUDE_INK[a], a)}`;
  }).join('<br>');
  return `<div style="display:flex;justify-content:space-between"><b>JOURNAL</b>` +
    `${dim(`₡${arc.earned} earned · J to close`)}</div>` +
    `${section('IN HAND')}${now}${section('DONE')}${done || dim('—')}` +
    `${section('CHOICES')}${choices || dim('None yet.')}${section('PEOPLE')}${people}`;
}

export function updateArcUI(ui, arc, x, z, time) {
  write(ui, 'objective', ui.objective, objectiveHtml(arc, x, z, time));
  write(ui, 'dialogue', ui.dialogue, dialogueHtml(arc));
  write(ui, 'journal', ui.journal, ui.journalOpen ? journalHtml(arc) : '');
}
