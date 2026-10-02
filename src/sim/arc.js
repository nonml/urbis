// The arc: six missions, three people, two choices the district remembers.
// Content is src/content/arc.json, the verbs are mission.js runs, the story is
// docs/ARC.md. Pure state (law 5): render and the HUD read it, only main ticks
// it, and it reads the city without ever writing to it.
// The attribute lets Node (the headless tests) load the same module Vite bundles.
import RAW_ARC from '../content/arc.json' with { type: 'json' };
import { worldArc } from './anchors.js';
import { activeStep, createRun, isNear, missionOnChoice, missionPoll, missionRewind, siteFor } from './mission.js';

const ARC = worldArc(RAW_ARC);
export { ARC };

// Coldest to warmest. A choice moves a contact along this scale and it stays
// moved; the journal and later dialogue read where they ended up.
export const ATTITUDES = ['hostile', 'cold', 'wary', 'neutral', 'warm', 'ally'];

// A line stays up for a beat to find the panel, then a reading pace. A choice
// stays up until it is answered — nothing on the street decides for you.
const READ_BASE_SECS = 2.5;
const READ_SECS_PER_CHAR = 0.055;
const NOTE_SECS = 4;
// Flags a read_lot step writes: what the lot was when the player stood at it.
const LOT_FLAG = 'lot:';

export function createArc(def = ARC, time = 0) {
  const trust = {};
  for (const [id, c] of Object.entries(def.contacts)) trust[id] = ATTITUDES.indexOf(c.attitude);
  const arc = {
    def,
    flags: {},
    trust,
    mission: null,
    run: null,
    asking: -1,
    played: [],
    done: [],
    choices: [],
    dialogue: null,
    queue: [],
    note: null,
    owed: 0,
    earned: 0,
    finished: false,
    wasBusted: false,
  };
  startMission(arc, def.start, time);
  return arc;
}

function missionById(def, id) {
  return def.missions.find((m) => m.id === id);
}

function startMission(arc, id, time) {
  const m = missionById(arc.def, id);
  arc.mission = m;
  arc.run = createRun(m.steps, arc.def.places);
  arc.asking = -1;
  arc.played.push(m.id);
  say(arc, m.brief, time);
}

// A condition is a flag, "!flag", or a list of them meaning any one will do.
export function holds(arc, cond) {
  if (cond === undefined) return true;
  const any = Array.isArray(cond) ? cond : [cond];
  return any.some((c) => (c.startsWith('!') ? !arc.flags[c.slice(1)] : !!arc.flags[c]));
}

function linesFor(arc, list = []) {
  return list.filter((l) => holds(arc, l.if)).map((l) => ({ who: l.who, text: l.text }));
}

function say(arc, list, time, options = null) {
  const lines = linesFor(arc, list);
  if (lines.length === 0 && !options) return;
  arc.queue.push({ lines, options });
  showNext(arc, time);
}

function showNext(arc, time) {
  if (arc.dialogue || arc.queue.length === 0) return;
  const d = arc.queue.shift();
  const chars = d.lines.reduce((n, l) => n + l.text.length, 0);
  const until = d.options ? Infinity : time + READ_BASE_SECS + chars * READ_SECS_PER_CHAR;
  arc.dialogue = { ...d, until };
}

function closeDialogue(arc, time) {
  arc.dialogue = null;
  showNext(arc, time);
}

function note(arc, text, time) {
  arc.note = { text, until: time + NOTE_SECS };
}

function setLotFlags(arc, lot) {
  for (const f of Object.keys(arc.flags)) if (f.startsWith(LOT_FLAG)) delete arc.flags[f];
  if (lot) arc.flags[LOT_FLAG + lot.stage] = true;
}

function onStepDone(arc, i, time) {
  const s = arc.run.steps[i];
  if (s.verb === 'read_lot') setLotFlags(arc, arc.run.lot);
  if (s.verb !== 'choose') say(arc, s.say, time);
}

// A choice opens once its step is in hand and, if it names a place, once the
// player is standing there.
function askIfDue(arc, world, time) {
  const i = activeStep(arc.run);
  const s = arc.run.steps[i];
  if (!s || s.verb !== 'choose' || arc.asking === i) return;
  if (s.at && !isNear(s.at, world.x, world.z)) return;
  arc.asking = i;
  say(arc, s.say, time, s.options.map(({ key, text }) => ({ key, text })));
}

function nextMissionId(arc, m) {
  if (!m.next) return null;
  if (typeof m.next === 'string') return m.next;
  const flag = Object.keys(m.next).find((f) => arc.flags[f]);
  return flag ? m.next[flag] : null;
}

function completeMission(arc, time) {
  const m = arc.mission;
  arc.done.push({ id: m.id, title: m.title, contact: m.contact, paid: m.payout });
  arc.owed += m.payout;
  say(arc, m.debrief, time);
  const next = nextMissionId(arc, m);
  const paid = m.payout > 0 ? ` +₡${m.payout}` : '';
  if (!next) {
    arc.finished = true;
    arc.mission = null;
    arc.run = null;
    note(arc, `${m.title} COMPLETE${paid} — THE ARC IS DONE`, time);
    return;
  }
  note(arc, `${m.title} COMPLETE${paid}`, time);
  startMission(arc, next, time);
}

// The arc on a busted player: the mission goes back to just past its last
// answered choice. The choice itself, and everything it changed, stays.
function onBusted(arc, time) {
  const run = arc.run;
  let keep = -1;
  run.steps.forEach((s, i) => { if (s.verb === 'choose' && run.done[i]) keep = i; });
  missionRewind(run, keep);
  arc.asking = -1;
  arc.dialogue = null;
  arc.queue = [];
  note(arc, `BUSTED — ${arc.mission.title} picks up from the top`, time);
}

// World snapshot, as mission.js polls it, plus `busted` for this tick.
// Returns the money the arc paid out this tick, for the wallet main owns.
export function tickArc(arc, world, time) {
  if (arc.dialogue && time >= arc.dialogue.until) closeDialogue(arc, time);
  if (arc.run) {
    if (world.busted && !arc.wasBusted) onBusted(arc, time);
    const i = missionPoll(arc.run, world);
    if (i >= 0) onStepDone(arc, i, time);
    askIfDue(arc, world, time);
    if (activeStep(arc.run) < 0) completeMission(arc, time);
  }
  arc.wasBusted = !!world.busted;
  const owed = arc.owed;
  arc.owed = 0;
  arc.earned += owed;
  return owed;
}

function applyChoice(arc, opt) {
  arc.flags[opt.set] = true;
  arc.owed += opt.money ?? 0;
  for (const [who, step] of Object.entries(opt.trust ?? {})) {
    arc.trust[who] = Math.max(0, Math.min(ATTITUDES.length - 1, arc.trust[who] + step));
  }
  arc.choices.push({ mission: arc.mission.title, text: opt.text, note: opt.note });
}

// Keys 1 and 2. They mean something only while a dialogue is open: 1 moves a
// plain line along, 1 or 2 answers a choice. Returns whether anything happened.
export function arcChoose(arc, key, time) {
  const d = arc.dialogue;
  if (!d) return false;
  if (!d.options) {
    if (key !== 1) return false;
    closeDialogue(arc, time);
    return true;
  }
  if (!arc.run || !missionOnChoice(arc.run, key)) return false;
  const opt = arc.run.choice;
  applyChoice(arc, opt);
  arc.dialogue = null;
  say(arc, [{ who: 'you', text: opt.text }, ...opt.reply], time);
  return true;
}

// What the objective line says: mission, contact, the step in hand.
export function arcObjective(arc) {
  if (arc.finished || !arc.run) return null;
  const i = activeStep(arc.run);
  return { title: arc.mission.title, contact: arc.mission.contact, label: arc.run.phases[i] ?? '' };
}

// Where the world marker stands, or null. A place until the player reaches it;
// for a crane to stop, the working site nearest the player.
export function arcTarget(arc, parcels, x, z) {
  if (!arc.run) return null;
  const s = arc.run.steps[activeStep(arc.run)];
  if (!s) return null;
  if (s.verb === 'stall_site') {
    const p = siteFor(parcels, s.zone, x, z);
    return p ? { x: p.x, z: p.z } : null;
  }
  if (!s.at || isNear(s.at, x, z)) return null;
  return { x: s.at.x, z: s.at.z };
}

// The signs the district now carries because of what the player chose.
export function arcSigns(arc) {
  return arc.def.signs.filter((s) => holds(arc, s.if));
}

export function attitudeOf(arc, who) {
  return ATTITUDES[arc.trust[who]];
}

// The probe's view of the arc (window.__game.arc): plain data, no functions.
export function arcSnapshot(arc, parcels, x, z) {
  return {
    mission: arc.mission?.id ?? null,
    step: arc.run ? activeStep(arc.run) : -1,
    objective: arcObjective(arc),
    target: arcTarget(arc, parcels, x, z),
    flags: Object.keys(arc.flags),
    people: Object.fromEntries(Object.keys(arc.def.contacts).map((id) => [id, attitudeOf(arc, id)])),
    done: arc.done.map((d) => d.id),
    choices: arc.choices.map((c) => c.note),
    dialogue: arc.dialogue && { lines: arc.dialogue.lines, options: arc.dialogue.options },
    signs: arcSigns(arc).map((s) => s.id),
    finished: arc.finished,
    earned: arc.earned,
  };
}

// Capture probe only (?capture=1): finish the step in hand as if it had been
// played, to stage evidence. It skips the step's lines, and it never answers a
// choice — that takes arcChoose, like a player.
export function arcSkipStep(arc) {
  const i = arc.run ? activeStep(arc.run) : -1;
  if (i >= 0 && arc.run.steps[i].verb !== 'choose') arc.run.done[i] = true;
}
