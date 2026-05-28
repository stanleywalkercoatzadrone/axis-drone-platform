/**
 * localDatabase.js — SQLite database for local (offline) mode
 *
 * Tracks orthomosaic jobs locally when running without PostgreSQL.
 * Used when AXIS_LOCAL_MODE=true.
 *
 * Schema mirrors the cloud orthomosaic_jobs table but is minimal —
 * only the fields needed for local processing and sync.
 *
 * Database file: LOCAL_DATA_DIR/../axis-ortho.db
 *   (one level up from jobs/, so it survives job folder cleanup)
 */

import Database from 'better-sqlite3';
import path     from 'path';
import fs       from 'fs';

const DATA_DIR = process.env.LOCAL_DATA_DIR
    || path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', 'AxisOrtho', 'jobs');

const DB_PATH = path.join(path.dirname(DATA_DIR), 'axis-ortho.db');

// Ensure parent directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
    CREATE TABLE IF NOT EXISTS local_jobs (
        id              TEXT PRIMARY KEY,           -- UUID
        mission_id      TEXT,                       -- optional Axis Platform mission ID
        mission_title   TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        -- pending | uploading | processing | completed | failed | synced
        pipeline_stage  TEXT,
        progress        INTEGER DEFAULT 0,          -- 0-100
        image_count     INTEGER DEFAULT 0,
        fast_mode       INTEGER DEFAULT 0,          -- 0|1 boolean
        input_dir       TEXT NOT NULL,              -- absolute local path
        output_dir      TEXT,                       -- absolute local path (set after processing)
        orthomosaic_path TEXT,                      -- local path to orthomosaic.tif
        dsm_path        TEXT,                       -- local path to dsm.tif
        archive_path    TEXT,                       -- local path to all.zip
        error_message   TEXT,
        odm_task_id     TEXT,                       -- NodeODM task UUID
        cloud_job_id    TEXT,                       -- Axis Platform orthomosaic_jobs.id (set after sync)
        cloud_ortho_uri TEXT,                       -- GCS URI after sync
        cloud_dsm_uri   TEXT,
        cloud_archive_uri TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
        synced_at       TEXT                        -- NULL until synced to cloud
    );

    CREATE TABLE IF NOT EXISTS sync_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id      TEXT NOT NULL,
        action      TEXT NOT NULL,   -- 'upload_files' | 'notify_api' | 'complete'
        success     INTEGER,         -- 0|1
        message     TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
`);

// ── Job CRUD ──────────────────────────────────────────────────────────────────

export function createJob(data) {
    const stmt = db.prepare(`
        INSERT INTO local_jobs (id, mission_id, mission_title, status, image_count, fast_mode, input_dir)
        VALUES (@id, @mission_id, @mission_title, 'pending', @image_count, @fast_mode, @input_dir)
    `);
    stmt.run({
        id:            data.id,
        mission_id:    data.missionId    || null,
        mission_title: data.missionTitle || null,
        image_count:   data.imageCount   || 0,
        fast_mode:     data.fastMode     ? 1 : 0,
        input_dir:     data.inputDir,
    });
    return getJob(data.id);
}

export function getJob(id) {
    return db.prepare('SELECT * FROM local_jobs WHERE id = ?').get(id);
}

export function listJobs({ limit = 50, offset = 0 } = {}) {
    return db.prepare('SELECT * FROM local_jobs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
}

export function updateJob(id, fields) {
    const allowed = [
        'status', 'pipeline_stage', 'progress', 'output_dir',
        'orthomosaic_path', 'dsm_path', 'archive_path',
        'error_message', 'odm_task_id', 'cloud_job_id',
        'cloud_ortho_uri', 'cloud_dsm_uri', 'cloud_archive_uri', 'synced_at',
    ];
    const updates = Object.keys(fields)
        .filter(k => allowed.includes(k))
        .map(k => `${k} = @${k}`)
        .join(', ');

    if (!updates) return;

    db.prepare(`UPDATE local_jobs SET ${updates}, updated_at = datetime('now') WHERE id = @id`)
      .run({ ...fields, id });
}

export function getUnsyncedJobs() {
    return db.prepare(`
        SELECT * FROM local_jobs
        WHERE status = 'completed' AND synced_at IS NULL
        ORDER BY created_at ASC
    `).all();
}

export function markSynced(id, cloudData = {}) {
    db.prepare(`
        UPDATE local_jobs
        SET status = 'synced',
            synced_at = datetime('now'),
            cloud_job_id      = @cloud_job_id,
            cloud_ortho_uri   = @cloud_ortho_uri,
            cloud_dsm_uri     = @cloud_dsm_uri,
            cloud_archive_uri = @cloud_archive_uri,
            updated_at        = datetime('now')
        WHERE id = @id
    `).run({
        id,
        cloud_job_id:      cloudData.cloudJobId      || null,
        cloud_ortho_uri:   cloudData.cloudOrthoUri   || null,
        cloud_dsm_uri:     cloudData.cloudDsmUri     || null,
        cloud_archive_uri: cloudData.cloudArchiveUri || null,
    });
}

// ── Sync Log ──────────────────────────────────────────────────────────────────

export function logSync(jobId, action, success, message = null) {
    db.prepare(`
        INSERT INTO sync_log (job_id, action, success, message)
        VALUES (?, ?, ?, ?)
    `).run(jobId, action, success ? 1 : 0, message);
}

export function getSyncLog(jobId) {
    return db.prepare('SELECT * FROM sync_log WHERE job_id = ? ORDER BY created_at DESC').all(jobId);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getStats() {
    return db.prepare(`
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'completed' AND synced_at IS NULL THEN 1 ELSE 0 END) AS pending_sync,
            SUM(CASE WHEN status = 'synced'    THEN 1 ELSE 0 END) AS synced,
            SUM(CASE WHEN status = 'processing' OR status = 'uploading' THEN 1 ELSE 0 END) AS processing,
            SUM(CASE WHEN status = 'failed'    THEN 1 ELSE 0 END) AS failed
        FROM local_jobs
    `).get();
}

export default db;
