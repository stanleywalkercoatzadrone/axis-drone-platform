#!/usr/bin/env node
/**
 * recover_odm_outputs.js
 *
 * One-time recovery script: finds all completed orthomosaic_jobs whose
 * engine_job_id maps to a completed NodeODM task, downloads the all.zip
 * from NodeODM, saves it to GCS, and records it in orthomosaic_outputs.
 *
 * Run: node backend/scripts/recover_odm_outputs.js
 */
import 'dotenv/config';
import pg from 'pg';
import { Storage } from '@google-cloud/storage';

const ODM_URL      = process.env.ODM_URL || 'http://35.185.234.59:3000';
const GCS_BUCKET   = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const gcs  = new Storage({ projectId: process.env.GCS_PROJECT_ID || 'axis-platform-484701' });

async function run() {
    // Find completed jobs that have an engine_job_id but no outputs recorded
    const { rows: jobs } = await pool.query(`
        SELECT j.id, j.tenant_id, j.engine_job_id
        FROM orthomosaic_jobs j
        LEFT JOIN orthomosaic_outputs o ON o.job_id = j.id
        WHERE j.status = 'completed'
          AND j.engine_job_id IS NOT NULL
          AND j.engine_job_id NOT LIKE 'mock-%'
          AND o.id IS NULL
        ORDER BY j.created_at ASC
    `);

    console.log(`Found ${jobs.length} completed job(s) with no outputs.`);
    if (jobs.length === 0) { await pool.end(); return; }

    for (const job of jobs) {
        const odmTaskId = job.engine_job_id;
        console.log(`\nProcessing job ${job.id} → ODM task ${odmTaskId}`);

        // Verify ODM task is actually completed
        let taskInfo;
        try {
            const r = await fetch(`${ODM_URL}/task/${odmTaskId}/info`);
            taskInfo = await r.json();
        } catch (err) {
            console.error(`  ✗ Could not reach NodeODM: ${err.message}`);
            continue;
        }

        if (taskInfo?.status?.code !== 40) {
            console.log(`  ⚠ ODM task status=${taskInfo?.status?.code} — skipping (not completed)`);
            continue;
        }

        const outputs = [];

        // ── 1. Download all.zip ───────────────────────────────────────────────
        const archiveUrl = `${ODM_URL}/task/${odmTaskId}/download/all.zip`;
        try {
            console.log(`  ↓ Downloading all.zip from NodeODM…`);
            const headRes = await fetch(archiveUrl, { method: 'HEAD' });
            if (!headRes.ok) throw new Error(`HEAD ${headRes.status}`);

            const zipRes = await fetch(archiveUrl);
            if (!zipRes.ok) throw new Error(`GET ${zipRes.status}`);

            const buf = Buffer.from(await zipRes.arrayBuffer());
            const gcsPath = `orthomosaic/outputs/${odmTaskId}/all.zip`;
            await gcs.bucket(GCS_BUCKET).file(gcsPath).save(buf, {
                contentType: 'application/zip',
                metadata: { cacheControl: 'no-cache' },
            });
            console.log(`  ✓ Saved all.zip → gs://${GCS_BUCKET}/${gcsPath} (${Math.round(buf.length / 1e6)}MB)`);
            outputs.push({ type: 'archive', filename: 'all.zip', gcsPath, sizeBytes: buf.length });
        } catch (err) {
            console.error(`  ✗ all.zip: ${err.message}`);
            // Still record the direct ODM URL so downloads work
            outputs.push({
                type: 'archive', filename: 'all.zip',
                gcsPath: archiveUrl, sizeBytes: null,
            });
        }

        // ── 2. Try downloading orthomosaic.tif ───────────────────────────────
        for (const { asset, type, name } of [
            { asset: 'odm_orthophoto/odm_orthophoto.tif', type: 'orthomosaic', name: 'orthomosaic.tif' },
            { asset: 'odm_dem/dsm.tif', type: 'dsm', name: 'dsm.tif' },
        ]) {
            try {
                const url = `${ODM_URL}/task/${odmTaskId}/download/${asset}`;
                const h = await fetch(url, { method: 'HEAD' });
                if (!h.ok) { console.log(`  ⚠ ${name} not available (${h.status})`); continue; }

                console.log(`  ↓ Downloading ${name}…`);
                const r = await fetch(url);
                const buf = Buffer.from(await r.arrayBuffer());
                const gcsPath = `orthomosaic/outputs/${odmTaskId}/${name}`;
                await gcs.bucket(GCS_BUCKET).file(gcsPath).save(buf, { contentType: 'image/tiff' });
                console.log(`  ✓ Saved ${name} → gs://${GCS_BUCKET}/${gcsPath} (${Math.round(buf.length / 1e6)}MB)`);
                outputs.push({ type, filename: name, gcsPath, sizeBytes: buf.length });
            } catch (err) {
                console.log(`  ⚠ ${name}: ${err.message}`);
            }
        }

        // ── 3. Insert outputs into DB ─────────────────────────────────────────
        for (const out of outputs) {
            await pool.query(
                `INSERT INTO orthomosaic_outputs
                     (job_id, tenant_id, output_type, file_name, gcs_path, file_size_bytes, metadata)
                 SELECT $1, tenant_id, $2, $3, $4, $5, '{}'::jsonb
                 FROM orthomosaic_jobs WHERE id = $1
                 ON CONFLICT DO NOTHING`,
                [job.id, out.type, out.filename, out.gcsPath, out.sizeBytes]
            );
        }
        console.log(`  ✓ Recorded ${outputs.length} output(s) for job ${job.id}`);
    }

    await pool.end();
    console.log('\n✅ Recovery complete.');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
