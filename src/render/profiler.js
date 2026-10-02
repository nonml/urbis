// Profiler overlay: DOM panel pinned above the targeted NPC.
// Identity is always readable; the secret needs proximity (< 6m). When the
// game hands over the person the NPC stands for, home and work replace the
// old abstract job and income: the pedestrian on the street is a real resident.
import * as THREE from 'three';
import { describe } from '../sim/people.js';

const SECRET_RANGE = 6;
let panel = null;

export function buildProfiler() {
  panel = document.createElement('div');
  panel.id = 'profiler';
  panel.style.cssText = [
    'position:fixed', 'display:none', 'pointer-events:none', 'z-index:5',
    'transform:translate(-50%,-100%)', 'min-width:190px',
    'font:11px/1.65 ui-monospace,Menlo,monospace', 'letter-spacing:0.05em',
    'color:#e4e1da', 'background:rgba(3,10,18,0.82)',
    'border:1px solid rgba(255,255,255,0.16)', 'border-left:3px solid #d8c7a8',
    'padding:7px 10px', 'border-radius:4px',
    'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
  ].join(';');
  document.body.appendChild(panel);
  return panel;
}

const proj = new THREE.Vector3();

export function updateProfiler(camera, target, person = null, doing = null) {
  if (!panel) return null;
  if (!target) {
    panel.style.display = 'none';
    return null;
  }
  const { npc, dist } = target;
  proj.set(npc.x, 2.35, npc.z).project(camera);
  if (proj.z > 1 || Math.abs(proj.x) > 1.05 || Math.abs(proj.y) > 1.05) {
    panel.style.display = 'none';
    return null;
  }
  const p = npc.profile;
  const near = dist < SECRET_RANGE;
  const who = person ?? p;
  const d = person ? describe(person) : null;
  const work = d && (person.job === null ? d.work : `works ${d.work}`);
  const about = d ? `home ${d.home} · ${work}${doing ? ` · ${doing}` : ''}` : `${p.job} · ${p.income}`;
  panel.innerHTML =
    `<b style="color:#fff">${who.name}</b> · ${who.age}<br>` +
    `${about}<br>` +
    (near
      ? `<span style="color:#ffb14e">◆ ${p.secret}</span><br>`
      : `<span style="opacity:0.55">◆ signal weak — move closer</span><br>`) +
    `<span style="opacity:0.6">${dist.toFixed(1)}m</span>`;
  panel.style.display = 'block';
  panel.style.left = `${(proj.x * 0.5 + 0.5) * window.innerWidth}px`;
  panel.style.top = `${(-proj.y * 0.5 + 0.5) * window.innerHeight - 8}px`;
  return { name: who.name, dist: +dist.toFixed(1), secret: near, doing };
}
