/**
 * IndexedDB Service — Axis Pilot Offline Support
 *
 * Manages a local IndexedDB database for offline-first pilot operations.
 * Only active when ENABLE_OFFLINE_PILOT env flag is true (checked at runtime).
 *
 * Database: axis-pilot-offline  v1
 * Stores:
 *   - missions        (cached mission list for field reference)
 *   - checklists      (cached work items / checklists per mission)
 *   - uploadQueue     (queued uploads to sync when back online)
 */

const DB_NAME    = 'axis-pilot-offline';
const DB_VERSION = 1;

interface CachedMission {
    id: string;
    title: string;
    status: string;
    siteName: string;
    date: string;
    cachedAt: number;
    [key: string]: unknown;
}

interface CachedChecklist {
    id: string;
    missionId: string;
    title: string;
    items: unknown[];
    cachedAt: number;
}

interface QueuedUpload {
    id: string;
    missionId: string;
    file: File;
    fileName: string;
    mimeType: string;
    uploadType: string;
    queuedAt: number;
    attempts: number;
}

class IndexedDBService {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    /** Initialize (or upgrade) the IndexedDB instance. Idempotent. */
    async init(): Promise<void> {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains('missions')) {
                    const ms = db.createObjectStore('missions', { keyPath: 'id' });
                    ms.createIndex('cachedAt', 'cachedAt');
                }

                if (!db.objectStoreNames.contains('checklists')) {
                    const cs = db.createObjectStore('checklists', { keyPath: 'id' });
                    cs.createIndex('missionId', 'missionId');
                }

                if (!db.objectStoreNames.contains('uploadQueue')) {
                    const uq = db.createObjectStore('uploadQueue', { keyPath: 'id' });
                    uq.createIndex('queuedAt', 'queuedAt');
                    uq.createIndex('missionId', 'missionId');
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };

            request.onerror = (event) => {
                console.error('[IndexedDB] Open failed:', (event.target as IDBOpenDBRequest).error);
                reject((event.target as IDBOpenDBRequest).error);
            };
        });

        return this.initPromise;
    }

    private async getStore(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
        await this.init();
        if (!this.db) throw new Error('IndexedDB not available');
        return this.db.transaction(name, mode).objectStore(name);
    }

    private idbRequest<T>(req: IDBRequest<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
    }

    // ── Missions ────────────────────────────────────────────────────

    async cacheMissions(missions: CachedMission[]): Promise<void> {
        const store = await this.getStore('missions', 'readwrite');
        const ts    = Date.now();
        for (const m of missions) {
            await this.idbRequest(store.put({ ...m, cachedAt: ts }));
        }
    }

    async getCachedMissions(): Promise<CachedMission[]> {
        const store = await this.getStore('missions', 'readonly');
        return this.idbRequest<CachedMission[]>(store.getAll());
    }

    async clearMissionCache(): Promise<void> {
        const store = await this.getStore('missions', 'readwrite');
        await this.idbRequest(store.clear());
    }

    // ── Checklists ──────────────────────────────────────────────────

    async cacheChecklist(checklist: CachedChecklist): Promise<void> {
        const store = await this.getStore('checklists', 'readwrite');
        await this.idbRequest(store.put({ ...checklist, cachedAt: Date.now() }));
    }

    async getCachedChecklists(missionId: string): Promise<CachedChecklist[]> {
        const store = await this.getStore('checklists', 'readonly');
        const index = store.index('missionId');
        return this.idbRequest<CachedChecklist[]>(index.getAll(missionId));
    }

    // ── Upload Queue ────────────────────────────────────────────────

    async queueUpload(upload: Omit<QueuedUpload, 'id' | 'queuedAt' | 'attempts'>): Promise<string> {
        const id    = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const entry: QueuedUpload = { ...upload, id, queuedAt: Date.now(), attempts: 0 };
        const store = await this.getStore('uploadQueue', 'readwrite');
        await this.idbRequest(store.put(entry));
        return id;
    }

    async getPendingUploads(): Promise<QueuedUpload[]> {
        const store = await this.getStore('uploadQueue', 'readonly');
        return this.idbRequest<QueuedUpload[]>(store.getAll());
    }

    async removeQueuedUpload(id: string): Promise<void> {
        const store = await this.getStore('uploadQueue', 'readwrite');
        await this.idbRequest(store.delete(id));
    }

    async incrementUploadAttempts(id: string): Promise<void> {
        const store = await this.getStore('uploadQueue', 'readwrite');
        const entry = await this.idbRequest<QueuedUpload>(store.get(id));
        if (entry) {
            entry.attempts += 1;
            await this.idbRequest(store.put(entry));
        }
    }

    async getQueueSize(): Promise<number> {
        const store = await this.getStore('uploadQueue', 'readonly');
        return this.idbRequest<number>(store.count());
    }

    /** Destroy the entire offline database. For logout / data wipe. */
    async destroy(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.initPromise = null;
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = () => resolve();
            req.onerror   = () => reject(req.error);
        });
    }
}

// Singleton instance
export const indexedDBService = new IndexedDBService();
export type { CachedMission, CachedChecklist, QueuedUpload };
