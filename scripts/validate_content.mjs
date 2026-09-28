#!/usr/bin/env node
// Content schema validator for src/content/*.json.
// Usage: node scripts/validate_content.mjs [--quiet]
// Exit non-zero on any violation — wire into gate before build.
import { readFileSync } from 'fs';
import { AVENUES, CROSSINGS } from '../src/sim/world.js';

const QUIET = process.argv.includes('--quiet');
const log = (...a) => { if (!QUIET) console.log(...a); };
const fails = [];
const bad = (where, msg) => fails.push(`${where}: ${msg}`);

function load(rel) {
  try {
    return JSON.parse(readFileSync(new URL(`../src/content/${rel}`, import.meta.url)));
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

const VERBS = ['enter_car', 'blackout_zone', 'blackout_chain', 'profile_count', 'lose_heat'];

function checkMissions(data) {
  if (!Array.isArray(data) || data.length === 0) return bad('missions.json', 'must be a non-empty array');
  const ids = new Set();
  data.forEach((m, i) => {
    const w = `missions[${i}]`;
    if (typeof m.id !== 'string' || m.id.length === 0) bad(w, 'id must be a non-empty string');
    if (ids.has(m.id)) bad(w, `duplicate id ${m.id}`);
    ids.add(m.id);
    if (typeof m.payout !== 'number' || m.payout <= 0) bad(w, 'payout must be a positive number');
    if (!Array.isArray(m.steps) || m.steps.length === 0) return bad(w, 'steps must be a non-empty array');
    m.steps.forEach((s, j) => {
      const sw = `${w}.steps[${j}]`;
      if (!VERBS.includes(s.verb)) return bad(sw, `unknown verb ${s.verb}`);
      if (typeof s.label !== 'string' || s.label.length === 0) bad(sw, 'label required');
      if (s.verb === 'blackout_zone' && ![-1, 0, 1].includes(s.zone)) bad(sw, 'zone must be -1 (any), 0, or 1');
      if (s.verb === 'blackout_chain' && (!Array.isArray(s.zones) || s.zones.some((z) => ![0, 1].includes(z)))) {
        bad(sw, 'zones must be an array of 0/1');
      }
      if (s.verb === 'profile_count' && (!Number.isInteger(s.n) || s.n < 1 || s.n > 12)) {
        bad(sw, 'n must be an integer 1–12');
      }
    });
  });
}

// Every call the wanted sim can make (src/sim/wanted.js, src/sim/response.js).
// A new event means a line here and wording in dispatch.json; keep them in step.
const CALLS = [
  'tier_up_1', 'tier_up_2', 'tier_up_3', 'tier_down_2', 'tier_down_1', 'clear', 'spotted', 'lost',
  'spikes_down', 'spikes_hit', 'roadblock_up', 'rammed', 'heli_on_night', 'heli_on_day', 'heli_off', 'busted',
];
const SPEAKERS = ['dispatch', 'unit', 'block', 'air'];
const BLANKS = ['street', 'heading', 'mode', 'cause'];
// A subtitle, read in the half-second a player can spare mid-chase.
const LINE_MAX = 72;

function checkWordMap(where, map, keys) {
  if (!map || typeof map !== 'object') return bad(where, 'missing');
  for (const k of keys) if (typeof map[k] !== 'string' || !map[k]) bad(where, `needs a string for ${k}`);
}

function checkDispatch(data) {
  if (!data) return;
  const w = 'dispatch.json';
  checkWordMap(`${w}.speakers`, data.speakers, SPEAKERS);
  checkWordMap(`${w}.streets`, data.streets, [...AVENUES, ...CROSSINGS].map((way) => way.id));
  checkWordMap(`${w}.headings`, data.headings, ['n', 's', 'e', 'w']);
  checkWordMap(`${w}.modes`, data.modes, ['car', 'foot']);
  checkWordMap(`${w}.causes`, data.causes, ['blackout', 'speeding', 'evading']);
  for (const call of CALLS) {
    const lines = data.lines?.[call];
    if (!Array.isArray(lines) || lines.length === 0) {
      bad(`${w}.lines`, `needs at least one line for ${call}`);
      continue;
    }
    lines.forEach((l, i) => {
      const lw = `${w}.lines.${call}[${i}]`;
      if (!SPEAKERS.includes(l.by)) bad(lw, `by must be one of ${SPEAKERS.join(', ')}`);
      if (typeof l.say !== 'string' || l.say.length === 0 || l.say.length > LINE_MAX) {
        bad(lw, `say must be 1–${LINE_MAX} chars`);
      }
      for (const [, blank] of (l.say || '').matchAll(/\{(\w+)\}/g)) {
        if (!BLANKS.includes(blank)) bad(lw, `unknown blank {${blank}}`);
      }
    });
  }
  for (const call of Object.keys(data.lines || {})) {
    if (!CALLS.includes(call)) bad(`${w}.lines`, `${call} is never called`);
  }
}

checkSigns(load('signs.json'));
checkMissions(load('missions.json'));
checkDispatch(load('dispatch.json'));

if (fails.length) {
  console.error(`validate FAILED (${fails.length}):\n- ${fails.join('\n- ')}`);
  process.exit(1);
}
log('validate OK — signs + missions + dispatch schemas pass');
