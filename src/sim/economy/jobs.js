const BUILDING_JOB_CONFIG = {
    house: [],
    farm: [{ role: 'farmer', slots: 2, wage: 3 }],
    'lumber-mill': [{ role: 'lumberjack', slots: 2, wage: 3 }],
    market: [{ role: 'merchant', slots: 3, wage: 4 }],
    warehouse: [{ role: 'craftsman', slots: 2, wage: 4 }],
    'town-hall': [{ role: 'official', slots: 2, wage: 5 }],
    barracks: [{ role: 'soldier', slots: 3, wage: 6 }],
    school: [{ role: 'teacher', slots: 2, wage: 5 }],
    'police-station': [{ role: 'soldier', slots: 2, wage: 6 }],
    'cctv-network': [{ role: 'official', slots: 1, wage: 4 }],
    counterintel: [{ role: 'official', slots: 1, wage: 5 }],
    'propaganda-office': [{ role: 'official', slots: 1, wage: 4 }],
};

function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export class JobsManager {
    constructor(game) {
        this.game = game;
        this.staffingByBuilding = new Map();
        this.totalWageCost = 0;
    }

    updateAssignments() {
        const citizens = this.game.citizens.citizens;
        const buildings = this.game.buildings.buildings;
        this.staffingByBuilding.clear();
        this.totalWageCost = 0;

        const slots = [];
        for (const b of buildings) {
            const jobs = BUILDING_JOB_CONFIG[b.type] || [];
            let totalSlots = 0;
            for (const cfg of jobs) {
                totalSlots += cfg.slots;
                for (let i = 0; i < cfg.slots; i++) {
                    slots.push({
                        buildingId: b.id,
                        role: cfg.role,
                        wage: cfg.wage,
                        x: b.x,
                        y: b.y,
                        occupiedBy: null,
                    });
                }
            }
            if (totalSlots > 0) {
                this.staffingByBuilding.set(b.id, { assigned: 0, slots: totalSlots, ratio: 0 });
            }
        }

        // Release invalid assignments.
        const buildingIds = new Set(buildings.map((b) => b.id));
        for (const c of citizens) {
            if (!buildingIds.has(c.workBuildingId)) {
                c.workBuildingId = null;
                c.job = 'unemployed';
            }
            if (c.job === 'unemployed') {
                c.unemployedTicks = (c.unemployedTicks || 0) + 1;
            } else {
                c.unemployedTicks = 0;
            }
        }

        // Assign employed citizens to matching slots first.
        for (const c of citizens) {
            if (!c.workBuildingId || c.job === 'unemployed') continue;
            const slot = slots.find((s) => s.buildingId === c.workBuildingId && s.role === c.job && s.occupiedBy === null);
            if (slot) slot.occupiedBy = c.id;
            else {
                c.workBuildingId = null;
                c.job = 'unemployed';
            }
        }

        // Assign unemployed deterministically by id.
        const unemployed = citizens.filter((c) => c.job === 'unemployed').sort((a, b) => a.id - b.id);
        for (const c of unemployed) {
            const radius = Math.min(120, 40 + Math.floor((c.unemployedTicks || 0) / 5) * 10);
            const candidates = slots
                .filter((s) => s.occupiedBy === null)
                .map((s) => ({ slot: s, dist: manhattan(c, s) }))
                .filter((entry) => entry.dist <= radius)
                .sort((a, b) => {
                    const wageDiff = b.slot.wage - a.slot.wage;
                    if (wageDiff !== 0) return wageDiff;
                    if (a.dist !== b.dist) return a.dist - b.dist;
                    if (a.slot.buildingId !== b.slot.buildingId) return a.slot.buildingId - b.slot.buildingId;
                    return a.slot.role.localeCompare(b.slot.role);
                });
            if (candidates.length === 0) continue;
            const picked = candidates[0].slot;
            picked.occupiedBy = c.id;
            c.job = picked.role;
            c.workBuildingId = picked.buildingId;
            c.salary = picked.wage;
            c.unemployedTicks = 0;
        }

        // Compute staffing ratios + wage burden.
        for (const slot of slots) {
            const rec = this.staffingByBuilding.get(slot.buildingId);
            if (!rec) continue;
            if (slot.occupiedBy !== null) {
                rec.assigned++;
                this.totalWageCost += slot.wage;
            }
        }
        for (const rec of this.staffingByBuilding.values()) {
            rec.ratio = rec.slots > 0 ? Math.max(0, Math.min(1, rec.assigned / rec.slots)) : 1;
        }
    }

    getStaffingRatio(buildingId) {
        const rec = this.staffingByBuilding.get(buildingId);
        if (!rec) return 1;
        return rec.ratio;
    }

    scaleIncome(income, buildings) {
        let totalWeight = 0;
        let weightedRatio = 0;
        for (const b of buildings) {
            const baseIncome = Math.abs((b.income?.gold || 0)) + Math.abs((b.income?.food || 0)) + Math.abs((b.income?.wood || 0));
            if (baseIncome <= 0) continue;
            totalWeight += baseIncome;
            weightedRatio += this.getStaffingRatio(b.id) * baseIncome;
        }
        const ratio = totalWeight > 0 ? weightedRatio / totalWeight : 1;
        return {
            gold: Math.floor((income.gold || 0) * ratio),
            food: Math.floor((income.food || 0) * ratio),
            wood: Math.floor((income.wood || 0) * ratio),
            ratio,
        };
    }

    applyWages(resources) {
        const wageCost = Math.max(0, Math.floor(this.totalWageCost));
        resources.remove('gold', wageCost);
        return wageCost;
    }
}

