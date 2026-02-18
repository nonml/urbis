import { Map } from '../src/map.js';

console.log('Testing Map with Roads and Blocks...\n');

// Test with SMALL map
console.log('=== SMALL Map (40x40) ===');
const smallMap = new Map(40, 40, 12345);
console.log('Districts:', smallMap.districts.length);
console.log('Roads:', smallMap.roads ? smallMap.roads.length : 'Not generated');
console.log('Block map size:', smallMap.blockMap ? smallMap.blockMap.length : 'Not generated');

// Count unique blocks
const blockSet = new Set();
if (smallMap.blockMap) {
    for (let i = 0; i < smallMap.blockMap.length; i++) {
        if (smallMap.blockMap[i] !== 255) {
            blockSet.add(smallMap.blockMap[i]);
        }
    }
}
console.log('Unique blocks:', blockSet.size);

// Check road tiles
if (smallMap.roads && smallMap.roads.length > 0) {
    console.log('\nRoad 0:');
    console.log('  Tiles:', smallMap.roads[0].tiles.length);
    console.log('  Sidewalks:', smallMap.roads[0].sidewalks.length);
    console.log('  From:', smallMap.roads[0].from);
    console.log('  To:', smallMap.roads[0].to);
}

// Test block lookup
if (smallMap.blockMap) {
    const centerX = Math.floor(smallMap.width / 2);
    const centerY = Math.floor(smallMap.height / 2);
    console.log('\nBlock lookup:');
    console.log('  Center (', centerX, ',', centerY, '):', smallMap.getBlockAt(centerX, centerY));
    console.log('  (0, 0):', smallMap.getBlockAt(0, 0));
}

// Test CITY map
console.log('\n=== CITY Map (96x96) ===');
const cityMap = new Map(96, 96, 999999);
console.log('Districts:', cityMap.districts.length);
console.log('Roads:', cityMap.roads ? cityMap.roads.length : 'Not generated');

const cityBlockSet = new Set();
if (cityMap.blockMap) {
    for (let i = 0; i < cityMap.blockMap.length; i++) {
        if (cityMap.blockMap[i] !== 255) {
            cityBlockSet.add(cityMap.blockMap[i]);
        }
    }
}
console.log('Unique blocks:', cityBlockSet.size);

// Test MEGA map
console.log('\n=== MEGA Map (256x256) ===');
const megaMap = new Map(256, 256, 777777);
console.log('Districts:', megaMap.districts.length);
console.log('Roads:', megaMap.roads ? megaMap.roads.length : 'Not generated');

const megaBlockSet = new Set();
if (megaMap.blockMap) {
    for (let i = 0; i < megaMap.blockMap.length; i++) {
        if (megaMap.blockMap[i] !== 255) {
            megaBlockSet.add(megaMap.blockMap[i]);
        }
    }
}
console.log('Unique blocks:', megaBlockSet.size);

console.log('\nRoad and Block Tests Complete!');