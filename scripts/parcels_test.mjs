import { Map } from '../src/map.js';

console.log('Testing Map with Parcels...\n');

// Test with SMALL map
console.log('=== SMALL Map (40x40) ===');
const smallMap = new Map(40, 40, 12345);
console.log('Districts:', smallMap.districts.length);
console.log('Roads:', smallMap.roads ? smallMap.roads.length : 'Not generated');
console.log('Blocks:', new Set(smallMap.blockMap.filter(x => x !== 255)).size);
console.log('Parcels:', smallMap.parcels ? smallMap.parcels.length : 'Not generated');

if (smallMap.parcels) {
    console.log('\nParcels:');
    smallMap.parcels.slice(0, 10).forEach(p => {
        console.log(`  Parcel ${p.id}: Zone=${p.zoneType}, Block=${p.blockId}, Size=${p.w}x${p.h}, Tiles=${p.tiles.length}`);
    });
}

// Test parcel lookup
if (smallMap.parcelMap) {
    console.log('\nParcel lookup:');
    const centerX = Math.floor(smallMap.width / 2);
    const centerY = Math.floor(smallMap.height / 2);
    console.log('  Center (', centerX, ',', centerY, '):', smallMap.getParcelAt(centerX, centerY));
    console.log('  (0, 0):', smallMap.getParcelAt(0, 0));
}

// Test CITY map
console.log('\n=== CITY Map (96x96) ===');
const cityMap = new Map(96, 96, 999999);
console.log('Districts:', cityMap.districts.length);
console.log('Parcels:', cityMap.parcels ? cityMap.parcels.length : 'Not generated');
if (cityMap.parcels) {
    const zones = {};
    for (const p of cityMap.parcels) {
        zones[p.zoneType] = (zones[p.zoneType] || 0) + 1;
    }
    console.log('Zone distribution:', zones);
}

// Test MEGA map
console.log('\n=== MEGA Map (256x256) ===');
const megaMap = new Map(256, 256, 777777);
console.log('Districts:', megaMap.districts.length);
console.log('Parcels:', megaMap.parcels ? megaMap.parcels.length : 'Not generated');
if (megaMap.parcels) {
    const zones = {};
    for (const p of megaMap.parcels) {
        zones[p.zoneType] = (zones[p.zoneType] || 0) + 1;
    }
    console.log('Zone distribution:', zones);
}

console.log('\nParcels Tests Complete!');