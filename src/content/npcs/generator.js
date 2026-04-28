import { NPC_ROLES, PERSONALITIES, MOTIVATIONS } from './schema.js';

const TITLES = {
    corporate: ['CEO', 'CTO', 'Director', 'VP', 'Manager', 'Analyst', 'Consultant'],
    government: ['Mayor', 'Councilor', 'Commissioner', 'Inspector', 'Agent', 'Officer'],
    criminal: ['Boss', 'Enforcer', 'Runner', 'Dealer', 'Hacker', 'Fixer', 'Smuggler'],
    civilian: ['Teacher', 'Doctor', 'Engineer', 'Artist', 'Journalist', 'Student', 'Worker'],
};

const SECRETS = [
    'Embezzles from employer.',
    'Double agent for a rival faction.',
    'Witness to an unsolved crime.',
    'Runs an underground gambling ring.',
    'Has a fake identity.',
    'Hides a criminal record.',
    'Secretly wealthy.',
    'Informant for police.',
];

const FIRST_NAMES = [
    'James', 'Maria', 'Alex', 'Jordan', 'Kai', 'Lena', 'Marco', 'Nina',
    'Omar', 'Priya', 'Sam', 'Tae', 'Victor', 'Zara', 'Chen', 'Devi',
];
const LAST_NAMES = [
    'Smith', 'Garcia', 'Nguyen', 'Patel', 'Kim', 'Silva', 'Müller', 'Sato',
    'Jensen', 'Torres', 'Okafor', 'Volkov', 'Singh', 'Chen', 'Flores', 'Ali',
];

function pickOne(rng, arr) {
    return arr[rng.int(0, arr.length - 1)];
}

function pickOneFromSet(rng, set) {
    const arr = [...set];
    return arr[rng.int(0, arr.length - 1)];
}

export function generateNPCArchetype(rng, opts = {}) {
    const role = opts.role || pickOneFromSet(rng, NPC_ROLES);
    const firstName = pickOne(rng, FIRST_NAMES);
    const lastName = pickOne(rng, LAST_NAMES);
    const num = rng.int(100, 999);

    return {
        id: opts.id || `gen_npc_${role.slice(0, 4)}_${num}`,
        name: `${firstName} ${lastName}`,
        role,
        title: pickOne(rng, TITLES[role] || TITLES.civilian),
        personality: pickOneFromSet(rng, PERSONALITIES),
        motivation: pickOneFromSet(rng, MOTIVATIONS),
        age: rng.int(22, 65),
        income: rng.int(20, 200) * 100,
        secret: pickOne(rng, SECRETS),
        schedule: {
            night: 'home',
            morning: 'work',
            day: 'work',
            evening: 'leisure',
            dusk: 'home',
        },
    };
}

export function generateBatch(rng, count, opts = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(generateNPCArchetype(rng, opts));
    }
    return results;
}
