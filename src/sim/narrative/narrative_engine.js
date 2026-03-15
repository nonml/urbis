/**
 * Emergent Narrative Engine
 *
 * Observes the social graph, crime data, NPC relationships, economy, and politics
 * each game-day and synthesises short story beats that are printed to the city log.
 *
 * Each "story" is derived from real simulation state — no scripted events.
 */

// ─── Story Templates ──────────────────────────────────────────────────────────

const TEMPLATES = {
    /** Social / relationship stories */
    FRIENDSHIP_FORMED: (a, b) =>
        `${a.name} and ${b.name} have become close friends — often seen talking near ${a.workplaceName || 'the market'}.`,

    RIVALRY_ESCALATED: (a, b) =>
        `Tensions between ${a.name} and ${b.name} have spilled into public arguments. Neighbours are worried.`,

    FAMILY_CRISIS: (a, b) =>
        `${a.name}'s family is struggling: ${b.name} has not been home in days. Rumours are spreading.`,

    ROMANCE: (a, b) =>
        `Word is that ${a.name} and ${b.name} are spending every evening together. A spring romance?`,

    /** Crime / safety stories */
    CRIME_WAVE: (type, count, district) =>
        `A wave of ${type} has hit ${district} — ${count} incidents this week alone. Residents demand action.`,

    SUSPECT_SPOTTED: (name, crime) =>
        `${name} was seen near the scene of the latest ${crime}. Police are asking for witnesses.`,

    CRIME_SOLVED: (name, crime) =>
        `Detectives have closed the case: ${name} has been charged with ${crime}. The community breathes easier.`,

    /** Economy stories */
    UNEMPLOYMENT_SPIKE: (rate) =>
        `Unemployment has climbed to ${rate}% — vacant storefronts are multiplying on the high street.`,

    GOLD_RUSH: (amount) =>
        `The city treasury swelled by ${amount}💰 this week. The mayor is already fielding expansion proposals.`,

    DEBT_WARNING: (debt) =>
        `City debt has reached ${debt}💰. The financial committee is pressing for spending cuts.`,

    /** Politics stories */
    POLICY_BACKLASH: (policy) =>
        `The new "${policy}" policy is drawing criticism. A petition is circulating in the market square.`,

    FACTION_RISING: (faction) =>
        `The ${faction} faction has gained significant influence. Their leader was seen meeting with city officials.`,

    RIVAL_PLOT: (action) =>
        `Intelligence sources suggest a rival power is planning to ${action.replace(/_/g, ' ')}. The council is on alert.`,

    /** City life */
    POPULATION_BOOM: (pop) =>
        `The city has reached ${pop} residents! New arrivals are pouring in from the countryside.`,

    HOUSING_CRISIS: (shortfall) =>
        `${shortfall} families are sleeping in temporary shelters. The housing shortage is becoming a crisis.`,

    HAPPY_DISTRICT: (name) =>
        `${name || 'The city centre'} has been dubbed the happiest neighbourhood — residents are lively and content.`,

    LOW_MORALE: (pct) =>
        `City morale has dropped to ${pct}%. The streets feel quieter; people worry about the future.`,
};

// ─── Story deduplication ───────────────────────────────────────────────────────

const COOLDOWN_TICKS = 14; // min days between the same story type

// ─── Engine ───────────────────────────────────────────────────────────────────

export class NarrativeEngine {
    constructor(game) {
        this.game = game;
        /** @type {Map<string, number>} story-type → last-day emitted */
        this._lastEmitted = new Map();
        /** recent crime cache keyed by type */
        this._crimeCache = new Map();
        this._tick = 0;
    }

    /**
     * Called once per game day from game.js.
     * Evaluates narrative conditions and emits story beats to the city log.
     */
    update() {
        this._tick++;
        const day = this.game.resources?.day ?? this._tick;

        // Run all detectors — each returns a story string or null
        const stories = [
            this._checkRelationships(day),
            this._checkCrime(day),
            this._checkEconomy(day),
            this._checkPolitics(day),
            this._checkCityHealth(day),
        ].filter(Boolean);

        for (const { key, text } of stories) {
            const last = this._lastEmitted.get(key) ?? -COOLDOWN_TICKS;
            if (day - last >= COOLDOWN_TICKS) {
                this._lastEmitted.set(key, day);
                this.game.ui?.showMessage(`📰 ${text}`, 'event');
            }
        }
    }

    // ── Relationship detector ─────────────────────────────────────────────────

    _checkRelationships(day) {
        const sg = this.game.socialGraph;
        if (!sg?.relationships?.size) return null;
        const citizens = this.game.citizens?.citizens;
        if (!citizens?.length) return null;

        let bestFriendship = null, worstRivalry = null;

        for (const rel of sg.relationships.values()) {
            if (rel.affinity > 70 && rel.trust > 60 && rel.interactionCount > 5) {
                if (!bestFriendship || rel.affinity > bestFriendship.affinity) bestFriendship = rel;
            }
            if (rel.affinity < -60 && rel.interactionCount > 3) {
                if (!worstRivalry || rel.affinity < worstRivalry.affinity) worstRivalry = rel;
            }
        }

        // Pick the more story-worthy of the two
        if (bestFriendship && this._cooldownPassed('friendship', day)) {
            const a = this._getCitizen(citizens, bestFriendship.idA);
            const b = this._getCitizen(citizens, bestFriendship.idB);
            if (a && b) {
                const romantic = bestFriendship.affinity > 85;
                return {
                    key: 'friendship',
                    text: romantic
                        ? TEMPLATES.ROMANCE(a, b)
                        : TEMPLATES.FRIENDSHIP_FORMED(a, b),
                };
            }
        }

        if (worstRivalry && this._cooldownPassed('rivalry', day)) {
            const a = this._getCitizen(citizens, worstRivalry.idA);
            const b = this._getCitizen(citizens, worstRivalry.idB);
            if (a && b) {
                return { key: 'rivalry', text: TEMPLATES.RIVALRY_ESCALATED(a, b) };
            }
        }

        return null;
    }

    // ── Crime detector ────────────────────────────────────────────────────────

    _checkCrime(day) {
        const cg = this.game.crimeGenerator;
        if (!cg) return null;
        const incidents = cg.incidents ?? cg.activeIncidents ?? [];
        if (!incidents.length) return null;

        // Count recent incidents by type (last 7 days)
        const recentByType = new Map();
        for (const inc of incidents) {
            if (!inc.day || day - inc.day <= 7) {
                const t = inc.type?.id ?? inc.type ?? 'crime';
                recentByType.set(t, (recentByType.get(t) ?? 0) + 1);
            }
        }

        // Find dominant crime type
        let dominantType = null, dominantCount = 0;
        for (const [type, count] of recentByType) {
            if (count > dominantCount) { dominantType = type; dominantCount = count; }
        }

        if (dominantCount >= 3 && this._cooldownPassed('crime_wave', day)) {
            return {
                key: 'crime_wave',
                text: TEMPLATES.CRIME_WAVE(dominantType, dominantCount, 'the city'),
            };
        }

        // Solved crime story
        const solved = incidents.filter(i => i.resolved && i.suspectName && i.day && day - i.day <= 3);
        if (solved.length && this._cooldownPassed('crime_solved', day)) {
            const inc = solved[solved.length - 1];
            return {
                key: 'crime_solved',
                text: TEMPLATES.CRIME_SOLVED(inc.suspectName, inc.type?.id ?? inc.type ?? 'crime'),
            };
        }

        return null;
    }

    // ── Economy detector ──────────────────────────────────────────────────────

    _checkEconomy(day) {
        const res = this.game.resources;
        if (!res) return null;

        // Unemployment
        const citizens = this.game.citizens?.citizens ?? [];
        if (citizens.length > 5) {
            const employed = citizens.filter(c => c.job || c.employed).length;
            const rate = Math.round(((citizens.length - employed) / citizens.length) * 100);
            if (rate >= 35 && this._cooldownPassed('unemployment', day)) {
                return { key: 'unemployment', text: TEMPLATES.UNEMPLOYMENT_SPIKE(rate) };
            }
        }

        // Gold treasury milestone
        const gold = Math.floor(res.gold ?? 0);
        if (gold >= 2000 && this._cooldownPassed('gold_rush', day)) {
            return { key: 'gold_rush', text: TEMPLATES.GOLD_RUSH(gold) };
        }

        // Debt warning
        const debt = Math.floor(res.debt ?? 0);
        if (debt >= 500 && this._cooldownPassed('debt', day)) {
            return { key: 'debt', text: TEMPLATES.DEBT_WARNING(debt) };
        }

        return null;
    }

    // ── Politics detector ─────────────────────────────────────────────────────

    _checkPolitics(day) {
        // Rival AI story
        const rival = this.game.state?.rival;
        if (rival?.currentAction && rival.influence >= 50 && this._cooldownPassed('rival_plot', day)) {
            return { key: 'rival_plot', text: TEMPLATES.RIVAL_PLOT(rival.currentAction) };
        }

        // Faction power story
        const factions = this.game.factionSystem?.factions;
        if (factions) {
            for (const f of Object.values(factions)) {
                if ((f.influence ?? 0) >= 65 && this._cooldownPassed(`faction_${f.id}`, day)) {
                    return { key: `faction_${f.id}`, text: TEMPLATES.FACTION_RISING(f.name ?? f.id) };
                }
            }
        }

        // Active policy backlash
        const activePolicies = this.game.state?.policies?.active ?? [];
        if (activePolicies.length && this._cooldownPassed('policy', day)) {
            const p = activePolicies[activePolicies.length - 1];
            const name = p.name ?? p.id ?? 'new policy';
            return { key: 'policy', text: TEMPLATES.POLICY_BACKLASH(name) };
        }

        return null;
    }

    // ── City health detector ──────────────────────────────────────────────────

    _checkCityHealth(day) {
        const res = this.game.resources;
        if (!res) return null;

        // Population milestone
        const pop = res.population ?? 0;
        const prev = this._lastEmitted.get('pop_milestone_val') ?? 0;
        const milestone = Math.floor(pop / 50) * 50;
        if (milestone > 0 && milestone > prev && this._cooldownPassed('pop_milestone', day)) {
            this._lastEmitted.set('pop_milestone_val', milestone);
            return { key: 'pop_milestone', text: TEMPLATES.POPULATION_BOOM(milestone) };
        }

        // Housing crisis
        const shortfall = Math.max(0, pop - (res.housing ?? 0));
        if (shortfall >= 5 && this._cooldownPassed('housing_crisis', day)) {
            return { key: 'housing_crisis', text: TEMPLATES.HOUSING_CRISIS(shortfall) };
        }

        // Morale
        const citizens = this.game.citizens?.citizens ?? [];
        if (citizens.length >= 10) {
            const happyCount = citizens.filter(c => (c.happiness ?? c.needs?.happiness ?? 50) >= 65).length;
            const pctHappy = Math.round((happyCount / citizens.length) * 100);
            if (pctHappy >= 80 && this._cooldownPassed('happy_city', day)) {
                return { key: 'happy_city', text: TEMPLATES.HAPPY_DISTRICT(null) };
            }
            if (pctHappy <= 30 && this._cooldownPassed('low_morale', day)) {
                return { key: 'low_morale', text: TEMPLATES.LOW_MORALE(pctHappy) };
            }
        }

        return null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _cooldownPassed(key, day) {
        const last = this._lastEmitted.get(key) ?? -COOLDOWN_TICKS;
        return day - last >= COOLDOWN_TICKS;
    }

    _getCitizen(citizens, id) {
        return citizens.find(c => c.id === id || c.citizenId === id) ?? null;
    }
}
