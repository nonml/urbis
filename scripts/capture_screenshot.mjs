import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=swiftshader'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

// Capture all console messages and errors
const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:5173');
await page.waitForLoadState('networkidle');

// Click "SOLO CAMPAIGN"
await page.click('#start-btn');

// Wait for "3D renderer ready" in the log, up to 15s
try {
    await page.waitForFunction(() => {
        const log = document.getElementById('message-log');
        return log && log.textContent.includes('3D renderer ready');
    }, { timeout: 15000 });
} catch (e) {
    console.log('Warning: did not see "3D renderer ready"');
}

await page.waitForTimeout(6000);

// Capture canvas debug info from the page
const canvasInfo = await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas');
    const r = canvas?.getBoundingClientRect();
    const renderer = window.game?.ui?.renderer3d?.renderer;
    return {
        canvasClientW: canvas?.clientWidth,
        canvasClientH: canvas?.clientHeight,
        canvasBoundW: r?.width,
        canvasBoundH: r?.height,
        canvasAttrW: canvas?.width,
        canvasAttrH: canvas?.height,
        rendererW: renderer?.domElement?.width,
        rendererH: renderer?.domElement?.height,
        isFallback: window.game?.ui?.renderer3d?.isFallback,
        rendererExists: !!renderer,
        sceneBackground: window.game?.ui?.renderer3d?.scene?.background?.getHexString?.(),
        composerExists: !!window.game?.ui?.renderer3d?.composer,
    };
});
console.log('Canvas/Renderer info:', JSON.stringify(canvasInfo, null, 2));
console.log('\nConsole logs:');
logs.slice(-30).forEach(l => console.log(l));

const shot = await page.screenshot({ fullPage: false });
writeFileSync('scripts/game_capture.png', shot);
console.log('\nScreenshot saved.');

await browser.close();
