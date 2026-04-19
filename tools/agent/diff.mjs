import { spawnSync, execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();

export function extractDiff(modelOutput) {
  const text = (modelOutput || '').trim();
  if (text === 'ABORT_NEEDS_SPLIT') return { abort: true };
  const start = text.indexOf('diff --git');
  if (start === -1) return { error: 'no unified diff found', raw: text.slice(0, 500) };
  let diff = text.slice(start);
  const fence = diff.indexOf('\n```');
  if (fence !== -1) diff = diff.slice(0, fence);
  if (!diff.endsWith('\n')) diff += '\n';
  return { diff };
}

export function applyDiff(diff) {
  const dir = mkdtempSync(join(tmpdir(), 'noctune-diff-'));
  const patchPath = join(dir, 'patch.diff');
  writeFileSync(patchPath, diff);
  try {
    const r = spawnSync('git', ['apply', '--3way', '--whitespace=nowarn', patchPath], {
      cwd: ROOT, encoding: 'utf8',
    });
    if (r.status !== 0) return { ok: false, error: r.stderr || r.stdout };
    return { ok: true };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

export function revertWorkingTree() {
  spawnSync('git', ['reset', '--hard', 'HEAD'], { cwd: ROOT });
  spawnSync('git', ['clean', '-fd', 'src', 'tools/agent', 'tests', 'docs'], { cwd: ROOT });
}

export function filesTouchedByDiff(diff) {
  const set = new Set();
  for (const line of diff.split('\n')) {
    const m = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
    if (m) { set.add(m[1]); set.add(m[2]); }
  }
  return [...set];
}

export function assertDiffWithinAllowed(diff, allowed) {
  const touched = filesTouchedByDiff(diff);
  const bad = touched.filter((f) => !allowed.includes(f));
  if (bad.length) throw new Error(`diff touches files outside files_allowed: ${bad.join(', ')}`);
}

export function gitCommit(message, files) {
  execFileSync('git', ['add', '--', ...files], { cwd: ROOT });
  const r = spawnSync('git', ['commit', '-m', message], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git commit failed: ${r.stderr}`);
  return r.stdout;
}

export function currentHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
}
