import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query as dbQuery } from '../config/database.js';

const router = Router();

// ── Auto-migration ────────────────────────────────────────────────────────────
try {
    await dbQuery(`
        CREATE TABLE IF NOT EXISTS marketing_leads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            company_name TEXT NOT NULL,
            contact_name TEXT,
            contact_email TEXT,
            phone TEXT,
            industry TEXT NOT NULL,
            sub_category TEXT,
            location TEXT,
            state TEXT,
            status TEXT DEFAULT 'new',
            lead_type TEXT DEFAULT 'prospect',
            discount_code TEXT,
            discount_percent NUMERIC,
            notes TEXT,
            tags TEXT[],
            last_contacted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS marketing_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            name TEXT NOT NULL,
            subject TEXT NOT NULL,
            body_html TEXT NOT NULL,
            category TEXT DEFAULT 'outreach',
            variables TEXT[],
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS marketing_outreach_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            lead_id UUID REFERENCES marketing_leads(id) ON DELETE SET NULL,
            template_id UUID,
            recipient_email TEXT NOT NULL,
            recipient_name TEXT,
            subject TEXT NOT NULL,
            body_html TEXT NOT NULL,
            status TEXT DEFAULT 'sent',
            sent_at TIMESTAMPTZ DEFAULT NOW(),
            opened_at TIMESTAMPTZ,
            error_message TEXT
        )
    `);

    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mktg_leads_industry ON marketing_leads(industry)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mktg_leads_status ON marketing_leads(status)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mktg_leads_tenant ON marketing_leads(tenant_id)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mktg_logs_lead ON marketing_outreach_logs(lead_id)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mktg_logs_tenant ON marketing_outreach_logs(tenant_id)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mktg_logs_sent ON marketing_outreach_logs(sent_at DESC)`);

    console.log('✅ Marketing Hub: tables + indexes ready');

    // ── Seed default templates ────────────────────────────────────────────────
    const emailHeader = `
        <div style="background: linear-gradient(135deg, #0a1628 0%, #1a2a4a 100%); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; font-size: 24px; letter-spacing: 1px;">
                CoatzaDrone USA
            </h1>
            <p style="color: #7eb8da; font-family: 'Segoe UI', Arial, sans-serif; margin: 6px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">
                Enterprise Drone Inspection Services
            </p>
        </div>`;

    const emailFooter = `
        <div style="background: #f4f6f8; padding: 24px; text-align: center; border-top: 1px solid #e0e4e8;">
            <p style="color: #6b7280; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; margin: 0 0 8px;">
                CoatzaDrone USA &bull; Enterprise Drone Inspection &amp; Analytics
            </p>
            <p style="color: #9ca3af; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; margin: 0;">
                This email was sent by CoatzaDrone USA. If you received this in error, please disregard.
            </p>
        </div>`;

    const bodyStyle = `style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #1f2937; line-height: 1.7; padding: 32px 24px; background: #ffffff;"`;

    const seedTemplates = [
        {
            name: 'Drone Inspection Services',
            subject: 'Partner with CoatzaDrone USA for Enterprise Drone Inspections',
            category: 'outreach',
            variables: ['company_name', 'contact_name', 'industry'],
            body_html: `<div style="max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${emailHeader}
                <div ${bodyStyle}>
                    <p>Dear {{contact_name}},</p>
                    <p>I'm reaching out from <strong>CoatzaDrone USA</strong> to introduce our enterprise-grade drone inspection services tailored for the <strong>{{industry}}</strong> industry.</p>
                    <p>Our platform delivers:</p>
                    <ul style="padding-left: 20px;">
                        <li>High-resolution aerial imaging with AI-powered defect detection</li>
                        <li>Automated reporting with actionable insights</li>
                        <li>FAA Part 107 certified pilots with industry-specific training</li>
                        <li>Real-time mission tracking and client portal access</li>
                    </ul>
                    <p>We'd love to discuss how CoatzaDrone USA can help <strong>{{company_name}}</strong> reduce inspection costs by up to 60% while improving accuracy and safety.</p>
                    <p>Would you be available for a brief 15-minute call this week?</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>CoatzaDrone USA Sales Team</strong></p>
                </div>
                ${emailFooter}
            </div>`
        },
        {
            name: 'Solar Panel Inspection',
            subject: 'Thermal Drone Inspections for {{company_name}} Solar Assets',
            category: 'outreach',
            variables: ['company_name', 'contact_name', 'industry'],
            body_html: `<div style="max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${emailHeader}
                <div ${bodyStyle}>
                    <p>Dear {{contact_name}},</p>
                    <p>Solar assets require regular thermal inspections to identify hotspots, micro-cracks, and underperforming modules before they impact your bottom line.</p>
                    <p><strong>CoatzaDrone USA</strong> specializes in large-scale solar farm inspections with:</p>
                    <ul style="padding-left: 20px;">
                        <li>Dual-sensor thermal + RGB imaging at up to 2,000 acres/day</li>
                        <li>AI-powered fault classification (hotspots, string failures, bypass diode faults)</li>
                        <li>Block-by-block progress tracking with our LBD module</li>
                        <li>Energy loss estimation and prioritized maintenance reports</li>
                    </ul>
                    <p>We currently serve some of the largest solar operators in Texas and would welcome the opportunity to support <strong>{{company_name}}</strong>'s inspection needs.</p>
                    <p>Can we schedule a demo of our Solar Farm Intelligence Platform?</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>CoatzaDrone USA Solar Division</strong></p>
                </div>
                ${emailFooter}
            </div>`
        },
        {
            name: 'Insurance Claims Assessment',
            subject: 'Accelerate Claims with Aerial Drone Inspections — {{company_name}}',
            category: 'outreach',
            variables: ['company_name', 'contact_name', 'industry'],
            body_html: `<div style="max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${emailHeader}
                <div ${bodyStyle}>
                    <p>Dear {{contact_name}},</p>
                    <p>In the insurance industry, speed and accuracy in claims assessment can make all the difference. <strong>CoatzaDrone USA</strong> partners with insurance providers to deliver rapid, evidence-based aerial inspections.</p>
                    <p>Our insurance inspection services include:</p>
                    <ul style="padding-left: 20px;">
                        <li>Roof and property damage assessment within 24–48 hours of a claim</li>
                        <li>High-resolution orthomosaic maps for precise damage documentation</li>
                        <li>Court-admissible photographic evidence packages</li>
                        <li>Secure client portal for adjusters and underwriters</li>
                    </ul>
                    <p>We help carriers like <strong>{{company_name}}</strong> reduce cycle times, lower adjuster risk, and improve policyholder satisfaction.</p>
                    <p>I'd love to share a case study — are you available for a quick call?</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>CoatzaDrone USA Insurance Services</strong></p>
                </div>
                ${emailFooter}
            </div>`
        },
        {
            name: 'Construction Site Monitoring',
            subject: 'Drone-Powered Construction Monitoring for {{company_name}}',
            category: 'outreach',
            variables: ['company_name', 'contact_name', 'industry'],
            body_html: `<div style="max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${emailHeader}
                <div ${bodyStyle}>
                    <p>Dear {{contact_name}},</p>
                    <p>Managing construction site progress across multiple projects is challenging. <strong>CoatzaDrone USA</strong> provides automated aerial monitoring that keeps your team informed in real time.</p>
                    <p>Our construction services deliver:</p>
                    <ul style="padding-left: 20px;">
                        <li>Weekly or bi-weekly aerial progress captures with orthomosaic mapping</li>
                        <li>Volumetric measurements for earthwork and stockpile tracking</li>
                        <li>Safety compliance monitoring with before/after comparisons</li>
                        <li>Stakeholder-ready visual reports with annotated evidence</li>
                    </ul>
                    <p>We work with general contractors, developers, and project managers to bring transparency and accountability to every phase of construction.</p>
                    <p>Let's discuss how we can support <strong>{{company_name}}</strong>'s active projects.</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>CoatzaDrone USA Construction Division</strong></p>
                </div>
                ${emailFooter}
            </div>`
        },
        {
            name: 'Telecom Tower Inspection',
            subject: 'Safe & Efficient Telecom Tower Inspections — {{company_name}}',
            category: 'outreach',
            variables: ['company_name', 'contact_name', 'industry'],
            body_html: `<div style="max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${emailHeader}
                <div ${bodyStyle}>
                    <p>Dear {{contact_name}},</p>
                    <p>Tower climbs are costly, time-consuming, and carry inherent safety risks. <strong>CoatzaDrone USA</strong> offers a smarter alternative with our drone-powered telecom tower inspection program.</p>
                    <p>Our telecom services include:</p>
                    <ul style="padding-left: 20px;">
                        <li>360° tower inspections without climber deployment</li>
                        <li>Equipment condition reports (antennas, cables, mounts, structural elements)</li>
                        <li>Pre- and post-installation documentation for 5G rollouts</li>
                        <li>AI-assisted anomaly detection for corrosion, damage, and misalignment</li>
                    </ul>
                    <p>We help telecom companies like <strong>{{company_name}}</strong> cut inspection costs by up to 50% while eliminating safety incidents.</p>
                    <p>Would you be open to a demo or pilot project?</p>
                    <p style="margin-top: 24px;">Best regards,<br><strong>CoatzaDrone USA Telecom Division</strong></p>
                </div>
                ${emailFooter}
            </div>`
        }
    ];

    for (const t of seedTemplates) {
        await dbQuery(
            `INSERT INTO marketing_templates (name, subject, body_html, category, variables)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [t.name, t.subject, t.body_html, t.category, t.variables]
        );
    }

    console.log('✅ Marketing Hub: default templates seeded');
} catch (migrationErr) {
    console.error('⚠ Marketing Hub migration (non-fatal):', migrationErr.message);
}

// ── Email service (optional) ──────────────────────────────────────────────────
let sendEmail = null;
try {
    const emailMod = await import('../services/emailService.js');
    sendEmail = emailMod.sendEmail;
} catch {
    console.warn('⚠ Marketing Hub: emailService not available — send will simulate only');
}

// All routes require authentication
router.use(protect);

// ── Leads ─────────────────────────────────────────────────────────────────────

// GET /leads — List leads with optional filters
router.get('/leads', async (req, res) => {
    try {
        const { industry, status, type, search } = req.query;
        const conditions = ['tenant_id = $1'];
        const params = [req.user.tenantId];

        if (industry) {
            params.push(industry);
            conditions.push(`industry = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }
        if (type) {
            params.push(type);
            conditions.push(`lead_type = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(company_name ILIKE $${params.length} OR contact_name ILIKE $${params.length} OR contact_email ILIKE $${params.length})`);
        }

        const r = await dbQuery(
            `SELECT * FROM marketing_leads
             WHERE ${conditions.join(' AND ')}
             ORDER BY created_at DESC`,
            params
        );
        res.json({ success: true, data: r.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /leads/:id — Get single lead
router.get('/leads/:id', async (req, res) => {
    try {
        const r = await dbQuery(
            `SELECT * FROM marketing_leads WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, req.user.tenantId]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Lead not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /leads — Create lead
router.post('/leads', authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    const { company_name, contact_name, contact_email, phone, industry, sub_category,
            location, state, status, lead_type, discount_code, discount_percent, notes, tags } = req.body;

    if (!company_name || !industry) {
        return res.status(400).json({ success: false, error: 'company_name and industry are required' });
    }

    try {
        const r = await dbQuery(
            `INSERT INTO marketing_leads
                (tenant_id, company_name, contact_name, contact_email, phone, industry, sub_category,
                 location, state, status, lead_type, discount_code, discount_percent, notes, tags)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             RETURNING *`,
            [req.user.tenantId, company_name, contact_name || null, contact_email || null,
             phone || null, industry, sub_category || null, location || null, state || null,
             status || 'new', lead_type || 'prospect', discount_code || null,
             discount_percent || null, notes || null, tags || null]
        );
        res.status(201).json({ success: true, data: r.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// PUT /leads/:id — Update lead
router.put('/leads/:id', authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    const { company_name, contact_name, contact_email, phone, industry, sub_category,
            location, state, status, lead_type, discount_code, discount_percent, notes, tags,
            last_contacted_at } = req.body;

    try {
        const r = await dbQuery(
            `UPDATE marketing_leads SET
                company_name      = COALESCE($1, company_name),
                contact_name      = COALESCE($2, contact_name),
                contact_email     = COALESCE($3, contact_email),
                phone             = COALESCE($4, phone),
                industry          = COALESCE($5, industry),
                sub_category      = COALESCE($6, sub_category),
                location          = COALESCE($7, location),
                state             = COALESCE($8, state),
                status            = COALESCE($9, status),
                lead_type         = COALESCE($10, lead_type),
                discount_code     = COALESCE($11, discount_code),
                discount_percent  = COALESCE($12, discount_percent),
                notes             = COALESCE($13, notes),
                tags              = COALESCE($14, tags),
                last_contacted_at = COALESCE($15, last_contacted_at),
                updated_at        = NOW()
             WHERE id = $16 AND tenant_id = $17
             RETURNING *`,
            [company_name, contact_name, contact_email, phone, industry, sub_category,
             location, state, status, lead_type, discount_code, discount_percent,
             notes, tags, last_contacted_at || null, req.params.id, req.user.tenantId]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Lead not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// DELETE /leads/:id — Delete lead
router.delete('/leads/:id', authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    try {
        const r = await dbQuery(
            `DELETE FROM marketing_leads WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [req.params.id, req.user.tenantId]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Lead not found' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /leads/bulk — Bulk create leads
router.post('/leads/bulk', authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    const { leads } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ success: false, error: 'leads array is required' });
    }

    try {
        const created = [];
        for (const lead of leads) {
            if (!lead.company_name || !lead.industry) continue;
            const r = await dbQuery(
                `INSERT INTO marketing_leads
                    (tenant_id, company_name, contact_name, contact_email, phone, industry, sub_category,
                     location, state, status, lead_type, discount_code, discount_percent, notes, tags)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                 RETURNING *`,
                [req.user.tenantId, lead.company_name, lead.contact_name || null,
                 lead.contact_email || null, lead.phone || null, lead.industry,
                 lead.sub_category || null, lead.location || null, lead.state || null,
                 lead.status || 'new', lead.lead_type || 'prospect',
                 lead.discount_code || null, lead.discount_percent || null,
                 lead.notes || null, lead.tags || null]
            );
            created.push(r.rows[0]);
        }
        res.status(201).json({ success: true, data: created, count: created.length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Templates ─────────────────────────────────────────────────────────────────

// GET /templates — List templates
router.get('/templates', async (req, res) => {
    try {
        const r = await dbQuery(
            `SELECT * FROM marketing_templates
             WHERE tenant_id = $1 OR tenant_id IS NULL
             ORDER BY name`,
            [req.user.tenantId]
        );
        res.json({ success: true, data: r.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /templates — Create template
router.post('/templates', authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    const { name, subject, body_html, category, variables } = req.body;
    if (!name || !subject || !body_html) {
        return res.status(400).json({ success: false, error: 'name, subject, and body_html are required' });
    }

    try {
        const r = await dbQuery(
            `INSERT INTO marketing_templates (tenant_id, name, subject, body_html, category, variables)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING *`,
            [req.user.tenantId, name, subject, body_html, category || 'outreach', variables || null]
        );
        res.json({ success: true, data: r.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// PUT /templates/:id — Update template
router.put('/templates/:id', authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    const { name, subject, body_html, category, variables } = req.body;
    try {
        const r = await dbQuery(
            `UPDATE marketing_templates SET
                name      = COALESCE($1, name),
                subject   = COALESCE($2, subject),
                body_html = COALESCE($3, body_html),
                category  = COALESCE($4, category),
                variables = COALESCE($5, variables)
             WHERE id = $6 AND (tenant_id = $7 OR tenant_id IS NULL)
             RETURNING *`,
            [name, subject, body_html, category, variables, req.params.id, req.user.tenantId]
        );
        if (!r.rows.length) return res.status(404).json({ success: false, error: 'Template not found' });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Send / Simulate ───────────────────────────────────────────────────────────

// POST /send — Send or simulate an outreach email
router.post('/send', authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    const { leadId, templateId, subject, bodyHtml, simulate = true } = req.body;

    if (!subject || !bodyHtml) {
        return res.status(400).json({ success: false, error: 'subject and bodyHtml are required' });
    }

    try {
        // Fetch lead details if provided
        let recipientEmail = req.body.recipientEmail;
        let recipientName = req.body.recipientName;

        if (leadId) {
            const lead = await dbQuery(
                `SELECT * FROM marketing_leads WHERE id = $1 AND tenant_id = $2`,
                [leadId, req.user.tenantId]
            );
            if (lead.rows.length) {
                recipientEmail = recipientEmail || lead.rows[0].contact_email;
                recipientName = recipientName || lead.rows[0].contact_name;
            }
        }

        if (!recipientEmail) {
            return res.status(400).json({ success: false, error: 'recipientEmail is required (either in body or from lead)' });
        }

        let emailStatus = 'simulated';
        let errorMessage = null;

        if (!simulate) {
            if (sendEmail) {
                try {
                    await sendEmail(recipientEmail, subject, bodyHtml);
                    emailStatus = 'sent';
                } catch (emailErr) {
                    console.error('[marketing/send] Email send failed:', emailErr.message);
                    emailStatus = 'failed';
                    errorMessage = emailErr.message;
                }
            } else {
                console.warn('[marketing/send] Email service not available — logging as failed');
                emailStatus = 'failed';
                errorMessage = 'Email service not configured';
            }
        }

        // Log the outreach
        const log = await dbQuery(
            `INSERT INTO marketing_outreach_logs
                (tenant_id, lead_id, template_id, recipient_email, recipient_name, subject, body_html, status, error_message)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [req.user.tenantId, leadId || null, templateId || null, recipientEmail,
             recipientName || null, subject, bodyHtml, emailStatus, errorMessage]
        );

        // Update lead last_contacted_at if applicable
        if (leadId && emailStatus !== 'failed') {
            await dbQuery(
                `UPDATE marketing_leads SET last_contacted_at = NOW(), status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END, updated_at = NOW()
                 WHERE id = $1 AND tenant_id = $2`,
                [leadId, req.user.tenantId]
            );
        }

        res.json({ success: true, data: log.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Outreach Logs ─────────────────────────────────────────────────────────────

// GET /logs — Get outreach logs with pagination
router.get('/logs', async (req, res) => {
    try {
        const { page = 1, limit = 50, status } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = ['ol.tenant_id = $1'];
        const params = [req.user.tenantId];

        if (status) {
            params.push(status);
            conditions.push(`ol.status = $${params.length}`);
        }

        params.push(parseInt(limit), offset);

        const r = await dbQuery(
            `SELECT ol.*,
                    ml.company_name AS lead_company,
                    ml.industry AS lead_industry,
                    mt.name AS template_name
             FROM marketing_outreach_logs ol
             LEFT JOIN marketing_leads ml ON ml.id = ol.lead_id
             LEFT JOIN marketing_templates mt ON mt.id = ol.template_id
             WHERE ${conditions.join(' AND ')}
             ORDER BY ol.sent_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const countParams = params.slice(0, -2);
        const countRes = await dbQuery(
            `SELECT COUNT(*) FROM marketing_outreach_logs ol WHERE ${conditions.join(' AND ')}`,
            countParams
        );

        res.json({
            success: true,
            data: r.rows,
            total: parseInt(countRes.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Stats ─────────────────────────────────────────────────────────────────────

// GET /stats — Dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        // Leads by industry
        const leadsByIndustry = await dbQuery(
            `SELECT industry, COUNT(*) as count FROM marketing_leads
             WHERE tenant_id = $1 GROUP BY industry ORDER BY count DESC`,
            [tenantId]
        );

        // Leads by status
        const leadsByStatus = await dbQuery(
            `SELECT status, COUNT(*) as count FROM marketing_leads
             WHERE tenant_id = $1 GROUP BY status ORDER BY count DESC`,
            [tenantId]
        );

        // Total leads
        const totalLeads = await dbQuery(
            `SELECT COUNT(*) as count FROM marketing_leads WHERE tenant_id = $1`,
            [tenantId]
        );

        // Outreach stats
        const outreachStats = await dbQuery(
            `SELECT status, COUNT(*) as count FROM marketing_outreach_logs
             WHERE tenant_id = $1 GROUP BY status`,
            [tenantId]
        );

        // Conversion rate (leads with status 'converted' / total leads)
        const convertedCount = await dbQuery(
            `SELECT COUNT(*) as count FROM marketing_leads
             WHERE tenant_id = $1 AND status = 'converted'`,
            [tenantId]
        );

        const total = parseInt(totalLeads.rows[0]?.count || 0);
        const converted = parseInt(convertedCount.rows[0]?.count || 0);
        const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';

        // Outreach breakdown
        const outreachMap = {};
        for (const row of outreachStats.rows) {
            outreachMap[row.status] = parseInt(row.count);
        }

        res.json({
            success: true,
            data: {
                totalLeads: total,
                leadsByIndustry: leadsByIndustry.rows,
                leadsByStatus: leadsByStatus.rows,
                totalSent: outreachMap.sent || 0,
                totalSimulated: outreachMap.simulated || 0,
                totalFailed: outreachMap.failed || 0,
                totalOpened: outreachMap.opened || 0,
                conversionRate: parseFloat(conversionRate),
                convertedLeads: converted
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
