import { POLICY_CATEGORIES, POLICY_STATES } from '../sim/politics/policies.js';
import { politicsStore } from '../stores/politics.js';

const CATEGORY_LABELS = {
    [POLICY_CATEGORIES.ECONOMIC]:       'Economic',
    [POLICY_CATEGORIES.SOCIAL]:         'Social',
    [POLICY_CATEGORIES.SECURITY]:       'Security',
    [POLICY_CATEGORIES.INFRASTRUCTURE]: 'Infrastructure',
    [POLICY_CATEGORIES.DIPLOMACY]:      'Diplomacy',
};

export class PoliticsPanel {
    constructor(game) {
        this.game = game;
    }

    update() {
        const pm = this.game.policyManager;
        const am = this.game.appointmentsManager;

        // Policies by category
        const categories = [];
        if (pm) {
            const enacted  = pm.getEnactedPolicies?.() ?? [];
            const pending  = pm.getAvailablePolicies?.() ?? [];
            const all      = [...enacted, ...pending];
            const catMap   = {};
            for (const p of all) {
                const catId = p.category || POLICY_CATEGORIES.ECONOMIC;
                if (!catMap[catId]) catMap[catId] = [];
                catMap[catId].push({
                    id:          p.id,
                    name:        p.name,
                    description: p.description,
                    enacted:     p.state === POLICY_STATES.ENACTED,
                    remaining:   pm.getPolicyRemainingTicks?.(p.id) ?? 0,
                    canEnact:    pm.canEnactPolicy?.(p.id) ?? false,
                    cost:        p.cost ?? 0,
                    duration:    p.duration ?? 0,
                });
            }
            for (const [catId, policies] of Object.entries(catMap)) {
                categories.push({ id: catId, label: CATEGORY_LABELS[catId] || catId, policies });
            }
        }

        // Appointments
        const appointments = am ? (am.getAppointments?.() ?? []).map(a => ({
            title:       a.title,
            description: a.description,
            reputation:  a.reputation || 0,
        })) : [];

        politicsStore.update(s => ({
            ...s,
            categories,
            appointments,
            enactedCount: pm ? (pm.getEnactedPolicies?.() ?? []).length : 0,
            monthlyCost:  pm ? (pm.getMonthlyCost?.() ?? 0) : 0,
            budget:       this.game.state.resources.budget || 0,
        }));
    }

    // Legacy compat
    mount()      {}
    switchTab(t) { politicsStore.update(s => ({ ...s, activeTab: t })); }
}
