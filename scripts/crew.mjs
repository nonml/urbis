#!/usr/bin/env node
// The director's crew: OpenCode workers, one git worktree each, supervised.
//
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
// watched: a worker idle for STALL_MIN gets nudged to continue in the same session,
// a second stall restarts it, a third escalates it to the next model tier.
//
// Not game code: it lives in scripts/ and touches nothing in src/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PLUGIN = path.join(process.env.HOME, '.claude/plugins/cache/naicud-opencode-plugin-cc/opencode/1.22.0/scripts/lib/opencode-server.mjs');
const { ensureServer, createClient, readServerRegistry } = await import(PLUGIN);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATE = path.join(ROOT, '..', '.urbis-crew.json');
const TIERS = ['opencode-go/deepseek-v4.1-flash', 'opencode-go/glm-5.3-flash', 'opencode-go/mimo-v2.6-pro'];
const STALL_MIN = 10;
const POLL_MS = 30_000;
// Each worker gets its own block of ports: gate 4x73, shots 4x91, scorecard 4x95.
const PORT_BLOCKS = [40, 41, 42, 43, 44, 45, 46, 47];

const load = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { workers: {} });
const save = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
const sh = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// The server the plugin registered for this worktree (several worktrees may share
// one); a new worktree gets its own. The directory header scopes every call.
async function client(dir) {
  const known = readServerRegistry(dir)[0];
  const url = known ? `http://${known.host ?? '127.0.0.1'}:${known.port}` : (await ensureServer({ cwd: dir })).url;
  return { url, c: createClient(url, { directory: dir }) };
}

function worktree(name) {
  const dir = path.join(ROOT, '..', `urbis-wt-${name}`);
  if (!fs.existsSync(dir)) {
    sh('git', ['worktree', 'add', '-q', '-b', `wt/${name}`, dir, 'main']);
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  }
  return dir;
}

function ports(state, name) {
  const used = new Set(Object.entries(state.workers).filter(([n, w]) => n !== name && w.live).map(([, w]) => w.block));
  const block = state.workers[name]?.block ?? PORT_BLOCKS.find((b) => !used.has(b));
  return { block, gate: block * 100 + 73, shot: block * 100 + 91, score: block * 100 + 95 };
}

function prompt(w) {
  return [
    'You have full read/write access. Make the necessary code changes.',
    `Read AGENTS.md, then own ${w.brief} end to end. Iterate until every finish line holds.`,
    `You are in a parallel git worktree. Always use GATE_PORT=${w.gate}, SHOT_PORT=${w.shot}, SCORE_PORT=${w.score}; other workers use other ports.`,
    'Make your first edit within 5 minutes: read only what the next edit needs, then measure, fix, repeat.',
    'Do not commit, push, stash or checkout. Do not open or judge PNGs.',
    'End with a report: files changed, each finish line with its measured number, anything you could not do.',
    w.extra ?? '',
  ].join('\n');
}

async function send(w, text) {
  const { c } = await client(w.dir);
  if (!w.session) w.session = (await c.createSession({ title: `crew ${w.name}` })).id;
  await c.sendPromptAsync(w.session, text, { agent: 'build', model: w.model });
  w.lastSent = Date.now();
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
  return { busy: !!st[w.session], last, error: reply?.info?.error?.name ?? null, text: (reply?.parts ?? []).filter((p) => p.type === 'text').map((p) => p.text).join('\n') };
}

async function abort(w) {
  const { url } = await client(w.dir);
  await fetch(`${url}/session/${w.session}/abort`, { method: 'POST' });
}

function changed(w) {
  return sh('git', ['status', '--short'], w.dir).split('\n').filter(Boolean).length;
}

const cmd = process.argv[2];
const state = load();

if (cmd === 'start') {
  const [, , , name, model, brief, extra] = process.argv;
  const dir = worktree(name);
  const p = ports(state, name);
  const w = { name, dir, brief, extra, model: model.includes('/') ? model : TIERS[+model], stalls: 0, live: true, started: Date.now(), ...p };
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
  const p = ports(state, name);
  state.workers[name] = { name, dir, brief, model: model.includes('/') ? model : TIERS[+model], stalls: 0, live: true, started: Date.now(), session: mine[0].id, ...p };
  save(state);
  console.log(`adopted ${name} (${mine[0].id})`);
} else if (cmd === 'status') {
  for (const w of Object.values(state.workers).filter((w) => w.live)) {
    const i = await sessionInfo(w);
    const idle = ((Date.now() - i.last) / 60000).toFixed(0);
    console.log(`${w.name.padEnd(12)} ${i.busy ? 'working' : 'idle   '} last step ${idle}m ago, ${changed(w)} files changed, stalls ${w.stalls}, ${w.model}`);
  }
} else if (cmd === 'watch') {
  // Returns as soon as there is something for the director: a finished worker, an
  // error, or an escalation. Nudges and restarts are handled here, without waking anyone.
  for (;;) {
    const events = [];
    for (const w of Object.values(state.workers).filter((w) => w.live)) {
      const i = await sessionInfo(w);
      const idleMin = (Date.now() - i.last) / 60000;
      if (!i.busy) {
        w.live = false;
        events.push(`${w.name} ${i.error ? `ended with ${i.error}` : 'finished'} (${changed(w)} files changed)`);
      } else if (idleMin > STALL_MIN) {
        w.stalls += 1;
        await abort(w);
        if (w.stalls === 1) {
          await send(w, 'You stopped making progress. Continue from where you were: take the next concrete step now.');
        } else if (w.stalls === 2) {
          w.session = null;
          await send(w, prompt(w) + '\nA previous attempt stalled; its uncommitted edits are in this worktree. Build on them.');
        } else {
          const next = TIERS[Math.min(TIERS.indexOf(w.model) + 1, TIERS.length - 1)];
          w.model = next;
          w.session = null;
          w.stalls = 0;
          await send(w, prompt(w) + '\nEarlier attempts stalled; their uncommitted edits are in this worktree. Build on them.');
          events.push(`${w.name} escalated to ${next}`);
        }
        console.error(`[crew] ${w.name} stalled ${idleMin.toFixed(0)}m, action ${w.stalls}`);
      }
    }
    save(state);
    if (events.length) {
      console.log(events.join('\n'));
      break;
    }
    if (!Object.values(state.workers).some((w) => w.live)) {
      console.log('no live workers');
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
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
  console.log('usage: crew.mjs start|status|watch|report|stop');
}
