import { Map } from '../src/map.js';

try {
    const map = new Map(96, 96, 12345);
    console.log('Map created successfully!');
    console.log('width:', map.width);
    console.log('height:', map.height);
    console.log('grid length:', map.grid.length);
    console.log('First row length:', map.grid[0].length);
} catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
}