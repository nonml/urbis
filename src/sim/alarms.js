// M5.T14 (M5-5, docs/ROADMAP.md): the fire alarm a building can have.
//
// M6's FIRE ALARM hack sets one off (M6.T19, hackables.js fire_alarm) and the
// renderer will read it as the building's siren; the alarm is a deadline on
// the parcel and nothing else — pure data, no tick — so nothing in the frame
// loop has to know about it and a replay is stable. One gap for whoever wires
// it up: save.js snapshotParcel keeps a fixed list of parcel fields, so an
// alarm does not travel through a save until `alarmUntil` joins that list.
//
// A raised alarm clears after ALARM_SECS, or in half of that when a fire
// station reaches the building: inside the station's catchment and among the
// nearest buildings it can serve (SERVICES.fire, 300 m, capacity 64;
// ops.js serviceReach) — the same machinery that decides whether a building
// is served at all (decline.js servedIn), so a station whose catchment is
// full helps no one. The half is decided when the alarm is raised and held for
// its whole life: a station built later helps the next alarm, as two
// substations scale only the blackout they start in (M5.T12, street.js
// hackBlackout).
import { serviceReach, hasBuilding } from './ops.js';

// Game seconds a raised alarm rings for before it clears on its own.
export const ALARM_SECS = 120;

// The parcel's alarm deadline, 0 for a building that has never had one: a
// parcel carries no `alarmUntil` until an alarm is raised on it.
function deadline(p) {
  return p.alarmUntil ?? 0;
}

// How long an alarm raised on `parcel` now clears in: half when a fire station
// reaches it, whole when none does.
export function alarmClearSecs(parcels, parcel) {
  const reached = serviceReach(parcels, 'fire').has(parcel);
  return reached ? ALARM_SECS / 2 : ALARM_SECS;
}

// Is the alarm ringing at `at`?
export function alarmOn(parcel, at) {
  return deadline(parcel) > at;
}

// Seconds left on the alarm at `at`, 0 once it has cleared.
export function alarmLeft(parcel, at) {
  return Math.max(0, deadline(parcel) - at);
}

// Set a building's alarm off: it clears after alarmClearSecs. Only a standing
// building can have one — an empty lot or a site is refused — and only when it
// is not already ringing. The seconds set are returned, 0 when refused.
export function raiseAlarm(parcels, parcel, at) {
  if (!parcel || !hasBuilding(parcel) || deadline(parcel) > at) return 0;
  const secs = alarmClearSecs(parcels, parcel);
  parcel.alarmUntil = at + secs;
  return secs;
}

// The FIRE ALARM hack (sim/hackables.js fire_alarm, reach 'building'), fired at
// one registered building (M6.T19). Returns { secs, why }: the seconds it rings,
// or why it did not take — a building whose alarm already rings is not a second
// one, and nothing standing holds no alarm at all. The street reads the alarm
// back through alarmOn: walkers.js empties the building onto the pavement and
// shuts its door for as long as it rings.
export function hackFireAlarm(parcels, parcel, at) {
  const secs = raiseAlarm(parcels, parcel, at);
  if (secs > 0) return { secs, why: null };
  return { secs: 0, why: parcel && deadline(parcel) > at ? 'alarm already ringing' : 'no building to alarm' };
}
