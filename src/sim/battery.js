// M6.T4 (M6-3, docs/ROADMAP.md): the phone's battery.
//
// One meter pays for every hack the registry offers. Each hack spends its cost
// when it fires; one the battery cannot pay for does not fire, and the HUD says
// why. Holding Q (Focus) slows the game to 0.3x for up to FOCUS_SECS and drains
// the same meter while it is held.
//
// The costs are the registry's own (sim/hackables.js HACKS) and are transcribed
// one for one in docs/HACKING.md, with the refill and focus rates beside them.
// Pure: no three.js, no DOM, no RNG (law 5). The clock is the street sim's own,
// so the battery keeps its place beside every counter the fixed step advances.
import { HACKS } from './hackables.js';

// Feel values (docs/ROADMAP.md rule 10), each written in docs/HACKING.md with
// the reason it was tuned to what it is. One full meter is one full focus.
export const BATTERY_MAX = 100;
export const REFILL_PER_SEC = 1;
export const FOCUS_DRAIN_PER_SEC = 25;
export const FOCUS_SPEED = 0.3;
export const FOCUS_SECS = 4;
// How long a refusal stays named on the HUD, in game seconds.
const NOTE_SECS = 2.5;

export function createBattery(level = BATTERY_MAX) {
  return { level, note: null, noteLeft: 0 };
}

// The cost of one hack, read from the registry that fires it.
export function hackCost(id) {
  return HACKS[id]?.cost ?? 0;
}

// The level as 0..1: what the HUD's readout scales and a check reads.
export function batteryLevel(b) {
  return (b?.level ?? 0) / BATTERY_MAX;
}

export function batteryCanPay(b, hack) {
  return b.level >= hack.cost;
}

// Name why a hack did not fire, for NOTE_SECS of game time. The HUD shows it
// until the meter has had time to say it.
export function batteryRefuse(b, hack) {
  b.note = `no battery — ${hack.name} costs ${hack.cost}`;
  b.noteLeft = NOTE_SECS;
  return b;
}

// The reason the last hack did not fire, while the HUD is still naming it.
export function batteryNote(b) {
  return b?.note ?? null;
}

// Spend one hack's cost. A battery that cannot pay spends nothing and says
// why, leaving the caller to not fire. Returns { ok, battery, reason }.
export function batterySpend(b, hack) {
  if (!batteryCanPay(b, hack)) {
    const reason = batteryRefuse(b, hack).note;
    return { ok: false, battery: b, reason };
  }
  b.level -= hack.cost;
  b.note = null;
  b.noteLeft = 0;
  return { ok: true, battery: b, reason: null };
}

// Advance the meter by `secs` of game time: it refills when nothing is being
// spent and drains while focus is held, and never past either end.
export function batteryTick(b, secs, focusing = false) {
  const rate = focusing ? -FOCUS_DRAIN_PER_SEC : REFILL_PER_SEC;
  b.level = Math.max(0, Math.min(BATTERY_MAX, b.level + rate * secs));
  b.noteLeft = Math.max(0, b.noteLeft - secs);
  if (b.noteLeft <= 0) b.note = null;
  return b;
}
