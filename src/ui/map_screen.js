// City map screen - map toggle with district overlay and icons
import { TERRAIN_COLORS, TERRAIN_ICONS } from '../constants.js';
import { getInteractableTypeInfo, getInteractableStateName } from '../sim/interactables.js';
import { ROAD_COLORS } from '../gen/roads.js';
import { ZONE_COLORS } from '../gen/parcels.js';
import { eventBus } from '../sim/events.js';

const MAP_WIDTH = 256;  // Max map dimension to render
const MAP_HEIGHT = 256;

// District colors for map display
const DISTRICT_COLORS = {
    residential: '#ffcc80',
    commercial: '#e0f7fa',
    industrial: '#cfd8dc',
    waterfront: '#81d4fa',
    elite: '#f48fb1',
};

/**
 * Map screen manager
 */
export class MapScreen {
    constructor(game) {
        this.game = game;
        this.canvas = null;
        this.ctx = null;
        this.element = null;
        this.overlay = null;
        this.isvisible = false;
        this.mapCache = null;
        this.mapCacheTimestamp = 0;
        this.waypoint = null;
        this.setupUI();
    }

    setupUI() {
        // Create map container
        this.element = document.createElement('div');
        this.element.id = 'map-screen';
        this.element.className = 'hidden';
        this.element.innerHTML = `
            <div class="map-container">
                <canvas id="map-canvas" width="${MAP_WIDTH}" height="${MAP_HEIGHT}"></canvas>
                <div class="map-controls">
                    <button id="map-toggle" class="btn btn-primary">Close Map (M)</button>
                    <div class="map-info">
                        <h3>District: <span id="map-district-name">Unknown</span></h3>
                        <div class="map-stats">
                            <p>Tiles: <span id="map-tile-count">0</span></p>
                            <p>Buildings: <span id="map-building-count">0</span></p>
                        </div>
                        <div class="waypoint-section">
                            <p>Click on map to set waypoint</p>
                            <button id="map-clear-waypoint" class="btn btn-secondary">Clear Waypoint</button>
                        </div>
                    </div>
                    <div class="map-legend">
                        <h4>Legend</h4>
                        <div class="legend-item"><span class="legend-color" style="background: ${DISTRICT_COLORS.residential}"></span> Residential</div>
                        <div class="legend-item"><span class="legend-color" style="background: ${DISTRICT_COLORS.commercial}"></span> Commercial</div>
                        <div class="legend-item"><span class="legend-color" style="background: ${DISTRICT_COLORS.industrial}"></span> Industrial</div>
                        <div class="legend-item"><span class="legend-color" style="background: ${DISTRICT_COLORS.waterfront}"></span> Waterfront</div>
                        <div class="legend-item"><span class="legend-color" style="background: ${DISTRICT_COLORS.elite}"></span> Elite</div>
                        <div class="legend-item"><span class="legend-color" style="background: #888"></span> Road</div>
                        <div class="legend-item"><span class="legend-color" style="background: #90ee90"></span> Park</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.element);

        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('map-screen');

        // Bind events
        document.getElementById('map-toggle').addEventListener('click', () => this.toggle());
        document.getElementById('map-clear-waypoint').addEventListener('click', () => {
            this.waypoint = null;
            this.drawMap();
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor(e.clientX - rect.left);
            const y = Math.floor(e.clientY - rect.top);
            this.setWaypoint(x, y);
        });
    }

    toggle() {
        this.isvisible = !this.isvisible;
        if (this.isvisible) {
            this.element.classList.remove('hidden');
            this.drawMap();
            eventBus.emit('map_screen_toggled', { visible: true });
        } else {
            this.element.classList.add('hidden');
            eventBus.emit('map_screen_toggled', { visible: false });
        }
    }

    setWaypoint(gridX, gridY) {
        const width = this.game.map.width;
        const height = this.game.map.height;

        // Scale from canvas coords to map coords
        const scaleX = width / MAP_WIDTH;
        const scaleY = height / MAP_HEIGHT;

        this.waypoint = {
            x: Math.floor(gridX * scaleX),
            y: Math.floor(gridY * scaleY),
        };
        this.drawMap();
    }

    clearWaypoint() {
        this.waypoint = null;
        this.drawMap();
    }

    /**
     * Draw the map to canvas
     */
    drawMap() {
        if (!this.ctx) return;

        const map = this.game.map;
        const width = map.width;
        const height = map.height;
        const scale = Math.min(MAP_WIDTH / width, MAP_HEIGHT / height);

        // Clear canvas
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

        // Calculate offset to center map
        const offsetX = (MAP_WIDTH - width * scale) / 2;
        const offsetY = (MAP_HEIGHT - height * scale) / 2;

        // Draw terrain
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const terrain = map.grid[y][x];
                let color = TERRAIN_COLORS[terrain];

                // Override for roads
                if (map.roadMap && map.roadMap[y * width + x] > 0) {
                    color = ROAD_COLORS[4] || '#888888';
                }
                // Override for sidewalks
                if (map.sidewalkMap && map.sidewalkMap[y * width + x] > 0) {
                    color = ROAD_COLORS[5] || '#aaaaaa';
                }
                // Override for parks
                if (map.grid[y][x] === 6) {
                    color = ROAD_COLORS[6] || '#90ee90';
                }

                this.ctx.fillStyle = color;
                this.ctx.fillRect(
                    offsetX + x * scale,
                    offsetY + y * scale,
                    scale,
                    scale
                );
            }
        }

        // Draw districts (overlay with transparency)
        if (map.districtMap) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const districtId = map.districtMap[y * width + x];
                    if (districtId >= 0 && districtId < map.districts.length) {
                        const district = map.districts[districtId];
                        const color = DISTRICT_COLORS[district.theme] || '#999';
                        this.ctx.fillStyle = color + '80'; // 50% transparent
                        this.ctx.fillRect(
                            offsetX + x * scale,
                            offsetY + y * scale,
                            scale,
                            scale
                        );
                    }
                }
            }
        }

        // Draw roads on top
        if (map.roads) {
            this.ctx.fillStyle = '#555';
            for (const road of map.roads) {
                for (const tile of road.tiles) {
                    this.ctx.fillRect(
                        offsetX + tile.x * scale,
                        offsetY + tile.y * scale,
                        scale,
                        scale
                    );
                }
            }
        }

        // Draw interactables
        if (this.game.interactables) {
            for (const node of this.game.interactables.interactables) {
                const typeInfo = getInteractableTypeInfo(node.type);
                const stateName = getInteractableStateName(node.state);
                const color = stateName === 'Ready' ? '#00ff00' : '#ffaa00';

                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(
                    offsetX + node.x * scale,
                    offsetY + node.y * scale,
                    scale * 2,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();

                this.ctx.fillStyle = '#fff';
                this.ctx.font = `${Math.floor(scale * 0.8)}px sans-serif`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(typeInfo.icon, offsetX + node.x * scale, offsetY + node.y * scale);
            }
        }

        // Draw player position
        this.ctx.fillStyle = '#00ff00';
        this.ctx.beginPath();
        this.ctx.arc(
            offsetX + this.game.player.x * scale,
            offsetY + this.game.player.y * scale,
            scale * 3,
            0,
            Math.PI * 2
        );
        this.ctx.fill();

        // Draw waypoint
        if (this.waypoint) {
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(
                offsetX + this.game.player.x * scale,
                offsetY + this.game.player.y * scale
            );
            this.ctx.lineTo(
                offsetX + this.waypoint.x * scale,
                offsetY + this.waypoint.y * scale
            );
            this.ctx.stroke();

            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(
                offsetX + this.waypoint.x * scale,
                offsetY + this.waypoint.y * scale,
                scale * 2,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        }

        // Draw parcel boundaries (optional, faint)
        if (map.parcelMap) {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            this.ctx.lineWidth = 1;
            // Draw faint grid at parcel scale
            const parcelScale = Math.max(8, scale * 2);
            for (let y = 0; y < height; y += 4) {
                for (let x = 0; x < width; x += 4) {
                    const parcelId = map.parcelMap[y * width + x];
                    if (parcelId !== 65535) {
                        this.ctx.fillRect(
                            offsetX + x * scale,
                            offsetY + y * scale,
                            scale,
                            scale
                        );
                    }
                }
            }
        }

        // Update stats
        document.getElementById('map-district-name').textContent =
            map.getDistrictName(map.getDistrictAt(this.game.player.x, this.game.player.y)) ||
            'Unknown';
        document.getElementById('map-tile-count').textContent = width * height;
        document.getElementById('map-building-count').textContent = this.game.buildings.buildings.length;
    }

    /**
     * Update map display when game state changes
     */
    update() {
        if (this.isvisible) {
            this.drawMap();
        }
    }

    /**
     * Rebuild map when world is rebuilt
     */
    onWorldRebuilt() {
        this.mapCache = null;
        this.drawMap();
    }

    /**
     * Show a message on the map
     */
    showMessage(message) {
        const log = document.getElementById('message-log');
        if (log) {
            const entry = document.createElement('div');
            entry.className = 'message normal';
            entry.textContent = message;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
    }

    /**
     * Destroy map screen
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

/**
 * Map screen UI helper
 */
export function createMapUI(game) {
    return new MapScreen(game);
}