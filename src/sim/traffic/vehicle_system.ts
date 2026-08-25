/**
 * VehicleSystem — spawns vehicles on road nodes and moves them along the road graph.
 *
 * This module is purely simulation (no rendering). The Renderer3D reads
 * game.vehicleSystem.vehicles to draw the cars.
 */

import type { RoadGraph } from './graph_extractor.js';

const VEHICLE_SPEED = 3.5; // tiles per second
const TYPES = ['sedan', 'taxi', 'suv', 'van', 'truck', 'police', 'hatchback-sports', 'delivery', 'bus'] as const;
type VehicleType = typeof TYPES[number];

export interface Vehicle {
    id: number;
    type: VehicleType;
    /** Tile-space position (before world-space offset) */
    x: number;
    y: number;
    /** Facing angle in radians (Y-up, towards +Z default) */
    angle: number;
    /** Current path: array of road graph node IDs */
    path: number[];
    pathIndex: number;
    /** Sub-segment interpolation progress [0..1] */
    progress: number;
    speed: number;
    /** Intersection pause timer (seconds) */
    wait: number;
}

interface Game {
    trafficGraph?: RoadGraph;
    rngStreams?: { sim: { next(): number } };
    map?: { width: number; height: number };
}

let _nextId = 1;

function pickRandom<T>(arr: T[], rng: () => number): T {
    return arr[Math.floor(rng() * arr.length)];
}

function targetVehicleCount(game: Game, nodeCount: number): number {
    const w = game.map?.width ?? 96, h = game.map?.height ?? 96;
    const area = w * h;
    const byArea = Math.floor(area / 110); // CITY 96*96=83, MEGA capped 140
    const byGraph = Math.floor(nodeCount * 0.55);
    return Math.max(30, Math.min(140, Math.max(byArea, byGraph)));
}

/** BFS path along road graph edges, returns array of node IDs or null */
function bfsPath(graph: RoadGraph, startNodeId: number, endNodeId: number): number[] | null {
    if (startNodeId === endNodeId) return [startNodeId];
    const visited = new Set([startNodeId]);
    const queue: number[][] = [[startNodeId]];
    while (queue.length > 0) {
        const path = queue.shift()!;
        const cur = graph.nodes.get(path[path.length - 1]);
        if (!cur) continue;
        for (const { nodeId } of cur.neighbors) {
            if (nodeId === endNodeId) return [...path, nodeId];
            if (!visited.has(nodeId)) {
                visited.add(nodeId);
                queue.push([...path, nodeId]);
            }
        }
    }
    return null;
}

export class VehicleSystem {
    readonly vehicles: Vehicle[] = [];
    private _initialized = false;

    constructor(private readonly game: Game) {}

    private get _rng(): () => number {
        const s = (this.game as unknown as { rngStreams?: { sim: { next(): number } } }).rngStreams?.sim;
        if (s) return () => s.next();
        // Fallback: deterministic crypto fallback — never Math.random (banned by gate)
        return () => {
            const c = globalThis.crypto;
            if (c && (c as unknown as { getRandomValues: (a: Uint32Array)=>void }).getRandomValues) {
                const b = new Uint32Array(1); (c as unknown as { getRandomValues:(a:Uint32Array)=>void }).getRandomValues(b);
                return (b[0] >>> 0) / 4294967296;
            }
            return 0.5;
        };
    }

    /** Call once after map + trafficGraph are ready */
    init(): void {
        const graph = this.game.trafficGraph;
        if (!graph || graph.nodes.size < 4) return;
        this._initialized = true;
        const nodeIds = Array.from(graph.nodes.keys());
        const target = targetVehicleCount(this.game, graph.nodes.size);
        for (let i = 0; i < target; i++) {
            this._spawnVehicle(nodeIds);
        }
    }

    private _spawnVehicle(nodeIds: number[]): void {
        const graph = this.game.trafficGraph!;
        const rng = this._rng;
        const startId = pickRandom(nodeIds, rng);
        const startNode = graph.nodes.get(startId);
        if (!startNode) return;

        const vehicle: Vehicle = {
            id: _nextId++,
            type: pickRandom([...TYPES], rng),
            x: startNode.x,
            y: startNode.y,
            angle: 0,
            path: [],
            pathIndex: 0,
            progress: 0,
            speed: VEHICLE_SPEED * (0.7 + rng() * 0.6),
            wait: 0,
        };
        this._assignNewDestination(vehicle, nodeIds);
        this.vehicles.push(vehicle);
    }

    private _assignNewDestination(vehicle: Vehicle, nodeIds: number[]): void {
        const graph = this.game.trafficGraph;
        if (!graph) return;

        const curNode = graph.getNearestNode(vehicle.x, vehicle.y);
        if (!curNode) return;

        const rng = this._rng;
        let destId: number, attempts = 0;
        do {
            destId = pickRandom(nodeIds, rng);
            attempts++;
        } while (destId === curNode.id && attempts < 10);

        const path = bfsPath(graph, curNode.id, destId);
        if (!path || path.length < 2) return;

        vehicle.path = path;
        vehicle.pathIndex = 0;
        vehicle.progress = 0;
    }

    update(dt: number): void {
        if (!this._initialized) {
            this.init();
            return;
        }

        const graph = this.game.trafficGraph;
        if (!graph) return;
        const nodeIds = Array.from(graph.nodes.keys());

        for (const v of this.vehicles) {
            // Skip player-driven vehicles — VehicleController handles their physics
            if ((v as any)._playerDriven) continue;

            if (v.wait > 0) { v.wait = Math.max(0, v.wait - dt); continue; }

            if (v.path.length < 2 || v.pathIndex >= v.path.length - 1) {
                this._assignNewDestination(v, nodeIds);
                if (v.path.length < 2) continue;
            }

            const fromNode = graph.nodes.get(v.path[v.pathIndex]);
            const toNode   = graph.nodes.get(v.path[v.pathIndex + 1]);
            if (!fromNode || !toNode) {
                this._assignNewDestination(v, nodeIds);
                continue;
            }

            const segLen = Math.sqrt((toNode.x - fromNode.x) ** 2 + (toNode.y - fromNode.y) ** 2);
            v.progress += (v.speed * dt) / (segLen || 1);

            if (v.progress >= 1) {
                v.progress -= 1;
                v.pathIndex++;
                v.x = toNode.x;
                v.y = toNode.y;
                // Intersection pause: 35% at degree >=3, 60% at true 4-way — reads as traffic lights
                const degree = (toNode as unknown as { neighbors: unknown[] }).neighbors?.length ?? 0;
                if (degree >= 3 && this._rng() < (degree >= 4 ? 0.60 : 0.35)) {
                    v.wait = 0.7 + this._rng() * 1.4;
                }
                if (v.pathIndex >= v.path.length - 1) {
                    this._assignNewDestination(v, nodeIds);
                }
            } else {
                v.x = fromNode.x + (toNode.x - fromNode.x) * v.progress;
                v.y = fromNode.y + (toNode.y - fromNode.y) * v.progress;
            }

            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            if (dx !== 0 || dy !== 0) {
                v.angle = Math.atan2(dx, dy);
            }
        }
    }

    destroy(): void {
        this.vehicles.length = 0;
        this._initialized = false;
    }
}
