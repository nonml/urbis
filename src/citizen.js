// Citizen class for NPC simulation
import { BUILDING_HOUSE, JOB_TYPES } from './constants.js';

export class Citizen {
    constructor(id, x, y, rng, personality = null) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.rng = rng;
        this.age = 18;
        this.happiness = 100;
        this.foodLevel = 100;
        this.job = 'unemployed';
        this.salary = 0;
        this.relationships = {};
        this.goals = [];
        this.history = [];
        this.personality = personality || this.generatePersonality();
        this.createdAt = Date.now();
        this.isDead = false;
        // Needs for new citizen simulation system
        this.needs = {
            food: 100,
            rest: 100,
            safety: 100,
        };
        this.mood = 'content';
        this.traits = [];
        this.householdId = null;
        this.homeParcel = null;
        this.workBuildingId = null;
        this.unemployedTicks = 0;
        this.schedule = {
            night: 'home',
            morning: 'work',
            day: 'work',
            evening: 'leisure',
            dusk: 'home',
        };
        this.relationshipEdges = [];
    }

    generatePersonality() {
        const traits = ['ambitious', 'frugal', 'social', 'creative', 'hardworking', 'lucky', 'lazy', 'curious'];
        const trait1 = traits[Math.floor(this.rng.next() * traits.length)];
        let trait2 = traits[Math.floor(this.rng.next() * traits.length)];
        while (trait2 === trait1) {
            trait2 = traits[Math.floor(this.rng.next() * traits.length)];
        }
        return { primary: trait1, secondary: trait2 };
    }

    getNeeds() {
        return {
            food: this.foodLevel < 30,
            shelter: this.happiness < 40,
            social: Object.keys(this.relationships).length < 2,
            work: this.job === 'unemployed' && this.age > 16
        };
    }

    updateDaily(jobOpportunities) {
        // Age increment
        if (this.rng.chance(0.05)) {
            this.age++;
        }

        // Food consumption (citizens eat 2 food per day)
        this.foodLevel -= 2;
        if (this.foodLevel <= 0) {
            this.happiness -= 15;
            this.foodLevel = 0;
        }

        // Job production (citizens produce resources based on job)
        if (this.job !== 'unemployed' && this.job in JOB_TYPES) {
            const jobInfo = JOB_TYPES[this.job];
            this.produceResources(jobInfo.production);
        }

        // Happiness decay (reduced if employed)
        this.happiness -= this.job === 'unemployed' ? 1 : 0.5;

        // Job happiness modifier
        if (this.job in JOB_TYPES) {
            this.happiness += JOB_TYPES[this.job].happinessModifier;
        }

        // Salary income
        if (this.salary > 0) {
            this.happiness += this.salary / 10;
        }

        // Check for death
        if (this.age > 80 || this.happiness <= 0 || this.foodLevel <= 0) {
            if (this.rng.chance(0.3)) {
                this.isDead = true;
                return { type: 'death', message: `Citizen #${this.id} died` };
            }
        }

        // Update job based on personality and availability
        this.updateJob(jobOpportunities);

        // Generate random story event
        const event = this.generateStoryEvent();
        if (event) {
            this.history.push(event);
            return event;
        }

        return null;
    }

    produceResources(production) {
        // Add production to a temporary storage (handled by manager)
        // Returns the production amount for each resource
        return {
            gold: production.gold || 0,
            food: production.food || 0,
            wood: production.wood || 0
        };
    }

    updateJob(jobOpportunities) {
        // Reset job if current job is no longer available
        if (this.job !== 'unemployed' && !this.hasJobAvailability(jobOpportunities)) {
            this.job = 'unemployed';
            this.salary = 0;
        }

        if (this.job === 'unemployed' && this.age > 16) {
            // Find job based on personality and available opportunities
            const suitableJobs = Object.keys(JOB_TYPES).filter(job =>
                job !== 'unemployed' && this.isSuitableForJob(job)
            ).filter(job => jobOpportunities[job] && jobOpportunities[job].count > 0);

            if (suitableJobs.length > 0) {
                // Pick best match based on personality
                let bestJob = suitableJobs[0];
                let bestScore = -1;

                for (const job of suitableJobs) {
                    const score = this.calculateJobScore(job);
                    if (score > bestScore) {
                        bestScore = score;
                        bestJob = job;
                    }
                }

                this.job = bestJob;
                this.salary = JOB_TYPES[bestJob].baseSalary;
            }
        }
    }

    hasJobAvailability(jobOpportunities) {
        if (this.job === 'unemployed') return true;
        return jobOpportunities[this.job] && jobOpportunities[this.job].count > 0;
    }

    isSuitableForJob(job) {
        const jobInfo = JOB_TYPES[job];
        const personality = this.personality;

        // Hardworking types prefer physical jobs
        if (personality.primary === 'hardworking' || personality.secondary === 'hardworking') {
            if (job === 'farmer' || job === 'lumberjack' || job === 'soldier') return true;
        }

        // Creative types prefer craft jobs
        if (personality.primary === 'creative' || personality.secondary === 'creative') {
            if (job === 'craftsman' || job === 'merchant') return true;
        }

        // Social types prefer interaction jobs
        if (personality.primary === 'social' || personality.secondary === 'social') {
            if (job === 'merchant' || job === 'official' || job === 'teacher') return true;
        }

        // Ambitious types prefer high-income jobs
        if (personality.primary === 'ambitious' || personality.secondary === 'ambitious') {
            if (job === 'merchant' || job === 'official') return true;
            }

        // General fit based on job requirements
        return true;
    }

    calculateJobScore(job) {
        const jobInfo = JOB_TYPES[job];
        let score = 50;

        // Base salary factor
        score += jobInfo.baseSalary * 3;

        // Happiness modifier factor
        score += jobInfo.happinessModifier * 2;

        // Personality alignment
        if (this.isSuitableForJob(job)) {
            score += 20;
        }

        // Salary meets expectations based on age/experience
        if (this.age > 25 && jobInfo.baseSalary >= 4) {
            score += 15;
        }

        return score;
    }

    generateStoryEvent() {
        const events = [
            { type: 'birthday', message: `Citizen turned ${this.age}` },
            { type: 'moved', message: 'Citizen moved to a new house' },
            { type: 'found_friend', message: 'Citizen made a new friend' },
            { type: 'got_promotion', message: 'Citizen received a promotion' }
        ];

        if (this.rng.chance(0.1)) {
            return events[Math.floor(this.rng.next() * events.length)];
        }
        return null;
    }

    addRelationship(otherCitizenId, type, value = 50) {
        this.relationships[otherCitizenId] = { type, value };
    }

    becomeFriends(otherCitizenId) {
        this.addRelationship(otherCitizenId, 'friend', 100);
    }

    becomeEnemies(otherCitizenId) {
        this.addRelationship(otherCitizenId, 'enemy', 0);
    }
}

export class CitizenManager {
    constructor(rng) {
        this.citizens = [];
        this.nextId = 1;
        this.birthRate = 0.02;
        this.deathRate = 0.01;
        this.rng = rng;
    }

    spawnCitizen(x, y) {
        const citizen = new Citizen(this.nextId++, x, y, this.rng);
        this.citizens.push(citizen);
        return citizen;
    }

    spawnRandomCitizen(map) {
        // Find a valid spawn location
        for (let attempt = 0; attempt < 10; attempt++) {
            const x = this.rng.int(0, map.width - 1);
            const y = this.rng.int(0, map.height - 1);
            if (map.isValidPlacement(x, y)) {
                return this.spawnCitizen(x, y);
            }
        }
        return null;
    }

    calculateJobOpportunities(buildingManager) {
        const opportunities = {};
        for (const key of Object.keys(JOB_TYPES)) {
            if (key !== 'unemployed') {
                opportunities[key] = { count: 0, totalProduction: { gold: 0, food: 0, wood: 0 } };
            }
        }

        for (const building of buildingManager.buildings) {
            if (building.type === 'farm') {
                opportunities.farmer.count += 2;
                opportunities.farmer.totalProduction.food += 10;
            }
            if (building.type === 'lumber-mill') {
                opportunities.lumberjack.count += 2;
                opportunities.lumberjack.totalProduction.wood += 8;
            }
            if (building.type === 'market') {
                opportunities.merchant.count += 3;
                opportunities.merchant.totalProduction.gold += 15;
            }
            if (building.type === 'warehouse') {
                opportunities.craftsman.count += 2;
                opportunities.craftsman.totalProduction.gold += 8;
                opportunities.craftsman.totalProduction.wood += 4;
            }
            if (building.type === 'town-hall') {
                opportunities.official.count += 2;
                opportunities.official.totalProduction.gold += 10;
            }
            if (building.type === 'barracks') {
                opportunities.soldier.count += 3;
                opportunities.soldier.totalProduction.gold += 5;
            }
            if (building.type === 'school') {
                opportunities.teacher.count += 2;
                opportunities.teacher.totalProduction.gold += 5;
            }
        }
        return opportunities;
    }

    collectJobProduction(jobOpportunities) {
        const totalProduction = { gold: 0, food: 0, wood: 0 };
        for (const citizen of this.citizens) {
            if (citizen.job !== 'unemployed' && citizen.job in JOB_TYPES) {
                const jobInfo = JOB_TYPES[citizen.job];
                for (const resource of ['gold', 'food', 'wood']) {
                    totalProduction[resource] += (jobInfo.production[resource] || 0);
                }
            }
        }
        return totalProduction;
    }

    updateAll(map, buildingManager) {
        const newCitizens = [];
        let deaths = 0;

        // Calculate job opportunities based on buildings
        const jobOpportunities = this.calculateJobOpportunities(buildingManager);

        // Update each citizen
        for (const citizen of this.citizens) {
            const result = citizen.updateDaily(jobOpportunities);

            if (citizen.isDead) {
                deaths++;
            } else if (result && result.message) {
                // Keep story events on citizen history
            }
        }

        // Handle births (only if there is spare housing)
        const pop = this.citizens.length;
        const housing = buildingManager.totalHousing;
        if (pop > 0 && pop < housing && this.rng.chance(this.birthRate)) {
            const parent = this.citizens[Math.floor(this.rng.next() * this.citizens.length)];
            const house = this.findNearbyHouse(map, parent.x, parent.y, buildingManager);
            if (house) newCitizens.push(this.spawnCitizen(house.x, house.y));
        }

        this.citizens = this.citizens.filter(c => c && !c.isDead);
        this.citizens.push(...newCitizens);

        // Collect job production for this day
        const jobProduction = this.collectJobProduction(jobOpportunities);

        return { newCitizens: newCitizens.length, deaths, jobProduction };
    }

    findNearbyHouse(map, x, y, buildingManager) {
        // Find a house building nearby
        const nearbyBuildings = [];
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const buildingsAtTile = buildingManager.getBuildingsAt(x + dx, y + dy);
                nearbyBuildings.push(...buildingsAtTile);
            }
        }
        const house = nearbyBuildings.find(b => b.type === 'house');
        return house;
    }

    getPopulation() {
        return this.citizens.length;
    }

    getAverageHappiness() {
        if (this.citizens.length === 0) return 0;
        const total = this.citizens.reduce((sum, c) => sum + c.happiness, 0);
        return Math.floor(total / this.citizens.length);
    }

    getEmploymentRate() {
        const employed = this.citizens.filter(c => c.job !== 'unemployed').length;
        return this.citizens.length > 0 ? Math.floor(employed / this.citizens.length * 100) : 0;
    }

    getCitizenById(id) {
        return this.citizens.find(c => c.id === id) || null;
    }
}