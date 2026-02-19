export class RewardSystem {
    constructor(game) {
        this.game = game;
    }

    ensureProgressState() {
        const progress = this.game.state.progress || (this.game.state.progress = {});
        progress.runFlags = progress.runFlags || {};
        progress.unlocks = progress.unlocks || { buildings: [], hacks: [] };
        progress.rewardLog = progress.rewardLog || {};
        return progress;
    }

    wasApplied(questId) {
        const progress = this.ensureProgressState();
        return !!progress.rewardLog[questId];
    }

    markApplied(questId, summary = []) {
        const progress = this.ensureProgressState();
        progress.rewardLog[questId] = {
            appliedAtTick: this.game.state.time?.tick || 0,
            summary,
        };
    }

    applyRewards(quest, rewards = []) {
        if (!quest || !quest.id) return { applied: false, reason: 'missing_quest', summary: [] };
        const progress = this.ensureProgressState();
        if (this.wasApplied(quest.id)) return { applied: false, reason: 'already_applied', summary: [] };

        const summary = [];
        for (const reward of rewards) {
            if (!reward || typeof reward !== 'object') continue;
            const type = reward.type;
            if (type === 'add_resource') {
                const resource = reward.resource;
                const amount = Number(reward.amount || 0);
                if (resource && Number.isFinite(amount) && this.game.resources?.add) {
                    this.game.resources.add(resource, amount);
                    summary.push(`${resource} ${amount >= 0 ? '+' : ''}${amount}`);
                }
                continue;
            }
            if (type === 'set_flag') {
                const key = reward.key;
                if (typeof key === 'string' && key.length > 0) {
                    progress.runFlags[key] = reward.value ?? true;
                    summary.push(`flag ${key}=${String(progress.runFlags[key])}`);
                }
                continue;
            }
            if (type === 'modify_heat') {
                const delta = Number(reward.delta || 0);
                if (Number.isFinite(delta) && this.game.heatSystem?.addHeat) {
                    this.game.heatSystem.addHeat(delta);
                    summary.push(`heat ${delta >= 0 ? '+' : ''}${delta}`);
                }
                continue;
            }
            if (type === 'rep_delta') {
                const amount = Number(reward.amount || 0);
                if (Number.isFinite(amount)) {
                    const prev = this.game.state.player.reputation || 0;
                    const next = Math.max(0, Math.min(100, prev + amount));
                    this.game.state.player.reputation = next;
                    summary.push(`reputation ${amount >= 0 ? '+' : ''}${amount}`);
                }
                continue;
            }
            if (type === 'unlock_building') {
                const id = reward.buildingId;
                if (typeof id === 'string' && !progress.unlocks.buildings.includes(id)) {
                    progress.unlocks.buildings.push(id);
                    summary.push(`building unlock ${id}`);
                }
                continue;
            }
            if (type === 'unlock_hack') {
                const id = reward.hackId;
                if (typeof id === 'string' && !progress.unlocks.hacks.includes(id)) {
                    progress.unlocks.hacks.push(id);
                    summary.push(`hack unlock ${id}`);
                }
            }
        }

        this.markApplied(quest.id, summary);
        return { applied: true, summary };
    }
}
