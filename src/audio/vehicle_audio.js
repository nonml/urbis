/**
 * Vehicle Audio — continuous procedural engine + tire sounds
 * Uses Web Audio API oscillators that update in real-time based on vehicle speed.
 */

export class VehicleAudio {
    constructor(audioContext, masterGain) {
        this.ctx = audioContext;
        this.masterGain = masterGain;
        this._running = false;

        // Engine nodes
        this._engineOsc = null;
        this._engineGain = null;
        this._engineLfo = null;
        this._engineLfoGain = null;

        // Tire squeal nodes
        this._tireNoise = null;
        this._tireFilter = null;
        this._tireGain = null;

        // Collision burst
        this._lastCollisionTime = 0;
    }

    /**
     * Start engine sound (call when player enters vehicle)
     */
    start() {
        if (this._running || !this.ctx) return;
        this._running = true;

        const now = this.ctx.currentTime;

        // Engine: sawtooth oscillator at low frequency + LFO for rumble
        this._engineOsc = this.ctx.createOscillator();
        this._engineOsc.type = 'sawtooth';
        this._engineOsc.frequency.setValueAtTime(80, now); // idle frequency

        this._engineLfo = this.ctx.createOscillator();
        this._engineLfo.type = 'sine';
        this._engineLfo.frequency.setValueAtTime(6, now); // rumble rate
        this._engineLfoGain = this.ctx.createGain();
        this._engineLfoGain.gain.setValueAtTime(15, now);
        this._engineLfo.connect(this._engineLfoGain);
        this._engineLfoGain.connect(this._engineOsc.frequency);

        this._engineGain = this.ctx.createGain();
        this._engineGain.gain.setValueAtTime(0, now);
        this._engineGain.gain.linearRampToValueAtTime(0.12, now + 0.3); // fade in

        // Lowpass filter to tame harshness
        this._engineFilter = this.ctx.createBiquadFilter();
        this._engineFilter.type = 'lowpass';
        this._engineFilter.frequency.setValueAtTime(400, now);
        this._engineFilter.Q.setValueAtTime(2, now);

        this._engineOsc.connect(this._engineFilter);
        this._engineFilter.connect(this._engineGain);
        this._engineGain.connect(this.masterGain || this.ctx.destination);

        this._engineOsc.start(now);
        this._engineLfo.start(now);

        // Tire squeal: filtered noise, starts silent
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this._tireNoise = this.ctx.createBufferSource();
        this._tireNoise.buffer = buffer;
        this._tireNoise.loop = true;

        this._tireFilter = this.ctx.createBiquadFilter();
        this._tireFilter.type = 'bandpass';
        this._tireFilter.frequency.setValueAtTime(3000, now);
        this._tireFilter.Q.setValueAtTime(5, now);

        this._tireGain = this.ctx.createGain();
        this._tireGain.gain.setValueAtTime(0, now); // silent until drift

        this._tireNoise.connect(this._tireFilter);
        this._tireFilter.connect(this._tireGain);
        this._tireGain.connect(this.masterGain || this.ctx.destination);

        this._tireNoise.start(now);
    }

    /**
     * Stop all vehicle audio (call when player exits vehicle)
     */
    stop() {
        if (!this._running) return;
        this._running = false;

        const now = this.ctx.currentTime;

        if (this._engineGain) {
            this._engineGain.gain.cancelScheduledValues(now);
            this._engineGain.gain.setValueAtTime(this._engineGain.gain.value, now);
            this._engineGain.gain.linearRampToValueAtTime(0, now + 0.2);
        }
        if (this._tireGain) {
            this._tireGain.gain.cancelScheduledValues(now);
            this._tireGain.gain.setValueAtTime(0, now);
        }

        // Stop oscillators after fade out
        setTimeout(() => {
            try { this._engineOsc?.stop(); } catch {}
            try { this._engineLfo?.stop(); } catch {}
            try { this._tireNoise?.stop(); } catch {}
            this._engineOsc = null;
            this._engineLfo = null;
            this._engineGain = null;
            this._engineFilter = null;
            this._engineLfoGain = null;
            this._tireNoise = null;
            this._tireFilter = null;
            this._tireGain = null;
        }, 300);
    }

    /**
     * Update engine pitch and tire squeal based on vehicle state
     * Call every frame while driving.
     * @param {number} speed - current speed in m/s
     * @param {number} maxSpeed - vehicle max speed
     * @param {number} driftFactor - 0-1 drift amount
     */
    update(speed, maxSpeed, driftFactor) {
        if (!this._running || !this.ctx) return;

        const now = this.ctx.currentTime;
        const ratio = Math.min(1, speed / (maxSpeed || 22));

        // Engine pitch: 80Hz idle -> 250Hz at max speed
        if (this._engineOsc) {
            const freq = 80 + ratio * 170;
            this._engineOsc.frequency.setTargetAtTime(freq, now, 0.05);
        }

        // Engine volume: louder with speed
        if (this._engineGain) {
            const vol = 0.08 + ratio * 0.15;
            this._engineGain.gain.setTargetAtTime(vol, now, 0.05);
        }

        // LFO rumble increases with speed
        if (this._engineLfo) {
            const lfoRate = 6 + ratio * 12;
            this._engineLfo.frequency.setTargetAtTime(lfoRate, now, 0.1);
        }

        // Engine filter opens up with speed
        if (this._engineFilter) {
            const filterFreq = 400 + ratio * 800;
            this._engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);
        }

        // Tire squeal when drifting at speed
        if (this._tireGain) {
            const tireVol = driftFactor > 0.3 ? (driftFactor - 0.3) * 0.4 * ratio : 0;
            this._tireGain.gain.setTargetAtTime(tireVol, now, 0.03);
        }
    }

    /**
     * Play a collision impact burst
     */
    playCollision() {
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        if (now - this._lastCollisionTime < 0.3) return; // debounce
        this._lastCollisionTime = now;

        const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);

        source.start(now);
    }
}
