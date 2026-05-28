/**
 * main.js — Axis Ortho Electron Main Process
 *
 * Responsibilities:
 *  1. First-run setup wizard (Docker check, keytar token, data dir)
 *  2. Start NodeODM Docker container
 *  3. Start the local Express backend on port 58080
 *  4. Open Electron main window → http://localhost:58080
 *  5. Monitor network connectivity → trigger sync when online
 *  6. Tray icon with live status (offline / syncing / synced)
 */

const {
    app, BrowserWindow, Tray, Menu, nativeImage,
    dialog, ipcMain, shell
} = require('electron');
const { spawn, execSync, spawnSync } = require('child_process');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');
const fetch = require('node-fetch');

// ── Constants ─────────────────────────────────────────────────────────────────

const BACKEND_PORT  = 58080;
const ODM_PORT      = 58000;   // local NodeODM Docker port
const ODM_IMAGE     = 'opendronemap/nodeodm:latest';
const ODM_CONTAINER = 'axis-ortho-odm';
const DEV_MODE      = process.env.NODE_ENV === 'development';
const KEYCHAIN_SVC  = 'app.axisplatform.ortho';
const KEYCHAIN_ACC  = 'axis-sync-token';
const SETUP_FLAG    = path.join(app.getPath('userData'), '.setup-complete');

let mainWindow   = null;
let wizardWindow = null;
let tray         = null;
let backendProc  = null;
let syncInterval = null;
let isOnline     = false;
let dataDir      = path.join(os.homedir(), 'AxisOrtho');

// ── Keytar (lazy-load — native module) ───────────────────────────────────────

let keytar = null;
function getKeytar() {
    if (!keytar) {
        try { keytar = require('keytar'); } catch { /* optional */ }
    }
    return keytar;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    // Load data dir preference if previously saved
    const prefFile = path.join(app.getPath('userData'), 'prefs.json');
    if (fs.existsSync(prefFile)) {
        try {
            const prefs = JSON.parse(fs.readFileSync(prefFile, 'utf8'));
            if (prefs.dataDir) dataDir = prefs.dataDir;
        } catch {}
    }

    // First run? → show setup wizard, then continue
    const needsSetup = !fs.existsSync(SETUP_FLAG);
    if (needsSetup) {
        await showWizard();  // resolves when wizard completes
    }

    // 1. Ensure Docker + ODM running
    const dockerOk = await checkDocker();
    if (!dockerOk) return;
    await ensureOdmContainer();

    // 2. Start backend
    startBackend();
    await waitForBackend();

    // 3. Main window
    createWindow();

    // 4. Tray
    createTray();

    // 5. Sync monitor
    startSyncMonitor();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
    if (syncInterval) clearInterval(syncInterval);
    if (backendProc)  backendProc.kill();
});

// ── Setup Wizard ──────────────────────────────────────────────────────────────

function showWizard() {
    return new Promise((resolve) => {
        wizardWindow = new BrowserWindow({
            width:           560,
            height:          680,
            resizable:       false,
            center:          true,
            frame:           false,         // frameless — wizard has custom chrome
            titleBarStyle:   'hidden',
            backgroundColor: '#060d1a',
            show:            false,
            webPreferences: {
                preload:          path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration:  false,
            },
        });

        wizardWindow.loadFile(path.join(__dirname, 'setup-wizard.html'));
        wizardWindow.once('ready-to-show', () => wizardWindow.show());
        wizardWindow.on('closed', () => {
            wizardWindow = null;
            resolve();
        });
    });
}

// Called from wizard when setup is complete
async function completeSetup(token, chosenDataDir) {
    // Save token to OS keychain
    if (token) {
        const kt = getKeytar();
        if (kt) await kt.setPassword(KEYCHAIN_SVC, KEYCHAIN_ACC, token);
    }

    // Save data directory preference
    if (chosenDataDir) {
        dataDir = chosenDataDir;
        fs.mkdirSync(dataDir, { recursive: true });
        const prefFile = path.join(app.getPath('userData'), 'prefs.json');
        fs.writeFileSync(prefFile, JSON.stringify({ dataDir }, null, 2));
    }

    // Mark setup complete
    fs.writeFileSync(SETUP_FLAG, new Date().toISOString());

    if (wizardWindow) wizardWindow.close();
}

// ── Docker & ODM ──────────────────────────────────────────────────────────────

async function checkDocker() {
    try {
        execSync('docker info', { stdio: 'pipe' });
        return true;
    } catch {
        const { response } = await dialog.showMessageBox({
            type:      'error',
            title:     'Docker Required',
            message:   'Axis Ortho requires Docker to process drone images.',
            detail:    'Install Docker Desktop and make sure it is running, then relaunch Axis Ortho.',
            buttons:   ['Open Docker Website', 'Quit'],
            defaultId: 0,
        });
        if (response === 0) shell.openExternal('https://www.docker.com/products/docker-desktop/');
        app.quit();
        return false;
    }
}

async function ensureOdmContainer() {
    try {
        const running = execSync(
            `docker ps --filter name=${ODM_CONTAINER} --format "{{.Names}}"`,
            { encoding: 'utf8' }
        ).trim();

        if (running === ODM_CONTAINER) {
            console.log('[ODM] Container already running.');
            return;
        }

        const exists = execSync(
            `docker ps -a --filter name=${ODM_CONTAINER} --format "{{.Names}}"`,
            { encoding: 'utf8' }
        ).trim();

        if (exists === ODM_CONTAINER) {
            console.log('[ODM] Restarting existing container…');
            execSync(`docker start ${ODM_CONTAINER}`, { stdio: 'pipe' });
        } else {
            console.log('[ODM] Pulling and starting NodeODM…');
            execSync(
                `docker run -d --name ${ODM_CONTAINER} -p ${ODM_PORT}:3000 --restart unless-stopped ${ODM_IMAGE}`,
                { stdio: 'inherit' }
            );
        }

        // Wait up to 60s for NodeODM to be ready
        for (let i = 0; i < 30; i++) {
            try {
                const res = await fetch(`http://localhost:${ODM_PORT}/info`, { timeout: 2000 });
                if (res.ok) { console.log('[ODM] NodeODM ready.'); return; }
            } catch {}
            await sleep(2000);
        }
        console.warn('[ODM] NodeODM did not respond in time — proceeding anyway.');
    } catch (err) {
        console.error('[ODM] Failed to start container:', err.message);
        dialog.showErrorBox('ODM Error', `Could not start the processing engine:\n${err.message}`);
    }
}

// ── Backend ───────────────────────────────────────────────────────────────────

function startBackend() {
    const backendPath = DEV_MODE
        ? path.join(__dirname, '..', 'backend', 'server.js')
        : path.join(process.resourcesPath, 'backend', 'server.js');

    const env = {
        ...process.env,
        PORT:            String(BACKEND_PORT),
        AXIS_LOCAL_MODE: 'true',
        ODM_URL:         `http://localhost:${ODM_PORT}`,
        NODE_ENV:        'production',
        LOCAL_DATA_DIR:  path.join(dataDir, 'jobs'),
    };

    backendProc = spawn('node', [backendPath], { env, stdio: 'inherit' });
    backendProc.on('error', (err) => console.error('[Backend]', err.message));
    backendProc.on('exit',  (code) => console.log(`[Backend] exited ${code}`));
    console.log(`[Backend] Started on port ${BACKEND_PORT}`);
}

async function waitForBackend(retries = 20) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(`http://localhost:${BACKEND_PORT}/health`, { timeout: 2000 });
            if (res.ok) { console.log('[Backend] Ready.'); return; }
        } catch {}
        await sleep(1000);
    }
    console.warn('[Backend] Did not respond in time — loading anyway.');
}

// ── Main Window ───────────────────────────────────────────────────────────────

function createWindow() {
    mainWindow = new BrowserWindow({
        width:        1400,
        height:       900,
        minWidth:     1000,
        minHeight:    700,
        title:        'Axis Ortho',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        backgroundColor: '#0f172a',
        icon:         path.join(__dirname, 'assets', 'icon.icns'),
        webPreferences: {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
        },
    });

    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
    if (DEV_MODE) mainWindow.webContents.openDevTools();
    mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    updateTray('idle');
}

function updateTray(status) {
    if (!tray) return;
    const labels = {
        idle:    '⚫ Offline',
        syncing: '🔄 Syncing…',
        synced:  '✅ Synced',
        error:   '❌ Sync Error',
    };
    const menu = Menu.buildFromTemplate([
        { label: 'Axis Ortho', enabled: false },
        { label: labels[status] || status, enabled: false },
        { type: 'separator' },
        { label: 'Open',     click: () => mainWindow ? mainWindow.focus() : createWindow() },
        { label: 'Sync Now', click: () => triggerSync() },
        { type: 'separator' },
        { label: 'Quit',     click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
    tray.setToolTip(`Axis Ortho — ${labels[status] || status}`);
}

// ── Sync Monitor ──────────────────────────────────────────────────────────────

function startSyncMonitor() {
    syncInterval = setInterval(async () => {
        const online = await checkConnectivity();
        if (online && !isOnline) { isOnline = true; triggerSync(); }
        else if (!online) { isOnline = false; updateTray('idle'); }
    }, 30_000);

    // Initial check
    checkConnectivity().then(online => {
        if (online) { isOnline = true; triggerSync(); }
    });
}

async function checkConnectivity() {
    try {
        const res = await fetch('https://axisplatform.app/health', { timeout: 5000 });
        return res.ok;
    } catch {
        try { await fetch('https://dns.google', { timeout: 3000 }); return true; } catch {}
        return false;
    }
}

async function triggerSync() {
    try {
        updateTray('syncing');
        const res  = await fetch(`http://localhost:${BACKEND_PORT}/api/local/sync`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 120_000,
        });
        const data = await res.json().catch(() => ({}));
        updateTray(data.success ? 'synced' : 'error');
        if (mainWindow) mainWindow.webContents.send('sync-complete', data);
    } catch (err) {
        console.error('[Sync] Failed:', err.message);
        updateTray('error');
    }
}

// ── IPC: Wizard handlers ──────────────────────────────────────────────────────

// Check if Docker is running
ipcMain.handle('wizard:check-docker', async () => {
    try { execSync('docker info', { stdio: 'pipe' }); return true; }
    catch { return false; }
});

// Check if NodeODM image is pulled
ipcMain.handle('wizard:check-odm-image', async () => {
    try {
        const out = execSync(`docker images ${ODM_IMAGE} --format "{{.Repository}}"`, { encoding: 'utf8' }).trim();
        return out.includes('opendronemap');
    } catch { return false; }
});

// Check free disk space (returns GB)
ipcMain.handle('wizard:check-disk', async () => {
    try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
            const out = execSync(`df -k "${os.homedir()}"`, { encoding: 'utf8' });
            const line = out.split('\n')[1];
            const parts = line.trim().split(/\s+/);
            const freeKb = parseInt(parts[3], 10);
            return Math.round(freeKb / 1024 / 1024 * 10) / 10; // GB
        }
        return null;
    } catch { return null; }
});

// Check total system memory (returns MB)
ipcMain.handle('wizard:check-memory', async () => {
    return Math.round(os.totalmem() / 1024 / 1024);
});

// Open directory chooser dialog
ipcMain.handle('wizard:choose-directory', async () => {
    const result = await dialog.showOpenDialog(wizardWindow, {
        title:       'Choose Data Directory',
        defaultPath: path.join(os.homedir(), 'AxisOrtho'),
        properties:  ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
});

// Get default data dir
ipcMain.handle('wizard:get-default-dir', () => {
    return path.join(os.homedir(), 'AxisOrtho');
});

// Verify token against Axis Platform API + save to keychain
ipcMain.handle('wizard:save-setup', async (_, { token, dataDir: dir }) => {
    // Verify token hits the Axis API
    try {
        const res = await fetch('https://axisplatform.app/api/auth/verify-desktop-token', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            timeout: 10_000,
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { ok: false, error: body.message || `Invalid token (${res.status})` };
        }
    } catch {
        // If we can't reach the API (offline), accept the token and validate on first sync
        console.warn('[Setup] Offline — saving token without online verification.');
    }

    await completeSetup(token, dir);
    return { ok: true };
});

// Complete setup and close wizard
ipcMain.handle('wizard:complete', async () => {
    if (wizardWindow) wizardWindow.close();
});

// Open external URL from wizard
ipcMain.handle('wizard:open-external', async (_, url) => {
    shell.openExternal(url);
});

// ── IPC: Runtime handlers ─────────────────────────────────────────────────────

ipcMain.handle('get-status', async () => ({
    online:  isOnline,
    odmPort: ODM_PORT,
    dataDir,
}));

ipcMain.handle('sync-now', async () => {
    await triggerSync();
});

ipcMain.handle('open-output-dir', async (_, jobId) => {
    const dir = path.join(dataDir, 'jobs', jobId, 'output');
    shell.openPath(dir);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
