import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=swiftshader'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

page.on('console', msg => {});
page.on('pageerror', err => {});

await page.goto('http://localhost:5173');
await page.waitForLoadState('networkidle');

await page.click('#start-btn');

try {
    await page.waitForFunction(() => {
        const log = document.getElementById('message-log');
        return log && log.textContent.includes('3D renderer ready');
    }, { timeout: 15000 });
} catch (e) {
    console.log('Warning: did not see "3D renderer ready"');
}

await page.waitForTimeout(4000);

// Debug: check what the scene background is
const debug = await page.evaluate(() => {
    const r = window.game?.ui?.renderer3d;
    const bg = r?.scene?.background;
    const fog = r?.scene?.fog;
    const sky = r?._sky;
    return {
        bgHex: bg?.getHexString?.(),
        fogColor: fog?.color?.getHexString?.(),
        fogDensity: fog?.density,
        skyExists: !!sky,
        skyVisible: sky?.visible,
        season: r?.game?.weatherSystem?.state?.season,
        weather: r?.game?.weatherSystem?.state?.type,
        cameraMode: r?.cameraMode,
    };
});
console.log('Debug:', JSON.stringify(debug, null, 2));

// Capture god mode screenshot
const godShot = await page.screenshot({ fullPage: false });
writeFileSync('scripts/screenshot_god_mode.png', godShot);
console.log('God mode screenshot saved.');

// Switch to street mode
await page.evaluate(() => {
    const g = window.game;
    if (!g) return;
    g.mode = 'street';
    g.ui?.renderer3d?.setCameraMode?.('street');
    g.ui?.updateHUDLayers?.();
});
await page.waitForTimeout(3000);

const streetShot = await page.screenshot({ fullPage: false });
writeFileSync('scripts/screenshot_street_mode.png', streetShot);
console.log('Street mode screenshot saved.');

await page.evaluate(() => {
    const ui = window.game?.ui;
    if (ui) { ui.hackScanVisible = true; ui.hackList?.setVisible?.(true); }
});
await page.waitForTimeout(2000);

const hackShot = await page.screenshot({ fullPage: false });
writeFileSync('scripts/screenshot_hack_scan.png', hackShot);
console.log('Hack scan screenshot saved.');

await browser.close();
