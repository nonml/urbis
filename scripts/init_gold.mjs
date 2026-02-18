import { Game } from '../src/headless_game.js';

try {
    const game = new Game({ mapPreset: 'SMALL', seed: 22222 });
    game.init();

    console.log('After init:');
    console.log('  game.resources.gold:', game.resources.gold);
    console.log('  game.state.resources.gold:', game.state.resources.gold);
    console.log('  House cost:', 10); // from BUILDING_TYPES
    console.log('  Expected after pay 50:', game.state.resources.gold - 50);
    console.log('  Actual after pay 50:', function() {
        const cost = { gold: 50, food: 20, wood: 10 };
        game.resources.pay(cost);
        return game.state.resources.gold;
    }());
} catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
}