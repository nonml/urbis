// The pause menu (M7.T9, criterion M7-3): the Esc key, the overlay and Resume.
// The loop owns the pause state and the time hold (game/loop.js); this is the
// player's side of it, in capture phase so input.js — bound after loop.js at
// boot — never sees the game's action keys while the menu is up. Esc while the
// title is up is left to the title; browser keys (Tab, reload) are never eaten.
const OVERLAY = 'position:fixed;inset:0;z-index:35;display:none;align-items:center;'
  + 'justify-content:center;background:rgba(4,6,10,0.62);'
  + 'font:13px/1.7 ui-monospace,Menlo,monospace;color:#e4e1da;letter-spacing:0.06em';
const CARD = 'width:280px;padding:22px 26px;text-align:center;background:rgba(5,8,14,0.9);'
  + 'border:1px solid rgba(255,255,255,0.16);border-radius:10px;box-shadow:0 24px 70px rgba(0,0,0,0.6)';
const BUTTON = 'display:block;width:100%;margin:16px 0 0;padding:9px 12px;'
  + 'font:600 13px ui-monospace,Menlo,monospace;letter-spacing:0.14em;color:#e4e1da;'
  + 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.22);'
  + 'border-radius:5px;cursor:pointer';

let api = null, root = null;

function el(tag, css, text) {
  const node = document.createElement(tag);
  node.style.cssText = css;
  node.textContent = text;
  return node;
}

function apply(on) {
  api.setPaused(on);
  root.style.display = on ? 'flex' : 'none';
}

function onKey(e) {
  if (e.key !== 'Escape') {
    if (api.isPaused()) e.stopImmediatePropagation();
    return;
  }
  if (e.repeat) return;
  const title = document.getElementById('title');
  if (title && title.style.display !== 'none') return;
  apply(!api.isPaused());
}

// The menu is a menu even with one item: M7.T14 hangs the save slots off it.
// Called once from game/loop.js at boot. A headless script may stub
// globalThis.document for the canvas atlases (scripts/check_overlap.mjs), so the
// test is a real window and body, not just a document.
export function installPause(hooks) {
  if (root || typeof window === 'undefined' || !document.body) return;
  api = hooks;
  root = el('div', OVERLAY);
  root.id = 'pause';
  const card = el('div', CARD);
  const resume = el('button', BUTTON, 'RESUME');
  resume.id = 'pause-resume';
  resume.addEventListener('click', () => apply(false));
  card.append(
    el('div', 'font-size:20px;font-weight:600;letter-spacing:0.34em;color:#fff', 'PAUSED'),
    resume,
    el('div', 'margin-top:8px;font-size:10px;opacity:0.55;letter-spacing:0.14em', 'ESC RESUME'),
  );
  root.appendChild(card);
  document.body.appendChild(root);
  window.addEventListener('keydown', onKey, true);
}
