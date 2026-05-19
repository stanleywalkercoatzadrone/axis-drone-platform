/**
 * uploadProcessor.js — Auto-Processing Engine
 *
 * Triggered immediately after a file lands in storage.
 * Pipeline:
 *   1. Gemini Vision AI  → per-image fault/anomaly detection
 *      - GCS URI mode  : uses fileData { fileUri: 'gs://...' } — no size limit
 *      - Inline fallback: uses inlineData base64 for non-GCS files (<20MB)
 *   2. Pix4D Cloud API   → photogrammetry dispatch for aerial datasets (optional)
 *   3. DB update         → status, ai_result, pix4d_job_id
 *   4. Socket.io emit    → real-time status to connected clients
 *
 * Designed to be called fire-and-forget (never awaited by the HTTP handler).
 */
import { query } from '../config/database.js';
import { logger } from './logger.js';
import { analyzeSolarImage, preprocessImage } from './solarAnalysisEngine.js';
// ── Gemini Vision client ──────────────────────────────────────────────────────
// Uses @google/genai (newer SDK) which supports the fileData/GCS URI part type.
let genAI = null;
let GoogleGenAI = null;

try {
    const mod = await import('@google/genai');
    GoogleGenAI = mod.GoogleGenAI;
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (key) {
        genAI = new GoogleGenAI({ apiKey: key });
        logger.info('[uploadProcessor] Gemini AI initialized (GCS URI + inline fallback)');
    } else {
        logger.warn('[uploadProcessor] No GEMINI_API_KEY — AI analysis disabled');
    }
} catch (e) {
    // Fallback to legacy SDK
    try {
        const mod2 = await import('@google/generative-ai');
        const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (key && mod2.GoogleGenerativeAI) {
            genAI = { _legacy: new mod2.GoogleGenerativeAI(key) };
            logger.info('[uploadProcessor] Gemini AI initialized (legacy SDK, inline only)');
        }
    } catch (e2) {
        logger.warn('[uploadProcessor] Gemini import failed:', e2.message);
    }
}

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';
const INLINE_LIMIT_BYTES = 20 * 1024 * 1024; // 20 MB

// Orthomosaic photogrammetry is handled by the dedicated AxisEngine pipeline
// (orthomosaicQueue.js + photogrammetryEngine.js). No secondary Pix4D dispatch here.

// ── Build prompt per analysis/upload type ────────────────────────────────────
// All prompts embed US safety standards zero-shot (OSHA, NEC, IEC 62446, ASTM, ASCE)
// Gemini requires no additional training for these standards.
function buildPrompt(uploadType, analysisType) {
    const at = analysisType || uploadType;

    // ── THERMAL / IR IMAGE ──────────────────────────────────────────────────
    if (at === 'thermal_fault' || at === 'thermal') {
        return `You are a certified thermal imaging inspector with deep expertise in IEC 62446-3 (thermographic PV inspection), NFPA 70 (NEC Article 690), OSHA 29 CFR 1910 electrical safety, and ASTM E1933 IR measurement procedures. You require no additional training.

Analyze this thermal/IR drone image with MAXIMUM fault sensitivity. Identify ALL of the following fault categories where present:
- Cell hotspots: single-cell, cross, omega, full-cell patterns
- Bypass diode failures (string-level elevated areas)
- PID (Potential Induced Degradation): systematic column-level heat patterns
- Shading-induced thermal signatures (distinguishable by uniformity)
- Open-circuit/disconnected modules (anomalously cold)
- Junction box overheating (fire hazard per NEC 690.31)
- Soiling and bird droppings (localized ΔT elevation)
- Delamination (diffuse heat maps)
- String combiner box overheating
- Electrical arc/burn marks (ΔT >30°C = OSHA immediate action required)
- Mounting/tracker hardware thermal anomalies

Report EVERY fault individually. Never aggregate. Never omit minor faults.
NOTE: If this is a pseudo-color thermal image without a scale, estimate relative severity based on color intensity (e.g. bright white/red = severe hotspot, dark blue/purple = cold). Do NOT omit faults just because absolute temperatures are unknown; use null for temp values if necessary.

Return ONLY valid JSON (no markdown, no prose outside JSON):
{
  "faults": [
    {
      "id": "F001",
      "type": string,
      "category": "hotspot|bypass_diode|pid|shading|open_circuit|junction_box|soiling|delamination|combiner|arc|hardware|other",
      "tempDelta": "number or null",
      "peakTempCelsius": "number or null",
      "location": string,
      "panelId": string,
      "severity": "low|medium|high|critical",
      "confidence": number,
      "usStandardViolation": string,
      "immediateActionRequired": boolean,
      "description": string
    }
  ],
  "totalFaults": number,
  "criticalFaults": number,
  "maxTempDelta": "number or null",
  "overallCondition": "good|degraded|critical|unsafe",
  "estimatedPowerLossPercent": "number or null",
  "complianceFlags": [string],
  "recommendations": [string],
  "summary": string
}`;
    }

    // ── SOLAR PANEL RGB IMAGE ───────────────────────────────────────────────
    if (at === 'solar_panel') {
        return `You are a certified solar PV inspector with expertise in IEC 61215 (PV module qualification), IEC 62446 (PV system inspection), NEC Article 690 (Solar PV Systems), OSHA 29 CFR 1910 electrical safety, and ASTM E2848 (PV performance). You require no additional training.

Analyze this RGB drone image of a solar field with MAXIMUM fault sensitivity. Identify ALL visible faults:
- Physical damage: cracks (micro, snail trail, spiderweb), broken glass, frame deformation
- Surface soiling: dust, bird droppings, debris, organic growth (estimate coverage %)
- Discoloration: EVA yellowing/browning, backsheet degradation
- Delamination: bubbling, moisture ingress, separation
- Shading: vegetation, structural shadows, inter-row shading
- Structural/mounting: loose frames, corrosion, broken clamps, sagging panels
- Wiring/junction: cable damage, open/damaged junction boxes, unsecured conduit
- Tracker faults: misalignment, stuck trackers, structural failure
- Vegetation encroachment within 18 inches of array (fire risk)
- Drainage/ponding water
- Security/perimeter gaps

Report EVERY fault individually. Never omit minor faults.

Return ONLY valid JSON (no markdown, no prose outside JSON):
{
  "faults": [
    {
      "id": "F001",
      "type": string,
      "category": "physical_damage|soiling|discoloration|delamination|shading|structural|wiring|tracker|vegetation|drainage|security|other",
      "location": string,
      "affectedArea": string,
      "severity": "low|medium|high|critical",
      "confidence": number,
      "usStandardViolation": string,
      "immediateActionRequired": boolean,
      "description": string
    }
  ],
  "totalFaults": number,
  "criticalFaults": number,
  "soilingPercent": number,
  "overallCondition": "good|degraded|critical|unsafe",
  "complianceFlags": [string],
  "recommendations": [string],
  "summary": string
}`;
    }

    // ── LBD / LIDAR / STRUCTURAL SCAN ──────────────────────────────────────
    if (at === 'lbd_defect' || at === 'lbd') {
        return `You are a licensed structural inspection engineer with expertise in ACI 318 (concrete), AISC 360 (steel), OSHA 1926 Subpart R (steel erection), IBC (International Building Code), and ASCE 7 (structural loads). You require no additional training.

Analyze this structural scan image and identify ALL defects:
- Concrete: cracks (hairline, structural, map cracking), spalling, delamination, rebar exposure
- Steel: corrosion (surface, section loss), weld failures, bolt loosening, buckling
- Geometry: out-of-plumb, differential settlement, deflection beyond L/360 code limit
- Surface: coating failure, efflorescence, staining (moisture ingress)
- Joints: sealant failure, expansion joint damage
- Drainage: blocked weeps, improper slope, ponding
- Safety: handrail deficiency (OSHA 1926.502), fall exposure, structural instability

Return ONLY valid JSON (no markdown, no prose outside JSON):
{
  "defects": [
    {
      "id": "D001",
      "type": string,
      "category": "crack|spalling|corrosion|geometry|surface|joint|drainage|safety|other",
      "material": "concrete|steel|masonry|other",
      "location": string,
      "dimensions": string,
      "severity": "low|medium|high|critical",
      "confidence": number,
      "usStandardViolation": string,
      "immediateActionRequired": boolean,
      "description": string
    }
  ],
  "totalDefects": number,
  "criticalDefects": number,
  "overallSeverity": "low|medium|high|critical",
  "structuralIntegrityRating": "sound|monitor|repair|urgent_repair|unsafe",
  "complianceFlags": [string],
  "recommendations": [string],
  "summary": string
}`;
    }

    // ── FULL INSPECTION (multi-system) ──────────────────────────────────────
    if (at === 'full_inspection') {
        return `You are a multi-discipline certified drone inspection AI with expertise across: OSHA 1910 & 1926, NEC 2023, IEC 62446, NFPA 70E, ACI 318, AISC 360, and FAA AC 107-2. You require no additional training.

Perform a comprehensive multi-system analysis inspecting ALL of the following simultaneously:
ELECTRICAL: hotspots, arcing, exposed conductors, junction box damage, ground faults
STRUCTURAL: cracks, corrosion, settlement, deflection, delamination, spalling
PV SPECIFIC: cell faults, soiling, delamination, shading, tracker misalignment
FIRE/SAFETY: vegetation within 30ft of electrical, fuel storage proximity, egress blockage
ENVIRONMENTAL: drainage issues, erosion, standing water near electrical equipment
SECURITY: perimeter breach, vandalism, unauthorized access indicators

Report EVERY observed fault and anomaly. Do not omit anything.

Return ONLY valid JSON (no markdown, no prose outside JSON):
{
  "faults": [
    {
      "id": "F001",
      "type": string,
      "system": "electrical|structural|pv|fire_safety|environmental|security|other",
      "severity": "low|medium|high|critical",
      "location": string,
      "confidence": number,
      "usStandardViolation": string,
      "immediateActionRequired": boolean,
      "description": string
    }
  ],
  "anomalies": [
    {
      "type": string,
      "severity": "low|medium|high",
      "confidence": number,
      "location": string,
      "description": string
    }
  ],
  "totalFaults": number,
  "criticalFaults": number,
  "maxTempDelta": number,
  "overallCondition": "good|degraded|critical|unsafe",
  "imageQuality": "poor|fair|good|excellent",
  "complianceFlags": [string],
  "recommendations": [string],
  "summary": string
}`;
    }

    // ── DEFAULT: RGB AERIAL / GENERAL IMAGES ───────────────────────────────
    return `You are a certified aerial inspection AI with comprehensive knowledge of OSHA safety standards, NEC electrical codes, IEC inspection standards, ASCE structural standards, and FAA UAS safety guidelines. You require no additional training.

Analyze this aerial drone image and identify ALL anomalies, hazards, and maintenance items. Flag:
- Subtle discoloration, staining, or weathering indicating hidden issues
- Vegetation encroachment or organic growth
- Any condition that would fail a US code inspection
- Deferred maintenance indicators

Return ONLY valid JSON (no markdown, no prose outside JSON):
{
  "anomalies": [
    {
      "id": "A001",
      "type": string,
      "category": "structural|electrical|vegetation|drainage|surface|safety|other",
      "severity": "low|medium|high|critical",
      "confidence": number,
      "location": string,
      "usStandardViolation": string,
      "immediateActionRequired": boolean,
      "description": string
    }
  ],
  "totalAnomalies": number,
  "criticalAnomalies": number,
  "imageQuality": "poor|fair|good|excellent",
  "overallCondition": "normal|monitor|review|critical|unsafe",
  "complianceFlags": [string],
  "recommendations": [string],
  "summary": string
}`;
}

// ── Parse Gemini response safely ──────────────────────────────────────────────
function parseGeminiJSON(text) {
    const clean = text.trim().replace(/^```(?:json)?\n?/i, '').replace(/```$/m, '').trim();
    try { return JSON.parse(clean); } catch {
        const m = clean.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
        throw new Error('No valid JSON in Gemini response');
    }
}

// ── Detect GCS URI ────────────────────────────────────────────────────────────
function toGCSUri(storageUrl) {
    if (!storageUrl) return null;
    // Already a gs:// URI
    if (storageUrl.startsWith('gs://')) return storageUrl;
    // Public HTTPS: https://storage.googleapis.com/BUCKET/PATH
    const m = storageUrl.match(/storage\.googleapis\.com\/([^/]+)\/(.+)/);
    if (m) return `gs://${m[1]}/${m[2]}`;
    return null;
}

// ── Gemini: analyse one image ─────────────────────────────────────────────────
/**
 * @param {string|null} storageUrl  - GCS URL (preferred: avoids base64, no size limit)
 * @param {Buffer|null} fileBuffer  - inline fallback for non-GCS files
 * @param {string}      mimeType
 * @param {string}      uploadType
 */
export async function analyzeWithGemini(storageUrl, fileBuffer, mimeType, uploadType, analysisType) {
    if (!genAI) return null;
    const prompt = buildPrompt(uploadType, analysisType);
    const model  = 'gemini-2.0-flash';
    const gcsUri = toGCSUri(storageUrl);

    try {
        let result;

        // ── Path A: GCS URI — fastest, no size limit ──────────────────────────
        if (gcsUri && !genAI._legacy) {
            logger.info(`[uploadProcessor] Gemini GCS URI analysis: ${gcsUri}`);
            result = await genAI.models.generateContent({
                model,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { fileData: { mimeType: mimeType || 'image/jpeg', fileUri: gcsUri } },
                    ],
                }],
                config: {
                    responseMimeType: 'application/json'
                }
            });
            return parseGeminiJSON(result.text || '{}');
        }

        // ── Path B: Inline base64 (local files / legacy SDK / small files) ────
        if (fileBuffer) {
            const effective = fileBuffer.length > INLINE_LIMIT_BYTES
                ? fileBuffer.slice(0, INLINE_LIMIT_BYTES)   // trim if over limit
                : fileBuffer;

            if (effective.length < fileBuffer.length) {
                logger.warn(`[uploadProcessor] File >20MB (${Math.round(fileBuffer.length/1024/1024)}MB), trimmed for inline analysis. Consider using GCS.`);
            }

            logger.info(`[uploadProcessor] Gemini inline analysis: ${Math.round(effective.length/1024)}KB`);

            if (genAI._legacy) {
                // Legacy @google/generative-ai SDK
                const m = genAI._legacy.getGenerativeModel({ model });
                const r = await m.generateContent([
                    { text: prompt },
                    { inlineData: { mimeType: mimeType || 'image/jpeg', data: effective.toString('base64') } },
                ]);
                return parseGeminiJSON(r.response.text());
            } else {
                // New @google/genai SDK
                result = await genAI.models.generateContent({
                    model,
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: mimeType || 'image/jpeg', data: effective.toString('base64') } },
                        ],
                    }],
                    config: {
                        responseMimeType: 'application/json'
                    }
                });
                return parseGeminiJSON(result.text || '{}');
            }
        }

        logger.warn('[uploadProcessor] No GCS URI and no file buffer — cannot analyze');
        return null;

    } catch (e) {
        logger.warn('[uploadProcessor] Gemini analysis failed:', e.message);
        return { error: e.message, summary: 'AI analysis failed — please review manually.' };
    }
}



import { geolocateAnomaly } from './geoProjection.js';

// ── Main entry point ───────────────────────────────────────────────────────────
/**
 * processUpload — fire-and-forget after a file is stored.
 *
 * @param {object} opts
 * @param {string}  opts.jobId        - upload_jobs row id
 * @param {string}  opts.uploadFileId - upload_files row id (optional)
 * @param {string}  opts.missionId
 * @param {string}  opts.uploadType   - 'images'|'thermal'|'lbd'|'kml'|...
 * @param {string}  opts.storageUrl   - GCS URI (gs://...) or HTTPS public URL
 * @param {Buffer}  opts.fileBuffer   - raw file buffer (inline fallback)
 * @param {string}  opts.mimeType
 * @param {string}  opts.fileName
 * @param {object}  opts.io           - Socket.io server instance
 * @param {string}  opts.userId       - pilotId (for scoped socket emit)
 * @param {object}  opts.exifMeta     - extracted EXIF metadata
 */
export async function processUpload({
    jobId, uploadFileId, missionId, uploadType, analysisType, storageUrl,
    fileBuffer, mimeType, fileName, io, userId, exifMeta
}) {
    const canAnalyze = ['images', 'thermal', 'lbd'].includes(uploadType);
    const gcsUri     = toGCSUri(storageUrl);

    // Record processing start
    await query(
        `UPDATE upload_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [jobId]
    ).catch(() => {});

    emit(io, userId, 'upload:processing', { jobId, missionId, fileName, uploadType });

    let aiResult = null;

    // ── 1. Gemini AI analysis ─────────────────────────────────────────────────
    const hasData = Boolean(gcsUri || fileBuffer);
    logger.info(`[uploadProcessor] ${fileName} | type=${uploadType} canAnalyze=${canAnalyze} gcsUri=${gcsUri || 'none'} hasBuffer=${!!fileBuffer} hasGenAI=${!!genAI}`);

    if (canAnalyze && hasData && genAI) {
        try {
            if (analysisType === 'solar_panel' || analysisType === 'thermal_fault') {
                const siteConditions = await preprocessImage(fileBuffer);
                aiResult = await analyzeSolarImage(fileBuffer, mimeType, siteConditions);
            } else {
                aiResult = await analyzeWithGemini(storageUrl, fileBuffer, mimeType, uploadType, analysisType);
            }

            // Geoprojection of AI faults
            if (aiResult && exifMeta) {
                const applyGeo = (items) => {
                    if (!items) return;
                    for (const item of items) {
                        if (item.location) {
                            const geo = geolocateAnomaly(item.location, exifMeta);
                            if (geo) {
                                item.geolocation = geo;
                            }
                        }
                    }
                };
                applyGeo(aiResult.faults);
                applyGeo(aiResult.defects);
                applyGeo(aiResult.anomalies);
            }

            logger.info(`[uploadProcessor] Gemini done for ${fileName} — ${JSON.stringify(aiResult)?.slice(0, 80)}`);

            if (uploadFileId) {
                await query(
                    `UPDATE upload_files SET ai_result = $1, status = 'complete', updated_at = NOW() WHERE id = $2`,
                    [JSON.stringify(aiResult), uploadFileId]
                ).catch(e => logger.warn('[uploadProcessor] upload_files update failed:', e.message));
            }
        } catch (e) {
            logger.error('[uploadProcessor] Gemini step failed:', e.message);
            if (uploadFileId) {
                await query(
                    `UPDATE upload_files SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
                    [e.message, uploadFileId]
                ).catch(() => {});
            }
        }
    } else if (uploadFileId && !canAnalyze) {
        // Non-analyzable file (kml, spreadsheet) — just mark complete
        await query(
            `UPDATE upload_files SET status = 'complete', updated_at = NOW() WHERE id = $1`,
            [uploadFileId]
        ).catch(() => {});
    }

    // ── 2. Persist AI result & mark complete ──────────────────────────────────
    try {
        await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS ai_result JSONB`).catch(() => {});
        await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ`).catch(() => {});

        await query(
            `UPDATE upload_jobs
             SET status          = 'complete',
                 ai_result       = $1,
                 processed_at    = NOW(),
                 processed_count = processed_count + 1,
                 updated_at      = NOW()
             WHERE id = $2`,
            [aiResult ? JSON.stringify(aiResult) : null, jobId]
        );

        // ── Phase 1: The Data Flywheel (Save to training dataset) ─────────────
        if (aiResult) {
            const hasFaults = (aiResult.faults && aiResult.faults.length > 0) || 
                              (aiResult.defects && aiResult.defects.length > 0) || 
                              (aiResult.anomalies && aiResult.anomalies.length > 0);
            
            if (hasFaults && storageUrl) {
                // Ensure table exists
                await query(`
                    CREATE TABLE IF NOT EXISTS training_data_flywheel (
                        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        mission_id          UUID NOT NULL,
                        image_url           TEXT NOT NULL,
                        upload_type         TEXT NOT NULL,
                        detected_faults     JSONB NOT NULL,
                        human_verified      BOOLEAN DEFAULT false,
                        created_at          TIMESTAMPTZ DEFAULT NOW()
                    )
                `).catch(() => {});

                // Log the finding into our proprietary dataset
                await query(
                    `INSERT INTO training_data_flywheel (mission_id, image_url, upload_type, detected_faults)
                     VALUES ($1, $2, $3, $4)`,
                    [missionId, storageUrl, uploadType, JSON.stringify(aiResult)]
                ).catch(e => logger.warn('[uploadProcessor] Failed to save to training flywheel:', e.message));
                
                logger.info(`[Data Flywheel] Saved image ${fileName} to proprietary training dataset.`);
            }
        }
    } catch (e) {
        logger.warn('[uploadProcessor] DB update failed:', e.message);
        await query(`UPDATE upload_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`, [jobId]).catch(() => {});
    }

    // ── 3. Real-time emit ─────────────────────────────────────────────────────
    emit(io, userId, 'upload:complete', {
        jobId, missionId, fileName, uploadType,
        aiResult,
        processedAt: new Date().toISOString(),
    });

    logger.info(`[uploadProcessor] ✅ ${fileName} processing complete — jobId=${jobId}`);
}

function emit(io, userId, event, payload) {
    try {
        if (!io) return;
        io.emit(event, payload);
        if (userId) io.to(`user:${userId}`).emit(event, payload);
    } catch (e) {
        logger.warn('[uploadProcessor] socket emit failed:', e.message);
    }
}
