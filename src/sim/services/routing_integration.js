// Routing Integration for Services - Milestone H-01
// Integrates traffic routing with police, emergency, and service vehicles

import { PlayerVehicle, VehicleSpawner } from '../agents/player_vehicle.js';
import { TrafficPathfinder, PathResult } from '../traffic/pathfinder.js';

// Service vehicle types
export const SERVICE_TYPES = Object.freeze({
    POLICE: { type: 'EMERGENCY', name: 'Police Car', priority: true },
    FIRE: { type: 'SERVICE', name: 'Fire Truck', priority: true },
    AMBULANCE: { type: 'SERVICE', name: 'Ambulance', priority: true },
    MAINTENANCE: { type: 'SERVICE', name: 'Maintenance Vehicle', priority: false },
    POLICE_HELI: { type: 'EMERGENCY', name: 'Police Helicopter', priority: true }
});

/**
 * Service dispatcher - manages service vehicle routing and dispatch
 */
export class ServiceDispatcher {
    constructor(game) {
        this.game = game;
        this.spawner = new VehicleSpawner(game);
        this.pathfinder = null;
        this.activeJobs = [];
        this.queuedJobs = [];
        this.maxActiveJobs = 5;
        this.jobIdCounter = 1;
    }

    /**
     * Set the pathfinder for routing
     */
    setPathfinder(pathfinder) {
        this.pathfinder = pathfinder;
    }

    /**
     * Dispatch a service vehicle to a location
     * @param {string} serviceType - Type of service (POLICE, FIRE, AMBULANCE)
     * @param {number} x - Target X
     * @param {number} y - Target Y
     * @param {Object} [options] - Dispatch options
     * @param {number} [options.priority=0] - Job priority
     * @returns {Object|null} Dispatched vehicle or null if no vehicles available
     */
    dispatchService(serviceType, x, y, options = {}) {
        const { priority = 0 } = options;

        // Check if we have pathfinder
        if (!this.pathfinder) {
            console.warn('ServiceDispatcher: No pathfinder available');
            return null;
        }

        // Find nearest available vehicle
        const nearestVehicle = this.findNearestAvailableVehicle(serviceType, x, y);

        if (nearestVehicle) {
            // Create job
            const job = {
                id: this.jobIdCounter++,
                serviceType,
                vehicleId: nearestVehicle.id,
                targetX: x,
                targetY: y,
                priority,
                status: 'EN_ROUTE',
                createdAt: this.game.state.time.tick,
                estimatedArrival: null
            };

            // Route the vehicle
            const pathResult = this.pathfinder.findPath(
                Math.round(nearestVehicle.x),
                Math.round(nearestVehicle.y),
                x, y
            );

            if (pathResult.success) {
                nearestVehicle.setPath(pathResult);
                nearestVehicle.targetDestination = { x, y };
                nearestVehicle.serviceJob = job;
                nearestVehicle.state = 'MOVING';

                job.estimatedArrival = pathResult.length;

                this.activeJobs.push(job);
                this.game.ui?.showMessage?.(
                    `${SERVICE_TYPES[serviceType].name} dispatched to ${x},${y}`,
                    'normal'
                );

                return nearestVehicle;
            }
        }

        // No vehicle available, queue the job
        const queuedJob = {
            id: this.jobIdCounter++,
            serviceType,
            targetX: x,
            targetY: y,
            priority,
            status: 'QUEUED',
            createdAt: this.game.state.time.tick
        };

        this.queuedJobs.push(queuedJob);
        return null;
    }

    /**
     * Find nearest available vehicle for service type
     */
    findNearestAvailableVehicle(serviceType, x, y) {
        const allVehicles = this.game.traffic?.agents || [];
        const serviceVehicles = allVehicles.filter(v =>
            v.serviceJob === undefined ||
            (v.serviceJob && v.serviceJob.status === 'COMPLETED')
        );

        if (serviceVehicles.length === 0) return null;

        let nearest = null;
        let nearestDist = Infinity;

        for (const vehicle of serviceVehicles) {
            const dist = Math.sqrt((vehicle.x - x) ** 2 + (vehicle.y - y) ** 2);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = vehicle;
            }
        }

        return nearest;
    }

    /**
     * Handle vehicle arrival at destination
     */
    handleArrival(vehicle) {
        if (!vehicle.serviceJob) return;

        vehicle.serviceJob.status = 'COMPLETED';
        vehicle.serviceJob.arrivalTime = this.game.state.time.tick;

        // Reset vehicle
        vehicle.serviceJob = null;
        vehicle.clearDestination();
        vehicle.state = 'IDLE';
        vehicle.speed = 0;

        // Remove from active jobs
        this.activeJobs = this.activeJobs.filter(j => j.id !== vehicle.serviceJob?.id);

        // Check for queued jobs
        this._processQueuedJobs();
    }

    /**
     * Process queued jobs when vehicles become available
     */
    _processQueuedJobs() {
        while (this.activeJobs.length < this.maxActiveJobs && this.queuedJobs.length > 0) {
            // Get highest priority queued job
            this.queuedJobs.sort((a, b) => b.priority - a.priority);
            const job = this.queuedJobs.shift();

            const result = this.dispatchService(
                job.serviceType,
                job.targetX,
                job.targetY,
                { priority: job.priority }
            );

            if (!result) {
                // Could not dispatch, put job back
                this.queuedJobs.unshift(job);
                break;
            }
        }
    }

    /**
     * Cancel a service job
     */
    cancelJob(jobId) {
        const job = this.activeJobs.find(j => j.id === jobId);
        if (job) {
            job.status = 'CANCELLED';
            job.cancelledAt = this.game.state.time.tick;

            const vehicle = this.game.traffic?.agents?.find(v => v.id === job.vehicleId);
            if (vehicle) {
                vehicle.serviceJob = null;
                vehicle.clearDestination();
                vehicle.state = 'IDLE';
            }

            this.activeJobs = this.activeJobs.filter(j => j.id !== jobId);
        }
    }

    /**
     * Get job stats
     */
    getStats() {
        return {
            activeJobs: this.activeJobs.length,
            queuedJobs: this.queuedJobs.length,
            totalJobsProcessed: this.jobIdCounter - 1,
            avgResponseTime: this._calculateAvgResponseTime()
        };
    }

    /**
     * Calculate average response time for completed jobs
     */
    _calculateAvgResponseTime() {
        const completed = this.activeJobs.filter(j => j.status === 'COMPLETED' && j.arrivalTime);
        if (completed.length === 0) return 0;

        const total = completed.reduce((sum, j) =>
            sum + (j.arrivalTime - j.createdAt), 0
        );

        return Math.round(total / completed.length);
    }

    /**
     * Serialize dispatcher state
     */
    serialize() {
        return {
            jobIdCounter: this.jobIdCounter,
            activeJobs: this.activeJobs,
            queuedJobs: this.queuedJobs
        };
    }

    /**
     * Deserialize dispatcher state
     */
    deserialize(data) {
        if (!data) return;
        this.jobIdCounter = data.jobIdCounter || 1;
        this.activeJobs = data.activeJobs || [];
        this.queuedJobs = data.queuedJobs || [];

        // Re-link vehicles to jobs
        for (const job of this.activeJobs) {
            const vehicle = this.game.traffic?.agents?.find(v => v.id === job.vehicleId);
            if (vehicle) {
                vehicle.serviceJob = job;
            }
        }
    }
}

/**
 * Police pursuit router - routes police vehicles for pursuits
 */
export class PoliceRouter {
    constructor(game) {
        this.game = game;
        this.pathfinder = null;
        this.pursuitMode = false;
        this.targetVehicleId = null;
    }

    /**
     * Set pathfinder
     */
    setPathfinder(pathfinder) {
        this.pathfinder = pathfinder;
    }

    /**
     * Start pursuing a vehicle
     */
    startPursuit(targetVehicleId) {
        this.pursuitMode = true;
        this.targetVehicleId = targetVehicleId;
    }

    /**
     * Stop pursuing
     */
    stopPursuit() {
        this.pursuitMode = false;
        this.targetVehicleId = null;
    }

    /**
     * Update pursuit routing
     */
    updatePursuit() {
        if (!this.pursuitMode || !this.targetVehicleId || !this.pathfinder) return;

        const targetVehicle = this.game.traffic?.agents?.find(
            v => v.id === this.targetVehicleId
        );

        if (!targetVehicle) {
            this.stopPursuit();
            return;
        }

        // Find police vehicles
        const policeVehicles = this.game.traffic?.agents?.filter(
            v => v.type === 'EMERGENCY'
        ) || [];

        for (const policeVehicle of policeVehicles) {
            if (policeVehicle.state !== 'IDLE' && policeVehicle.state !== 'MOVING') continue;
            if (policeVehicle.serviceJob) continue;

            const pathResult = this.pathfinder.findPath(
                Math.round(policeVehicle.x),
                Math.round(policeVehicle.y),
                Math.round(targetVehicle.x),
                Math.round(targetVehicle.y)
            );

            if (pathResult.success) {
                policeVehicle.setPath(pathResult);
                policeVehicle.targetDestination = {
                    x: targetVehicle.x,
                    y: targetVehicle.y
                };
                policeVehicle.state = 'MOVING';
            }
        }
    }

    /**
     * Get pursuit stats
     */
    getPursuitStats() {
        if (!this.pursuitMode) return null;

        const targetVehicle = this.game.traffic?.agents?.find(
            v => v.id === this.targetVehicleId
        );

        if (!targetVehicle) return null;

        return {
            pursuitMode: true,
            targetId: this.targetVehicleId,
            targetPos: { x: targetVehicle.x, y: targetVehicle.y }
        };
    }

    /**
     * Serialize router state
     */
    serialize() {
        return {
            pursuitMode: this.pursuitMode,
            targetVehicleId: this.targetVehicleId
        };
    }

    /**
     * Deserialize router state
     */
    deserialize(data) {
        if (!data) return;
        this.pursuitMode = data.pursuitMode || false;
        this.targetVehicleId = data.targetVehicleId || null;
    }
}

/**
 * Emergency response router - routes fire/ambulance to incidents
 */
export class EmergencyRouter {
    constructor(game) {
        this.game = game;
        this.pathfinder = null;
        this.incidents = [];
        this.responseQueue = [];
    }

    /**
     * Set pathfinder
     */
    setPathfinder(pathfinder) {
        this.pathfinder = pathfinder;
    }

    /**
     * Report an incident
     */
    reportIncident(type, x, y, severity = 1) {
        const incident = {
            id: this.incidents.length + 1,
            type,
            x,
            y,
            severity,
            reportedAt: this.game.state.time.tick,
            status: 'UNRESPONDED'
        };

        this.incidents.push(incident);
        this._queueResponse(incident);

        this.game.ui?.showMessage?.(
            `Emergency reported: ${type} at ${x},${y}`,
            'warning'
        );
    }

    /**
     * Queue response for incident
     */
    _queueResponse(incident) {
        // Find nearest response unit
        const nearest = this._findNearestResponseUnit(incident);

        if (nearest) {
            const pathResult = this.pathfinder.findPath(
                Math.round(nearest.x),
                Math.round(nearest.y),
                incident.x,
                incident.y
            );

            if (pathResult.success) {
                nearest.setPath(pathResult);
                nearest.targetDestination = { x: incident.x, y: incident.y };
                nearest.state = 'MOVING';
                nearest.emergencyIncident = incident;

                incident.status = 'RESPONDING';
                incident.responseVehicleId = nearest.id;
                incident.arrivalEstimated = pathResult.length;
            }
        }
    }

    /**
     * Find nearest response unit (fire or ambulance)
     */
    _findNearestResponseUnit(incident) {
        const allVehicles = this.game.traffic?.agents || [];
        return allVehicles.find(v => v.state === 'IDLE');
    }

    /**
     * Handle incident response completion
     */
    handleResponseComplete(vehicle) {
        if (!vehicle.emergencyIncident) return;

        const incident = vehicle.emergencyIncident;
        incident.status = 'RESPONDED';
        incident.responseTime = this.game.state.time.tick - incident.reportedAt;
        incident.responseVehicleId = null;

        vehicle.emergencyIncident = null;
        vehicle.clearDestination();
        vehicle.state = 'IDLE';
        vehicle.speed = 0;
    }

    /**
     * Get incident stats
     */
    getIncidentStats() {
        const responded = this.incidents.filter(i => i.status === 'RESPONDED');
        const responding = this.incidents.filter(i => i.status === 'RESPONDING');
        const unresponded = this.incidents.filter(i => i.status === 'UNRESPONDED');

        const avgResponseTime = responded.length > 0
            ? Math.round(responded.reduce((sum, i) => sum + i.responseTime, 0) / responded.length)
            : 0;

        return {
            totalIncidents: this.incidents.length,
            responded: responded.length,
            responding: responding.length,
            unresponded: unresponded.length,
            avgResponseTime
        };
    }

    /**
     * Serialize state
     */
    serialize() {
        return {
            incidents: this.incidents
        };
    }

    /**
     * Deserialize state
     */
    deserialize(data) {
        if (!data) return;
        this.incidents = data.incidents || [];
    }
}