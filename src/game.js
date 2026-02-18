// Core Game class managing state and systems
import { Resources } from './resources.js';
import { Map } from './map.js';
import { CitizenManager } from './citizen.js';
import { BuildingManager } from './buildings.js';
import { CrisisManager } from './crisis.js';
import { UIManager } from './ui.js';
import { Minimap } from './minimap.js';
import { DIFFICULTY, BUILDING_TYPES, MAP_PRESETS } from './constants.js';
import { RNG } from './rng.js';

export class Game {
    constructor(options = {}) {
        const preset = options.mapPreset || 'SMALL';
        const presetDef = MAP_PRESETS[preset] || MAP_PRESETS.SMALL;
        this.mapPreset = preset;
        this.seed = (options.seed ?? Math.floor(Math.random() * 1000000)) >>> 0;
        this.rng = new RNG(this.seed);

        this.resources = new Resources();
        this.map = new Map(presetDef.width, presetDef.height, this.seed, this.rng);
        this.citizens = new CitizenManager(this.rng);
        // Pass game reference (required for upgrades + future systems)
        this.buildings = new BuildingManager(this);
        this.crisisManager = new CrisisManager(this, this.rng);
        this.ui = new UIManager(this);
        this.minimap = new Minimap(this);
        this.difficulty = DIFFICULTY.NORMAL;
        this.isRunning = false;
        this.lastFrame = 0;
        this.tickAccumulator = 0;
        this.tickRate = 1000; // 1 second per day
        this.paused = false;

        // Player state
        // x,y are tile coords; wx,wz are continuous world coords used by 3D renderer.
        const cx = Math.floor(this.map.width / 2);
        const cy = Math.floor(this.map.height / 2);
        this.player = { x: cx, y: cy, wx: cx + 0.5, wz: cy + 0.5 };
    }

    init() {
        // Spawn initial citizens
        const startX = Math.floor(this.map.width / 2);
        const startY = Math.floor(this.map.height / 2);

        this.player.x = startX;
        this.player.y = startY;
        this.player.wx = startX + 0.5;
        this.player.wz = startY + 0.5;

        // Build initial house
        const houseCost = BUILDING_TYPES['house'].cost;
        this.resources.pay(houseCost);
        this.buildings.build('house', startX, startY);
        this.resources.housing = 4;

        for (let i = 0; i < 3; i++) this.citizens.spawnCitizen(startX + i, startY);

        this.resources.population = this.citizens.getPopulation();
        this.resources.housing = this.buildings.totalHousing;

        // Set starting resources
        this.resources.gold = 100;
        this.resources.food = 100;
        this.resources.wood = 100;
        this.resources.population = this.citizens.getPopulation();

        this.ui.showMessage('Welcome to your new city! Build houses to grow your population.', 'success');
        this.ui.showMessage('Select a building from the panel to place it on the map.', 'normal');

        this.ui.setPlayerTile(startX, startY);

        // Initial UI paint
        this.ui.updateResources(this.resources);

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

    loop() {
        if (!this.isRunning) return;

        const now = performance.now();
        const frameDt = Math.min(50, now - this.lastFrame); // clamp
        this.lastFrame = now;

        // Game tick (daily updates)
        if (!this.paused) {
            this.tickAccumulator += frameDt;
            while (this.tickAccumulator >= this.tickRate) {
                this.tick();
                this.tickAccumulator -= this.tickRate;
            }
        }

        // UI updates (every frame)
        this.ui.render(frameDt);

        // Minimap updates (every frame)
        this.minimap.update();

        requestAnimationFrame(() => this.loop());
    }

    tick() {
        // Advance day
        this.resources.day++;

        // Daily resource income
        const income = this.buildings.getIncome();
        this.resources.add('gold', income.gold);
        this.resources.add('food', income.food);
        this.resources.add('wood', income.wood);

        // Daily upkeep
        const upkeep = this.buildings.getTotalUpkeep();
        this.resources.remove('gold', upkeep);

        // Citizen updates
        const citizenResult = this.citizens.updateAll(this.map, this.buildings);
        this.resources.population = this.citizens.getPopulation();
        this.resources.housing = this.buildings.totalHousing;

        // Day start message (first tick of each day)
        if (this.resources.day === 1 || this.rng.chance(0.3)) {
            this.ui.showMessage(`Day ${this.resources.day} begins...`, 'day-start');
        }

        // Daily happiness check
        if (this.citizens.getAverageHappiness() < 30) {
            this.ui.showMessage('⚠️ Citizens are unhappy!', 'crisis');
        }

        // Crisis check
        this.crisisManager.checkForCrises();
        this.crisisManager.update();

        // Victory checks
        this.checkVictoryConditions();

        // Update UI
        this.ui.updateResources(this.resources);
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

        // Build it with animation
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
        const saveData = {
            meta: {
                seed: this.seed,
                mapPreset: this.mapPreset,
                mapWidth: this.map.width,
                mapHeight: this.map.height,
                tickRate: this.tickRate
            },
            resources: {
                gold: this.resources.gold,
                food: this.resources.food,
                wood: this.resources.wood,
                population: this.resources.population,
                housing: this.resources.housing,
                day: this.resources.day
            },
            buildings: this.buildings.buildings.map(b => ({
                type: b.type,
                x: b.x,
                y: b.y
            })),
            citizens: this.citizens.citizens.map(c => ({
                x: c.x,
                y: c.y,
                age: c.age,
                happiness: c.happiness,
                foodLevel: c.foodLevel,
                job: c.job,
                salary: c.salary,
                personality: c.personality
            })),
            player: { x: this.player.x, y: this.player.y, wx: this.player.wx, wz: this.player.wz }
        };
        localStorage.setItem('cityBuilderSave', JSON.stringify(saveData));
        this.ui.showMessage('Game saved!', 'success');
    }

    loadGame() {
        const saveData = localStorage.getItem('cityBuilderSave');
        if (!saveData) {
            this.ui.showMessage('No save game found!', 'crisis');
            return;
        }

        const data = JSON.parse(saveData);

        // If map size/seed differs, rebuild the whole game world deterministically
        const meta = data.meta || {};
        const needRebuild = meta.mapWidth && (meta.mapWidth !== this.map.width || meta.mapHeight !== this.map.height || meta.seed !== this.seed);
        if (needRebuild) {
            this.seed = (meta.seed ?? this.seed) >>> 0;
            this.mapPreset = meta.mapPreset || this.mapPreset;
            this.rng = new RNG(this.seed);
            this.map = new Map(meta.mapWidth, meta.mapHeight, this.seed, this.rng);
            this.citizens.rng = this.rng;
            this.crisisManager.rng = this.rng;
            this.ui.onWorldRebuilt();
            this.minimap.onWorldRebuilt?.();
        }
        this.resources.gold = data.resources.gold;
        this.resources.food = data.resources.food;
        this.resources.wood = data.resources.wood;
        this.resources.population = data.resources.population;
        this.resources.housing = data.resources.housing;
        this.resources.day = data.resources.day;

        // Reset and rebuild
        this.buildings.buildings = [];
        this.citizens.citizens = [];

        for (const b of data.buildings) {
            this.buildings.build(b.type, b.x, b.y);
        }

        for (const c of data.citizens) {
            const citizen = this.citizens.spawnCitizen(c.x, c.y);
            if (citizen && c) {
                citizen.age = c.age ?? citizen.age;
                citizen.happiness = c.happiness ?? citizen.happiness;
                citizen.foodLevel = c.foodLevel ?? citizen.foodLevel;
                citizen.job = c.job ?? citizen.job;
                citizen.salary = c.salary ?? citizen.salary;
                citizen.personality = c.personality ?? citizen.personality;
            }
        }

        if (data.player) {
            this.player.x = data.player.x;
            this.player.y = data.player.y;
            this.player.wx = data.player.wx ?? (this.player.x + 0.5);
            this.player.wz = data.player.wz ?? (this.player.y + 0.5);
            this.ui.setPlayerTile(this.player.x, this.player.y);
        }

        this.ui.showMessage('Game loaded!', 'success');
    }
}