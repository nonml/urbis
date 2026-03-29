const { contextBridge, ipcRenderer } = require('electron');

/**
 * Electron preload — exposes native APIs to the renderer (game) safely.
 * Available as `window.electronAPI` in the browser context.
 */

// Ask main process synchronously whether Steam/Greenworks is ready.
// This runs at preload time (before any renderer JS executes) so steam.js
// can call initAPI() synchronously and get the correct answer.
const steamEnabled = ipcRenderer.sendSync('steam:enabled');

/**
 * Greenworks proxy — mirrors the Greenworks API surface but routes every call
 * through IPC to the main process (which holds the real native addon).
 * Exposed as window.electronAPI.greenworks (or null if Steam is unavailable).
 */
const greenworksProxy = steamEnabled ? {
    /** initAPI() already ran in the main process; just return cached result. */
    initAPI: () => true,

    getSteamId: async () => ipcRenderer.invoke('steam:get-steam-id'),

    activateAchievement: (steamId, onSuccess, onError) => {
        ipcRenderer.invoke('steam:activate-achievement', steamId)
            .then(onSuccess)
            .catch(onError);
    },

    clearAchievement: (steamId, onSuccess, onError) => {
        ipcRenderer.invoke('steam:clear-achievement', steamId)
            .then(onSuccess)
            .catch(onError);
    },

    setStatInt: (stat, value, onSuccess, onError) => {
        ipcRenderer.invoke('steam:set-stat-int', stat, value)
            .then(onSuccess)
            .catch(onError);
    },

    storeStats: (onSuccess, onError) => {
        ipcRenderer.invoke('steam:store-stats')
            .then(onSuccess)
            .catch(onError);
    },

    activateGameOverlay: (dialog) => {
        ipcRenderer.invoke('steam:activate-overlay', dialog);
    },
} : null;

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

    /** Greenworks proxy (null when Steam is unavailable) */
    greenworks: greenworksProxy,

    /** Save game JSON — opens native Save dialog */
    saveFile: (defaultName, content) =>
        ipcRenderer.invoke('save-file-dialog', { defaultName, content }),

    /** Load game JSON — opens native Open dialog */
    openFile: () =>
        ipcRenderer.invoke('open-file-dialog'),

    /** Save PNG screenshot — opens native Save dialog */
    saveScreenshot: (dataUrl, defaultName) =>
        ipcRenderer.invoke('save-screenshot', { dataUrl, defaultName }),
});
