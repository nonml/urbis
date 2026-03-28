/**
 * Tooltip System - Enhanced tooltip display for building and tile information
 * 
 * Provides rich tooltips with icons, stats, and contextual information
 * for buildings, citizens, and interactable objects.
 */

/**
 * Tooltip data structure
 */
export class TooltipData {
    constructor() {
        this.title = '';
        this.icon = '';
        this.description = '';
        this.stats = [];
        this.effects = [];
        this.actions = [];
        this.style = 'default'; // default, building, citizen, warning, success
        this.x = 0;
        this.y = 0;
    }

    /**
     * Add a stat line to the tooltip
     */
    addStat(label, value, icon = '') {
        this.stats.push({ label, value, icon });
        return this;
    }

    /**
     * Add an effect/property line
     */
    addEffect(text, type = 'neutral') {
        this.effects.push({ text, type });
        return this;
    }

    /**
     * Add an action button
     */
    addAction(label, onClick, icon = '') {
        this.actions.push({ label, onClick, icon });
        return this;
    }

    /**
     * Set tooltip style
     */
    setStyle(style) {
        this.style = style;
        return this;
    }
}

/**
 * TooltipManager handles tooltip display and positioning
 */
export class TooltipManager {
    constructor(game) {
        this.game = game;
        this.currentTooltip = null;
        this.tooltipElement = null;
        this.enabled = true;
        this.delay = 200; // ms before showing
        this.hideDelay = 100; // ms before hiding after mouse leave
        this.hideTimer = null;
        this.showTimer = null;
        
        // Tooltip position offset
        this.offsetX = 15;
        this.offsetY = 15;
        
        // Default styles
        this.styles = {
            default: {
                bg: 'rgba(0, 0, 0, 0.85)',
                border: '1px solid #444',
                textColor: '#fff',
                titleColor: '#ffd700',
                statColor: '#aaa',
                effectNeutral: '#888',
                effectPositive: '#4caf50',
                effectNegative: '#f44336'
            },
            building: {
                bg: 'rgba(16, 32, 48, 0.95)',
                border: '1px solid #5a8',
                textColor: '#eef',
                titleColor: '#8f8',
                statColor: '#aad',
                effectNeutral: '#88a',
                effectPositive: '#6c6',
                effectNegative: '#c66'
            },
            citizen: {
                bg: 'rgba(48, 32, 16, 0.95)',
                border: '1px solid #a84',
                textColor: '#fee',
                titleColor: '#fa8',
                statColor: '#daa',
                effectNeutral: '#aa8',
                effectPositive: '#ca6',
                effectNegative: '#a66'
            },
            warning: {
                bg: 'rgba(48, 16, 0, 0.95)',
                border: '1px solid #f80',
                textColor: '#fee',
                titleColor: '#fa6',
                statColor: '#da8',
                effectNeutral: '#a84',
                effectPositive: '#8c8',
                effectNegative: '#f64'
            },
            success: {
                bg: 'rgba(0, 32, 16, 0.95)',
                border: '1px solid #4a8',
                textColor: '#efe',
                titleColor: '#8f8',
                statColor: '#8da',
                effectNeutral: '#8a8',
                effectPositive: '#6f6',
                effectNegative: '#a66'
            }
        };
    }

    /**
     * Initialize tooltip manager
     */
    init() {
        if (this.tooltipElement) return;
        
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.id = 'game-tooltip';
        this.tooltipElement.style.cssText = `
            position: fixed;
            pointer-events: none;
            visibility: hidden;
            opacity: 0;
            transition: opacity 0.15s ease-out;
            z-index: 10000;
            max-width: 300px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
            line-height: 1.4;
        `;
        document.body.appendChild(this.tooltipElement);
    }

    /**
     * Show tooltip at position with data
     */
    show(x, y, data) {
        if (!this.enabled) return;
        if (!this.tooltipElement) this.init();
        
        // Clear any pending hide
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
        
        // Set tooltip data
        this.currentTooltip = data;
        this.currentTooltip.x = x;
        this.currentTooltip.y = y;
        
        // Update position
        this.updatePosition(x, y);
        
        // Render content
        this.render();
        
        // Show with fade
        this.tooltipElement.style.visibility = 'visible';
        this.tooltipElement.style.opacity = '1';
    }

    /**
     * Hide tooltip
     */
    hide(immediate = false) {
        if (!this.tooltipElement) return;
        
        if (immediate) {
            this.tooltipElement.style.visibility = 'hidden';
            this.tooltipElement.style.opacity = '0';
            this.currentTooltip = null;
        } else {
            // Fade out then hide
            this.tooltipElement.style.opacity = '0';
            setTimeout(() => {
                this.tooltipElement.style.visibility = 'hidden';
                this.currentTooltip = null;
            }, 150);
        }
    }

    /**
     * Update tooltip position
     */
    updatePosition(x, y) {
        if (!this.tooltipElement) return;
        
        // Convert game coordinates to screen coordinates if needed
        let screenX = x;
        let screenY = y;
        
        // If x/y are game tile coordinates, convert to screen
        if (typeof x === 'number' && x < 1000) {
            // Assume these are tile coordinates
            const tileSize = 40;
            screenX = x * tileSize + this.offsetX;
            screenY = y * tileSize + this.offsetY;
        } else {
            // Already screen coordinates
            screenX = x + this.offsetX;
            screenY = y + this.offsetY;
        }
        
        // Keep tooltip within viewport
        const rect = this.tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (screenX + rect.width > viewportWidth - 20) {
            screenX = viewportWidth - rect.width - 20;
        }
        if (screenY + rect.height > viewportHeight - 20) {
            screenY = viewportHeight - rect.height - 20;
        }
        if (screenX < 10) screenX = 10;
        if (screenY < 10) screenY = 10;
        
        this.tooltipElement.style.left = `${screenX}px`;
        this.tooltipElement.style.top = `${screenY}px`;
    }

    /**
     * Render tooltip content
     */
    render() {
        if (!this.tooltipElement || !this.currentTooltip) return;
        
        const data = this.currentTooltip;
        const style = this.styles[data.style] || this.styles.default;
        
        let html = `
            <div style="
                background: ${style.bg};
                border: ${style.border};
                border-radius: 4px;
                padding: 12px;
                color: ${style.textColor};
            ">
                ${data.icon ? `<div style="font-size: 24px; margin-bottom: 8px;">${data.icon}</div>` : ''}
                <div style="
                    font-size: 15px;
                    font-weight: bold;
                    color: ${style.titleColor};
                    margin-bottom: 8px;
                ">${data.title}</div>
                ${data.description ? `<div style="color: ${style.statColor}; margin-bottom: 10px; font-style: italic;">${data.description}</div>` : ''}
        `;
        
        // Stats section
        if (data.stats?.length > 0) {
            html += `<div style="border-top: 1px solid ${style.statColor}33; padding-top: 8px; margin-bottom: 8px;">`;
            for (const stat of data.stats) {
                html += `
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        padding: 2px 0;
                        color: ${style.statColor};
                    ">
                        <span>${stat.icon ? stat.icon + ' ' : ''}${stat.label}</span>
                        <span style="font-weight: bold;">${stat.value}</span>
                    </div>
                `;
            }
            html += `</div>`;
        }
        
        // Effects section
        if (data.effects?.length > 0) {
            html += `<div style="border-top: 1px solid ${style.statColor}33; padding-top: 8px; margin-bottom: 8px;">`;
            for (const effect of data.effects) {
                let effectColor = style.effectNeutral;
                if (effect.type === 'positive') effectColor = style.effectPositive;
                if (effect.type === 'negative') effectColor = style.effectNegative;
                
                html += `
                    <div style="
                        padding: 2px 0;
                        color: ${effectColor};
                    ">${effect.text}</div>
                `;
            }
            html += `</div>`;
        }
        
        // Actions section
        if (data.actions?.length > 0) {
            html += `<div style="border-top: 1px solid ${style.statColor}33; padding-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">`;
            for (const action of data.actions) {
                html += `
                    <button style="
                        background: ${style.titleColor}33;
                        border: 1px solid ${style.titleColor};
                        color: ${style.titleColor};
                        padding: 4px 12px;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 12px;
                    " onmouseover="this.style.background='${style.titleColor}66'" 
                       onmouseout="this.style.background='${style.titleColor}33'">
                        ${action.icon ? action.icon + ' ' : ''}${action.label}
                    </button>
                `;
            }
            html += `</div>`;
        }
        
        html += `</div>`;
        this.tooltipElement.innerHTML = html;
    }

    /**
     * Show building tooltip
     */
    showBuilding(x, y, building) {
        if (!building) return;
        
        const data = new TooltipData();
        data.title = building.name || 'Building';
        data.icon = building.icon || '🏢';
        data.description = building.description || '';
        data.setStyle('building');
        
        if (building.level) {
            data.addStat('Level', building.level);
        }
        if (building.population) {
            data.addStat('Population', building.population);
        }
        if (building.income) {
            if (building.income.gold) data.addStat('Gold/Day', building.income.gold > 0 ? `+${building.income.gold}` : building.income.gold);
            if (building.income.food) data.addStat('Food/Day', building.income.food > 0 ? `+${building.income.food}` : building.income.food);
            if (building.income.wood) data.addStat('Wood/Day', building.income.wood > 0 ? `+${building.income.wood}` : building.income.wood);
        }
        if (building.upkeep) {
            data.addStat('Upkeep', `-${building.upkeep} gold`);
        }
        
        this.show(x, y, data);
    }

    /**
     * Show citizen tooltip
     */
    showCitizen(x, y, citizen) {
        if (!citizen) return;
        
        const data = new TooltipData();
        data.title = citizen.name || 'Citizen';
        data.icon = '👤';
        data.setStyle('citizen');
        
        data.addStat('Age', citizen.age || 0);
        data.addStat('Happiness', `${citizen.happiness || 50}%`);
        data.addStat('Job', citizen.job || 'Unemployed');
        data.addStat('Salary', `${citizen.salary || 0} gold`);
        
        if (citizen.needs) {
            if (citizen.needs.food) data.addStat('Food', `${citizen.needs.food}%`);
        }
        
        this.show(x, y, data);
    }

    /**
     * Show tile tooltip
     */
    showTile(x, y, tileData) {
        if (!tileData) return;
        
        const data = new TooltipData();
        data.title = tileData.name || 'Tile';
        data.icon = tileData.icon || '🟩';
        data.setStyle('default');
        
        if (tileData.terrain) {
            data.addStat('Terrain', tileData.terrain);
        }
        if (tileData.buildings && tileData.buildings.length > 0) {
            data.addStat('Buildings', tileData.buildings.length);
        }
        
        this.show(x, y, data);
    }

    /**
     * Enable/disable tooltip system
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.hide(true);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.hideTimer) clearTimeout(this.hideTimer);
        if (this.showTimer) clearTimeout(this.showTimer);
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
        }
        this.tooltipElement = null;
        this.currentTooltip = null;
    }
}

/**
 * Create tooltip manager instance
 */
export function createTooltipManager(game) {
    const manager = new TooltipManager(game);
    manager.init();
    return manager;
}