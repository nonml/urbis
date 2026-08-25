// Screenshot script - cinematic city views
import { chromium } from '@playwright/test';

const PORT = 5200;
const BASE = `http://127.0.0.1:${PORT}/`;
const W = 1920, H = 1080;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle'] });
const page = await browser.newPage();
await page.setViewportSize({ width: W, height: H });
page.setDefaultTimeout(30000);

const logs = [];
page.on('pageerror', e => logs.push('ERR:' + e.message));
page.on('console', m => { if (m.type() !== 'log') return; logs.push(m.text()); });

await page.goto(BASE);
await page.waitForLoadState('networkidle');

// Start game
const startBtn = page.locator('#start-btn');
if (await startBtn.isVisible()) await startBtn.click();
await page.waitForTimeout(2000);

// Wait for 3D renderer to be ready
await page.waitForFunction(() => window.game?.ui?.renderer3d?.scene != null, { timeout: 20000 });
await page.waitForTimeout(3000); // extra time for GLTFs to load

// Log what's loaded
const info = await page.evaluate(() => {
  const r = window.game.ui.renderer3d;
  return {
    gltfs: [...r._gltfModels.keys()],
    roadModels: r._roadModels.size,
    propModels: r._propModels.size,
    mapSize: `${window.game.map.width}x${window.game.map.height}`,
  };
});
console.log('Renderer info:', JSON.stringify(info));

// Make canvas fill the full viewport and hide UI overlays
await page.evaluate(({ w, h }) => {
  const canvas = document.getElementById('game-canvas') || document.querySelector('canvas');
  if (canvas) {
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.zIndex = '1';
    let el = canvas.parentElement;
    while (el) {
      el.style.display = '';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      el = el.parentElement;
    }
  }
  const hideIds = [
    'main-menu-overlay','top-bar','resource-bar','building-panel',
    'info-panel','message-log','minimap-container','tutorial-tooltip',
    'politics-panel','campaign-panel','factions-panel','quest-log',
    'city-log','city-log-container','stats-panel','bottom-bar',
    'hud','ui-overlay','scan-panel','street-mode-label','mode-label',
    'debug-panel','version-display','settings-btn','reset-camera',
  ];
  hideIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('[class*="panel"],[class*="overlay"],[class*="hud"],[class*="bar"],[class*="menu"],[class*="tooltip"],[class*="log"],[class*="scan"],[class*="mode"]').forEach(el => {
    if (el.tagName !== 'CANVAS') el.style.display = 'none';
  });
}, { w: W, h: H });

// Build the city
await page.evaluate(() => {
  const game = window.game;
  const r = game.ui.renderer3d;

  r.renderer.setSize(1920, 1080);
  r.camera.aspect = 1920 / 1080;
  r.camera.updateProjectionMatrix();
  if (r.composer) r.composer.setSize(1920, 1080);

  r.dayNightCycle = false;
  if (r._updateSkyForTime) r._updateSkyForTime(13);

  const cx = Math.floor(game.map.width / 2);
  const cy = Math.floor(game.map.height / 2);

  if (game.player) { game.player.x = cx; game.player.y = cy; }

  // Real GTA city now ships with a dense Manhattan grid (Map.generate → roads.js grid, 12-tile spacing, 2-tile avenues).
  // We no longer flatten the terrain nor stamp a fake every-4 grid — we build on top of the real street network.
  const FLATTEN_R = 20;
  const TERRAIN_GRASS = 1;
  const TERRAIN_ROAD = 4;

  const canBuild = (x, y) => {
    if (x < 1 || y < 1 || x >= game.map.width-1 || y >= game.map.height-1) return false;
    const idx = y * game.map.width + x;
    if (game.map.roadMap?.[idx] === 1 || game.map.sidewalkMap?.[idx] === 1) return false;
    const t = game.map.getTileAt(x, y);
    return t === TERRAIN_GRASS || t === 6; // grass or park (forest) — not road/water/mountain
  };

  // Downtown core: landmark tall buildings, deliberately varied colors
  // town-hall=gold, shopping-mall=steel-blue, hotel=warm-tan, stadium=dark-teal,
  // museum=purple, courthouse=stone, hospital=white — break any color clusters
  const DOWNTOWN = [
    'town-hall','shopping-mall','hotel','courthouse','shopping-mall',
    'hotel','museum','town-hall','stadium','hotel',
    'shopping-mall','town-hall','hospital','courthouse','shopping-mall',
    'hotel','town-hall','museum','stadium','shopping-mall',
  ];

  // Mid-ring: mixed use — apartments, civic, commercial
  const MIDRING = [
    'apartment','market','hospital','police-station','apartment',
    'fire-station','school','apartment','market','library',
    'theater','apartment','museum','restaurant','apartment',
    'market','hotel','nightclub','metro-station','apartment',
    'bus-stop','market','bus-depot','hospital','apartment',
  ];

  // Outer suburbs: houses, farms
  const OUTER = [
    'house','house','house','house','farm','house','house','house',
    'park','house','house','lumber-mill','house','house','farm','house',
    'house','house','house','house','house','house',
  ];

  let placed = 0;
  const used = new Set();
  const key = (x,y) => `${x},${y}`;

  const addBuilding = (x, y, type) => {
    if (used.has(key(x,y)) || !canBuild(x, y)) return false;
    if (game.buildings.getBuildingsAt(x, y).length > 0) { used.add(key(x,y)); return false; }
    game.buildings.build(type, x, y);
    used.add(key(x,y));
    placed++;
    return true;
  };

  // Downtown: dense 7x7 grid (avoid road tiles at multiples of 4)
  let di = 0;
  for (let dy = -7; dy <= 7; dy++)
    for (let dx = -7; dx <= 7; dx++)
      addBuilding(cx+dx, cy+dy, DOWNTOWN[di++ % DOWNTOWN.length]);

  // Mid ring: radius 8-14
  let mi = 0;
  for (let dy = -14; dy <= 14; dy++)
    for (let dx = -14; dx <= 14; dx++) {
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d < 8 || d > 14) continue;
      addBuilding(cx+dx, cy+dy, MIDRING[mi++ % MIDRING.length]);
    }

  // Outer: radius 15-18
  let oi = 0;
  for (let dy = -18; dy <= 18; dy++)
    for (let dx = -18; dx <= 18; dx++) {
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d < 15 || d > 18) continue;
      addBuilding(cx+dx, cy+dy, OUTER[oi++ % OUTER.length]);
    }

  // Tree-lined road edges: set empty grass tiles adjacent to real roads → TERRAIN_PARK
  const TERRAIN_PARK_T = 6;
  for (let dy = -FLATTEN_R; dy <= FLATTEN_R; dy++) {
    for (let dx = -FLATTEN_R; dx <= FLATTEN_R; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 1 || y < 1 || x >= game.map.width-1 || y >= game.map.height-1) continue;
      if (game.map.getTileAt(x, y) !== TERRAIN_GRASS) continue;
      if (game.buildings.getBuildingsAt(x, y).length > 0) continue;
      const idx = y * game.map.width + x;
      // Adjacent to a real roadMap tile?
      const nIdx = (nx, ny) => ny * game.map.width + nx;
      const isRoadAdj = (
        (x > 0 && game.map.roadMap?.[nIdx(x - 1, y)] === 1) ||
        (x < game.map.width - 1 && game.map.roadMap?.[nIdx(x + 1, y)] === 1) ||
        (y > 0 && game.map.roadMap?.[nIdx(x, y - 1)] === 1) ||
        (y < game.map.height - 1 && game.map.roadMap?.[nIdx(x, y + 1)] === 1)
      );
      if (isRoadAdj) game.map.setTileAt(x, y, TERRAIN_PARK_T);
    }
  }

  // Extend LOD so everything is visible
  r.LOD_FULL_DIST = 9999;
  r.LOD_TERRAIN_ONLY_DIST = 9999;

  // Keep GLTF road models — new renderer uses roadMap so GTA intersections render correctly.
  // Do NOT clear _roadModels; the models are dimmed in renderer to avoid white glare.

  // Full world rebuild
  r.rebuildWorld();

  console.log('City built:', placed, 'buildings, map center:', cx, cy);
  console.log('Total buildings:', game.buildings.buildings.length);
});

await page.waitForTimeout(5000); // wait for rebuild + GLTF loading

// Add parked cars along real road corridors (roadMap, not terrain)
await page.evaluate(() => {
  const r = window.game.ui.renderer3d;
  const game = window.game;
  const carTypes = ['sedan', 'taxi', 'suv', 'van', 'truck', 'hatchback-sports', 'delivery', 'police', 'firetruck', 'garbage-truck', 'bus'];
  const rng = (x, y, s) => {
    let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
    h = ((h ^ (h >> 13)) * 2654435761) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  };
  let carsPlaced = 0;
  const hw = r._mapHalfW, hh = r._mapHalfH;
  const isRoad = (x, y) => y >= 0 && y < game.map.height && x >= 0 && x < game.map.width && game.map.roadMap?.[y * game.map.width + x] === 1;
  for (let y = 0; y < game.map.height; y++) {
    for (let x = 0; x < game.map.width; x++) {
      if (!isRoad(x, y)) continue;
      if (rng(x, y, 0) > 0.08) continue; // ~8% parked — readable, not a parking lot
      const carType = carTypes[Math.floor(rng(x, y, 1) * carTypes.length)];
      const model = r._vehicleModels.get(carType);
      if (!model) continue;
      const isNS = isRoad(x, y - 1) || isRoad(x, y + 1);
      const clone = model.clone(true);
      const wx = x - hw + 0.5;
      const wz = y - hh + 0.5;
      const lateral = (rng(x, y, 2) > 0.5 ? 1 : -1) * (0.25 + rng(x, y, 3) * 0.08);
      const facing = rng(x, y, 4) > 0.5 ? 0 : Math.PI;
      if (isNS) {
        clone.position.set(wx + lateral, 0.06, wz);
        clone.rotation.y = facing;
      } else {
        clone.position.set(wx, 0.06, wz + lateral);
        clone.rotation.y = facing + Math.PI / 2;
      }
      // Assign realistic dark car colors and strip diffuse textures so color takes effect
      const carPalette = [0x2a3a4a, 0x3a2a2a, 0x2a3a2a, 0x4a4038, 0x1a2a3a,
                          0x383030, 0x303838, 0x4a3820, 0x202838, 0x3a3a3a];
      const bodyColor = carPalette[Math.floor(rng(x, y, 5) * carPalette.length)];
      clone.traverse(c => {
        if (!c.isMesh) return;
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        for (const m of mats) {
          if (!m) continue;
          const lum = m.color ? m.color.r * 0.299 + m.color.g * 0.587 + m.color.b * 0.114 : 1;
          if (lum > 0.35) {
            m.color?.setHex(bodyColor);
            if (m.map) { m.map = null; } // remove diffuse texture so color is authoritative
            if (m.roughness !== undefined) m.roughness = 0.55;
            if (m.metalness !== undefined) m.metalness = 0.15;
          }
        }
      });
      r.scene.add(clone);
      carsPlaced++;
    }
  }
  console.log('Cars placed:', carsPlaced);
});

async function render(setup) {
  await page.evaluate((s) => {
    const r = window.game.ui.renderer3d;

    r.dayNightCycle = false;
    if (r._sky) r._sky.visible = false;
    if (r._ssaoPass) r._ssaoPass.enabled = false; // causes white artifact in headless

    if (s.dusk) {
      // Golden hour — warm orange sun just above horizon
      if (r._updateSkyForTime) r._updateSkyForTime(18.5);
      r.scene.background.setHex(0xf07830);
      if (r.scene.fog) { r.scene.fog.color.setHex(0xe8602a); r.scene.fog.density = 0.0018; }
      if (r.hemiLight)   { r.hemiLight.color.setHex(0xffb060); r.hemiLight.groundColor.setHex(0x8a5030); r.hemiLight.intensity = 0.55; }
      if (r.ambientLight) { r.ambientLight.color.setHex(0xff9040); r.ambientLight.intensity = 0.35; }
      if (r.sunLight)    { r.sunLight.color.setHex(0xff8030); r.sunLight.intensity = 1.8; }
      if (r.sunLightFar) { r.sunLightFar.color.setHex(0xff8030); r.sunLightFar.intensity = 0.9; }
      r.renderer.toneMappingExposure = 1.1;
      if (r._bloomPass) { r._bloomPass.strength = 0.18; r._bloomPass.threshold = 0.80; }
      // Window glow: moderate visibility at dusk
      r.scene.traverse(o => { if (o.isMesh && o.material?.blending === 2) o.material.opacity = 0.60; });
    } else if (s.night) {
      // Night — dark sky, buildings barely lit, window glow is primary light source
      if (r._updateSkyForTime) r._updateSkyForTime(0);
      r.scene.background.setHex(0x04091a);
      if (r.scene.fog) { r.scene.fog.color.setHex(0x04091a); r.scene.fog.density = 0.0006; }
      if (r.hemiLight)   { r.hemiLight.color.setHex(0x1a2d68); r.hemiLight.groundColor.setHex(0x0a0e22); r.hemiLight.intensity = 0.22; }
      if (r.ambientLight) { r.ambientLight.color.setHex(0x0e1530); r.ambientLight.intensity = 0.12; }
      if (r.sunLight)    { r.sunLight.intensity = 0.015; }
      if (r.sunLightFar) { r.sunLightFar.intensity = 0.01; }
      // Dim IBL env map so sky doesn't dominate — keep at 4% for faint silhouette
      r.scene.traverse(o => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        if (o.material.envMapIntensity !== undefined) o.material.envMapIntensity = 0.04;
        // Desaturate and darken vegetation so trees don't glow bright green at night
        if (o.material.color) {
          const c = o.material.color;
          const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
          // Identify green-dominant vegetation materials
          if (c.g > c.r * 1.3 && c.g > c.b * 1.3) {
            c.r = lum * 0.25; c.g = lum * 0.30; c.b = lum * 0.20;
          }
        }
      });
      r.renderer.toneMappingExposure = 1.45;
      if (r._bloomPass) { r._bloomPass.strength = 0.32; r._bloomPass.threshold = 0.78; }
      // Full window glow brightness at night
      r.scene.traverse(o => { if (o.isMesh && o.material?.blending === 2) o.material.opacity = 0.90; });
    } else {
      // Daytime — 8:30am, long dramatic shadows
      if (r._updateSkyForTime) r._updateSkyForTime(8.5);
      r.scene.background.setHex(0x5ab4f0);
      if (r.scene.fog) { r.scene.fog.color.setHex(0xaad4f0); r.scene.fog.density = 0.0010; }
      if (r.hemiLight)   { r.hemiLight.color.setHex(0x9fd8fb); r.hemiLight.groundColor.setHex(0x4a7a3a); r.hemiLight.intensity = 0.70; }
      if (r.ambientLight) { r.ambientLight.color.setHex(0xfff8f0); r.ambientLight.intensity = 0.30; }
      if (r.sunLight)    { r.sunLight.color.setHex(0xfffbe0); r.sunLight.intensity = 1.75; }
      if (r.sunLightFar) { r.sunLightFar.color.setHex(0xfffbe0); r.sunLightFar.intensity = 0.95; }
      r.renderer.toneMappingExposure = 1.10;
      if (r._bloomPass) { r._bloomPass.strength = 0.10; r._bloomPass.threshold = 0.92; }
      // Window glow: subtle in daylight
      r.scene.traverse(o => { if (o.isMesh && o.material?.blending === 2) o.material.opacity = 0.55; });
    }

    r.camera.position.set(s.cx, s.cy, s.cz);
    r.camera.lookAt(s.lx, s.ly, s.lz);
    r.camera.fov = s.fov || 60;
    r.camera.aspect = 1920 / 1080;
    r.camera.updateProjectionMatrix();

    // Point shadow camera at city center so building shadows fall on terrain
    if (r.sunLight) {
      r.sunLight.target.position.set(0, 0, 0);
      r.sunLight.target.updateMatrixWorld();
    }
    if (r.sunLightFar) {
      r.sunLightFar.target.position.set(0, 0, 0);
      r.sunLightFar.target.updateMatrixWorld();
    }

    // Force all chunks visible
    r._chunkMeshes.forEach(entry => {
      entry.group.visible = true;
      entry.group.children.forEach(child => child.visible = true);
    });

    // Render 8 frames — shadow maps need extra passes to stabilize
    for (let i = 0; i < 8; i++) {
      if (r.composer) r.composer.render();
      else r.renderer.render(r.scene, r.camera);
    }
  }, setup);
  await page.waitForTimeout(300);
}

async function shot(name, setup) {
  await render(setup);
  const dataUrl = await page.evaluate(() => {
    const r = window.game.ui.renderer3d;
    if (r.composer) r.composer.render();
    else r.renderer.render(r.scene, r.camera);
    return r.renderer.domElement.toDataURL('image/png');
  });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const buf = Buffer.from(base64, 'base64');
  const { writeFileSync, mkdirSync } = await import('fs');
  mkdirSync('screenshots', { recursive: true });
  writeFileSync(`screenshots/${name}.png`, buf);
  console.log('Saved', `screenshots/${name}.png`);
}

// Camera angles — world (0,0,0) is map center
// Roads at every 4 tiles: world x = ...-11.5, -7.5, -3.5, 0.5, 4.5, 8.5...

// Camera note: roads at dx%4==0 → world x = ...-11.5, -7.5, -3.5, 0.5, 4.5, 8.5, 12.5
// Building blocks at dx = ±1,2,3 from each road

// OVERVIEW — mid-elevation isometric, city fills the frame
await shot('ss_overview',  { cx: 18, cy: 22, cz: 18, lx: 0, ly: 2, lz: 0, fov: 55 });

// SKYLINE — dramatic low-angle from SW, full tower silhouette against sky
await shot('ss_skyline',   { cx: -26, cy: 6, cz: 20, lx: 0, ly: 6, lz: 0, fov: 46 });

// STREET — south approach on center road, looking north into tower canyon
await shot('ss_street',    { cx: 0.5, cy: 1.6, cz: 24, lx: 0.5, ly: 8, lz: 4, fov: 60 });

// PANORAMA — wide arc from NE, city fills lower 2/3 of frame
await shot('ss_panorama',  { cx: 22, cy: 18, cz: -18, lx: -1, ly: 2, lz: 1, fov: 62 });

// DUSK — golden hour, warm orange sun from W, long shadows
await shot('ss_dusk',      { cx: -26, cy: 6, cz: 20, lx: 0, ly: 6, lz: 0, fov: 46, dusk: true });

// NIGHT — city lit by window glow, dark sky
await shot('ss_night',     { cx: -20, cy: 10, cz: 22, lx: 0, ly: 4, lz: 0, fov: 52, night: true });

// NIGHT STREET — south approach looking north into glowing tower canyon
await shot('ss_night_street', { cx: 0.5, cy: 1.6, cz: 24, lx: 0.5, ly: 8, lz: 4, fov: 60, night: true });

console.log('\nLogs:', logs.filter(l=>l.startsWith('City')||l.startsWith('Total')||l.startsWith('Placed')));
await browser.close();
