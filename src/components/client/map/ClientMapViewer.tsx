import React, { useState, useEffect, useCallback } from 'react';
import {
    Camera, Search, X, ChevronLeft, ChevronRight,
    Download, Loader2, Image as ImageIcon, Film, FileText, Globe,
} from 'lucide-react';
import apiClient from '../../../../services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────────
interface MediaFile {
    id: string;
    name: string;
    url: string;
    type: string;
    mission_title?: string;
    created_at?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getFileCategory(file: MediaFile): 'thermal' | 'rgb' | 'video' | 'other' {
    const n = file.name.toLowerCase();
    const t = file.type.toLowerCase();
    if (n.includes('thermal') || n.includes('ir') || t.includes('tiff')) return 'thermal';
    if (t.startsWith('video/') || n.endsWith('.mp4') || n.endsWith('.mov')) return 'video';
    if (t.startsWith('image/')) return 'rgb';
    return 'other';
}

function FileBadge({ cat }: { cat: ReturnType<typeof getFileCategory> }) {
    const cfg = {
        thermal: { label: 'Thermal', color: 'text-orange-400 bg-orange-500/20 border-orange-500/30' },
        rgb:     { label: 'RGB',     color: 'text-sky-400 bg-sky-500/20 border-sky-500/30' },
        video:   { label: 'Video',   color: 'text-violet-400 bg-violet-500/20 border-violet-500/30' },
        other:   { label: 'File',    color: 'text-slate-400 bg-slate-700/40 border-slate-600/40' },
    };
    const c = cfg[cat];
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border rounded-md ${c.color}`}>
            {c.label}
        </span>
    );
}

function FileTypeIcon({ type }: { type: string }) {
    const t = type.toLowerCase();
    if (t.startsWith('image/')) return <ImageIcon size={32} className="text-slate-500" />;
    if (t.startsWith('video/')) return <Film size={32} className="text-slate-500" />;
    if (t.includes('pdf'))      return <FileText size={32} className="text-slate-500" />;
    return <Globe size={32} className="text-slate-500" />;
}

function fmtDate(d?: string) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
}

function isImage(file: MediaFile) {
    return file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|tif|tiff)$/i.test(file.name);
}

// ── Lightbox ───────────────────────────────────────────────────────────────────
const Lightbox: React.FC<{
    files: MediaFile[];
    index: number;
    onClose: () => void;
    onNav: (i: number) => void;
}> = ({ files, index, onClose, onNav }) => {
    const file = files[index];

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft')  onNav(Math.max(0, index - 1));
            if (e.key === 'ArrowRight') onNav(Math.min(files.length - 1, index + 1));
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [index, files.length, onClose, onNav]);

    return (
        <div
            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
            onClick={onClose}
        >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0" onClick={e => e.stopPropagation()}>
                <div className="min-w-0 flex-1">
                    <p className="text-white font-bold text-sm truncate">{file.name}</p>
                    {file.mission_title && (
                        <p className="text-slate-500 text-xs mt-0.5 truncate">{file.mission_title}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                    <a href={file.url} download target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
                        onClick={e => e.stopPropagation()}>
                        <Download size={12} /> Download
                    </a>
                    <span className="text-slate-600 text-xs">{index + 1} / {files.length}</span>
                    <button onClick={onClose}
                        className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Image */}
            <div className="flex-1 flex items-center justify-center px-4 min-h-0" onClick={e => e.stopPropagation()}>
                {isImage(file) ? (
                    <img src={file.url} alt={file.name}
                        className="max-h-full max-w-full object-contain rounded-xl"
                        style={{ maxHeight: 'calc(100vh - 140px)' }} />
                ) : (
                    <div className="flex flex-col items-center gap-4 text-slate-500">
                        <FileTypeIcon type={file.type} />
                        <p className="text-sm">Preview not available</p>
                        <a href={file.url} download className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm hover:bg-slate-700 transition-colors flex items-center gap-2">
                            <Download size={14} /> Download file
                        </a>
                    </div>
                )}
            </div>

            {/* Nav arrows */}
            {files.length > 1 && (
                <>
                    {index > 0 && (
                        <button
                            onClick={e => { e.stopPropagation(); onNav(index - 1); }}
                            className="fixed left-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white hover:bg-slate-700 transition-colors backdrop-blur-sm">
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    {index < files.length - 1 && (
                        <button
                            onClick={e => { e.stopPropagation(); onNav(index + 1); }}
                            className="fixed right-4 top-1/2 -translate-y-1/2 p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white hover:bg-slate-700 transition-colors backdrop-blur-sm">
                            <ChevronRight size={20} />
                        </button>
                    )}
                </>
            )}

            {/* Bottom date */}
            {file.created_at && (
                <p className="text-center text-slate-700 text-[10px] py-3 shrink-0">
                    Uploaded {fmtDate(file.created_at)}
                </p>
            )}
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ClientMapViewer: React.FC = () => {
    const [files, setFiles]         = useState<MediaFile[]>([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'thermal' | 'rgb' | 'video'>('all');
    const [missionFilter, setMissionFilter] = useState<string>('all');
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    useEffect(() => {
        apiClient.get('/client/media')
            .then(r => setFiles(r.data.data ?? []))
            .catch(() => setFiles([]))
            .finally(() => setLoading(false));
    }, []);

    const missions = Array.from(new Set(files.map(f => f.mission_title).filter(Boolean))) as string[];

    const filtered = files.filter(f => {
        const cat = getFileCategory(f);
        if (typeFilter !== 'all' && cat !== typeFilter) return false;
        if (missionFilter !== 'all' && f.mission_title !== missionFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!f.name.toLowerCase().includes(q) && !(f.mission_title || '').toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const openLightbox = useCallback((idx: number) => {
        setLightboxIdx(idx);
        document.body.style.overflow = 'hidden';
    }, []);

    const closeLightbox = useCallback(() => {
        setLightboxIdx(null);
        document.body.style.overflow = '';
    }, []);

    return (
        <div className="min-h-screen bg-slate-950">
            <div className="p-5 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            <Camera size={24} className="text-sky-400" /> Imagery & Media
                        </h1>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                            Drone survey images and deliverables
                        </p>
                    </div>
                    {/* Stats strip */}
                    {!loading && files.length > 0 && (
                        <div className="flex items-center gap-4 text-[11px] text-slate-500">
                            <span><strong className="text-white font-black">{files.length}</strong> files</span>
                            <span><strong className="text-white font-black">{missions.length}</strong> missions</span>
                            {files[0]?.created_at && (
                                <span>Updated {fmtDate(files[0].created_at)}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Filters ─────────────────────────────────────────────── */}
                {!loading && files.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search files or missions…"
                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 transition-colors"
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {(['all', 'rgb', 'thermal', 'video'] as const).map(t => (
                                <button key={t} onClick={() => setTypeFilter(t)}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all
                                        ${typeFilter === t
                                            ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                                            : 'text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'}`}>
                                    {t === 'all' ? `All (${files.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                        {missions.length > 1 && (
                            <select
                                value={missionFilter}
                                onChange={e => setMissionFilter(e.target.value)}
                                className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500/50 transition-colors">
                                <option value="all">All Missions</option>
                                {missions.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {/* ── Content ──────────────────────────────────────────────── */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <Loader2 size={32} className="text-sky-400 animate-spin" />
                        <p className="text-slate-600 text-sm">Loading imagery…</p>
                    </div>
                ) : files.length === 0 ? (
                    <div className="py-24 text-center border border-slate-800 rounded-2xl flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
                            <Camera size={28} className="text-slate-600" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-base">No imagery uploaded yet</p>
                            <p className="text-slate-600 text-sm mt-1 max-w-xs mx-auto">
                                Your drone survey images will appear here after each mission is processed
                            </p>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center border border-slate-800 rounded-2xl">
                        <p className="text-slate-500 font-semibold text-sm">No files match your filter</p>
                        <button onClick={() => { setSearch(''); setTypeFilter('all'); setMissionFilter('all'); }}
                            className="mt-3 px-4 py-2 text-xs font-bold text-sky-400 border border-sky-500/30 rounded-xl hover:bg-sky-500/10 transition-colors">
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {filtered.map((file, idx) => {
                            const cat = getFileCategory(file);
                            const img = isImage(file);
                            return (
                                <button
                                    key={file.id}
                                    onClick={() => openLightbox(idx)}
                                    className="group relative aspect-square rounded-xl overflow-hidden bg-slate-800/60 border border-slate-700/40 hover:border-sky-500/50 hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                                >
                                    {img ? (
                                        <img
                                            src={file.url}
                                            alt={file.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <FileTypeIcon type={file.type} />
                                        </div>
                                    )}

                                    {/* File type badge */}
                                    <div className="absolute top-2 left-2">
                                        <FileBadge cat={cat} />
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2">
                                        <p className="text-white text-[10px] font-bold leading-tight truncate">{file.name}</p>
                                        {file.mission_title && (
                                            <p className="text-slate-400 text-[9px] truncate mt-0.5">{file.mission_title}</p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxIdx !== null && (
                <Lightbox
                    files={filtered}
                    index={lightboxIdx}
                    onClose={closeLightbox}
                    onNav={setLightboxIdx}
                />
            )}
        </div>
    );
};

export default ClientMapViewer;
