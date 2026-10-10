// Hack menu (M6.T3, criterion M6-4): the panel a held hack key opens over the
// registered thing the aim holds. It names that thing and lists its hacks with
// their costs, the default one selected; the arrow keys move the selection and
// Enter fires the chosen hack. A hack the sim has no applier for yet refuses
// with a reason in the note line, so nothing in the menu pretends to work.
// DOM only, no draws: game/input.js owns the keys and the fire, and hands back
// the reason a chosen hack refused with.
export function buildHackMenu(onFire) {
  const el = document.createElement('div');
  el.id = 'hackmenu';
  el.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:44px', 'transform:translateX(-50%)',
    'display:none', 'pointer-events:auto', 'z-index:6', 'min-width:220px',
    'font:11px/1.75 ui-monospace,Menlo,monospace', 'letter-spacing:0.08em',
    'color:#e4e1da', 'background:rgba(3,10,18,0.88)',
    'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
    'border:1px solid rgba(255,177,78,0.5)', 'border-left:3px solid #ffb14e',
    'padding:8px 12px', 'border-radius:4px',
  ].join(';');
  document.body.appendChild(el);

  // The thing held when the menu opened, and the row the selection sits on.
  let entry = null;
  let sel = 0;

  function draw(note = '') {
    if (!entry) return;
    el.innerHTML = `<b style="color:#fff">${entry.name}</b><br>`
      + entry.hacks.map((h, i) => `<div data-row="${i}" data-sel="${i === sel ? 1 : 0}"`
        + ` style="color:${i === sel ? '#ffb14e' : 'inherit'}">${h.name} · ₡${h.cost}</div>`).join('')
      + (note ? `<br><span style="color:#ffb14e">${note}</span>` : '');
  }

  function open(next) {
    entry = next;
    sel = 0;
    draw();
    el.style.display = 'block';
  }

  function close() {
    entry = null;
    el.style.display = 'none';
  }

  function move(delta) {
    if (!entry || entry.hacks.length === 0) return;
    sel = (sel + delta + entry.hacks.length) % entry.hacks.length;
    draw();
  }

  function choose() {
    if (!entry) return;
    const hack = entry.hacks[sel];
    // A hack the sim takes closes the menu; one it refuses leaves it open with
    // the reason, so the player can read why nothing happened.
    const why = onFire(hack, entry);
    if (why) draw(`${hack.name} · ${why}`);
    else close();
  }

  // A click on a row fires it, the way Enter does: a mouse is a menu key here.
  el.addEventListener('click', (e) => {
    const row = e.target?.closest?.('[data-row]');
    if (!row) return;
    sel = Number(row.dataset.row);
    choose();
  });

  return {
    get isOpen() { return !!entry; }, open, close, move, choose,
  };
}
