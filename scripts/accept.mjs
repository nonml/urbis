// npm run accept — run the checks a milestone's green criteria name.
//
//   npm run accept -- M1          run tests/accept/m1-* (one milestone's checks)
//   npm run accept                every criterion green in docs/ROADMAP.md's Done log
//   npm run accept -- M1 --speed 1
//                                 force real speed: ACCEPT_SPEED reaches the
//                                 checks, which use it in place of ?speed=4 (R10)
//
// As scripts/shot.mjs: run `npm run build` first, the checks are served from
// build/ on GATE_PORT. A check is a test file (`tests/**/*.spec.js` or
// `.test.js`, run by Playwright) or a script (`tests|scripts/**/*.js`, run by
// Node). The criterion's row in docs/ROADMAP.md, or docs/plan/milestones/,
// names its check; a token that is not one of those is not a runnable check.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLAYWRIGHT_CLI = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const TABLES = ['docs/ROADMAP.md', ...readdirSync('docs/plan/milestones').map((f) => `docs/plan/milestones/${f}`)];
const TEST_FILE = /\.(?:spec|test)\.js$/;
const NODE_FILE = /^(?:tests|scripts)\/[\w./-]+\.m?js$/;

// Done-log rows: | Date | Criterion | Commit | Evidence |; the header does not match.
export function greenCriteria(roadmap) {
  const log = roadmap.split('## Done log')[1]?.split(/\n## /)[0] ?? '';
  return [...log.matchAll(/^\|\s*\d{4}-\d{2}-\d{2}\s*\|\s*(M\d+-\d+)\s*\|/gm)].map((m) => m[1]);
}

export function milestoneChecks(milestone) {
  const prefix = `${milestone.toLowerCase()}-`;
  return readdirSync('tests/accept')
    .filter((f) => TEST_FILE.test(f) && f.startsWith(prefix))
    .map((f) => `tests/accept/${f}`);
}

// Each criterion's check tokens: Playwright test files, Node scripts, npm scripts.
export function checksFor(criteria) {
  const found = new Set();
  for (const table of TABLES) {
    for (const line of readFileSync(table, 'utf8').split('\n')) {
      const id = line.match(/^\|\s*(M\d+-\d+)\s*\|/)?.[1];
      if (!id || !criteria.includes(id)) continue;
      for (const [, token] of line.matchAll(/`([^`\s]+)`/g)) {
        if (TEST_FILE.test(token)) found.add(token);
        else if (NODE_FILE.test(token)) found.add(`node:${token}`);
        else if (/^npm run [\w:.-]+$/.test(token)) found.add(`npm:${token.slice(8)}`);
      }
    }
  }
  return [...found].sort();
}

function run(cmd, cmdArgs, env) {
  console.log(`accept: ${[cmd, ...cmdArgs].join(' ')}`);
  execFileSync(cmd, cmdArgs, { stdio: 'inherit', env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const speed = args.includes('--speed') ? args[args.indexOf('--speed') + 1] : null;
  const milestone = args.find((a) => /^M\d+$/i.test(a))?.toUpperCase() ?? null;
  const checks = milestone
    ? milestoneChecks(milestone)
    : checksFor(greenCriteria(readFileSync('docs/ROADMAP.md', 'utf8')));
  if (!checks.length) {
    console.log(milestone ? `accept: no checks match ${milestone}` : 'accept: the Done log has no green criterion');
    process.exit(0);
  }
  if (!existsSync('build/index.html')) {
    console.error('accept: build/ is missing — run `npm run build` first');
    process.exit(1);
  }
  const env = { ...process.env, GATE_FULL: '1', ...(speed ? { ACCEPT_SPEED: speed } : {}) };
  try {
    const tests = checks.filter((c) => TEST_FILE.test(c));
    if (tests.length) run(process.execPath, [PLAYWRIGHT_CLI, 'test', ...tests], env);
    for (const c of checks) {
      if (TEST_FILE.test(c)) continue;
      if (c.startsWith('node:')) run(process.execPath, [c.slice(5)], env);
      else run('npm', ['run', c.slice(4)], env);
    }
  } catch (e) {
    process.exit(e.status ?? 1);
  }
  console.log(`accept: ${checks.length} check(s) passed`);
}
