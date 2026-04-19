import { readQueue, writeQueue, readState, writeState, pickNextReady, updateTask } from './queue_io.mjs';
import { runGate, formatGateError } from './gate.mjs';
import { renderPrompt, renderFixPrompt } from './prompt_render.mjs';
import { callModel, modelInfo } from './ollama.mjs';
import { extractDiff, applyDiff, revertWorkingTree, assertDiffWithinAllowed, gitCommit, currentHead } from './diff.mjs';
import { tickChecklistItems } from './checklist.mjs';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(HERE, 'logs');
const PENDING_DIR = join(HERE, 'pending_changes');
const MAX_RETRIES = 2;

// BOOT inputs
const MANUAL_PATH = join(HERE, '..', '..', 'docs', 'ROADMAP_2Y.md');
const CHECKLIST_PATH = join(HERE, '..', '..', 'docs', 'CHECKLIST_2Y.md');

function ts() { return new Date().toISOString().replace(/[:.]/g, '-'); }

/**
 * BOOT phase: read manual, checklist, queue, state, and git status.
 * Throws if any required file is missing.
 * Returns an object with all five inputs and their sizes.
 */
export function boot() {
  const inputs = {};

  // 1. Read manual (ROADMAP_2Y.md)
  if (!existsSync(MANUAL_PATH)) {
    throw new Error(`BOOT failed: manual not found at ${MANUAL_PATH}`);
  }
  inputs.manual = readFileSync(MANUAL_PATH, 'utf8');
  inputs.manual_size = inputs.manual.length;

  // 2. Read checklist (CHECKLIST_2Y.md)
  if (!existsSync(CHECKLIST_PATH)) {
    throw new Error(`BOOT failed: checklist not found at ${CHECKLIST_PATH}`);
  }
  inputs.checklist = readFileSync(CHECKLIST_PATH, 'utf8');
  inputs.checklist_size = inputs.checklist.length;

  // 3. Read queue (queue.json)
  inputs.queue = readQueue();

  // 4. Read state (state.json)
  inputs.state = readState();

  // 5. Read git status (current HEAD)
  inputs.git_head = currentHead();

  return inputs;
}

/**
 * TRIAGE phase: decide which task to run.
 * Returns { task, mode } where mode is 'resume', 'pick', or 'maintenance'.
 */
export function triage(queue, state) {
  // 1. Resume in_progress task if present
  if (state.phase === 'in_progress' && state.current_id) {
    const task = queue.find((t) => t.id === state.current_id);
    if (task) return { task, mode: 'resume' };
  }

  // 2. Pick highest-priority READY task
  const picked = pickNextReady(queue);
  if (picked) return { task: picked, mode: 'pick' };

  // 3. No task available — maintenance mode
  return { task: null, mode: 'maintenance' };
}

function logTranscript(task, entries) {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  const path = join(LOGS_DIR, `${ts()}-${task?.id || 'maintenance'}.md`);
  writeFileSync(path, entries.map((e) => `## ${e.phase}\n${e.body}\n`).join('\n'));
  return path;
}

function writeChangelogSnippet(task, diffLen) {
  if (!existsSync(PENDING_DIR)) mkdirSync(PENDING_DIR, { recursive: true });
  const snippet = `type: ${task.type}
area: ${task.area || 'agent'}
summary: ${task.title}
task: ${task.id}
loc_changed: ${diffLen}
`;
  writeFileSync(join(PENDING_DIR, `${task.id}.md`), snippet);
}

function commitMessage(task, tickedIds) {
  return `${task.type}(${task.area || 'agent'}): ${task.title}

Why: ${task.description || task.title}
Task: ${task.id}
Checklist: ${tickedIds.join(', ') || '(none)'}

Co-Authored-By: local-agent-World <agent@noctune.local>`;
}

export async function runOnce() {
  const transcript = [{ phase: 'boot', body: JSON.stringify(modelInfo(), null, 2) }];
  let queue = readQueue();
  let state = readState();

  let task = state.phase === 'in_progress'
    ? queue.find((t) => t.id === state.current_id)
    : pickNextReady(queue);

  if (!task) {
    transcript.push({ phase: 'idle', body: 'no READY tasks — sleeping' });
    logTranscript(null, transcript);
    return { status: 'idle' };
  }

  transcript.push({ phase: 'triage', body: `picked ${task.id} (priority ${task.priority})` });
  writeState({ phase: 'in_progress', current_id: task.id, plan: null, started_at: new Date().toISOString(), retry_count: 0 });
  queue = updateTask(queue, task.id, { status: 'in_progress' });
  writeQueue(queue);

  let prompt;
  try {
    prompt = renderPrompt(task);
  } catch (e) {
    queue = updateTask(queue, task.id, { status: 'needs_split', last_error: e.message });
    writeQueue(queue);
    writeState({ phase: 'idle', current_id: null, plan: null, started_at: null, retry_count: 0 });
    transcript.push({ phase: 'abort', body: `needs_split: ${e.message}` });
    logTranscript(task, transcript);
    return { status: 'needs_split', task: task.id };
  }

  transcript.push({ phase: 'prompt', body: prompt.slice(0, 2000) + (prompt.length > 2000 ? '\n... [truncated]' : '') });
  const headBefore = currentHead();

  let lastDiff = '';
  let gate;
  let attempt = 0;
  let applied = false;

  for (; attempt <= MAX_RETRIES; attempt++) {
    const modelOut = await callModel(attempt === 0 ? prompt : renderFixPrompt(task, formatGateError(gate), lastDiff));
    transcript.push({ phase: `model-attempt-${attempt}`, body: modelOut.slice(0, 4000) });

    const ex = extractDiff(modelOut);
    if (ex.abort) {
      queue = updateTask(queue, task.id, { status: 'needs_split', last_error: 'model ABORT_NEEDS_SPLIT' });
      writeQueue(queue);
      writeState({ phase: 'idle', current_id: null, plan: null, started_at: null, retry_count: 0 });
      transcript.push({ phase: 'abort', body: 'ABORT_NEEDS_SPLIT' });
      logTranscript(task, transcript);
      return { status: 'needs_split', task: task.id };
    }
    if (ex.error) {
      transcript.push({ phase: 'bad-diff', body: `${ex.error}: ${ex.raw}` });
      continue;
    }

    try {
      assertDiffWithinAllowed(ex.diff, task.files_allowed || []);
    } catch (e) {
      transcript.push({ phase: 'out-of-bounds', body: e.message });
      continue;
    }

    const ap = applyDiff(ex.diff);
    if (!ap.ok) {
      transcript.push({ phase: 'apply-fail', body: ap.error });
      continue;
    }

    lastDiff = ex.diff;
    applied = true;
    gate = runGate();
    transcript.push({ phase: `gate-attempt-${attempt}`, body: gate.ok ? 'PASS' : formatGateError(gate) });

    if (gate.ok) break;
    revertWorkingTree();
  }

  if (!applied || !gate?.ok) {
    revertWorkingTree();
    queue = updateTask(queue, task.id, { status: 'needs_rework', last_error: 'gate failed after retries' });
    writeQueue(queue);
    writeState({ phase: 'idle', current_id: null, plan: null, started_at: null, retry_count: 0 });
    transcript.push({ phase: 'revert', body: 'all attempts exhausted' });
    logTranscript(task, transcript);
    return { status: 'needs_rework', task: task.id };
  }

  const diffLen = lastDiff.split('\n').length;
  writeChangelogSnippet(task, diffLen);
  const tickedIds = tickChecklistItems(task.checklist_items || []);

  const filesToCommit = [...(task.files_allowed || []), `tools/agent/pending_changes/${task.id}.md`];
  if (tickedIds.length) filesToCommit.push('docs/CHECKLIST_2Y.md');

  try {
    gitCommit(commitMessage(task, tickedIds), filesToCommit);
  } catch (e) {
    revertWorkingTree();
    queue = updateTask(queue, task.id, { status: 'needs_rework', last_error: `commit failed: ${e.message}` });
    writeQueue(queue);
    writeState({ phase: 'idle', current_id: null, plan: null, started_at: null, retry_count: 0 });
    transcript.push({ phase: 'commit-fail', body: e.message });
    logTranscript(task, transcript);
    return { status: 'needs_rework', task: task.id };
  }

  queue = updateTask(queue, task.id, { status: 'done', head: currentHead() });
  writeQueue(queue);
  writeState({ phase: 'idle', current_id: null, plan: null, started_at: null, retry_count: 0 });
  transcript.push({ phase: 'commit', body: `HEAD ${headBefore} -> ${currentHead()}; ticked: ${tickedIds.join(', ')}` });
  logTranscript(task, transcript);
  return { status: 'done', task: task.id, ticked: tickedIds };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  runOnce().then((r) => {
    console.log('runOnce result:', r);
    process.exit(0);
  }).catch((e) => {
    console.error('runner error:', e);
    process.exit(1);
  });
}
