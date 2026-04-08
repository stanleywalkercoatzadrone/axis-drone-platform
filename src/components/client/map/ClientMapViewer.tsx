import React, { useState, useEffect } from 'react';
import { Map, Loader2, Image, ChevronLeft, ChevronRight, X, MapPin, Calendar, ExternalLink } from 'lucide-react';
import apiClient from '../../../../src/services/apiClient';

interface MediaFile {
    id: string; name: string; url: string; type: string;
    mission_title?: string; created_at?: string;
}

const MOCK: MediaFile[] = [
    { id:'1', name:'Block_A_RGB_001.jpg',     url:'https://via.placeholder.com/640x480/1e293b/10b981?text=RGB+Image',    type:'image/jpeg', mission_title:'Block A RGB Survey', created_at:'2026-03-05' },
    { id:'2', name:'Block_A_Thermal_001.tif', url:'https://via.placeholder.com/640x480/1e293b/f59e0b?text=Thermal+Image', type:'image/tiff',  mission_title:'Block A Thermal Scan', created_at:'2026-03-05' },
    { id:'3', name:'Block_B_RGB_002.jpg',     url:'https://via.placeholder.com/640x480/1e293b/6366f1?text=RGB+Image+2',  type:'image/jpeg', mission_title:'Block B Survey', created_at:'2026-03-07' },
];

// Simple pin-map component (no external map library required)
function MiniMap({ files }: { files: MediaFile[] }) {
    return (
        <div className="relative w-full h-48 bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="text-center z-10">
                <MapPin size={28} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold">{files.length} media files</p>
                <p className="text-[10px] text-slate-600">Map integration coming soon</p>
            </div>
        </div>
    );
}

function Lightbox({ files, index, onClose, onPrev, onNext }: {
    files: MediaFile[]; index: number; onClose:()=>void; onPrev:()=>void; onNext:()=>void;
}) {
    const f = files[index];
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') onPrev();
            if (e.key === 'ArrowRight') onNext();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose, onPrev, onNext]);

    return (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute -top-10 right-0 text-slate-400 hover:text-white transition-colors">
                    <X size={22} />
                </button>
                <img src={f.url} alt={f.name} className="w-full max-h-[75vh] object-contain rounded-2xl border border-slate-700/50" />
                <div className="flex items-center justify-between mt-3">
                    <div>
                        <p className="text-sm font-bold text-white">{f.name}</p>
                        {f.mission_title && <p className="text-xs text-slate-500 mt-0.5">{f.mission_title}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onPrev} disabled={index===0}
                            className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs text-slate-500 tabular-nums">{index+1} / {files.length}</span>
                        <button onClick={onNext} disabled={index===files.length-1}
                            className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                            <ChevronRight size={16} />
                        </button>
                        <a href={f.url} target="_blank" rel="noopener noreferrer"
                            className="p-2 bg-emerald-800/30 border border-emerald-700/40 text-emerald-400 rounded-lg hover:bg-emerald-700/30 transition-all">
                            <ExternalLink size={16} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

const ClientMapViewer: React.FC = () => {
    const [files, setFiles] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [lightbox, setLightbox] = useState<number | null>(null);

    useEffect(() => {
        apiClient.get('/admin/media')
            .then(r => setFiles(r.data.data ?? []))
            .catch(() => setFiles(MOCK))
            .finally(() => setLoading(false));
    }, []);

    const filtered = files.filter(f =>
        !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
        (f.mission_title || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="text-emerald-400 animate-spin" size={32} /></div>;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                        <Map size={24} className="text-teal-400" /> Media Viewer
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                        {files.length} images across your projects
                    </p>
                </div>
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search files…"
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 w-52" />
            </div>

            <MiniMap files={filtered} />

            {/* Image grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map((f, i) => (
                    <button key={f.id} onClick={() => setLightbox(i)}
                        className="group relative aspect-square bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden hover:border-teal-500/40 hover:scale-[1.02] transition-all duration-300">
                        <img src={f.url} alt={f.name}
                            className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
                            onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23334155" width="100" height="100"/><text fill="%2394a3b8" x="50" y="55" text-anchor="middle" font-size="10">No preview</text></svg>'; }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                            <p className="text-[10px] text-white font-bold truncate">{f.name}</p>
                            {f.mission_title && <p className="text-[9px] text-slate-400 truncate">{f.mission_title}</p>}
                        </div>
                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-slate-950/60 rounded-md p-1">
                                <Image size={10} className="text-teal-400" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="py-24 text-center text-slate-600 text-sm">No media files available</div>
            )}

            {lightbox !== null && (
                <Lightbox
                    files={filtered}
                    index={lightbox}
                    onClose={() => setLightbox(null)}
                    onPrev={() => setLightbox(i => Math.max(0, (i ?? 0) - 1))}
                    onNext={() => setLightbox(i => Math.min(filtered.length - 1, (i ?? 0) + 1))}
                />
            )}
        </div>
    );
};

export default ClientMapViewer;
