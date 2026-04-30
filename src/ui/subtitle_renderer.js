/**
 * Subtitle Renderer — displays dialogue subtitles with toggle, size, and speaker labels.
 * Integrates with TTS service and dialogue system.
 */

import { eventBus, EVENT_TYPES } from '../sim/events.js';

const SIZES = {
    small:  { font: '14px', lineH: '1.2', maxW: '40%' },
    medium: { font: '18px', lineH: '1.4', maxW: '50%' },
    large:  { font: '24px', lineH: '1.5', maxW: '60%' },
};

export class SubtitleRenderer {
    constructor(game) {
        this.game = game;
        this.enabled = true;
        this.size = 'medium';
        this.showSpeakers = true;
        this._container = null;
        this._currentLine = null;
        this._speakerLabel = null;
        this._textEl = null;
        this._fadeTimer = null;
        this._setup();
        this._listen();
    }

    _setup() {
        this._container = document.createElement('div');
        this._container.id = 'subtitle-container';
        this._container.className = 'subtitle-off';
        this._container.innerHTML = `
            <div class="subtitle-speaker" id="subtitle-speaker"></div>
            <div class="subtitle-text" id="subtitle-text"></div>
        `;
        const anchor = document.getElementById('main-area') || document.body;
        anchor.appendChild(this._container);
        this._speakerLabel = this._container.querySelector('#subtitle-speaker');
        this._textEl = this._container.querySelector('#subtitle-text');
        this._applySize();
    }

    _listen() {
        eventBus.on(EVENT_TYPES.CAMPAIGN_DIALOGUE_TRIGGERED, (data) => {
            this.showLine(data.text, data.speaker);
        }, this);

        eventBus.on(EVENT_TYPES.PLAYER_DECISION, (data) => {
            if (data.speaker) {
                this.showLine(data.text, data.speaker);
            }
        }, this);
    }

    showLine(text, speaker) {
        if (!this.enabled || !text) return;
        this._clearFade();
        this._container.classList.remove('subtitle-off');
        this._container.classList.add('subtitle-on');

        if (this.showSpeakers && speaker) {
            this._speakerLabel.textContent = speaker;
            this._speakerLabel.classList.add('speaker-visible');
        } else {
            this._speakerLabel.textContent = '';
            this._speakerLabel.classList.remove('speaker-visible');
        }

        this._textEl.textContent = text;
        this._applySize();
        this._scheduleFade();
    }

    _scheduleFade() {
        this._fadeTimer = setTimeout(() => {
            this._container.classList.add('subtitle-fade');
            setTimeout(() => {
                this._container.classList.remove('subtitle-on', 'subtitle-fade');
                this._container.classList.add('subtitle-off');
            }, 300);
        }, 4000);
    }

    _clearFade() {
        if (this._fadeTimer) {
            clearTimeout(this._fadeTimer);
            this._fadeTimer = null;
        }
    }

    _applySize() {
        const s = SIZES[this.size] || SIZES.medium;
        this._container.style.fontSize = s.font;
        this._container.style.lineHeight = s.lineH;
        this._container.style.maxWidth = s.maxW;
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this._clearFade();
            this._container.classList.remove('subtitle-on', 'subtitle-fade');
            this._container.classList.add('subtitle-off');
        }
    }

    setSize(size) {
        if (SIZES[size]) {
            this.size = size;
            this._applySize();
        }
    }

    toggleSpeakers() {
        this.showSpeakers = !this.showSpeakers;
    }

    render() {
        // Called each frame — no-op, event-driven
    }
}
