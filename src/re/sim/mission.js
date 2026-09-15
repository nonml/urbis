// Mission GRID RUN: take the car, chain both blackouts inside one window,
// then lose the heat. Pure state machine — render reads, main advances events.
export const PAYOUT = 500;

export function createMission() {
  return {
    id: 'GRID RUN',
    balance: 0,
    phases: [
      'Get in the car (F)',
      'Blackout Zone 1',
      'Blackout Zone 0 — while Zone 1 burns',
      'Lose the heat (★★★ → ☆☆☆)',
    ],
    done: [false, false, false, false],
    complete: false,
    bannerUntil: 0,
    bannerText: '',
  };
}

export function missionNote(m, text, time, dur = 3) {
  m.bannerText = text;
  m.bannerUntil = time + dur;
}

// Called after any blackout change. zonesDark: [bool, bool].
export function missionOnBlackout(m, zonesDark) {
  if (m.complete) return;
  if (zonesDark[1]) m.done[1] = true;
  if (zonesDark[0] && zonesDark[1]) m.done[2] = true;
}

export function missionOnEnterCar(m) {
  if (!m.complete) m.done[0] = true;
}

// Called every tick: going clean after chaining both zones pays out.
export function missionOnHeatZero(m, heat, time) {
  if (m.complete || !m.done[2] || heat > 0) return;
  m.done[3] = true;
  m.complete = true;
  m.balance += PAYOUT;
  missionNote(m, `CONTRACT COMPLETE +₡${PAYOUT}`, time, 4);
}

export function missionReset(m) {
  m.done = [false, false, false, false];
  m.complete = false;
}
