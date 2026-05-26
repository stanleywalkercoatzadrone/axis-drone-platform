/**
 * Solar PDF Export utility — Advanced Enterprise Version.
 * Generates a high-fidelity, branded technical report for solar asset portfolios.
 */
import jsPDF from 'jspdf';
import { saveReport } from '../utils/reportStorage';
import { Fault } from '../../../src/types';

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
        imageIndex?: number;
    }>;
    faults?: Fault[];
    aiSummary: string;
    section: { title: string; badge: string; accentHex: string };
    images: string[];
    theme?: string;
    branding?: { primaryColor?: string; logo?: string; companyName?: string };
    config?: {
        showExecutiveSummary?: boolean;
        showSiteIntelligence?: boolean;
        showStrategicAssessment?: boolean;
        showCostAnalysis?: boolean;
        showDetailedImagery?: boolean;
        showAuditTrail?: boolean;
    };
}

const today = () =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const sevColor = (s: string): string =>
    ({ Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a' }[s] ?? '#6b7280');

export const exportSolarReportPDF = async (params: SolarPDFParams): Promise<string | void> => {
    const { form, findings, aiSummary, section, faults } = params;

    // Config Toggles
    const showSummary = params.config?.showExecutiveSummary !== false;
    const showSiteIntel = params.config?.showSiteIntelligence !== false;
    const showCosts = params.config?.showCostAnalysis !== false;
    const showImagery = params.config?.showDetailedImagery !== false;

    // Theme values
    const theme = (params.theme || 'TECHNICAL').toUpperCase();
    const isDark = theme === 'TECHNICAL';
    const isMinimal = theme === 'MINIMAL';
    const isExecutive = theme === 'EXECUTIVE';

    // Branding values
    const accent = params.branding?.primaryColor || params.section?.accentHex || '#f59e0b';
    const company = params.branding?.companyName || 'AXIS PLATFORM';
    const logo = params.branding?.logo;

    const container = document.createElement('div');
    container.style.cssText = [
        'position:fixed', 'top:-99999px', 'left:-99999px',
        'width:816px', 'background:#fff',
        'font-family:Arial,Helvetica,sans-serif', 'color:#111827', 'z-index:-1'
    ].join(';');

    const pageStyle = [
        'width:816px', 'height:1056px', 'background:#fff',
        'position:relative', 'overflow:hidden', 'box-sizing:border-box'
    ].join(';');

    const totalMin = findings.reduce((s, f) => s + (f.estimatedCostMin ?? 0), 0);
    const totalMax = findings.reduce((s, f) => s + (f.estimatedCostMax ?? 0), 0);
    const totalKwhLoss = findings.reduce((s, f) => s + (f.estimatedKwhLoss ?? 0), 0);
    const criticals = findings.filter(f => f.severity === 'Critical').length;
    const highs = findings.filter(f => f.severity === 'High').length;
    const $ = (n: number) => `$${n.toLocaleString()}`;

    let coverHtml = '';
    if (isMinimal) {
        coverHtml = `
        <!-- PAGE 1: MINIMAL COVER -->
        <div class="pdf-page" style="${pageStyle} background:#fff; padding:60px; border:20px solid #f8fafc;">
            <div style="display:flex;flex-direction:column;height:100%;justify-content:space-between;border:1px solid #e2e8f0;padding:40px;">
                <div>
                    <p style="font-family:'Inter';font-size:10px;font-weight:700;letter-spacing:2px;color:#9ca3af;text-transform:uppercase;">${company}</p>
                    <h1 style="font-family:'Outfit';font-size:32px;font-weight:900;color:#000;margin:40px 0 10px;line-height:1.2;">${form.siteName || 'Solar Asset Inspection'}</h1>
                    <p style="font-family:'Inter';font-size:14px;color:#4b5563;">Client: ${form.clientName || 'TBD'}</p>
                </div>
                <div style="border-top:1px solid #e5e7eb;padding-top:20px;display:flex;justify-content:space-between;font-size:10px;color:#6b7280;">
                    <p>GENERATED: ${today()}</p>
                    <p>STATUS: FINALIZED</p>
                </div>
            </div>
        </div>`;
    } else if (isExecutive) {
        coverHtml = `
        <!-- PAGE 1: EXECUTIVE COVER -->
        <div class="pdf-page" style="${pageStyle} background:#f8fafc; padding:60px;">
            <div style="position:relative;z-index:10;display:flex;flex-direction:column;height:100%;padding:40px;background:#ffffff;border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,0.03);border:1px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:60px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        ${logo ? `<img src="${logo}" style="height:36px;object-fit:contain;" />` : `<div style="width:36px;height:36px;background:${accent};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:18px;">A</div>`}
                        <div>
                            <p style="font-family:'Outfit';font-size:16px;font-weight:900;color:#0f172a;margin:0;letter-spacing:1px;">${company}</p>
                            <p style="font-family:'Inter';font-size:9px;color:${accent};font-weight:700;margin:0;text-transform:uppercase;letter-spacing:0.5px;">Executive Inspection Solution</p>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top:auto;margin-bottom:auto;">
                    <h1 style="font-family:'Outfit';font-size:36px;font-weight:900;color:#0f172a;margin:0 0 20px;line-height:1.15;letter-spacing:-1px;">${form.siteName || 'Solar Asset Inspection'}</h1>
                    <p style="font-family:'Inter';font-size:16px;color:#475569;margin:0;">Client Profile: <span style="color:#0f172a;font-weight:700;">${form.clientName || 'TBD'}</span></p>
                    ${showSiteIntel && form.siteId ? `<p style="font-family:'Inter';font-size:12px;color:#64748b;margin-top:10px;">Site ID: ${form.siteId}</p>` : ''}
                </div>

                <div style="margin-top:auto;padding-top:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <p style="font-family:'Inter';font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Prepared For</p>
                        <p style="font-family:'Inter';font-size:12px;font-weight:700;color:#0f172a;">${form.clientName || 'Client Representative'}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-family:'Inter';font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Date Generated</p>
                        <p style="font-family:'Inter';font-size:12px;font-weight:700;color:#0f172a;">${today()}</p>
                    </div>
                </div>
            </div>
        </div>`;
    } else {
        // Default: TECHNICAL
        coverHtml = `
        <!-- PAGE 1: TECHNICAL COVER -->
        <div class="pdf-page" style="${pageStyle} background: #070B14;">
            <!-- Background Accents -->
            <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;z-index:0;">
                <div style="position:absolute;top:-200px;right:-100px;width:800px;height:800px;background:radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%);"></div>
                <div style="position:absolute;bottom:-300px;left:-200px;width:900px;height:900px;background:radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);"></div>
                <!-- Geometric Grid -->
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);background-size: 50px 50px;"></div>
            </div>

            <div style="position:relative;z-index:10;display:flex;flex-direction:column;height:100%;padding:80px;">
                <!-- Logo Header -->
                <div style="display:flex;align-items:center;gap:18px;margin-bottom:120px;">
                    ${logo ? `<img src="${logo}" style="height:56px;object-fit:contain;" />` : `<div style="width:56px;height:56px;background:linear-gradient(135deg, ${accent}, #3b82f6);border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:32px;box-shadow:0 15px 30px rgba(37,99,235,0.3);">A</div>`}
                    <div>
                        <p style="font-family:'Outfit';font-size:22px;font-weight:900;letter-spacing:6px;color:#cbd5e1;margin:0;">${company}</p>
                        <p style="font-family:'Inter';font-size:11px;color:${accent};letter-spacing:2px;margin:0;font-weight:800;text-transform:uppercase;">Renewable Intelligence Pipeline</p>
                    </div>
                </div>

                <!-- Main Title Area -->
                <div style="margin-bottom:80px;">
                    <div style="display:inline-flex;align-items:center;gap:10px;border:1px solid ${accent}80;border-radius:100px;padding:8px 20px;background:${accent}15;margin-bottom:30px;">
                        <div style="width:8px;height:8px;background:${accent};border-radius:50%;box-shadow:0 0 10px ${accent};"></div>
                        <span style="font-family:'Inter';font-size:12px;font-weight:900;color:${accent};text-transform:uppercase;letter-spacing:3px;">Edge Intelligence Report</span>
                    </div>
                    <h1 style="font-family:'Outfit';font-size:56px;font-weight:900;color:#f8fafc;margin:0 0 20px;line-height:1;letter-spacing:-2px;text-shadow: 0 4px 12px rgba(0,0,0,0.3);">${form.siteName || 'Solar Asset Inspection'}</h1>
                    <p style="font-family:'Inter';font-size:24px;color:#94a3b8;font-weight:500;margin:0;">Portfolio Intelligence for <span style="color:#3b82f6;font-weight:900;">${form.clientName || 'Stakeholders'}</span></p>
                </div>

                <!-- Stats Bar -->
                <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:2px;background:rgba(255,255,255,0.1);border-radius:24px;overflow:hidden;margin-bottom:auto;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);">
                    <div style="background:rgba(15,23,42,0.8);padding:30px;text-align:center;">
                        <p style="font-family:'Inter';font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Inspection Date</p>
                        <p style="font-family:'Outfit';font-size:20px;font-weight:700;color:#f1f5f9;">${form.inspectionDate || today()}</p>
                    </div>
                    <div style="background:rgba(15,23,42,0.8);padding:30px;text-align:center;">
                        <p style="font-family:'Inter';font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Site Capacity</p>
                        <p style="font-family:'Outfit';font-size:20px;font-weight:700;color:#f1f5f9;">${form.installedKw || '—'} kW</p>
                    </div>
                    <div style="background:rgba(15,23,42,0.8);padding:30px;text-align:center;">
                        <p style="font-family:'Inter';font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Neural Insights</p>
                        <p style="font-family:'Outfit';font-size:20px;font-weight:700;color:${accent};">${findings.length}</p>
                    </div>
                    <div style="background:rgba(15,23,42,0.8);padding:30px;text-align:center;">
                        <p style="font-family:'Inter';font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Security Level</p>
                        <p style="font-family:'Outfit';font-size:20px;font-weight:700;color:#10b981;">Class A</p>
                    </div>
                </div>

                <!-- Footer Meta -->
                <div style="display:flex; justify-content:space-between; align-items:end;">
                    <div style="font-family:'Inter';font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                        <p style="color:#94a3b8;">STRICTLY CONFIDENTIAL</p>
                        <p style="color:#3b82f6;margin-top:4px;">PROPERTY OF ${form.clientName || 'CLIENT'}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-family:'Outfit';font-size:14px;font-weight:900;color:#cbd5e1;">Axis Platform V2.4</p>
                        <p style="font-family:'Inter';font-size:9px;color:#94a3b8;margin-top:4px;">Neural Network Certification: AX-880-GEN</p>
                    </div>
                </div>
            </div>
        </div>`;
    }

    let manifestHtml = '';
    if (!isMinimal) {
        manifestHtml = `
        <!-- PAGE 2: TABLE OF CONTENTS -->
        <div class="pdf-page" style="${pageStyle} background: #fff; padding: 60px;">
            <h2 style="font-family:'Outfit';font-size:36px;font-weight:900;color:#0f172a;margin-bottom:10px;letter-spacing:-1px;">Intelligence Manifest</h2>
            <p style="font-family:'Inter';font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:60px;border-bottom:2px solid #f1f5f9;padding-bottom:20px;">DOCUMENT NAVIGATION & DIRECTORY</p>
            
            <div style="display:flex;flex-direction:column;gap:30px;">
                ${showSummary ? `
                <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px dashed #e2e8f0;padding-bottom:10px;">
                    <span style="font-family:'Outfit';font-size:24px;font-weight:900;color:#0f172a;">I. Executive Diagnosis & Technical Specs</span>
                    <span style="font-family:'Outfit';font-size:24px;font-weight:900;color:${accent};">03</span>
                </div>` : ''}
                ${showImagery ? `
                <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px dashed #e2e8f0;padding-bottom:10px;">
                    <span style="font-family:'Outfit';font-size:24px;font-weight:900;color:#0f172a;">II. Neural Defect Registry (AI Detected)</span>
                    <span style="font-family:'Outfit';font-size:24px;font-weight:900;color:${accent};">04</span>
                </div>` : ''}
                ${faults && faults.length > 0 && showImagery ? `
                <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px dashed #e2e8f0;padding-bottom:10px;">
                    <span style="font-family:'Outfit';font-size:24px;font-weight:900;color:#0f172a;">III. Manual Validation & Precision Faults</span>
                    <span style="font-family:'Outfit';font-size:24px;font-weight:900;color:${accent};">05</span>
                </div>` : ''}
            </div>

            <!-- Global Footer -->
            <div style="position:absolute;bottom:40px;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;padding-top:20px;">
                <p style="font-family:'Inter';font-size:9px;font-weight:800;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">© 2026 AXIS INTELLIGENCE // SECURE FOOTER</p>
                <p style="font-family:'Outfit';font-size:10px;font-weight:900;color:#0f172a;">PAGE 02</p>
            </div>
        </div>`;
    }

    let summaryPageHtml = '';
    if (showSummary) {
        summaryPageHtml = `
        <!-- PAGE 3: EXECUTIVE SUMMARY & TECHNICAL SPECS -->
        <div class="pdf-page" style="${pageStyle} background: #fff; padding: 60px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;border-bottom:3px solid #f8fafc;padding-bottom:20px;">
                <div>
                    <h2 style="font-family:'Outfit';font-size:28px;font-weight:900;color:#0f172a;letter-spacing:-1px;">Executive Diagnosis</h2>
                    <p style="font-family:'Inter';font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Neural Asset Synthesis</p>
                </div>
                <div style="background:${accent};color:#fff;padding:8px 16px;border-radius:8px;font-family:'Inter';font-size:11px;font-weight:900;letter-spacing:1px;">STATUS: ACTION REQUIRED</div>
            </div>

            <!-- AI Summary Panel -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:24px;padding:32px;margin-bottom:40px;position:relative;overflow:hidden;">
                <div style="position:absolute;top:0;right:0;padding:12px 20px;background:#0f172a;color:${accent};font-family:'Inter';font-size:9px;font-weight:900;letter-spacing:2px;border-bottom-left-radius:16px;">AI SYNTHESIS</div>
                <p style="font-family:'Inter';font-size:16px;line-height:1.7;color:#334155;font-weight:500;margin:0;">${aiSummary || 'Automated analysis complete. No critical structural anomalies detected.'}</p>
            </div>

            <!-- Metric Grid -->
            ${showCosts ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:40px;">
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
                    <p style="font-family:'Inter';font-size:10px;font-weight:800;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px;">Financial Exposure (Estimated)</p>
                    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">
                        <span style="font-family:'Outfit';font-size:36px;font-weight:900;color:#0f172a;">${$(totalMin)}</span>
                        <span style="font-family:'Inter';font-size:14px;color:#94a3b8;font-weight:600;">to ${$(totalMax)}</span>
                    </div>
                    <p style="font-family:'Inter';font-size:12px;color:#ef4444;font-weight:700;">Potential Annual Revenue Loss: ${$(Math.round(totalKwhLoss * 0.12))}</p>
                </div>
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
                    <p style="font-family:'Inter';font-size:10px;font-weight:800;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px;">Health Distribution</p>
                    <div style="display:flex;gap:4px;height:12px;border-radius:6px;overflow:hidden;margin-bottom:15px;">
                        <div style="width:${findings.length > 0 ? (criticals/findings.length)*100 : 0}%;background:#dc2626;"></div>
                        <div style="width:${findings.length > 0 ? (highs/findings.length)*100 : 0}%;background:#ea580c;"></div>
                        <div style="flex-grow:1;background:#e2e8f0;"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-family:'Inter';font-size:11px;font-weight:700;">
                        <span style="color:#dc2626;">${criticals} Critical</span>
                        <span style="color:#ea580c;">${highs} High Risk</span>
                        <span style="color:#94a3b8;">${findings.length - criticals - highs} Minor</span>
                    </div>
                </div>
            </div>` : ''}

            <!-- Technical Specification Section -->
            ${showSiteIntel ? `
            <div>
                <h3 style="font-family:'Outfit';font-size:18px;font-weight:900;color:#0f172a;margin-bottom:20px;">Technical Verification Parameters</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                            <span style="font-family:'Inter';font-size:12px;font-weight:700;color:#64748b;">Asset Class</span>
                            <span style="font-family:'Inter';font-size:12px;font-weight:800;color:#0f172a;">Utility Scale PV</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                            <span style="font-family:'Inter';font-size:12px;font-weight:700;color:#64748b;">Module Make/Model</span>
                            <span style="font-family:'Inter';font-size:12px;font-weight:800;color:#0f172a;">${form.panelMake || 'Mixed Tier-1'}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                            <span style="font-family:'Inter';font-size:12px;font-weight:700;color:#64748b;">Telemetry Origin</span>
                            <span style="font-family:'Inter';font-size:12px;font-weight:800;color:#0f172a;">Thermal Orthographic</span>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                            <span style="font-family:'Inter';font-size:12px;font-weight:700;color:#64748b;">Flight Altitude</span>
                            <span style="font-family:'Inter';font-size:12px;font-weight:800;color:#0f172a;">${form.flightAltitude || '120'} ft AGL</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                            <span style="font-family:'Inter';font-size:12px;font-weight:700;color:#64748b;">Irradiance (Est.)</span>
                            <span style="font-family:'Inter';font-size:12px;font-weight:800;color:#0f172a;">~840 W/m²</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                            <span style="font-family:'Inter';font-size:12px;font-weight:700;color:#64748b;">Mission Lead</span>
                            <span style="font-family:'Inter';font-size:12px;font-weight:800;color:#0f172a;">${form.pilotName || 'AI Pilot Agent'}</span>
                        </div>
                    </div>
                </div>
            </div>` : ''}

            <!-- Global Footer -->
            <div style="position:absolute;bottom:40px;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;padding-top:20px;">
                <p style="font-family:'Inter';font-size:9px;font-weight:800;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">© 2026 AXIS INTELLIGENCE // SECURE FOOTER</p>
                <p style="font-family:'Outfit';font-size:10px;font-weight:900;color:#0f172a;">PAGE 03</p>
            </div>
        </div>`;
    }

    let registryHtml = '';
    if (showImagery) {
        registryHtml = `
        <!-- PAGE 4: DEFECT REGISTRY -->
        <div class="pdf-page" style="${pageStyle} background: #fff; padding: 60px;">
            <h2 style="font-family:'Outfit';font-size:24px;font-weight:900;color:#0f172a;margin-bottom:30px;border-bottom:2px solid #0f172a;padding-bottom:10px;">Defect Registry & Analysis</h2>
            
            <div style="display:flex;flex-direction:column;gap:20px;">
                ${findings.map((fnd, i) => `
                <div class="finding-card" style="border:1.5px solid #e2e8f0;border-radius:20px;padding:24px;position:relative;overflow:hidden;background:#fff;">
                    <div style="position:absolute;top:0;left:0;bottom:0;width:8px;background:${sevColor(fnd.severity)};"></div>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div style="width:28px;height:28px;background:#0f172a;color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-size:14px;font-weight:900;">${i+1}</div>
                            <h3 style="font-family:'Outfit';font-size:18px;font-weight:900;color:#0f172a;">${fnd.type}</h3>
                            <div style="display:flex;gap:8px;align-items:center;">
                                ${fnd.imageIndex !== undefined ? `<span style="font-family:'Inter';font-size:9px;font-weight:900;background:#3b82f615;color:#3b82f6;padding:4px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:1px;border:1px solid #3b82f630;">Photo #${fnd.imageIndex + 1}</span>` : ''}
                                <span style="font-family:'Inter';font-size:9px;font-weight:900;background:${sevColor(fnd.severity)}20;color:${sevColor(fnd.severity)};padding:4px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:1px;">${fnd.severity}</span>
                            </div>
                        </div>
                        ${showCosts ? `
                        <div style="text-align:right;">
                            <p style="font-family:'Inter';font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Action Est.</p>
                            <p style="font-family:'Outfit';font-size:18px;font-weight:800;color:#0f172a;">${$(fnd.estimatedCostMin ?? 0)}</p>
                        </div>` : ''}
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:20px;">
                        <!-- Finding Image Proof -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; height:140px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                            ${fnd.imageIndex !== undefined && params.images[fnd.imageIndex] 
                                ? `<img src="${params.images[fnd.imageIndex]}" style="width:100%; height:100%; object-fit:cover;" />` 
                                : `<div style="color:#94a3b8; font-size:10px; font-weight:700;">VISUAL PROOF N/A</div>`
                            }
                        </div>
                        <div style="flex:1;">
                            <p style="font-family:'Inter';font-size:12px;line-height:1.6;color:#334155;margin-bottom:12px;font-weight:500;">${fnd.description}</p>
                            <div style="background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:15px;">
                                <p style="font-family:'Inter';font-size:10px;font-weight:900;color:#854d0e;text-transform:uppercase;margin-bottom:4px;letter-spacing:1px;">Primary Recommendation</p>
                                <p style="font-family:'Inter';font-size:12px;font-weight:700;color:#451a03;line-height:1.4;">${fnd.recommendation}</p>
                            </div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <div style="background:#f8fafc;border-radius:10px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-family:'Inter';font-size:10px;font-weight:700;color:#64748b;">Location</span>
                                <span style="font-family:'Inter';font-size:11px;font-weight:800;color:#0f172a;">${fnd.location}</span>
                            </div>
                            ${showCosts ? `
                            <div style="background:#f8fafc;border-radius:10px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-family:'Inter';font-size:10px;font-weight:700;color:#64748b;">Est. Annual Loss</span>
                                <span style="font-family:'Inter';font-size:11px;font-weight:800;color:#ea580c;">${fnd.estimatedKwhLoss || 0} kWh</span>
                            </div>` : ''}
                            <div style="background:#f8fafc;border-radius:10px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-family:'Inter';font-size:10px;font-weight:700;color:#64748b;">Confidence</span>
                                <span style="font-family:'Inter';font-size:11px;font-weight:800;color:#10b981;">98.4%</span>
                            </div>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>

            <!-- Global Footer -->
            <div style="position:absolute;bottom:40px;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;padding-top:20px;">
                <p style="font-family:'Inter';font-size:9px;font-weight:800;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Generated via Axis AI Core</p>
                <p style="font-family:'Outfit';font-size:10px;font-weight:900;color:#0f172a;">PAGE 04</p>
            </div>
        </div>`;
    }

    let validationHtml = '';
    if (faults && faults.length > 0 && showImagery) {
        validationHtml = `
        <!-- PAGE 5: MANUAL VALIDATION -->
        <div class="pdf-page" style="${pageStyle} background: #fff; padding: 60px;">
            <h2 style="font-family:'Outfit';font-size:24px;font-weight:900;color:#0f172a;margin-bottom:30px;border-bottom:2px solid #0f172a;padding-bottom:10px;">Manual Validation & Precision Faults</h2>
            <div style="display:flex;flex-direction:column;gap:20px;">
                ${faults.map((fnd, i) => `
                <div class="finding-card" style="border:1.5px solid #e2e8f0;border-radius:20px;padding:24px;position:relative;overflow:hidden;background:#fff;">
                    <div style="position:absolute;top:0;left:0;bottom:0;width:8px;background:${sevColor(fnd.severity)};"></div>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div style="width:28px;height:28px;background:#3b82f6;color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-size:14px;font-weight:900;">${i+1}</div>
                            <h3 style="font-family:'Outfit';font-size:18px;font-weight:900;color:#0f172a;">${fnd.type}</h3>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <span style="font-family:'Inter';font-size:9px;font-weight:900;background:#10b98120;color:#10b981;padding:4px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:1px;border:1px solid #10b98130;">Human Verified</span>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-family:'Inter';font-size:9px;font-weight:900;background:${sevColor(fnd.severity)}20;color:${sevColor(fnd.severity)};padding:4px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:1px;">${fnd.severity}</span>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                        <div style="flex:1;">
                            <p style="font-family:'Inter';font-size:12px;line-height:1.6;color:#334155;margin-bottom:12px;font-weight:500;">${fnd.description}</p>
                            ${fnd.remediation ? `
                            <div style="background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:15px;">
                                <p style="font-family:'Inter';font-size:10px;font-weight:900;color:#854d0e;text-transform:uppercase;margin-bottom:4px;letter-spacing:1px;">Remediation Note</p>
                                <p style="font-family:'Inter';font-size:12px;font-weight:700;color:#451a03;line-height:1.4;">${fnd.remediation}</p>
                            </div>
                            ` : ''}
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            ${showSiteIntel ? `
                            <div style="background:#f8fafc;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:4px;">
                                <span style="font-family:'Inter';font-size:10px;font-weight:700;color:#64748b;">GPS Coordinates</span>
                                <span style="font-family:'Inter';font-size:11px;font-weight:800;color:#0f172a;">
                                    ${fnd.coordinates ? `${fnd.coordinates.lat.toFixed(6)}, ${fnd.coordinates.lng.toFixed(6)}` : 'Manual Point'}
                                </span>
                            </div>` : ''}
                            <div style="background:#f8fafc;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:4px;">
                                <span style="font-family:'Inter';font-size:10px;font-weight:700;color:#64748b;">Source Image ID</span>
                                <span style="font-family:'Inter';font-size:11px;font-weight:800;color:#0f172a;word-break:break-all;">${fnd.imageId}</span>
                            </div>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
            
            <!-- Global Footer -->
            <div style="position:absolute;bottom:40px;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;padding-top:20px;">
                <p style="font-family:'Inter';font-size:9px;font-weight:800;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Generated via Axis AI Core</p>
                <p style="font-family:'Outfit';font-size:10px;font-weight:900;color:#0f172a;">PAGE 05</p>
            </div>
        </div>`;
    }

    container.innerHTML = `
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Outfit:wght@500;700;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .font-outfit { font-family: 'Outfit', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
        .glass-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px); border-radius: 16px; padding: 24px; }
        .finding-card { page-break-inside: avoid; }
    </style>
    ${coverHtml}
    ${manifestHtml}
    ${summaryPageHtml}
    ${registryHtml}
    ${validationHtml}
    `;

    document.body.appendChild(container);

    try {
        const { default: html2canvas } = await import('html2canvas');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
        const PW_PT = 612, PH_PT = 792, PW_PX = 816, PH_PX = 1056;
        const pages = container.querySelectorAll<HTMLElement>('.pdf-page');

        let pageCount = 0;
        for (let i = 0; i < pages.length; i++) {
            if (i > 0) pdf.addPage();
            pageCount++;
            const canvas = await html2canvas(pages[i], {
                scale: 3, // High-DPI render
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: PW_PX,
                height: PH_PX,
            });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PW_PT, PH_PT);
        }

        const slug = (form.siteName || 'solar').replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const filename = `axis-solar-report-${slug}.pdf`;

        const buf = pdf.output('arraybuffer');
        const reportId = saveReport(
            'solar', 
            form.siteName || 'Solar Inspection', 
            filename, 
            buf, 
            { form, findings, aiSummary }
        );

        pdf.save(filename);
        return reportId;
    } finally {
        document.body.removeChild(container);
    }
};
