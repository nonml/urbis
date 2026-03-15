const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ─── Greenworks / Steam ───────────────────────────────────────────────────────
// Loaded once at startup; null if Steam is unavailable.
let gw = null;
let gwEnabled = false;

function initSteam() {
    try {
        // greenworks must be a native addon built for this Electron version.
        // It lives next to the binary in production, or in node_modules in dev.
        const greenworks = (() => {
            try { return require('greenworks'); } catch { return null; }
        })();
        if (!greenworks) return;
        if (!greenworks.initAPI()) {
            console.info('[Steam] initAPI() returned false — Steam not running.');
            return;
        }
        gw = greenworks;
        gwEnabled = true;
        console.info('[Steam] Initialised. SteamId:', gw.getSteamId?.() ?? 'n/a');
    } catch (err) {
        console.warn('[Steam] Init error:', err.message);
    }
}

function setupSteamIpc() {
    // Synchronous: renderer can call this at preload time to get init status
    ipcMain.on('steam:enabled', (e) => { e.returnValue = gwEnabled; });

    ipcMain.handle('steam:get-steam-id', () => gwEnabled ? (gw.getSteamId?.() ?? null) : null);

    ipcMain.handle('steam:activate-achievement', (_, steamId) => new Promise((resolve, reject) => {
        if (!gwEnabled) { resolve(false); return; }
        gw.activateAchievement(steamId, () => resolve(true), (err) => reject(err));
    }));

    ipcMain.handle('steam:clear-achievement', (_, steamId) => new Promise((resolve, reject) => {
        if (!gwEnabled) { resolve(false); return; }
        gw.clearAchievement(steamId, () => resolve(true), (err) => reject(err));
    }));

    ipcMain.handle('steam:set-stat-int', (_, stat, value) => new Promise((resolve, reject) => {
        if (!gwEnabled) { resolve(false); return; }
        gw.setStatInt(stat, value, () => resolve(true), (err) => reject(err));
    }));

    ipcMain.handle('steam:store-stats', () => new Promise((resolve, reject) => {
        if (!gwEnabled) { resolve(false); return; }
        gw.storeStats(() => resolve(true), (err) => reject(err));
    }));

    ipcMain.handle('steam:activate-overlay', (_, dialog) => {
        if (!gwEnabled) return;
        try { gw.activateGameOverlay(dialog); } catch { /* ignore */ }
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'City Builder',
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'electron-preload.js'),
        },
        // Remove default menu bar for cleaner game feel
        autoHideMenuBar: true,
    });

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools({ mode: 'detach' });
    } else {
        win.loadFile(path.join(__dirname, 'build', 'index.html'));
    }

    // Fullscreen toggle (F11)
    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F11') {
            win.setFullScreen(!win.isFullScreen());
        }
    });
}

app.whenReady().then(() => {
    initSteam();
    setupSteamIpc();
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ─── IPC handlers for native features ────────────────────────────────────────

/** Save game data to a file chosen by the user */
ipcMain.handle('save-file-dialog', async (event, { defaultName, content }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Game',
        defaultPath: defaultName ?? 'city-save.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false };
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true, filePath };
});

/** Load game data from a file chosen by the user */
ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Load Game',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { ok: false };
    const content = fs.readFileSync(filePaths[0], 'utf8');
    return { ok: true, content, filePath: filePaths[0] };
});

/** Screenshot — renderer sends a data URL, we save it */
ipcMain.handle('save-screenshot', async (event, { dataUrl, defaultName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Screenshot',
        defaultPath: defaultName ?? 'city-screenshot.png',
        filters: [{ name: 'PNG', extensions: ['png'] }],
    });
    if (canceled || !filePath) return { ok: false };
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return { ok: true, filePath };
});
