import { profileManager, calculateRunScore } from '../sim/persistence/profile.js';
import { runSummaryStore } from '../stores/run_summary.js';

function calculateGrade(score, ended) {
    if (ended.kind !== 'win') return { letter: 'F', label: 'Run Failed', color: '#f87171' };
    if (score >= 2000) return { letter: 'S', label: 'Legendary', color: '#fbbf24' };
    if (score >= 1500) return { letter: 'A', label: 'Excellent', color: '#4ade80' };
    if (score >= 1000) return { letter: 'B', label: 'Good',      color: '#60a5fa' };
    if (score >= 600)  return { letter: 'C', label: 'Average',   color: '#94a3b8' };
    if (score >= 300)  return { letter: 'D', label: 'Below Avg', color: '#fbbf24' };
    return { letter: 'F', label: 'Poor', color: '#f87171' };
}

export class RunSummaryUI {
    constructor(game) {
        this.game = game;
        this.isShowing = false;
        this.currentRunData = null;
    }

    show(runState, endedState) {
        const score = calculateRunScore(runState);
        const grade = calculateGrade(score, endedState);
        const resources = runState.resources || {};
        const goalState = runState.progress?.goalState || {};
        const meta = runState.meta || {};
        const win = goalState.kind === 'win';

        const runData = { state: runState, score, grade };
        this.currentRunData = runData;
        this.isShowing = true;

        const stats = [
            { label: 'Days Survived',         value: (resources.day || 0).toLocaleString(),         isPrimary: true },
            { label: 'Population',             value: (resources.population || 0).toLocaleString(),   isPrimary: true },
            { label: 'Gold Balance',           value: (resources.gold || 0).toLocaleString(),          isPrimary: false },
            { label: 'Avg Happiness',          value: (runState.citizens?.getAverageHappiness?.() || 0).toFixed(1) + '%', isPrimary: true },
            { label: 'Total Gold Earned',      value: (resources.totalGoldEarned || 0).toLocaleString(), isPrimary: false },
            { label: 'Buildings Constructed',  value: (runState.buildings?.list?.length || 0).toLocaleString(), isPrimary: false },
            { label: 'Cases Completed',        value: (runState.cases?.completed?.length || 0).toLocaleString(), isPrimary: false },
            { label: 'Crises Averted',         value: (runState.crisis?.history?.length || 0).toLocaleString(), isPrimary: false },
        ];

        const elapsed = new Date(Date.now() - (meta.createdAt || Date.now())).toISOString().substr(11, 8);
        const details = [
            { label: 'Seed',         value: String(meta.seed || 'N/A'),                              isHighlighted: false },
            { label: 'Run ID',       value: (meta.runId || 'N/A').substring(0, 8),                    isHighlighted: false },
            { label: 'Map Size',     value: `${meta.mapWidth}x${meta.mapHeight}`,                     isHighlighted: false },
            { label: 'Run Duration', value: elapsed,                                                   isHighlighted: false },
            { label: 'End State',    value: goalState.title || (win ? 'City Thriving' : 'City Failed'), isHighlighted: true },
        ];

        runSummaryStore.set({ open: true, win, day: resources.day || 0, score, grade, stats, details, runData });
        profileManager.recordRun(runState, win);
    }

    hide() {
        this.isShowing = false;
        this.currentRunData = null;
        runSummaryStore.update(s => ({ ...s, open: false }));
    }

    onReplay(runData) {
        this.hide();
        this.game?.restart?.({ seed: runData?.state?.meta?.seed });
    }

    onNewRun() {
        this.hide();
        this.game?.restart?.({ newSeed: true });
    }

    onViewStats() {
        this.hide();
        this.game?.ui?.showStatsPanel?.();
    }

    // Legacy compat
    insertStyles() {}
}

export function createRunSummary(game) { return new RunSummaryUI(game); }
