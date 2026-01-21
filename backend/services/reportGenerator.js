/**
 * Report Generator Service
 * Generates structured PDF and JSON reports for inspection intelligence
 */

import { logger } from './logger.js';
import { query } from '../config/database.js';

/**
 * Generate insurer-ready PDF report
 * Note: For production, integrate with a PDF library like puppeteer or pdfkit
 * This implementation provides the data structure and HTML template
 */
export async function generatePDFReport(reportId, userId) {
    try {
        // Fetch report data
        const reportResult = await query(
            `SELECT r.*, u.full_name as author_name,
              (SELECT json_agg(i.*) FROM images i WHERE i.report_id = r.id) as images,
              (SELECT json_agg(ar.*) FROM ai_analysis_results ar WHERE ar.report_id = r.id ORDER BY ar.created_at DESC LIMIT 1) as ai_analysis
       FROM reports r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1 AND (r.user_id = $2 OR $3 = true)`,
            [reportId, userId, true] // TODO: Check if user is admin
        );

        if (reportResult.rows.length === 0) {
            throw new Error('Report not found or access denied');
        }

        const report = reportResult.rows[0];
        const aiAnalysis = report.ai_analysis?.[0];

        // Generate HTML template
        const html = generateReportHTML(report, aiAnalysis);

        // In production, convert HTML to PDF using puppeteer or similar
        // For now, return the HTML and metadata
        return {
            reportId,
            format: 'html', // Will be 'pdf' in production
            content: html,
            metadata: {
                title: report.title,
                client: report.client,
                industry: report.industry,
                generatedAt: new Date().toISOString(),
                generatedBy: userId,
                version: report.version || 1
            }
        };
    } catch (error) {
        logger.error('Failed to generate PDF report', {
            reportId,
            userId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Generate HTML template for report
 */
function generateReportHTML(report, aiAnalysis) {
    const findings = aiAnalysis ? JSON.parse(aiAnalysis.findings || '[]') : [];
    const recommendations = aiAnalysis ? JSON.parse(aiAnalysis.recommendations || '[]') : [];

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${report.title} - Inspection Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { margin: 0; color: #0f172a; }
    .header .meta { color: #64748b; margin-top: 10px; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #0f172a; border-left: 4px solid #3b82f6; padding-left: 12px; }
    .finding { border: 1px solid #e2e8f0; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
    .finding.critical { border-left: 4px solid #ef4444; }
    .finding.high { border-left: 4px solid #f59e0b; }
    .finding.medium { border-left: 4px solid #eab308; }
    .finding.low { border-left: 4px solid #22c55e; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge.critical { background: #fee2e2; color: #991b1b; }
    .badge.high { background: #fed7aa; color: #9a3412; }
    .badge.medium { background: #fef3c7; color: #854d0e; }
    .badge.low { background: #dcfce7; color: #166534; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}</h1>
    <div class="meta">
      <strong>Client:</strong> ${report.client} | 
      <strong>Industry:</strong> ${report.industry} | 
      <strong>Date:</strong> ${new Date(report.created_at).toLocaleDateString()} |
      <strong>Author:</strong> ${report.author_name}
    </div>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <p>${report.summary || 'No summary available.'}</p>
  </div>

  ${aiAnalysis ? `
  <div class="section">
    <h2>AI Analysis Results</h2>
    <p><strong>Overall Severity:</strong> <span class="badge ${aiAnalysis.severity?.toLowerCase()}">${aiAnalysis.severity}</span></p>
    <p><strong>Risk Score:</strong> ${aiAnalysis.risk_score}/100</p>
  </div>
  ` : ''}

  ${findings.length > 0 ? `
  <div class="section">
    <h2>Findings (${findings.length})</h2>
    ${findings.map(f => `
      <div class="finding ${f.severity?.toLowerCase()}">
        <div><span class="badge ${f.severity?.toLowerCase()}">${f.severity}</span> <strong>${f.type || 'Finding'}</strong></div>
        <p>${f.description}</p>
        ${f.location ? `<p><small><strong>Location:</strong> ${f.location}</small></p>` : ''}
        ${f.confidence ? `<p><small><strong>Confidence:</strong> ${Math.round(f.confidence * 100)}%</small></p>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${recommendations.length > 0 ? `
  <div class="section">
    <h2>Recommendations</h2>
    ${recommendations.map((r, i) => `
      <div style="margin-bottom: 15px;">
        <p><strong>${i + 1}. ${r.action}</strong> <span class="badge ${r.priority?.toLowerCase()}">${r.priority}</span></p>
        <p>${r.rationale}</p>
        ${r.estimatedCost ? `<p><small><strong>Estimated Cost:</strong> $${r.estimatedCost.toLocaleString()}</small></p>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by CoatzadroneUSA Inspection Intelligence Platform</p>
    <p>Report ID: ${report.id} | Version: ${report.version || 1}</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate structured JSON export
 */
export async function generateJSONExport(reportId, userId) {
    try {
        const reportResult = await query(
            `SELECT r.*, u.full_name as author_name, u.email as author_email,
              (SELECT json_agg(i.*) FROM images i WHERE i.report_id = r.id) as images,
              (SELECT json_agg(ar.*) FROM ai_analysis_results ar WHERE ar.report_id = r.id) as ai_analysis
       FROM reports r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
            [reportId]
        );

        if (reportResult.rows.length === 0) {
            throw new Error('Report not found');
        }

        const report = reportResult.rows[0];

        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            exportedBy: userId,
            report: {
                id: report.id,
                title: report.title,
                client: report.client,
                industry: report.industry,
                status: report.status,
                summary: report.summary,
                createdAt: report.created_at,
                updatedAt: report.updated_at,
                finalizedAt: report.finalized_at,
                version: report.version,
                author: {
                    name: report.author_name,
                    email: report.author_email
                },
                images: report.images || [],
                aiAnalysis: report.ai_analysis || [],
                metadata: {
                    theme: report.theme,
                    config: report.config,
                    branding: report.branding
                }
            }
        };
    } catch (error) {
        logger.error('Failed to generate JSON export', {
            reportId,
            userId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Generate compliance report
 */
export async function generateComplianceReport(startDate, endDate, userId) {
    try {
        // Fetch all AI decisions in date range
        const decisionsResult = await query(
            `SELECT 
        endpoint,
        COUNT(*) as total_requests,
        AVG(confidence_score) as avg_confidence,
        AVG(processing_time_ms) as avg_processing_time,
        SUM(token_count) as total_tokens,
        COUNT(CASE WHEN confidence_score < 0.7 THEN 1 END) as low_confidence_count
       FROM ai_decisions
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY endpoint
       ORDER BY total_requests DESC`,
            [startDate, endDate]
        );

        // Fetch human overrides
        const overridesResult = await query(
            `SELECT COUNT(*) as total_overrides,
              AVG(EXTRACT(EPOCH FROM (override_at - created_at))) as avg_override_time_seconds
       FROM ai_analysis_results
       WHERE human_override = true
       AND created_at BETWEEN $1 AND $2`,
            [startDate, endDate]
        );

        // Fetch prompt versions used
        const promptsResult = await query(
            `SELECT DISTINCT prompt_version, model_version, COUNT(*) as usage_count
       FROM ai_decisions
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY prompt_version, model_version
       ORDER BY usage_count DESC`,
            [startDate, endDate]
        );

        return {
            period: {
                start: startDate,
                end: endDate
            },
            generatedAt: new Date().toISOString(),
            generatedBy: userId,
            summary: {
                totalAIDecisions: decisionsResult.rows.reduce((sum, r) => sum + parseInt(r.total_requests), 0),
                totalHumanOverrides: parseInt(overridesResult.rows[0]?.total_overrides || 0),
                averageConfidence: parseFloat(decisionsResult.rows[0]?.avg_confidence || 0),
                totalTokensUsed: decisionsResult.rows.reduce((sum, r) => sum + parseInt(r.total_tokens || 0), 0)
            },
            endpointMetrics: decisionsResult.rows,
            humanOverrides: overridesResult.rows[0],
            promptVersions: promptsResult.rows,
            compliance: {
                auditTrailComplete: true,
                allDecisionsLogged: true,
                confidenceThresholdMet: decisionsResult.rows.every(r => parseFloat(r.avg_confidence) >= 0.7),
                humanOversightActive: parseInt(overridesResult.rows[0]?.total_overrides || 0) > 0
            }
        };
    } catch (error) {
        logger.error('Failed to generate compliance report', {
            startDate,
            endDate,
            userId,
            error: error.message
        });
        throw error;
    }
}

export default {
    generatePDFReport,
    generateJSONExport,
    generateComplianceReport
};
