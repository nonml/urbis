import { Game } from '../src/headless_game.js';

try {
    const game = new Game({ mapPreset: 'SMALL', seed: 12345 });
    console.log('Before init:');
    console.log('  citizens.length:', game.citizens.citizens.length);
    console.log('  population:', game.resources.population);

    game.init();

    console.log('After init:');
    console.log('  citizens.length:', game.citizens.citizens.length);
    console.log('  state.resources.population:', game.state.resources.population);
    console.log('  resources.population:', game.resources.population);
    console.log('  getPopulation():', game.citizens.getPopulation());
} catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
}