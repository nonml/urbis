// Run summary UI panel - shows results after a run ends
import { profileManager, calculateRunScore } from '../sim/persistence/profile.js';

// Constants for styling
const SUMMARY_STYLES = `
.run-summary {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    max-width: 90vw;
    background: rgba(20, 20, 30, 0.98);
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    z-index: 10000;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.run-summary-header {
    text-align: center;
    margin-bottom: 24px;
}

.run-summary-title {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
}

.run-summary-subtitle {
    font-size: 14px;
    color: #888;
}

.run-summary-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 24px;
}

.summary-stat-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 16px;
}

.summary-stat-card.full-width {
    grid-column: 1 / -1;
}

.summary-stat-label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}

.summary-stat-value {
    font-size: 24px;
    font-weight: 600;
    color: #fff;
}

.summary-stat-value.primary {
    color: #4ade80;
}

.summary-stat-value.danger {
    color: #f87171;
}

.summary-stat-value.warning {
    color: #fbbf24;
}

.summary-score-card {
    background: linear-gradient(135deg, rgba(74, 222, 128, 0.1), rgba(59, 130, 246, 0.1));
    grid-column: 1 / -1;
    text-align: center;
}

.summary-score-label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
}

.summary-score-value {
    font-size: 48px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 8px;
}

.summary-score-grade {
    font-size: 18px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 4px;
    display: inline-block;
}

.summary-details {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
}

.summary-details-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #ccc;
}

.summary-details-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.summary-detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
}

.summary-detail-item span:first-child {
    color: #888;
}

.summary-detail-item span:last-child {
    color: #fff;
}

.run-summary-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
}

.summary-btn {
    flex: 1;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.summary-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.summary-btn:active {
    transform: translateY(0);
}

.summary-btn-primary {
    background: linear-gradient(135deg, #4ade80, #22c55e);
    color: #fff;
}

.summary-btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.summary-btn:hover.summary-btn-secondary {
    background: rgba(255, 255, 255, 0.15);
}

.summary-btn-outline {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #fff;
}

.summary-btn:hover.summary-btn-outline {
    background: rgba(255, 255, 255, 0.05);
}

/* Responsive adjustments */
@media (max-width: 600px) {
    .run-summary {
        width: 90vw;
        padding: 16px;
    }

    .run-summary-title {
        font-size: 22px;
    }

    .summary-stat-value {
        font-size: 20px;
    }

    .summary-score-value {
        font-size: 36px;
    }

    .run-summary-content {
        grid-template-columns: 1fr;
    }

    .summary-btn {
        font-size: 13px;
        padding: 10px 16px;
    }
}
`;

// Grade calculation
function calculateGrade(score, ended) {
    if (ended.kind !== 'win') {
        return { letter: 'F', label: 'Run Failed', color: '#f87171' };
    }

    if (score >= 2000) return { letter: 'S', label: 'Legendary', color: '#fbbf24' };
    if (score >= 1500) return { letter: 'A', label: 'Excellent', color: '#4ade80' };
    if (score >= 1000) return { letter: 'B', label: 'Good', color: '#60a5fa' };
    if (score >= 600) return { letter: 'C', label: 'Average', color: '#94a3b8' };
    if (score >= 300) return { letter: 'D', label: 'Below Avg', color: '#fbbf24' };
    return { letter: 'F', label: 'Poor', color: '#f87171' };
}

// Create summary content
function createSummaryHTML(runData) {
    const { state, score, grade, runInfo } = runData;

    const resources = state.resources || {};
    const goalState = state.progress?.goalState || {};
    const meta = state.meta || {};

    const win = goalState.kind === 'win';

    const stats = [
        { label: 'Days Survived', value: resources.day, isPrimary: true },
        { label: 'Population', value: resources.population, isPrimary: true },
        { label: 'Gold Balance', value: resources.gold, isPrimary: false },
        { label: 'Avg Happiness', value: (state.citizens?.getAverageHappiness?.() || 0).toFixed(1) + '%', isPrimary: true },
        { label: 'Total Gold Earned', value: resources.totalGoldEarned || 0, isPrimary: false },
        { label: 'Buildings Constructed', value: state.buildings?.list?.length || 0, isPrimary: false },
        { label: 'Cases Completed', value: state.cases?.completed?.length || 0, isPrimary: false },
        { label: 'Crises Averted', value: state.crisis?.history?.length || 0, isPrimary: false },
    ];

    const details = [
        { label: 'Seed', value: meta.seed || 'N/A' },
        { label: 'Run ID', value: meta.runId?.substring(0, 8) || 'N/A', truncate: true },
        { label: 'Map Size', value: `${meta.mapWidth}x${meta.mapHeight}` },
        { label: 'Run Duration', value: new Date(Date.now() - (meta.createdAt || Date.now())).toISOString().substr(11, 8) },
        { label: 'End State', value: goalState.title || (win ? 'City Thriving' : 'City Failed'), isHighlighted: true },
    ];

    let html = `
        <div class="run-summary">
            <div class="run-summary-header">
                <div class="run-summary-title">${win ? 'City Thriving!' : 'City Failed'}</div>
                <div class="run-summary-subtitle">Run ended on Day ${resources.day}</div>
            </div>

            <div class="run-summary-content">
                <div class="summary-score-card">
                    <div class="summary-score-label">Final Score</div>
                    <div class="summary-score-value">${score.toLocaleString()}</div>
                    <div class="summary-score-grade" style="background: ${grade.color}; color: #000;">
                        Grade: ${grade.letter} - ${grade.label}
                    </div>
                </div>

                ${stats.map(stat => `
                    <div class="summary-stat-card">
                        <div class="summary-stat-label">${stat.label}</div>
                        <div class="summary-stat-value ${stat.isPrimary ? 'primary' : ''}">
                            ${stat.value.toLocaleString()}
                        </div>
                    </div>
                `).join('')}

                <div class="summary-details full-width">
                    <div class="summary-details-title">Run Details</div>
                    <div class="summary-details-grid">
                        ${details.map(detail => `
                            <div class="summary-detail-item">
                                <span>${detail.label}</span>
                                <span style="${detail.isHighlighted ? 'color: #4ade80; font-weight: 600;' : ''}">
                                    ${detail.truncate ? detail.value : detail.value}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="run-summary-actions">
                <button class="summary-btn summary-btn-secondary" id="btn-replay">
                    Replay
                </button>
                <button class="summary-btn summary-btn-primary" id="btn-new-run">
                    New Run
                </button>
                <button class="summary-btn summary-btn-outline" id="btn-view-stats">
                    Stats
                </button>
            </div>
        </div>
    `;

    return html;
}

// RunSummaryUI class
export class RunSummaryUI {
    constructor(game) {
        this.game = game;
        this.panel = null;
        this.isShowing = false;

        // Style element
        this.styleElement = null;
        this.insertStyles();
    }

    insertStyles() {
        if (this.styleElement) return;

        this.styleElement = document.createElement('style');
        this.styleElement.textContent = SUMMARY_STYLES;
        document.head.appendChild(this.styleElement);
    }

    // Show summary after run ends
    show(runState, endedState) {
        if (this.isShowing) this.hide();

        // Calculate score
        const score = calculateRunScore(runState);
        const grade = calculateGrade(score, endedState);

        // Build run data
        const runData = {
            state: runState,
            score,
            grade,
            runInfo: {
                seed: runState.meta?.seed,
                runId: runState.meta?.runId,
                days: runState.resources?.day,
            },
        };

        // Create panel
        this.panel = document.createElement('div');
        this.panel.innerHTML = createSummaryHTML(runData);

        // Add event listeners
        this.panel.querySelector('#btn-replay').addEventListener('click', () => {
            this.onReplay(runData);
        });

        this.panel.querySelector('#btn-new-run').addEventListener('click', () => {
            this.onNewRun();
        });

        this.panel.querySelector('#btn-view-stats').addEventListener('click', () => {
            this.onViewStats();
        });

        // Store reference for callbacks
        this.currentRunData = runData;

        // Add to DOM
        document.body.appendChild(this.panel);
        this.isShowing = true;

        // Update profile
        profileManager.recordRun(runState, endedState.kind === 'win');
    }

    hide() {
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
        this.isShowing = false;
        this.currentRunData = null;
    }

    // Event handlers
    onReplay(runData) {
        this.hide();
        if (this.game && typeof this.game.restart === 'function') {
            // Use same seed for exact replay
            const seed = runData.state.meta?.seed;
            this.game.restart({ seed });
        }
    }

    onNewRun() {
        this.hide();
        if (this.game && typeof this.game.restart === 'function') {
            // New random seed
            this.game.restart({ newSeed: true });
        }
    }

    onViewStats() {
        this.hide();
        // Show profile/stats panel
        if (this.game && this.game.ui && typeof this.game.ui.showStatsPanel === 'function') {
            this.game.ui.showStatsPanel();
        } else {
            console.log('Profile stats:', profileManager.getProfileData());
        }
    }
}

// Factory function
export function createRunSummary(game) {
    return new RunSummaryUI(game);
}