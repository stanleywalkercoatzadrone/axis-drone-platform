/**
 * blockProgress.js — Solar Block Progress API
 * Phase 4 – Block Progress API
 * Phase 6 – KML Import endpoint
 * Phase 9 – Client-safe progress endpoint
 * Phase 12 – Auto block status on 100% completion
 * Phase 13 – Socket.IO events
 * Phase 14 – Redis cache
 *
 * Phase LBD-2 – LBD Unit tracking
 *
 * GET  /api/blocks/my-blocks               — Pilot: my assigned blocks + counts
 * GET  /api/blocks/:blockId/lbds           — Admin+Pilot: paginated LBD list
 * PATCH /api/blocks/lbds/:lbdId            — Admin+Pilot: update LBD unit
 * POST /api/blocks/upload                  — Admin: CSV/XLSX block import
 * GET  /api/blocks/:deploymentId         — List blocks for a mission
 * POST /api/blocks                        — Admin creates blocks
 * POST /api/blocks/:blockId/progress      — Pilot submits progress
 * PATCH /api/blocks/:blockId/status       — Admin override block status
 * GET  /api/blocks/:blockId/coverage      — Coverage analysis for one block
 * GET  /api/blocks/:deploymentId/summary  — Full deployment coverage summary
 * POST /api/blocks/import-kml             — KML block import (admin)
 */
import express from 'express';
import multer from 'multer';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { getCache, setCache, deleteCache } from '../config/redis.js';
import { analyzeDeploymentCoverage } from '../services/blockCoverageAnalyzer.js';
import { predictSiteCompletion } from '../services/blockCompletionPredictor.js';
import { importBlocksFromKML } from '../services/blockKMLImporter.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CACHE_TTL = 120;
const cacheKey = (depId) => `block-summary:${depId}`;

const bustBlockCache = async (deploymentId, io) => {
    await deleteCache(cacheKey(deploymentId)).catch(() => { });
    if (io) io.emit('block_progress_update', { deploymentId });
};

router.use(protect);

// ── GET /api/blocks/my-blocks ─────────────────────────────────────────────────
// Pilot: returns all blocks assigned to them with aggregated LBD counts
// MUST be defined before GET /:deploymentId or Express swallows it as a param
router.get('/my-blocks', async (req, res) => {
    try {
        const pilotId = req.user.id;
        const result = await query(
            `SELECT sb.*,
                    COALESCE((
                        SELECT COUNT(*) FROM lbd_units lu WHERE lu.block_id = sb.id
                    ), 0)::int                                              AS total_lbd_units,
                    COALESCE((
                        SELECT COUNT(*) FROM lbd_units lu
                        WHERE lu.block_id = sb.id AND lu.status = 'completed'
                    ), 0)::int                                              AS completed_lbds,
                    d.title                                                AS mission_title,
                    d.site_name                                            AS site_name
             FROM solar_blocks sb
             JOIN deployments d ON d.id = sb.mission_id
             WHERE sb.assigned_to = $1
             ORDER BY sb.block_name ASC`,
            [pilotId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Returns all blocks for a mission. Accessible by admin and pilot.
router.get('/:deploymentId', async (req, res) => {
    try {
        const { deploymentId } = req.params;
        const result = await query(
            `SELECT sb.*,
                    COALESCE(
                        (SELECT json_agg(row_to_json(bp))
                         FROM block_progress bp WHERE bp.block_id = sb.id),
                        '[]'
                    ) as progress_entries,
                    COALESCE((
                        SELECT COUNT(*) FROM lbd_units lu WHERE lu.block_id = sb.id
                    ), 0)::int AS total_lbd_units,
                    COALESCE((
                        SELECT COUNT(*) FROM lbd_units lu
                        WHERE lu.block_id = sb.id AND lu.status = 'completed'
                    ), 0)::int AS completed_lbds
             FROM solar_blocks sb
             WHERE sb.mission_id = $1
             ORDER BY sb.block_number ASC, sb.block_name ASC`,
            [deploymentId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/blocks/:deploymentId/summary ─────────────────────────────────────
// Full coverage summary with Redis cache (Phase 14)
router.get('/:deploymentId/summary', async (req, res) => {
    try {
        const { deploymentId } = req.params;
        const key = cacheKey(deploymentId);

        const cached = await getCache(key);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const summary = await analyzeDeploymentCoverage(deploymentId);
        await setCache(key, summary, CACHE_TTL);
        res.json({ success: true, data: summary, cached: false });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/blocks/:blockId/coverage ─────────────────────────────────────────
router.get('/:blockId/coverage', async (req, res) => {
    try {
        const { blockId } = req.params;
        const blockRes = await query(`SELECT * FROM solar_blocks WHERE id = $1`, [blockId]);
        if (!blockRes.rows.length) return res.status(404).json({ success: false, message: 'Block not found' });

        const progressRes = await query(`SELECT * FROM block_progress WHERE block_id = $1`, [blockId]);
        const { analyzeBlockCoverage } = await import('../services/blockCoverageAnalyzer.js');
        const coverage = analyzeBlockCoverage(blockRes.rows[0], progressRes.rows);
        res.json({ success: true, data: coverage });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/blocks ──────────────────────────────────────────────────────────
// Admin creates a block for a mission
router.post('/', authorize('admin'), async (req, res) => {
    try {
        const { deployment_id, block_name, block_number, acreage, latitude, longitude } = req.body;
        if (!deployment_id) return res.status(400).json({ success: false, message: 'deployment_id required' });

        const result = await query(
            `INSERT INTO solar_blocks (mission_id, block_name, block_number, acreage, latitude, longitude)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [deployment_id, block_name, block_number || null, acreage || null, latitude || null, longitude || null]
        );

        const { io } = await import('../app.js');
        io?.emit('block_added', { deploymentId: deployment_id, block: result.rows[0] });
        await bustBlockCache(deployment_id, io);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/blocks/:blockId/progress ────────────────────────────────────────
// Pilot submits progress for a block
router.post('/:blockId/progress', async (req, res) => {
    try {
        const { blockId } = req.params;
        const pilotId = req.user.id;
        const { acres_completed, inspection_type, flight_hours, images_collected, data_uploaded, completed_at } = req.body;

        // Verify block exists
        const blockRes = await query(`SELECT * FROM solar_blocks WHERE id = $1`, [blockId]);
        if (!blockRes.rows.length) return res.status(404).json({ success: false, message: 'Block not found' });
        const block = blockRes.rows[0];

        // Insert progress
        const progressResult = await query(
            `INSERT INTO block_progress
                (block_id, pilot_id, mission_id, acres_completed, inspection_type,
                 flight_hours, images_collected, data_uploaded, completed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                blockId, pilotId, block.deployment_id,
                acres_completed || 0, inspection_type || 'visual',
                flight_hours || 0, images_collected || 0,
                data_uploaded || false,
                completed_at || null,
            ]
        );

        // Phase 12: Auto-complete block if 100% coverage
        const progressRows = await query(`SELECT * FROM block_progress WHERE block_id = $1`, [blockId]);
        const totalAcresLogged = progressRows.rows.reduce((s, p) => s + parseFloat(p.acres_completed || 0), 0);
        const blockAcreage = parseFloat(block.acreage) || 0;

        if (blockAcreage > 0 && totalAcresLogged >= blockAcreage) {
            await query(
                `UPDATE solar_blocks SET status = 'completed', updated_at = NOW() WHERE id = $1 AND status != 'completed'`,
                [blockId]
            );
            // Phase 13: emit block_completed event
            try {
                const { io } = await import('../app.js');
                io?.emit('block_completed', { blockId, deploymentId: block.deployment_id });
            } catch { /* optional */ }
        } else {
            // Set in_progress
            await query(
                `UPDATE solar_blocks SET status = 'in_progress', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
                [blockId]
            );
        }

        // Phase 13+14: emit update, bust cache
        try {
            const { io } = await import('../app.js');
            await bustBlockCache(block.deployment_id, io);
        } catch { /* optional */ }

        res.status(201).json({ success: true, data: progressResult.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH /api/blocks/:blockId/status ─────────────────────────────────────────
// Admin manually overrides block status (Phase 4, always takes priority)
router.patch('/:blockId/status', authorize('admin'), async (req, res) => {
    try {
        const { blockId } = req.params;
        const { status } = req.body;
        const valid = ['pending', 'in_progress', 'completed', 'skipped'];
        if (!valid.includes(status)) return res.status(400).json({ success: false, message: `status must be one of: ${valid.join(', ')}` });

        const result = await query(
            `UPDATE solar_blocks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, blockId]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Block not found' });

        // Bust cache + emit
        try {
            const { io } = await import('../app.js');
            await bustBlockCache(result.rows[0].deployment_id, io);
        } catch { /* optional */ }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH /api/blocks/:blockId/assign ─────────────────────────────────────────
// Admin assigns (or unassigns) a pilot to a block
router.patch('/:blockId/assign', authorize('admin'), async (req, res) => {
    try {
        const { blockId } = req.params;
        const { assigned_to } = req.body; // UUID or null/empty string to unassign

        const assignedTo = assigned_to || null; // treat empty string as unassign

        const result = await query(
            `UPDATE solar_blocks SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [assignedTo, blockId]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Block not found' });

        try {
            const { io } = await import('../app.js');
            await bustBlockCache(result.rows[0].mission_id, io);
        } catch { /* optional */ }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/blocks/import-kml ───────────────────────────────────────────────
// Admin imports blocks from KML file (Phase 6)
router.post('/import-kml', authorize('admin'), upload.single('kml'), async (req, res) => {
    try {
        const { deployment_id } = req.body;
        if (!deployment_id) return res.status(400).json({ success: false, message: 'deployment_id required' });
        if (!req.file) return res.status(400).json({ success: false, message: 'KML file required' });

        const kmlContent = req.file.buffer.toString('utf-8');
        const result = await importBlocksFromKML(deployment_id, kmlContent);

        try {
            const { io } = await import('../app.js');
            io?.emit('block_added', { deploymentId: deployment_id, count: result.created });
            await bustBlockCache(deployment_id, io);
        } catch { /* optional */ }

        res.json({ success: true, created: result.created, blocks: result.blocks });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/blocks/:deploymentId/predict ─────────────────────────────────────
// Completion prediction
router.get('/:deploymentId/predict', async (req, res) => {
    try {
        const { deploymentId } = req.params;
        const prediction = await predictSiteCompletion(deploymentId);
        res.json({ success: true, data: prediction });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/blocks/upload ──────────────────────────────────────────────────
// Admin: CSV or XLSX block sheet import → creates solar_blocks + lbd_units
router.post('/upload', authorize('admin'), upload.single('file'), async (req, res) => {
    try {
        const { deployment_id } = req.body;
        if (!deployment_id) return res.status(400).json({ success: false, message: 'deployment_id required' });
        if (!req.file)      return res.status(400).json({ success: false, message: 'File required (csv or xlsx)' });

        const { default: ExcelJS } = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const ext = (req.file.originalname || '').toLowerCase();
        const isCSV = ext.endsWith('.csv') || req.file.mimetype === 'text/csv';

        if (isCSV) {
            const { Readable } = await import('stream');
            await workbook.csv.read(Readable.from(req.file.buffer));
        } else {
            await workbook.xlsx.load(req.file.buffer);
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) return res.status(400).json({ success: false, message: 'No sheet found in file' });

        // ── Cell value helpers ─────────────────────────────────────────────────
        const unwrap = (v) => {
            if (v !== null && typeof v === 'object' && !Array.isArray(v) && 'result' in v) return v.result;
            return v;
        };
        const cellNum = (cell) => {
            const v = unwrap(cell.value);
            if (v === null || v === undefined || v === '') return 0;
            const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
            return isFinite(n) && n > 0 ? Math.round(n) : 0;
        };
        const cellStr = (cell) => {
            const v = unwrap(cell.value);
            return (v === null || v === undefined) ? '' : String(v).trim();
        };
        // Does a given column actually contain numeric data in rows 2-6?
        const colHasNumbers = (col) => {
            for (let r = 2; r <= Math.min(6, worksheet.rowCount); r++) {
                if (cellNum(worksheet.getRow(r).getCell(col)) > 0) return true;
            }
            return false;
        };

        // ── Step 1: keyword header detection ─────────────────────────────────
        const headerRow = worksheet.getRow(1);
        const headers = { block: null, count: null, assign: null };
        const headerNames = {};
        headerRow.eachCell((cell, col) => {
            const v = String(cell.value ?? '').toLowerCase().trim();
            headerNames[col] = String(cell.value ?? '');
            if (!headers.block &&
                (v.includes('block') || v.includes('name') || v.includes('section') || v.includes('zone')) &&
                !v.match(/count|qty|num|#|total|lbd|unit|panel|module|string|inverter|pcs/)) {
                headers.block = col;
            }
            if (v.match(/count|lbd|total|qty|num|#|unit|panel|module|string|inverter|pcs|quantity/)) {
                headers.count = col;
            }
            if (v.match(/assign|pilot|tech|oper|user/)) {
                headers.assign = col;
            }
        });

        // ── Step 2: validate — if chosen count col has no data, reset ─────────
        if (headers.count && !colHasNumbers(headers.count)) {
            headers.count = null;
        }

        // ── Step 3: data-driven scan — find column with actual numeric data ───
        if (!headers.count) {
            const totalCols = worksheet.columnCount || 10;
            for (let c = 1; c <= totalCols; c++) {
                if (c === headers.block) continue;
                if (colHasNumbers(c)) { headers.count = c; break; }
            }
        }

        const headerSummary = Object.entries(headerNames).map(([c, h]) => `col${c}="${h}"`).join(', ');
        if (!headers.block || !headers.count) {
            const sample = [];
            for (let c = 1; c <= Math.min(6, worksheet.columnCount || 6); c++) {
                sample.push(`col${c}=${JSON.stringify(worksheet.getRow(2).getCell(c).value)}`);
            }
            return res.status(400).json({
                success: false,
                message: `Could not auto-detect columns. Headers: [${headerSummary}]. Row 2 data: [${sample.join(', ')}]. Rename your count column to "LBD Count".`
            });
        }

        const created = [], skipped = [], errors = [];

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const blockName   = cellStr(row.getCell(headers.block));
            const totalLbds   = cellNum(row.getCell(headers.count));
            const assignedRaw = headers.assign ? cellStr(row.getCell(headers.assign)) : '';
            if (!blockName) continue;

            if (totalLbds <= 0) {
                const rawVal = row.getCell(headers.count).value;
                errors.push(`Row ${i}: invalid LBD count for block "${blockName}" (raw value: ${JSON.stringify(rawVal)})`);
                continue;
            }

            // Resolve assigned user by name or email
            let assignedTo = null;
            if (assignedRaw) {
                const uRes = await query(
                    `SELECT id FROM users WHERE LOWER(full_name) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1`,
                    [assignedRaw]
                );
                if (uRes.rows.length) assignedTo = uRes.rows[0].id;
            }

            // Skip if block_name already exists for this deployment
            // Use mission_id (guaranteed column) — deployment_id may not exist yet on first run
            const existing = await query(
                `SELECT id FROM solar_blocks WHERE mission_id = $1 AND block_name = $2`,
                [deployment_id, blockName]
            );
            if (existing.rows.length > 0) { skipped.push(blockName); continue; }


            // INSERT — write mission_id (original column) + deployment_id (new column, may not exist yet)
            // We try the full insert first; if deployment_id column doesn't exist yet, fall back to mission_id only
            let blockRes;
            try {
                blockRes = await query(
                    `INSERT INTO solar_blocks (mission_id, deployment_id, block_name, total_lbds, assigned_to, status)
                     VALUES ($1, $1, $2, $3, $4, 'not_started') RETURNING id`,
                    [deployment_id, blockName, totalLbds, assignedTo]
                );
            } catch (insertErr) {
                if (insertErr.message.includes('deployment_id')) {
                    // deployment_id column not yet added by migration — use mission_id only
                    blockRes = await query(
                        `INSERT INTO solar_blocks (mission_id, block_name, total_lbds, assigned_to, status)
                         VALUES ($1, $2, $3, $4, 'not_started') RETURNING id`,
                        [deployment_id, blockName, totalLbds, assignedTo]
                    );
                } else {
                    throw insertErr;
                }
            }

            const blockId = blockRes.rows[0].id;

            // Generate lbd_units: "Block A1-001" → "Block A1-NNN"
            const pad = Math.max(3, String(totalLbds).length);
            const unitInserts = [];
            for (let n = 1; n <= totalLbds; n++) {
                const code = `${blockName}-${String(n).padStart(pad, '0')}`;
                unitInserts.push(query(
                    `INSERT INTO lbd_units (block_id, lbd_code, lbd_number) VALUES ($1, $2, $3) ON CONFLICT (block_id, lbd_code) DO NOTHING`,
                    [blockId, code, n]
                ));
            }
            await Promise.all(unitInserts);
            created.push({ blockName, totalLbds, blockId });
        }

        // Bust cache + emit event
        try {
            const { io } = await import('../app.js');
            io?.emit('block_added', { deploymentId: deployment_id, count: created.length });
            await bustBlockCache(deployment_id, io);
        } catch { /* optional */ }

        res.json({
            success: true,
            message: `${created.length} block(s) imported, ${skipped.length} skipped, ${errors.length} error(s)`,
            created, skipped, errors
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/blocks/:blockId/lbds ─────────────────────────────────────────────
// Admin + Pilot: paginated LBD unit list for a block
// RBAC: pilots can only see LBDs in blocks assigned to them
router.get('/:blockId/lbds', async (req, res) => {
    try {
        const { blockId } = req.params;
        const page  = Math.max(1, parseInt(req.query.page  || '1'));
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100')));
        const offset = (page - 1) * limit;
        const role = req.user.role;

        // RBAC: pilot may only see their assigned blocks
        const blockRes = await query(`SELECT * FROM solar_blocks WHERE id = $1`, [blockId]);
        if (!blockRes.rows.length) return res.status(404).json({ success: false, message: 'Block not found' });
        const block = blockRes.rows[0];
        if (role === 'pilot' && String(block.assigned_to) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [unitsRes, countRes] = await Promise.all([
            query(
                `SELECT lu.*, u.full_name AS uploaded_by_name
                 FROM lbd_units lu
                 LEFT JOIN users u ON u.id = lu.uploaded_by
                 WHERE lu.block_id = $1
                 ORDER BY lu.lbd_number ASC
                 LIMIT $2 OFFSET $3`,
                [blockId, limit, offset]
            ),
            query(`SELECT COUNT(*) FROM lbd_units WHERE block_id = $1`, [blockId])
        ]);

        const total = parseInt(countRes.rows[0].count);
        res.json({
            success: true,
            data: unitsRes.rows,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            block
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH /api/blocks/lbds/:lbdId ─────────────────────────────────────────────
// Admin + Pilot: update an LBD unit; auto-syncs parent block status
router.patch('/lbds/:lbdId', async (req, res) => {
    try {
        const { lbdId } = req.params;
        const { status, notes, thermal_flag, file_urls } = req.body;
        const role = req.user.role;

        // Validate
        const validStatus = ['pending', 'completed', 'issue'];
        if (status && !validStatus.includes(status)) {
            return res.status(400).json({ success: false, message: `status must be one of: ${validStatus.join(', ')}` });
        }

        // Fetch the LBD + its parent block for RBAC
        const lbdRes = await query(
            `SELECT lu.*, sb.mission_id AS deployment_id, sb.assigned_to, sb.total_lbds, sb.block_name
             FROM lbd_units lu
             JOIN solar_blocks sb ON sb.id = lu.block_id
             WHERE lu.id = $1`,
            [lbdId]
        );
        if (!lbdRes.rows.length) return res.status(404).json({ success: false, message: 'LBD unit not found' });
        const lbd = lbdRes.rows[0];

        // RBAC: pilot may only update LBDs in their own assigned blocks
        if (role === 'pilot' && String(lbd.assigned_to) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Build update
        const sets = [], vals = [];
        let idx = 1;
        if (status !== undefined)       { sets.push(`status = $${idx++}`);       vals.push(status); }
        if (notes !== undefined)        { sets.push(`notes = $${idx++}`);         vals.push(notes); }
        if (thermal_flag !== undefined) { sets.push(`thermal_flag = $${idx++}`);  vals.push(thermal_flag); }
        if (file_urls !== undefined)    { sets.push(`file_urls = $${idx++}`);     vals.push(JSON.stringify(file_urls)); }
        if (status === 'completed')     {
            sets.push(`uploaded_by = $${idx++}`, `uploaded_at = NOW()`);
            vals.push(req.user.id);
        }
        if (!sets.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
        vals.push(lbdId);

        const updated = await query(
            `UPDATE lbd_units SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            vals
        );

        // Auto-sync parent block status based on LBD counts
        const agg = await query(
            `SELECT
                COUNT(*) FILTER (WHERE status = 'completed') AS done,
                COUNT(*) AS total
             FROM lbd_units WHERE block_id = $1`,
            [lbd.block_id]
        );
        const done  = parseInt(agg.rows[0].done);
        const total = parseInt(agg.rows[0].total);
        let blockStatus = 'not_started';
        if (done > 0 && done < total) blockStatus = 'in_progress';
        if (done >= total && total > 0) blockStatus = 'completed';

        await query(
            `UPDATE solar_blocks SET status = $1, updated_at = NOW() WHERE id = $2`,
            [blockStatus, lbd.block_id]
        );

        // Emit real-time lbd_updated event
        try {
            const { io } = await import('../app.js');
            io?.emit('lbd_updated', {
                block_id:    lbd.block_id,
                lbd_id:      lbdId,
                deployment_id: lbd.deployment_id,
                counts:      { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 },
                blockStatus
            });
            await bustBlockCache(lbd.deployment_id, io);
        } catch { /* optional */ }

        res.json({ success: true, data: updated.rows[0], blockStatus, counts: { done, total } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
