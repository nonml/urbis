// Politics Panel UI - Displays policies, appointments, and pressure map

import { POLICY_CATEGORIES, POLICY_STATES } from '../sim/politics/policies.js';
import { PRESSURE_LEVELS } from '../sim/politics/pressure_map.js';

const CATEGORY_LABELS = {
    [POLICY_CATEGORIES.ECONOMIC]: 'Economic',
    [POLICY_CATEGORIES.SOCIAL]: 'Social',
    [POLICY_CATEGORIES.SECURITY]: 'Security',
    [POLICY_CATEGORIES.INFRASTRUCTURE]: 'Infrastructure',
    [POLICY_CATEGORIES.DIPLOMACY]: 'Diplomacy'
};

const PRESSURE_LABELS = {
    [PRESSURE_LEVELS.NONE]: 'None',
    [PRESSURE_LEVELS.LOW]: 'Low',
    [PRESSURE_LEVELS.MEDIUM]: 'Medium',
    [PRESSURE_LEVELS.HIGH]: 'High',
    [PRESSURE_LEVELS.CRITICAL]: 'Critical'
};

export class PoliticsPanel {
    constructor(game) {
        this.game = game;
        this.root = null;
        this.activeTab = 'policies';
        this.policyRows = new Map();
        this.mount();
    }

    mount() {
        const container = document.getElementById('game-container');
        if (!container) return;
        this.root = document.createElement('div');
        this.root.id = 'politics-panel';
        this.root.className = 'politics-panel';
        this.root.innerHTML = `
            <div class="politics-tabs">
                <button class="tab-btn active" data-tab="policies">Policies</button>
                <button class="tab-btn" data-tab="appointments">Appointments</button>
                <button class="tab-btn" data-tab="pressure">Pressure Map</button>
            </div>
            <div class="politics-content">
                <div class="tab-content policies-tab active">
                    <div class="policy-list"></div>
                </div>
                <div class="tab-content appointments-tab">
                    <div class="appointment-list"></div>
                </div>
                <div class="tab-content pressure-tab">
                    <div class="pressure-info">Hover over map districts to see pressure levels</div>
                </div>
            </div>
            <div class="politics-status" id="politics-status"></div>
        `;
        container.appendChild(this.root);

        // Setup tab buttons
        this.root.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        this.policyListEl = this.root.querySelector('.policy-list');
        this.appointmentListEl = this.root.querySelector('.appointment-list');
        this.statusEl = this.root.querySelector('#politics-status');
    }

    switchTab(tabName) {
        this.activeTab = tabName;
        this.root.querySelectorAll('.tab-btn').forEach(btn => {
            btn.className = btn.dataset.tab === tabName ? 'tab-btn active' : 'tab-btn';
        });
        this.root.querySelectorAll('.tab-content').forEach(content => {
            content.className = `tab-content ${tabName}-tab ${tabName === this.activeTab ? 'active' : ''}`;
        });
        this.update();
    }

    update() {
        if (!this.root) return;

        // Update policy list
        if (this.activeTab === 'policies') {
            this.updatePolicyList();
        } else if (this.activeTab === 'appointments') {
            this.updateAppointmentList();
        }

        // Update politics status
        this.updateStatus();
    }

    updatePolicyList() {
        if (!this.policyListEl || !this.game.policyManager) return;

        const manager = this.game.policyManager;
        const enacted = manager.getEnactedPolicies();
        const pending = manager.getAvailablePolicies();
        const allPolicies = [...enacted, ...pending];

        this.policyListEl.innerHTML = '';
        const categories = {};

        // Group policies by category
        for (const policy of allPolicies) {
            const cat = policy.category || POLICY_CATEGORIES.ECONOMIC;
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(policy);
        }

        // Render by category
        for (const [catId, policies] of Object.entries(categories)) {
            const categoryEl = document.createElement('div');
            categoryEl.className = 'policy-category';
            categoryEl.innerHTML = `<div class="category-title">${CATEGORY_LABELS[catId] || catId}</div>`;
            this.policyListEl.appendChild(categoryEl);

            for (const policy of policies) {
                const row = document.createElement('div');
                row.className = 'policy-row';
                row.innerHTML = this.getPolicyRowHTML(policy, manager);
                categoryEl.appendChild(row);
            }
        }
    }

    getPolicyRowHTML(policy, manager) {
        const isEnacted = policy.state === POLICY_STATES.ENACTED;
        const remaining = manager.getPolicyRemainingTicks(policy.id);
        const canAct = manager.canEnactPolicy(policy.id) || isEnacted;

        if (isEnacted) {
            return `
                <div class="policy-info">
                    <span class="policy-name">${policy.name}</span>
                    <span class="policy-desc">${policy.description}</span>
                </div>
                <div class="policy-duration">
                    ${remaining} days remaining
                </div>
                <button class="policy-btn revoke" data-id="${policy.id}">Revoke</button>
            `;
        } else {
            const canEnact = manager.canEnactPolicy(policy.id);
            return `
                <div class="policy-info">
                    <span class="policy-name">${policy.name}</span>
                    <span class="policy-desc">${policy.description}</span>
                </div>
                <div class="policy-cost">
                    <span class="cost">Cost: ${policy.cost}g</span>
                    <span class="duration">${policy.duration} days</span>
                </div>
                <button class="policy-btn enact ${canEnact ? 'enabled' : 'disabled'}" data-id="${policy.id}">
                    ${canEnact ? 'Enact' : 'Too Low Rep'}
                </button>
            `;
        }
    }

    updateAppointmentList() {
        if (!this.appointmentListEl || !this.game.appointmentsManager) return;

        const manager = this.game.appointmentsManager;
        const appointments = manager.getAppointments();

        this.appointmentListEl.innerHTML = '';

        for (const appointment of appointments) {
            const row = document.createElement('div');
            row.className = 'appointment-row';
            row.innerHTML = `
                <div class="appointment-info">
                    <span class="appointment-title">${appointment.title}</span>
                    <span class="appointment-desc">${appointment.description}</span>
                </div>
                <div class="appointment-status">
                    <span class="appointment-rep">Rep: ${appointment.reputation || 0}</span>
                </div>
            `;
            this.appointmentListEl.appendChild(row);
        }
    }

    updateStatus() {
        if (!this.statusEl || !this.game.policyManager) return;

        const manager = this.game.policyManager;
        const enactedCount = manager.getEnactedPolicies().length;
        const totalBudget = this.game.state.resources.budget || 0;
        const monthlyCost = manager.getMonthlyCost();

        this.statusEl.innerHTML = `
            <span>Enacted Policies: ${enactedCount}</span> |
            <span>Monthly Cost: ${monthlyCost}g</span> |
            <span>Budget: ${totalBudget}g</span>
        `;
    }
}