#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).trim();
}

function collectCommits() {
  const raw = run('git log --format="%H|%aI|%s" --since="3 months ago"');
  if (!raw) return [];
  return raw.split('\n').map(line => {
    const [hash, date, subject] = line.split('|');
    return { hash: hash.slice(0, 8), date, subject };
  });
}

function collectLOC() {
  const raw = run('git log --format="%H" --since="3 months ago"');
  if (!raw) return [];
  return raw.split('\n').slice(0, 50).map(hash => {
    const stat = run(`git show ${hash} --stat --format=""`);
    const match = stat.match(/(\d+) insertions?.*?(\d+) deletions?/);
    const ins = match ? parseInt(match[1]) : 0;
    const del = match ? parseInt(match[2]) : 0;
    return { hash: hash.slice(0, 8), insertions: ins, deletions: del, net: ins - del };
  });
}

function collectReverts() {
  const raw = run('git log --format="%s" --since="3 months ago"');
  if (!raw) return { total: 0, reverts: 0 };
  const lines = raw.split('\n');
  const reverts = lines.filter(s => /revert/i.test(s)).length;
  return { total: lines.length, reverts, rate: lines.length ? (reverts / lines.length * 100).toFixed(1) : 0 };
}

function collectChecklist() {
  const md = readFileSync(join(ROOT, 'docs', 'CHECKLIST_2Y.md'), 'utf-8');
  const done = (md.match(/- \[x\]/g) || []).length;
  const open = (md.match(/- \[ \]/g) || []).length;
  const wip = (md.match(/- \[~\]/g) || []).length;
  const struck = (md.match(/~~\[~\]~~/g) || []).length;

  const openItems = [];
  for (const m of md.matchAll(/- \[ \] `([^`]+)` (.+)/g)) {
    openItems.push({ id: m[1], desc: m[2] });
  }

  const sections = {};
  let curSection = '';
  for (const line of md.split('\n')) {
    const hm = line.match(/^### (.+)/);
    if (hm) { curSection = hm[1]; sections[curSection] = { done: 0, total: 0 }; continue; }
    if (curSection && sections[curSection]) {
      if (/- \[x\]/.test(line)) { sections[curSection].done++; sections[curSection].total++; }
      else if (/- \[ \]/.test(line)) { sections[curSection].total++; }
      else if (/~~\[~\]~~/.test(line)) { sections[curSection].done++; sections[curSection].total++; }
    }
  }

  return { done, open, wip, struck, openItems: openItems.slice(0, 10), sections };
}

function collectBundleSize() {
  try {
    const distDir = join(ROOT, 'build', 'assets');
    let totalBytes = 0;
    for (const f of readdirSync(distDir)) {
      if (/\.(js|css)$/.test(f)) {
        totalBytes += statSync(join(distDir, f)).size;
      }
    }
    return { totalKB: Math.round(totalBytes / 1024), date: new Date().toISOString() };
  } catch {
    return { totalKB: 0, date: new Date().toISOString() };
  }
}

function collectWeeklyThroughput(commits) {
  const weeks = {};
  for (const c of commits) {
    const d = new Date(c.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    weeks[key] = (weeks[key] || 0) + 1;
  }
  return Object.entries(weeks)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

function collectGateHealth() {
  const gates = ['lint:basic', 'check:no-math-random', 'validate', 'test'];
  const results = {};
  for (const g of gates) {
    try {
      run(`npm run ${g} 2>&1`);
      results[g] = 'pass';
    } catch {
      results[g] = 'fail';
    }
  }
  const lastGreen = Object.values(results).every(v => v === 'pass')
    ? new Date().toISOString().slice(0, 10) : null;
  return { gates: results, lastGreen };
}

const commits = collectCommits();
const data = {
  generatedAt: new Date().toISOString(),
  throughput: collectWeeklyThroughput(commits),
  reverts: collectReverts(),
  loc: collectLOC(),
  checklist: collectChecklist(),
  bundle: collectBundleSize(),
  gateHealth: collectGateHealth(),
};

const outPath = join(__dirname, 'data.json');
writeFileSync(outPath, JSON.stringify(data, null, 2));
const itemCount = Object.keys(data).length;
process.stdout.write(`Dashboard data collected: ${itemCount} sections → ${outPath}\n`);
