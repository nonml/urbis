import { Game } from '../src/headless_game.js';

try {
    const game = new Game({ mapPreset: 'SMALL', seed: 12345 });
    game.init();

    console.log('Game created!');
    console.log('Before runTicks:');
    console.log('  resources.day:', game.resources.day);
    console.log('  state.resources.day:', game.state.resources.day);
    console.log('  state.time.tick:', game.state.time.tick);

    game.runTicks(10);

    console.log('After runTicks:');
    console.log('  resources.day:', game.resources.day);
    console.log('  state.resources.day:', game.state.resources.day);
    console.log('  state.time.tick:', game.state.time.tick);
} catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
}