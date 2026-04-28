/**
 * Radio Manager — owns the currently-tuned channel and steps between
 * them.  Pure logic: the in-car UI and audio playback layers consume
 * `currentChannel()`.
 *
 * `off` is a real state — players can turn the radio off without
 * losing their last station; `tune(lastChannelId)` brings it back.
 */

import { RADIO_CHANNELS, CHANNEL_IDS, getChannel } from './channels.js';

export class RadioManager {
    constructor(opts = {}) {
        this._channelIdx = -1;
        this._lastIdx = 0;
        if (opts.initial) this.tune(opts.initial);
    }

    tune(channelId) {
        if (channelId === null || channelId === 'off') {
            this._channelIdx = -1;
            return null;
        }
        const idx = CHANNEL_IDS.indexOf(channelId);
        if (idx < 0) return null;
        this._channelIdx = idx;
        this._lastIdx = idx;
        return RADIO_CHANNELS[idx];
    }

    next() {
        if (this._channelIdx < 0) {
            this._channelIdx = this._lastIdx;
        } else {
            this._channelIdx = (this._channelIdx + 1) % RADIO_CHANNELS.length;
            this._lastIdx = this._channelIdx;
        }
        return RADIO_CHANNELS[this._channelIdx];
    }

    previous() {
        if (this._channelIdx < 0) {
            this._channelIdx = this._lastIdx;
        } else {
            this._channelIdx = (this._channelIdx - 1 + RADIO_CHANNELS.length) % RADIO_CHANNELS.length;
            this._lastIdx = this._channelIdx;
        }
        return RADIO_CHANNELS[this._channelIdx];
    }

    turnOff() { this._channelIdx = -1; }

    isOn() { return this._channelIdx >= 0; }

    currentChannel() {
        return this._channelIdx >= 0 ? RADIO_CHANNELS[this._channelIdx] : null;
    }

    serialize() {
        return {
            currentId: this.currentChannel()?.id ?? null,
            lastId: RADIO_CHANNELS[this._lastIdx]?.id ?? null,
        };
    }

    deserialize(state) {
        if (!state) return;
        if (state.lastId) {
            const idx = CHANNEL_IDS.indexOf(state.lastId);
            if (idx >= 0) this._lastIdx = idx;
        }
        if (state.currentId) {
            this.tune(state.currentId);
        } else {
            this._channelIdx = -1;
        }
    }
}

export { RADIO_CHANNELS, getChannel };
