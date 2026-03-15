// Citizen Profile UI - delegates rendering to CitizenProfile.svelte
import { citizenProfileStore } from '../stores/citizen_profile.js';

export class CitizenProfileData {
    constructor(citizen, game) {
        this.citizen = citizen;
        this.game = game;
        this.household = game.housingManager?.households?.get(citizen.householdId) || null;
        this.connections = game.socialGraph?.getCitizenConnections(citizen.id) || [];
        this.crimeRecord = this._getCrimeRecord();
    }

    _getCrimeRecord() {
        if (!this.game.crimeGenerator) return [];
        const incidents = [];
        for (const incident of this.game.crimeGenerator.incidents.values()) {
            if (incident.perpetratorId === this.citizen.id) incidents.push(incident);
        }
        return incidents.slice(-5);
    }

    getName()     { return this.citizen.name || `Citizen #${this.citizen.id}`; }
    getAge()      { return this.citizen.age || 18; }
    getMood()     { return this.citizen.mood || 'content'; }
    getHappiness(){ return this.citizen.happiness || 50; }
    getTraits()   { const p = this.citizen.personality || { primary: 'adaptive', secondary: 'steady' }; return [p.primary, p.secondary]; }
    getNeeds()    { const n = this.citizen.needs || {}; return { food: n.food ?? 100, rest: n.rest ?? 100, safety: n.safety ?? 100 }; }
    getJob() {
        if (!this.citizen.job || this.citizen.job === 'unemployed') return { title: 'Unemployed', income: 0, status: 'unemployed' };
        const info = this.game.jobsManager?.getJobInfo?.(this.citizen.job) || { baseSalary: this.citizen.salary || 0, name: this.citizen.job };
        return { title: info.name || this.citizen.job, income: info.baseSalary || this.citizen.salary || 0, status: 'employed' };
    }
    getHouseholdInfo() {
        if (!this.household) return { name: 'No household', capacity: 0, members: 0, quality: 0 };
        return { name: this.household.homeBuildingId ? 'Residence' : 'Household', capacity: this.household.capacity, members: this.household.members.length, quality: this.household.housingQuality };
    }
}

export class CitizenProfileUI {
    constructor(game) {
        this.game = game;
        this.selectedCitizenId = null;
        this.open = false;
    }

    selectCitizen(id) {
        this.selectedCitizenId = id;
        this.open = true;
        this.refresh();
    }

    deselect() {
        this.selectedCitizenId = null;
        this.open = false;
        citizenProfileStore.update(s => ({ ...s, open: false }));
    }

    toggle(force = null) {
        this.open = force !== null ? force : !this.open;
        if (this.open && this.selectedCitizenId) this.refresh();
        else citizenProfileStore.update(s => ({ ...s, open: this.open }));
    }

    refresh() {
        if (!this.selectedCitizenId) return;
        const citizen = this.game.citizens.getCitizenById(this.selectedCitizenId);
        if (!citizen) { this.deselect(); return; }

        const d = new CitizenProfileData(citizen, this.game);
        const connections = d.connections.slice(0, 5).map(conn => {
            const other = this.game.citizens.getCitizenById(conn.id);
            return { id: conn.id, type: conn.type, affinity: conn.affinity, name: other ? `Citizen #${conn.id}` : `Unknown #${conn.id}` };
        });

        citizenProfileStore.set({
            open: true,
            citizenId: citizen.id,
            name: d.getName(),
            meta: `ID #${citizen.id} • Tick ${citizen.createdAt}`,
            age: d.getAge(),
            happiness: d.getHappiness(),
            mood: d.getMood(),
            traits: d.getTraits(),
            needs: d.getNeeds(),
            job: d.getJob(),
            household: d.getHouseholdInfo(),
            connections,
            crimeRecord: d.crimeRecord.map(i => ({ name: i.name, severity: i.severity, status: i.status })),
        });
    }

    // Legacy compat
    create() {}
}
