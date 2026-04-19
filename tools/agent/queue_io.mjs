import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const QUEUE_PATH = join(HERE, 'queue.json');
export const STATE_PATH = join(HERE, 'state.json');

export function readQueue() {
  const raw = readFileSync(QUEUE_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('queue.json must be an array');
  return data;
}

export function writeQueue(queue) {
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
}

export function readState() {
  if (!existsSync(STATE_PATH)) {
    return { phase: 'idle', current_id: null, plan: null, started_at: null, retry_count: 0 };
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
}

export function writeState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

export function pickNextReady(queue) {
  const ready = queue.filter((t) => t.status === 'READY');
  ready.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return ready[0] ?? null;
}

export function updateTask(queue, id, patch) {
  const idx = queue.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error(`task ${id} not found`);
  queue[idx] = { ...queue[idx], ...patch, updated_at: new Date().toISOString() };
  return queue;
}
