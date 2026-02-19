import { RNG } from '../../rng.js';

function normalizeType(type) {
    if (type === 'missing') return 'missing_person';
    if (type === 'gang') return 'extortion';
    return type;
}

function pickDistrictByTheme(map, theme, rng) {
    const districts = map?.districts || [];
    const byTheme = districts.filter((d) => d.theme === theme);
    const pool = byTheme.length > 0 ? byTheme : districts;
    if (pool.length === 0) return { id: 0, center: { x: 0, y: 0 }, theme: 'residential' };
    return pool[rng.int(0, pool.length - 1)];
}

function pickSuspects(citizens, rng, count = 3) {
    const sorted = [...(citizens || [])].sort((a, b) => a.id - b.id);
    if (sorted.length === 0) return [];
    const suspects = [];
    const used = new Set();
    while (suspects.length < Math.min(count, sorted.length)) {
        const idx = rng.int(0, sorted.length - 1);
        if (used.has(idx)) continue;
        used.add(idx);
        const c = sorted[idx];
        suspects.push({
            id: `suspect_${c.id}`,
            citizenId: c.id,
            name: `Citizen #${c.id}`,
            risk: Math.max(1, Math.min(5, Math.round((100 - (c.happiness || 50)) / 20) + 1)),
        });
    }
    return suspects;
}

function missingPersonChapters(base) {
    return [
        {
            id: `${base.id}_ch1`,
            title: 'Last Seen',
            steps: [
                { id: 'start', kind: 'trigger', trigger: 'missing_person', text: 'Missing report filed.' },
                { id: 'hack_cctv', kind: 'hack_node', nodeType: 'CCTV_POLE', text: 'Hack CCTV for last-seen trace.', onComplete: ['spawn_clue:last_seen_clip'] },
                { id: 'go_site', kind: 'go_to', targetX: base.targetX, targetY: base.targetY, text: 'Go to the last-seen location.' },
                { id: 'outcome', kind: 'outcome', outcomes: [{ id: 'chapter_done', effect: ['district_stability_up'] }] },
            ],
        },
        {
            id: `${base.id}_ch2`,
            title: 'Lead Decision',
            steps: [
                {
                    id: 'approach_choice',
                    kind: 'choice',
                    text: 'How will you pursue the lead?',
                    choices: [
                        { id: 'network_sweep', label: 'Network sweep', runFlags: { case_path: 'network' }, heatDelta: 4, nextStep: 'branch' },
                        { id: 'witness_route', label: 'Witness interviews', runFlags: { case_path: 'witness' }, reputationDelta: 3, nextStep: 'branch' },
                    ],
                },
                {
                    id: 'branch',
                    kind: 'conditional',
                    condition: { type: 'run_flag', key: 'case_path', equals: 'network' },
                    thenStep: 'network_outcome',
                    elseStep: 'witness_outcome',
                },
                { id: 'network_outcome', kind: 'outcome', outcomes: [{ id: 'network_done', effect: ['spawn_clue:network_dump'] }] },
                { id: 'witness_outcome', kind: 'outcome', outcomes: [{ id: 'witness_done', effect: ['spawn_clue:witness_statement'] }] },
            ],
        },
        {
            id: `${base.id}_ch3`,
            title: 'Resolution',
            steps: [
                { id: 'investigate', kind: 'investigate', requiresEvidenceId: 'network_dump', text: 'Verify the final location with collected evidence.' },
                { id: 'resolve', kind: 'outcome', outcomes: [{ id: 'resolved', effect: ['reputation_high', 'district_security_up'] }] },
            ],
            rewards: [
                { type: 'add_resource', resource: 'gold', amount: 30 },
                { type: 'unlock_hack', hackId: 'camera_takeover' },
            ],
        },
    ];
}

function corruptionChapters(base) {
    return [
        {
            id: `${base.id}_ch1`,
            title: 'Paper Trail',
            steps: [
                { id: 'start', kind: 'trigger', trigger: 'blackmail', text: 'Corruption anomaly detected.' },
                { id: 'hack_telecom', kind: 'hack_node', nodeType: 'TELECOM_BOX', text: 'Hack telecom records.', onComplete: ['spawn_clue:money_trail'] },
                { id: 'goto', kind: 'go_to', targetX: base.targetX, targetY: base.targetY, text: 'Investigate financial hub.' },
                { id: 'done', kind: 'outcome', outcomes: [{ id: 'chapter_done', effect: ['district_corruption_down'] }] },
            ],
        },
        {
            id: `${base.id}_ch2`,
            title: 'Pressure Point',
            steps: [
                {
                    id: 'choice',
                    kind: 'choice',
                    text: 'Choose your pressure strategy.',
                    choices: [
                        { id: 'public', label: 'Public exposure', runFlags: { case_path: 'public' }, reputationDelta: 5, nextStep: 'branch' },
                        { id: 'private', label: 'Private coercion', runFlags: { case_path: 'private' }, heatDelta: 6, nextStep: 'branch' },
                    ],
                },
                {
                    id: 'branch',
                    kind: 'conditional',
                    condition: { type: 'run_flag', key: 'case_path', equals: 'public' },
                    thenStep: 'public_outcome',
                    elseStep: 'private_outcome',
                },
                { id: 'public_outcome', kind: 'outcome', outcomes: [{ id: 'public_done', effect: ['district_transparency_up'] }] },
                { id: 'private_outcome', kind: 'outcome', outcomes: [{ id: 'private_done', effect: ['heat_rival_high'] }] },
            ],
        },
        {
            id: `${base.id}_ch3`,
            title: 'Conviction',
            steps: [
                { id: 'investigate', kind: 'investigate', requiresEvidenceId: 'money_trail', text: 'Finalize the case package.' },
                { id: 'resolve', kind: 'outcome', outcomes: [{ id: 'resolved', effect: ['reputation_high'] }] },
            ],
            rewards: [
                { type: 'add_resource', resource: 'gold', amount: 45 },
                { type: 'unlock_building', buildingId: 'propaganda-office' },
            ],
        },
    ];
}

function extortionChapters(base) {
    return [
        {
            id: `${base.id}_ch1`,
            title: 'Shakedown Route',
            steps: [
                { id: 'start', kind: 'trigger', trigger: 'workplace_conflict', text: 'Businesses report extortion pressure.' },
                { id: 'talk', kind: 'interact', interactType: 'citizen', text: 'Speak with local witness.', onComplete: ['spawn_clue:shakedown_note'] },
                { id: 'goto', kind: 'go_to', targetX: base.targetX, targetY: base.targetY, text: 'Track extortion route.' },
                { id: 'done', kind: 'outcome', outcomes: [{ id: 'chapter_done', effect: ['district_order_up'] }] },
            ],
        },
        {
            id: `${base.id}_ch2`,
            title: 'Counter Move',
            steps: [
                {
                    id: 'choice',
                    kind: 'choice',
                    text: 'How do you disrupt the ring?',
                    choices: [
                        { id: 'raid', label: 'Coordinated raid', runFlags: { case_path: 'raid' }, heatDelta: 5, nextStep: 'branch' },
                        { id: 'flip', label: 'Flip lieutenant', runFlags: { case_path: 'flip' }, reputationDelta: 4, nextStep: 'branch' },
                    ],
                },
                {
                    id: 'branch',
                    kind: 'conditional',
                    condition: { type: 'run_flag', key: 'case_path', equals: 'flip' },
                    thenStep: 'flip_outcome',
                    elseStep: 'raid_outcome',
                },
                { id: 'flip_outcome', kind: 'outcome', outcomes: [{ id: 'flip_done', effect: ['spawn_clue:inside_manifest'] }] },
                { id: 'raid_outcome', kind: 'outcome', outcomes: [{ id: 'raid_done', effect: ['spawn_clue:seized_ledger'] }] },
            ],
        },
        {
            id: `${base.id}_ch3`,
            title: 'Wrap-up',
            steps: [
                { id: 'investigate', kind: 'investigate', requiresEvidenceId: 'inside_manifest', text: 'Build final extortion case from evidence.' },
                { id: 'resolve', kind: 'outcome', outcomes: [{ id: 'resolved', effect: ['district_crime_down', 'reputation_high'] }] },
            ],
            rewards: [
                { type: 'add_resource', resource: 'gold', amount: 35 },
                { type: 'unlock_building', buildingId: 'cctv-network' },
            ],
        },
    ];
}

export class CaseAssembler {
    constructor(game) {
        this.game = game;
    }

    assemble(type, options = {}) {
        const caseType = normalizeType(type);
        const seed = (options.seed ?? 1) >>> 0;
        const rng = new RNG(seed || 1);
        const themeByType = {
            missing_person: 'residential',
            corruption: 'commercial',
            extortion: 'industrial',
        };
        const district = pickDistrictByTheme(this.game.map, themeByType[caseType] || 'residential', rng);
        const targetX = district.center?.x ?? 0;
        const targetY = district.center?.y ?? 0;
        const base = `${caseType}_${seed}`;

        const suspects = pickSuspects(this.game.citizens.citizens, rng, 3);
        const leads = [
            { id: `${base}_lead_1`, label: 'Digital trace', status: 'open' },
            { id: `${base}_lead_2`, label: 'Witness account', status: 'open' },
            { id: `${base}_lead_3`, label: 'Physical site check', status: 'open' },
        ];

        let chapters = [];
        if (caseType === 'missing_person') chapters = missingPersonChapters({ id: base, targetX, targetY });
        else if (caseType === 'corruption') chapters = corruptionChapters({ id: base, targetX, targetY });
        else chapters = extortionChapters({ id: base, targetX, targetY });

        return {
            id: `${caseType}_${seed}`,
            type: caseType,
            districtId: district.id ?? 0,
            difficulty: 2 + rng.int(0, 2),
            suspects,
            evidence: [],
            leads,
            chapters,
            caseSeed: seed,
            currentChapter: 0,
            status: 'active',
            createdAt: Date.now(),
            questIds: [],
        };
    }
}
