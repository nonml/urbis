/**
 * Voice Bank — 6 archetype voices for the game's cast.
 *
 * Each archetype maps to a specific Piper voice id and a mood
 * descriptor.  Mission writers and NPC archetype authors reference
 * the archetype id, not the raw voice id, so we can swap voices
 * later without touching content.
 *
 * Voice ids match piper-tts-web's catalog (see types.d.ts in the
 * package).  All chosen voices are public-domain Piper models that
 * download from HuggingFace on first use.
 */

function deepFreeze(o) {
    Object.freeze(o);
    for (const k of Object.keys(o)) {
        if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]);
    }
    return o;
}

export const VOICE_BANK = deepFreeze({
    fixer: {
        voiceId: 'en_US-ryan-medium',
        mood: 'gravelly',
        gender: 'male',
        language: 'en_US',
        description: 'Mid-aged handler, runs the player\'s jobs.',
    },
    operator: {
        voiceId: 'en_US-amy-medium',
        mood: 'calm',
        gender: 'female',
        language: 'en_US',
        description: 'Info-broker on comms, cool and precise.',
    },
    enforcer: {
        voiceId: 'en_GB-alan-medium',
        mood: 'authoritative',
        gender: 'male',
        language: 'en_GB',
        description: 'Police / corp-security, uniformed authority.',
    },
    civilian: {
        voiceId: 'en_US-hfc_female-medium',
        mood: 'warm',
        gender: 'female',
        language: 'en_US',
        description: 'Everyday NPC: shopkeepers, witnesses, bystanders.',
    },
    rival: {
        voiceId: 'en_GB-cori-medium',
        mood: 'smug',
        gender: 'female',
        language: 'en_GB',
        description: 'Charismatic antagonist, light and dangerous.',
    },
    narrator: {
        voiceId: 'en_US-lessac-medium',
        mood: 'neutral',
        gender: 'neutral',
        language: 'en_US',
        description: 'Tutorials, cutscene voice-over, codex entries.',
    },
});

export const ARCHETYPE_IDS = Object.freeze(Object.keys(VOICE_BANK));

export const DEFAULT_ARCHETYPE = 'narrator';

export function getArchetypeVoice(archetypeId) {
    return VOICE_BANK[archetypeId] ?? null;
}

export function resolveVoiceId(archetypeId) {
    const v = VOICE_BANK[archetypeId];
    if (v) return v.voiceId;
    return VOICE_BANK[DEFAULT_ARCHETYPE].voiceId;
}

export function listArchetypes() {
    return ARCHETYPE_IDS.map(id => ({ id, ...VOICE_BANK[id] }));
}
