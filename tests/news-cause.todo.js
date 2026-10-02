// The chain reads in one line (milestone 4): a firm a power cut drove out says
// so, because the cut's own line is often gone by the time the firm leaves.
import { test, expect } from '@playwright/test';
import { STAGE } from '../src/sim/zoning.js';
import { newsBetween, snapshot } from '../src/sim/news.js';

function fakeWorld() {
  const city = {
    parcels: [{ x: 0, z: 30, use: 'res', stage: STAGE.LOW }],
    economy: { districts: [{ id: 0, name: 'south', last: null }, { id: 1, name: 'north', last: null }] },
  };
  return { city, people: { list: [] }, street: { time: 100, zones: [{ darkUntil: 0 }, { darkUntil: 0 }] } };
}

test('a firm a power cut drove out says why; any other move does not', () => {
  const { city, people, street } = fakeWorld();
  const before = snapshot(city, people, street);
  city.economy.districts[1].last = { at: 1, use: 'ind', jobs: -22.6, cause: 'dark' };
  city.economy.districts[0].last = { at: 1, use: 'com', jobs: -6.2 };
  expect(newsBetween(before, snapshot(city, people, street), city)).toEqual([
    '6 office jobs left the south district',
    '23 workshop jobs left the north district after the power cut',
  ]);
});
