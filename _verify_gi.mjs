import { chromium } from '@playwright/test';
const URL = process.env.VURL;
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
await page.goto(URL, { timeout: 20000 });
await page.waitForSelector('#main-menu-overlay', { timeout: 20000 });
await page.click('#start-btn');
await page.waitForTimeout(11000);
const res = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const r = window.game?.renderer3d || window.game?.ui?.renderer3d;
  if (!r) return { err: 'no renderer' };
  for (let i = 0; i < 25; i++) { r.render?.(16); await sleep(12); }
  let giMats = 0;
  r.scene.traverse((o) => {
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { if (m && m.userData && m.userData.__giApplied) giMats++; }
  });
  const gi = r._gi;
  // sample a few irradiance texels to confirm the grid is populated (non-zero)
  let nonZero = 0;
  if (gi) { const d = gi._data; for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i+1] + d[i+2] > 0.001) nonZero++; } }
  return { hasGI: !!gi, giMaterials: giMats, probes: gi ? gi.nx * gi.nz : 0, nonZeroProbes: nonZero };
});
console.log('RES', JSON.stringify(res));
const ce = errors.filter(e => /not compiled|VALIDATE_STATUS|undeclared|vGIWorld|uGITex|uGIStrength|uGIOrigin|opaque/i.test(e));
console.log('GI_COMPILE_ERRORS', ce.length);
ce.slice(0,5).forEach(e=>console.log('  -', e.replace(/\n/g,' ').slice(0,200)));
await browser.close();
