import { Game } from '../src/headless_game.js';
import { ScheduleManager, DAY_PHASES, getDayPhase, tickToTimeOfDay } from '../src/sim/schedule.js';

console.log('=== Schedule System Tests ===\n');

// Test 1: Day phase definitions
console.log('Test 1: Day Phase Definitions');
for (const key in DAY_PHASES) {
    const phase = DAY_PHASES[key];
    console.log(`  ${key}: ${phase.name} (${phase.start} - ${phase.end})`);
}

// Test 2: getDayPhase function
console.log('\nTest 2: getDayPhase function');
const testTimes = [0.0, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7, 0.85, 0.95, 1.0];
for (const t of testTimes) {
    const phase = getDayPhase(t);
    console.log(`  time=${t.toFixed(2)} -> ${phase.name}`);
}

// Test 3: tickToTimeOfDay function
console.log('\nTest 3: tickToTimeOfDay function');
const testTicks = [0, 5, 12, 18, 23, 24, 25, 48];
for (const tick of testTicks) {
    const time = tickToTimeOfDay(tick, 24);
    const phase = getDayPhase(time);
    console.log(`  tick=${tick} -> time=${time.toFixed(3)} -> ${phase.name}`);
}

// Test 4: ScheduleManager with Game
console.log('\nTest 4: ScheduleManager Integration with Game');
try {
    const game = new Game({ mapPreset: 'CITY', seed: 12345 });
    game.init();

    console.log(`  Map size: ${game.map.width}x${game.map.height}`);
    console.log(`  Initial citizens: ${game.citizens.citizens.length}`);

    // Run some ticks
    const ticksToRun = 48;
    console.log(`  Running ${ticksToRun} ticks (${ticksToRun / 24} days)...\n`);

    for (let i = 0; i < ticksToRun; i++) {
        const oldTime = game.state.time.timeOfDay;
        const tickPerDay = game.state.time.tickPerDay || 24;

        game.tickOnce(1000 / 24);

        const newTime = game.state.time.timeOfDay;
        const phaseChange = game.scheduleManager.checkPhaseTransition(oldTime, newTime);

        if (phaseChange || i === 0 || i === ticksToRun - 1) {
            const phase = game.scheduleManager.getPhaseAt(newTime);
            console.log(`  Tick ${i + 1}: time=${newTime.toFixed(3)}, phase=${phase.name}, population=${game.citizens.getPopulation()}`);
        }
    }

    console.log(`\n  Final population: ${game.citizens.getPopulation()}`);
    console.log(`  Average happiness: ${game.citizens.getAverageHappiness()}`);
} catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
}

// Test 5: Citizen movement test
console.log('\nTest 5: Citizen Movement Test');
try {
    const game = new Game({ mapPreset: 'SMALL', seed: 99999 });
    game.init();

    console.log('  Testing citizen movement at different phases:');

    // Spawn additional citizens for testing
    for (let i = 0; i < 3; i++) {
        const cx = Math.floor(game.map.width / 2) + i + 1;
        const cy = Math.floor(game.map.height / 2);
        game.citizens.spawnCitizen(cx, cy);
    }

    console.log(`  Total citizens: ${game.citizens.citizens.length}`);

    // Test movement at different times
    const testPhases = [
        { time: 0.1, name: 'Night' },
        { time: 0.3, name: 'Morning' },
        { time: 0.5, name: 'Day' },
        { time: 0.8, name: 'Evening' }
    ];

    for (const tp of testPhases) {
        const game2 = new Game({ mapPreset: 'SMALL', seed: 99999 });
        game2.init();

        // Manually set time
        game2.state.time.timeOfDay = tp.time;

        // Test schedule for first citizen
        const citizen = game2.citizens.citizens[0];
        const scheduleResult = game2.scheduleManager.updateCitizenSchedule(
            citizen,
            { map: game2.map, buildings: game2.buildings },
            tp.time
        );

        console.log(`  ${tp.name} (${tp.time}): citizen moved=${scheduleResult.moved}, target=${scheduleResult.target ? `${scheduleResult.target.x},${scheduleResult.target.y}` : 'none'}`);
    }
} catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
}

console.log('\n=== Schedule Tests Complete ===');