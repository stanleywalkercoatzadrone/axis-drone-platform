/**
 * MediaGallery.tsx — Admin Media Viewer
 * Tabs: Gallery (DB-tracked files) | S3 Bucket Browser | GCS Bucket Browser
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    Camera, Mountain, FileText, Download, RefreshCw, Trash2,
    AlertCircle, Search, X, Grid, List, ChevronDown, ChevronRight,
    Sun, Thermometer, Layers, FolderOpen, HardDrive, CloudLightning,
    ArrowLeft, TriangleAlert, Brain, Zap, CheckCircle2
} from 'lucide-react';
import apiClient from '../src/services/apiClient';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface MediaFile {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    created_at: string;
    mission_title?: string;
    mission_id?: string;
    upload_type?: string;
    storage_destination?: string;
}

interface BucketObject {
    key: string;
    name: string;
    size: number;
    lastModified?: string;
    url: string;
    contentType?: string;
}

interface BucketPrefix { prefix: string; name: string; }
interface Mission { id: string; title: string; }
type Tab = 'gallery' | 's3' | 'gcs';
type ImageKind = 'all' | 'rgb' | 'thermal' | 'ortho' | 'ir' | 'ground';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const formatBytes = (b: number) => {
    if (!b) return '—';
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const isImage = (name: string, type?: string) =>
    /\.(jpg|jpeg|png|webp|gif|bmp|tiff?)$/i.test(name) || (type || '').startsWith('image/');

type KindKey = 'rgb' | 'thermal' | 'ortho' | 'ir' | 'ground';
const kindBadge: Record<KindKey, { label: string; color: string }> = {
    rgb:     { label: 'RGB',     color: 'text-sky-400' },
    thermal: { label: 'Thermal', color: 'text-orange-400' },
    ortho:   { label: 'Ortho',   color: 'text-violet-400' },
    ir:      { label: 'LiDAR',   color: 'text-emerald-400' },
    ground:  { label: 'Ground',  color: 'text-slate-400' },
};

function getKind(uploadType?: string): KindKey {
    switch (uploadType) {
        case 'images':      return 'rgb';
        case 'thermal':     return 'thermal';
        case 'orthomosaic': return 'ortho';
        case 'lbd':         return 'ir';
        default:            return 'ground';
    }
}

function storageBadge(url: string, dest?: string) {
    if (dest === 's3' || url?.includes('amazonaws.com'))
        return { label: 'S3',  color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' };
    if (dest === 'gcs' || url?.startsWith('gs://') || url?.includes('storage.googleapis.com'))
        return { label: 'GCS', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' };
    return { label: 'Local', color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Confirm Delete Dialog
// ──────────────────────────────────────────────────────────────────────────────
function ConfirmDeleteDialog({
    fileName, onConfirm, onCancel
}: { fileName: string; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-500/10 rounded-xl"><TriangleAlert size={18} className="text-red-400" /></div>
                    <h3 className="font-black text-white text-sm uppercase tracking-wide">Confirm Delete</h3>
                </div>
                <p className="text-sm text-slate-400 mb-1">This will permanently remove:</p>
                <p className="text-sm font-semibold text-white bg-slate-800 px-3 py-2 rounded-lg mb-4 truncate">{fileName}</p>
                <p className="text-xs text-red-400 mb-5">⚠ File will be deleted from cloud storage and cannot be recovered.</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:border-slate-500 transition-all">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black hover:bg-red-500 transition-all">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// File Card (Gallery)
// ──────────────────────────────────────────────────────────────────────────────
function FileCard({
    file, view, onDelete, onSendToAI
}: { file: MediaFile; view: 'grid' | 'list'; onDelete: (f: MediaFile) => void; onSendToAI: (f: MediaFile, report?: string) => void }) {
    const [imgErr, setImgErr] = useState(false);
    const [aiState, setAiState] = useState<'idle'|'sending'|'done'|'err'>('idle');
    const storage = storageBadge(file.url, file.storage_destination);
    const kind    = getKind(file.upload_type);
    const kb      = kindBadge[kind];
    const canPreview = isImage(file.name, file.type) && !file.url.startsWith('gs://') && !imgErr;

    const handleDownload = () => {
        if (file.url.startsWith('gs://')) window.open(`/api/admin/media/${file.id}/download`, '_blank');
        else window.open(file.url, '_blank');
    };

    const handleAI = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setAiState('sending');
        try {
            const res = await apiClient.post(`/admin/media/${file.id}/send-to-ai`);
            setAiState('done');
            onSendToAI(file, res.data?.analysis?.aiReport || '✓ AI analysis complete');
            setTimeout(() => setAiState('idle'), 4000);
        } catch {
            setAiState('err');
            setTimeout(() => setAiState('idle'), 3000);
        }
    };

    const aiBtnClass = aiState === 'done' ? 'bg-emerald-900/80 border-emerald-600 text-emerald-300'
        : aiState === 'err' ? 'bg-red-900/80 border-red-700 text-red-300'
        : 'bg-violet-900/80 border-violet-700 text-violet-300 hover:text-white';
    const AIIcon = aiState === 'done' ? CheckCircle2 : aiState === 'sending' ? RefreshCw : Brain;

    if (view === 'grid') return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-all group">
            <div className="h-32 bg-slate-950 relative flex items-center justify-center overflow-hidden">
                {canPreview
                    ? <img src={file.url} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={() => setImgErr(true)} />
                    : <div className="flex flex-col items-center gap-1">
                          {kind === 'ir' ? <Mountain size={20} className="text-emerald-500/40" />
                              : kind === 'thermal' ? <Thermometer size={20} className="text-orange-500/40" />
                              : <Camera size={20} className="text-slate-600" />}
                          <span className="text-[9px] text-slate-600 font-mono">.{file.name.split('.').pop()}</span>
                      </div>}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={handleAI} title="Send to AI" disabled={aiState==='sending'}
                        className={`p-1.5 border rounded-lg transition-all ${aiBtnClass}`}>
                        <AIIcon size={12} className={aiState==='sending'?'animate-spin':''} />
                    </button>
                    <button onClick={handleDownload} className="p-1.5 bg-slate-800/90 border border-slate-700 rounded-lg text-slate-300 hover:text-white">
                        <Download size={12} />
                    </button>
                    <button onClick={() => onDelete(file)} className="p-1.5 bg-red-900/80 border border-red-700 rounded-lg text-red-300 hover:text-white">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
            <div className="p-2.5">
                <p className="text-[11px] font-semibold text-slate-200 truncate" title={file.name}>{file.name}</p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{file.mission_title || '—'}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${storage.bg} ${storage.color}`}>{storage.label}</span>
                    <span className={`text-[9px] font-bold ${kb.color}`}>{kb.label}</span>
                    <span className="text-[10px] text-slate-600 ml-auto">{formatBytes(file.size)}</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 hover:bg-slate-900/40 transition-colors group">
            <div className="w-9 h-9 bg-slate-950 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                {canPreview ? <img src={file.url} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
                    : <FileText size={14} className="text-slate-500" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                <p className="text-[10px] text-slate-500">{file.mission_title || '—'} · {new Date(file.created_at).toLocaleDateString()}</p>
            </div>
            <span className={`text-[9px] font-bold shrink-0 hidden sm:block ${kb.color}`}>{kb.label}</span>
            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${storage.bg} ${storage.color} shrink-0 hidden md:block`}>{storage.label}</span>
            <span className="text-xs text-slate-600 shrink-0 hidden md:block">{formatBytes(file.size)}</span>
            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={handleAI} title="Send to AI" disabled={aiState==='sending'}
                    className={`p-1.5 rounded-lg border transition-all ${aiBtnClass}`}>
                    <AIIcon size={13} className={aiState==='sending'?'animate-spin':''} />
                </button>
                <button onClick={handleDownload} className="p-1.5 text-slate-500 hover:text-white transition-colors"><Download size={13} /></button>
                <button onClick={() => onDelete(file)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
const S3_CRED_KEY = 'axis_s3_creds';

function useS3Creds() {
    const [creds, setCreds] = useState<{ keyId: string; secret: string; region: string } | null>(() => {
        try {
            const raw = sessionStorage.getItem(S3_CRED_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });

    const save = (keyId: string, secret: string, region: string) => {
        const c = { keyId, secret, region };
        sessionStorage.setItem(S3_CRED_KEY, JSON.stringify(c));
        setCreds(c);
    };

    const clear = () => {
        sessionStorage.removeItem(S3_CRED_KEY);
        setCreds(null);
    };

    const headerKey = creds
        ? `${creds.keyId}::${creds.secret}::${creds.region}`
        : '';

    const getHeaders = () => creds
        ? { 'x-s3-key-id': creds.keyId, 'x-s3-secret': creds.secret, 'x-s3-region': creds.region }
        : {};

    return { creds, headerKey, getHeaders, save, clear };
}

// S3 credential connect modal
function S3ConnectModal({ onConnect, onCancel }: { onConnect: (k: string, s: string, r: string) => void; onCancel?: () => void }) {
    const [keyId,  setKeyId]  = useState('');
    const [secret, setSecret] = useState('');
    const [region, setRegion] = useState('us-west-1');
    const [show,   setShow]   = useState(false);

    return (
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl max-w-md w-full">
                <div className="flex items-center gap-3 mb-4">
                    <HardDrive size={18} className="text-orange-400" />
                    <h3 className="font-black text-white text-sm">Connect S3 Credentials</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    The platform upload key doesn't have <code className="text-orange-300">s3:ListBucket</code>.
                    Enter your personal AWS credentials — they're stored in session memory only and sent
                    securely over HTTPS. They are never saved to the server.
                </p>
                <div className="space-y-2.5">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Access Key ID</label>
                        <input value={keyId} onChange={e => setKeyId(e.target.value)}
                            placeholder="AKIA..."
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-orange-500/50" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Secret Access Key</label>
                        <div className="relative">
                            <input
                                type={show ? 'text' : 'password'}
                                value={secret} onChange={e => setSecret(e.target.value)}
                                placeholder="Secret..."
                                className="w-full px-3 py-2 pr-16 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-orange-500/50" />
                            <button onClick={() => setShow(v => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-200">
                                {show ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Region</label>
                        <input value={region} onChange={e => setRegion(e.target.value)}
                            placeholder="us-east-1"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-orange-500/50" />
                    </div>
                </div>
                <button
                    onClick={() => { if (keyId && secret) onConnect(keyId, secret, region); }}
                    disabled={!keyId || !secret}
                    className="mt-4 w-full py-2.5 rounded-xl bg-orange-600 text-white text-xs font-black uppercase tracking-wider hover:bg-orange-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    Connect to S3
                </button>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Bucket Browser (S3 or GCS)
// ──────────────────────────────────────────────────────────────────────────────
// Default S3 starting prefix
const S3_DEFAULT_PREFIX = 'Coatza Drone/';
const S3_DEFAULT_CREDS  = { keyId: '', secret: '', region: 'us-west-1' };

function BucketBrowser({ cloud }: { cloud: 's3' | 'gcs' }) {
    const startPrefix = cloud === 's3' ? S3_DEFAULT_PREFIX : '';
    const [prefix, setPrefix]         = useState(startPrefix);
    const [prefixStack, setStack]     = useState<string[]>(cloud === 's3' ? [''] : []);
    const [objects, setObjects]       = useState<BucketObject[]>([]);
    const [prefixes, setPrefixes]     = useState<BucketPrefix[]>([]);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<BucketObject | null>(null);
    const [deleting, setDeleting]     = useState(false);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [deleteAllProgress, setDeleteAllProgress] = useState<{done:number;total:number}|null>(null);
    const [search, setSearch]         = useState('');

    const confirmDeleteAll = async () => {
        const toDelete = filtered.length > 0 ? filtered : objects;
        if (!toDelete.length) return;
        setDeleteAllConfirm(false);
        setDeleteAllProgress({ done: 0, total: toDelete.length });
        let done = 0;
        for (const obj of toDelete) {
            try {
                await apiClient.delete(`/admin/media/browse/${cloud}`, {
                    data: { key: obj.key },
                });
                done++;
                setObjects(prev => prev.filter(o => o.key !== obj.key));
            } catch { done++; }
            setDeleteAllProgress({ done, total: toDelete.length });
        }
        setDeleteAllProgress(null);
    };

    // Backend uses its own AWS env vars — no need to forward creds from frontend
    const load = useCallback(async (p: string) => {
        setLoading(true); setError(null);
        try {
            const res = await apiClient.get(`/admin/media/browse/${cloud}`, {
                params: { prefix: p, limit: 500 },
            });
            setObjects(res.data.objects || []);
            setPrefixes(res.data.prefixes || []);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cloud]);

    // Load on mount and when cloud changes
    useEffect(() => { load(startPrefix); }, [load]);

    const navigateTo = (p: string) => {
        setStack(s => [...s, prefix]);
        setPrefix(p);
        load(p);
    };

    const navigateBack = () => {
        const prev = prefixStack[prefixStack.length - 1] ?? '';
        setStack(s => s.slice(0, -1));
        setPrefix(prev);
        load(prev);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/admin/media/browse/${cloud}`, {
                data: { key: deleteTarget.key },
            });
            setObjects(prev => prev.filter(o => o.key !== deleteTarget.key));
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally { setDeleting(false); setDeleteTarget(null); }
    };

    const handleDownload = (obj: BucketObject) => {
        if (cloud === 'gcs') {
            // Route via signed URL endpoint — find DB record by key match
            window.open(`/api/admin/media/browse/${cloud}/download?key=${encodeURIComponent(obj.key)}`, '_blank');
        } else {
            window.open(obj.url, '_blank');
        }
    };

    const filtered = objects.filter(o =>
        !search || o.name.toLowerCase().includes(search.toLowerCase())
    );

    const accentColor = cloud === 's3' ? 'orange' : 'blue';
    const Icon        = cloud === 's3' ? HardDrive : CloudLightning;
    const bucketLabel = cloud === 's3' ? 'tm-prod-pilot-california' : 'axis-platform-uploads';

    const isAccessDenied = error?.toLowerCase().includes('access') || error?.toLowerCase().includes('denied') || error?.toLowerCase().includes('listbucket');

    return (
        <div className="space-y-4">
            {(cloud === 'gcs' || !isAccessDenied) && (<>
            <div className="flex items-center gap-2 flex-wrap">
                {prefixStack.length > 0 && (
                    <button onClick={navigateBack}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all">
                        <ArrowLeft size={12} /> Back
                    </button>
                )}
                <div className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-${accentColor}-500/10 border border-${accentColor}-500/20 text-${accentColor}-400 flex-1 min-w-0 truncate`}>
                    <Icon size={11} />
                    {bucketLabel}/{prefix || ''}
                </div>
                <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Filter files..."
                        className="pl-7 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 w-40" />
                </div>
                <button onClick={() => load(prefix)} disabled={loading}
                    className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all">
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
                {objects.length > 0 && (
                    <button onClick={() => setDeleteAllConfirm(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-700/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 text-xs font-bold transition-all">
                        <Trash2 size={11} /> Delete All
                    </button>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                    <AlertCircle size={13} className="shrink-0" />{error}
                </div>
            )}

            {/* Folder list */}
            {prefixes.length > 0 && (
                <div className="space-y-1">
                    {prefixes.map(p => (
                        <button key={p.prefix} onClick={() => navigateTo(p.prefix)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900 transition-all text-left">
                            <FolderOpen size={15} className={`text-${accentColor}-400 shrink-0`} />
                            <span className="text-sm font-medium text-slate-200 flex-1">{p.name}</span>
                            <ChevronRight size={13} className="text-slate-600" />
                        </button>
                    ))}
                </div>
            )}

            {/* File list */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw size={20} className="animate-spin text-blue-400" />
                </div>
            ) : filtered.length === 0 && prefixes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <FileText size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">{prefix ? 'Empty folder' : 'Bucket is empty'}</p>
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {filtered.length} object{filtered.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] text-slate-600">
                            {formatBytes(filtered.reduce((s, o) => s + (o.size || 0), 0))} total
                        </span>
                    </div>
                    <div className="divide-y divide-slate-800/50 max-h-[500px] overflow-y-auto">
                        {filtered.map(obj => (
                            <div key={obj.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 group transition-colors">
                                <div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center shrink-0">
                                    {isImage(obj.name, obj.contentType)
                                        ? <Camera size={13} className="text-sky-400" />
                                        : <FileText size={13} className="text-slate-500" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-200 truncate">{obj.name || obj.key}</p>
                                    <p className="text-[10px] text-slate-600">
                                        {obj.lastModified ? new Date(obj.lastModified).toLocaleDateString() : '—'} · {formatBytes(obj.size)}
                                    </p>
                                </div>
                                <div className="flex gap-1.5">
                                    <button onClick={() => handleDownload(obj)}
                                        className="p-1.5 text-slate-500 hover:text-white transition-colors" title="Download">
                                        <Download size={13} />
                                    </button>
                                    <button onClick={() => setDeleteTarget(obj)}
                                        className="p-1.5 text-red-500/70 hover:text-red-400 transition-colors" title="Delete">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {deleteTarget && !deleting && (
                <ConfirmDeleteDialog
                    fileName={deleteTarget.name || deleteTarget.key}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
            {deleting && (
                <div className="fixed inset-0 bg-slate-950/50 z-50 flex items-center justify-center">
                    <RefreshCw size={24} className="animate-spin text-red-400" />
                </div>
            )}
            {/* Delete All confirm */}
            {deleteAllConfirm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/10 rounded-xl"><TriangleAlert size={18} className="text-red-400" /></div>
                            <h3 className="font-black text-white text-sm uppercase tracking-wide">Delete All Files</h3>
                        </div>
                        <p className="text-sm text-slate-400 mb-2">This will permanently delete:</p>
                        <p className="text-sm font-semibold text-white bg-slate-800 px-3 py-2 rounded-lg mb-2">
                            {filtered.length > 0 ? filtered.length : objects.length} file{(filtered.length || objects.length) !== 1 ? 's' : ''} in <span className="text-orange-300 font-mono text-xs">{prefix || '/'}</span>
                        </p>
                        <p className="text-xs text-red-400 mb-5">⚠ Files will be deleted from cloud storage and cannot be recovered.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteAllConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:border-slate-500 transition-all">Cancel</button>
                            <button onClick={confirmDeleteAll} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black hover:bg-red-500 transition-all">Delete All</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete All progress */}
            {deleteAllProgress && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-3">
                        <p className="text-sm font-black text-white">Deleting files…</p>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                            <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${(deleteAllProgress.done / deleteAllProgress.total) * 100}%` }} />
                        </div>
                        <p className="text-xs text-slate-400 text-right">{deleteAllProgress.done} / {deleteAllProgress.total}</p>
                    </div>
                </div>
            )}
        </>
        )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Mission filter
// ──────────────────────────────────────────────────────────────────────────────
function MissionFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [missions, setMissions] = useState<Mission[]>([]);
    useEffect(() => {
        apiClient.get('/deployments?limit=200')
            .then(r => { const d = r.data?.data || r.data || []; setMissions(Array.isArray(d) ? d.slice(0, 150) : []); })
            .catch(() => {});
    }, []);
    return (
        <div className="relative min-w-40">
            <FolderOpen size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select value={value} onChange={e => onChange(e.target.value)}
                className="w-full appearance-none pl-7 pr-6 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer">
                <option value="">All Missions</option>
                {missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Gallery Tab
// ──────────────────────────────────────────────────────────────────────────────
function GalleryTab() {
    const [files, setFiles]               = useState<MediaFile[]>([]);
    const [totalCount, setTotalCount]     = useState(0);
    const [hasMore, setHasMore]           = useState(false);
    const [loadingMore, setLoadingMore]   = useState(false);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState<string | null>(null);
    const [search, setSearch]             = useState('');
    const [storageFilter, setStorageFilter] = useState<'all'|'aerial'|'ground'>('all');
    const [kindFilter, setKindFilter]     = useState<ImageKind>('all');
    const [missionFilter, setMissionFilter] = useState('');
    const [groupByMission, setGroupByMission] = useState(false);
    const [view, setView]                 = useState<'grid'|'list'>('grid');
    const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
    const [deleting, setDeleting]         = useState(false);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [deleteAllProgress, setDeleteAllProgress] = useState<{done:number;total:number}|null>(null);
    const [aiReport, setAiReport]         = useState<{name: string; text: string} | null>(null);

    const load = async () => {
        setLoading(true); setError(null);
        try {
            const params: Record<string,string> = { limit: '200', offset: '0' };
            if (missionFilter) params.missionId = missionFilter;
            const res = await apiClient.get('/admin/media', { params });
            setFiles(res.data.data || []);
            setTotalCount(res.data.totalCount ?? (res.data.data?.length ?? 0));
            setHasMore(res.data.hasMore ?? false);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally { setLoading(false); }
    };

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const params: Record<string,string> = { limit: '200', offset: String(files.length) };
            if (missionFilter) params.missionId = missionFilter;
            const res = await apiClient.get('/admin/media', { params });
            const newFiles = res.data.data || [];
            setFiles(prev => [...prev, ...newFiles]);
            setHasMore(res.data.hasMore ?? false);
        } catch { /* silent */ } finally { setLoadingMore(false); }
    };

    useEffect(() => { load(); }, [missionFilter]);

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/admin/media/${deleteTarget.id}`);
            setFiles(prev => prev.filter(f => f.id !== deleteTarget.id));
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally { setDeleting(false); setDeleteTarget(null); }
    };

    const confirmDeleteAll = async () => {
        setDeleteAllConfirm(false);
        setDeleteAllProgress({ done: 0, total: totalCount || files.length });
        try {
            // Single bulk request — backend deletes ALL matching files (no pagination limit)
            const body: Record<string, string> = {};
            if (missionFilter) body.missionId = missionFilter;
            const res = await apiClient.delete('/admin/media/bulk', { data: body });
            const deleted = res.data?.deleted ?? 0;
            setDeleteAllProgress({ done: deleted, total: deleted });
            // Reload gallery to reflect new counts
            await load();
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setDeleteAllProgress(null);
        }
    };

    const filtered = files.filter(f => {
        const q = search.toLowerCase();
        if (q && !f.name.toLowerCase().includes(q) && !(f.mission_title||'').toLowerCase().includes(q)) return false;
        if (storageFilter === 'aerial' && !['images','thermal','orthomosaic'].includes(f.upload_type||'')) return false;
        if (storageFilter === 'ground' && ['images','thermal','orthomosaic'].includes(f.upload_type||'')) return false;
        if (kindFilter !== 'all' && getKind(f.upload_type) !== kindFilter) return false;
        return true;
    });

    const grouped = groupByMission
        ? filtered.reduce<Record<string,{title:string;files:MediaFile[]}>>((acc, f) => {
            const k = f.mission_id || '__none__';
            if (!acc[k]) acc[k] = { title: f.mission_title || 'No Mission', files: [] };
            acc[k].files.push(f); return acc;
        }, {}) : null;

    const aerialCount  = files.filter(f => ['images','thermal','orthomosaic'].includes(f.upload_type||'')).length;
    const rgbCount     = files.filter(f => f.upload_type === 'images').length;
    const thermalCount = files.filter(f => f.upload_type === 'thermal').length;
    const irCount      = files.filter(f => f.upload_type === 'lbd').length;

    const [aiToast, setAiToast] = useState<string | null>(null);
    const handleSendToAI = (file: MediaFile, reportText?: string) => {
        if (reportText && reportText.length > 30) {
            setAiReport({ name: file.name, text: reportText });
        } else {
            setAiToast(`✓ AI analysis complete for ${file.name}`);
            setTimeout(() => setAiToast(null), 5000);
        }
    };

    const renderGrid = (items: MediaFile[]) => view === 'grid'
        ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {items.map(f => <FileCard key={f.id} file={f} view="grid" onDelete={setDeleteTarget} onSendToAI={handleSendToAI} />)}
          </div>
        : <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {items.map(f => <FileCard key={f.id} file={f} view="list" onDelete={setDeleteTarget} onSendToAI={handleSendToAI} />)}
          </div>;

    const KIND_CHIPS: { key: ImageKind; label: string; show: boolean }[] = [
        { key: 'all',     label: 'All Types', show: true },
        { key: 'rgb',     label: 'RGB',        show: storageFilter !== 'ground' },
        { key: 'thermal', label: 'Thermal',    show: storageFilter !== 'ground' },
        { key: 'ortho',   label: 'Ortho',      show: storageFilter !== 'ground' },
        { key: 'ir',      label: 'LiDAR/LBD',  show: storageFilter !== 'aerial' },
        { key: 'ground',  label: 'Ground',     show: storageFilter !== 'aerial' },
    ];

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                    { label:'Loaded',  val: `${files.length}${totalCount > files.length ? ` / ${totalCount}` : ''}`, c:'text-white' },
                    { label:'RGB',     val: rgbCount,       c:'text-sky-400' },
                    { label:'Thermal', val: thermalCount,   c:'text-orange-400' },
                    { label:'LiDAR',   val: irCount,        c:'text-emerald-400' },
                    { label:'Size',    val: formatBytes(files.reduce((s,f)=>s+(f.size||0),0)), c:'text-slate-300' },
                ].map(s => (
                    <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{s.label}</p>
                        <p className={`text-lg font-black mt-0.5 ${s.c}`}>{s.val}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-44 relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
                        className="w-full pl-7 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
                    {search && <button onClick={()=>setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={11}/></button>}
                </div>
                <MissionFilter value={missionFilter} onChange={setMissionFilter} />
                <div className="flex gap-1">
                    {(['all','aerial','ground'] as const).map(f => (
                        <button key={f} onClick={()=>{setStorageFilter(f);setKindFilter('all');}}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all
                                ${storageFilter===f?'bg-blue-600 border-blue-500 text-white':'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                            {f==='all'?'All':f==='aerial'?'✈ Aerial':'⛰ Ground'}
                        </button>
                    ))}
                </div>
                <button onClick={()=>setGroupByMission(v=>!v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all
                        ${groupByMission?'bg-blue-600 border-blue-500 text-white':'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                    Group
                </button>
                <button onClick={()=>setView(v=>v==='grid'?'list':'grid')}
                    className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-all">
                    {view==='grid'?<List size={13}/>:<Grid size={13}/>}
                </button>
                <button onClick={load} disabled={loading}
                    className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-all">
                    <RefreshCw size={13} className={loading?'animate-spin':''} />
                </button>
                {filtered.length > 0 && (
                    <button onClick={() => setDeleteAllConfirm(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-700/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 text-xs font-bold transition-all">
                        <Trash2 size={11} /> Delete All ({filtered.length})
                    </button>
                )}
                {filtered.length > 0 && (
                    <button onClick={async () => {
                        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
                        let sent = 0;
                        setAiToast(`Analysing ${filtered.length} images… (paced to avoid rate limits)`);
                        for (const f of filtered) {
                            try {
                                const res = await apiClient.post(`/admin/media/${f.id}/send-to-ai`);
                                sent++;
                                setAiToast(`Analysing… ${sent}/${filtered.length} done`);
                                if (res.data?.analysis?.aiReport) {
                                    // Last image — show the last report
                                    if (sent === filtered.length) setAiReport({ name: `Batch (${sent} images)`, text: res.data.analysis.aiReport });
                                }
                            } catch { /* continue */ }
                            await delay(2500); // 2.5s gap = ~24 req/min, safely under 30 RPM free tier
                        }
                        setAiToast(`✓ Batch analysis complete — ${sent} of ${filtered.length} analysed`);
                        setTimeout(() => setAiToast(null), 6000);
                    }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-700/50 bg-violet-900/20 text-violet-400 hover:bg-violet-900/40 text-xs font-bold transition-all">
                        <Zap size={11} /> Analyse All
                    </button>
                )}
            </div>

            {/* Kind chips */}
            <div className="flex flex-wrap gap-1.5">
                {KIND_CHIPS.filter(k=>k.show).map(k => (
                    <button key={k.key} onClick={()=>setKindFilter(k.key)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all
                            ${kindFilter===k.key?'bg-slate-700 border-slate-500 text-white':'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}>
                        {k.label}
                    </button>
                ))}
            </div>

            {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300"><AlertCircle size={13}/>{error}</div>}

            {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="animate-spin text-blue-400"/></div>}

            {!loading && !error && filtered.length===0 && (
                <div className="text-center py-16 text-slate-500">
                    <Camera size={32} className="mx-auto mb-2 opacity-20"/>
                    <p className="text-sm text-slate-400">{search?'No files match':'No files yet'}</p>
                </div>
            )}

            {!loading && !error && filtered.length>0 && (
                grouped
                    ? <div className="space-y-6">{Object.entries(grouped).map(([k,g])=>(
                        <div key={k}>
                            <div className="flex items-center gap-2 mb-3">
                                <FolderOpen size={13} className="text-blue-400"/>
                                <h3 className="text-sm font-black text-white">{g.title}</h3>
                                <span className="text-xs text-slate-500">{g.files.length} file{g.files.length!==1?'s':''}</span>
                            </div>
                            {renderGrid(g.files)}
                        </div>
                    ))}</div>
                    : renderGrid(filtered)
            )}

            {/* Load More */}
            {hasMore && !loading && (
                <div className="flex justify-center pt-2">
                    <button onClick={loadMore} disabled={loadingMore}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-bold hover:border-slate-500 hover:text-white transition-all disabled:opacity-50">
                        {loadingMore ? <RefreshCw size={13} className="animate-spin" /> : null}
                        {loadingMore ? 'Loading…' : `Load More (${totalCount - files.length} remaining)`}
                    </button>
                </div>
            )}

            {deleteTarget && !deleting && (
                <ConfirmDeleteDialog
                    fileName={deleteTarget.name}
                    onConfirm={confirmDelete}
                    onCancel={()=>setDeleteTarget(null)}
                />
            )}
            {deleting && <div className="fixed inset-0 bg-slate-950/50 z-50 flex items-center justify-center"><RefreshCw size={24} className="animate-spin text-red-400"/></div>}
            {/* Delete All confirm */}
            {deleteAllConfirm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/10 rounded-xl"><TriangleAlert size={18} className="text-red-400" /></div>
                            <h3 className="font-black text-white text-sm uppercase tracking-wide">Delete All Files</h3>
                        </div>
                        <p className="text-sm text-slate-400 mb-2">This will permanently delete:</p>
                        <p className="text-sm font-semibold text-white bg-slate-800 px-3 py-2 rounded-lg mb-2">
                            {filtered.length} file{filtered.length !== 1 ? 's' : ''} {missionFilter ? 'from selected mission' : storageFilter !== 'all' ? `(${storageFilter})` : ''}
                        </p>
                        <p className="text-xs text-red-400 mb-5">⚠ Files will be removed from cloud storage and the database.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteAllConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:border-slate-500 transition-all">Cancel</button>
                            <button onClick={confirmDeleteAll} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black hover:bg-red-500 transition-all">Delete All</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete All progress */}
            {deleteAllProgress && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-3">
                        <p className="text-sm font-black text-white">Deleting files…</p>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                            <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${(deleteAllProgress.done / deleteAllProgress.total) * 100}%` }} />
                        </div>
                    </div>
                </div>
            )}
            {/* AI Report Modal */}
            {aiReport && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-violet-500/30 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Brain size={16} className="text-violet-400" />
                                <div>
                                    <p className="text-sm font-black text-white">AI Inspection Report</p>
                                    <p className="text-[10px] text-slate-500 truncate max-w-xs">{aiReport.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setAiReport(null)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5">
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                {aiReport.text.split('\n').map((line, i) => {
                                    const isHeader = /^\d+\. [A-Z ]+:/.test(line) || /^#{1,3} /.test(line);
                                    return line.trim() ? (
                                        <p key={i} className={`leading-relaxed mb-1 text-sm ${isHeader ? 'font-black text-violet-300 mt-3' : 'text-slate-300'}`}>
                                            {line.replace(/^#{1,3} /, '').replace(/^\*\*(.*?)\*\*/, '$1')}
                                        </p>
                                    ) : <div key={i} className="h-1" />;
                                })}
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
                            <button onClick={() => setAiReport(null)}
                                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-500 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* AI submission toast */}
            {aiToast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-violet-900/90 border border-violet-600/50 backdrop-blur-sm px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                    <Brain size={16} className="text-violet-300 shrink-0" />
                    <p className="text-sm font-bold text-white">{aiToast}</p>
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Root Component
// ──────────────────────────────────────────────────────────────────────────────
export default function MediaGallery() {
    const [tab, setTab] = useState<Tab>('gallery');

    return (
        <div className="p-4 md:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Media Gallery</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">Gallery · S3 Info · GCS Browser</p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
                {([
                    { key: 'gallery', label: 'Gallery',     icon: <Grid size={13} /> },
                    { key: 's3',      label: 'S3 Browser',  icon: <HardDrive size={13} /> },
                    { key: 'gcs',     label: 'GCS Browser', icon: <CloudLightning size={13} /> },
                ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all
                            ${tab === t.key
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-slate-200'}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {tab === 'gallery'  && <GalleryTab />}
            {tab === 's3'       && <BucketBrowser cloud="s3" />}
            {tab === 'gcs'      && <BucketBrowser cloud="gcs" />}
        </div>
    );
}
