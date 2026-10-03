// The pillar scorecard — bots play the six pillar tests on generated cities.
//
//   npm run build
//   npm run scorecard                       # seeds 20260916 + 11,22,33,44
//   node scripts/scorecard.mjs --seeds=5,9  # replace the four extra seeds
//
// It boots the built game on SCORE_PORT (default 4991) with ?capture=1, the same
// way scripts/shot.mjs does, and drives the probes bound to window.__game.scorecard
// (src/main.js). It is a meter, not a gate: it always exits 0 and writes
// docs/scorecard/latest.json, latest.md and one contact sheet per run.
//
// One row per pillar, one column per run. A run is seed 20260916 both ways — the
// hand preset and the generated city — plus each extra seed generated, because
// the hand map boots whatever the seed without gen=1 (src/sim/newgame.js).
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.SCORE_PORT || 4991);
const OUT = 'docs/scorecard';
const BOOT_TIMEOUT_MS = 60000;
const CAPTURE_WAIT_MS = 1500;
// Pillar 5: the walk cap per edge, the reach that counts as arriving, and the
// share of the frame a blocker may cover. The walk runs 0.5 s of sim per real
// frame, so 20 s of walking is 40 frames, not 20 rasterised seconds.
const WALK_CAP_SECS = 20;
const WALK_STEP_SECS = 0.5;
const REACH_M = 3;
const BLOCKED_MAX = 0.02;
// Pillar 2: idle this much sim time between the two snapshots.
const IDLE_SECS = 120;
// Pillar 1: fast-forward this much sim time for a zoned lot to reach LOW.
const GROW_SECS = 180;

const [MAIN_SEED, ...EXTRA_SEEDS] = [20260916, ...[11, 22, 33, 44]];
const seedArg = process.argv.slice(2);
const readSeeds = (() => {
  const eq = seedArg.find((a) => a.startsWith('--seeds='));
  if (eq) return eq.slice(8);
  const i = seedArg.indexOf('--seeds');
  return i === -1 ? null : seedArg[i + 1];
})();
const extra = (readSeeds ? readSeeds.split(',') : EXTRA_SEEDS)
  .map((s) => Number(String(s).trim()))
  .filter((n) => Number.isInteger(n) && n > 0);

// 20260916 runs both ways; the extras run generated.
const RUNS = [
  { seed: MAIN_SEED, gen: false, label: `${MAIN_SEED} hand`, slug: `${MAIN_SEED}-hand` },
  { seed: MAIN_SEED, gen: true, label: `${MAIN_SEED} gen`, slug: `${MAIN_SEED}-gen` },
  ...extra.map((seed) => ({ seed, gen: true, label: `gen ${seed}`, slug: `gen-${seed}` })),
];

const PILLARS = [
  'Build it, live in it',
  'The city lives',
  'Every tool is expressive',
  'Consequence fits the act',
  'The player feels capable',
  'Beauty in the system',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Pillar 6's two static numbers: lint errors/warnings, and functions over 60
// lines. Neither needs a browser, and both are the same for every seed.

function lintReport() {
  let out = '';
  let code = 0;
  try {
    out = execFileSync(process.execPath, ['scripts/lint_basic.mjs'], { encoding: 'utf8' });
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    code = e.status ?? 1;
  }
  const num = (re) => Number((out.match(re) ?? [])[1] ?? NaN);
  return {
    errors: num(/Errors:\s*(\d+)/),
    warnings: num(/Warnings:\s*(\d+)/),
    exit: code,
  };
}

function collectJS(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...collectJS(full));
    else if (name.endsWith('.js')) files.push(full);
  }
  return files;
}

// A function's line span, by brace matching from its opening brace. Declarations
// and named arrow/function expressions are found; anything else is not. This is
// a meter for the "functions over 60 lines" taste rule, not a parser.
function longFunctions(dir) {
  const found = [];
  for (const file of collectJS(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/)
        || lines[i].match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/);
      if (!m) continue;
      let depth = 0;
      let opened = false;
      let end = i;
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') { depth++; opened = true; }
          else if (ch === '}') depth--;
        }
        if (opened && depth <= 0) { end = j; break; }
      }
      const span = end - i + 1;
      if (span > 60) found.push({ name: m[1], file: file.replaceAll('\\', '/'), lines: span });
    }
  }
  return found.sort((a, b) => b.lines - a.lines);
}

// ---------------------------------------------------------------------------
// The bots. Each returns { pass, value, detail }.

async function boot(page, run) {
  const url = `http://localhost:${PORT}/?capture=1&seed=${run.seed}${run.gen ? '&gen=1' : ''}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: BOOT_TIMEOUT_MS });
  await page.waitForTimeout(CAPTURE_WAIT_MS);
}

// Let the real frame loop run once so the follow cam and interior links catch up
// to whatever a probe just fast-forwarded.
async function settle(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await sleep(40);
}

async function contactSheet(page, run) {
  const shot = async (name) => {
    await page.waitForTimeout(name === 'street' ? 300 : 2600);
    const png = await page.evaluate(() => window.__game.shot());
    writeFileSync(`${OUT}/${run.slug}-${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
  };
  await shot('street');
  await page.keyboard.press('t');
  await shot('day');
  await page.keyboard.press('z');
  await shot('city');
  // City view and day both change how the bots move; put the view back.
  await page.keyboard.press('z');
  await sleep(200);
}

async function botBuildItLiveInIt(page) {
  const parcels = await page.evaluate(() => window.__game.city().parcels);
  const idx = parcels.findIndex((p) => p.stage === 'EMPTY');
  if (idx === -1) return { pass: false, value: 'no empty lot', detail: 'the city had no EMPTY parcel to zone' };
  await page.evaluate((i) => {
    window.__game.zoning.pin('com', 1);
    window.__game.scorecard.zone(i, 'com');
  }, idx);
  // Fast-forward in chunks so the render loop can keep the interior links fresh.
  for (let t = 0; t < GROW_SECS; t += 20) {
    await page.evaluate((s) => window.__game.advance(s), 20);
    await settle(page);
    const stage = await page.evaluate((i) => window.__game.city().parcels[i].stage, idx);
    if (stage === 'LOW' || stage === 'MID' || stage === 'HIGH') break;
  }
  const after = await page.evaluate((i) => window.__game.city().parcels[i], idx);
  const doors = await page.evaluate(() => window.__game.doorList());
  const link = doors.find((d) => d.id === `lot:${idx}-door`);
  if (!link) {
    return {
      pass: false,
      value: `lot ${idx} ${after.stage}`,
      detail: 'no door on zoned buildings',
    };
  }
  const space = await page.evaluate((i) => window.__game.enterLot(i), idx);
  await settle(page);
  const indoors = await page.evaluate(() => window.__game.scorecard.indoors());
  return {
    pass: indoors === true,
    value: indoors ? `${link.id} → ${space}` : `lot ${idx} ${after.stage}`,
    detail: indoors ? `walked into ${space}` : `door ${link.id} did not admit the player`,
  };
}

async function botCityLives(page) {
  const snap = () => page.evaluate(() => {
    const g = window.__game;
    return {
      parcels: g.city().parcels.map((p) => ({ stage: p.stage, progress: p.progress })),
      economy: g.economy(),
      npcs: g.scorecard.npcs(),
      cars: g.scorecard.cars(),
    };
  });
  const moved = (a, b) => a.map((p, i) => Math.hypot(p.x - b[i].x, p.z - b[i].z));
  const before = await snap();
  await page.evaluate((s) => window.__game.advance(s), IDLE_SECS);
  await settle(page);
  const after = await snap();
  const parcelChanged = before.parcels.some((p, i) => p.stage !== after.parcels[i].stage || p.progress !== after.parcels[i].progress);
  const npcMoved = moved(before.npcs, after.npcs).filter((d) => d > 5).length / (before.npcs.length || 1);
  const carMoved = moved(before.cars, after.cars).filter((d) => d > 5).length / (before.cars.length || 1);
  const pass = parcelChanged && npcMoved >= 0.5;
  return {
    pass,
    value: `parcel ${parcelChanged ? 'changed' : 'static'}; npc ${(npcMoved * 100).toFixed(0)}%; car ${(carMoved * 100).toFixed(0)}%`,
    detail: pass ? 'the district and its people moved with nobody touching anything'
      : parcelChanged ? 'fewer than half the NPCs moved more than 5 m'
        : 'no parcel stage or progress changed in 120 s of sim',
  };
}

async function botToolAndConsequence(page) {
  // Both live pillars ride one hack: zone 1 (player at spawn z = 26).
  await page.evaluate(() => window.__game.pose(2.5, 26, 0));
  const before = await page.evaluate(() => window.__game.scorecard.lights());
  await page.evaluate(() => window.__game.hack());
  await page.evaluate(() => window.__game.advance(2));
  await settle(page);
  const after = await page.evaluate(() => window.__game.scorecard.lights());
  const zone = before.phase.findIndex((p, i) => p !== after.phase[i]);
  const changed = before.phase.filter((p, i) => p !== after.phase[i]).length;
  const tool = { pass: zone !== -1, value: zone === -1 ? 'no change' : `zone ${zone}: ${before.phase[zone]} → ${after.phase[zone]}`, detail: '' };
  const immediate = { pass: changed === 1, value: `${changed} zone${changed === 1 ? '' : 's'} changed`, detail: changed === 1 ? 'the effect stayed inside one zone' : 'the hack reached beyond its zone' };
  return { tool, immediate };
}

async function botFeelsCapable(page) {
  const edges = (await page.evaluate(() => window.__game.scorecard.edges())).filter((e) => e.kind === 'avenue');
  let reached = 0;
  let camInside = 0;
  let samples = 0;
  let checks = 0;
  let maxBlocked = 0;
  for (let i = 0; i < edges.length; i++) {
    const r = await page.evaluate(
      ([idx, cap, step, every, reach]) => window.__game.scorecard.walkEdge(idx, cap, step, every, reach),
      [i, WALK_CAP_SECS, WALK_STEP_SECS, 8, REACH_M],
    );
    if (!r) continue;
    if (r.reached) reached++;
    camInside += r.camInside;
    samples += r.samples;
    checks += r.checks;
    maxBlocked = Math.max(maxBlocked, r.maxBlocked);
  }
  // One drive loop, if the car probe exists: out along the first avenue and back.
  const drive = await page.evaluate(() => window.__game.scorecard.simDrive(8, 1, 0));
  const pass = edges.length > 0 && reached / edges.length >= 0.95 && camInside === 0 && maxBlocked <= BLOCKED_MAX;
  return {
    pass,
    value: `edges ${reached}/${edges.length}; cam-in-building ${camInside}; frameCheck ≤ ${maxBlocked.toFixed(3)} (${checks}/${samples} frames); car ${drive.moved}m`,
    detail: pass ? `arrived on ${reached}/${edges.length} avenue edges in the 20 s cap, camera always clear`
      : `reached ${reached}/${edges.length} edges; ${camInside} camera-in-building frames; worst blocked ${maxBlocked.toFixed(3)} over ${checks} sampled frames`,
  };
}

function beautyReport(lint, longs) {
  return {
    pass: lint.errors === 0,
    value: `lint ${lint.errors} errors / ${lint.warnings} warnings; ${longs.length} functions > 60 lines`,
    detail: longs.length ? `longest: ${longs.slice(0, 3).map((f) => `${f.name} ${f.lines}`).join(', ')}` : 'no function over 60 lines',
  };
}

// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT, { recursive: true });
  const lint = lintReport();
  const longs = longFunctions('src');
  const beauty = beautyReport(lint, longs);
  console.log(`lint: ${lint.errors} errors, ${lint.warnings} warnings, exit ${lint.exit}`);
  console.log(`long functions (>60 lines): ${longs.length}`);
  for (const f of longs) console.log(`  ${f.name} ${f.lines}  ${f.file}`);

  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  const url = `http://localhost:${PORT}/`;
  const started = Date.now();
  for (; ; await sleep(250)) {
    if (await fetch(url).then((r) => r.ok, () => false)) break;
    if (Date.now() - started > BOOT_TIMEOUT_MS) { server.kill(); throw new Error(`preview did not start on ${PORT}`); }
  }

  const mac = process.platform === 'darwin';
  const browser = await chromium.launch({
    channel: mac ? 'chromium' : 'chrome',
    args: [`--use-angle=${mac ? 'metal' : 'd3d11'}`, '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  });

  const cells = Object.fromEntries(PILLARS.map((p) => [p, {}]));
  try {
    for (const run of RUNS) {
      const t0 = Date.now();
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await boot(page, run);
        await contactSheet(page, run);
        const build = await botBuildItLiveInIt(page);
        const lives = await botCityLives(page);
        const { tool, immediate } = await botToolAndConsequence(page);
        const capable = await botFeelsCapable(page);
        Object.assign(cells['Build it, live in it'], { [run.label]: build });
        Object.assign(cells['The city lives'], { [run.label]: lives });
        Object.assign(cells['Every tool is expressive'], { [run.label]: tool });
        Object.assign(cells['Consequence fits the act'], { [run.label]: immediate });
        Object.assign(cells['The player feels capable'], { [run.label]: capable });
        Object.assign(cells['Beauty in the system'], { [run.label]: beauty });
        console.log(`${run.label}: ${((Date.now() - t0) / 1000).toFixed(0)}s, page errors ${errors.length}`);
      } catch (e) {
        const failed = { pass: false, value: 'run failed', detail: e.message };
        for (const p of PILLARS) cells[p][run.label] = failed;
        console.error(`${run.label} FAILED: ${e.message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }

  const labels = RUNS.map((r) => r.label);
  const report = {
    generatedAt: new Date().toISOString(),
    seeds: labels,
    pillars: Object.fromEntries(PILLARS.map((p) => [p, cells[p]])),
  };
  writeFileSync(`${OUT}/latest.json`, `${JSON.stringify(report, null, 2)}\n`);

  const mark = (c) => (c?.pass ? `✅ ${c.value}` : `❌ ${c.value}`);
  const md = [
    '# Urbis pillar scorecard',
    '',
    `Generated ${report.generatedAt}. A meter, not a gate — exit 0 always.`,
    '',
    `| Pillar | ${labels.join(' | ')} |`,
    `|---|${labels.map(() => '---').join('|')}|`,
    ...PILLARS.map((p) => `| **${p}** | ${labels.map((l) => mark(cells[p][l])).join(' | ')} |`),
    '',
    '## Detail',
    '',
    ...PILLARS.flatMap((p) => [
      `### ${p}`,
      ...labels.map((l) => `- **${l}**: ${mark(cells[p][l])} — ${cells[p][l]?.detail ?? ''}`),
      '',
    ]),
  ].join('\n');
  writeFileSync(`${OUT}/latest.md`, md);
  console.log(`\nwrote ${OUT}/latest.md and latest.json (${labels.length} runs, ${((Date.now() - started) / 1000).toFixed(0)}s)`);
  console.log(md);
}

await main();
