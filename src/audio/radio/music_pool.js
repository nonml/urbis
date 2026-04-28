/**
 * Radio Music Pool — track entries for each channel palette.
 *
 * Two source types:
 *
 *   'procedural'  — generated at runtime by the existing procedural-
 *                   music engine (Tone.js).  Cheap, infinite variety,
 *                   shipped today.  proceduralParams describes scale,
 *                   tempo, density.
 *
 *   'asset'       — a free-licence audio file dropped into
 *                   assets/audio/radio/.  Empty `assetUrl` means the
 *                   slot is reserved but the file hasn't been added
 *                   yet; the pool skips empty slots so it never plays
 *                   silence.
 *
 * Tracks belong to a palette (`news_jazz`, `synthwave`,
 * `industrial_punk`).  Channels reference their palette via
 * channels.js.  Pool selection is deterministic via the rng stream
 * caller passes in.
 */

import { CHANNEL_IDS, getChannel } from './channels.js';

function freeze(arr) { return Object.freeze(arr.map(t => Object.freeze({ ...t }))); }

const PROCEDURAL_TRACKS = freeze([
    {
        id: 'jazz_late_corner',
        palette: 'news_jazz',
        source: 'procedural',
        title: 'Late Corner',
        proceduralParams: { scale: 'dorian', bpm: 78, density: 0.4, mood: 'mellow' },
        durationSec: 180,
    },
    {
        id: 'jazz_blue_window',
        palette: 'news_jazz',
        source: 'procedural',
        title: 'Blue Window',
        proceduralParams: { scale: 'dorian', bpm: 92, density: 0.5, mood: 'mellow' },
        durationSec: 165,
    },
    {
        id: 'jazz_long_walk',
        palette: 'news_jazz',
        source: 'procedural',
        title: 'Long Walk Home',
        proceduralParams: { scale: 'minor', bpm: 70, density: 0.35, mood: 'wistful' },
        durationSec: 200,
    },
    {
        id: 'syn_neon_arteries',
        palette: 'synthwave',
        source: 'procedural',
        title: 'Neon Arteries',
        proceduralParams: { scale: 'minor', bpm: 116, density: 0.7, mood: 'driving' },
        durationSec: 220,
    },
    {
        id: 'syn_chrome_pulse',
        palette: 'synthwave',
        source: 'procedural',
        title: 'Chrome Pulse',
        proceduralParams: { scale: 'minor', bpm: 124, density: 0.75, mood: 'driving' },
        durationSec: 200,
    },
    {
        id: 'syn_skyline_run',
        palette: 'synthwave',
        source: 'procedural',
        title: 'Skyline Run',
        proceduralParams: { scale: 'major', bpm: 132, density: 0.8, mood: 'euphoric' },
        durationSec: 240,
    },
    {
        id: 'pnk_signal_jam',
        palette: 'industrial_punk',
        source: 'procedural',
        title: 'Signal Jam',
        proceduralParams: { scale: 'phrygian', bpm: 140, density: 0.85, mood: 'aggressive' },
        durationSec: 180,
    },
    {
        id: 'pnk_blackout',
        palette: 'industrial_punk',
        source: 'procedural',
        title: 'Blackout',
        proceduralParams: { scale: 'phrygian', bpm: 152, density: 0.9, mood: 'aggressive' },
        durationSec: 165,
    },
    {
        id: 'pnk_grid_kill',
        palette: 'industrial_punk',
        source: 'procedural',
        title: 'Grid Kill',
        proceduralParams: { scale: 'phrygian', bpm: 168, density: 0.95, mood: 'aggressive' },
        durationSec: 145,
    },
]);

const FREE_LICENCE_SLOTS = freeze([
    {
        id: 'free_jazz_1', palette: 'news_jazz', source: 'asset', title: 'reserved',
        assetUrl: '', attribution: 'TBD: CC0 jazz piece, attribution required if added',
    },
    {
        id: 'free_syn_1', palette: 'synthwave', source: 'asset', title: 'reserved',
        assetUrl: '', attribution: 'TBD: CC0 synthwave piece, attribution required if added',
    },
    {
        id: 'free_pnk_1', palette: 'industrial_punk', source: 'asset', title: 'reserved',
        assetUrl: '', attribution: 'TBD: CC0 industrial piece, attribution required if added',
    },
]);

export const MUSIC_TRACKS = Object.freeze([...PROCEDURAL_TRACKS, ...FREE_LICENCE_SLOTS]);

export const MUSIC_PALETTES = Object.freeze(['news_jazz', 'synthwave', 'industrial_punk']);

function isPlayable(track) {
    if (track.source === 'procedural') return true;
    if (track.source === 'asset') return typeof track.assetUrl === 'string' && track.assetUrl.length > 0;
    return false;
}

export function tracksForPalette(palette) {
    return MUSIC_TRACKS.filter(t => t.palette === palette);
}

export function playableTracksForPalette(palette) {
    return tracksForPalette(palette).filter(isPlayable);
}

export class MusicPool {
    constructor(rng) {
        if (!rng || typeof rng.next !== 'function') {
            throw new Error('MusicPool requires an RNG with next()');
        }
        this.rng = rng;
        this._lastByPalette = new Map();
    }

    pick(palette) {
        const playable = playableTracksForPalette(palette);
        if (playable.length === 0) return null;
        const lastId = this._lastByPalette.get(palette);
        const candidates = playable.length > 1
            ? playable.filter(t => t.id !== lastId)
            : playable;
        const idx = Math.floor(this.rng.next() * candidates.length);
        const pick = candidates[idx];
        this._lastByPalette.set(palette, pick.id);
        return pick;
    }

    pickForChannel(channelId) {
        const ch = getChannel(channelId);
        if (!ch) return null;
        return this.pick(ch.palette);
    }
}

// Sanity: every channel's palette has at least one playable track.
for (const id of CHANNEL_IDS) {
    const ch = getChannel(id);
    if (playableTracksForPalette(ch.palette).length === 0) {
        throw new Error(`Channel '${id}' palette '${ch.palette}' has no playable tracks`);
    }
}
