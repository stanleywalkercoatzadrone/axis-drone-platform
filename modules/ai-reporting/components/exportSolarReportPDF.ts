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
    <style>* { box-sizing:border-box; margin:0; padding:0; }</style>

    <!-- PAGE 1: COVER -->
    <div class="pdf-page" style="${pageStyle}">
        <div style="background:linear-gradient(155deg,#0f172a 0%,#1e1b4b 50%,#1c2e4a 100%);height:400px;padding:52px 56px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:-50px;right:-50px;width:280px;height:280px;border-radius:50%;background:rgba(245,158,11,0.07);"></div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:48px;">
                <div style="width:38px;height:38px;background:#f59e0b;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:20px;">A</div>
                <div>
                    <p style="font-size:11px;font-weight:800;letter-spacing:3px;color:#f59e0b;text-transform:uppercase;margin:0;">Prism Axis</p>
                    <p style="font-size:9px;color:rgba(255,255,255,0.4);margin:0;">Solar AI Division</p>
                </div>
            </div>
            <div style="display:inline-block;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:4px 12px;margin-bottom:14px;">
                <span style="font-size:9px;font-weight:700;letter-spacing:2px;color:#f59e0b;text-transform:uppercase;">Solar AI Inspection Report — ${section.title}</span>
            </div>
            <h1 style="font-size:28px;font-weight:900;color:#fff;margin:0 0 8px;line-height:1.2;">${form.siteName || 'Solar Farm Inspection'}</h1>
            <p style="font-size:13px;color:rgba(255,255,255,0.55);margin:0;">${form.clientName || ''}</p>
            <div style="display:flex;gap:28px;margin-top:28px;">
                ${form.siteId ? `<div><p style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;margin:0 0 3px;">Site ID</p><p style="font-size:13px;font-weight:800;color:#fff;font-family:monospace;margin:0;">${form.siteId}</p></div>` : ''}
                ${form.installedKw ? `<div><p style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;margin:0 0 3px;">Installed Capacity</p><p style="font-size:13px;font-weight:800;color:#fff;margin:0;">${form.installedKw} kW</p></div>` : ''}
                <div><p style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;margin:0 0 3px;">Report Date</p><p style="font-size:13px;font-weight:800;color:#fff;margin:0;">${today()}</p></div>
            </div>
        </div>
        <!-- Stats strip -->
        <div style="background:#fff;padding:0 56px;display:grid;grid-template-columns:repeat(4,1fr);border-bottom:2px solid #f3f4f6;">
            ${[
            { label: 'Total Findings', value: findings.length.toString(), color: '#374151' },
            { label: 'Critical Issues', value: criticals.toString(), color: '#dc2626' },
            { label: 'Est. Repair Cost', value: totalMin > 0 ? `${$(totalMin)}–${$(totalMax)}` : '—', color: '#f59e0b' },
            { label: 'Inspection Date', value: form.inspectionDate || today(), color: '#111827' },
        ].map((s, i) => `
            <div style="padding:18px 0;text-align:center;${i > 0 ? 'border-left:1px solid #f3f4f6;' : ''}">
                <p style="font-size:${s.value.length > 8 ? '13px' : '20px'};font-weight:900;color:${s.color};margin:0;">${s.value}</p>
                <p style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin:4px 0 0;">${s.label}</p>
            </div>`).join('')}
        </div>
        <!-- AI Summary -->
        ${aiSummary ? `
        <div style="margin:32px 56px 0;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px 24px;">
            <p style="font-size:9px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">AI Analysis Summary</p>
            <p style="font-size:12px;color:#374151;line-height:1.7;">${aiSummary}</p>
        </div>` : ''}
        <!-- Footer -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:16px 56px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:9px;color:#9ca3af;">AI-Generated Report — ${today()}</span>
            <span style="font-size:9px;color:#9ca3af;">Page 1</span>
        </div>
    </div>

    <!-- PAGE 2: FINDINGS -->
    <div class="pdf-page" style="${pageStyle}padding:52px 56px;">
        <div style="border-bottom:2px solid #f3f4f6;padding-bottom:16px;margin-bottom:24px;">
            <h2 style="font-size:18px;font-weight:900;color:#0f172a;margin:0 0 4px;">Inspection Findings</h2>
            <p style="font-size:11px;color:#6b7280;">${form.siteName} — ${findings.length} finding(s) identified</p>
        </div>
        ${findings.map((fnd, i) => `
        <div style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:14px;border-left:4px solid ${sevColor(fnd.severity)};">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:10px;color:#9ca3af;font-family:monospace;">#${i + 1}</span>
                    <span style="font-size:13px;font-weight:800;color:#111827;">${fnd.type}</span>
                    <span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;background:${sevColor(fnd.severity)}18;color:${sevColor(fnd.severity)};text-transform:uppercase;">${fnd.severity}</span>
                </div>
                ${fnd.estimatedCostMin ? `<span style="font-size:13px;font-weight:800;color:#111827;">${$(fnd.estimatedCostMin)} – ${$(fnd.estimatedCostMax ?? 0)}</span>` : ''}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:10px;color:#6b7280;margin-bottom:8px;">
                <span>📍 ${fnd.location}</span>
                ${fnd.panelId ? `<span>Panel: ${fnd.panelId}</span>` : ''}
                ${fnd.temperature ? `<span>🌡️ ${fnd.temperature}°C</span>` : ''}
                ${fnd.efficiency ? `<span>⚡ ${fnd.efficiency}% efficiency</span>` : ''}
                ${fnd.estimatedKwhLoss ? `<span>📉 ${fnd.estimatedKwhLoss.toLocaleString()} kWh/yr loss</span>` : ''}
            </div>
            <p style="font-size:11px;color:#374151;margin-bottom:6px;">${fnd.description}</p>
            <p style="font-size:11px;color:#b45309;">→ ${fnd.recommendation}</p>
        </div>`).join('')}
        <div style="position:absolute;bottom:0;left:0;right:0;padding:16px 56px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:9px;color:#9ca3af;">CONFIDENTIAL — AI-Generated Report</span>
            <span style="font-size:9px;color:#9ca3af;">Page 2</span>
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
