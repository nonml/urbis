// New Game makes a generated city (milestone 2): a player with no save gets a
// fresh generated city, a continued game keeps the world it was saved in (an
// old save is a hand-preset game), automated runs stay on the hand preset, and
// a URL that picks the world never touches the save.
import { test, expect } from '@playwright/test';
import { FIXED_SEED, pickWorld } from '../src/sim/newgame.js';

const NOW = 1_759_500_000_123;
const FRESH = NOW % 2147483647;
const human = (search = '', saved = null) => pickWorld({ search, webdriver: false, saved, now: NOW });
const robot = (search = '', saved = null) => pickWorld({ search, webdriver: true, saved, now: NOW });
const save = (o) => JSON.stringify({ version: 2, ...o });

test('a player with no save gets a fresh generated city and keeps it saved', () => {
  expect(human()).toEqual({ seed: FRESH, generate: true, saving: true });
  expect(human('', 'not json')).toEqual({ seed: FRESH, generate: true, saving: true });
  expect(human('', save({ seed: 0 }))).toEqual({ seed: FRESH, generate: true, saving: true });
  expect(pickWorld({ search: '', webdriver: false, saved: null, now: 2147483647 * 3 }).seed).toBe(1);
});

test('a continued game keeps the world it was saved in', () => {
  expect(human('', save({ seed: 777, generate: true }))).toEqual({ seed: 777, generate: true, saving: true });
  expect(human('', save({ seed: 777 })), 'an old save is a hand-preset game').toEqual({ seed: 777, generate: false, saving: true });
  expect(human('', save({ seed: 777, generate: 'yes' }))).toEqual({ seed: 777, generate: false, saving: true });
});

test('a URL that picks the world replays it and never touches the save', () => {
  const s = save({ seed: 777, generate: true });
  expect(human('?seed=5', s)).toEqual({ seed: 5, generate: true, saving: false });
  expect(human('?seed=5&gen=0', s)).toEqual({ seed: 5, generate: false, saving: false });
  expect(human('?gen=0', s)).toEqual({ seed: FRESH, generate: false, saving: false });
  expect(human('?gen=1', s)).toEqual({ seed: FRESH, generate: true, saving: false });
  for (const bad of ['?seed=0', '?seed=abc', '?seed=-4', `?seed=${2 ** 31}`, '?seed=1.5']) {
    expect(human(bad, s), bad).toEqual({ seed: 777, generate: true, saving: true });
  }
  expect(human('?gen=2', s), 'only 0 and 1 pick').toEqual({ seed: 777, generate: true, saving: true });
});

test('automated runs stay on the hand preset unless the URL says otherwise', () => {
  const s = save({ seed: 777, generate: true });
  expect(robot()).toEqual({ seed: FIXED_SEED, generate: false, saving: false });
  expect(robot('', s), 'a robot never reads the save').toEqual({ seed: FIXED_SEED, generate: false, saving: false });
  expect(robot('?gen=1')).toEqual({ seed: FIXED_SEED, generate: true, saving: false });
  expect(robot('?gen=1&seed=7')).toEqual({ seed: 7, generate: true, saving: false });
  expect(robot('?capture=1&seed=7')).toEqual({ seed: 7, generate: false, saving: false });
  expect(robot('?savetest=1', s)).toEqual({ seed: 777, generate: true, saving: true });
  expect(robot('?savetest=1', save({ seed: 777 }))).toEqual({ seed: 777, generate: false, saving: true });
  expect(robot('?savetest=1')).toEqual({ seed: FIXED_SEED, generate: false, saving: true });
});
