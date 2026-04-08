/**
 * SolarBlockMap.tsx — Phase 6 frontend
 * Color-coded solar block grid for a deployment/mission.
 * Fetches from GET /api/blocks?deploymentId=:id (already live).
 */
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../src/services/apiClient';
import { Grid3x3, CheckCircle2, AlertCircle, Clock, RefreshCw, Zap } from 'lucide-react';

interface Block {
    id: string;
    block_name: string;
    block_number?: number;
    acreage?: number;
    expected_images?: number;
    captured_images?: number;
    completion_percent?: number;
    status?: string;
    fault_risk_score?: number;
}

interface Props {
    deploymentId: string;
}

const STATUS_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    completed: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
    in_progress: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400 animate-pulse' },
    pending: { bg: 'bg-slate-800', border: 'border-slate-700', text: 'text-slate-400', dot: 'bg-slate-600' },
    default: { bg: 'bg-slate-800', border: 'border-slate-700', text: 'text-slate-400', dot: 'bg-slate-600' },
};

function blockStatus(block: Block): string {
    if (block.status) return block.status;
    const pct = block.completion_percent ?? 0;
    if (pct >= 100) return 'completed';
    if (pct > 0) return 'in_progress';
    return 'pending';
}

export const SolarBlockMap: React.FC<Props> = ({ deploymentId }) => {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBlocks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get(`/blocks?deploymentId=${deploymentId}`);
            setBlocks(res.data.data || res.data || []);
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Failed to load blocks');
        } finally {
            setLoading(false);
        }
    }, [deploymentId]);

    useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

    if (loading) return (
        <div className="p-8 flex items-center justify-center gap-3 text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin" /> Loading solar blocks...
        </div>
    );
    if (error) return <div className="p-8 text-center text-red-400 text-sm">{error}</div>;
    if (blocks.length === 0) return (
        <div className="p-10 text-center text-slate-500 text-sm">
            <Grid3x3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            No solar blocks defined for this mission.<br />
            <span className="text-xs text-slate-600 mt-1 block">Add blocks via the block management interface.</span>
        </div>
    );

    const completed = blocks.filter(b => blockStatus(b) === 'completed').length;
    const inProgress = blocks.filter(b => blockStatus(b) === 'in_progress').length;
    const pending = blocks.filter(b => blockStatus(b) === 'pending').length;
    const avgPct = blocks.length > 0
        ? Math.round(blocks.reduce((s, b) => s + (b.completion_percent ?? 0), 0) / blocks.length)
        : 0;
    const criticalFaults = blocks.filter(b => (b.fault_risk_score ?? 0) >= 3).length;

    return (
        <div className="p-4 space-y-5">
            {/* Summary Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Total Blocks', value: blocks.length, cls: 'text-white' },
                    { label: 'Completed', value: completed, cls: 'text-emerald-400' },
                    { label: 'In Progress', value: inProgress, cls: 'text-amber-400' },
                    { label: 'Pending', value: pending, cls: 'text-slate-400' },
                    { label: 'Avg Progress', value: `${avgPct}%`, cls: 'text-white' },
                ].map(s => (
                    <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{s.label}</p>
                        <p className={`text-xl font-black ${s.cls}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Overall progress bar */}
            <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Overall Block Completion</span>
                    <span className="font-bold text-white">{avgPct}%</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${avgPct >= 100 ? 'bg-emerald-500' : avgPct > 50 ? 'bg-gradient-to-r from-blue-500 to-emerald-400' : 'bg-gradient-to-r from-blue-600 to-amber-500'
                            }`}
                        style={{ width: `${Math.min(avgPct, 100)}%` }}
                    />
                </div>
            </div>

            {criticalFaults > 0 && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span><strong>{criticalFaults}</strong> block{criticalFaults !== 1 ? 's' : ''} with critical fault risk — check Thermal tab</span>
                </div>
            )}

            {/* Block Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {blocks.map(block => {
                    const status = blockStatus(block);
                    const col = STATUS_COLOR[status] || STATUS_COLOR.default;
                    const pct = block.completion_percent ?? 0;
                    const risk = block.fault_risk_score ?? 0;

                    return (
                        <div
                            key={block.id}
                            className={`${col.bg} border ${col.border} rounded-xl p-4 space-y-2.5 hover:scale-[1.02] transition-transform`}
                        >
                            {/* Block header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                                    <span className="text-sm font-bold text-slate-100">{block.block_name}</span>
                                </div>
                                {risk >= 3 && (
                                    <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20">
                                        ⚡ Risk
                                    </span>
                                )}
                            </div>

                            {/* Progress bar */}
                            <div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${status === 'completed' ? 'bg-emerald-500' :
                                                status === 'in_progress' ? 'bg-amber-400' : 'bg-slate-600'
                                            }`}
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Stats row */}
                            <div className="flex justify-between items-center">
                                <span className={`text-xs font-bold ${col.text} capitalize`}>
                                    {status.replace(/_/g, ' ')}
                                </span>
                                <span className="text-sm font-black text-white">{pct}%</span>
                            </div>

                            {/* Image count if available */}
                            {(block.expected_images != null) && (
                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Zap className="w-3 h-3" />
                                    {block.captured_images ?? 0} / {block.expected_images} images
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 pt-1">
                {[
                    { dot: 'bg-emerald-500', label: 'Completed' },
                    { dot: 'bg-amber-400 animate-pulse', label: 'In Progress' },
                    { dot: 'bg-slate-600', label: 'Pending' },
                ].map(l => (
                    <div key={l.label} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className={`w-2.5 h-2.5 rounded-full ${l.dot}`} />
                        {l.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SolarBlockMap;
