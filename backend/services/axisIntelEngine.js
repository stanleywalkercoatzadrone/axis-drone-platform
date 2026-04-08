/**
 * AXIS INTELLIGENCE MODULE — AI Analysis Engine
 * 
 * Calls Gemini AI with structured JSON schema.
 * Persists results to axis_mission_intel table.
 * Simulation overrides persist to axis_mission_intel_simulations ONLY.
 * 
 * DOES NOT: modify missions, assign personnel, trigger billing, or auto-close jobs.
 * Human-in-the-loop required for all decisions.
 */

import { GoogleGenAI } from '@google/genai';
import { query } from '../config/database.js';
import { aggregateMissionData } from './intelligenceAggregator.js';

const AXIS_INTEL_SCHEMA = {
    type: 'OBJECT',
    properties: {
        riskScore: {
            type: 'NUMBER',
            description: 'Overall mission risk score 1-100 (100 = extreme risk)'
        },
        priorityLevel: {
            type: 'STRING',
            enum: ['Low', 'Medium', 'High', 'Critical']
        },
        recommendedPilotCount: {
            type: 'NUMBER',
            description: 'Optimal number of pilots for this mission'
        },
        weatherConcern: {
            type: 'STRING',
            description: 'Brief weather risk assessment (e.g. "High winds expected - delay recommended")'
        },
        estimatedCompletionDays: {
            type: 'NUMBER',
            description: 'Estimated days to complete the mission'
        },
        financialExposure: {
            type: 'NUMBER',
            description: 'Estimated financial exposure / cost in USD'
        },
        safetyFlags: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'List of specific safety concerns identified'
        },
        blockPriorityStrategy: {
            type: 'OBJECT',
            description: 'Recommended inspection block prioritization strategy',
            properties: {
                approach: { type: 'STRING' },
                sequence: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            block: { type: 'STRING' },
                            priority: { type: 'STRING' },
                            rationale: { type: 'STRING' }
                        }
                    }
                },
                estimatedEfficiency: { type: 'STRING' }
            }
        }
    },
    required: [
        'riskScore',
        'priorityLevel',
        'recommendedPilotCount',
        'weatherConcern',
        'estimatedCompletionDays',
        'financialExposure',
        'safetyFlags',
        'blockPriorityStrategy'
    ]
};

/**
 * Generate AI-powered mission intelligence.
 * 
 * @param {string} missionId - UUID of the deployment
 * @param {object|null} simulationOverrides - Optional simulation parameters (does NOT overwrite primary record)
 * @returns {object} Intelligence result or error object
 */
export async function generateMissionIntel(missionId, simulationOverrides = null) {
    const isSimulation = simulationOverrides !== null && Object.keys(simulationOverrides).length > 0;

    // 1. Aggregate mission data (read-only)
    let aggregation;
    try {
        aggregation = await aggregateMissionData(missionId);
    } catch (err) {
        return {
            success: false,
            error: `Failed to aggregate mission data: ${err.message}`,
            missionId
        };
    }

    // 2. Merge simulation overrides if provided (non-destructive)
    const analysisPayload = { ...aggregation };
    if (isSimulation) {
        if (simulationOverrides.pilotCount !== undefined) {
            analysisPayload.assignedPilotsCount = simulationOverrides.pilotCount;
        }
        if (simulationOverrides.windSpeed !== undefined && analysisPayload.weather) {
            analysisPayload.weather = { ...analysisPayload.weather, windSpeed: simulationOverrides.windSpeed };
        }
        if (simulationOverrides.defectProbability !== undefined) {
            analysisPayload.historicalDefectRate = simulationOverrides.defectProbability;
        }
        if (simulationOverrides.startDelayDays !== undefined) {
            analysisPayload.startDelayDays = simulationOverrides.startDelayDays;
        }
    }

    // 3. Build AI prompt
    const systemPrompt = `You are the Axis Intelligence Engine — an AI decision-support system for drone inspection mission planning.

Your role is ADVISORY ONLY. You do NOT execute actions, assign personnel, modify data, or trigger billing.
You produce structured recommendations for human review.

Analyze the provided mission data JSON and return ONLY a valid JSON object matching the required schema.
No explanations. No markdown. JSON only.`;

    const userPrompt = `Analyze this drone inspection mission and return structured intelligence:

${JSON.stringify(analysisPayload, null, 2)}

${isSimulation ? `\n⚠️ SIMULATION MODE: Parameters have been overridden for scenario planning. Note this is hypothetical.` : ''}

Return JSON only with risk assessment, priority, recommended resources, safety flags, and blocking strategy.`;

    // 4. Call Gemini AI
    let intelResult;
    try {
        const ai = new GoogleGenAI({
            apiKey: process.env.GOOGLE_API_KEY || process.env.API_KEY || ''
        });

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: AXIS_INTEL_SCHEMA
            }
        });

        const rawText = response.text || '';
        intelResult = JSON.parse(rawText);

        // Validate required fields
        if (
            typeof intelResult.riskScore !== 'number' ||
            !intelResult.priorityLevel ||
            !Array.isArray(intelResult.safetyFlags)
        ) {
            throw new Error('AI response failed schema validation');
        }

    } catch (err) {
        console.error('[AxisIntelEngine] AI call failed:', err.message);
        return {
            success: false,
            error: `AI analysis failed: ${err.message}`,
            missionId,
            partialAggregation: aggregation
        };
    }

    // 5. Persist to database
    try {
        if (isSimulation) {
            // SIMULATION: save to separate table only — never overwrites primary record
            await query(
                `INSERT INTO axis_mission_intel_simulations 
                 (mission_id, overrides, results) 
                 VALUES ($1, $2, $3)`,
                [
                    missionId,
                    JSON.stringify(simulationOverrides),
                    JSON.stringify(intelResult)
                ]
            );
        } else {
            // PRIMARY: upsert the main intel record
            await query(
                `INSERT INTO axis_mission_intel 
                 (mission_id, risk_score, priority_level, recommended_pilot_count, 
                  weather_concern, estimated_completion_days, financial_exposure, 
                  safety_flags, block_priority_strategy)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (mission_id) DO UPDATE SET
                   risk_score = EXCLUDED.risk_score,
                   priority_level = EXCLUDED.priority_level,
                   recommended_pilot_count = EXCLUDED.recommended_pilot_count,
                   weather_concern = EXCLUDED.weather_concern,
                   estimated_completion_days = EXCLUDED.estimated_completion_days,
                   financial_exposure = EXCLUDED.financial_exposure,
                   safety_flags = EXCLUDED.safety_flags,
                   block_priority_strategy = EXCLUDED.block_priority_strategy,
                   updated_at = NOW()`,
                [
                    missionId,
                    intelResult.riskScore,
                    intelResult.priorityLevel,
                    intelResult.recommendedPilotCount,
                    intelResult.weatherConcern,
                    intelResult.estimatedCompletionDays,
                    intelResult.financialExposure,
                    JSON.stringify(intelResult.safetyFlags),
                    JSON.stringify(intelResult.blockPriorityStrategy)
                ]
            );
        }
    } catch (dbErr) {
        console.error('[AxisIntelEngine] DB persist failed:', dbErr.message);
        // Return the result even if DB save fails — don't crash the response
        return {
            success: true,
            isSimulation,
            missionId,
            intel: intelResult,
            aggregation,
            warning: 'Result generated but could not be persisted to database.'
        };
    }

    return {
        success: true,
        isSimulation,
        missionId,
        intel: intelResult,
        aggregation
    };
}

/**
 * Fetch the latest persisted intelligence record for a mission.
 */
export async function getLatestMissionIntel(missionId) {
    try {
        const result = await query(
            `SELECT * FROM axis_mission_intel WHERE mission_id = $1 ORDER BY updated_at DESC LIMIT 1`,
            [missionId]
        );
        if (result.rows.length === 0) return null;
        return result.rows[0];
    } catch (err) {
        console.error('[AxisIntelEngine] getLatestMissionIntel failed:', err.message);
        return null;
    }
}

/**
 * Fetch all simulation records for a mission.
 */
export async function getMissionSimulations(missionId) {
    try {
        const result = await query(
            `SELECT * FROM axis_mission_intel_simulations WHERE mission_id = $1 ORDER BY created_at DESC`,
            [missionId]
        );
        return result.rows || [];
    } catch (err) {
        console.error('[AxisIntelEngine] getMissionSimulations failed:', err.message);
        return [];
    }
}
