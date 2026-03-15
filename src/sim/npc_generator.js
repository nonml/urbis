// NPC Generator - Procedural NPC names, faces, and backstories
// Creates persistent NPCs that appear across narrative events

import { RNG } from '../rng.js';

// Name components for procedural generation
const FIRST_NAMES = {
    male: ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
           'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
           'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan'],
    female: ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
             'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
             'Dorothy', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia'],
    neutral: ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Dakota', 'Reese']
};

const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
                    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
                    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
                    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'];

const TITLES = {
    corporate: ['CEO', 'CTO', 'Director', 'VP', 'Manager', 'Executive', 'Analyst', 'Consultant', 'Advisor', 'Partner'],
    government: ['Mayor', 'Councilor', 'Commissioner', 'Director', 'Chief', 'Officer', 'Agent', 'Inspector', 'Sheriff', 'Deputy'],
    criminal: ['Boss', 'Enforcer', 'Runner', 'Dealer', 'Thief', 'Hacker', 'Informant', 'Fixer', 'Smuggler', 'Hitman'],
    civilian: ['Teacher', 'Doctor', 'Nurse', 'Engineer', 'Artist', 'Writer', 'Journalist', 'Student', 'Retiree', 'Worker']
};

const PERSONALITIES = [
    'ambitious', 'corrupt', 'honest', 'greedy', 'altruistic', 'paranoid', 'charismatic', 'intimidating',
    'mysterious', 'friendly', 'hostile', 'neutral', 'deceptive', 'loyal', 'treacherous'
];

const MOTIVATIONS = [
    'power', 'wealth', 'revenge', 'justice', 'survival', 'fame', 'knowledge', 'control',
    'protection', 'freedom', 'reputation', 'legacy', 'greed', 'ideology'
];

// Face descriptors for visual representation (can be used with procedural sprites)
const FACE_TYPES = ['round', 'oval', 'square', 'heart', 'diamond', 'long', 'triangular'];
const EYE_COLORS = ['brown', 'blue', 'green', 'hazel', 'gray', 'amber', 'dark'];
const HAIR_COLORS = ['black', 'brown', 'blonde', 'red', 'gray', 'bald'];
const HAIR_STYLES = ['short', 'long', 'medium', 'curly', 'straight', 'wavy', 'buzz', 'ponytail'];
const AGE_RANGES = ['young_adult', 'adult', 'middle_aged', 'elderly'];

export class NPCGenerator {
    constructor(seed) {
        this.rng = seed instanceof RNG ? seed : new RNG(seed);
        this.generatedNPCs = new Map(); // Cache to ensure consistency
        this.npcCounter = 0;
    }

    /**
     * Generate a unique NPC ID
     */
    _generateID() {
        return `npc-${this.rng.int(100000, 999999)}`;
    }

    /**
     * Generate a random first name
     * @param {string} gender - 'male', 'female', or 'neutral'
     * @returns {string} First name
     */
    _generateFirstName(gender = null) {
        if (gender === 'male') return this.rng.pick(FIRST_NAMES.male);
        if (gender === 'female') return this.rng.pick(FIRST_NAMES.female);
        if (gender === 'neutral') return this.rng.pick(FIRST_NAMES.neutral);
        
        // Random gender selection
        const roll = this.rng.float(0, 1);
        if (roll < 0.48) return this.rng.pick(FIRST_NAMES.male);
        if (roll < 0.96) return this.rng.pick(FIRST_NAMES.female);
        return this.rng.pick(FIRST_NAMES.neutral);
    }

    /**
     * Generate a random last name
     * @returns {string} Last name
     */
    _generateLastName() {
        return this.rng.pick(LAST_NAMES);
    }

    /**
     * Generate a full name
     * @param {string} gender - Optional gender preference
     * @returns {string} Full name
     */
    generateName(gender = null) {
        return `${this._generateFirstName(gender)} ${this._generateLastName()}`;
    }

    /**
     * Generate a title based on faction
     * @param {string} faction - 'corporate', 'government', 'criminal', or 'civilian'
     * @returns {string} Title
     */
    generateTitle(faction) {
        const titles = TITLES[faction] || TITLES.civilian;
        return this.rng.pick(titles);
    }

    /**
     * Generate a complete NPC profile
     * @param {Object} options - Generation options
     * @returns {Object} NPC profile
     */
    generateNPC(options = {}) {
        const {
            faction = this.rng.pick(['corporate', 'government', 'criminal', 'civilian']),
            gender = null,
            importance = 'minor' // minor, moderate, major, key
        } = options;

        const id = this._generateID();
        
        // Generate basic info
        const firstName = this._generateFirstName(gender);
        const lastName = this._generateLastName();
        const fullName = `${firstName} ${lastName}`;
        const title = this.generateTitle(faction);
        
        // Generate physical description
        const ageRange = this.rng.pick(AGE_RANGES);
        const faceType = this.rng.pick(FACE_TYPES);
        const eyeColor = this.rng.pick(EYE_COLORS);
        const hairColor = this.rng.pick(HAIR_COLORS);
        const hairStyle = hairColor === 'bald' ? 'bald' : this.rng.pick(HAIR_STYLES);
        
        // Generate personality and motivation
        const personality = this.rng.pick(PERSONALITIES);
        const motivation = this.rng.pick(MOTIVATIONS);
        
        // Generate backstory based on faction and importance
        const backstory = this._generateBackstory(faction, importance, personality, motivation);
        
        // Generate relationships (for key NPCs)
        const relationships = importance === 'key' ? this._generateRelationships() : [];
        
        const npc = {
            id,
            firstName,
            lastName,
            fullName,
            title,
            faction,
            gender: gender || (firstName === firstName.toLowerCase() ? 'neutral' : (firstName === firstName.toUpperCase() ? 'male' : 'female')),
            ageRange,
            physical: {
                faceType,
                eyeColor,
                hairColor,
                hairStyle
            },
            personality,
            motivation,
            backstory,
            relationships,
            importance,
            firstMentionTick: 0,
            lastSeenTick: 0,
            alive: true,
            reputation: 0, // -100 to 100
            location: null, // District ID or building ID
            involvedCases: [], // Case IDs this NPC is involved in
            involvedQuests: [], // Quest IDs
            dialogueHistory: [] // Brief notes on interactions
        };

        // Cache the NPC
        this.generatedNPCs.set(id, npc);
        
        return npc;
    }

    /**
     * Generate a backstory based on faction and importance
     */
    _generateBackstory(faction, importance, personality, motivation) {
        const backstories = {
            corporate: [
                `Rise through the ranks of ${this._generateCompanyName()} through ${personality} business practices.`,
                `Inherited control of a family business, now seeking to expand into new markets.`,
                `Former government official who jumped to the private sector, bringing valuable connections.`,
                `Built a tech startup from scratch, now a major player in the industry.`,
                `Known for ${motivation}-driven decisions that have made them both wealthy and controversial.`
            ],
            government: [
                `Elected to office promising reform, but the system has proven corrupting.`,
                `Long-serving bureaucrat with deep knowledge of how things really work.`,
                `Rapidly rising politician with ${personality} campaign tactics.`,
                `Former law enforcement officer turned politician, fighting for justice.`,
                `Appointed position holder with strong ties to corporate interests.`
            ],
            criminal: [
                `Started small on the streets, now controls significant territory.`,
                `Former corporate executive turned criminal mastermind after being framed.`,
                `Family legacy in organized crime, expected to take over operations.`,
                `Independent operator who plays both sides for personal gain.`,
                `Ex-military with valuable skills now used for ${motivation}.`
            ],
            civilian: [
                `Ordinary citizen caught up in extraordinary circumstances.`,
                `Whistleblower who knows too much about city corruption.`,
                `Journalist investigating the dark underbelly of the city.`,
                `Community leader trying to make a difference in their neighborhood.`,
                `Former victim seeking ${motivation} against those who wronged them.`
            ]
        };

        const factionBackstories = backstories[faction] || backstories.civilian;
        return this.rng.pick(factionBackstories);
    }

    /**
     * Generate a random company name
     */
    _generateCompanyName() {
        const prefixes = ['Global', 'United', 'Metro', 'City', 'Prime', 'Elite', 'Apex', 'Nova', 'Quantum', 'Digital'];
        const suffixes = ['Corp', 'Industries', 'Enterprises', 'Solutions', 'Technologies', 'Systems', 'Group', 'Partners'];
        return `${this.rng.pick(prefixes)} ${this.rng.pick(suffixes)}`;
    }

    /**
     * Generate relationships for key NPCs
     */
    _generateRelationships() {
        const relationships = [];
        const numRelationships = this.rng.int(1, 4);
        
        for (let i = 0; i < numRelationships; i++) {
            const relationshipTypes = ['ally', 'rival', 'mentor', 'subordinate', 'family', 'business_partner', 'enemy'];
            const type = this.rng.pick(relationshipTypes);
            const strength = this.rng.int(30, 100);
            
            relationships.push({
                type,
                strength,
                npcId: this._generateID(), // Will be filled in when that NPC is generated
                description: this._generateRelationshipDescription(type, strength)
            });
        }
        
        return relationships;
    }

    /**
     * Generate a relationship description
     */
    _generateRelationshipDescription(type, strength) {
        const descriptions = {
            ally: strength > 70 ? 'Close ally and trusted confidant' : 'Casual ally with shared interests',
            rival: strength > 70 ? 'Fierce competitor with history of conflict' : 'Mild rivalry over territory',
            mentor: 'Former mentor who shaped their career path',
            subordinate: strength > 70 ? 'Loyal subordinate who takes orders' : 'Reluctant subordinate',
            family: strength > 70 ? 'Blood relative with strong bond' : 'Distant family member',
            business_partner: strength > 70 ? 'Trusted business partner in multiple ventures' : 'Occasional business associate',
            enemy: strength > 70 ? 'Deadly enemy seeking revenge' : 'Someone with a grudge'
        };
        return descriptions[type] || 'Unknown relationship';
    }

    /**
     * Get or create an NPC by ID (ensures consistency)
     * @param {string} npcId - The NPC ID
     * @returns {Object|null} NPC profile or null if not found
     */
    getNPC(npcId) {
        return this.generatedNPCs.get(npcId) || null;
    }

    /**
     * Get all generated NPCs
     * @returns {Array} Array of all NPCs
     */
    getAllNPCs() {
        return Array.from(this.generatedNPCs.values());
    }

    /**
     * Get NPCs by faction
     * @param {string} faction - Faction to filter by
     * @returns {Array} NPCs in that faction
     */
    getNPCsByFaction(faction) {
        return this.getAllNPCs().filter(npc => npc.faction === faction);
    }

    /**
     * Get NPCs by importance level
     * @param {string} importance - Importance level to filter by
     * @returns {Array} NPCs at that importance level
     */
    getNPCsByImportance(importance) {
        return this.getAllNPCs().filter(npc => npc.importance === importance);
    }

    /**
     * Update NPC's last seen tick
     * @param {string} npcId - NPC ID
     * @param {number} tick - Current tick
     */
    updateLastSeen(npcId, tick) {
        const npc = this.getNPC(npcId);
        if (npc) {
            npc.lastSeenTick = tick;
        }
    }

    /**
     * Add NPC to a case
     * @param {string} npcId - NPC ID
     * @param {string} caseId - Case ID
     */
    addNPCToCase(npcId, caseId) {
        const npc = this.getNPC(npcId);
        if (npc && !npc.involvedCases.includes(caseId)) {
            npc.involvedCases.push(caseId);
        }
    }

    /**
     * Generate a news headline featuring an NPC
     * @param {Object} npc - NPC profile
     * @param {string} event - Event type
     * @returns {string} News headline
     */
    generateHeadline(npc, event) {
        const headlines = {
            arrest: `${npc.fullName}, ${npc.title}, arrested in connection with ongoing investigation`,
            promotion: `${npc.fullName} promoted to higher position at ${this._generateCompanyName()}`,
            scandal: `Scandal rocks ${npc.faction} sector: ${npc.fullName} under scrutiny`,
            death: `${npc.fullName} found dead in suspicious circumstances`,
            testimony: `${npc.fullName} provides key testimony in corruption case`,
            election: `${npc.fullName} wins election in landslide victory`,
            resignation: `${npc.fullName} resigns amid controversy`,
            breakthrough: `Breakthrough in case: ${npc.fullName} identified as key witness`,
            confrontation: `Standoff: ${npc.fullName} confronts authorities`,
            alliance: `${npc.fullName} forms new alliance with ${this._generateCompanyName()}`
        };
        
        return headlines[event] || `${npc.fullName} makes headlines in ${npc.faction} news`;
    }

    /**
     * Generate a news article body
     * @param {Object} npc - NPC profile
     * @param {string} event - Event type
     * @param {string} headline - Headline text
     * @returns {string} Article body
     */
    generateArticle(npc, event, headline) {
        const articles = {
            arrest: `In a major development, ${npc.fullName}, known as the ${npc.title} of ${npc.faction} interests, was taken into custody earlier today. Sources indicate the arrest is connected to an ongoing investigation into ${npc.motivation}-driven activities. ${npc.backstory} Authorities have not yet filed charges but expect announcements within the week.`,
            
            promotion: `${npc.fullName} has been promoted to a higher position, marking another step up in their corporate ladder. The ${npc.personality} executive has been instrumental in driving ${this._generateCompanyName()}'s recent success. "They're exactly the kind of leader we need," said a company spokesperson.`,
            
            scandal: `A brewing scandal has put ${npc.fullName} in the spotlight. Allegations of ${npc.personality} behavior have emerged, with sources claiming involvement in questionable dealings. The ${npc.title} has not yet commented on the allegations.`,
            
            death: `The city mourns the loss of ${npc.fullName}, whose death has raised numerous questions. The ${npc.ageRange} ${npc.title} was found in circumstances that investigators are calling "highly suspicious." ${npc.backstory}`
        };
        
        return articles[event] || `In related news, ${npc.fullName} continues to be a central figure in ${npc.faction} affairs. ${npc.backstory}`;
    }
}

// Singleton instance
let npcGeneratorInstance = null;

export function getNPCGenerator(seed) {
    if (!npcGeneratorInstance) {
        npcGeneratorInstance = new NPCGenerator(seed);
    }
    return npcGeneratorInstance;
}

export function resetNPCGenerator(seed) {
    npcGeneratorInstance = new NPCGenerator(seed);
    return npcGeneratorInstance;
}
