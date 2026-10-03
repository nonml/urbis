// How many generated cities a placement test sweeps. The fast gate takes the
// first 20, so it runs in under a minute; GATE_FULL=1 sweeps every one.
export const sweep = (n) => Array.from({ length: process.env.GATE_FULL === '1' ? n : Math.min(n, 20) }, (_, i) => i + 1);
