/**
 * AIReportPage.tsx — Full AI Inspection Report viewer (printable / PDF)
 *
 * Accessible at: /report/:jobId (admin) or as modal via client dashboard
 * Also exported as <AIReportViewer report={data} /> for inline use
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, CheckCircle2, Printer, ArrowLeft, BrainCircuit,
  Thermometer, Zap, MapPin, Calendar, User, FileText, Activity,
  Shield, ChevronDown, ChevronUp, Layers,
} from 'lucide-react';
import apiClient from '../services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AIReportData {
  jobId: string;
  missionId: string;
  missionTitle: string;
  siteName: string;
  pilotName: string;
  uploadType: string;
  analysisType: string;
  generatedAt: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  totalIssues: number;
  overallCondition: string;
  maxTempDelta: number | null;
  imageQuality: string | null;
  issues: Array<{
    type: string;
    severity: string;
    confidence?: number;
    location?: string;
    tempDelta?: number;
  }>;
  recommendations: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const RISK_COLORS = {
  low:      { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  medium:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   bar: 'bg-amber-500'   },
  high:     { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-400',  bar: 'bg-orange-500'  },
  critical: { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     bar: 'bg-red-500'     },
};
const SEV_ORDER = ['critical','high','medium','low'];
const SEV_COLOR: Record<string,string> = {
  critical: 'bg-red-500/10 border-red-500/30 text-red-400',
  high: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  medium: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  low: 'bg-slate-800 border-slate-700 text-slate-400',
};
function fmt(dt: string) {
  try { return new Date(dt).toLocaleDateString('en-US', { dateStyle: 'long' }); } catch { return dt; }
}

// ── Report Viewer Component ────────────────────────────────────────────────────
export function AIReportViewer({ report, onBack }: { report: AIReportData; onBack?: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const risk = RISK_COLORS[report.riskLevel] ?? RISK_COLORS.low;

  const sorted = [...(report.issues ?? [])].sort(
    (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)
  );
  const visible = showAll ? sorted : sorted.slice(0, 8);

  const handlePrint = () => window.print();

  const sevCount = (sev: string) => sorted.filter(i => i.severity === sev).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white print:bg-white print:text-black" ref={printRef}>
      {/* Toolbar — hidden on print */}
      <div className="print:hidden sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors font-bold">
            <ArrowLeft size={14} /> Back
          </button>
        )}
        <div className="flex-1" />
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-colors">
          <Printer size={13} /> Save PDF / Print
        </button>
      </div>

      {/* Report body */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 print:py-4">

        {/* Header */}
        <div className="border-b border-slate-800 print:border-slate-300 pb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit size={16} className="text-indigo-400 print:text-indigo-600" />
                <span className="text-[10px] font-black text-indigo-400 print:text-indigo-600 uppercase tracking-widest">
                  Axis AI Inspection Report
                </span>
              </div>
              <h1 className="text-2xl font-black text-white print:text-slate-900 leading-tight">
                {report.siteName || report.missionTitle || 'Inspection Report'}
              </h1>
              <p className="text-sm text-slate-500 print:text-slate-600 mt-1">{report.missionTitle}</p>
            </div>
            {/* Risk badge */}
            <div className={`flex flex-col items-center px-5 py-3 rounded-2xl border ${risk.bg} ${risk.border}`}>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Risk Score</span>
              <span className={`text-3xl font-black tabular-nums ${risk.text}`}>{report.riskScore}</span>
              <span className={`text-[10px] font-black uppercase mt-0.5 ${risk.text}`}>{report.riskLevel}</span>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-slate-500 print:text-slate-600">
            {report.siteName && <span className="flex items-center gap-1.5"><MapPin size={10} />{report.siteName}</span>}
            {report.pilotName && <span className="flex items-center gap-1.5"><User size={10} />Pilot: {report.pilotName}</span>}
            <span className="flex items-center gap-1.5"><Calendar size={10} />{fmt(report.generatedAt)}</span>
            <span className="flex items-center gap-1.5"><Layers size={10} />Type: {report.uploadType} / {report.analysisType?.replace(/_/g,' ')}</span>
            {report.imageQuality && <span className="flex items-center gap-1.5"><FileText size={10} />Image Quality: {report.imageQuality}</span>}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Issues',  value: report.totalIssues, color: report.totalIssues > 0 ? 'text-amber-400' : 'text-emerald-400', Icon: AlertTriangle },
            { label: 'Risk Score',    value: `${report.riskScore}/100`, color: risk.text, Icon: Shield },
            { label: 'Critical',      value: sevCount('critical'), color: sevCount('critical') > 0 ? 'text-red-400' : 'text-slate-500', Icon: Zap },
            { label: 'Max ΔTemp',     value: report.maxTempDelta != null ? `${report.maxTempDelta}°C` : '—', color: 'text-orange-400', Icon: Thermometer },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="bg-slate-900 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={10} className="text-slate-600" />
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
              </div>
              <p className={`text-2xl font-black ${color} print:text-slate-900`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Risk bar */}
        <div className="bg-slate-900 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4">
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
            <span>Overall Risk</span>
            <span className={risk.text}>{report.riskLevel.toUpperCase()}</span>
          </div>
          <div className="w-full bg-slate-800 print:bg-slate-200 rounded-full h-2.5">
            <div className={`${risk.bar} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${report.riskScore}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-slate-600">
            <span>0 — Low</span><span>50 — High</span><span>100 — Critical</span>
          </div>
        </div>

        {/* Severity breakdown */}
        <div className="grid grid-cols-4 gap-2">
          {SEV_ORDER.map(sev => {
            const count = sevCount(sev);
            return (
              <div key={sev} className={`rounded-xl border p-3 ${count > 0 ? SEV_COLOR[sev] : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                <p className="text-[9px] font-black uppercase tracking-wider">{sev}</p>
                <p className="text-2xl font-black tabular-nums">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {report.summary && (
          <div className="bg-slate-900/60 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">AI Summary</p>
            <p className="text-sm text-slate-300 print:text-slate-700 leading-relaxed">{report.summary}</p>
          </div>
        )}

        {/* Issues table */}
        {sorted.length > 0 && (
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 print:text-slate-600 mb-3 flex items-center gap-2">
              <Activity size={12} /> Detected Issues ({sorted.length})
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-800 print:border-slate-200">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-slate-800/50 print:bg-slate-100 border-b border-slate-700 print:border-slate-200">
                    {['Severity','Type','Location','Temp Δ','Confidence'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-black text-slate-500 print:text-slate-600 uppercase tracking-wider text-[9px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((issue, i) => (
                    <tr key={i} className="border-b border-slate-800/50 print:border-slate-100 hover:bg-slate-800/30 print:hover:bg-transparent">
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${SEV_COLOR[issue.severity] ?? SEV_COLOR.low}`}>
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300 print:text-slate-700 font-medium">{issue.type}</td>
                      <td className="px-3 py-2 text-slate-500 print:text-slate-600">{issue.location ?? '—'}</td>
                      <td className="px-3 py-2 text-orange-400 font-bold">{issue.tempDelta != null ? `${issue.tempDelta}°C` : '—'}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {issue.confidence != null ? `${Math.round(issue.confidence * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > 8 && (
              <button onClick={() => setShowAll(s => !s)}
                className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-white transition-colors font-bold print:hidden">
                {showAll ? <><ChevronUp size={11} /> Show fewer</> : <><ChevronDown size={11} /> Show all {sorted.length} issues</>}
              </button>
            )}
          </div>
        )}

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 print:text-slate-600 mb-3 flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-400" /> Recommended Actions
            </h2>
            <div className="space-y-2">
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-3 bg-slate-900/60 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl px-4 py-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[9px] font-black flex items-center justify-center">{i+1}</span>
                  <p className="text-sm text-slate-300 print:text-slate-700 leading-snug">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 print:border-slate-300 pt-4 text-[9px] text-slate-600 print:text-slate-400">
          <p>Generated by Axis Platform AI on {fmt(report.generatedAt)} · Analysis type: {report.analysisType?.replace(/_/g,' ')} · This report is AI-generated and should be reviewed by a qualified inspector before taking remediation action.</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
          @page { margin: 0.75in; }
        }
      `}</style>
    </div>
  );
}

// ── Page wrapper — fetches from API ───────────────────────────────────────────
interface AIReportPageProps { jobId: string; onBack?: () => void; }

const AIReportPage: React.FC<AIReportPageProps> = ({ jobId, onBack }) => {
  const [report, setReport] = useState<AIReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get(`/pilot/upload-jobs/${jobId}/report`)
      .then(r => setReport(r.data?.data ?? null))
      .catch(e => setError(e.response?.data?.message || 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <BrainCircuit size={32} className="text-indigo-400 animate-pulse mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-bold">Loading report…</p>
      </div>
    </div>
  );

  if (error || !report) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
        <p className="text-sm text-slate-400">{error ?? 'Report not available'}</p>
        {onBack && <button onClick={onBack} className="mt-4 text-xs text-slate-500 hover:text-white flex items-center gap-1 mx-auto"><ArrowLeft size={11} /> Back</button>}
      </div>
    </div>
  );

  return <AIReportViewer report={report} onBack={onBack} />;
};

export default AIReportPage;
