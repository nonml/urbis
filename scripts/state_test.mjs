import { createNewGameState } from '../src/state/game_state.js';
import { test, describe } from 'node:test';
import assert from 'node:assert';

const PRESET_SIZES = {
  SMALL: { width: 10, height: 10 },
  MEDIUM: { width: 20, height: 20 },
  LARGE: { width: 30, height: 30 },
};

describe('GameState Creation Tests', () => {
  test('creates valid state for SMALL preset', () => {
    const state = createNewGameState({ mapPreset: 'SMALL', seed: 12345 });
    assert.strictEqual(state.map.width, 10, 'Width mismatch for SMALL');
    assert.strictEqual(state.map.height, 10, 'Height mismatch for SMALL');
    assert.ok(Array.isArray(state.map.tiles), 'Map tiles must be an array');
  });

  test('creates valid state for MEDIUM preset', () => {
    const state = createNewGameState({ mapPreset: 'MEDIUM', seed: 67890 });
    assert.strictEqual(state.map.width, 20, 'Width mismatch for MEDIUM');
    assert.strictEqual(state.map.height, 20, 'Height mismatch for MEDIUM');
    assert.ok(Array.isArray(state.map.tiles), 'Map tiles must be an array');
  });

  test('creates valid state for LARGE preset', () => {
    const state = createNewGameState({ mapPreset: 'LARGE', seed: 11111 });
    assert.strictEqual(state.map.width, 30, 'Width mismatch for LARGE');
    assert.strictEqual(state.map.height, 30, 'Height mismatch for LARGE');
    assert.ok(Array.isArray(state.map.tiles), 'Map tiles must be an array');
  });

  test('rejects invalid preset', () => {
    const state = createNewGameState({ mapPreset: 'INVALID', seed: 12345 });
    assert.ok(state.error, 'Expected error for invalid preset');
    assert.ok(!state.map, 'Expected no map on error');
  });

  test('rejects missing seed', () => {
    const state = createNewGameState({ mapPreset: 'SMALL', seed: undefined });
    assert.ok(state.error, 'Expected error for missing seed');
    assert.ok(!state.map, 'Expected no map on error');
  });

  test('rejects invalid seed type', () => {
    const state = createNewGameState({ mapPreset: 'SMALL', seed: 'invalid_string' });
    assert.ok(state.error, 'Expected error for invalid seed type');
    assert.ok(!state.map, 'Expected no map on invalid seed type');
  });

  test('generates deterministic state for same seed', () => {
    const seed = 12345;
    const state1 = createNewGameState({ mapPreset: 'SMALL', seed });
    const state2 = createNewGameState({ mapPreset: 'SMALL', seed });
    assert.deepStrictEqual(state1.map.tiles, state2.map.tiles, 'Same seed must produce identical tile arrays');
  });

  test('validates map dimensions match tile count', () => {
    const state = createNewGameState({ mapPreset: 'SMALL', seed: 12345 });
    const expectedLength = state.map.width * state.map.height;
    assert.strictEqual(
      state.map.tiles.length,
      expectedLength,
      `Tile count must match width(${state.map.width}) * height(${state.map.height}) = ${expectedLength}`
    );
  });
});
