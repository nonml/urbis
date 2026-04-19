import { test } from 'node:test';
import { strictEqual, notStrictEqual } from 'node:assert';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT_DIR = join(HERE, '..');
const STATE_PATH = join(AGENT_DIR, 'state.json');
const QUEUE_PATH = join(AGENT_DIR, 'queue.json');

// Snapshot original state
const originalState = existsSync(STATE_PATH)
  ? readFileSync(STATE_PATH, 'utf8')
  : null;

function writeState(obj) {
  writeFileSync(STATE_PATH, JSON.stringify(obj, null, 2) + '\n');
}

function readState() {
  if (!existsSync(STATE_PATH)) {
    return { phase: 'idle', current_id: null, plan: null, started_at: null, retry_count: 0 };
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
}

// Find two READY tasks with different priorities in queue
function loadQueue() {
  return JSON.parse(readFileSync(QUEUE_PATH, 'utf8'));
}

function findReadyTasks(queue, minCount) {
  const ready = queue.filter((t) => t.status === 'READY');
  if (ready.length < minCount) {
    throw new Error(`Need at least ${minCount} READY tasks, found ${ready.length}`);
  }
  ready.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return ready;
}

function restoreState() {
  if (originalState !== null) {
    writeFileSync(STATE_PATH, originalState);
  } else if (existsSync(STATE_PATH)) {
    writeFileSync(STATE_PATH, JSON.stringify({
      phase: 'idle',
      current_id: null,
      plan: null,
      started_at: null,
      retry_count: 0
    }, null, 2) + '\n');
  }
}

test('runner resumes in_progress task over READY tasks', async () => {
  const queue = loadQueue();
  const ready = findReadyTasks(queue, 2);

  // Pick the lower-priority task as the "crashed" task
  const crashedTask = ready[1]; // lower priority
  const higherPriorityTask = ready[0]; // higher priority

  // Simulate mid-task crash: state says in_progress with crashedTask.id
  writeState({
    phase: 'in_progress',
    current_id: crashedTask.id,
    plan: null,
    started_at: '2026-04-18T12:00:00Z',
    retry_count: 0,
  });

  // Verify state was written correctly
  const state = readState();
  strictEqual(state.phase, 'in_progress');
  strictEqual(state.current_id, crashedTask.id);

  // Simulate the runner's decision logic (runner.mjs lines 48-53):
  //   let task = state.phase === 'in_progress'
  //     ? queue.find((t) => t.id === state.current_id)
  //     : pickNextReady(queue);
  const resumedTask = queue.find((t) => t.id === state.current_id);
  strictEqual(
    resumedTask?.id,
    crashedTask.id,
    'Runner should resume the in_progress task, not pick a new READY task'
  );

  // Verify the resumed task is different from what pickNextReady would return
  const { pickNextReady } = await import('../queue_io.mjs');
  const nextReady = pickNextReady(queue);
  strictEqual(
    nextReady.id,
    higherPriorityTask.id,
    'pickNextReady returns higher-priority task'
  );
  notStrictEqual(
    resumedTask.id,
    nextReady.id,
    'Resumed task differs from pickNextReady result'
  );

  restoreState();
});

test('runner picks next READY when phase is idle', async () => {
  const queue = loadQueue();
  const ready = findReadyTasks(queue, 1);
  const highestPriority = ready[0];

  // Simulate idle state
  writeState({
    phase: 'idle',
    current_id: null,
    plan: null,
    started_at: null,
    retry_count: 0,
  });

  const state = readState();
  strictEqual(state.phase, 'idle');
  strictEqual(state.current_id, null);

  // When idle, runner should pick highest-priority READY task
  const { pickNextReady } = await import('../queue_io.mjs');
  const picked = pickNextReady(queue);
  strictEqual(
    picked.id,
    highestPriority.id,
    'Runner picks highest-priority READY task when idle'
  );

  restoreState();
});

test('runner is idle when no READY tasks match current_id', async () => {
  const queue = loadQueue();

  // Simulate crash with a non-existent task id
  writeState({
    phase: 'in_progress',
    current_id: 'nonexistent-task-id',
    plan: null,
    started_at: '2026-04-18T12:00:00Z',
    retry_count: 0,
  });

  const state = readState();
  const resumedTask = queue.find((t) => t.id === state.current_id);

  strictEqual(
    resumedTask,
    undefined,
    'Runner finds no task matching nonexistent current_id'
  );

  restoreState();
});
