#!/usr/bin/env node
/**
 * Runtime verification of software VRS (Q11.F).
 *
 * Playwright normally forces testMode (navigator.webdriver), which skips
 * post-processing entirely — so the VRS pass path never runs under the e2e
 * suite. This script boots the real renderer (webdriver flag spoofed),
 * switches presets, and asserts the VRS state machine actually engages:
 * passes enabled, scene RenderPass clear disabled, dome hidden, then all
 * restored on a higher preset. It also fails on any page error.
 *
 * Usage: npm run build && node tools/verify_vrs.mjs
 */

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

let pass = 0;
let fail = 0;
const assert = (cond, msg) => {
    console.log(cond ? `  PASS ${msg}` : `  FAIL ${msg}`);
    if (cond) pass++; else fail++;
};

let server = null;

async function killServer() {
    if (!server) return;
    // Kill the whole tree FIRST (taskkill /T needs the parent alive), then
    // the wrapper. npm spawns vite as a child that survives npm's death.
    try {
        const { execSync } = await import('node:child_process');
        execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' });
    } catch { /* process already gone */ }
    try { server.kill(); } catch { /* already dead */ }
}

async function ensurePreview() {
    // Reclaim the port first — a stale preview server from an earlier run
    // (npm spawns vite as a child that survives npm's death) would otherwise
    // be silently reused and never cleaned up.
    const { execSync } = await import('node:child_process');
    try {
        execSync(
            'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { taskkill /PID $_ /T /F }"',
            { stdio: 'ignore' }
        );
    } catch { /* nothing listening — fine */ }
    server = spawn('npm run preview', { shell: true, stdio: 'ignore', windowsHide: true });
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch('http://localhost:4173/');
            if (r.ok) return;
        } catch { /* keep waiting */ }
        await sleep(1000);
    }
    throw new Error('preview server did not start');
}

async function main() {
    await ensurePreview();
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => {
        if (m.type() === 'error') pageErrors.push(m.text());
    });
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto('http://localhost:4173/', { waitUntil: 'load' });
    await page.waitForSelector('#main-menu-overlay', { timeout: 30000 });
    await page.evaluate(() => {
        document.getElementById('map-size').value = 'SMALL';
        window.startGame();
    });
    await page.waitForFunction(() =>
        window.game?.ui?.renderer3d?.composer && window.game.ui.renderer3d._vrsPass,
        { timeout: 60000 }
    );
    await sleep(1000);

    // Boot-time noise (missing GLB texture asset, pre-existing) is not VRS
    // work — reset the error log so only VRS-window errors are counted.
    pageErrors.length = 0;

    const vrs = await page.evaluate(() => {
        const r = window.game.ui.renderer3d;
        return {
            supported: r._vrsSupported,
            mode: r._vrsMode,
            rate: r._vrsRate,
            passBuilt: !!r._vrsPass,
            compositeBuilt: !!r._vrsCompositePass,
            low: { enabled: r._vrsEnabled, active: r._vrsActive, rate: r._vrsRate },
        };
    });
    assert(vrs.passBuilt, 'VRS pre pass built in real renderer');
    assert(vrs.compositeBuilt, 'VRS composite pass built');
    assert(vrs.supported === true, `VRS supported (mode: ${vrs.mode})`);

    await page.evaluate(() => window.game.ui.renderer3d.setPreset('low'));
    await sleep(1000);
    const low = await page.evaluate(() => {
        const r = window.game.ui.renderer3d;
        return {
            enabled: r._vrsEnabled,
            active: r._vrsActive,
            rate: r._vrsRate,
            preOn: r._vrsPass.enabled,
            compOn: r._vrsCompositePass.enabled,
            clear: r._renderPass.clear,
            domeVisible: r._skyDome.visible,
            graphHasVrs: !!r._renderGraph?.nodes?.get('vrsSky'),
        };
    });
    assert(low.enabled === true, 'Performance preset enables VRS');
    assert(low.active === true, 'VRS active in renderer');
    assert(low.rate === '2x2', 'VRS rate is 2x2');
    assert(low.preOn === true, 'Pre pass enabled');
    assert(low.compOn === true, 'Composite pass enabled');
    assert(low.clear === false, 'Scene RenderPass clear disabled (VRS owns fill)');
    assert(low.domeVisible === false, 'Sky dome hidden (shaded at 2x2 via pre pass)');
    assert(low.graphHasVrs === true, 'VRS passes registered in render graph');

    await page.evaluate(() => window.game.ui.renderer3d.setPreset('high'));
    await sleep(1000);
    const high = await page.evaluate(() => {
        const r = window.game.ui.renderer3d;
        return {
            enabled: r._vrsEnabled,
            active: r._vrsActive,
            preOn: r._vrsPass.enabled,
            clear: r._renderPass.clear,
            domeVisible: r._skyDome.visible,
        };
    });
    assert(high.enabled === false, 'High preset disables VRS');
    assert(high.active === false, 'VRS inactive');
    assert(high.preOn === false, 'Pre pass disabled');
    assert(high.clear === true, 'Scene RenderPass clear restored');
    assert(high.domeVisible === true, 'Sky dome visible again');

    // A/B: same preset, VRS on vs off — frames must be visually near-identical
    // (2x2 shading only coarsens the imperceptible sky + fog-shrouded far band).
    await page.evaluate(() => window.game.ui.renderer3d.setPreset('low'));
    await sleep(500);
    const shotOn = await page.screenshot({ encoding: 'base64' });
    await page.evaluate(() => {
        const r = window.game.ui.renderer3d;
        r._vrsEnabled = false;
        r._applyVRSState();
    });
    await sleep(150);
    const shotOff = await page.screenshot({ encoding: 'base64' });
    await page.evaluate(() => {
        const r = window.game.ui.renderer3d;
        r._vrsEnabled = true;
        r._applyVRSState();
    });
    const diffPct = await page.evaluate(async ({ a, b }) => {
        const load = (d) => new Promise((res) => {
            const i = new Image();
            i.onload = () => {
                const c = document.createElement('canvas');
                c.width = i.width; c.height = i.height;
                const x = c.getContext('2d');
                x.drawImage(i, 0, 0);
                res(x.getImageData(0, 0, i.width, i.height).data);
            };
            i.src = 'data:image/png;base64,' + d;
        });
        const [da, db] = await Promise.all([load(a), load(b)]);
        let sum = 0;
        for (let i = 0; i < da.length; i += 4) {
            sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        }
        return (sum / ((da.length / 4) * 3 * 255)) * 100;
    }, { a: shotOn, b: shotOff });
    assert(diffPct < 5, `VRS on/off frames near-identical (mean channel diff ${diffPct.toFixed(2)}%)`);

    await sleep(2000);
    const fatal = pageErrors.filter((e) => !/ResizeObserver|favicon|WebGL context lost/.test(e));
    assert(fatal.length === 0, `Zero page errors during VRS frames (${pageErrors.length} total console/page errors)`);
    for (const e of pageErrors) console.log(`    [page error] ${e}`);

    await browser.close();
    await killServer();

    console.log(`\nVRS verify: ${pass} passed, ${fail} failed`);
    // Always exit explicitly — lingering fetch/child handles must not hang CI.
    process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error('verify_vrs failed:', e);
    if (server) server.kill();
    process.exit(1);
});