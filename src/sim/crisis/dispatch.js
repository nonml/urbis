// Dispatch/Response System - Coordinates emergency responses to crises
// Integrates with traffic, services, and vehicle systems

import { CRISIS_TYPES } from '../../constants.js';
import { EVENT_TYPES as GAME_EVENT_TYPES, eventBus } from '../events.js';

// Response team types
export const RESPONSE_TEAM_TYPES = {
    FIRE: {
        name: 'Fire Department',
        icon: '🚒',
        vehicles: ['fire_truck'],
        equipment: ['extinguishers', 'ladders'],
        responseTimeBase: 30,
        capacity: 3,
        unitCost: 50
    },
    POLICE: {
        name: 'Police Department',
        icon: '🚓',
        vehicles: ['patrol_car'],
        equipment: ['restraints', 'nonlethal'],
        responseTimeBase: 25,
        capacity: 4,
        unitCost: 40
    },
    MEDICAL: {
        name: 'Medical Team',
        icon: '🚑',
        vehicles: ['ambulance'],
        equipment: ['medkits', 'defibrillators'],
        responseTimeBase: 35,
        capacity: 2,
        unitCost: 60
    },
    ENGINEERING: {
        name: 'Engineering Crew',
        icon: '👷',
        vehicles: ['construction_vehicle'],
        equipment: ['tools', 'materials'],
        responseTimeBase: 45,
        capacity: 5,
        unitCost: 30
    }
};

// Response states
export const RESPONSE_STATE = {
    AVAILABLE: 'available',
    EN_ROUTE: 'en_route',
    ON_SCENE: 'on_scene',
    RECOVERING: 'recovering',
    RETURNING: 'returning'
};

export class ResponseTeam {
    constructor(id, type, baseLocation) {
        this.id = id;
        this.type = type;
        this.state = RESPONSE_STATE.AVAILABLE;
        this.baseLocation = baseLocation; // { x, y }
        this.currentLocation = { ...baseLocation };
        this.targetLocation = null;
        this.assignedIncident = null;
        this.arrivalTime = 0;
        this.durationOnScene = 0;
        this.equipmentStatus = 100; // 0-100
        this.crewStatus = 100; // 0-100
    }

    // Assign to an incident
    assign(incident, estimatedTravelTime) {
        this.state = RESPONSE_STATE.EN_ROUTE;
        this.targetLocation = incident.location;
        this.assignedIncident = incident;
        this.arrivalTime = estimatedTravelTime;
    }

    // Arrive at incident scene
    arrive() {
        this.state = RESPONSE_STATE.ON_SCENE;
        this.durationOnScene = 0;
        this.currentLocation = { ...this.targetLocation };
    }

    // Work on scene
    workTick() {
        this.durationOnScene++;
        this.equipmentStatus = Math.max(0, this.equipmentStatus - 0.5);
        this.crewStatus = Math.max(0, this.crewStatus - 0.3);

        return this.crewStatus > 0 && this.equipmentStatus > 0;
    }

    // Finish response and return
    returnToBase() {
        this.state = RESPONSE_STATE.RETURNING;
        this.targetLocation = this.baseLocation;
    }

    // Complete return
    completeReturn() {
        this.state = RESPONSE_STATE.AVAILABLE;
        this.currentLocation = { ...this.baseLocation };
        this.targetLocation = null;
        this.assignedIncident = null;
    }

    // Serialize for save
    serialize() {
        return {
            id: this.id,
            type: this.type,
            state: this.state,
            baseLocation: this.baseLocation,
            currentLocation: this.currentLocation,
            targetLocation: this.targetLocation,
            assignedIncidentId: this.assignedIncident?.id || null,
            arrivalTime: this.arrivalTime,
            durationOnScene: this.durationOnScene,
            equipmentStatus: this.equipmentStatus,
            crewStatus: this.crewStatus
        };
    }
}

export class DispatchSystem {
    constructor(game, rng) {
        this.game = game;
        this.rng = rng;

        // Response teams
        this.teams = {};
        this.teamCounter = 0;

        // Response queue
        this.responseQueue = [];

        // Dispatch configuration
        this.baseCooldown = 10; // Minimum ticks between dispatches

        // Initialize teams by type
        for (const [type, config] of Object.entries(RESPONSE_TEAM_TYPES)) {
            this.teams[type] = this.createInitialTeams(type, config.capacity);
        }

        // Events
        this.eventTypes = {
            RESPONSE_DISPATCHED: 'response_dispatched',
            RESPONSE_ARRIVED: 'response_arrived',
            RESPONSE_COMPLETE: 'response_complete',
            RESPONSE_RETURNED: 'response_returned'
        };
    }

    // Create initial teams for a type
    createInitialTeams(type, count) {
        const teams = [];
        const map = this.game.map;
        const baseLocation = map ? this.findSafeLocation() : { x: 50, y: 50 };

        for (let i = 0; i < count; i++) {
            const team = new ResponseTeam(`team_${++this.teamCounter}`, type, baseLocation);
            teams.push(team);
        }

        return teams;
    }

    // Find a safe location for team base
    findSafeLocation() {
        const map = this.game.map;
        const buildings = this.game.buildings;
        if (!map) return { x: 50, y: 50 };

        // Try to find a location near the town center or city hall
        const townHall = buildings.buildings.find(b => b.type === 'town-hall');
        if (townHall) {
            return { x: townHall.x, y: townHall.y };
        }

        // Default to center of map
        return { x: map.width / 2, y: map.height / 2 };
    }

    // Request a response to an incident
    requestResponse(incidentId, teamType) {
        const incident = this.game.crisis?.incidentSystem?.incidents?.find(i => i.id === incidentId);
        if (!incident) return null;

        // Find available team
        const availableTeam = this.getAvailableTeam(teamType);
        if (!availableTeam) return null;

        // Calculate estimated travel time
        const travelTime = this.calculateTravelTime(availableTeam.baseLocation, incident.location);

        // Assign team
        availableTeam.assign(incident, travelTime);
        availableTeam.equipmentStatus = Math.min(100, availableTeam.equipmentStatus + 10);

        // Add to queue for arrival processing
        this.responseQueue.push({
            teamId: availableTeam.id,
            arrivalTick: this.game.state.time.tick + travelTime,
            incidentId: incidentId
        });

        eventBus.emit(this.eventTypes.RESPONSE_DISPATCHED, {
            teamId: availableTeam.id,
            teamType: teamType,
            incidentId: incidentId,
            travelTime: travelTime
        });

        this.game.showMessage(` dispatched to ${incident.name}`, 'info');

        return availableTeam;
    }

    // Get available team of specified type
    getAvailableTeam(type) {
        const teams = this.teams[type];
        if (!teams) return null;

        return teams.find(t => t.state === RESPONSE_STATE.AVAILABLE);
    }

    // Calculate travel time (in ticks)
    calculateTravelTime(from, to) {
        const distance = Math.hypot(to.x - from.x, to.y - from.y);

        // Base speed: 10 tiles per tick
        const baseSpeed = 10;
        let travelTime = Math.ceil(distance / baseSpeed);

        // Adjust for traffic
        const traffic = this.game.traffic;
        if (traffic) {
            const trafficFactor = traffic.getTrafficFactor(from, to) || 1;
            travelTime = Math.ceil(travelTime * trafficFactor);
        }

        // Minimum travel time
        return Math.max(5, travelTime);
    }

    // Process response arrivals
    updateResponses() {
        const tick = this.game.state.time.tick;
        const completedArrivals = [];

        for (const arrival of this.responseQueue) {
            if (tick >= arrival.arrivalTick) {
                const team = this.getTeamById(arrival.teamId);
                if (team) {
                    team.arrive();
                    completedArrivals.push(arrival);
                }
            }
        }

        this.responseQueue = this.responseQueue.filter(a => !completedArrivals.includes(a));

        // Process teams on scene
        for (const teams of Object.values(this.teams)) {
            for (const team of teams) {
                if (team.state === RESPONSE_STATE.ON_SCENE) {
                    const stillWorking = team.workTick();

                    if (!stillWorking || team.durationOnScene > 100) {
                        // Team exhausted or task complete
                        team.returnToBase();
                        this.responseQueue.push({
                            teamId: team.id,
                            arrivalTick: tick + this.calculateTravelTime(team.currentLocation, team.baseLocation),
                            incidentId: team.assignedIncident?.id || null,
                            isReturn: true
                        });
                    }
                } else if (team.state === RESPONSE_STATE.RETURNING) {
                    const map = this.game.map;
                    const distance = Math.hypot(team.baseLocation.x - team.currentLocation.x,
                        team.baseLocation.y - team.currentLocation.y);

                    // Simulate return journey
                    if (distance < 5) {
                        team.completeReturn();
                        eventBus.emit(this.eventTypes.RESPONSE_COMPLETE, {
                            teamId: team.id,
                            incidentId: team.assignedIncident?.id || null,
                            duration: team.durationOnScene
                        });
                    } else {
                        // Move towards base
                        const speed = 15;
                        team.currentLocation.x += (team.baseLocation.x - team.currentLocation.x) / speed;
                        team.currentLocation.y += (team.baseLocation.y - team.currentLocation.y) / speed;
                    }
                }
            }
        }
    }

    // Get team by ID
    getTeamById(id) {
        for (const teams of Object.values(this.teams)) {
            const found = teams.find(t => t.id === id);
            if (found) return found;
        }
        return null;
    }

    // Get all response teams for UI
    getAllTeams() {
        const result = [];
        for (const [type, teams] of Object.entries(this.teams)) {
            for (const team of teams) {
                result.push({
                    id: team.id,
                    type: type,
                    state: team.state,
                    baseLocation: team.baseLocation,
                    currentLocation: team.currentLocation,
                    equipmentStatus: team.equipmentStatus,
                    crewStatus: team.crewStatus
                });
            }
        }
        return result;
    }

    // Get teams by state
    getTeamsByState(state) {
        const result = [];
        for (const teams of Object.values(this.teams)) {
            result.push(...teams.filter(t => t.state === state));
        }
        return result;
    }

    // Get response statistics
    getStats() {
        let totalDeployments = 0;
        let totalOnScene = 0;

        for (const teams of Object.values(this.teams)) {
            totalDeployments += teams.filter(t => t.state !== RESPONSE_STATE.AVAILABLE).length;
            totalOnScene += teams.filter(t => t.state === RESPONSE_STATE.ON_SCENE).length;
        }

        return {
            totalTeams: this.teamCounter,
            availableTeams: this.getTeamsByState(RESPONSE_STATE.AVAILABLE).length,
            enRouteTeams: this.getTeamsByState(RESPONSE_STATE.EN_ROUTE).length,
            onSceneTeams: totalOnScene,
            totalDeployments: totalDeployments
        };
    }

    // Serialize for save
    serialize() {
        return {
            teams: Object.fromEntries(
                Object.entries(this.teams).map(([type, teams]) => [
                    type,
                    teams.map(t => t.serialize())
                ])
            ),
            teamCounter: this.teamCounter,
            responseQueue: this.responseQueue
        };
    }

    // Deserialize from save
    deserialize(data) {
        this.teams = {};

        for (const [type, teamData] of Object.entries(data.teams)) {
            this.teams[type] = teamData.map(d => {
                const team = new ResponseTeam(d.id, d.type, d.baseLocation);
                team.state = d.state;
                team.currentLocation = d.currentLocation;
                team.targetLocation = d.targetLocation;
                team.arrivalTime = d.arrivalTime;
                team.durationOnScene = d.durationOnScene;
                team.equipmentStatus = d.equipmentStatus;
                team.crewStatus = d.crewStatus;
                return team;
            });
        }

        this.teamCounter = data.teamCounter;
        this.responseQueue = data.responseQueue || [];
    }

    // Deploy team to location (for manual intervention)
    deployToLocation(teamId, location) {
        const team = this.getTeamById(teamId);
        if (!team || team.state !== RESPONSE_STATE.AVAILABLE) return false;

        team.state = RESPONSE_STATE.EN_ROUTE;
        team.targetLocation = location;

        this.responseQueue.push({
            teamId: team.id,
            arrivalTick: this.game.state.time.tick + this.calculateTravelTime(team.baseLocation, location),
            isManual: true
        });

        return true;
    }

    // Get team type config
    getTeamConfig(type) {
        return RESPONSE_TEAM_TYPES[type];
    }
}