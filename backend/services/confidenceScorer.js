/**
 * Confidence Scorer
 * Calculates multi-factor confidence scores for AI decisions
 */

import { logger } from './logger.js';

/**
 * Confidence thresholds
 */
const THRESHOLDS = {
    HIGH: 0.85,
    MEDIUM: 0.70,
    LOW: 0.50,
    MINIMUM: 0.30 // Below this, reject the result
};

/**
 * Calculate confidence score for inspection analysis
 */
export function scoreInspectionAnalysis(analysis, metadata = {}) {
    const factors = [];
    let totalWeight = 0;
    let weightedSum = 0;

    // Factor 1: Finding confidence (40% weight)
    if (analysis.findings && analysis.findings.length > 0) {
        const avgFindingConfidence = analysis.findings.reduce((sum, f) =>
            sum + (f.confidence || 0.5), 0) / analysis.findings.length;

        factors.push({
            name: 'finding_confidence',
            score: avgFindingConfidence,
            weight: 0.4,
            description: 'Average confidence of individual findings'
        });

        weightedSum += avgFindingConfidence * 0.4;
        totalWeight += 0.4;
    }

    // Factor 2: Schema completeness (20% weight)
    const requiredFields = ['findings', 'severity', 'riskScore', 'recommendations'];
    const presentFields = requiredFields.filter(field => analysis[field] !== undefined);
    const completeness = presentFields.length / requiredFields.length;

    factors.push({
        name: 'schema_completeness',
        score: completeness,
        weight: 0.2,
        description: 'Completeness of required fields'
    });

    weightedSum += completeness * 0.2;
    totalWeight += 0.2;

    // Factor 3: Data quality (20% weight)
    let qualityScore = 1.0;

    // Penalize if risk score is inconsistent with severity
    if (analysis.severity && analysis.riskScore !== undefined) {
        const severityRiskMap = {
            'LOW': [0, 25],
            'MEDIUM': [25, 60],
            'HIGH': [60, 85],
            'CRITICAL': [85, 100]
        };

        const expectedRange = severityRiskMap[analysis.severity];
        if (expectedRange) {
            const [min, max] = expectedRange;
            if (analysis.riskScore < min || analysis.riskScore > max) {
                qualityScore *= 0.7; // 30% penalty for inconsistency
            }
        }
    }

    factors.push({
        name: 'data_quality',
        score: qualityScore,
        weight: 0.2,
        description: 'Internal consistency of analysis'
    });

    weightedSum += qualityScore * 0.2;
    totalWeight += 0.2;

    // Factor 4: Processing metadata (20% weight)
    let metadataScore = 0.8; // Default

    if (metadata.processingTime) {
        // Penalize very fast responses (likely low quality)
        if (metadata.processingTime < 1000) {
            metadataScore *= 0.8;
        }
        // Penalize very slow responses (timeout risk)
        if (metadata.processingTime > 30000) {
            metadataScore *= 0.9;
        }
    }

    factors.push({
        name: 'processing_metadata',
        score: metadataScore,
        weight: 0.2,
        description: 'Processing quality indicators'
    });

    weightedSum += metadataScore * 0.2;
    totalWeight += 0.2;

    // Calculate final score
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Determine confidence level
    let level = 'VERY_LOW';
    if (overallScore >= THRESHOLDS.HIGH) level = 'HIGH';
    else if (overallScore >= THRESHOLDS.MEDIUM) level = 'MEDIUM';
    else if (overallScore >= THRESHOLDS.LOW) level = 'LOW';

    const result = {
        overall: Math.round(overallScore * 10000) / 10000, // 4 decimal places
        level,
        factors,
        meetsMinimum: overallScore >= THRESHOLDS.MINIMUM
    };

    logger.debug('Confidence score calculated', {
        overall: result.overall,
        level: result.level,
        factorCount: factors.length
    });

    return result;
}

/**
 * Calculate confidence for anomaly detection
 */
export function scoreAnomalyDetection(detection, metadata = {}) {
    const factors = [];
    let totalWeight = 0;
    let weightedSum = 0;

    // Factor 1: Anomaly confidence (50% weight)
    if (detection.anomalies && detection.anomalies.length > 0) {
        const avgConfidence = detection.anomalies.reduce((sum, a) =>
            sum + (a.confidence || 0.5), 0) / detection.anomalies.length;

        factors.push({
            name: 'anomaly_confidence',
            score: avgConfidence,
            weight: 0.5,
            description: 'Average confidence of detected anomalies'
        });

        weightedSum += avgConfidence * 0.5;
        totalWeight += 0.5;
    } else {
        // No anomalies detected - high confidence in "clean" result
        factors.push({
            name: 'no_anomalies',
            score: 0.9,
            weight: 0.5,
            description: 'High confidence in absence of anomalies'
        });

        weightedSum += 0.9 * 0.5;
        totalWeight += 0.5;
    }

    // Factor 2: Risk consistency (30% weight)
    let consistencyScore = 1.0;

    if (detection.anomalies && detection.overallRisk) {
        const criticalCount = detection.anomalies.filter(a => a.severity === 'CRITICAL').length;
        const highCount = detection.anomalies.filter(a => a.severity === 'HIGH').length;

        // Check if overall risk matches anomaly severities
        if (detection.overallRisk === 'CRITICAL' && criticalCount === 0) {
            consistencyScore *= 0.6;
        }
        if (detection.overallRisk === 'LOW' && (criticalCount > 0 || highCount > 0)) {
            consistencyScore *= 0.6;
        }
    }

    factors.push({
        name: 'risk_consistency',
        score: consistencyScore,
        weight: 0.3,
        description: 'Consistency between anomalies and overall risk'
    });

    weightedSum += consistencyScore * 0.3;
    totalWeight += 0.3;

    // Factor 3: Processing quality (20% weight)
    const processingScore = metadata.processingTime && metadata.processingTime < 15000 ? 0.9 : 0.7;

    factors.push({
        name: 'processing_quality',
        score: processingScore,
        weight: 0.2,
        description: 'Processing time and quality'
    });

    weightedSum += processingScore * 0.2;
    totalWeight += 0.2;

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    let level = 'VERY_LOW';
    if (overallScore >= THRESHOLDS.HIGH) level = 'HIGH';
    else if (overallScore >= THRESHOLDS.MEDIUM) level = 'MEDIUM';
    else if (overallScore >= THRESHOLDS.LOW) level = 'LOW';

    return {
        overall: Math.round(overallScore * 10000) / 10000,
        level,
        factors,
        meetsMinimum: overallScore >= THRESHOLDS.MINIMUM
    };
}

/**
 * Calculate confidence for mission readiness
 */
export function scoreMissionReadiness(readiness, metadata = {}) {
    const factors = [];
    let totalWeight = 0;
    let weightedSum = 0;

    // Factor 1: Risk flag severity (40% weight)
    let riskScore = 1.0;

    if (readiness.riskFlags && readiness.riskFlags.length > 0) {
        const criticalFlags = readiness.riskFlags.filter(f => f.severity === 'CRITICAL').length;
        const highFlags = readiness.riskFlags.filter(f => f.severity === 'HIGH').length;

        // Penalize based on severity
        riskScore -= (criticalFlags * 0.3 + highFlags * 0.15);
        riskScore = Math.max(0, riskScore);
    }

    factors.push({
        name: 'risk_assessment',
        score: riskScore,
        weight: 0.4,
        description: 'Quality of risk flag assessment'
    });

    weightedSum += riskScore * 0.4;
    totalWeight += 0.4;

    // Factor 2: Readiness score consistency (30% weight)
    let consistencyScore = 1.0;

    if (readiness.score !== undefined && readiness.ready !== undefined) {
        // If ready=true but score is low, penalize
        if (readiness.ready && readiness.score < 70) {
            consistencyScore *= 0.7;
        }
        // If ready=false but score is high, penalize
        if (!readiness.ready && readiness.score > 70) {
            consistencyScore *= 0.7;
        }
    }

    factors.push({
        name: 'readiness_consistency',
        score: consistencyScore,
        weight: 0.3,
        description: 'Consistency between ready flag and score'
    });

    weightedSum += consistencyScore * 0.3;
    totalWeight += 0.3;

    // Factor 3: Recommendation quality (30% weight)
    const hasRecommendations = readiness.recommendations && readiness.recommendations.length > 0;
    const recommendationScore = hasRecommendations ? 0.9 : 0.6;

    factors.push({
        name: 'recommendations',
        score: recommendationScore,
        weight: 0.3,
        description: 'Presence and quality of recommendations'
    });

    weightedSum += recommendationScore * 0.3;
    totalWeight += 0.3;

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    let level = 'VERY_LOW';
    if (overallScore >= THRESHOLDS.HIGH) level = 'HIGH';
    else if (overallScore >= THRESHOLDS.MEDIUM) level = 'MEDIUM';
    else if (overallScore >= THRESHOLDS.LOW) level = 'LOW';

    return {
        overall: Math.round(overallScore * 10000) / 10000,
        level,
        factors,
        meetsMinimum: overallScore >= THRESHOLDS.MINIMUM
    };
}

/**
 * Calculate confidence for daily management summary
 */
export function scoreDailySummary(summary, metadata = {}) {
    const factors = [];
    let totalWeight = 0;
    let weightedSum = 0;

    // Factor 1: Required detail fields (50% weight)
    const required = ['workCompleted', 'financialStatus', 'overrunAlerts', 'recommendations'];
    const presentCount = required.filter(f => summary[f] && summary[f].length > 10).length;
    const completeness = presentCount / required.length;

    factors.push({
        name: 'detail_completeness',
        score: completeness,
        weight: 0.5,
        description: 'Quality and length of required narrative fields'
    });

    weightedSum += completeness * 0.5;
    totalWeight += 0.5;

    // Factor 2: Financial clarity (30% weight)
    const hasMonetaryTerms = /\$|cost|total|pay|usd/.test(summary.financialStatus?.toLowerCase());
    const financialScore = hasMonetaryTerms ? 1.0 : 0.4;

    factors.push({
        name: 'financial_clarity',
        score: financialScore,
        weight: 0.3,
        description: 'Presence of financial data in summary'
    });

    weightedSum += financialScore * 0.3;
    totalWeight += 0.3;

    // Factor 3: LLM meta-confidence (20% weight)
    const metaScore = metadata.processingTime > 2000 ? 0.9 : 0.7;

    factors.push({
        name: 'processing_depth',
        score: metaScore,
        weight: 0.2,
        description: 'Estimated depth of reasoning based on processing'
    });

    weightedSum += metaScore * 0.2;
    totalWeight += 0.2;

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    let level = 'VERY_LOW';
    if (overallScore >= THRESHOLDS.HIGH) level = 'HIGH';
    else if (overallScore >= THRESHOLDS.MEDIUM) level = 'MEDIUM';
    else if (overallScore >= THRESHOLDS.LOW) level = 'LOW';

    return {
        overall: Math.round(overallScore * 10000) / 10000,
        level,
        factors,
        meetsMinimum: overallScore >= THRESHOLDS.MINIMUM
    };
}

/**
 * Get confidence thresholds
 */
export function getThresholds() {
    return { ...THRESHOLDS };
}

export default {
    scoreInspectionAnalysis,
    scoreAnomalyDetection,
    scoreMissionReadiness,
    scoreDailySummary,
    getThresholds
};
