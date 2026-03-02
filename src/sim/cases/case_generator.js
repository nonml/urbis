// Case File Generator - Creates quest instances from templates and storylets
// Generates "main cases" and "minor cases" per run based on city state

/**
 * Case generator - creates quests from templates and storylets
 */
export class CaseGenerator {
    constructor(game) {
        this.game = game;
        this.storylets = [];
        this.caseTemplates = [];
        this.nextCaseId = 1;
    }

    /**
     * Load storylets for case generation
     * @param {Array} storylets - Array of storylet definitions
     */
    loadStorylets(storylets) {
        this.storylets = storylets;
    }

    /**
     * Load case templates
     * @param {Array} caseTemplates - Array of case template definitions
     */
    loadCaseTemplates(caseTemplates) {
        this.caseTemplates = caseTemplates;
    }

    /**
     * Generate a main case file
     * @returns {Object} Quest instance for main case
     */
    generateMainCase() {
        // Pick a main case template
        const template = this.pickCaseTemplate();
        if (!template) return null;

        // Get context from current city state
        const context = this.buildCaseContext();

        // Instantiate the quest
        const quest = this.instantiateQuest(template, context);

        // Log generation info
        console.log(`Case generator: Created main case "${quest.title}" (${quest.id})`);

        return quest;
    }

    /**
     * Generate a minor case file
     * @returns {Object|null} Quest instance for minor case, or null if no cases available
     */
    generateMinorCase() {
        // Pick a minor case template or storylet
        const candidate = this.pickMinorCaseCandidate();
        if (!candidate) return null;

        const context = this.buildCaseContext();
        const quest = this.instantiateQuest(candidate, context);

        console.log(`Case generator: Created minor case "${quest.title}" (${quest.id})`);

        return quest;
    }

    /**
     * Generate cases based on city state
     * @returns {Array} Array of quest instances
     */
    generateCasesFromState() {
        const cases = [];

        // Always generate a main case
        const mainCase = this.generateMainCase();
        if (mainCase) cases.push(mainCase);

        // Generate 1-3 minor cases based on city state
        const minorCount = this.rng.int(1, 3);
        for (let i = 0; i < minorCount; i++) {
            const minor = this.generateMinorCase();
            if (minor) cases.push(minor);
        }

        return cases;
    }

    /**
     * Pick a case template based on city state
     * @returns {Object|null} Case template or null
     */
    pickCaseTemplate() {
        if (this.caseTemplates.length === 0) return null;

        // Weighted selection based on city conditions
        const weightedTemplates = this.caseTemplates.map(template => {
            let weight = template.weight || 0.5;

            // Adjust weight based on city conditions
            if (template.tags?.includes('corruption') && this.cityHasCorruption()) {
                weight *= 1.5;
            }
            if (template.tags?.includes('gang') && this.cityHasGangActivity()) {
                weight *= 2;
            }
            if (template.tags?.includes('missing') && this.cityHasMissingPerson()) {
                weight *= 2;
            }

            return { template, weight };
        });

        return this.weightedPick(weightedTemplates);
    }

    /**
     * Pick a minor case candidate
     * @returns {Object|null} Template or storylet
     */
    pickMinorCaseCandidate() {
        const candidates = [];

        // Add case templates with lower weight
        for (const template of this.caseTemplates) {
            if (template.type === 'casefile') {
                candidates.push({ item: template, weight: 0.3 });
            }
        }

        // Add storylets
        for (const storylet of this.storylets) {
            candidates.push({ item: storylet, weight: storylet.weight || 0.5 });
        }

        // Filter by city state
        const filtered = candidates.filter(c => this.storyletMatchesState(c.item));

        if (filtered.length === 0) return null;

        return this.weightedPick(filtered)?.item;
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
            const district = this.game.map?.getDistrictAt?.(this.game.state?.player?.x, this.game.state?.player?.y);
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
     */
    cityHasCorruption() {
        // Check if any officials have high debt or low happiness
        const citizens = this.game.citizens?.citizens || [];
        return citizens.some(c =>
            c.job === 'official' && (c.happiness < 40 || c.personality?.includes('greedy'))
        );
    }

    /**
     * Check if city has gang activity
     */
    cityHasGangActivity() {
        // Check for high crime districts
        const districts = this.game.map?.districts || [];
        return districts.some(d => d.modifiers?.some(m => m.name === 'crime' && m.value > 0.2));
    }

    /**
     * Check if city has missing person indicators
     */
    cityHasMissingPerson() {
        // Random chance based on population size
        const pop = this.game.resources?.population || 0;
        return this.rng.chance(Math.min(0.5, pop / 100));
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
            // Find a random citizen as target
            randomCitizen: validCitizens.length > 0 ? this.rng.pick(validCitizens) : null,
            // Find suspicious building (random commercial/residential)
            suspiciousBuilding: validBuildings.length > 0 ? this.rng.pick(validBuildings) : null,
            // Last seen location (player's current position)
            lastSeenLocation: {
                x: this.game.state?.player?.x,
                y: this.game.state?.player?.y
            }
        };
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
            tags: [...template.tags],
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

        // Fallback for edge cases where random >= totalWeight
        return weightedItems[weightedItems.length - 1];
    }

    /**
     * Get random number generator
     */
    get rng() {
        return this.game.rng;
    }
}
