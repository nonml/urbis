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

// Import headless game that doesn't require browser dependencies
import { Game } from '../src/headless_game.js';
import { MAP_PRESETS } from '../src/constants.js';

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
        assert(game.state.schemaVersion === 1, 'Schema version is 1');
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

console.log('='.repeat(60));
console.log('City Builder Smoke Test');
console.log('='.repeat(60));

testGameCreation();
testFixedTimestep();
testDeterminism();
testCitizenLogic();
testMapBounds();
testResourceManagement();

console.log('\n' + '='.repeat(60));
console.log(`Results: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(60));

if (failCount > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
} else {
    console.log('\n✅ All smoke tests passed');
    process.exit(0);
}