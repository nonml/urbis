/**
 * Procedural Music Engine (6D)
 * Uses Tone.js to generate music from city state — no audio files needed.
 *
 * City state → music mapping:
 *   game speed         → tempo (BPM)
 *   citizen happiness  → harmonic mode (major = happy, minor = troubled)
 *   crisis active      → tension layer (dissonant pads, faster arp)
 *   gold income        → melody brightness (higher notes = prosperity)
 *   district camera    → timbre blend (residential = warm, industrial = harsh)
 */

let Tone = null;

async function loadTone() {
    if (Tone) return Tone;
    try {
        Tone = await import('tone');
        return Tone;
    } catch (e) {
        console.warn('[ProceduralMusic] Tone.js unavailable:', e.message);
        return null;
    }
}

// Scale definitions (MIDI semitone offsets from root)
const SCALES = {
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],  // neutral/bittersweet
    phrygian:   [0, 1, 3, 5, 7, 8, 10],  // dark/tense
};

const ROOT_NOTE = 'C3'; // MIDI root

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function noteInScale(degree, octave, scale, rootMidi = 48) {
    const semitones = scale[degree % scale.length] + (Math.floor(degree / scale.length) + octave) * 12;
    return midiToFreq(rootMidi + semitones);
}

export class ProceduralMusicEngine {
    constructor(game) {
        this.game = game;
        this.ready = false;
        this.running = false;
        this._masterVolume = null;
        this._melody = null;
        this._pad = null;
        this._bass = null;
        this._tension = null;
        this._arpSeq = null;
        this._melodySeq = null;
        this._bassSeq = null;
        this._melodyStep = 0;
        this._arpStep = 0;
        this._currentScale = SCALES.major;
        this._currentBPM = 90;
        this._isCrisis = false;
        this._volume = 0.4; // 0-1
        this._init();
    }

    async _init() {
        const T = await loadTone();
        if (!T) return;
        Tone = T;

        // Master volume
        this._masterVolume = new Tone.Volume(-12).toDestination();

        // --- Pad (ambient harmony layer) ---
        this._pad = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 1.5, decay: 0.5, sustain: 0.7, release: 3 },
        }).connect(new Tone.Reverb({ decay: 4, wet: 0.6 }).connect(this._masterVolume));
        this._pad.volume.value = -18;

        // --- Bass ---
        this._bass = new Tone.MonoSynth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
            filterEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 1, baseFrequency: 200, octaves: 2 },
        }).connect(new Tone.Filter(400, 'lowpass').connect(this._masterVolume));
        this._bass.volume.value = -14;

        // --- Melody ---
        this._melody = new Tone.Synth({
            oscillator: { type: 'triangle8' },
            envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.6 },
        }).connect(new Tone.Reverb({ decay: 2, wet: 0.3 }).connect(this._masterVolume));
        this._melody.volume.value = -16;

        // --- Tension (crisis layer) ---
        this._tension = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.5, decay: 0.2, sustain: 0.5, release: 1.5 },
        }).connect(new Tone.Distortion(0.3).connect(
            new Tone.Reverb({ decay: 3, wet: 0.5 }).connect(this._masterVolume)
        ));
        this._tension.volume.value = -26; // start silent

        this.ready = true;
    }

    start() {
        if (!this.ready || this.running) return;
        Tone.start(); // requires user gesture
        this.running = true;
        this._startSequencers();
        this._updateLoop();
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        Tone.Transport.stop();
        Tone.Transport.cancel();
    }

    setVolume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this._masterVolume) {
            this._masterVolume.volume.value = -40 + this._volume * 40; // -40dB to 0dB
        }
    }

    /** Called every game tick to sync music to city state. */
    _updateLoop() {
        if (!this.running) return;
        this._syncToGameState();
        setTimeout(() => this._updateLoop(), 2000); // re-sync every 2s
    }

    _syncToGameState() {
        const game = this.game;
        if (!game?.state) return;

        // --- BPM from game speed ---
        const speed = game.state.time?.speed ?? 1;
        const targetBPM = Math.round(70 + speed * 20); // 70–150
        if (Math.abs(this._currentBPM - targetBPM) > 2) {
            this._currentBPM = targetBPM;
            Tone.Transport.bpm.rampTo(targetBPM, 2);
        }

        // --- Scale from happiness ---
        const happiness = game.citizens?.averageHappiness ?? 50;
        const newScale = happiness > 65 ? SCALES.major
            : happiness > 45 ? SCALES.dorian
            : happiness > 25 ? SCALES.minor
            : SCALES.phrygian;
        this._currentScale = newScale;

        // --- Crisis tension ---
        const crisisActive = game.crisisManager?.isActive?.() ??
            (game.state.crises && Object.values(game.state.crises).some(c => c?.active));
        this._isCrisis = !!crisisActive;
        if (this._tension) {
            const targetVol = crisisActive ? -16 : -36;
            this._tension.volume.rampTo(targetVol, 3);
        }

        // --- Pad chord from scale root ---
        if (this._pad) {
            const scale = this._currentScale;
            const root = midiToFreq(48); // C3
            const third = noteInScale(2, 0, scale);
            const fifth = noteInScale(4, 0, scale);
            this._pad.releaseAll();
            this._pad.triggerAttack([root, third, fifth]);
        }

        // --- Master volume from settings ---
        const masterVol = game.ui?.settings?.get?.('masterVolume') ?? 0.8;
        this.setVolume(masterVol * 0.6);
    }

    _startSequencers() {
        if (!Tone) return;
        Tone.Transport.bpm.value = this._currentBPM;

        // Bass pattern: root on beat 1, fifth on beat 3
        const bassPattern = ['1n', '2n.', '1n', '2n.'];
        let bassStep = 0;
        new Tone.Sequence((time) => {
            if (!this.running) return;
            const scale = this._currentScale;
            const notes = [
                noteInScale(0, -1, scale), // root
                noteInScale(4, -1, scale), // fifth
                noteInScale(0, -1, scale),
                noteInScale(2, -1, scale), // third
            ];
            this._bass.triggerAttackRelease(notes[bassStep % 4], '4n', time);
            bassStep++;
        }, ['4n', '4n', '4n', '4n'], '1m').start(0);

        // Melody: simple stepwise motion through scale
        let melStep = 0;
        const melPattern = [0, 1, 2, 4, 3, 2, 1, 0, 4, 2, 0, 3, 2, 4, 1, 3];
        new Tone.Sequence((time) => {
            if (!this.running) return;
            // Skip some notes for breathing room
            if (Math.random() < 0.35) { melStep++; return; }
            const degree = melPattern[melStep % melPattern.length];
            const octave = melStep < 8 ? 1 : 2;
            const freq = noteInScale(degree, octave, this._currentScale);
            this._melody.triggerAttackRelease(freq, '8n', time);
            melStep++;
        }, ['8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n'], '1m').start('2m');

        // Tension arp: fast arpeggios during crisis
        let arpStep = 0;
        new Tone.Sequence((time) => {
            if (!this.running || !this._isCrisis) return;
            const scale = SCALES.phrygian;
            const notes = [0, 3, 5, 7, 3, 5, 3, 0];
            const freq = noteInScale(notes[arpStep % 8], 1, scale);
            this._tension.triggerAttackRelease(freq, '16n', time);
            arpStep++;
        }, ['16n', '16n', '16n', '16n', '16n', '16n', '16n', '16n'], '1m').start('1m');

        Tone.Transport.start();
    }
}

/** Singleton accessor */
let _instance = null;
export function getProceduralMusic(game) {
    if (!_instance && game) _instance = new ProceduralMusicEngine(game);
    return _instance;
}
