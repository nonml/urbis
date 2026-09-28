#!/usr/bin/env node
// Content schema validator for src/content/*.json.
// Usage: node scripts/validate_content.mjs [--quiet] [--dir <content dir>]
// Exit non-zero on any violation — wire into gate before build. --dir points it
// at another copy of the content, which is how the tests prove a broken arc fails.
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { WALK_BOUNDS } from '../src/sim/world.js';
import { STAGES } from '../src/sim/zoning.js';

const QUIET = process.argv.includes('--quiet');
const DIR_ARG = process.argv.indexOf('--dir');
const CONTENT = DIR_ARG > 0
  ? pathToFileURL(`${resolve(process.argv[DIR_ARG + 1])}/`)
  : new URL('../src/content/', import.meta.url);
const log = (...a) => { if (!QUIET) console.log(...a); };
const fails = [];
const bad = (where, msg) => fails.push(`${where}: ${msg}`);

function load(rel) {
  try {
    return JSON.parse(readFileSync(new URL(rel, CONTENT)));
  } catch (e) {
    bad(rel, `unreadable — ${e.message}`);
    return null;
  }
}

function checkSigns(data) {
  if (!Array.isArray(data) || data.length === 0) return bad('signs.json', 'must be a non-empty array');
  const seen = new Set();
  data.forEach((s, i) => {
    const w = `signs[${i}]`;
    if (typeof s.text !== 'string' || [...s.text].length < 1 || [...s.text].length > 5) bad(w, 'text must be 1–5 chars');
    if (typeof s.sub !== 'string' || s.sub.length > 6) bad(w, 'sub must be a string ≤ 6 chars');
    if (!/^#[0-9a-fA-F]{6}$/.test(s.color || '')) bad(w, 'color must be #rrggbb');
    if (![-1, 0, 1].includes(s.side)) bad(w, 'side must be -1, 0, or 1');
    if (typeof s.z !== 'number' || typeof s.y !== 'number' || s.y < 2 || s.y > 30) bad(w, 'z/y numbers, y in 2–30');
    if (s.ax !== undefined && typeof s.ax !== 'number') bad(w, 'ax must be a number');
    if (s.face !== undefined && s.face !== 'south') bad(w, 'face must be "south"');
    const key = `${s.side}|${s.ax || 0}|${s.z}`;
    if (seen.has(key)) bad(w, 'duplicate sign position');
    seen.add(key);
  });
}

// The closed verb set. A new verb is an entry here and a handler in
// src/sim/mission.js, together. The last four are arc-only: they are polled
// against where the player stands and what the city is doing, one step at a
// time (a mission.js run), and the contracts board only hears events.
const VERBS = [
  'enter_car', 'blackout_zone', 'blackout_chain', 'profile_count', 'lose_heat',
  'go_to', 'read_lot', 'stall_site', 'choose',
];
const ARC_ONLY = ['go_to', 'read_lot', 'stall_site', 'choose'];
const PLACED = ['go_to', 'read_lot'];

// ctx: { places, contacts, flags, arc } — places/contacts/flags come from arc.json.
function checkStep(sw, s, ctx) {
  if (!VERBS.includes(s.verb)) return bad(sw, `unknown verb ${s.verb}`);
  if (!ctx.arc && ARC_ONLY.includes(s.verb)) return bad(sw, `${s.verb} is arc-only — the board cannot poll it`);
  if (typeof s.label !== 'string' || s.label.length === 0) bad(sw, 'label required');
  if (s.verb === 'blackout_zone' && ![-1, 0, 1].includes(s.zone)) bad(sw, 'zone must be -1 (any), 0, or 1');
  if (s.verb === 'blackout_chain' && (!Array.isArray(s.zones) || s.zones.length === 0
    || s.zones.some((z) => ![0, 1].includes(z)))) {
    bad(sw, 'zones must be a non-empty array of 0/1');
  }
  if (s.verb === 'profile_count' && (!Number.isInteger(s.n) || s.n < 1 || s.n > 12)) {
    bad(sw, 'n must be an integer 1–12');
  }
  if (s.verb === 'stall_site' && ![0, 1].includes(s.zone)) bad(sw, 'zone must be 0 or 1');
  if (PLACED.includes(s.verb) && s.place === undefined) bad(sw, `${s.verb} needs a place`);
  if (s.place !== undefined && !(s.place in ctx.places)) bad(sw, `unknown place ${s.place}`);
  if (!ctx.arc && (s.place !== undefined || s.say !== undefined)) bad(sw, 'place and say are arc-only');
  if (s.radius !== undefined && !(typeof s.radius === 'number' && s.radius > 0)) bad(sw, 'radius must be > 0');
  if (s.say !== undefined) checkLines(`${sw}.say`, s.say, ctx);
  if (s.verb === 'choose') checkChoice(sw, s, ctx);
}

function checkMissions(data, ctx) {
  if (!Array.isArray(data) || data.length === 0) return bad('missions.json', 'must be a non-empty array');
  const ids = new Set();
  data.forEach((m, i) => {
    const w = `missions[${i}]`;
    if (typeof m.id !== 'string' || m.id.length === 0) bad(w, 'id must be a non-empty string');
    if (ids.has(m.id)) bad(w, `duplicate id ${m.id}`);
    ids.add(m.id);
    if (typeof m.payout !== 'number' || m.payout <= 0) bad(w, 'payout must be a positive number');
    if (!Array.isArray(m.steps) || m.steps.length === 0) return bad(w, 'steps must be a non-empty array');
    m.steps.forEach((s, j) => checkStep(`${w}.steps[${j}]`, s, { ...ctx, arc: false }));
  });
}

// ---------------------------------------------------------------------------
// arc.json — the story. Contacts, places, the signs a choice puts up, and the
// missions. The rules below are the schema; docs/ARC.md is the story they hold.
const ARC_MISSIONS = 6;            // every way through the arc is six missions long
const ATTITUDES = ['hostile', 'cold', 'wary', 'neutral', 'warm', 'ally'];
const YOU = 'you';                 // the player's own lines
const LINE_MAX = 200;              // one line of dialogue, in characters
const OPTION_MAX = 80;             // an answer has to fit on one line of the panel
const TITLE_MAX = 24;
const TRUST_STEP_MAX = 5;
const PLACE_REACH_MAX = 60;
const SIGN_KINDS = ['banner', 'board'];
const SIGN_TEXT_MAX = 14;
const SIGN_SUB_MAX = 30;
const SIGN_Y_MAX = 12;
const SIGN_W = [0.5, 8];
const SIGN_H = [0.3, 6];
const FACES = ['1,0', '-1,0', '0,1', '0,-1'];
const ID = /^[a-z][a-z_]*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const inBounds = (x, z) => typeof x === 'number' && typeof z === 'number'
  && x >= WALK_BOUNDS.minX && x <= WALK_BOUNDS.maxX && z >= WALK_BOUNDS.minZ && z <= WALK_BOUNDS.maxZ;

// Every flag the arc can raise: each answer's `set`, and what a lot can be read as.
function arcContext(arc) {
  const flags = new Set(STAGES.map((st) => `lot:${st}`));
  for (const m of arc?.missions ?? []) {
    for (const s of m.steps ?? []) {
      for (const o of s.options ?? []) if (typeof o.set === 'string') flags.add(o.set);
    }
  }
  const places = isObj(arc?.places) ? arc.places : {};
  const contacts = isObj(arc?.contacts) ? arc.contacts : {};
  return { places, contacts, flags };
}

function checkCond(w, cond, ctx) {
  const list = Array.isArray(cond) ? cond : [cond];
  if (list.length === 0) return bad(w, 'if must not be an empty list');
  for (const c of list) {
    if (typeof c !== 'string' || !ctx.flags.has(c.replace(/^!/, ''))) bad(w, `if names unknown flag ${c}`);
  }
}

function checkLines(w, lines, ctx) {
  if (!Array.isArray(lines)) return bad(w, 'must be an array of lines');
  lines.forEach((l, i) => {
    const lw = `${w}[${i}]`;
    if (!isObj(l)) return bad(lw, 'line must be an object');
    if (l.who !== YOU && !(l.who in ctx.contacts)) bad(lw, `unknown speaker ${l.who}`);
    if (typeof l.text !== 'string' || l.text.length === 0 || l.text.length > LINE_MAX) {
      bad(lw, `text must be 1–${LINE_MAX} chars`);
    }
    if (l.if !== undefined) checkCond(`${lw}.if`, l.if, ctx);
  });
}

// Keys 1 and 2 are the only answer keys the game binds, so a choice has two.
function checkChoice(sw, s, ctx) {
  if (!(s.who in ctx.contacts)) bad(sw, `choose needs a contact to ask, got ${s.who}`);
  if (!Array.isArray(s.say) || s.say.length === 0) bad(sw, 'choose needs the question in say');
  if (!Array.isArray(s.options) || s.options.length !== 2) return bad(sw, 'choose needs exactly 2 options');
  s.options.forEach((o, k) => {
    const ow = `${sw}.options[${k}]`;
    if (o.key !== k + 1) bad(ow, `key must be ${k + 1}`);
    if (typeof o.text !== 'string' || o.text.length === 0 || o.text.length > OPTION_MAX) {
      bad(ow, `text must be 1–${OPTION_MAX} chars`);
    }
    if (typeof o.set !== 'string' || !ID.test(o.set)) bad(ow, 'set must be a flag name (a-z, _)');
    if (o.money !== undefined && !(typeof o.money === 'number' && o.money >= 0)) bad(ow, 'money must be ≥ 0');
    for (const [who, step] of Object.entries(o.trust ?? {})) {
      if (!(who in ctx.contacts)) bad(ow, `trust names unknown contact ${who}`);
      if (!Number.isInteger(step) || Math.abs(step) > TRUST_STEP_MAX) {
        bad(ow, `trust step must be an integer ±${TRUST_STEP_MAX}`);
      }
    }
    if (typeof o.note !== 'string' || o.note.length === 0) bad(ow, 'note (the journal line) required');
    checkLines(`${ow}.reply`, o.reply ?? [], ctx);
  });
  if (s.options[0]?.set === s.options[1]?.set) bad(sw, 'the two options must set different flags');
}

function checkContacts(contacts) {
  if (!isObj(contacts) || Object.keys(contacts).length === 0) {
    return bad('arc.contacts', 'must be a non-empty object');
  }
  for (const [id, c] of Object.entries(contacts)) {
    const w = `arc.contacts.${id}`;
    if (!ID.test(id) || id === YOU) bad(w, 'id must be a-z/_ and not "you"');
    if (typeof c.name !== 'string' || c.name.length === 0) bad(w, 'name required');
    if (typeof c.role !== 'string' || c.role.length === 0) bad(w, 'role required');
    if (!HEX.test(c.color || '')) bad(w, 'color must be #rrggbb');
    if (!ATTITUDES.includes(c.attitude)) bad(w, `attitude must be one of ${ATTITUDES.join('/')}`);
  }
}

function checkPlaces(places) {
  if (!isObj(places) || Object.keys(places).length === 0) return bad('arc.places', 'must be a non-empty object');
  for (const [id, p] of Object.entries(places)) {
    const w = `arc.places.${id}`;
    if (!ID.test(id)) bad(w, 'id must be a-z/_');
    if (typeof p.name !== 'string' || p.name.length === 0) bad(w, 'name required');
    if (!inBounds(p.x, p.z)) bad(w, 'x/z must be inside the walkable district');
    if (p.r !== undefined && !(typeof p.r === 'number' && p.r > 0 && p.r <= PLACE_REACH_MAX)) {
      bad(w, `r must be in (0, ${PLACE_REACH_MAX}]`);
    }
  }
}

const within = (v, [lo, hi]) => typeof v === 'number' && v >= lo && v <= hi;

function checkArcSigns(signs, ctx) {
  if (!Array.isArray(signs)) return bad('arc.signs', 'must be an array');
  const ids = new Set();
  signs.forEach((s, i) => {
    const w = `arc.signs[${i}]`;
    if (typeof s.id !== 'string' || ids.has(s.id)) bad(w, 'id must be a unique string');
    ids.add(s.id);
    if (typeof s.if !== 'string' || !ctx.flags.has(s.if)) bad(w, 'if must name a flag an answer sets');
    if (!SIGN_KINDS.includes(s.kind)) bad(w, `kind must be ${SIGN_KINDS.join(' or ')}`);
    if (typeof s.text !== 'string' || s.text.length === 0 || s.text.length > SIGN_TEXT_MAX) {
      bad(w, `text must be 1–${SIGN_TEXT_MAX} chars`);
    }
    if (typeof s.sub !== 'string' || s.sub.length > SIGN_SUB_MAX) bad(w, `sub must be a string ≤ ${SIGN_SUB_MAX}`);
    if (!HEX.test(s.color || '') || !HEX.test(s.ink || '')) bad(w, 'color and ink must be #rrggbb');
    if (!inBounds(s.x, s.z)) bad(w, 'x/z must be inside the walkable district');
    if (!within(s.y, [0, SIGN_Y_MAX]) || !within(s.w, SIGN_W) || !within(s.h, SIGN_H)) bad(w, 'y/w/h out of range');
    if (!Array.isArray(s.face) || !FACES.includes(s.face.join(','))) bad(w, 'face must be an axis: [±1,0] or [0,±1]');
  });
}

function checkArcMission(m, i, ids, ctx) {
  const w = `arc.missions[${i}]`;
  if (typeof m.id !== 'string' || !ID.test(m.id)) bad(w, 'id must be a-z/_');
  if (typeof m.title !== 'string' || m.title.length === 0 || m.title.length > TITLE_MAX) {
    bad(w, `title must be 1–${TITLE_MAX} chars`);
  }
  if (!(m.contact in ctx.contacts)) bad(w, `unknown contact ${m.contact}`);
  if (typeof m.payout !== 'number' || m.payout < 0) bad(w, 'payout must be a number ≥ 0');
  checkLines(`${w}.brief`, m.brief ?? [], ctx);
  checkLines(`${w}.debrief`, m.debrief ?? [], ctx);
  if (!Array.isArray(m.steps) || m.steps.length === 0) bad(w, 'steps must be a non-empty array');
  else m.steps.forEach((s, j) => checkStep(`${w}.steps[${j}]`, s, { ...ctx, arc: true }));
  let targets = null;
  if (m.next === null) targets = [];
  else if (typeof m.next === 'string') targets = [m.next];
  else if (isObj(m.next)) targets = Object.values(m.next);
  if (targets === null) return bad(w, 'next must be null, a mission id, or { flag: mission id }');
  for (const t of targets) if (!ids.has(t)) bad(w, `next names unknown mission ${t}`);
  for (const f of isObj(m.next) ? Object.keys(m.next) : []) {
    if (!ctx.flags.has(f)) bad(w, `next branches on unknown flag ${f}`);
  }
}

// Play every way through the arc: each choice both ways, each branch followed.
// Every path must resolve its branches and end after exactly ARC_MISSIONS.
function walkArc(byId, start) {
  const reached = new Set();
  const walk = (id, flags, path) => {
    if (path.includes(id)) return bad('arc', `loop: ${[...path, id].join(' > ')}`);
    const m = byId.get(id);
    const here = [...path, id];
    reached.add(id);
    const choices = (m.steps ?? []).filter((s) => s.verb === 'choose');
    let ends = [flags];
    for (const c of choices) ends = ends.flatMap((f) => (c.options ?? []).map((o) => new Set([...f, o.set])));
    for (const f of ends) {
      if (m.next === null) {
        const n = here.length;
        if (n !== ARC_MISSIONS) bad('arc', `${here.join(' > ')} is ${n} missions, not ${ARC_MISSIONS}`);
        continue;
      }
      const hits = typeof m.next === 'string'
        ? [m.next]
        : Object.keys(m.next).filter((k) => f.has(k)).map((k) => m.next[k]);
      if (hits.length !== 1) bad('arc', `${here.join(' > ')}: next must resolve to one mission, got ${hits.length}`);
      else walk(hits[0], f, here);
    }
  };
  walk(start, new Set(), []);
  for (const id of byId.keys()) if (!reached.has(id)) bad('arc', `mission ${id} can never be reached`);
}

function checkArc(arc, ctx) {
  if (!isObj(arc)) return bad('arc.json', 'must be an object');
  checkContacts(arc.contacts);
  checkPlaces(arc.places);
  checkArcSigns(arc.signs, ctx);
  if (!Array.isArray(arc.missions) || arc.missions.length === 0) {
    return bad('arc.missions', 'must be a non-empty array');
  }
  const byId = new Map();
  arc.missions.forEach((m, i) => {
    if (byId.has(m.id)) bad(`arc.missions[${i}]`, `duplicate id ${m.id}`);
    byId.set(m.id, m);
  });
  const ids = new Set(byId.keys());
  arc.missions.forEach((m, i) => checkArcMission(m, i, ids, ctx));
  if (!byId.has(arc.start)) return bad('arc.start', `unknown mission ${arc.start}`);
  if (fails.length === 0) walkArc(byId, arc.start);
}

checkSigns(load('signs.json'));
const arc = load('arc.json');
const ctx = arcContext(arc);
checkMissions(load('missions.json'), ctx);
checkArc(arc, ctx);

if (fails.length) {
  console.error(`validate FAILED (${fails.length}):\n- ${fails.join('\n- ')}`);
  process.exit(1);
}
log('validate OK — signs + missions + arc schemas pass, every way through the arc is six missions');
