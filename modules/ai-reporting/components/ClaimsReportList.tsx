import React, { useState } from 'react';
import {
    FileText, Search, Filter, Plus, ChevronRight,
    AlertTriangle, CheckCircle2, Clock, Trash2, RefreshCw, Download, Loader2
} from 'lucide-react';
import { ClaimsReport } from '../EnterpriseAIReporting';
import apiClient from '../../../src/services/apiClient';
import { exportReportPDF } from './exportReportPDF';

interface Props {
    reports: ClaimsReport[];
    loading: boolean;
    onSelect: (r: ClaimsReport) => void;
    onNew: () => void;
    onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    DRAFT: { label: 'Draft', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', icon: <Clock className="w-3 h-3" /> },
    FINALIZED: { label: 'Finalized', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
    APPROVED: { label: 'Approved', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
};

const APPROVAL_CONFIG: Record<string, string> = {
    'Pending': 'text-slate-400',
    'Under Review': 'text-yellow-400',
    'Approved': 'text-emerald-400',
    'Rejected': 'text-red-400',
    'Needs Revision': 'text-orange-400',
    'Submitted': 'text-blue-400',
};

const ClaimsReportList: React.FC<Props> = ({ reports, loading, onSelect, onNew, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [downloading, setDownloading] = useState<string | null>(null);

    const filtered = reports.filter(r => {
        const matchSearch = !search ||
            r.title.toLowerCase().includes(search.toLowerCase()) ||
            (r.claimNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.propertyAddress || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.carrier || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'all' || r.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Delete this report? This cannot be undone.')) return;
        setDeleting(id);
        try {
            await apiClient.delete(`/claims-reports/${id}`);
            onRefresh();
        } catch (err) {
            console.error('Delete failed:', err);
        } finally {
            setDeleting(null);
        }
    };

    const handleDownload = async (e: React.MouseEvent, report: ClaimsReport) => {
        e.stopPropagation();
        setDownloading(report.id);
        try {
            // Fetch full report with images/annotations
            const res = await apiClient.get(`/claims-reports/${report.id}`);
            await exportReportPDF(res.data.data);
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setDownloading(null);
        }
    };

    const getRiskColor = (score: number) => {
        if (score >= 75) return 'text-red-400';
        if (score >= 50) return 'text-orange-400';
        if (score >= 25) return 'text-yellow-400';
        return 'text-emerald-400';
    };

    const getRiskBar = (score: number) => {
        if (score >= 75) return 'bg-red-500';
        if (score >= 50) return 'bg-orange-500';
        if (score >= 25) return 'bg-yellow-500';
        return 'bg-emerald-500';
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search reports, claims, addresses..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                    />
                </div>

                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="px-3 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-orange-500/50 transition-all"
                >
                    <option value="all">All Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="FINALIZED">Finalized</option>
                </select>

                <button
                    onClick={onRefresh}
                    className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>

                <button
                    onClick={onNew}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> New Report
                </button>
            </div>

            {/* Table */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/60 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-800/60">
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Report</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Claim #</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Property</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Carrier</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Risk</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Estimate</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Updated</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {[...Array(9)].map((_, j) => (
                                        <td key={j} className="px-4 py-4">
                                            <div className="h-4 bg-slate-800 rounded" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3 text-slate-600">
                                        <FileText className="w-10 h-10 opacity-30" />
                                        <p className="text-sm font-semibold">
                                            {search ? 'No reports match your search' : 'No reports yet'}
                                        </p>
                                        {!search && (
                                            <button onClick={onNew} className="text-xs text-orange-400 hover:text-orange-300 font-bold">
                                                Create your first report →
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : filtered.map(r => {
                            const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.DRAFT;
                            return (
                                <tr
                                    key={r.id}
                                    onClick={() => onSelect(r)}
                                    className="hover:bg-slate-800/30 cursor-pointer transition-all group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1.5 h-8 rounded-full ${getRiskBar(r.riskScore)}`} />
                                            <div>
                                                <p className="text-sm font-bold text-white">{r.title}</p>
                                                <p className="text-xs text-slate-500">{r.inspectionType || 'Post-Loss'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-xs text-slate-400 font-mono">{r.claimNumber || '—'}</td>
                                    <td className="px-4 py-4 text-xs text-slate-400 max-w-[160px] truncate">{r.propertyAddress || '—'}</td>
                                    <td className="px-4 py-4 text-xs text-slate-400">{r.carrier || '—'}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full ${getRiskBar(r.riskScore)} rounded-full`} style={{ width: `${r.riskScore}%` }} />
                                            </div>
                                            <span className={`text-xs font-black ${getRiskColor(r.riskScore)}`}>{r.riskScore}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-xs text-slate-300 font-bold">
                                        {r.totalDamageEstimate > 0
                                            ? `$${r.totalDamageEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border ${statusCfg.color}`}>
                                            {statusCfg.icon} {statusCfg.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-xs text-slate-500">
                                        {new Date(r.updatedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={e => handleDownload(e, r)}
                                                disabled={downloading === r.id}
                                                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition-all"
                                                title="Export PDF"
                                            >
                                                {downloading === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                            </button>
                                            <button
                                                onClick={e => handleDelete(e, r.id)}
                                                disabled={deleting === r.id}
                                                className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                            <ChevronRight className="w-4 h-4 text-slate-500" />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {filtered.length > 0 && (
                <p className="text-xs text-slate-600 text-center">
                    Showing {filtered.length} of {reports.length} reports
                </p>
            )}
        </div>
    );
};

export default ClaimsReportList;
