const QUEST_TYPES = ['casefile', 'storylet', 'subcase'];

const THEMES = [
    { tag: 'missing', title: 'Missing Person', desc: 'A citizen vanished from' },
    { tag: 'corruption', title: 'Corruption Trail', desc: 'Suspicious activity at' },
    { tag: 'extortion', title: 'Extortion Scheme', desc: 'Someone is shaking down' },
    { tag: 'smuggling', title: 'Smuggling Ring', desc: 'Contraband moving through' },
    { tag: 'sabotage', title: 'Infrastructure Sabotage', desc: 'Systems failing at' },
    { tag: 'gang', title: 'Gang Turf War', desc: 'Tensions rising in' },
    { tag: 'heist', title: 'The Heist', desc: 'A break-in planned at' },
    { tag: 'blackmail', title: 'Blackmail Plot', desc: 'Someone has leverage on' },
];

const DISTRICTS = ['downtown', 'waterfront', 'industrial', 'suburbs', 'old-town'];

const STEP_PATTERNS = [
    [
        { kind: 'trigger', text: 'Report received — investigate the area.' },
        { kind: 'go_to', text: 'Head to the location.', targetX: 50, targetY: 50 },
        { kind: 'investigate', text: 'Search for evidence.' },
        { kind: 'outcome', text: 'Case resolved.' },
    ],
    [
        { kind: 'trigger', text: 'An informant reaches out.' },
        { kind: 'hack_node', text: 'Hack a terminal to get intel.' },
        { kind: 'go_to', text: 'Meet the contact.', targetX: 30, targetY: 40 },
        { kind: 'choice', text: 'Decide what to do.', choices: [
            { id: 'confront', label: 'Confront directly' },
            { id: 'stealth', label: 'Approach stealthily' },
        ]},
        { kind: 'outcome', text: 'Situation resolved.' },
    ],
    [
        { kind: 'trigger', text: 'Strange signals detected.' },
        { kind: 'interact', text: 'Talk to a local witness.' },
        { kind: 'go_to', text: 'Follow the lead.', targetX: 60, targetY: 35 },
        { kind: 'investigate', text: 'Examine the scene.' },
        { kind: 'spawn_clue', text: 'A key clue emerges.' },
        { kind: 'outcome', text: 'Mystery solved.' },
    ],
];

const REWARD_POOL = [
    { type: 'add_resource', resource: 'gold', amount: 50 },
    { type: 'add_resource', resource: 'gold', amount: 100 },
    { type: 'modify_heat', delta: -10 },
    { type: 'rep_delta', faction: 'citizens', delta: 5 },
    { type: 'set_flag', flag: 'quest_complete', value: true },
];

function pickOne(rng, arr) {
    return arr[rng.int(0, arr.length - 1)];
}

export function generateQuest(rng, opts = {}) {
    const theme = opts.theme
        ? THEMES.find(t => t.tag === opts.theme) || pickOne(rng, THEMES)
        : pickOne(rng, THEMES);

    const district = pickOne(rng, DISTRICTS);
    const num = rng.int(100, 999);
    const id = opts.id || `gen_${theme.tag}_${num}`;
    const qType = opts.type || pickOne(rng, QUEST_TYPES);

    const pattern = pickOne(rng, STEP_PATTERNS);
    const steps = pattern.map((s, i) => ({
        ...s,
        id: `${id}_step_${i}`,
    }));

    const rewardCount = rng.int(1, 3);
    const rewards = [];
    for (let i = 0; i < rewardCount; i++) {
        rewards.push({ ...pickOne(rng, REWARD_POOL) });
    }

    return {
        id,
        type: qType,
        title: `${theme.title} #${num}`,
        description: `${theme.desc} the ${district} district.`,
        tags: [theme.tag, district, 'generated'],
        steps,
        rewards,
    };
}

export function generateBatch(rng, count, opts = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(generateQuest(rng, opts));
    }
    return results;
}
