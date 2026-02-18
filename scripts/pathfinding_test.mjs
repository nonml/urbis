import { Map } from '../src/map.js';
import { Pathfinding } from '../src/sim/pathfinding.js';

console.log('Testing Pathfinding...\n');

// Create a map
const map = new Map(40, 40, 12345);

// Create pathfinding instance
const pathfinding = new Pathfinding(map.width, map.height);

// Flatten terrain grid for pathfinding
const flatGrid = [];
for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
        flatGrid.push(map.grid[y][x]);
    }
}

console.log('Terrain info:');
console.log('  TERRAIN_WATER =', 0);
console.log('  TERRAIN_GRASS =', 1);
console.log('  First few tiles:', flatGrid.slice(0, 20));
console.log('  Tile at (5,5):', map.grid[5][5]);
console.log('  Tile at (15,15):', map.grid[15][15]);
console.log('  Tile at (2,2):', map.grid[2][2]);
console.log('  Tile at (20,20):', map.grid[20][20]);
console.log('  Tile at (0,0):', map.grid[0][0]);
console.log('  Tile at (10,10):', map.grid[10][10]);

console.log('Pathfinding Tests:\n');

// Test 1: Simple path on grass - use known grass locations
console.log('Test 1: Simple path on grass');
// Center area should be grass due to createStartingArea
const startX1 = 18, startY1 = 18;  // Around the starting area
const endX1 = 22, endY1 = 22;
console.log(`  Start: (${startX1}, ${startY1}), End: (${endX1}, ${endY1})`);
console.log(`  Start terrain: ${map.grid[startY1][startX1]}, End terrain: ${map.grid[endY1][endX1]}`);
const result1 = pathfinding.findPath(flatGrid, startX1, startY1, endX1, endY1);
console.log(`  Success: ${result1.success}`);
console.log(`  Distance: ${result1.distance}`);
console.log(`  Path length: ${result1.path.length}`);

// Test 2: Path avoiding water - use known grass locations
console.log('\nTest 2: Path avoiding water');
const startX2 = 18, startY2 = 18;
const endX2 = 25, endY2 = 25;
console.log(`  Start: (${startX2}, ${startY2}), End: (${endX2}, ${endY2})`);
console.log(`  Start terrain: ${map.grid[startY2][startX2]}, End terrain: ${map.grid[endY2][endX2]}`);
const result2 = pathfinding.findPath(flatGrid, startX2, startY2, endX2, endY2);
console.log(`  Success: ${result2.success}`);
console.log(`  Distance: ${result2.distance}`);

// Test 3: Path in same location
console.log('\nTest 3: Path in same location');
const result3 = pathfinding.findPath(flatGrid, 10, 10, 10, 10);
console.log(`  Start: (10, 10), End: (10, 10)`);
console.log(`  Success: ${result3.success}`);
console.log(`  Path:`, result3.path);

// Test 4: Path to unreachable location (water tile)
console.log('\nTest 4: Path to unreachable location');
const startX4 = 18, startY4 = 18;
const endX4 = 0, endY4 = 0;  // Water tile
console.log(`  Start: (${startX4}, ${startY4}), End: (${endX4}, ${endY4})`);
console.log(`  Start terrain: ${map.grid[startY4][startX4]}, End terrain: ${map.grid[endY4][endX4]}`);
const result4 = pathfinding.findPath(flatGrid, startX4, startY4, endX4, endY4);
console.log(`  Success: ${result4.success}`);

// Test cache
console.log('\nCache Statistics:');
console.log(' ', pathfinding.getCacheStats());

// Test path following
if (result1.success && result1.path.length > 0) {
    console.log('\nPath following test:');
    console.log(`  Step 0: ${result1.path[0].x}, ${result1.path[0].y}`);
    if (result1.path.length > 1) {
        console.log(`  Step 1: ${result1.path[1].x}, ${result1.path[1].y}`);
    }
    console.log(`  Last step: ${result1.path[result1.path.length - 1].x}, ${result1.path[result1.path.length - 1].y}`);
}

console.log('\nPathfinding Tests Complete!');