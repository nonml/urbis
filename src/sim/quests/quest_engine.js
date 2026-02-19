// Quest Engine - Executes quests step-by-step, event-driven
import { eventBus, EVENT_TYPES } from '../events.js';
import { getInteractableTypeInfo } from '../interactables.js';
import { RewardSystem } from '../rewards/reward_system.js';

export const STEP_KINDS = {
    TRIGGER: 'trigger',
    HACK_NODE: 'hack_node',
    GO_TO: 'go_to',
    CHOICE: 'choice',
    INVESTIGATE: 'investigate',
    INTERACT: 'interact',
    OUTCOME: 'outcome',
    CONDITIONAL: 'conditional',
    SPAWN_CLUE: 'spawn_clue'
};

const NODE_TYPE_ALIASES = {
    CCTV: 'CCTV_POLE',
    CCTV_POLE: 'CCTV_POLE',
    TELECOM: 'TELECOM_BOX',
    TELECOM_BOX: 'TELECOM_BOX',
    POWER: 'POWER_SUBSTATION',
    POWER_SUBSTATION: 'POWER_SUBSTATION',
};

function now() {
    return Date.now();
}

function normalizeNodeType(value) {
    if (!value) return value;
    return NODE_TYPE_ALIASES[value] || value;
}

export function createQuestInstance(questDef, context = {}) {
    const resolvedSteps = (questDef.steps || []).map((step) => resolveStep(step, context));

    return {
        id: questDef.id,
        title: questDef.title || questDef.id,
        description: questDef.description || '',
        type: questDef.type || 'casefile',
        tags: Array.isArray(questDef.tags) ? questDef.tags : [],
        trigger: questDef.trigger || null,
        rewards: Array.isArray(questDef.rewards) ? questDef.rewards : [],
        status: 'active',
        currentStepIndex: 0,
        steps: resolvedSteps,
        completedSteps: [],
        blockedReason: null,
        context: { ...context },
        data: {
            clues: [],
            choices: [],
            markers: [],
            evidence: [],
            flags: {},
            triggers: {},
            choicePending: null,
            outcome: null,
        },
        createdAt: now(),
        lastUpdated: now()
    };
}

function resolveStep(step, context) {
    const resolved = { ...step };

    if (step.kind === STEP_KINDS.HACK_NODE) {
        resolved.nodeType = normalizeNodeType(step.nodeType);
    }

    if (step.marker && context) {
        if (step.marker === 'last_seen' && context.lastSeenLocation) {
            resolved.targetX = context.lastSeenLocation.x;
            resolved.targetY = context.lastSeenLocation.y;
        } else if (step.marker === 'suspicious_building' && context.suspiciousBuilding) {
            resolved.targetX = context.suspiciousBuilding.x;
            resolved.targetY = context.suspiciousBuilding.y;
        }
    }

    return resolved;
}

export class QuestEngine {
    constructor(game) {
        this.game = game;
        this.activeQuests = [];
        this.completedQuests = [];
        this.rng = game.rngStreams?.quest || game.rng;
        this.rewardSystem = new RewardSystem(game);
        this.setupEventListeners();
    }

    setupEventListeners() {
        eventBus.on(EVENT_TYPES.PLAYER_HACKED_NODE, (data) => {
            this.handleHackedNode(data.interactable, data.success);
        }, this);

        eventBus.on(EVENT_TYPES.PLAYER_ENTERED_DISTRICT, (data) => {
            this.handleEnteredDistrict(data.districtId);
        }, this);

        eventBus.on(EVENT_TYPES.ANOMALY_FOUND, (data) => {
            this.handleAnomaly(data.anomalyType, data.details);
        }, this);

        eventBus.on(EVENT_TYPES.PLAYER_DECISION, (data) => {
            this.handlePlayerDecision(data);
        }, this);

        eventBus.on(EVENT_TYPES.INTERACTABLE_AVAILABLE, (data) => {
            this.handleInteractableAvailable(data.interactable);
        }, this);
    }

    addQuest(questDef, context = {}) {
        const ctx = { ...context, rng: this.rng };
        const quest = createQuestInstance(questDef, ctx);
        this.activeQuests.push(quest);

        eventBus.emit(EVENT_TYPES.QUEST_STARTED, {
            questId: quest.id,
            questTitle: quest.title,
            tick: now()
        });

        // Auto-run trigger if provided at top-level.
        if (quest.trigger) {
            quest.data.triggers[quest.trigger] = false;
        }

        this.tryAdvanceQuest(quest);
        return quest;
    }

    getQuestById(id) {
        return this.activeQuests.find((q) => q.id === id) ||
               this.completedQuests.find((q) => q.id === id);
    }

    getStepById(quest, stepId) {
        if (!quest || !stepId) return null;
        return quest.steps.find((s) => s.id === stepId) || null;
    }

    jumpToStep(quest, stepId) {
        if (!quest || !stepId) return false;
        const idx = quest.steps.findIndex((s) => s.id === stepId);
        if (idx < 0) return false;
        quest.currentStepIndex = idx;
        quest.lastUpdated = now();
        return true;
    }

    finishQuest(quest, outcome = 'success') {
        quest.status = 'completed';
        quest.currentStepIndex = quest.steps.length;

        if (!this.completedQuests.find((q) => q.id === quest.id)) {
            this.completedQuests.push(quest);
        }
        this.activeQuests = this.activeQuests.filter((q) => q.id !== quest.id);

        const rewardResult = this.rewardSystem.applyRewards(quest, quest.rewards);
        if (rewardResult.applied && this.game.ui?.showMessage) {
            const label = rewardResult.summary.length ? rewardResult.summary.join(' | ') : 'No rewards';
            this.game.ui.showMessage(`Quest rewards: ${label}`, 'success');
            this.game.ui.setupBuildingPanel?.();
        }

        eventBus.emit(EVENT_TYPES.QUEST_COMPLETED, {
            questId: quest.id,
            outcome,
            tick: now()
        });
    }

    advanceQuest(quest) {
        if (!quest || quest.status === 'completed' || quest.status === 'failed') return false;

        if (quest.currentStepIndex >= quest.steps.length) {
            this.finishQuest(quest, 'success');
            return false;
        }

        const currentStep = quest.steps[quest.currentStepIndex];
        const result = this.executeStep(quest, currentStep);
        if (!result?.done) return false;

        if (!quest.completedSteps.includes(currentStep.id)) {
            quest.completedSteps.push(currentStep.id);
            eventBus.emit(EVENT_TYPES.QUEST_STEP_COMPLETED, {
                questId: quest.id,
                stepId: currentStep.id,
                tick: now()
            });
        }

        if (result.nextStepId) {
            this.jumpToStep(quest, result.nextStepId);
        } else {
            quest.currentStepIndex++;
        }

        quest.lastUpdated = now();

        if (quest.currentStepIndex >= quest.steps.length) {
            this.finishQuest(quest, 'success');
        }

        return true;
    }

    tryAdvanceQuest(quest) {
        const currentStep = quest?.steps?.[quest.currentStepIndex];
        if (!currentStep) return false;
        if (currentStep.autoAdvance) return this.advanceQuest(quest);
        return false;
    }

    executeStep(quest, step) {
        switch (step.kind) {
            case STEP_KINDS.TRIGGER:
                return this.handleTriggerStep(quest, step);
            case STEP_KINDS.HACK_NODE:
                return this.handleHackNodeStep(quest, step);
            case STEP_KINDS.GO_TO:
                return this.handleGoToStep(quest, step);
            case STEP_KINDS.CHOICE:
                return this.handleChoiceStep(quest, step);
            case STEP_KINDS.INVESTIGATE:
                return this.handleInvestigateStep(quest, step);
            case STEP_KINDS.INTERACT:
                return this.handleInteractStep(quest, step);
            case STEP_KINDS.OUTCOME:
                return this.handleOutcomeStep(quest, step);
            case STEP_KINDS.CONDITIONAL:
                return this.handleConditionalStep(quest, step);
            case STEP_KINDS.SPAWN_CLUE:
                return this.handleSpawnClueStep(quest, step);
            default:
                return { done: true };
        }
    }

    handleTriggerStep(quest, step) {
        const triggered = !!quest.data.triggers?.[step.trigger];
        return { done: triggered };
    }

    handleHackNodeStep(quest, step) {
        const wantedType = normalizeNodeType(step.nodeType);
        const node = this.findNodeByType(wantedType);
        if (node && node.state === 'success') {
            if (Array.isArray(step.onComplete)) {
                for (const effect of step.onComplete) {
                    this.applyEffect(effect, quest);
                }
            }
            return { done: true };
        }

        const nearbyNode = this.game.interactables?.getNearbyInteractable?.(
            this.game.state.player.x,
            this.game.state.player.y
        );

        if (nearbyNode && normalizeNodeType(nearbyNode.type) === wantedType && nearbyNode.state === 'available') {
            this.game.ui?.showMessage?.(`Press E to hack ${getInteractableTypeInfo(nearbyNode.type).name}.`, 'normal');
        }

        return { done: false };
    }

    handleGoToStep(quest, step) {
        if (Number.isFinite(step.targetX) && Number.isFinite(step.targetY)) {
            const dist = Math.abs(this.game.state.player.x - step.targetX) + Math.abs(this.game.state.player.y - step.targetY);
            if (!quest.data.markers.find((m) => m.stepId === step.id)) {
                quest.data.markers.push({ stepId: step.id, x: step.targetX, y: step.targetY, type: 'waypoint' });
            }
            return { done: dist <= 2 };
        }
        return { done: false };
    }

    handleChoiceStep(quest, step) {
        quest.data.choices = Array.isArray(step.choices) ? step.choices : [];
        if (quest.data.choicePending === step.id) return { done: false };

        quest.data.choicePending = step.id;
        this.game.ui?.showQuestChoice?.(step.text || 'Choose', quest.data.choices, (choice) => {
            eventBus.emit(EVENT_TYPES.PLAYER_DECISION, {
                questId: quest.id,
                stepId: step.id,
                choiceId: choice.id,
                choice,
            });
        });

        return { done: false };
    }

    handleInvestigateStep(quest, step) {
        if (step.requiresEvidenceId) {
            const caseId = this.game.caseManager?.getCaseIdByQuest?.(quest.id);
            const has = this.game.evidenceSystem?.hasEvidence?.(caseId, step.requiresEvidenceId);
            if (!has) return { done: false };
        }
        const target = quest.data.targetLocation || (Number.isFinite(step.targetX) && Number.isFinite(step.targetY)
            ? { x: step.targetX, y: step.targetY }
            : null);

        if (!target) return { done: true };

        const dist = Math.abs(this.game.state.player.x - target.x) + Math.abs(this.game.state.player.y - target.y);
        return { done: dist <= 2 };
    }

    handleInteractStep(quest, step) {
        const citizen = step.targetCitizen;
        if (!citizen) return { done: false };
        const dist = Math.abs(this.game.state.player.x - citizen.x) + Math.abs(this.game.state.player.y - citizen.y);
        return { done: dist <= 2 };
    }

    handleOutcomeStep(quest, step) {
        if (step.outcomes?.length) {
            const outcome = step.outcomes[0];
            this.applyOutcome(outcome);
            quest.data.outcome = outcome;
        }
        return { done: true };
    }

    handleConditionalStep(quest, step) {
        const passed = this.evaluateCondition(step.condition, quest);
        const nextStepId = passed ? step.thenStep : step.elseStep;
        return { done: true, nextStepId };
    }

    handleSpawnClueStep(quest, step) {
        const clueId = step.clueId || step.id;
        if (!quest.data.clues.find((c) => c.id === clueId)) {
            quest.data.clues.push({ id: clueId, timestamp: now() });
        }
        return { done: true };
    }

    handlePlayerDecision(data) {
        const quest = this.getQuestById(data.questId);
        if (!quest || quest.status !== 'active') return;

        const step = this.getStepById(quest, data.stepId);
        const choice = data.choice || step?.choices?.find((c) => c.id === data.choiceId);
        if (!choice) return;

        if (choice.effect) this.applyEffect(choice.effect, quest);
        if (Array.isArray(choice.effects)) {
            for (const effect of choice.effects) this.applyEffect(effect, quest);
        }
        if (Array.isArray(choice.setFlags)) {
            for (const f of choice.setFlags) {
                if (typeof f === 'string') quest.data.flags[f] = true;
            }
        }
        if (choice.runFlags && typeof choice.runFlags === 'object') {
            const runFlags = this.game.state.progress?.runFlags || (this.game.state.progress.runFlags = {});
            for (const [k, v] of Object.entries(choice.runFlags)) runFlags[k] = v;
        }
        if (Number.isFinite(choice.heatDelta) && this.game.heatSystem?.addHeat) {
            this.game.heatSystem.addHeat(choice.heatDelta);
        }
        if (Number.isFinite(choice.reputationDelta)) {
            const prev = this.game.state.player.reputation || 0;
            this.game.state.player.reputation = Math.max(0, Math.min(100, prev + choice.reputationDelta));
        }

        quest.data.choicePending = null;

        if (choice.nextStep && this.jumpToStep(quest, choice.nextStep)) {
            this.advanceQuest(quest);
            return;
        }

        this.advanceQuest(quest);
    }

    handleHackedNode(interactable, success) {
        if (!success || !interactable) return;

        for (const quest of this.activeQuests) {
            const step = quest.steps[quest.currentStepIndex];
            if (!step || step.kind !== STEP_KINDS.HACK_NODE) continue;
            const wanted = normalizeNodeType(step.nodeType);
            if (normalizeNodeType(interactable.type) !== wanted) continue;
            this.advanceQuest(quest);
        }
    }

    handleEnteredDistrict(districtId) {
        for (const quest of this.activeQuests) {
            quest.data.lastDistrict = districtId;
        }
    }

    handleAnomaly(anomalyType, details) {
        for (const quest of this.activeQuests) {
            const step = quest.steps[quest.currentStepIndex];
            if (!step || step.kind !== STEP_KINDS.TRIGGER) continue;
            if (step.trigger === anomalyType) {
                quest.data.triggers[anomalyType] = true;
                this.advanceQuest(quest);
            }
        }

        // If no active quest was waiting, keep anomaly in state only.
        const anomalies = this.game.state.world?.anomalies || [];
        if (!anomalies.find((a) => a.type === anomalyType && a.tick === (this.game.state.time?.tick || 0))) {
            // no-op; anomaly detectors already append to world list.
        }
        void details;
    }

    handleInteractableAvailable(interactable) {
        if (!interactable) return;
        for (const quest of this.activeQuests) {
            const step = quest.steps[quest.currentStepIndex];
            if (!step || step.kind !== STEP_KINDS.HACK_NODE) continue;
            if (normalizeNodeType(step.nodeType) !== normalizeNodeType(interactable.type)) continue;
            const dist = Math.abs(this.game.state.player.x - interactable.x) + Math.abs(this.game.state.player.y - interactable.y);
            if (dist <= 5) {
                this.game.ui?.showMessage?.(`Node available for quest: ${interactable.name}`, 'normal');
            }
        }
    }

    findNodeByType(nodeType) {
        const wanted = normalizeNodeType(nodeType);
        return this.game.interactables?.interactables?.find((n) => normalizeNodeType(n.type) === wanted && n.state === 'success');
    }

    evaluateCondition(condition, quest) {
        if (!condition) return true;

        if (Array.isArray(condition.and)) {
            return condition.and.every((c) => this.evaluateCondition(c, quest));
        }
        if (Array.isArray(condition.or)) {
            return condition.or.some((c) => this.evaluateCondition(c, quest));
        }

        const type = condition.type;
        if (type === 'run_flag') {
            const key = condition.key;
            const expected = condition.equals ?? true;
            const actual = this.game.state.progress?.runFlags?.[key];
            return actual === expected;
        }

        if (type === 'quest_flag') {
            const key = condition.key;
            const expected = condition.equals ?? true;
            const actual = quest?.data?.flags?.[key];
            return actual === expected;
        }

        if (type === 'metric') {
            const name = condition.name;
            const op = condition.op || 'gte';
            const value = Number(condition.value || 0);
            let actual = 0;
            if (name === 'heat') actual = Number(this.game.state.player.heat || 0);
            else if (name === 'reputation') actual = Number(this.game.state.player.reputation || 0);
            else if (name === 'happiness') actual = Number(this.game.citizens?.getAverageHappiness?.() || 0);
            else if (name === 'district_security') actual = Number(this.game.servicesManager?.metrics?.city?.police || 0);

            if (op === 'gt') return actual > value;
            if (op === 'lt') return actual < value;
            if (op === 'lte') return actual <= value;
            if (op === 'eq') return actual === value;
            return actual >= value;
        }

        if (type === 'district_type') {
            const districtId = this.game.map.getDistrictAt(this.game.state.player.x, this.game.state.player.y);
            const district = this.game.map.districts?.find((d) => d.id === districtId);
            return district?.theme === condition.value;
        }

        if (type === 'has_clue') {
            return this.hasClue(condition.clueId);
        }

        if (type === 'quest_completed') {
            return this.getQuestById(condition.questId)?.status === 'completed';
        }

        return true;
    }

    hasClue(clueId) {
        for (const quest of [...this.activeQuests, ...this.completedQuests]) {
            if (quest.data.clues.find((c) => c.id === clueId)) return true;
        }
        return false;
    }

    applyEffect(effect, quest) {
        if (Array.isArray(effect)) {
            for (const e of effect) this.applyEffect(e, quest);
            return;
        }

        if (typeof effect === 'object' && effect) {
            if (effect.runFlags && typeof effect.runFlags === 'object') {
                const runFlags = this.game.state.progress?.runFlags || (this.game.state.progress.runFlags = {});
                for (const [k, v] of Object.entries(effect.runFlags)) runFlags[k] = v;
            }
            if (effect.questFlags && typeof effect.questFlags === 'object') {
                for (const [k, v] of Object.entries(effect.questFlags)) quest.data.flags[k] = v;
            }
            if (Number.isFinite(effect.heatDelta) && this.game.heatSystem?.addHeat) this.game.heatSystem.addHeat(effect.heatDelta);
            if (Number.isFinite(effect.reputationDelta)) {
                const prev = this.game.state.player.reputation || 0;
                this.game.state.player.reputation = Math.max(0, Math.min(100, prev + effect.reputationDelta));
            }
            return;
        }

        if (typeof effect !== 'string') return;

        if (effect.startsWith('gains_clue:')) {
            const clueId = effect.split(':')[1];
            if (!quest.data.clues.find((c) => c.id === clueId)) {
                const clue = { id: clueId, timestamp: now() };
                quest.data.clues.push(clue);
                this.game.evidenceSystem?.registerClueEvidence?.(quest, clueId);
                eventBus.emit(EVENT_TYPES.CLUE_DISCOVERED, { questId: quest.id, clue });
            }
            return;
        }

        if (effect.startsWith('spawn_clue:')) {
            const clueId = effect.split(':')[1];
            if (!quest.data.clues.find((c) => c.id === clueId)) {
                quest.data.clues.push({ id: clueId, timestamp: now() });
                this.game.evidenceSystem?.registerClueEvidence?.(quest, clueId);
            }
            return;
        }

        if (effect.startsWith('set_flag:')) {
            const key = effect.split(':')[1];
            if (key) this.game.state.progress.runFlags[key] = true;
            return;
        }

        if (effect === 'reputation_high') {
            this.game.state.player.reputation = Math.min(100, (this.game.state.player.reputation || 0) + 10);
            return;
        }
        if (effect === 'reputation_lost') {
            this.game.state.player.reputation = Math.max(0, (this.game.state.player.reputation || 0) - 10);
            return;
        }
        if (effect === 'heat_rival_high') {
            this.game.heatSystem?.addHeat?.(8);
            return;
        }
        if (effect === 'heat_rival_low') {
            this.game.heatSystem?.addHeat?.(-6);
        }
    }

    applyOutcome(outcome) {
        if (!outcome) return;

        if (outcome.effect) {
            this.applyEffect(outcome.effect, { data: { clues: [] } });
            if (Array.isArray(outcome.effect)) {
                for (const mod of outcome.effect) this.applyDistrictModifier(mod);
            }
        }

        if (outcome.factionImpact) {
            for (const [faction, impact] of Object.entries(outcome.factionImpact)) {
                this.applyFactionImpact(faction, impact);
            }
        }
    }

    applyDistrictModifier(modifier, value) {
        let districtId = this.game.map.getDistrictAt(this.game.state.player.x, this.game.state.player.y);
        let modifierName = modifier;
        let modifierValue = value;

        if (typeof modifier === 'string') {
            const parts = modifier.split('_');
            if (parts.length >= 3) {
                modifierName = parts[2];
                modifierValue = -0.1;
                if (parts[3] === 'up') modifierValue = 0.1;
                if (parts[3] === 'down') modifierValue = -0.1;
                const districtByTheme = this.game.map.districts?.find((d) => d.theme === parts[1]);
                if (districtByTheme) districtId = districtByTheme.id;
            }
        }

        const districts = this.game.map.districts || [];
        const district = districts.find((d) => d.id === districtId);
        if (!district) return;
        district.modifiers = district.modifiers || [];

        const existing = district.modifiers.find((m) => m.name === modifierName);
        if (existing) existing.value = (existing.value || 0) + (modifierValue || 0);
        else district.modifiers.push({ name: modifierName, value: modifierValue || 0, appliedAt: now() });
    }

    applyFactionImpact(faction, impact) {
        const factions = this.game.state.factions || (this.game.state.factions = {});
        factions.reputation = factions.reputation || {};

        const applyOne = (key, delta) => {
            const prev = Number(factions.reputation[key] || 0);
            factions.reputation[key] = Math.max(-100, Math.min(100, prev + delta));
        };

        if (faction === 'all_factions') {
            ['citizens', 'police', 'gangs', 'corp'].forEach((f) => applyOne(f, impact));
            return;
        }

        applyOne(faction, impact);
    }

    update() {
        for (const quest of [...this.activeQuests]) {
            if (quest.status !== 'active' && quest.status !== 'blocked') continue;

            const currentStep = quest.steps[quest.currentStepIndex];
            if (!currentStep) {
                this.finishQuest(quest, 'success');
                continue;
            }

            if (currentStep.autoAdvance && currentStep.autoAdvance > 0) {
                quest.autoAdvanceTimer = (quest.autoAdvanceTimer || 0) + 1;
                if (quest.autoAdvanceTimer >= currentStep.autoAdvance) {
                    this.advanceQuest(quest);
                    quest.autoAdvanceTimer = 0;
                }
            }

            if (!this.canCompleteStep(quest, currentStep)) {
                if (quest.status !== 'blocked') {
                    quest.status = 'blocked';
                    quest.blockedReason = 'Waiting for player action';
                    eventBus.emit(EVENT_TYPES.QUEST_BLOCKED, {
                        questId: quest.id,
                        reason: quest.blockedReason,
                        tick: now()
                    });
                }
            } else if (quest.status === 'blocked') {
                quest.status = 'active';
                quest.blockedReason = null;
            }

            // Execute conditionally-completable steps continuously.
            if ([STEP_KINDS.GO_TO, STEP_KINDS.INVESTIGATE, STEP_KINDS.INTERACT, STEP_KINDS.CONDITIONAL].includes(currentStep.kind)) {
                this.advanceQuest(quest);
            }
        }
    }

    canCompleteStep(quest, step) {
        switch (step.kind) {
            case STEP_KINDS.TRIGGER:
                return !!quest.data.triggers?.[step.trigger];
            case STEP_KINDS.HACK_NODE:
                return this.findNodeByType(step.nodeType) !== undefined;
            case STEP_KINDS.GO_TO:
            case STEP_KINDS.INVESTIGATE:
            case STEP_KINDS.INTERACT:
            case STEP_KINDS.CONDITIONAL:
                return true;
            case STEP_KINDS.CHOICE:
                return Array.isArray(quest.data.choices) && quest.data.choices.length > 0;
            case STEP_KINDS.OUTCOME:
            default:
                return true;
        }
    }

    getQuestsByStatus(status) {
        return status === 'active' ? this.activeQuests : this.completedQuests;
    }

    serialize() {
        return {
            activeQuests: this.activeQuests.map((q) => ({
                id: q.id,
                status: q.status,
                currentStepIndex: q.currentStepIndex,
                completedSteps: q.completedSteps,
                data: q.data,
                context: q.context,
            })),
            completedQuests: this.completedQuests.map((q) => ({
                id: q.id,
                outcome: q.data.outcome,
                data: q.data,
                context: q.context,
            }))
        };
    }

    deserialize(data) {
        if (!data) return;
        const defs = this.game.content?.quests || [];

        this.activeQuests = (data.activeQuests || []).map((qData) => {
            const questDef = defs.find((q) => q.id === qData.id);
            if (!questDef) return null;

            const quest = createQuestInstance(questDef, qData.context || {});
            quest.status = qData.status;
            quest.currentStepIndex = qData.currentStepIndex;
            quest.completedSteps = qData.completedSteps || [];
            quest.data = { ...quest.data, ...(qData.data || {}) };
            quest.lastUpdated = now();
            return quest;
        }).filter(Boolean);

        this.completedQuests = (data.completedQuests || []).map((qData) => {
            const questDef = defs.find((q) => q.id === qData.id);
            if (!questDef) return null;

            const quest = createQuestInstance(questDef, qData.context || {});
            quest.status = 'completed';
            quest.currentStepIndex = quest.steps.length;
            quest.data = { ...quest.data, ...(qData.data || {}) };
            quest.data.outcome = qData.outcome;
            return quest;
        }).filter(Boolean);
    }

    reset() {
        this.activeQuests = [];
        this.completedQuests = [];
    }
}
