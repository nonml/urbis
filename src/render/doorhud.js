// The door's two pieces of HUD: the prompt that says E will do something here,
// and the half-second of black that covers the cut from one space to the next.
// A stairwell is a fade, not a load. DOM only; nothing here draws in WebGL.

const FADE_MS = 320;

export function buildDoorHud() {
  const prompt = document.createElement('div');
  prompt.id = 'door-prompt';
  prompt.style.cssText = [
    'position:fixed', 'bottom:86px', 'left:50%', 'transform:translateX(-50%)',
    'display:none', 'pointer-events:none', 'z-index:6',
    'font:600 13px ui-monospace,Menlo,monospace', 'letter-spacing:0.12em',
    'color:#f4efe4', 'background:rgba(14,10,6,0.82)', 'border:1px solid rgba(216,199,168,0.55)',
    'border-left:3px solid #d8c7a8', 'padding:8px 18px', 'border-radius:4px',
    'text-shadow:0 1px 2px rgba(0,0,0,0.8)',
  ].join(';');
  const fade = document.createElement('div');
  fade.id = 'door-fade';
  fade.style.cssText = [
    'position:fixed', 'inset:0', 'pointer-events:none', 'z-index:4', 'background:#000',
    'opacity:0', `transition:opacity ${FADE_MS}ms ease-out`,
  ].join(';');
  document.body.append(prompt, fade);
  return { prompt, fade, shown: null };
}

// `door` is what sim/interior.js says the player can reach, or null.
export function updateDoorHud(hud, door) {
  const label = door ? `E · ${door.label}` : null;
  if (label === hud.shown) return;
  hud.shown = label;
  hud.prompt.textContent = label ?? '';
  hud.prompt.style.display = label ? 'block' : 'none';
}

// Snap to black, then let the transition bring the new space up.
export function fadeThroughDoor(hud) {
  hud.fade.style.transition = 'none';
  hud.fade.style.opacity = '1';
  // Read layout so the snap commits before the transition is put back.
  void hud.fade.offsetWidth;
  hud.fade.style.transition = `opacity ${FADE_MS}ms ease-out`;
  hud.fade.style.opacity = '0';
}
