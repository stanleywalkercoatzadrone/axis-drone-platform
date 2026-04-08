/**
 * Solar PDF Export utility (stub — to be expanded with full PDF generation).
 * Mirrors the structure of exportReportPDF.ts for insurance reports.
 */
import jsPDF from 'jspdf';
import { saveReport } from '../utils/reportStorage';

interface SolarPDFParams {
    form: {
        siteName: string;
        siteId: string;
        clientName: string;
        installedKw: string;
        panelCount: string;
        panelMake: string;
        inspectionDate: string;
        pilotName: string;
        flightAltitude: string;
        weatherConditions: string;
        notes: string;
    };
    findings: Array<{
        id: string;
        type: string;
        severity: string;
        location: string;
        panelId?: string;
        stringId?: string;
        temperature?: number;
        efficiency?: number;
        description: string;
        recommendation: string;
        estimatedKwhLoss?: number;
        estimatedCostMin?: number;
        estimatedCostMax?: number;
    }>;
    aiSummary: string;
    section: { title: string; badge: string; accentHex: string };
    images: string[];
}

const today = () =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const sevColor = (s: string): string =>
    ({ Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a' }[s] ?? '#6b7280');

export const exportSolarReportPDF = async (params: SolarPDFParams): Promise<void> => {
    const { form, findings, aiSummary, section } = params;

    const container = document.createElement('div');
    container.style.cssText = [
        'position:fixed', 'top:-99999px', 'left:-99999px',
        'width:816px', 'background:#fff',
        'font-family:Arial,Helvetica,sans-serif', 'color:#111827', 'z-index:-1'
    ].join(';');

    const pageStyle = [
        'width:816px', 'min-height:1056px', 'background:#fff',
        'position:relative', 'overflow:hidden', 'box-sizing:border-box'
    ].join(';');

    const totalMin = findings.reduce((s, f) => s + (f.estimatedCostMin ?? 0), 0);
    const totalMax = findings.reduce((s, f) => s + (f.estimatedCostMax ?? 0), 0);
    const criticals = findings.filter(f => f.severity === 'Critical').length;
    const $ = (n: number) => `$${n.toLocaleString()}`;

    container.innerHTML = `
    <style>
        * { box-sizing:border-box; margin:0; padding:0; font-family:'Inter', Arial, Helvetica, sans-serif; }
        .glass-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px); border-radius: 16px; padding: 24px; }
    </style>

    <!-- PAGE 1: COVER -->
    <div class="pdf-page" style="${pageStyle} background: #0B1121;">
        <!-- High-End Drone Cover Background Mock Base -->
        <div style="position:absolute;top:0;left:0;right:0;height:100%;overflow:hidden;z-index:0;">
            <!-- Ambient Glows -->
            <div style="position:absolute;top:-100px;right:-100px;width:600px;height:600px;border-radius:50%;background:rgba(245,158,11,0.15);filter:blur(80px);"></div>
            <div style="position:absolute;bottom:100px;left:-200px;width:700px;height:700px;border-radius:50%;background:rgba(234,88,12,0.1);filter:blur(100px);"></div>
            <!-- Isometric Grid Map Pattern Background -->
            <div style="position:absolute;top:0;left:0;right:0;height:100%;background-image:linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);background-size:40px 40px;transform:rotateX(60deg) scale(2);transform-origin:top;"></div>
            <div style="position:absolute;top:0;left:0;right:0;height:100%;background:linear-gradient(to bottom, transparent 20%, #0B1121 80%);"></div>
        </div>

        <div style="position:relative;z-index:10;display:flex;flex-direction:column;height:100%;padding:60px;">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="display:flex;align-items:center;gap:14px;">
                    <div style="width:44px;height:44px;background:linear-gradient(135deg, #f59e0b, #ea580c);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:24px;box-shadow:0 10px 20px rgba(245,158,11,0.3);">A</div>
                    <div>
                        <p style="font-size:14px;font-weight:900;letter-spacing:4px;color:#fff;margin:0;">PRISM AXIS</p>
                        <p style="font-size:10px;color:#f59e0b;letter-spacing:1px;margin:0;font-weight:700;">ENTERPRISE SOLAR AI</p>
                    </div>
                </div>
                <div style="text-align:right;">
                    <p style="font-size:10px;font-weight:800;letter-spacing:2px;color:#e2e8f0;margin:0;text-transform:uppercase;">Confidential</p>
                    <p style="font-size:9px;color:#94a3b8;font-family:monospace;letter-spacing:1px;">ID: ${form.siteId || 'GEN-001'}</p>
                </div>
            </div>

            <!-- Title Area -->
            <div style="margin-top:auto;margin-bottom:60px;">
                <div style="display:inline-block;border:1px solid rgba(245,158,11,0.4);border-radius:100px;padding:6px 16px;background:rgba(245,158,11,0.1);color:#fbcfe8;font-size:10px;font-weight:800;letter-spacing:2px;color:#f59e0b;text-transform:uppercase;margin-bottom:20px;">
                    Neural Diagnostics Report
                </div>
                <h1 style="font-size:42px;font-weight:900;color:#fff;margin:0 0 16px;line-height:1.1;letter-spacing:-1px;">${form.siteName || 'Solar Field Inspection'}</h1>
                <p style="font-size:18px;color:#cbd5e1;font-weight:500;margin:0;">Prepared for: <span style="color:#fff;font-weight:800;">${form.clientName || 'Stakeholders'}</span></p>
            </div>

            <!-- Dashboard Glass Panel -->
            <div class="glass-panel" style="display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:24px;">
                <!-- Summary Text -->
                <div style="border-right:1px solid rgba(255,255,255,0.1);padding-right:24px;">
                    <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Executive Summary</p>
                    <p style="font-size:12px;color:#cbd5e1;line-height:1.6;margin:0;">${aiSummary || 'AI analysis completed across full asset portfolio yielding high-accuracy anomaly detection.'}</p>
                </div>
                
                <!-- Financial Impact -->
                <div style="border-right:1px solid rgba(255,255,255,0.1);padding-right:24px;display:flex;flex-direction:column;justify-content:center;">
                    <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Est. Repair Cost</p>
                    <p style="font-size:24px;font-weight:900;color:#10b981;font-family:monospace;margin:0;letter-spacing:-1px;">${totalMin > 0 ? `${$(totalMin)}` : '$—'}</p>
                    <p style="font-size:10px;color:#64748b;margin-top:2px;">Range up to ${$(totalMax)}</p>
                </div>

                <!-- SVG Donut Chart -->
                <div style="display:flex;align-items:center;gap:16px;">
                    <svg width="64" height="64" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="transparent" stroke="rgba(255,255,255,0.1)" stroke-width="4"></circle>
                        <circle cx="18" cy="18" r="16" fill="transparent" stroke="#f59e0b" stroke-width="4" stroke-dasharray="${findings.length > 0 ? Math.min((criticals / findings.length) * 100, 99) : 0} 100" stroke-dashoffset="-25"></circle>
                        <text x="18" y="21.5" fill="#fff" font-size="10" font-weight="900" font-family="Arial" text-anchor="middle">${criticals}</text>
                    </svg>
                    <div>
                        <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 2px;">Criticals</p>
                        <p style="font-size:16px;font-weight:900;color:#ef4444;margin:0;">${findings.length} <span style="font-size:12px;color:#64748b;font-weight:600;">Total</span></p>
                    </div>
                </div>
            </div>

            <!-- Footer Meta -->
            <div style="margin-top:24px;display:flex;justify-content:space-between;color:#64748b;font-size:10px;font-weight:600;letter-spacing:0.5px;">
                <p>INSPECTION: ${form.inspectionDate || today()}</p>
                <p>CAPACITY: ${form.installedKw || 'N/A'} kW</p>
                <p>GENERATED: ${today()}</p>
            </div>
        </div>
    </div>

    <!-- PAGE 2: AI FINDINGS -->
    <div class="pdf-page" style="${pageStyle} background: #f8fafc; padding: 60px;">
        <!-- Header Strip -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:30px;">
            <div>
                <h2 style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;margin:0 0 6px;">Anomaly Index</h2>
                <p style="font-size:12px;color:#64748b;font-weight:500;margin:0;">Site: ${form.siteName} // Module Defect Registry</p>
            </div>
            <div style="background:#0f172a;border-radius:12px;padding:12px 24px;text-align:right;">
                <p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin:0 0 4px;">Total Findings</p>
                <p style="font-size:22px;font-weight:900;color:#fff;margin:0;">${findings.length}</p>
            </div>
        </div>

        <!-- Findings List -->
        <div style="display:flex;flex-direction:column;gap:16px;">
            ${findings.length === 0 ? `<div style="text-align:center;padding:40px;color:#94a3b8;font-weight:600;font-size:14px;">No defects detected during analysis.</div>` : ''}
            ${findings.map((fnd, i) => `
            <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,0.03);border:1px solid #e2e8f0;border-left:6px solid ${sevColor(fnd.severity)};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-size:20px;font-weight:900;color:#cbd5e1;font-family:monospace;letter-spacing:-1px;">${String(i + 1).padStart(2, '0')}</span>
                        <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin:0;">${fnd.type}</h3>
                        <span style="font-size:10px;font-weight:900;padding:4px 10px;border-radius:6px;background:${sevColor(fnd.severity)}18;color:${sevColor(fnd.severity)};text-transform:uppercase;letter-spacing:1px;">${fnd.severity} PRIORITY</span>
                    </div>
                    ${fnd.estimatedCostMin ? `<span style="font-size:15px;font-weight:900;color:#0f172a;font-family:monospace;">${$(fnd.estimatedCostMin)} <span style="color:#94a3b8;font-weight:500;">– ${$(fnd.estimatedCostMax ?? 0)}</span></span>` : ''}
                </div>
                
                <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
                    <div><p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin:0 0 2px;">Geolocation</p><p style="font-size:11px;font-weight:600;color:#334155;margin:0;">${fnd.location}</p></div>
                    ${fnd.panelId ? `<div><p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin:0 0 2px;">Panel / String</p><p style="font-size:11px;font-weight:600;color:#334155;margin:0;">${fnd.panelId}</p></div>` : '<div></div>'}
                    ${fnd.temperature ? `<div><p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin:0 0 2px;">Delta Temp</p><p style="font-size:11px;font-weight:600;color:#ef4444;margin:0;">+${fnd.temperature}°C</p></div>` : '<div></div>'}
                    ${fnd.estimatedKwhLoss ? `<div><p style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin:0 0 2px;">Est Losses</p><p style="font-size:11px;font-weight:600;color:#f59e0b;margin:0;">${fnd.estimatedKwhLoss} kWh/yr</p></div>` : '<div></div>'}
                </div>
                
                <p style="font-size:13px;color:#475569;line-height:1.6;margin:0 0 8px;">${fnd.description}</p>
                <div style="display:flex;align-items:flex-start;gap:8px;background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:12px;">
                    <span style="font-size:12px;font-weight:900;color:#ca8a04;">RECOMMENDATION:</span>
                    <span style="font-size:12px;font-weight:600;color:#a16207;">${fnd.recommendation}</span>
                </div>
            </div>`).join('')}
        </div>

        <div style="position:absolute;bottom:0;left:0;right:0;padding:24px 60px;display:flex;justify-content:space-between;align-items:center;background:#fff;border-top:1px solid #e2e8f0;">
            <div style="display:flex;align-items:center;gap:8px;opacity:0.5;">
                <div style="width:16px;height:16px;background:#f59e0b;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10px;">A</div>
                <span style="font-size:10px;font-weight:800;letter-spacing:1px;color:#0f172a;">PRISM AXIS // CONFIDENTIAL</span>
            </div>
            <span style="font-size:10px;font-weight:700;color:#94a3b8;">PAGE 02</span>
        </div>
    </div>`;

    document.body.appendChild(container);

    try {
        const { default: html2canvas } = await import('html2canvas');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
        const PW_PT = 612, PH_PT = 792, PW_PX = 816, PH_PX = 1056;
        const pages = container.querySelectorAll<HTMLElement>('.pdf-page');

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) pdf.addPage();
            const canvas = await html2canvas(pages[i], {
                scale: 2, useCORS: true, backgroundColor: '#ffffff',
                logging: false, width: PW_PX, height: PH_PX,
            });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PW_PT, PH_PT);
        }

        const slug = (form.siteName || 'solar').replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const filename = `solar-report-${slug}.pdf`;

        // Save to archive before downloading
        try {
            const buf = pdf.output('arraybuffer');
            saveReport('solar', form.siteName || 'Solar Inspection', filename, buf);
        } catch { /* non-fatal */ }

        pdf.save(filename);
    } finally {
        document.body.removeChild(container);
    }
};
