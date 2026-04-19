import { runOnce } from './runner.mjs';

const IDLE_SLEEP_MS = Number(process.env.AGENT_IDLE_SLEEP_MS || 60_000);
const WORK_SLEEP_MS = Number(process.env.AGENT_WORK_SLEEP_MS || 5_000);
const ERROR_SLEEP_MS = Number(process.env.AGENT_ERROR_SLEEP_MS || 120_000);
const MAX_CONSECUTIVE_ERRORS = Number(process.env.AGENT_MAX_ERRORS || 3);

let consecutiveErrors = 0;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log(`[loop] starting — ${new Date().toISOString()}`);
  console.log(`[loop] MODEL_URL=${process.env.MODEL_URL || 'http://localhost:11434'} MODEL_NAME=${process.env.MODEL_NAME || 'gemma3:27b'}`);
  while (true) {
    try {
      const r = await runOnce();
      console.log(`[loop] ${new Date().toISOString()} ${r.status}${r.task ? ` (${r.task})` : ''}${r.ticked?.length ? ` [ticked ${r.ticked.join(',')}]` : ''}`);
      consecutiveErrors = 0;
      if (r.status === 'idle') await sleep(IDLE_SLEEP_MS);
      else await sleep(WORK_SLEEP_MS);
    } catch (e) {
      consecutiveErrors++;
      console.error(`[loop] error #${consecutiveErrors}:`, e.message);
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`[loop] ${MAX_CONSECUTIVE_ERRORS} consecutive errors — halting. Check tools/agent/incidents/.`);
        process.exit(1);
      }
      await sleep(ERROR_SLEEP_MS);
    }
  }
}

process.on('SIGINT', () => { console.log('\n[loop] stopping'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n[loop] stopping'); process.exit(0); });

main();
