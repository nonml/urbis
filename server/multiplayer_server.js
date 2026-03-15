/**
 * City Builder — Multiplayer WebSocket Server
 *
 * Protocol: deterministic lockstep (2-4 players).
 * Each connected client sends inputs for each "lock tick".
 * The server collects all inputs from all clients, then broadcasts
 * the merged input bundle so every client advances the simulation identically.
 *
 * Run with:  node server/multiplayer_server.js [--port 8765]
 *
 * Message types (JSON):
 *   C→S  { type:'join',   name: string, seed?: number }
 *   C→S  { type:'input',  tick: number, actions: Action[] }
 *   C→S  { type:'ready',  tick: number }   — client finished simulating this tick
 *
 *   S→C  { type:'welcome',  playerId: string, players: Player[], seed: number, lockInterval: number }
 *   S→C  { type:'joined',   player: Player }
 *   S→C  { type:'left',     playerId: string }
 *   S→C  { type:'advance',  tick: number, inputs: { [playerId]: Action[] } }
 *   S→C  { type:'error',    message: string }
 */

import { WebSocketServer } from 'ws';

const PORT       = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] ?? '8765', 10);
const MAX_ROOMS  = 8;
const MAX_PER_ROOM = 4;
const LOCK_INTERVAL = 3;   // ticks between lockstep advances
const TICK_MS    = 250;    // time budget per lockstep tick (ms)

// ─── Room management ──────────────────────────────────────────────────────────

class Room {
    constructor(id) {
        this.id       = id;
        this.players  = new Map();   // playerId → { ws, name, ready }
        this.seed     = Math.floor(Math.random() * 0xFFFFFFFF);
        this.tick     = 0;           // current lockstep tick
        this.inputs   = new Map();   // playerId → actions[] (for current tick)
        this.readySet = new Set();   // playerIds that sent 'ready' for this tick
        this._timeout = null;
    }

    get isFull() { return this.players.size >= MAX_PER_ROOM; }

    broadcast(msg, except = null) {
        const raw = JSON.stringify(msg);
        for (const [pid, p] of this.players) {
            if (pid !== except && p.ws.readyState === 1 /* OPEN */) {
                p.ws.send(raw);
            }
        }
    }

    send(playerId, msg) {
        const p = this.players.get(playerId);
        if (p?.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
    }

    addInput(playerId, tick, actions) {
        if (tick !== this.tick) return;
        this.inputs.set(playerId, actions ?? []);
        this._checkAdvance();
    }

    markReady(playerId, tick) {
        if (tick !== this.tick) return;
        this.readySet.add(playerId);
        this._checkAdvance();
    }

    _checkAdvance() {
        const connected = [...this.players.keys()];
        const allReady = connected.every(pid => this.readySet.has(pid));
        if (!allReady) return;

        // All players have submitted their inputs — merge and broadcast
        const mergedInputs = {};
        for (const pid of connected) {
            mergedInputs[pid] = this.inputs.get(pid) ?? [];
        }

        clearTimeout(this._timeout);
        const advanceTick = this.tick;
        this.tick++;
        this.inputs.clear();
        this.readySet.clear();

        // Schedule timeout for next tick in case a slow client holds everyone up
        this._timeout = setTimeout(() => {
            // Force advance by injecting empty input for any lagging player
            for (const pid of connected) {
                if (!this.inputs.has(pid)) this.inputs.set(pid, []);
                this.readySet.add(pid);
            }
            this._checkAdvance();
        }, TICK_MS * 4);

        this.broadcast({ type: 'advance', tick: advanceTick, inputs: mergedInputs });
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        this.inputs.delete(playerId);
        this.readySet.delete(playerId);
        if (this.players.size > 0) this._checkAdvance();
    }
}

const rooms = new Map();

function findOrCreateRoom() {
    for (const room of rooms.values()) {
        if (!room.isFull) return room;
    }
    if (rooms.size >= MAX_ROOMS) return null;
    const id = `room-${Date.now()}`;
    const room = new Room(id);
    rooms.set(id, room);
    return room;
}

function cleanEmptyRooms() {
    for (const [id, room] of rooms) {
        if (room.players.size === 0) rooms.delete(id);
    }
}

// ─── Server ───────────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT });

console.log(`[MP Server] Listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
    let room = null;
    let playerId = null;

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'join') {
            if (room) return; // already joined

            room = findOrCreateRoom();
            if (!room) {
                ws.send(JSON.stringify({ type: 'error', message: 'Server full' }));
                ws.close();
                return;
            }

            playerId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const playerInfo = { id: playerId, name: msg.name ?? `Player ${room.players.size + 1}` };

            room.players.set(playerId, { ws, ...playerInfo, ready: false });

            // Tell the new player about the room
            ws.send(JSON.stringify({
                type: 'welcome',
                playerId,
                players: [...room.players.values()].map(p => ({ id: p.id, name: p.name })),
                seed: room.seed,
                lockInterval: LOCK_INTERVAL,
            }));

            // Tell existing players about the newcomer
            room.broadcast({ type: 'joined', player: playerInfo }, playerId);

        } else if (msg.type === 'input') {
            room?.addInput(playerId, msg.tick, msg.actions);

        } else if (msg.type === 'ready') {
            room?.markReady(playerId, msg.tick);
        }
    });

    ws.on('close', () => {
        if (room && playerId) {
            room.removePlayer(playerId);
            room.broadcast({ type: 'left', playerId });
            cleanEmptyRooms();
        }
    });

    ws.on('error', (err) => {
        console.warn('[MP Server] WS error:', err.message);
    });
});
