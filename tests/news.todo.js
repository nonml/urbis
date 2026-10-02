// The city tells the player what just changed (milestone 3): lots breaking
// ground, topping out and coming down, firms moving jobs, the power going and
// coming back, people moving in and out, each said once and gone after a while.
import { test, expect } from '@playwright/test';
import { STAGE } from '../src/sim/zoning.js';
import { address } from '../src/sim/decline.js';
import {
  CROWD, NEWS_MAX, NEWS_SECS, createNews, liveNews, newsBetween, snapshot, tickNews,
} from '../src/sim/news.js';

// A small city the news can read: two districts, three lots.
function fakeWorld() {
  const city = {
    parcels: [
      { x: 0, z: 30, use: 'res', stage: STAGE.EMPTY },
      { x: 44, z: 0, use: 'com', stage: STAGE.MID },
      { x: -44, z: -60, use: 'ind', stage: STAGE.LOW },
    ],
    economy: { districts: [{ id: 0, name: 'south', last: null }, { id: 1, name: 'north', last: null }] },
  };
  const people = { list: Array.from({ length: 20 }, () => ({})) };
  const street = { time: 100, zones: [{ darkUntil: 0 }, { darkUntil: 0 }] };
  return { city, people, street };
}

test('a lot says when it breaks ground, tops out and comes down, and nothing else', () => {
  const { city, people, street } = fakeWorld();
  const before = snapshot(city, people, street);
  city.parcels[0].stage = STAGE.SITE;
  city.parcels[1].stage = STAGE.HIGH;
  city.parcels[2].stage = STAGE.EMPTY;
  expect(newsBetween(before, snapshot(city, people, street), city)).toEqual([
    `Flats breaking ground at ${address(0, 30)}`,
    `Offices topped out at ${address(44, 0)}`,
    `Workshops at ${address(-44, -60)} came down`,
  ]);
  expect(address(0, 30)).toBe('Main & Plaza');
  const quiet = snapshot(city, people, street);
  city.parcels[0].stage = STAGE.LOW;
  city.parcels[1].stage = STAGE.MID;
  expect(newsBetween(quiet, snapshot(city, people, street), city), 'growing or slumping a stage is not news').toEqual([]);
});

test('the power going and coming back is news, first', () => {
  const { city, people, street } = fakeWorld();
  const before = snapshot(city, people, street);
  street.zones[1].darkUntil = 200;
  city.parcels[0].stage = STAGE.SITE;
  const dark = snapshot(city, people, street);
  expect(newsBetween(before, dark, city)).toEqual([
    'Power cut in the north district',
    `Flats breaking ground at ${address(0, 30)}`,
  ]);
  street.time = 250;
  expect(newsBetween(dark, snapshot(city, people, street), city)).toEqual(['Power back in the north district']);
});

test('a firm moving is news once, rounded, and a zero move says nothing', () => {
  const { city, people, street } = fakeWorld();
  const before = snapshot(city, people, street);
  city.economy.districts[0].last = { at: 1, use: 'com', jobs: 11.6 };
  city.economy.districts[1].last = { at: 1, use: 'ind', jobs: -7.2 };
  const moved = snapshot(city, people, street);
  expect(newsBetween(before, moved, city)).toEqual([
    '12 office jobs moved into the south district',
    '7 workshop jobs left the north district',
  ]);
  expect(newsBetween(moved, snapshot(city, people, street), city), 'the same move twice').toEqual([]);
  city.economy.districts[0].last = { at: 2, use: 'com', jobs: 0.4 };
  expect(newsBetween(moved, snapshot(city, people, street), city)).toEqual([]);
});

test('tickNews keeps the newest lines, counts people in crowds, and liveNews lets them go', () => {
  const { city, people, street } = fakeWorld();
  const news = createNews();
  tickNews(news, city, people, street);
  expect(news.items, 'the first frame is the baseline').toEqual([]);
  expect(news.residents).toBe(20);
  people.list.push({}, {}, {}, {});
  tickNews(news, city, people, street);
  expect(news.items, `fewer than ${CROWD} is not a crowd`).toEqual([]);
  people.list.push({});
  street.time = 110;
  tickNews(news, city, people, street);
  expect(news.items).toEqual([{ at: 110, text: '5 people moved into the city' }]);
  expect(news.residents).toBe(25);
  people.list.length = 18;
  city.parcels[0].stage = STAGE.SITE;
  street.time = 115;
  tickNews(news, city, people, street);
  expect(news.items.map((i) => i.text)).toEqual([
    '5 people moved into the city',
    `Flats breaking ground at ${address(0, 30)}`,
    '7 people moved out of the city',
  ]);
  for (const [k, use] of ['com', 'ind', 'com'].entries()) {
    city.economy.districts[0].last = { at: k, use, jobs: 3 + k };
    street.time = 116 + k;
    tickNews(news, city, people, street);
  }
  expect(news.items.length).toBe(NEWS_MAX);
  expect(news.items[0].text, 'the oldest go first').toBe('7 people moved out of the city');
  expect(liveNews(news, 118)).toEqual(news.items.map((i) => i.text));
  expect(liveNews(news, 115 + NEWS_SECS)).toEqual(news.items.slice(1).map((i) => i.text));
  expect(liveNews(news, 118 + NEWS_SECS)).toEqual([]);
});
