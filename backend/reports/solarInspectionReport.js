/**
 * Axis Mapping Engine - Solar Report Aggregator
 * Processes data arrays matching the strict NEC/IEC Solar Analysis Engine.
 */

const SEVERITY_WEIGHTS = {
    CRITICAL: 10,
    HIGH: 5,
    MEDIUM: 2,
    LOW: 1,
    NORMAL: 0
};

export function generateSolarInspectionReport(allIssues) {
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let normalCount = 0;

    let totalScorePenalty = 0;

    const criticalIssues = [];

    // Aggregate counts and compute penalties
    for (const issue of allIssues) {
        const sev = (issue.severity || 'NORMAL').toUpperCase();
        
        switch(sev) {
            case 'CRITICAL':
                criticalCount++;
                criticalIssues.push(issue);
                break;
            case 'HIGH':
                highCount++;
                break;
            case 'MEDIUM':
                mediumCount++;
                break;
            case 'LOW':
                lowCount++;
                break;
            default:
                normalCount++;
        }

        totalScorePenalty += (SEVERITY_WEIGHTS[sev] || 0);
    }

    const totalIssuesClassified = criticalCount + highCount + mediumCount + lowCount;
    
    // Scale penalty (max impact cap at 100)
    let healthScore = 100 - totalScorePenalty;
    if (healthScore < 0) healthScore = 0;

    return {
        executiveSummary: \`Axis Solar Inspection Analysis complete. Evaluated \${allIssues.length} points of interest indicating \${totalIssuesClassified} classified anomalies. Site Health Score: \${healthScore}/100.\`,
        siteHealthScore: healthScore,
        counts: {
            total: allIssues.length,
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
            low: lowCount,
            normal: normalCount
        },
        criticalIssues,
        diagnostics: "Diagnostics completed per NEC (NFPA 70) specifications using Axis Mapping Engine AI pipeline.",
        timestamp: new Date().toISOString()
    };
}
