// Data-driven contracts board (re-011). Mission defs live in
// src/re/content/missions.json; this module is the runner — pure state,
// no rendering. Render reads id/phases/done/balance via main.
import MISSION_DEFS from '../content/missions.json';

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
