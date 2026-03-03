// Simulation chunking system - Milestone Q-01
// Active cells simulate at full fidelity; far cells use aggregate stats

/**
 * SimCell - represents a chunk of the map for simulation
 */
export class SimCell {
    constructor(gridX, gridY, cellSize) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.cellSize = cellSize;
        
        // Bounding box in world coordinates
        this.minX = gridX * cellSize;
        this.maxX = (gridX + 1) * cellSize;
        this.minY = gridY * cellSize;
        this.maxY = (gridY + 1) * cellSize;
        
        // Simulation state
        this.isActive = false;
        this.citizenCount = 0;
        this.vehicleCount = 0;
        this.buildingCount = 0;
        this.crimeRate = 0;
        this.employmentRate = 0;
        this.happiness = 50;
        
        // Aggregate metrics (for inactive cells)
        this.population = 0;
        this.jobs = 0;
        this.crimes = 0;
        this.economyScore = 50;
    }

    /**
     * Activate cell for full simulation
     */
    activate() {
        this.isActive = true;
        this.citizenCount = 0;
        this.vehicleCount = 0;
        this.buildingCount = 0;
    }

    /**
     * Deactivate cell, switch to aggregate mode
     */
    deactivate() {
        this.isActive = false;
        // Preserve aggregate stats
    }

    /**
     * Update with citizen data
     */
    addCitizen() {
        if (this.isActive) {
            this.citizenCount++;
        } else {
            this.population++;
        }
    }

    /**
     * Update with vehicle data
     */
    addVehicle() {
        if (this.isActive) {
            this.vehicleCount++;
        }
    }

    /**
     * Update with building data
     */
    addBuilding() {
        this.buildingCount++;
    }

    /**
     * Serialize cell state
     */
    serialize() {
        return {
            gridX: this.gridX,
            gridY: this.gridY,
            cellSize: this.cellSize,
            isActive: this.isActive,
            citizenCount: this.isActive ? this.citizenCount : 0,
            vehicleCount: this.isActive ? this.vehicleCount : 0,
            buildingCount: this.buildingCount,
            population: this.population,
            employmentRate: this.employmentRate,
            crimeRate: this.crimeRate,
            happiness: this.happiness,
        };
    }

    /**
     * Deserialize cell state
     */
    static deserialize(data) {
        const cell = new SimCell(data.gridX, data.gridY, data.cellSize);
        cell.isActive = data.isActive || false;
        cell.citizenCount = data.citizenCount || 0;
        cell.vehicleCount = data.vehicleCount || 0;
        cell.buildingCount = data.buildingCount || 0;
        cell.population = data.population || 0;
        cell.employmentRate = data.employmentRate || 0;
        cell.crimeRate = data.crimeRate || 0;
        cell.happiness = data.happiness || 50;
        return cell;
    }
}

/**
 * SimChunkManager - manages all simulation chunks
 */
export class SimChunkManager {
    constructor(game, cellSize = 64) {
        this.game = game;
        this.cellSize = cellSize;
        this.cells = new Map();
        
        // Player/camera position tracking
        this.lastPlayerX = 0;
        this.lastPlayerY = 0;
        
        // Thresholds
        this.activeRadius = 2; // cells around player
        this.farThreshold = 4; // cells beyond which cells become inactive
    }

    /**
     * Get or create cell at grid coordinates
     */
    getCell(gridX, gridY) {
        const key = `${gridX},${gridY}`;
        if (!this.cells.has(key)) {
            const cell = new SimCell(gridX, gridY, this.cellSize);
            this.cells.set(key, cell);
        }
        return this.cells.get(key);
    }

    /**
     * Get cell at world coordinates
     */
    getCellAt(x, y) {
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);
        return this.getCell(gridX, gridY);
    }

    /**
     * Get active cells (within activeRadius of player)
     */
    getActiveCells() {
        const cells = [];
        const playerGridX = Math.floor(this.game.player.x / this.cellSize);
        const playerGridY = Math.floor(this.game.player.y / this.cellSize);
        
        for (let gx = playerGridX - this.activeRadius; gx <= playerGridX + this.activeRadius; gx++) {
            for (let gy = playerGridY - this.activeRadius; gy <= playerGridY + this.activeRadius; gy++) {
                const cell = this.getCell(gx, gy);
                if (!cell.isActive) {
                    cell.activate();
                }
                cells.push(cell);
            }
        }
        
        return cells;
    }

    /**
     * Get far cells (beyond farThreshold) - these use aggregate stats
     */
    getFarCells() {
        const cells = [];
        const playerGridX = Math.floor(this.game.player.x / this.cellSize);
        const playerGridY = Math.floor(this.game.player.y / this.cellSize);
        
        // Check a wider area
        const checkRadius = this.farThreshold + 1;
        for (let gx = playerGridX - checkRadius; gx <= playerGridX + checkRadius; gx++) {
            for (let gy = playerGridY - checkRadius; gy <= playerGridY + checkRadius; gy++) {
                const distance = Math.abs(gx - playerGridX) + Math.abs(gy - playerGridY);
                if (distance > this.farThreshold) {
                    const cell = this.getCell(gx, gy);
                    if (cell.isActive) {
                        cell.deactivate();
                    }
                    cells.push(cell);
                }
            }
        }
        
        return cells;
    }

    /**
     * Update simulation chunking each tick
     */
    update(tick) {
        // Check if player moved significantly
        const currentX = this.game.player.x;
        const currentY = this.game.player.y;
        const distanceMoved = Math.abs(currentX - this.lastPlayerX) + Math.abs(currentY - this.lastPlayerY);
        
        if (distanceMoved > this.cellSize * 0.5) {
            this.lastPlayerX = currentX;
            this.lastPlayerY = currentY;
            
            // Reactivate cells around player
            this.getActiveCells();
            
            // Deactivate far cells
            this.getFarCells();
        }
        
        // Update aggregate stats from inactive cells
        this._updateAggregateStats();
    }

    /**
     * Update aggregate stats from inactive cells
     * These stats feed into economy/simulation without full per-agent updates
     */
    _updateAggregateStats() {
        let totalPopulation = 0;
        let totalJobs = 0;
        let totalCrimes = 0;
        let totalHappiness = 0;
        let activeCellCount = 0;

        for (const cell of this.cells.values()) {
            if (cell.isActive) {
                totalPopulation += cell.citizenCount;
                totalJobs += cell.citizenCount * 0.7; // Approximate employment
                totalCrimes += cell.citizenCount * cell.crimeRate * 0.01;
                totalHappiness += cell.happiness;
                activeCellCount++;
            } else {
                // Aggregate stats from inactive cells
                totalPopulation += cell.population;
                totalJobs += cell.employmentRate * cell.population;
                totalCrimes += cell.crimeRate * cell.population;
                totalHappiness += cell.happiness;
            }
        }

        // Update game-wide stats from chunk aggregates
        this.game.state.resources.population = totalPopulation;
        
        if (activeCellCount > 0) {
            this.game.state.resources.avgHappiness = Math.round(totalHappiness / this.cells.size);
        }
    }

    /**
     * Add citizen to appropriate cell
     */
    addCitizen(x, y) {
        const cell = this.getCellAt(x, y);
        cell.addCitizen();
    }

    /**
     * Add vehicle to appropriate cell
     */
    addVehicle(x, y) {
        const cell = this.getCellAt(x, y);
        cell.addVehicle();
    }

    /**
     * Add building to appropriate cell
     */
    addBuilding(x, y) {
        const cell = this.getCellAt(x, y);
        cell.addBuilding();
    }

    /**
     * Get simulation summary
     */
    getSummary() {
        let activeCount = 0;
        let farCount = 0;
        let totalPopulation = 0;
        let totalAgents = 0;

        for (const cell of this.cells.values()) {
            if (cell.isActive) {
                activeCount++;
                totalAgents += cell.citizenCount + cell.vehicleCount;
            } else {
                farCount++;
            }
            totalPopulation += cell.population;
        }

        return {
            activeCells: activeCount,
            farCells: farCount,
            totalCells: this.cells.size,
            totalPopulation,
            totalAgents,
        };
    }

    /**
     * Serialize chunk manager state
     */
    serialize() {
        return {
            cellSize: this.cellSize,
            lastPlayerX: this.lastPlayerX,
            lastPlayerY: this.lastPlayerY,
            cells: Array.from(this.cells.values()).map(c => c.serialize()),
        };
    }

    /**
     * Deserialize chunk manager state
     */
    deserialize(data) {
        if (!data) return;

        this.cellSize = data.cellSize || 64;
        this.lastPlayerX = data.lastPlayerX || 0;
        this.lastPlayerY = data.lastPlayerY || 0;

        this.cells.clear();
        for (const cellData of data.cells || []) {
            const cell = SimCell.deserialize(cellData);
            this.cells.set(`${cell.gridX},${cell.gridY}`, cell);
        }
    }
}