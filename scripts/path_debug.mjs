import { Map } from '../src/map.js';
import { TERRAIN_WATER } from '../src/constants.js';

const map = new Map(40, 40, 12345);

console.log('Terrain at key locations:');
console.log('  (5, 5):', map.grid[5][5], '(grass=1, water=0)');
console.log('  (15, 15):', map.grid[15][15]);
console.log('  (0, 0):', map.grid[0][0]);
console.log('  (20, 20):', map.grid[20][20]);

console.log('\nWater count:', map.countTerrain(TERRAIN_WATER));

// Check if there are any water tiles blocking the path
console.log('\nPath from (5,5) to (15,15):');
for (let y = 5; y <= 15; y++) {
    let row = '';
    for (let x = 5; x <= 15; x++) {
        const t = map.grid[y][x];
        row += (t === TERRAIN_WATER ? 'W' : '.');
    }
    console.log(' ', row);
}