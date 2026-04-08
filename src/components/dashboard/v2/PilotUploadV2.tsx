/**
 * PilotUploadV2.tsx — Split Upload Portal (fixed)
 *
 * Fixes:
 * - missionId no longer from useParams (upload page is a standalone tab)
 *   → Pilot picks their mission from a dropdown loaded via API
 * - Submit button moved to a sticky action bar ABOVE the file queue (always visible)
 * - Folder upload via webkitdirectory + drag-and-drop recursive traversal
 *
 * Tab 1: Aerial Imagery  → AWS S3
 * Tab 2: Ground / LBD    → Google Cloud Storage
 */
import React, { useState, useEffect } from 'react';
import {
    Camera, Mountain, Upload, CheckCircle2, AlertCircle,
    FileText, Layers, RotateCw, X, Plus, FolderOpen,
    ChevronDown, Rocket
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────
type Portal = 'aerial' | 'ground';

interface UploadTypeConfig {
    key: string;
    label: string;
    accept: string;
    description: string;
}

interface FileEntry {
    file: File;
    relativePath: string;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
}

interface Mission {
    id: string;
    title: string;
    status?: string;
    site_name?: string;
    project_name?: string;
}

// ── Portal definitions ────────────────────────────────────────────────────────
const AERIAL_TYPES: UploadTypeConfig[] = [
    { key: 'images',      label: 'RGB Photos',   accept: 'image/*,.tif,.tiff',         description: 'Standard RGB aerial imagery' },
    { key: 'thermal',     label: 'IR / Thermal', accept: 'image/*,.tif,.tiff',         description: 'Infrared and radiometric images' },
    { key: 'orthomosaic', label: 'Orthomosaic',  accept: '.tif,.tiff,.jpg,.jpeg,.png', description: 'Processed orthomosaic GeoTIFFs' },
];

const GROUND_TYPES: UploadTypeConfig[] = [
    { key: 'lbd',         label: 'LBD / LiDAR',  accept: '.las,.laz,.ply,.pcd,.xyz,.e57,.bin', description: 'Ground LiDAR / LBD point cloud data' },
    { key: 'kml',         label: 'KML / KMZ',    accept: '.kml,.kmz,.geojson,.json',           description: 'Flight path and boundary files' },
    { key: 'sensor_log',  label: 'Sensor Logs',  accept: '.csv,.log,.txt,.bin,.dat',           description: 'Raw sensor and telemetry logs' },
    { key: 'spreadsheet', label: 'Field Data',   accept: '.xlsx,.xls,.csv,.xlsm',              description: 'Field survey spreadsheets' },
];

// ── Recursive folder traversal helper ────────────────────────────────────────
async function traverseEntry(entry: FileSystemEntry, pathPrefix = ''): Promise<{ file: File; relativePath: string }[]> {
    if (entry.isFile) {
        const file = await new Promise<File>(resolve => (entry as FileSystemFileEntry).file(resolve));
        return [{ file, relativePath: pathPrefix + file.name }];
    }
    if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        // readEntries may not return all entries in one call — keep reading until empty
        const allEntries: FileSystemEntry[] = [];
        const readAll = (): Promise<void> => new Promise(resolve => {
            reader.readEntries(entries => {
                if (!entries.length) { resolve(); return; }
                allEntries.push(...entries);
                readAll().then(resolve);
            });
        });
        await readAll();
        const results = await Promise.all(allEntries.map(e => traverseEntry(e, pathPrefix + entry.name + '/')));
        return results.flat();
    }
    return [];
}

// ── Mission selector ──────────────────────────────────────────────────────────
function MissionPicker({
    value, onChange
}: {
    value: string;
    onChange: (id: string) => void;
}) {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/pilot/secure/missions')
            .then(res => {
                const data = res.data?.data || res.data || [];
                setMissions(Array.isArray(data) ? data : []);
            })
            .catch(() => setMissions([]))
            .finally(() => setLoading(false));
    }, []);

    const selected = missions.find(m => m.id === value);
    const [open, setOpen] = React.useState(false);

    return (
        <div className="relative">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Mission
            </label>
            {loading ? (
                <div className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-500 animate-pulse">
                    Loading missions...
                </div>
            ) : (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setOpen(o => !o)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer hover:border-slate-600 transition-colors"
                    >
                        <span className={selected ? 'text-white font-medium' : 'text-slate-400'}>
                            {selected
                                ? (() => { const p = selected.project_name || selected.site_name; return p ? `${p} — ${selected.title}` : selected.title; })()
                                : '— Select mission —'}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                            <button
                                type="button"
                                onClick={() => { onChange(''); setOpen(false); }}
                                className="w-full text-left px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-800 transition-colors border-b border-slate-800"
                            >
                                — Select mission —
                            </button>
                            {missions.map(m => {
                                const projectLabel = m.project_name || m.site_name;
                                const label = projectLabel ? `${projectLabel} — ${m.title}` : m.title;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => { onChange(m.id); setOpen(false); }}
                                        className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-slate-800
                                            ${value === m.id ? 'text-blue-300 bg-blue-900/20' : 'text-white'}`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {/* Backdrop to close dropdown */}
                    {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
                </div>
            )}
        </div>
    );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({
    accept, disabled, onFiles, accentColor
}: {
    accept: string;
    disabled: boolean;
    onFiles: (files: { file: File; relativePath: string }[]) => void;
    accentColor: string;
}) {
    const [dragging, setDragging] = useState(false);

    const fromFileList = (fileList: FileList): { file: File; relativePath: string }[] =>
        Array.from(fileList).map(f => ({
            file: f,
            relativePath: (f as any).webkitRelativePath || f.name
        }));

    return (
        <div className="space-y-2">
            {/* Drag zone */}
            <div
                className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-all
                    ${disabled ? 'opacity-40 pointer-events-none' : ''}
                    ${dragging
                        ? `border-${accentColor}-400 bg-${accentColor}-500/10`
                        : `border-slate-700 hover:border-${accentColor}-500/40 hover:bg-${accentColor}-500/5`}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={async e => {
                    e.preventDefault(); setDragging(false);
                    const items = Array.from(e.dataTransfer.items).filter(i => i.kind === 'file');
                    const results: { file: File; relativePath: string }[] = [];
                    for (const item of items) {
                        const entry = item.webkitGetAsEntry?.();
                        if (entry) {
                            const found = await traverseEntry(entry);
                            results.push(...found);
                        } else {
                            const f = item.getAsFile();
                            if (f) results.push({ file: f, relativePath: f.name });
                        }
                    }
                    if (results.length) onFiles(results);
                }}
            >
                <Upload size={28} className={`mb-2 text-slate-600 transition-colors ${dragging ? `text-${accentColor}-400` : ''}`} />
                <p className="text-xs font-semibold text-slate-400">Drag files or entire folders here</p>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none
                    ${disabled ? 'opacity-40 pointer-events-none' : ''}
                    border-slate-700 bg-slate-900 text-slate-300 hover:border-${accentColor}-500/40 hover:text-${accentColor}-300`}>
                    <input type="file" multiple accept={accept} className="sr-only" disabled={disabled}
                        onChange={e => { if (e.target.files?.length) onFiles(fromFileList(e.target.files)); }} />
                    <Upload size={12} /> Select Files
                </label>

                <label className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none
                    ${disabled ? 'opacity-40 pointer-events-none' : ''}
                    border-slate-700 bg-slate-900 text-slate-300 hover:border-${accentColor}-500/40 hover:text-${accentColor}-300`}>
                    <input
                        type="file" multiple className="sr-only" disabled={disabled}
                        // @ts-ignore webkitdirectory is non-standard but supported on all modern browsers + iOS Safari 15+
                        webkitdirectory=""
                        onChange={e => { if (e.target.files?.length) onFiles(fromFileList(e.target.files)); }}
                    />
                    <FolderOpen size={12} /> Select Folder
                </label>
            </div>
        </div>
    );
}

// ── Upload Pane ───────────────────────────────────────────────────────────────
function UploadPane({
    types, missionId, accentColor, storage
}: {
    types: UploadTypeConfig[];
    missionId: string;
    accentColor: string;
    storage: string;
}) {
    const [activeType, setActiveType] = useState(types[0].key);
    const [queue, setQueue] = useState<FileEntry[]>([]);
    const [uploading, setUploading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lbdBlock, setLbdBlock] = useState('');
    const [missionFolder, setMissionFolder] = useState('');
    const cancelRef = React.useRef(false);

    const currentType = types.find(t => t.key === activeType)!;
    const isLBD     = activeType === 'lbd';
    const isAerial  = storage === 'AWS S3';
    const pending   = queue.filter(f => f.status === 'pending').length;
    const completed = queue.filter(f => f.status === 'done').length;
    const hasErrors = queue.some(f => f.status === 'error');
    const canUpload = !!missionId && pending > 0 && !uploading
        && (!isLBD || lbdBlock.trim().length > 0)
        && (!isAerial || missionFolder.trim().length > 0);

    const addFiles = (files: { file: File; relativePath: string }[]) => {
        setQueue(prev => [...prev, ...files.map(f => ({
            file: f.file,
            relativePath: f.relativePath,
            status: 'pending' as const
        }))]);
        setDone(false);
        setError(null);
    };

    const removeFile = (idx: number) => setQueue(prev => prev.filter((_, i) => i !== idx));

    const upload = async () => {
        if (!canUpload) return;
        cancelRef.current = false;
        setUploading(true);
        setError(null);

        try {
            // 1. Create upload job
            const jobRes = await apiClient.post('/pilot/upload-jobs', {
                missionId,
                uploadType: activeType,
                ...(isLBD    && { lbdBlock:       lbdBlock.trim() }),
                ...(isAerial && { missionFolder:  missionFolder.trim() }),
            });
            if (!jobRes.data.success) throw new Error(jobRes.data.message || 'Failed to create upload job');
            const jobId = jobRes.data.data.id;

            // 2. Upload pending files sequentially — check cancelRef between each
            for (let i = 0; i < queue.length; i++) {
                if (cancelRef.current) {
                    // Mark remaining pending files as cancelled
                    setQueue(prev => prev.map(f => f.status === 'pending' ? { ...f, status: 'error', error: 'Cancelled' } : f));
                    break;
                }
                if (queue[i].status !== 'pending') continue;
                setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));
                try {
                    const fd = new FormData();
                    fd.append('image', queue[i].file, queue[i].file.name);
                    await apiClient.post(`/pilot/upload-jobs/${jobId}/files`, fd);
                    setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done' } : f));
                } catch (err: any) {
                    if (cancelRef.current) {
                        setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: 'Cancelled' } : f));
                        break;
                    }
                    const msg = err.response?.data?.message || err.message || 'Upload failed';
                    setQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: msg } : f));
                }
            }

            // 3. Mark complete only if not cancelled
            if (!cancelRef.current) {
                await apiClient.patch(`/pilot/upload-jobs/${jobId}/complete`).catch(() => {});
                setDone(true);
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Upload failed';
            setError(msg);
            console.error('[PilotUpload]', err);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Type pills */}
            <div className="flex flex-wrap gap-2">
                {types.map(t => (
                    <button key={t.key} onClick={() => setActiveType(t.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                            ${activeType === t.key
                                ? `bg-${accentColor}-500/20 border-${accentColor}-500/50 text-${accentColor}-300`
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <p className="text-[11px] text-slate-500">{currentType.description}</p>

            {/* Mission folder — shown for aerial (S3) uploads */}
            {isAerial && (
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                        Mission / Flight ID <span className="text-red-400">*</span>
                    </label>
                    <input
                        value={missionFolder}
                        onChange={e => setMissionFolder(e.target.value)}
                        placeholder="e.g. M14, Flight-3, Block-A-Day2"
                        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                    />
                    <p className="text-[10px] text-slate-600 mt-1">
                        S3 path: <span className="text-blue-400 font-mono">[Site Name] / {missionFolder.trim() || '…'} / IR or RGB /</span>
                    </p>
                </div>
            )}

            {/* LBD Block name — shown only for LBD type */}
            {isLBD && (
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                        LBD Block Name <span className="text-red-400">*</span>
                    </label>
                    <input
                        value={lbdBlock}
                        onChange={e => setLbdBlock(e.target.value)}
                        placeholder="e.g. Block A, Scan Zone 1, BCS-North"
                        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                    />
                    <p className="text-[10px] text-slate-600 mt-1">
                        Files will be stored under: <span className="text-emerald-400 font-mono">[Project] / [Your Name] / {lbdBlock.trim() || '…'}/</span>
                    </p>
                </div>
            )}

            {/* ── Sticky action bar — ABOVE queue, always visible ── */}
            {queue.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl sticky top-0 z-10">
                    <span className="text-xs text-slate-400 font-bold flex-1">
                        {done ? `✓ ${completed} uploaded` : uploading
                            ? `Uploading ${completed}/${queue.length}...`
                            : `${pending} file${pending !== 1 ? 's' : ''} ready`}
                    </span>
                    {!done && (
                        <>
                            {!uploading && (
                                <button onClick={() => setQueue([])}
                                    className="text-xs text-slate-600 hover:text-red-400 px-2 py-1 transition-colors">
                                    Clear
                                </button>
                            )}
                            {uploading && (
                                <button onClick={() => { cancelRef.current = true; }}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-700/50 text-red-300 hover:bg-red-900/70 font-bold transition-all">
                                    <X size={11} /> Cancel
                                </button>
                            )}
                            <button
                                onClick={upload}
                                disabled={!canUpload}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all
                                    ${canUpload
                                        ? `bg-${accentColor}-600 text-white hover:bg-${accentColor}-500 shadow-md`
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                                {uploading
                                    ? <><RotateCw size={11} className="animate-spin" /> Uploading</>
                                    : <><Rocket size={11} /> Upload to {storage}</>}
                            </button>
                        </>
                    )}
                    {done && (
                        <button onClick={() => { setQueue([]); setDone(false); }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-${accentColor}-500/30 text-${accentColor}-400`}>
                            <Plus size={11} /> Add More
                        </button>
                    )}
                </div>
            )}

            {/* No mission warning */}
            {!missionId && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <AlertCircle size={14} className="text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-300">Select a mission above before uploading</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle size={14} className="text-red-400 shrink-0" />
                    <p className="text-xs text-red-300 flex-1">{error}</p>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300"><X size={12} /></button>
                </div>
            )}

            {/* Drop zone */}
            <DropZone
                accept={currentType.accept}
                disabled={uploading}
                onFiles={addFiles}
                accentColor={accentColor}
            />

            {/* Queue list */}
            {queue.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Queue {completed}/{queue.length}
                        </span>
                        {hasErrors && (
                            <span className="text-[10px] text-red-400">{queue.filter(f => f.status === 'error').length} failed</span>
                        )}
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/50">
                        {queue.map((f, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2">
                                <div className="shrink-0">
                                    {f.status === 'done'      && <CheckCircle2 size={13} className="text-emerald-400" />}
                                    {f.status === 'error'     && <AlertCircle  size={13} className="text-red-400" />}
                                    {f.status === 'uploading' && <RotateCw     size={13} className={`text-${accentColor}-400 animate-spin`} />}
                                    {f.status === 'pending'   && <FileText     size={13} className="text-slate-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] text-slate-300 truncate">
                                        {f.relativePath || f.file.name}
                                    </p>
                                    {f.error && <p className="text-[10px] text-red-400 truncate">{f.error}</p>}
                                </div>
                                <span className="text-[10px] text-slate-600 shrink-0">
                                    {(f.file.size / 1024 / 1024).toFixed(1)}MB
                                </span>
                                {f.status === 'pending' && !uploading && (
                                    <button onClick={() => removeFile(i)} className="text-slate-600 hover:text-red-400 shrink-0">
                                        <X size={11} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Success banner */}
            {done && (
                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-emerald-300">Transfer Complete</p>
                        <p className="text-[11px] text-emerald-500/70">{completed} file{completed !== 1 ? 's' : ''} → {storage}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PilotUploadV2() {
    const [portal, setPortal] = useState<Portal>('aerial');
    const [missionId, setMissionId] = useState('');

    return (
        <div className="min-h-screen bg-slate-950 text-white">
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 pb-28">
            {/* Header */}
            <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Mission Data Uplink</h2>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest font-bold">Secure Transfer Portal</p>
            </div>

            {/* Mission selector */}
            <MissionPicker value={missionId} onChange={setMissionId} />

            {/* Portal tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button onClick={() => setPortal('aerial')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-bold transition-all
                        ${portal === 'aerial' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>
                    <Camera size={15} /> Aerial Imagery
                </button>
                <button onClick={() => setPortal('ground')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-bold transition-all
                        ${portal === 'ground' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>
                    <Mountain size={15} /> Ground / LBD
                </button>
            </div>

            {/* Storage indicator */}
            <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg border
                ${portal === 'aerial'
                    ? 'bg-blue-500/5 border-blue-500/20 text-blue-400'
                    : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'}`}>
                <Layers size={11} />
                {portal === 'aerial'
                    ? '→ AWS S3 · tm-prod-pilot-california · Encrypted at rest'
                    : '→ Google Cloud Storage · axis-platform-uploads · ADC secured'}
            </div>

            {/* Portal */}
            {portal === 'aerial' ? (
                <UploadPane key="aerial" types={AERIAL_TYPES} missionId={missionId} accentColor="blue" storage="AWS S3" />
            ) : (
                <UploadPane key="ground" types={GROUND_TYPES} missionId={missionId} accentColor="emerald" storage="Google Cloud" />
            )}
        </div>
        </div>
    );
}
