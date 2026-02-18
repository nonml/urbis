import { generateDistricts, getDistrictAt, getDistrictName } from '../src/gen/districts.js';

console.log('Testing District Generator...\n');

// Test with SMALL map
console.log('=== SMALL Map (40x40) ===');
const smallResult = generateDistricts(40, 40, 12345, 3);
console.log('Districts generated:', smallResult.districts.length);
smallResult.districts.forEach(d => {
    console.log(`  ${d.id}: ${d.name} (${d.theme}) - Area: ${d.area}, Center: (${d.center.x}, ${d.center.y})`);
    console.log(`    Bounds: (${d.bounds.minX}, ${d.bounds.minY}) to (${d.bounds.maxX}, ${d.bounds.maxY})`);
    console.log(`    Tiles: ${d.tiles.length}`);
    console.log(`    Building pools: ${d.buildingPools.join(', ')}`);
});

// Test district lookup
console.log('\nDistrict lookup tests:');
console.log('  (5, 5) -> District:', getDistrictAt(smallResult.districtMap, 5, 5, 40));
console.log('  (0, 0) -> District:', getDistrictAt(smallResult.districtMap, 0, 0, 40));
console.log('  (100, 100) -> District:', getDistrictAt(smallResult.districtMap, 100, 100, 40));
console.log('  Name of district 0:', getDistrictName(smallResult.districts, 0));
console.log('  Name of district 2:', getDistrictName(smallResult.districts, 2));

// Test determinism
console.log('\n=== Determinism Check ===');
const result1 = generateDistricts(96, 96, 999999, 4);
const result2 = generateDistricts(96, 96, 999999, 4);
console.log('First run district 0 name:', result1.districts[0].name);
console.log('Second run district 0 name:', result2.districts[0].name);
console.log('Names match:', result1.districts[0].name === result2.districts[0].name);
console.log('Areas match:', result1.districts[0].area === result2.districts[0].area);

// Test MEGA map
console.log('\n=== MEGA Map (256x256) ===');
const megaResult = generateDistricts(256, 256, 777777, 5);
console.log('Districts generated:', megaResult.districts.length);
console.log('Total tiles covered:', megaResult.districts.reduce((sum, d) => sum + d.area, 0));
console.log('Expected tiles:', 256 * 256);
console.log('All tiles assigned:', megaResult.districts.reduce((sum, d) => sum + d.area, 0) === 256 * 256);

console.log('\nDistrict Generator Tests Complete!');