/**
 * Orthomosaic PDF Export utility — Advanced Enterprise Version.
 * Generates a high-fidelity, branded technical quality report for photogrammetry deliverables.
 */
import jsPDF from 'jspdf';
import { saveReport } from '../utils/reportStorage';

interface OrthoPDFParams {
    projectName: string;
    siteName?: string;
    clientName?: string;
    flightDate?: string;
    pilotName?: string;
    notes?: string;
    stats: {
        imagesUsed?: number;
        areaCoveredHa?: string;
        pointsCount?: string;
        reprojectionError?: string;
        durationMinutes?: number;
        gpsEnabled?: boolean;
        componentsCount?: number;
        avgFeaturesDetected?: string;
        avgFeaturesReconstructed?: string;
        stepsTimes?: Array<{ step: string; mins: number; pct: number }>;
    };
    previewUrl?: string; // GCS preview PNG signed URL
    theme?: string; // TECHNICAL, EXECUTIVE, MINIMAL
    branding?: {
        primaryColor?: string;
        logo?: string;
        companyName?: string;
    };
    config?: {
        showStats?: boolean;
        showFeatures?: boolean;
        showReconstruction?: boolean;
        showPreview?: boolean;
    };
}

const today = () =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export const exportOrthoReportPDF = async (params: OrthoPDFParams): Promise<string | void> => {
    const { stats, config = {} } = params;

    // Config Toggles
    const showStats = config.showStats !== false;
    const showFeatures = config.showFeatures !== false;
    const showReconstruction = config.showReconstruction !== false;
    const showPreview = config.showPreview !== false;

    // Theme values
    const theme = (params.theme || 'TECHNICAL').toUpperCase();
    const isDark = theme === 'TECHNICAL';
    const isMinimal = theme === 'MINIMAL';
    const isExecutive = theme === 'EXECUTIVE';

    // Branding values
    const accent = params.branding?.primaryColor || '#38bdf8';
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

    const headerBar = (pageNum: number, totalPages: number) => {
        if (isMinimal) {
            return `
            <div style="padding:15px 36px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;">
                <span style="font-size:9px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:1px;">${company}</span>
                <span style="font-size:9px;color:#9ca3af;">Page ${pageNum} of ${totalPages}</span>
            </div>`;
        }

        if (isExecutive) {
            return `
            <div style="padding:15px 36px;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                <div style="display:flex;align-items:center;gap:8px;">
                    ${logo ? `<img src="${logo}" style="height:18px;object-fit:contain;" />` : `<div style="width:16px;height:16px;background:${accent};border-radius:3px;"></div>`}
                    <span style="font-size:9px;font-weight:800;color:#0f172a;letter-spacing:1px;text-transform:uppercase;">${company}</span>
                </div>
                <span style="font-size:9px;color:#64748b;">Page ${pageNum} of ${totalPages}</span>
            </div>`;
        }

        // Default: TECHNICAL (Dark indigo header)
        return `
        <div style="background:#090d16;padding:10px 36px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex;align-items:center;gap:10px;">
                ${logo ? `<img src="${logo}" style="height:18px;object-fit:contain;" />` : `<div style="width:24px;height:24px;background:${accent};border-radius:5px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:13px;">A</div>`}
                <span style="font-size:9px;font-weight:700;letter-spacing:2px;color:${accent};text-transform:uppercase;">${company}</span>
            </div>
            <div style="display:flex;align-items:center;gap:24px;">
                <span style="font-size:9px;color:rgba(255,255,255,0.5);">QUALITY CONTROL REPORT</span>
                <span style="font-size:9px;color:rgba(255,255,255,0.5);">Page ${pageNum} of ${totalPages}</span>
            </div>
        </div>`;
    };

    const footerBar = () => `
    <div style="position:absolute;bottom:0;left:0;right:0;background:#f9fafb;border-top:1px solid #e5e7eb;padding:8px 36px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:8px;color:#9ca3af;">CONFIDENTIAL — Orthomosaic Processing & Quality Verification. Generated via ODM Core.</span>
        <span style="font-size:8px;color:#9ca3af;">Generated ${today()}</span>
    </div>`;

    const sectionHead = (title: string, sub?: string) => `
    <div style="margin-bottom:18px; padding-bottom:10px; border-bottom:2px solid #e5e7eb;">
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin:0 0 4px;">${sub || 'Section'}</p>
        <h2 style="font-size:18px;font-weight:800;color:#111827;margin:0;">${title}</h2>
    </div>`;

    // ── PAGE 1: COVER ──────────────────────────────────────────────────────────
    let coverHtml = '';
    if (isMinimal) {
        coverHtml = `
        <div class="pdf-page" style="${pageStyle} background:#fff; padding:60px; border:20px solid #f8fafc;">
            <div style="display:flex;flex-direction:column;height:100%;justify-content:space-between;border:1px solid #e2e8f0;padding:40px;">
                <div>
                    <p style="font-size:10px;font-weight:700;letter-spacing:2px;color:#9ca3af;text-transform:uppercase;">${company}</p>
                    <h1 style="font-size:32px;font-weight:900;color:#000;margin:40px 0 10px;line-height:1.2;">${params.projectName || 'Quality Audit'}</h1>
                    <p style="font-size:14px;color:#4b5563;">Client: ${params.clientName || 'TBD'}</p>
                    ${params.siteName ? `<p style="font-size:12px;color:#6b7280;margin-top:6px;">Site: ${params.siteName}</p>` : ''}
                </div>
                <div style="border-top:1px solid #e5e7eb;padding-top:20px;display:flex;justify-content:space-between;font-size:10px;color:#6b7280;">
                    <p>GENERATED: ${today()}</p>
                    <p>FLIGHT DATE: ${params.flightDate || 'N/A'}</p>
                </div>
            </div>
        </div>`;
    } else if (isExecutive) {
        coverHtml = `
        <div class="pdf-page" style="${pageStyle} background:#f8fafc; padding:60px;">
            <div style="position:relative;z-index:10;display:flex;flex-direction:column;height:100%;padding:40px;background:#ffffff;border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,0.03);border:1px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:60px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        ${logo ? `<img src="${logo}" style="height:36px;object-fit:contain;" />` : `<div style="width:36px;height:36px;background:${accent};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:18px;">A</div>`}
                        <div>
                            <p style="font-size:16px;font-weight:900;color:#0f172a;margin:0;letter-spacing:1px;">${company}</p>
                            <p style="font-size:9px;color:${accent};font-weight:700;margin:0;text-transform:uppercase;letter-spacing:0.5px;">Photogrammetry deliverable</p>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top:auto;margin-bottom:auto;">
                    <h1 style="font-size:36px;font-weight:900;color:#0f172a;margin:0 0 20px;line-height:1.15;letter-spacing:-1px;">${params.projectName || 'Quality Audit'}</h1>
                    <p style="font-size:16px;color:#475569;margin:0;">Client Profile: <span style="color:#0f172a;font-weight:700;">${params.clientName || 'TBD'}</span></p>
                    ${params.siteName ? `<p style="font-size:12px;color:#64748b;margin-top:10px;">Site: ${params.siteName}</p>` : ''}
                </div>

                <div style="margin-top:auto;padding-top:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Lead Pilot</p>
                        <p style="font-size:12px;font-weight:700;color:#0f172a;">${params.pilotName || 'N/A'}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Date Processed</p>
                        <p style="font-size:12px;font-weight:700;color:#0f172a;">${today()}</p>
                    </div>
                </div>
            </div>
        </div>`;
    } else {
        // Default: TECHNICAL (Sleek Dark Theme)
        coverHtml = `
        <div class="pdf-page" style="${pageStyle} background: #0b0f19;">
            <div style="position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;z-index:0;">
                <div style="position:absolute;top:-200px;right:-100px;width:800px;height:800px;background:radial-gradient(circle, ${accent}18 0%, transparent 70%);"></div>
                <div style="position:absolute;bottom:-300px;left:-200px;width:900px;height:900px;background:radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%);"></div>
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;background-image: linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px);background-size: 40px 40px;"></div>
            </div>

            <div style="position:relative;z-index:10;display:flex;flex-direction:column;height:100%;padding:80px;">
                <div style="display:flex;align-items:center;gap:18px;margin-bottom:120px;">
                    ${logo ? `<img src="${logo}" style="height:48px;object-fit:contain;" />` : `<div style="width:48px;height:48px;background:linear-gradient(135deg, ${accent}, #1d4ed8);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:24px;box-shadow:0 10px 20px rgba(37,99,235,0.35);">A</div>`}
                    <div>
                        <p style="font-size:20px;font-weight:900;letter-spacing:4px;color:#cbd5e1;margin:0;">${company}</p>
                        <p style="font-size:10px;color:${accent};letter-spacing:2px;margin:0;font-weight:800;text-transform:uppercase;">Photogrammetry Processing Portal</p>
                    </div>
                </div>

                <div style="margin-bottom:80px;">
                    <div style="display:inline-flex;align-items:center;gap:10px;border:1px solid ${accent}60;border-radius:100px;padding:6px 16px;background:${accent}10;margin-bottom:24px;">
                        <div style="width:6px;height:6px;background:${accent};border-radius:50%;box-shadow:0 0 8px ${accent};"></div>
                        <span style="font-size:10px;font-weight:900;color:${accent};text-transform:uppercase;letter-spacing:2px;">Orthomosaic Quality Verification</span>
                    </div>
                    <h1 style="font-size:48px;font-weight:900;color:#f8fafc;margin:0 0 16px;line-height:1.1;letter-spacing:-1.5px;">${params.projectName || 'Quality Audit'}</h1>
                    <p style="font-size:20px;color:#94a3b8;font-weight:500;margin:0;">Prepared Client Profile: <span style="color:${accent};font-weight:900;">${params.clientName || 'General Stakeholders'}</span></p>
                </div>

                <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:2px;background:rgba(255,255,255,0.06);border-radius:20px;overflow:hidden;margin-bottom:auto;border:1px solid rgba(255,255,255,0.1);">
                    <div style="background:rgba(15,23,42,0.85);padding:24px;text-align:center;">
                        <p style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Flight Date</p>
                        <p style="font-size:15px;font-weight:700;color:#f1f5f9;">${params.flightDate || 'N/A'}</p>
                    </div>
                    <div style="background:rgba(15,23,42,0.85);padding:24px;text-align:center;">
                        <p style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Area Covered</p>
                        <p style="font-size:15px;font-weight:700;color:#f1f5f9;">${stats.areaCoveredHa || '—'} ha</p>
                    </div>
                    <div style="background:rgba(15,23,42,0.85);padding:24px;text-align:center;">
                        <p style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Images Processed</p>
                        <p style="font-size:15px;font-weight:700;color:${accent};">${stats.imagesUsed || '—'}</p>
                    </div>
                    <div style="background:rgba(15,23,42,0.85);padding:24px;text-align:center;">
                        <p style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Reprojection Error</p>
                        <p style="font-size:15px;font-weight:700;color:#10b981;">${stats.reprojectionError || '—'}</p>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:end; border-top:1px solid rgba(255,255,255,0.06); padding-top:20px; color:#475569; font-size:9px; font-weight:700;">
                    <div>
                        <p style="color:#64748b; text-transform:uppercase; letter-spacing:1px;">PILOT IN CHARGE: ${params.pilotName || 'N/A'}</p>
                    </div>
                    <div>
                        <p style="color:#64748b; text-transform:uppercase; letter-spacing:1px;">GENERATED: ${today()}</p>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ── PAGE 2: REPORT BODY ───────────────────────────────────────────────────
    let bodyHtml = `
    <div class="pdf-page" style="${pageStyle}">
        ${headerBar(2, 2)}
        <div style="padding:40px 56px 80px; display:flex; flex-direction:column; justify-content:space-between; height:100%; box-sizing:border-box;">
            <div style="flex:1; overflow:hidden;">
                ${sectionHead('Photogrammetry Processing Summary', 'Verification & Analytics')}

                <!-- Notes / Description -->
                ${params.notes ? `
                <div style="background:#f8fafc; border-left:4px solid ${accent}; border-radius:0 8px 8px 0; padding:16px 20px; margin-bottom:24px;">
                    <p style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:${accent}; margin:0 0 6px;">Notes & Observations</p>
                    <p style="font-size:11.5px; color:#374151; line-height:1.6; margin:0; white-space:pre-wrap;">${params.notes}</p>
                </div>` : ''}

                <!-- Processing Stats Grid -->
                ${showStats ? `
                <div style="margin-bottom:24px;">
                    <p style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#475569; margin:0 0 10px;">Quality & Density Metrics</p>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;">
                        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px;">
                            <p style="font-size:8.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#15803d; margin:0 0 4px;">Points Reconstructed</p>
                            <p style="font-size:18px; font-weight:900; color:#16a34a; margin:0;">${stats.pointsCount || '—'}</p>
                            <p style="font-size:9px; color:#475569; margin-top:2px;">Dense cloud points</p>
                        </div>
                        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:14px;">
                            <p style="font-size:8.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#1d4ed8; margin:0 0 4px;">Processing Time</p>
                            <p style="font-size:18px; font-weight:900; color:#2563eb; margin:0;">${stats.durationMinutes || '—'} mins</p>
                            <p style="font-size:9px; color:#475569; margin-top:2px;">Engine execution time</p>
                        </div>
                        <div style="background:#faf5ff; border:1px solid #e9d5ff; border-radius:10px; padding:14px;">
                            <p style="font-size:8.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#6b21a8; margin:0 0 4px;">Camera GPS</p>
                            <p style="font-size:18px; font-weight:900; color:#7c3aed; margin:0;">${stats.gpsEnabled ? 'Enabled' : 'Disabled'}</p>
                            <p style="font-size:9px; color:#475569; margin-top:2px;">Georeference status</p>
                        </div>
                    </div>
                </div>` : ''}

                <!-- Sub stats lists -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px;">
                    ${showFeatures && (stats.avgFeaturesDetected || stats.avgFeaturesReconstructed) ? `
                    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px;">
                        <p style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#64748b; margin:0 0 12px; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">Feature Tracking</p>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <div style="display:flex; justify-content:space-between; font-size:11px;">
                                <span style="color:#64748b;">Detected Features/Image</span>
                                <span style="font-weight:700; color:#1f2937;">${stats.avgFeaturesDetected || '—'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:11px;">
                                <span style="color:#64748b;">Reconstructed Features/Image</span>
                                <span style="font-weight:700; color:#1f2937;">${stats.avgFeaturesReconstructed || '—'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:11px;">
                                <span style="color:#64748b;">Bundle Adjustment Blocks</span>
                                <span style="font-weight:700; color:#1f2937;">${stats.componentsCount || '1'}</span>
                            </div>
                        </div>
                    </div>` : ''}

                    ${showReconstruction && stats.stepsTimes && stats.stepsTimes.length > 0 ? `
                    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px;">
                        <p style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#64748b; margin:0 0 12px; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">Step Time Distribution</p>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${stats.stepsTimes.slice(0, 4).map(st => `
                            <div>
                                <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px;">
                                    <span style="color:#64748b; max-width:180px; truncate;">${st.step}</span>
                                    <span style="font-weight:700; color:#1f2937;">${st.mins}m (${st.pct}%)</span>
                                </div>
                                <div style="height:3px; background:#f1f5f9; border-radius:1.5px; overflow:hidden;">
                                    <div style="height:100%; background:${accent}; width:${st.pct}%;"></div>
                                </div>
                            </div>
                            `).join('')}
                        </div>
                    </div>` : ''}
                </div>

                <!-- Orthomosaic Map Preview Embed -->
                ${showPreview && params.previewUrl ? `
                <div>
                    <p style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#475569; margin:0 0 10px;">Visual Map Overview</p>
                    <div style="width:100%; height:260px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; display:flex; align-items:center; justify-content:center; position:relative;">
                        <img src="${params.previewUrl}" style="width:100%; height:100%; object-fit:cover;" crossorigin="anonymous" />
                        <div style="position:absolute; bottom:12px; left:12px; background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:4px 10px; color:#fff; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
                            Orthomosaic Preview PNG
                        </div>
                    </div>
                </div>` : ''}
            </div>

            <!-- Page 2 Footer -->
            <div style="margin-top:auto; padding-top:12px; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; font-size:8px; color:#9ca3af;">
                <span>REPORT ID: QUALITY-QC-${Date.now().toString().slice(-6)}</span>
                <span>SYSTEM: OpenDroneMap Core (ODM-2.4)</span>
            </div>
        </div>
        ${footerBar()}
    </div>`;

    container.innerHTML = `
    <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        .pdf-page { page-break-after:always; }
    </style>
    ${coverHtml}
    ${bodyHtml}
    `;

    document.body.appendChild(container);

    try {
        const { default: html2canvas } = await import('html2canvas');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
        const PW_PT = 612, PH_PT = 792, PW_PX = 816, PH_PX = 1056;
        const pages = container.querySelectorAll<HTMLElement>('.pdf-page');

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) pdf.addPage();
            const canvas = await html2canvas(pages[i], {
                scale: 2, // High-DPI
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: PW_PX,
                height: PH_PX,
            });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, PW_PT, PH_PT);
        }

        const slug = (params.projectName || 'orthomosaic').replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const filename = `orthomosaic-report-${slug}.pdf`;

        // Save report to system archive
        const buf = pdf.output('arraybuffer');
        const reportId = saveReport(
            'orthomosaic',
            params.projectName || 'Orthomosaic QC',
            filename,
            buf,
            { projectName: params.projectName, stats, notes: params.notes }
        );

        pdf.save(filename);
        return reportId;
    } finally {
        document.body.removeChild(container);
    }
};
