// Headless Game class - works without browser dependencies
// Used for testing and server-side simulation
import { Resources } from './resources.js';
import { Map } from './map.js';
import { CitizenManager } from './citizen.js';
import { BuildingManager } from './buildings.js';
import { CrisisManager } from './crisis.js';
import { DIFFICULTY, BUILDING_TYPES, MAP_PRESETS } from './constants.js';
import { RNG } from './rng.js';
import { createNewGameState, validateGameState } from './state/game_state.js';
import { ScheduleManager } from './sim/schedule.js';

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

        // Use seeded RNG for world generation, but seed from options or random
        const worldSeed = (seed ?? Math.floor(Math.random() * 1000000)) >>> 0;
        this.rng = new RNG(worldSeed);

        // Create fresh GameState - this is the single source of truth
        this.state = createNewGameState({
            mapPreset: preset,
            seed: worldSeed,
        });

        // Initialize systems with references to state
        this.resources = new Resources(this.state.resources);
        this.map = new Map(this.state.map.width, this.state.map.height, this.state.meta.seed, this.rng);
        this.citizens = new CitizenManager(this.rng);
        this.buildings = new BuildingManager(this);
        this.crisisManager = new CrisisManager(this, this.rng);

        // Mock UI and minimap for headless mode
        this.ui = new MockUI(this);
        this.minimap = new MockMinimap();

        this.difficulty = DIFFICULTY.NORMAL;

        // Schedule system for citizen daily routines
        this.scheduleManager = new ScheduleManager(this.map.width, this.map.height);

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

        this.ui.setPlayerTile(startX, startY);

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

        this.resources._syncState();

        // 1. Daily resource income from buildings
        const income = this.buildings.getIncome();
        this.resources.add('gold', income.gold);
        this.resources.add('food', income.food);
        this.resources.add('wood', income.wood);

        // 2. Daily upkeep
        const upkeep = this.buildings.getTotalUpkeep();
        this.resources.remove('gold', upkeep);

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
        }

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

        // 9. Victory checks
        this.checkVictoryConditions();

        // 10. Update UI
        this.ui.updateResources(this.resources);
    }

    /**
     * Process citizen daily schedules - move them between home, work, and leisure
     */
    processCitizenSchedules(oldTime, newTime) {
        const gameData = { map: this.map, buildings: this.buildings };
        const tickPerDay = this.state.time.tickPerDay || 24;

        // Process phase transitions and schedule updates
        const scheduleResult = this.scheduleManager.updateSchedules(
            this.citizens.citizens,
            gameData,
            oldTime,
            newTime
        );

        // Log phase changes (debug)
        if (scheduleResult.transition) {
            const phase = this.scheduleManager.getPhaseAt(newTime);
            // In headless mode, just track it; UI would show this in a full game
        }
    }

    attemptBuild(type, x, y) {
        const buildingType = BUILDING_TYPES[type];
        const cost = buildingType.cost;

        // Check resources
        if (!this.resources.canAfford(cost)) {
            this.ui.showMessage(`Cannot afford ${buildingType.name}! Need more resources.`, 'crisis');
            return;
        }

        // Check placement
        if (!this.buildings.isValidPlacement(x, y, this.map)) {
            this.ui.showMessage('Cannot build here! Must be on valid terrain near other buildings.', 'crisis');
            return;
        }

        // Build it
        this.resources.pay(cost);
        const building = this.buildings.build(type, x, y);
        this.ui.showMessage(`Built: ${building.name} at (${x}, ${y})`, 'success');
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
                })),
                nextId: this.citizens.nextId,
            },
            crises: {
                active: this.crisisManager.activeCrisis,
                history: this.crisisManager.eventHistory,
            },
            player: {
                x: this.state.player.x,
                y: this.state.player.y,
                wx: this.state.player.wx,
                wz: this.state.player.wz,
                yaw: this.state.player.yaw,
                pitch: this.state.player.pitch,
            },
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
                this.rng = new RNG(this.state.meta.seed);
                this.map = new Map(meta.mapWidth, meta.mapHeight, this.state.meta.seed, this.rng);
                this.citizens.rng = this.rng;
                this.crisisManager.rng = this.rng;
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
                    this.buildings.build(b.type, b.x, b.y, b.level);
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
                    }
                }
            }

            // Restore crises
            this.crisisManager.activeCrisis = data.crises?.active || null;
            this.crisisManager.eventHistory = data.crises?.history || [];

            // Restore player
            if (data.player) {
                this.state.player.x = data.player.x;
                this.state.player.y = data.player.y;
                this.state.player.wx = data.player.wx ?? (this.state.player.x + 0.5);
                this.state.player.wz = data.player.wz ?? (this.state.player.y + 0.5);
                this.state.player.yaw = data.player.yaw ?? 0;
                this.state.player.pitch = data.player.pitch ?? -0.35;
                this.ui.setPlayerTile(this.state.player.x, this.state.player.y);
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