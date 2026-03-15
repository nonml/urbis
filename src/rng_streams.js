// RNG Streams - Deterministic RNG with separate streams for different systems
// Usage:
//   const rngStreams = createRNGStreams(seed);
//   rngStreams.world.next()  // For world generation
//   rngStreams.sim.next()    // For simulation events
//   rngStreams.quest.next()  // For quest logic
//   rngStreams.rival.next()  // For rival AI
//   rngStreams.vfx.next()    // For visual effects
//   rngStreams.narrative.next()  // For NPC/narrative generation
//
// All streams derive from the same base seed but are independent.

import { RNG } from './rng.js';

/**
 * Creates separate RNG streams from a base seed
 * Each stream is XOR'd with a unique constant to ensure independence
 */
export function createRNGStreams(seed) {
    // XOR constants to derive independent streams from base seed
    const WORLD_SEED_CONST = 0x2D3E5D7F;
    const SIM_SEED_CONST = 0x8A9B7C6D;
    const QUEST_SEED_CONST = 0xE4F5A6B7;
    const RIVAL_SEED_CONST = 0x1C2D3E4F;
    const VFX_SEED_CONST = 0x5A6B7C8D;
    const NARRATIVE_SEED_CONST = 0x7B8C9D0E;

    const baseSeed = (seed >>> 0) || 1;

    return {
        world: new RNG(baseSeed ^ WORLD_SEED_CONST),
        sim: new RNG(baseSeed ^ SIM_SEED_CONST),
        quest: new RNG(baseSeed ^ QUEST_SEED_CONST),
        rival: new RNG(baseSeed ^ RIVAL_SEED_CONST),
        vfx: new RNG(baseSeed ^ VFX_SEED_CONST),
        narrative: new RNG(baseSeed ^ NARRATIVE_SEED_CONST),
    };
}

/**
 * Creates a saveable RNG streams object (only stores seeds, not RNG state)
 * This is for serialization - we don't save RNG state, just seeds
 */
export function createRNGStreamSeeds(seed) {
    const WORLD_SEED_CONST = 0x2D3E5D7F;
    const SIM_SEED_CONST = 0x8A9B7C6D;
    const QUEST_SEED_CONST = 0xE4F5A6B7;
    const RIVAL_SEED_CONST = 0x1C2D3E4F;
    const VFX_SEED_CONST = 0x5A6B7C8D;
    const NARRATIVE_SEED_CONST = 0x7B8C9D0E;

    const baseSeed = (seed >>> 0) || 1;

    return {
        worldSeed: (baseSeed ^ WORLD_SEED_CONST) >>> 0,
        simSeed: (baseSeed ^ SIM_SEED_CONST) >>> 0,
        questSeed: (baseSeed ^ QUEST_SEED_CONST) >>> 0,
        rivalSeed: (baseSeed ^ RIVAL_SEED_CONST) >>> 0,
        vfxSeed: (baseSeed ^ VFX_SEED_CONST) >>> 0,
        narrativeSeed: (baseSeed ^ NARRATIVE_SEED_CONST) >>> 0,
    };
}

/**
 * Reconstructs RNG instances from saved seeds
 */
export function createRNGsFromSeeds(streamSeeds) {
    return {
        world: new RNG(streamSeeds.worldSeed),
        sim: new RNG(streamSeeds.simSeed),
        quest: new RNG(streamSeeds.questSeed),
        rival: new RNG(streamSeeds.rivalSeed),
        vfx: new RNG(streamSeeds.vfxSeed),
        narrative: new RNG(streamSeeds.narrativeSeed),
    };
}

// Re-export RNG class since it's the core implementation
export { RNG } from './rng.js';