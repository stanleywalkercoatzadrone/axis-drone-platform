import { GoogleGenAI } from "@google/genai";

// Enum simulations
const Industry = {
    SOLAR: 'Solar Farm',
    UTILITIES: 'Power Utilities',
    INSURANCE: 'Storm Damage Insurance',
    TELECOM: 'Telecom Towers',
    CONSTRUCTION: 'Construction Logistics'
};

const Type = {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    ARRAY: 'ARRAY'
};

/**
 * Diagnostic tool to verify API availability and latency
 */
export async function testAIConnection() {
    const start = Date.now();
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '' });

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-thinking-exp-01-21',
            contents: [{ role: 'user', parts: [{ text: 'Respond with the word "CONNECTED" only.' }] }],
            config: {
                thinkingConfig: { includeThoughts: true }
            }
        });

        const latency = Date.now() - start;
        if (response.text?.trim().includes('CONNECTED')) {
            return { status: 'ok', message: 'Gemini Cloud Interface Responsive', latency };
        }
        throw new Error('Unexpected response signature');
    } catch (error) {
        return { status: 'error', message: error.message || 'Connection failed', latency: Date.now() - start };
    }
}

/**
 * Enterprise Image Analysis using Gemini 2.0 Pro
 */
export async function analyzeInspectionImage(imageData, industry, sensitivity = 50) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '' });

    const isInsurance = industry === Industry.INSURANCE;

    // Convert sensitivity (0-100) to descriptive instruction
    let sensitivityInstruction = "";
    if (sensitivity < 30) {
        sensitivityInstruction = "OPERATE WITH ULTRA-CONSERVATIVE BIAS. Only report anomalies with absolute certainty (high confidence). Prioritize precision over recall to eliminate false positives.";
    } else if (sensitivity > 70) {
        sensitivityInstruction = "OPERATE WITH ULTRA-SENSITIVE BIAS. Report even the most minute or debatable anomalies (allow lower confidence). Prioritize recall over precision; it is better to have a false positive than miss a minor defect.";
    } else {
        sensitivityInstruction = "OPERATE WITH BALANCED BIAS. Report clear anomalies and noteworthy wear, maintaining standard industry confidence thresholds.";
    }

    const prompt = `
    ACT AS: Lead Drone Inspection Engineer for ${industry} Infrastructure.
    TASK: Execute a High-Resolution Visual/Thermal Audit of the provided drone capture.
    
    DETECTION SENSITIVITY: ${sensitivity}/100
    ${sensitivityInstruction}
    
    SYSTEM DIRECTIVES:
    1. Identify structural anomalies, material degradation, or safety hazards based on the specified sensitivity.
    2. Provide precise bounding box coordinates (0-100 scale).
    3. Categorize Severity based on operational risk.
    4. MUST PROVIDE A CONFIDENCE SCORE (0.0 to 1.0) for each detection.
    5. Generate a technical summary using enterprise nomenclature.

    INDUSTRY PROTOCOLS:
    - ${Industry.SOLAR}: Hot-spot identification (Thermal), micro-cracks, PID markers, and junction box corrosion.
    - ${Industry.UTILITIES}: Insulator flashover markers, conductor sag analysis, and vegetation encroachment distance.
    - ${Industry.INSURANCE}: Shingle uplift density, granule loss mapping, hail impact per SQ, and perimeter flashing integrity.
    - ${Industry.TELECOM}: RAD center alignment, antenna tilt variance, mounting rust, and cable weather-loop health.
    - ${Industry.CONSTRUCTION}: Safety compliance (PPE), material inventory, trenching shoring verification, and foundation curing status.

    ${isInsurance ? `
    XACTIMATE INTEGRATION:
    - Mandatory line-item cost estimation for detected damages.
    - Use standard SQ, EA, LF units and current market rates.
    ` : 'NO financial estimation required.'}
  `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-pro-exp-02-05',
            contents: [
                {
                    role: 'user', parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: imageData.split(',')[1] || imageData
                            }
                        }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        issues: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    severity: {
                                        type: Type.STRING,
                                        enum: ['Low', 'Medium', 'High', 'Critical']
                                    },
                                    confidence: {
                                        type: Type.NUMBER,
                                        description: "Probability of correct detection, 0.0 to 1.0"
                                    },
                                    location: {
                                        type: Type.OBJECT,
                                        properties: {
                                            x: { type: Type.NUMBER },
                                            y: { type: Type.NUMBER },
                                            width: { type: Type.NUMBER },
                                            height: { type: Type.NUMBER }
                                        },
                                        required: ['x', 'y', 'width', 'height']
                                    },
                                    suggestedCosts: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                category: { type: Type.STRING },
                                                itemCode: { type: Type.STRING },
                                                description: { type: Type.STRING },
                                                quantity: { type: Type.NUMBER },
                                                unit: { type: Type.STRING },
                                                unitPrice: { type: Type.NUMBER }
                                            }
                                        }
                                    }
                                },
                                required: ['label', 'description', 'severity', 'location', 'confidence']
                            }
                        },
                        recommendations: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ['summary', 'issues', 'recommendations']
                }
            }
        });

        return JSON.parse(result.text || '{}');
    } catch (error) {
        console.error("AI Analysis Parse Error:", error);
        throw error;
    }
}

/**
 * Strategic Assessment using Gemini 2.0 Thinking Mode + Search Grounding
 */
export async function generateStrategicAssessment(reportData) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '' });

    const prompt = `
    ACT AS: Principal Infrastructure Consultant.
    TASK: High-Level Operational Assessment & Correction Directives.
    INPUT: ${JSON.stringify(reportData)}
    
    OBJECTIVES:
    1. Evaluate detected anomalies collective risk.
    2. USE GOOGLE SEARCH to find actual industry-standard repair procedures or "Corrective Protocols" for the specific issues found (e.g., how to repair a cracked PV glass or treat rusted tower mounts per IEEE/NACE standards).
    3. Identify long-term structural liability risks.
    4. Provide exactly 3 high-priority operational directives for field crews.
    5. For each major issue type, provide a step-by-step "Corrective Protocol".
  `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash-thinking-exp-01-21',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearchRetrieval: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reasoning: { type: Type.STRING },
                        longTermRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
                        operationalPriorities: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctiveProtocols: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    issueType: { type: Type.STRING },
                                    procedure: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    requiredHardware: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    safetyProtocol: { type: Type.STRING }
                                },
                                required: ['issueType', 'procedure', 'safetyProtocol']
                            }
                        },
                        grandTotalEstimate: { type: Type.NUMBER }
                    },
                    required: ['reasoning', 'longTermRisks', 'operationalPriorities', 'correctiveProtocols']
                }
            }
        });

        const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const links = groundingChunks
            .map((chunk) => chunk.web)
            .filter(Boolean)
            .map((w) => ({
                title: w.title || "Technical Documentation",
                uri: w.uri
            }));

        const assessment = JSON.parse(result.text || '{}');
        assessment.groundingSources = links;

        return assessment;
    } catch (error) {
        console.error("Strategic Assessment Error:", error);
        throw error;
    }
}

/**
 * Site Intelligence using Gemini 2.0 Flash + Search Grounding
 */
export async function getSiteIntelligence(locationName, industry, lat, lng) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '' });

    const prompt = `Analyze environmental and industrial context for a professional drone inspection at: ${locationName}. 
  Focus on ${industry} specific environmental hazards, local infrastructure history, and zoning regulations.`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearchRetrieval: {} }],
            }
        });

        const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const links = groundingChunks
            .map((chunk) => chunk.web)
            .filter(Boolean)
            .map((w) => ({
                title: w.title || "Technical Context",
                uri: w.uri
            }));

        return {
            summary: result.text || "Background intelligence compiled from multiple sources.",
            nearbyHazards: [],
            sources: links
        };
    } catch (error) {
        return {
            summary: "Environmental intelligence unavailable. Local context cache being used.",
            nearbyHazards: [],
            sources: []
        };
    }
}

/**
 * Generate a professional pilot interest inquiry email body using Gemini AI.
 * Context-aware: understands drone flight vs LBD scanning vs combined roles,
 * includes pay rate, and adapts language to the specific industry.
 *
 * @param {object} mission - Mission data including payRate, personnelRole
 * @returns {Promise<{ subject: string, body: string }>}
 */
export async function generateMissionInquiryEmail(mission) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '' });

    // Admin's explicit job type toggle takes full priority over heuristic detection
    const explicitRole = (mission.personnelRole || '').toLowerCase().trim();

    let workTypeContext;
    if (explicitRole === 'both') {
        workTypeContext = 'COMBINED ROLE: This mission requires BOTH drone flight operations AND terrestrial LBD (Load Balance Disconnect) ground scanning. The technician must be prepared for aerial UAV data capture as well as physically walking the site rows with handheld scanning equipment to inspect individual load balance disconnect units, connectors, and junction boxes on solar panels or electrical infrastructure.';
    } else if (explicitRole === 'lbd') {
        workTypeContext = 'TERRESTRIAL GROUND SCAN ROLE (LBD): This is a ground-based scanning mission — NO drone flying required. The technician will walk the site on foot with handheld scanning equipment, inspecting individual Load Balance Disconnect (LBD) units row by row across the array. Tasks include scanning panel connectors, junction boxes, and string combiner boxes. This is ground work only.';
    } else {
        // Default: drone pilot / flying role
        workTypeContext = 'DRONE FLIGHT / AERIAL INSPECTION ROLE: This is a drone piloting mission. The pilot will operate UAV aircraft to capture aerial imagery, thermal data, or survey footage of the site. Responsibilities include pre-flight checks, flight operations, data capture (RGB/thermal), and post-flight data handoff. Ground scanning is NOT required for this role.';
    }

    const payContext = mission.payRate
        ? `COMPENSATION: The daily pay rate for this mission is $${Number(mission.payRate).toLocaleString()} per day.`
        : 'COMPENSATION: Competitive daily rate — will be confirmed based on pilot profile and scope.';

    const missionContext = [
        `Title: ${mission.title}`,
        mission.type       && `Mission Type: ${mission.type}`,
        mission.industry   && `Industry Sector: ${mission.industry}`,
        mission.siteName   && `Site Name: ${mission.siteName}`,
        mission.clientName && `Client: ${mission.clientName}`,
        mission.date       && `Scheduled Date: ${mission.date}`,
        mission.location   && `Location / Coordinates: ${mission.location}`,
        mission.estimatedDurationDays && `Estimated Duration: ${mission.estimatedDurationDays} day(s)`,
        mission.notes      && `Admin Notes / Scope Details: ${mission.notes}`,
    ].filter(Boolean).join('\n');

    const prompt = `
You are the operations coordinator for Axis Drone Platform, a professional enterprise UAV inspection and ground-survey company. We dispatch both drone pilots and ground technicians (LBD scanners) to client sites.

Your task: Write a professional, warm, and specific interest inquiry email to send to a pilot or technician to ask if they are available and interested in an upcoming mission.

─── MISSION DETAILS ───────────────────────────────────────
${missionContext}

─── WORK TYPE CONTEXT ─────────────────────────────────────
${workTypeContext}

─── COMPENSATION ──────────────────────────────────────────
${payContext}

─── WRITING INSTRUCTIONS ──────────────────────────────────
1. Open with "Hi [Name]," — this will be personalized automatically.
2. In 1–2 sentences, clearly explain WHAT TYPE OF WORK this is (flying a drone, scanning LBDs on the ground, or both). Be direct — pilots need to know immediately whether this requires them to fly or scan.
3. Describe the site and industry context. Explain what they'll physically be doing at the site (e.g., "you'll be capturing thermal imagery of solar panels from the air" OR "you'll walk the solar array rows with a scanner inspecting individual LBD units").
4. Mention the scheduled date and estimated duration.
5. ALWAYS include the daily pay rate clearly (e.g., "The daily rate for this mission is $XXX/day" or "Compensation will be discussed based on scope" if no rate is set).
6. Ask if they're available and interested — keep it concise, one clear ask.
7. Keep tone: professional, direct, human — NOT corporate-robotic.
8. DO NOT include a subject line, signature, or sign-off — those are added automatically.
9. Maximum 4 short paragraphs.
10. Return plain text ONLY — no markdown, no HTML, no bullet points.

Also write a short email subject line (under 10 words) that clearly states it's a mission opportunity and the type of work.
`.trim();

    const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    subject: { type: 'STRING', description: 'Short professional email subject line, under 10 words' },
                    body:    { type: 'STRING', description: 'Plain-text email body only, no subject, no signature' },
                },
                required: ['subject', 'body'],
            },
        },
    });

    return JSON.parse(result.text || '{}');
}
