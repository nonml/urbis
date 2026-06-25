import { test, expect } from '@playwright/test';

/**
 * Q11.A WebGPU Spike: probe WebGPU capability in Chromium-stable headless.
 * Results are stored in the test report for the decision document.
 */
test('q11-wg-spike: WebGPU availability in headless Chromium', async ({ page }) => {
    test.setTimeout(30_000);

    await page.goto('about:blank');

    const result = await page.evaluate(async () => {
        const out = {};
        out.navigatorGpu = typeof navigator !== 'undefined' && typeof navigator.gpu !== 'undefined';
        if (!out.navigatorGpu) {
            out.adapterOk = false;
            out.deviceOk = false;
            out.computeBufferOk = false;
            return out;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
            out.adapterOk = !!adapter;
            if (adapter) {
                const info = adapter.info ?? adapter.requestAdapterInfo?.() ?? null;
                if (info && typeof info.then === 'function') out.adapterInfo = await info;
                else out.adapterInfo = info;
                out.features = [...(adapter.features ?? [])];
                out.limits = {
                    maxComputeWorkgroupsPerDimension: adapter.limits?.maxComputeWorkgroupsPerDimension ?? null,
                    maxStorageBufferBindingSize: adapter.limits?.maxStorageBufferBindingSize ?? null,
                };

                try {
                    const device = await adapter.requestDevice({
                        requiredFeatures: [],
                    });
                    out.deviceOk = !!device;
                    if (device) {
                        try {
                            const buf = device.createBuffer({
                                size: 1024,
                                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                            });
                            out.computeBufferOk = !!buf;
                            buf.destroy();
                            device.destroy();
                        } catch (e) {
                            out.computeBufferErr = e.message;
                        }
                    }
                } catch (e) {
                    out.deviceErr = e.message;
                }
            }
        } catch (e) {
            out.adapterErr = e.message;
        }

        return out;
    });

    // Attach full probe result to the test for the decision doc.
    console.log('[WebGPU Spike Result]', JSON.stringify(result, null, 2));

    // Record what we found so the assertion doubles as documentation.
    expect(typeof result.navigatorGpu).toBe('boolean');

    if (result.navigatorGpu && result.adapterOk) {
        expect(result.deviceOk, 'GPUDevice creation should succeed').toBe(true);
        expect(result.computeBufferOk, 'STORAGE buffer creation should succeed').toBe(true);
    } else {
        // WebGPU unavailable in this headless context — decision: wait.
        console.warn('[WebGPU Spike] navigator.gpu absent or adapter null — decision: WAIT');
    }
});
