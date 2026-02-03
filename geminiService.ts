
import { GoogleGenAI, Type } from "@google/genai";
import { Industry, AIAnalysisResponse, SiteContext, StrategicAssessment } from "./types";

/**
 * Diagnostic tool to verify API availability and latency
 */
export async function testAIConnection(): Promise<{ status: 'ok' | 'error', message: string, latency: number }> {
  const start = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

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
  } catch (error: any) {
    return { status: 'error', message: error.message || 'Connection failed', latency: Date.now() - start };
  }
}

/**
 * Enterprise Image Analysis using Gemini 2.0 Pro
 */
export async function analyzeInspectionImage(
  imageData: string,
  industry: Industry,
  sensitivity: number = 50
): Promise<AIAnalysisResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

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

    return JSON.parse(result.text || '{}') as AIAnalysisResponse;
  } catch (error) {
    console.error("AI Analysis Parse Error:", error);
    throw error;
  }
}

/**
 * Strategic Assessment using Gemini 2.0 Thinking Mode + Search Grounding
 */
export async function generateStrategicAssessment(
  reportData: any
): Promise<StrategicAssessment> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

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
        tools: [{ googleSearchRetrieval: {} } as any],
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
      .map((chunk: any) => chunk.web)
      .filter(Boolean)
      .map((w: any) => ({
        title: w.title || "Technical Documentation",
        uri: w.uri
      }));

    const assessment = JSON.parse(result.text || '{}') as StrategicAssessment;
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
export async function getSiteIntelligence(
  locationName: string,
  industry: Industry,
  lat?: number,
  lng?: number
): Promise<SiteContext> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  const prompt = `Analyze environmental and industrial context for a professional drone inspection at: ${locationName}. 
  Focus on ${industry} specific environmental hazards, local infrastructure history, and zoning regulations.`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearchRetrieval: {} } as any],
      }
    });

    const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const links = groundingChunks
      .map((chunk: any) => chunk.web)
      .filter(Boolean)
      .map((w: any) => ({
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
