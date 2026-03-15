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

        this._pendingActions = [];
        this._lockTick  = 0;
        this._gameTicks = 0;
        /** True while waiting for the server's 'advance' message. */
        this._waiting   = false;
        /** Queued advance payload to apply on the next allowed tick. */
        this._pendingAdvance = null;
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
                this._waiting = false; // unblock simulation
                this.game.ui?.showMessage('🌐 Disconnected from multiplayer', 'event');
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
     * Called synchronously by game.js at the top of tickOnce().
     * Returns false if the simulation should be skipped this tick (waiting for server).
     * Returns true when the simulation may proceed.
     *
     * @param {number} gameTick
     * @returns {boolean}  true = proceed, false = skip
     */
    onTick(gameTick) {
        if (!this.connected) return true;

        // If we received an advance while paused, apply remote actions now and unblock
        if (this._waiting && this._pendingAdvance) {
            const advance = this._pendingAdvance;
            this._pendingAdvance = null;
            this._waiting = false;
            for (const [pid, pidActions] of Object.entries(advance.inputs ?? {})) {
                if (pid === this.playerId) continue;
                for (const action of pidActions) this._applyRemoteAction(action);
            }
            return true;
        }

        // Still waiting — skip this simulation tick
        if (this._waiting) return false;

        this._gameTicks++;
        if (this._gameTicks < this.lockInterval) return true;
        this._gameTicks = 0;

        // Flush actions and notify server we're ready for next lockstep
        const actions = this._pendingActions.splice(0);
        const tick = this._lockTick;
        this.ws?.send(JSON.stringify({ type: 'input', tick, actions }));
        this.ws?.send(JSON.stringify({ type: 'ready', tick }));
        this._waiting = true;

        return true; // let this tick through; next tick will be blocked until advance
    }

    _onAdvance(msg) {
        this._lockTick++;
        if (this._waiting) {
            // Store for application at the start of the next allowed tick
            this._pendingAdvance = msg;
        }
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
