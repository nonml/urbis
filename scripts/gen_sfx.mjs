/**
 * Procedural SFX Generator
 * Writes WAV files for all game sound effects using pure math (no deps).
 * All output is CC0 — generated programmatically.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'assets', 'audio');

const SAMPLE_RATE = 44100;

// ── WAV writer ────────────────────────────────────────────────────────────────
function writeWav(filename, samples) {
    const numSamples = samples.length;
    const buf = Buffer.alloc(44 + numSamples * 2);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + numSamples * 2, 4);
    buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);           // PCM, mono
    buf.writeUInt32LE(SAMPLE_RATE, 24); buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
    buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
    buf.write('data', 36); buf.writeUInt32LE(numSamples * 2, 40);
    for (let i = 0; i < numSamples; i++) {
        buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
    }
    const dir = dirname(join(OUT, filename));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(OUT, filename), buf);
    console.log('✓', filename);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const sine  = (t, freq) => Math.sin(2 * Math.PI * freq * t);
const noise = () => (Math.random() * 2 - 1);
const env   = (t, attack, sustain, release, total) => {
    if (t < attack)                               return t / attack;
    if (t < attack + sustain)                     return 1;
    if (t < attack + sustain + release)           return 1 - (t - attack - sustain) / release;
    return 0;
};
const gen = (dur, fn) => {
    const n = Math.ceil(SAMPLE_RATE * dur);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = fn(i / SAMPLE_RATE, i);
    return s;
};

// ── UI Click ─────────────────────────────────────────────────────────────────
writeWav('ui/click.wav', gen(0.08, (t) => {
    const e = env(t, 0.001, 0.01, 0.07, 0.08);
    return (sine(t, 1200) * 0.4 + sine(t, 2400) * 0.2) * e;
}));

// ── UI Success ────────────────────────────────────────────────────────────────
writeWav('ui/success.wav', gen(0.35, (t) => {
    const freq = t < 0.12 ? 880 : t < 0.24 ? 1100 : 1320;
    const e = env(t, 0.005, 0.06, 0.12, 0.35);
    return sine(t, freq) * e * 0.5;
}));

// ── UI Error ─────────────────────────────────────────────────────────────────
writeWav('ui/error.wav', gen(0.3, (t) => {
    const e = env(t, 0.002, 0.05, 0.15, 0.3);
    return (sine(t, 160) * 0.6 + noise() * 0.1) * e;
}));

// ── UI Slider ────────────────────────────────────────────────────────────────
writeWav('ui/slider.wav', gen(0.05, (t) => {
    const e = env(t, 0.001, 0.005, 0.04, 0.05);
    return sine(t, 800) * e * 0.3;
}));

// ── Build / Construction ─────────────────────────────────────────────────────
writeWav('build/build.wav', gen(0.6, (t) => {
    // Rising sweep + thud
    const sweep = sine(t, 300 + t * 600) * env(t, 0.01, 0.1, 0.2, 0.35) * 0.4;
    const thud  = (sine(t - 0.35, 80) + noise() * 0.3) * env(t - 0.35, 0.002, 0.03, 0.2, 0.25) * (t > 0.35 ? 0.6 : 0);
    return sweep + thud;
}));

// ── Crisis Stinger ───────────────────────────────────────────────────────────
writeWav('crisis/stinger.wav', gen(1.5, (t) => {
    const e = env(t, 0.01, 0.3, 0.8, 1.5);
    return (sine(t, 220) * 0.5 + sine(t, 330) * 0.3 + sine(t, 110) * 0.2) * e;
}));

// ── Crisis Warning (siren-like) ───────────────────────────────────────────────
writeWav('crisis/warning.wav', gen(2.0, (t) => {
    const lfo  = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2.5 * t); // 2.5 Hz sweep
    const freq = 600 + lfo * 400;
    const e    = Math.min(1, t * 4) * Math.max(0, 1 - (t - 1.5) * 4);
    return sine(t, freq) * e * 0.6;
}));

// ── Footsteps (grass — soft thud) ────────────────────────────────────────────
writeWav('footsteps/grass.wav', gen(0.15, (t) => {
    const e = env(t, 0.003, 0.02, 0.1, 0.15);
    return (noise() * 0.5 + sine(t, 120) * 0.3) * e;
}));

// ── Footsteps (urban — harder click) ─────────────────────────────────────────
writeWav('footsteps/urban.wav', gen(0.12, (t) => {
    const e = env(t, 0.001, 0.01, 0.1, 0.12);
    return (noise() * 0.3 + sine(t, 200) * 0.5) * e;
}));

console.log('\nAll SFX generated successfully.');
