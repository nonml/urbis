// Political Appointments System - Manages key roles and their effects
// Appointments provide faction influence and special abilities

import { eventBus, EVENT_TYPES } from '../events.js';

// Appointment types with definitions
export const APPOINTMENT_TYPES = {
    MAYOR: 'mayor',
    CHIEF_OF_POLICE: 'chief_of_police',
    COMMISSIONER: 'commissioner',
    ADVISOR: 'advisor',
    SPokesperson: 'spokesperson',
    TREASURER: 'treasurer',
    SECRETARY: 'secretary',
    ENVIRONMENTAL_DIRECTOR: 'environmental_director'
};

// Appointment definitions with requirements and effects
export const APPOINTMENT_DEFINITIONS = {
    [APPOINTMENT_TYPES.MAYOR]: {
        id: APPOINTMENT_TYPES.MAYOR,
        name: 'Mayor',
        description: 'City leader with broad authority over policy and faction influence',
        requirements: {
            reputation: 0,
            experience: 10,
            cost: 0
        },
        effects: {
            factionInfluence: {
                citizens: 5,
                corp: 3,
                police: 2
            },
            policyCostMultiplier: 0.9,
            policyDurationBonus: 10,
            approvalRating: 2
        },
        abilities: [
            'vetopolicy',
            'emergency_decree',
            'cabinet_shuffles'
        ]
    },
    [APPOINTMENT_TYPES.CHIEF_OF_POLICE]: {
        id: APPOINTMENT_TYPES.CHIEF_OF_POLICE,
        name: 'Chief of Police',
        description: 'Lead law enforcement officer with authority over police operations',
        requirements: {
            reputation: -10,
            experience: 15,
            cost: 50
        },
        effects: {
            factionInfluence: {
                police: 15,
                citizens: -5,
                gangs: -10
            },
            policeEffectiveness: 1.2,
            heatDecayMultiplier: 0.8,
            pursuitPressure: 1.15
        },
        abilities: [
            'police_raids',
            'surveillance_expansion',
            'wiretaps'
        ]
    },
    [APPOINTMENT_TYPES.COMMISSIONER]: {
        id: APPOINTMENT_TYPES.COMMISSIONER,
        name: 'City Commissioner',
        description: 'Senior administrator managing city services and infrastructure',
        requirements: {
            reputation: -5,
            experience: 12,
            cost: 30
        },
        effects: {
            factionInfluence: {
                citizens: 8,
                corp: 5,
                police: 2
            },
            serviceCoverage: 10,
            infrastructureCostMultiplier: 0.85,
            jobProductionBonus: 8
        },
        abilities: [
            'service_directives',
            'infrastructure_projects',
            'resource_allocation'
        ]
    },
    [APPOINTMENT_TYPES.ADVISOR]: {
        id: APPOINTMENT_TYPES.ADVISOR,
        name: 'Senior Advisor',
        description: 'Strategic advisor providing political counsel and influence',
        requirements: {
            reputation: 10,
            experience: 20,
            cost: 40
        },
        effects: {
            factionInfluence: {
                citizens: 3,
                corp: 4,
                police: 2
            },
            policyCostMultiplier: 0.95,
            influenceGainRate: 1.3,
            rivalInfluenceResistance: 1.5
        },
        abilities: [
            'strategic_advice',
            'media_briefings',
            'backroom_dealings'
        ]
    },
    [APPOINTMENT_TYPES.SPOKESPERSON]: {
        id: APPOINTMENT_TYPES.SPOKESPERSON,
        name: 'City Spokesperson',
        description: 'Public relations officer managing city image and sentiment',
        requirements: {
            reputation: -15,
            experience: 8,
            cost: 25
        },
        effects: {
            factionInfluence: {
                citizens: 12,
                corp: 2
            },
            sentimentGainRate: 1.5,
            newsPositiveBias: 0.3,
            crisisRecoveryBonus: 20
        },
        abilities: [
            'media_campaigns',
            'public_addresses',
            'image_management'
        ]
    },
    [APPOINTMENT_TYPES.TREASURER]: {
        id: APPOINTMENT_TYPES.TREASURER,
        name: 'City Treasurer',
        description: 'Financial officer managing city budget and economy',
        requirements: {
            reputation: -10,
            experience: 15,
            cost: 35
        },
        effects: {
            factionInfluence: {
                corp: 10,
                citizens: -2
            },
            budgetRegenMultiplier: 1.2,
            taxEfficiency: 1.25,
            economicStability: 1.2
        },
        abilities: [
            'budget_allocation',
            'economic_stimulus',
            'fiscal_austerity'
        ]
    },
    [APPOINTMENT_TYPES.SECRETARY]: {
        id: APPOINTMENT_TYPES.SECRETARY,
        name: 'City Secretary',
        description: 'Administrative coordinator managing city records and appointments',
        requirements: {
            reputation: -5,
            experience: 10,
            cost: 20
        },
        effects: {
            factionInfluence: {
                citizens: 5,
                corp: 3
            },
            decisionCooldownReduction: 5,
            informationFlow: 1.3,
            approvalRating: 1
        },
        abilities: [
            'document_processing',
            ' scheduling',
            'record_keeping'
        ]
    },
    [APPOINTMENT_TYPES.ENVIRONMENTAL_DIRECTOR]: {
        id: APPOINTMENT_TYPES.ENVIRONMENTAL_DIRECTOR,
        name: 'Environmental Director',
        description: 'Director of environmental initiatives and sustainability',
        requirements: {
            reputation: -20,
            experience: 12,
            cost: 30
        },
        effects: {
            factionInfluence: {
                citizens: 10,
                corp: -5
            },
            pollutionReduction: 15,
            greenCoverage: 10,
            healthBonus: 5
        },
        abilities: [
            'green_initiatives',
            'pollution_control',
            'sustainability_programs'
        ]
    }
};

// Appointment states
export const APPOINTMENT_STATES = {
    VACANT: 'vacant',
    APPOINTED: 'appointed',
    RESIGNED: 'resigned',
    FIRED: 'fired',
    EXPIRED: 'expired'
};

// Appointments Manager class
export class AppointmentsManager {
    constructor(game, rng) {
        this.game = game;
        this.rng = rng;
        this.appointments = {}; // Map of appointmentId -> { state, duration, effects }
        this.appointmentHistory = [];
        this.applicantPool = [];
        this.lastUpdateTick = 0;
    }

    /**
     * Initialize default appointments
     */
    initialize() {
        // Set default appointments
        this.appointments[APPOINTMENT_TYPES.MAYOR] = {
            state: APPOINTMENT_STATES.APPOINTED,
            duration: 180, // 6 months
            tickAppointed: this.game.state.time.tick || 0,
            appointedBy: 'default',
            effects: { ...APPOINTMENT_DEFINITIONS[APPOINTMENT_TYPES.MAYOR].effects }
        };

        // Other positions are vacant by default
        const otherPositions = Object.keys(APPOINTMENT_DEFINITIONS).filter(
            k => k !== APPOINTMENT_TYPES.MAYOR
        );
        for (const pos of otherPositions) {
            this.appointments[pos] = {
                state: APPOINTMENT_STATES.VACANT,
                duration: 0,
                tickAppointed: null,
                appointedBy: null,
                effects: {}
            };
        }
    }

    /**
     * Get appointment definition by ID
     * @param {string} appointmentId - Appointment identifier
     * @returns {Object|null} Appointment definition
     */
    getDefinition(appointmentId) {
        return APPOINTMENT_DEFINITIONS[appointmentId] || null;
    }

    /**
     * Get all appointment definitions
     * @returns {Object} All appointment definitions
     */
    getAllDefinitions() {
        return APPOINTMENT_DEFINITIONS;
    }

    /**
     * Get appointment by ID
     * @param {string} appointmentId - Appointment identifier
     * @returns {Object|null} Appointment object
     */
    getAppointment(appointmentId) {
        return this.appointments[appointmentId] || null;
    }

    /**
     * Get all active appointments
     * @returns {Array} Array of active appointments
     */
    getActiveAppointments() {
        return Object.entries(this.appointments)
            .filter(([_, ap]) => ap.state === APPOINTMENT_STATES.APPOINTED)
            .map(([id, ap]) => ({ id, ...ap }));
    }

    /**
     * Check requirements for an appointment
     * @param {string} appointmentId - Appointment to check
     * @returns {Object} { meetsRequirements: boolean, missing?: Array, reason?: string }
     */
    checkRequirements(appointmentId) {
        const def = APPOINTMENT_DEFINITIONS[appointmentId];
        if (!def) {
            return { meetsRequirements: false, reason: 'Appointment not found' };
        }

        const reqs = def.requirements;
        const rep = this.game.state.factions?.reputation || {};
        const playerRep = rep.citizens || 0;
        const tick = this.game.state.time.tick || 0;

        const missing = [];

        if (playerRep < reqs.reputation) {
            missing.push(`reputation (need ${reqs.reputation}, have ${playerRep})`);
        }

        if (this.appointmentHistory.length < reqs.experience) {
            missing.push(`experience (need ${reqs.experience} appointments, have ${this.appointmentHistory.length})`);
        }

        const budget = this.game.state.resources?.gold || 0;
        if (budget < reqs.cost) {
            missing.push(`budget (need ${reqs.cost}, have ${budget})`);
        }

        if (missing.length > 0) {
            return {
                meetsRequirements: false,
                missing,
                reason: `Missing requirements: ${missing.join(', ')}`
            };
        }

        return { meetsRequirements: true };
    }

    /**
     * Appoint someone to a position
     * @param {string} appointmentId - Position to fill
     * @param {string} appointeeName - Name of appointee
     * @returns {Object} { success: boolean, error?: string, appointment?: Object }
     */
    appoint(appointmentId, appointeeName = 'Unknown') {
        const validation = this.checkRequirements(appointmentId);
        if (!validation.meetsRequirements) {
            return { success: false, error: validation.reason };
        }

        const def = APPOINTMENT_DEFINITIONS[appointmentId];
        const budget = this.game.state.resources.gold;

        // Deduct cost if any
        if (def.requirements.cost > 0) {
            this.game.state.resources.gold -= def.requirements.cost;
        }

        // Update appointment
        const tick = this.game.state.time.tick || 0;
        this.appointments[appointmentId] = {
            state: APPOINTMENT_STATES.APPOINTED,
            duration: 90, // 3 months default
            tickAppointed: tick,
            appointee: appointeeName,
            effects: { ...def.effects }
        };

        // Log history
        this.appointmentHistory.push({
            appointmentId,
            appointee: appointeeName,
            tick: tick,
            state: APPOINTMENT_STATES.APPOINTED
        });

        // Apply effects
        this.applyAppointmentEffects(appointmentId);

        // Emit event
        eventBus.emit(EVENT_TYPES.APPOINTMENT_MADE, {
            appointmentId,
            appointee: appointeeName,
            tick: tick
        });

        // Notify player
        this.game.ui?.showMessage?.(`Appointed ${appointeeName} as ${def.name}`, 'politics');

        return { success: true, appointment: this.appointments[appointmentId] };
    }

    /**
     * Fire an appointee
     * @param {string} appointmentId - Position to fire
     * @returns {Object} { success: boolean, error?: string }
     */
    fire(appointmentId) {
        if (!this.appointments[appointmentId]) {
            return { success: false, error: 'Appointment not found' };
        }

        const appointment = this.appointments[appointmentId];
        if (appointment.state !== APPOINTMENT_STATES.APPOINTED) {
            return { success: false, error: 'Appointment not active' };
        }

        const def = APPOINTMENT_DEFINITIONS[appointmentId];

        // Update state
        appointment.state = APPOINTMENT_STATES.FIRED;
        appointment.tickFired = this.game.state.time.tick;
        appointment.firedBy = 'player';

        // Revoke effects
        this.revokeAppointmentEffects(appointmentId);

        // Log history
        this.appointmentHistory.push({
            appointmentId,
            appointee: appointment.appointee,
            tick: this.game.state.time.tick,
            state: APPOINTMENT_STATES.FIRED
        });

        // Emit event
        eventBus.emit(EVENT_TYPES.APPOINTMENT_FIRED, {
            appointmentId,
            appointee: appointment.appointee,
            tick: this.game.state.time.tick
        });

        // Notify player
        this.game.ui?.showMessage?.(`Fired ${appointment.appointee} from ${def.name}`, 'politics');

        return { success: true };
    }

    /**
     * Resign an appointee
     * @param {string} appointmentId - Position to resign
     * @returns {Object} { success: boolean, error?: string }
     */
    resign(appointmentId) {
        if (!this.appointments[appointmentId]) {
            return { success: false, error: 'Appointment not found' };
        }

        const appointment = this.appointments[appointmentId];
        if (appointment.state !== APPOINTMENT_STATES.APPOINTED) {
            return { success: false, error: 'Appointment not active' };
        }

        const def = APPOINTMENT_DEFINITIONS[appointmentId];

        // Update state
        appointment.state = APPOINTMENT_STATES.RESIGNED;
        appointment.tickResigned = this.game.state.time.tick;
        appointment.resignedBy = appointment.appointee;

        // Revoke effects
        this.revokeAppointmentEffects(appointmentId);

        // Log history
        this.appointmentHistory.push({
            appointmentId,
            appointee: appointment.appointee,
            tick: this.game.state.time.tick,
            state: APPOINTMENT_STATES.RESIGNED
        });

        // Emit event
        eventBus.emit(EVENT_TYPES.APPOINTMENT_RESIGNED, {
            appointmentId,
            appointee: appointment.appointee,
            tick: this.game.state.time.tick
        });

        // Notify player
        this.game.ui?.showMessage?.(`${appointment.appointee} resigned from ${def.name}`, 'politics');

        return { success: true };
    }

    /**
     * Apply appointment effects to game state
     * @param {string} appointmentId - Appointment to apply
     */
    applyAppointmentEffects(appointmentId) {
        const appointment = this.appointments[appointmentId];
        const def = APPOINTMENT_DEFINITIONS[appointmentId];

        if (!appointment || !def) return;

        // Faction influence
        if (def.effects.factionInfluence) {
            for (const [factionId, bonus] of Object.entries(def.effects.factionInfluence)) {
                this.game.factionSystem?.modifyRep?.(factionId, bonus, `appointment_${appointmentId}`, 'politics');
            }
        }

        // Economy modifiers
        if (def.effects.policyCostMultiplier) {
            this.game.state.policyCostMultiplier = (this.game.state.policyCostMultiplier || 1) * def.effects.policyCostMultiplier;
        }
        if (def.effects.budgetRegenMultiplier) {
            this.game.state.budgetRegenMultiplier = (this.game.state.budgetRegenMultiplier || 1) * def.effects.budgetRegenMultiplier;
        }
        if (def.effects.taxEfficiency) {
            this.game.state.taxEfficiency = (this.game.state.taxEfficiency || 1) * def.effects.taxEfficiency;
        }

        // Police modifiers
        if (def.effects.policeEffectiveness) {
            this.game.state.policeEffectiveness = (this.game.state.policeEffectiveness || 1) * def.effects.policeEffectiveness;
        }

        // Service coverage
        if (def.effects.serviceCoverage) {
            this.game.state.serviceCoverageBonus = (this.game.state.serviceCoverageBonus || 0) + def.effects.serviceCoverage;
        }

        // Sentiment
        if (def.effects.sentimentGainRate) {
            this.game.state.sentimentGainRate = (this.game.state.sentimentGainRate || 1) * def.effects.sentimentGainRate;
        }
    }

    /**
     * Revoke appointment effects
     * @param {string} appointmentId - Appointment to revoke
     */
    revokeAppointmentEffects(appointmentId) {
        const appointment = this.appointments[appointmentId];
        const def = APPOINTMENT_DEFINITIONS[appointmentId];

        if (!appointment || !def) return;

        // Revoke faction influence
        if (def.effects.factionInfluence) {
            for (const [factionId, bonus] of Object.entries(def.effects.factionInfluence)) {
                this.game.factionSystem?.modifyRep?.(factionId, -bonus, `appointment_${appointmentId}_revoked`, 'politics');
            }
        }

        // Revoke economy modifiers (simplified)
        if (def.effects.policyCostMultiplier && this.game.state.policyCostMultiplier > 1) {
            this.game.state.policyCostMultiplier /= def.effects.policyCostMultiplier;
        }
    }

    /**
     * Update appointments each tick
     * @param {number} tick - Current tick
     */
    update(tick) {
        for (const [appointmentId, appointment] of Object.entries(this.appointments)) {
            if (appointment.state !== APPOINTMENT_STATES.APPOINTED) continue;

            // Check duration
            appointment.duration--;
            if (appointment.duration <= 0) {
                appointment.state = APPOINTMENT_STATES.EXPIRED;
                appointment.tickExpired = tick;

                // Revoke effects
                this.revokeAppointmentEffects(appointmentId);

                // Log history
                this.appointmentHistory.push({
                    appointmentId,
                    appointee: appointment.appointee,
                    tick: tick,
                    state: APPOINTMENT_STATES.EXPIRED
                });

                // Emit event
                eventBus.emit(EVENT_TYPES.APPOINTMENT_EXPIRED, {
                    appointmentId,
                    appointee: appointment.appointee,
                    tick: tick
                });

                // Notify player
                this.game.ui?.showMessage?.(`${appointment.appointee}'s term expired as ${this.getDefinition(appointmentId)?.name}`, 'politics');
            }
        }

        this.lastUpdateTick = tick;
    }

    /**
     * Generate applicant pool based on game state
     * @returns {Array} Array of potential applicants
     */
    generateApplicantPool() {
        const pool = [];
        const tick = this.game.state.time.tick || 0;

        // Generate new applicants periodically
        if (tick % 30 === 0 && this.applicantPool.length < 10) {
            const candidateNames = [
                'John Smith', 'Sarah Johnson', 'Michael Chen', 'Maria Garcia',
                'David Wilson', 'Emily Brown', 'James Lee', 'Jennifer Davis',
                'Robert Taylor', 'Lisa Anderson', 'William Martinez', 'Amanda Thomas'
            ];

            const positions = Object.keys(APPOINTMENT_DEFINITIONS);

            for (let i = 0; i < 3; i++) {
                const name = candidateNames[Math.floor(this.rng.float(0, candidateNames.length))];
                const position = positions[Math.floor(this.rng.float(0, positions.length))];

                // Calculate match score
                const rep = this.game.state.factions?.reputation || 0;
                const matchScore = 50 + Math.floor(this.rng.float(-20, 20)) + Math.floor(rep / 5);

                pool.push({
                    name,
                    position,
                    matchScore,
                    experience: Math.floor(this.rng.float(5, 25)),
                    tickAdded: tick
                });
            }

            this.applicantPool = pool.slice(-10); // Keep last 10
        }

        return this.applicantPool;
    }

    /**
     * Get appointments telemetry for UI
     * @returns {Object} Appointments telemetry
     */
    getTelemetry() {
        return {
            appointments: Object.entries(this.appointments).map(([id, ap]) => ({
                id,
                name: APPOINTMENT_DEFINITIONS[id]?.name || id,
                state: ap.state,
                duration: ap.duration,
                appointee: ap.appointee || 'Vacant',
                tickAppointed: ap.tickAppointed
            })),
            appointmentHistory: this.appointmentHistory.slice(-30).reverse(),
            applicantPool: this.applicantPool.slice(-5)
        };
    }
}

// Event type additions
EVENT_TYPES.APPOINTMENT_MADE = 'appointment_made';
EVENT_TYPES.APPOINTMENT_FIRED = 'appointment_fired';
EVENT_TYPES.APPOINTMENT_RESIGNED = 'appointment_resigned';
EVENT_TYPES.APPOINTMENT_EXPIRED = 'appointment_expired';