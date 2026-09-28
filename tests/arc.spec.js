// The arc, proven without a browser; arc-game.spec.js is the half in the game.
// The sim is pure (law 5), so a synthetic player can walk every way through
// the story in milliseconds: it reads the step in hand, hands the arc a world
// where that step is true — standing at the place, the block dark, the heat
// gone — and answers each choice from a script. What the tests hold the arc to:
//
//   - every way through is six missions and ends, on each branch;
//   - a choice is remembered: later lines, contacts, signs and money read it,
//     and getting busted never takes it back;
//   - 1 and 2 do nothing unless a dialogue is open;
//   - the content validates, and a broken arc.json does not.
import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  ARC, arcChoose, arcObjective, arcSigns, arcTarget, attitudeOf, createArc, tickArc,
} from '../src/sim/arc.js';
import { activeStep, createRun, missionPoll } from '../src/sim/mission.js';
import { STAGE, STAGES, createCity, tickZoning } from '../src/sim/zoning.js';
import { createStreet, tickStreet } from '../src/sim/street.js';

const DT = 0.05;
const MAX_TICKS = 40000;
const SPAWN = { x: 2.5, z: 26 };
const SOLD = 1;
const WARNED = 2;
const TO_ARDEN = 1;
const TO_NELL = 2;

// Synthetic lots: the plaza lot the story is about, and a south site at work.
function lots(plazaStage = STAGE.SITE) {
  const building = (st) => st > STAGE.EMPTY && st < STAGE.HIGH;
  return [
    { x: -15.25, z: 56, stage: plazaStage, use: 'com', powerZone: 1, building: building(plazaStage) },
    { x: 29.25, z: -35.75, stage: STAGE.LOW, use: 'res', powerZone: 0, building: true },
    { x: 61.5, z: -55, stage: STAGE.HIGH, use: 'ind', powerZone: 0, building: false },
  ];
}

// A world in which the step in hand is true. Blackout steps come with heat,
// the way a real hack brings it; only the lose_heat step finds the heat gone.
function worldFor(arc, parcels, names) {
  const w = { ...SPAWN, inCar: false, dark: [false, false], heat: 0, profile: null, parcels, busted: false };
  const s = arc.run?.steps[activeStep(arc.run)];
  if (!s) return w;
  if (s.at) Object.assign(w, { x: s.at.x, z: s.at.z });
  if (s.verb === 'enter_car') w.inCar = true;
  if (s.verb === 'blackout_zone') Object.assign(w, { dark: [s.zone !== 1, s.zone === 1], heat: 1 });
  if (s.verb === 'blackout_chain') Object.assign(w, { dark: [true, true], heat: 2 });
  if (s.verb === 'stall_site') {
    const site = parcels.find((p) => p.powerZone === s.zone && p.building);
    Object.assign(w, { x: site.x + 10, z: site.z, heat: 1 });
    w.dark[s.zone] = true;
  }
  if (s.verb === 'profile_count') w.profile = `WALKER ${names.n++}`;
  return w;
}

// Plays the arc to the end. `answers` is the key pressed at each choice, in order.
function play(answers, { plazaStage = STAGE.SITE, onTick = () => {} } = {}) {
  const arc = createArc();
  const parcels = lots(plazaStage);
  const names = { n: 0 };
  const said = [];
  let wallet = 0;
  let asked = 0;
  let t = 0;
  // Past the end, until the last lines have been read out.
  for (let tick = 0; tick < MAX_TICKS && (!arc.finished || arc.dialogue); tick++) {
    t += DT;
    if (arc.dialogue?.options) expect(arcChoose(arc, answers[asked++], t)).toBe(true);
    const before = arc.dialogue;
    wallet += tickArc(arc, worldFor(arc, parcels, names), t);
    if (arc.dialogue && arc.dialogue !== before) said.push(...arc.dialogue.lines.map((l) => l.text));
    onTick(arc, t);
  }
  return { arc, wallet, said, asked };
}

const PATHS = [
  {
    answers: [SOLD, TO_ARDEN],
    missions: ['live_wire', 'site_visit', 'quiet_title', 'dead_air', 'crossed_wires', 'topping_out'],
    signs: ['bookshop_closing', 'lot_arden'],
    people: { ruf: 'warm', celeste: 'ally', nell: 'hostile' },
    bonus: 800 + 1500,
  },
  {
    answers: [SOLD, TO_NELL],
    missions: ['live_wire', 'site_visit', 'quiet_title', 'dead_air', 'crossed_wires', 'common_ground'],
    signs: ['bookshop_closing', 'lot_trust'],
    people: { ruf: 'hostile', celeste: 'cold', nell: 'wary' },
    bonus: 800,
  },
  {
    answers: [WARNED, TO_ARDEN],
    missions: ['live_wire', 'site_visit', 'stop_work', 'dead_air', 'crossed_wires', 'topping_out'],
    signs: ['bookshop_holdout', 'lot_arden'],
    people: { ruf: 'warm', celeste: 'wary', nell: 'wary' },
    bonus: 1500,
  },
  {
    answers: [WARNED, TO_NELL],
    missions: ['live_wire', 'site_visit', 'stop_work', 'dead_air', 'crossed_wires', 'common_ground'],
    signs: ['bookshop_holdout', 'lot_trust'],
    people: { ruf: 'hostile', celeste: 'hostile', nell: 'ally' },
    bonus: 0,
  },
];

const payout = (id) => ARC.missions.find((m) => m.id === id).payout;

for (const path of PATHS) {
  test(`the arc runs start to finish answering ${path.answers.join(' then ')}`, () => {
    const { arc, wallet, asked } = play(path.answers);
    expect(arc.finished).toBe(true);
    expect(arc.played).toEqual(path.missions);
    expect(arc.done.map((d) => d.id)).toEqual(path.missions);
    expect(asked).toBe(2);
    expect(arc.choices).toHaveLength(2);
    expect(arcSigns(arc).map((s) => s.id)).toEqual(path.signs);
    for (const [who, attitude] of Object.entries(path.people)) expect(attitudeOf(arc, who)).toBe(attitude);
    const earned = path.missions.reduce((sum, id) => sum + payout(id), 0) + path.bonus;
    expect(wallet).toBe(earned);
    expect(arc.earned).toBe(earned);
    expect(arcObjective(arc)).toBeNull();
    expect(arcTarget(arc, lots(), 0, 0)).toBeNull();
  });
}

test('a choice is remembered by every line, sign and person after it', () => {
  const sold = play([SOLD, TO_NELL]);
  const warned = play([WARNED, TO_NELL]);
  // Ruf's plan for the registry is told from the side you took.
  expect(sold.said).toContain(ARC.missions[4].brief[2].text);
  expect(sold.said).not.toContain(ARC.missions[4].brief[1].text);
  expect(warned.said).toContain(ARC.missions[4].brief[1].text);
  expect(warned.said).not.toContain(ARC.missions[4].brief[2].text);
  // Nell's last word is about the first choice, four missions later.
  expect(sold.said).toContain("We're square now. Don't come to West Avenue again.");
  expect(warned.said).toContain('The shop stays open. Come by. First book\'s still free.');
  expect(sold.arc.choices[0].note).toBe('You gave Arden the names on West Avenue.');
  expect(warned.arc.choices[0].note).toBe('You told Nell what Arden is planning.');
});

test('the plaza lot is read off the city: what Celeste says is what stands there', () => {
  for (const stage of [STAGE.EMPTY, STAGE.SITE, STAGE.MID, STAGE.HIGH]) {
    const { said, arc } = play([SOLD, TO_ARDEN], { plazaStage: stage });
    const read = ARC.missions[1].steps[1].say.filter((l) => l.if && [l.if].flat().includes(`lot:${STAGES[stage]}`));
    expect(read).toHaveLength(1);
    expect(said).toContain(read[0].text);
    expect(arc.flags[`lot:${STAGES[stage]}`]).toBe(true);
    expect(Object.keys(arc.flags).filter((f) => f.startsWith('lot:'))).toHaveLength(1);
  }
});

test('busted mid-mission rewinds the steps but never the choice before them', () => {
  // A small arc with a choice in the middle of a mission, so there is work after it.
  const def = structuredClone(ARC);
  const visit = def.missions[1];
  visit.steps.push({ verb: 'go_to', place: 'bookshop', label: 'Walk past the bookshop' });
  const arc = createArc(def);
  const parcels = lots();
  const names = { n: 0 };
  let t = 0;
  for (;;) {
    t += DT;
    if (arc.dialogue?.options) {
      arcChoose(arc, SOLD, t);
      break;
    }
    tickArc(arc, worldFor(arc, parcels, names), t);
  }
  expect(arc.mission.id).toBe('site_visit');
  const choiceStep = visit.steps.findIndex((s) => s.verb === 'choose');
  expect(activeStep(arc.run)).toBe(choiceStep + 1);
  const busted = { ...SPAWN, inCar: false, dark: [false, false], heat: 0, profile: null, parcels, busted: true };
  tickArc(arc, busted, (t += DT));
  expect(activeStep(arc.run)).toBe(choiceStep + 1);
  expect(arc.run.done.slice(0, choiceStep + 1).every(Boolean)).toBe(true);
  expect(arc.flags.sold_names).toBe(true);
  expect(arc.choices).toHaveLength(1);
  expect(arc.note.text).toContain('BUSTED');
  expect(arc.dialogue).toBeNull();
});

test('busted before a choice rewinds the whole mission, and asks again', () => {
  const arc = createArc();
  const parcels = lots();
  const names = { n: 0 };
  let t = 0;
  while (!(arc.mission.id === 'crossed_wires' && arc.dialogue?.options)) {
    t += DT;
    if (arc.dialogue?.options) arcChoose(arc, WARNED, t);
    tickArc(arc, worldFor(arc, parcels, names), t);
  }
  const busted = { ...SPAWN, inCar: false, dark: [false, false], heat: 0, profile: null, parcels, busted: true };
  tickArc(arc, busted, (t += DT));
  expect(activeStep(arc.run)).toBe(0);
  expect(arc.flags.ledger_arden).toBeUndefined();
  expect(arc.flags.warned_nell).toBe(true);
  // Back at the tavern, Ruf asks again.
  while (!arc.dialogue?.options) tickArc(arc, worldFor(arc, parcels, names), (t += DT));
  expect(arcChoose(arc, TO_NELL, t)).toBe(true);
  expect(arc.flags.ledger_nell).toBe(true);
});

test('1 and 2 do nothing unless a dialogue is open', () => {
  const arc = createArc();
  expect(arc.dialogue.options).toBeNull();
  // A plain line: 1 moves it along, 2 is not an answer to anything.
  expect(arcChoose(arc, 2, 0.1)).toBe(false);
  expect(arcChoose(arc, 1, 0.1)).toBe(true);
  expect(arc.dialogue).toBeNull();
  const before = JSON.stringify({ ...arc, def: null });
  expect(arcChoose(arc, 1, 0.2)).toBe(false);
  expect(arcChoose(arc, 2, 0.2)).toBe(false);
  expect(JSON.stringify({ ...arc, def: null })).toBe(before);
});

test('a line leaves on its own after a reading pause; a choice waits for an answer', () => {
  const arc = createArc();
  const parcels = lots();
  const quiet = { ...SPAWN, inCar: false, dark: [false, false], heat: 0, profile: null, parcels, busted: false };
  let t = 0;
  while (arc.dialogue && t < 60) tickArc(arc, quiet, (t += DT));
  expect(arc.dialogue).toBeNull();
  expect(t).toBeGreaterThan(5);
  const { arc: asking } = play([SOLD, TO_ARDEN], {
    onTick: (a) => { if (a.dialogue?.options) expect(a.dialogue.until).toBe(Infinity); },
  });
  expect(asking.finished).toBe(true);
});

test('stall_site takes a dark zone, a working crane, and a player close enough to see it', () => {
  const step = ARC.missions.find((m) => m.id === 'stop_work').steps[0];
  const parcels = lots();
  const site = parcels[1];
  const at = (x, z, dark) => ({ x, z, inCar: false, dark, heat: 1, profile: null, parcels });
  const poll = (w) => missionPoll(createRun([step]), w);
  expect(poll(at(site.x, site.z, [false, false]))).toBe(-1);
  expect(poll(at(site.x, site.z + 200, [true, false]))).toBe(-1);
  const idle = parcels.map((p) => ({ ...p, building: false }));
  expect(missionPoll(createRun([step]), { ...at(site.x, site.z, [true, false]), parcels: idle })).toBe(-1);
  expect(poll(at(site.x, site.z, [true, false]))).toBe(0);
});

test('the marker stands on the place in hand and steps aside once the player arrives', () => {
  const arc = createArc();
  const parcels = lots();
  arc.run.done[0] = true;
  const substation = ARC.places.substation_s;
  expect(arcTarget(arc, parcels, SPAWN.x, SPAWN.z)).toEqual({ x: substation.x, z: substation.z });
  expect(arcTarget(arc, parcels, substation.x, substation.z)).toBeNull();
  expect(arcObjective(arc)).toEqual({ title: 'LIVE WIRE', contact: 'ruf', label: 'Drive to the south substation' });
});

test('on the real city the arc finds a real lot and a real crane', () => {
  const city = createCity(20260916);
  const street = createStreet(20260916);
  for (let i = 0; i < 20 / DT; i++) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
  }
  const visit = createRun(ARC.missions[1].steps, ARC.places);
  visit.done[0] = true;
  const lot = ARC.places.plaza_lot;
  expect(missionPoll(visit, { x: lot.x, z: lot.z, parcels: city.parcels })).toBe(1);
  const away = (p) => Math.hypot(p.x - lot.x, p.z - lot.z);
  const nearest = city.parcels.reduce((a, b) => (away(a) < away(b) ? a : b));
  expect(visit.lot).toEqual({ stage: STAGES[nearest.stage], use: nearest.use });
  const stop = createArc();
  stop.run = createRun(ARC.missions.find((m) => m.id === 'stop_work').steps, ARC.places);
  const target = arcTarget(stop, city.parcels, 0, -30);
  const site = city.parcels.find((p) => p.x === target.x && p.z === target.z);
  expect(site.powerZone).toBe(0);
});

test('the same answers play the same arc', () => {
  const strip = ({ arc, wallet, said }) => JSON.stringify({ ...arc, def: null, wallet, said });
  expect(strip(play([WARNED, TO_ARDEN]))).toBe(strip(play([WARNED, TO_ARDEN])));
});

// ---- the validator: the content passes, and a broken arc does not ----------

function validate(dir) {
  const args = ['scripts/validate_content.mjs', '--quiet'];
  const r = spawnSync(process.execPath, dir ? [...args, '--dir', dir] : args, { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function brokenCopy(breakIt) {
  const dir = mkdtempSync(join(tmpdir(), 'urbis-arc-'));
  cpSync('src/content', dir, { recursive: true });
  const arc = JSON.parse(readFileSync(join(dir, 'arc.json'), 'utf8'));
  breakIt(arc);
  writeFileSync(join(dir, 'arc.json'), JSON.stringify(arc));
  return dir;
}

test('the shipped content validates, and so does an untouched copy of it', () => {
  expect(validate()).toEqual({ status: 0, out: '' });
  expect(validate(brokenCopy(() => {}))).toEqual({ status: 0, out: '' });
});

const BREAKS = [
  ['an unknown verb', (a) => { a.missions[0].steps[0].verb = 'teleport'; }, 'unknown verb teleport'],
  ['a branch to nowhere', (a) => { a.missions[1].next.sold_names = 'nowhere'; }, 'unknown mission nowhere'],
  ['a short way through', (a) => { a.missions[0].next = 'crossed_wires'; }, 'is 3 missions, not 6'],
  ['three answers', (a) => { a.missions[1].steps[3].options.push({ ...a.missions[1].steps[3].options[0], key: 3 }); },
    'exactly 2 options'],
  ['a line on a flag nothing sets', (a) => { a.missions[0].brief[0].if = 'met_the_mayor'; },
    'unknown flag met_the_mayor'],
  ['a sign off the map', (a) => { a.signs[0].x = 500; }, 'inside the walkable district'],
  ['a place nobody defined', (a) => { a.missions[0].steps[1].place = 'the_moon'; }, 'unknown place the_moon'],
  ['a choice on the contracts board', null, 'arc-only'],
];

for (const [what, breakIt, message] of BREAKS) {
  test(`a malformed arc fails the validator: ${what}`, () => {
    let dir;
    if (breakIt) dir = brokenCopy(breakIt);
    else {
      dir = brokenCopy(() => {});
      const board = JSON.parse(readFileSync(join(dir, 'missions.json'), 'utf8'));
      board[0].steps.push({ verb: 'choose', label: 'Pick one' });
      writeFileSync(join(dir, 'missions.json'), JSON.stringify(board));
    }
    const r = validate(dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain(message);
  });
}

