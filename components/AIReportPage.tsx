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
  Shield, ChevronDown, ChevronUp, Layers, ShieldAlert, Droplets,
  Image, Flag, Info,
} from 'lucide-react';
import apiClient from '../services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AIReportIssue {
  id?: string;
  type: string;
  severity: string;
  confidence?: number;
  location?: string;
  tempDelta?: number;
  peakTempCelsius?: number;
  panelId?: string;
  category?: string;
  affectedArea?: string;
  usStandardViolation?: string;
  immediateActionRequired?: boolean;
  description?: string;
  sourceFile?: string;
  system?: string;
  material?: string;
  dimensions?: string;
}

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
  criticalIssues?: number;
  overallCondition: string;
  maxTempDelta: number | null;
  soilingPercent?: number | null;
  imageQuality: string | null;
  filesProcessed?: number;
  issues: AIReportIssue[];
  faults?: AIReportIssue[];
  defects?: AIReportIssue[];
  anomalies?: AIReportIssue[];
  recommendations: string[];
  complianceFlags?: string[];
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
  high:     'bg-orange-500/10 border-orange-500/30 text-orange-400',
  medium:   'bg-amber-500/10 border-amber-500/30 text-amber-400',
  low:      'bg-slate-800 border-slate-700 text-slate-400',
};
function fmt(dt: string) {
  try { return new Date(dt).toLocaleDateString('en-US', { dateStyle: 'long' }); } catch { return dt; }
}

// ── Report Viewer Component ────────────────────────────────────────────────────
export function AIReportViewer({ report, onBack }: { report: AIReportData; onBack?: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const risk = RISK_COLORS[report.riskLevel] ?? RISK_COLORS.low;

  const sorted = [...(report.issues ?? [])].sort(
    (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)
  );
  const visible = showAll ? sorted : sorted.slice(0, 12);
  const immediateActions = sorted.filter(i => i.immediateActionRequired);
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
        {report.filesProcessed != null && (
          <span className="text-[10px] text-slate-500 font-bold">{report.filesProcessed} file{report.filesProcessed !== 1 ? 's' : ''} analyzed</span>
        )}
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-colors">
          <Printer size={13} /> Save PDF / Print
        </button>
      </div>

      {/* Report body */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6 print:py-4">

        {/* Header */}
        <div className="border-b border-slate-800 print:border-slate-300 pb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit size={16} className="text-indigo-400 print:text-indigo-600" />
                <span className="text-[10px] font-black text-indigo-400 print:text-indigo-600 uppercase tracking-widest">
                  Axis AI Inspection Report · US Standards Compliant
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
            {report.filesProcessed != null && <span className="flex items-center gap-1.5"><Image size={10} />{report.filesProcessed} files analyzed</span>}
          </div>
        </div>

        {/* ── IMMEDIATE ACTION REQUIRED ALERT ────────────────────────────────── */}
        {immediateActions.length > 0 && (
          <div className="border border-red-500/40 bg-red-500/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={16} className="text-red-400 shrink-0" />
              <span className="text-sm font-black text-red-400 uppercase tracking-wider">
                Immediate Action Required — {immediateActions.length} Critical Item{immediateActions.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {immediateActions.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-red-300">
                  <Zap size={10} className="mt-0.5 shrink-0 text-red-400" />
                  <div>
                    <span className="font-bold">{issue.type}</span>
                    {issue.location && <span className="text-red-400/70"> — {issue.location}</span>}
                    {issue.usStandardViolation && (
                      <span className="ml-2 text-[9px] bg-red-500/20 border border-red-500/30 text-red-300 px-1.5 py-0.5 rounded font-bold">
                        {issue.usStandardViolation}
                      </span>
                    )}
                    {issue.description && <p className="text-red-400/60 mt-0.5">{issue.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Issues',   value: report.totalIssues,   color: report.totalIssues > 0 ? 'text-amber-400' : 'text-emerald-400', Icon: AlertTriangle },
            { label: 'Critical',       value: sevCount('critical'),  color: sevCount('critical') > 0 ? 'text-red-400' : 'text-slate-500',   Icon: ShieldAlert  },
            { label: 'Risk Score',     value: `${report.riskScore}/100`, color: risk.text,                                                    Icon: Shield       },
            { label: 'Max ΔTemp',      value: report.maxTempDelta != null ? `${report.maxTempDelta}°C` : '—', color: 'text-orange-400',       Icon: Thermometer  },
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

        {/* Soiling % card — solar only */}
        {report.soilingPercent != null && (
          <div className="bg-slate-900 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <Droplets size={18} className="text-blue-400 shrink-0" />
            <div>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-black mb-0.5">Soiling Coverage</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-400">{report.soilingPercent}%</span>
                <span className="text-[10px] text-slate-500">of array surface affected</span>
              </div>
            </div>
            <div className="flex-1 ml-4">
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min(100, report.soilingPercent)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Risk bar */}
        <div className="bg-slate-900 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4">
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
            <span>Overall Risk</span>
            <span className={risk.text}>{report.riskLevel.toUpperCase()} — {report.overallCondition}</span>
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

        {/* ── COMPLIANCE FLAGS ────────────────────────────────────────────────── */}
        {report.complianceFlags && report.complianceFlags.length > 0 && (
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flag size={13} className="text-orange-400" />
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                US Regulatory Compliance Flags ({report.complianceFlags.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.complianceFlags.map((flag, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 text-[10px] font-bold">
                  {flag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {report.summary && (
          <div className="bg-slate-900/60 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-xl p-4">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">AI Summary</p>
            <div className="space-y-1">
              {report.summary.split('\n').map((line, i) => (
                <p key={i} className="text-sm text-slate-300 print:text-slate-700 leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* ── ISSUES TABLE ────────────────────────────────────────────────────── */}
        {sorted.length > 0 && (
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 print:text-slate-600 mb-3 flex items-center gap-2">
              <Activity size={12} /> Detected Issues ({sorted.length})
            </h2>
            <div className="space-y-2">
              {visible.map((issue, i) => (
                <div
                  key={i}
                  className={`rounded-xl border overflow-hidden transition-all cursor-pointer ${
                    issue.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                    issue.severity === 'high'     ? 'border-orange-500/30 bg-orange-500/5' :
                    issue.severity === 'medium'   ? 'border-amber-500/30 bg-amber-500/5' :
                    'border-slate-800 bg-slate-900/60'
                  }`}
                  onClick={() => setExpandedIssue(expandedIssue === i ? null : i)}
                >
                  {/* Issue header row */}
                  <div className="flex items-center gap-3 px-4 py-3 text-[11px]">
                    {/* Severity badge */}
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[8px] font-black uppercase border ${SEV_COLOR[issue.severity] ?? SEV_COLOR.low}`}>
                      {issue.severity}
                    </span>

                    {/* Immediate action indicator */}
                    {issue.immediateActionRequired && (
                      <Zap size={10} className="text-red-400 shrink-0" title="Immediate action required" />
                    )}

                    {/* Type */}
                    <span className="font-bold text-white print:text-slate-900 flex-1 min-w-0 truncate">{issue.type}</span>

                    {/* Category pill */}
                    {issue.category && (
                      <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[8px] font-bold uppercase shrink-0">
                        {issue.category.replace(/_/g, ' ')}
                      </span>
                    )}

                    {/* Location */}
                    {issue.location && (
                      <span className="text-slate-500 print:text-slate-600 shrink-0 flex items-center gap-1">
                        <MapPin size={8} />{issue.location}
                      </span>
                    )}

                    {/* Delta temp */}
                    {issue.tempDelta != null && (
                      <span className="text-orange-400 font-bold shrink-0">{issue.tempDelta}°C</span>
                    )}

                    {/* Confidence */}
                    {issue.confidence != null && (
                      <span className="text-slate-500 shrink-0">{Math.round(issue.confidence * 100)}%</span>
                    )}

                    {/* Source file */}
                    {issue.sourceFile && (
                      <span className="hidden lg:inline text-[9px] text-slate-600 shrink-0 truncate max-w-[100px]" title={issue.sourceFile}>
                        {issue.sourceFile}
                      </span>
                    )}

                    <ChevronDown size={11} className={`text-slate-600 shrink-0 transition-transform ${expandedIssue === i ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Expanded detail panel */}
                  {expandedIssue === i && (
                    <div className="border-t border-slate-800/60 px-4 py-3 space-y-2 bg-slate-900/40 text-[11px]">
                      {issue.description && (
                        <div className="flex gap-2">
                          <Info size={10} className="text-slate-500 mt-0.5 shrink-0" />
                          <p className="text-slate-400 leading-snug">{issue.description}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-[10px]">
                        {issue.usStandardViolation && (
                          <div>
                            <span className="text-slate-600 uppercase tracking-wider font-bold">Standard</span>
                            <p className="text-orange-300 font-bold">{issue.usStandardViolation}</p>
                          </div>
                        )}
                        {issue.affectedArea && (
                          <div>
                            <span className="text-slate-600 uppercase tracking-wider font-bold">Affected Area</span>
                            <p className="text-slate-300">{issue.affectedArea}</p>
                          </div>
                        )}
                        {issue.panelId && (
                          <div>
                            <span className="text-slate-600 uppercase tracking-wider font-bold">Panel ID</span>
                            <p className="text-slate-300">{issue.panelId}</p>
                          </div>
                        )}
                        {issue.peakTempCelsius != null && (
                          <div>
                            <span className="text-slate-600 uppercase tracking-wider font-bold">Peak Temp</span>
                            <p className="text-orange-400 font-bold">{issue.peakTempCelsius}°C</p>
                          </div>
                        )}
                        {issue.material && (
                          <div>
                            <span className="text-slate-600 uppercase tracking-wider font-bold">Material</span>
                            <p className="text-slate-300">{issue.material}</p>
                          </div>
                        )}
                        {issue.dimensions && (
                          <div>
                            <span className="text-slate-600 uppercase tracking-wider font-bold">Dimensions</span>
                            <p className="text-slate-300">{issue.dimensions}</p>
                          </div>
                        )}
                        {issue.system && (
                          <div>
                            <span className="text-slate-600 uppercase tracking-wider font-bold">System</span>
                            <p className="text-slate-300">{issue.system.replace(/_/g, ' ')}</p>
                          </div>
                        )}
                        {issue.sourceFile && (
                          <div className="col-span-2">
                            <span className="text-slate-600 uppercase tracking-wider font-bold">Source Image</span>
                            <p className="text-slate-400 truncate">{issue.sourceFile}</p>
                          </div>
                        )}
                        {issue.immediateActionRequired && (
                          <div className="col-span-2 md:col-span-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 text-[9px] font-black uppercase">
                              <Zap size={8} /> Immediate Action Required
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {sorted.length > 12 && (
              <button onClick={() => setShowAll(s => !s)}
                className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-white transition-colors font-bold print:hidden">
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
        <div className="border-t border-slate-800 print:border-slate-300 pt-4 text-[9px] text-slate-600 print:text-slate-400 space-y-1">
          <p>Generated by Axis Platform AI on {fmt(report.generatedAt)} · Analysis type: {report.analysisType?.replace(/_/g,' ')}</p>
          <p className="text-slate-700">Standards referenced: OSHA 29 CFR 1910, NEC 2023 Art. 690, IEC 62446-3, IEC 61215, NFPA 70E, ACI 318, AISC 360, ASCE 7, ASTM E1933</p>
          <p className="text-slate-700">This report is AI-generated under zero-shot US safety standards analysis. All findings should be reviewed by a qualified licensed inspector before taking remediation action.</p>
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
  const [error, setError]   = useState<string | null>(null);

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
