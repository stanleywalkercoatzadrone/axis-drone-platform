import React, { useState, useEffect, useCallback } from 'react';
import {
    Download, FileText, Film, Image, Globe, BarChart3,
    Loader2, CheckCircle, Package, AlertCircle, Calendar,
    RefreshCw, FolderOpen, Clock,
} from 'lucide-react';
import apiClient from '../../../../services/apiClient';
import { useAuth } from '../../../../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Deliverable {
    id: string;
    project_id?: string;
    project_name?: string;
    mission_title?: string;
    mission_name?: string;
    site_name?: string;
    file_name?: string;
    file_url?: string | null;
    url?: string | null;
    file_type?: string;
    file_size?: number | null;
    orthomosaic_url?: string | null;
    model_3d_url?: string | null;
    report_url?: string | null;
    created_at: string;
    updated_at?: string;
}

// ── File type helpers ──────────────────────────────────────────────────────────

function getFileIcon(type?: string, name?: string): React.ComponentType<{ size?: number; className?: string }> {
    const t = (type ?? name ?? '').toLowerCase();
    if (/video|mp4|mov|avi/.test(t))                return Film;
    if (/image|jpg|jpeg|png|tiff|tif|webp/.test(t)) return Image;
    if (/map|ortho|geo|kml|kmz/.test(t))            return Globe;
    if (/csv|xlsx|json|report|pdf/.test(t))         return FileText;
    if (/model|3d|obj|las|ply|laz/.test(t))         return BarChart3;
    return FileText;
}

function getFileAccent(type?: string, name?: string): { icon: string; badge: string; bar: string } {
    const t = (type ?? name ?? '').toLowerCase();
    if (/video|mp4|mov/.test(t))                    return { icon: 'text-pink-400',   badge: 'border-pink-500/20 bg-pink-500/10',   bar: 'bg-pink-500' };
    if (/image|jpg|jpeg|png|tiff|webp/.test(t))     return { icon: 'text-sky-400',    badge: 'border-sky-500/20 bg-sky-500/10',     bar: 'bg-sky-500' };
    if (/map|ortho|geo|kml|kmz/.test(t))            return { icon: 'text-teal-400',   badge: 'border-teal-500/20 bg-teal-500/10',   bar: 'bg-teal-500' };
    if (/model|3d|obj|las|ply|laz/.test(t))         return { icon: 'text-violet-400', badge: 'border-violet-500/20 bg-violet-500/10', bar: 'bg-violet-500' };
    if (/csv|xlsx|json/.test(t))                    return { icon: 'text-emerald-400',badge: 'border-emerald-500/20 bg-emerald-500/10', bar: 'bg-emerald-500' };
    return { icon: 'text-indigo-400', badge: 'border-indigo-500/20 bg-indigo-500/10', bar: 'bg-indigo-500' };
}

function formatFileSize(bytes?: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDate(dt: string) {
    try {
        return new Date(dt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    } catch { return dt; }
}

// ── Resolve download URL and display name from any deliverable shape ───────────

function resolveDeliverable(d: Deliverable): {
    url: string | null;
    name: string;
    mission: string;
    size: string;
    type: string;
} {
    const url  = d.file_url ?? d.url ?? d.report_url ?? d.orthomosaic_url ?? d.model_3d_url ?? null;
    const name = d.file_name
        ?? (d.file_url  ? d.file_url.split('/').pop()  : null)
        ?? (d.url       ? d.url.split('/').pop()        : null)
        ?? 'Deliverable';
    const mission = d.mission_title ?? d.mission_name ?? d.site_name ?? d.project_name ?? 'Mission';
    return {
        url,
        name:    name ?? 'Deliverable',
        mission,
        size:    formatFileSize(d.file_size),
        type:    d.file_type ?? (name ? name.split('.').pop() ?? '' : ''),
    };
}

// ── Individual Deliverable Card ────────────────────────────────────────────────

function DeliverableCard({ item }: { item: Deliverable }) {
    const { url, name, mission, size, type } = resolveDeliverable(item);
    const Icon   = getFileIcon(type, name);
    const accent = getFileAccent(type, name);
    const ready  = !!url;

    function handleDownload(e: React.MouseEvent) {
        e.stopPropagation();
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }

    return (
        <div
            className={`group relative bg-slate-800/40 border rounded-2xl overflow-hidden
                        transition-all duration-200 flex flex-col
                        ${ready
                            ? 'border-slate-700/40 hover:border-violet-500/30 hover:bg-slate-800/60 hover:-translate-y-0.5 cursor-pointer'
                            : 'border-slate-700/20 opacity-60'}`}
            onClick={ready ? handleDownload : undefined}
        >
            {/* Accent bar */}
            <div className={`h-[3px] w-full ${accent.bar} opacity-60`} />

            <div className="p-5 flex flex-col gap-4 flex-1">
                {/* File icon + name */}
                <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${accent.badge}`}>
                        <Icon size={18} className={accent.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-white text-sm truncate leading-tight" title={name}>
                            {name}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                            {mission}
                        </p>
                    </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center justify-between gap-2 mt-auto">
                    <div className="flex items-center gap-3">
                        {size && (
                            <span className="text-[10px] text-slate-600 font-bold">
                                {size}
                            </span>
                        )}
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                            <Calendar size={9} />
                            {fmtDate(item.created_at)}
                        </span>
                    </div>
                    {type && (
                        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest
                                         px-2 py-0.5 rounded-md bg-slate-900/60 border border-slate-700/40 text-slate-500">
                            {type.toUpperCase()}
                        </span>
                    )}
                </div>

                {/* Download button or Processing state */}
                {ready ? (
                    <button
                        onClick={handleDownload}
                        className="w-full flex items-center justify-center gap-2 py-2.5 min-h-[44px]
                                   rounded-xl bg-violet-500/10 border border-violet-500/20
                                   text-violet-400 text-xs font-black uppercase tracking-wider
                                   hover:bg-violet-500/20 transition-colors
                                   group-hover:border-violet-400/40"
                    >
                        <Download size={13} /> Download
                    </button>
                ) : (
                    <div className="w-full flex items-center justify-center gap-2 py-2.5
                                    rounded-xl bg-slate-900/40 border border-slate-700/30
                                    text-slate-600 text-xs font-black uppercase tracking-wider">
                        <Loader2 size={12} className="animate-spin" /> Processing…
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Mission Group ──────────────────────────────────────────────────────────────

function MissionGroup({
    missionName,
    items,
}: {
    missionName: string;
    items: Deliverable[];
}) {
    const [collapsed, setCollapsed] = useState(false);
    const readyCount = items.filter(d => !!(d.file_url ?? d.url ?? d.report_url ?? d.orthomosaic_url ?? d.model_3d_url)).length;
    const allReady   = readyCount === items.length;

    return (
        <div className="space-y-3">
            {/* Section header */}
            <button
                onClick={() => setCollapsed(c => !c)}
                className="w-full flex items-center gap-3 group text-left"
            >
                <div className={`w-2 h-2 rounded-full shrink-0 ${allReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <h3 className="font-black text-white text-sm flex-1 truncate group-hover:text-violet-300 transition-colors">
                    {missionName}
                </h3>
                {allReady && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase
                                     tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md">
                        <CheckCircle size={8} /> All Ready
                    </span>
                )}
                <span className="shrink-0 text-[10px] text-slate-600 font-bold">
                    {readyCount}/{items.length} ready
                </span>
                <span className={`shrink-0 text-slate-600 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </svg>
                </span>
            </button>

            {/* Cards grid */}
            {!collapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(d => (
                        <DeliverableCard key={d.id} item={d} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function CardSkeleton() {
    return (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl overflow-hidden animate-pulse">
            <div className="h-[3px] bg-slate-700/50" />
            <div className="p-5 space-y-4">
                <div className="flex gap-3">
                    <div className="w-10 h-10 bg-slate-700/40 rounded-xl shrink-0" />
                    <div className="space-y-2 flex-1">
                        <div className="h-4 bg-slate-700/40 rounded w-3/4" />
                        <div className="h-3 bg-slate-700/20 rounded w-1/2" />
                    </div>
                </div>
                <div className="h-10 bg-slate-700/20 rounded-xl" />
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const ClientDeliverables: React.FC = () => {
    const { user } = useAuth();
    const companyName = user?.companyName ?? '';

    const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
    const [loading, setLoading]           = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        apiClient.get('/client/deliverables')
            .then(r  => setDeliverables(r.data?.data ?? r.data ?? []))
            .catch(() => setDeliverables([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Derived ─────────────────────────────────────────────────────────────

    // Group by mission name
    const groups: Record<string, Deliverable[]> = {};
    for (const d of deliverables) {
        const key = d.mission_title ?? d.mission_name ?? d.site_name ?? d.project_name ?? 'Uncategorised';
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
    }
    const missionNames = Object.keys(groups);

    const totalFiles  = deliverables.length;
    const readyFiles  = deliverables.filter(d =>
        !!(d.file_url ?? d.url ?? d.report_url ?? d.orthomosaic_url ?? d.model_3d_url)
    ).length;
    const latestDate  = deliverables.length > 0
        ? fmtDate(deliverables[0].updated_at ?? deliverables[0].created_at)
        : null;

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-slate-950">
        <div className="p-6 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto
                        animate-in fade-in slide-in-from-bottom-4 duration-500
                        space-y-8">

            {/* ── Page Header ───────────────────────────────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                        <Download size={24} className="text-violet-400" />
                        Deliverables
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                        {companyName
                            ? <>{companyName} · Project outputs &amp; downloads</>
                            : 'Download your project outputs — reports, maps, and data files'}
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 min-h-[44px]
                               bg-slate-800 border border-slate-700 rounded-xl
                               text-xs text-slate-300 hover:bg-slate-700
                               transition-colors font-bold disabled:opacity-50"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* ── Stats Strip ───────────────────────────────────────────── */}
            {deliverables.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                        <div className="text-3xl font-black text-white tabular-nums">{totalFiles}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                            Files Available
                        </div>
                    </div>
                    <div className="bg-slate-800/40 border border-violet-500/20 rounded-2xl p-5">
                        <div className="text-3xl font-black text-violet-400 tabular-nums">
                            {missionNames.length}
                        </div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                            Missions
                        </div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock size={12} className="text-slate-500" />
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Last Updated
                            </div>
                        </div>
                        <div className="text-base font-black text-slate-300 tabular-nums">
                            {latestDate ?? '—'}
                        </div>
                        <div className="mt-2 text-[10px] text-slate-600 font-bold">
                            {readyFiles}/{totalFiles} files ready
                        </div>
                    </div>
                </div>
            )}

            {/* ── Content ────────────────────────────────────────────────── */}
            {loading ? (
                /* Skeleton grid */
                <div className="space-y-8">
                    {[0, 1].map(g => (
                        <div key={g} className="space-y-3">
                            <div className="h-5 w-48 bg-slate-800/50 rounded animate-pulse" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[0, 1, 2].map(i => <CardSkeleton key={i} />)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : missionNames.length > 0 ? (
                /* Mission groups */
                <div className="space-y-10">
                    {missionNames.map(mission => (
                        <MissionGroup
                            key={mission}
                            missionName={mission}
                            items={groups[mission]}
                        />
                    ))}
                </div>
            ) : (
                /* ── Empty State ────────────────────────────────────────── */
                <div className="py-24 text-center border border-slate-800/50 rounded-2xl bg-slate-900/20 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20
                                    flex items-center justify-center mx-auto">
                        <FolderOpen size={28} className="text-violet-500/60" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-base font-black text-slate-400">
                            No deliverables available yet
                        </p>
                        <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                            Orthomosaics, 3D models, inspection reports, and processed data files
                            will appear here once your team has completed post-processing.
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
                        {[
                            { icon: Image,    label: 'Orthomosaics',  color: 'text-sky-400' },
                            { icon: BarChart3, label: '3D Models',    color: 'text-violet-400' },
                            { icon: FileText, label: 'Reports',       color: 'text-amber-400' },
                        ].map(({ icon: Icon, label, color }) => (
                            <div key={label} className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                <Icon size={11} className={color} /> {label}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        </div>
    );
};

export default ClientDeliverables;
