// Shop UI for purchasing unlocks with profile progression
import { profileManager, UNLOCK_TREE } from '../sim/persistence/profile.js';

// Shop styles
const SHOP_STYLES = `
.shop-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    max-width: 90vw;
    max-height: 80vh;
    background: rgba(20, 20, 30, 0.98);
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    z-index: 10000;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
}

.shop-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.shop-title {
    font-size: 24px;
    font-weight: 700;
}

.shop-subtitle {
    font-size: 13px;
    color: #888;
}

.shop-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 20px;
}

.shop-tab {
    padding: 8px 16px;
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: #aaa;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s ease;
}

.shop-tab:hover {
    background: rgba(255, 255, 255, 0.1);
}

.shop-tab.active {
    background: #4ade80;
    color: #000;
    font-weight: 600;
}

.shop-content {
    flex: 1;
    overflow-y: auto;
    padding-right: 8px;
}

.shop-content::-webkit-scrollbar {
    width: 6px;
}

.shop-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
}

.shop-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
}

.shop-category {
    margin-bottom: 24px;
}

.shop-category-title {
    font-size: 14px;
    font-weight: 600;
    color: #ccc;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.shop-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
}

.shop-item {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
}

.shop-item:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
}

.shop-item.unlocked {
    opacity: 0.5;
    cursor: default;
}

.shop-item.locked {
    border-color: rgba(255, 255, 255, 0.1);
}

.shop-item.purchasable {
    border-color: #4ade80;
}

.shop-item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
}

.shop-item-name {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
}

.shop-item-unlocked {
    font-size: 10px;
    background: #4ade80;
    color: #000;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 700;
}

.shop-item-description {
    font-size: 12px;
    color: #888;
    line-height: 1.4;
    margin-bottom: 12px;
}

.shop-item-cost {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
}

.shop-item-cost-value {
    color: #4ade80;
    font-weight: 600;
}

.shop-item-status {
    font-size: 11px;
    color: #888;
}

.shop-footer {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.shop-profile-info {
    font-size: 13px;
    color: #888;
}

.shop-profile-info span {
    color: #fff;
    font-weight: 600;
}

.shop-close-btn {
    padding: 8px 20px;
    background: #4ade80;
    color: #000;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.shop-close-btn:hover {
    background: #22c55e;
    transform: translateY(-2px);
}

/* Category specific colors */
.shop-category.buildings .shop-item {
    border-left: 3px solid #60a5fa;
}

.shop-category.mutators .shop-item {
    border-left: 3px solid #4ade80;
}

.shop-category.modes .shop-item {
    border-left: 3px solid #fbbf24;
}
`;

// Shop UI class
export class ShopUI {
    constructor(game) {
        this.game = game;
        this.panel = null;
        this.isShowing = false;
        this.activeTab = 'buildings';

        // Style element
        this.styleElement = null;
        this.insertStyles();
    }

    insertStyles() {
        if (this.styleElement) return;

        this.styleElement = document.createElement('style');
        this.styleElement.textContent = SHOP_STYLES;
        document.head.appendChild(this.styleElement);
    }

    // Show the shop
    show() {
        if (this.isShowing) this.hide();

        // Create panel
        this.panel = document.createElement('div');
        this.panel.className = 'shop-panel';
        this.panel.innerHTML = this.createShopHTML();

        // Add event listeners
        this.setupEventListeners();

        // Add to DOM
        document.body.appendChild(this.panel);
        this.isShowing = true;

        // Initial render
        this.renderTab();
    }

    hide() {
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
        this.isShowing = false;
    }

    setupEventListeners() {
        // Tab switches
        const tabs = this.panel.querySelectorAll('.shop-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                if (category) {
                    this.activeTab = category;
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.renderTab();
                }
            });
        });

        // Item purchases
        this.panel.querySelectorAll('.shop-item').forEach(item => {
            item.addEventListener('click', () => {
                const category = item.dataset.category;
                const key = item.dataset.key;
                this.handleItemClick(category, key, item);
            });
        });

        // Close button
        this.panel.querySelector('.shop-close-btn').addEventListener('click', () => {
            this.hide();
        });
    }

    createShopHTML() {
        const profile = profileManager.getProfileData();

        const tabs = [
            { id: 'buildings', label: 'Buildings', icon: '🏢' },
            { id: 'mutators', label: 'Mutators', icon: '⚙️' },
            { id: 'modes', label: 'Modes', icon: '🎮' },
            { id: 'ui', label: 'UI Features', icon: '🎨' },
        ];

        return `
            <div class="shop-header">
                <div>
                    <div class="shop-title">Meta Progression Shop</div>
                    <div class="shop-subtitle">Unlock content with your city-building achievements</div>
                </div>
                <div class="shop-profile-info">
                    Unlocked: <span>${profile.unlockedCount}</span> / <span>${profile.totalCount}</span>
                </div>
            </div>

            <div class="shop-tabs">
                ${tabs.map(tab => `
                    <button class="shop-tab ${tab.id === this.activeTab ? 'active' : ''}"
                            data-category="${tab.id}">
                        ${tab.icon} ${tab.label}
                    </button>
                `).join('')}
            </div>

            <div class="shop-content">
                ${this.createTabContent()}
            </div>

            <div class="shop-footer">
                <div class="shop-profile-info">
                    Runs: <span>${profile.totalRuns}</span> | Wins: <span>${profile.wins}</span> (Rate: ${profile.winRate}%)
                </div>
                <button class="shop-close-btn">Close Shop</button>
            </div>
        `;
    }

    createTabContent() {
        const category = this.activeTab;

        // Get unlocked items for this category
        const unlockedItems = profileManager.getUnlockedItems()[category] || [];

        // Get unlockable items from UNLOCK_TREE
        const items = UNLOCK_TREE[category] || {};

        let html = `<div class="shop-category ${category}">`;

        // Group by category title if needed
        if (category === 'buildings') {
            html += `<div class="shop-category-title">Building Templates</div>`;
        } else if (category === 'mutators') {
            html += `<div class="shop-category-title">Run Modifiers</div>`;
        } else if (category === 'modes') {
            html += `<div class="shop-category-title">Game Modes</div>`;
        } else if (category === 'ui') {
            html += `<div class="shop-category-title">User Interface Features</div>`;
        }

        html += `<div class="shop-grid">`;

        for (const [key, item] of Object.entries(items)) {
            const isUnlocked = this.isItemUnlocked(category, key);
            const isPurchasable = this.isItemPurchasable(category, key);

            html += `
                <div class="shop-item ${isUnlocked ? 'unlocked' : ''} ${isPurchasable ? 'purchasable' : ''}"
                     data-category="${category}" data-key="${key}">
                    <div class="shop-item-header">
                        <span class="shop-item-name">${item.name}</span>
                        ${isUnlocked ? '<span class="shop-item-unlocked">Unlocked</span>' : ''}
                    </div>
                    <div class="shop-item-description">${item.description}</div>
                    <div class="shop-item-cost">
                        <span class="shop-item-cost-value">
                            ${this.getCostDisplay(item.cost)}
                        </span>
                        <span class="shop-item-status">
                            ${isUnlocked ? '✓ Owned' : isPurchasable ? 'Click to Unlock' : 'Coming Soon'}
                        </span>
                    </div>
                </div>
            `;
        }

        html += `</div></div>`;
        return html;
    }

    getCostDisplay(cost) {
        const parts = [];
        if (cost.runs > 0) {
            parts.push(`${cost.runs} ${cost.runs === 1 ? 'Run' : 'Runs'}`);
        }
        if (cost.days > 0) {
            parts.push(`${cost.days} Days`);
        }
        return parts.length > 0 ? parts.join(' + ') : 'Free';
    }

    isItemUnlocked(category, key) {
        return profileManager.isUnlocked(category, key);
    }

    isItemPurchasable(category, key) {
        if (this.isItemUnlocked(category, key)) return false;

        const item = UNLOCK_TREE[category]?.[key];
        if (!item) return false;

        return profileManager.canUnlockMutator(key);
    }

    handleItemClick(category, key, itemElement) {
        if (this.isItemUnlocked(category, key)) return;

        if (this.isItemPurchasable(category, key)) {
            // Unlock the item
            if (profileManager.unlockMutator(key)) {
                // Re-render
                this.renderTab();
                this.updateProfileInfo();
            }
        } else {
            // Show unlock requirements
            const item = UNLOCK_TREE[category]?.[key];
            if (item) {
                alert(`Unlock Requirements:\n${this.getCostDisplay(item.cost)}\n\n${item.description}`);
            }
        }
    }

    renderTab() {
        const content = this.panel.querySelector('.shop-content');
        if (content) {
            content.innerHTML = this.createTabContent();
            this.setupEventListeners();
        }
    }

    updateProfileInfo() {
        const info = this.panel.querySelector('.shop-profile-info');
        if (info) {
            const profile = profileManager.getProfileData();
            info.innerHTML = `
                Runs: <span>${profile.totalRuns}</span> | Wins: <span>${profile.wins}</span> (Rate: ${profile.winRate}%)
            `;
        }
    }
}

// Factory function
export function createShop(game) {
    return new ShopUI(game);
}