/**
 * AssetDashboard.tsx — Total Redesign
 * Admin/In-house only. Clean, premium UI for browsing site assets.
 */
import React, { useState, useEffect } from 'react';
import {
    HardDrive, Globe, Image, Film, FileText, Archive,
    Search, Filter, RefreshCw, Loader2, FolderOpen,
    Eye, Download, Clock, BarChart3, Layers
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { Site } from '../../types';
import AssetGrid from './AssetGrid';
import { useParams } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetStats {
    total: number;
    images: number;
    videos: number;
    documents: number;
    other: number;
    totalSizeMb: number;
}

type FilterType = 'all' | 'images' | 'videos' | 'documents' | 'other';

const FILE_TYPES: { id: FilterType; label: string; icon: typeof Image; color: string; accent: string }[] = [
    { id: 'all', label: 'All Files', icon: HardDrive, color: 'text-slate-300', accent: 'border-slate-600' },
    { id: 'images', label: 'Images', icon: Image, color: 'text-sky-400', accent: 'border-sky-500/40' },
    { id: 'videos', label: 'Videos', icon: Film, color: 'text-violet-400', accent: 'border-violet-500/40' },
    { id: 'documents', label: 'Documents', icon: FileText, color: 'text-amber-400', accent: 'border-amber-500/40' },
    { id: 'other', label: 'Other', icon: Archive, color: 'text-rose-400', accent: 'border-rose-500/40' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const AssetDashboard: React.FC = () => {
    const { siteId: paramSiteId } = useParams<{ siteId: string }>();

    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(paramSiteId || null);
    const [loadingSites, setLoadingSites] = useState(true);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [stats] = useState<AssetStats>({
        total: 0, images: 0, videos: 0, documents: 0, other: 0, totalSizeMb: 0
    });

    useEffect(() => { fetchSites(); }, []);
    useEffect(() => { if (paramSiteId) setSelectedSiteId(paramSiteId); }, [paramSiteId]);

    const fetchSites = async () => {
        try {
            setLoadingSites(true);
            const response = await apiClient.get('/assets/sites');
            const fetched: Site[] = response.data.data || [];
            setSites(fetched);
            if (fetched.length > 0 && !selectedSiteId && !paramSiteId) {
                setSelectedSiteId(fetched[0].id);
            }
        } catch {
            // silently fail — AssetGrid handles its own error state
        } finally {
            setLoadingSites(false);
        }
    };

    const selectedSite = sites.find(s => s.id === selectedSiteId);

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden">

            {/* ── LEFT PANEL: Site Navigator ──────────────────────── */}
            <aside className="w-64 shrink-0 flex flex-col border-r border-slate-800/80 bg-slate-900/40">
                {/* Header */}
                <div className="px-4 pt-5 pb-3 border-b border-slate-800/60">
                    <div className="flex items-center gap-2 mb-4">
                        <Layers size={14} className="text-emerald-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Site Navigator</span>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search sites…"
                            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-8 pr-3 py-2
                                       text-xs text-white placeholder-slate-600 focus:outline-none
                                       focus:border-emerald-500/40 transition-colors"
                        />
                    </div>
                </div>

                {/* Site List */}
                <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                    {loadingSites ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={18} className="text-emerald-400 animate-spin" />
                        </div>
                    ) : sites.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map(site => {
                        const isActive = selectedSiteId === site.id;
                        return (
                            <button
                                key={site.id}
                                onClick={() => setSelectedSiteId(site.id)}
                                className={`w-full text-left px-3 py-3 rounded-xl border transition-all group
                                           ${isActive
                                        ? 'bg-emerald-600/10 border-emerald-500/30 shadow-sm'
                                        : 'border-transparent hover:bg-slate-800/60 hover:border-slate-700/50'
                                    }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors
                                                    ${isActive ? 'bg-emerald-500/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                                        <Globe size={13} className={isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                            {site.name}
                                        </p>
                                        {site.location && (
                                            <p className="text-[10px] text-slate-600 truncate">{site.location}</p>
                                        )}
                                    </div>
                                    {isActive && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                    {!loadingSites && sites.length === 0 && (
                        <div className="py-10 text-center">
                            <FolderOpen size={28} className="text-slate-700 mx-auto mb-2" />
                            <p className="text-xs text-slate-600">No sites found</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* ── MAIN CONTENT AREA ───────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* Topbar */}
                <div className="shrink-0 flex items-center gap-4 px-6 py-4 bg-slate-950/80
                                border-b border-slate-800/60 backdrop-blur-xl flex-wrap">
                    {/* Site title */}
                    <div className="mr-auto min-w-0">
                        <h1 className="text-lg font-black text-white tracking-tight truncate">
                            {selectedSite?.name ?? 'Select a Site'}
                        </h1>
                        {selectedSite?.location && (
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedSite.location}</p>
                        )}
                    </div>

                    {/* File type filters */}
                    <div className="flex items-center gap-1.5 bg-slate-900 rounded-xl p-1 border border-slate-800">
                        {FILE_TYPES.map(ft => {
                            const Icon = ft.icon;
                            const active = activeFilter === ft.id;
                            return (
                                <button
                                    key={ft.id}
                                    onClick={() => setActiveFilter(ft.id)}
                                    title={ft.label}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black
                                               uppercase tracking-widest border transition-all
                                               ${active
                                            ? `bg-slate-800 ${ft.accent} ${ft.color}`
                                            : 'text-slate-600 border-transparent hover:text-slate-400'}`}
                                >
                                    <Icon size={11} />
                                    <span className="hidden sm:inline">{ft.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={fetchSites}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500
                                   hover:text-slate-300 hover:border-slate-700 transition-all"
                        title="Refresh sites"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>

                {/* Stats bar */}
                {selectedSite && (
                    <div className="shrink-0 flex items-center gap-6 px-6 py-3 border-b border-slate-800/40 bg-slate-900/20">
                        {[
                            { icon: BarChart3, label: 'Total Assets', value: stats.total || '—', color: 'text-slate-400' },
                            { icon: Image, label: 'Images', value: stats.images || '—', color: 'text-sky-400' },
                            { icon: Film, label: 'Videos', value: stats.videos || '—', color: 'text-violet-400' },
                            { icon: FileText, label: 'Docs', value: stats.documents || '—', color: 'text-amber-400' },
                            { icon: Clock, label: 'Storage', value: stats.totalSizeMb > 0 ? `${stats.totalSizeMb} MB` : '—', color: 'text-emerald-400' },
                        ].map(s => {
                            const Icon = s.icon;
                            return (
                                <div key={s.label} className="flex items-center gap-2">
                                    <Icon size={12} className={s.color} />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</span>
                                    <span className={`text-xs font-black tabular-nums ${s.color}`}>{s.value}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Asset Grid or Empty State */}
                <div className="flex-1 overflow-auto">
                    {selectedSiteId ? (
                        <AssetGridWrapper siteId={selectedSiteId} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6">
                                <HardDrive size={32} className="text-slate-700" />
                            </div>
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">No Site Selected</h3>
                            <p className="text-xs text-slate-600 max-w-xs">
                                Choose a site from the navigator to browse its drone imagery, reports, and data assets.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssetDashboard;

// ─── Wrapper for passing siteId as prop ──────────────────────────────────────
import AssetGridComponent from './AssetGrid';

const AssetGridWrapper: React.FC<{ siteId: string }> = ({ siteId }) => {
    return <AssetGridComponent siteIdOverride={siteId} />;
};
