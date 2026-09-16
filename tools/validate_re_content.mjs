#!/usr/bin/env node
// re-011: rewrite content validator. Schemas for src/re/content/*.json.
// Usage: node tools/validate_re_content.mjs [--quiet]
// Exit non-zero on any violation — wire into gate before build.
import { readFileSync } from 'fs';

const QUIET = process.argv.includes('--quiet');
const log = (...a) => { if (!QUIET) console.log(...a); };
const fails = [];
const bad = (where, msg) => fails.push(`${where}: ${msg}`);

function load(rel) {
  try {
    return JSON.parse(readFileSync(new URL(`../src/re/content/${rel}`, import.meta.url)));
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

checkSigns(load('signs.json'));
checkMissions(load('missions.json'));

if (fails.length) {
  console.error(`validate:re FAILED (${fails.length}):\n- ${fails.join('\n- ')}`);
  process.exit(1);
}
log('validate:re OK — signs + missions schemas pass');
