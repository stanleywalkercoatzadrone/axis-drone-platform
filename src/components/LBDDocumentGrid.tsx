/**
 * LBDDocumentGrid.tsx
 * Renders a visual clickable grid of LBD blocks + units parsed from uploaded documents.
 * - Admin / Client: read-only heatmap showing block/unit completion status
 * - Pilot: interactive — click a unit tile to open a bottom-sheet and mark complete / issue / pending
 * Uses the same /blocks API as LBDBlockTracker.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../services/apiClient';
import {
    CheckCircle2, AlertTriangle, Clock, RefreshCw,
    Grid3X3, ChevronDown, ChevronUp, Zap, Flame, Thermometer, X
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface LBDUnit {
    id: string;
    lbd_code: string;
    lbd_number: number;
    status: 'pending' | 'completed' | 'issue';
    thermal_flag: 'normal' | 'hotspot' | 'critical';
    notes: string | null;
    uploaded_by_name: string | null;
}

interface Block {
    id: string;
    block_name: string;
    total_lbds: number;
    total_lbd_units?: number;
    completed_lbds?: number;
    status: string;
    assigned_to: string | null;
}

interface Props {
    deploymentId: string;
    userRole?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const isPilot = (role?: string) =>
    role === 'pilot_technician' || role === 'pilot' || role === 'field_operator';

const isClient = (role?: string) =>
    role === 'client' || role === 'client_user' || role === 'customer';

const unitStyle = (status: string, thermal: string) => {
    if (thermal === 'critical') return { bg: 'bg-red-600 border-red-400', text: 'text-white', label: 'text-red-300' };
    if (thermal === 'hotspot')  return { bg: 'bg-amber-500 border-amber-300', text: 'text-white', label: 'text-amber-200' };
    if (status === 'completed') return { bg: 'bg-emerald-600 border-emerald-400', text: 'text-white', label: 'text-emerald-200' };
    if (status === 'issue')     return { bg: 'bg-red-500/80 border-red-400', text: 'text-white', label: 'text-red-200' };
    return { bg: 'bg-slate-700/80 border-slate-600', text: 'text-slate-300', label: 'text-slate-500' };
};

const blockProgressColor = (pct: number) => {
    if (pct >= 100) return 'from-emerald-500 to-emerald-400';
    if (pct >= 50)  return 'from-amber-500 to-amber-400';
    return 'from-red-500 to-red-400';
};

// ── Unit Status Icon ──────────────────────────────────────────────────────────
function UnitIcon({ unit, size = 14 }: { unit: LBDUnit; size?: number }) {
    if (unit.thermal_flag === 'critical') return <Flame style={{ width: size, height: size }} />;
    if (unit.thermal_flag === 'hotspot')  return <Thermometer style={{ width: size, height: size }} />;
    if (unit.status === 'completed')      return <CheckCircle2 style={{ width: size, height: size }} />;
    if (unit.status === 'issue')          return <AlertTriangle style={{ width: size, height: size }} />;
    return <span style={{ fontSize: 10, fontWeight: 900, lineHeight: 1 }}>{unit.lbd_number}</span>;
}

// ── Bottom Sheet Modal (for pilot tile interaction) ───────────────────────────
function UnitModal({ unit, onClose, onUpdate }: {
    unit: LBDUnit;
    onClose: () => void;
    onUpdate: (id: string, status: LBDUnit['status'], notes: string) => Promise<void>;
}) {
    const [notes, setNotes] = useState(unit.notes || '');
    const [saving, setSaving] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    const handle = async (newStatus: LBDUnit['status']) => {
        setSaving(true);
        await onUpdate(unit.id, newStatus, notes);
        setSaving(false);
        onClose();
    };

    const s = unitStyle(unit.status, unit.thermal_flag);

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div className="w-full sm:w-auto sm:min-w-[340px] sm:max-w-sm bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center ${s.bg} ${s.text}`}>
                            <UnitIcon unit={unit} size={18} />
                        </div>
                        <div>
                            <p className="font-black text-white text-sm">{unit.lbd_code}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 capitalize">
                                {unit.thermal_flag !== 'normal' ? `${unit.thermal_flag} thermal` : unit.status}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Notes */}
                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                        Notes / Observations
                    </label>
                    <textarea
                        rows={3}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="e.g. Hotspot at string 3, row 7 — visually confirmed"
                        className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                    />
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => handle('completed')}
                        disabled={saving}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
                    >
                        <CheckCircle2 size={18} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Done</span>
                    </button>
                    <button
                        onClick={() => handle('issue')}
                        disabled={saving}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-red-600/30 hover:bg-red-600/50 border border-red-600/40 disabled:opacity-50 text-red-300 transition-colors"
                    >
                        <AlertTriangle size={18} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Issue</span>
                    </button>
                    <button
                        onClick={() => handle('pending')}
                        disabled={saving || unit.status === 'pending'}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 transition-colors"
                    >
                        <Clock size={18} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Reset</span>
                    </button>
                </div>

                {saving && (
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                        <RefreshCw size={12} className="animate-spin" /> Saving…
                    </div>
                )}
            </div>
        </div>
    );
}

// ── LBD Unit Tile ─────────────────────────────────────────────────────────────
const UnitTile: React.FC<{
    unit: LBDUnit;
    editable: boolean;
    onTap: (unit: LBDUnit) => void;
}> = ({ unit, editable, onTap }) => {
    const s = unitStyle(unit.status, unit.thermal_flag);

    return (
        <button
            onClick={() => editable && onTap(unit)}
            title={`${unit.lbd_code} — ${unit.status}${unit.notes ? '\n' + unit.notes : ''}`}
            className={`
                flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-150 min-w-0
                ${s.bg} ${s.text}
                ${editable ? 'cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95' : 'cursor-default'}
            `}
            style={{ minWidth: 52 }}
        >
            <div className="flex items-center justify-center h-5">
                <UnitIcon unit={unit} size={16} />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-tight leading-none truncate w-full text-center ${s.label}`}>
                {unit.lbd_code.length > 8 ? unit.lbd_code.slice(-6) : unit.lbd_code}
            </span>
        </button>
    );
};

// ── Block Grid Card ───────────────────────────────────────────────────────────
const BlockGridCard: React.FC<{
    block: Block;
    editable: boolean;
    onUnitUpdate: (unitId: string, status: LBDUnit['status'], notes?: string) => Promise<void>;
}> = ({ block, editable, onUnitUpdate }) => {
    const [expanded, setExpanded] = useState(true);
    const [units, setUnits] = useState<LBDUnit[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [activeUnit, setActiveUnit] = useState<LBDUnit | null>(null);
    const [markingAll, setMarkingAll] = useState(false);
    const [resettingAll, setResettingAll] = useState(false);

    const total     = block.total_lbd_units ?? block.total_lbds ?? 0;
    const completed = block.completed_lbds ?? 0;
    const issues    = units.filter(u => u.status === 'issue').length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

    const fetchUnits = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/blocks/${block.id}/lbds?limit=500`);
            setUnits(res.data.data || []);
            setLoaded(true);
        } catch { /* silent */ } finally { setLoading(false); }
    }, [block.id]);

    useEffect(() => {
        if (expanded && !loaded) fetchUnits();
    }, [expanded, loaded, fetchUnits]);

    const handleUpdate = async (unitId: string, status: LBDUnit['status'], notes?: string) => {
        try {
            const res = await apiClient.patch(`/blocks/lbds/${unitId}`, { status, notes });
            setUnits(prev => prev.map(u =>
                u.id === unitId ? { ...u, ...res.data.data, status, notes: notes ?? u.notes } : u
            ));
            await onUnitUpdate(unitId, status, notes);
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Update failed');
        }
    };

    const markAllComplete = async () => {
        const pending = units.filter(u => u.status !== 'completed');
        if (pending.length === 0) return;
        setMarkingAll(true);
        try {
            await Promise.all(
                pending.map(u => apiClient.patch(`/blocks/lbds/${u.id}`, { status: 'completed' }))
            );
            setUnits(prev => prev.map(u => ({ ...u, status: u.status === 'completed' ? u.status : 'completed' as const })));
            await onUnitUpdate('bulk', 'completed');
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Bulk update failed');
        } finally {
            setMarkingAll(false);
        }
    };

    const resetAllPending = async () => {
        const nonPending = units.filter(u => u.status !== 'pending');
        if (nonPending.length === 0) return;
        if (!window.confirm(`Reset all ${nonPending.length} unit${nonPending.length !== 1 ? 's' : ''} in "${block.block_name}" back to pending?`)) return;
        setResettingAll(true);
        try {
            await Promise.all(
                nonPending.map(u => apiClient.patch(`/blocks/lbds/${u.id}`, { status: 'pending' }))
            );
            setUnits(prev => prev.map(u => ({ ...u, status: 'pending' as const })));
            await onUnitUpdate('bulk', 'pending');
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Reset failed');
        } finally {
            setResettingAll(false);
        }
    };

    // Counts from live unit data (if loaded), else fall back to block summary
    const liveDone   = loaded ? units.filter(u => u.status === 'completed').length : completed;
    const liveTotal  = loaded ? units.length : total;
    const livePct    = liveTotal > 0 ? Math.round((liveDone / liveTotal) * 100) : 0;

    return (
        <>
            {/* Modal */}
            {activeUnit && editable && (
                <UnitModal
                    unit={activeUnit}
                    onClose={() => setActiveUnit(null)}
                    onUpdate={handleUpdate}
                />
            )}

            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-md">
                {/* Block Header */}
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-800/40 transition-colors"
                >
                    {/* Status dot */}
                    <div className={`w-3 h-3 rounded-full shrink-0 ${livePct >= 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : livePct > 0 ? 'bg-amber-500' : 'bg-slate-600'}`} />

                    <span className="font-bold text-white text-sm flex-1 text-left">{block.block_name}</span>

                        {/* Mark All / Reset All — only for pilots, only when units are loaded */}
                        {editable && loaded && (
                            <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                {units.some(u => u.status !== 'completed') && (
                                    <button
                                        onClick={markAllComplete}
                                        disabled={markingAll || resettingAll}
                                        title="Mark all units in this block as complete"
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600/25 disabled:opacity-50 transition-colors"
                                    >
                                        {markingAll
                                            ? <><RefreshCw size={9} className="animate-spin" /> Saving…</>
                                            : <><CheckCircle2 size={10} /> Mark All</>}
                                    </button>
                                )}
                                {units.some(u => u.status !== 'pending') && (
                                    <button
                                        onClick={resetAllPending}
                                        disabled={markingAll || resettingAll}
                                        title="Reset all units in this block to pending"
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-400 text-[10px] font-black uppercase tracking-wider hover:bg-slate-600/50 disabled:opacity-50 transition-colors"
                                    >
                                        {resettingAll
                                            ? <><RefreshCw size={9} className="animate-spin" /> Resetting…</>
                                            : <><Clock size={9} /> Reset All</>}
                                    </button>
                                )}
                            </div>
                        )}

                    {/* Stats */}
                    <div className="flex items-center gap-3 shrink-0">
                        {issues > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full">
                                <AlertTriangle size={9} />{issues}
                            </span>
                        )}
                        <span className="text-xs font-bold text-slate-400 tabular-nums">
                            {liveDone}/{liveTotal}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            livePct >= 100 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                            livePct > 0    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                             'bg-slate-700/40 text-slate-500 border-slate-700/30'
                        }`}>
                            {livePct >= 100 ? '✓ Done' : livePct > 0 ? `${livePct}%` : 'Pending'}
                        </span>
                    </div>

                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                </button>

                {/* Progress bar */}
                <div className="h-1 w-full bg-slate-800">
                    <div
                        className={`h-full bg-gradient-to-r transition-all duration-700 ${blockProgressColor(livePct)}`}
                        style={{ width: `${livePct}%` }}
                    />
                </div>

                {/* Unit Grid */}
                {expanded && (
                    <div className="px-4 py-4">
                        {loading ? (
                            <div className="flex items-center gap-2 text-slate-500 text-xs py-6 justify-center">
                                <RefreshCw className="w-4 h-4 animate-spin" /> Loading units…
                            </div>
                        ) : units.length === 0 ? (
                            <div className="py-6 text-center">
                                <p className="text-slate-600 text-xs">No LBD units found.</p>
                                <p className="text-slate-700 text-[10px] mt-1">Upload a block document (CSV/XLSX) to populate this grid.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Pilot CTA */}
                                {editable && (
                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20">
                                        <div className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center shrink-0">
                                            <Grid3X3 size={11} className="text-blue-400" />
                                        </div>
                                        <p className="text-[10px] font-bold text-blue-400">Tap any tile to mark it complete, flag an issue, or add notes</p>
                                    </div>
                                )}

                                {/* Legend */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                                    {[
                                        { color: 'bg-slate-700 border-slate-600', label: 'Pending' },
                                        { color: 'bg-emerald-600 border-emerald-400', label: 'Complete' },
                                        { color: 'bg-red-500/80 border-red-400', label: 'Issue' },
                                        { color: 'bg-amber-500 border-amber-300', label: 'Hotspot' },
                                        { color: 'bg-red-600 border-red-400', label: 'Critical' },
                                    ].map(item => (
                                        <span key={item.label} className="flex items-center gap-1.5">
                                            <span className={`w-2.5 h-2.5 rounded border ${item.color} inline-block`} />
                                            {item.label}
                                        </span>
                                    ))}
                                </div>

                                {/* Grid */}
                                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))' }}>
                                    {units.map(unit => (
                                        <UnitTile
                                            key={unit.id}
                                            unit={unit}
                                            editable={editable}
                                            onTap={setActiveUnit}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

// ── Main LBDDocumentGrid ──────────────────────────────────────────────────────
const LBDDocumentGrid: React.FC<Props> = ({ deploymentId, userRole }) => {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const editable = isPilot(userRole);
    const readOnly = isClient(userRole);

    const fetchBlocks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/blocks/${deploymentId}`);
            setBlocks((res.data.data || []).map((b: any) => ({
                ...b,
                total_lbd_units: b.total_lbd_units ?? b.total_lbds ?? 0,
                completed_lbds:  b.completed_lbds ?? 0,
            })));
        } catch { /* silent */ } finally { setLoading(false); }
    }, [deploymentId]);

    useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

    const handleUnitUpdate = useCallback(async () => {
        try {
            const res = await apiClient.get(`/blocks/${deploymentId}`);
            setBlocks((res.data.data || []).map((b: any) => ({
                ...b,
                total_lbd_units: b.total_lbd_units ?? b.total_lbds ?? 0,
                completed_lbds:  b.completed_lbds ?? 0,
            })));
        } catch { /* silent */ }
    }, [deploymentId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Loading block grid…</span>
            </div>
        );
    }

    if (blocks.length === 0) return null;

    const totalBlocks    = blocks.length;
    const completedBlocks = blocks.filter(b => b.status === 'completed').length;
    const totalUnits     = blocks.reduce((s, b) => s + (b.total_lbd_units ?? b.total_lbds ?? 0), 0);
    const completedUnits = blocks.reduce((s, b) => s + (b.completed_lbds ?? 0), 0);
    const overallPct     = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <Grid3X3 className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">LBD Block Grid</h3>
                            {editable && (
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 uppercase tracking-widest">
                                    Interactive
                                </span>
                            )}
                            {readOnly && (
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-700/60 border border-slate-600/30 text-slate-500 uppercase tracking-widest">
                                    Read Only
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            {totalBlocks} block{totalBlocks !== 1 ? 's' : ''} · {totalUnits} units
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchBlocks}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Overall Progress */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Overall Completion
                    </span>
                    <span className="text-xl font-black text-white tabular-nums">{overallPct}%</span>
                </div>
                <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${blockProgressColor(overallPct)}`}
                        style={{ width: `${overallPct}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                    <span>{completedUnits} of {totalUnits} units complete</span>
                    <span>{completedBlocks}/{totalBlocks} blocks done</span>
                </div>
            </div>

            {/* Block Cards */}
            <div className="space-y-3">
                {blocks.map(block => (
                    <BlockGridCard
                        key={block.id}
                        block={block}
                        editable={editable}
                        onUnitUpdate={handleUnitUpdate}
                    />
                ))}
            </div>
        </div>
    );
};

export default LBDDocumentGrid;
