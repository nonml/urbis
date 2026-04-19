const MODEL_URL = process.env.MODEL_URL || 'http://localhost:11434';
const MODEL_NAME = process.env.MODEL_NAME || 'gemma3:27b';
const NUM_CTX = Number(process.env.MODEL_NUM_CTX || 24576);
const NUM_PREDICT = Number(process.env.MODEL_NUM_PREDICT || 4096);
const TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS || 300_000);

export async function callModel(prompt, { temperature = 0.15, stop = [] } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${MODEL_URL}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt,
        stream: false,
        options: {
          temperature,
          top_p: 0.9,
          num_ctx: NUM_CTX,
          num_predict: NUM_PREDICT,
          stop,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`model HTTP ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.response ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export function modelInfo() {
  return { MODEL_URL, MODEL_NAME, NUM_CTX, NUM_PREDICT, TIMEOUT_MS };
}
