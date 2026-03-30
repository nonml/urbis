/**
 * VFX Trigger Manager - Event-driven VFX system
 * 
 * Listens to game events and triggers appropriate visual effects:
 * - Player actions (hack success/failure, building construction)
 * - Crisis events (start, escalate, resolve)
 * - Quest events (complete, clue discovered)
 * - Intel events (revealed, ping)
 * - Heat/influence events
 * - UI feedback (resource changes)
 */

import { eventBus, EVENT_TYPES } from '../../sim/events.js';

// VFX config for new Tier 2B/2C events (faction conflicts, rival milestones)
// These are appended to the main VFX_CONFIG below after its definition.
const EXTRA_VFX_CONFIG = {
    FACTION_CONFLICT_TRIGGERED: {
        shake: { intensity: 4, duration: 250 },
        text:  { color: 0xff8800, duration: 2000, fontSize: 22 }
    },
    RIVAL_INFLUENCE_MILESTONE: {
        shake: { intensity: 7, duration: 350 },
        burst: { color: 0xff4444, count: 24, speed: 120 },
        text:  { color: 0xff4444, duration: 2500, fontSize: 28 }
    },
};

// VFX color palette
export const VFX_COLORS = {
    SUCCESS: 0x00ff88,      // Green - success, positive
    FAILURE: 0xff4444,      // Red - failure, danger
    INFO: 0x44aaff,         // Blue - information
    WARNING: 0xffaa00,      // Orange - warning
    GOLD: 0xffd700,         // Gold - quest complete, valuable
    PURPLE: 0xaa44ff,       // Purple - intel, mysterious
    WHITE: 0xffffff,        // White - neutral
    CYAN: 0x00ffff,         // Cyan - tech, hacking
    PINK: 0xff44ff          // Pink - special, rare
};

// VFX configuration per event type
export const VFX_CONFIG = {
    // Player actions
    PLAYER_HACKED_NODE: {
        success: {
            burst: { color: VFX_COLORS.CYAN, count: 16, speed: 100 },
            text: { content: 'Hacked!', color: VFX_COLORS.CYAN, duration: 1500 }
        },
        failure: {
            burst: { color: VFX_COLORS.FAILURE, count: 8, speed: 80 }
        }
    },
    PLAYER_BUILT_BUILDING: {
        burst: { color: VFX_COLORS.SUCCESS, count: 24, speed: 120 },
        dust: { color: 0xC2B280, count: 16, speed: 60 }, // Dust particles at ground level
        pulse: { color: VFX_COLORS.SUCCESS, duration: 1000 }
    },
    PLAYER_ENTERED_DISTRICT: {
        text: { color: VFX_COLORS.INFO, duration: 2000, fontSize: 28 }
    },
    
    // Crisis events
    CRISIS_STARTED: {
        shake: { intensity: 8, duration: 400 },
        text: { color: VFX_COLORS.FAILURE, duration: 2500, fontSize: 32 }
    },
    CRISIS_ESCALATED: {
        shake: { intensity: 12, duration: 500 },
        burst: { color: VFX_COLORS.FAILURE, count: 32, speed: 150 }
    },
    CRISIS_RESOLVED: {
        burst: { color: VFX_COLORS.SUCCESS, count: 32, speed: 120 },
        text: { content: 'Resolved!', color: VFX_COLORS.SUCCESS, duration: 2000 }
    },
    CRISIS_DAMAGE: {
        text: { color: VFX_COLORS.FAILURE, duration: 1500 }
    },
    
    // Quest events
    QUEST_STARTED: {
        text: { color: VFX_COLORS.INFO, duration: 2000 }
    },
    QUEST_COMPLETED: {
        burst: { color: VFX_COLORS.GOLD, count: 48, speed: 150 },
        text: { content: 'Quest Complete!', color: VFX_COLORS.GOLD, duration: 2500 }
    },
    QUEST_STEP_COMPLETED: {
        text: { color: VFX_COLORS.SUCCESS, duration: 1500 }
    },
    CLUE_DISCOVERED: {
        pulse: { color: VFX_COLORS.PURPLE, duration: 800 },
        text: { content: 'Clue Found!', color: VFX_COLORS.PURPLE, duration: 1500 }
    },
    
    // Interactable events
    INTERACTABLE_SUCCESS: {
        burst: { color: VFX_COLORS.SUCCESS, count: 12, speed: 80 }
    },
    INTERACTABLE_FAILED: {
        burst: { color: VFX_COLORS.FAILURE, count: 8, speed: 60 }
    },
    INTERACTABLE_AVAILABLE: {
        pulse: { color: VFX_COLORS.INFO, duration: 600 }
    },
    
    // Incident events
    INCIDENT_CREATED: {
        shake: { intensity: 5, duration: 300 },
        text: { color: VFX_COLORS.WARNING, duration: 2000 }
    },
    INCIDENT_CONTAINED: {
        burst: { color: VFX_COLORS.INFO, count: 20, speed: 100 },
        text: { content: 'Contained!', color: VFX_COLORS.INFO, duration: 1500 }
    },
    INCIDENT_SPREAD: {
        text: { color: VFX_COLORS.WARNING, duration: 1500 }
    },
    
    // Intel events
    INTEL_REVEALED: {
        pulse: { color: VFX_COLORS.PURPLE, duration: 800 },
        text: { content: 'Intel Revealed', color: VFX_COLORS.PURPLE, duration: 1500 }
    },
    INTEL_PING: {
        ring: { color: VFX_COLORS.CYAN, duration: 2000 }
    },
    INTEL_GENERATED: {
        text: { content: 'New Intel', color: VFX_COLORS.PURPLE, duration: 1500 }
    },
    
    // Heat events
    HEAT_CHANGED: {
        increase: { text: { color: VFX_COLORS.FAILURE, duration: 1500 } },
        decrease: { text: { color: VFX_COLORS.SUCCESS, duration: 1500 } }
    },
    
    // Influence operations
    INFLUENCE_OP_STARTED: {
        ring: { color: VFX_COLORS.PURPLE, duration: 3000 }
    },
    INFLUENCE_OP_COMPLETED: {
        burst: { color: VFX_COLORS.SUCCESS, count: 24, speed: 100 },
        text: { color: VFX_COLORS.SUCCESS, duration: 1500 }
    },
    INFLUENCE_OP_CANCELLED: {
        text: { content: 'Cancelled', color: VFX_COLORS.WARNING, duration: 1200 }
    },
    
    // UI feedback
    UI_RESOURCE_GAINED: {
        text: { color: VFX_COLORS.SUCCESS, duration: 1500 }
    },
    UI_RESOURCE_LOST: {
        text: { color: VFX_COLORS.FAILURE, duration: 1500 }
    },
    UI_NOTIFICATION: {
        text: { color: VFX_COLORS.INFO, duration: 2000 }
    },
    UI_ERROR: {
        shake: { intensity: 5, duration: 200 },
        text: { color: VFX_COLORS.FAILURE, duration: 2000 }
    },

    // Combat events
    PLAYER_FIRED_WEAPON: {
        muzzleFlash: { color: 0xffdd44, count: 6, speed: 80 },
        tracer: { color: 0xffff88, duration: 150 },
        hit: { color: 0xff6644, count: 10, speed: 60 },
        shake: { intensity: 2, duration: 100 },  // light recoil shake
    }
};

/**
 * VFX Trigger Manager
 */
export class VFXTriggerManager {
    constructor(fxSystem, game) {
        this.fxSystem = fxSystem;
        this.game = game;
        this.enabled = true;
        
        // Bind handlers
        this._bindHandlers();
        
        // Don't register listeners yet - wait for setupListeners() call
    }
    
    /**
     * Bind all event handlers
     */
    _bindHandlers() {
        // Player actions
        this._onPlayerHackedNode = this._onPlayerHackedNode.bind(this);
        this._onPlayerBuiltBuilding = this._onPlayerBuiltBuilding.bind(this);
        this._onPlayerEnteredDistrict = this._onPlayerEnteredDistrict.bind(this);
        this._onPlayerInteract = this._onPlayerInteract.bind(this);
        this._onPlayerFiredWeapon = this._onPlayerFiredWeapon.bind(this);
        
        // Crisis events
        this._onCrisisStarted = this._onCrisisStarted.bind(this);
        this._onCrisisEscalated = this._onCrisisEscalated.bind(this);
        this._onCrisisResolved = this._onCrisisResolved.bind(this);
        this._onCrisisDamage = this._onCrisisDamage.bind(this);
        
        // Quest events
        this._onQuestStarted = this._onQuestStarted.bind(this);
        this._onQuestCompleted = this._onQuestCompleted.bind(this);
        this._onQuestStepCompleted = this._onQuestStepCompleted.bind(this);
        this._onClueDiscovered = this._onClueDiscovered.bind(this);
        
        // Interactable events
        this._onInteractableSuccess = this._onInteractableSuccess.bind(this);
        this._onInteractableFailed = this._onInteractableFailed.bind(this);
        this._onInteractableAvailable = this._onInteractableAvailable.bind(this);
        
        // Incident events
        this._onIncidentCreated = this._onIncidentCreated.bind(this);
        this._onIncidentContained = this._onIncidentContained.bind(this);
        this._onIncidentSpread = this._onIncidentSpread.bind(this);
        
        // Intel events
        this._onIntelRevealed = this._onIntelRevealed.bind(this);
        this._onIntelPing = this._onIntelPing.bind(this);
        this._onIntelGenerated = this._onIntelGenerated.bind(this);
        
        // Heat events
        this._onHeatChanged = this._onHeatChanged.bind(this);
        
        // Influence operations
        this._onInfluenceOpStarted = this._onInfluenceOpStarted.bind(this);
        this._onInfluenceOpCompleted = this._onInfluenceOpCompleted.bind(this);
        this._onInfluenceOpCancelled = this._onInfluenceOpCancelled.bind(this);
        
        // UI feedback
        this._onUIResourceGained = this._onUIResourceGained.bind(this);
        this._onUIResourceLost = this._onUIResourceLost.bind(this);
        this._onUINotification = this._onUINotification.bind(this);
        this._onUIError = this._onUIError.bind(this);

        // Tier 2B/2C events
        this._onFactionConflict = this._onFactionConflict.bind(this);
        this._onRivalMilestone  = this._onRivalMilestone.bind(this);
    }
    
    /**
     * Register event listeners
     */
    setupListeners() {
        // Player actions
        eventBus.on(EVENT_TYPES.PLAYER_HACKED_NODE, this._onPlayerHackedNode);
        eventBus.on(EVENT_TYPES.PLAYER_BUILT_BUILDING, this._onPlayerBuiltBuilding);
        eventBus.on(EVENT_TYPES.PLAYER_ENTERED_DISTRICT, this._onPlayerEnteredDistrict);
        eventBus.on(EVENT_TYPES.PLAYER_INTERACT, this._onPlayerInteract);
        eventBus.on(EVENT_TYPES.PLAYER_FIRED_WEAPON, this._onPlayerFiredWeapon);

        // Crisis events
        eventBus.on(EVENT_TYPES.CRISIS_STARTED, this._onCrisisStarted);
        eventBus.on(EVENT_TYPES.CRISIS_ESCALATED, this._onCrisisEscalated);
        eventBus.on(EVENT_TYPES.CRISIS_RESOLVED, this._onCrisisResolved);
        eventBus.on(EVENT_TYPES.CRISIS_DAMAGE, this._onCrisisDamage);
        
        // Quest events
        eventBus.on(EVENT_TYPES.QUEST_STARTED, this._onQuestStarted);
        eventBus.on(EVENT_TYPES.QUEST_COMPLETED, this._onQuestCompleted);
        eventBus.on(EVENT_TYPES.QUEST_STEP_COMPLETED, this._onQuestStepCompleted);
        eventBus.on(EVENT_TYPES.CLUE_DISCOVERED, this._onClueDiscovered);
        
        // Interactable events
        eventBus.on(EVENT_TYPES.INTERACTABLE_SUCCESS, this._onInteractableSuccess);
        eventBus.on(EVENT_TYPES.INTERACTABLE_FAILED, this._onInteractableFailed);
        eventBus.on(EVENT_TYPES.INTERACTABLE_AVAILABLE, this._onInteractableAvailable);
        
        // Incident events
        eventBus.on(EVENT_TYPES.INCIDENT_CREATED, this._onIncidentCreated);
        eventBus.on(EVENT_TYPES.INCIDENT_CONTAINED, this._onIncidentContained);
        eventBus.on(EVENT_TYPES.INCIDENT_SPREAD, this._onIncidentSpread);
        
        // Intel events
        eventBus.on(EVENT_TYPES.INTEL_REVEALED, this._onIntelRevealed);
        eventBus.on(EVENT_TYPES.INTEL_PING, this._onIntelPing);
        eventBus.on(EVENT_TYPES.INTEL_GENERATED, this._onIntelGenerated);
        
        // Heat events
        eventBus.on(EVENT_TYPES.HEAT_CHANGED, this._onHeatChanged);
        
        // Influence operations
        eventBus.on(EVENT_TYPES.INFLUENCE_OP_STARTED, this._onInfluenceOpStarted);
        eventBus.on(EVENT_TYPES.INFLUENCE_OP_COMPLETED, this._onInfluenceOpCompleted);
        eventBus.on(EVENT_TYPES.INFLUENCE_OP_CANCELLED, this._onInfluenceOpCancelled);
        
        // UI feedback (custom events)
        eventBus.on('ui_resource_gained', this._onUIResourceGained);
        eventBus.on('ui_resource_lost', this._onUIResourceLost);
        eventBus.on('ui_notification', this._onUINotification);
        eventBus.on('ui_error', this._onUIError);

        // Tier 2B/2C: faction conflicts + rival milestones
        eventBus.on(EVENT_TYPES.FACTION_CONFLICT_TRIGGERED, this._onFactionConflict);
        eventBus.on(EVENT_TYPES.RIVAL_INFLUENCE_MILESTONE,  this._onRivalMilestone);
    }
    
    /**
     * Unregister all event listeners
     */
    teardownListeners() {
        eventBus.off(EVENT_TYPES.PLAYER_HACKED_NODE, this._onPlayerHackedNode);
        eventBus.off(EVENT_TYPES.PLAYER_BUILT_BUILDING, this._onPlayerBuiltBuilding);
        eventBus.off(EVENT_TYPES.PLAYER_ENTERED_DISTRICT, this._onPlayerEnteredDistrict);
        eventBus.off(EVENT_TYPES.PLAYER_INTERACT, this._onPlayerInteract);
        eventBus.off(EVENT_TYPES.PLAYER_FIRED_WEAPON, this._onPlayerFiredWeapon);
        eventBus.off(EVENT_TYPES.CRISIS_STARTED, this._onCrisisStarted);
        eventBus.off(EVENT_TYPES.CRISIS_ESCALATED, this._onCrisisEscalated);
        eventBus.off(EVENT_TYPES.CRISIS_RESOLVED, this._onCrisisResolved);
        eventBus.off(EVENT_TYPES.CRISIS_DAMAGE, this._onCrisisDamage);
        eventBus.off(EVENT_TYPES.QUEST_STARTED, this._onQuestStarted);
        eventBus.off(EVENT_TYPES.QUEST_COMPLETED, this._onQuestCompleted);
        eventBus.off(EVENT_TYPES.QUEST_STEP_COMPLETED, this._onQuestStepCompleted);
        eventBus.off(EVENT_TYPES.CLUE_DISCOVERED, this._onClueDiscovered);
        eventBus.off(EVENT_TYPES.INTERACTABLE_SUCCESS, this._onInteractableSuccess);
        eventBus.off(EVENT_TYPES.INTERACTABLE_FAILED, this._onInteractableFailed);
        eventBus.off(EVENT_TYPES.INTERACTABLE_AVAILABLE, this._onInteractableAvailable);
        eventBus.off(EVENT_TYPES.INCIDENT_CREATED, this._onIncidentCreated);
        eventBus.off(EVENT_TYPES.INCIDENT_CONTAINED, this._onIncidentContained);
        eventBus.off(EVENT_TYPES.INCIDENT_SPREAD, this._onIncidentSpread);
        eventBus.off(EVENT_TYPES.INTEL_REVEALED, this._onIntelRevealed);
        eventBus.off(EVENT_TYPES.INTEL_PING, this._onIntelPing);
        eventBus.off(EVENT_TYPES.INTEL_GENERATED, this._onIntelGenerated);
        eventBus.off(EVENT_TYPES.HEAT_CHANGED, this._onHeatChanged);
        eventBus.off(EVENT_TYPES.INFLUENCE_OP_STARTED, this._onInfluenceOpStarted);
        eventBus.off(EVENT_TYPES.INFLUENCE_OP_COMPLETED, this._onInfluenceOpCompleted);
        eventBus.off(EVENT_TYPES.INFLUENCE_OP_CANCELLED, this._onInfluenceOpCancelled);
        eventBus.off('ui_resource_gained', this._onUIResourceGained);
        eventBus.off('ui_resource_lost', this._onUIResourceLost);
        eventBus.off('ui_notification', this._onUINotification);
        eventBus.off('ui_error', this._onUIError);
        eventBus.off(EVENT_TYPES.FACTION_CONFLICT_TRIGGERED, this._onFactionConflict);
        eventBus.off(EVENT_TYPES.RIVAL_INFLUENCE_MILESTONE,  this._onRivalMilestone);
    }
    
    // ==================== Player Action Handlers ====================
    
    _onPlayerHackedNode(data) {
        if (!this.enabled || !data.interactable) return;
        
        const { interactable, success } = data;
        const config = VFX_CONFIG.PLAYER_HACKED_NODE[success ? 'success' : 'failure'];
        
        // Get world position from interactable
        const pos = this._getInteractablePosition(interactable);
        if (!pos) return;
        
        if (success) {
            if (config.burst) {
                this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z, 
                    config.burst.color, config.burst.count, config.burst.speed);
            }
            if (config.text) {
                this.fxSystem.showFloatingText(pos.x, pos.y, pos.z + 1, 
                    config.text.content, config.text.color, config.text.duration);
            }
        } else {
            if (config.burst) {
                this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z, 
                    config.burst.color, config.burst.count, config.burst.speed);
            }
        }
    }
    
    _onPlayerBuiltBuilding(data) {
        if (!this.enabled || !data.x || !data.y) return;
        
        const config = VFX_CONFIG.PLAYER_BUILT_BUILDING;
        const pos = this._tileToWorldPosition(data.x, data.y);
        if (!pos) return;
        
        // Success burst above the building
        if (config.burst) {
            this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z + 2,
                config.burst.color, config.burst.count, config.burst.speed);
        }
        
        // Dust particles at ground level
        if (config.dust) {
            this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z + 0.1,
                config.dust.color, config.dust.count, config.dust.speed);
        }
        
        // Highlight pulse
        if (config.pulse) {
            this.fxSystem.showHighlightPulse(pos.x, pos.y, pos.z,
                config.pulse.color, config.pulse.duration);
        }
    }
    
    _onPlayerEnteredDistrict(data) {
        if (!this.enabled || !data.districtName) return;
        
        const config = VFX_CONFIG.PLAYER_ENTERED_DISTRICT;
        
        // Show district name at camera position (screen space)
        this.fxSystem.showFloatingText(0, 0, 100, data.districtName, 
            config.text.color, config.text.duration, config.text.fontSize);
    }
    
    _onPlayerInteract(data) {
        if (!this.enabled || !data.interactable) return;
        
        const pos = this._getInteractablePosition(data.interactable);
        if (!pos) return;
        
        this.fxSystem.showHighlightPulse(pos.x, pos.y, pos.z, 
            VFX_COLORS.INFO, 400);
    }
    
    // ==================== Combat Event Handlers ====================

    _onPlayerFiredWeapon(data) {
        if (!this.enabled) return;
        const config = VFX_CONFIG.PLAYER_FIRED_WEAPON;
        const pos = this._tileToWorldPosition(data.x, data.y);
        if (!pos) return;

        const weapon = data.weapon;
        const isMelee = weapon === 'fist' || weapon === 'bat';

        // Muzzle flash burst at player position (ranged only)
        if (!isMelee && config.muzzleFlash) {
            this.fxSystem.showParticleBurst(pos.x, pos.y + 1.2, pos.z,
                config.muzzleFlash.color, config.muzzleFlash.count, config.muzzleFlash.speed);
        }

        // Camera recoil shake (ranged only, light)
        if (!isMelee && config.shake) {
            // Scale shake by weapon type
            const mult = weapon === 'shotgun' ? 2.5 : weapon === 'smg' ? 0.5 : 1;
            this.fxSystem.shakeCamera(config.shake.intensity * mult, config.shake.duration);
        }

        // Hit particle burst at each hit target position
        if (data.hit && data.hits && config.hit) {
            for (const h of data.hits) {
                const hitPos = this._tileToWorldPosition(h.x, h.y);
                if (hitPos) {
                    this.fxSystem.showParticleBurst(hitPos.x, hitPos.y + 0.8, hitPos.z,
                        config.hit.color, config.hit.count, config.hit.speed);
                    // Damage floating text
                    this.fxSystem.showFloatingText(hitPos.x, hitPos.y + 1.5, hitPos.z,
                        'HIT', 0xff4444, 800);
                }
            }
        }

        // Melee hit effects
        if (isMelee && data.hit && data.hits) {
            for (const h of data.hits) {
                const hitPos = this._tileToWorldPosition(h.x, h.y);
                if (hitPos) {
                    this.fxSystem.showParticleBurst(hitPos.x, hitPos.y + 0.8, hitPos.z,
                        0xffaa44, 8, 50);
                    this.fxSystem.shakeCamera(3, 120);
                }
            }
        }
    }

    // ==================== Crisis Event Handlers ====================
    
    _onCrisisStarted(data) {
        if (!this.enabled || !data.crisis) return;

        const config = VFX_CONFIG.CRISIS_STARTED;
        const crisis = data.crisis;

        if (config.shake) {
            // Tier shake intensity by crisis severity (1D)
            const sev = crisis.severity ?? crisis.pressure ?? 1;
            const intensity = Math.min(16, 4 + sev * 2);
            this.fxSystem.shakeCamera(intensity, config.shake.duration);
        }
        if (config.text) {
            // Show crisis type at screen center
            this.fxSystem.showFloatingText(0, 0, 100, 
                `${crisis.type.replace('_', ' ').toUpperCase()}!`, 
                config.text.color, config.text.duration, config.text.fontSize);
        }
    }
    
    _onCrisisEscalated(data) {
        if (!this.enabled) return;

        const config = VFX_CONFIG.CRISIS_ESCALATED;

        if (config.shake) {
            // Escalated = current severity + extra (1D)
            const sev = data.crisis?.severity ?? data.crisis?.pressure ?? 3;
            const intensity = Math.min(20, 6 + sev * 2.5);
            this.fxSystem.shakeCamera(intensity, config.shake.duration);
        }
        if (config.burst) {
            // Show burst at crisis location if available
            const pos = data.crisis?.position ? 
                this._getWorldPosition(data.crisis.position) : { x: 0, y: 0, z: 10 };
            this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z, 
                config.burst.color, config.burst.count, config.burst.speed);
        }
    }
    
    _onCrisisResolved(data) {
        if (!this.enabled) return;
        
        const config = VFX_CONFIG.CRISIS_RESOLVED;
        
        if (config.burst) {
            const pos = data.crisis?.position ? 
                this._getWorldPosition(data.crisis.position) : { x: 0, y: 0, z: 10 };
            this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z, 
                config.burst.color, config.burst.count, config.burst.speed);
        }
        if (config.text) {
            this.fxSystem.showFloatingText(0, 0, 100, 
                config.text.content, config.text.color, config.text.duration);
        }
    }
    
    _onCrisisDamage(data) {
        if (!this.enabled || !data.damage) return;
        
        const config = VFX_CONFIG.CRISIS_DAMAGE;
        const pos = data.position ? this._getWorldPosition(data.position) : null;
        
        if (pos) {
            this.fxSystem.showFloatingText(pos.x, pos.y, pos.z + 2, 
                `-${data.damage}`, config.text.color, config.text.duration);
        }
    }
    
    // ==================== Quest Event Handlers ====================
    
    _onQuestStarted(data) {
        if (!this.enabled || !data.questTitle) return;
        
        const config = VFX_CONFIG.QUEST_STARTED;
        this.fxSystem.showFloatingText(0, 0, 100, 
            `Quest: ${data.questTitle}`, config.text.color, config.text.duration);
    }
    
    _onQuestCompleted(data) {
        if (!this.enabled) return;
        
        const config = VFX_CONFIG.QUEST_COMPLETED;
        
        if (config.burst) {
            this.fxSystem.showParticleBurst(0, 0, 10, 
                config.burst.color, config.burst.count, config.burst.speed);
        }
        if (config.text) {
            this.fxSystem.showFloatingText(0, 0, 100, 
                config.text.content, config.text.color, config.text.duration);
        }
    }
    
    _onQuestStepCompleted(data) {
        if (!this.enabled) return;
        
        const config = VFX_CONFIG.QUEST_STEP_COMPLETED;
        this.fxSystem.showFloatingText(0, 0, 100, 
            'Step Complete', config.text.color, config.text.duration);
    }
    
    _onClueDiscovered(data) {
        if (!this.enabled) return;
        
        const config = VFX_CONFIG.CLUE_DISCOVERED;
        
        // Show at clue position if available
        const pos = data.clue?.position ? 
            this._getWorldPosition(data.clue.position) : { x: 0, y: 0, z: 10 };
        
        if (config.pulse) {
            this.fxSystem.showHighlightPulse(pos.x, pos.y, pos.z, 
                config.pulse.color, config.pulse.duration);
        }
        if (config.text) {
            this.fxSystem.showFloatingText(pos.x, pos.y, pos.z + 1, 
                config.text.content, config.text.color, config.text.duration);
        }
    }
    
    // ==================== Interactable Event Handlers ====================
    
    _onInteractableSuccess(data) {
        if (!this.enabled || !data.interactable) return;
        
        const config = VFX_CONFIG.INTERACTABLE_SUCCESS;
        const pos = this._getInteractablePosition(data.interactable);
        
        if (pos && config.burst) {
            this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z, 
                config.burst.color, config.burst.count, config.burst.speed);
        }
    }
    
    _onInteractableFailed(data) {
        if (!this.enabled || !data.interactable) return;
        
        const config = VFX_CONFIG.INTERACTABLE_FAILED;
        const pos = this._getInteractablePosition(data.interactable);
        
        if (pos && config.burst) {
            this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z, 
                config.burst.color, config.burst.count, config.burst.speed);
        }
    }
    
    _onInteractableAvailable(data) {
        if (!this.enabled || !data.interactable) return;
        
        const config = VFX_CONFIG.INTERACTABLE_AVAILABLE;
        const pos = this._getInteractablePosition(data.interactable);
        
        if (pos && config.pulse) {
            this.fxSystem.showHighlightPulse(pos.x, pos.y, pos.z, 
                config.pulse.color, config.pulse.duration);
        }
    }
    
    // ==================== Incident Event Handlers ====================
    
    _onIncidentCreated(data) {
        if (!this.enabled || !data.incident) return;
        
        const config = VFX_CONFIG.INCIDENT_CREATED;
        const incident = data.incident;
        
        if (config.shake) {
            this.fxSystem.shakeCamera(config.shake.intensity, config.shake.duration);
        }
        if (config.text) {
            const pos = incident.position ? 
                this._getWorldPosition(incident.position) : { x: 0, y: 0, z: 100 };
            this.fxSystem.showFloatingText(pos.x, pos.y, pos.z + 2, 
                incident.name || 'Incident!', config.text.color, config.text.duration);
        }
    }
    
    _onIncidentContained(data) {
        if (!this.enabled) return;
        
        const config = VFX_CONFIG.INCIDENT_CONTAINED;
        const pos = data.incident?.position ? 
            this._getWorldPosition(data.incident.position) : { x: 0, y: 0, z: 10 };
        
        if (config.burst) {
            this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z, 
                config.burst.color, config.burst.count, config.burst.speed);
        }
        if (config.text) {
            this.fxSystem.showFloatingText(pos.x, pos.y, pos.z + 2, 
                config.text.content, config.text.color, config.text.duration);
        }
    }
    
    _onIncidentSpread(data) {
        if (!this.enabled) return;
        
        const config = VFX_CONFIG.INCIDENT_SPREAD;
        const pos = data.position ? this._getWorldPosition(data.position) : null;
        
        if (pos) {
            this.fxSystem.showFloatingText(pos.x, pos.y, pos.z + 2, 
                'Spreading...', config.text.color, config.text.duration);
        }
    }
    
    // ==================== Intel Event Handlers ====================
    
    _onIntelRevealed(data) {
        if (!this.enabled) return;
        
        const config = VFX_CONFIG.INTEL_REVEALED;
        const pos = data.position ? this._getWorldPosition(data.position) : { x: 0, y: 0, z: 10 };
        
        if (config.pulse) {
            this.fxSystem.showHighlightPulse(pos.x, pos.y, pos.z, 
                config.pulse.color, config.pulse.duration);
        }
        if (config.text) {
            this.fxSystem.showFloatingText(pos.x, pos.y, pos.z + 1, 
                config.text.content, config.text.color, config.text.duration);
        }
    }
    
    _onIntelPing(data) {
        if (!this.enabled || !data.ping) return;
        
        const config = VFX_CONFIG.INTEL_PING;
        const pos = this._getWorldPosition(data.ping);
        
        if (pos && config.ring) {
            this.fxSystem.showProgressRing(pos.x, pos.y, pos.z, 
                0, config.ring.color, config.ring.duration);
        }
    }
    
    _onIntelGenerated(data) {
        if (!this.enabled) return;
        
        const config = VFX_CONFIG.INTEL_GENERATED;
        if (config.text) {
            this.fxSystem.showFloatingText(0, 0, 100, 
                config.text.content, config.text.color, config.text.duration);
        }
    }
    
    // ==================== Heat Event Handlers ====================
    
    _onHeatChanged(data) {
        if (!this.enabled || data.oldHeat === undefined) return;
        
        const config = VFX_CONFIG.HEAT_CHANGED;
        const change = data.newHeat - data.oldHeat;
        const heatConfig = change > 0 ? config.increase : config.decrease;
        
        if (heatConfig?.text) {
            const sign = change > 0 ? '+' : '';
            this.fxSystem.showFloatingText(0, 0, 100, 
                `Heat ${sign}${change}`, heatConfig.text.color, heatConfig.text.duration);
        }
    }
    
    // ==================== Influence Operation Handlers ====================
    
    _onInfluenceOpStarted(data) {
        if (!this.enabled || !data.operation) return;
        
        const config = VFX_CONFIG.INFLUENCE_OP_STARTED;
        const pos = data.operation.position ? 
            this._getWorldPosition(data.operation.position) : { x: 0, y: 0, z: 10 };
        
        if (config.ring) {
            this.fxSystem.showProgressRing(pos.x, pos.y, pos.z, 
                0, config.ring.color, config.ring.duration);
        }
    }
    
    _onInfluenceOpCompleted(data) {
        if (!this.enabled || !data.operation) return;
        
        const config = VFX_CONFIG.INFLUENCE_OP_COMPLETED;
        const pos = data.operation.position ? 
            this._getWorldPosition(data.operation.position) : { x: 0, y: 0, z: 10 };
        
        if (config.burst) {
            this.fxSystem.showParticleBurst(pos.x, pos.y, pos.z, 
                config.burst.color, config.burst.count, config.burst.speed);
        }
        if (config.text) {
            const result = data.success ? 'Success!' : 'Failed';
            this.fxSystem.showFloatingText(pos.x, pos.y, pos.z + 1, 
                result, config.text.color, config.text.duration);
        }
    }
    
    _onInfluenceOpCancelled(data) {
        if (!this.enabled) return;
        
        const config = VFX_CONFIG.INFLUENCE_OP_CANCELLED;
        if (config.text) {
            this.fxSystem.showFloatingText(0, 0, 100, 
                config.text.content, config.text.color, config.text.duration);
        }
    }
    
    // ==================== UI Feedback Handlers ====================
    
    _onUIResourceGained(data) {
        if (!this.enabled || !data.amount) return;
        
        const config = VFX_CONFIG.UI_RESOURCE_GAINED;
        this.fxSystem.showFloatingText(0, 0, 100, 
            `+${data.amount} ${data.type}`, config.text.color, config.text.duration);
    }
    
    _onUIResourceLost(data) {
        if (!this.enabled || !data.amount) return;
        
        const config = VFX_CONFIG.UI_RESOURCE_LOST;
        this.fxSystem.showFloatingText(0, 0, 100, 
            `-${data.amount} ${data.type}`, config.text.color, config.text.duration);
    }
    
    _onUINotification(data) {
        if (!this.enabled || !data.message) return;
        
        const config = VFX_CONFIG.UI_NOTIFICATION;
        this.fxSystem.showFloatingText(0, 0, 100, 
            data.message, config.text.color, config.text.duration);
    }
    
    _onUIError(data) {
        if (!this.enabled || !data.message) return;
        
        const config = VFX_CONFIG.UI_ERROR;
        
        if (config.shake) {
            this.fxSystem.shakeCamera(config.shake.intensity, config.shake.duration);
        }
        if (config.text) {
            this.fxSystem.showFloatingText(0, 0, 100, 
                data.message, config.text.color, config.text.duration);
        }
    }
    
    // ==================== Tier 2B/2C Event Handlers ====================

    _onFactionConflict(data) {
        if (!this.enabled) return;
        const cfg = EXTRA_VFX_CONFIG.FACTION_CONFLICT_TRIGGERED;
        if (cfg.shake) {
            this.fxSystem.shakeCamera(cfg.shake.intensity, cfg.shake.duration);
        }
        if (cfg.text) {
            const src = data.sourceFaction || 'Faction';
            const aff = data.affectedFaction || 'Rival';
            this.fxSystem.showFloatingText(0, 0, 100,
                `${src} vs ${aff}`, cfg.text.color, cfg.text.duration, cfg.text.fontSize);
        }
    }

    _onRivalMilestone(data) {
        if (!this.enabled) return;
        const cfg = EXTRA_VFX_CONFIG.RIVAL_INFLUENCE_MILESTONE;
        if (cfg.shake) {
            this.fxSystem.shakeCamera(cfg.shake.intensity, cfg.shake.duration);
        }
        if (cfg.burst) {
            this.fxSystem.showParticleBurst(0, 2, 0,
                cfg.burst.color, cfg.burst.count, cfg.burst.speed);
        }
        if (cfg.text) {
            const level = data.threshold >= 80 ? 'CRITICAL' : 'WARNING';
            this.fxSystem.showFloatingText(0, 0, 100,
                `RIVAL ${level}: ${data.influence?.toFixed(0) ?? data.threshold}% Influence`,
                cfg.text.color, cfg.text.duration, cfg.text.fontSize);
        }
    }

    // ==================== Position Helpers ====================
    
    /**
     * Convert tile coordinates to world position.
     * The renderer maps: wx = tileX - mapWidth/2 + 0.5,  wz = tileY - mapHeight/2 + 0.5
     */
    _tileToWorldPosition(x, y) {
        const halfW = (this.game.map?.width  ?? 48) / 2;
        const halfH = (this.game.map?.height ?? 48) / 2;
        return {
            x: x - halfW + 0.5,
            y: 2,               // slightly above ground (Three.js Y-up)
            z: y - halfH + 0.5,
        };
    }
    
    /**
     * Get world position from various position formats
     */
    _getWorldPosition(pos) {
        if (!pos) return null;
        
        // If already a world position object
        if (pos.x !== undefined && pos.y !== undefined && pos.z !== undefined) {
            return pos;
        }
        
        // If tile coordinates
        if (pos.x !== undefined && pos.y !== undefined) {
            return this._tileToWorldPosition(pos.x, pos.y);
        }
        
        return null;
    }
    
    /**
     * Get world position from interactable object
     */
    _getInteractablePosition(interactable) {
        // Interactables typically have x, y tile coordinates
        if (interactable.x !== undefined && interactable.y !== undefined) {
            return this._tileToWorldPosition(interactable.x, interactable.y);
        }
        
        // Or they might have a position object
        if (interactable.position) {
            return this._getWorldPosition(interactable.position);
        }
        
        return null;
    }
    
    // ==================== Control Methods ====================
    
    /**
     * Enable/disable all VFX triggers
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    /**
     * Set reduced motion mode
     */
    setReducedMotion(enabled) {
        if (this.fxSystem) {
            this.fxSystem.setReducedMotion(enabled);
        }
    }
    
    /**
     * Clear all active VFX
     */
    clear() {
        if (this.fxSystem) {
            this.fxSystem.clear();
        }
    }
    
    /**
     * Get VFX statistics
     */
    getStats() {
        return this.fxSystem ? this.fxSystem.getStats() : {};
    }
}

/**
 * Create a VFX trigger manager instance
 */
export function createVFXTriggerManager(fxSystem, game) {
    return new VFXTriggerManager(fxSystem, game);
}

// Singleton instance
let vfxTriggerManagerInstance = null;

/**
 * Get the global VFX trigger manager instance
 */
export function getVFXTriggerManager() {
    return vfxTriggerManagerInstance;
}

/**
 * Set the global VFX trigger manager instance
 */
export function setVFXTriggerManager(instance) {
    vfxTriggerManagerInstance = instance;
}
