import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    FileText, Download, Trash2, Eye, X, ChevronLeft,
    Building2, Sun, Zap, HardHat, Radio, Search,
    Archive, AlertCircle, Shield
} from 'lucide-react';
import {
    listReports,
    listMissionReports,
    listAllGlobalReports,
    deleteReport,
    downloadReport,
    getBlobUrl,
    formatSize,
    ReportMeta,
    ReportIndustry,
} from '../utils/reportStorage';
import { 
    ArrowRight, Clock, Star, Info, List, BarChart, ArrowUpRight,
    RefreshCw, MapPin, Globe, Loader2
} from 'lucide-react';
import { SystemReportView } from './SystemReportView';

// ── Dashboard Component ───────────────────────────────────────────────────────

// ── Industry config ───────────────────────────────────────────────────────────

export const INDUSTRY_CONFIG: Record<ReportIndustry, {
    label: string; emoji: string; color: string; bg: string; border: string;
}> = {
    insurance: { label: 'Insurance', emoji: '🛡️', color: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    solar: { label: 'Solar', emoji: '☀️', color: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    utilities: { label: 'Utilities', emoji: '⚡', color: '#8b5cf6', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    construction: { label: 'Construction', emoji: '🏗️', color: '#06b6d4', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
    telecom: { label: 'Telecom', emoji: '📡', color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ── Inline PDF Viewer Modal ───────────────────────────────────────────────────

const ReportDashboard: React.FC<{ meta: ReportMeta; onClose?: () => void; onDownload?: () => void }> = ({ meta, onClose, onDownload }) => {
    // If the report has structured rawData (TOC, content, findings), use the high-fidelity SystemReportView
    if (meta.rawData?.toc || meta.rawData?.findings || meta.rawData?.content) {
        return <SystemReportView report={meta} onClose={onClose || (() => {})} onDownload={onDownload} embedded />;
    }

    const data = meta.rawData;
    if (!data) return null;

    // Fallback to legacy specific dashboards for old data
    if (meta.industry === 'insurance') {
        const report = data;
        const images = report.images || [];
        const allAnnotations = images.flatMap((img: any) => img.annotations || []);
        
        return (
            <div className="flex-1 overflow-y-auto bg-slate-950 p-8">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                    <ShieldIcon size={12} /> Insurance Intelligence
                                </span>
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">{report.title}</h1>
                            <p className="text-slate-400 font-medium flex items-center gap-2">
                                <MapPinIcon size={14} className="text-slate-500" /> {report.propertyAddress}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Claim Reference</p>
                            <p className="text-xl font-mono font-black text-white">{report.claimNumber || 'PENDING'}</p>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Risk Assessment</p>
                            <p className={`text-2xl font-black ${report.riskScore >= 75 ? 'text-red-400' : report.riskScore >= 50 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                {report.riskScore || 0} / 100
                            </p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Anomaly Count</p>
                            <p className="text-2xl font-black text-white">{allAnnotations.length}</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Carrier Group</p>
                            <p className="text-xl font-bold text-white truncate">{report.carrier || 'Unspecified'}</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Est. Damage</p>
                            <p className="text-2xl font-black text-emerald-400">
                                ${Number(report.totalDamageEstimate || 0).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-indigo-600/5 border border-indigo-500/20 rounded-3xl p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <BrainIcon size={80} />
                        </div>
                        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                             Executive Tactical Summary
                        </h3>
                        <p className="text-lg text-slate-300 leading-relaxed font-medium">
                            {report.executiveSummary}
                        </p>
                    </div>

                    {/* Findings Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Detailed Anomaly Registry</h3>
                            <span className="text-[10px] text-slate-600 font-bold">{allAnnotations.length} entries detected</span>
                        </div>
                        <div className="p-0">
                            <table className="w-full text-left">
                                <thead className="bg-slate-950/50">
                                    <tr>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Label</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Severity</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Est. Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {allAnnotations.map((a: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-slate-200">{a.label}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{a.location || 'Structural POI'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                                                    a.severity === 'Critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                    a.severity === 'High' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                    'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                }`}>
                                                    {a.severity}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="text-sm font-mono font-black text-slate-300">
                                                    ${Number(a.estimatedCostMin || 0).toLocaleString()}
                                                </p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (meta.industry === 'solar') {
        const { form, findings, aiSummary } = data;
        return (
            <div className="flex-1 overflow-y-auto bg-slate-950 p-8">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex justify-between items-end">
                        <div>
                             <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                    <Sun size={12} /> Photovoltaic Inspection
                                </span>
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">{form.siteName || 'Solar Asset'}</h1>
                            <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">Client: {form.clientName}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Inspection Date</p>
                            <p className="text-sm font-bold text-white uppercase">{new Date(meta.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-4 gap-4">
                         <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative group overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ZapIcon size={32} />
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Anomalies</p>
                            <p className="text-3xl font-black text-white">{findings.length}</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative group overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ShieldIcon size={32} />
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">System Health</p>
                            <p className="text-3xl font-black text-emerald-400">92.4%</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Inverter Group</p>
                            <p className="text-xl font-bold text-white truncate">{form.inverterModel || 'Standard'}</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Technician</p>
                            <p className="text-xl font-bold text-white truncate">{form.pilotName || 'Axis Pilot'}</p>
                        </div>
                    </div>

                    {/* AI Summary */}
                    <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 shadow-2xl">
                        <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                             <BrainIcon size={14} /> Neural Summary Insight
                        </h3>
                        <p className="text-xl text-slate-300 leading-relaxed font-inter italic">
                            "{aiSummary || "Site analysis demonstrates normal thermal signature variance. No immediate intervention required."}"
                        </p>
                    </div>

                    {/* Findings list */}
                    <div className="space-y-4">
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Anomalies Detected</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {findings.map((f: any, i: number) => (
                                <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-500">
                                        POI {i+1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-sm font-bold text-white truncate">{f.anomalyType}</h4>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${
                                                f.severity === 'Critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                            }`}>{f.severity}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 line-clamp-2">{f.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex items-center justify-center bg-slate-950 p-20 text-center">
             <div>
                <FileText size={48} className="mx-auto text-slate-800 mb-4" />
                <h3 className="text-xl font-black text-slate-500">Native Archive Viewer Unsupported</h3>
                <p className="text-slate-600 mt-2">This report's raw data schema is not registered for native rendering. Please use the PDF export view instead.</p>
             </div>
        </div>
    );
};

interface ViewerProps {
    meta: ReportMeta;
    onClose: () => void;
    onDownload: () => void;
}

export const PDFViewer: React.FC<ViewerProps> = ({ meta, onClose, onDownload }) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'pdf' | 'dashboard'>('pdf');
    const cfg = INDUSTRY_CONFIG[meta.industry];

    useEffect(() => {
        const url = getBlobUrl(meta.id);
        setBlobUrl(url);
        // If no PDF stored locally but we have structured data, show dashboard
        if (!url && meta.rawData) setViewMode('dashboard');
        return () => { if (url) URL.revokeObjectURL(url); };
    }, [meta.id, meta.rawData]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
            {/* Viewer header */}
            <div className="flex items-center gap-3 px-5 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
                <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm"
                >
                    <ChevronLeft size={16} />
                    <span className="hidden sm:inline">Back</span>
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} border ${cfg.border}`}
                            style={{ color: cfg.color }}
                        >
                            {cfg.emoji} {cfg.label}
                        </span>
                        <h1 className="text-sm font-bold text-slate-100 truncate">{meta.title}</h1>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDate(meta.createdAt)} · {formatSize(meta.sizeBytes)}
                    </p>
                </div>

                {meta.rawData && (
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button
                            onClick={() => setViewMode('pdf')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'pdf' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            PDF
                        </button>
                        <button
                            onClick={() => setViewMode('dashboard')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Data
                        </button>
                    </div>
                )}

                <button
                    onClick={onDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                    <Download size={15} />
                    Download
                </button>
                <button
                    onClick={onClose}
                    className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Viewer Content: PDF iframe or Dashboard */}
            <div className="flex-1 min-h-0 bg-slate-800 relative flex flex-col">
                {/* Dashboard view */}
                {viewMode === 'dashboard' && meta.rawData && (
                    <ReportDashboard meta={meta} onClose={onClose} onDownload={onDownload} />
                )}

                {/* PDF iframe view */}
                {viewMode === 'pdf' && blobUrl && (
                    <>
                        <iframe
                            src={blobUrl}
                            className="w-full h-full border-none"
                            title={meta.title}
                        />
                        <div className="absolute bottom-6 right-6 flex items-center gap-2">
                            {meta.rawData && (
                                <button
                                    onClick={() => setViewMode('dashboard')}
                                    className="px-3 py-2 bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-200 text-xs font-bold rounded-lg shadow-2xl hover:bg-slate-800 transition-all flex items-center gap-2"
                                >
                                    <BarChart size={13} className="text-indigo-400" />
                                    View Summary
                                </button>
                            )}
                            <button
                                onClick={onDownload}
                                className="px-3 py-2 bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-200 text-xs font-bold rounded-lg shadow-2xl hover:bg-slate-800 transition-all flex items-center gap-2"
                            >
                                <FileText size={13} className="text-amber-500" />
                                Can't see it? Download
                            </button>
                        </div>
                    </>
                )}

                {/* No PDF blob and no rawData — show download prompt */}
                {viewMode === 'pdf' && !blobUrl && !meta.rawData && (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center p-8 bg-slate-900/50 rounded-3xl border border-slate-800/50">
                            <AlertCircle size={48} className="mx-auto mb-4 text-amber-500/50" />
                            <h3 className="text-lg font-bold text-slate-200 mb-2">Preview Unavailable</h3>
                            <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">The PDF preview is not available for server-archived reports. Download to view the full report.</p>
                            <button
                                onClick={onDownload}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-xl flex items-center gap-2 mx-auto"
                            >
                                <Download size={18} />
                                Download Report Now
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Report Card ───────────────────────────────────────────────────────────────

interface CardProps {
    meta: ReportMeta;
    onView: () => void;
    onDownload: () => void;
    onDelete: () => void;
}

const ReportCard: React.FC<CardProps> = ({ meta, onView, onDownload, onDelete }) => {
    const cfg = INDUSTRY_CONFIG[meta.industry];
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div className="group bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all duration-200 hover:bg-slate-900/80">
            <div className="flex items-start gap-3">
                {/* Industry icon */}
                <div
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${cfg.bg} border ${cfg.border}`}
                >
                    {cfg.emoji}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span
                            className={`text-[9px] font-black uppercase tracking-wider ${cfg.bg} border ${cfg.border} px-1.5 py-0.5 rounded-full`}
                            style={{ color: cfg.color }}
                        >
                            {cfg.label}
                        </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 truncate">{meta.title}</h3>
                    
                    {/* Mission Context */}
                    {(meta.missionTitle || meta.siteName) && (
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-indigo-400 font-medium bg-indigo-500/5 py-0.5 px-1.5 rounded-md border border-indigo-500/10 w-fit">
                            <MapPin size={10} />
                            <span className="truncate max-w-[120px]">
                                {meta.siteName || meta.missionTitle}
                            </span>
                            {meta.clientName && (
                                <>
                                    <span className="text-slate-700">•</span>
                                    <span className="text-slate-500 truncate max-w-[80px]">{meta.clientName}</span>
                                </>
                            )}
                        </div>
                    )}

                    <p className="text-[11px] text-slate-500 mt-1">
                        {formatDate(meta.createdAt)} · {formatSize(meta.sizeBytes)}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5 truncate font-mono">{meta.filename}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={onView}
                        title="View PDF"
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    >
                        <Eye size={15} />
                    </button>
                    <button
                        onClick={onDownload}
                        title="Download PDF"
                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                    >
                        <Download size={15} />
                    </button>
                    {confirmDelete ? (
                        <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                            <span className="text-[10px] text-red-400 font-semibold">Delete?</span>
                            <button
                                onClick={onDelete}
                                className="text-[10px] font-black text-red-400 hover:text-red-300 ml-1"
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="text-[10px] text-slate-500 hover:text-slate-300"
                            >
                                No
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            title="Delete"
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Trash2 size={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* View button (always visible on small) */}
            <div className="mt-3 flex gap-2">
                <button
                    onClick={onView}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors border border-slate-700/50"
                >
                    <Eye size={13} />
                    View Report
                </button>
                {meta.missionId && (
                    <button
                        onClick={() => window.location.href = `/missions/${meta.missionId}`}
                        className="flex items-center justify-center p-2 rounded-lg bg-indigo-900/20 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-500/20 transition-colors"
                        title="Launch Mission"
                    >
                        <ArrowUpRight size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

// ── Main Archive Component ────────────────────────────────────────────────────

const AIReportArchive: React.FC<{ defaultSearch?: string; missionId?: string }> = ({ defaultSearch, missionId }) => {
    const [reports, setReports] = useState<ReportMeta[]>([]);
    const [viewing, setViewing] = useState<ReportMeta | null>(null);
    const [filter, setFilter] = useState<ReportIndustry | 'all'>('all');
    const [search, setSearch] = useState(defaultSearch || '');

    // Reset search if defaultSearch changes (e.g. user selects a different mission)
    useEffect(() => {
        if (defaultSearch !== undefined) {
            setSearch(defaultSearch);
        }
    }, [defaultSearch]);

    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            if (missionId) {
                const res = await listMissionReports(missionId);
                setReports(res);
            } else {
                // Fetch from backend but fallback to local if needed
                const global = await listAllGlobalReports();
                const local = listReports();
                
                // Merge and deduplicate by ID
                const joined = [...global];
                const globalIds = new Set(global.map(g => g.id));
                local.forEach(l => {
                    if (!globalIds.has(l.id)) joined.push(l);
                });
                
                setReports(joined.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            }
        } finally {
            setLoading(false);
        }
    }, [missionId]);

    useEffect(() => { refresh(); }, [refresh]);

    // Listen for new reports saved while this panel is open.
    // 'storage' fires for cross-tab saves; 'axis-report-saved' fires for same-tab saves
    // (window.dispatchEvent in reportStorage.ts since StorageEvent is cross-tab only).
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'axis_ai_reports_index') refresh();
        };
        const handleCustom = () => refresh();
        window.addEventListener('storage', handleStorage);
        window.addEventListener('axis-report-saved', handleCustom);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('axis-report-saved', handleCustom);
        };
    }, [refresh]);

    const handleDelete = (id: string) => {
        deleteReport(id);
        refresh();
        if (viewing?.id === id) setViewing(null);
    };

    const filtered = reports.filter(r => {
        const matchIndustry = filter === 'all' || r.industry === filter;
        const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.filename.toLowerCase().includes(search.toLowerCase());
        return matchIndustry && matchSearch;
    });

    // Count by industry
    const counts = reports.reduce<Record<string, number>>((acc, r) => {
        acc[r.industry] = (acc[r.industry] || 0) + 1;
        return acc;
    }, {});

    if (viewing) {
        return (
            <PDFViewer
                meta={viewing}
                onClose={() => setViewing(null)}
                onDownload={() => downloadReport(viewing)}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-50">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="border-b border-slate-800 px-6 py-5 shrink-0">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Archive size={18} className="text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-100 tracking-tight">
                            {missionId ? 'Mission AI Reports' : 'AI Report Archive'}
                        </h1>
                        <p className="text-[11px] text-slate-500">
                            {reports.length} report{reports.length !== 1 ? 's' : ''} {missionId ? 'linked to mission' : 'synced from enterprise database'}
                        </p>
                    </div>
                    
                    <button 
                        onClick={refresh}
                        disabled={loading}
                        className="ml-auto p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-all hover:border-slate-700"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Stats pills */}
                {reports.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {(Object.keys(INDUSTRY_CONFIG) as ReportIndustry[])
                            .filter(k => counts[k])
                            .map(k => {
                                const cfg = INDUSTRY_CONFIG[k];
                                return (
                                    <span
                                        key={k}
                                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} border ${cfg.border}`}
                                        style={{ color: cfg.color }}
                                    >
                                        {cfg.emoji} {counts[k]} {cfg.label}
                                    </span>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* ── Filters ────────────────────────────────────────────────────── */}
            {reports.length > 0 && (
                <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-800/50 shrink-0 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-48">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search reports…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
                        />
                    </div>

                    {/* Industry filter */}
                    <div className="flex items-center gap-1 flex-wrap">
                        {(['all', ...Object.keys(INDUSTRY_CONFIG)] as Array<'all' | ReportIndustry>).map(k => {
                            const cfg = k !== 'all' ? INDUSTRY_CONFIG[k] : null;
                            const isActive = filter === k;
                            return (
                                <button
                                    key={k}
                                    onClick={() => setFilter(k)}
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${isActive
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                        }`}
                                >
                                    {cfg ? `${cfg.emoji} ${cfg.label}` : 'All'}
                                    {cfg && counts[k] ? ` (${counts[k]})` : ''}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── List ───────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {reports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20">
                        <div className="w-20 h-20 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-5">
                            <FileText size={32} className="text-slate-600" />
                        </div>
                        <h2 className="text-lg font-black text-slate-400 mb-2">No Reports Yet</h2>
                        <p className="text-sm text-slate-600 max-w-xs">
                            Generate an AI report from the Solar or Insurance generators —
                            it will automatically appear here and persist across sessions.
                        </p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Search size={28} className="text-slate-700 mb-3" />
                        <p className="text-slate-500 text-sm">No reports match your filter.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filtered.map(meta => (
                            <ReportCard
                                key={meta.id}
                                meta={meta}
                                onView={() => setViewing(meta)}
                                onDownload={() => downloadReport(meta)}
                                onDelete={() => handleDelete(meta.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIReportArchive;
