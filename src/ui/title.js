// The title screen (M7.T8, criterion M7-2): the player's front door. Built
// before main.js runs — src/boot.js imports it — and owns three things: the
// overlay (New Game, Continue, Settings, all by mouse), the city name made
// from the seed, and the HUD line that carries that name into play.
//
// The world is already behind the overlay: main.js boots right after boot.js
// returns, so Continue lifts the overlay off the running city. New Game writes
// its seed and name to localStorage and reloads, because the world seed is
// fixed once world.js has evaluated (src/sim/seedstore.js).
import { mulberry32 } from '../sim/rng.js';
import { SEED_LIMIT } from '../sim/newgame.js';
import { activeSlot, handoffSlot, slotInfo, slotInfos } from '../savestore.js';

// City names: a root and an ending, or a prefix and a root, picked from the
// seed. The lists are wide enough that two cities rarely share a name, and the
// same seed always gets the same one until the player renames it.
const PREFIX = ['North ', 'Port ', 'Lake ', 'Fort ', 'New ', 'Old '];
const ROOT = ['Marrow', 'Cinder', 'Hollow', 'Vale', 'Ashen', 'Bramble', 'Copper', 'Fallow',
  'Harbor', 'Ironside', 'Juniper', 'Kestrel', 'Larkspur', 'Mill', 'Nettle', 'Orchard',
  'Pike', 'Quarry', 'Ridge', 'Sable', 'Thorn', 'Verge', 'Willow', 'Yarrow'];
const SUFFIX = ['field', 'gate', 'mouth', 'bridge', 'haven', 'ford', 'crest', 'reach',
  'stead', 'row', 'side', 'mills'];

export function nameForSeed(seed) {
  const rng = mulberry32(seed >>> 0);
  const root = ROOT[Math.floor(rng() * ROOT.length)];
  const suffix = SUFFIX[Math.floor(rng() * SUFFIX.length)];
  const prefix = PREFIX[Math.floor(rng() * PREFIX.length)];
  return rng() < 0.7 ? `${root}${suffix}` : `${prefix}${root}`;
}

const NAMES_KEY = 'urbis.citynames';
const PENDING_KEY = 'urbis.pending';

const seedOk = (n) => Number.isInteger(n) && n > 0 && n < SEED_LIMIT;

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function writeJson(key, value) {
  // A denied or full store costs the player a name, never the game.
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* the name is optional */ }
}

function nameFor(seed) {
  const names = readJson(NAMES_KEY);
  const named = names && names[seed];
  return typeof named === 'string' && named.trim() ? named : nameForSeed(seed);
}

function rememberName(seed, name) {
  writeJson(NAMES_KEY, { ...(readJson(NAMES_KEY) ?? {}), [seed]: name });
}

// A New Game click leaves its seed and name here for the next boot (boot.js),
// because a reload is the only way to build a different world.
export function readPending() {
  const p = readJson(PENDING_KEY);
  if (!p || !seedOk(p.seed)) return null;
  return { seed: p.seed, name: typeof p.name === 'string' ? p.name.trim().slice(0, 24) : '' };
}

function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* it is cleared next boot anyway */ }
}

// The status line (game/hud.js) rewrites #hud every quarter second. The city
// name is not a measured number, so it lives in its own line and the observer
// puts it back when a rewrite clears it.
function mountHudName(name, seed) {
  const hud = document.getElementById('hud');
  if (!hud) return;
  const line = document.createElement('div');
  line.id = 'cityname';
  line.style.cssText = 'margin-bottom:4px;color:#fff;letter-spacing:0.08em';
  const city = document.createElement('b');
  city.textContent = name;
  const meta = document.createElement('span');
  meta.style.opacity = '0.6';
  meta.textContent = ` · seed ${seed}`;
  line.append(city, meta);
  hud.prepend(line);
  new MutationObserver(() => { if (line.parentNode !== hud) hud.prepend(line); })
    .observe(hud, { childList: true });
}

function el(tag, css, text) {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

const BUTTON = 'display:block;width:100%;margin:8px 0;padding:9px 12px;'
  + 'font:600 13px ui-monospace,Menlo,monospace;letter-spacing:0.14em;color:#e4e1da;'
  + 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.22);'
  + 'border-radius:5px;cursor:pointer';
const BUTTON_ON = 'display:block;width:100%;margin:8px 0;padding:9px 12px;'
  + 'font:600 13px ui-monospace,Menlo,monospace;letter-spacing:0.14em;color:#ffd9a0;'
  + 'background:rgba(255,177,78,0.13);border:1px solid rgba(255,177,78,0.5);'
  + 'border-radius:5px;cursor:pointer';
const FIELD = 'width:100%;box-sizing:border-box;margin:4px 0 8px;padding:6px 8px;'
  + 'font:12px ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,0.35);'
  + 'border:1px solid rgba(255,255,255,0.2);border-radius:4px';
const LABEL = 'display:block;margin-top:8px;font-size:10px;letter-spacing:0.14em;opacity:0.6';
const PANEL = 'display:none;margin:8px 0;padding:12px;text-align:left;'
  + 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:6px';

function button(id, label, primary = false) {
  const b = el('button', primary ? BUTTON_ON : BUTTON, label);
  b.id = id;
  b.type = 'button';
  return b;
}

// The save slots (M7.T14, criterion M7-7): one row per slot, named by the
// city's name, its seed, its population and the time it was saved. The city
// name is made from the seed here, as everywhere else on this screen.
const SLOT = 'display:block;width:100%;margin:6px 0;padding:8px 10px;text-align:left;'
  + 'font:12px/1.4 ui-monospace,Menlo,monospace;color:#e4e1da;background:rgba(255,255,255,0.05);'
  + 'border:1px solid rgba(255,255,255,0.18);border-radius:5px;cursor:pointer';
const SLOT_ON = 'display:block;width:100%;margin:6px 0;padding:8px 10px;text-align:left;'
  + 'font:12px/1.4 ui-monospace,Menlo,monospace;color:#ffd9a0;background:rgba(255,177,78,0.13);'
  + 'border:1px solid rgba(255,177,78,0.5);border-radius:5px;cursor:pointer';
const ASK = 'position:fixed;inset:0;z-index:60;display:none;align-items:center;'
  + 'justify-content:center;background:rgba(4,6,10,0.72);'
  + 'font:13px/1.7 ui-monospace,Menlo,monospace;color:#e4e1da;letter-spacing:0.06em';

function saveTime(ms) {
  return ms > 0 ? new Date(ms).toLocaleString() : 'time unknown';
}

const slotName = (info) => (info.seed === null ? 'UNREADABLE' : nameFor(info.seed));

function slotButton(info, isOn, pick) {
  const name = info.hasSave ? slotName(info) : '';
  const b = el('button', isOn ? SLOT_ON : SLOT);
  b.id = `title-slot-${info.slot}`;
  b.type = 'button';
  b.dataset.slot = String(info.slot);
  b.dataset.seed = info.seed === null ? '' : String(info.seed);
  b.dataset.population = info.hasSave ? String(info.population) : '';
  b.dataset.savedAt = info.hasSave ? String(info.savedAt) : '';
  b.append(
    el('div', 'font-weight:600;letter-spacing:0.12em',
      info.hasSave ? name : `SLOT ${info.slot} · EMPTY`),
    el('div', 'margin-top:2px;font-size:10px;opacity:0.65',
      info.hasSave ? `seed ${info.seed ?? '?'} · pop ${info.population} · ${saveTime(info.savedAt)}` : 'new city'),
  );
  b.addEventListener('click', () => pick(info.slot));
  return b;
}

// The New Game panel: the city's seed, a reroll, a seed to type, and the name
// the seed made — which the player can change before the city starts.
function buildNewGame(seed, start) {
  const panel = el('div', PANEL);
  panel.id = 'title-newgame-panel';

  const seedRow = el('div', 'display:flex;align-items:center;gap:8px');
  seedRow.append(el('span', 'font-size:10px;letter-spacing:0.14em;opacity:0.6', 'SEED'));
  const seedVal = el('span', 'flex:1;color:#fff;font-weight:600;letter-spacing:0.1em', String(seed));
  seedVal.id = 'title-seed';
  const reroll = button('title-reroll', 'REROLL');
  reroll.style.cssText = 'width:auto;margin:0;padding:4px 10px;font-size:10px';
  seedRow.append(seedVal, reroll);
  panel.appendChild(seedRow);

  panel.append(el('label', LABEL, 'OR TYPE A SEED'));
  const seedInput = el('input', FIELD);
  seedInput.id = 'title-seedinput';
  seedInput.type = 'text';
  seedInput.inputMode = 'numeric';
  seedInput.placeholder = `1 – ${SEED_LIMIT - 1}`;
  seedInput.autocomplete = 'off';
  panel.append(seedInput);

  panel.append(el('label', LABEL, 'CITY NAME'));
  const nameInput = el('input', FIELD);
  nameInput.id = 'title-nameinput';
  nameInput.type = 'text';
  nameInput.maxLength = 24;
  nameInput.autocomplete = 'off';
  panel.append(nameInput);

  const startBtn = button('title-start', 'START NEW CITY', true);
  panel.append(startBtn);
  const back = button('title-newgame-back', 'BACK');
  back.addEventListener('click', () => { panel.style.display = 'none'; });
  panel.append(back);

  // Seed and name move together: a new seed gets the name made from it, and a
  // name the player typed sticks until the seed changes under it.
  let current = seed;
  const showSeed = (n) => {
    current = n;
    seedVal.textContent = String(n);
    nameInput.value = nameFor(n);
  };
  showSeed(seed);
  reroll.addEventListener('click', () => {
    const roll = new Uint32Array(1);
    crypto.getRandomValues(roll);
    showSeed(1 + (roll[0] % (SEED_LIMIT - 1)));
  });
  seedInput.addEventListener('input', () => {
    const n = Number(seedInput.value);
    if (/^\d+$/.test(seedInput.value) && n > 0 && n < SEED_LIMIT) showSeed(n);
  });
  startBtn.addEventListener('click', () => {
    const typed = Number(seedInput.value);
    const n = /^\d+$/.test(seedInput.value) && typed > 0 && typed < SEED_LIMIT ? typed : current;
    start(n, nameInput.value.trim().slice(0, 24) || nameForSeed(n));
  });
  return panel;
}

// Settings: the shell M7.T10 fills in. What is here already works by mouse.
function buildSettings() {
  const panel = el('div', PANEL);
  panel.id = 'title-settings-panel';
  panel.append(el('div', 'font-size:10px;letter-spacing:0.14em;opacity:0.6', 'SETTINGS'));
  const full = button('title-fullscreen', 'FULL SCREEN');
  full.addEventListener('click', () => {
    const done = document.fullscreenElement
      ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    if (done) done.catch(() => { /* the browser may refuse without a gesture */ });
  });
  const back = button('title-settings-back', 'BACK');
  back.addEventListener('click', () => { panel.style.display = 'none'; });
  panel.append(full, back);
  return panel;
}

// The three slots and the buttons that act on the selected one. Continue on
// the slot the page is already playing lifts the overlay; another slot is
// handed to the next boot (savestore handoffSlot). New Game opens the panel on
// an empty slot, and asks in the page first when the selected one holds a city.
function buildSlots(seed, start, lift) {
  const boot = activeSlot();
  const first = slotInfos();
  let selected = first.some((s) => s.slot === boot && s.hasSave)
    ? boot : (first.find((s) => s.hasSave) ?? first[0]).slot;
  const host = el('div', 'margin:4px 0');
  const target = el('div', 'margin:2px 0 6px;font-size:10px;letter-spacing:0.14em;opacity:0.65', '');
  target.id = 'title-slot-target';
  const continueBtn = button('title-continue', 'CONTINUE');
  const newBtn = button('title-newgame', 'NEW GAME');
  const aside = el('div', 'display:flex;gap:8px');
  aside.append(continueBtn, newBtn);
  const ask = el('div', PANEL);
  ask.id = 'title-replace';
  const askText = el('div', 'font-size:11px;letter-spacing:0.1em;color:#ffd9a0', '');
  const askYes = button('title-replace-yes', 'REPLACE SAVE', true);
  const askNo = button('title-replace-no', 'CANCEL');
  ask.append(askText, askYes, askNo);
  const panel = buildNewGame(seed, (nextSeed, nextName) => start(selected, nextSeed, nextName));
  panel.prepend(target);

  const picked = (slot) => {
    selected = slot;
    panel.style.display = ask.style.display = 'none';
    refresh();
  };
  function refresh() {
    // Fresh on every render: the world behind the title keeps autosaving, so a
    // snapshot taken once would show stale population and save time.
    const infos = slotInfos();
    host.replaceChildren(...infos.map((info) => slotButton(info, info.slot === selected, picked)));
    continueBtn.disabled = !slotInfo(selected).hasSave;
  }
  const openPanel = () => {
    const info = slotInfo(selected);
    target.textContent = info.hasSave
      ? `SLOT ${selected} · REPLACES ${slotName(info)}`
      : `SLOT ${selected} · NEW CITY`;
    panel.style.display = 'block';
  };
  continueBtn.addEventListener('click', () => {
    if (!slotInfo(selected).hasSave) return;
    if (selected === boot) { lift(); return; }
    handoffSlot(selected);
    location.reload();
  });
  newBtn.addEventListener('click', () => {
    ask.style.display = 'none';
    const info = slotInfo(selected);
    if (!info.hasSave) { openPanel(); return; }
    askText.textContent = `REPLACE ${slotName(info)} IN SLOT ${selected}?`;
    ask.style.display = 'block';
  });
  askYes.addEventListener('click', () => { ask.style.display = 'none'; openPanel(); });
  askNo.addEventListener('click', () => { ask.style.display = 'none'; });
  refresh();
  return { host, aside, ask, panel };
}

function buildOverlay({ seed, start }) {
  const overlay = el('div', 'position:fixed;inset:0;z-index:40;display:flex;'
    + 'align-items:center;justify-content:center;'
    + 'background:radial-gradient(ellipse at 50% 38%,rgba(10,14,22,0.8),rgba(3,5,10,0.97) 78%);'
    + 'font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e4e1da;letter-spacing:0.06em');
  overlay.id = 'title';
  const card = el('div', 'width:360px;padding:24px 28px;text-align:center;'
    + 'background:rgba(5,8,14,0.85);border:1px solid rgba(255,255,255,0.14);border-radius:10px;'
    + 'box-shadow:0 24px 70px rgba(0,0,0,0.6)');
  card.append(
    el('div', 'font-size:30px;font-weight:600;letter-spacing:0.42em;text-indent:0.42em;'
      + 'color:#fff;text-shadow:0 2px 14px rgba(255,214,160,0.25)', 'URBIS'),
    el('div', 'margin:2px 0 18px;font-size:11px;opacity:0.55;letter-spacing:0.18em',
      'BUILD IT · LIVE IN IT'),
  );
  const lift = () => { overlay.style.display = 'none'; };
  const slots = buildSlots(seed, start, lift);
  const settingsPanel = buildSettings();
  const settings = button('title-settings', 'SETTINGS');
  settings.addEventListener('click', () => {
    settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block';
  });
  card.append(slots.host, slots.aside, slots.ask, slots.panel, settings, settingsPanel);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// M7.T14: the pause menu (ui/pause.js) has no save of its own, so the front
// door mounts the button the way the HUD name is kept in place: SAVE calls the
// running game's own save entry — the autosave path — at once.
function mountPauseSave() {
  if (typeof document === 'undefined') return;
  const hang = () => {
    const card = document.getElementById('pause')?.firstElementChild;
    if (!card || card.querySelector('#pause-save')) return;
    const line = el('div', 'margin-top:6px;font:10px ui-monospace,Menlo,monospace;'
      + 'letter-spacing:0.14em;opacity:0.65', '');
    line.id = 'pause-saveline';
    const save = button('pause-save', 'SAVE');
    save.addEventListener('click', () => {
      const slot = activeSlot();
      const wrote = typeof globalThis.__game?.saveNow === 'function' && globalThis.__game.saveNow();
      const info = slotInfo(slot);
      line.textContent = wrote && info.hasSave
        ? `SAVED · SLOT ${slot} · ${slotName(info)}`
        : 'NO SAVE IN THIS RUN';
    });
    card.insertBefore(save, card.lastElementChild);
    card.appendChild(line);
  };
  hang();
  if (!document.getElementById('pause')) {
    new MutationObserver(hang).observe(document.body, { childList: true });
  }
}

// N (M7-7): a new game never replaces a save without asking, in the page.
// Automated runs are not players, and boot.js hides the title for them, so
// the gate drives N straight through; a real browser is asked first.
// The title is not play: N does nothing there (titleShowing), because its own
// NEW GAME button is the front door's ask.
export function titleShowing() {
  if (typeof document === 'undefined') return false;
  const root = document.getElementById('title');
  return !!root && root.style.display !== 'none';
}

export function askNewGame(onYes) {
  if (typeof document === 'undefined' || navigator.webdriver) { onYes(); return null; }
  const shown = document.getElementById('newgame-ask');
  if (shown) return shown;
  const info = slotInfo(activeSlot());
  if (!info.hasSave) { onYes(); return null; }
  const root = el('div', ASK);
  root.id = 'newgame-ask';
  const card = el('div', 'width:300px;padding:20px 24px;text-align:center;'
    + 'background:rgba(5,8,14,0.94);border:1px solid rgba(255,255,255,0.16);border-radius:10px');
  const close = (go) => { root.remove(); if (go) onYes(); };
  const yes = button('newgame-yes', 'START NEW GAME', true);
  const no = button('newgame-no', 'CANCEL');
  yes.addEventListener('click', () => close(true));
  no.addEventListener('click', () => close(false));
  card.append(
    el('div', 'font-size:16px;font-weight:600;letter-spacing:0.2em;color:#fff', 'START NEW GAME?'),
    el('div', 'margin-top:8px;font-size:11px;opacity:0.7',
      `SLOT ${info.slot} · ${slotName(info)} — its save will be replaced`),
    yes, no,
  );
  root.appendChild(card);
  root.style.display = 'flex';
  document.body.appendChild(root);
  return root;
}

// Called by boot.js once the world is picked. `pending` is a New Game click
// this boot is fulfilling, which starts straight into play. `show` is false
// for automated runs and capture; the pause menu's save button is mounted even
// then, because the pause menu is the running game's, not the title's.
export function initTitle({ seed, show, pending }) {
  const name = pending?.name || nameFor(seed);
  if (pending) {
    rememberName(seed, name);
    clearPending();
  }
  mountHudName(name, seed);
  mountPauseSave();
  if (!show || pending) return;
  const start = (slot, nextSeed, nextName) => {
    rememberName(nextSeed, nextName);
    handoffSlot(slot);
    writeJson(PENDING_KEY, { seed: nextSeed, name: nextName });
    location.assign(location.pathname);
  };
  buildOverlay({ seed, start });
}
