/**
 * Enterprise AI Insurance Report Generator — Backend Controller
 * Module: /modules/ai-reporting
 * 
 * Fully isolated. Does NOT modify any existing tables or controllers.
 * Uses its own `claims_reports` table family.
 */

import { query } from '../../../backend/config/database.js';
import { AppError } from '../../../backend/middleware/errorHandler.js';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
    if (!apiKey) throw new AppError('AI not configured: GEMINI_API_KEY missing', 503);
    return new GoogleGenAI({ apiKey });
};

// Model fallback chain — tries each in order on 429/quota errors
const MODEL_CHAIN = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
];

/**
 * Calls ai.models.generateContent with automatic model fallback on quota errors.
 * Tries each model in MODEL_CHAIN; if all fail, throws the last error.
 */
const callWithFallback = async (ai, params, retryDelay = 5000) => {
    let lastErr;
    for (const model of MODEL_CHAIN) {
        try {
            return await ai.models.generateContent({ ...params, model });
        } catch (err) {
            const status = err?.status || err?.response?.status;
            const isQuota = status === 429 || (err?.message || '').includes('RESOURCE_EXHAUSTED') || (err?.message || '').includes('quota');
            if (isQuota) {
                console.warn(`⚠️  Quota exceeded on ${model}, trying next model...`);
                lastErr = err;
                // Brief pause before trying next model
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
            throw err; // Non-quota errors bubble up immediately
        }
    }
    // All models exhausted
    throw new AppError(
        'AI quota exceeded on all available models. Please upgrade your Gemini API plan at https://ai.dev/rate-limit',
        429
    );
};

// ─── MIGRATION: ensure tables exist (runs once per process) ──────────────────

let schemaReady = false;

export const ensureSchema = async () => {
    if (schemaReady) return;
    // Use a PostgreSQL advisory lock to prevent concurrent schema creation
    await query(`SELECT pg_advisory_lock(987654321)`);
    try {
        if (!schemaReady) {
            await query(`
                CREATE TABLE IF NOT EXISTS claims_reports (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id TEXT,
                    user_id UUID REFERENCES users(id),
                    title TEXT NOT NULL,
                    claim_number TEXT,
                    policy_number TEXT,
                    property_address TEXT,
                    property_type TEXT DEFAULT 'Residential',
                    inspection_type TEXT DEFAULT 'Post-Loss',
                    carrier TEXT,
                    adjuster_name TEXT,
                    adjuster_email TEXT,
                    status TEXT DEFAULT 'DRAFT',
                    approval_status TEXT DEFAULT 'Pending',
                    risk_score INTEGER DEFAULT 0,
                    total_damage_estimate NUMERIC(12,2) DEFAULT 0,
                    executive_summary TEXT,
                    recommendations TEXT[],
                    weather_data JSONB DEFAULT '{}',
                    metadata JSONB DEFAULT '{}',
                    version INTEGER DEFAULT 1,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS claims_report_images (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    report_id UUID REFERENCES claims_reports(id) ON DELETE CASCADE,
                    storage_url TEXT NOT NULL,
                    storage_key TEXT,
                    original_name TEXT,
                    image_type TEXT DEFAULT 'drone',
                    annotations JSONB DEFAULT '[]',
                    ai_summary TEXT,
                    damage_score INTEGER DEFAULT 0,
                    uploaded_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS claims_report_comments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    report_id UUID REFERENCES claims_reports(id) ON DELETE CASCADE,
                    user_id UUID REFERENCES users(id),
                    author_name TEXT,
                    author_role TEXT,
                    content TEXT NOT NULL,
                    comment_type TEXT DEFAULT 'note',
                    resolved BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS claims_report_history (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    report_id UUID REFERENCES claims_reports(id) ON DELETE CASCADE,
                    user_id UUID REFERENCES users(id),
                    action TEXT NOT NULL,
                    changes JSONB DEFAULT '{}',
                    version INTEGER,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);
            schemaReady = true;
        }
    } finally {
        await query(`SELECT pg_advisory_unlock(987654321)`).catch(() => { });
    }
};

// Kick off schema init immediately on module load (non-blocking)
ensureSchema().catch(err => console.error('[AI Reporting] Schema init error:', err));

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function fetchImageAsBase64(storageUrl) {
    if (!storageUrl.startsWith('http://') && !storageUrl.startsWith('https://')) {
        const localPath = path.join(process.cwd(), storageUrl);
        const buffer = await fs.readFile(localPath);
        const ext = path.extname(storageUrl).toLowerCase().replace('.', '');
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff' };
        return `data:${mimeMap[ext] || 'image/jpeg'};base64,${buffer.toString('base64')}`;
    }
    const res = await axios.get(storageUrl, { responseType: 'arraybuffer', timeout: 20000 });
    const ct = res.headers['content-type'] || 'image/jpeg';
    return `data:${ct};base64,${Buffer.from(res.data).toString('base64')}`;
}

function mapReport(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        title: row.title,
        claimNumber: row.claim_number,
        policyNumber: row.policy_number,
        propertyAddress: row.property_address,
        propertyType: row.property_type,
        inspectionType: row.inspection_type,
        carrier: row.carrier,
        adjusterName: row.adjuster_name,
        adjusterEmail: row.adjuster_email,
        status: row.status,
        approvalStatus: row.approval_status,
        riskScore: row.risk_score,
        totalDamageEstimate: parseFloat(row.total_damage_estimate || 0),
        executiveSummary: row.executive_summary,
        recommendations: row.recommendations || [],
        weatherData: row.weather_data || {},
        metadata: row.metadata || {},
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        images: (row.images || []).map(img => ({
            id: img.id,
            url: img.storage_url,
            storageKey: img.storage_key,
            originalName: img.original_name,
            imageType: img.image_type,
            annotations: img.annotations || [],
            aiSummary: img.ai_summary,
            damageScore: img.damage_score || 0,
            uploadedAt: img.uploaded_at
        })),
        comments: row.comments || [],
        history: row.history || [],
        authorName: row.author_name
    };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const listReports = async (req, res, next) => {
    try {
        if (!schemaReady) await ensureSchema();
        const result = await query(
            `SELECT cr.*, u.full_name as author_name,
                (SELECT COUNT(*) FROM claims_report_images WHERE report_id = cr.id)::int as image_count
             FROM claims_reports cr
             LEFT JOIN users u ON cr.user_id = u.id
             WHERE cr.tenant_id = $1
             ORDER BY cr.updated_at DESC`,
            [req.user.tenantId]
        );
        res.json({ success: true, data: result.rows.map(r => ({ ...mapReport(r), imageCount: r.image_count })) });
    } catch (err) { next(err); }
};

export const getReport = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT cr.*, u.full_name as author_name,
                (SELECT json_agg(i.* ORDER BY i.uploaded_at) FROM claims_report_images i WHERE i.report_id = cr.id) as images,
                (SELECT json_agg(c.* ORDER BY c.created_at DESC) FROM claims_report_comments c WHERE c.report_id = cr.id) as comments,
                (SELECT json_agg(h.* ORDER BY h.created_at DESC) FROM claims_report_history h WHERE h.report_id = cr.id) as history
             FROM claims_reports cr
             LEFT JOIN users u ON cr.user_id = u.id
             WHERE cr.id = $1 AND cr.tenant_id = $2`,
            [req.params.id, req.user.tenantId]
        );
        if (!result.rows.length) throw new AppError('Report not found', 404);
        res.json({ success: true, data: mapReport(result.rows[0]) });
    } catch (err) { next(err); }
};

export const createReport = async (req, res, next) => {
    try {
        if (!schemaReady) await ensureSchema();
        const {
            title, claimNumber, policyNumber, propertyAddress, propertyType,
            inspectionType, carrier, adjusterName, adjusterEmail
        } = req.body;

        const result = await query(
            `INSERT INTO claims_reports
                (tenant_id, user_id, title, claim_number, policy_number, property_address,
                 property_type, inspection_type, carrier, adjuster_name, adjuster_email)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [req.user.tenantId, req.user.id, title || 'Untitled Claim Report',
                claimNumber, policyNumber, propertyAddress,
            propertyType || 'Residential', inspectionType || 'Post-Loss',
                carrier, adjusterName, adjusterEmail]
        );

        await query(
            `INSERT INTO claims_report_history (report_id, user_id, action, version)
             VALUES ($1, $2, 'CREATED', 1)`,
            [result.rows[0].id, req.user.id]
        );

        res.status(201).json({ success: true, data: mapReport(result.rows[0]) });
    } catch (err) { next(err); }
};

export const updateReport = async (req, res, next) => {
    try {
        const {
            title, claimNumber, policyNumber, propertyAddress, propertyType,
            inspectionType, carrier, adjusterName, adjusterEmail,
            executiveSummary, recommendations, weatherData, metadata
        } = req.body;

        const result = await query(
            `UPDATE claims_reports SET
                title = COALESCE($1, title),
                claim_number = COALESCE($2, claim_number),
                policy_number = COALESCE($3, policy_number),
                property_address = COALESCE($4, property_address),
                property_type = COALESCE($5, property_type),
                inspection_type = COALESCE($6, inspection_type),
                carrier = COALESCE($7, carrier),
                adjuster_name = COALESCE($8, adjuster_name),
                adjuster_email = COALESCE($9, adjuster_email),
                executive_summary = COALESCE($10, executive_summary),
                recommendations = COALESCE($11, recommendations),
                weather_data = COALESCE($12, weather_data),
                metadata = COALESCE($13, metadata),
                updated_at = NOW()
             WHERE id = $14 AND tenant_id = $15
             RETURNING *`,
            [title, claimNumber, policyNumber, propertyAddress, propertyType,
                inspectionType, carrier, adjusterName, adjusterEmail,
                executiveSummary,
                recommendations ? `{${recommendations.map(r => `"${r.replace(/"/g, '\\"')}"`).join(',')}}` : null,
                weatherData ? JSON.stringify(weatherData) : null,
                metadata ? JSON.stringify(metadata) : null,
                req.params.id, req.user.tenantId]
        );

        if (!result.rows.length) throw new AppError('Report not found', 404);

        await query(
            `INSERT INTO claims_report_history (report_id, user_id, action, changes, version)
             VALUES ($1, $2, 'UPDATED', $3, (SELECT version FROM claims_reports WHERE id = $1))`,
            [req.params.id, req.user.id, JSON.stringify(req.body)]
        );

        res.json({ success: true, data: mapReport(result.rows[0]) });
    } catch (err) { next(err); }
};

export const deleteReport = async (req, res, next) => {
    try {
        const result = await query(
            `DELETE FROM claims_reports WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [req.params.id, req.user.tenantId]
        );
        if (!result.rows.length) throw new AppError('Report not found', 404);
        res.json({ success: true, message: 'Report deleted' });
    } catch (err) { next(err); }
};

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────

export const uploadReportImages = async (req, res, next) => {
    try {
        const { reportId, imageType = 'drone' } = req.body;
        const files = req.files || (req.file ? [req.file] : []);
        if (!files.length) throw new AppError('No files provided', 400);

        // Verify report ownership
        const rpt = await query(
            `SELECT id FROM claims_reports WHERE id = $1 AND tenant_id = $2`,
            [reportId, req.user.tenantId]
        );
        if (!rpt.rows.length) throw new AppError('Report not found', 404);

        const { uploadFile } = await import('../../../backend/services/storageService.js');
        const uploaded = [];

        for (const file of files) {
            const result = await uploadFile(file, `claims/${reportId}`);
            const row = await query(
                `INSERT INTO claims_report_images
                    (report_id, storage_url, storage_key, original_name, image_type)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [reportId, result.url, result.key, file.originalname, imageType]
            );
            uploaded.push(row.rows[0]);
        }

        res.status(201).json({ success: true, data: uploaded });
    } catch (err) { next(err); }
};

// ─── AI IMAGE ANALYSIS ────────────────────────────────────────────────────────

export const analyzeReportImage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { inspectionType = 'Post-Loss', sensitivity = 60 } = req.body;

        const imgRow = await query(
            `SELECT cri.*, cr.tenant_id, cr.inspection_type as report_inspection_type
             FROM claims_report_images cri
             JOIN claims_reports cr ON cri.report_id = cr.id
             WHERE cri.id = $1 AND cr.tenant_id = $2`,
            [id, req.user.tenantId]
        );
        if (!imgRow.rows.length) throw new AppError('Image not found', 404);

        const img = imgRow.rows[0];
        const imageData = await fetchImageAsBase64(img.storage_url);
        const ai = getAI();

        const iType = inspectionType || img.report_inspection_type || 'Post-Loss';

        const prompt = `
ACT AS: Senior Insurance Property Inspector and Claims Adjuster.
TASK: Perform a comprehensive damage assessment of this drone/ground inspection image.
INSPECTION TYPE: ${iType}
SENSITIVITY: ${sensitivity}/100

DETECT AND REPORT:
1. Roof damage: missing shingles, hail impact, wind uplift, granule loss, flashing damage
2. Structural damage: cracks, foundation issues, wall damage
3. Water intrusion: staining, mold indicators, pooling
4. Storm damage: debris, tree impact, siding damage
5. Fire/smoke damage indicators
6. Pre-existing conditions vs. storm-related damage

For each finding provide:
- Precise location description
- Severity (Low/Medium/High/Critical)
- Estimated repair cost range (USD)
- Confidence score (0.0-1.0)
- Whether it's storm-related or pre-existing
- Recommended action

Also provide:
- Overall damage score (0-100)
- Xactimate line items where applicable
- Recommended next steps
`;

        const result = await callWithFallback(ai, {
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/jpeg', data: imageData.split(',')[1] || imageData } }
                ]
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        summary: { type: 'STRING' },
                        damageScore: { type: 'NUMBER' },
                        findings: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    label: { type: 'STRING' },
                                    description: { type: 'STRING' },
                                    location: { type: 'STRING' },
                                    severity: { type: 'STRING', enum: ['Low', 'Medium', 'High', 'Critical'] },
                                    confidence: { type: 'NUMBER' },
                                    isStormRelated: { type: 'STRING', enum: ['Yes', 'No', 'Uncertain'] },
                                    estimatedCostMin: { type: 'NUMBER' },
                                    estimatedCostMax: { type: 'NUMBER' },
                                    xactimateCode: { type: 'STRING' },
                                    recommendedAction: { type: 'STRING' },
                                    x: { type: 'NUMBER' },
                                    y: { type: 'NUMBER' },
                                    width: { type: 'NUMBER' },
                                    height: { type: 'NUMBER' }
                                },
                                required: ['label', 'description', 'severity', 'confidence']
                            }
                        },
                        recommendations: { type: 'ARRAY', items: { type: 'STRING' } },
                        totalEstimatedCost: { type: 'NUMBER' }
                    },
                    required: ['summary', 'damageScore', 'findings', 'recommendations']
                }
            }
        });

        const analysis = JSON.parse(result.text || '{}');

        const annotations = (analysis.findings || []).map(f => ({
            id: uuidv4(),
            label: f.label,
            description: f.description,
            location: f.location,
            severity: f.severity,
            confidence: f.confidence,
            isStormRelated: f.isStormRelated,
            estimatedCostMin: f.estimatedCostMin || 0,
            estimatedCostMax: f.estimatedCostMax || 0,
            xactimateCode: f.xactimateCode,
            recommendedAction: f.recommendedAction,
            x: f.x ?? 10,
            y: f.y ?? 10,
            width: f.width ?? 20,
            height: f.height ?? 20,
            source: 'ai'
        }));

        await query(
            `UPDATE claims_report_images
             SET annotations = $1, ai_summary = $2, damage_score = $3
             WHERE id = $4`,
            [JSON.stringify(annotations), analysis.summary, Math.round(analysis.damageScore || 0), id]
        );

        res.json({
            success: true,
            data: {
                imageId: id,
                annotations,
                summary: analysis.summary,
                damageScore: analysis.damageScore,
                recommendations: analysis.recommendations,
                totalEstimatedCost: analysis.totalEstimatedCost
            }
        });
    } catch (err) { next(err); }
};

// ─── AI REPORT NARRATIVE ──────────────────────────────────────────────────────

export const generateNarrative = async (req, res, next) => {
    try {
        const { id } = req.params;

        const rptResult = await query(
            `SELECT cr.*, u.full_name as author_name,
                (SELECT json_agg(i.*) FROM claims_report_images i WHERE i.report_id = cr.id) as images
             FROM claims_reports cr
             LEFT JOIN users u ON cr.user_id = u.id
             WHERE cr.id = $1 AND cr.tenant_id = $2`,
            [id, req.user.tenantId]
        );
        if (!rptResult.rows.length) throw new AppError('Report not found', 404);

        const rpt = rptResult.rows[0];
        const images = rpt.images || [];
        const allFindings = images.flatMap(img =>
            (img.annotations || []).map(a => ({
                label: a.label, severity: a.severity, description: a.description,
                isStormRelated: a.isStormRelated, costMin: a.estimatedCostMin, costMax: a.estimatedCostMax
            }))
        );

        const totalMin = allFindings.reduce((s, f) => s + (f.costMin || 0), 0);
        const totalMax = allFindings.reduce((s, f) => s + (f.costMax || 0), 0);
        const criticals = allFindings.filter(f => f.severity === 'Critical').length;
        const highs = allFindings.filter(f => f.severity === 'High').length;

        const ai = getAI();
        const prompt = `
You are a senior insurance claims adjuster writing a professional, legally defensible inspection report.

PROPERTY: ${rpt.property_address || 'Unknown Address'}
CLAIM #: ${rpt.claim_number || 'N/A'}
POLICY #: ${rpt.policy_number || 'N/A'}
CARRIER: ${rpt.carrier || 'N/A'}
INSPECTION TYPE: ${rpt.inspection_type}
IMAGES ANALYZED: ${images.length}
TOTAL FINDINGS: ${allFindings.length}
CRITICAL: ${criticals} | HIGH: ${highs}
ESTIMATED DAMAGE RANGE: $${totalMin.toLocaleString()} - $${totalMax.toLocaleString()}

FINDINGS SUMMARY:
${allFindings.slice(0, 20).map((f, i) => `${i + 1}. [${f.severity}] ${f.label}: ${f.description} (Storm-related: ${f.isStormRelated || 'Unknown'})`).join('\n')}

Write:
1. A professional executive summary (4-6 sentences) suitable for an insurance carrier
2. 4-6 specific, actionable recommendations
3. An overall risk assessment (Low/Moderate/High/Severe)
4. Key coverage considerations

Respond in JSON: {
  "executiveSummary": "...",
  "recommendations": ["...", "..."],
  "riskAssessment": "High",
  "coverageConsiderations": ["...", "..."],
  "riskScore": 75
}
`;

        const result = await callWithFallback(ai, {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });

        const narrative = JSON.parse(result.text || '{}');

        // Save back to report
        await query(
            `UPDATE claims_reports SET
                executive_summary = $1,
                recommendations = $2,
                risk_score = $3,
                total_damage_estimate = $4,
                updated_at = NOW()
             WHERE id = $5`,
            [
                narrative.executiveSummary,
                narrative.recommendations ? `{${narrative.recommendations.map(r => `"${r.replace(/"/g, '\\"')}"`).join(',')}}` : '{}',
                narrative.riskScore || 0,
                (totalMin + totalMax) / 2,
                id
            ]
        );

        res.json({ success: true, data: narrative });
    } catch (err) { next(err); }
};

// ─── FINALIZE ─────────────────────────────────────────────────────────────────

export const finalizeReport = async (req, res, next) => {
    try {
        const result = await query(
            `UPDATE claims_reports SET
                status = 'FINALIZED',
                approval_status = 'Submitted',
                version = version + 1,
                updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2
             RETURNING *`,
            [req.params.id, req.user.tenantId]
        );
        if (!result.rows.length) throw new AppError('Report not found', 404);

        await query(
            `INSERT INTO claims_report_history (report_id, user_id, action, version)
             VALUES ($1, $2, 'FINALIZED', $3)`,
            [req.params.id, req.user.id, result.rows[0].version]
        );

        res.json({ success: true, data: mapReport(result.rows[0]) });
    } catch (err) { next(err); }
};

// ─── COMMENTS / COLLABORATION ─────────────────────────────────────────────────

export const addComment = async (req, res, next) => {
    try {
        const { content, commentType = 'note' } = req.body;
        if (!content?.trim()) throw new AppError('Comment content required', 400);

        const result = await query(
            `INSERT INTO claims_report_comments
                (report_id, user_id, author_name, author_role, content, comment_type)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.params.id, req.user.id, req.user.fullName || req.user.email,
            req.user.role, content.trim(), commentType]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) { next(err); }
};

export const resolveComment = async (req, res, next) => {
    try {
        await query(
            `UPDATE claims_report_comments SET resolved = TRUE WHERE id = $1`,
            [req.params.commentId]
        );
        res.json({ success: true });
    } catch (err) { next(err); }
};

// ─── APPROVAL WORKFLOW ────────────────────────────────────────────────────────

export const updateApproval = async (req, res, next) => {
    try {
        const { approvalStatus } = req.body;
        const allowed = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Needs Revision'];
        if (!allowed.includes(approvalStatus)) throw new AppError('Invalid approval status', 400);

        const result = await query(
            `UPDATE claims_reports SET approval_status = $1, updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3 RETURNING *`,
            [approvalStatus, req.params.id, req.user.tenantId]
        );
        if (!result.rows.length) throw new AppError('Report not found', 404);

        await query(
            `INSERT INTO claims_report_history (report_id, user_id, action, changes)
             VALUES ($1, $2, $3, $4)`,
            [req.params.id, req.user.id, `APPROVAL_${approvalStatus.toUpperCase().replace(' ', '_')}`,
            JSON.stringify({ approvalStatus })]
        );

        res.json({ success: true, data: mapReport(result.rows[0]) });
    } catch (err) { next(err); }
};

// ─── PORTFOLIO DASHBOARD ──────────────────────────────────────────────────────

export const getPortfolioDashboard = async (req, res, next) => {
    try {
        if (!schemaReady) await ensureSchema();
        const [stats, recentReports, riskDist] = await Promise.all([
            query(
                `SELECT
                    COUNT(*) as total_reports,
                    COUNT(*) FILTER (WHERE status = 'FINALIZED') as finalized,
                    COUNT(*) FILTER (WHERE status = 'DRAFT') as drafts,
                    COUNT(*) FILTER (WHERE approval_status = 'Approved') as approved,
                    COUNT(*) FILTER (WHERE risk_score >= 75) as high_risk,
                    COALESCE(SUM(total_damage_estimate), 0) as total_exposure,
                    COALESCE(AVG(risk_score), 0) as avg_risk_score
                 FROM claims_reports WHERE tenant_id = $1`,
                [req.user.tenantId]
            ),
            query(
                `SELECT cr.id, cr.title, cr.claim_number, cr.property_address, cr.status,
                    cr.approval_status, cr.risk_score, cr.total_damage_estimate,
                    cr.inspection_type, cr.updated_at, u.full_name as author_name
                 FROM claims_reports cr
                 LEFT JOIN users u ON cr.user_id = u.id
                 WHERE cr.tenant_id = $1
                 ORDER BY cr.updated_at DESC LIMIT 10`,
                [req.user.tenantId]
            ),
            query(
                `SELECT
                    CASE
                        WHEN risk_score >= 75 THEN 'Severe'
                        WHEN risk_score >= 50 THEN 'High'
                        WHEN risk_score >= 25 THEN 'Moderate'
                        ELSE 'Low'
                    END as risk_level,
                    COUNT(*) as count
                 FROM claims_reports WHERE tenant_id = $1
                 GROUP BY risk_level`,
                [req.user.tenantId]
            )
        ]);

        res.json({
            success: true,
            data: {
                stats: stats.rows[0],
                recentReports: recentReports.rows,
                riskDistribution: riskDist.rows
            }
        });
    } catch (err) { next(err); }
};
