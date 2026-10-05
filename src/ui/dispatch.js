// The police radio as subtitles: speaker, then the line, bottom-left, the last
// few calls fading as they age. Its own element — it never touches #hud.
// M7.T5: under the subtitles, a synthesized key-up crackle as each new line
// lands (`d.said` is the cue). Noise, not a file, so nothing to credit.
import { mulberry32 } from '../sim/rng.js';

const LINE_SECS = 7;
const FADE_SECS = 1.5;

export const CRACKLE = 'radio_crackle';
const CRACKLE_SECS = 0.13, CRACKLE_GAIN = 0.5;

// Band-split noise, loud on the attack, gone in an eighth of a second.
export function crackleBuffer(sampleRate = 44100) {
  if (typeof AudioBuffer === 'undefined') return null;
  const n = Math.max(1, Math.round(sampleRate * CRACKLE_SECS));
  const buffer = new AudioBuffer({ length: n, sampleRate, numberOfChannels: 1 });
  const out = buffer.getChannelData(0);
  const noise = mulberry32(0x51ca7e);
  let low = 0;
  for (let i = 0; i < n; i++) {
    low += (noise() * 2 - 1 - low) * 0.3;
    out[i] = low * (1 - i / n) ** 2;
  }
  return buffer;
}

// One crackle per newly said line; `heard` is the last count played.
export function dispatchSounds(d = {}, heard = 0) {
  if (d.said <= heard) return [];
  return [{ name: CRACKLE, bus: 'effects', loop: false, flat: true, gain: CRACKLE_GAIN }];
}

// The radio voice; `buffers[CRACKLE]` comes from crackleBuffer.
export function createDispatchRadio(audio, buffers = {}) {
  let heard = null;
  function update(d) {
    const plan = dispatchSounds(d, heard ?? d.said);
    heard = d.said;
    if (plan.length && buffers[CRACKLE]) audio.play(CRACKLE, buffers[CRACKLE], plan[0]);
    return plan;
  }
  return { update, plan: dispatchSounds };
}

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
