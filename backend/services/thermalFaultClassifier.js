/**
 * thermalFaultClassifier.js
 * Phase 2 + Phase 3 – Thermal Fault Classification + Gemini AI Analysis
 *
 * Classifies thermal anomalies from image metadata.
 * Optional: AI-enhanced classification using Gemini Vision.
 * Non-destructive — does not modify any existing services.
 */
import { GoogleGenAI } from '@google/genai';

// Fault type lookup by temperature delta and pattern
const FAULT_TYPE_RULES = [
    // ΔT ranges + pattern keywords → fault type
    { minDelta: 25, faultType: 'string_outage', label: 'String Outage' },
    { minDelta: 20, faultType: 'bypass_diode_failure', label: 'Bypass Diode Failure' },
    { minDelta: 15, faultType: 'hot_cell', label: 'Hot Cell' },
    { minDelta: 10, faultType: 'connector_overheating', label: 'Connector Overheating' },
    { minDelta: 8, faultType: 'panel_mismatch', label: 'Panel Mismatch' },
    { minDelta: 5, faultType: 'shading_anomaly', label: 'Shading Anomaly' },
    { minDelta: 2, faultType: 'minor_thermal_deviation', label: 'Minor Thermal Deviation' },
    { minDelta: 0, faultType: 'normal', label: 'Normal' },
];

const SEVERITY_RULES = [
    { minDelta: 15, severity: 'critical' },
    { minDelta: 8, severity: 'moderate' },
    { minDelta: 4, severity: 'low' },
    { minDelta: 0, severity: 'normal' },
];

const CONFIDENCE_BY_DELTA = (delta) => {
    // Higher ΔT → more confident classification
    if (delta >= 20) return 92;
    if (delta >= 15) return 87;
    if (delta >= 10) return 80;
    if (delta >= 7) return 72;
    if (delta >= 4) return 62;
    return 50;
};

/**
 * Rule-based fault classification from temperature delta.
 * @param {number} temperatureDelta - °C above baseline
 * @param {Object} [meta] - extra metadata (width, height, pattern hints)
 * @returns {{ fault_type, severity, confidence_score, temperature_delta }}
 */
export function classifyByDelta(temperatureDelta, meta = {}) {
    const delta = Math.abs(parseFloat(temperatureDelta) || 0);

    const faultRule = FAULT_TYPE_RULES.find(r => delta >= r.minDelta);
    const sevRule = SEVERITY_RULES.find(r => delta >= r.minDelta);

    return {
        fault_type: faultRule?.faultType || 'normal',
        fault_label: faultRule?.label || 'Normal',
        severity: sevRule?.severity || 'normal',
        confidence_score: CONFIDENCE_BY_DELTA(delta),
        temperature_delta: Math.round(delta * 100) / 100,
    };
}

/**
 * Phase 3: AI-powered thermal fault analysis via Gemini.
 * Gracefully falls back to rule-based if AI unavailable.
 * @param {string|null} base64Image - base64-encoded thermal image (optional)
 * @param {number} temperatureDelta - measured ΔT in °C
 * @param {Object} [context] - { blockName, latitude, longitude, imageFilename }
 * @returns {Promise<{fault_type, severity, temperature_delta, confidence_score, ai_enhanced}>}
 */
export async function analyzeThermalFault(base64Image, temperatureDelta, context = {}) {
    // Always start with rule-based as fallback
    const ruleResult = classifyByDelta(temperatureDelta, context);

    const apiKey = process.env.GOOGLE_API_KEY || process.env.API_KEY || '';
    if (!apiKey || !base64Image) {
        return { ...ruleResult, ai_enhanced: false };
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `You are a solar thermal inspection AI.
Analyze this thermal drone image and identify any anomalies.

Context:
- Measured temperature delta vs baseline: ${temperatureDelta}°C
- Block: ${context.blockName || 'Unknown'}
- Location: ${context.latitude || 'N/A'}, ${context.longitude || 'N/A'}

Respond ONLY with valid JSON in this exact format:
{
  "fault_type": "hot_cell|bypass_diode_failure|string_outage|connector_overheating|panel_mismatch|shading_anomaly|minor_thermal_deviation|normal",
  "severity": "critical|moderate|low|normal",
  "temperature_delta": <number>,
  "confidence_score": <0-100>,
  "notes": "<short explanation>"
}`;

        const parts = [{ text: prompt }];
        if (base64Image) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image,
                }
            });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts }],
        });

        const rawText = response.text?.trim() || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in AI response');

        const aiResult = JSON.parse(jsonMatch[0]);
        return {
            fault_type: aiResult.fault_type || ruleResult.fault_type,
            severity: aiResult.severity || ruleResult.severity,
            temperature_delta: parseFloat(aiResult.temperature_delta) || temperatureDelta,
            confidence_score: parseInt(aiResult.confidence_score) || ruleResult.confidence_score,
            ai_notes: aiResult.notes || null,
            ai_enhanced: true,
        };
    } catch (err) {
        console.warn('[thermalFaultClassifier] AI analysis failed, using rule-based:', err.message);
        return { ...ruleResult, ai_enhanced: false };
    }
}

/**
 * Determine severity label for display purposes.
 */
export function getSeverityColor(severity) {
    const map = {
        critical: '#ef4444',
        moderate: '#f97316',
        low: '#eab308',
        normal: '#22c55e',
    };
    return map[severity] || '#6b7280';
}
