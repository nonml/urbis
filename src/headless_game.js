// Headless Game class - works without browser dependencies
// Used for testing and server-side simulation
import { Resources } from './resources.js';
import { Map } from './map.js';
import { CitizenManager } from './citizen.js';
import { BuildingManager } from './buildings.js';
import { CrisisManager } from './crisis.js';
import { CrisisDirector } from './sim/crisis/director.js';
import { IncidentSystem } from './sim/crisis/incident_system.js';
import { DispatchSystem } from './sim/crisis/dispatch.js';
import { StreetModeManager } from './sim/crisis/street_mode.js';
import { AftermathManager } from './sim/crisis/aftermath.js';
import { DIFFICULTY, BUILDING_TYPES, BUILDING_SECURITY, MAP_PRESETS } from './constants.js';
import { randomSeed32 } from './rng.js';
import { createRNGStreams } from './rng_streams.js';
import { createNewGameState, validateGameState } from './state/game_state.js';
import { ScheduleManager } from './sim/schedule.js';
import { ChunkManager } from './world/chunks.js';
import { validatePlacement } from './build/placement.js';
import { EconomyLedger } from './sim/economy/ledger.js';
import { ServiceManager } from './sim/services/services.js';
import { GoalsManager } from './sim/goals/goals.js';
import { CitizenSim } from './sim/citizens/citizen_sim.js';
import { JobsManager } from './sim/economy/jobs.js';
import { AnomalyDetectors } from './sim/anomalies/detectors.js';
import { ensureCitizenState } from './sim/citizens/citizen_state.js';
import { InteractableManager } from './sim/interactables.js';
import { HeatSystem } from './sim/heat/heat_system.js';
import { QuestEngine } from './sim/quests/quest_engine.js';
import { CaseManager } from './sim/cases/case_manager.js';
import { EvidenceSystem } from './sim/evidence/evidence_system.js';
import { FactionSystem } from './sim/factions/faction_system.js';
import { CampaignModel } from './sim/campaign/model.js';
import { CaseGeneratorV2 } from './sim/campaign/case_generator.js';
import { DialogueManager } from './sim/campaign/dialogue.js';
import { NewsFeed, BriefingSystem } from './sim/campaign/news_feed.js';

// Mock UI class for headless mode
class MockUI {
    constructor(game) {
        this.game = game;
        this.messages = [];
    }
    showMessage(message, type) {
        this.messages.push({ message, type });
    }
    setPlayerTile(x, y) {}
    updateResources() {}
    render() {}
    updateStats() {}
    onWorldRebuilt() {}
    resetCamera() {}
    setupBuildingPanel() {}
    setupInfoTabs() {}
    setupGlobalShortcuts() {}
    setupInput() {}
    showQuestChoice(title, choices, onChoice) {
        if (choices && choices.length > 0 && typeof onChoice === 'function') {
            onChoice(choices[0]);
        }
    }
    showCrisis(crisis, options, onPick) {
        // In headless mode, automatically pick the cheapest option
        if (options && options.length > 0) {
            // Sort by cost (lowest first)
            options.sort((a, b) => {
                const costA = (a.cost?.gold || 0) + (a.cost?.wood || 0) + (a.cost?.food || 0);
                const costB = (b.cost?.gold || 0) + (b.cost?.wood || 0) + (b.cost?.food || 0);
                return costA - costB;
            });
            // Pick cheapest option
            const choice = options[0];
            onPick(choice);
            this.messages.push({ message: `Resolved crisis: ${crisis.name} (${choice.label})`, type: 'crisis' });
        }
    }
}

// Mock minimap
class MockMinimap {
    update() {}
    onWorldRebuilt() {}
}

export class Game {
    constructor(options = {}) {
        const preset = options.mapPreset || 'CITY';
        const seed = options.seed;
        const mode = options.mode || 'standard';

        // Use seeded RNG for world generation, but seed from options or random
        const worldSeed = (seed ?? randomSeed32()) >>> 0;
        this.rngStreams = createRNGStreams(worldSeed);

        // Use sim stream as default for backward compatibility
        this.rng = this.rngStreams.sim;

        // Create fresh GameState - this is the single source of truth
        this.state = createNewGameState({
            mapPreset: preset,
            seed: worldSeed,
        });
        this.state.progress.mode = mode;

        // Initialize systems with references to state
        this.resources = new Resources(this.state.resources);
        this.map = new Map(this.state.map.width, this.state.map.height, this.state.meta.seed, this.rngStreams.world);
        this.citizens = new CitizenManager(this.rngStreams.sim);
        this.buildings = new BuildingManager(this);
        this.crisisManager = new CrisisManager(this, this.rngStreams.sim);

        // Milestone M: Crisis Director v2 system
        this.crisisDirector = new CrisisDirector(this, this.rngStreams.sim);
        this.incidentSystem = new IncidentSystem(this, this.rngStreams.sim);
        this.dispatchSystem = new DispatchSystem(this, this.rngStreams.sim);
        this.streetModeManager = new StreetModeManager(this, this.rngStreams.sim);
        this.aftermathManager = new AftermathManager(this, this.rngStreams.sim);

        // Mock UI and minimap for headless mode
        this.ui = new MockUI(this);
        this.minimap = new MockMinimap();

        this.difficulty = DIFFICULTY.NORMAL;

        // Schedule system for citizen daily routines
        this.scheduleManager = new ScheduleManager(this.map.width, this.map.height, this.map, this.buildings);
        this.nav = this.scheduleManager.nav;
        this.chunks = new ChunkManager(this.map.width, this.map.height, {
            chunkSize: 32,
            activeRadius: 3,
            unloadDelayMs: 2000,
        });
        this.economyLedger = new EconomyLedger(30);
        this.servicesManager = new ServiceManager(this);
        this.powerShortageTicks = 0;
        this.goalsManager = new GoalsManager(this);
        this.goalsManager.setMode(mode);
        this.citizenSim = new CitizenSim(this);
        this.jobsManager = new JobsManager(this);
        this.anomalyDetectors = new AnomalyDetectors(this);
        this.interactables = new InteractableManager(this.map.width, this.map.height, this.state.meta.seed);
        this.interactables.game = this;
        this.heatSystem = new HeatSystem(this);
        this.heatSystem.setHeat(this.state.player.heat || 0);
        this.content = { quests: [] };
        this.questEngine = new QuestEngine(this);
        this.caseManager = new CaseManager(this);
        this.evidenceSystem = new EvidenceSystem(this);

        // Milestone N: Campaign systems
        this.campaign = new CampaignModel(this);
        this.caseGenerator = new CaseGeneratorV2(this);
        this.dialogueManager = new DialogueManager(this);
        this.newsFeed = new NewsFeed(this);
        this.briefingSystem = new BriefingSystem(this);
        this.campaignPanel = null; // No UI in headless mode

        this.factionSystem = new FactionSystem(this);

        this.isRunning = false;
        this.lastFrame = 0;
        this.tickAccumulator = 0;
        this.tickRate = 1000; // 1 second per day (1000ms)
        this.paused = false;

        // Player state
        const cx = Math.floor(this.map.width / 2);
        const cy = Math.floor(this.map.height / 2);
        this.state.player.x = cx;
        this.state.player.y = cy;
        this.state.player.wx = cx + 0.5;
        this.state.player.wz = cy + 0.5;
    }

    /**
     * Initialize the game world - spawn citizens, build initial structures
     */
    init() {
        // Spawn initial citizens
        const startX = Math.floor(this.map.width / 2);
        const startY = Math.floor(this.map.height / 2);

        this.state.player.x = startX;
        this.state.player.y = startY;
        this.state.player.wx = startX + 0.5;
        this.state.player.wz = startY + 0.5;

        // Build initial house
        const houseCost = BUILDING_TYPES['house'].cost;
        this.resources.pay(houseCost);
        this.buildings.build('house', startX, startY);
        this.state.resources.housing = 4;

        for (let i = 0; i < 3; i++) this.citizens.spawnCitizen(startX + i, startY);
        for (const c of this.citizens.citizens) ensureCitizenState(c, this.map);

        this.state.resources.population = this.citizens.getPopulation();
        this.state.resources.housing = this.buildings.totalHousing;

        // Set starting resources (adjust for initial house cost)
        this.state.resources.gold = 100 + houseCost.gold;
        this.state.resources.food = 100;
        this.state.resources.wood = 100;
        this.state.resources.population = this.citizens.getPopulation();

        // Sync state changes back to Resources instance
        this.resources.syncFromState();

        this.ui.showMessage('Welcome to your new city! Build houses to grow your population.', 'success');
        this.ui.showMessage('Select a building from the panel to place it on the map.', 'normal');
        if (this.goalsManager.isSandbox()) {
            this.ui.showMessage('Sandbox mode enabled: win/lose conditions disabled.', 'normal');
        }

        this.ui.setPlayerTile(startX, startY);

        this.interactables.generate(this.map);
        if ((this.state.cases?.active || []).length === 0) {
            this.caseManager.spawnCase('missing_person');
            this.caseManager.spawnCase('corruption');
            this.caseManager.spawnCase('extortion');
        }

        // Initial UI paint
        this.ui.updateResources(this.resources);

        this.start();
    }

    start() {
        this.isRunning = true;
        this.lastFrame = 0;
        this.tickAccumulator = 0;
    }

    stop() {
        this.isRunning = false;
    }

    /**
     * Run simulation for specified number of ticks
     * @param {number} tickCount - Number of ticks to run
     */
    runTicks(tickCount) {
        if (!this.isRunning) {
            this.start();
        }
        for (let i = 0; i < tickCount; i++) {
            this.tickOnce(this.tickRate / 1000);
        }
    }

    /**
     * Single simulation tick - runs deterministic simulation step
     * This is called at fixed intervals (tickRate)
     */
    tickOnce(dt) {
        const oldTime = this.state.time.timeOfDay;
        const tickPerDay = this.state.time.tickPerDay || 24;

        // Update time of day (0.0 to 1.0)
        this.state.time.tick++;
        const newTick = this.state.time.tick;
        this.state.time.timeOfDay = (newTick % tickPerDay) / tickPerDay;

        // Increment day when tick completes a cycle
        if (newTick % tickPerDay === 0) {
            this.resources.day++;
        }
        const ledgerTick = this.economyLedger.beginTick(newTick);

        this.resources._syncState();

        // 1. Daily resource income from buildings
        this.jobsManager.updateAssignments();
        const incomeRaw = this.buildings.getIncome();
        const income = this.jobsManager.scaleIncome(incomeRaw, this.buildings.buildings);
        this.resources.add('gold', income.gold);
        this.resources.add('food', income.food);
        this.resources.add('wood', income.wood);
        this.economyLedger.addDelta(ledgerTick, 'gold', income.gold || 0, 'buildings_income_scaled');
        this.economyLedger.addDelta(ledgerTick, 'food', income.food || 0, 'buildings_income_scaled');
        this.economyLedger.addDelta(ledgerTick, 'wood', income.wood || 0, 'buildings_income_scaled');

        // 2. Daily upkeep
        const upkeep = this.buildings.getTotalUpkeep();
        this.resources.remove('gold', upkeep);
        this.economyLedger.addDelta(ledgerTick, 'gold', -(upkeep || 0), 'buildings_upkeep');
        const wageMult = this.factionSystem.getPerkSnapshot().modifiers.wageMultiplier ?? 1;
        const wages = this.jobsManager.applyWages(this.resources, wageMult);
        this.economyLedger.addDelta(ledgerTick, 'gold', -wages, 'wages');

        const foodUse = Math.max(0, Math.ceil((this.resources.population || 0) / 6));
        this.resources.remove('food', foodUse);
        this.economyLedger.addDelta(ledgerTick, 'food', -foodUse, 'citizen_food');

        // 3. Process citizen daily schedules (movement between home/work/leisure)
        this.processCitizenSchedules(oldTime, this.state.time.timeOfDay);

        // 4. Citizen updates (includes job production)
        // Sort citizens by ID for deterministic ordering
        this.citizens.citizens.sort((a, b) => a.id - b.id);
        const citizenResult = this.citizens.updateAll(this.map, this.buildings);
        this.state.resources.population = this.citizens.getPopulation();
        this.state.resources.housing = this.buildings.totalHousing;

        // 5. Job production (from employed citizens)
        if (citizenResult?.jobProduction) {
            this.resources.recordJobProduction?.(citizenResult.jobProduction);
            this.resources.add('gold', citizenResult.jobProduction.gold || 0);
            this.resources.add('food', citizenResult.jobProduction.food || 0);
            this.resources.add('wood', citizenResult.jobProduction.wood || 0);
            this.economyLedger.addDelta(ledgerTick, 'gold', citizenResult.jobProduction.gold || 0, 'jobs');
            this.economyLedger.addDelta(ledgerTick, 'food', citizenResult.jobProduction.food || 0, 'jobs');
            this.economyLedger.addDelta(ledgerTick, 'wood', citizenResult.jobProduction.wood || 0, 'jobs');
        }

        // 5a. Services + citizen effects
        this.servicesManager.update();
        this.servicesManager.applyCitizenEffects(this.citizens.citizens);
        const policeCov = this.servicesManager.metrics?.city?.police || 0;
        if (policeCov < 0.25) this.factionSystem.modifyRep('citizens', -0.5, 'low_police_coverage', 'services');
        else if (policeCov > 0.6) this.factionSystem.modifyRep('citizens', 0.25, 'safe_streets', 'services');
        if (this.servicesManager.metrics.city.brownout) {
            this.powerShortageTicks++;
        } else {
            this.powerShortageTicks = 0;
        }
        this.anomalyDetectors.run(this.state.time.tick);
        this.factionSystem.update();

        // 6. Day start message (first tick of each day)
        if (this.resources.day === 1 || this.rng.chance(0.3)) {
            this.ui.showMessage(`Day ${this.resources.day} begins...`, 'day-start');
        }

        // 7. Daily happiness check
        if (this.citizens.getAverageHappiness() < 30) {
            this.ui.showMessage('⚠️ Citizens are unhappy!', 'crisis');
        }

        // 8. Crisis check
        this.crisisManager.checkForCrises();
        this.crisisManager.update();

        // Milestone M: Crisis Director v2 systems update
        this.crisisDirector.checkForCrisis(this.state.time.tick);
        this.crisisDirector.updateCrises(this.state.time.tick);
        this.incidentSystem.updateIncidents();
        this.dispatchSystem.updateResponses();
        this.streetModeManager.updateInterventions(this.state.time.tick);
        this.aftermathManager.updateAftermaths();

        this.interactables.updateAll(this.state.time.tick);
        this.heatSystem.decay(false);
        this.questEngine.update();
        this.caseManager.update();

        // 8c. Campaign update
        this.campaign.update();
        this.dialogueManager.update();
        this.newsFeed.update();
        this.briefingSystem.update();

        // 9/10. Goals + win/lose checks
        this.goalsManager.update();

        // 10. Update UI
        this.ui.updateResources(this.resources);
        this.economyLedger.commitTick(ledgerTick);
    }

    /**
     * Process citizen daily schedules - move them between home, work, and leisure
     */
    processCitizenSchedules(oldTime, newTime) {
        this.citizenSim.updateAll(this.citizens.citizens, newTime, this.state.time.tick);
    }

    attemptBuild(type, x, y, options = {}) {
        const buildingType = BUILDING_TYPES[type] || BUILDING_SECURITY[type];
        if (!buildingType) {
            return { ok: false, reason: 'Unknown building type.' };
        }
        const cost = buildingType.cost;
        const rotation = options.rotation ?? 0;

        const placement = validatePlacement(this, type, x, y, rotation);
        if (!placement.ok) {
            this.ui.showMessage(placement.reason, 'crisis');
            return { ok: false, reason: placement.reason };
        }

        // Check resources
        if (!this.resources.canAfford(cost)) {
            this.ui.showMessage(`Cannot afford ${buildingType.name}! Need more resources.`, 'crisis');
            return { ok: false, reason: 'Cannot afford building.' };
        }

        // Build it
        this.resources.pay(cost);
        const building = this.buildings.build(type, x, y, 1, rotation);
        this.scheduleManager.syncNavBuildings(this.buildings);
        this.ui.showMessage(`Built: ${building.name} at (${x}, ${y})`, 'success');
        return { ok: true, building };
    }

    showTileInfo(x, y) {
        const tile = this.map.getTileAt(x, y);
        const buildings = this.buildings.getBuildingsAt(x, y);

        let info = `Tile [${x}, ${y}]: ${this.getTerrainName(tile)}`;

        if (buildings.length > 0) {
            info += ` - Buildings: ${buildings.map(b => b.name).join(', ')}`;
        }

        this.ui.showMessage(info, 'normal');
    }

    getTerrainName(terrain) {
        const names = {
            0: 'Water',
            1: 'Grass',
            2: 'Forest',
            3: 'Mountain'
        };
        return names[terrain] || 'Unknown';
    }

    checkVictoryConditions() {
        const progress = this.buildings.getVictoryProgress();
        const totalProgress = (progress.military + progress.economic + progress.cultural + progress.technological) / 4;

        if (progress.military >= 100) {
            this.stop();
        } else if (progress.economic >= 100) {
            this.stop();
        } else if (progress.cultural >= 100) {
            this.stop();
        } else if (progress.technological >= 100) {
            this.stop();
        }
    }

    applyEffect(effect) {
        for (const [resource, value] of Object.entries(effect)) {
            if (typeof value === 'number') {
                if (resource === 'population') {
                    this.resources.population = Math.max(0, this.resources.population + value);
                } else {
                    if (resource in this.resources) {
                        this.resources.add(resource, value);
                    }
                }
            }
        }
    }

    showMessage(message, type) {
        this.ui.showMessage(message, type);
    }

    getDay() {
        return this.resources.day;
    }

    getResourceReport() {
        return this.economyLedger.getResourceReport(this.resources);
    }

    get player() {
        return this.state.player;
    }

    spawnCase(type, options = {}) {
        return this.caseManager.spawnCase(type, options);
    }

    pickHackAction(interactable) {
        if (!interactable) return null;
        if (interactable.type === 'CCTV_POLE') return 'camera_takeover';
        if (interactable.type === 'POWER_SUBSTATION') return 'district_blackout_ping';
        if (interactable.type === 'TELECOM_BOX') {
            return (interactable.securityLevel || 1) % 2 === 0 ? 'traffic_light_switch' : 'door_unlock';
        }
        return 'door_unlock';
    }

    executeHack(interactable, success) {
        if (!interactable) return { ok: false, reason: 'No interactable selected.' };
        const tick = this.state.time.tick;
        if (!this.interactables.isAvailable(interactable)) {
            return { ok: false, reason: 'Node is cooling down.' };
        }

        this.interactables.startHack(interactable, tick, interactable.securityLevel || 1);

        if (!success) {
            this.interactables.cancelHack(interactable);
            this.interactables.setCooldown(interactable, tick + 10);
            const heat = this.heatSystem.addHeat(5);
            this.factionSystem.modifyRep('police', -3, 'failed_loud_hack', 'hacks');
            this.factionSystem.modifyRep('citizens', -1, 'failed_loud_hack', 'hacks');
            return { ok: true, success: false, cooldownUntil: tick + 10, heat };
        }

        this.interactables.tickHack(interactable, tick, (interactable.securityLevel || 1) * 5 + 1);
        const action = this.pickHackAction(interactable);
        const actionResult = this.interactables.performHackAction(interactable, action, tick);
        if (actionResult.ok) {
            if (actionResult.loud) {
                this.heatSystem.addHeat(12);
                this.factionSystem.modifyRep('police', -4, `hack_${action}`, 'hacks');
                this.factionSystem.modifyRep('citizens', -1, `hack_${action}`, 'hacks');
                this.factionSystem.modifyRep('gangs', 1, `hack_${action}`, 'hacks');
            } else {
                this.heatSystem.addHeat(-2);
                this.factionSystem.modifyRep('citizens', 1, `stealth_hack_${action}`, 'hacks');
                this.factionSystem.modifyRep('corp', 1, `stealth_hack_${action}`, 'hacks');
            }
        }
        return {
            ok: true,
            success: true,
            action,
            actionResult,
            heat: this.heatSystem.getHeat(),
        };
    }

    saveGame() {
        // Build save data from GameState
        const saveData = {
            schemaVersion: 1,
            meta: {
                ...this.state.meta,
                savedAt: Date.now(),
            },
            time: {
                tick: this.state.time.tick,
                paused: this.state.time.paused,
            },
            resources: {
                gold: this.resources.gold,
                food: this.resources.food,
                wood: this.resources.wood,
                population: this.resources.population,
                housing: this.resources.housing,
                day: this.resources.day,
                jobProduction: this.resources.jobProduction,
                totalGoldEarned: this.resources.totalGoldEarned,
                totalFoodProduced: this.resources.totalFoodProduced,
                totalWoodProduced: this.resources.totalWoodProduced,
            },
            map: {
                width: this.map.width,
                height: this.map.height,
                tiles: Array.from(this.map.grid),
            },
            buildings: {
                list: this.buildings.buildings.map(b => ({
                    id: b.id,
                    type: b.type,
                    x: b.x,
                    y: b.y,
                    level: b.level,
                    rotation: b.rotation ?? 0,
                    population: b.population,
                    income: b.income,
                    upkeep: b.upkeep,
                    constructedAt: b.constructedAt,
                })),
                nextId: this.buildings.nextId,
            },
            citizens: {
                list: this.citizens.citizens.map(c => ({
                    id: c.id,
                    x: c.x,
                    y: c.y,
                    age: c.age,
                    happiness: c.happiness,
                    foodLevel: c.foodLevel,
                    job: c.job,
                    salary: c.salary,
                    personality: c.personality,
                    relationships: c.relationships,
                    history: c.history,
                    homeParcel: c.homeParcel,
                    workBuildingId: c.workBuildingId,
                    schedule: c.schedule,
                    needs: c.needs,
                    mood: c.mood,
                    traits: c.traits,
                    relationshipEdges: c.relationshipEdges,
                    unemployedTicks: c.unemployedTicks,
                })),
                nextId: this.citizens.nextId,
            },
            crises: {
                active: this.crisisManager.activeCrisis,
                history: this.crisisManager.eventHistory,
            },
            // Milestone M: Crisis Director v2 state
            crisisDirector: this.crisisDirector.serialize(),
            incidentSystem: this.incidentSystem.serialize(),
            dispatchSystem: this.dispatchSystem.serialize(),
            streetModeManager: this.streetModeManager.serialize(),
            aftermathManager: this.aftermathManager.serialize(),
            quests: this.questEngine.serialize(),
            cases: this.state.cases || { evidence: [] },
            factions: this.state.factions || { list: [] },
            // Milestone N: Campaign data
            campaign: this.campaign?.serialize(),
            player: {
                x: this.state.player.x,
                y: this.state.player.y,
                wx: this.state.player.wx,
                wz: this.state.player.wz,
                yaw: this.state.player.yaw,
                pitch: this.state.player.pitch,
                heat: this.state.player.heat,
                heatState: this.state.player.heatState || this.heatSystem.getStateForHeat(this.state.player.heat || 0),
            },
            progress: this.state.progress || null,
            world: this.state.world || null,
        };

        try {
            localStorage.setItem('cityBuilderSave_v1', JSON.stringify(saveData));
            this.ui.showMessage('Game saved!', 'success');
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            this.ui.showMessage('Failed to save game!', 'crisis');
            return false;
        }
    }

    loadGame() {
        try {
            const saveData = localStorage.getItem('cityBuilderSave_v1');
            if (!saveData) {
                this.ui.showMessage('No save game found!', 'crisis');
                return false;
            }

            const data = JSON.parse(saveData);

            // Validate basic shape
            const validation = validateGameState(data);
            if (!validation.valid) {
                this.ui.showMessage('Save file is corrupted!', 'crisis');
                return false;
            }

            // If map size/seed differs, rebuild the world
            const meta = data.meta || {};
            const needRebuild = meta.mapWidth &&
                (meta.mapWidth !== this.map.width || meta.mapHeight !== this.map.height || meta.seed !== this.state.meta.seed);

            if (needRebuild) {
                this.state.meta.seed = meta.seed >>> 0;
                this.state.map.width = meta.mapWidth;
                this.state.map.height = meta.mapHeight;
                this.rngStreams = createRNGStreams(this.state.meta.seed);
                this.rng = this.rngStreams.sim;
                this.map = new Map(meta.mapWidth, meta.mapHeight, this.state.meta.seed, this.rngStreams.world);
                this.citizens = new CitizenManager(this.rngStreams.sim);
                this.crisisManager = new CrisisManager(this, this.rngStreams.sim);
                this.scheduleManager = new ScheduleManager(this.map.width, this.map.height, this.map, this.buildings);
                this.nav = this.scheduleManager.nav;
                this.chunks = new ChunkManager(this.map.width, this.map.height, {
                    chunkSize: 32,
                    activeRadius: 3,
                    unloadDelayMs: 2000,
                });
                this.economyLedger = new EconomyLedger(30);
                this.servicesManager = new ServiceManager(this);
                this.citizenSim = new CitizenSim(this);
                this.jobsManager = new JobsManager(this);
                this.anomalyDetectors = new AnomalyDetectors(this);
                this.interactables = new InteractableManager(this.map.width, this.map.height, this.state.meta.seed);
                this.interactables.game = this;
                this.heatSystem = new HeatSystem(this);
                this.questEngine = new QuestEngine(this);
                this.caseManager = new CaseManager(this);
                this.evidenceSystem = new EvidenceSystem(this);
                this.factionSystem = new FactionSystem(this);
                this.ui.onWorldRebuilt();
                this.minimap.onWorldRebuilt?.();
            }

            // Restore time
            this.state.time.tick = data.time?.tick || 0;
            this.state.time.paused = data.time?.paused || false;

            // Restore resources
            this.resources.gold = data.resources.gold;
            this.resources.food = data.resources.food;
            this.resources.wood = data.resources.wood;
            this.resources.population = data.resources.population;
            this.resources.housing = data.resources.housing;
            this.resources.day = data.resources.day;
            this.resources.jobProduction = data.resources.jobProduction || { gold: 0, food: 0, wood: 0 };
            this.resources.totalGoldEarned = data.resources.totalGoldEarned || 0;
            this.resources.totalFoodProduced = data.resources.totalFoodProduced || 0;
            this.resources.totalWoodProduced = data.resources.totalWoodProduced || 0;

            // Restore map tiles
            if (data.map && data.map.tiles) {
                this.map.grid = data.map.tiles.map(row =>
                    Array.isArray(row) ? row : new Uint8Array(row)
                );
            }

            // Restore buildings
            this.buildings.buildings = [];
            this.buildings.nextId = data.buildings?.nextId || 1;
            if (data.buildings?.list) {
                for (const b of data.buildings.list) {
                    this.buildings.build(b.type, b.x, b.y, b.level, b.rotation ?? 0);
                }
            }

            // Restore citizens
            this.citizens.citizens = [];
            this.citizens.nextId = data.citizens?.nextId || 1;
            if (data.citizens?.list) {
                for (const c of data.citizens.list) {
                    const citizen = this.citizens.spawnCitizen(c.x, c.y);
                    if (citizen) {
                        citizen.id = c.id;
                        citizen.age = c.age ?? citizen.age;
                        citizen.happiness = c.happiness ?? citizen.happiness;
                        citizen.foodLevel = c.foodLevel ?? citizen.foodLevel;
                        citizen.job = c.job ?? citizen.job;
                        citizen.salary = c.salary ?? citizen.salary;
                        citizen.personality = c.personality ?? citizen.personality;
                        citizen.relationships = c.relationships ?? {};
                        citizen.history = c.history ?? [];
                        citizen.homeParcel = c.homeParcel ?? null;
                        citizen.workBuildingId = c.workBuildingId ?? null;
                        citizen.schedule = c.schedule ?? null;
                        citizen.needs = c.needs ?? null;
                        citizen.mood = c.mood ?? citizen.mood;
                        citizen.traits = c.traits ?? null;
                        citizen.relationshipEdges = c.relationshipEdges ?? [];
                        citizen.unemployedTicks = c.unemployedTicks ?? 0;
                        ensureCitizenState(citizen, this.map);
                    }
                }
            }

            // Restore crises
            this.crisisManager.activeCrisis = data.crises?.active || null;
            this.crisisManager.eventHistory = data.crises?.history || [];

            // Milestone M: Restore crisis Director v2 systems
            if (data.crisisDirector) {
                this.crisisDirector.deserialize(data.crisisDirector);
            }
            if (data.incidentSystem) {
                this.incidentSystem.deserialize(data.incidentSystem);
            }
            if (data.dispatchSystem) {
                this.dispatchSystem.deserialize(data.dispatchSystem);
            }
            if (data.streetModeManager) {
                this.streetModeManager.deserialize(data.streetModeManager);
            }
            if (data.aftermathManager) {
                this.aftermathManager.deserialize(data.aftermathManager);
            }

            this.state.cases = data.cases || this.state.cases || { active: [], completed: [], evidence: [], nextCaseSeed: 1 };
            this.state.factions = data.factions || this.state.factions || { list: ['citizens', 'police', 'gangs', 'corp'], reputation: {}, recentChanges: [] };
            this.state.factions.list = this.state.factions.list || ['citizens', 'police', 'gangs', 'corp'];
            this.state.factions.reputation = this.state.factions.reputation || {};
            this.state.factions.recentChanges = this.state.factions.recentChanges || [];
            this.state.meta.devTuning = this.state.meta.devTuning || { factionMultipliers: { hacks: 1, quests: 1, services: 1 } };
            this.state.meta.devTuning.factionMultipliers = this.state.meta.devTuning.factionMultipliers || { hacks: 1, quests: 1, services: 1 };
            this.questEngine.deserialize(data.quests);

            // Milestone N: Restore campaign
            if (data.campaign) {
                this.campaign?.deserialize(data.campaign);
            }

            // Restore player
            if (data.player) {
                this.state.player.x = data.player.x;
                this.state.player.y = data.player.y;
                this.state.player.wx = data.player.wx ?? (this.state.player.x + 0.5);
                this.state.player.wz = data.player.wz ?? (this.state.player.y + 0.5);
                this.state.player.yaw = data.player.yaw ?? 0;
                this.state.player.pitch = data.player.pitch ?? -0.35;
                this.state.player.heat = data.player.heat ?? 0;
                this.state.player.heatState = data.player.heatState ?? this.heatSystem.getStateForHeat(this.state.player.heat);
                this.ui.setPlayerTile(this.state.player.x, this.state.player.y);
            }

            this.state.progress = data.progress || this.state.progress || { mode: 'standard', goalState: {} };
            this.state.progress.runFlags = this.state.progress.runFlags || {};
            this.state.progress.unlocks = this.state.progress.unlocks || { buildings: [], hacks: [] };
            this.state.progress.rewardLog = this.state.progress.rewardLog || {};
            this.goalsManager.setMode(this.state.progress.mode || 'standard');
            this.state.cases.active = this.state.cases.active || [];
            this.state.cases.completed = this.state.cases.completed || [];
            this.state.cases.evidence = this.state.cases.evidence || [];
            this.state.cases.nextCaseSeed = this.state.cases.nextCaseSeed || 1;
            this.state.world = data.world || this.state.world || { anomalies: [], factionEncounters: [] };
            this.state.world.factionEncounters = this.state.world.factionEncounters || [];
            this.interactables.generate(this.map);
            this.heatSystem.setHeat(this.state.player.heat ?? 0);
            this.caseManager = new CaseManager(this);
            this.evidenceSystem = new EvidenceSystem(this);

            // Milestone N: Initialize campaign case generator
            this.caseGenerator?.init();

            this.factionSystem = new FactionSystem(this);
            this.caseManager.rebuildQuestMap?.();

            this.ui.showMessage('Game loaded!', 'success');
            return true;
        } catch (e) {
            console.error('Load failed:', e);
            this.ui.showMessage('Failed to load save file!', 'crisis');
            return false;
        }
    }
}
