/**
 * missionSessionController.js
 * Enterprise session tracking for multi-day drone inspection missions.
 * Phase 5: mission_timeline event logging added.
 * All logic is ADDITIVE — does not modify existing deployment endpoints.
 */
import * as db from '../config/database.js';

/** Phase 5: Log a mission timeline event (non-fatal) */
async function logTimelineEvent(missionId, eventType, description, sessionId = null, createdBy = null) {
    try {
        await db.query(
            `INSERT INTO mission_timeline (mission_id, event_type, description, session_id, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [missionId, eventType, description, sessionId, createdBy]
        );
    } catch (e) {
        console.warn('[timeline] log failed (non-fatal):', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sessions/:missionId  — list all sessions
// ─────────────────────────────────────────────────────────────────────────────
export const getSessions = async (req, res) => {
    try {
        const { missionId } = req.params;
        const result = await db.query(
            `SELECT s.*, u.full_name AS pilot_name
             FROM mission_work_sessions s
             LEFT JOIN users u ON u.id = s.pilot_id
             WHERE s.mission_id = $1
             ORDER BY s.session_number ASC`,
            [missionId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[sessions] getSessions error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sessions/:missionId/timeline — Phase 5
// ─────────────────────────────────────────────────────────────────────────────
export const getTimeline = async (req, res) => {
    try {
        const { missionId } = req.params;
        const result = await db.query(`
            SELECT mt.*, u.full_name as created_by_name
            FROM mission_timeline mt
            LEFT JOIN users u ON u.id = mt.created_by
            WHERE mt.mission_id = $1
            ORDER BY mt.created_at ASC
        `, [missionId]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[timeline] getTimeline error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/:missionId/start
// ─────────────────────────────────────────────────────────────────────────────
export const startSession = async (req, res) => {
    try {
        const { missionId } = req.params;
        const pilotId = req.user?.id || null;

        const missionCheck = await db.query(
            `SELECT id, mission_status_v2, total_sessions FROM deployments
             WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL OR $2 IS NULL)`,
            [missionId, req.user?.tenantId || null]
        );
        if (missionCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Mission not found' });
        }

        // Close any previously open session (safety guard)
        await db.query(
            `UPDATE mission_work_sessions
             SET end_time = now(), status = 'closed', reason_closed = 'auto-closed on new start'
             WHERE mission_id = $1 AND end_time IS NULL`,
            [missionId]
        );

        const maxRes = await db.query(
            `SELECT COALESCE(MAX(session_number), 0) AS max_num FROM mission_work_sessions WHERE mission_id = $1`,
            [missionId]
        );
        const sessionNumber = maxRes.rows[0].max_num + 1;

        const sessionRes = await db.query(
            `INSERT INTO mission_work_sessions
                (mission_id, pilot_id, session_number, session_date, start_time, status)
             VALUES ($1, $2, $3, CURRENT_DATE, now(), 'active')
             RETURNING *`,
            [missionId, pilotId, sessionNumber]
        );

        await db.query(
            `UPDATE deployments SET mission_status_v2 = 'in_progress', total_sessions = $1 WHERE id = $2`,
            [sessionNumber, missionId]
        );

        // Phase 5: timeline event
        await logTimelineEvent(missionId, 'session_started',
            `Session ${sessionNumber} started`, sessionRes.rows[0]?.id, pilotId);

        res.status(201).json({
            success: true,
            message: `Session ${sessionNumber} started`,
            data: sessionRes.rows[0]
        });
    } catch (err) {
        console.error('[sessions] startSession error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/:missionId/end
// Body: { completion_percent, notes }
// ─────────────────────────────────────────────────────────────────────────────
export const endSession = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { completion_percent = 0, notes = '' } = req.body;

        const sessionRes = await db.query(
            `UPDATE mission_work_sessions
             SET end_time = now(), status = 'completed',
                 completion_percent = $1, notes = $2
             WHERE mission_id = $3 AND end_time IS NULL
             RETURNING *`,
            [completion_percent, notes, missionId]
        );

        const totalRes = await db.query(
            `SELECT LEAST(COALESCE(SUM(completion_percent), 0), 100) AS total
             FROM mission_work_sessions WHERE mission_id = $1`,
            [missionId]
        );
        const total = parseInt(totalRes.rows[0].total, 10);
        const newStatus = total >= 100 ? 'completed' : 'partially_completed';

        await db.query(
            `UPDATE deployments
             SET mission_status_v2 = $1, completion_percent = $2, billing_status = 'ready_for_invoice'
             WHERE id = $3`,
            [newStatus, total, missionId]
        );

        // Phase 5: timeline event
        const evType = total >= 100 ? 'mission_completed' : 'session_completed';
        await logTimelineEvent(missionId, evType,
            `Session ended at ${completion_percent}% — mission total ${total}%`,
            sessionRes.rows[0]?.id, req.user?.id);

        res.json({
            success: true,
            message: `Session closed. Mission ${total}% complete.`,
            data: { session: sessionRes.rows[0] || null, missionCompletion: total, missionStatus: newStatus }
        });
    } catch (err) {
        console.error('[sessions] endSession error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/:missionId/pause-weather
// Body: { notes }
// ─────────────────────────────────────────────────────────────────────────────
export const pauseWeather = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { notes = '' } = req.body;

        const sessionRes = await db.query(
            `UPDATE mission_work_sessions
             SET end_time = now(), status = 'paused_weather',
                 weather_stop = true, reason_closed = 'weather', notes = $1
             WHERE mission_id = $2 AND end_time IS NULL
             RETURNING *`,
            [notes, missionId]
        );

        await db.query(
            `UPDATE deployments
             SET mission_status_v2 = 'awaiting_return', billing_status = 'ready_for_invoice'
             WHERE id = $1`,
            [missionId]
        );

        // Phase 5: timeline event
        await logTimelineEvent(missionId, 'weather_pause',
            'Session paused — weather conditions unsafe for flight',
            sessionRes.rows[0]?.id, req.user?.id);

        res.json({
            success: true,
            message: 'Mission paused for weather. Billing status set to ready_for_invoice.',
            data: sessionRes.rows[0] || null
        });
    } catch (err) {
        console.error('[sessions] pauseWeather error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/:missionId/resume
// ─────────────────────────────────────────────────────────────────────────────
export const resumeSession = async (req, res) => {
    try {
        const { missionId } = req.params;
        const pilotId = req.user?.id || null;

        const missionCheck = await db.query(
            `SELECT total_sessions FROM deployments
             WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL OR $2 IS NULL)`,
            [missionId, req.user?.tenantId || null]
        );
        if (missionCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Mission not found' });
        }

        const maxRes = await db.query(
            `SELECT COALESCE(MAX(session_number), 0) AS max_num FROM mission_work_sessions WHERE mission_id = $1`,
            [missionId]
        );
        const sessionNumber = maxRes.rows[0].max_num + 1;

        const sessionRes = await db.query(
            `INSERT INTO mission_work_sessions
                (mission_id, pilot_id, session_number, session_date, start_time, status)
             VALUES ($1, $2, $3, CURRENT_DATE, now(), 'active')
             RETURNING *`,
            [missionId, pilotId, sessionNumber]
        );

        await db.query(
            `UPDATE deployments SET mission_status_v2 = 'in_progress', total_sessions = $1 WHERE id = $2`,
            [sessionNumber, missionId]
        );

        // Phase 5: timeline event
        await logTimelineEvent(missionId, 'session_started',
            `Mission resumed — Session ${sessionNumber} started`,
            sessionRes.rows[0]?.id, pilotId);

        res.status(201).json({
            success: true,
            message: `Mission resumed — session ${sessionNumber} started`,
            data: sessionRes.rows[0]
        });
    } catch (err) {
        console.error('[sessions] resumeSession error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/sessions/:missionId/override  — Admin manual override
// Body: { completion_percent, billing_status, mission_status_v2 }
// ─────────────────────────────────────────────────────────────────────────────
export const adminOverride = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { completion_percent, billing_status, mission_status_v2 } = req.body;

        const fields = [];
        const vals = [];
        let idx = 1;

        if (completion_percent !== undefined) { fields.push(`completion_percent = $${idx++}`); vals.push(Number(completion_percent)); }
        if (billing_status !== undefined) { fields.push(`billing_status = $${idx++}`); vals.push(billing_status); }
        if (mission_status_v2 !== undefined) { fields.push(`mission_status_v2 = $${idx++}`); vals.push(mission_status_v2); }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        vals.push(missionId);
        const result = await db.query(
            `UPDATE deployments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, mission_status_v2, completion_percent, billing_status`,
            vals
        );

        // Phase 5: log override event
        await logTimelineEvent(missionId, 'admin_override',
            `Admin override: ${fields.join(', ')}`, null, req.user?.id);

        res.json({ success: true, message: 'Mission overridden', data: result.rows[0] });
    } catch (err) {
        console.error('[sessions] adminOverride error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/sessions/:missionId/session/:sessionId — edit individual session
// ─────────────────────────────────────────────────────────────────────────────
export const editSession = async (req, res) => {
    try {
        const { missionId, sessionId } = req.params;
        const { completion_percent, notes, billable, status, end_time, weather_stop } = req.body;

        const fields = [];
        const vals = [];
        let idx = 1;

        if (completion_percent !== undefined) { fields.push(`completion_percent = $${idx++}`); vals.push(completion_percent); }
        if (notes !== undefined)              { fields.push(`notes = $${idx++}`); vals.push(notes); }
        if (billable !== undefined)           { fields.push(`billable = $${idx++}`); vals.push(billable); }
        if (status !== undefined)             { fields.push(`status = $${idx++}`); vals.push(status); }
        if (end_time !== undefined)           { fields.push(`end_time = $${idx++}`); vals.push(end_time || null); }
        if (weather_stop !== undefined)       { fields.push(`weather_stop = $${idx++}`); vals.push(weather_stop); }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        vals.push(sessionId);
        vals.push(missionId);
        const result = await db.query(
            `UPDATE mission_work_sessions
             SET ${fields.join(', ')}
             WHERE id = $${idx++} AND mission_id = $${idx}
             RETURNING *`,
            vals
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        await logTimelineEvent(missionId, 'session_edited',
            `Session #${result.rows[0].session_number} edited: ${fields.join(', ')}`,
            sessionId, req.user?.id);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[sessions] editSession error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};
