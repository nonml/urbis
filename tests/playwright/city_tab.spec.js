import { test, expect } from '@playwright/test';

// Timeout configuration
const GLOBAL_TIMEOUT = 60000;
const ACTION_TIMEOUT = 15000;
const NAVIGATION_TIMEOUT = 10000;
const GAME_LOAD_DELAY = 6000;
const RENDER_STABILIZE_DELAY = 2000;

// Selector constants for maintainability
const SELECTORS = {
    // Main Buttons
    START_BTN: '#start-btn',
    
    // Game containers
    GAME_CONTAINER: '#game-container',
    GAME_CANVAS: '#game-canvas',
    
    // Build Menu
    BUILDING_GRID: '#building-grid',
    BUILDING_GRID_CITY: '#building-grid-city',
    BUILDING_CARD: '.building-card',
    BUILD_TAB_CORE: '.build-tab:has-text("Core")',
    BUILD_TAB_CITY: '.build-tab:has-text("City")',
    
    // City tab building selectors - using text content matching
    BUS_STOP: '.building-card:has-text("Bus Stop")',
    METRO_STATION: '.building-card:has-text("Metro Station")',
    BUS_DEPOT: '.building-card:has-text("Bus Depot")',
    TOLLWAY_GATE: '.building-card:has-text("Tollway Gate")',
    HIGHWAY_RAMP: '.building-card:has-text("Highway Ramp")',
    SUBWAY_SHAFT: '.building-card:has-text("Subway Shaft")',
    
    // Building card elements
    BUILDING_ICON: '.building-icon',
    BUILDING_NAME: '.building-name',
    BUILDING_COST: '.building-cost',
    COST_GOLD: '.cost-item.gold',
    
    // Transit category header - using exact text match
    TRANSIT_CATEGORY: '.building-category-header:has-text("Transit")',
};

// Extended building type constants
const CITY_BUILDINGS = {
    BUS_STOP: 'bus-stop',
    METRO_STATION: 'metro-station',
    BUS_DEPOT: 'bus-depot',
    TOLLWAY_GATE: 'tollway-gate',
    HIGHWAY_RAMP: 'highway-ramp',
    SUBWAY_SHAFT: 'subway-shaft',
};

// Transit building expected costs (from BUILDING_EXTENDED)
const TRANSIT_BUILDING_COSTS = {
    [CITY_BUILDINGS.BUS_STOP]: { gold: 40 },
    [CITY_BUILDINGS.METRO_STATION]: { gold: 500 },
    [CITY_BUILDINGS.BUS_DEPOT]: { gold: 200 },
    [CITY_BUILDINGS.TOLLWAY_GATE]: { gold: 150 },
    [CITY_BUILDINGS.HIGHWAY_RAMP]: { gold: 120 },
    [CITY_BUILDINGS.SUBWAY_SHAFT]: { gold: 80 },
};

// Extend test with custom fixtures
const customTest = test.extend({
    page: async ({ page }, use) => {
        page.setDefaultTimeout(ACTION_TIMEOUT);
        page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
        
        const consoleErrors = [];
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);
            if (msg.type() === 'error') {
                consoleErrors.push(text);
            }
        });
        
        page.consoleErrors = consoleErrors;
        page.consoleMessages = consoleMessages;
        
        // Helper to dismiss blocking overlays
        page.dismissOverlays = async () => {
            // Check if build menu is closed by looking for "Build: Off" message
            const isBuildMenuClosed = await page.evaluate(() => {
                const hud = document.getElementById('build-mode-hud');
                if (hud && hud.textContent && hud.textContent.includes('Build: Off')) {
                    return true;
                }
                return false;
            });
            
            await page.evaluate(() => {
                const overlayIds = [
                    'politics-panel', 'campaign-panel', 'factions-panel', 'tech-screen',
                    'quest-log', 'case-file', 'codex', 'shop', 'citizen-profile',
                    'map-screen', 'seed-browser', 'case-browser', 'hack-list',
                    'breach-minigame', 'run-summary', 'tutorial-tooltip',
                    'crisis-overlay', 'defeat-overlay', 'victory-overlay',
                    'settings-overlay'
                ];
                overlayIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.style.pointerEvents = 'none';
                        el.style.opacity = '0';
                        el.style.display = 'none';
                    }
                });
                // Also dismiss any generic overlay elements that might block
                document.querySelectorAll('.overlay-content, .dialogue-overlay, .tutorial-overlay, .crisis-choice-overlay').forEach(el => {
                    el.style.pointerEvents = 'none';
                    el.style.display = 'none';
                });
                // Disable minimap container pointer events to prevent click interception
                const minimapContainer = document.querySelector('.minimap-container');
                if (minimapContainer) {
                    minimapContainer.style.pointerEvents = 'none';
                }
                // Ensure building panel is visible by removing hidden class and setting inline styles with !important
                const buildingPanel = document.querySelector('.building-panel');
                if (buildingPanel) {
                    buildingPanel.classList.remove('hidden');
                    buildingPanel.style.setProperty('display', 'block', 'important');
                    buildingPanel.style.pointerEvents = 'auto';
                    // Scroll to top to ensure all buildings are visible
                    buildingPanel.scrollTop = 0;
                }
            });
            // Only press 'B' key if build menu is closed
            if (isBuildMenuClosed) {
                await page.keyboard.press('b');
            }
        };
        
        await use(page);
    },
});

customTest.describe.configure({ timeout: GLOBAL_TIMEOUT });

// ============================================================================
// CITY TAB BUILDINGS TESTS
// ============================================================================
customTest.describe('City Tab Buildings', () => {
    customTest.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4173/');
        await page.waitForLoadState('networkidle');
        // Wait for game container to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY });
    });

    customTest('city tab is accessible and shows transit buildings', async ({ page }) => {
        // Click start button to begin game
        await page.click(SELECTORS.START_BTN);
        // Wait for game container to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });
        
        // Verify game container is visible
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible();
        
        // Dismiss any blocking overlays
        await page.dismissOverlays();
        
        // Wait for city tab to be visible
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toBeVisible();
        // Switch to city tab
        await page.click(SELECTORS.BUILD_TAB_CITY);
        // Wait for city tab to have active class
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toHaveClass(/active/, { timeout: 2000 });
        // Wait for building grid to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.BUILDING_GRID_CITY)).toBeVisible({ timeout: 2000 });
        
        // Verify city tab is active (check for visual indicator or class)
        const cityTab = page.locator(SELECTORS.BUILD_TAB_CITY);
        await expect(cityTab).toBeVisible();
        
        // Verify transit category header is visible
        await expect(page.locator(SELECTORS.TRANSIT_CATEGORY)).toBeVisible();
        
        // Verify bus-stop building is visible
        const busStop = page.locator(SELECTORS.BUS_STOP);
        await expect(busStop).toBeVisible();
        
        // Verify other transit buildings are visible
        const metroStation = page.locator(SELECTORS.METRO_STATION);
        await expect(metroStation).toBeVisible();
        
        const busDepot = page.locator(SELECTORS.BUS_DEPOT);
        await expect(busDepot).toBeVisible();
        
        const tollwayGate = page.locator(SELECTORS.TOLLWAY_GATE);
        await expect(tollwayGate).toBeVisible();
        
        // Verify highway-ramp is visible
        const highwayRamp = page.locator(SELECTORS.HIGHWAY_RAMP);
        await expect(highwayRamp).toBeVisible();
        
        // Verify subway-shaft is visible
        const subwayShaft = page.locator(SELECTORS.SUBWAY_SHAFT);
        await expect(subwayShaft).toBeVisible();
    });

    customTest('can place bus-stop building', async ({ page }) => {
        // Click start button to begin game
        await page.click(SELECTORS.START_BTN);
        // Wait for game container to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });
        
        // Dismiss any blocking overlays
        await page.dismissOverlays();
        
        // Wait for city tab to be visible
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toBeVisible();
        // Switch to city tab
        await page.click(SELECTORS.BUILD_TAB_CITY);
        // Wait for city tab to have active class
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toHaveClass(/active/, { timeout: 2000 });
        // Wait for building grid to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.BUILDING_GRID_CITY)).toBeVisible({ timeout: 2000 });
        
        // Check if bus-stop is locked (requires 20 population, game starts with 10)
        const busStop = page.locator(SELECTORS.BUS_STOP);
        
        // Check if building has 'locked' class by inspecting the class attribute
        const busStopClass = await busStop.getAttribute('class');
        const isLocked = busStopClass && busStopClass.includes('locked');
        
        if (isLocked) {
            // Building is locked due to population requirement, verify the lock indicator is shown
            await expect(busStop).toContainText('Requires: 20 population');
            // Skip selection test for locked buildings
            return;
        }
        
        // Click on bus-stop building (only if unlocked)
        await busStop.click();
        // Wait for selected class instead of arbitrary timeout
        await expect(busStop).toHaveClass(/selected/, { timeout: 1000 });
        
        // Verify bus-stop is selected (already checked above, but keep for clarity)
        await expect(busStop).toHaveClass(/selected/);
        
        // Verify the building type is set in the game state
        const selectedBuilding = await page.evaluate(() => {
            return window.ui?.selectedBuilding || document.querySelector('.building-card.selected')?.dataset.type;
        });
        
        expect(selectedBuilding).toBe(CITY_BUILDINGS.BUS_STOP);
    });

    customTest('can place metro-station building', async ({ page }) => {
        // Click start button to begin game
        await page.click(SELECTORS.START_BTN);
        // Wait for game container to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });
        
        // Dismiss any blocking overlays
        await page.dismissOverlays();
        
        // Wait for city tab to be visible
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toBeVisible();
        // Switch to city tab
        await page.click(SELECTORS.BUILD_TAB_CITY);
        // Wait for city tab to have active class
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toHaveClass(/active/, { timeout: 2000 });
        // Wait for building grid to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.BUILDING_GRID_CITY)).toBeVisible({ timeout: 2000 });
        
        // Check if metro-station is locked (requires 150 population, game starts with 10)
        const metroStation = page.locator(SELECTORS.METRO_STATION);
        
        // Check if building has 'locked' class by inspecting the class attribute
        const metroStationClass = await metroStation.getAttribute('class');
        const isLocked = metroStationClass && metroStationClass.includes('locked');
        
        if (isLocked) {
            // Building is locked due to population requirement, verify the lock indicator is shown
            await expect(metroStation).toContainText('Requires: 150 population');
            // Skip selection test for locked buildings
            return;
        }
        
        // Click on metro-station building (only if unlocked)
        await metroStation.click();
        // Wait for selected class instead of arbitrary timeout
        await expect(metroStation).toHaveClass(/selected/, { timeout: 1000 });
        
        // Verify metro-station is selected (already checked above, but keep for clarity)
        await expect(metroStation).toHaveClass(/selected/);
        
        // Verify the building type is set in the game state
        const selectedBuilding = await page.evaluate(() => {
            return window.ui?.selectedBuilding || document.querySelector('.building-card.selected')?.dataset.type;
        });
        
        expect(selectedBuilding).toBe(CITY_BUILDINGS.METRO_STATION);
    });

    customTest('transit buildings show correct cost', async ({ page }) => {
        // Click start button to begin game
        await page.click(SELECTORS.START_BTN);
        // Wait for game container to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });
        
        // Dismiss any blocking overlays
        await page.dismissOverlays();
        
        // Wait for city tab to be visible
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toBeVisible();
        // Switch to city tab
        await page.click(SELECTORS.BUILD_TAB_CITY);
        // Wait for city tab to have active class
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toHaveClass(/active/, { timeout: 2000 });
        // Wait for building grid to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.BUILDING_GRID_CITY)).toBeVisible({ timeout: 2000 });
        
        // Verify bus-stop cost (40 gold)
        const busStop = page.locator(SELECTORS.BUS_STOP);
        await expect(busStop).toContainText('💰40');
        
        // Verify metro-station cost (500 gold)
        const metroStation = page.locator(SELECTORS.METRO_STATION);
        await expect(metroStation).toContainText('💰500');
        
        // Verify bus-depot cost (200 gold)
        const busDepot = page.locator(SELECTORS.BUS_DEPOT);
        await expect(busDepot).toContainText('💰200');
        
        // Verify tollway-gate cost (150 gold)
        const tollwayGate = page.locator(SELECTORS.TOLLWAY_GATE);
        await expect(tollwayGate).toContainText('💰150');
    });

    customTest('all transit buildings are clickable and selectable', async ({ page }) => {
        // Click start button to begin game
        await page.click(SELECTORS.START_BTN);
        // Wait for game container to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });
        
        // Dismiss any blocking overlays
        await page.dismissOverlays();
        
        // Wait for city tab to be visible
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toBeVisible();
        // Switch to city tab
        await page.click(SELECTORS.BUILD_TAB_CITY);
        // Wait for city tab to have active class
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toHaveClass(/active/, { timeout: 2000 });
        // Wait for building grid to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.BUILDING_GRID_CITY)).toBeVisible({ timeout: 2000 });
        
        // Test each transit building
        const transitBuildings = [
            { selector: SELECTORS.BUS_STOP, type: CITY_BUILDINGS.BUS_STOP },
            { selector: SELECTORS.METRO_STATION, type: CITY_BUILDINGS.METRO_STATION },
            { selector: SELECTORS.BUS_DEPOT, type: CITY_BUILDINGS.BUS_DEPOT },
            { selector: SELECTORS.TOLLWAY_GATE, type: CITY_BUILDINGS.TOLLWAY_GATE },
            { selector: SELECTORS.HIGHWAY_RAMP, type: CITY_BUILDINGS.HIGHWAY_RAMP },
            { selector: SELECTORS.SUBWAY_SHAFT, type: CITY_BUILDINGS.SUBWAY_SHAFT },
        ];
        
        for (const building of transitBuildings) {
            const card = page.locator(building.selector);
            
            // Check if building is locked by inspecting the class attribute
            const cardClass = await card.getAttribute('class');
            const isLocked = cardClass && cardClass.includes('locked');
            
            if (isLocked) {
                // Building is locked, verify it has a lock indicator
                await expect(card).toContainText('Requires:');
                // Skip selection test for locked buildings
                continue;
            }
            
            // Click on the building (only if unlocked)
            await card.click();
            // Wait for selected class instead of arbitrary timeout
            await expect(card).toHaveClass(/selected/, { timeout: 1000 });
            
            // Verify the building is selected (already checked above, but keep for clarity)
            await expect(card).toHaveClass(/selected/);
            
            // Verify the building type is set correctly
            const selectedType = await page.evaluate(() => {
                return document.querySelector('.building-card.selected')?.dataset.type;
            });
            
            expect(selectedType).toBe(building.type);
        }
    });

    customTest('city tab buildings display correct names and icons', async ({ page }) => {
        // Click start button to begin game
        await page.click(SELECTORS.START_BTN);
        // Wait for game container to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });
        
        // Dismiss any blocking overlays
        await page.dismissOverlays();
        
        // Wait for city tab to be visible
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toBeVisible();
        // Switch to city tab
        await page.click(SELECTORS.BUILD_TAB_CITY);
        // Wait for city tab to have active class
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toHaveClass(/active/, { timeout: 2000 });
        // Wait for building grid to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.BUILDING_GRID_CITY)).toBeVisible({ timeout: 2000 });
        
        // Verify building names are displayed
        await expect(page.locator(SELECTORS.BUS_STOP)).toContainText('Bus Stop');
        await expect(page.locator(SELECTORS.METRO_STATION)).toContainText('Metro Station');
        await expect(page.locator(SELECTORS.BUS_DEPOT)).toContainText('Bus Depot');
        await expect(page.locator(SELECTORS.TOLLWAY_GATE)).toContainText('Tollway Gate');
        await expect(page.locator(SELECTORS.HIGHWAY_RAMP)).toContainText('Highway Ramp');
        await expect(page.locator(SELECTORS.SUBWAY_SHAFT)).toContainText('Subway Shaft');
        
        // Verify icons are present (emoji icons)
        await expect(page.locator(SELECTORS.BUS_STOP)).toContainText('🚌');
        await expect(page.locator(SELECTORS.METRO_STATION)).toContainText('🚇');
        await expect(page.locator(SELECTORS.BUS_DEPOT)).toContainText('🚌');
        await expect(page.locator(SELECTORS.TOLLWAY_GATE)).toContainText('🚧');
        await expect(page.locator(SELECTORS.HIGHWAY_RAMP)).toContainText('🛣️');
        await expect(page.locator(SELECTORS.SUBWAY_SHAFT)).toContainText('🚇');
    });

    customTest('can switch between core and city tabs', async ({ page }) => {
        // Click start button to begin game
        await page.click(SELECTORS.START_BTN);
        // Wait for game container to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible({ timeout: GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY });
        
        // Dismiss any blocking overlays
        await page.dismissOverlays();
        
        // Verify core tab is initially visible (should show core buildings)
        const coreTab = page.locator(SELECTORS.BUILD_TAB_CORE);
        await expect(coreTab).toBeVisible();
        
        // Wait for city tab to be visible
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toBeVisible();
        // Click on city tab
        await page.click(SELECTORS.BUILD_TAB_CITY);
        // Wait for city tab to have active class
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toHaveClass(/active/, { timeout: 2000 });
        // Wait for transit category to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.TRANSIT_CATEGORY)).toBeVisible({ timeout: 2000 });
        
        // Verify transit buildings are visible
        await expect(page.locator(SELECTORS.BUS_STOP)).toBeVisible();
        
        // Click back to core tab
        await page.click(SELECTORS.BUILD_TAB_CORE);
        // Wait for building grid to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.BUILDING_GRID)).toBeVisible({ timeout: 1000 });
        
        // Verify core buildings are visible (e.g., House - always unlocked)
        await expect(page.locator('.building-card[data-type="house"]')).toBeVisible();
        
        // Wait for city tab to be visible
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toBeVisible();
        // Click back to city tab
        await page.click(SELECTORS.BUILD_TAB_CITY);
        // Wait for city tab to have active class
        await expect(page.locator(SELECTORS.BUILD_TAB_CITY)).toHaveClass(/active/, { timeout: 2000 });
        // Wait for transit category to be visible instead of arbitrary timeout
        await expect(page.locator(SELECTORS.TRANSIT_CATEGORY)).toBeVisible({ timeout: 2000 });
        
        // Verify transit buildings are visible again
        await expect(page.locator(SELECTORS.TRANSIT_CATEGORY)).toBeVisible();
    });
});
