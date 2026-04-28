import { eventBus, EVENT_TYPES } from '../events.js';

const WAVE_CONFIGS = [
    { units: 3, types: ['PATROL_CAR'], roadblock: false, heli: false },
    { units: 4, types: ['PATROL_CAR', 'INTERCEPTOR'], roadblock: false, heli: false },
    { units: 5, types: ['PATROL_CAR', 'INTERCEPTOR'], roadblock: true, heli: false },
    { units: 6, types: ['PATROL_CAR', 'INTERCEPTOR', 'DRONE'], roadblock: true, heli: true },
    { units: 8, types: ['PATROL_CAR', 'INTERCEPTOR', 'DRONE'], roadblock: true, heli: true },
];

const BREATHER_TICKS = 90;
const WAVE_TIMEOUT_TICKS = 600;

export class WaveEncounter {
    constructor(game) {
        this._game = game;
        this._active = false;
        this._wave = 0;
        this._maxWaves = WAVE_CONFIGS.length;
        this._spawnedIds = new Set();
        this._startTick = 0;
        this._waveStartTick = 0;
        this._breatherUntil = 0;
        this._completed = false;
    }

    get active() { return this._active; }
    get wave() { return this._wave; }
    get maxWaves() { return this._maxWaves; }
    get completed() { return this._completed; }

    start() {
        if (this._active) return false;
        this._active = true;
        this._wave = 0;
        this._completed = false;
        this._startTick = this._game.state.time.tick;
        this._breatherUntil = 0;
        this._spawnedIds.clear();
        eventBus.emit(EVENT_TYPES.WAVE_ENCOUNTER_STARTED, {
            tick: this._game.state.time.tick,
        });
        this._advanceWave();
        return true;
    }

    update(tick) {
        if (!this._active) return;

        if (this._breatherUntil > tick) return;

        if (this._isWaveCleared(tick)) {
            if (this._wave >= this._maxWaves) {
                this._finish(true);
                return;
            }
            this._breatherUntil = tick + BREATHER_TICKS;
            this._advanceWave();
        }
    }

    _advanceWave() {
        this._wave++;
        this._spawnedIds.clear();
        this._waveStartTick = this._game.state.time.tick;

        const cfg = WAVE_CONFIGS[this._wave - 1];
        this._spawnWave(cfg);

        eventBus.emit(EVENT_TYPES.WAVE_STARTED, {
            wave: this._wave,
            maxWaves: this._maxWaves,
            units: cfg.units,
            tick: this._game.state.time.tick,
        });

        this._game.ui?.showMessage?.(
            `Wave ${this._wave}/${this._maxWaves}`,
            'crisis',
        );
    }

    _spawnWave(cfg) {
        const police = this._game.policeSystem;
        const rng = this._game.rng;
        const px = this._game.state.player.x;
        const py = this._game.state.player.y;

        for (let i = 0; i < cfg.units; i++) {
            const typeIdx = i % cfg.types.length;
            const angle = (i / cfg.units) * Math.PI * 2
                + (rng.int(0, 360) * Math.PI / 180);
            const dist = 15 + rng.int(0, 20);
            const sx = px + Math.cos(angle) * dist;
            const sy = py + Math.sin(angle) * dist;

            const unit = police.spawnUnit({
                x: Math.round(sx),
                y: Math.round(sy),
                type: cfg.types[typeIdx],
                heading: rng.int(0, 359),
                targetX: px,
                targetY: py,
            });
            this._spawnedIds.add(unit.id);
        }
    }

    _isWaveCleared(tick) {
        const elapsed = tick - this._waveStartTick;
        if (elapsed < 30) return false;

        if (elapsed >= WAVE_TIMEOUT_TICKS) return true;

        const police = this._game.policeSystem;
        const alive = police.units.filter(u => this._spawnedIds.has(u.id) && u.active);
        return alive.length === 0;
    }

    _finish(victory) {
        this._active = false;
        this._completed = victory;

        const elapsed = this._game.state.time.tick - this._startTick;
        eventBus.emit(EVENT_TYPES.WAVE_ENCOUNTER_COMPLETED, {
            victory,
            waves: this._wave,
            ticks: elapsed,
            tick: this._game.state.time.tick,
        });

        if (victory) {
            this._game.ui?.showMessage?.(
                'All waves survived!',
                'success',
            );
        }
    }

    abort() {
        if (!this._active) return;
        this._finish(false);
    }

    serialize() {
        return {
            active: this._active,
            wave: this._wave,
            startTick: this._startTick,
            waveStartTick: this._waveStartTick,
            breatherUntil: this._breatherUntil,
            completed: this._completed,
            spawnedIds: [...this._spawnedIds],
        };
    }

    deserialize(data) {
        if (!data) return;
        this._active = data.active;
        this._wave = data.wave;
        this._startTick = data.startTick;
        this._waveStartTick = data.waveStartTick;
        this._breatherUntil = data.breatherUntil;
        this._completed = data.completed;
        this._spawnedIds = new Set(data.spawnedIds || []);
    }
}
