/**
 * Pilot Network Applications
 * Public: POST /api/pilot-network/apply
 * Admin:  GET  /api/pilot-network/applications
 *         PUT  /api/pilot-network/applications/:id/status
 *         POST /api/pilot-network/applications/:id/sync-profile
 */
import express from 'express';
import { query } from '../config/database.js';
import { sensitiveLimiter } from '../middleware/rateLimiter.js';
import { protect, authorize } from '../middleware/auth.js';
import { sendPilotApplicationStatusEmail } from '../services/emailService.js';

const router = express.Router();

// ── Shared helper: sync an application row → personnel profile ─────────────────
async function syncApplicationToPersonnel(app, tenantId = null) {
    // Defensive helpers — ensure all array fields are proper JS arrays
    const toArr = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string' && v.length) return v.split(',').map(s => s.trim()).filter(Boolean);
        return [];
    };
    const certifications  = toArr(app.certifications);
    const specializations = toArr(app.specializations);
    const drone_equipment = toArr(app.drone_equipment);
    const years_exp       = parseInt(app.years_exp, 10) || 0;
    const travel_km       = parseInt(app.travel_distance_km, 10) || 0;
    const thermal         = app.terrestrial_thermal === true || app.terrestrial_thermal === 'true';

    // Lookup country_id from countries table
    let countryId = null;
    if (app.country) {
        const countryRes = await query('SELECT id FROM countries WHERE iso_code = $1', [app.country]);
        if (countryRes.rows.length > 0) {
            countryId = countryRes.rows[0].id;
        }
    }

    console.log(`[pilot-network] Syncing personnel for ${app.email} | certs=${certifications.length} specs=${specializations.length} drones=${drone_equipment.length} yrs=${years_exp}`);

    // Single UPSERT — always creates or overwrites with application data
    const result = await query(`
        INSERT INTO personnel
            (full_name, email, phone, country, city, bio,
             certifications, specializations, drone_equipment,
             years_exp, portfolio_url, travel_distance_km,
             terrestrial_thermal, role, status, source, tenant_id, country_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Pilot','Active','network_application',$14,$15)
        ON CONFLICT (email) DO UPDATE SET
            full_name          = COALESCE(NULLIF(EXCLUDED.full_name,''), personnel.full_name),
            phone              = COALESCE(EXCLUDED.phone, personnel.phone),
            country            = COALESCE(EXCLUDED.country, personnel.country),
            city               = COALESCE(EXCLUDED.city, personnel.city),
            bio                = EXCLUDED.bio,
            certifications     = EXCLUDED.certifications,
            specializations    = EXCLUDED.specializations,
            drone_equipment    = EXCLUDED.drone_equipment,
            years_exp          = EXCLUDED.years_exp,
            portfolio_url      = EXCLUDED.portfolio_url,
            travel_distance_km = EXCLUDED.travel_distance_km,
            terrestrial_thermal= EXCLUDED.terrestrial_thermal,
            source             = COALESCE(personnel.source, 'network_application'),
            country_id         = COALESCE(EXCLUDED.country_id, personnel.country_id),
            updated_at         = NOW()
        RETURNING (xmax = 0) AS inserted
    `, [
        String(app.full_name || '').trim(),
        String(app.email || '').toLowerCase().trim(),
        app.phone   || null,
        app.country || null,
        app.city    || null,
        app.bio     || null,
        certifications,
        specializations,
        drone_equipment,
        years_exp,
        app.portfolio_url || null,
        travel_km,
        thermal,
        tenantId,
        countryId
    ]);

    const wasInserted = result.rows[0]?.inserted;
    const outcome = wasInserted ? 'created' : 'updated';
    console.log(`[pilot-network] Synced (${outcome}) personnel for ${app.email}`);
    return outcome;
}

// ── POST /apply — public, no auth required ────────────────────────────────────
// SECURITY: sensitiveLimiter enforces 3 submissions/hour per IP
router.post('/apply', sensitiveLimiter, async (req, res) => {
    try {
        const {
            fullName, email, phone, country, city,
            yearsExp, certifications, specializations,
            droneEquipment, bio, portfolioUrl, terrestrialThermal, travelDistanceKm
        } = req.body;

        // ── Input validation ───────────────────────────────────────────────────
        if (!fullName || !email) {
            return res.status(400).json({ success: false, message: 'Name and email are required.' });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailClean = String(email).toLowerCase().trim();
        if (!emailRegex.test(emailClean)) {
            return res.status(400).json({ success: false, message: 'Invalid email address format.' });
        }

        // Field length limits (prevent DB bloat / stored XSS)
        const fullNameClean = String(fullName).trim().slice(0, 200);
        if (fullNameClean.length < 2) {
            return res.status(400).json({ success: false, message: 'Full name must be at least 2 characters.' });
        }
        const bioClean      = bio ? String(bio).trim().slice(0, 3000) : null;
        const phoneClean    = phone ? String(phone).trim().slice(0, 30) : null;
        const cityClean     = city ? String(city).trim().slice(0, 100) : null;
        const countryClean  = country ? String(country).trim().slice(0, 100) : null;

        // URL validation for portfolio
        let urlClean = null;
        if (portfolioUrl) {
            try {
                const parsed = new URL(portfolioUrl);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') urlClean = parsed.href.slice(0, 500);
            } catch { /* invalid URL — silently drop */ }
        }

        // Array guard for all array fields
        const toArr = (v) => {
            if (Array.isArray(v)) return v.map(s => String(s).trim().slice(0, 100)).slice(0, 20);
            if (typeof v === 'string' && v.length) return v.split(',').map(s => s.trim().slice(0, 100)).filter(Boolean).slice(0, 20);
            return [];
        };

        const dup = await query(
            `SELECT id FROM pilot_network_applications WHERE email = $1 AND status = 'pending'`,
            [emailClean]
        );
        if (dup.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An application from this email is already under review.'
            });
        }

        const result = await query(`
            INSERT INTO pilot_network_applications
                (full_name, email, phone, country, city, years_exp,
                 certifications, specializations, drone_equipment, bio,
                 portfolio_url, terrestrial_thermal, travel_distance_km)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING id, created_at
        `, [
            fullNameClean,
            emailClean,
            phoneClean,
            countryClean,
            cityClean,
            parseInt(yearsExp, 10) || 0,
            toArr(certifications),
            toArr(specializations),
            toArr(droneEquipment),
            bioClean,
            urlClean,
            terrestrialThermal === true || terrestrialThermal === 'true',
            Math.max(0, Math.min(parseInt(travelDistanceKm, 10) || 0, 5000)),
        ]);

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully.',
            data: { id: result.rows[0].id }
        });
    } catch (err) {
        console.error('[pilot-network/apply]', err);
        res.status(500).json({ success: false, message: 'Failed to submit application.' });
    }
});

// ── GET /applications — admin only ────────────────────────────────────────────
router.get('/applications', protect, authorize('admin'), async (req, res) => {
    try {
        const { status, countryId } = req.query;
        const params = [];
        let whereClauses = [];

        if (status) {
            params.push(status);
            whereClauses.push(`status = $${params.length}`);
        }

        if (countryId) {
            const countryRes = await query('SELECT iso_code FROM countries WHERE id = $1', [countryId]);
            if (countryRes.rows.length > 0) {
                const isoCode = countryRes.rows[0].iso_code;
                params.push(isoCode);
                whereClauses.push(`country = $${params.length}`);
            } else {
                return res.json({ success: true, data: [] });
            }
        }

        const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const result = await query(
            `SELECT * FROM pilot_network_applications ${where} ORDER BY created_at DESC`,
            params
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[pilot-network/applications]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch applications.' });
    }
});

// ── PUT /applications/:id/status — admin only ─────────────────────────────────
router.put('/applications/:id/status', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const allowed = ['pending', 'approved', 'rejected', 'waitlisted'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        }

        await query(`
            UPDATE pilot_network_applications
            SET status = $1, admin_notes = $2, reviewed_by = $3,
                reviewed_at = NOW(), updated_at = NOW()
            WHERE id = $4
        `, [status, adminNotes || null, req.user.id, id]);

        // Fetch full application row — needed for profile sync AND notification email
        const appRes = await query(
            `SELECT * FROM pilot_network_applications WHERE id = $1`, [id]
        );
        const app = appRes.rows[0];

        if (status === 'approved' && app) {
            try {
                const tenantId = req.user?.tenantId || req.user?.tenant_id || null;
                console.log(`[pilot-network] Approving ${id}, tenantId=${tenantId}, user=${JSON.stringify(req.user?.id)}`);
                const outcome = await syncApplicationToPersonnel(app, tenantId);
                console.log(`[pilot-network] Approve sync result: ${outcome}`);
            } catch (profileErr) {
                console.error('[pilot-network] SYNC FAILED on approve:', profileErr.message, profileErr.stack?.split('\n')[1]);
            }
        }

        // Send status notification email — non-blocking, never fails the response
        if (app && app.email && ['approved', 'rejected', 'waitlisted'].includes(status)) {
            const firstName = app.first_name || app.full_name?.split(' ')[0] || 'Pilot';
            sendPilotApplicationStatusEmail({
                to: app.email,
                firstName,
                status,
                adminNotes: adminNotes || null,
            }).catch(err => {
                console.error(`[pilot-network] Status email failed for ${app.email}:`, err.message);
            });
        }

        res.json({ success: true, message: `Application ${status}.` });
    } catch (err) {
        console.error('[pilot-network/status]', err);
        res.status(500).json({ success: false, message: 'Failed to update status.' });
    }
});

// ── POST /applications/:id/sync-profile — admin only ─────────────────────────
// Force-push application data into the personnel profile regardless of status.
router.post('/applications/:id/sync-profile', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const appRes = await query(
            `SELECT * FROM pilot_network_applications WHERE id = $1`, [id]
        );
        if (!appRes.rows[0]) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }
        const outcome = await syncApplicationToPersonnel(appRes.rows[0], req.user.tenantId || null);
        res.json({
            success: true,
            message: outcome === 'created'
                ? 'Pilot profile created from application.'
                : 'Pilot profile updated with latest application data.',
            outcome
        });
    } catch (err) {
        console.error('[pilot-network/sync-profile]', err);
        res.status(500).json({ success: false, message: 'Failed to sync profile: ' + err.message });
    }
});

// ── DELETE /applications/:id — admin only ─────────────────────────────────────
router.delete('/applications/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await query(
            `DELETE FROM pilot_network_applications WHERE id = $1 RETURNING id`,
            [req.params.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }
        res.json({ success: true, message: 'Application deleted.' });
    } catch (err) {
        console.error('[pilot-network/delete]', err);
        res.status(500).json({ success: false, message: 'Failed to delete application.' });
    }
});

export default router;
