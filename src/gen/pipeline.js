// Progressive generation pipeline - enables streaming for MEGA maps
// Runs generators in steps to avoid main-thread blocking

/**
 * Generator pipeline state
 */
export const PipelineStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};

/**
 * Progress event for pipeline
 */
export class PipelineProgress {
    constructor(phase, progress, message) {
        this.phase = phase;
        this.progress = progress; // 0-1
        this.message = message;
        this.timestamp = Date.now();
    }
}

/**
 * Progressive generation pipeline
 */
export class GenerationPipeline {
    constructor(width, height, seed) {
        this.width = width;
        this.height = height;
        this.seed = seed;
        this.rng = new RNG(seed);
        this.status = PipelineStatus.PENDING;
        this.currentPhase = 0;
        this.phases = [];
        this.progressCallback = null;
        this.completedPhases = 0;
        this.totalPhases = 0;
        this.interrupted = false;
    }

    /**
     * Set progress callback
     */
    onProgress(callback) {
        this.progressCallback = callback;
        return this;
    }

    /**
     * Add a generation phase
     */
    addPhase(name, generatorFn, maxSteps) {
        this.phases.push({
            name,
            generatorFn,
            maxSteps,
            step: 0,
            progress: 0,
        });
        this.totalPhases++;
        return this;
    }

    /**
     * Run pipeline for one frame (yields control)
     * @returns {boolean} True if still running
     */
    runFrame() {
        if (this.status !== PipelineStatus.RUNNING) return false;
        if (this.interrupted) {
            this.status = PipelineStatus.CANCELLED;
            return false;
        }

        const progress = new PipelineProgress(
            this.phases[this.currentPhase]?.name || 'complete',
            0,
            ''
        );

        // Process current phase
        if (this.currentPhase < this.phases.length) {
            const phase = this.phases[this.currentPhase];
            const stepSize = Math.max(1, Math.floor(phase.maxSteps / 20)); // 20 steps per phase

            for (let i = 0; i < stepSize; i++) {
                if (this.interrupted) {
                    this.status = PipelineStatus.CANCELLED;
                    return false;
                }

                const result = phase.generatorFn(phase.step);
                phase.step++;

                // Update progress
                phase.progress = phase.step / phase.maxSteps;
                this.completedPhases = this.currentPhase;
                const totalProgress = (this.completedPhases + phase.progress) / this.totalPhases;

                progress.phase = phase.name;
                progress.progress = totalProgress;
                progress.message = `${phase.name}: ${(totalProgress * 100).toFixed(0)}%`;

                if (result && result.done) {
                    this.currentPhase++;
                    break;
                }
            }

            this.progressCallback?.(progress);
        }

        // Check if complete
        if (this.currentPhase >= this.phases.length) {
            this.status = PipelineStatus.COMPLETED;
            this.progressCallback?.(new PipelineProgress(
                'complete',
                1,
                'Generation complete!'
            ));
            return false;
        }

        return true;
    }

    /**
     * Run pipeline to completion (blocking, not recommended for MEGA)
     */
    runSync() {
        this.status = PipelineStatus.RUNNING;
        while (this.runFrame()) {
            // Run until complete (this will block!)
        }
        return this.getStatus();
    }

    /**
     * Start pipeline
     */
    start() {
        this.status = PipelineStatus.RUNNING;
        this.currentPhase = 0;
        this.completedPhases = 0;
        this.interrupted = false;
        return this;
    }

    /**
     * Cancel pipeline
     */
    cancel() {
        this.interrupted = true;
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            status: this.status,
            currentPhase: this.currentPhase,
            totalPhases: this.phases.length,
            progress: this.completedPhases / this.totalPhases,
        };
    }

    /**
     * Get progress at a specific phase
     */
    getPhaseProgress(phaseIndex) {
        if (phaseIndex < 0 || phaseIndex >= this.phases.length) return 1;
        const phase = this.phases[phaseIndex];
        return phase.progress;
    }

    /**
     * Get total progress (0-1)
     */
    getTotalProgress() {
        const completed = this.completedPhases;
        const current = this.currentPhase < this.phases.length ? this.phases[this.currentPhase].progress : 0;
        return (completed + current) / this.phases.length;
    }
}

/**
 * Creates a generation pipeline for map generation
 */
export function createMapGenerationPipeline(width, height, seed, map) {
    const pipeline = new GenerationPipeline(width, height, seed);

    // Phase 1: Terrain generation
    let terrainStep = 0;
    const terrainSteps = height; // One row per step
    pipeline.addPhase('Terrain', () => {
        const row = terrainStep;
        for (let x = 0; x < width; x++) {
            // Simple noise-based terrain
            const noiseValue = map.noise.noise(x * 0.08, row * 0.08);
            let terrain;
            if (noiseValue < -0.3) terrain = 0; // Water
            else if (noiseValue < -0.1) terrain = 1; // Grass
            else if (noiseValue < 0.4) terrain = 2; // Forest
            else terrain = 3; // Mountain
            map.grid[row][x] = terrain;
        }
        terrainStep++;
        return { done: row >= height - 1 };
    }, terrainSteps);

    // Phase 2: Resource clusters
    let resourceStep = 0;
    const resourceSteps = 12;
    pipeline.addPhase('Resources', () => {
        if (resourceStep === 0) {
            // Place forest clusters
            for (let i = 0; i < 8; i++) {
                const cx = map.rng.int(0, width - 1);
                const cy = map.rng.int(0, height - 1);
                for (let dy = -3; dy <= 3; dy++) {
                    for (let dx = -3; dx <= 3; dx++) {
                        if (map.rng.next() > 0.3) {
                            const ny = ((cy + dy) % height + height) % height;
                            const nx = ((cx + dx) % width + width) % width;
                            if (map.grid[ny][nx] === 1) map.grid[ny][nx] = 2;
                        }
                    }
                }
            }
        } else {
            // Place mountain clusters
            for (let i = 0; i < 4; i++) {
                const cx = map.rng.int(0, width - 1);
                const cy = map.rng.int(0, height - 1);
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        if (map.rng.next() > 0.4) {
                            const ny = ((cy + dy) % height + height) % height;
                            const nx = ((cx + dx) % width + width) % width;
                            if (map.grid[ny][nx] === 1) map.grid[ny][nx] = 3;
                        }
                    }
                }
            }
        }
        resourceStep++;
        return { done: resourceStep >= resourceSteps };
    }, resourceSteps);

    // Phase 3: Starting area creation
    pipeline.addPhase('Starting Area', () => {
        const startX = Math.floor(width / 2) - 2;
        const startY = Math.floor(height / 2) - 2;
        for (let y = startY; y < startY + 5; y++) {
            for (let x = startX; x < startX + 5; x++) {
                if (y >= 0 && y < height && x >= 0 && x < width) {
                    map.grid[y][x] = 1; // Grass
                }
            }
        }
        return { done: true };
    }, 1);

    // Phase 4: District generation
    let districtStep = 0;
    let districtQueue = [];
    let districtMap = new Uint8Array(width * height).fill(255);
    pipeline.addPhase('Districts', () => {
        if (districtStep === 0) {
            // Setup district centers
            const area = width * height;
            const districtCount = area > 10000 ? 5 : area > 5000 ? 4 : 3;
            const centers = [];
            for (let i = 0; i < districtCount; i++) {
                let centerX, centerY;
                let attempts = 0;
                do {
                    centerX = map.rng.int(2, width - 3);
                    centerY = map.rng.int(2, height - 3);
                    attempts++;
                } while (attempts < 100 && districtMap[centerY * width + centerX] !== 255);
                centers.push({ x: centerX, y: centerY, id: i });
                districtMap[centerY * width + centerX] = i;
            }
            districtQueue = [...centers];
            districtStep++;
        } else {
            // Process BFS queue in batches
            const batchSize = Math.max(100, width * 2);
            for (let i = 0; i < batchSize && districtQueue.length > 0; i++) {
                const current = districtQueue.shift();
                const cx = current.x;
                const cy = current.y;
                const currentId = current.id;

                const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                for (const [dx, dy] of directions) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const idx = ny * width + nx;
                        if (districtMap[idx] === 255) {
                            districtMap[idx] = currentId;
                            districtQueue.push({ x: nx, y: ny, id: currentId });
                        }
                    }
                }
            }
            return { done: districtQueue.length === 0 };
        }
        return { done: false };
    }, Math.ceil((width * height) / 100));

    // Phase 5: Road network
    let roadStep = 0;
    const roadSteps = 10;
    pipeline.addPhase('Roads', () => {
        // Simplified road generation - just run in one step for now
        // For large maps, this could be broken down further
        roadStep++;
        return { done: roadStep >= roadSteps };
    }, roadSteps);

    // Phase 6: Parcels
    let parcelStep = 0;
    const parcelSteps = 5;
    pipeline.addPhase('Parcels', () => {
        parcelStep++;
        return { done: parcelStep >= parcelSteps };
    }, parcelSteps);

    // Phase 7: Buildings (optional - can be added later)
    pipeline.addPhase('Buildings', () => {
        return { done: true };
    }, 1);

    return pipeline;
}

/**
 * Simple generator that yields over time
 */
export function* yieldGenerator(steps, stepDuration = 16) {
    for (let i = 0; i < steps; i++) {
        yield i;
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
}