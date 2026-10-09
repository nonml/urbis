// Which corner each HUD panel stands in (M5.R1). game/hud.js stacks the
// bottom-left panels upward from the screen's bottom-left corner and never looks
// at what stands at the top left, so in the city view the stack ran over the
// status lines: at 1280x720 the district table and the lot note were painted
// across them and neither could be read. This runs after tickHud, measures the
// same panels and lays them out in two columns instead:
//
//   left    the street's own, packed up from the bottom: the city view's
//           palette, then the lot note, the police radio and the contact's
//           dialogue. The status lines own the top-left corner, so a readout
//           whose top edge would reach into them stands on the right instead.
//   right   the city's own, packed up from the bottom-right corner: the district
//           table, and above it whatever the left column had no room for. The
//           news feed and the mission panel hold the top of this column, where
//           they already were.
//
// The district table never changes column: it is the panel a planner reads, and
// the bottom-right corner is the one the city view's history panel shares — the
// column packs above that when it is open.

// The margin every panel keeps off the screen's edge.
const EDGE = 12;
// Between two panels of one column.
const GAP = 8;

// On screen this frame. `display:none` is off, and a panel holding nothing (the
// police radio with no call said yet) has no height to place.
const shown = (el) => !!el && el.style.display !== 'none' && el.offsetHeight > 0;

// Each panel's own offsets, read once: a panel that moves between columns comes
// back to the corner it was built in. The offsets are inline (each build writes
// its own cssText), so clearing the override would drop the offset rather than
// restore it.
const homes = new WeakMap();
function homeOf(el) {
  if (!homes.has(el)) homes.set(el, { left: el.style.left, right: el.style.right });
  return homes.get(el);
}

// Stands `el` in `side`, `bottom` px up from that side's edge.
function stand(el, side, bottom) {
  const home = homeOf(el);
  el.style.left = side === 'left' ? home.left : 'auto';
  el.style.right = side === 'right' ? `${EDGE}px` : home.right;
  el.style.bottom = `${bottom}px`;
}

// The lowest a panel may start, in px up from the screen's bottom edge: above
// the bottom-centre strip — the hint, and the drive prompt over it — which is
// wider than the gap beside either column.
function centreBase() {
  let top = innerHeight;
  for (const id of ['prompt', 'hint']) {
    const el = document.getElementById(id);
    if (shown(el)) top = Math.min(top, el.getBoundingClientRect().top);
  }
  return shown(document.getElementById('hint')) ? Math.max(EDGE, innerHeight - top + GAP) : EDGE;
}

// The left column: the city view's palette stands in its own corner, then the
// street's own readouts stack above it and clear of the bottom-centre strip. A
// readout that would reach into the status lines is returned instead, for the
// right column.
function placeLeft(hud, palette) {
  let bottom = EDGE;
  if (shown(palette)) {
    stand(palette, 'left', bottom);
    bottom += palette.offsetHeight + GAP;
  }
  bottom = Math.max(bottom, centreBase());
  // Where the status lines end, in the screen's own coordinates.
  const stop = hud.el.getBoundingClientRect().bottom + GAP;
  const spill = [];
  for (const el of [hud.lotNote, hud.radio.el, hud.arcUI.dialogue]) {
    if (!shown(el)) continue;
    if (innerHeight - (bottom + el.offsetHeight) < stop) { spill.push(el); continue; }
    stand(el, 'left', bottom);
    bottom += el.offsetHeight + GAP;
  }
  return spill;
}

// The right column, packed up from the bottom-right corner: the district table,
// then whatever the left column had no room for — above the history panel when
// the city view has that open.
function placeRight(hud, history, spill) {
  let bottom = centreBase();
  if (shown(history?.el)) bottom += history.el.offsetHeight + GAP;
  for (const el of [hud.economyPanel.panel, ...spill]) {
    if (!shown(el)) continue;
    stand(el, 'right', bottom);
    bottom += el.offsetHeight + GAP;
  }
}

// `hud` is game/hud.js's panel set; `history` is the city view's own panel.
export function placeHudPanels(hud, history) {
  placeRight(hud, history, placeLeft(hud, document.getElementById('cityview')));
}
