import { Map } from '../src/map.js';

console.log('Testing Map with Districts...\n');

// Test with SMALL map
console.log('=== SMALL Map (40x40) ===');
const smallMap = new Map(40, 40, 12345);
console.log('Width:', smallMap.width);
console.log('Height:', smallMap.height);
console.log('Districts:', smallMap.districts.length);
smallMap.districts.forEach(d => {
    console.log(`  ${d.id}: ${d.name} (${d.theme}) - Area: ${d.area}`);
});

// Test district lookup
console.log('\nDistrict lookup tests:');
console.log('  (5, 5) -> District:', smallMap.getDistrictAt(5, 5));
console.log('  Name:', smallMap.getTileDistrictName(5, 5));
console.log('  (100, 100) -> District:', smallMap.getDistrictAt(100, 100));
console.log('  Name:', smallMap.getTileDistrictName(100, 100));

// Test CITY map
console.log('\n=== CITY Map (96x96) ===');
const cityMap = new Map(96, 96, 999999);
console.log('Districts:', cityMap.districts.length);
cityMap.districts.forEach(d => {
    console.log(`  ${d.id}: ${d.name} (${d.theme}) - Area: ${d.area}`);
});

// Test MEGA map
console.log('\n=== MEGA Map (256x256) ===');
const megaMap = new Map(256, 256, 777777);
console.log('Districts:', megaMap.districts.length);
megaMap.districts.forEach(d => {
    console.log(`  ${d.id}: ${d.name} (${d.theme}) - Area: ${d.area}`);
});

console.log('\nMap District Tests Complete!');