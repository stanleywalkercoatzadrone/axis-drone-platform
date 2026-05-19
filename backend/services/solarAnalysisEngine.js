/**
 * solarAnalysisEngine.js — Axis Solar Inspection AI Pipeline
 * Enforces strict NEC (NFPA 70) and IEC 62446 compliance outputs from Gemini.
 * Uses the same lazy-init genAI pattern as uploadProcessor.js.
 */

import exifr from 'exifr';

// ── Gemini SDK init (mirrors uploadProcessor.js pattern) ─────────────────────
let genAI = null;

try {
    const mod = await import('@google/genai');
    const key = process.env.GEMINI_API_KEY;
    if (key) {
        genAI = new mod.GoogleGenAI({ apiKey: key });
        console.log('[solarAnalysisEngine] ✅ Gemini SDK initialized');
    } else {
        console.warn('[solarAnalysisEngine] ⚠️ GEMINI_API_KEY not set — AI analysis disabled');
    }
} catch (e) {
    console.warn('[solarAnalysisEngine] Gemini SDK load failed:', e.message);
}

const SYSTEM_ROLE = `You are a certified solar PV inspector trained in NEC (NFPA 70), IEC 62446, and utility-scale solar O&M practices. You analyze RGB and thermal drone imagery to detect faults in solar modules.`;

const buildPrompt = (siteConditions = {}) => `SITE CONDITIONS:
Ambient Temp: ${siteConditions.ambientTemp || 'Unknown'}
Irradiance: ${siteConditions.irradiance || 'Unknown'}

INSTRUCTIONS:
1. Identify ALL anomalies present: Hotspots, String failures, Bypass diode failures, Soiling, Shading, Cracks, Physical damage, Junction box issues.
2. CLASSIFY each by severity:
   - CRITICAL (fire risk / major failure / ΔT > 30°C)
   - HIGH (performance loss / ΔT 20-30°C)
   - MEDIUM (maintenance needed / ΔT 10-20°C)
   - LOW (minor issue / ΔT < 10°C)
   - NORMAL (no issue observed)
3. If this is a pseudo-color thermal image without a temperature scale, estimate severity from color intensity: bright white/red = high ΔT, dark blue/purple = low or cold.
4. DO NOT give generic summaries. Be specific per anomaly.
5. DO NOT say "appears normal" unless every panel is genuinely fault-free.
6. ALWAYS return at least one classification even if condition is NORMAL.

Return ONLY valid JSON — no markdown, no explanation outside JSON:
{
  "issues": [
    {
      "anomaly_type": "string",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|NORMAL",
      "temperature_delta": "string or null",
      "confidence": "0.0-1.0",
      "recommended_action": "string",
      "code_reference": "string"
    }
  ],
  "totalIssues": number,
  "criticalCount": number,
  "overallCondition": "good|degraded|critical|unsafe",
  "summary": "string"
}`;

/**
 * Extract ambient temperature and irradiance from image EXIF metadata.
 */
export async function preprocessImage(fileBuffer) {
    let ambientTemp = 'Unknown';
    let irradiance = 'Unknown';
    try {
        const meta = await exifr.parse(fileBuffer, { pick: ['AmbientTemperature', 'Irradiance', 'RelativeHumidity'] });
        if (meta?.AmbientTemperature) ambientTemp = `${meta.AmbientTemperature}°C`;
        if (meta?.Irradiance) irradiance = `${parseFloat(meta.Irradiance).toFixed(2)} W/m²`;
    } catch (e) {
        // EXIF read failure is non-fatal
    }
    return { ambientTemp, irradiance };
}

/**
 * Run the multi-step solar inspection AI pipeline on a single image buffer.
 * Returns structured JSON with classified anomalies per NEC/IEC standards.
 */
export async function analyzeSolarImage(fileBuffer, mimeType = 'image/jpeg', siteConditions = {}) {
    if (!genAI) throw new Error('[solarAnalysisEngine] Gemini not initialized — check GEMINI_API_KEY');

    const prompt = buildPrompt(siteConditions);
    const imageData = {
        inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: fileBuffer.toString('base64')
        }
    };

    const result = await genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
            role: 'user',
            parts: [{ text: prompt }, imageData]
        }],
        config: {
            systemInstruction: SYSTEM_ROLE,
            responseMimeType: 'application/json'
        }
    });

    let text = result.text || '{}';

    // Strip markdown fences if model ignores responseMimeType
    if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    try {
        return JSON.parse(text);
    } catch (parseErr) {
        console.error('[solarAnalysisEngine] JSON parse failed. Raw output:', text.slice(0, 300));
        throw new Error(`Gemini returned non-parseable JSON: ${parseErr.message}`);
    }
}
