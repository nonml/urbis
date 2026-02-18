import { Game } from '../src/headless_game.js';
import { BUILDING_TYPES } from '../src/constants.js';

try {
    const game = new Game({ mapPreset: 'SMALL', seed: 22222 });
    game.init();

    console.log('Before pay:');
    console.log('  game.resources.gold:', game.resources.gold);
    console.log('  game.state.resources.gold:', game.state.resources.gold);

    const initialGold = game.state.resources.gold;
    const cost = { gold: 50, food: 20, wood: 10 };
    game.resources.pay(cost);

    console.log('After pay:');
    console.log('  game.resources.gold:', game.resources.gold);
    console.log('  game.state.resources.gold:', game.state.resources.gold);
    console.log('  initialGold:', initialGold);
    console.log('  houseCost:', BUILDING_TYPES['house'].cost);
    console.log('  match?', game.state.resources.gold === initialGold - 50);
} catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
}