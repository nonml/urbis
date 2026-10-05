// M7.T17 (M7-10): the music — every track CC0, pinned to its sha256 in
// tools/sounds/fetch.sh and recorded in public/assets/CREDITS.md, exactly as
// M7.T2's sounds are; the title theme at the title, and a mission score that is
// calm until wanted.js has the suspect in contact, then settles back once the
// chase is lost. Node-only: musicPlan is pure, so the check lists the playing
// tracks per pose with no browser and no AudioContext (the criterion's words).
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  TITLE, SCORE_CALM, SCORE_URGENT, MUSIC_FILES, musicPlan, isChase, createMusic,
} from '../../src/audio/music.js';
import { createWanted, forceTier, forceSearch, tickWanted } from '../../src/sim/wanted.js';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT));
// The music rows carry a leading `music|` tag, so M7.T2's roster — plain
// four-field rows, and every file in public/assets/sounds/ is a sound — only
// ever sees the sounds.
const rowRe = /^music\|([a-z0-9_]+\.mp3)\|([^\s|]+)\|([^\s|]+)\|([0-9a-f]{64})$/gm;
const rows = [...read('tools/sounds/fetch.sh').toString().matchAll(rowRe)]
  .map(([, file, page, url, sha]) => ({ file, page, url, sha }));

// A stand-in for audio/engine.js, recording what createMusic asks of it.
function fakeAudio() {
  const log = [];
  return {
    log,
    play(name, buffer, opts = {}) {
      log.push(['play', name, opts]);
      return { name, buffer };
    },
    update(entry, patch = {}) {
      log.push(['update', entry.name, patch]);
      return entry;
    },
    stop(entry) {
      log.push(['stop', entry.name]);
    },
  };
}
const BUFFERS = Object.fromEntries(Object.keys(MUSIC_FILES).map((n) => [n, { track: n }]));
const names = (plan) => plan.map((s) => s.name);
const events = (audio, kind) => audio.log.filter(([t]) => t === kind).map(([, n]) => n);

test('M7.T17: every music track is pinned in fetch.sh, apart from the sounds', () => {
  for (const [name, path] of Object.entries(MUSIC_FILES)) {
    const file = `${name}.mp3`;
    expect(path, `${name} is served from public/assets/music/`).toBe(`assets/music/${file}`);
    const row = rows.find((r) => r.file === file);
    expect(row, `fetch.sh pins ${file}`).toBeTruthy();
    expect(row.url, `${file} downloads from a pinned URL`).toMatch(/^https:\/\//);
    // The bytes are the asset task's to land; a file that is present must still
    // match its pin, so a wrong or corrupt download cannot pass once committed.
    const onDisk = new URL(`public/assets/music/${file}`, ROOT);
    if (existsSync(onDisk)) {
      expect(createHash('sha256').update(readFileSync(onDisk)).digest('hex'),
        `${file} matches its pin`).toBe(row.sha);
    }
  }
  expect(new Set(rows.map((r) => r.file)).size, 'fetch.sh lists no track twice').toBe(rows.length);
  expect(rows.length, 'fetch.sh pins every track music plays').toBeGreaterThanOrEqual(Object.keys(MUSIC_FILES).length);
});

test('M7.T17: every music track is in CREDITS.md with its CC0 source', () => {
  const credits = read('public/assets/CREDITS.md').toString();
  for (const name of Object.keys(MUSIC_FILES)) {
    const file = `${name}.mp3`;
    const row = rows.find((r) => r.file === file);
    const line = credits.split('\n').find((l) => l.includes(file));
    expect(line, `${file} in CREDITS.md`).toBeTruthy();
    expect(line, `${file} is CC0`).toContain('CC0');
    expect(line, `${file} names its source`).toContain(row.page);
  }
});

test('M7.T17: the title theme, then a score that rises with the chase and settles', () => {
  const mission = { id: 'LIVE WIRE', title: 'LIVE WIRE' };
  expect(musicPlan({ scene: 'play' }), 'play with no mission is silence').toEqual([]);
  expect(names(musicPlan({ scene: 'title' })), 'the title theme at the title').toEqual([TITLE]);
  expect(names(musicPlan({ mission })), 'a calm score under the mission').toEqual([SCORE_CALM]);

  // wanted.js starts the chase, as the game loop passes it: forceTier is its
  // own capture hook, so this reads the real sim's heat and contact fields.
  const wanted = createWanted();
  forceTier(wanted, 1, { x: 0, z: 0, yaw: 0 }, 0);
  expect(isChase({ wanted })).toBe(true);
  expect(names(musicPlan({ mission, wanted })), 'contact turns the score urgent').toEqual([SCORE_URGENT]);

  // Losing the trail settles the score while the search runs, and running the
  // tier out (tickWanted, hero far from the search centre) leaves it calm.
  forceSearch(wanted, 60, 60, 0, 1, 0);
  expect(isChase({ wanted }), 'a lost trail is not a chase').toBe(false);
  expect(names(musicPlan({ mission, wanted }))).toEqual([SCORE_CALM]);
  const hero = {
    x: 0, z: 0, yaw: 0, inCar: false, cover: false, night: 0.5,
    car: { speed: 0, flat: 0 }, body: { x: 0, z: 0, speed: 0 },
  };
  for (let t = 2; t <= 22 && wanted.heat > 0; t += 1) tickWanted(wanted, 1, hero, t);
  expect(wanted.heat, 'the search runs the tier out').toBe(0);
  expect(names(musicPlan({ mission, wanted })), 'the chase over, the score stays calm').toEqual([SCORE_CALM]);
});

test('M7.T17: createMusic swaps the loops as the pose turns urgent and settles', () => {
  const audio = fakeAudio();
  const music = createMusic(audio, BUFFERS);
  const mission = { id: 'LIVE WIRE' };
  const wanted = createWanted();
  forceTier(wanted, 2, { x: 0, z: 0, yaw: 0 }, 0);

  expect(names(music.update({ scene: 'title' }))).toEqual([TITLE]);
  expect(events(audio, 'play'), 'the title loops').toEqual([TITLE]);
  music.update({ mission });
  expect(events(audio, 'play'), 'the calm score replaces the title').toEqual([TITLE, SCORE_CALM]);
  expect(events(audio, 'stop'), 'and the title is let go').toEqual([TITLE]);
  music.update({ mission, wanted });
  expect(events(audio, 'play'), 'contact raises the chase track').toEqual([TITLE, SCORE_CALM, SCORE_URGENT]);
  expect(events(audio, 'stop')).toEqual([TITLE, SCORE_CALM]);
  forceSearch(wanted, 60, 60, 0, 5, 0);
  music.update({ mission, wanted });
  expect(events(audio, 'play'), 'the lost trail settles back to calm').toEqual(
    [TITLE, SCORE_CALM, SCORE_URGENT, SCORE_CALM]);
  expect(events(audio, 'stop')).toEqual([TITLE, SCORE_CALM, SCORE_URGENT]);
  music.update({ scene: 'play', mission: null });
  expect(events(audio, 'stop'), 'no mission, no music').toEqual(
    [TITLE, SCORE_CALM, SCORE_URGENT, SCORE_CALM]);
  for (const [, , opts] of audio.log.filter(([t]) => t === 'play')) {
    expect(opts, 'every track is a looping bed, not an effect').toMatchObject({ loop: true, flat: true, bus: 'ambience' });
  }
});
