// Data-driven contracts board (re-011). Mission defs live in
// src/re/content/missions.json; this module is the runner — pure state,
// no rendering. Render reads id/phases/done/balance via main.
import MISSION_DEFS from '../content/missions.json' with { type: 'json' };
import { STAGES } from './zoning.js';

export { MISSION_DEFS };

function loadDef(m, idx) {
  const def = m.defs[idx];
  m.idx = idx;
  m.id = def.id;
  m.payout = def.payout;
  m.steps = def.steps;
  m.done = def.steps.map(() => false);
  m.seen = {};
  m.complete = false;
  syncPhases(m);
}

function profileTotal(m) {
  return Object.keys(m.seen).length;
}

function syncPhases(m) {
  m.phases = m.steps.map((s) => {
    if (s.verb === 'profile_count') return `${s.label} (${Math.min(profileTotal(m), s.n)}/${s.n})`;
    return s.label;
  });
}

export function createMission(defs = MISSION_DEFS) {
  const m = { defs, balance: 0, bannerUntil: 0, bannerText: '' };
  loadDef(m, 0);
  return m;
}

export function missionNote(m, text, time, dur = 3) {
  m.bannerText = text;
  m.bannerUntil = time + dur;
}

function allWorkDone(m) {
  return m.steps.every((s, i) => s.verb === 'lose_heat' || m.done[i]);
}

// Called after any blackout change. zonesDark: [bool, bool].
export function missionOnBlackout(m, zonesDark) {
  if (m.complete) return;
  m.steps.forEach((s, i) => {
    if (s.verb === 'blackout_zone') {
      if (s.zone === -1 ? (zonesDark[0] || zonesDark[1]) : zonesDark[s.zone]) m.done[i] = true;
    } else if (s.verb === 'blackout_chain') {
      if (s.zones.every((z) => zonesDark[z])) m.done[i] = true;
    }
  });
  syncPhases(m);
}

export function missionOnEnterCar(m) {
  if (m.complete) return;
  m.steps.forEach((s, i) => { if (s.verb === 'enter_car') m.done[i] = true; });
  syncPhases(m);
}

export function missionOnProfile(m, name) {
  if (m.complete || !name) return;
  m.seen[name] = true;
  m.steps.forEach((s, i) => {
    if (s.verb === 'profile_count' && profileTotal(m) >= s.n) m.done[i] = true;
  });
  syncPhases(m);
}

// Called every tick: going clean after the work pays out and deals the
// next contract — the board never runs dry.
export function missionOnHeatZero(m, heat, time) {
  if (m.complete || !allWorkDone(m) || heat > 0) return;
  m.steps.forEach((s, i) => { if (s.verb === 'lose_heat') m.done[i] = true; });
  m.complete = true;
  m.balance += m.payout;
  const next = (m.idx + 1) % m.defs.length;
  const paid = m.payout;
  const nextId = m.defs[next].id;
  loadDef(m, next);
  missionNote(m, `CONTRACT COMPLETE +₡${paid} — NEW CONTRACT: ${nextId}`, time, 4);
}

export function missionReset(m) {
  loadDef(m, m.idx);
}

// The contract board a save left in play (sim/save.js). Progress is worth
// restoring because the board pays out on completion: without it a reload
// would pay for the same contract twice. Returns null on a snapshot that does
// not fit this content — a corrupt save is a missing save.
export function missionRestore(m, saved) {
  const def = Number.isInteger(saved.idx) ? m.defs[saved.idx] : null;
  const ok = def
    && Array.isArray(saved.done) && saved.done.length === def.steps.length
    && saved.seen && typeof saved.seen === 'object'
    && Number.isFinite(saved.balance) && Number.isFinite(saved.bannerUntil)
    && typeof saved.bannerText === 'string'
    && typeof saved.complete === 'boolean';
  if (!ok) return null;
  loadDef(m, saved.idx);
  m.done = saved.done.map((d) => !!d);
  m.seen = Object.fromEntries(Object.keys(saved.seen).map((k) => [k, true]));
  m.complete = saved.complete;
  m.balance = saved.balance;
  m.bannerUntil = saved.bannerUntil;
  m.bannerText = saved.bannerText;
  syncPhases(m);
  return m;
}

// ---------------------------------------------------------------------------
// Runs: the same verbs, played in order. The contracts board above takes its
// steps in any order and hears about the world through events. A story cannot:
// "drive to the substation, then kill its block" means nothing if the blackout
// already happened on the way. So a run takes one step at a time, and the
// world is polled as a snapshot — what is true right now — which is also what
// makes a step that is already satisfied when it comes up complete at once.
//
// Snapshot: { x, z, inCar, dark: [bool, bool], heat, profile, parcels }.
// `profile` is the name the profiler read this tick, or null. `parcels` is
// city.parcels, read and never written: the arc does not own the city.

// Metres. Close enough to have arrived somewhere, unless the place says.
const ARRIVE_RADIUS = 6;
// Metres. Close enough to watch a crane stop: the length of a city block.
const SITE_WATCH_RADIUS = 40;
// Metres. How far a place may sit from the lot it names.
const LOT_SEARCH_RADIUS = 25;

export function createRun(steps, places = {}) {
  const run = {
    steps: steps.map((s) => withPlace(s, places)),
    done: steps.map(() => false),
    seen: {},
    lot: null,
    choice: null,
  };
  syncPhases(run);
  return run;
}

function withPlace(s, places) {
  const p = s.place ? places[s.place] : null;
  if (!p) return s;
  return { ...s, at: { x: p.x, z: p.z, r: s.radius ?? p.r ?? ARRIVE_RADIUS, name: p.name } };
}

export function activeStep(run) {
  return run.done.indexOf(false);
}

export function isNear(at, x, z) {
  return Math.hypot(at.x - x, at.z - z) <= at.r;
}

// The lot a place stands on: the nearest parcel, if one is close enough.
export function lotAt(parcels, at) {
  let best = null;
  let bestD = LOT_SEARCH_RADIUS;
  for (const p of parcels) {
    const d = Math.hypot(p.x - at.x, p.z - at.z);
    if (d <= bestD) { best = p; bestD = d; }
  }
  return best;
}

function siteWorking(p, zone) {
  return p.powerZone === zone && p.building;
}

// The site a stall_site step is about: the working one nearest the player, or
// failing that the nearest lot in the zone, so the marker always has a target.
export function siteFor(parcels, zone, x, z) {
  let best = null;
  let bestScore = Infinity;
  for (const p of parcels) {
    if (p.powerZone !== zone) continue;
    const score = Math.hypot(p.x - x, p.z - z) + (p.building ? 0 : 1e4);
    if (score < bestScore) { best = p; bestScore = score; }
  }
  return best;
}

function readLot(s, w, m) {
  if (!isNear(s.at, w.x, w.z)) return false;
  const p = lotAt(w.parcels, s.at);
  m.lot = p ? { stage: STAGES[p.stage], use: p.use } : null;
  return true;
}

function profileNear(s, w, m) {
  if (w.profile && (!s.at || isNear(s.at, w.x, w.z))) m.seen[w.profile] = true;
  return profileTotal(m) >= s.n;
}

function stallSite(s, w) {
  if (!w.dark[s.zone]) return false;
  const reach = s.radius ?? SITE_WATCH_RADIUS;
  return w.parcels.some((p) => siteWorking(p, s.zone) && Math.hypot(p.x - w.x, p.z - w.z) <= reach);
}

// What each verb needs to be true of the world. `choose` is absent on purpose:
// only the player's answer completes it (missionOnChoice).
const WORLD_VERBS = {
  enter_car: (s, w) => w.inCar,
  go_to: (s, w) => isNear(s.at, w.x, w.z),
  read_lot: readLot,
  blackout_zone: (s, w) => (s.zone === -1 ? w.dark[0] || w.dark[1] : w.dark[s.zone]),
  blackout_chain: (s, w) => s.zones.every((z) => w.dark[z]),
  profile_count: profileNear,
  stall_site: stallSite,
  lose_heat: (s, w) => w.heat === 0,
};

// Returns the index of the step this snapshot completed, or -1.
export function missionPoll(run, world) {
  const i = activeStep(run);
  if (i < 0) return -1;
  const s = run.steps[i];
  const met = WORLD_VERBS[s.verb]?.(s, world, run) ?? false;
  if (met) run.done[i] = true;
  // Only a finished step or a new name changes a label; the rest is every frame.
  if (met || world.profile) syncPhases(run);
  return met ? i : -1;
}

// The player's answer to the choose step in hand. Returns false, and changes
// nothing, when the step in hand is not a choice or the key is not an option.
export function missionOnChoice(run, key) {
  const i = activeStep(run);
  const s = run.steps[i];
  if (!s || s.verb !== 'choose') return false;
  const option = s.options.find((o) => o.key === key);
  if (!option) return false;
  run.choice = option;
  run.done[i] = true;
  syncPhases(run);
  return true;
}

// Busted mid-run: everything after step `keep` is undone. A choice is never
// undone — the arc rewinds to just past the last one it recorded.
export function missionRewind(run, keep) {
  run.done = run.done.map((d, i) => d && i <= keep);
  run.seen = {};
  syncPhases(run);
}
