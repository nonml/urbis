import { spawnSync } from 'node:child_process';

const STAGES = [
  { id: 'lint',        cmd: 'npm',  args: ['run', 'lint:basic'],          timeoutMs: 60_000 },
  { id: 'mathrandom',  cmd: 'npm',  args: ['run', 'check:no-math-random'], timeoutMs: 30_000 },
  { id: 'validate',    cmd: 'npm',  args: ['run', 'validate'],             timeoutMs: 60_000 },
  { id: 'smoke',       cmd: 'npm',  args: ['test', '--silent'],            timeoutMs: 120_000 },
];

export function runGate({ skip = [] } = {}) {
  const results = [];
  for (const stage of STAGES) {
    if (skip.includes(stage.id)) {
      results.push({ id: stage.id, ok: true, skipped: true });
      continue;
    }
    const r = spawnSync(stage.cmd, stage.args, {
      encoding: 'utf8',
      timeout: stage.timeoutMs,
      shell: process.platform === 'win32',
    });
    const ok = r.status === 0;
    results.push({
      id: stage.id,
      ok,
      code: r.status,
      stderr: (r.stderr || '').slice(-4000),
      stdout: (r.stdout || '').slice(-2000),
    });
    if (!ok) return { ok: false, results, failedAt: stage.id };
  }
  return { ok: true, results };
}

export function formatGateError(gate) {
  const last = gate.results[gate.results.length - 1];
  return `Gate failed at stage "${last.id}" (exit ${last.code}).\n\nSTDERR (tail):\n${last.stderr}\n\nSTDOUT (tail):\n${last.stdout}`;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const gate = runGate();
  console.log(JSON.stringify(gate, null, 2));
  process.exit(gate.ok ? 0 : 1);
}
