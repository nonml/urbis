// Social Graph System - Milestone J
// Manages social relationships between citizens

/**
 * Social Relationship - represents a connection between citizens
 */
export class SocialRelationship {
    constructor(idA, idB) {
        this.idA = idA;
        this.idB = idB;
        this.affinity = 0; // -100 to 100
        this.trust = 0; // -100 to 100
        this.familiarity = 0; // 0 to 100
        this.interactionCount = 0;
        this.lastInteractionTick = 0;
        this.relationshipType = 'neutral'; // neutral, friend, rival, family
        this.familyRelation = null; // parent, spouse, child, sibling
    }

    /**
     * Update affinity based on interaction
     */
    updateAffinity(delta) {
        this.affinity = Math.max(-100, Math.min(100, this.affinity + delta));
        this._updateType();
    }

    /**
     * Update trust based on positive interactions
     */
    updateTrust(delta) {
        this.trust = Math.max(-100, Math.min(100, this.trust + delta));
        this.familiarity = Math.min(100, this.familiarity + Math.abs(delta) / 2);
    }

    /**
     * Update interaction count and last interaction time
     */
    recordInteraction(tick) {
        this.interactionCount++;
        this.lastInteractionTick = tick;
        this.familiarity = Math.min(100, this.familiarity + 1);
    }

    /**
     * Determine relationship type based on affinity and trust
     */
    _updateType() {
        if (this.affinity > 50 && this.trust > 50) {
            this.relationshipType = 'friend';
        } else if (this.affinity < -50) {
            this.relationshipType = 'rival';
        } else if (this.familyRelation) {
            this.relationshipType = 'family';
        } else {
            this.relationshipType = 'neutral';
        }
    }

    /**
     * Calculate relationship strength
     */
    getStrength() {
        return Math.abs(this.affinity) + Math.abs(this.trust) + this.familiarity;
    }

    /**
     * Check if this is a positive relationship
     */
    isPositive() {
        return this.affinity > 20 && this.trust > 20;
    }

    /**
     * Check if this is a negative relationship
     */
    isNegative() {
        return this.affinity < -20 || this.trust < -20;
    }

    /**
     * Serialize relationship
     */
    serialize() {
        return {
            idA: this.idA,
            idB: this.idB,
            affinity: this.affinity,
            trust: this.trust,
            familiarity: this.familiarity,
            interactionCount: this.interactionCount,
            lastInteractionTick: this.lastInteractionTick,
            relationshipType: this.relationshipType,
            familyRelation: this.familyRelation,
        };
    }

    /**
     * Deserialize relationship
     */
    static deserialize(data) {
        const rel = new SocialRelationship(data.idA, data.idB);
        rel.affinity = data.affinity || 0;
        rel.trust = data.trust || 0;
        rel.familiarity = data.familiarity || 0;
        rel.interactionCount = data.interactionCount || 0;
        rel.lastInteractionTick = data.lastInteractionTick || 0;
        rel.relationshipType = data.relationshipType || 'neutral';
        rel.familyRelation = data.familyRelation || null;
        return rel;
    }
}

/**
 * Social Graph - manages all social relationships
 */
export class SocialGraph {
    constructor(game, rng = null) {
        this.game = game;
        this.rng = rng;
        this.relationships = new Map();
        this.traitWeights = {
            extroverted: 1.5,
            introverted: 0.8,
            aggressive: 0.5,
            empathetic: 1.3,
            suspicious: 0.7,
            steady: 1.2,
        };
    }

    /**
     * Get relationship between two citizens
     */
    getRelationship(idA, idB) {
        const key = this._makeKey(idA, idB);
        return this.relationships.get(key);
    }

    /**
     * Create or get relationship between two citizens
     */
    getOrCreateRelationship(idA, idB) {
        const key = this._makeKey(idA, idB);
        if (!this.relationships.has(key)) {
            const rel = new SocialRelationship(idA, idB);
            this.relationships.set(key, rel);
        }
        return this.relationships.get(key);
    }

    /**
     * Create key for relationship map
     */
    _makeKey(idA, idB) {
        return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
    }

    /**
     * Process social interaction between citizens
     */
    processInteraction(idA, idB, tick) {
        const rel = this.getOrCreateRelationship(idA, idB);
        rel.recordInteraction(tick);

        const citizenA = this.game.citizens.getCitizenById(idA);
        const citizenB = this.game.citizens.getCitizenById(idB);

        if (!citizenA || !citizenB) return;

        // Base interaction effect
        let effect = 2;

        // Modify by traits
        effect *= this._getTraitModifier(citizenA, citizenB);

        // Modify by mood
        const moodA = citizenA.mood || 'content';
        const moodB = citizenB.mood || 'content';

        if (moodA === 'optimistic' && moodB === 'optimistic') effect *= 1.5;
        else if (moodA === 'stressed' || moodB === 'stressed') effect *= 0.5;
        else if (moodA === 'desperate' || moodB === 'desperate') effect *= 0.2;

        // Update relationship
        rel.updateAffinity(effect);
        rel.updateTrust(Math.abs(effect) / 2);

        // Chance to form family bond if interacting frequently
        this._checkFamilyBond(rel, citizenA, citizenB);
    }

    /**
     * Get trait modifier for interaction
     */
    _getTraitModifier(citizenA, citizenB) {
        let modifier = 1;

        for (const trait of citizenA.traits || []) {
            modifier *= this.traitWeights[trait] || 1;
        }

        for (const trait of citizenB.traits || []) {
            modifier *= this.traitWeights[trait] || 1;
        }

        return modifier;
    }

    /**
     * Check for potential family bond
     */
    _checkFamilyBond(rel, citizenA, citizenB) {
        // Skip if already family
        if (rel.familyRelation) return;

        // Only check for nearby adults
        const dist = Math.abs(citizenA.x - citizenB.x) + Math.abs(citizenA.y - citizenB.y);
        if (dist > 5) return;

        const ageA = citizenA.age || 30;
        const ageB = citizenB.age || 30;

        // Adult relationship potential
        if (ageA >= 18 && ageB >= 18 && ageA <= 60 && ageB <= 60) {
            if (rel.affinity > 60 && this.rng?.chance(0.05) ?? Math.random() < 0.05) {
                rel.relationshipType = 'friend';
                // Spouse potential based on compatibility
                if ((this.rng?.chance(0.3) ?? Math.random()) < 0.3 && ageA !== ageB) {
                    rel.familyRelation = 'spouse';
                }
            }
        }

        // Parent-child potential if ages differ significantly
        if (Math.abs(ageA - ageB) > 20) {
            const parent = ageA > ageB ? citizenA : citizenB;
            const child = ageA > ageB ? citizenB : citizenA;

            if (parent.homeParcel === child.homeParcel && rel.affinity > 40) {
                rel.familyRelation = ageA > ageB ? 'parent' : 'child';
            }
        }
    }

    /**
     * Build family graph from household data
     */
    buildFamilyGraph() {
        const households = this.game.housingManager?.households;

        if (!households) return;

        for (const household of households.values()) {
            const members = household.members;

            // Connect household members
            for (let i = 0; i < members.length; i++) {
                for (let j = i + 1; j < members.length; j++) {
                    const rel = this.getOrCreateRelationship(members[i], members[j]);
                    rel.familyRelation = 'household_member';
                    rel.affinity = 50 + ((this.rng?.next() ?? Math.random()) * 30);
                    rel.updateType();
                }
            }
        }
    }

    /**
     * Get citizen's social connections
     */
    getCitizenConnections(citizenId) {
        const connections = [];

        for (const [key, rel] of this.relationships) {
            if (rel.idA === citizenId) {
                connections.push({
                    id: rel.idB,
                    affinity: rel.affinity,
                    trust: rel.trust,
                    type: rel.relationshipType,
                    family: rel.familyRelation,
                });
            } else if (rel.idB === citizenId) {
                connections.push({
                    id: rel.idA,
                    affinity: rel.affinity,
                    trust: rel.trust,
                    type: rel.relationshipType,
                    family: rel.familyRelation,
                });
            }
        }

        // Sort by affinity
        connections.sort((a, b) => b.affinity - a.affinity);
        return connections;
    }

    /**
     * Get social influence for a citizen
     */
    getSocialInfluence(citizenId) {
        const connections = this.getCitizenConnections(citizenId);
        let influence = 0;

        for (const conn of connections) {
            influence += conn.affinity * (conn.trust + 100) / 200;
        }

        return Math.round(influence);
    }

    /**
     * Get citizen's popularity (average affinity of neighbors)
     */
    getPopularity(citizenId) {
        const connections = this.getCitizenConnections(citizenId);
        if (connections.length === 0) return 50;

        const avgAffinity = connections.reduce((sum, c) => sum + c.affinity, 0) / connections.length;
        return Math.round((avgAffinity + 100) / 2);
    }

    /**
     * Calculate social graph statistics
     */
    getStats() {
        const relationships = Array.from(this.relationships.values());
        const positive = relationships.filter(r => r.isPositive()).length;
        const negative = relationships.filter(r => r.isNegative()).length;
        const neutral = relationships.length - positive - negative;

        const totalAffinity = relationships.reduce((sum, r) => sum + r.affinity, 0);
        const avgAffinity = relationships.length > 0 ? totalAffinity / relationships.length : 0;

        // Count family relationships
        const familyRelations = relationships.filter(r => r.familyRelation).length;

        return {
            totalRelationships: relationships.length,
            positive: positive,
            negative: negative,
            neutral: neutral,
            avgAffinity: Math.round(avgAffinity),
            familyRelations,
        };
    }

    /**
     * Update social graph each tick
     */
    update(tick) {
        if (tick % 3 !== 0) return;

        const citizens = this.game.citizens.citizens;

        // Check for nearby citizen interactions
        for (let i = 0; i < citizens.length; i++) {
            for (let j = i + 1; j < citizens.length; j++) {
                const a = citizens[i];
                const b = citizens[j];

                // Check if close enough for interaction
                const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
                if (dist <= 3 && (this.rng?.chance(0.1) ?? Math.random()) < 0.1) {
                    this.processInteraction(a.id, b.id, tick);
                }
            }
        }

        // Rebuild family graph periodically
        if (tick % 50 === 0) {
            this.buildFamilyGraph();
        }
    }

    /**
     * Serialize social graph state
     */
    serialize() {
        return {
            relationships: Array.from(this.relationships.values()).map(r => r.serialize()),
        };
    }

    /**
     * Deserialize social graph state
     */
    deserialize(data) {
        if (!data) return;

        this.relationships.clear();

        for (const relData of data.relationships || []) {
            const rel = SocialRelationship.deserialize(relData);
            this.relationships.set(this._makeKey(rel.idA, rel.idB), rel);
        }
    }
}