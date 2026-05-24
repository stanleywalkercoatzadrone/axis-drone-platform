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
  id: string;
  title: string;
  client?: string;
  industry?: string;
  theme?: string;
  status?: string;
  approvalStatus?: string;
  date?: string;
  summary?: string;
  siteContext?: string;
  strategicAssessment?: string;
  images?: ReportImage[];
  authorName?: string;
  branding?: { primaryColor?: string; logoUrl?: string; companyName?: string };
  config?: Record<string, unknown>;
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
  const accent = report.branding?.primaryColor || '#38bdf8';

  const statusColor = report.approvalStatus === 'Approved' ? '#4ade80'
    : report.approvalStatus === 'Rejected' ? '#f87171'
    : '#facc15';

  async function exportPDF() {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      if (!contentRef.current) return;
      const canvas = await html2canvas(contentRef.current, { scale: 1.5, backgroundColor: '#020817', useCORS: true });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h);
      pdf.save(`${report.title || 'Report'}.pdf`);
    } catch { /* silent */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#020817' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(2,8,23,0.97)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl" style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
            <FileText className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white truncate">{report.title}</p>
            <div className="flex items-center gap-3 mt-0.5">
              {report.client && (
                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#64748b' }}>
                  <Building2 className="w-2.5 h-2.5" />{report.client}
                </span>
              )}
              {report.date && (
                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#64748b' }}>
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}>
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-8 space-y-8" style={{ background: '#020817' }}>

          {/* Summary */}
          {report.summary && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>
                Executive Summary
              </h2>
              <div className="rounded-2xl p-5" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.1)' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>{report.summary}</p>
              </div>
            </section>
          )}

          {/* Images carousel */}
          {images.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#64748b' }}>
                  Inspection Images ({images.length})
                </h2>
                {images.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setImgIndex(i => Math.max(0, i - 1))}
                      disabled={imgIndex === 0}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 hover:opacity-70"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-black" style={{ color: '#475569' }}>
                      {imgIndex + 1} / {images.length}
                    </span>
                    <button onClick={() => setImgIndex(i => Math.min(images.length - 1, i + 1))}
                      disabled={imgIndex === images.length - 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 hover:opacity-70"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <AnnotatedImage img={images[imgIndex]} />
              {images[imgIndex]?.summary && (
                <p className="text-xs mt-3 leading-relaxed" style={{ color: '#64748b' }}>
                  {images[imgIndex].summary}
                </p>
              )}
              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button key={img.id} onClick={() => setImgIndex(i)}
                      className="shrink-0 rounded-lg overflow-hidden transition-all"
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
          {report.siteContext && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>
                Site Context
              </h2>
              <div className="rounded-2xl p-5" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#38bdf8' }} />
                  <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{report.siteContext}</p>
                </div>
              </div>
            </section>
          )}

          {/* Strategic assessment */}
          {report.strategicAssessment && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>
                Strategic Assessment
              </h2>
              <div className="rounded-2xl p-5" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)' }}>
                <div className="flex items-start gap-3">
                  <BarChart3 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#a78bfa' }} />
                  <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{report.strategicAssessment}</p>
                </div>
              </div>
            </section>
          )}

          {/* Empty state — report has no content yet */}
          {!report.summary && !report.siteContext && !report.strategicAssessment && images.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
              <div className="p-5 rounded-3xl mb-5" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <FileText className="w-10 h-10" style={{ color: '#a78bfa' }} />
              </div>
              <p className="text-base font-black text-white mb-2">Report content not filled in yet</p>
              <p className="text-sm leading-relaxed mb-6 max-w-sm" style={{ color: '#475569' }}>
                This report was created but the summary, images, and assessment haven't been added. Open it in the Report Wizard to complete it.
              </p>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all hover:opacity-80"
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
              >
                <FileText className="w-4 h-4" /> Go to Reports tab to edit
              </button>
            </div>
          )}

        </div>

        {/* Right: metadata sidebar */}
        <div className="w-72 shrink-0 overflow-y-auto p-5 space-y-4"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(2,8,23,0.95)' }}>

          {/* Meta card */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {[
              { label: 'Client', value: report.client, icon: <Building2 className="w-3 h-3" /> },
              { label: 'Industry', value: report.industry, icon: <Layers className="w-3 h-3" /> },
              { label: 'Author', value: report.authorName, icon: <FileText className="w-3 h-3" /> },
              { label: 'Date', value: report.date ? new Date(report.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined, icon: <Calendar className="w-3 h-3" /> },
            ].filter(r => r.value).map(row => (
              <div key={row.label}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: '#334155' }}>{row.label}</p>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: '#475569' }}>{row.icon}</span>
                  <p className="text-xs font-bold" style={{ color: '#94a3b8' }}>{row.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status */}
          <div className="rounded-xl p-4" style={{ background: `${statusColor}0d`, border: `1px solid ${statusColor}22` }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#334155' }}>Status</p>
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
          {images.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(30,41,59,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#334155' }}>Imagery</p>
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4" style={{ color: '#38bdf8' }} />
                <span className="text-sm font-black text-white">{images.length}</span>
                <span className="text-xs" style={{ color: '#475569' }}>inspection {images.length === 1 ? 'photo' : 'photos'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportViewer;
