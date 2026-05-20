import React, { useState, useEffect } from 'react';
import {
    Download, Box, FileText, Image, ExternalLink,
    Loader2, CheckCircle, Package, AlertCircle,
    Flame, AlertTriangle, ShieldAlert, BrainCircuit, Eye
} from 'lucide-react';
import apiClient from '../../../../services/apiClient';

interface AIReportData {
    riskLevel?: 'critical' | 'high' | 'medium' | 'low';
    totalIssues?: number;
    riskScore?: number;
    maxTempDelta?: number;
    summary?: string;
}

const RISK_STYLES: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

interface Deliverable {
    id: string; project_id: string; project_name: string;
    orthomosaic_url: string | null; model_3d_url: string | null;
    report_url: string | null; created_at: string;
}

interface AIReportRow {
    id: string;
    deployment_id: string;
    mission_title: string;
    site_name: string;
    report_data: AIReportData;
    created_at: string;
}

const MOCK: Deliverable[] = [
    { id:'1', project_id:'p1', project_name:'Riverstart Solar Phase I',
      orthomosaic_url:'https://example.com/ortho/riverstart.tif',
      model_3d_url:'https://example.com/3d/riverstart.obj',
      report_url:'https://example.com/reports/riverstart.pdf', created_at:'2026-03-06' },
    { id:'2', project_id:'p2', project_name:'Desert Ridge Solar Farm',
      orthomosaic_url:'https://example.com/ortho/desert-ridge.tif',
      model_3d_url:null,
      report_url:'https://example.com/reports/desert-ridge.pdf', created_at:'2026-03-08' },
];

const ASSET_TYPES = [
    { key: 'orthomosaic_url' as const, label:'Orthomosaic Map', ext:'GeoTIFF', icon: Image,    accent:'border-sky-500/20',    iconColor:'text-sky-400',    bg:'bg-sky-500/10' },
    { key: 'model_3d_url'   as const, label:'3D Model',        ext:'OBJ / LAS', icon: Box,    accent:'border-violet-500/20', iconColor:'text-violet-400', bg:'bg-violet-500/10' },
    { key: 'report_url'     as const, label:'Inspection Report', ext:'PDF',    icon: FileText, accent:'border-amber-500/20',  iconColor:'text-amber-400',  bg:'bg-amber-500/10' },
];

function fmt(dt: string) {
    try { return new Date(dt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
    catch { return dt; }
}

function AssetCard({ label, url, ext, icon: Icon, accent, iconColor, bg }: {
    label:string; url:string|null; ext:string;
    icon:React.ElementType; accent:string; iconColor:string; bg:string;
}) {
    const ok = !!url;
    return (
        <div onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
            className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-300
                ${ok ? `${accent} bg-slate-800/50 cursor-pointer hover:brightness-110 hover:scale-[1.02] group` : 'bg-slate-900/20 border-slate-800/30 opacity-50'}`}>
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={18} className={iconColor} />
            </div>
            <div>
                <div className="font-bold text-white text-sm mb-0.5">{label}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{ext}</div>
            </div>
            {ok ? (
                <div className="flex items-center gap-2 mt-auto text-emerald-400 text-xs font-black uppercase tracking-widest group-hover:text-emerald-300 transition-colors">
                    <Download size={12} />Download<ExternalLink size={10} />
                </div>
            ) : (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600 mt-auto font-bold uppercase tracking-widest">
                    <AlertCircle size={10} />Not yet available
                </div>
            )}
        </div>
    );
}

// ── AI Report Card ─────────────────────────────────────────────────────────────
function AIReportCard({ row, onView }: { row: AIReportRow; onView: (r: AIReportRow) => void }) {
    const d = row.report_data;
    const riskStyle = RISK_STYLES[d?.riskLevel ?? 'low'];
    const RiskIcon = d?.riskLevel === 'critical' ? Flame : d?.riskLevel === 'high' ? AlertTriangle : ShieldAlert;

    return (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 flex flex-col gap-3 hover:border-indigo-500/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <BrainCircuit size={14} className="text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white leading-tight">{row.site_name || row.mission_title}</p>
                        <p className="text-[10px] text-slate-500">{row.mission_title} · {fmt(row.created_at)}</p>
                    </div>
                </div>
                {d?.riskLevel && (
                    <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase ${riskStyle}`}>
                        <RiskIcon size={10} />
                        {d.riskLevel} risk
                    </span>
                )}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900/60 rounded-xl p-2 text-center border border-slate-800">
                    <p className="text-[8px] text-slate-600 uppercase font-bold">Issues</p>
                    <p className={`text-lg font-black ${(d?.totalIssues ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{d?.totalIssues ?? 0}</p>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-2 text-center border border-slate-800">
                    <p className="text-[8px] text-slate-600 uppercase font-bold">Risk</p>
                    <p className={`text-lg font-black ${RISK_STYLES[d?.riskLevel ?? 'low']?.split(' ')[2] ?? 'text-emerald-400'}`}>{d?.riskScore ?? 0}/100</p>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-2 text-center border border-slate-800">
                    <p className="text-[8px] text-slate-600 uppercase font-bold">Max ΔT</p>
                    <p className="text-lg font-black text-orange-400">{d?.maxTempDelta != null ? `${d.maxTempDelta}°` : '—'}</p>
                </div>
            </div>

            {d?.summary && (
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{d.summary}</p>
            )}

            <button onClick={() => onView(row)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black hover:bg-indigo-500/20 transition-colors">
                <Eye size={12} /> View Full AI Report
            </button>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const ClientDeliverables: React.FC = () => {
    const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/client/deliverables')
            .then(r  => setDeliverables(r.data.data ?? []))
            .catch(() => setDeliverables(MOCK))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="text-emerald-400 animate-spin" size={32} /></div>;

    const totalAssets = deliverables.reduce((n, d) => n + ASSET_TYPES.filter(a => d[a.key]).length, 0);
    const maxAssets   = deliverables.length * ASSET_TYPES.length;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

            {/* Page header */}
            <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <Package size={24} className="text-violet-400" /> Deliverables
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                    Download your project outputs — reports, maps, and data files
                </p>
            </div>

            {/* Assets ready summary */}
            {deliverables.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500">
                        {deliverables.length} project{deliverables.length !== 1 ? 's' : ''} with deliverables
                    </p>
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-2 text-right">
                        <span className="text-lg font-black text-white tabular-nums">{totalAssets}</span>
                        <span className="text-slate-600">/{maxAssets}</span>
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-2">assets ready</span>
                    </div>
                </div>
            )}

            {/* Project deliverables */}
            <div className="space-y-6">
                    {deliverables.map(d => {
                        const readyCount = ASSET_TYPES.filter(a => d[a.key]).length;
                        const allReady   = readyCount === ASSET_TYPES.length;
                        return (
                            <div key={d.id} className="bg-slate-800/30 border border-slate-700/40 rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-5 flex-wrap">
                                    <div className={`w-2 h-2 rounded-full ${allReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                                    <h3 className="font-black text-white text-base">{d.project_name}</h3>
                                    {allReady && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md">
                                            <CheckCircle size={9} />All Ready
                                        </span>
                                    )}
                                    <span className="ml-auto text-[10px] text-slate-600 font-bold">
                                        {new Date(d.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {ASSET_TYPES.map(a => <AssetCard key={a.key} {...a} url={d[a.key]} />)}
                                </div>
                                <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center gap-4 flex-wrap">
                                    {ASSET_TYPES.map(a => (
                                        <div key={a.key} className="flex items-center gap-1.5">
                                            {d[a.key]
                                                ? <CheckCircle size={11} className="text-emerald-400" />
                                                : <div className="w-2.5 h-2.5 rounded-full border border-slate-700" />}
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{a.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {deliverables.length === 0 && (
                        <div className="py-24 text-center text-slate-600 text-sm border border-slate-800 rounded-2xl">
                            No deliverables available yet. Your team will upload these after processing.
                        </div>
                    )}
                </div>
        </div>
    );
};

export default ClientDeliverables;
