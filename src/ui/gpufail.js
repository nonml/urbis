// M7-9 (docs/ROADMAP.md): when the GPU fails the page says so in words and what
// to try; a context that comes back restores the game. Plain DOM outlives the
// context; three (r160) re-inits its own GL state on restore.
const OVERLAY_ID = 'gpufail';
const STYLE = 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;'
  + 'background:#05070d;color:#e4e1da;font:14px/1.6 ui-monospace,Menlo,monospace;padding:24px;text-align:center';

export const GPU_FAIL_TEXT = {
  missing: {
    title: 'Urbis needs WebGL',
    body: 'This browser cannot start WebGL, the 3D graphics the city is drawn with, so there is no city to show.',
    try: 'Try turning on hardware acceleration in your browser settings, or updating your browser or graphics driver, then reload the page.',
  },
  lost: {
    title: 'The graphics device stopped',
    body: 'WebGL lost its context, so the city cannot be drawn right now. The game is waiting.',
    try: 'Wait a moment: if the GPU comes back the game resumes by itself. If the picture stays black, reload the page.',
  },
};

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function showGpuFail(mode) {
  let el = document.getElementById(OVERLAY_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('role', 'alert');
    document.body.append(el);
  }
  const { title, body, try: advice } = GPU_FAIL_TEXT[mode];
  el.style.cssText = STYLE;
  el.innerHTML = `<div style="max-width:34em"><b style="letter-spacing:.08em">${title}</b>`
    + `<p style="opacity:.85;margin:10px 0">${body}</p><p style="color:#ffb14e;margin:0">${advice}</p></div>`;
}

export function hideGpuFail() {
  document.getElementById(OVERLAY_ID)?.style.setProperty('display', 'none');
}

// Called by boot.js before main.js builds the renderer. False means no GPU to
// build against, so boot stops before three throws its own unexplained error.
export function initGpuFail() {
  if (!webglAvailable()) { showGpuFail('missing'); return false; }
  const canvas = document.getElementById('scene');
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showGpuFail('lost'); });
  canvas.addEventListener('webglcontextrestored', hideGpuFail);
  return true;
}
