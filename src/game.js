// Core Game class managing state and systems
import { Resources } from './resources.js';
import { Map } from './map.js';
import { CitizenManager } from './citizen.js';
import { BuildingManager } from './buildings.js';
import { CrisisManager } from './crisis.js';
import { CrisisDirector, Crisis, CRISIS_STATE, CRISIS_SEVERITY } from './sim/crisis/director.js';
import { IncidentSystem, Incident } from './sim/crisis/incident_system.js';
import { DispatchSystem, RESPONSE_TEAM_TYPES, RESPONSE_STATE } from './sim/crisis/dispatch.js';
import { StreetModeManager, StreetIntervention, INTERVENTION_TYPES } from './sim/crisis/street_mode.js';
import { AftermathManager, CrisisAftermath, RECOVERY_STATE, RECOVERY_PHASE } from './sim/crisis/aftermath.js';
import { UIManager } from './ui.js';
import { Minimap } from './minimap.js';
import { DIFFICULTY, BUILDING_TYPES, MAP_PRESETS, BUILDING_SECURITY } from './constants.js';
import { RNG, randomSeed32 } from './rng.js';
import { createRNGStreams, createRNGStreamSeeds, createRNGsFromSeeds } from './rng_streams.js';
import { createNewGameState, validateGameState as validateState, migrateState, CURRENT_SCHEMA_VERSION } from './state/game_state.js';
import { validateGameState, assertStateShape } from './state/validate.js';
import { ScheduleManager } from './sim/schedule.js';
import { InteractableManager } from './sim/interactables.js';
import { QuestEngine } from './sim/quests/quest_engine.js';
import { QuestLogUI } from './ui/quest_log.js';
import { loadQuestsFromDirectory } from './content/loader.js';
import { RivalAI } from './sim/rival/rival_ai.js';
import { ProgressionManager } from './sim/progression.js';
import { createTutorialManager } from './sim/tutorial/tutorial.js?v=20260220b';
import { eventBus, Events } from './sim/events.js';
import { VERSION, BUILD_TIMESTAMP } from './version.js?v=20260220';
import { ChunkManager } from './world/chunks.js';
import { validatePlacement } from './build/placement.js';
import { EconomyLedger } from './sim/economy/ledger.js';
import { ServiceManager, computeTransitMetrics } from './sim/services/services.js';
import { BUILDING_EXTENDED, calculateBuildingEffects } from './buildings_extended.js';
import { GoalsManager } from './sim/goals/goals.js';
import { createVictoryManager } from './sim/victory_conditions.js';
import { steam } from './platform/steam.js';
import { MultiplayerClient } from './multiplayer/multiplayer_client.js';
import { CitizenSim } from './sim/citizens/citizen_sim.js';
import { JobsManager } from './sim/economy/jobs.js';
import { AnomalyDetectors } from './sim/anomalies/detectors.js';
import { ensureCitizenState } from './sim/citizens/citizen_state.js';
import { SocialGraph } from './sim/citizens/social_graph.js';
import { CrimeGenerator } from './sim/citizens/crime_generator.js';
import { HousingManager, PopulationManager } from './sim/citizens/household.js';
import { NarrativeEngine } from './sim/narrative/narrative_engine.js';
import { SimChunkManager } from './sim/streaming/sim_cells.js';
import { HeatSystem } from './sim/heat/heat_system.js';
import { CaseManager } from './sim/cases/case_manager.js';
import { EvidenceSystem } from './sim/evidence/evidence_system.js';
import { CampaignModel } from './sim/campaign/model.js';
import { CaseGeneratorV2 } from './sim/campaign/case_generator.js';
import { DialogueManager } from './sim/campaign/dialogue.js';
import { NewsFeed, BriefingSystem } from './sim/campaign/news_feed.js';
import { CampaignPanel } from './ui/campaign_panel.js';
import { NPCGenerator } from './sim/npc_generator.js';
import { FactionSystem } from './sim/factions/faction_system.js';
import { PoliceSystem } from './sim/police/police_system.js';
import { PursuitAI } from './sim/police/pursuit_ai.js';
import { IntelSystem } from './sim/intel/intel_system.js';
import { createIntelDatabase } from './sim/intel/database.js';
import { createSurveillanceSources } from './sim/intel/sources.js';
import { createInfluenceEngine } from './sim/intel/influence_engine.js';
import { createSentimentManager } from './sim/intel/sentiment.js';
import { createHeatManager } from './sim/intel/heat_manager.js';
import { ZoningManager, createZoningManager, ZONE_TYPES } from './sim/zoning/zoning.js';
import { DemandCalculator, createDemandCalculator } from './sim/economy/demand.js';
import { ModeIndicator, MODE_STREET, MODE_GOD } from './ui/mode_indicator.js';
import { PolicyManager } from './sim/politics/policies.js';
import { AppointmentsManager } from './sim/politics/appointments.js';
import { PressureMapManager } from './sim/politics/pressure_map.js';
import { RivalIntegrationManager } from './sim/politics/rival_integration.js';
import { BudgetManager, createBudgetManager } from './sim/economy/budget.js';
import { LoanManager, createLoanManager } from './sim/economy/loans.js';
import { createNetworks } from './sim/networks/network_core.js';
import { createPowerSystem } from './sim/networks/power.js';
import { createWaterSystem } from './sim/networks/water.js';
import { createDataGridSystem } from './sim/networks/data_grid.js';
import { extractRoadGraph } from './sim/traffic/graph_extractor.js';
import { TrafficPathfinder } from './sim/traffic/pathfinder.js';
import { TrafficManager } from './sim/agents/traffic_agent.js';
import { VehicleSystem } from './sim/traffic/vehicle_system.ts';
import { VehicleController } from './vehicles/vehicle_controller.js';
import { PlayerHealth } from './player/health.js';
import { CombatSystem } from './player/combat.js';
import { NPCReactionSystem } from './sim/citizens/npc_reactions.js';
import { WorldHackEffects } from './sim/world_hacks.js';
import { ServiceDispatcher, PoliceRouter, EmergencyRouter } from './sim/services/routing_integration.js';

import { ModLoader } from './mod/mod_loader.js';

// Weather and particle systems (new)
import { WeatherSystem, createWeatherSystem } from './weather_system.js';
import { getParticleSystem, createParticleSystem } from './world/particle_pool.js';
import { TooltipManager, createTooltipManager } from './ui/tooltips.js';

// Roguelike meta imports (Milestone O)
import { createRunSummary, RunSummaryUI } from './ui/run_summary.js';
import { profileManager, calculateRunScore } from './sim/persistence/profile.js';
import { createShop, ShopUI } from './ui/shop.js';
import { SCENARIOS, MUTATORS, ScenarioSelector, scenarioPersistence } from './sim/scenarios.js';
import { createSeedBrowser, SeedBrowserUI, ReplayManager } from './ui/seed_browser.js';

// Dev tools imports (Milestone P)
import { DevMenu } from './dev/dev_menu.js';
import { PlacementTool } from './dev/placement_tool.js';

// Mock UI class for headless mode
class MockUI {
    constructor(game) {
        this.game = game;
        this.messages = [];
    }
    showMessage(message, type) {
        this.messages.push({ message, type });
    }
    showTip(message, duration) {
        this.messages.push({ message, type: 'tip', duration });
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

export class Game {
    constructor(options = {}) {
        const preset = options.mapPreset || 'CITY';
        const seed = options.seed;
        const mode = options.mode || 'standard';

        // Use seeded RNG for world generation, but seed from options or random
        const worldSeed = (seed ?? randomSeed32()) >>> 0;

        // Create RNG streams for deterministic simulation
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
        this.resources.syncFromState();
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

        this.interactables = new InteractableManager(this.map.width, this.map.height, this.state.meta.seed);
        this.interactables.game = this; // Pass game reference for player heat updates

        // Skip UI initialization for headless mode
        this.isHeadless = options.headless || false;
        if (this.isHeadless) {
            this.ui = new MockUI(this);
            this.minimap = { update() {}, onWorldRebuilt() {} };
        } else {
            this.ui = new UIManager(this);
            this.ui.applySettings();
            this.minimap = new Minimap(this);
            // Wire audio manager to resources for resource change sounds
            this.resources.setAudioManager(this.ui.audioManager);
        }

        // Sandbox game-mode overrides difficulty to SANDBOX preset
        const diffKey = (mode === 'sandbox' ? 'SANDBOX' : (options.difficulty || 'NORMAL')).toUpperCase();
        this.difficulty = DIFFICULTY[diffKey] ?? DIFFICULTY.NORMAL;
        this._dda = { struggleTicks: 0, reliefActive: 0 }; // dynamic difficulty adjuster state

        // Modding support (Phase 8)
        this.modLoader = new ModLoader(this);

        // Schedule system for citizen daily routines
        this.scheduleManager = new ScheduleManager(this.map.width, this.map.height, this.map, this.buildings);
        this.nav = this.scheduleManager.nav;

        // Chunk streaming
        this.chunks = new ChunkManager(this.map.width, this.map.height, {
            chunkSize: 32,
            activeRadius: 3,
            unloadDelayMs: 2000,
        });
        this.economyLedger = new EconomyLedger(30);
        this.servicesManager = new ServiceManager(this);
        this.powerShortageTicks = 0;
        this.transitMetrics = { mobilityBonus: 0, transitCoverage: 0, congestionReduction: 0, busRoutes: 0, tollRevenue: 0, trafficControl: 0, connectivityBonus: 0, subwayStations: 0 };
        this.goalsManager = new GoalsManager(this);
        this.goalsManager.setMode(mode);
        this.victoryManager = createVictoryManager(this);
        this.steam = steam;
        steam.init();

        // Multiplayer (opt-in — call game.mp.connect() to activate)
        this.mp = new MultiplayerClient(this);

        // Milestone P: Dev menu (only if not headless)
        this.devMenu = this.isHeadless ? null : new DevMenu(this);
        this.placementTool = this.isHeadless ? null : new PlacementTool(this);

        // Milestone O: Roguelike meta systems
        this.runSummary = this.isHeadless ? null : createRunSummary(this);
        this.shop = this.isHeadless ? null : createShop(this);
        this.seedBrowser = this.isHeadless ? null : createSeedBrowser(this);
        this.scenarioSelector = new ScenarioSelector(this);
        this.scenarioSelector.selectScenario(options.scenario || scenarioPersistence.getDefaultScenario());
        this.scenarioSelector.activeMutators = options.mutators || scenarioPersistence.getDefaultMutators();

        this.citizenSim = new CitizenSim(this);
        this.jobsManager = new JobsManager(this);
        this.anomalyDetectors = new AnomalyDetectors(this);
        this.heatSystem = new HeatSystem(this);
        this.heatSystem.setHeat(this.state.player.heat || 0);

        // Milestone K: Intel systems
        this.intelDatabase = createIntelDatabase(this);
        this.surveillanceSources = createSurveillanceSources(this);
        this.influenceEngine = createInfluenceEngine(this);
        this.sentimentManager = createSentimentManager(this);
        this.heatManager = createHeatManager(this);

        // Quest system
        this.questEngine = new QuestEngine(this);
        this.caseManager = new CaseManager(this);
        this.evidenceSystem = new EvidenceSystem(this);

        // Milestone N: Campaign systems
        this.campaign = new CampaignModel(this);
        this.caseGenerator = new CaseGeneratorV2(this);
        this.dialogueManager = new DialogueManager(this);
        
        // Tier 2B: NPC Generator for emergent narrative
        this.npcGenerator = new NPCGenerator(this.rngStreams.narrative);
        
        this.newsFeed = new NewsFeed(this, this.npcGenerator);
        this.briefingSystem = new BriefingSystem(this);
        if (!this.isHeadless) {
            this.campaignPanel = new CampaignPanel(this);
        }

        this.factionSystem = new FactionSystem(this);
        this.questLogUI = this.isHeadless ? null : new QuestLogUI(this);

        // Milestone L: Politics systems
        this.policyManager = new PolicyManager(this, this.rngStreams.sim);
        this.appointmentsManager = new AppointmentsManager(this, this.rngStreams.sim);
        this.pressureMapManager = new PressureMapManager(this, this.map, this.rngStreams.sim);
        this.rivalIntegrationManager = new RivalIntegrationManager(this, this.rivalAI, this.policyManager, this.pressureMapManager);

        // Rival AI system - uses rival stream for independent determinism
        this.rivalAI = new RivalAI(this.rngStreams.rival);

        // Progression system
        this.progressionManager = new ProgressionManager(this);

        // Tutorial system
        this.tutorialManager = this.isHeadless ? null : createTutorialManager(this);

        // Milestone F: Zoning system
        this.zoningManager = createZoningManager(this.map.width, this.map.height);

        // Milestone F: Demand calculator
        this.demandCalculator = createDemandCalculator();

        // Milestone F: Mode system (default to Street Mode)
        this.mode = MODE_STREET;
        if (!this.isHeadless) {
            this.modeIndicator = new ModeIndicator(this);
            this.modeIndicator.setMode(this.mode);
        }

        // Milestone G: Budget & loans system
        this.budgetManager = createBudgetManager(this);
        this.loanManager = createLoanManager(this);

        // Milestone H: Network systems
        this.networks = createNetworks(this);
        this.powerSystem = createPowerSystem(this);
        this.waterSystem = createWaterSystem(this);
        this.dataGridSystem = createDataGridSystem(this);

        // Milestone I: Traffic system
        this.trafficGraph = extractRoadGraph(this.map);
        this.trafficPathfinder = new TrafficPathfinder(this.trafficGraph, null);
        this.trafficManager = new TrafficManager(this, this.rngStreams.sim);
        this.vehicleSystem = new VehicleSystem(this);

        // Player-drivable vehicle controller (bridges to vehicleSystem traffic vehicles)
        this.vehicleController = new VehicleController(this);

        // Player health/damage system
        this.playerHealth = new PlayerHealth(this);

        // Player combat system
        this.combat = new CombatSystem(this);

        // NPC reaction system (flee, dodge, report)
        this.npcReactions = new NPCReactionSystem(this);

        // Police system (pursuit, enforcement)
        this.policeSystem = new PoliceSystem(this);

        // World hack effects (blackout, traffic freeze, CCTV disable)
        this.worldHacks = new WorldHackEffects(this);

        // Weather and particle systems
        this.weatherSystem = new WeatherSystem(this);
        this.particleSystem = createParticleSystem(this);
        this.tooltipManager = this.isHeadless ? null : new TooltipManager(this);

        // Social graph system (Milestone J)
        this.socialGraph = new SocialGraph(this, this.rngStreams.sim);

        // Crime generator system (Milestone J)
        this.crimeGenerator = new CrimeGenerator(this, this.rngStreams.sim);

        // Emergent narrative engine
        this.narrativeEngine = new NarrativeEngine(this);

        // Housing/Population system (Milestone J)
        this.housingManager = new HousingManager(this, this.rngStreams.sim);
        this.populationManager = new PopulationManager(this, this.rngStreams.sim);
        this.serviceDispatcher = new ServiceDispatcher(this);
        this.serviceDispatcher.setPathfinder(this.trafficPathfinder);
        this.policeRouter = new PoliceRouter(this);
        this.policeRouter.setPathfinder(this.trafficPathfinder);
        this.emergencyRouter = new EmergencyRouter(this);
        this.emergencyRouter.setPathfinder(this.trafficPathfinder);

        this.isRunning = false;
        this.lastFrame = 0;
        this.tickAccumulator = 0;
        this.tickRate = 1000; // 1 second per day (1000ms)
        this.paused = false;

        // Simulation chunking (Milestone Q-01)
        this.chunkManager = new SimChunkManager(this, 64);

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
        const houseCost2 = BUILDING_TYPES['house'].cost;
        this.state.resources.gold = 100 + houseCost2.gold;
        this.state.resources.food = 100;
        this.state.resources.wood = 100;
        this.state.resources.population = this.citizens.getPopulation();

        // Apply scenario and mutators
        this.scenarioSelector.applyToGameState(this.state);

        // Apply difficulty preset (Tier 2D)
        this.applyDifficulty(this.difficulty);

        // Start tutorial if enabled
        if (this.ui.settings.get('showTutorial')) {
            this.tutorialManager.start();
        }

        // Initialize tutorial overlay if player hasn't completed it
        if (this.ui.initTutorial) {
            this.ui.initTutorial();
        }

        this.ui.showMessage('Welcome to your new city! Build houses to grow your population.', 'success');
        this.ui.showMessage('Select a building from the panel to place it on the map.', 'normal');
        if (this.goalsManager.isSandbox()) {
            this.ui.showMessage('Sandbox mode enabled: win/lose conditions disabled.', 'normal');
        }

        this.ui.setPlayerTile(startX, startY);

        // Generate interactables (hacking nodes)
        this.interactables.generate(this.map);
        this.ui.showMessage('Hacking nodes installed across the city!', 'normal');
        if ((this.state.cases?.active || []).length === 0) {
            this.caseManager.spawnCase('missing_person');
            this.caseManager.spawnCase('corruption');
            this.caseManager.spawnCase('extortion');
        }

        // Initial UI paint
        this.ui.updateResources(this.resources);

        // Initialize weather system
        this.weatherSystem.init();

        // Enable dev tools (if in dev mode)
        if (this.devMenu) {
            this.devMenu.enable();
        }
        if (this.placementTool) {
            this.placementTool.enable();
        }

        this.start();
    }

    start() {
        this.isRunning = true;
        this.lastFrame = performance.now();
        this.tickAccumulator = 0;
        this.loop();
    }

    stop() {
        this.isRunning = false;
    }

    /**
     * Restart the game with a new or same seed
     * @param {Object} options - Restart options
     * @param {number} options.seed - Specific seed for replay
     * @param {boolean} options.newSeed - Generate new random seed
     */
    restart(options = {}) {
        const seed = options.newSeed ? undefined : (options.seed || randomSeed32());
        const preset = this.state.map.preset || 'CITY';
        const mode = this.state.progress?.mode || 'standard';

        // Create new game state with the same or new seed
        window.game = new Game({ mapPreset: preset, seed, mode });
        window.game.init();
    }

    /**
     * Main game loop - uses fixed-timestep with accumulator pattern
     * This ensures simulation is independent of render FPS
     */
    loop() {
        if (!this.isRunning) return;

        const now = performance.now();
        const frameDt = Math.min(50, now - this.lastFrame); // clamp to prevent spiral of death
        this.lastFrame = now;

        // Accumulate real time
        this.tickAccumulator += frameDt;

        // Track simDt for player movement (fixed-timestep)
        let simDt = 0;

        // Run fixed-timestep simulation
        if (!this.state.time.paused) {
            while (this.tickAccumulator >= this.tickRate) {
                simDt = this.tickRate / 1000; // convert ms to seconds
                this.tickOnce(simDt);
                this.tickAccumulator -= this.tickRate;
            }
        }

        // Vehicle smooth movement (every frame, not fixed-tick)
        if (!this.state.time.paused && this.vehicleSystem) {
            this.vehicleSystem.update(frameDt / 1000);
        }

        // Player-driven vehicle physics (every frame)
        if (!this.state.time.paused && this.vehicleController?.activeVehicleId) {
            this.vehicleController.update(this.state.time.tick);
        }

        // Player health update (respawn timer, damage flash)
        if (this.playerHealth) {
            this.playerHealth.update(frameDt);
        }

        // Combat system update (muzzle flash timer)
        if (this.combat) {
            this.combat.update(frameDt);
        }

        // UI updates (every frame)
        // Pass simDt for consistent player movement physics
        this.ui.render(frameDt, simDt);

        // Minimap updates (every frame)
        this.minimap.update();

        requestAnimationFrame(() => this.loop());
    }

    /**
     * Single simulation tick - runs deterministic simulation step
     * This is called at fixed intervals (tickRate)
     */
    tickOnce(dt) {
        // Multiplayer lockstep gate — skip simulation body if waiting for server advance
        if (this.mp?.connected && !this.mp.onTick(this.state.time.tick)) return;

        // Compute transit metrics from placed buildings
        const placedBuildings = this.buildings.buildings.reduce((map, b) => {
            if (!map.has(b.type)) map.set(b.type, []);
            map.get(b.type).push(b);
            return map;
        }, new Map());
        this.transitMetrics = computeTransitMetrics(placedBuildings, BUILDING_EXTENDED);
        this.buildingEffects = calculateBuildingEffects(this.buildings.buildings);

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

        // 1. Daily resource income from buildings (Tier 2C: adjacency + decay)
        this.jobsManager.updateAssignments();
        const incomeRaw = this.buildings.getDynamicIncome();
        // Tier 2D: difficulty income bonus (+ dynamic difficulty relief bonus)
        const diffBonus  = this.difficulty?.incomeBonus  ?? 0;
        const reliefMult = this._dda?.reliefActive > 0 ? 0.2 : 0;
        if (diffBonus !== 0 || reliefMult !== 0) {
            const m = 1 + diffBonus + reliefMult;
            incomeRaw.gold = Math.floor(incomeRaw.gold * m);
            incomeRaw.food = Math.floor(incomeRaw.food * m);
            incomeRaw.wood = Math.floor(incomeRaw.wood * m);
        }
        // 1b. Weather income modifier (6B): rain/storm/snow reduce food/wood output
        const weatherFx = this.weatherSystem?.currentEffects;
        if (weatherFx && weatherFx.speedModifier < 1) {
            const wMod = weatherFx.speedModifier; // 0.7–0.9 for bad weather
            incomeRaw.food = Math.floor(incomeRaw.food * wMod);
            incomeRaw.wood = Math.floor(incomeRaw.wood * wMod);
        }

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

        // 2a. Toll revenue from transit buildings
        if (this.transitMetrics && this.transitMetrics.tollRevenue > 0) {
            const tollIncome = Math.floor(this.transitMetrics.tollRevenue);
            this.resources.add('gold', tollIncome);
            this.economyLedger.addDelta(ledgerTick, 'gold', tollIncome, 'toll_revenue');
        }

        // 2b. Tier 2C: Building decay (degrades when city is running a deficit)
        const inDebt = (this.state.resources.gold ?? 0) < 0;
        const decayMult = this.difficulty?.decayMultiplier ?? 1;
        this.buildings.updateDecay(inDebt, decayMult);
        if (inDebt && newTick % 20 === 0) {
            const { critical, degraded } = this.buildings.getConditionSummary();
            if (critical > 0) {
                this.ui?.showMessage?.(`${critical} building(s) in critical condition — repair by clearing debt.`, 'crisis');
            } else if (degraded > 0) {
                this.ui?.showMessage?.(`${degraded} building(s) degrading — income reduced.`, 'warning');
            }
        }

        // 2c. Tier 2D: Dynamic difficulty adjustment
        // Track "struggling" ticks; after 30 consecutive ticks of hardship, grant a 10-tick income relief
        if (this._dda) {
            if (this._dda.reliefActive > 0) {
                this._dda.reliefActive--;
            } else {
                const avgHappy = this.citizens.getAverageHappiness?.() ?? 50;
                const isStruggling = inDebt || (this.state.resources.food < 15 && this.state.resources.gold < 15) || avgHappy < 20;
                if (isStruggling) {
                    this._dda.struggleTicks = (this._dda.struggleTicks || 0) + 1;
                    if (this._dda.struggleTicks >= 30 && !this.difficulty?.sandbox) {
                        this._dda.struggleTicks = 0;
                        this._dda.reliefActive = 10;
                        this.ui?.showMessage?.('Emergency aid incoming — income boosted for 10 ticks.', 'normal');
                        eventBus.emit('ui_notification', { message: 'Emergency Aid Active (+20% income)' });
                    }
                } else {
                    this._dda.struggleTicks = Math.max(0, (this._dda.struggleTicks || 0) - 1);
                }
            }
        }
        const wageMult = this.factionSystem.getPerkSnapshot().modifiers.wageMultiplier ?? 1;
        const wages = this.jobsManager.applyWages(this.resources, wageMult);
        this.economyLedger.addDelta(ledgerTick, 'gold', -wages, 'wages');

        // 2a. Citizen baseline food consumption
        const foodUse = Math.max(0, Math.ceil((this.resources.population || 0) / 6));
        this.resources.remove('food', foodUse);
        this.economyLedger.addDelta(ledgerTick, 'food', -foodUse, 'citizen_food');

        // 3. Process citizen daily schedules (movement between home/work/leisure)
        this.processCitizenSchedules();

        // 4. Citizen updates (includes job production)
        // Sort citizens by ID for deterministic ordering
        this.citizens.citizens.sort((a, b) => a.id - b.id);
        const citizenResult = this.citizens.updateAll(this.map, this.buildings);
        this.state.resources.population = this.citizens.getPopulation();
        this.state.resources.housing = this.buildings.totalHousing;

        // Milestone Q-01: Simulation chunking update
        this.chunkManager.update(this.state.time.tick);

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
        this.servicesManager.applyCitizenEffects(this.citizens.citizens, this.transitMetrics, this.buildingEffects);

        // Milestone I: Traffic system updates
        this.trafficManager.transitMetrics = this.transitMetrics;
        this.trafficManager.update(this.state.time.tick);
        this.trafficManager.updateBusRoutes(this.buildings.buildings);
        this.policeRouter.updatePursuit();
        this.policeSystem.update(this.state.time.tick);
        const policeCov = this.servicesManager.metrics?.city?.police || 0;
        if (policeCov < 0.25) this.factionSystem.modifyRep('citizens', -0.5, 'low_police_coverage', 'services');
        else if (policeCov > 0.6) this.factionSystem.modifyRep('citizens', 0.25, 'safe_streets', 'services');
        if (this.servicesManager.metrics.city.brownout) {
            this.powerShortageTicks++;
            if (this.powerShortageTicks === 1 || this.powerShortageTicks % 5 === 0) {
                this.ui.showMessage('⚡ Brownout: power supply is below demand.', 'crisis');
            }
        } else {
            this.powerShortageTicks = 0;
        }

        // 5b. Milestone F: Demand calculation
        const demand = this.demandCalculator.calculate(this.state);
        this.state.economy.demand = demand;

        // 5c. Milestone G: Budget calculation
        const budgetResult = this.budgetManager.processBudgetTick();
        if (this.state.economy) {
            this.state.economy.lastBudget = {
                income: budgetResult?.income ?? 0,
                expenses: budgetResult?.expenses ?? 0,
                deficit: budgetResult?.deficit ?? 0,
                balanced: budgetResult?.balanced ?? true,
                tick: this.state.time.tick,
            };
        }

        // 5d. Milestone G: Debt payment processing
        this.loanManager.processDebtPayments();

        // 5e. Milestone G: Bankruptcy check
        this.loanManager.checkBankruptcyStatus();

        // 5f. Emergent anomaly detectors
        this.anomalyDetectors.run(this.state.time.tick);

        // Milestone K: Intel systems update
        this.intelDatabase.update();
        this.surveillanceSources.update();
        this.influenceEngine.update();
        this.sentimentManager.update();
        this.heatManager.update();

        this.factionSystem.update();

        // Milestone L: Politics systems update
        this.policyManager.update(this.state.time.tick);
        this.appointmentsManager.update(this.state.time.tick);
        this.pressureMapManager.update(this.state.time.tick);
        this.rivalIntegrationManager.update(this.state, this.state.time.tick);

        // 6. Day start message (first tick of each day)
        if (this.resources.day === 1 || this.rng.chance(0.3)) {
            this.ui.showMessage(`Day ${this.resources.day} begins...`, 'day-start');
        }

        // Emergent narrative beats (once per tick)
        if (this.narrativeEngine) this.narrativeEngine.update();

        // 7. Daily happiness check
        if (this.citizens.getAverageHappiness() < 30) {
            this.ui.showMessage('⚠️ Citizens are unhappy!', 'crisis');
        }

        // 8. Crisis check
        this.crisisManager.checkForCrises();
        this.crisisManager.update();

        // Weather and particle system updates
        this.weatherSystem.update();

        // Milestone M: Crisis Director v2 systems update
        this.crisisDirector.checkForCrisis(this.state.time.tick);
        this.crisisDirector.updateCrises(this.state.time.tick);
        this.incidentSystem.updateIncidents();
        this.dispatchSystem.updateResponses();
        this.streetModeManager.updateInterventions(this.state.time.tick);
        this.aftermathManager.updateAftermaths();

        // 8a. Network systems update
        this.powerSystem?.update();
        this.waterSystem?.update();
        this.dataGridSystem?.update();

        // 8b. Interactables update (cooldowns, state management)
        this.interactables.updateAll(this.state.time.tick);

        // World hack effects (blackout, traffic freeze, CCTV disable)
        this.worldHacks.update(this.state.time.tick);

        // 8b. Quest engine update
        this.questEngine.update();
        this.caseManager.update();

        // 8c. Campaign update
        this.campaign.update();
        this.dialogueManager.update();
        this.newsFeed.update();
        this.briefingSystem.update();

        // 8d. Progression update
        this.progressionManager.update();

        // 8d. Rival AI update
        this.rivalAI.update(this.state, this.state.time.tick);

        // 8e. Tutorial update
        this.tutorialManager?.update();

        // 8d. Heat decay for player
        const prevHeatState = this.state.player.heatState || 'calm';
        this.heatSystem.decay(false);
        const nextHeatState = this.state.player.heatState || 'calm';
        if (nextHeatState !== prevHeatState) {
            this.ui.showMessage(`Heat status: ${nextHeatState.toUpperCase()}`, nextHeatState === 'calm' ? 'normal' : 'crisis');
        }

        // 9/10. Goals + win/lose checks
        this.goalsManager.update();

        // 10b. Victory conditions + achievements
        const victoryResult = this.victoryManager.update();
        if (victoryResult && this.ui) {
            // Show victory screen
            const victoryScreen = this.ui.victoryScreen;
            if (victoryScreen) {
                victoryScreen.show(this.state, victoryResult.victoryDetails);
            }
            // Steam: unlock victory achievement
            if (victoryResult.type) {
                steam.unlock(`victory_${victoryResult.type}`);
            }
            this.stop();
        }

        // Steam: sync achievements and stats each day
        if (this.victoryManager.achievements) {
            for (const ach of this.victoryManager.achievements) {
                if (ach.unlocked && !steam._unlocked.has(ach.id)) {
                    steam.unlock(ach.id);
                }
            }
        }
        steam.setStat('days_survived', this.resources.day ?? 1);
        steam.setStat('buildings_built', this.buildings.buildings?.length ?? 0);
        steam.setStat('population_peak', Math.max(
            this.steam?._stats?.population_peak ?? 0,
            this.resources.population ?? 0
        ));

        // 11. Update UI
        this.ui.updateResources(this.resources);
        this.economyLedger.commitTick(ledgerTick);
    }

    /**
     * Process citizen daily schedules - move them between home, work, and leisure
     */
    processCitizenSchedules() {
        const newTime = this.state.time.timeOfDay;
        this.citizenSim.updateAll(this.citizens.citizens, newTime, this.state.time.tick);
        this.nav = this.scheduleManager.nav;

        // NPC reactions (flee, dodge, report to police)
        if (this.npcReactions) {
            this.npcReactions.update();
        }
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
            // Trigger gold flash animation for visual feedback
            if (this.ui.triggerUnaffordableFlash) {
                this.ui.triggerUnaffordableFlash();
            }
            return { ok: false, reason: 'Cannot afford building.' };
        }

        // Build it
        this.resources.pay(cost);
        const building = this.buildings.build(type, x, y, 1, rotation);
        this.scheduleManager.syncNavBuildings(this.buildings);
        this.ui.showMessage(`Built: ${building.name} at (${x}, ${y})`, 'success');

        // Broadcast to multiplayer peers (no-op when not connected or action is remote)
        if (!options.remote) this.mp?.recordAction('build', { buildingType: type, x, y, rotation });

        // Emit event for tutorial/quest tracking
        Events.playerBuiltBuilding(type, x, y);

        // Show VFX feedback if renderer is available
        if (this.ui.renderer3d) {
            this.ui.renderer3d.showBuildFeedback(x, y, buildingType.name, true);
        }
        return { ok: true, building };
    }

    showTileInfo(x, y) {
        const tile = this.map.getTileAt(x, y);
        const buildings = this.buildings.getBuildingsAt(x, y);

        let info = `Tile [${x}, ${y}]: ${this.getTerrainName(tile)}`;

        if (buildings.length > 0) {
            const details = buildings.map((b) => {
                const staffing = this.jobsManager?.getStaffingRatio?.(b.id);
                const adj = b._adjacencyBonus;
                let label = b.name;
                if (staffing !== undefined) label += ` (staff ${Math.round(staffing * 100)}%)`;
                if (adj) {
                    const bonuses = [];
                    if (adj.gold > 0) bonuses.push(`+${adj.gold}💰`);
                    if (adj.food > 0) bonuses.push(`+${adj.food}🌾`);
                    if (adj.wood > 0) bonuses.push(`+${adj.wood}🪵`);
                    if (bonuses.length) label += ` [${bonuses.join(' ')}]`;
                }
                const adjLabels = this.buildings.getAdjacencyLabels(b);
                if (adjLabels.length) label += ` ✦ ${adjLabels.join(', ')}`;
                return label;
            });
            info += ` — ${details.join(' | ')}`;
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
            this.ui.showVictory('Military', totalProgress);
            this.stop();
        } else if (progress.economic >= 100) {
            this.ui.showVictory('Economic', totalProgress);
            this.stop();
        } else if (progress.cultural >= 100) {
            this.ui.showVictory('Cultural', totalProgress);
            this.stop();
        } else if (progress.technological >= 100) {
            this.ui.showVictory('Technological', totalProgress);
            this.stop();
        } else {
            // Check custom mod scenarios
            const customWin = this.modLoader?.checkCustomVictory();
            if (customWin) {
                this.ui.showVictory(customWin.name, totalProgress);
                this.stop();
            }
        }
    }

    /**
     * Check for game over conditions
     */
    checkLoseConditions() {
        const resources = this.resources;
        const rival = this.state.rival;
        const player = this.state.player;

        // Bankruptcy - no gold and negative income
        if (resources.gold < 0 && resources.jobProduction?.gold <= -10) {
            this.ui.showDefeat('Bankruptcy', 'Your city has run out of funds.');
            this.stop();
            return;
        }

        // Population collapse - too few citizens
        if (resources.population < 5 && resources.day > 30) {
            this.ui.showDefeat('Population Collapse', 'Your city has been abandoned.');
            this.stop();
            return;
        }

        // Heat too high - rival takeover
        if (player.heat >= 100) {
            this.ui.showDefeat('Takeover', 'The rival has gained too much influence and taken over your city.');
            this.stop();
            return;
        }

        // Rival influence too high (city has fallen under their control)
        if (rival && rival.influence >= 100) {
            this.ui.showDefeat('Rival Dominance', 'The rival city has completely dominated your city.');
            this.stop();
            return;
        }

        // Crisis severity - accumulated crisis damage
        const crisisDamage = this.crisisManager.getAccumulatedDamage();
        if (crisisDamage >= 500) {
            this.ui.showDefeat('Civil Collapse', 'Your city has been destroyed by cascading crises.');
            this.stop();
            return;
        }

        // Milestone M: Additional crisis v2 checks
        const aftermathStats = this.aftermathManager.getStats();
        if (aftermathStats.totalDamage.gold >= 500 || aftermathStats.totalDamage.population >= 50) {
            this.ui.showDefeat('Cascading Collapse', 'Your city has been overwhelmed by crisis aftermaths.');
            this.stop();
            return;
        }
    }

    /**
     * Apply a difficulty preset to all tunable systems.
     * Safe to call mid-game (e.g. from settings or a debug menu).
     * @param {Object} preset - One of the DIFFICULTY constants
     */
    applyDifficulty(preset) {
        if (!preset) return;
        this.difficulty = preset;

        // Crisis chance
        this.crisisManager?.setDifficulty(preset);
        this.crisisDirector?.setDifficulty?.(preset);

        // Sandbox mode: flip progress.mode so goalsManager.isSandbox() picks it up
        if (preset.sandbox) {
            this.state.progress = this.state.progress || {};
            this.state.progress.mode = 'sandbox';
        }

        // Starting resources only apply on new-game (don't overwrite mid-game saves)
        if (this.state.time?.tick === 0) {
            const { startingGold, startingFood, startingWood } = preset;
            if (startingGold !== undefined) this.state.resources.gold  = startingGold;
            if (startingFood !== undefined) this.state.resources.food  = startingFood;
            if (startingWood !== undefined) this.state.resources.wood  = startingWood;
            this.resources?.syncFromState?.();
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
                        // Emit VFX event for noticeable resource changes (|value| >= 5)
                        if (Math.abs(value) >= 5) {
                            const eventName = value > 0 ? 'ui_resource_gained' : 'ui_resource_lost';
                            eventBus.emit(eventName, { type: resource, amount: Math.abs(value) });
                        }
                    }
                }
            }
        }
    }

    /**
     * Mutate state safely through a central wrapper
     * This provides a single place for state invariants and validation
     * @param {Function} fn - Function that mutates state
     * @param {Object} options - Validation options
     * @returns {any} Result of the function
     */
    mutate(fn, options = {}) {
        const { validate = true } = options;
        const result = fn(this.state);
        if (validate) {
            const validation = validateGameState(this.state);
            if (!validation.valid) {
                console.error('State mutation failed validation:', validation.errors);
                throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
            }
        }
        return result;
    }

    showMessage(message, type) {
        this.ui.showMessage(message, type);
    }

    showTip(message, duration = 5000) {
        this.ui.showTip(message, duration);
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

    getPinnedChunkTiles() {
        const pinned = [];
        const quests = this.questEngine?.activeQuests || [];
        for (const quest of quests) {
            const markers = quest?.data?.markers || [];
            for (const marker of markers) {
                if (Number.isFinite(marker?.x) && Number.isFinite(marker?.y)) {
                    pinned.push({ x: marker.x, y: marker.y });
                }
            }
        }
        return pinned;
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
            this.audioManager?.playHackFail();
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
        this.audioManager?.playHackSuccess();
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
            schemaVersion: CURRENT_SCHEMA_VERSION,
            meta: {
                ...this.state.meta,
                savedAt: Date.now(),
                version: VERSION,
                buildTimestamp: BUILD_TIMESTAMP,
                // Include rngStreamSeeds for reproducible reloads
                rngStreamSeeds: this.state.meta.rngStreams,
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
            economy: this.state.economy || { demand: { residential: 0.5, commercial: 0.5, industrial: 0.5 }, debt: 0, lastBudget: { income: 0, expenses: 0, deficit: 0, balanced: true, tick: 0 } },
            map: {
                width: this.map.width,
                height: this.map.height,
                tiles: Array.from(this.map.grid), // convert Uint8Array to array
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
                    condition: b.condition ?? 100,
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
            cases: this.state.cases,
            factions: this.state.factions,
            player: {
                x: this.state.player.x,
                y: this.state.player.y,
                wx: this.state.player.wx,
                wz: this.state.player.wz,
                yaw: this.state.player.yaw,
                pitch: this.state.player.pitch,
                heat: this.state.player.heat,
                heatState: this.state.player.heatState || this.heatSystem.getStateForHeat(this.state.player.heat || 0),
                exposure: this.state.player.exposure,
                reputation: this.state.player.reputation,
            },
            rival: this.state.rival || null,
            progression: this.state.progression || null,
            progress: this.state.progress || null,
            world: this.state.world || null,
            // Milestone F: Zoning data
            zoning: this.zoningManager?.serialize(),
            // Milestone F: Current mode
            mode: this.mode,
            // Milestone G: Budget data
            budget: this.budgetManager?.serialize(),
            // Milestone G: Loans data
            loans: this.loanManager?.serialize(),
            // Milestone H: Network data
            networks: this.networks?.serialize(),
            power: this.powerSystem?.serialize(),
            water: this.waterSystem?.serialize(),
            dataGrid: this.dataGridSystem?.serialize(),
            // Milestone I: Traffic data
            trafficGraph: this.trafficGraph?.serialize(),
            trafficManager: this.trafficManager?.serialize(),
            serviceDispatcher: this.serviceDispatcher?.serialize(),
            policeRouter: this.policeRouter?.serialize(),
            emergencyRouter: this.emergencyRouter?.serialize(),
            // Milestone K: Intel systems
            intelDatabase: this.intelDatabase?.serialize(),
            surveillanceSources: this.surveillanceSources?.serialize(),
            influenceEngine: this.influenceEngine?.serialize(),
            sentimentManager: this.sentimentManager?.serialize(),
            heatManager: this.heatManager?.serialize(),
            // Milestone Q-01: Simulation chunking
            chunkManager: this.chunkManager?.serialize(),
            // Milestone N: Campaign data
            campaign: this.campaign?.serialize(),
            // Weather and particle systems
            weatherSystem: this.weatherSystem?.serialize(),
        };

        try {
            localStorage.setItem('cityBuilderSave_v2', JSON.stringify(saveData));
            // Back-compat: also write v1 key so older builds can still load a save.
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
            const saveData = localStorage.getItem('cityBuilderSave_v2') || localStorage.getItem('cityBuilderSave_v1');
            if (!saveData) {
                this.ui.showMessage('No save game found!', 'crisis');
                return false;
            }

            let data = JSON.parse(saveData);

            // Migrate older saves (e.g. v1 missing economy) before validation.
            data = migrateState(data);

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
                // Reconstruct RNG streams from saved seeds or seed
                if (meta.rngStreamSeeds) {
                    this.rngStreams = createRNGsFromSeeds(meta.rngStreamSeeds);
                } else {
                    this.rngStreams = createRNGStreams(this.state.meta.seed);
                }
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
                this.servicesManager = new ServiceManager(this);
                this.powerShortageTicks = 0;
                this.rivalAI = new RivalAI(this.rngStreams.rival);
                this.citizenSim = new CitizenSim(this);
                this.jobsManager = new JobsManager(this);
                this.anomalyDetectors = new AnomalyDetectors(this);
                this.heatSystem = new HeatSystem(this);
                this.interactables = new InteractableManager(this.map.width, this.map.height, this.state.meta.seed);
                this.interactables.game = this;
                this.caseManager = new CaseManager(this);
                this.evidenceSystem = new EvidenceSystem(this);
                this.factionSystem = new FactionSystem(this);
                // Initialize campaign case generator with loaded content
                this.caseGenerator?.init();
                this.questEngine.rng = this.rngStreams.quest;
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

            // Restore economy (v2+)
            if (!this.state.economy) this.state.economy = { demand: { residential: 0.5, commercial: 0.5, industrial: 0.5 }, debt: 0, lastBudget: { income: 0, expenses: 0, deficit: 0, balanced: true, tick: 0 } };
            if (data.economy && typeof data.economy === 'object') {
                this.state.economy.debt = Number(data.economy.debt || 0);
                const d = data.economy.demand || {};
                // Accept old format {res,com,ind}
                this.state.economy.demand = {
                    residential: Number(d.residential ?? d.res ?? 0.5),
                    commercial: Number(d.commercial ?? d.com ?? 0.5),
                    industrial: Number(d.industrial ?? d.ind ?? 0.5),
                };
                this.state.economy.lastBudget = data.economy.lastBudget || this.state.economy.lastBudget;
            }

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
                // Restore condition (build() always starts at 100; patch from save)
                for (let i = 0; i < data.buildings.list.length; i++) {
                    const saved = data.buildings.list[i];
                    if (saved.condition !== undefined && this.buildings.buildings[i]) {
                        this.buildings.buildings[i].condition = saved.condition;
                    }
                }
                this.scheduleManager.syncNavBuildings(this.buildings);
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

            // Restore quests
            this.questEngine.deserialize(data.quests);

            // Restore cases evidence
            this.state.cases = data.cases || { active: [], completed: [], evidence: [], nextCaseSeed: 1 };
            // Restore campaign cases
            if (data.campaign?.cases) {
                this.state.campaign = this.state.campaign || {};
                this.state.campaign.cases = data.campaign.cases;
                this.state.campaign.activeCaseId = data.campaign.activeCaseId;
            }
            this.state.factions = data.factions || { list: ['citizens', 'police', 'gangs', 'corp'], reputation: {}, recentChanges: [] };
            this.state.factions.list = this.state.factions.list || ['citizens', 'police', 'gangs', 'corp'];
            this.state.factions.reputation = this.state.factions.reputation || {};
            this.state.factions.recentChanges = this.state.factions.recentChanges || [];
            this.state.meta.devTuning = this.state.meta.devTuning || { factionMultipliers: { hacks: 1, quests: 1, services: 1 } };
            this.state.meta.devTuning.factionMultipliers = this.state.meta.devTuning.factionMultipliers || { hacks: 1, quests: 1, services: 1 };

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
                this.state.player.exposure = data.player.exposure ?? 0;
                this.state.player.reputation = data.player.reputation ?? 50;
                this.ui.setPlayerTile(this.state.player.x, this.state.player.y);
            }

            // Restore rival
            this.state.rival = data.rival || this.rivalAI.createInitialState();

            // Restore progression
            this.state.progression = data.progression || { points: 0, unlocked: [], completedCases: 0, districtStability: {} };
            this.progressionManager.deserialize(this.state.progression);
            this.state.progress = data.progress || this.state.progress || { mode: 'standard', goalState: {} };
            this.state.progress.runFlags = this.state.progress.runFlags || {};
            this.state.progress.unlocks = this.state.progress.unlocks || { buildings: [], hacks: [] };
            this.state.progress.rewardLog = this.state.progress.rewardLog || {};
            this.state.cases.active = this.state.cases.active || [];
            this.state.cases.completed = this.state.cases.completed || [];
            this.state.cases.evidence = this.state.cases.evidence || [];
            this.state.cases.nextCaseSeed = this.state.cases.nextCaseSeed || 1;
            this.state.world = data.world || this.state.world || { anomalies: [], factionEncounters: [] };
            this.state.world.factionEncounters = this.state.world.factionEncounters || [];
            this.goalsManager.setMode(this.state.progress.mode || 'standard');
            this.interactables.generate(this.map);
            this.heatSystem.setHeat(this.state.player.heat ?? 0);
            this.caseManager = new CaseManager(this);
            this.evidenceSystem = new EvidenceSystem(this);

            // Milestone N: Restore campaign
            if (data.campaign) {
                this.campaign?.deserialize(data.campaign);
            }

            this.factionSystem = new FactionSystem(this);
            this.caseManager.rebuildQuestMap?.();

            // Milestone F: Restore zoning
            if (data.zoning) {
                this.zoningManager?.deserialize(data.zoning);
            }

            // Milestone F: Restore mode
            if (data.mode !== undefined) {
                this.mode = data.mode;
                this.modeIndicator?.setMode(this.mode);
            }

            // Milestone G: Restore budget
            if (data.budget) {
                this.budgetManager?.deserialize(data.budget);
            }

            // Milestone G: Restore loans
            if (data.loans) {
                this.loanManager?.deserialize(data.loans);
            }

            // Milestone H: Restore networks
            if (data.networks) {
                this.networks?.deserialize(data.networks);
            }
            if (data.power) {
                this.powerSystem?.deserialize(data.power);
            }
            if (data.water) {
                this.waterSystem?.deserialize(data.water);
            }
            if (data.dataGrid) {
                this.dataGridSystem?.deserialize(data.dataGrid);
            }

            // Milestone I: Restore traffic
            if (data.trafficGraph) {
                this.trafficGraph?.deserialize(data.trafficGraph);
            }
            if (data.trafficManager) {
                this.trafficManager?.deserialize(data.trafficManager);
            }
            if (data.serviceDispatcher) {
                this.serviceDispatcher?.deserialize(data.serviceDispatcher);
            }
            if (data.policeRouter) {
                this.policeRouter?.deserialize(data.policeRouter);
            }
            if (data.emergencyRouter) {
                this.emergencyRouter?.deserialize(data.emergencyRouter);
            }

            // Milestone K: Restore intel systems
            if (data.intelDatabase) {
                this.intelDatabase?.loadState();
            }
            if (data.surveillanceSources) {
                this.surveillanceSources?.deserialize(data.surveillanceSources);
            }
            if (data.influenceEngine) {
                this.influenceEngine?.loadState();
            }
            if (data.sentimentManager) {
                this.sentimentManager?.loadState();
            }
            if (data.heatManager) {
                this.heatManager?.loadState();
            }
            if (data.chunkManager) {
                this.chunkManager.deserialize(data.chunkManager);
            }

            // Weather and particle systems
            if (data.weatherSystem) {
                this.weatherSystem?.deserialize(data.weatherSystem);
            }

            this.ui.showMessage('Game loaded!', 'success');
            return true;
        } catch (e) {
            console.error('Load failed:', e);
            this.ui.showMessage('Failed to load save file!', 'crisis');
            return false;
        }
    }
}
