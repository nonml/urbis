const { contextBridge, ipcRenderer } = require('electron');

/**
 * Electron preload — exposes native APIs to the renderer (game) safely.
 * Available as `window.electronAPI` in the browser context.
 */
contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

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
