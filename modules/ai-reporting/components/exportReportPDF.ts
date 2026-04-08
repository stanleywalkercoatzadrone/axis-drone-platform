import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ClaimsReport, ClaimsImage, ClaimsAnnotation } from '../EnterpriseAIReporting';
import { saveReport } from '../utils/reportStorage';

// ─── PDF Engine ───────────────────────────────────────────────────────────────

export const exportReportPDF = async (report: ClaimsReport): Promise<void> => {
    const container = document.createElement('div');
    container.style.cssText = [
        'position:fixed', 'top:-99999px', 'left:-99999px',
        'width:816px', 'background:#fff',
        'font-family:Arial,Helvetica,sans-serif', 'color:#111827', 'z-index:-1'
    ].join(';');
    container.innerHTML = buildFullReport(report);
    document.body.appendChild(container);

    try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
        // letter = 612×792pt; at 96dpi → 816×1056px
        const PW_PX = 816;
        const PH_PX = 1056;
        const PW_PT = 612;
        const PH_PT = 792;

        const pages = container.querySelectorAll<HTMLElement>('.pdf-page');

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) pdf.addPage();
            const canvas = await html2canvas(pages[i], {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: PW_PX,
                height: PH_PX,
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.93);
            pdf.addImage(imgData, 'JPEG', 0, 0, PW_PT, PH_PT);
        }

        const slug = (report.claimNumber || report.id || 'report')
            .replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const filename = `claims-report-${slug}.pdf`;

        // Save to archive before downloading
        try {
            const buf = pdf.output('arraybuffer');
            saveReport('insurance', report.title || `Claim ${report.claimNumber || ''}`, filename, buf);
        } catch { /* non-fatal */ }

        pdf.save(filename);
    } finally {
        document.body.removeChild(container);
    }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const $ = (n?: number | null) =>
    n != null && n > 0 ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

const pct = (n?: number) =>
    n != null ? `${Math.round(n * 100)}%` : '—';

const sev = (s: string) => ({
    Critical: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', dot: '#dc2626' },
    High: { bg: '#fff7ed', border: '#fdba74', text: '#ea580c', dot: '#ea580c' },
    Medium: { bg: '#fefce8', border: '#fde047', text: '#ca8a04', dot: '#ca8a04' },
    Low: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', dot: '#16a34a' },
}[s] || { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280', dot: '#6b7280' });

const riskLabel = (score: number) =>
    score >= 75 ? 'SEVERE' : score >= 50 ? 'HIGH' : score >= 25 ? 'MODERATE' : 'LOW';

const riskColor = (score: number) =>
    score >= 75 ? '#dc2626' : score >= 50 ? '#ea580c' : score >= 25 ? '#ca8a04' : '#16a34a';

const today = () => new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
});

const pageStyle = `
    width:816px; height:1056px; overflow:hidden; position:relative;
    background:#fff; box-sizing:border-box;
`;

const sectionHead = (title: string, sub?: string) => `
    <div style="margin-bottom:18px; padding-bottom:10px; border-bottom:2px solid #e5e7eb;">
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin:0 0 4px;">${sub || 'Section'}</p>
        <h2 style="font-size:18px;font-weight:800;color:#111827;margin:0;">${title}</h2>
    </div>`;

const headerBar = (report: ClaimsReport, pageNum: number, totalPages: number) => `
    <div style="background:#1e1b4b;padding:10px 36px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:24px;height:24px;background:#f97316;border-radius:5px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:13px;">A</div>
            <span style="font-size:9px;font-weight:700;letter-spacing:2px;color:#f97316;text-transform:uppercase;">Prism Axis ${report.industry || 'Enterprise'} Solutions</span>
        </div>
        <div style="display:flex;align-items:center;gap:24px;">
            <span style="font-size:9px;color:rgba(255,255,255,0.5);">${report.claimNumber ? `Claim #${report.claimNumber}` : ''}</span>
            <span style="font-size:9px;color:rgba(255,255,255,0.5);">Page ${pageNum} of ${totalPages}</span>
        </div>
    </div>`;

const footerBar = (report: ClaimsReport) => `
    <div style="position:absolute;bottom:0;left:0;right:0;background:#f9fafb;border-top:1px solid #e5e7eb;padding:8px 36px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:8px;color:#9ca3af;">CONFIDENTIAL — For authorized use only. AI-assisted analysis. Verify with licensed adjuster.</span>
        <span style="font-size:8px;color:#9ca3af;">Generated ${today()}</span>
    </div>`;

// ─── Full Report Builder ───────────────────────────────────────────────────────

const buildFullReport = (report: ClaimsReport): string => {
    const images = report.images || [];
    const allAnnotations = images.flatMap(img => img.annotations || []);
    const criticals = allAnnotations.filter(a => a.severity === 'Critical');
    const highs = allAnnotations.filter(a => a.severity === 'High');
    const mediums = allAnnotations.filter(a => a.severity === 'Medium');
    const lows = allAnnotations.filter(a => a.severity === 'Low');
    const stormRelated = allAnnotations.filter(a => a.isStormRelated === 'Yes');
    const preExisting = allAnnotations.filter(a => a.isStormRelated === 'No');
    const totalMin = allAnnotations.reduce((s, a) => s + (a.estimatedCostMin || 0), 0);
    const totalMax = allAnnotations.reduce((s, a) => s + (a.estimatedCostMax || 0), 0);
    const avgDamageScore = images.length > 0
        ? Math.round(images.reduce((s, img) => s + (img.damageScore || 0), 0) / images.length)
        : 0;
    const score = report.riskScore || 0;
    const rc = riskColor(score);

    // Count pages needed for findings (4 per page)
    const findingsPages = Math.ceil(allAnnotations.length / 4) || 0;
    // Count pages needed for image analysis (2 per page)
    const imagePages = Math.ceil(images.length / 2) || 0;
    const totalPages = 3 + findingsPages + imagePages; // cover + summary + details + findings + images

    let pages = '';

    // ── PAGE 1: COVER ──────────────────────────────────────────────────────────
    pages += `
    <div class="pdf-page" style="${pageStyle} background: #0B1121;">
        <!-- High-End Isometric Cover Background -->
        <div style="position:absolute;top:0;left:0;right:0;height:100%;overflow:hidden;z-index:0;">
            <!-- Ambient Glows -->
            <div style="position:absolute;top:-150px;right:-100px;width:700px;height:700px;border-radius:50%;background:rgba(249,115,22,0.12);filter:blur(90px);"></div>
            <div style="position:absolute;bottom:0px;left:-200px;width:800px;height:800px;border-radius:50%;background:rgba(99,102,241,0.08);filter:blur(120px);"></div>
            <!-- Isometric Grid Map Pattern Background -->
            <div style="position:absolute;top:0;left:0;right:0;height:100%;background-image:linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);background-size:40px 40px;transform:rotateX(60deg) scale(2);transform-origin:top;"></div>
            <div style="position:absolute;top:0;left:0;right:0;height:100%;background:linear-gradient(to bottom, transparent 10%, #0B1121 90%);"></div>
        </div>

        <div style="position:relative;z-index:10;display:flex;flex-direction:column;height:100%;padding:60px;">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="display:flex;align-items:center;gap:14px;">
                    <div style="width:44px;height:44px;background:linear-gradient(135deg, #f97316, #dc2626);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:24px;box-shadow:0 10px 20px rgba(249,115,22,0.3);">A</div>
                    <div>
                        <p style="font-size:14px;font-weight:900;letter-spacing:4px;color:#fff;margin:0;">PRISM AXIS</p>
                        <p style="font-size:10px;color:#f97316;letter-spacing:1px;margin:0;font-weight:700;">ENTERPRISE CLAIMS AI</p>
                    </div>
                </div>
                <div style="text-align:right;">
                    <p style="font-size:10px;font-weight:800;letter-spacing:2px;color:#e2e8f0;margin:0;text-transform:uppercase;">Confidential</p>
                    <p style="font-size:9px;color:#94a3b8;font-family:monospace;letter-spacing:1px;">CLAIM ID: ${report.claimNumber || 'PENDING'}</p>
                </div>
            </div>

            <!-- Title Area -->
            <div style="margin-top:auto;margin-bottom:60px;">
                <div style="display:inline-block;border:1px solid rgba(249,115,22,0.4);border-radius:100px;padding:6px 16px;background:rgba(249,115,22,0.1);color:#fbcfe8;font-size:10px;font-weight:800;letter-spacing:2px;color:#f97316;text-transform:uppercase;margin-bottom:20px;">
                    Neural Claims Report — Level ${riskLabel(score)}
                </div>
                <h1 style="font-size:42px;font-weight:900;color:#fff;margin:0 0 16px;line-height:1.1;letter-spacing:-1px;">${report.title || 'Property Damage Inspection'}</h1>
                <p style="font-size:18px;color:#cbd5e1;font-weight:500;margin:0;">Location: <span style="color:#fff;font-weight:800;">${report.propertyAddress || 'TBD'}</span></p>
            </div>

            <!-- Dashboard Glass Panel -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px); border-radius: 16px; padding: 24px; display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:24px;">
                <!-- Summary Text -->
                <div style="border-right:1px solid rgba(255,255,255,0.1);padding-right:24px;">
                    <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Executive Summary</p>
                    <p style="font-size:12px;color:#cbd5e1;line-height:1.6;margin:0;">${report.executiveSummary || 'AI analysis completed across asset. Damage parameters established.'}</p>
                </div>
                
                <!-- Financial Impact -->
                <div style="border-right:1px solid rgba(255,255,255,0.1);padding-right:24px;display:flex;flex-direction:column;justify-content:center;">
                    <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Est. Total Claim Value</p>
                    <p style="font-size:24px;font-weight:900;color:#f97316;font-family:monospace;margin:0;letter-spacing:-1px;">${report.totalDamageEstimate > 0 ? `${$(report.totalDamageEstimate)}` : '$—'}</p>
                    <p style="font-size:10px;color:#64748b;margin-top:2px;">AI Baseline Estimate</p>
                </div>

                <!-- SVG Donut Chart for Score -->
                <div style="display:flex;align-items:center;gap:16px;">
                    <svg width="64" height="64" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="transparent" stroke="rgba(255,255,255,0.1)" stroke-width="4"></circle>
                        <circle cx="18" cy="18" r="16" fill="transparent" stroke="${rc}" stroke-width="4" stroke-dasharray="${score} 100" stroke-dashoffset="-25"></circle>
                        <text x="18" y="21.5" fill="#fff" font-size="10" font-weight="900" font-family="Arial" text-anchor="middle">${score}</text>
                    </svg>
                    <div>
                        <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 2px;">Risk Score</p>
                        <p style="font-size:16px;font-weight:900;color:${rc};margin:0;text-transform:uppercase;">${riskLabel(score)}</p>
                    </div>
                </div>
            </div>

            <!-- Footer Meta -->
            <div style="margin-top:24px;display:flex;justify-content:space-between;color:#64748b;font-size:10px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">
                <p>CARRIER: ${report.carrier || 'N/A'}</p>
                <p>ADJUSTER: ${report.adjusterName || 'N/A'}</p>
                <p>GENERATED: ${today()}</p>
            </div>
        </div>
    </div>`;

    // ── PAGE 2: EXECUTIVE SUMMARY + RECOMMENDATIONS ────────────────────────────
    pages += `
    <div class="pdf-page" style="${pageStyle}">
        ${headerBar(report, 2, totalPages)}
        <div style="padding:32px 56px 80px;">
            ${sectionHead('Executive Summary & Findings Overview', 'Report Summary')}

            ${report.executiveSummary ? `
            <div style="background:#f8fafc;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
                <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;margin:0 0 8px;">Executive Summary</p>
                <p style="font-size:12px;color:#374151;line-height:1.75;margin:0;">${report.executiveSummary}</p>
            </div>` : ''}

            <!-- Damage Breakdown -->
            <div style="margin-bottom:24px;">
                <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#374151;margin:0 0 12px;">Damage Classification</p>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
                    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px;">
                        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#dc2626;margin:0 0 6px;">Storm-Related Damage</p>
                        <p style="font-size:24px;font-weight:900;color:#dc2626;margin:0;">${stormRelated.length}</p>
                        <p style="font-size:10px;color:#6b7280;margin:4px 0 0;">findings attributed to storm</p>
                    </div>
                    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:14px;">
                        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ea580c;margin:0 0 6px;">Pre-Existing Conditions</p>
                        <p style="font-size:24px;font-weight:900;color:#ea580c;margin:0;">${preExisting.length}</p>
                        <p style="font-size:10px;color:#6b7280;margin:4px 0 0;">pre-existing damage noted</p>
                    </div>
                    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px;">
                        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;margin:0 0 6px;">Avg. Damage Score</p>
                        <p style="font-size:24px;font-weight:900;color:#16a34a;margin:0;">${avgDamageScore}</p>
                        <p style="font-size:10px;color:#6b7280;margin:4px 0 0;">out of 100 across all images</p>
                    </div>
                </div>
            </div>

            <!-- Cost Summary -->
            ${totalMin > 0 ? `
            <div style="background:#1e1b4b;border-radius:12px;padding:20px 24px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.5);margin:0 0 4px;">Total Estimated Repair Cost Range</p>
                    <p style="font-size:26px;font-weight:900;color:#fff;margin:0;">${$(totalMin)} <span style="color:rgba(255,255,255,0.4);">—</span> ${$(totalMax)}</p>
                </div>
                <div style="text-align:right;">
                    <p style="font-size:9px;color:rgba(255,255,255,0.5);margin:0 0 4px;">Based on ${allAnnotations.length} AI-identified findings</p>
                    <p style="font-size:9px;color:rgba(255,255,255,0.5);margin:0;">Costs are preliminary estimates</p>
                </div>
            </div>` : ''}

            <!-- Recommendations -->
            ${(report.recommendations || []).length > 0 ? `
            <div>
                <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#374151;margin:0 0 12px;">Adjuster Recommendations</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${(report.recommendations || []).map((r, i) => `
                    <div style="display:flex;align-items:flex-start;gap:10px;background:#f9fafb;border-radius:8px;padding:12px;">
                        <div style="width:20px;height:20px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;font-weight:900;color:#fff;">${i + 1}</div>
                        <p style="font-size:11px;color:#374151;line-height:1.5;margin:0;">${r}</p>
                    </div>`).join('')}
                </div>
            </div>` : ''}
        </div>
        ${footerBar(report)}
    </div>`;

    // ── PAGE 3: FINDINGS DETAIL TABLE ──────────────────────────────────────────
    // Chunk annotations 4 per page
    const FINDINGS_PER_PAGE = 4;
    for (let p = 0; p < Math.max(1, Math.ceil(allAnnotations.length / FINDINGS_PER_PAGE)); p++) {
        const chunk = allAnnotations.slice(p * FINDINGS_PER_PAGE, (p + 1) * FINDINGS_PER_PAGE);
        const pageNum = 3 + p;
        pages += `
        <div class="pdf-page" style="${pageStyle}">
            ${headerBar(report, pageNum, totalPages)}
            <div style="padding:28px 56px 80px;">
                ${p === 0 ? sectionHead(`AI Damage Findings (${allAnnotations.length} Total)`, 'Detailed Findings') : `<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 20px;">Findings (continued)</p>`}

                ${chunk.length === 0 ? `
                <div style="background:#f9fafb;border-radius:12px;padding:40px;text-align:center;">
                    <p style="font-size:14px;color:#9ca3af;">No AI findings recorded. Run AI Analysis on uploaded images to generate findings.</p>
                </div>` : chunk.map((a, idx) => {
            const s = sev(a.severity);
            const globalIdx = p * FINDINGS_PER_PAGE + idx + 1;
            return `
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:12px;border-left:4px solid ${s.dot};">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-size:10px;font-weight:700;color:#9ca3af;">#${globalIdx}</span>
                            <h3 style="font-size:13px;font-weight:800;color:#111827;margin:0;">${a.label}</h3>
                            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;background:${s.bg};border:1px solid ${s.border};color:${s.text};">${a.severity}</span>
                        </div>
                        <div style="text-align:right;flex-shrink:0;">
                            ${(a.estimatedCostMin || 0) > 0 ? `<p style="font-size:13px;font-weight:900;color:#111827;margin:0;">${$(a.estimatedCostMin)} – ${$(a.estimatedCostMax)}</p><p style="font-size:9px;color:#9ca3af;margin:2px 0 0;">Estimated Cost Range</p>` : ''}
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;">
                        <div>
                            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 3px;">Description</p>
                            <p style="font-size:11px;color:#374151;line-height:1.5;margin:0;">${a.description || '—'}</p>
                        </div>
                        <div>
                            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 3px;">Location</p>
                            <p style="font-size:11px;color:#374151;margin:0;">${a.location || '—'}</p>
                        </div>
                        <div>
                            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 3px;">Storm-Related</p>
                            <p style="font-size:11px;font-weight:700;color:${a.isStormRelated === 'Yes' ? '#dc2626' : a.isStormRelated === 'No' ? '#16a34a' : '#9ca3af'};margin:0;">${a.isStormRelated || 'Uncertain'}</p>
                        </div>
                        <div>
                            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 3px;">AI Confidence</p>
                            <p style="font-size:11px;font-weight:700;color:#374151;margin:0;">${pct(a.confidence)}</p>
                        </div>
                    </div>
                    ${(a.xactimateCode || a.recommendedAction) ? `
                    <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;margin-top:10px;padding-top:10px;border-top:1px solid #f3f4f6;">
                        ${a.xactimateCode ? `<div><p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 3px;">Xactimate Code</p><p style="font-size:11px;font-family:monospace;font-weight:700;color:#6366f1;margin:0;">${a.xactimateCode}</p></div>` : '<div></div>'}
                        ${a.recommendedAction ? `<div><p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 3px;">Recommended Action</p><p style="font-size:11px;color:#374151;margin:0;">${a.recommendedAction}</p></div>` : ''}
                    </div>` : ''}
                </div>`;
        }).join('')}

                ${p === Math.ceil(allAnnotations.length / FINDINGS_PER_PAGE) - 1 && totalMin > 0 ? `
                <div style="background:#f9fafb;border-radius:10px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border:1px solid #e5e7eb;">
                    <span style="font-size:12px;font-weight:700;color:#374151;">Total Estimated Damage Range</span>
                    <span style="font-size:16px;font-weight:900;color:#111827;font-family:monospace;">${$(totalMin)} – ${$(totalMax)}</span>
                </div>` : ''}
            </div>
            ${footerBar(report)}
        </div>`;
    }

    // ── IMAGE ANALYSIS PAGES (2 per page) ─────────────────────────────────────
    const IMAGES_PER_PAGE = 2;
    for (let p = 0; p < Math.max(1, Math.ceil(images.length / IMAGES_PER_PAGE)); p++) {
        const chunk = images.slice(p * IMAGES_PER_PAGE, (p + 1) * IMAGES_PER_PAGE);
        const pageNum = 3 + Math.ceil(allAnnotations.length / FINDINGS_PER_PAGE) + p;
        pages += `
        <div class="pdf-page" style="${pageStyle}">
            ${headerBar(report, pageNum, totalPages)}
            <div style="padding:28px 56px 80px;">
                ${p === 0 ? sectionHead(`Image Analysis (${images.length} Images)`, 'Per-Image Findings') : `<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 20px;">Image Analysis (continued)</p>`}

                ${chunk.length === 0 ? `
                <div style="background:#f9fafb;border-radius:12px;padding:40px;text-align:center;">
                    <p style="font-size:14px;color:#9ca3af;">No images uploaded for this report.</p>
                </div>` : chunk.map((img, idx) => {
            const imgAnnotations = img.annotations || [];
            const imgCriticals = imgAnnotations.filter(a => a.severity === 'Critical').length;
            const imgHighs = imgAnnotations.filter(a => a.severity === 'High').length;
            const imgMin = imgAnnotations.reduce((s, a) => s + (a.estimatedCostMin || 0), 0);
            const imgMax = imgAnnotations.reduce((s, a) => s + (a.estimatedCostMax || 0), 0);
            const globalIdx = p * IMAGES_PER_PAGE + idx + 1;
            return `
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:16px;">
                    <!-- Image header -->
                    <div style="background:#f9fafb;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;">
                        <div>
                            <p style="font-size:9px;color:#9ca3af;margin:0 0 2px;">Image ${globalIdx} of ${images.length}</p>
                            <p style="font-size:12px;font-weight:700;color:#111827;margin:0;">${img.originalName || `Image ${globalIdx}`}</p>
                        </div>
                        <div style="display:flex;gap:12px;align-items:center;">
                            ${imgCriticals > 0 ? `<span style="font-size:9px;font-weight:700;color:#dc2626;background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:2px 8px;">${imgCriticals} Critical</span>` : ''}
                            ${imgHighs > 0 ? `<span style="font-size:9px;font-weight:700;color:#ea580c;background:#fff7ed;border:1px solid #fdba74;border-radius:4px;padding:2px 8px;">${imgHighs} High</span>` : ''}
                            <span style="font-size:9px;color:#6b7280;">${imgAnnotations.length} finding${imgAnnotations.length !== 1 ? 's' : ''}</span>
                            ${img.damageScore ? `<span style="font-size:9px;font-weight:700;color:#374151;">Damage Score: ${img.damageScore}/100</span>` : ''}
                        </div>
                    </div>
                    <div style="padding:16px 20px;">
                        ${img.aiSummary ? `
                        <div style="background:#f8fafc;border-left:3px solid #6366f1;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:12px;">
                            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;margin:0 0 4px;">AI Analysis Summary</p>
                            <p style="font-size:11px;color:#374151;line-height:1.6;margin:0;">${img.aiSummary}</p>
                        </div>` : ''}

                        ${imgAnnotations.length > 0 ? `
                        <table style="width:100%;border-collapse:collapse;font-size:10px;">
                            <thead>
                                <tr style="background:#f9fafb;">
                                    <th style="text-align:left;padding:6px 10px;font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:1px solid #e5e7eb;">Finding</th>
                                    <th style="text-align:center;padding:6px 10px;font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:1px solid #e5e7eb;width:70px;">Severity</th>
                                    <th style="text-align:left;padding:6px 10px;font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:1px solid #e5e7eb;">Location</th>
                                    <th style="text-align:center;padding:6px 10px;font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:1px solid #e5e7eb;width:60px;">Storm</th>
                                    <th style="text-align:center;padding:6px 10px;font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:1px solid #e5e7eb;width:55px;">Conf.</th>
                                    <th style="text-align:right;padding:6px 10px;font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:1px solid #e5e7eb;width:120px;">Est. Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${imgAnnotations.map((a, ai) => {
                const s = sev(a.severity);
                return `
                                <tr style="border-bottom:1px solid #f3f4f6;background:${ai % 2 === 0 ? '#fff' : '#fafafa'};">
                                    <td style="padding:7px 10px;">
                                        <p style="font-size:10px;font-weight:700;color:#111827;margin:0;">${a.label}</p>
                                        ${a.xactimateCode ? `<p style="font-size:9px;color:#6366f1;font-family:monospace;margin:1px 0 0;">${a.xactimateCode}</p>` : ''}
                                    </td>
                                    <td style="text-align:center;padding:7px 10px;">
                                        <span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:8px;font-weight:800;text-transform:uppercase;background:${s.bg};border:1px solid ${s.border};color:${s.text};">${a.severity}</span>
                                    </td>
                                    <td style="padding:7px 10px;font-size:10px;color:#374151;">${a.location || '—'}</td>
                                    <td style="text-align:center;padding:7px 10px;font-size:10px;font-weight:700;color:${a.isStormRelated === 'Yes' ? '#dc2626' : a.isStormRelated === 'No' ? '#16a34a' : '#9ca3af'};">${a.isStormRelated || '?'}</td>
                                    <td style="text-align:center;padding:7px 10px;font-size:10px;color:#374151;">${pct(a.confidence)}</td>
                                    <td style="text-align:right;padding:7px 10px;font-size:10px;font-family:monospace;color:#374151;">${(a.estimatedCostMin || 0) > 0 ? `${$(a.estimatedCostMin)}–${$(a.estimatedCostMax)}` : '—'}</td>
                                </tr>`;
            }).join('')}
                            </tbody>
                            ${imgMin > 0 ? `
                            <tfoot>
                                <tr style="background:#f9fafb;border-top:2px solid #e5e7eb;">
                                    <td colspan="5" style="padding:8px 10px;font-size:10px;font-weight:700;color:#374151;text-align:right;">Image Subtotal</td>
                                    <td style="padding:8px 10px;font-size:11px;font-weight:900;color:#111827;text-align:right;font-family:monospace;">${$(imgMin)}–${$(imgMax)}</td>
                                </tr>
                            </tfoot>` : ''}
                        </table>` : `<p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">No findings for this image.</p>`}
                    </div>
                </div>`;
        }).join('')}
            </div>
            ${footerBar(report)}
        </div>`;
    }

    return `
    <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:Arial,Helvetica,sans-serif; }
        .pdf-page { page-break-after:always; }
    </style>
    ${pages}`;
};
