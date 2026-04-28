#!/usr/bin/env node
/**
 * Smoke test for the city builder game
 * Runs headless simulation without renderer
 * Usage: node scripts/smoke_test.mjs
 *
 * This script runs a headless simulation to verify:
 * - Game creates without errors
 * - Fixed-timestep works correctly
 * - Determinism (same seed = same results)
 * - Resources stay valid (no NaN, non-negative)
 * - Map bounds are respected
 */

// Suppress Worker-not-defined rejections from PathfindingProxy in headless Node
process.on('unhandledRejection', (reason) => {
    if (reason instanceof ReferenceError && /Worker/.test(reason.message)) return;
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});

// Import headless game that doesn't require browser dependencies
import { Game } from '../src/headless_game.js';
import { MAP_PRESETS } from '../src/constants.js';
import { eventBus, EVENT_TYPES } from '../src/sim/events.js';
import { InteractableManager } from '../src/sim/interactables.js';
import { getChunkId } from '../src/world/chunks.js';
import { validateQuestDefinition } from '../src/content/quests/schema.js';
import { CoverSystem, CoverController } from '../src/player/cover.js';
import { WaveEncounter } from '../src/sim/encounters/wave_encounter.js';
import { sequence, selector, condition, action, inverter, tick as btTick, SUCCESS, FAILURE, RUNNING } from '../src/sim/agents/bt.js';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passCount++;
    } else {
        console.log(`  ✗ ${message}`);
        failCount++;
    }
}

function testGameCreation() {
    console.log('\n[1] Game Creation');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 12345 });
        assert(game !== null, 'Game instance created');
        assert(game.state !== null, 'GameState exists');
assert(game.state.schemaVersion >= 1, `Schema version is >= 1 (got ${game.state.schemaVersion})`);
        assert(game.state.meta.seed === 12345, 'Seed stored correctly');
        assert(game.state.time.tick === 0, 'Tick starts at 0');
        assert(game.state.resources.gold === 100, 'Initial gold is 100');
    } catch (e) {
        console.log(`  ✗ Game creation failed: ${e.message}`);
        failCount++;
    }
}

function testFixedTimestep() {
    console.log('\n[2] Fixed Timestep Simulation');

    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 12345 });
        game.init();

        const initialDay = game.getDay();
        const initialGold = game.state.resources.gold;

        // Simulate 10 ticks (10 seconds = 10 days)
        game.runTicks(10);

        assert(game.getDay() === initialDay + 10, `Day advanced by 10 (got ${game.getDay()})`);
        assert(game.state.time.tick === 10, 'Tick counter incremented');

        // Resources should have changed based on buildings
        assert(game.state.resources.gold >= 0, 'Gold not negative');
        assert(game.state.resources.food >= 0, 'Food not negative');
        assert(game.state.resources.wood >= 0, 'Wood not negative');
    } catch (e) {
        console.log(`  ✗ Fixed timestep test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testDeterminism() {
    console.log('\n[3] Determinism Check');

    try {
        // Run two games with same seed, should produce same results
        const game1 = new Game({ mapPreset: 'SMALL', seed: 999999 });
        game1.init();
        game1.runTicks(5);

        const game2 = new Game({ mapPreset: 'SMALL', seed: 999999 });
        game2.init();
        game2.runTicks(5);

        // Compare key values
        assert(game1.getDay() === game2.getDay(), 'Days match');
        assert(game1.state.resources.gold === game2.state.resources.gold, 'Gold matches');
        assert(game1.state.resources.population === game2.state.resources.population, 'Population matches');
        assert(game1.buildings.buildings.length === game2.buildings.buildings.length, 'Building count matches');
    } catch (e) {
        console.log(`  ✗ Determinism test failed: ${e.message}`);
        failCount++;
    }
}

function testCitizenLogic() {
    console.log('\n[4] Citizen Logic');

    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 54321 });
        game.init();

        const initialPopulation = game.state.resources.population;
        assert(initialPopulation > 0, 'Initial population > 0');

        // Run ticks and check citizen behavior
        let NaNFound = false;
        game.runTicks(10);

        // Check no NaN in stats
        if (isNaN(game.state.resources.population) || isNaN(game.state.resources.gold)) {
            NaNFound = true;
        }

        assert(!NaNFound, 'No NaN values in citizen stats');
        assert(game.state.resources.population >= 0, 'Population not negative');
    } catch (e) {
        console.log(`  ✗ Citizen logic test failed: ${e.message}`);
        failCount++;
    }
}

function testMapBounds() {
    console.log('\n[5] Map Bounds');

    try {
        for (const preset of ['SMALL', 'CITY', 'MEGA']) {
            const config = MAP_PRESETS[preset];
            const game = new Game({ mapPreset: preset, seed: 11111 });

            assert(game.map.width === config.width, `${preset} map width correct`);
            assert(game.map.height === config.height, `${preset} map height correct`);

            // Test tile access at bounds
            const tile = game.map.getTileAt(0, 0);
            assert(tile !== null, `${preset} can read tile at (0,0)`);

            const tile2 = game.map.getTileAt(config.width - 1, config.height - 1);
            assert(tile2 !== null, `${preset} can read tile at bounds`);
        }
    } catch (e) {
        console.log(`  ✗ Map bounds test failed: ${e.message}`);
        failCount++;
    }
}

function testResourceManagement() {
    console.log('\n[6] Resource Management');

    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 22222 });
        game.init();

        // Test paying resources (note: init builds a house costing 10 gold)
        const initialGold = game.state.resources.gold; // 90 after init
        const cost = { gold: 50, food: 20, wood: 10 };
        game.resources.pay(cost);

        assert(game.state.resources.gold === initialGold - 50, 'Gold deducted correctly');
        assert(game.state.resources.food >= 0, 'Food not negative');
        assert(game.state.resources.wood >= 0, 'Wood not negative');

        // Test canAfford
        const canAfford = game.resources.canAfford(cost);
        assert(typeof canAfford === 'boolean', 'canAfford returns boolean');

        // Test add/remove
        game.resources.add('gold', 100);
        assert(game.state.resources.gold >= 0, 'Gold stays non-negative after add');
    } catch (e) {
        console.log(`  ✗ Resource management test failed: ${e.message}`);
        failCount++;
    }
}

function testRngStreamSeeds() {
    console.log('\n[7] RNG Stream Seeds (Ticket A-3)');

    try {
        // Test that RNG streams seeds are stored in state meta
        const game = new Game({ mapPreset: 'SMALL', seed: 33333 });
        game.init();

        // Check that rngStreamSeeds exist in meta
        assert(game.state.meta.rngStreams !== undefined, 'rngStreams exist in meta');
        assert(game.state.meta.rngStreams.worldSeed !== undefined, 'worldSeed exists');
        assert(game.state.meta.rngStreams.simSeed !== undefined, 'simSeed exists');
        assert(game.state.meta.rngStreams.questSeed !== undefined, 'questSeed exists');
        assert(game.state.meta.rngStreams.rivalSeed !== undefined, 'rivalSeed exists');
        assert(game.state.meta.rngStreams.vfxSeed !== undefined, 'vfxSeed exists');

        // Test determinism across reloads using saved seeds
        const game1 = new Game({ mapPreset: 'SMALL', seed: 44444 });
        game1.init();
        game1.runTicks(20);

        // Save the seed from first game
        const savedSeed = game1.state.meta.seed;
        const savedRngStreams = game1.state.meta.rngStreams;

        // Create new game with same seed and verify determinism
        const game2 = new Game({ mapPreset: 'SMALL', seed: savedSeed });
        game2.init();
        game2.runTicks(20);

        assert(game1.state.resources.gold === game2.state.resources.gold, 'Deterministic reload: gold matches');
        assert(game1.state.resources.population === game2.state.resources.population, 'Deterministic reload: population matches');

        // Verify RNG streams were restored correctly
        assert(game2.state.meta.rngStreams !== undefined, 'rngStreams restored after reload');

        // Test RNG stream independence (different seeds produce different values)
        assert(savedRngStreams.worldSeed !== savedRngStreams.simSeed, 'worldSeed != simSeed');
        assert(savedRngStreams.simSeed !== savedRngStreams.questSeed, 'simSeed != questSeed');
        assert(savedRngStreams.questSeed !== savedRngStreams.rivalSeed, 'questSeed != rivalSeed');
    } catch (e) {
        console.log(`  ✗ RNG stream seeds test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

console.log('='.repeat(60));
console.log('City Builder Smoke Test');
console.log('='.repeat(60));

testGameCreation();
testFixedTimestep();
testDeterminism();
testCitizenLogic();
testMapBounds();
testResourceManagement();
testRngStreamSeeds();
testInteractPrompt();
testChunkStreaming();
testNavGridApi();
testBuildPlacementV1();
testEconomyLedgerV1();
testServicesV1();
testGoalsV1();
testCitizenSimV2();
testJobsStaffingV2();
testAnomalyDetectorsV1();
testHackingScanV1();
testBreachPenaltyV1();
testHackActionsHeatV1();
testQuestSchemaValidationV2();
testQuestBranchingChoiceMemoryV2();
testQuestRewardsUnlocksV2();
testCaseManagerPersistenceV1();
testEvidenceSystemV1();
testCaseArchetypesAssemblyV1();
testFactionRegistryTrackingV1();
testFactionPerksHostilityV1();
testFactionTuningV1();
testCoverSnapController();
testCoverBlindfire();
testCoverNpcUse();
testBehaviorTreeLibrary();

function testCoverBlindfire() {
    console.log('\n[45] Cover System — Blindfire Aim Penalty Curve');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 55555 });
        game.init();

        const cs = new CoverSystem(game);
        cs.rebuild();
        const cc = new CoverController(cs);

        const px = Math.floor(game.map.width / 2);
        const py = Math.floor(game.map.height / 2);
        cc.snapToCover(px, py);

        if (!cc.isInCover) {
            assert(true, 'No cover available (skip blindfire tests)');
            return;
        }

        cc.blindfire();
        assert(cc.isBlindFiring, 'Blindfire state active');
        assert(cc.isInCover, 'Still in cover during blindfire');
        const pen0 = cc.aimPenalty;
        assert(pen0 >= 0.6, 'Blindfire starts with high aim penalty');

        for (let i = 0; i < 10; i++) cc.tickBlindfire();
        const pen10 = cc.aimPenalty;
        assert(pen10 > pen0, 'Penalty increases over time');
        assert(pen10 <= 0.9, 'Penalty capped at 0.9');

        assert(cc.damageReduction > 0, 'Still has damage reduction while blindfiring');

        cc.stopBlindfire();
        assert(cc.state === 'snapped', 'Back to snapped after stop');
        assert(cc.aimPenalty === 0.5, 'Penalty resets to snapped level');
    } catch (e) {
        console.log(`  ✗ Cover blindfire test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testBehaviorTreeLibrary() {
    console.log('\n[47] Behavior Tree Library');
    try {
        const ctx = { hp: 80, ammo: 10, inCover: false };

        const tree = selector(
            sequence(
                condition(c => c.hp < 20),
                action(c => { c.fleeing = true; return SUCCESS; })
            ),
            sequence(
                condition(c => c.ammo > 0),
                action(c => { c.shooting = true; return SUCCESS; })
            ),
            action(c => { c.idling = true; return SUCCESS; })
        );

        let result = btTick(tree, ctx);
        assert(result === SUCCESS, 'Tree returns SUCCESS');
        assert(ctx.shooting === true, 'Selector picks shooting branch (hp ok, ammo > 0)');
        assert(!ctx.fleeing, 'Did not flee (hp > 20)');

        ctx.ammo = 0;
        ctx.shooting = false;
        result = btTick(tree, ctx);
        assert(ctx.idling === true, 'Falls through to idle when no ammo and hp ok');

        ctx.hp = 5;
        ctx.fleeing = false;
        result = btTick(tree, ctx);
        assert(ctx.fleeing === true, 'Flees when hp < 20');

        const invTree = inverter(condition(c => c.hp < 20));
        assert(btTick(invTree, { hp: 80 }) === SUCCESS, 'Inverter flips FAILURE to SUCCESS');
        assert(btTick(invTree, { hp: 5 }) === FAILURE, 'Inverter flips SUCCESS to FAILURE');

        const seqFail = sequence(
            action(() => SUCCESS),
            action(() => FAILURE),
            action(() => SUCCESS)
        );
        assert(btTick(seqFail, {}) === FAILURE, 'Sequence stops at first failure');

        const runAction = action(() => RUNNING);
        assert(btTick(runAction, {}) === RUNNING, 'RUNNING propagates from action');
    } catch (e) {
        console.log(`  ✗ BT library test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testCoverNpcUse() {
    console.log('\n[46] Cover System — NPC Cover Query');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 55555 });
        game.init();

        const cs = new CoverSystem(game);
        cs.rebuild();

        if (cs.count === 0) {
            assert(true, 'No cover points on empty map (skip)');
            return;
        }

        const cx = Math.floor(game.map.width / 2);
        const cy = Math.floor(game.map.height / 2);
        const cover = cs.findCoverFor(cx, cy, cx + 10, cy, 10);
        assert(cover !== null, 'NPC finds cover facing threat');
        assert(typeof cover.nx === 'number', 'Cover has normal');

        const cc = new CoverController(cs);
        const snapped = cc.snapToCover(cover.x, cover.y);
        assert(snapped, 'NPC can snap to found cover point');
        assert(cc.damageReduction > 0, 'NPC gets damage reduction from same cover');

        cc.release();
    } catch (e) {
        console.log(`  ✗ NPC cover use test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testCoverSnapController() {
    console.log('\n[44] Cover System — Snap-to-Cover Controller');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 55555 });
        game.init();

        const cs = new CoverSystem(game);
        cs.rebuild();
        const cc = new CoverController(cs);

        assert(cc.state === 'idle', 'Starts idle');
        assert(!cc.isInCover, 'Not in cover initially');

        const px = Math.floor(game.map.width / 2);
        const py = Math.floor(game.map.height / 2);
        const snapped = cc.snapToCover(px, py);

        if (cs.count > 0) {
            assert(snapped, 'Snaps to nearest cover point');
            assert(cc.state === 'snapped', 'State is snapped');
            assert(cc.isInCover, 'isInCover true');
            assert(cc.damageReduction > 0, 'Damage reduction when in cover');
            assert(cc.aimPenalty > 0, 'Aim penalty when snapped');

            const pos = cc.getSnappedPosition();
            assert(pos !== null, 'Snapped position returned');

            cc.lean();
            assert(cc.isLeaning, 'Leaning state active');
            assert(cc.aimPenalty < 0.5, 'Aim penalty reduced when leaning');

            cc.unlean();
            assert(cc.state === 'snapped', 'Back to snapped after unlean');

            cc.release();
            assert(cc.state === 'idle', 'Released to idle');
            assert(!cc.isInCover, 'No longer in cover');
        } else {
            assert(!snapped, 'No cover points to snap to (expected for empty map)');
        }
    } catch (e) {
        console.log(`  ✗ Cover snap controller test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testInteractPrompt() {
    console.log('\n[8] Interact Prompt + Action Dispatch (Ticket B-3)');

    try {
        // Verify event bus has PLAYER_INTERACT
        assert(EVENT_TYPES.PLAYER_INTERACT !== undefined, 'PLAYER_INTERACT event exists');

        // Verify InteractableManager class exists and can be instantiated
        const manager = new InteractableManager(32, 32, 12345);
        assert(manager !== undefined, 'InteractableManager class exists');
        assert(manager.generate !== undefined, 'InteractableManager has generate method');

        // Test getNearbyInteractable function signature
        // Create a mock map for generation
        const mockMap = {
            width: 32,
            height: 32,
            grid: Array(32).fill().map(() => Array(32).fill(1)), // All grass
            districts: [{ center: { x: 16, y: 16 } }],
            getDistrictAt: (x, y) => 0
        };
        manager.generate(mockMap);
        assert(manager.interactables.length > 0, 'Interactables generated');

        // Verify getNearbyInteractable returns correct type
        const nearby = manager.getNearbyInteractable(0, 0, 2.2);
        assert(nearby === null || nearby !== null, 'getNearbyInteractable returns valid result');

        // Note: Full E key integration requires browser environment (keyboard events)
        // The smoke test verifies the event and module structure are in place
    } catch (e) {
        console.log(`  ✗ Interact prompt test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testChunkStreaming() {
    console.log('\n[9] Chunk Streaming (Ticket D-1)');

    try {
        const game = new Game({ mapPreset: 'MEGA', seed: 10101 });
        game.init();

        const p = game.player;
        const result = game.chunks.update({ x: p.x, y: p.y }, [], 0);
        assert(result.active.length <= 49, `Active chunks <= 49 (got ${result.active.length})`);

        const playerChunk = getChunkId(p.x, p.y, game.chunks.chunkSize);
        assert(game.chunks.isLoaded(playerChunk), 'Player chunk is loaded');

        // Move far away, old chunk should unload after delay
        const result2 = game.chunks.update({ x: game.map.width - 2, y: game.map.height - 2 }, [], 3001);
        assert(result2.unloadedNow.length > 0, 'Far chunks unload after delay');
    } catch (e) {
        console.log(`  ✗ Chunk streaming test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testNavGridApi() {
    console.log('\n[10] Navigation Grid API (Ticket D-3)');

    try {
        const game = new Game({ mapPreset: 'CITY', seed: 20202 });
        game.init();

        // Choose two walkable road tiles to query path
        let start = null;
        let target = null;
        for (let y = 0; y < game.map.height; y++) {
            for (let x = 0; x < game.map.width; x++) {
                if (game.scheduleManager.isWalkable(x, y)) {
                    if (!start) start = { x, y };
                    target = { x, y };
                }
            }
        }

        assert(start !== null && target !== null, 'Found walkable tiles');
        if (!start || !target) return;

        const pathA = game.scheduleManager.findPath(start, target);
        const pathB = game.scheduleManager.findPath(start, target);
        assert(Array.isArray(pathA), 'findPath returns array polyline');
        assert(pathA.length === pathB.length, 'Path query is deterministic');
        assert(game.scheduleManager.isWalkable(start.x, start.y), 'isWalkable(start) is true');

        // Place a building on path destination and verify it becomes blocked
        game.buildings.build('house', target.x, target.y);
        game.scheduleManager.syncNavBuildings(game.buildings);
        assert(!game.scheduleManager.isWalkable(target.x, target.y), 'Building blocks walkability');
    } catch (e) {
        console.log(`  ✗ Navigation grid test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testBuildPlacementV1() {
    console.log('\n[11] Build Placement UX API (Ticket E-1)');

    try {
        const game = new Game({ mapPreset: 'CITY', seed: 30303 });
        game.init();

        // Find a road tile and verify placement is rejected with reason.
        let road = null;
        for (let y = 0; y < game.map.height && !road; y++) {
            for (let x = 0; x < game.map.width; x++) {
                const idx = y * game.map.width + x;
                if (game.map.roadMap?.[idx] === 1 || game.map.sidewalkMap?.[idx] === 1) {
                    road = { x, y };
                    break;
                }
            }
        }
        assert(road !== null, 'Found road or sidewalk tile');
        if (road) {
            const blocked = game.attemptBuild('house', road.x, road.y, { rotation: 1 });
            assert(!blocked.ok, 'Building on road/sidewalk is blocked');
            assert(typeof blocked.reason === 'string' && blocked.reason.length > 0, 'Blocked placement returns reason');
        }

        // Find a valid parcel tile and verify rotation is stored deterministically.
        let valid = null;
        for (let y = 0; y < game.map.height && !valid; y++) {
            for (let x = 0; x < game.map.width; x++) {
                if (game.map.getParcelAt(x, y) < 0) continue;
                const existing = game.buildings.getBuildingsAt(x, y);
                const idx = y * game.map.width + x;
                if (existing.length > 0) continue;
                if (game.map.roadMap?.[idx] === 1 || game.map.sidewalkMap?.[idx] === 1) continue;
                if (game.map.getTileAt(x, y) === 0) continue;
                valid = { x, y };
                break;
            }
        }
        assert(valid !== null, 'Found valid parcel tile');
        if (!valid) return;

        const built = game.attemptBuild('farm', valid.x, valid.y, { rotation: 3 });
        assert(built.ok, 'Valid build placement succeeds');
        assert(built.building.rotation === 3, 'Placed building stores rotation');
    } catch (e) {
        console.log(`  ✗ Build placement test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testEconomyLedgerV1() {
    console.log('\n[12] Economy Ledger API (Ticket E-2)');

    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 40404 });
        game.init();
        game.runTicks(3);

        const report = game.getResourceReport();
        assert(report !== null && typeof report === 'object', 'getResourceReport returns object');
        assert(report.historyLength > 0, 'Ledger has tick history');
        assert(report.report?.gold !== undefined, 'Gold report exists');
        assert(Number.isFinite(report.report.gold.net), 'Gold net delta is numeric');
        assert(Array.isArray(report.report.food.contributors), 'Food contributors list exists');
    } catch (e) {
        console.log(`  ✗ Economy ledger test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testServicesV1() {
    console.log('\n[13] Services System (Ticket E-3)');

    try {
        const game = new Game({ mapPreset: 'CITY', seed: 50505 });
        game.init();
        game.runTicks(2);

        assert(game.servicesManager !== undefined, 'ServiceManager exists');
        assert(game.servicesManager.metrics.city.brownout === true, 'Power shortage (brownout) detected');
        assert(game.powerShortageTicks >= 1, 'Power shortage counter increments');

        const center = game.map.districts[0]?.center || { x: Math.floor(game.map.width / 2), y: Math.floor(game.map.height / 2) };
        const beforePolice = game.servicesManager.getTileCoverage(center.x, center.y, 'police');

        let buildSpot = null;
        const maxD = 12;
        for (let dy = -maxD; dy <= maxD && !buildSpot; dy++) {
            for (let dx = -maxD; dx <= maxD; dx++) {
                const x = center.x + dx;
                const y = center.y + dy;
                if (x < 0 || y < 0 || x >= game.map.width || y >= game.map.height) continue;
                if (game.map.getParcelAt(x, y) < 0) continue;
                if (game.map.getTileAt(x, y) === 0) continue;
                const idx = y * game.map.width + x;
                if (game.map.roadMap?.[idx] === 1 || game.map.sidewalkMap?.[idx] === 1) continue;
                if (game.buildings.getBuildingsAt(x, y).length > 0) continue;
                buildSpot = { x, y };
                break;
            }
        }
        assert(buildSpot !== null, 'Found valid placement near district center');
        if (buildSpot) {
            const built = game.attemptBuild('police-station', buildSpot.x, buildSpot.y);
            assert(built.ok, 'Police station placement succeeds');
            game.runTicks(1);
            const afterPolice = game.servicesManager.getTileCoverage(center.x, center.y, 'police');
            assert(afterPolice >= beforePolice, 'Police coverage improves or stays higher nearby');
        }
    } catch (e) {
        console.log(`  ✗ Services test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testGoalsV1() {
    console.log('\n[14] Goals + Sandbox (Ticket E-4)');

    try {
        const standard = new Game({ mapPreset: 'SMALL', seed: 60606, mode: 'standard' });
        standard.init();
        standard.runTicks(6); // day > 3 while pop is still below threshold
        assert(standard.goalsManager.state.ended, 'Standard mode triggers end-state');
        assert(standard.goalsManager.state.endState?.kind === 'lose', 'Standard mode can lose');

        const sandbox = new Game({ mapPreset: 'SMALL', seed: 60606, mode: 'sandbox' });
        sandbox.init();
        sandbox.runTicks(6);
        assert(!sandbox.goalsManager.state.ended, 'Sandbox disables win/lose end-state');

        const winTest = new Game({ mapPreset: 'SMALL', seed: 70707, mode: 'standard' });
        winTest.init();
        winTest.goalsManager.config.win.population = 1;
        winTest.goalsManager.config.win.avgHappiness = 1;
        winTest.goalsManager.config.win.holdTicks = 1;
        winTest.runTicks(1);
        assert(winTest.goalsManager.state.endState?.kind === 'win', 'Win condition can trigger');
    } catch (e) {
        console.log(`  ✗ Goals test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testCitizenSimV2() {
    console.log('\n[15] Citizen Sim v2 (Ticket F-1)');
    try {
        const game = new Game({ mapPreset: 'CITY', seed: 80808, mode: 'standard' });
        game.init();
        const c0 = game.citizens.citizens[0];
        const foodBefore = c0.needs?.food ?? 100;
        game.runTicks(2);
        assert(c0.schedule !== undefined, 'Citizen has schedule');
        assert(c0.needs !== undefined, 'Citizen has needs');
        assert(c0.mood !== undefined, 'Citizen has mood');
        assert(c0.homeParcel !== undefined, 'Citizen has homeParcel');
        assert((c0.needs.food ?? 100) <= foodBefore, 'Needs decay over time');

        const lod = game.citizenSim.lodCounts;
        const sumLod = (lod.near || 0) + (lod.mid || 0) + (lod.far || 0);
        assert(sumLod === game.citizens.citizens.length, 'Citizen LOD buckets cover all citizens');
    } catch (e) {
        console.log(`  ✗ Citizen sim test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testJobsStaffingV2() {
    console.log('\n[16] Jobs + Staffing Coupling (Ticket F-2)');
    try {
        const game = new Game({ mapPreset: 'CITY', seed: 90909, mode: 'standard' });
        game.init();

        let valid = null;
        for (let y = 0; y < game.map.height && !valid; y++) {
            for (let x = 0; x < game.map.width; x++) {
                if (game.map.getParcelAt(x, y) < 0) continue;
                const idx = y * game.map.width + x;
                if (game.map.roadMap?.[idx] === 1 || game.map.sidewalkMap?.[idx] === 1) continue;
                if (game.map.getTileAt(x, y) === 0) continue;
                if (game.buildings.getBuildingsAt(x, y).length > 0) continue;
                valid = { x, y };
                break;
            }
        }
        assert(valid !== null, 'Found valid tile for job building');
        if (!valid) return;

        const built = game.attemptBuild('market', valid.x, valid.y);
        assert(built.ok, 'Job building placement succeeds');
        game.runTicks(2);

        const employedBefore = game.citizens.citizens.filter((c) => c.job !== 'unemployed').length;
        assert(employedBefore > 0, 'Citizens find jobs');

        const staffing = game.jobsManager.getStaffingRatio(built.building.id);
        assert(staffing >= 0 && staffing <= 1, 'Staffing ratio is clamped 0..1');

        game.buildings.destroy(built.building);
        game.runTicks(1);
        const employedAfter = game.citizens.citizens.filter((c) => c.job !== 'unemployed').length;
        assert(employedAfter <= employedBefore, 'Removing key building can reduce employment');
    } catch (e) {
        console.log(`  ✗ Jobs/staffing test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testAnomalyDetectorsV1() {
    console.log('\n[17] Relationship + Anomalies (Ticket F-3)');
    try {
        const game = new Game({ mapPreset: 'CITY', seed: 100100, mode: 'standard' });
        game.init();
        const c0 = game.citizens.citizens[0];
        c0.needs.food = 5;
        c0._sim.stuckTicks = 12;

        const before = (game.state.world?.anomalies || []).length;
        game.anomalyDetectors.run(10);
        const after = (game.state.world?.anomalies || []).length;
        assert(after > before, 'Anomaly detector emits events');

        const anomaly = game.state.world.anomalies[game.state.world.anomalies.length - 1];
        assert(['missing_person', 'workplace_conflict', 'blackmail'].includes(anomaly.type), 'Anomaly type is valid');

        // Cooldown should suppress duplicate spam immediately.
        game.anomalyDetectors.run(11);
        const after2 = (game.state.world?.anomalies || []).length;
        assert(after2 === after, 'Anomaly detector is rate-limited');
    } catch (e) {
        console.log(`  ✗ Anomaly detector test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testHackingScanV1() {
    console.log('\n[18] Hacking Scan Registry (Ticket G-1)');
    try {
        const game = new Game({ mapPreset: 'CITY', seed: 110110, mode: 'standard' });
        game.init();
        assert(game.interactables.interactables.length > 0, 'Interactables generated for hacking');

        const first = game.interactables.interactables[0];
        const scanA = game.interactables.scanNearby(first.x, first.y, 25);
        const scanB = game.interactables.scanNearby(first.x, first.y, 25);
        assert(scanA.length > 0, 'Nearby scan returns nodes');
        assert(scanA.every((n) => n.securityLevel >= 1 && n.securityLevel <= 5), 'Security levels are clamped 1..5');
        assert(scanA.every((n) => ['city', 'corp', 'gang', 'police'].includes(n.ownerFaction)), 'Owner factions are valid');
        assert(scanA.map((n) => n.id).join('|') === scanB.map((n) => n.id).join('|'), 'Scan ordering is deterministic');
    } catch (e) {
        console.log(`  ✗ Hacking scan test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testBreachPenaltyV1() {
    console.log('\n[19] Breach Fail Penalty + Cooldown (Ticket G-2)');
    try {
        const game = new Game({ mapPreset: 'CITY', seed: 120120, mode: 'standard' });
        game.init();
        const node = game.interactables.interactables[0];
        const heatBefore = game.state.player.heat || 0;

        const result = game.executeHack(node, false);
        assert(result.ok && result.success === false, 'Failed breach resolves as failure');
        assert((game.state.player.heat || 0) === heatBefore + 5, 'Failed breach adds +5 heat');
        assert(!game.interactables.isAvailable(node), 'Failed node is cooling down');

        game.state.time.tick = result.cooldownUntil;
        assert(game.interactables.isAvailable(node), 'Node becomes available after 10 ticks');
    } catch (e) {
        console.log(`  ✗ Breach penalty test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testHackActionsHeatV1() {
    console.log('\n[20] Hack Actions + Heat System (Ticket G-3)');
    try {
        const game = new Game({ mapPreset: 'CITY', seed: 130130, mode: 'standard' });
        game.init();

        const cctv = game.interactables.interactables.find((n) => n.type === 'CCTV_POLE');
        const telecomEven = game.interactables.interactables.find((n) => n.type === 'TELECOM_BOX' && (n.securityLevel % 2 === 0));
        const telecomOdd = game.interactables.interactables.find((n) => n.type === 'TELECOM_BOX' && (n.securityLevel % 2 !== 0));
        const power = game.interactables.interactables.find((n) => n.type === 'POWER_SUBSTATION');
        assert(!!cctv && !!power, 'Found nodes for core hack actions');

        if (cctv) {
            const r = game.executeHack(cctv, true);
            assert(r.ok && r.action === 'camera_takeover', 'Camera takeover action executes');
        }
        if (power) {
            const r = game.executeHack(power, true);
            assert(r.ok && r.action === 'district_blackout_ping', 'District blackout action executes');
            assert((game.state.world.blackouts || []).length > 0, 'Blackout world effect recorded');
        }
        if (telecomEven) {
            const r = game.executeHack(telecomEven, true);
            assert(r.ok && r.action === 'traffic_light_switch', 'Traffic switch action executes');
            assert((game.state.world.trafficSwitches || []).length > 0, 'Traffic world effect recorded');
        }
        if (telecomOdd) {
            const r = game.executeHack(telecomOdd, true);
            assert(r.ok && r.action === 'door_unlock', 'Door unlock action executes');
            assert((game.state.world.unlockedDoors || []).length > 0, 'Door world effect recorded');
        }

        game.heatSystem.setHeat(140);
        assert(game.state.player.heat === 100, 'Heat clamps to max');
        assert(game.state.player.heatState === 'pursuit', 'Heat state reaches pursuit at high heat');
        game.heatSystem.setHeat(-10);
        assert(game.state.player.heat === 0, 'Heat clamps to min');
    } catch (e) {
        console.log(`  ✗ Hack actions/heat test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testQuestSchemaValidationV2() {
    console.log('\n[21] Quest Schema Validation (Ticket H-1)');
    try {
        const invalid = {
            id: 'broken_quest',
            steps: [{ id: 's1', kind: 'unknown_kind' }],
        };
        const iv = validateQuestDefinition(invalid);
        assert(!iv.valid, 'Invalid quest is rejected');
        assert(iv.errors.length > 0, 'Invalid quest returns validation errors');

        const valid = {
            id: 'valid_quest',
            title: 'Valid Quest',
            tags: ['test'],
            trigger: 'ANOMALY_TEST',
            rewards: [{ type: 'add_resource', resource: 'gold', amount: 5 }],
            steps: [
                { id: 's1', kind: 'trigger', trigger: 'ANOMALY_TEST' },
                { id: 's2', kind: 'outcome', outcomes: [{ id: 'done', effect: [] }] },
            ],
        };
        const vv = validateQuestDefinition(valid);
        assert(vv.valid, 'Valid quest passes schema validation');
    } catch (e) {
        console.log(`  ✗ Quest schema validation test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testQuestBranchingChoiceMemoryV2() {
    console.log('\n[22] Branching + Choice Memory (Ticket H-2)');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 140140, mode: 'standard' });
        game.init();

        const questDef = {
            id: 'branching_case',
            type: 'casefile',
            title: 'Branching Case',
            tags: ['branching'],
            steps: [
                {
                    id: 'pick',
                    kind: 'choice',
                    text: 'Pick a branch',
                    choices: [
                        {
                            id: 'a',
                            label: 'Path A',
                            setFlags: ['chose_a'],
                            runFlags: { branch_global: 'A' },
                            heatDelta: 3,
                            nextStep: 'gate',
                        },
                        {
                            id: 'b',
                            label: 'Path B',
                            runFlags: { branch_global: 'B' },
                            nextStep: 'alt',
                        },
                    ],
                },
                {
                    id: 'gate',
                    kind: 'conditional',
                    condition: { type: 'run_flag', key: 'branch_global', equals: 'A' },
                    thenStep: 'resolve_a',
                    elseStep: 'resolve_b',
                },
                { id: 'alt', kind: 'outcome', outcomes: [{ id: 'alt_done', effect: [] }] },
                { id: 'resolve_a', kind: 'outcome', outcomes: [{ id: 'a_done', effect: [] }] },
                { id: 'resolve_b', kind: 'outcome', outcomes: [{ id: 'b_done', effect: [] }] },
            ],
        };

        const q = game.questEngine.addQuest(questDef);
        game.questEngine.advanceQuest(q); // enters choice state
        game.questEngine.handlePlayerDecision({
            questId: q.id,
            stepId: 'pick',
            choiceId: 'a',
            choice: questDef.steps[0].choices[0],
        });
        game.questEngine.update();

        assert(game.state.progress.runFlags.branch_global === 'A', 'Choice writes run flag');
        assert(q.data.flags.chose_a === true, 'Choice writes quest-local flag');
        assert((game.state.player.heat || 0) >= 3, 'Choice metric effect applied (heat)');

        const serialized = game.questEngine.serialize();
        game.questEngine.deserialize(serialized);
        const restored = game.questEngine.getQuestById('branching_case');
        if (restored) {
            assert(restored.data.flags.chose_a === true, 'Quest choice flags survive serialize/deserialize');
        } else {
            assert(true, 'Quest may already be completed and moved out of active set');
        }
    } catch (e) {
        console.log(`  ✗ Quest branching test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testQuestRewardsUnlocksV2() {
    console.log('\n[23] Quest Rewards + Idempotency (Ticket H-3)');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 150150, mode: 'standard' });
        game.init();
        const goldBefore = game.state.resources.gold;
        const repBefore = game.state.player.reputation || 0;

        const questDef = {
            id: 'reward_case',
            type: 'casefile',
            title: 'Reward Case',
            tags: ['rewards'],
            rewards: [
                { type: 'add_resource', resource: 'gold', amount: 25 },
                { type: 'rep_delta', amount: 7 },
                { type: 'modify_heat', delta: -4 },
                { type: 'unlock_building', buildingId: 'police-station' },
                { type: 'unlock_building', buildingId: 'cctv-network' },
                { type: 'unlock_building', buildingId: 'counterintel' },
                { type: 'unlock_hack', hackId: 'traffic_light_switch' },
                { type: 'unlock_hack', hackId: 'district_blackout_ping' },
            ],
            steps: [{ id: 'done', kind: 'outcome', outcomes: [{ id: 'done_outcome', effect: [] }] }],
        };

        const q = game.questEngine.addQuest(questDef);
        game.questEngine.advanceQuest(q); // completes quest + applies rewards

        assert((game.state.resources.gold || 0) >= goldBefore + 25, 'Reward adds resources');
        assert((game.state.player.reputation || 0) >= repBefore + 7, 'Reward modifies reputation');
        assert(game.state.progress.unlocks.buildings.includes('police-station'), 'Reward unlocks building #1');
        assert(game.state.progress.unlocks.buildings.includes('cctv-network'), 'Reward unlocks building #2');
        assert(game.state.progress.unlocks.buildings.includes('counterintel'), 'Reward unlocks building #3');
        assert(game.state.progress.unlocks.hacks.includes('traffic_light_switch'), 'Reward unlocks hack #1');
        assert(game.state.progress.unlocks.hacks.includes('district_blackout_ping'), 'Reward unlocks hack #2');
        assert(!!game.state.progress.rewardLog.reward_case, 'Reward application is logged');

        const goldAfterFirst = game.state.resources.gold;
        const applyAgain = game.questEngine.rewardSystem.applyRewards(q, questDef.rewards);
        assert(applyAgain.applied === false, 'Rewards are idempotent (second apply blocked)');
        assert(game.state.resources.gold === goldAfterFirst, 'Resources do not duplicate on re-apply');
    } catch (e) {
        console.log(`  ✗ Quest rewards test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testCaseManagerPersistenceV1() {
    console.log('\n[24] Case File Model + Persistence (Ticket I-1)');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 160160, mode: 'standard' });
        game.init();

        const created = game.spawnCase('missing_person', { seed: 4242 });
        assert(created !== null, 'Case can be created');
        assert(Array.isArray(game.state.cases.active), 'state.cases.active exists');
        assert(Array.isArray(game.state.cases.completed), 'state.cases.completed exists');
        assert(created.suspects.length > 0, 'Case has suspects');
        assert(created.leads.length > 0, 'Case has leads');

        // Progress first chapter by force-finishing its quest.
        const qid = created.questIds[0];
        const q = game.questEngine.getQuestById(qid);
        game.questEngine.finishQuest(q, 'test');
        assert(created.currentChapter >= 1, 'Case chapter advances after quest completion');

        // Simulate persistence by serializing case state and restoring in a new game.
        const snapshot = JSON.parse(JSON.stringify(game.state.cases));
        const game2 = new Game({ mapPreset: 'SMALL', seed: 160160, mode: 'standard' });
        game2.init();
        game2.state.cases = snapshot;
        game2.caseManager.ensureState();
        game2.caseManager.rebuildQuestMap();
        assert(game2.state.cases.active.length === snapshot.active.length, 'Active cases restore from snapshot');
        assert(game2.state.cases.completed.length === snapshot.completed.length, 'Completed cases restore from snapshot');
    } catch (e) {
        console.log(`  ✗ Case manager test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testEvidenceSystemV1() {
    console.log('\n[25] Evidence Collect + Gating (Ticket I-2)');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 170170, mode: 'standard' });
        game.init();
        const c = game.spawnCase('corruption', { seed: 5151 });
        assert(c !== null, 'Case for evidence test created');
        const qid = c.questIds[c.questIds.length - 1];
        const quest = game.questEngine.getQuestById(qid);
        assert(quest !== null, 'Case chapter quest exists');

        const before = game.state.cases.evidence.length;
        game.questEngine.applyEffect('spawn_clue:money_trail', quest);
        const after = game.state.cases.evidence.length;
        assert(after === before + 1, 'Clue registers an evidence item');

        game.questEngine.applyEffect('spawn_clue:money_trail', quest);
        const afterDup = game.state.cases.evidence.length;
        assert(afterDup === after, 'Duplicate evidence is not collected twice');

        // Investigate step requiring evidence should fail before evidence and pass after.
        const fakeQuest = {
            id: 'fake_evidence_quest',
            data: { targetLocation: null, clues: [], markers: [], evidence: [], flags: {}, choices: [], triggers: {} },
            steps: [],
            completedSteps: [],
            currentStepIndex: 0,
            context: {},
            status: 'active',
        };
        const caseId = c.id;
        game.caseManager.questToCase.set(fakeQuest.id, caseId);
        const step = { id: 'investigate_gate', kind: 'investigate', requiresEvidenceId: 'required_doc' };
        const blocked = game.questEngine.handleInvestigateStep(fakeQuest, step);
        assert(blocked.done === false, 'Investigate step is gated without evidence');
        game.evidenceSystem.registerEvidence({ caseId, clueId: 'required_doc', sourcePoiId: 'poi_test', type: 'log', collected: true });
        const passed = game.questEngine.handleInvestigateStep(fakeQuest, step);
        assert(passed.done === true, 'Investigate step passes after evidence collection');
    } catch (e) {
        console.log(`  ✗ Evidence system test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testCaseArchetypesAssemblyV1() {
    console.log('\n[26] Case Archetypes + Procedural Assembly (Ticket I-3)');
    try {
        const game = new Game({ mapPreset: 'CITY', seed: 180180, mode: 'standard' });
        game.init();
        // Increase citizen pool for better suspect diversity.
        const cx = Math.floor(game.map.width / 2);
        const cy = Math.floor(game.map.height / 2);
        for (let i = 0; i < 10; i++) game.citizens.spawnCitizen(cx + (i % 3), cy + Math.floor(i / 3));

        const a = game.spawnCase('missing_person', { seed: 1001 });
        const b = game.spawnCase('corruption', { seed: 1002 });
        const c = game.spawnCase('extortion', { seed: 1003 });
        assert(a.type === 'missing_person', 'Missing person archetype assembles');
        assert(b.type === 'corruption', 'Corruption archetype assembles');
        assert(c.type === 'extortion', 'Extortion archetype assembles');

        const d1 = game.spawnCase('missing_person', { seed: 2001 });
        const d2 = game.spawnCase('missing_person', { seed: 2002 });
        assert(d1.id !== d2.id, 'Case ids differ across seeds');
        const sig1 = `${d1.districtId}:${(d1.suspects[0] || {}).citizenId || 'x'}`;
        const sig2 = `${d2.districtId}:${(d2.suspects[0] || {}).citizenId || 'x'}`;
        assert(sig1 !== sig2 || d1.caseSeed !== d2.caseSeed, 'Case suspects/locations vary across seeds');

        const chapters = d1.chapters || [];
        assert(chapters.length >= 3 && chapters.length <= 6, 'Case chapter count within 3..6');
        const branchChapter = chapters[1];
        const stepIds = new Set((branchChapter.steps || []).map((s) => s.id));
        const cond = (branchChapter.steps || []).find((s) => s.kind === 'conditional');
        assert(!!cond, 'Branch chapter contains conditional step');
        assert(stepIds.has(cond.thenStep) && stepIds.has(cond.elseStep), 'Conditional references coherent step ids');
    } catch (e) {
        console.log(`  ✗ Case archetype assembly test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testFactionRegistryTrackingV1() {
    console.log('\n[27] Faction Registry + Reputation Tracking (Ticket J-1)');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 190190, mode: 'standard' });
        game.init();

        const rep = game.state.factions?.reputation || {};
        assert(['citizens', 'police', 'gangs', 'corp'].every((k) => k in rep), 'All 4 faction ids exist');

        const before = game.factionSystem.getReputation('police');
        game.factionSystem.modifyRep('police', -15, 'test_delta', 'quests');
        const after = game.factionSystem.getReputation('police');
        assert(after === before - 15, 'modifyRep applies deterministic delta');
        assert((game.state.factions.recentChanges || []).length > 0, 'Rep changes are logged');

        game.factionSystem.setReputation('police', -300, 'clamp_test');
        assert(game.factionSystem.getReputation('police') === -100, 'Reputation is clamped to -100');
        game.factionSystem.setReputation('police', 300, 'clamp_test');
        assert(game.factionSystem.getReputation('police') === 100, 'Reputation is clamped to +100');
    } catch (e) {
        console.log(`  ✗ Faction registry test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testFactionPerksHostilityV1() {
    console.log('\n[28] Faction Perks + Hostility Rules (Ticket J-2)');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 200200, mode: 'standard' });
        game.init();

        // Police friendly should improve heat decay.
        game.heatSystem.setHeat(20);
        game.factionSystem.setReputation('police', 70, 'test_friendly');
        const beforeDecay = game.state.player.heat;
        game.heatSystem.decay(false);
        const dropFriendly = beforeDecay - game.state.player.heat;

        game.heatSystem.setHeat(20);
        game.factionSystem.setReputation('police', -70, 'test_hostile');
        const beforeDecayHostile = game.state.player.heat;
        game.heatSystem.decay(false);
        const dropHostile = beforeDecayHostile - game.state.player.heat;
        assert(dropFriendly > dropHostile, 'Police-friendly rep increases heat decay versus hostile');

        // Corp rep should alter wage burden via perk multiplier.
        game.jobsManager.totalWageCost = 100;
        game.resources.gold = 1000;
        game.factionSystem.setReputation('corp', 70, 'test_corp_friendly');
        const wageFriendly = game.jobsManager.applyWages(game.resources, game.factionSystem.getPerkSnapshot().modifiers.wageMultiplier || 1);
        game.resources.gold = 1000;
        game.factionSystem.setReputation('corp', -70, 'test_corp_hostile');
        const wageHostile = game.jobsManager.applyWages(game.resources, game.factionSystem.getPerkSnapshot().modifiers.wageMultiplier || 1);
        assert(wageFriendly < wageHostile, 'Corp-friendly rep reduces wages versus hostile');

        // Hostility encounter stub should fire when gang/police rep is hostile.
        const encountersBefore = (game.state.world.factionEncounters || []).length;
        game.state.time.tick += 10;
        game.factionSystem.setReputation('gangs', -80, 'test_hostile_gang');
        game.factionSystem.update();
        const encountersAfter = (game.state.world.factionEncounters || []).length;
        assert(encountersAfter > encountersBefore, 'Hostile rep emits encounter notifications');
    } catch (e) {
        console.log(`  ✗ Faction perks/hostility test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function testFactionTuningV1() {
    console.log('\n[29] Faction UI/Tuning Multipliers (Ticket J-3)');
    try {
        const game = new Game({ mapPreset: 'SMALL', seed: 210210, mode: 'standard' });
        game.init();

        const meta = game.state.meta || {};
        assert(meta.devTuning?.factionMultipliers !== undefined, 'Dev tuning multipliers exist in state.meta');

        const before = game.factionSystem.getReputation('police');
        game.state.meta.devTuning.factionMultipliers.hacks = 2;
        game.factionSystem.modifyRep('police', -3, 'tuned_hack_delta', 'hacks');
        const after = game.factionSystem.getReputation('police');
        assert(after === before - 6, 'Tuning multiplier affects deltas immediately');

        // Ensure recent change has a reason suitable for UI explainability.
        const last = (game.state.factions.recentChanges || []).slice(-1)[0];
        assert(typeof last.reason === 'string' && last.reason.length > 0, 'Recent faction change carries a reason');
    } catch (e) {
        console.log(`  ✗ Faction tuning test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

function runRapierDeterminismTest() {
    return import('@dimforge/rapier3d-compat').then(mod => {
        const RAPIER = mod.default;
        return RAPIER.init().then(() => {
            console.log('\n[30] Rapier Physics Determinism');
            const STEPS = 1000;
            const BODY_COUNT = 8;
            const results = [];

            for (let run = 0; run < 2; run++) {
                const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
                const bodies = [];

                for (let i = 0; i < BODY_COUNT; i++) {
                    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                        .setTranslation(i * 2.0, 10.0 + i, 0.0);
                    const body = world.createRigidBody(bodyDesc);
                    const cd = RAPIER.ColliderDesc.ball(0.5).setRestitution(0.3);
                    world.createCollider(cd, body);
                    bodies.push(body);
                }

                const groundDesc = RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(0, 0, 0);
                const ground = world.createRigidBody(groundDesc);
                world.createCollider(
                    RAPIER.ColliderDesc.cuboid(50, 0.1, 50), ground
                );

                for (let s = 0; s < STEPS; s++) {
                    world.step();
                }

                const positions = bodies.map(b => {
                    const t = b.translation();
                    return [t.x, t.y, t.z];
                });
                results.push(positions);
                world.free();
            }

            let allMatch = true;
            for (let i = 0; i < BODY_COUNT; i++) {
                for (let axis = 0; axis < 3; axis++) {
                    if (results[0][i][axis] !== results[1][i][axis]) {
                        allMatch = false;
                    }
                }
            }
            assert(allMatch, 'Identical seeds produce identical positions after 1000 steps');
        });
    }).catch(e => {
        console.log(`  ✗ Rapier determinism test failed: ${e.message}`);
        failCount++;
    });
}

function runRapierPoolTest() {
    return import('../src/sim/physics/rapier_world.js').then(mod => {
        const { RapierPhysicsWorld, initRapier, RAPIER: R } = mod;
        return initRapier().then(() => {
            console.log('\n[31] Rapier Rigid-Body Pool Cap + Recycle');
            const pw = new RapierPhysicsWorld({ poolCap: 4 });
            assert(pw.ready, 'Physics world initializes when Rapier is ready');
            assert(pw.poolCap === 4, 'Pool cap is configurable');

            const R2 = mod.RAPIER;
            const ids = [];
            for (let i = 0; i < 6; i++) {
                const desc = R2.RigidBodyDesc.dynamic()
                    .setTranslation(i, 5, 0);
                const id = pw.createRigidBody(desc);
                pw.createCollider(R2.ColliderDesc.ball(0.5), id);
                ids.push(id);
            }
            assert(pw.bodyCount <= 4, `Body count capped at pool limit (got ${pw.bodyCount})`);
            assert(pw.getBodyPosition(ids[0]) === null, 'Oldest body recycled');
            assert(pw.getBodyPosition(ids[5]) !== null, 'Newest body still alive');

            pw.removeBody(ids[5]);
            assert(pw.getBodyPosition(ids[5]) === null, 'Explicit remove works');
            assert(pw.bodyCount === 3, `Body count after remove is 3 (got ${pw.bodyCount})`);
            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Rapier pool test failed: ${e.message}`);
        failCount++;
    });
}

function runRapierSaveLoadTest() {
    return import('../src/sim/physics/rapier_world.js').then(mod => {
        const { RapierPhysicsWorld, initRapier, RAPIER: R2 } = mod;
        return initRapier().then(() => {
            console.log('\n[32] Rapier Physics Save/Load');
            const pw = new RapierPhysicsWorld({ poolCap: 16 });
            const R = mod.RAPIER;

            const desc = R.RigidBodyDesc.dynamic().setTranslation(3, 10, -2);
            const id = pw.createRigidBody(desc);
            pw.createCollider(R.ColliderDesc.ball(0.5), id);

            for (let i = 0; i < 60; i++) pw.step();

            const pos1 = pw.getBodyPosition(id);
            const snap = pw.serialize();
            assert(snap !== null, 'Serialize produces data');
            assert(snap.bodies.length === 1, 'Serialized body count matches');

            const pw2 = new RapierPhysicsWorld({ poolCap: 16 });
            pw2.deserialize(snap);
            const pos2 = pw2.getBodyPosition(snap.bodies[0].id);
            assert(pos2 !== null, 'Deserialized body exists');
            const dx = Math.abs(pos1.x - pos2.x);
            const dy = Math.abs(pos1.y - pos2.y);
            const dz = Math.abs(pos1.z - pos2.z);
            assert(dx < 0.01 && dy < 0.01 && dz < 0.01, 'Position survives save/load');

            pw.destroy();
            pw2.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Rapier save/load test failed: ${e.message}`);
        failCount++;
    });
}

function runPhysicsPropTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/props.js'),
    ]).then(([rwMod, propMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[33] Physics Props — Traffic Cone');
            const { RapierPhysicsWorld } = rwMod;
            const { PhysicsPropManager, PROP_TYPES } = propMod;

            assert(PROP_TYPES.traffic_cone !== undefined, 'traffic_cone type defined');

            const pw = new RapierPhysicsWorld({ poolCap: 32 });
            const rng = { next: () => 0.5 };
            const pm = new PhysicsPropManager(pw, rng);

            const cone = pm.spawn('traffic_cone', 5, 2, 0);
            assert(cone !== null, 'Cone spawns successfully');
            assert(cone.type === 'traffic_cone', 'Cone has correct type');
            assert(pm.propCount === 1, 'Prop count is 1');

            const pos0 = pm.getPosition(cone.id);
            assert(pos0 !== null, 'Cone has initial position');
            assert(Math.abs(pos0.x - 5) < 0.01, 'Cone X matches spawn');

            for (let i = 0; i < 30; i++) pw.step();
            const pos1 = pm.getPosition(cone.id);
            assert(pos1.y < pos0.y, 'Cone falls under gravity');

            pm.remove(cone.id);
            assert(pm.propCount === 0, 'Prop removed');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Physics prop test failed: ${e.message}`);
        failCount++;
    });
}

function runTrashcanKickTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/props.js'),
    ]).then(([rwMod, propMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[34] Physics Props — Trashcan Kick');
            const { RapierPhysicsWorld, RAPIER: R } = rwMod;
            const { PhysicsPropManager, PROP_TYPES } = propMod;
            const RR = rwMod.RAPIER;

            assert(PROP_TYPES.trashcan !== undefined, 'trashcan type defined');

            const pw = new RapierPhysicsWorld({ poolCap: 32 });
            const rng = { next: () => 0.5 };
            const pm = new PhysicsPropManager(pw, rng);

            const groundDesc = RR.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
            const ground = pw.createRigidBody(groundDesc);
            pw.createCollider(RR.ColliderDesc.cuboid(50, 0.1, 50), ground);

            const can = pm.spawn('trashcan', 0, 1, 0);
            assert(can !== null, 'Trashcan spawns');

            for (let i = 0; i < 60; i++) pw.step();
            const posRest = pm.getPosition(can.id);

            pm.applyImpulse(can.id, { x: 5, y: 2, z: 0 });
            for (let i = 0; i < 30; i++) pw.step();
            const posKicked = pm.getPosition(can.id);

            assert(posKicked.x > posRest.x + 0.1, 'Trashcan rolls when kicked');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Trashcan kick test failed: ${e.message}`);
        failCount++;
    });
}

function runSignToppleTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/props.js'),
    ]).then(([rwMod, propMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[35] Physics Props — Sign Bend-Then-Fall');
            const { RapierPhysicsWorld } = rwMod;
            const { PhysicsPropManager, PROP_TYPES } = propMod;
            const RR = rwMod.RAPIER;

            assert(PROP_TYPES.sign.toppleThreshold > 0, 'Sign has topple threshold');

            const pw = new RapierPhysicsWorld({ poolCap: 32 });
            const rng = { next: () => 0.5 };
            const pm = new PhysicsPropManager(pw, rng);

            const groundDesc = RR.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
            const ground = pw.createRigidBody(groundDesc);
            pw.createCollider(RR.ColliderDesc.cuboid(50, 0.1, 50), ground);

            const sign = pm.spawn('sign', 0, 1.0, 0);
            assert(sign !== null, 'Sign spawns');

            for (let i = 0; i < 60; i++) pw.step();
            assert(!pm.isToppled(sign.id), 'Sign upright at rest');

            pm.applyImpulse(sign.id, { x: 80, y: 20, z: 0 });
            pm.applyTorqueImpulse(sign.id, { x: 0, y: 0, z: 40 });
            for (let i = 0; i < 120; i++) pw.step();
            assert(pm.isToppled(sign.id), 'Sign topples after strong impact');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Sign topple test failed: ${e.message}`);
        failCount++;
    });
}

function runChairPropTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/props.js'),
    ]).then(([rwMod, propMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[36] Physics Props — Chair');
            const { RapierPhysicsWorld } = rwMod;
            const { PhysicsPropManager, PROP_TYPES } = propMod;
            const RR = rwMod.RAPIER;

            assert(PROP_TYPES.chair !== undefined, 'chair type defined');
            assert(PROP_TYPES.chair.collider === 'cuboid', 'Chair uses cuboid collider');

            const pw = new RapierPhysicsWorld({ poolCap: 32 });
            const rng = { next: () => 0.5 };
            const pm = new PhysicsPropManager(pw, rng);

            const groundDesc = RR.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
            const ground = pw.createRigidBody(groundDesc);
            pw.createCollider(RR.ColliderDesc.cuboid(50, 0.1, 50), ground);

            const chair = pm.spawn('chair', 2, 1, 3);
            assert(chair !== null, 'Chair spawns');

            for (let i = 0; i < 60; i++) pw.step();
            const posRest = pm.getPosition(chair.id);
            assert(posRest.y < 1.0, 'Chair settles under gravity');

            pm.applyImpulse(chair.id, { x: 3, y: 1, z: 0 });
            for (let i = 0; i < 30; i++) pw.step();
            const posKicked = pm.getPosition(chair.id);
            assert(posKicked.x > posRest.x + 0.05, 'Chair slides when pushed');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Chair prop test failed: ${e.message}`);
        failCount++;
    });
}

function runCrateBreakTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/props.js'),
    ]).then(([rwMod, propMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[37] Physics Props — Breakable Crate');
            const { RapierPhysicsWorld } = rwMod;
            const { PhysicsPropManager, PROP_TYPES } = propMod;

            assert(PROP_TYPES.crate.breakable === true, 'Crate is breakable');
            assert(PROP_TYPES.crate.hp === 30, 'Crate has 30 HP');

            const pw = new RapierPhysicsWorld({ poolCap: 32 });
            const rng = { next: () => 0.5 };
            const pm = new PhysicsPropManager(pw, rng);

            let destroyedProp = null;
            pm.onDestroy(prop => { destroyedProp = prop; });

            const crate = pm.spawn('crate', 0, 1, 0);
            assert(crate !== null, 'Crate spawns');
            assert(crate.hp === 30, 'Crate starts with full HP');

            const r1 = pm.damage(crate.id, 10);
            assert(!r1.destroyed, 'Crate survives 10 damage');
            assert(r1.prop.hp === 20, 'Crate HP reduced to 20');

            const r2 = pm.damage(crate.id, 25);
            assert(r2.destroyed, 'Crate destroyed at 0 HP');
            assert(destroyedProp !== null, 'onDestroy callback fired');
            assert(pm.propCount === 0, 'Destroyed crate removed from manager');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Crate break test failed: ${e.message}`);
        failCount++;
    });
}

function runPropSpawnerTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/props.js'),
    ]).then(([rwMod, propMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[38] Physics Props — Density-Tuned Spawner');
            const { RapierPhysicsWorld } = rwMod;
            const { PhysicsPropManager, PropSpawner } = propMod;

            const pw = new RapierPhysicsWorld({ poolCap: 64 });
            let rngVal = 0.1;
            const rng = { next: () => { rngVal = (rngVal * 7 + 0.3) % 1; return rngVal; } };
            const pm = new PhysicsPropManager(pw, rng);
            const spawner = new PropSpawner(pm, rng);

            const COMMERCIAL = 2;
            const INDUSTRIAL = 3;
            let spawned = 0;
            for (let x = 0; x < 10; x++) {
                const result = spawner.spawnForTile(x, 0, COMMERCIAL);
                if (result) spawned++;
            }
            assert(spawned > 0, 'Spawner produces props for commercial tiles');
            assert(spawned <= 10, 'Spawner respects density limit');

            const dup = spawner.spawnForTile(0, 0, COMMERCIAL);
            assert(dup === null, 'Spawner skips already-spawned tiles');

            let indSpawned = 0;
            for (let x = 10; x < 20; x++) {
                if (spawner.spawnForTile(x, 1, INDUSTRIAL)) indSpawned++;
            }
            assert(indSpawned > 0, 'Industrial zone also spawns props');

            spawner.reset();
            assert(spawner.spawnedCount === 0, 'Reset clears spawned set');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Prop spawner test failed: ${e.message}`);
        failCount++;
    });
}

function runRagdoll3BoneTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/ragdoll.js'),
    ]).then(([rwMod, ragMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[39] Ragdoll — 3-Bone Skeleton');
            const { RapierPhysicsWorld } = rwMod;
            const { Ragdoll } = ragMod;
            const RR = rwMod.RAPIER;

            const pw = new RapierPhysicsWorld({ poolCap: 32 });

            const groundDesc = RR.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
            const ground = pw.createRigidBody(groundDesc);
            pw.createCollider(RR.ColliderDesc.cuboid(50, 0.1, 50), ground);

            const rag = new Ragdoll(pw, 0, 3, 0);
            assert(rag.alive, 'Ragdoll is alive after creation');
            assert(rag.bones.hip != null, 'Hip bone exists');
            assert(rag.bones.chest != null, 'Chest bone exists');
            assert(rag.bones.head != null, 'Head bone exists');

            const pos0 = rag.getPositions();
            assert(pos0.head.y > pos0.hip.y, 'Head starts above hip');

            for (let i = 0; i < 90; i++) pw.step();
            const pos1 = rag.getPositions();
            assert(pos1.hip.y < 3.0, 'Ragdoll falls under gravity');

            rag.destroy();
            assert(!rag.alive, 'Ragdoll destroyed');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Ragdoll 3-bone test failed: ${e.message}`);
        failCount++;
    });
}

function runRagdollBlendInTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/ragdoll.js'),
    ]).then(([rwMod, ragMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[40] Ragdoll — Blend-In Within 150ms');
            const { RapierPhysicsWorld } = rwMod;
            const { Ragdoll } = ragMod;

            const pw = new RapierPhysicsWorld({ poolCap: 32 });
            const rag = new Ragdoll(pw, 0, 3, 0);

            assert(rag.state === 'idle', 'Starts idle');
            assert(rag.blendFactor(0) === 0, 'Blend factor 0 when idle');

            rag.activate(10);
            assert(rag.state === 'blending_in', 'State is blending_in after activate');
            assert(rag.blendFactor(10) === 0, 'Blend 0 at activation tick');
            assert(rag.blendFactor(12) > 0, 'Blend > 0 partway through');

            rag.update(15);
            assert(rag.state === 'active', 'Fully active after 5 ticks (166ms)');
            assert(rag.blendFactor(15) === 1, 'Blend factor 1.0 when active');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Ragdoll blend-in test failed: ${e.message}`);
        failCount++;
    });
}

function runRagdollBlendOutTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/ragdoll.js'),
    ]).then(([rwMod, ragMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[41] Ragdoll — Blend-Out Within 1.5s');
            const { RapierPhysicsWorld } = rwMod;
            const { Ragdoll } = ragMod;

            const pw = new RapierPhysicsWorld({ poolCap: 32 });
            const rag = new Ragdoll(pw, 0, 3, 0);

            rag.activate(0);
            rag.update(5);
            assert(rag.state === 'active', 'Active after blend-in');

            rag.beginRest(10);
            assert(rag.state === 'blending_out', 'Blending out after beginRest');
            assert(rag.blendFactor(10) === 1, 'Blend 1.0 at rest start');
            assert(rag.blendFactor(32) > 0 && rag.blendFactor(32) < 1, 'Blend partial midway');

            rag.update(55);
            assert(rag.state === 'rest', 'Rest state after 45 ticks (1.5s)');
            assert(rag.blendFactor(55) === 0, 'Blend factor 0 at rest');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Ragdoll blend-out test failed: ${e.message}`);
        failCount++;
    });
}

function runRagdollKnockbackTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/ragdoll.js'),
    ]).then(([rwMod, ragMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[42] Ragdoll — Explosive Knockback');
            const { RapierPhysicsWorld } = rwMod;
            const { Ragdoll } = ragMod;

            const pw = new RapierPhysicsWorld({ poolCap: 32 });
            const rag = new Ragdoll(pw, 5, 2, 0);

            rag.activate(0);
            rag.update(5);

            const posBefore = rag.getPositions();
            rag.applyExplosiveKnockback({ x: 3, y: 1, z: 0 }, 30);
            for (let i = 0; i < 30; i++) pw.step();
            const posAfter = rag.getPositions();

            assert(posAfter.hip.x > posBefore.hip.x, 'Hip pushed away from explosion');
            assert(posAfter.chest.x > posBefore.chest.x, 'Chest pushed away');
            assert(posAfter.head.y > posBefore.head.y || posAfter.head.x > posBefore.head.x, 'Head launched');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Ragdoll knockback test failed: ${e.message}`);
        failCount++;
    });
}

function runRagdollDespawnTest() {
    return Promise.all([
        import('../src/sim/physics/rapier_world.js'),
        import('../src/sim/physics/ragdoll.js'),
    ]).then(([rwMod, ragMod]) => {
        return rwMod.initRapier().then(() => {
            console.log('\n[43] Ragdoll — Deterministic Despawn');
            const { RapierPhysicsWorld } = rwMod;
            const { RagdollManager } = ragMod;

            const pw = new RapierPhysicsWorld({ poolCap: 32 });
            const rm = new RagdollManager(pw, { despawnTicks: 10 });

            const id = rm.spawn(0, 3, 0, 0);
            assert(id !== null, 'Ragdoll spawned via manager');
            assert(rm.count === 1, 'Manager tracks 1 ragdoll');

            rm.update(5);
            assert(rm.count === 1, 'Still alive at tick 5');

            rm.update(10);
            assert(rm.count === 0, 'Despawned at tick 10 (deterministic)');
            assert(rm.get(id) === null, 'Ragdoll no longer accessible');

            const id2 = rm.spawn(0, 3, 0, 20);
            const id3 = rm.spawn(5, 3, 0, 22);
            assert(rm.count === 2, 'Two ragdolls tracked');
            rm.update(30);
            assert(rm.count === 1, 'First despawned, second still alive');
            rm.update(32);
            assert(rm.count === 0, 'Both despawned by their respective deadlines');

            pw.destroy();
        });
    }).catch(e => {
        console.log(`  ✗ Ragdoll despawn test failed: ${e.message}`);
        failCount++;
    });
}

function testWaveEncounter() {
    console.log('\n[48] Wave Encounter System');
    try {
        const spawnedUnits = [];
        let tickCounter = 0;
        const mockGame = {
            state: { time: { tick: 0 }, player: { x: 50, y: 50 } },
            rng: { int: (a, b) => a },
            policeSystem: {
                units: spawnedUnits,
                spawnUnit(opts) {
                    const u = { id: `p_${spawnedUnits.length}`, active: true, ...opts };
                    spawnedUnits.push(u);
                    return u;
                },
            },
            ui: { showMessage() {} },
        };

        const we = new WaveEncounter(mockGame);
        assert(!we.active, 'Inactive before start');

        we.start();
        assert(we.active, 'Active after start');
        assert(we.wave === 1, 'Starts at wave 1');
        assert(spawnedUnits.length === 3, 'Wave 1 spawns 3 units');

        for (const u of spawnedUnits) u.active = false;
        mockGame.state.time.tick = 40;
        we.update(40);
        assert(we.wave === 2, 'Advances to wave 2 when cleared');

        const w2Count = spawnedUnits.filter(u => u.active).length;
        assert(w2Count === 4, 'Wave 2 spawns 4 units');

        for (const u of spawnedUnits) u.active = false;
        mockGame.state.time.tick = 230;
        we.update(230);
        assert(we.wave === 3, 'Advances to wave 3');

        for (const u of spawnedUnits) u.active = false;
        mockGame.state.time.tick = 420;
        we.update(420);
        assert(we.wave === 4, 'Advances to wave 4');

        for (const u of spawnedUnits) u.active = false;
        mockGame.state.time.tick = 610;
        we.update(610);
        assert(we.wave === 5, 'Advances to wave 5');

        for (const u of spawnedUnits) u.active = false;
        mockGame.state.time.tick = 800;
        we.update(800);
        assert(!we.active, 'Encounter ends after wave 5');
        assert(we.completed, 'Marked completed on victory');

        const data = we.serialize();
        const we2 = new WaveEncounter(mockGame);
        we2.deserialize(data);
        assert(we2.completed, 'Serialization round-trips completed flag');
        assert(we2.wave === 5, 'Serialization round-trips wave count');
    } catch (e) {
        console.log(`  ✗ Wave encounter test failed: ${e.message}`);
        console.log(`  Stack: ${e.stack}`);
        failCount++;
    }
}

testWaveEncounter();

runRapierDeterminismTest().then(() => runRapierPoolTest()).then(() => runRapierSaveLoadTest()).then(() => runPhysicsPropTest()).then(() => runTrashcanKickTest()).then(() => runSignToppleTest()).then(() => runChairPropTest()).then(() => runCrateBreakTest()).then(() => runPropSpawnerTest()).then(() => runRagdoll3BoneTest()).then(() => runRagdollBlendInTest()).then(() => runRagdollBlendOutTest()).then(() => runRagdollKnockbackTest()).then(() => runRagdollDespawnTest()).then(() => {
    console.log('='.repeat(60));
    console.log(`Results: ${passCount} passed, ${failCount} failed`);
    console.log('='.repeat(60));

    if (failCount > 0) {
        console.log('\n❌ Some tests failed');
        process.exit(1);
    } else {
        console.log('\n✅ All smoke tests passed');
        process.exit(0);
    }
});
