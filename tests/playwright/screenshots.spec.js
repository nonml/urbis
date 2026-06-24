import { test, expect } from '@playwright/test';
import { join } from 'path';

const LOAD_TIMEOUT = 10000;
const MENU_TIMEOUT = 15000;
const SPAWN_DELAY = 4000;
const SETTLE = 500;
const BASELINE_DIR = join(process.cwd(), 'tests', 'playwright', 'baselines');

async function startGame(page) {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });
  await page.click('#start-btn');
  await page.waitForSelector('#main-menu-overlay', { state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(SPAWN_DELAY);
  // Dismiss the first-run tutorial — its full-screen dark scrim (rgba 0,0,0,0.7
  // + spotlight cutout) otherwise dims every baseline by ~75%.
  await page.evaluate(() => {
    const t = window.game?.ui?.tutorial;
    if (t) { t.isActive = false; t.destroy?.(); }
    if (window.game?.state?.tutorial) window.game.state.tutorial.isFirstRun = false;
  });
  // Q9: capture baselines at the "Performance" preset (the low quality tier,
  // which is the new default for most players).
  await page.evaluate(() => window.game?.ui?.renderer3d?.setPreset?.('low'));
  await page.waitForTimeout(SETTLE);
}

function shot(name) {
  return { path: join(BASELINE_DIR, `${name}.png`) };
}

// Drive the day/night lerps to steady state. Headless renders at ~2 fps, so a
// short SETTLE only advances ~1 frame and the smooth lighting transitions never
// converge — calling the update directly steps them to their target regardless.
async function convergeLighting(page) {
  await page.evaluate(() => {
    const r = window.game?.ui?.renderer3d;
    if (!r || typeof r._updateDayNightLighting !== 'function') return;
    for (let i = 0; i < 200; i++) r._updateDayNightLighting();
  });
}

// Move the god-mode camera over the centre of the first district matching a
// theme so each per-district art-direction baseline (Q10.H) frames that
// neighbourhood. Chunks stream in around the relocated player; the camera is
// stepped directly because the headless render loop barely advances the lerp.
async function gotoDistrict(page, theme) {
  return page.evaluate((th) => {
    const g = window.game;
    const r = g?.ui?.renderer3d;
    if (!g || !r) return false;
    const d = (g.map.districts || []).find((x) => x.theme === th);
    if (!d) return false;
    const cx = Math.round(d.center.x), cy = Math.round(d.center.y);
    g.player.x = cx; g.player.y = cy;
    r.syncChunkStreaming?.(true);
    const wx = cx - r._mapHalfW + 0.5, wz = cy - r._mapHalfH + 0.5;
    const ty = r._smoothTerrainY ? r._smoothTerrainY(cx, cy) : 0;
    if (r._player) r._player.position.set(wx, ty + 1, wz);
    for (let i = 0; i < 80; i++) r.updateCamera();
    return true;
  }, theme);
}

for (const theme of ['docks', 'industrial', 'suburbs', 'oldtown']) {
  test(`@baseline district-${theme}`, async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      const tpd = window.game.state.time.tickPerDay || 24;
      window.game.state.time.timeOfDay = 0.5;
      window.game.state.time.tick = Math.floor(tpd * 0.5);
    });
    await gotoDistrict(page, theme);
    await convergeLighting(page);
    await page.waitForTimeout(SETTLE);
    await page.screenshot(shot(`district-${theme}`));
  });
}

test('@baseline main-menu', async ({ page }) => {
  await page.goto('http://localhost:4173/', { timeout: LOAD_TIMEOUT });
  await page.waitForSelector('#main-menu-overlay', { timeout: MENU_TIMEOUT });
  await page.waitForTimeout(SETTLE);
  await page.screenshot(shot('main-menu'));
});

test('@baseline new-game-spawn', async ({ page }) => {
  await startGame(page);
  await page.screenshot(shot('new-game-spawn'));
});

test('@baseline street-noon', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    window.game.mode = 'street';
    window.game.modeIndicator?.setMode('street');
    const tpd = window.game.state.time.tickPerDay || 24;
    window.game.state.time.timeOfDay = 0.5;
    window.game.state.time.tick = Math.floor(tpd * 0.5);
  });
  await convergeLighting(page);
  await page.waitForTimeout(SETTLE);
  await page.screenshot(shot('street-noon'));
});

test('@baseline street-night', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    window.game.mode = 'street';
    window.game.modeIndicator?.setMode('street');
    const tpd = window.game.state.time.tickPerDay || 24;
    window.game.state.time.timeOfDay = 0.875;
    window.game.state.time.tick = Math.floor(tpd * 0.875);
  });
  await convergeLighting(page);
  await page.waitForTimeout(SETTLE);
  await page.screenshot(shot('street-night'));
});

test('@baseline rain', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const ws = window.game.weatherSystem;
    ws.transitionQueue = [];
    ws.state.type = 'rain';
    ws.state.intensity = 1.0;
    ws.state.duration = 60;
  });
  await convergeLighting(page);
  await page.waitForTimeout(SETTLE);
  await page.screenshot(shot('rain'));
});

test('@baseline hack-overlay', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    window.game.mode = 'street';
    window.game.modeIndicator?.setMode('street');
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('q');
  await page.waitForTimeout(SETTLE);
  await page.screenshot(shot('hack-overlay'));
});

test('@baseline god-mode-empty', async ({ page }) => {
  await startGame(page);
  await page.screenshot(shot('god-mode-empty'));
});

test('@baseline god-mode-built', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const g = window.game;
    const cx = Math.floor(g.map.width / 2);
    const cy = Math.floor(g.map.height / 2);
    g.buildings.build('house', cx - 3, cy - 3);
    g.buildings.build('house', cx + 3, cy - 3);
    g.buildings.build('farm', cx - 3, cy + 3);
    g.buildings.build('market', cx + 3, cy + 3);
  });
  await page.waitForTimeout(SETTLE);
  await page.screenshot(shot('god-mode-built'));
});

test('@baseline vehicle-hud', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    window.game.mode = 'street';
    window.game.modeIndicator?.setMode('street');
    const vs = window.game.vehicleSystem;
    const pp = window.game.player;
    if (vs && pp) {
      const px = pp.wx ?? pp.x;
      const py = pp.wz ?? pp.y;
      for (const v of vs.vehicles) {
        const dx = v.x - px;
        const dy = v.y - py;
        if (Math.sqrt(dx * dx + dy * dy) < 20) {
          window.game.vehicleController?.enterVehicle?.(v.id);
          break;
        }
      }
    }
  });
  await page.waitForTimeout(SETTLE);
  await page.screenshot(shot('vehicle-hud'));
});

test('@baseline minimap', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.game.ui.toggleMapScreen());
  await page.waitForTimeout(SETTLE);
  await page.screenshot(shot('minimap'));
});

test('@baseline pause', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.game.ui.togglePauseMenu());
  await page.waitForTimeout(300);
  await page.screenshot(shot('pause'));
});

test('@baseline breach-minigame', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const el = document.getElementById('breach-minigame');
    if (el) { el.classList.remove('hidden'); el.style.display = 'block'; }
  });
  await page.waitForTimeout(300);
  await page.screenshot(shot('breach-minigame'));
});

test('@baseline case-file', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const el = document.getElementById('case-file');
    if (el) { el.classList.remove('hidden'); el.style.display = 'block'; }
  });
  await page.waitForTimeout(300);
  await page.screenshot(shot('case-file'));
});

test('@baseline codex', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const el = document.getElementById('codex');
    if (el) { el.classList.remove('hidden'); el.style.display = 'block'; }
  });
  await page.waitForTimeout(300);
  await page.screenshot(shot('codex'));
});

test('@baseline victory-screen', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const el = document.getElementById('victory-overlay');
    if (el) { el.classList.remove('hidden'); el.style.display = 'block'; }
  });
  await page.waitForTimeout(300);
  await page.screenshot(shot('victory-screen'));
});
