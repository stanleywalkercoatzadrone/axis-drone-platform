import React, { useState, useRef } from 'react';
import {
  X, Download, FileText, MapPin, Building2, Calendar,
  ChevronLeft, ChevronRight, Image, AlertCircle, CheckCircle2,
  Printer, Layers, BarChart3
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReportImage {
  id: string;
  url: string;
  annotations?: Array<{ x: number; y: number; label: string; color?: string }>;
  summary?: string;
}

interface Report {
  id?: string;
  title?: string;
  client?: string;
  industry?: string;
  theme?: string;
  status?: string;
  approvalStatus?: string;
  date?: string;
  summary?: string;
  siteContext?: string | Record<string, any>;
  strategicAssessment?: string | Record<string, any>;
  images?: ReportImage[];
  authorName?: string;
  branding?: { primaryColor?: string; logo?: string; logoUrl?: string; companyName?: string };
  config?: {
    showExecutiveSummary?: boolean;
    showSiteIntelligence?: boolean;
    showStrategicAssessment?: boolean;
    showCostAnalysis?: boolean;
    showDetailedImagery?: boolean;
    showAuditTrail?: boolean;
    [key: string]: any;
  };
}

interface ReportViewerProps {
  report: Report;
  onClose: () => void;
}

// ── Annotation overlay ────────────────────────────────────────────────────────
function AnnotatedImage({ img }: { img: ReportImage }) {
  const [loaded, setLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  const imgRef = useRef<HTMLImageElement>(null);

  const onLoad = () => {
    setLoaded(true);
    if (imgRef.current) {
      setImgSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  };

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#0a0f1e', borderRadius: 12, overflow: 'hidden' }}>
      <img
        ref={imgRef}
        src={img.url}
        alt="Inspection"
        onLoad={onLoad}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
      {/* Annotation pins */}
      {loaded && (img.annotations || []).map((ann, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${ann.x}%`,
          top: `${ann.y}%`,
          transform: 'translate(-50%, -100%)',
          zIndex: 10,
        }}>
          <div style={{
            background: ann.color || '#ef4444',
            color: 'white',
            fontSize: 10,
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}>
            {ann.label}
          </div>
          <div style={{
            width: 2,
            height: 10,
            background: ann.color || '#ef4444',
            margin: '0 auto',
          }} />
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ann.color || '#ef4444',
            margin: '0 auto',
            boxShadow: `0 0 6px ${ann.color || '#ef4444'}`,
          }} />
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const ReportViewer: React.FC<ReportViewerProps> = ({ report, onClose }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const images = (report.images || []).filter(Boolean);

  // Safe parsing of text inputs that can be objects in backend/db
  const siteContextText = typeof report.siteContext === 'object'
    ? report.siteContext?.description || report.siteContext?.name || JSON.stringify(report.siteContext)
    : report.siteContext;

  const strategicAssessmentText = typeof report.strategicAssessment === 'object'
    ? report.strategicAssessment?.reasoning || JSON.stringify(report.strategicAssessment)
    : report.strategicAssessment;

  // Configuration toggles
  const showSummary = report.config?.showExecutiveSummary !== false;
  const showSiteContext = report.config?.showSiteIntelligence !== false;
  const showStrategicAssessment = report.config?.showStrategicAssessment !== false;
  const showImagery = report.config?.showDetailedImagery !== false;

  // Custom theme mapping
  const normalizedTheme = (report.theme || 'TECHNICAL').toUpperCase();
  const isDark = normalizedTheme === 'TECHNICAL';
  const isMinimal = normalizedTheme === 'MINIMAL';
  const isExecutive = normalizedTheme === 'EXECUTIVE';

  // Branding Customizations
  const accent = report.branding?.primaryColor || (isDark ? '#38bdf8' : '#2563eb');
  const companyName = report.branding?.companyName || 'Axis Drone Platform';
  const logoUrl = report.branding?.logo;

  // Theme-based colors
  const bgColor = isMinimal ? '#ffffff' : isExecutive ? '#f8fafc' : '#020817';
  const paperColor = isMinimal ? '#ffffff' : isExecutive ? '#ffffff' : '#020817';
  const cardColor = isMinimal ? 'transparent' : isExecutive ? '#f8fafc' : 'rgba(30,41,59,0.4)';
  const borderColor = isMinimal ? '#e2e8f0' : isExecutive ? '#e2e8f0' : 'rgba(255,255,255,0.07)';
  const textColor = isDark ? '#cbd5e1' : '#334155';
  const titleColor = isDark ? '#ffffff' : '#0f172a';
  const mutedTextColor = '#64748b';
  const sectionHeaderColor = isDark ? '#64748b' : '#475569';
  const sidebarBg = isMinimal ? '#ffffff' : isExecutive ? '#ffffff' : 'rgba(2,8,23,0.95)';

  const statusColor = report.approvalStatus === 'Approved' ? '#4ade80'
    : report.approvalStatus === 'Rejected' ? '#f87171'
    : '#facc15';

  async function exportPDF() {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      if (!contentRef.current) return;
      const canvas = await html2canvas(contentRef.current, { scale: 1.5, backgroundColor: paperColor, useCORS: true });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h);
      pdf.save(`${report.title || 'Report'}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: bgColor }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{
          borderBottom: `1px solid ${borderColor}`,
          background: paperColor
        }}>
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg" />
          ) : (
            <div className="p-2 rounded-xl" style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
              <FileText className="w-5 h-5" style={{ color: accent }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-black truncate" style={{ color: titleColor }}>{report.title}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: mutedTextColor }}>
                {companyName}
              </span>
              {report.client && (
                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: mutedTextColor }}>
                  <Building2 className="w-2.5 h-2.5" />{report.client}
                </span>
              )}
              {report.date && (
                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: mutedTextColor }}>
                  <Calendar className="w-2.5 h-2.5" />{new Date(report.date).toLocaleDateString()}
                </span>
              )}
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: `${statusColor}18`, color: statusColor }}>
                {report.approvalStatus || report.status || 'Draft'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80 cursor-pointer"
            style={{ background: `${accent}18`, border: `1px solid ${accent}33`, color: accent }}>
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:opacity-70 cursor-pointer"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: isDark ? '#94a3b8' : '#475569' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-8 space-y-8" style={{ background: paperColor }}>

          {/* Summary */}
          {showSummary && report.summary && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: sectionHeaderColor }}>
                Executive Summary
              </h2>
              <div className="rounded-2xl p-5" style={{
                background: isMinimal ? 'transparent' : isExecutive ? `${accent}0d` : 'rgba(14,165,233,0.05)',
                border: `1px solid ${isMinimal ? borderColor : isExecutive ? `${accent}22` : 'rgba(14,165,233,0.1)'}`
              }}>
                <p className="text-sm leading-relaxed" style={{ color: textColor }}>{report.summary}</p>
              </div>
            </section>
          )}

          {/* Images carousel */}
          {showImagery && images.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: sectionHeaderColor }}>
                  Inspection Images ({images.length})
                </h2>
                {images.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setImgIndex(i => Math.max(0, i - 1))}
                      disabled={imgIndex === 0}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 hover:opacity-70 cursor-pointer"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: isDark ? '#94a3b8' : '#475569' }}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-black" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                      {imgIndex + 1} / {images.length}
                    </span>
                    <button onClick={() => setImgIndex(i => Math.min(images.length - 1, i + 1))}
                      disabled={imgIndex === images.length - 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 hover:opacity-70 cursor-pointer"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: isDark ? '#94a3b8' : '#475569' }}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <AnnotatedImage img={images[imgIndex]} />
              {images[imgIndex]?.summary && (
                <p className="text-xs mt-3 leading-relaxed" style={{ color: mutedTextColor }}>
                  {images[imgIndex].summary}
                </p>
              )}
              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button key={img.id} onClick={() => setImgIndex(i)}
                      className="shrink-0 rounded-lg overflow-hidden transition-all cursor-pointer"
                      style={{
                        width: 60, height: 45,
                        border: `2px solid ${i === imgIndex ? accent : 'transparent'}`,
                        opacity: i === imgIndex ? 1 : 0.5,
                      }}>
                      <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Site context */}
          {showSiteContext && siteContextText && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: sectionHeaderColor }}>
                Site Context
              </h2>
              <div className="rounded-2xl p-5" style={{ background: cardColor, border: `1px solid ${borderColor}` }}>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} />
                  <p className="text-sm leading-relaxed" style={{ color: textColor }}>{siteContextText}</p>
                </div>
              </div>
            </section>
          )}

          {/* Strategic assessment */}
          {showStrategicAssessment && strategicAssessmentText && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: sectionHeaderColor }}>
                Strategic Assessment
              </h2>
              <div className="rounded-2xl p-5" style={{
                background: isMinimal ? 'transparent' : isExecutive ? `${accent}05` : 'rgba(139,92,246,0.05)',
                border: `1px solid ${isMinimal ? borderColor : isExecutive ? `${accent}18` : 'rgba(139,92,246,0.12)'}`
              }}>
                <div className="flex items-start gap-3">
                  <BarChart3 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: isExecutive ? accent : '#a78bfa' }} />
                  <p className="text-sm leading-relaxed" style={{ color: textColor }}>{strategicAssessmentText}</p>
                </div>
              </div>
            </section>
          )}

          {/* Empty state — report has no content yet */}
          {!report.summary && !siteContextText && !strategicAssessmentText && images.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
              <div className="p-5 rounded-3xl mb-5" style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}>
                <FileText className="w-10 h-10" style={{ color: accent }} />
              </div>
              <p className="text-base font-black mb-2" style={{ color: titleColor }}>Report content not filled in yet</p>
              <p className="text-sm leading-relaxed mb-6 max-w-sm" style={{ color: mutedTextColor }}>
                This report was created but the summary, images, and assessment haven't been added. Open it in the Report Wizard to complete it.
              </p>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all hover:opacity-80 cursor-pointer"
                style={{ background: `${accent}18`, border: `1px solid ${accent}33`, color: accent }}
              >
                <FileText className="w-4 h-4" /> Go to Reports tab to edit
              </button>
            </div>
          )}

        </div>

        {/* Right: metadata sidebar */}
        <div className="w-72 shrink-0 overflow-y-auto p-5 space-y-4"
          style={{ borderLeft: `1px solid ${borderColor}`, background: sidebarBg }}>

          {/* Meta card */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: cardColor, border: `1px solid ${borderColor}` }}>
            {[
              { label: 'Client', value: report.client, icon: <Building2 className="w-3 h-3" /> },
              { label: 'Industry', value: report.industry, icon: <Layers className="w-3 h-3" /> },
              { label: 'Author', value: report.authorName, icon: <FileText className="w-3 h-3" /> },
              { label: 'Date', value: report.date ? new Date(report.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined, icon: <Calendar className="w-3 h-3" /> },
            ].filter(r => r.value).map(row => (
              <div key={row.label}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: isDark ? '#334155' : '#64748b' }}>{row.label}</p>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: isDark ? '#475569' : '#94a3b8' }}>{row.icon}</span>
                  <p className="text-xs font-bold" style={{ color: textColor }}>{row.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status */}
          <div className="rounded-xl p-4" style={{ background: `${statusColor}0d`, border: `1px solid ${statusColor}22` }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: isDark ? '#334155' : '#64748b' }}>Status</p>
            <div className="flex items-center gap-2">
              {report.approvalStatus === 'Approved'
                ? <CheckCircle2 className="w-4 h-4" style={{ color: '#4ade80' }} />
                : <AlertCircle className="w-4 h-4" style={{ color: statusColor }} />}
              <span className="text-sm font-black" style={{ color: statusColor }}>
                {report.approvalStatus || report.status || 'Draft'}
              </span>
            </div>
          </div>

          {/* Image count */}
          {showImagery && images.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: cardColor, border: `1px solid ${borderColor}` }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: isDark ? '#334155' : '#64748b' }}>Imagery</p>
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4" style={{ color: accent }} />
                <span className="text-sm font-black" style={{ color: titleColor }}>{images.length}</span>
                <span className="text-xs" style={{ color: mutedTextColor }}>inspection {images.length === 1 ? 'photo' : 'photos'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportViewer;
