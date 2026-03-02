import { eventBus, EVENT_TYPES } from '../events.js';
import { CaseAssembler } from './assembler.js';

const ANOMALY_TO_CASE = {
    missing_person: 'missing_person',
    blackmail: 'corruption',
    workplace_conflict: 'extortion',
};

export class CaseManager {
    constructor(game) {
        this.game = game;
        this.assembler = new CaseAssembler(game);
        this.questToCase = new Map();
        this.ensureState();
        this.rebuildQuestMap();
        this.setupListeners();
    }

    ensureState() {
        const cases = this.game.state.cases || (this.game.state.cases = {});
        cases.active = cases.active || [];
        cases.completed = cases.completed || [];
        cases.evidence = cases.evidence || [];
        cases.nextCaseSeed = Math.max(1, cases.nextCaseSeed || 1);
    }

    setupListeners() {
        eventBus.on(EVENT_TYPES.ANOMALY_FOUND, (data) => {
            const type = ANOMALY_TO_CASE[data.type];
            if (!type) return;
            if (this.hasActiveType(type)) return;
            this.spawnCase(type, { districtId: data.districtId, triggerAnomaly: data.type });
        }, this);

        eventBus.on(EVENT_TYPES.QUEST_COMPLETED, (data) => {
            this.onQuestCompleted(data.questId);
        }, this);
    }

    rebuildQuestMap() {
        this.questToCase.clear();
        const active = this.game.state.cases?.active || [];
        for (const c of active) {
            for (const qid of c.questIds || []) this.questToCase.set(qid, c.id);
        }
    }

    hasActiveType(type) {
        return (this.game.state.cases?.active || []).some((c) => c.type === type);
    }

    getCaseById(id) {
        const all = [...(this.game.state.cases?.active || []), ...(this.game.state.cases?.completed || [])];
        return all.find((c) => c.id === id) || null;
    }

    getCaseIdByQuest(questId) {
        return this.questToCase.get(questId) || null;
    }

    getCaseByQuest(questId) {
        const caseId = this.getCaseIdByQuest(questId);
        return caseId ? this.getCaseById(caseId) : null;
    }

    spawnCase(type, options = {}) {
        this.ensureState();
        const seed = (options.seed ?? this.game.state.cases.nextCaseSeed++) >>> 0;
        const caseObj = this.assembler.assemble(type, { ...options, seed });

        this.game.state.cases.active.push(caseObj);
        this.startCurrentChapter(caseObj, options.triggerAnomaly);
        this.game.ui?.showMessage?.(`Case started: ${caseObj.type.replace('_', ' ')}`, 'success');
        return caseObj;
    }

    startCurrentChapter(caseObj, triggerAnomaly = null) {
        if (!caseObj.chapters || !Array.isArray(caseObj.chapters)) {
            console.warn(`Case ${caseObj.id} missing valid chapters array.`);
            return;
        }

        const chapterIndex = caseObj.currentChapter || 0;
        const chapter = caseObj.chapters[chapterIndex];
        if (!chapter) {
            console.warn(`Case ${caseObj.id} chapter ${chapterIndex} not found.`);
            return;
        }

        const questDef = {
            id: chapter.id,
            type: 'casefile',
            title: `${caseObj.type.replace('_', ' ')} / ${chapter.title}`,
            description: `Case ${caseObj.id} chapter ${chapterIndex + 1}`,
            tags: [caseObj.type, 'case_chapter'],
            steps: chapter.steps,
            rewards: chapter.rewards || [],
            trigger: chapter.trigger || null,
        };

        const quest = this.game.questEngine.addQuest(questDef, {
            caseId: caseObj.id,
            caseType: caseObj.type,
            districtId: caseObj.districtId,
            suspectId: caseObj.suspects?.[0]?.id || null,
        });
        if (triggerAnomaly) {
            quest.data.triggers = quest.data.triggers || {};
            quest.data.triggers[triggerAnomaly] = true;
            this.game.questEngine.advanceQuest(quest);
        }
        caseObj.questIds.push(quest.id);
        this.questToCase.set(quest.id, caseObj.id);
    }

    onQuestCompleted(questId) {
        const caseId = this.getCaseIdByQuest(questId);
        if (!caseId) {
            console.warn(`[CaseManager] Quest ${questId} not found in active map.`);
            return;
        }

        const caseObj = (this.game.state.cases.active || []).find((c) => c.id === caseId);
        if (!caseObj) {
            console.warn(`[CaseManager] Case ${caseId} not found in active state.`);
            return;
        }

        if (!caseObj.chapters || !Array.isArray(caseObj.chapters)) {
            console.warn(`[CaseManager] Case ${caseObj.id} has no valid chapters array.`);
            return;
        }

        const chapterIdx = caseObj.currentChapter || 0;
        const expectedChapter = caseObj.chapters[chapterIdx];

        if (!expectedChapter) {
            console.error(`[CaseManager] Case ${caseObj.id} missing expected chapter at index ${chapterIdx}.`);
            return;
        }

        if (expectedChapter.id === questId) {
            caseObj.currentChapter++;
        } else {
            console.warn(`[CaseManager] Case ${caseObj.id} completed quest ${questId} but expected ${expectedChapter.id}. Scanning forward...`);
            const foundChapterIdx = caseObj.chapters.findIndex((ch, idx) => idx >= chapterIdx && ch.id === questId);
            if (foundChapterIdx !== -1) {
                if (foundChapterIdx > chapterIdx) {
                    console.warn(`[CaseManager] Case ${caseObj.id} skipped to chapter ${foundChapterIdx + 1} (expected ${chapterIdx + 1}).`);
                }
                caseObj.currentChapter = foundChapterIdx + 1;
            } else {
                console.error(`[CaseManager] Case ${caseObj.id} could not find quest ${questId} in remaining chapters.`);
                return;
            }
        }

        if (caseObj.currentChapter >= caseObj.chapters.length) {
            caseObj.status = 'completed';
            this.game.state.cases.active = this.game.state.cases.active.filter((c) => c.id !== caseObj.id);
            this.game.state.cases.completed.push(caseObj);
            this.game.ui?.showMessage?.(`Case completed: ${caseObj.type.replace('_', ' ')}`, 'success');
            this.rebuildQuestMap();
            return;
        }

        this.startCurrentChapter(caseObj);
    }

    update() {
        this.ensureState();
    }
}
