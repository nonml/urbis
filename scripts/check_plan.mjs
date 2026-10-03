// Plan check — docs/ROADMAP.md, docs/plan/TASKS.md and docs/plan/milestones/.
//
//   npm run check:plan
//
// The plan is settled (D15): everything Cities: Skylines, GTA, Watch Dogs and
// Cyberpunk 2077 have is in exactly one criterion. This fails when an edit
// breaks that or breaks the plan's own wiring:
// - every criterion is proved by a task, and every task proves a criterion
//   that exists; every check file a criterion names is written by a task;
// - every task a Needs cell names exists, and no tasks wait on each other in
//   a loop (a task in M13-M34 names exact tasks there, never a whole
//   milestone: whole-milestone Needs are what made loops before);
// - every mechanic of docs/plan/features/mechanics.md not taken into M0-M12 by
//   D14, every feature first marked later or out (urbis-*.md) and every
//   content row (triage-*.md) is covered by exactly one criterion of M13-M34;
// - every M13-M34 ID cited anywhere in the plan exists.
// It reads only markdown, so it runs in well under a second.
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, 'utf8');
const FEATURES = 'docs/plan/features/';
const MILESTONES = 'docs/plan/milestones/';
const GAMES = ['cs', 'gta', 'wd', 'cp'];
const TASK_ID = /^\| (M\d+\.(?:T\d+[ab]?|S\d+)) \|/;
const CRIT_ID = /^\| (M\d+-\d+) \|/;
// A Needs reference: a task (M3.T4b), a criterion (M8-2) or a whole milestone (M14).
const REF = /\bM(\d+)(?:\.([TS]\d+[ab]?)|-(\d+))?\b/g;

const errors = [];
const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
const lines = (text) => text.split('\n');
const msNum = (id) => Number(id.match(/^M(\d+)/)[1]);

// ---- the slice, M0-M12: ROADMAP criteria, TASKS.md tasks -------------------
const roadmap = read('docs/ROADMAP.md');
const tasksMd = read('docs/plan/TASKS.md');
const sliceCrit = new Map();
for (const l of lines(roadmap)) {
  const m = l.match(CRIT_ID);
  if (!m) continue;
  if (sliceCrit.has(m[1])) errors.push(`ROADMAP: ${m[1]} appears twice`);
  sliceCrit.set(m[1], cells(l));
}
const tasks = new Map(); // id -> { cells, file, order }
for (const l of lines(tasksMd)) {
  const m = l.match(TASK_ID);
  if (!m) continue;
  if (tasks.has(m[1])) errors.push(`TASKS.md: ${m[1]} appears twice`);
  tasks.set(m[1], { c: cells(l), file: 'TASKS.md', order: tasks.size });
}

// ---- M13-M34: one file each ------------------------------------------------
const files = readdirSync(ROOT + MILESTONES).filter((f) => /^M\d+-.*\.md$/.test(f))
  .sort((a, b) => msNum(a) - msNum(b));
const crit = new Map(sliceCrit);
const parsed = [];
for (const f of files) {
  const mid = f.match(/^(M\d+)/)[1];
  const text = read(MILESTONES + f);
  const critSection = text.split('## Criteria')[1]?.split('\n## ')[0] ?? '';
  const featSection = text.split('## What each criterion delivers')[1] ?? '';
  const own = (sec, re) => lines(sec).filter((l) => re.test(l)).map(cells);
  const cr = own(critSection, new RegExp(`^\\| ${mid}-\\d+ \\|`));
  const tk = own(text, new RegExp(`^\\| ${mid}\\.T\\d+ \\|`));
  const ft = own(featSection, new RegExp(`^\\| ${mid}-\\d+ \\|`));
  for (const c of cr) crit.set(c[0], c);
  for (const t of tk) {
    if (tasks.has(t[0])) errors.push(`${f}: ${t[0]} appears twice`);
    tasks.set(t[0], { c: t, file: f, order: tasks.size });
  }
  parsed.push({ f, mid, cr, tk, ft });
}

// ---- every row's shape, proof and check file -------------------------------
const proved = new Set();
for (const [id, { c, file }] of tasks) {
  if (c.length !== 6) { errors.push(`${file}: ${id} has ${c.length} cells, not 6`); continue; }
  if (file !== 'TASKS.md' && !['S', 'M'].includes(c[5])) errors.push(`${file}: ${id} size is ${c[5]}, not S or M`);
  const p = c[4].match(/M\d+-\d+/g) ?? [];
  if (file !== 'TASKS.md' && !p.some((x) => x.startsWith(id.split('.')[0] + '-'))) errors.push(`${file}: ${id} proves nothing of its milestone`);
  for (const x of p) {
    proved.add(x);
    if (!crit.has(x)) errors.push(`${file}: ${id} proves ${x}, which does not exist`);
  }
}
for (const id of crit.keys()) if (!proved.has(id)) errors.push(`${id}: no task proves it`);
for (const { f, mid, cr, tk } of parsed) {
  const want = (n, fmt) => Array.from({ length: n }, (_, i) => fmt(i + 1)).join();
  if (cr.map((c) => c[0]).join() !== want(cr.length, (i) => `${mid}-${i}`)) errors.push(`${f}: criteria are not numbered 1 to ${cr.length}`);
  if (tk.map((t) => t[0]).join() !== want(tk.length, (i) => `${mid}.T${i}`)) errors.push(`${f}: tasks are not numbered 1 to ${tk.length}`);
  for (const c of cr) if (c.length !== 5) errors.push(`${f}: ${c[0]} has ${c.length} cells, not 5`);
}
const taskText = [...tasks.values()].map(({ c }) => c.join(' ')).join('\n');
for (const [id, c] of crit) {
  for (const chk of c[2]?.match(/m\d+-[a-z0-9-]+\.(?:spec|test)\.js/g) ?? []) {
    if (!taskText.includes(chk)) errors.push(`${id}: no task writes its check ${chk}`);
  }
}

// ---- Needs: every reference exists, and no loops ---------------------------
const byMilestone = new Map();
for (const id of tasks.keys()) {
  const m = id.split('.')[0];
  if (!byMilestone.has(m)) byMilestone.set(m, []);
  byMilestone.get(m).push(id);
}
const deps = new Map();
for (const [id, { c, file, order }] of tasks) {
  const needs = c[3] ?? '';
  const own = id.split('.')[0];
  const d = new Set();
  if (/all of the above/.test(needs)) {
    for (const t of byMilestone.get(own)) if (tasks.get(t).order < order) d.add(t);
  }
  for (const [ref, n, task, critNo] of needs.matchAll(REF)) {
    const ms = `M${n}`;
    if (task) {
      if (tasks.has(ref)) d.add(ref); else errors.push(`${file}: ${id} needs ${ref}, which does not exist`);
    } else if (critNo) {
      for (const t of byMilestone.get(ms) ?? []) if (tasks.get(t).c[4]?.match(new RegExp(`\\b${ref}\\b`))) d.add(t);
    } else if (ms !== own) {
      if (!byMilestone.has(ms)) errors.push(`${file}: ${id} needs ${ms}, which does not exist`);
      const late = (k) => k >= 13 && k <= 34;
      if (late(msNum(own)) && late(Number(n))) errors.push(`${file}: ${id} needs the whole of ${ms}; name the exact task`);
      for (const t of byMilestone.get(ms) ?? []) d.add(t);
    }
  }
  d.delete(id);
  deps.set(id, d);
}
const state = new Map();
const loops = new Set();
const visit = (u, stack) => {
  state.set(u, 1);
  stack.push(u);
  for (const v of deps.get(u)) {
    if (state.get(v) === 1) loops.add(stack.slice(stack.indexOf(v)).concat(v).join(' -> '));
    else if (!state.get(v)) visit(v, stack);
  }
  stack.pop();
  state.set(u, 2);
};
for (const id of deps.keys()) if (!state.get(id)) visit(id, []);
for (const l of [...loops].slice(0, 10)) errors.push(`tasks wait on each other: ${l}`);
if (loops.size > 10) errors.push(`... and ${loops.size - 10} more loops`);

// ---- coverage: every mechanic, later/out feature and content row, once ----
const gaps = new Set();
for (const l of lines(read(FEATURES + 'mechanics.md'))) if (l.startsWith('| GAP-')) gaps.add(cells(l)[0]);
const capabilities = read('docs/plan/CAPABILITIES.md');
const wentIn = capabilities.split('**What went in.**')[1]?.split('**Where the rest went')[0] ?? '';
const d14 = new Set(wentIn.match(/GAP-\d\d-\d\d\d/g) ?? []);
const wantGap = [...gaps].filter((g) => !d14.has(g));
const laterOut = new Set();
const content = new Set();
for (const g of GAMES) {
  for (const l of lines(read(`${FEATURES}urbis-${g}.md`))) {
    const c = /^\| [A-Z]+-\d/.test(l) && cells(l);
    if (c && ['later', 'out'].includes(c[2])) laterOut.add(c[0]);
  }
  for (const l of lines(read(`${FEATURES}triage-${g}.md`))) {
    const c = /^\| [A-Z]+-\d/.test(l) && cells(l);
    if (c && c[3] === 'content') content.add(c[0]);
  }
}
// "GTA-03-001 to GTA-03-020" names every later/out or content row in between.
const expand = (s) => s.split(/,\s*/).map((p) => p.trim()).filter(Boolean).flatMap((p) => {
  const r = p.match(/^([A-Z]+-\d\d-)(\d+) to ([A-Z]+-\d\d-)(\d+)$/);
  if (!r) return [p];
  const out = [];
  for (let n = Number(r[2]); n <= Number(r[4]); n++) {
    const id = r[1] + String(n).padStart(r[2].length, '0');
    if (laterOut.has(id) || content.has(id)) out.push(id);
  }
  return r[1] === r[3] ? out : [`bad range ${p}`];
});
const gapSeen = new Map();
const featSeen = new Map();
for (const { f, cr, ft } of parsed) {
  for (const c of cr) {
    for (const g of c[4]?.match(/GAP-\d\d-\d\d\d/g) ?? []) {
      if (!gaps.has(g)) errors.push(`${f}: ${c[0]} covers ${g}, which is not in mechanics.md`);
      if (d14.has(g)) errors.push(`${f}: ${c[0]} covers ${g}, which D14 already put in M0-M12`);
      gapSeen.set(g, [...(gapSeen.get(g) ?? []), c[0]]);
    }
  }
  for (const [id, list] of ft) {
    if (!crit.has(id)) errors.push(`${f}: features listed for ${id}, which does not exist`);
    for (const x of expand(list)) {
      if (!laterOut.has(x) && !content.has(x)) errors.push(`${f}: ${id} lists ${x}, not a later/out or content feature`);
      else featSeen.set(x, [...(featSeen.get(x) ?? []), id]);
    }
  }
}
for (const [x, where] of [...gapSeen, ...featSeen]) if (where.length > 1) errors.push(`${x} is in ${where.join(' and ')}`);
const missing = (all, seen) => [...all].filter((x) => !seen.has(x));
const missGap = missing(wantGap, gapSeen);
const missLo = missing(laterOut, featSeen);
const missCt = missing(content, featSeen);
if (missGap.length) errors.push(`mechanics in no criterion: ${missGap.slice(0, 20).join(', ')}${missGap.length > 20 ? ' ...' : ''}`);
if (missLo.length) errors.push(`later/out features in no criterion: ${missLo.slice(0, 20).join(', ')}${missLo.length > 20 ? ' ...' : ''}`);
if (missCt.length) errors.push(`content rows in no criterion: ${missCt.slice(0, 20).join(', ')}${missCt.length > 20 ? ' ...' : ''}`);

// ---- every M13-M34 ID cited anywhere exists --------------------------------
const cited = ['docs/ROADMAP.md', 'docs/plan/TASKS.md', 'docs/plan/CAPABILITIES.md', 'AGENTS.md', `${FEATURES}README.md`,
  ...files.map((f) => MILESTONES + f)];
for (const p of cited) {
  for (const [id] of read(p).matchAll(/\bM(?:1[3-9]|2\d|3[0-4])(?:-\d+|\.T\d+)\b/g)) {
    if (!crit.has(id) && !tasks.has(id)) errors.push(`${p} cites ${id}, which does not exist`);
  }
}

const unique = [...new Set(errors)];
console.log(`plan: ${crit.size} criteria, ${tasks.size} tasks, ${files.length} milestone files; ` +
  `mechanics ${wantGap.length - missGap.length}/${wantGap.length}, later/out features ${laterOut.size - missLo.length}/${laterOut.size}, ` +
  `content rows ${content.size - missCt.length}/${content.size}; ${loops.size} loops`);
for (const e of unique) console.log('  FAIL ' + e);
process.exit(unique.length ? 1 : 0);
