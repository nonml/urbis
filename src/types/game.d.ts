/**
 * Core TypeScript interfaces for the city builder game.
 * These provide type safety for the most important data structures.
 */

// ─── Terrain & Map ─────────────────────────────────────────────────────────

export type TerrainType = 0 | 1 | 2 | 3 | 4 | 5; // water, grass, forest, mountain, road, sidewalk

export interface TileCoord {
    x: number;
    y: number;
}

export interface MapData {
    width: number;
    height: number;
    tiles: Uint8Array;
    roadMap: Int8Array | null;
    getTileAt(x: number, y: number): TerrainType;
    getParcelAt?(x: number, y: number): number;
}

// ─── Citizens ──────────────────────────────────────────────────────────────

export type CitizenMood = 'content' | 'optimistic' | 'stressed' | 'desperate';

export interface CitizenNeeds {
    food: number;    // 0–100
    rest: number;    // 0–100
    safety: number;  // 0–100
}

export interface RelationshipEdge {
    id: number;
    affinity: number; // -100..100
}

export interface CitizenSimState {
    lastX: number;
    lastY: number;
    stuckTicks: number;
    lodTier: 'near' | 'mid' | 'far';
}

export interface CitizenSchedule {
    night: string;
    morning: string;
    day: string;
    evening: string;
    dusk: string;
}

export interface Citizen {
    id: number;
    x: number;
    y: number;
    name: string;
    happiness: number; // 0–100
    mood: CitizenMood;
    needs: CitizenNeeds;
    traits: string[];
    schedule: CitizenSchedule;
    relationshipEdges: RelationshipEdge[];
    homeParcel: number;
    workBuildingId: number | null;
    unemployedTicks: number;
    personality?: { primary: string; secondary: string };
    _sim?: CitizenSimState;
}

// ─── Buildings ─────────────────────────────────────────────────────────────

export interface Building {
    id: number;
    type: string;
    x: number;
    y: number;
    rotation?: number;
    level?: number;
    hp?: number;
    maxHp?: number;
    constructionTick?: number;
}

export interface BuildingDef {
    name: string;
    cost: number;
    income?: number;
    happiness?: number;
    jobs?: number;
    population?: number;
    height?: number;
    size?: number;
    requiredTech?: string;
}

// ─── Economy ───────────────────────────────────────────────────────────────

export interface Resources {
    gold: number;
    food: number;
    materials: number;
    energy: number;
}

// ─── Time ──────────────────────────────────────────────────────────────────

export type TimeOfDay = 'dawn' | 'morning' | 'day' | 'evening' | 'dusk' | 'night';

export interface GameTime {
    tick: number;
    day: number;
    year: number;
    timeOfDay: TimeOfDay;
    tickPerDay: number;
    paused: boolean;
    speed: number;
}

// ─── Game State ────────────────────────────────────────────────────────────

export interface GameMeta {
    mapPreset: 'SMALL' | 'CITY' | 'MEGA';
    seed: number;
    difficulty: string;
    version: string;
}

export interface GameState {
    time: GameTime;
    resources: Resources;
    meta: GameMeta;
    population: number;
    happiness: number;
}

// ─── Events ────────────────────────────────────────────────────────────────

export interface GameEvent<T = unknown> {
    type: string;
    data?: T;
    tick?: number;
}

export type EventHandler<T = unknown> = (data: T) => void;

export interface EventBus {
    on<T = unknown>(event: string, handler: EventHandler<T>): void;
    off<T = unknown>(event: string, handler: EventHandler<T>): void;
    emit<T = unknown>(event: string, data?: T): void;
}
