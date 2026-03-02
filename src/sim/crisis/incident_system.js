// Incident System - Localized crisis events with spatial impact
// Extends crisis director with location-aware incidents and effects

import { CRISIS_TYPES } from '../../constants.js';
import { EVENT_TYPES as GAME_EVENT_TYPES, eventBus } from '../events.js';

// Incident priority levels
export const INCIDENT_PRIORITY = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4
};

// Incident types with specific behaviors
export const INCIDENT_TYPES = {
    // Fire incidents
    FIRE: {
        type: CRISIS_TYPES.FIRE,
        name: 'Building Fire',
        spreadRate: 0.3, // Chance to spread per tick
        damagePerTick: { wood: -5, gold: -2 },
        extinguishRate: 0.1,
        requiresFireDepartment: true
    },
    // Flood incidents
    FLOOD: {
        type: CRISIS_TYPES.FLOOD,
        name: 'Flooding Incident',
        spreadRate: 0.4,
        damagePerTick: { food: -8, gold: -3 },
        recedeRate: 0.2,
        requiresDrainage: true
    },
    // Riot incidents
    RIOT: {
        type: CRISIS_TYPES.RIOT,
        name: 'Street Riot',
        spreadRate: 0.5,
        damagePerTick: { gold: -10, wood: -5, population: -1 },
        calmRate: 0.15,
        requiresPolice: true
    },
    // Plague incidents
    PLAGUE: {
        type: CRISIS_TYPES.PLAGUE,
        name: 'Disease Cluster',
        spreadRate: 0.35,
        damagePerTick: { population: -2 },
        containedRate: 0.2,
        requiresHealthcare: true
    },
    // Blackout incidents
    BLACKOUT: {
        type: CRISIS_TYPES.BLACKOUT,
        name: 'Local Power Failure',
        spreadRate: 0.2,
        damagePerTick: { gold: -5 },
        restoreRate: 0.1,
        requiresPowerGrid: true
    }
};

export class Incident {
    constructor(id, type, location, severity) {
        this.id = id;
        this.type = type;
        this.name = INCIDENT_TYPES[type]?.name || 'Unknown Incident';
        this.location = location; // { x, y, radius }
        this.severity = severity || 1;
        this.age = 0;
        this.active = true;
        this.heat = 10 * severity;
        this.damageAccumulated = { gold: 0, food: 0, wood: 0, population: 0 };
    }

    // Tick the incident
    tick() {
        this.age++;
        this.heat = Math.max(0, this.heat - 1);

        // Check if incident should spread or be contained
        const config = INCIDENT_TYPES[this.type];
        if (!config) return { spread: false, contained: false };

        // Spread check
        const spread = this.rng.chance(config.spreadRate * this.severity);
        const contained = this.rng.chance(config.recedeRate || config.containedRate || 0);

        return { spread, contained };
    }

    // Apply damage for this tick
    applyDamage() {
        const config = INCIDENT_TYPES[this.type];
        if (!config || !config.damagePerTick) return;

        for (const [resource, amount] of Object.entries(config.damagePerTick)) {
            this.damageAccumulated[resource] = (this.damageAccumulated[resource] || 0) + amount;
        }
    }

    // Serialize for save
    serialize() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            location: this.location,
            severity: this.severity,
            age: this.age,
            active: this.active,
            heat: this.heat,
            damageAccumulated: this.damageAccumulated
        };
    }
}

export class IncidentSystem {
    constructor(game, rng) {
        this.game = game;
        this.rng = rng;

        // Incident tracking
        this.incidents = [];
        this.incidentCounter = 0;

        // Incident configuration
        this.maxIncidents = 10;
        this.incidentChance = 0.02; // Base chance per tick per tile

        // Response tracking
        this.dispatchedResponses = [];
        this.responseCooldowns = {}; // Type -> last response tick

        // Events
        this.eventTypes = {
            INCIDENT_CREATED: 'incident_created',
            INCIDENT_SPREAD: 'incident_spread',
            INCIDENT_CONTAINED: 'incident_contained',
            INCIDENT_DAMAGE: 'incident_damage',
            RESPONSE_DISPATCHED: 'response_dispatched'
        };

        // Register with events
        this.registerEvents();
    }

    registerEvents() {
        // Event registration handled by director
    }

    // Generate a new incident
    generateIncident() {
        if (this.incidents.length >= this.maxIncidents) return null;

        // Get potential incident locations (high-density areas)
        const locations = this.getHighDensityLocations();

        if (locations.length === 0) return null;

        // Pick random location
        const location = this.rng.pick(locations);

        // Pick random incident type
        const types = Object.keys(INCIDENT_TYPES);
        const type = this.rng.pick(types);

        const id = `incident_${++this.incidentCounter}`;
        const severity = Math.max(1, Math.min(4, this.rng.int(1, 3)));

        const incident = new Incident(id, type, location, severity);
        this.incidents.push(incident);

        eventBus.emit(this.eventTypes.INCIDENT_CREATED, {
            incidentId: id,
            incidentType: type,
            location: location,
            severity: severity
        });

        return incident;
    }

    // Get high-density locations (where incidents are more likely)
    getHighDensityLocations() {
        const locations = [];
        const map = this.game.map;
        const citizens = this.game.citizens;

        if (!map || !citizens) return locations;

        // Sample the map for high-density areas
        const step = 5; // Sample every 5 tiles
        for (let y = 0; y < map.height; y += step) {
            for (let x = 0; x < map.width; x += step) {
                // Check if this is a developed area
                const building = map.getBuildingAt(x, y);
                const citizenCount = citizens.getCitizensAt(x, y)?.length || 0;

                if (building || citizenCount > 0) {
                    // Weight by density
                    const weight = 1 + citizenCount * 0.1 + (building ? 1 : 0);
                    for (let i = 0; i < weight; i++) {
                        locations.push({ x, y, radius: 3 });
                    }
                }
            }
        }

        return locations;
    }

    // Process all active incidents
    updateIncidents() {
        const incidentsToRemove = [];

        for (const incident of this.incidents) {
            if (!incident.active) continue;

            // Apply damage
            incident.applyDamage();

            // Tick incident
            const { spread, contained } = incident.tick();

            // Handle spread
            if (spread) {
                this.spreadIncident(incident);
                eventBus.emit(this.eventTypes.INCIDENT_SPREAD, {
                    incidentId: incident.id,
                    newLocation: incident.location
                });
            }

            // Handle containment
            if (contained) {
                incident.active = false;
                incidentsToRemove.push(incident.id);
                this.game.showMessage(`✅ Incident contained: ${incident.name}`, 'success');
                eventBus.emit(this.eventTypes.INCIDENT_CONTAINED, {
                    incidentId: incident.id
                });
            }
        }

        // Remove contained incidents
        this.incidents = this.incidents.filter(i => !incidentsToRemove.includes(i.id));
    }

    // Spread incident to adjacent tiles
    spreadIncident(incident) {
        const { x, y, radius } = incident.location;

        // Calculate spread direction
        const angle = this.rng.float(0, Math.PI * 2);
        const distance = 1 + this.rng.float(0, radius);

        const newX = Math.floor(x + distance * Math.cos(angle));
        const newY = Math.floor(y + distance * Math.sin(angle));

        // Bounds check
        const map = this.game.map;
        if (newX >= 0 && newX < (map?.width || 100) &&
            newY >= 0 && newY < (map?.height || 100)) {
            incident.location = { x: newX, y: newY, radius: radius };
            incident.heat += 5;
        }
    }

    // Dispatch a response to an incident
    dispatchResponse(incidentId, responseType, resources) {
        const incident = this.incidents.find(i => i.id === incidentId);
        if (!incident || !incident.active) return false;

        // Check resources
        if (!this.game.resources.canAfford(resources)) {
            this.game.showMessage('Insufficient resources for response!', 'warning');
            return false;
        }

        // Pay for response
        this.game.resources.pay(resources);

        // Track response
        const responseId = `response_${++this.incidentCounter}`;
        this.dispatchedResponses.push({
            id: responseId,
            incidentId: incidentId,
            type: responseType,
            timestamp: this.game.state.time.tick,
            successChance: this.calculateResponseSuccess(incident, responseType)
        });

        // Apply response effect
        incident.heat -= 20;
        incident.heat = Math.max(0, incident.heat);

        // Check if response contains the incident
        if (incident.heat <= 0) {
            incident.active = false;
            this.game.showMessage(`✅ ${incident.name} successfully contained!`, 'success');
            eventBus.emit(this.eventTypes.INCIDENT_CONTAINED, {
                incidentId: incident.id,
                responseUsed: responseType
            });
        }

        eventBus.emit(this.eventTypes.RESPONSE_DISPATCHED, {
            responseId: responseId,
            incidentId: incidentId,
            responseType: responseType,
            successChance: this.calculateResponseSuccess(incident, responseType)
        });

        return true;
    }

    // Calculate response success chance
    calculateResponseSuccess(incident, responseType) {
        let success = 0.5;

        // Base success by response type
        switch (responseType) {
            case 'basic':
                success = 0.4;
                break;
            case 'professional':
                success = 0.7;
                break;
            case 'emergency':
                success = 0.9;
                break;
        }

        // Adjust by incident severity
        success -= incident.severity * 0.1;

        // Adjust by service coverage
        if (incident.type === CRISIS_TYPES.FIRE) {
            const fireCoverage = this.getFireDepartmentCoverage(incident.location);
            success += fireCoverage * 0.3;
        } else if (incident.type === CRISIS_TYPES.RIOT) {
            const policeCoverage = this.getPoliceCoverage(incident.location);
            success += policeCoverage * 0.3;
        } else if (incident.type === CRISIS_TYPES.PLAGUE) {
            const healthcareCoverage = this.getHealthcareCoverage(incident.location);
            success += healthcareCoverage * 0.3;
        }

        return Math.max(0.2, Math.min(0.95, success));
    }

    // Get fire department coverage at location
    getFireDepartmentCoverage(location) {
        // Check for nearby fire stations (police stations serve this role in the game)
        const map = this.game.map;
        const buildings = this.game.buildings;
        if (!map || !buildings) return 0;

        const fireStations = buildings.buildings.filter(b => b.type === 'police-station'); // Actually fire stations would be separate
        let coverage = 0;

        for (const station of fireStations) {
            const dist = Math.hypot(station.x - location.x, station.y - location.y);
            if (dist < 15) {
                coverage += 1 - (dist / 15);
            }
        }

        return Math.min(1, coverage);
    }

    // Get police coverage at location
    getPoliceCoverage(location) {
        const map = this.game.map;
        const buildings = this.game.buildings;
        if (!map || !buildings) return 0;

        const stations = buildings.buildings.filter(b => b.type === 'police-station') || [];
        let coverage = 0;

        for (const station of stations) {
            const dist = Math.hypot(station.x - location.x, station.y - location.y);
            if (dist < 20) {
                coverage += 1 - (dist / 20);
            }
        }

        return Math.min(1, coverage);
    }

    // Get healthcare coverage at location
    getHealthcareCoverage(location) {
        const map = this.game.map;
        const buildings = this.game.buildings;
        if (!map || !buildings) return 0;

        const facilities = buildings.buildings.filter(b => b.type === 'medical') || [];
        let coverage = 0;

        for (const facility of facilities) {
            const dist = Math.hypot(facility.x - location.x, facility.y - location.y);
            if (dist < 20) {
                coverage += 1 - (dist / 20);
            }
        }

        return Math.min(1, coverage);
    }

    // Get active incidents for UI
    getActiveIncidents() {
        return this.incidents.map(i => ({
            id: i.id,
            type: i.type,
            name: i.name,
            location: i.location,
            severity: i.severity,
            heat: i.heat,
            age: i.age,
            damageAccumulated: i.damageAccumulated
        }));
    }

    // Serialize for save
    serialize() {
        return {
            incidents: this.incidents.map(i => i.serialize()),
            incidentCounter: this.incidentCounter,
            dispatchedResponses: this.dispatchedResponses
        };
    }

    // Deserialize from save
    deserialize(data) {
        this.incidents = data.incidents.map(d => new Incident(
            d.id, d.type, d.location, d.severity
        ));

        for (let i = 0; i < this.incidents.length; i++) {
            const incident = this.incidents[i];
            const source = data.incidents[i];
            incident.age = source.age;
            incident.active = source.active;
            incident.heat = source.heat;
            incident.damageAccumulated = source.damageAccumulated;
        }

        this.incidentCounter = data.incidentCounter;
        this.dispatchedResponses = data.dispatchedResponses || [];
    }

    // Get statistics
    getStats() {
        let totalDamage = { gold: 0, food: 0, wood: 0, population: 0 };

        for (const incident of this.incidents) {
            for (const [resource, amount] of Object.entries(incident.damageAccumulated)) {
                totalDamage[resource] = (totalDamage[resource] || 0) + amount;
            }
        }

        return {
            activeCount: this.incidents.length,
            totalDamage: totalDamage,
            dispatchedCount: this.dispatchedResponses.length
        };
    }
}