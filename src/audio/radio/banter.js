/**
 * DJ Banter — short between-song lines a channel's host says.
 *
 * Templates contain `{slot}` placeholders that the renderer fills
 * from a context object: { channelName, frequency, timeOfDay, weather,
 * songTitle, eventSummary }.  Unknown slots fall back to a sensible
 * default rather than leaking the raw `{token}` to a player.
 *
 * Templates are bucketed by mood (matching radio channels) and by
 * kind (intro, outro, weather, time, event).  The renderer takes an
 * RNG stream so banter selection stays deterministic across saves.
 */

import { CHANNEL_IDS, getChannel } from './channels.js';

const SLOT_RE = /\{(\w+)\}/g;

const SLOT_FALLBACK = {
    channelName: 'this station',
    frequency: 'the dial',
    timeOfDay: 'right about now',
    weather: 'out there',
    songTitle: 'that one',
    eventSummary: 'the usual',
};

const TEMPLATES = {
    talk: {
        intro: [
            'Welcome back to {channelName}, {timeOfDay} on the dial.',
            'You are listening to {channelName} — {frequency} kHz, the city\'s long memory.',
            'This is {channelName}. Pour something warm.',
        ],
        outro: [
            'That was {songTitle}. We will sit with it for a moment.',
            'A note to close on, before the news.',
            'Brief pause. Stay with us.',
        ],
        weather: [
            'It\'s {weather} out there. Drive like you mean it.',
            'The sky is {weather}. Wear something honest.',
        ],
        time: [
            '{timeOfDay} — and the city is paying attention.',
            'It is {timeOfDay}. The streets are listening.',
        ],
        event: [
            'Word from the wire: {eventSummary}.',
            'Something the council won\'t say out loud — {eventSummary}.',
        ],
    },
    synthwave: {
        intro: [
            'Neon\'s back on. {channelName}, hold the line.',
            'You\'re locked into {channelName} at {frequency}. Keep it loud.',
            '{channelName}. Heart-rate audio for {timeOfDay}.',
        ],
        outro: [
            '{songTitle}. Crank it again later — promise.',
            'That one was a kick. More incoming.',
            'Don\'t let go yet. We\'re only halfway in.',
        ],
        weather: [
            '{weather} skies and we\'re not slowing down.',
            'Could be {weather} — looks like a soundtrack to me.',
        ],
        time: [
            'Past {timeOfDay} and the city is awake.',
            '{timeOfDay}. Best hour on the grid.',
        ],
        event: [
            'Bulletin says: {eventSummary}. We say: louder.',
            'Heard about it, played through it: {eventSummary}.',
        ],
    },
    underground: {
        intro: [
            'Pirate Wave hijacking {frequency} again. They\'ll catch us when we\'re bored.',
            'You found us. {channelName}. Don\'t tell the corps.',
            'Off the books, off the record. {channelName}.',
        ],
        outro: [
            '{songTitle} — banned in three districts, played here.',
            'They tried to mute that one. We turned it up.',
            'Track ends. Truth doesn\'t.',
        ],
        weather: [
            'Sky\'s {weather}. Pretend you didn\'t notice.',
            '{weather} weather — perfect for getting lost on purpose.',
        ],
        time: [
            'It\'s {timeOfDay}. Curfew\'s a suggestion.',
            'Past {timeOfDay} — they\'re watching, but they\'re tired.',
        ],
        event: [
            'They\'re calling it nothing. We\'re calling it: {eventSummary}.',
            'Mainstream feeds skipped this — {eventSummary}. We didn\'t.',
        ],
    },
};

export const BANTER_KINDS = ['intro', 'outro', 'weather', 'time', 'event'];

function fill(template, ctx) {
    return template.replace(SLOT_RE, (full, key) => {
        const v = ctx[key];
        if (typeof v === 'string' && v.length > 0) return v;
        if (typeof v === 'number') return String(v);
        return SLOT_FALLBACK[key] ?? full;
    });
}

export function listMoods() {
    return Object.keys(TEMPLATES);
}

export function getTemplates(mood, kind) {
    const m = TEMPLATES[mood];
    if (!m) return [];
    return m[kind] ?? [];
}

export function pickBanter(rng, mood, kind, ctx = {}) {
    const pool = getTemplates(mood, kind);
    if (pool.length === 0) return null;
    const idx = Math.floor(rng.next() * pool.length);
    return fill(pool[idx], ctx);
}

export function pickBanterForChannel(rng, channelId, kind, ctx = {}) {
    const ch = getChannel(channelId);
    if (!ch) return null;
    const enriched = {
        channelName: ch.name,
        frequency: (ch.frequencyKHz / 1000).toFixed(1),
        ...ctx,
    };
    return pickBanter(rng, ch.mood, kind, enriched);
}

export function templateCountByMood() {
    const out = {};
    for (const mood of Object.keys(TEMPLATES)) {
        let n = 0;
        for (const kind of BANTER_KINDS) n += getTemplates(mood, kind).length;
        out[mood] = n;
    }
    return out;
}

export const RADIO_MOODS = Object.freeze(Object.keys(TEMPLATES));

export function _allTemplates() {
    const all = [];
    for (const mood of Object.keys(TEMPLATES)) {
        for (const kind of BANTER_KINDS) {
            for (const t of getTemplates(mood, kind)) {
                all.push({ mood, kind, template: t });
            }
        }
    }
    return all;
}

// Sanity: every channel id has a mood with templates.
for (const id of CHANNEL_IDS) {
    const ch = getChannel(id);
    if (!TEMPLATES[ch.mood]) {
        throw new Error(`Radio channel '${id}' has mood '${ch.mood}' with no banter templates`);
    }
}
