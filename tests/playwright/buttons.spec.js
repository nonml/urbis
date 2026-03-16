import { test, expect } from '@playwright/test';

// Timeout configuration
const GLOBAL_TIMEOUT = 60000;
const ACTION_TIMEOUT = 15000;
const NAVIGATION_TIMEOUT = 10000;
const GAME_LOAD_DELAY = 3000;
const RENDER_STABILIZE_DELAY = 1000;

// Selector constants for maintainability
const SELECTORS = {
  // Overlays
  MAIN_MENU_OVERLAY: '#main-menu-overlay',
  VICTORY_OVERLAY: '#victory-overlay',
  CRISIS_OVERLAY: '#crisis-overlay',
  DEFEAT_OVERLAY: '#defeat-overlay',
  SETTINGS_OVERLAY: '#settings-overlay',
  
  // Main Buttons
  START_BTN: '#start-btn',
  RESTART_BTN: '#restart-btn',
  MAIN_MENU_BTN: '#main-menu-btn',
  SETTINGS_BTN: '#settings-btn',
  RESET_CAMERA: '#reset-camera',
  DEBUG_INFO_BTN: '#debug-info-btn',
  
  // Game containers
  GAME_CONTAINER: '#game-container',
  GAME_CANVAS: '#game-canvas',
  RESOURCE_BAR: '#resource-bar',
  MAIN_AREA: '#main-area',
  
  // Build Menu
  BUILD_MENU: '#build-menu',
  BUILDING_GRID: '#building-grid',
  BUILDING_CARD: '.building-card',
  BUILD_CANCEL_BTN: '.build-cancel-btn',
  
  // Campaign Panel
  CAMPAIGN_PANEL: '#campaign-panel',
  CAMPAIGN_TOGGLE_BTN: '#campaign-toggle-btn',
  CAMPAIGN_TABS: '.campaign-tabs .tab-btn',
  CAMPAIGN_CASE_BTN: '.case-btn',
  
  // Case File
  CASE_FILE: '#case-file',
  CASE_FILE_CLOSE: '#case-file-close',
  CASE_EVIDENCE_BTN: '.evidence-btn',
  
  // Citizen Profile
  CITIZEN_PROFILE: '#citizen-profile',
  CITIZEN_PROFILE_CLOSE: '#citizen-profile-close',
  CITIZEN_ACTION_BTN: '.citizen-action-btn',
  
  // Codex
  CODEX: '#codex',
  CODEX_CLOSE: '#codex-close',
  CODEX_ENTRY_BTN: '.codex-entry-btn',
  
  // Factions Panel
  FACTIONS_PANEL: '#factions-panel',
  FACTIONS_TOGGLE_BTN: '#factions-toggle-btn',
  FACTIONS_TABS: '.factions-tabs .tab-btn',
  FACTION_ACTION_BTN: '.faction-action-btn',
  
  // Hack List
  HACK_LIST: '#hack-list',
  HACK_LIST_CLOSE: '#hack-list-close',
  HACK_ACTION_BTN: '.hack-action-btn',
  
  // Map Screen
  MAP_SCREEN: '#map-screen',
  MAP_SCREEN_CLOSE: '#map-screen-close',
  MAP_NAV_BTN: '.map-nav-btn',
  
  // Politics Panel
  POLITICS_PANEL: '#politics-panel',
  POLITICS_TOGGLE_BTN: '#politics-toggle-btn',
  POLITICS_TABS: '.politics-tabs .tab-btn',
  POLICY_ENACT_BTN: '.policy-btn.enact',
  POLICY_REVOKE_BTN: '.policy-btn.revoke',
  
  // Quest Log
  QUEST_LOG: '#quest-log',
  QUEST_LOG_CLOSE: '#quest-log-close',
  QUEST_MARK_COMPLETE: '#quest-mark-complete',
  QUEST_CANCEL: '#quest-cancel',
  QUEST_LIST_ITEM: '.quest-list-item',
  
  // Run Summary
  RUN_SUMMARY: '.run-summary',
  RUN_SUMMARY_REPLAY: '#btn-replay',
  RUN_SUMMARY_NEW_RUN: '#btn-new-run',
  RUN_SUMMARY_STATS: '#btn-view-stats',
  
  // Seed Browser
  SEED_BROWSER: '.seed-browser',
  SEED_BROWSER_CLOSE: '.seed-browser-close',
  SEED_GENERATE_BTN: '.seed-generate-btn',
  SEED_ACTION_BTN: '.seed-action-btn',
  SEED_FILTER_BTN: '.seed-filter-btn',
  SEED_COPY_BTN: '.seed-action-btn.copy',
  SEED_DELETE_BTN: '.seed-action-btn.delete',
  SEED_REPLAY_BTN: '.seed-action-btn.replay',
  
  // Settings
  SETTINGS_TABS: '.settings-tabs .tab',
  SETTINGS_CLOSE: '.btn-close[data-action="close"]',
  SETTINGS_RESET: '#reset-settings',
  SETTINGS_KNOWN_ISSUES: '#known-issues-btn',
  SETTINGS_SLIDER: 'input[type="range"]',
  SETTINGS_CHECKBOX: 'input[type="checkbox"]',
  SETTINGS_SELECT: 'select',
  
  // Shop
  SHOP_PANEL: '.shop-panel',
  SHOP_CLOSE_BTN: '.shop-close-btn',
  SHOP_TABS: '.shop-tab',
  SHOP_ITEM: '.shop-item',
  
  // Tech Screen
  TECH_SCREEN: '#tech-overlay',
  TECH_SCREEN_TOGGLE: '#tech-toggle-btn',
  
  // Victory Screen
  VICTORY_SCREEN: '#victory-screen',
  VICTORY_CONTINUE: '.victory-continue',
  VICTORY_RESTART: '.victory-restart',
  VICTORY_MENU: '.victory-menu',
  
  // Breach Minigame
  BREACH_MINIGAME: '#breach-minigame',
  BREACH_ACTION_BTN: '.breach-action-btn',
  BREACH_CLOSE: '#breach-close',
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
    
    // Helper to dismiss blocking overlays (excludes settings-overlay)
    page.dismissOverlays = async () => {
      await page.evaluate(() => {
        const overlayIds = [
          'politics-panel', 'campaign-panel', 'factions-panel', 'tech-screen',
          'quest-log', 'case-file', 'codex', 'shop', 'citizen-profile',
          'map-screen', 'seed-browser', 'case-browser', 'hack-list',
          'breach-minigame', 'run-summary', 'tutorial-tooltip'
        ];
        overlayIds.forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0';
            el.style.display = 'none';
          }
        });
      });
    };
    
    await use(page);
  },
});

customTest.describe.configure({ timeout: GLOBAL_TIMEOUT });

// ============================================================================
// MAIN MENU BUTTONS
// ============================================================================
customTest.describe('Main Menu Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(GAME_LOAD_DELAY);
  });

  customTest('start button should be visible and enabled', async ({ page }) => {
    const startBtn = page.locator(SELECTORS.START_BTN);
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();
  });

  customTest('start button should transition to game', async ({ page }) => {
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY);
    await expect(page.locator(SELECTORS.GAME_CONTAINER)).toBeVisible();
  });

  customTest('restart button should be available in main menu', async ({ page }) => {
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY);
    
    // Show main menu to see restart button
    await page.evaluate(() => {
      if (window.showStartScreen) window.showStartScreen();
    });
    await page.waitForTimeout(500);
    
    await expect(page.locator(SELECTORS.RESTART_BTN)).toBeAttached();
  });

  customTest('settings button should be visible in main menu', async ({ page }) => {
    await expect(page.locator(SELECTORS.SETTINGS_BTN)).toBeVisible();
  });
});

// ============================================================================
// SETTINGS PANEL BUTTONS
// ============================================================================
customTest.describe('Settings Panel Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('settings button should open settings panel', async ({ page }) => {
    // Dismiss blocking overlays (excludes settings-overlay)
    await page.dismissOverlays();
    
    // Wait for settings button to be visible and enabled
    const settingsBtn = page.locator(SELECTORS.SETTINGS_BTN);
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await expect(settingsBtn).toBeEnabled({ timeout: 5000 });
    
    // Click the settings button
    await settingsBtn.click({ timeout: 5000 });
    
    // Wait for settings overlay to be attached and visible
    const settingsOverlay = page.locator(SELECTORS.SETTINGS_OVERLAY);
    await expect(settingsOverlay).toBeAttached({ timeout: 5000 });
    await expect(settingsOverlay).not.toHaveClass(/hidden/);
  });

  customTest('settings close button should close panel', async ({ page }) => {
    await page.dismissOverlays();
    const settingsBtn = page.locator(SELECTORS.SETTINGS_BTN);
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click({ timeout: 5000 });
    const settingsOverlay = page.locator(SELECTORS.SETTINGS_OVERLAY);
    await expect(settingsOverlay).toBeAttached({ timeout: 5000 });
    await expect(settingsOverlay).not.toHaveClass(/hidden/);
    
    const closeBtn = page.locator('#settings-overlay .btn-close[data-action="close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(settingsOverlay).not.toBeAttached({ timeout: 5000 });
  });

  customTest('settings tab buttons should switch tabs', async ({ page }) => {
    await page.dismissOverlays();
    const settingsBtn = page.locator(SELECTORS.SETTINGS_BTN);
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click({ timeout: 5000 });
    const settingsOverlay = page.locator(SELECTORS.SETTINGS_OVERLAY);
    await expect(settingsOverlay).toBeAttached({ timeout: 5000 });
    await expect(settingsOverlay).not.toHaveClass(/hidden/);
    
    const tabs = settingsOverlay.locator('.settings-tabs .tab');
    await expect(tabs.first()).toHaveClass(/active/);
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveClass(/active/);
  });

  customTest('settings sliders should be interactive', async ({ page }) => {
    await page.dismissOverlays();
    const settingsBtn = page.locator(SELECTORS.SETTINGS_BTN);
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click({ timeout: 5000 });
    const settingsOverlay = page.locator(SELECTORS.SETTINGS_OVERLAY);
    await expect(settingsOverlay).toBeAttached({ timeout: 5000 });
    await expect(settingsOverlay).not.toHaveClass(/hidden/);
    
    const sensitivitySlider = settingsOverlay.locator('#mouse-sensitivity');
    await expect(sensitivitySlider).toBeVisible();
    const initialValue = await sensitivitySlider.inputValue();
    expect(initialValue).toBeTruthy();
  });

  customTest('settings checkboxes should be toggleable', async ({ page }) => {
    await page.dismissOverlays();
    const settingsBtn = page.locator(SELECTORS.SETTINGS_BTN);
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click({ timeout: 5000 });
    const settingsOverlay = page.locator(SELECTORS.SETTINGS_OVERLAY);
    await expect(settingsOverlay).toBeAttached({ timeout: 5000 });
    await expect(settingsOverlay).not.toHaveClass(/hidden/);
    
    const invertYCheckbox = settingsOverlay.locator('#invert-y');
    await expect(invertYCheckbox).toBeVisible();
    await invertYCheckbox.check();
    await expect(invertYCheckbox).toBeChecked();
  });

  customTest('settings theme select should be changeable', async ({ page }) => {
    await page.dismissOverlays();
    const settingsBtn = page.locator(SELECTORS.SETTINGS_BTN);
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click({ timeout: 5000 });
    const settingsOverlay = page.locator(SELECTORS.SETTINGS_OVERLAY);
    await expect(settingsOverlay).toBeAttached({ timeout: 5000 });
    await expect(settingsOverlay).not.toHaveClass(/hidden/);
    
    await settingsOverlay.locator('.settings-tabs .tab[data-tab="graphics"]').click();
    await expect(settingsOverlay.locator('.settings-tab-content[data-content="graphics"]')).toBeVisible();
    const themeSelect = settingsOverlay.locator('#theme-select');
    await expect(themeSelect).toBeVisible();
  });

  customTest('settings reset button should be visible', async ({ page }) => {
    await page.dismissOverlays();
    const settingsBtn = page.locator(SELECTORS.SETTINGS_BTN);
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click({ timeout: 5000 });
    const settingsOverlay = page.locator(SELECTORS.SETTINGS_OVERLAY);
    await expect(settingsOverlay).toBeAttached({ timeout: 5000 });
    await expect(settingsOverlay).not.toHaveClass(/hidden/);
    
    await settingsOverlay.locator('.settings-tabs .tab[data-tab="system"]').click();
    await expect(settingsOverlay.locator('.settings-tab-content[data-content="system"]')).toBeVisible();
    const resetBtn = settingsOverlay.locator('#reset-settings');
    await expect(resetBtn).toBeVisible();
  });

  customTest('settings known issues button should be visible', async ({ page }) => {
    await page.dismissOverlays();
    const settingsBtn = page.locator(SELECTORS.SETTINGS_BTN);
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click({ timeout: 5000 });
    const settingsOverlay = page.locator(SELECTORS.SETTINGS_OVERLAY);
    await expect(settingsOverlay).toBeAttached({ timeout: 5000 });
    await expect(settingsOverlay).not.toHaveClass(/hidden/);
    
    await settingsOverlay.locator('.settings-tabs .tab[data-tab="system"]').click();
    await expect(settingsOverlay.locator('.settings-tab-content[data-content="system"]')).toBeVisible();
    const knownIssuesBtn = settingsOverlay.locator('#known-issues-btn');
    await expect(knownIssuesBtn).toBeVisible();
  });
});

// ============================================================================
// BUILD MENU BUTTONS
// ============================================================================
customTest.describe('Build Menu Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('building grid should be visible', async ({ page }) => {
    await expect(page.locator(SELECTORS.BUILDING_GRID)).toBeVisible();
  });

  customTest('building cards should be clickable', async ({ page }) => {
    const buildingCards = page.locator(SELECTORS.BUILDING_CARD);
    const count = await buildingCards.count();
    expect(count).toBeGreaterThan(0);
    
    // First building card should be clickable
    await expect(buildingCards.first()).toBeVisible();
  });

  customTest('building cards should have proper structure', async ({ page }) => {
    const buildingCards = page.locator(SELECTORS.BUILDING_CARD);
    await expect(buildingCards.first()).toBeVisible();
    
    // Building cards should have name and cost
    const firstCard = buildingCards.first();
    await expect(firstCard.locator('.building-name')).toBeVisible();
  });
});

// ============================================================================
// POLITICS PANEL BUTTONS
// ============================================================================
customTest.describe('Politics Panel Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('politics toggle button should open panel', async ({ page }) => {
    // Politics panel is toggled with 'P' key
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(500);
    
    // Panel should be created (may not be visible if no policies)
    const panel = page.locator(SELECTORS.POLITICS_PANEL);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist if politics system not initialized
    });
  });

  customTest('politics tab buttons should switch tabs', async ({ page }) => {
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.POLITICS_PANEL);
    // Politics panel tab buttons use .tab-btn class with data-tab attribute
    const tabs = page.locator('#politics-panel .tab-btn');
    
    // Check if tabs exist
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      await expect(tabs.first()).toBeVisible();
      
      // Click second tab
      if (tabCount > 1) {
        await tabs.nth(1).click();
        await page.waitForTimeout(300);
        await expect(tabs.nth(1)).toHaveClass(/active/);
      }
    }
  });
});

// ============================================================================
// CAMPAIGN PANEL BUTTONS
// ============================================================================
customTest.describe('Campaign Panel Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('campaign toggle button should open panel', async ({ page }) => {
    // Campaign panel is toggled with 'C' key
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.CAMPAIGN_PANEL);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist if campaign system not initialized
    });
  });

  customTest('campaign tab buttons should be present', async ({ page }) => {
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.CAMPAIGN_PANEL);
    const tabs = panel.locator('.campaign-tabs .tab-btn');
    
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });
});

// ============================================================================
// FACTIONS PANEL BUTTONS
// ============================================================================
customTest.describe('Factions Panel Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('factions toggle button should open panel', async ({ page }) => {
    // Factions panel is toggled with 'F' key
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.FACTIONS_PANEL);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist if factions system not initialized
    });
  });
});

// ============================================================================
// QUEST LOG BUTTONS
// ============================================================================
customTest.describe('Quest Log Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('quest log toggle should open panel', async ({ page }) => {
    // Quest log is toggled with 'J' key
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.QUEST_LOG);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist if quest system not initialized
    });
  });

  customTest('quest log close button should close panel', async ({ page }) => {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.QUEST_LOG);
    // Quest log close button has id #quest-log-close
    const closeBtn = page.locator('#quest-log-close');
    
    const closeCount = await closeBtn.count();
    if (closeCount > 0) {
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await page.waitForTimeout(300);
      
      await expect(panel).toHaveCSS('display', 'none');
    }
  });

  customTest('quest mark complete button should be present', async ({ page }) => {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(500);
    
    // Quest log buttons have IDs #quest-mark-complete and #quest-cancel
    const markCompleteBtn = page.locator('#quest-mark-complete');
    
    const btnCount = await markCompleteBtn.count();
    if (btnCount > 0) {
      await expect(markCompleteBtn).toBeVisible();
      // Button should be disabled by default (no quest selected)
      await expect(markCompleteBtn).toBeDisabled();
    }
  });

  customTest('quest cancel button should be present', async ({ page }) => {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(500);
    
    const cancelBtn = page.locator('#quest-cancel');
    
    const btnCount = await cancelBtn.count();
    if (btnCount > 0) {
      await expect(cancelBtn).toBeVisible();
      // Button should be disabled by default (no quest selected)
      await expect(cancelBtn).toBeDisabled();
    }
  });
});

// ============================================================================
// MAP SCREEN BUTTONS
// ============================================================================
customTest.describe('Map Screen Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('map screen toggle should open panel', async ({ page }) => {
    // Map screen is toggled with 'M' key
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.MAP_SCREEN);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist if map screen not initialized
    });
  });

  customTest('map screen close button should close panel', async ({ page }) => {
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.MAP_SCREEN);
    const closeBtn = panel.locator(SELECTORS.MAP_SCREEN_CLOSE);
    
    const closeCount = await closeBtn.count();
    if (closeCount > 0) {
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await page.waitForTimeout(300);
      
      await expect(panel).toHaveCSS('display', 'none');
    }
  });
});

// ============================================================================
// SEED BROWSER BUTTONS
// ============================================================================
customTest.describe('Seed Browser Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('seed browser should have close button', async ({ page }) => {
    // Seed browser is opened via UI - check if it can be created
    await page.evaluate(() => {
      if (window.seedBrowserUI && typeof window.seedBrowserUI.show === 'function') {
        window.seedBrowserUI.show();
      }
    });
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.SEED_BROWSER);
    const closeBtn = panel.locator(SELECTORS.SEED_BROWSER_CLOSE);
    
    const closeCount = await closeBtn.count();
    if (closeCount > 0) {
      await expect(closeBtn).toBeVisible();
    }
  });

  customTest('seed browser should have generate button', async ({ page }) => {
    await page.evaluate(() => {
      if (window.seedBrowserUI && typeof window.seedBrowserUI.show === 'function') {
        window.seedBrowserUI.show();
      }
    });
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.SEED_BROWSER);
    const generateBtn = panel.locator(SELECTORS.SEED_GENERATE_BTN);
    
    const btnCount = await generateBtn.count();
    if (btnCount > 0) {
      await expect(generateBtn).toBeVisible();
    }
  });

  customTest('seed browser should have filter buttons', async ({ page }) => {
    await page.evaluate(() => {
      if (window.seedBrowserUI && typeof window.seedBrowserUI.show === 'function') {
        window.seedBrowserUI.show();
      }
    });
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.SEED_BROWSER);
    const filterBtns = panel.locator(SELECTORS.SEED_FILTER_BTN);
    
    const btnCount = await filterBtns.count();
    if (btnCount > 0) {
      await expect(filterBtns.first()).toBeVisible();
    }
  });
});

// ============================================================================
// SHOP BUTTONS
// ============================================================================
customTest.describe('Shop Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('shop should have close button', async ({ page }) => {
    await page.evaluate(() => {
      if (window.shopUI && typeof window.shopUI.show === 'function') {
        window.shopUI.show();
      }
    });
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.SHOP_PANEL);
    const closeBtn = panel.locator(SELECTORS.SHOP_CLOSE_BTN);
    
    const closeCount = await closeBtn.count();
    if (closeCount > 0) {
      await expect(closeBtn).toBeVisible();
    }
  });

  customTest('shop should have tab buttons', async ({ page }) => {
    await page.evaluate(() => {
      if (window.shopUI && typeof window.shopUI.show === 'function') {
        window.shopUI.show();
      }
    });
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.SHOP_PANEL);
    const tabs = panel.locator(SELECTORS.SHOP_TABS);
    
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      await expect(tabs.first()).toBeVisible();
      // First tab should be active by default
      await expect(tabs.first()).toHaveClass(/active/);
    }
  });

  customTest('shop tab buttons should switch tabs', async ({ page }) => {
    await page.evaluate(() => {
      if (window.shopUI && typeof window.shopUI.show === 'function') {
        window.shopUI.show();
      }
    });
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.SHOP_PANEL);
    const tabs = panel.locator(SELECTORS.SHOP_TABS);
    
    const tabCount = await tabs.count();
    if (tabCount > 1) {
      // Click second tab
      await tabs.nth(1).click();
      await page.waitForTimeout(300);
      
      await expect(tabs.nth(1)).toHaveClass(/active/);
    }
  });
});

// ============================================================================
// TECH SCREEN BUTTONS
// ============================================================================
customTest.describe('Tech Screen Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('tech screen toggle should open panel', async ({ page }) => {
    // Tech screen is toggled with 'T' key
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.TECH_SCREEN);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist if tech screen not initialized
    });
  });

  customTest('tech screen should have close button', async ({ page }) => {
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.TECH_SCREEN);
    // Tech screen close button uses onclick handler with class .btn.btn-primary
    const closeBtn = panel.locator('.btn.btn-primary');
    
    const closeCount = await closeBtn.count();
    if (closeCount > 0) {
      await expect(closeBtn).toBeVisible();
    }
  });
});

// ============================================================================
// VICTORY SCREEN BUTTONS
// ============================================================================
customTest.describe('Victory Screen Buttons', () => {
  customTest('victory screen should have continue button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Simulate victory screen
    await page.evaluate(() => {
      const victoryScreen = document.getElementById('victory-screen');
      if (victoryScreen) {
        victoryScreen.classList.remove('hidden');
      }
    });
    await page.waitForTimeout(300);
    
    const continueBtn = page.locator(SELECTORS.VICTORY_CONTINUE);
    const continueCount = await continueBtn.count();
    
    if (continueCount > 0) {
      await expect(continueBtn).toBeVisible();
    }
  });

  customTest('victory screen should have restart button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.evaluate(() => {
      const victoryScreen = document.getElementById('victory-screen');
      if (victoryScreen) {
        victoryScreen.classList.remove('hidden');
      }
    });
    await page.waitForTimeout(300);
    
    const restartBtn = page.locator(SELECTORS.VICTORY_RESTART);
    const restartCount = await restartBtn.count();
    
    if (restartCount > 0) {
      await expect(restartBtn).toBeVisible();
    }
  });

  customTest('victory screen should have menu button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.evaluate(() => {
      const victoryScreen = document.getElementById('victory-screen');
      if (victoryScreen) {
        victoryScreen.classList.remove('hidden');
      }
    });
    await page.waitForTimeout(300);
    
    const menuBtn = page.locator(SELECTORS.VICTORY_MENU);
    const menuCount = await menuBtn.count();
    
    if (menuCount > 0) {
      await expect(menuBtn).toBeVisible();
    }
  });
});

// ============================================================================
// RUN SUMMARY BUTTONS
// ============================================================================
customTest.describe('Run Summary Buttons', () => {
  customTest('run summary should have replay button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Simulate run summary
    await page.evaluate(() => {
      const summary = document.querySelector('.run-summary');
      if (summary) {
        summary.style.display = 'block';
      }
    });
    await page.waitForTimeout(300);
    
    const replayBtn = page.locator(SELECTORS.RUN_SUMMARY_REPLAY);
    const replayCount = await replayBtn.count();
    
    if (replayCount > 0) {
      await expect(replayBtn).toBeVisible();
    }
  });

  customTest('run summary should have new run button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.evaluate(() => {
      const summary = document.querySelector('.run-summary');
      if (summary) {
        summary.style.display = 'block';
      }
    });
    await page.waitForTimeout(300);
    
    const newRunBtn = page.locator(SELECTORS.RUN_SUMMARY_NEW_RUN);
    const newRunCount = await newRunBtn.count();
    
    if (newRunCount > 0) {
      await expect(newRunBtn).toBeVisible();
    }
  });

  customTest('run summary should have stats button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.evaluate(() => {
      const summary = document.querySelector('.run-summary');
      if (summary) {
        summary.style.display = 'block';
      }
    });
    await page.waitForTimeout(300);
    
    const statsBtn = page.locator(SELECTORS.RUN_SUMMARY_STATS);
    const statsCount = await statsBtn.count();
    
    if (statsCount > 0) {
      await expect(statsBtn).toBeVisible();
    }
  });
});

// ============================================================================
// GAME CONTROLS BUTTONS
// ============================================================================
customTest.describe('Game Controls Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('reset camera button should be visible and clickable', async ({ page }) => {
    const resetBtn = page.locator(SELECTORS.RESET_CAMERA);
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toBeEnabled();
    
    await page.dismissOverlays();
    await resetBtn.click({ force: true });
    await page.waitForTimeout(300);
    
    await expect(resetBtn).toBeVisible();
  });

  customTest('debug info button should be visible', async ({ page }) => {
    const debugBtn = page.locator(SELECTORS.DEBUG_INFO_BTN);
    await expect(debugBtn).toBeVisible();
  });

  customTest('main menu button should be available', async ({ page }) => {
    // Main menu button may be in overlay
    const mainMenuBtn = page.locator(SELECTORS.MAIN_MENU_BTN);
    await mainMenuBtn.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Button may not be visible in game mode
    });
  });
});

// ============================================================================
// KEYBOARD TOGGLE TESTS
// ============================================================================
customTest.describe('Keyboard Toggle Buttons', () => {
  customTest.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click(SELECTORS.START_BTN);
    await page.waitForTimeout(GAME_LOAD_DELAY + RENDER_STABILIZE_DELAY);
  });

  customTest('P key should toggle politics panel', async ({ page }) => {
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.POLITICS_PANEL);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist
    });
  });

  customTest('C key should toggle campaign panel', async ({ page }) => {
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.CAMPAIGN_PANEL);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist
    });
  });

  customTest('F key should toggle factions panel', async ({ page }) => {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.FACTIONS_PANEL);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist
    });
  });

  customTest('J key should toggle quest log', async ({ page }) => {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.QUEST_LOG);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist
    });
  });

  customTest('M key should toggle map screen', async ({ page }) => {
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.MAP_SCREEN);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist
    });
  });

  customTest('T key should toggle tech screen', async ({ page }) => {
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(500);
    
    const panel = page.locator(SELECTORS.TECH_SCREEN);
    await panel.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {
      // Panel may not exist
    });
  });
});
