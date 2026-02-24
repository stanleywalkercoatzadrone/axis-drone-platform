import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    FileText, Download, Trash2, Eye, X, ChevronLeft,
    Building2, Sun, Zap, HardHat, Radio, Search,
    Archive, AlertCircle, Shield
} from 'lucide-react';
import {
    listReports,
    deleteReport,
    downloadReport,
    getBlobUrl,
    formatSize,
    ReportMeta,
    ReportIndustry,
} from '../utils/reportStorage';

// ── Industry config ───────────────────────────────────────────────────────────

const INDUSTRY_CONFIG: Record<ReportIndustry, {
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

interface ViewerProps {
    meta: ReportMeta;
    onClose: () => void;
    onDownload: () => void;
}

const PDFViewer: React.FC<ViewerProps> = ({ meta, onClose, onDownload }) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const cfg = INDUSTRY_CONFIG[meta.industry];

    useEffect(() => {
        const url = getBlobUrl(meta.id);
        setBlobUrl(url);
        return () => { if (url) URL.revokeObjectURL(url); };
    }, [meta.id]);

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

            {/* PDF iframe */}
            <div className="flex-1 min-h-0 bg-slate-800">
                {blobUrl ? (
                    <iframe
                        src={blobUrl}
                        className="w-full h-full border-none"
                        title={meta.title}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center">
                            <AlertCircle size={36} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm">Could not load PDF. The file may have been cleared from storage.</p>
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
                    <p className="text-[11px] text-slate-500 mt-0.5">
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
            <button
                onClick={onView}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors border border-slate-700/50"
            >
                <Eye size={13} />
                View Report
            </button>
        </div>
    );
};

// ── Main Archive Component ────────────────────────────────────────────────────

const AIReportArchive: React.FC = () => {
    const [reports, setReports] = useState<ReportMeta[]>([]);
    const [viewing, setViewing] = useState<ReportMeta | null>(null);
    const [filter, setFilter] = useState<ReportIndustry | 'all'>('all');
    const [search, setSearch] = useState('');

    const refresh = useCallback(() => setReports(listReports()), []);

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
                        <h1 className="text-lg font-black text-slate-100 tracking-tight">AI Report Archive</h1>
                        <p className="text-[11px] text-slate-500">
                            {reports.length} report{reports.length !== 1 ? 's' : ''} saved · persists across sessions
                        </p>
                    </div>
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
