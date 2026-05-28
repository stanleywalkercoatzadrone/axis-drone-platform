/**
 * preload.js — Electron Preload Script (context bridge)
 *
 * Exposes a safe, limited API from the main process to the renderer (React)
 * AND to the setup wizard HTML page.
 *
 * All IPC calls go through this bridge — no direct Node access in renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('axisOrtho', {

    // ── Runtime (React app) ───────────────────────────────────────────────────

    /** Get current app status (online, odmPort, dataDir) */
    getStatus: () => ipcRenderer.invoke('get-status'),

    /** Trigger a manual sync to Axis Platform */
    syncNow: () => ipcRenderer.invoke('sync-now'),

    /** Open the output folder for a job in Finder/Explorer */
    openOutputDir: (jobId) => ipcRenderer.invoke('open-output-dir', jobId),

    /** Listen for sync-complete events pushed from main process */
    onSyncComplete: (callback) => {
        ipcRenderer.on('sync-complete', (_, data) => callback(data));
    },

    /** Remove sync-complete listener */
    removeSyncListener: () => {
        ipcRenderer.removeAllListeners('sync-complete');
    },

    // ── Setup Wizard (setup-wizard.html) ──────────────────────────────────────

    /** Check if Docker is running */
    checkDocker: () => ipcRenderer.invoke('wizard:check-docker'),

    /** Check if NodeODM Docker image is pulled */
    checkOdmImage: () => ipcRenderer.invoke('wizard:check-odm-image'),

    /** Get free disk space in GB */
    checkDiskSpace: () => ipcRenderer.invoke('wizard:check-disk'),

    /** Get total system RAM in MB */
    checkMemory: () => ipcRenderer.invoke('wizard:check-memory'),

    /** Open native directory chooser; returns chosen path or null */
    chooseDirectory: () => ipcRenderer.invoke('wizard:choose-directory'),

    /** Get the default data directory path */
    getDefaultDataDir: () => ipcRenderer.invoke('wizard:get-default-dir'),

    /**
     * Verify token + save setup config.
     * @param {{ token: string, dataDir: string }} config
     * @returns {{ ok: boolean, error?: string }}
     */
    saveSetup: (config) => ipcRenderer.invoke('wizard:save-setup', config),

    /** Close the wizard window and proceed to main app */
    completeSetup: () => ipcRenderer.invoke('wizard:complete'),

    /** Open a URL in the system default browser */
    openExternal: (url) => ipcRenderer.invoke('wizard:open-external', url),

    // ── Platform info ─────────────────────────────────────────────────────────
    platform:   process.platform,  // 'darwin' | 'win32' | 'linux'
    isElectron: true,
});
