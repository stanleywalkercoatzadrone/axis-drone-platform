/**
 * Sync Manager — Axis Pilot Offline Support
 *
 * Manages online/offline state detection and upload queue synchronization.
 * When the pilot device goes back online, flushes any queued uploads automatically.
 *
 * Only active when ENABLE_OFFLINE_PILOT=true (checked via environment/config).
 * Import and call initSyncManager() from PilotDashboardV2 if flag is ON.
 *
 * Events emitted to window:
 *   axis:online           — device came back online
 *   axis:offline          — device went offline
 *   axis:sync:started     — upload queue sync started
 *   axis:sync:completed   — all queued uploads processed
 *   axis:sync:failed      — sync encountered unrecoverable error
 *   axis:queue:updated    — queue size changed
 */

import { indexedDBService, QueuedUpload } from './indexedDBService';

type SyncStatus = 'idle' | 'syncing' | 'error';
type ConnectivityStatus = 'online' | 'offline';

interface SyncManagerState {
    connectivity:  ConnectivityStatus;
    syncStatus:    SyncStatus;
    queueSize:     number;
    lastSyncAt:    Date | null;
    syncError:     string | null;
}

class SyncManager {
    private state: SyncManagerState = {
        connectivity: navigator.onLine ? 'online' : 'offline',
        syncStatus:   'idle',
        queueSize:    0,
        lastSyncAt:   null,
        syncError:    null,
    };

    private listeners = new Set<(state: SyncManagerState) => void>();
    private isSyncing = false;
    private uploadEndpoint = '/api/pilot/upload-jobs'; // existing endpoint

    /** Initialize event listeners. Call once on mount. */
    async init(): Promise<void> {
        await indexedDBService.init();
        this.state.queueSize = await indexedDBService.getQueueSize();

        window.addEventListener('online',  this.handleOnline);
        window.addEventListener('offline', this.handleOffline);

        // Attempt sync on init if already online
        if (navigator.onLine) {
            this.triggerSync();
        }

        this.notify();
        console.log('[SyncManager] Initialized — connectivity:', this.state.connectivity);
    }

    /** Tear down all listeners. Call on component unmount. */
    destroy(): void {
        window.removeEventListener('online',  this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        this.listeners.clear();
    }

    /** Subscribe to state changes. Returns unsubscribe function. */
    subscribe(listener: (state: SyncManagerState) => void): () => void {
        this.listeners.add(listener);
        listener({ ...this.state }); // Emit current state immediately
        return () => this.listeners.delete(listener);
    }

    /** Current sync manager state snapshot. */
    getState(): SyncManagerState {
        return { ...this.state };
    }

    /** Queue a file for upload (called when offline or upload fails). */
    async queueUpload(params: {
        missionId:  string;
        file:       File;
        uploadType: string;
    }): Promise<string> {
        const id = await indexedDBService.queueUpload({
            missionId:  params.missionId,
            file:       params.file,
            fileName:   params.file.name,
            mimeType:   params.file.type,
            uploadType: params.uploadType,
        });

        this.state.queueSize = await indexedDBService.getQueueSize();
        this.notify();
        window.dispatchEvent(new CustomEvent('axis:queue:updated', { detail: this.state.queueSize }));

        return id;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private handleOnline = async () => {
        this.state.connectivity = 'online';
        this.notify();
        window.dispatchEvent(new CustomEvent('axis:online'));
        console.log('[SyncManager] Online — triggering sync');
        await this.triggerSync();
    };

    private handleOffline = () => {
        this.state.connectivity = 'offline';
        this.notify();
        window.dispatchEvent(new CustomEvent('axis:offline'));
        console.log('[SyncManager] Offline — uploads will be queued');
    };

    private async triggerSync(): Promise<void> {
        if (this.isSyncing || !navigator.onLine) return;
        this.isSyncing = true;
        this.state.syncStatus = 'syncing';
        this.notify();
        window.dispatchEvent(new CustomEvent('axis:sync:started'));

        try {
            const pending = await indexedDBService.getPendingUploads();
            if (pending.length === 0) {
                this.state.syncStatus = 'idle';
                this.isSyncing = false;
                this.notify();
                return;
            }

            console.log(`[SyncManager] Syncing ${pending.length} queued upload(s)`);

            let successCount = 0;
            for (const upload of pending) {
                await this.syncUpload(upload);
                successCount++;
            }

            this.state.queueSize  = await indexedDBService.getQueueSize();
            this.state.syncStatus = 'idle';
            this.state.lastSyncAt = new Date();
            this.state.syncError  = null;
            this.notify();
            window.dispatchEvent(new CustomEvent('axis:sync:completed', { detail: { synced: successCount } }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Sync failed';
            this.state.syncStatus = 'error';
            this.state.syncError  = msg;
            this.notify();
            window.dispatchEvent(new CustomEvent('axis:sync:failed', { detail: msg }));
            console.error('[SyncManager] Sync error:', msg);
        } finally {
            this.isSyncing = false;
        }
    }

    private async syncUpload(upload: QueuedUpload): Promise<void> {
        const MAX_ATTEMPTS = 3;

        if (upload.attempts >= MAX_ATTEMPTS) {
            // Give up on this upload and remove from queue
            console.warn(`[SyncManager] Upload ${upload.id} exceeded max attempts — dropping`);
            await indexedDBService.removeQueuedUpload(upload.id);
            return;
        }

        await indexedDBService.incrementUploadAttempts(upload.id);

        const formData = new FormData();
        formData.append('file',       upload.file, upload.fileName);
        formData.append('missionId',  upload.missionId);
        formData.append('uploadType', upload.uploadType);

        const response = await fetch(this.uploadEndpoint, {
            method:      'POST',
            credentials: 'include',
            body:        formData,
        });

        if (!response.ok) {
            throw new Error(`Upload server error: ${response.status}`);
        }

        // Success — remove from queue
        await indexedDBService.removeQueuedUpload(upload.id);
        console.log(`[SyncManager] Upload ${upload.id} synced successfully`);
    }

    private notify(): void {
        const snap = { ...this.state };
        this.listeners.forEach(l => {
            try { l(snap); } catch { /* listener errors don't break sync */ }
        });
    }
}

// Singleton
export const syncManager = new SyncManager();
export type { SyncManagerState, ConnectivityStatus, SyncStatus };
