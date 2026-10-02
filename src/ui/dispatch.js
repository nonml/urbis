// The police radio as subtitles: speaker, then the line, bottom-left, the last
// few calls fading as they age. Its own element — it never touches #hud.
const LINE_SECS = 7;
const FADE_SECS = 1.5;

const BOX_STYLE = [
  'position:fixed', 'left:12px', 'bottom:40px', 'max-width:min(520px,70vw)', 'pointer-events:none',
  'z-index:5', 'display:flex', 'flex-direction:column', 'gap:4px',
  'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace', 'letter-spacing:0.03em',
].join(';');
const ROW_STYLE = [
  'color:#e4e1da', 'background:rgba(4,8,16,0.62)', 'border-left:2px solid rgba(228,225,218,0.55)',
  'padding:3px 10px', 'border-radius:2px', 'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
].join(';');
const WHO_STYLE = 'color:#ffd9a0;font-weight:600;margin-right:8px';

export function buildDispatchHud() {
  const el = document.createElement('div');
  el.id = 'dispatch';
  el.style.cssText = BOX_STYLE;
  document.body.appendChild(el);
  return { el, said: -1, rows: [] };
}

function row(line) {
  const div = document.createElement('div');
  div.style.cssText = ROW_STYLE;
  const who = document.createElement('span');
  who.style.cssText = WHO_STYLE;
  who.textContent = line.speaker;
  div.append(who, line.text);
  return div;
}

// d: the dispatch sim. Rebuilds only when something new was said; otherwise it
// only ages what is on screen.
export function updateDispatchHud(hud, d, time) {
  if (d.said !== hud.said) {
    hud.said = d.said;
    hud.rows = d.lines.map((line) => ({ line, el: row(line) }));
    hud.el.replaceChildren(...hud.rows.map((r) => r.el));
  }
  for (const r of hud.rows) {
    const left = r.line.at + LINE_SECS - time;
    r.el.style.opacity = Math.max(0, Math.min(1, left / FADE_SECS)).toFixed(2);
    r.el.style.display = left > 0 ? 'block' : 'none';
  }
}
