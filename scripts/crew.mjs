#!/usr/bin/env node
// The director's crew: OpenCode workers, one git worktree each, supervised.
//
//   node scripts/crew.mjs run <queue.json>...  # works task queues to the end, every lane at once
//   node scripts/crew.mjs run               # works every queue in docs/tasks, new ones too
//   node scripts/crew.mjs tasks             # where every queued task stands
//   node scripts/crew.mjs start <name> <model> <brief.md> [extra instruction]
//   node scripts/crew.mjs status
//   node scripts/crew.mjs watch      # blocks until a worker finishes or needs the director
//   node scripts/crew.mjs report <name>
//   node scripts/crew.mjs stop <name>
//
// Why it exists: the plugin's `task` command waits on one HTTP request and dies at
// Node's 5-minute header timeout, and every worktree shares one OpenCode server, so
// "is anyone busy" and "abort" must be per session, never global. Here a job is
// sent with prompt_async (returns at once), tracked by its own session id, and
// watched: a worker idle for STALL_MIN, or busy going round in circles (LOOP_*), is
// nudged to continue in the same session; a second time it is restarted, a third
// moves it up a model tier, and past the last tier it is parked for the director.
//
// `run` is the manager a model could not be. The director writes a milestone as
// small tasks, each with a test that fails until it is done; the script hands them
// out lane by lane, runs the gate on every answer, commits a pass to the lane's
// branch and sends a fail back with the gate's own output. Nothing reaches main
// here: the director reviews the lane branches and merges. It runs unattended:
//   nohup node scripts/crew.mjs run docs/tasks/<milestone>.json >> ../.urbis-crew.log 2>&1 &
// Run one supervisor (`run` or `watch`) at a time; both own the state file.
//
// Not game code: it lives in scripts/ and touches nothing in src/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PLUGIN = path.join(process.env.HOME, '.claude/plugins/cache/naicud-opencode-plugin-cc/opencode/1.22.0/scripts/lib/opencode-server.mjs');
const { ensureServer, createClient, readServerRegistry, isServerRunning } = await import(PLUGIN);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATE = path.join(ROOT, '..', '.urbis-crew.json');
const TIERS = ['opencode-go/deepseek-v4.1-flash', 'opencode-go/glm-5.3-flash'];
const STALL_MIN = 10;
const POLL_MS = 30_000;
// Each worker gets its own block of ports: gate 4x73, shots 4x91, scorecard 4x95.
const PORT_BLOCKS = [40, 41, 42, 43, 44, 45, 46, 47];

// A worker that keeps calling tools without editing is circling, not working: more
// calls than this since its last edit, or the same call LOOP_REPEATS times, is a
// loop. A whole-feature brief reads a lot before its first edit; a task should not.
const EDIT_TOOLS = new Set(['edit', 'write', 'patch', 'multiedit', 'apply_patch']);
const LOOP_CALLS = { brief: 60, task: 25 };
const LOOP_REPEATS = 3;
// Fixes a task's answer gets on one model before it moves up a tier.
const FIX_TRIES = 2;
// Lines of a failed gate sent back to the worker: the tail is where the failure is.
const GATE_TAIL = 60;
// Paths any task may change besides its own: the gate's evidence.
const ALWAYS_OWNED = [/^docs\/shots\//];

const load = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { workers: {} });
const save = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
const sh = (cmd, args, cwd = ROOT, env = {}) => execFileSync(cmd, args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env }, maxBuffer: 64 << 20,
});
const log = (msg) => console.log(`${new Date().toISOString().slice(11, 19)} ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The server the plugin registered for this worktree (several worktrees may share
// one); a new worktree gets its own. The directory header scopes every call.
// A server that died (a reboot, a killed supervisor) stays in the registry: skip it.
async function client(dir) {
  let known = null;
  for (const e of readServerRegistry(dir)) {
    if (await isServerRunning(e.host ?? '127.0.0.1', e.port)) {
      known = e;
      break;
    }
  }
  const url = known ? `http://${known.host ?? '127.0.0.1'}:${known.port}` : (await ensureServer({ cwd: dir })).url;
  return { url, c: createClient(url, { directory: dir }) };
}

const hasBranch = (b) => {
  try {
    sh('git', ['rev-parse', '--verify', '-q', `refs/heads/${b}`]);
    return true;
  } catch {
    return false;
  }
};

function worktree(name) {
  const dir = path.join(ROOT, '..', `urbis-wt-${name}`);
  if (!fs.existsSync(dir)) {
    const b = `wt/${name}`;
    sh('git', ['worktree', 'add', '-q', ...(hasBranch(b) ? [dir, b] : ['-b', b, dir, 'main'])]);
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  }
  return dir;
}

// Brings a clean lane up to main. A lane branch none of whose commits came from this
// board (one left by an earlier session) is set aside as wt/<lane>-old-<date> and the
// lane starts again from main: building on weeks-old code fails every task.
function freshLane(state, lane, dir) {
  if (changedPaths(dir).length) return;
  try {
    sh('git', ['merge', '--ff-only', '-q', 'main'], dir);
    return;
  } catch { /* the lane has commits main lacks */ }
  const ours = Object.values(state.tasks).some((t) => {
    if (t.lane !== lane || !t.commit) return false;
    try {
      sh('git', ['merge-base', '--is-ancestor', t.commit, 'HEAD'], dir);
      return true;
    } catch {
      return false;
    }
  });
  if (ours) return;   // the lane has commits of its own; it keeps building on them
  const old = `wt/${lane}-old-${new Date().toISOString().slice(0, 10)}`;
  sh('git', ['branch', '-f', old, 'HEAD'], dir);
  sh('git', ['reset', '-q', '--hard', 'main'], dir);
  log(`${lane}: wt/${lane} was an old branch, kept as ${old}; the lane starts from main`);
}

function ports(state, name) {
  const used = new Set(Object.entries(state.workers).filter(([n, w]) => n !== name && w.live).map(([, w]) => w.block));
  const block = state.workers[name]?.block ?? PORT_BLOCKS.find((b) => !used.has(b));
  return { block, gate: block * 100 + 73, shot: block * 100 + 91, score: block * 100 + 95 };
}

const portsLine = (w) => `You are in a parallel git worktree. Always use GATE_PORT=${w.gate}, SHOT_PORT=${w.shot}, SCORE_PORT=${w.score}; other workers use other ports.`;

function briefPrompt(w) {
  return [
    'You have full read/write access. Make the necessary code changes.',
    `Read AGENTS.md, then own ${w.brief} end to end. Iterate until every finish line holds.`,
    portsLine(w),
    'Make your first edit within 5 minutes: read only what the next edit needs, then measure, fix, repeat.',
    'Do not commit, push, stash or checkout. Do not open or judge PNGs.',
    'End with a report: files changed, each finish line with its measured number, anything you could not do.',
    w.extra ?? '',
  ].join('\n');
}

function taskPrompt(w) {
  const t = w.task;
  return [
    'You have full read/write access. Make the necessary code changes.',
    `Task ${t.id}: ${t.goal}`,
    `Edit only: ${t.files.join(', ')}. Do not edit ${t.test}: it is the definition of done.`,
    t.notes ?? '',
    'Read the test and the files above first, and little else. Make your first edit within 3 minutes.',
    `Check with: npm run build && GATE_PORT=${w.gate} npx playwright test ${t.test}`,
    'Do not run npm run gate: the crew runs the checks when you finish.',
    portsLine(w),
    'Do not commit, push, stash or checkout. Do not open or judge PNGs.',
    'End with: the files you changed and the test result.',
  ].filter(Boolean).join('\n');
}

// A queued task with a `brief` instead of a `test` is a whole feature: the brief's
// finish lines and the gate decide it, and the director reviews the lane branch.
const prompt = (w) => (w.task && !w.task.brief ? taskPrompt(w)
  : briefPrompt(w.task ? { ...w, brief: w.task.brief, extra: w.task.notes ?? w.extra } : w));

async function send(w, text) {
  const { c } = await client(w.dir);
  if (w.session) {
    // A session carried over from the lane's last task (assign) may be gone with
    // its server; then the task starts a new one.
    try {
      await c.sendPromptAsync(w.session, text, { agent: 'build', model: w.model });
      w.lastSent = Date.now();
      return;
    } catch {
      w.session = null;
    }
  }
  w.session = (await c.createSession({ title: `crew ${w.name}` })).id;
  await c.sendPromptAsync(w.session, text, { agent: 'build', model: w.model });
  w.lastSent = Date.now();
}

// Why a busy worker is circling, or null. Counts only what it did since it was last
// told something, and since its last edit.
function loopOf(msgs, limit) {
  const sinceTold = msgs.slice(msgs.findLastIndex((m) => m.info?.role === 'user') + 1);
  const calls = sinceTold.flatMap((m) => m.parts ?? []).filter((p) => p.type === 'tool');
  const sinceEdit = calls.slice(calls.findLastIndex((p) => EDIT_TOOLS.has(p.tool)) + 1);
  if (sinceEdit.length > limit) return `${sinceEdit.length} tool calls without an edit`;
  const seen = new Map();
  for (const p of sinceEdit) {
    const key = `${p.tool} ${JSON.stringify(p.state?.input ?? {})}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (seen.get(key) >= LOOP_REPEATS) return `the same ${p.tool} call ${LOOP_REPEATS} times without an edit`;
  }
  return null;
}

async function sessionInfo(w) {
  const { url } = await client(w.dir);
  const st = await (await fetch(`${url}/session/status`)).json();
  const msgs = await (await fetch(`${url}/session/${w.session}/message`)).json();
  let last = w.lastSent ?? 0;
  for (const m of msgs) {
    last = Math.max(last, m.info?.time?.created ?? 0, m.info?.time?.completed ?? 0);
    for (const p of m.parts ?? []) last = Math.max(last, p.state?.time?.start ?? 0, p.state?.time?.end ?? 0, p.time?.start ?? 0, p.time?.end ?? 0);
  }
  const reply = msgs.filter((m) => m.info?.role === 'assistant').at(-1);
  return {
    busy: !!st[w.session],
    last,
    loop: loopOf(msgs, LOOP_CALLS[w.task && !w.task.brief ? 'task' : 'brief']),
    error: reply?.info?.error?.name ?? null,
    text: (reply?.parts ?? []).filter((p) => p.type === 'text').map((p) => p.text).join('\n'),
  };
}

async function abort(w) {
  const { url } = await client(w.dir);
  await fetch(`${url}/session/${w.session}/abort`, { method: 'POST' });
}

function changedPaths(dir) {
  return sh('git', ['status', '--porcelain', '-uall'], dir).split('\n').filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').at(-1));
}

const changed = (w) => changedPaths(w.dir).length;

async function restart(w, why) {
  w.session = null;
  await send(w, `${prompt(w)}\n${why}`);
  return null;
}

// Moves a worker up a tier, or parks it when it is already on the last.
async function escalate(w, why) {
  const at = TIERS.indexOf(w.model);
  if (at === TIERS.length - 1) {
    w.live = false;
    return `${w.name} parked on ${w.model}: ${why}`;
  }
  w.model = TIERS[at + 1];
  w.stalls = 0;
  w.tries = 0;
  await restart(w, 'Earlier attempts on another model failed; their uncommitted edits are in this worktree. Build on them.');
  return `${w.name} moved up to ${w.model}: ${why}`;
}

// A busy worker gone quiet (a stall) or circling (a loop): nudge it, then restart
// it, then move it up a tier. Returns news for the director, or null.
async function supervise(w, i) {
  const idleMin = (Date.now() - i.last) / 60000;
  const why = idleMin > STALL_MIN ? `idle ${idleMin.toFixed(0)} min` : i.loop;
  if (!why) return null;
  w.stalls += 1;
  await abort(w);
  console.error(`[crew] ${w.name}: ${why}, action ${w.stalls}`);
  if (w.stalls === 1) {
    await send(w, `You stopped making progress (${why}). Continue from where you were: make the next edit now.`);
    return null;
  }
  if (w.stalls === 2) return restart(w, 'A previous attempt stalled; its uncommitted edits are in this worktree. Build on them.');
  return escalate(w, `stalled three times, last ${why}`);
}

// --- the queue ---------------------------------------------------------------
//
// A queue file is one milestone:
//   { "milestone": "1 walk into what you built",
//     "tasks": [{ "id": "m1-door", "lane": "doors", "goal": "one sentence",
//                 "files": ["src/sim/interior.js"], "test": "tests/m1-door.spec.js",
//                 "commit": "feat(interior): a door on every zoned building",
//                 "notes": "anything the test does not say" }] }
// The director commits each test as `<name>.todo.js`, which the gate does not run,
// beside a stub that keeps the game whole; handing the task out renames it to
// `.spec.js`. A lane is one worktree and runs its tasks in order; lanes run side by
// side; a lane with a parked task waits for the director.

const todoOf = (test) => test.replace(/\.spec\.js$/, '.todo.js');

function headFile(dir, ...files) {
  for (const f of files) {
    try {
      return sh('git', ['show', `HEAD:${f}`], dir);
    } catch { /* not in HEAD under this name; try the next */ }
  }
  return null;
}

function bringTest(dir, test) {
  const todo = todoOf(test);
  // A task queued after the lane branched has its test on main only: bring it over.
  if (!fs.existsSync(path.join(dir, todo)) && !fs.existsSync(path.join(dir, test))) {
    sh('git', ['checkout', 'main', '--', todo], dir);
  }
  if (fs.existsSync(path.join(dir, todo))) sh('git', ['mv', todo, test], dir);
}

async function assign(state, lane, task) {
  const dir = worktree(lane);
  freshLane(state, lane, dir);
  if (task.test) bringTest(dir, task.test);
  // The lane's next task goes on in the session its last one ran in, when that
  // was on the same model: the worker has already read the files the two share.
  const prev = state.workers[lane];
  const session = prev?.session && prev.dir === dir && prev.model === TIERS[0] ? prev.session : null;
  const w = { name: lane, dir, task, model: TIERS[0], session, stalls: 0, tries: 0, live: true, started: Date.now(), ...ports(state, lane) };
  state.workers[lane] = w;
  state.tasks[task.id] = { status: 'working', lane, model: w.model };
  await send(w, prompt(w));
  return `${lane}: started ${task.id}`;
}

// What the answer touched that the task does not own: its test, or files off its list.
function scopeFault(w) {
  const t = w.task;
  if (t.brief) return builtNothing(w);
  const testPath = path.join(w.dir, t.test);
  const original = headFile(w.dir, t.test, todoOf(t.test));
  if (original !== null && (!fs.existsSync(testPath) || fs.readFileSync(testPath, 'utf8') !== original)) {
    fs.writeFileSync(testPath, original);
    return `You changed ${t.test}. It is the definition of done and has been put back; make the code pass it as written.`;
  }
  const owned = new Set([...t.files, t.test, todoOf(t.test)]);
  const stray = changedPaths(w.dir).filter((f) => !owned.has(f) && !ALWAYS_OWNED.some((re) => re.test(f)));
  if (!stray.length) return null;
  return `You changed files this task does not own: ${stray.join(', ')}. Undo those changes; edit only ${t.files.join(', ')}.`;
}

// A brief is a feature: a turn that leaves only shots and notes behind has not
// built it, however green the gate is on the unchanged code.
function builtNothing(w) {
  if (changedPaths(w.dir).some((f) => !f.startsWith('docs/'))) return null;
  return `Nothing outside docs/ has changed: ${w.task.brief} is not built yet. Build it, measure every finish line, then stop.`;
}

// A task's check is the gate cut to what the task can break: the static checks, the
// build, its own test, every spec that names a file it changed, and gate.spec (the
// draws). Minutes, not the full gate's twenty. The full gate still runs once per
// lane, at review, before anything reaches main. A whole-brief task gets it all.
const STATIC_CHECKS = ['lint', 'check:rng', 'check:boundary', 'check:overlap', 'validate', 'build'];

function specsFor(w) {
  const t = w.task;
  const names = t.files.map((f) => path.basename(f));
  const dir = path.join(w.dir, 'tests');
  const named = fs.readdirSync(dir).filter((f) => f.endsWith('.spec.js'))
    .filter((f) => names.some((n) => fs.readFileSync(path.join(dir, f), 'utf8').includes(n)))
    .map((f) => `tests/${f}`);
  return [...new Set([t.test, 'tests/gate.spec.js', ...named])];
}

function gateFault(w) {
  try {
    const env = { GATE_PORT: String(w.gate) };
    let out;
    if (w.task.brief) out = sh('npm', ['run', 'gate'], w.dir, env);
    else {
      for (const check of STATIC_CHECKS) sh('npm', ['run', check], w.dir, env);
      out = sh('npx', ['playwright', 'test', ...specsFor(w)], w.dir, env);
    }
    w.draws = out.match(/draws: (\d+)/)?.[1] ?? null;
    return null;
  } catch (e) {
    return `The gate failed:\n${`${e.stdout ?? ''}${e.stderr ?? ''}`.split('\n').slice(-GATE_TAIL).join('\n')}`;
  }
}

// A task names its commit; a brief's commit is its title.
function subjectOf(t) {
  const title = t.brief && fs.existsSync(path.join(ROOT, t.brief))
    ? fs.readFileSync(path.join(ROOT, t.brief), 'utf8').match(/^# (.+)$/m)?.[1] : null;
  return `feat(${t.lane}): ${(title ?? t.goal ?? t.id).replace(/^./, (c) => c.toLowerCase())}`;
}

function commitTask(w) {
  const t = w.task;
  sh('git', ['add', '-A'], w.dir);
  const why = `Task ${t.id}, filled by ${w.model} and checked by scripts/crew.mjs: task checks green, draws ${w.draws ?? 'not printed'}.`;
  sh('git', ['commit', '-q', '-m', t.commit ?? subjectOf(t), '-m', why], w.dir);
  return sh('git', ['rev-parse', '--short', 'HEAD'], w.dir).trim();
}

// A worker finished a turn on its task: commit the answer, send it back with what is
// wrong, move it up a tier, or park it.
async function judge(state, w) {
  const t = w.task;
  const fault = scopeFault(w) ?? gateFault(w);
  if (!fault) {
    w.live = false;
    const commit = commitTask(w);
    state.tasks[t.id] = { ...state.tasks[t.id], status: 'done', commit, model: w.model };
    return `${w.name}: ${t.id} done in ${commit} on ${w.model}`;
  }
  w.tries += 1;
  if (w.tries <= FIX_TRIES) {
    await send(w, `Not done yet. ${fault}\nFix it, then check again.`);
    return `${w.name}: ${t.id} sent back (${w.tries}/${FIX_TRIES})`;
  }
  return escalate(w, `failed its check ${w.tries} times`);
}

async function tend(state, w) {
  const i = await sessionInfo(w);
  const news = i.busy ? await supervise(w, i) : await judge(state, w);
  state.tasks[w.task.id].model = w.model;
  if (!w.live && state.tasks[w.task.id].status !== 'done') state.tasks[w.task.id].status = 'stuck';
  return news;
}

async function stepLane(state, queue, lane) {
  const w = state.workers[lane];
  if (w?.live && !w.task) return [];   // a whole-brief worker owns this worktree
  const news = [];
  if (w?.live) news.push(await tend(state, w));
  if (!state.workers[lane]?.live) {
    const mine = queue.tasks.filter((t) => t.lane === lane);
    const status = (t) => state.tasks[t.id]?.status ?? 'pending';
    // A task left 'working' with no live worker was cut off (a crash, a reboot): redo it.
    const next = mine.find((t) => status(t) === 'pending' || status(t) === 'working');
    if (next && !mine.some((t) => status(t) === 'stuck')) news.push(await assign(state, lane, next));
  }
  return news.filter(Boolean);
}

// Whole-brief workers started with `start` are supervised here too, since only
// one supervisor may own the state file.
async function tendBriefs(state) {
  for (const w of Object.values(state.workers).filter((v) => v.live && !v.task)) {
    const i = await sessionInfo(w);
    if (i.busy) {
      const news = await supervise(w, i);
      if (news) log(news);
    } else {
      w.live = false;
      log(`${w.name} ${i.error ? `ended with ${i.error}` : 'finished'} (${changed(w)} files changed)`);
    }
  }
}

// `run` with no queue named works the whole board: every queue in BOARD, listed
// again each round, so a lane the director commits while it runs starts without a
// restart. It waits BOARD_IDLE_MS with nothing to do before it gives up.
const BOARD = 'docs/tasks';
const BOARD_IDLE_MS = 20 * 60_000;

async function runQueue(state, files) {
  // Re-read every round, so the director can append tasks to a running queue.
  // Several queues run as one board: each lane is a developer, lanes run at once.
  const named = () => (files.length ? files
    : fs.readdirSync(BOARD).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(BOARD, f)));
  const read = () => {
    // A queue not written yet is skipped, so a board can name one the director is still writing.
    const qs = named().filter((f) => fs.existsSync(f)).map((f) => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')));
    const open = qs.filter((q) => q.tasks.some((t) => state.tasks?.[t.id]?.status !== 'done'));
    return { milestone: open.map((q) => q.milestone).join(' + ') || 'the board', tasks: qs.flatMap((q) => q.tasks) };
  };
  let queue = read();
  state.tasks ??= {};
  log(`queue ${queue.milestone}: ${queue.tasks.length} tasks`);
  let idle = 0;
  for (;;) {
    try {
      queue = read();
    } catch (e) {
      log(`queue unreadable, keeping the last good one: ${e.message}`);
    }
    for (const lane of new Set(queue.tasks.map((t) => t.lane))) {
      try {
        for (const news of await stepLane(state, queue, lane)) log(news);
      } catch (e) {
        log(`${lane}: ${e.message}`);
      }
      save(state);
    }
    await tendBriefs(state).catch((e) => log(`briefs: ${e.message}`));
    save(state);
    // stepLane hands out every task it can, so no live worker means nothing else can move.
    if (Object.values(state.workers).some((w) => w.live)) idle = 0;
    else if (files.length || (idle += POLL_MS) > BOARD_IDLE_MS) break;
    await sleep(POLL_MS);
  }
  const count = (s) => queue.tasks.filter((t) => state.tasks[t.id]?.status === s).length;
  log(`queue ${queue.milestone} ended: ${count('done')} done, ${count('stuck')} parked, ${queue.tasks.length - count('done') - count('stuck')} waiting`);
}

// --- commands ------------------------------------------------------------------

const cmd = process.argv[2];
const state = load();
const live = () => Object.values(state.workers).filter((w) => w.live);

if (cmd === 'run') {
  await runQueue(state, process.argv.slice(3));
} else if (cmd === 'tasks') {
  for (const [id, t] of Object.entries(state.tasks ?? {})) {
    console.log(`${id.padEnd(24)} ${t.status.padEnd(8)} ${t.lane.padEnd(12)} ${(t.model ?? '').split('/').at(-1).padEnd(20)} ${t.commit ?? ''}`);
  }
} else if (cmd === 'start' && fs.existsSync(STATE) && /"live": true/.test(fs.readFileSync(STATE, 'utf8')) && process.env.CREW_FORCE !== '1') {
  // A running `run` owns the state file and would overwrite this worker; queue it instead.
  console.log('a supervisor may be running: add the brief to the queue as {"lane", "brief"} (CREW_FORCE=1 overrides)');
} else if (cmd === 'start') {
  const [, , , name, model, brief, extra] = process.argv;
  const dir = worktree(name);
  const w = { name, dir, brief, extra, model: model.includes('/') ? model : TIERS[+model], stalls: 0, live: true, started: Date.now(), ...ports(state, name) };
  state.workers[name] = w;
  await send(w, prompt(w));
  save(state);
  console.log(`started ${name} on ${w.model} in ${dir} (gate ${w.gate}, shot ${w.shot}, score ${w.score})`);
} else if (cmd === 'adopt') {
  // Put a worker launched some other way under supervision: its busy session in that worktree.
  const [, , , name, model, brief] = process.argv;
  const dir = path.join(ROOT, '..', `urbis-wt-${name}`);
  const { url } = await client(dir);
  const st = await (await fetch(`${url}/session/status`)).json();
  const mine = (await (await fetch(`${url}/session`)).json()).filter((s) => s.directory === dir && st[s.id]);
  if (!mine.length) throw new Error(`no busy session in ${dir}`);
  state.workers[name] = { name, dir, brief, model: model.includes('/') ? model : TIERS[+model], stalls: 0, live: true, started: Date.now(), session: mine[0].id, ...ports(state, name) };
  save(state);
  console.log(`adopted ${name} (${mine[0].id})`);
} else if (cmd === 'status') {
  for (const w of live()) {
    const i = await sessionInfo(w);
    const idle = ((Date.now() - i.last) / 60000).toFixed(0);
    console.log(`${w.name.padEnd(12)} ${i.busy ? 'working' : 'idle   '} last step ${idle}m ago, ${changed(w)} files changed, stalls ${w.stalls}, ${w.model}${i.loop ? `, looping: ${i.loop}` : ''}`);
  }
} else if (cmd === 'watch') {
  // Returns as soon as there is something for the director: a finished worker, an
  // error, an escalation or a parked worker. Nudges and restarts happen here, quietly.
  for (;;) {
    const events = [];
    for (const w of live()) {
      const i = await sessionInfo(w);
      if (!i.busy) {
        w.live = false;
        events.push(`${w.name} ${i.error ? `ended with ${i.error}` : 'finished'} (${changed(w)} files changed)`);
      } else {
        const news = await supervise(w, i);
        if (news) events.push(news);
      }
    }
    save(state);
    if (events.length) {
      console.log(events.join('\n'));
      break;
    }
    if (!live().length) {
      console.log('no live workers');
      break;
    }
    await sleep(POLL_MS);
  }
} else if (cmd === 'report') {
  const w = state.workers[process.argv[3]];
  console.log((await sessionInfo(w)).text);
} else if (cmd === 'stop') {
  const w = state.workers[process.argv[3]];
  await abort(w);
  w.live = false;
  save(state);
  console.log(`stopped ${w.name}`);
} else {
  console.log('usage: crew.mjs run|tasks|start|adopt|status|watch|report|stop');
}
