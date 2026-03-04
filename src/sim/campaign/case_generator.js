// Case Generator v2 - Creates cases from templates with narrative context
// Integrates with CampaignModel for story-driven case generation

import { loadQuestsFromDirectory, loadStoryletsFromDirectory } from '../../content/loader.js';

/**
 * Case Generator v2 - Generates cases with narrative context and city state awareness
 */
export class CaseGeneratorV2 {
    constructor(game) {
        this.game = game;
        this.storylets = [];
        this.caseTemplates = [];
        this.nextCaseId = 1;
        this.campaign = game.campaign;
    }

    /**
     * Initialize and load content
     * @returns {Promise<void>}
     */
    async init() {
        // Load case templates from content directory
        const questsResult = await loadQuestsFromDirectory('src/content/quests');
        if (questsResult.quests) {
            this.caseTemplates = questsResult.quests;
        }

        // Load storylets for minor cases
        const storyletsResult = await loadStoryletsFromDirectory('src/content/storylets');
        if (storyletsResult.storylets) {
            this.storylets = storyletsResult.storylets;
        }


    }

    /**
     * Generate a main case based on city state and campaign context
     * @returns {Object|null} Case object or null
     */
    generateMainCase() {
        // Pick a template weighted by city conditions
        const template = this.pickTemplate();
        if (!template) return null;

        // Build context from current city state
        const context = this.buildCaseContext();

        // Generate narrative elements
        const caseData = this.createCaseData(template, context);

        return caseData;
    }

    /**
     * Generate a minor case or storylet
     * @returns {Object|null} Case object or null
     */
    generateMinorCase() {
        const candidate = this.pickMinorCandidate();
        if (!candidate) return null;

        const context = this.buildCaseContext();
        const caseData = this.createCaseData(candidate, context);

        return caseData;
    }

    /**
     * Generate cases for current tick
     * @returns {Array} Array of case objects
     */
    generateCases() {
        const cases = [];

        // Generate main case if none active
        if (this.campaign?.getActiveCase() === null) {
            const mainCase = this.generateMainCase();
            if (mainCase) cases.push(mainCase);
        }

        // Generate minor cases based on city stress
        const minorCount = this.calculateMinorCaseCount();
        for (let i = 0; i < minorCount; i++) {
            const minor = this.generateMinorCase();
            if (minor) cases.push(minor);
        }

        return cases;
    }

    /**
     * Pick a template weighted by city conditions
     * @returns {Object|null} Template or null
     */
    pickTemplate() {
        if (this.caseTemplates.length === 0) return null;

        const weighted = this.caseTemplates.map(template => {
            let weight = template.weight || 0.5;

            // Adjust based on city conditions
            if (template.tags?.includes('corruption') && this.cityHasCorruption()) {
                weight *= 1.5;
            }
            if (template.tags?.includes('gang') && this.cityHasGangActivity()) {
                weight *= 2;
            }
            if (template.tags?.includes('missing') && this.cityHasMissingPerson()) {
                weight *= 1.8;
            }
            if (template.tags?.includes('crisis') && this.game.crisisManager?.activeCrisis) {
                weight *= 2.5;
            }

            return { template, weight };
        });

        return this.weightedPick(weighted);
    }

    /**
     * Pick a minor case candidate (template or storylet)
     * @returns {Object|null} Candidate or null
     */
    pickMinorCandidate() {
        const candidates = [];

        // Add templates with lower weight
        for (const template of this.caseTemplates) {
            if (template.type === 'casefile') {
                candidates.push({ item: template, weight: 0.3 });
            }
        }

        // Add storylets
        for (const storylet of this.storylets) {
            if (this.storyletMatchesState(storylet)) {
                candidates.push({ item: storylet, weight: storylet.weight || 0.5 });
            }
        }

        if (candidates.length === 0) return null;
        return this.weightedPick(candidates);
    }

    /**
     * Check if storylet matches current city state
     * @param {Object} storylet
     * @returns {boolean}
     */
    storyletMatchesState(storylet) {
        if (!storylet.requires) return true;

        // Check district types
        if (storylet.requires.districtTypes) {
            const district = this.game.map?.getDistrictAt?.(
                this.game.state?.player?.x,
                this.game.state?.player?.y
            );
            if (!district || !storylet.requires.districtTypes.includes(district.theme)) {
                return false;
            }
        }

        // Check crisis type
        if (storylet.requires.crisisType) {
            const activeCrisis = this.game.crisisManager?.activeCrisis;
            if (!activeCrisis || activeCrisis.type !== storylet.requires.crisisType) {
                return false;
            }
        }

        // Check happiness
        if (storylet.requires.happiness) {
            const avgHappy = this.game.citizens?.getAverageHappiness?.();
            if (storylet.requires.happiness === 'low' && avgHappy > 50) return false;
            if (storylet.requires.happiness === 'high' && avgHappy < 50) return false;
        }

        return true;
    }

    /**
     * Check if city has corruption indicators
     * @returns {boolean}
     */
    cityHasCorruption() {
        const citizens = this.game.citizens?.citizens || [];
        return citizens.some(c =>
            c.job === 'official' && (c.happiness < 40 || c.personality?.includes('greedy'))
        );
    }

    /**
     * Check if city has gang activity
     * @returns {boolean}
     */
    cityHasGangActivity() {
        const districts = this.game.map?.districts || [];
        return districts.some(d =>
            d.modifiers?.some(m => m.name === 'crime' && m.value > 0.2)
        );
    }

    /**
     * Check if city has missing person indicators
     * @returns {boolean}
     */
    cityHasMissingPerson() {
        const pop = this.game.resources?.population || 0;
        return this.rng.chance(Math.min(0.5, pop / 100));
    }

    /**
     * Calculate minor case count based on city conditions
     * @returns {number}
     */
    calculateMinorCaseCount() {
        // Base count is 1-2
        let count = 1;

        // More minor cases if more crime
        if (this.game.state.player.heat > 50) count += 1;
        if (this.game.crisisManager?.activeCrisis) count += 1;

        return Math.min(count, 4);
    }

    /**
     * Build case context from city state
     * @returns {Object} Context object
     */
    buildCaseContext() {
        const districts = this.game.map?.districts || [];
        const citizens = this.game.citizens?.citizens || [];

        const validCitizens = citizens.filter(c => c != null);
        const validBuildings = (this.game.buildings?.buildings || []).filter(b =>
            b != null && ['commercial', 'residential'].includes(b.type)
        );

        return {
            districts,
            citizens,
            playerX: this.game.state?.player?.x,
            playerY: this.game.state?.player?.y,
            timeOfDay: this.game.state?.time?.timeOfDay,
            day: this.game.resources?.day,
            heat: this.game.state?.player?.heat || 0,
            reputation: this.game.state?.player?.reputation || 0,
            randomCitizen: validCitizens.length > 0 ? this.rng.pick(validCitizens) : null,
            suspiciousBuilding: validBuildings.length > 0 ? this.rng.pick(validBuildings) : null,
            lastSeenLocation: {
                x: this.game.state?.player?.x,
                y: this.game.state?.player?.y
            }
        };
    }

    /**
     * Create case data with narrative elements
     * @param {Object} template - Case template or storylet
     * @param {Object} context - City state context
     * @returns {Object} Case data object
     */
    createCaseData(template, context) {
        const seed = this.nextCaseId++;
        const caseId = `${template.id}_${seed}`;

        // Extract narrative elements from template
        const title = this.narrateTitle(template, context);
        const description = this.narrateDescription(template, context);

        // Build chapters from template steps
        const chapters = this.buildChaptersFromTemplate(template, seed);

        // Create case suspects based on district
        const suspects = this.generateSuspects(context, template);

        // Create leads for the case
        const leads = this.generateLeads(template, seed);

        return {
            id: caseId,
            type: template.type || 'investigation',
            title: title,
            description: description,
            status: 'active',
            currentChapter: 0,
            chapters: chapters,
            questIds: [],
            suspects: suspects,
            leads: leads,
            clues: [],
            evidence: [],
            dialogue: template.dialogue || [],
            caseSeed: seed,
            createdAt: Date.now(),
            context: context,
        };
    }

    /**
     * Create narrative title from template and context
     * @param {Object} template
     * @param {Object} context
     * @returns {string}
     */
    narrateTitle(template, context) {
        const keywords = {
            missing: 'Disappearance',
            corruption: 'Scandal',
            gang: 'Syndicate',
            sabotage: 'Attack',
        };

        const keyword = Object.entries(keywords).find(([k]) =>
            template.tags?.includes(k)
        )?.[1] || 'Investigation';

        const location = context?.districts?.[0]?.name || 'Unknown District';

        return `${keyword} in ${location}`;
    }

    /**
     * Create narrative description from template
     * @param {Object} template
     * @param {Object} context
     * @returns {string}
     */
    narrateDescription(template, context) {
        const baseDescription = template.description || 'Investigate this incident and resolve the case.';

        // Add context-specific details
        if (context?.heat > 70) {
            return `${baseDescription} With rising heat, time is of the essence.`
        }
        if (context?.reputation < 30) {
            return `${baseDescription} Your low reputation makes this investigation challenging.`
        }

        return baseDescription;
    }

    /**
     * Build chapters from template steps
     * @param {Object} template
     * @param {number} seed
     * @returns {Array} Chapters array
     */
    buildChaptersFromTemplate(template, seed) {
        const steps = template.steps || [];

        // Group steps into chapters (simplified: 3 chapters)
        const chapters = [];
        const stepSize = Math.ceil(steps.length / 3);

        for (let i = 0; i < 3; i++) {
            const chapterSteps = steps.slice(i * stepSize, (i + 1) * stepSize);
            if (chapterSteps.length === 0) continue;

            chapters.push({
                id: `${template.id}_chapter_${i}`,
                title: `Chapter ${i + 1}: ${this.getChapterTitle(i, template)}`,
                steps: chapterSteps,
                rewards: i === 2 ? (template.rewards || []) : [],
            });
        }

        // Fallback if no chapters created
        if (chapters.length === 0) {
            chapters.push({
                id: `${template.id}_chapter_0`,
                title: 'Investigation',
                steps: steps,
                rewards: template.rewards || [],
            });
        }

        return chapters;
    }

    /**
     * Get narrative title for a chapter
     * @param {number} index
     * @param {Object} template
     * @returns {string}
     */
    getChapterTitle(index, template) {
        const titles = {
            0: 'Initial Investigation',
            1: 'Gathering Evidence',
            2: 'Resolution',
        };
        return titles[index] || `Chapter ${index + 1}`;
    }

    /**
     * Generate suspects based on context
     * @param {Object} context
     * @param {Object} template
     * @returns {Array} Suspects array
     */
    generateSuspects(context, template) {
        const citizens = context?.citizens || [];
        if (citizens.length === 0) return [];

        const suspects = [];
        const used = new Set();

        // Pick 2-3 suspects
        for (let i = 0; i < 3; i++) {
            const idx = this.rng.int(0, citizens.length - 1);
            if (used.has(idx)) continue;
            used.add(idx);

            const citizen = citizens[idx];
            suspects.push({
                id: `suspect_${citizen.id}_${this.nextCaseId}`,
                citizenId: citizen.id,
                name: citizen.name || `Citizen #${citizen.id}`,
                role: citizen.job || 'citizen',
                risk: Math.max(1, Math.min(5, Math.round((100 - (citizen.happiness || 50)) / 20) + 1)),
                motive: this.getMotive(template, citizen),
            });
        }

        return suspects;
    }

    /**
     * Get motive for a suspect based on template
     * @param {Object} template
     * @param {Object} citizen
     * @returns {string}
     */
    getMotive(template, citizen) {
        const motives = {
            corruption: 'Financial gain through illicit means',
            gang: 'Affiliation with local criminal organization',
            missing: 'Potential victim or witness',
            sabotage: 'Revenge against local authority',
        };

        const tag = Object.keys(motives).find(t => template.tags?.includes(t));
        return motives[tag] || 'Unknown motives';
    }

    /**
     * Generate leads for the case
     * @param {Object} template
     * @param {number} seed
     * @returns {Array} Leads array
     */
    generateLeads(template, seed) {
        const leads = [];

        // Digital lead
        if (template.tags?.includes('cctv') || template.tags?.includes('telecom')) {
            leads.push({
                id: `${template.id}_lead_digital_${seed}`,
                label: 'Digital Trace',
                type: 'digital',
                status: 'open',
                description: 'Check for digital evidence (CCTV, communications)',
            });
        }

        // Witness lead
        leads.push({
            id: `${template.id}_lead_witness_${seed}`,
            label: 'Witness Account',
            type: 'witness',
            status: 'open',
            description: 'Interview potential witnesses',
        });

        // Physical lead
        leads.push({
            id: `${template.id}_lead_physical_${seed}`,
            label: 'Physical Evidence',
            type: 'physical',
            status: 'open',
            description: 'Search the incident location',
        });

        return leads;
    }

    /**
     * Instantiate a quest from template with context binding
     * @param {Object} template - Quest or storylet template
     * @param {Object} context - Runtime context
     * @returns {Object} Quest instance
     */
    instantiateQuest(template, context) {
        const quest = {
            id: `${template.id}-${this.nextCaseId++}`,
            title: template.title || template.id,
            description: template.description || '',
            type: template.type || 'casefile',
            tags: [...(template.tags || [])],
            status: 'active',
            currentStepIndex: 0,
            steps: [],
            completedSteps: [],
            blockedReason: null,
            context: context,
            data: {
                clues: [],
                choices: [],
                markers: [],
                evidence: []
            },
            createdAt: Date.now(),
            lastUpdated: Date.now()
        };

        // Instantiate steps with context
        for (const step of template.steps) {
            quest.steps.push(this.instantiateStep(step, context));
        }

        return quest;
    }

    /**
     * Instantiate a single step with context binding
     * @param {Object} step - Step definition
     * @param {Object} context - Runtime context
     * @returns {Object} Instantiated step
     */
    instantiateStep(step, context) {
        const instantiated = { ...step };

        // Resolve marker to coordinates if needed
        if (step.marker === 'last_seen' && context?.lastSeenLocation) {
            instantiated.targetX = context.lastSeenLocation.x;
            instantiated.targetY = context.lastSeenLocation.y;
        }

        if (step.marker === 'suspicious_building' && context?.suspiciousBuilding) {
            instantiated.targetX = context.suspiciousBuilding.x;
            instantiated.targetY = context.suspiciousBuilding.y;
        }

        // Resolve interact target if citizen
        if (step.interactType === 'citizen' && context?.randomCitizen) {
            instantiated.targetCitizen = context.randomCitizen;
        }

        return instantiated;
    }

    /**
     * Pick an item by weight
     * @param {Array} weightedItems - Array of { item, weight }
     * @returns {Object|null} Picked item
     */
    weightedPick(weightedItems) {
        if (!weightedItems || weightedItems.length === 0) return null;

        const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0);
        if (totalWeight === 0) return null;

        const random = this.rng.float(0, totalWeight);

        let cumulativeWeight = 0;
        for (const item of weightedItems) {
            cumulativeWeight += item.weight;
            if (random < cumulativeWeight) {
                return item;
            }
        }

        return weightedItems[weightedItems.length - 1];
    }

    /**
     * Get random number generator
     */
    get rng() {
        return this.game.rng;
    }
}