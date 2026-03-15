/**
 * MultiplayerClient — Deterministic Lockstep Client
 *
 * Connects to the multiplayer_server.js WebSocket and synchronises game ticks
 * across all connected players via a lockstep protocol.
 *
 * Integration:
 *   const mp = new MultiplayerClient(game);
 *   await mp.connect('ws://localhost:8765', 'Alice');
 *
 * The client intercepts game tick advances:
 *   - Accumulates player actions (builds, demolitions, pause commands) as an
 *     "input bundle" for the current lock tick.
 *   - Every LOCK_INTERVAL game ticks, it sends the bundle + 'ready' to the server.
 *   - Simulation only advances once the server broadcasts 'advance' for that tick.
 *
 * When not connected, all calls are no-ops and the game runs normally.
 */

export class MultiplayerClient {
    constructor(game) {
        this.game = game;
        this.ws   = null;
        this.connected  = false;
        this.playerId   = null;
        this.players    = [];    // other players
        this.seed       = null;
        this.lockInterval = 3;

        /** Actions queued since last lock tick flush */
        this._pendingActions = [];
        /** Current lockstep tick index (counts lock advances, not game ticks) */
        this._lockTick = 0;
        /** Game tick counter since last flush */
        this._gameTicks = 0;
        /** Whether we're waiting for server advance before proceeding */
        this._waiting = false;
        /** Resolved when server sends 'advance' for current lockTick */
        this._advancePromise = null;
        this._advanceResolve = null;
    }

    // ── Connection ────────────────────────────────────────────────────────────

    connect(url, playerName) {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(url);
            } catch (e) {
                reject(e);
                return;
            }

            const timeout = setTimeout(() => {
                this.ws?.close();
                reject(new Error('Connection timed out'));
            }, 8000);

            this.ws.onopen = () => {
                this.ws.send(JSON.stringify({ type: 'join', name: playerName }));
            };

            this.ws.onmessage = (ev) => {
                let msg;
                try { msg = JSON.parse(ev.data); } catch { return; }

                if (msg.type === 'welcome') {
                    clearTimeout(timeout);
                    this.playerId    = msg.playerId;
                    this.players     = msg.players.filter(p => p.id !== msg.playerId);
                    this.seed        = msg.seed;
                    this.lockInterval = msg.lockInterval ?? 3;
                    this.connected   = true;
                    this.game.ui?.showMessage(`🌐 Multiplayer: joined room as ${playerName}`, 'normal');
                    resolve(this);

                } else if (msg.type === 'joined') {
                    this.players.push(msg.player);
                    this.game.ui?.showMessage(`🌐 ${msg.player.name} joined the game`, 'event');

                } else if (msg.type === 'left') {
                    this.players = this.players.filter(p => p.id !== msg.playerId);
                    this.game.ui?.showMessage(`🌐 A player left the game`, 'event');

                } else if (msg.type === 'advance') {
                    this._onAdvance(msg);

                } else if (msg.type === 'error') {
                    this.game.ui?.showMessage(`🌐 MP Error: ${msg.message}`, 'crisis');
                }
            };

            this.ws.onerror = (err) => {
                clearTimeout(timeout);
                console.warn('[MP] WebSocket error:', err);
                reject(err);
            };

            this.ws.onclose = () => {
                this.connected = false;
                this.game.ui?.showMessage('🌐 Disconnected from multiplayer', 'event');
                // Unblock any waiting tick so the game can continue solo
                this._advanceResolve?.({ tick: this._lockTick, inputs: {} });
            };
        });
    }

    disconnect() {
        this.ws?.close();
        this.ws = null;
        this.connected = false;
    }

    // ── Action recording ──────────────────────────────────────────────────────

    /**
     * Record a game action to be sent in the next lock bundle.
     * Call this instead of applying the action directly when multiplayer is active.
     *
     * @param {string} type  e.g. 'build', 'demolish', 'pause'
     * @param {Object} data  action payload
     */
    recordAction(type, data) {
        if (!this.connected) return;
        this._pendingActions.push({ type, data, ts: Date.now() });
    }

    // ── Lockstep tick hook ────────────────────────────────────────────────────

    /**
     * Called by game.js each game tick.
     * Returns a Promise that resolves when the simulation may advance.
     * In single-player the promise resolves immediately.
     *
     * @param {number} gameTick
     * @returns {Promise<void>}
     */
    async onTick(gameTick) {
        if (!this.connected) return;
        this._gameTicks++;

        if (this._gameTicks < this.lockInterval) return;
        this._gameTicks = 0;

        // Flush pending actions and signal ready
        const actions = this._pendingActions.splice(0);
        const tick = this._lockTick;

        this._advancePromise = new Promise((resolve) => {
            this._advanceResolve = resolve;
        });

        this.ws?.send(JSON.stringify({ type: 'input', tick, actions }));
        this.ws?.send(JSON.stringify({ type: 'ready', tick }));

        // Pause the game tick until server says advance
        this.game.state.time.paused = true;
        const advance = await this._advancePromise;
        this.game.state.time.paused = false;

        // Apply other players' actions
        if (advance?.inputs) {
            for (const [pid, pidActions] of Object.entries(advance.inputs)) {
                if (pid === this.playerId) continue;
                for (const action of pidActions) {
                    this._applyRemoteAction(action);
                }
            }
        }
    }

    _onAdvance(msg) {
        this._lockTick++;
        this._advanceResolve?.(msg);
        this._advanceResolve = null;
    }

    _applyRemoteAction(action) {
        try {
            if (action.type === 'build') {
                const { buildingType, x, y } = action.data;
                this.game.attemptBuild(buildingType, x, y, { remote: true });
            } else if (action.type === 'demolish') {
                this.game.demolish?.(action.data.x, action.data.y, { remote: true });
            } else if (action.type === 'pause') {
                this.game.state.time.paused = action.data.paused;
            }
        } catch (e) {
            console.warn('[MP] Failed to apply remote action:', action, e);
        }
    }

    // ── Status ────────────────────────────────────────────────────────────────

    get playerCount() {
        return this.players.length + (this.connected ? 1 : 0);
    }

    get statusText() {
        if (!this.connected) return 'Offline';
        return `Online (${this.playerCount} player${this.playerCount !== 1 ? 's' : ''})`;
    }
}
