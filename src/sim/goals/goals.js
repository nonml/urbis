import goalsData from '../../content/goals.json' with { type: 'json' };
import { createRunSummary } from '../../ui/run_summary.js';

const DEFAULT_GOALS = {
    win: {
        population: 50,
        avgHappiness: 60,
        holdTicks: 3,
    },
    lose: {
        bankruptTicks: 10,
        minPopulationAfterDay: { day: 3, population: 10 },
        revolt: { happinessBelow: 15, ticks: 5 },
    },
};

function loadGoalsConfig() {
    const parsed = goalsData || {};
    return {
        win: { ...DEFAULT_GOALS.win, ...(parsed.win || {}) },
        lose: {
            ...DEFAULT_GOALS.lose,
            ...(parsed.lose || {}),
            minPopulationAfterDay: {
                ...DEFAULT_GOALS.lose.minPopulationAfterDay,
                ...(parsed.lose?.minPopulationAfterDay || {}),
            },
            revolt: {
                ...DEFAULT_GOALS.lose.revolt,
                ...(parsed.lose?.revolt || {}),
            },
        },
    };
}

export class GoalsManager {
    constructor(game) {
        this.game = game;
        this.config = loadGoalsConfig();
        this.state = {
            winStreakTicks: 0,
            bankruptTicks: 0,
            revoltTicks: 0,
            ended: false,
            endState: null,
        };
    }

    setMode(mode) {
        this.game.state.progress = this.game.state.progress || {};
        this.game.state.progress.mode = mode;
    }

    isSandbox() {
        return (this.game.state.progress?.mode || 'standard') === 'sandbox';
    }

    update() {
        if (this.state.ended) return;
        if (this.isSandbox()) return;

        const resources = this.game.resources;
        const day = resources.day || 1;
        const pop = resources.population || 0;
        const avgHappiness = this.game.citizens.getAverageHappiness?.() || 0;
        const gold = resources.gold || 0;

        const winCfg = this.config.win;
        const loseCfg = this.config.lose;

        const winNow = pop >= winCfg.population && avgHappiness >= winCfg.avgHappiness;
        this.state.winStreakTicks = winNow ? (this.state.winStreakTicks + 1) : 0;
        if (this.state.winStreakTicks >= winCfg.holdTicks) {
            this._end('win', 'City Stability', `Population ${pop}, happiness ${Math.round(avgHappiness)}%.`);
            return;
        }

        this.state.bankruptTicks = gold <= 0 ? (this.state.bankruptTicks + 1) : 0;
        if (this.state.bankruptTicks >= loseCfg.bankruptTicks) {
            this._end('lose', 'Bankruptcy', 'Your treasury stayed depleted for too long.');
            return;
        }

        if (day > loseCfg.minPopulationAfterDay.day && pop < loseCfg.minPopulationAfterDay.population) {
            this._end('lose', 'Population Collapse', 'Population dropped below minimum stability threshold.');
            return;
        }

        this.state.revoltTicks = avgHappiness < loseCfg.revolt.happinessBelow ? (this.state.revoltTicks + 1) : 0;
        if (this.state.revoltTicks >= loseCfg.revolt.ticks) {
            this._end('lose', 'Revolt', 'Sustained unrest led to city-wide revolt.');
        }
    }

    _end(kind, title, detail) {
        this.state.ended = true;
        this.state.endState = { kind, title, detail, tick: this.game.state.time.tick };
        this.game.state.progress = this.game.state.progress || {};
        this.game.state.progress.goalState = { ...this.state };

        // Show run summary UI with the current state (only if UI available)
        if (this.game.ui && typeof window !== 'undefined') {
            try {
                const runSummary = createRunSummary(this.game);
                runSummary.show(this.game.state, this.state.endState);
            } catch (e) {
                console.error('Failed to show run summary:', e);
            }
        }

        this.game.stop();
    }
}
