// The news line: what the city just did (sim/news.js), top right, a few lines,
// gone after a few seconds. Painted like the lot note — the street talking, not
// an alarm — and its own corner, because the HUD, the story and the lot note
// already hold the other three.
export function buildNews() {
  const el = document.createElement('div');
  el.id = 'news';
  el.style.cssText = [
    'position:fixed', 'top:12px', 'right:12px', 'max-width:min(380px, 40vw)', 'display:none',
    'pointer-events:none', 'z-index:5', 'text-align:right',
    'font:12px/1.6 ui-monospace,Menlo,monospace', 'letter-spacing:0.04em',
    'color:#e4e1da', 'background:rgba(4,8,16,0.62)',
    'border:1px solid rgba(255,255,255,0.14)', 'border-right:3px solid #8a9bb0',
    'padding:6px 12px', 'border-radius:4px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

// Writes the DOM only when the lines change; the frame loop calls it every frame.
export function showNews(el, lines) {
  const text = lines.join('\n');
  if (el.dataset.text === text) return;
  el.dataset.text = text;
  el.replaceChildren(...lines.map((line) => {
    const row = document.createElement('div');
    row.textContent = line;
    return row;
  }));
  el.style.display = lines.length ? 'block' : 'none';
}
