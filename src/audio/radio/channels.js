/**
 * Radio channel definitions.  Three channels, three moods, three
 * audiences.  Frequencies are flavor text — the in-car tuner UI
 * (q7-rd-vehicle-radio) renders them, the music pool (q7-rd-music-pool)
 * fills the playlist, the DJ banter system (q7-rd-dj-banter-template)
 * fills the talk slots.
 *
 * Mood drives:
 *   - which procedural-music palette the channel pulls from
 *   - which DJ banter template tone it requests
 *   - the tint of the in-car tuner UI
 */

function deepFreeze(o) {
    Object.freeze(o);
    for (const k of Object.keys(o)) {
        if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]);
    }
    return o;
}

export const RADIO_CHANNELS = deepFreeze([
    {
        id: 'static_fm',
        name: 'Static FM',
        frequencyKHz: 88300,
        mood: 'talk',
        palette: 'news_jazz',
        djArchetype: 'narrator',
        color: '#d2b48c',
        description: 'Late-night talk, mellow jazz between segments. The city explains itself.',
    },
    {
        id: 'neon_105',
        name: 'Neon 105',
        frequencyKHz: 104900,
        mood: 'synthwave',
        palette: 'synthwave',
        djArchetype: 'rival',
        color: '#ff3aa8',
        description: 'Synthwave, retro-future pop. The skyline\'s heartbeat.',
    },
    {
        id: 'pirate_wave',
        name: 'Pirate Wave',
        frequencyKHz: 97700,
        mood: 'underground',
        palette: 'industrial_punk',
        djArchetype: 'fixer',
        color: '#4cffb1',
        description: 'Off-grid, anti-corp. Plays what the licensing boards killed.',
    },
]);

export const CHANNEL_IDS = Object.freeze(RADIO_CHANNELS.map(c => c.id));

export function getChannel(id) {
    return RADIO_CHANNELS.find(c => c.id === id) ?? null;
}

export function channelByFrequency(kHz) {
    if (typeof kHz !== 'number') return null;
    let best = null;
    let bestDelta = Infinity;
    for (const c of RADIO_CHANNELS) {
        const d = Math.abs(c.frequencyKHz - kHz);
        if (d < bestDelta) { bestDelta = d; best = c; }
    }
    return best;
}
