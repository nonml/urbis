/**
 * GameLoop — extracted from game.js to separate the frame-timing concern
 * from the simulation and initialization concerns.
 *
 * Usage:
 *   const loop = new GameLoop(game);
 *   loop.start();
 *   loop.stop();
 */
export class GameLoop {
    /**
     * @param {object} game - The Game instance
     */
    constructor(game) {
        this.game = game;
        this.isRunning = false;
        this.lastFrame = 0;
        this.tickAccumulator = 0;
        this._rafHandle = null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastFrame = performance.now();
        this.tickAccumulator = 0;
        this._rafHandle = requestAnimationFrame(() => this._tick());
    }

    stop() {
        this.isRunning = false;
        if (this._rafHandle != null) {
            cancelAnimationFrame(this._rafHandle);
            this._rafHandle = null;
        }
    }

    _tick() {
        if (!this.isRunning) return;

        const game = this.game;
        const now = performance.now();
        const frameDt = Math.min(50, now - this.lastFrame);
        this.lastFrame = now;

        this.tickAccumulator += frameDt;

        let simDt = 0;
        if (!game.state.time.paused) {
            while (this.tickAccumulator >= game.tickRate) {
                simDt = game.tickRate / 1000;
                game.tickOnce(simDt);
                this.tickAccumulator -= game.tickRate;
            }
        }

        if (!game.state.time.paused && game.vehicleSystem) {
            game.vehicleSystem.update(frameDt / 1000);
        }

        game.ui?.render(frameDt, simDt);
        game.minimap?.update();

        this._rafHandle = requestAnimationFrame(() => this._tick());
    }
}
