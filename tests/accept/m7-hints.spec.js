// M7-5 (docs/ROADMAP.md): a fresh game teaches every key with one hint each,
// and each goes away once done. The hints are content, not code: each later
// milestone's close adds its keys to content/hints.json and this check still
// holds. The module is driven with the smallest DOM and window it touches, so
// the key path is exercised, not asserted.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { hintDefs, installHints } from '../../src/ui/hints.js';

const HINTS = JSON.parse(readFileSync(new URL('../../content/hints.json', import.meta.url), 'utf8'));

function fakeWindow() {
  return {
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    press(key, repeat = false) { this.listeners.keydown({ key, repeat }); },
  };
}

test('M7-5: the hints are content, one per key, Z E F H at M7', () => {
  expect(hintDefs()).toEqual(HINTS);
  const keys = HINTS.map((h) => h.key);
  expect(new Set(keys).size, 'one hint per key').toBe(keys.length);
  for (const key of ['z', 'e', 'f', 'h']) expect(keys, `${key} taught when M7 closes`).toContain(key);
  for (const h of HINTS) expect(h.text, `text for ${h.key}`).toBeTruthy();
});

test('M7-5: a fresh game shows every hint; doing a key retires its own, not the rest', () => {
  const win = fakeWindow();
  const host = { textContent: '' };
  installHints(host, win);
  expect(win.listeners.keydown, 'the hint line listens for keys').toBeTruthy();
  for (const h of HINTS) expect(host.textContent, `${h.key} shown on a fresh game`).toContain(h.text);

  const doneKeys = new Set();
  for (const done of HINTS) {
    win.press(done.key);
    doneKeys.add(done.key);
    expect(host.textContent, `${done.key} gone once done`).not.toContain(done.text);
    for (const rest of HINTS) {
      if (!doneKeys.has(rest.key)) expect(host.textContent, `${rest.key} stays until done`).toContain(rest.text);
    }
  }
  expect(host.textContent.trim(), 'all done leaves no hint line').toBe('');
});

test('M7-5: a held key does not retire a hint, and a key not in the list never does', () => {
  const win = fakeWindow();
  const host = { textContent: '' };
  installHints(host, win);
  win.press('z', true);
  win.press('q');
  for (const h of HINTS) expect(host.textContent, `${h.key} still shown`).toContain(h.text);
  const z = HINTS.find((h) => h.key === 'z');
  win.press('Z');
  expect(host.textContent, 'the key itself, in any case, ends its hint').not.toContain(z.text);
});
