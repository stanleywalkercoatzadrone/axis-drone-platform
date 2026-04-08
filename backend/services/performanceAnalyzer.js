/**
 * performanceAnalyzer.js
 * Mission Forecasting & Performance Intelligence Engine — Phase 2
 * 
 * READ-ONLY analysis service. No data mutation.
 * Analyzes historical mission performance from existing tables.
 */
import { query } from '../config/database.js';
import { GoogleGenAI } from '@google/genai';

// Lazy-initialized — only constructed when API key is available (prevents startup crash)
let _ai = null;
function getAI() {
    if (_ai) return _ai;
    const apiKey = process.env.GOOGLE_API_KEY || process.env.API_KEY || '';
    if (!apiKey) return null;
    _ai = new GoogleGenAI({ apiKey });
    return _ai;
}

/**
 * Extract structured delay factors from pilot/technician notes using AI.
 * Returns structured object — never modifies the original note text.
 * (Single note — kept for backward compat with updateMissionPerformanceRecord)
 */
export async function extractNoteFactors(noteText) {
    if (!noteText || noteText.trim().length < 10) return {};
    const results = await extractNoteFactorsBatch([noteText]);
    return results[0] || {};
}

/**
 * Phase 6 – Batch AI Note Analysis
 * Processes all notes in a single Gemini prompt instead of one call per note.
 * Reduces API calls from N to 1 per analysis run.
 * @param {string[]} notes - array of note strings
 * @returns {Promise<Object[]>} - array of extracted factor objects, one per note
 */
export async function extractNoteFactorsBatch(notes) {
    if (!notes || notes.length === 0) return [];

    // Filter out empty notes but keep index mapping
    const validNotes = notes.map((n, i) => ({ index: i, text: n?.trim() || '' }))
        .filter(n => n.text.length >= 10);

    if (validNotes.length === 0) {
        return notes.map(() => ({}));
    }

    try {
        const notesBlock = validNotes.map(n =>
            `NOTE_${n.index}: "${n.text.replace(/"/g, "'").slice(0, 600)}"`
        ).join('\n\n');

        const prompt = `You are a drone mission operations analyst. Extract structured delay/impact factors from each field note below.
Return ONLY a valid JSON array, one object per note, in order. Each object must match exactly:
{
  "wind": true/false,
  "rain": true/false,
  "lowVisibility": true/false,
  "equipmentFailure": true/false,
  "crewShortage": true/false,
  "accessIssue": true/false,
  "safetyRestriction": true/false,
  "clientHold": true/false,
  "schedulingDelay": true/false,
  "weatherGeneral": true/false,
  "otherThemes": ["short phrases"],
  "severity": "none|low|medium|high",
  "summary": "one sentence"
}

Notes:
${notesBlock}`;

        const ai = getAI();
        if (!ai) return notes.map(() => ({}));
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        let text = (result.text || '[]').trim()
            .replace(/^```json\n?/i, '').replace(/```$/m, '').trim();
        const parsed = JSON.parse(text);

        // Map back to original index positions (filling in empty for filtered notes)
        const output = notes.map(() => ({}));
        validNotes.forEach((n, i) => {
            output[n.index] = parsed[i] || { summary: n.text.slice(0, 200) };
        });
        return output;
    } catch {
        // Fallback: return summary-only objects for each note
        return notes.map(n => n ? { summary: n.slice(0, 200) } : {});
    }
}

/**
 * Core performance analysis — READ ONLY.
 * Pulls from existing deployments, daily_logs, flight_parameters tables.
 */
export async function analyzeMissionPerformance(missionId) {
    // 1. Pull mission base data
    const missionRes = await query(
        `SELECT id, title, status, date, site_name, industry_key
         FROM deployments WHERE id = $1`,
        [missionId]
    );
    if (missionRes.rows.length === 0) throw new Error('Mission not found');
    const mission = missionRes.rows[0];

    // 2. Pull daily logs (performance history)
    const logsRes = await query(
        `SELECT id, date, notes, daily_pay, bonus_pay
         FROM daily_logs WHERE deployment_id = $1 ORDER BY date ASC`,
        [missionId]
    );
    const logs = logsRes.rows;

    // 3. Pull flight parameters (expected production data)
    const fpRes = await query(
        `SELECT flight_altitude_m, mission_area_acres, waypoint_count, params_raw
         FROM flight_parameters WHERE deployment_id = $1 LIMIT 1`,
        [missionId]
    );
    const flightParams = fpRes.rows[0] || null;

    // 4. Pull existing performance records from our new table
    const perfRes = await query(
        `SELECT * FROM mission_daily_performance WHERE mission_id = $1 ORDER BY date ASC`,
        [missionId]
    );
    const perfRecords = perfRes.rows;

    // ── Calculations ───────────────────────────────────────────────────────────

    // Average daily velocity — use daily_pay as a productivity proxy (no panel counts in schema)
    // Logs with any pay > 0 are active work days
    const activeLogs = logs.filter(l => (parseFloat(l.daily_pay) || 0) > 0);
    const avgVelocity = activeLogs.length > 0
        ? activeLogs.reduce((s, l) => s + (parseFloat(l.daily_pay) || 0), 0) / activeLogs.length
        : 0;

    // Completion rates from performance records
    const completionRates = perfRecords
        .map(r => parseFloat(r.completion_rate) || 0)
        .filter(r => r > 0);
    const avgCompletionRate = completionRates.length > 0
        ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
        : (activeLogs.length > 0 ? 75 : 60);

    // Delay pattern frequency from structured notes
    const delayFrequency = {};
    const delayKeys = [
        'wind', 'rain', 'lowVisibility', 'equipmentFailure',
        'crewShortage', 'accessIssue', 'safetyRestriction',
        'clientHold', 'schedulingDelay', 'weatherGeneral'
    ];

    perfRecords.forEach(r => {
        try {
            const factors = r.notes_extracted_factors || {};
            delayKeys.forEach(k => {
                if (factors[k]) delayFrequency[k] = (delayFrequency[k] || 0) + 1;
            });
        } catch { /* skip */ }
    });

    // Weather impact: proportion of days with weather-related delays
    const weatherDelayDays = perfRecords.filter(r => {
        const f = r.notes_extracted_factors || {};
        return f.wind || f.rain || f.lowVisibility || f.weatherGeneral;
    }).length;
    const weatherImpactFactor = perfRecords.length > 0
        ? Math.round((weatherDelayDays / perfRecords.length) * 100) / 100
        : 0.15; // default 15% weather impact

    // Irradiance impact (solar-specific)
    const irradianceRecords = perfRecords.filter(r => r.irradiance_level != null);
    const avgIrradiance = irradianceRecords.length > 0
        ? irradianceRecords.reduce((s, r) => s + parseFloat(r.irradiance_level), 0) / irradianceRecords.length
        : null;
    const irradianceImpactFactor = avgIrradiance != null
        ? Math.min(1, avgIrradiance / 800) // 800 W/m² as optimal baseline
        : 0.8;

    // Productivity variance
    const productivityVariance = activeLogs.length > 1
        ? Math.sqrt(
            activeLogs.reduce((s, l) => s + Math.pow((parseFloat(l.daily_pay) || 0) - avgVelocity, 2), 0)
            / activeLogs.length
        )
        : 0;

    // Risk trend based on pay/output in recent vs older logs
    const recentLogs = activeLogs.slice(-5);
    const olderLogs = activeLogs.slice(0, -5);
    const recentAvg = recentLogs.length > 0
        ? recentLogs.reduce((s, l) => s + (parseFloat(l.daily_pay) || 0), 0) / recentLogs.length
        : avgVelocity;
    const olderAvg = olderLogs.length > 0
        ? olderLogs.reduce((s, l) => s + (parseFloat(l.daily_pay) || 0), 0) / olderLogs.length
        : recentAvg;
    const riskTrend = recentAvg < olderAvg * 0.85 ? 'declining'
        : recentAvg > olderAvg * 1.1 ? 'improving' : 'stable';

    // Projected daily capacity (with weather impact applied)
    const projectedDailyCapacity = Math.round(avgVelocity * (1 - weatherImpactFactor * 0.5));

    // Top delay patterns (sorted by frequency)
    const delayPatterns = Object.entries(delayFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([key, count]) => ({
            factor: key,
            frequency: count,
            percentage: Math.round((count / Math.max(perfRecords.length, 1)) * 100)
        }));

    return {
        missionId,
        missionTitle: mission.title,
        industry: mission.industry_key || 'solar',
        siteName: mission.site_name,
        missionDate: mission.date,
        totalLogs: logs.length,
        activeDays: activeLogs.length,
        avgVelocity: Math.round(avgVelocity * 10) / 10,
        avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
        weatherImpactFactor,
        irradianceImpactFactor: Math.round(irradianceImpactFactor * 100) / 100,
        delayPatterns,
        projectedDailyCapacity,
        productivityVariance: Math.round(productivityVariance * 10) / 10,
        riskTrend,
        flightParams,
        dataQuality: perfRecords.length >= 5 ? 'high' : perfRecords.length >= 2 ? 'medium' : 'low',
    };
}
