import { createNewGameState } from '../src/state/game_state.js';

const state = createNewGameState({ mapPreset: 'SMALL', seed: 12345 });
console.log('state.map.width:', state.map.width);
console.log('state.map.height:', state.map.height);