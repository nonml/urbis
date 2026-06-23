// Error Capture System for Beta Release
// Global error handler with crash recovery UX and debug bundle export

import { VERSION, BUILD_TIMESTAMP, BUILD_NUMBER, getVersionInfo } from '../version.js';

/**
 * Error Bundle - Collects debug information for crash reports
 */
export class ErrorBundle {
    constructor() {
        this.error = null;
        this.stack = null;
        this.timestamp = new Date().toISOString();
        this.versionInfo = getVersionInfo();
        this.runId = this.generateRunId();
        this.seed = null;
        this.day = null;
        this.population = null;
        this.buildData = null;
        this.saveData = null;
        this.telemetry = null;
    }

    /**
     * Generate a unique run ID
     */
    generateRunId() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
        return `run_${hex}`;
    }

    /**
     * Set the error details
     */
    setError(error) {
        this.error = error;
        this.stack = error?.stack || 'No stack available';
        this.message = error?.message || 'Unknown error';
    }

    /**
     * Capture game state
     */
    captureGameState(game) {
        if (!game) return;

        this.seed = game.seed;
        this.day = game.resources?.day || 0;
        this.population = game.resources?.population || 0;
        this.gold = game.resources?.gold || 0;
        this.happiness = game.resources?.happiness || 0;
        this.cityName = game.cityName || 'Unnamed City';
        this.runMode = game.runMode || 'unknown';
    }

    /**
     * Capture build data
     */
    captureBuildData() {
        this.buildData = {
            version: VERSION,
            buildNumber: BUILD_NUMBER,
            buildTimestamp: BUILD_TIMESTAMP,
            commitHash: BUILD_NUMBER.split('-')[1] || 'unknown'
        };
    }

    /**
     * Capture save data (partial, for recovery)
     */
    captureSaveData(game) {
        if (!game) return;

        try {
            // Get a minimal save snapshot (without large assets)
            this.saveData = {
                state: this.redactState(game.state),
                timestamp: new Date().toISOString()
            };
        } catch (e) {
            this.saveData = { error: 'Failed to capture save data' };
        }
    }

    /**
     * Redact sensitive data from state
     */
    redactState(state) {
        if (!state) return null;

        // Create a shallow copy
        const safeState = { ...state };

        // Remove large arrays and sensitive data
        const redactKeys = [
            'citizens', 'buildings', 'vehicles', 'interactables',
            'intel', 'factions', 'social', 'networks'
        ];

        for (const key of redactKeys) {
            if (safeState[key]) {
                safeState[key] = {
                    _redacted: true,
                    count: Array.isArray(safeState[key]) ? safeState[key].length : 'object',
                    _keys: Object.keys(safeState[key]).slice(0, 10)
                };
            }
        }

        return safeState;
    }

    /**
     * Get bundle as JSON for export
     */
    getJSON() {
        return {
            error: {
                message: this.message,
                stack: this.stack,
                timestamp: this.timestamp
            },
            version: this.versionInfo,
            run: {
                id: this.runId,
                seed: this.seed,
                day: this.day,
                population: this.population,
                gold: this.gold
            },
            build: this.buildData,
            state: this.saveData
        };
    }

    /**
     * Get bundle as string for copy/paste
     */
    toString() {
        const bundle = this.getJSON();
        return JSON.stringify(bundle, null, 2);
    }
}

/**
 * Global Error Handler
 */
export class ErrorHandler {
    constructor() {
        this.errorBundle = null;
        this.errorScreenVisible = false;
        this.handlersInstalled = false;
        this.maxRecoveryAttempts = 3;
        this.recoveryAttempts = 0;
    }

    /**
     * Install global error handlers
     */
    install() {
        if (this.handlersInstalled) return;

        // Window error handler
        window.onerror = (message, source, lineno, colno, error) => {
            this.handleGlobalError(error || { message, source, lineno, colno });
            return true; // Prevent default browser handling
        };

        // Promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason);
            event.preventDefault();
        });

        this.handlersInstalled = true;
        console.log('[ErrorHandler] Global handlers installed');
    }

    /**
     * Handle global error
     */
    handleGlobalError(error) {
        this.recoveryAttempts++;

        // Guard against infinite loops
        if (this.recoveryAttempts > this.maxRecoveryAttempts) {
            console.error('[ErrorHandler] Max recovery attempts reached, forcing exit');
            this.showFatalErrorScreen();
            return;
        }

        // Create error bundle
        this.errorBundle = new ErrorBundle();
        this.errorBundle.setError(error);

        // Try to capture game state if available
        if (window.game) {
            this.errorBundle.captureGameState(window.game);
            this.errorBundle.captureSaveData(window.game);
        }

        this.errorBundle.captureBuildData();

        // Show error screen
        this.showErrorScreen();
    }

    /**
     * Show error recovery screen
     */
    showErrorScreen() {
        if (this.errorScreenVisible) return;

        this.errorScreenVisible = true;

        // Create error overlay
        const overlay = document.createElement('div');
        overlay.id = 'error-overlay';
        overlay.className = 'overlay';
        overlay.style.zIndex = '99999';

        // Get debug info
        const bundleString = this.errorBundle ? this.errorBundle.toString() : '';

        overlay.innerHTML = `
            <div class="overlay-content" style="max-width: 800px;">
                <div class="victory-icon">⚠️</div>
                <h2>Something Went Wrong</h2>
                <p class="error-message">The game encountered an unexpected error.</p>

                <div class="error-details" style="background: #1a2634; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 12px; margin: 16px 0; overflow: auto; max-height: 200px;">
                    <div><strong>Error:</strong> <span id="error-message">${this.errorBundle?.message || 'Unknown'}</span></div>
                    <div><strong>Version:</strong> ${VERSION} (Build ${BUILD_NUMBER})</div>
                    <div><strong>Run ID:</strong> ${this.errorBundle?.runId || 'Unknown'}</div>
                    <div><strong>Day:</strong> ${this.errorBundle?.day || 'N/A'}</div>
                    <div><strong>Seed:</strong> ${this.errorBundle?.seed || 'Random'}</div>
                    <div><strong>Time:</strong> ${this.errorBundle?.timestamp || 'Unknown'}</div>
                </div>

                <div class="error-actions" style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
                    <button class="btn btn-primary" id="error-reload-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.72c-.82 2.33-3.04 4-5.01 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                        Reload Game
                    </button>
                    <button class="btn btn-secondary" id="error-copy-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v10z"/></svg>
                        Copy Debug Info
                    </button>
                    <button class="btn btn-secondary" id="error-export-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        Export Bundle
                    </button>
                </div>

                <p style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
                    If the problem persists, please <a href="#" id="error-feedback-btn" style="color: #54d3ff;">report this issue</a> with the debug info above.
                </p>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add event listeners
        document.getElementById('error-reload-btn').addEventListener('click', () => {
            this.reloadGame();
        });

        document.getElementById('error-copy-btn').addEventListener('click', () => {
            this.copyDebugInfo();
        });

        document.getElementById('error-export-btn').addEventListener('click', () => {
            this.exportBundle();
        });

        document.getElementById('error-feedback-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.openFeedback();
        });
    }

    /**
     * Reload the game
     */
    reloadGame() {
        try {
            hideErrorOverlay();
            location.reload();
        } catch (e) {
            console.error('[ErrorHandler] Failed to reload:', e);
        }
    }

    /**
     * Copy debug info to clipboard
     */
    copyDebugInfo() {
        if (!this.errorBundle) return;

        const debugText = this.errorBundle.toString();

        navigator.clipboard.writeText(debugText).then(() => {
            const btn = document.getElementById('error-copy-btn');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Copied!';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            }
        }).catch(() => {
            // Fallback: prompt user to copy
            alert('Please copy the debug info from the error screen:\n\n' + debugText);
        });
    }

    /**
     * Export error bundle as JSON file
     */
    exportBundle() {
        if (!this.errorBundle) return;

        const bundle = this.errorBundle.getJSON();
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `city-error-${this.errorBundle.runId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Open feedback form
     */
    openFeedback() {
        const info = this.errorBundle?.getJSON() || {};
        const feedbackUrl = `https://github.com/anthropics/city-builder/issues/new?title=Bug:+${encodeURIComponent(info.error?.message || 'Unknown Error')}&body=${encodeURIComponent(this.formatFeedbackText(info))}`;
        window.open(feedbackUrl, '_blank');
    }

    /**
     * Format feedback text
     */
    formatFeedbackText(info) {
        return `
## Description
[Describe what you were doing when the error occurred]

## Error Details
- **Version**: ${info.version?.version || 'Unknown'}
- **Build**: ${info.build?.buildNumber || 'Unknown'}
- **Run ID**: ${info.run?.id || 'Unknown'}
- **Day**: ${info.run?.day || 'N/A'}
- **Seed**: ${info.run?.seed || 'Random'}

## Stack Trace
\`\`\`
${info.error?.stack || 'No stack available'}
\`\`\`

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
[What you expected to happen]

## Actual Behavior
[What actually happened]
`;
    }

    /**
     * Show fatal error screen (after max retries)
     */
    showFatalErrorScreen() {
        const overlay = document.createElement('div');
        overlay.id = 'fatal-error-overlay';
        overlay.className = 'overlay';
        overlay.style.zIndex = '99999';

        overlay.innerHTML = `
            <div class="overlay-content">
                <div class="victory-icon">❌</div>
                <h2>Critical Error</h2>
                <p>The game has encountered too many errors and cannot continue.</p>
                <p style="margin-top: 20px; color: #ff5f5f;">Please report this issue with your save file.</p>
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="location.reload()">Retry</button>
                    <button class="btn btn-secondary" onclick="window.showStartScreen && window.showStartScreen()">Main Menu</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
    }

    /**
     * Clear error state
     */
    clear() {
        this.errorBundle = null;
        this.errorScreenVisible = false;
        this.recoveryAttempts = 0;
        hideErrorOverlay();
    }
}

/**
 * Hide error overlay
 */
function hideErrorOverlay() {
    const overlay = document.getElementById('error-overlay');
    if (overlay) overlay.remove();
}

/**
 * Get or create error handler instance
 */
let errorHandlerInstance = null;

export function getErrorHandler() {
    if (!errorHandlerInstance) {
        errorHandlerInstance = new ErrorHandler();
        errorHandlerInstance.install();
    }
    return errorHandlerInstance;
}

/**
 * Initialize error handling
 */
export function initErrorHandling() {
    const handler = getErrorHandler();
    handler.install();
    return handler;
}