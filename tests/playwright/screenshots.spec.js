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
}

function shot(name) {
  return { path: join(BASELINE_DIR, `${name}.png`) };
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
