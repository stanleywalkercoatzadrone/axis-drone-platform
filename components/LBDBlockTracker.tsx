/**
 * LBDBlockTracker.tsx — Admin Block Progress View
 * Shows block-level and LBD-unit-level progress for a deployment.
 * Supports CSV/XLSX upload, pilot assignment, and real-time updates via Socket.IO.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../src/services/apiClient';
import {
    Upload, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle,
    Users, Grid3X3, RefreshCw, X, Flame, Thermometer, Activity
} from 'lucide-react';

interface LBDUnit {
    id: string;
    lbd_code: string;
    lbd_number: number;
    status: 'pending' | 'completed' | 'issue';
    thermal_flag: 'normal' | 'hotspot' | 'critical';
    notes: string | null;
    uploaded_by_name: string | null;
    uploaded_at: string | null;
}

interface Block {
    id: string;
    block_name: string;
    total_lbds: number;
    assigned_to: string | null;
    status: string;
    deployment_id: string;
    // aggregated from JOIN
    total_lbd_units?: number;
    completed_lbds?: number;
}

interface Props {
    deploymentId: string;
    personnel?: any[]; // existing personnel list for assignment dropdown
}

/* ── Status helpers ─────────────────────────────────────────────────────────── */
const statusBadge = (status: string) => {
    const map: Record<string, string> = {
        not_started: 'bg-red-500/15 text-red-400 border border-red-500/30',
        pending:     'bg-red-500/15 text-red-400 border border-red-500/30',
        in_progress: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        completed:   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        skipped:     'bg-slate-600/30 text-slate-400 border border-slate-600/30',
    };
    return map[status] ?? 'bg-slate-700 text-slate-400';
};

const statusDot = (status: string) => {
    if (status === 'completed') return 'bg-emerald-500';
    if (status === 'in_progress') return 'bg-amber-500';
    return 'bg-red-500';
};

const thermalIcon = (flag: string) => {
    if (flag === 'critical') return <Flame className="w-3 h-3 text-red-400" />;
    if (flag === 'hotspot')  return <Thermometer className="w-3 h-3 text-amber-400" />;
    return null;
};

const lbdStatusColor = (s: string) => {
    if (s === 'completed') return 'text-emerald-400';
    if (s === 'issue')     return 'text-red-400';
    return 'text-slate-500';
};

/* ── LBD Unit Row ───────────────────────────────────────────────────────────── */
const LBDRow: React.FC<{ lbd: LBDUnit; onUpdate: (id: string, patch: Partial<LBDUnit>) => void }> = ({ lbd, onUpdate }) => {
    const [open, setOpen] = useState(false);
    const [notes, setNotes] = useState(lbd.notes || '');
    const [thermal, setThermal] = useState(lbd.thermal_flag || 'normal');
    const [saving, setSaving] = useState(false);

    const toggle = async (newStatus: 'completed' | 'pending' | 'issue') => {
        setSaving(true);
        try {
            const res = await apiClient.patch(`/blocks/lbds/${lbd.id}`, {
                status: newStatus,
                notes: notes || undefined,
                thermal_flag: thermal,
            });
            onUpdate(lbd.id, res.data.data);
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Update failed');
        } finally {
            setSaving(false);
            setOpen(false);
        }
    };

    return (
        <div className="border-b border-slate-800/60 last:border-0">
            <div
                className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800/30 cursor-pointer transition-colors"
                onClick={() => setOpen(o => !o)}
            >
                {/* Status indicator */}
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    lbd.status === 'completed'
                        ? 'bg-emerald-500 border-emerald-500'
                        : lbd.status === 'issue'
                        ? 'bg-red-500/20 border-red-500'
                        : 'border-slate-600'
                }`}>
                    {lbd.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-white" />}
                    {lbd.status === 'issue'     && <AlertCircle  className="w-3 h-3 text-red-400" />}
                </div>

                <span className={`text-xs font-mono font-bold flex-1 ${lbdStatusColor(lbd.status)}`}>
                    {lbd.lbd_code}
                </span>

                {thermalIcon(lbd.thermal_flag)}

                {lbd.uploaded_by_name && (
                    <span className="text-[10px] text-slate-600 hidden sm:block">
                        {lbd.uploaded_by_name}
                    </span>
                )}

                {open ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
            </div>

            {open && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-slate-900/50">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Notes</label>
                            <textarea
                                rows={2}
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Observations, issues..."
                                className="w-full px-3 py-2 bg-slate-800 text-slate-200 text-xs border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Thermal</label>
                            <select
                                value={thermal}
                                onChange={e => setThermal(e.target.value as any)}
                                className="w-full px-2 py-2 bg-slate-800 text-slate-200 text-xs border border-slate-700 rounded-lg focus:outline-none"
                            >
                                <option value="normal">Normal</option>
                                <option value="hotspot">Hotspot</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => toggle('completed')}
                            disabled={saving}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving…' : '✓ Mark Complete'}
                        </button>
                        <button
                            onClick={() => toggle('issue')}
                            disabled={saving}
                            className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 text-xs font-bold rounded-lg border border-red-600/30 transition-colors disabled:opacity-50"
                        >
                            Issue
                        </button>
                        {lbd.status !== 'pending' && (
                            <button
                                onClick={() => toggle('pending')}
                                disabled={saving}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ── Block Card ─────────────────────────────────────────────────────────────── */
const BlockCard: React.FC<{
    block: Block;
    personnel: any[];
    onAssign: (blockId: string, userId: string) => void;
}> = ({ block, personnel, onAssign }) => {
    const [expanded, setExpanded] = useState(false);
    const [lbds, setLbds] = useState<LBDUnit[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const completed = block.completed_lbds ?? 0;
    const total     = block.total_lbd_units ?? block.total_lbds ?? 0;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

    const fetchLBDs = useCallback(async (pg = 1) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/blocks/${block.id}/lbds?page=${pg}&limit=100`);
            setLbds(prev => pg === 1 ? res.data.data : [...prev, ...res.data.data]);
            setTotalPages(res.data.pagination?.pages ?? 1);
            setPage(pg);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    }, [block.id]);

    const handleExpand = () => {
        if (!expanded && lbds.length === 0) fetchLBDs(1);
        setExpanded(e => !e);
    };

    const updateLBD = (id: string, patch: Partial<LBDUnit>) => {
        setLbds(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Block Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={handleExpand}
            >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(block.status)}`} />

                <span className="font-bold text-slate-100 text-sm flex-1">{block.block_name}</span>

                {/* Assign dropdown */}
                <select
                    value={block.assigned_to ?? ''}
                    onChange={e => { e.stopPropagation(); onAssign(block.id, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none max-w-[130px] truncate"
                >
                    <option value="">Unassigned</option>
                    {personnel.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.full_name || p.name}</option>
                    ))}
                </select>

                {/* Progress */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:block w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-red-500/50'
                            }`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <span className="text-xs font-bold text-slate-300 w-20 text-right">
                        {completed}/{total} ({pct}%)
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${statusBadge(block.status)}`}>
                        {block.status.replace('_', ' ')}
                    </span>
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
            </div>

            {/* LBD Unit List */}
            {expanded && (
                <div className="border-t border-slate-800">
                    {loading && lbds.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">
                            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                            Loading LBDs…
                        </div>
                    ) : lbds.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-xs italic">
                            No LBD units found. Upload a CSV to generate them.
                        </div>
                    ) : (
                        <>
                            <div className="max-h-96 overflow-y-auto">
                                {lbds.map(lbd => (
                                    <LBDRow key={lbd.id} lbd={lbd} onUpdate={updateLBD} />
                                ))}
                            </div>
                            {page < totalPages && (
                                <div className="p-3 border-t border-slate-800 text-center">
                                    <button
                                        onClick={() => fetchLBDs(page + 1)}
                                        disabled={loading}
                                        className="text-xs font-bold text-blue-400 hover:text-blue-300 disabled:opacity-50"
                                    >
                                        Load more…
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

/* ── Upload Modal ───────────────────────────────────────────────────────────── */
const UploadModal: React.FC<{ deploymentId: string; onClose: () => void; onSuccess: () => void }> = ({ deploymentId, onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('deployment_id', deploymentId);
            const res = await apiClient.post('/blocks/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult(res.data);
            onSuccess();
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Upload className="w-4 h-4 text-blue-400" />
                        Import Blocks from CSV / XLSX
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="text-xs text-slate-400 bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1">
                        <p className="font-bold text-slate-300">Required columns:</p>
                        <p>• <code className="text-blue-300">Block Name</code> — e.g. A1, B2</p>
                        <p>• <code className="text-blue-300">LBD Count</code> — number of units (e.g. 22)</p>
                        <p>• <code className="text-blue-300">Assigned</code> — pilot name or email (optional)</p>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
                            Select File (.csv or .xlsx)
                        </label>
                        <input
                            type="file"
                            accept=".csv,.xlsx"
                            onChange={e => setFile(e.target.files?.[0] ?? null)}
                            className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-xs file:font-bold hover:file:bg-blue-500 transition-colors"
                        />
                    </div>

                    {result && (
                        <div className={`text-xs p-3 rounded-lg border ${result.errors?.length ? 'bg-amber-900/20 border-amber-700/30 text-amber-300' : 'bg-emerald-900/20 border-emerald-700/30 text-emerald-300'}`}>
                            <p className="font-bold mb-1">{result.message}</p>
                            {result.errors?.length > 0 && result.errors.map((e: string, i: number) => (
                                <p key={i} className="text-red-400">{e}</p>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Importing…</> : <><Upload className="w-4 h-4" /> Import</>}
                        </button>
                        <button onClick={onClose} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-xl transition-colors">
                            {result ? 'Done' : 'Cancel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ── Main LBDBlockTracker ───────────────────────────────────────────────────── */
const LBDBlockTracker: React.FC<Props> = ({ deploymentId, personnel = [] }) => {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const socketRef = useRef<any>(null);

    const fetchBlocks = useCallback(async () => {
        try {
            const res = await apiClient.get(`/blocks/${deploymentId}`);
            // Merge aggregated counts from DB into block objects
            const rows: Block[] = (res.data.data || []).map((b: any) => ({
                ...b,
                total_lbd_units: b.total_lbd_units ?? b.total_lbds ?? 0,
                completed_lbds:  b.completed_lbds ?? 0,
            }));
            setBlocks(rows);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    }, [deploymentId]);

    useEffect(() => {
        fetchBlocks();

        // Socket.IO — listen for real-time LBD updates
        const initSocket = async () => {
            try {
                const { io } = await import('socket.io-client');
                const socket = io(window.location.origin, { transports: ['websocket'] });
                socketRef.current = socket;

                socket.on('lbd_updated', (payload: any) => {
                    if (payload.deployment_id !== deploymentId) return;
                    // Refresh block list to get updated counts
                    fetchBlocks();
                });

                socket.on('block_added', (payload: any) => {
                    if (payload.deploymentId === deploymentId) fetchBlocks();
                });
            } catch { /* socket optional */ }
        };
        initSocket();

        return () => { socketRef.current?.disconnect(); };
    }, [deploymentId, fetchBlocks]);

    const handleAssign = async (blockId: string, userId: string) => {
        try {
            await apiClient.patch(`/blocks/${blockId}/assign`, { assigned_to: userId || null });
        } catch (e: any) {
            console.error('Assign failed:', e?.response?.data?.message || e.message);
        } finally {
            fetchBlocks();
        }
    };

    const totalBlocks    = blocks.length;
    const completedBlocks = blocks.filter(b => b.status === 'completed').length;
    const inProgressBlocks = blocks.filter(b => b.status === 'in_progress').length;
    const totalLBDs      = blocks.reduce((s, b) => s + (b.total_lbd_units ?? b.total_lbds ?? 0), 0);
    const completedLBDs  = blocks.reduce((s, b) => s + (b.completed_lbds ?? 0), 0);
    const overallPct     = totalLBDs > 0 ? Math.round((completedLBDs / totalLBDs) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Header + Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <Grid3X3 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Block Progress</h3>
                        <p className="text-[11px] text-slate-500">{totalBlocks} blocks · {totalLBDs} LBD units</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchBlocks}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowUpload(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                        <Upload className="w-3.5 h-3.5" /> Import CSV/XLSX
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Blocks', value: totalBlocks, icon: <Grid3X3 className="w-4 h-4 text-slate-400" />, cls: 'text-white' },
                    { label: 'Completed',    value: completedBlocks, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, cls: 'text-emerald-400' },
                    { label: 'In Progress',  value: inProgressBlocks, icon: <Activity className="w-4 h-4 text-amber-400" />, cls: 'text-amber-400' },
                    { label: 'LBD Progress', value: `${completedLBDs}/${totalLBDs}`, icon: <Clock className="w-4 h-4 text-blue-400" />, cls: 'text-blue-400' },
                ].map(kpi => (
                    <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                        {kpi.icon}
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{kpi.label}</p>
                            <p className={`text-lg font-black ${kpi.cls}`}>{kpi.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Overall progress bar */}
            {totalLBDs > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                        <span className="font-bold text-slate-300">Overall LBD Completion</span>
                        <span className="font-black text-white">{overallPct}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: `${overallPct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Block List */}
            {loading ? (
                <div className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
                    Loading blocks…
                </div>
            ) : blocks.length === 0 ? (
                <div className="p-10 text-center space-y-3 bg-slate-900 border border-slate-800 rounded-xl">
                    <Grid3X3 className="w-8 h-8 text-slate-700 mx-auto" />
                    <p className="text-slate-400 font-semibold">No blocks yet</p>
                    <p className="text-slate-600 text-sm">Upload a CSV or XLSX file to generate blocks and LBD units.</p>
                    <button
                        onClick={() => setShowUpload(true)}
                        className="mx-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                        <Upload className="w-4 h-4" /> Import Blocks
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {blocks.map(block => (
                        <BlockCard
                            key={block.id}
                            block={block}
                            personnel={personnel}
                            onAssign={handleAssign}
                        />
                    ))}
                </div>
            )}

            {showUpload && (
                <UploadModal
                    deploymentId={deploymentId}
                    onClose={() => setShowUpload(false)}
                    onSuccess={fetchBlocks}
                />
            )}
        </div>
    );
};

export default LBDBlockTracker;
