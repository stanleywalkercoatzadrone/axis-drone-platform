/**
 * PilotChecklistV2.tsx — Pilot Protocol Library (full-page view)
 * Routed from /pilot/checklist via PilotNavV2
 * Shows all active protocols from the library, grouped by category
 */
import React, { useState, useEffect } from 'react';
import {
    BookOpen, ChevronDown, ChevronRight, Shield, CheckCircle,
    AlertTriangle, CheckSquare, Search, Loader2
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

interface ProtocolStep {
    id: string;
    order: number;
    title: string;
    description: string;
    type: 'check' | 'sign' | 'input' | 'photo';
    required: boolean;
}

interface Protocol {
    id: string;
    title: string;
    description: string;
    category: 'pre_flight' | 'mission' | 'post_flight' | 'emergency' | 'general';
    mission_type: string;
    steps: ProtocolStep[];
    version: string;
    is_required: boolean;
    step_count: number;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
    pre_flight:  { label: 'Pre-Flight',  icon: <Shield className="w-3.5 h-3.5" />,       color: 'text-blue-400',    bg: 'bg-blue-900/30',    border: 'border-blue-700/40' },
    mission:     { label: 'Mission',     icon: <CheckSquare className="w-3.5 h-3.5" />,   color: 'text-violet-400',  bg: 'bg-violet-900/30',  border: 'border-violet-700/40' },
    post_flight: { label: 'Post-Flight', icon: <CheckCircle className="w-3.5 h-3.5" />,   color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700/40' },
    emergency:   { label: 'Emergency',   icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-red-400',     bg: 'bg-red-900/30',     border: 'border-red-700/40' },
    general:     { label: 'General',     icon: <BookOpen className="w-3.5 h-3.5" />,      color: 'text-slate-400',   bg: 'bg-slate-800/50',   border: 'border-slate-700/40' },
};

const MISSION_TYPE_LABELS: Record<string, string> = {
    all: 'All Types', solar: '☀️ Solar', insurance: '🏠 Insurance',
    utilities: '⚡ Utilities', telecom: '📡 Telecom', construction: '🏗️ Construction',
};

const STEP_TYPE_LABELS: Record<string, string> = {
    check: '✓ Check', sign: '✍ Sign', input: '📝 Input', photo: '📷 Photo',
};

const ProtocolCard: React.FC<{ protocol: Protocol }> = ({ protocol }) => {
    const [expanded, setExpanded] = useState(false);
    const meta = CATEGORY_META[protocol.category] || CATEGORY_META.general;

    return (
        <div className={`border rounded-xl overflow-hidden transition-all ${expanded ? 'border-slate-600' : 'border-slate-700/60'} bg-slate-900/60`}>
            {/* Header */}
            <div
                className="px-4 py-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.bg} border ${meta.border}`}>
                    <span className={meta.color}>{meta.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                        <span className="text-[10px] text-slate-500">·</span>
                        <span className="text-[10px] text-slate-500">{MISSION_TYPE_LABELS[protocol.mission_type] || protocol.mission_type}</span>
                        {protocol.is_required && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-700/40">Required</span>
                        )}
                        <span className="text-[10px] text-slate-600 ml-auto">v{protocol.version}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-100 leading-tight">{protocol.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{protocol.step_count} steps</p>
                </div>
                {expanded ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />}
            </div>

            {/* Expanded content */}
            {expanded && (
                <div className="border-t border-slate-700/60 bg-slate-950/40 px-4 py-4 space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">{protocol.description}</p>
                    <div className="space-y-2">
                        {(protocol.steps || []).map((step, i) => (
                            <div key={step.id || i} className="flex gap-3 bg-slate-900/60 border border-slate-700/40 rounded-xl px-3 py-2.5">
                                <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {step.order}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <span className="text-xs font-bold text-slate-200">{step.title}</span>
                                        {step.required && <span className="text-[9px] text-red-400 font-bold uppercase">Req</span>}
                                        <span className="text-[9px] text-slate-500 font-medium ml-auto">{STEP_TYPE_LABELS[step.type] || step.type}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function PilotChecklistV2() {
    const [protocols, setProtocols] = useState<Protocol[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');

    useEffect(() => {
        apiClient.get('/protocols')
            .then(r => setProtocols(r.data?.data || []))
            .catch(() => setProtocols([]))
            .finally(() => setLoading(false));
    }, []);

    const filtered = protocols.filter(p => {
        if (filterCat && p.category !== filterCat) return false;
        if (search) {
            const s = search.toLowerCase();
            return p.title.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s);
        }
        return true;
    });

    const grouped = (['pre_flight', 'mission', 'post_flight', 'emergency', 'general'] as const).reduce((acc, cat) => {
        const items = filtered.filter(p => p.category === cat);
        if (items.length) acc[cat] = items;
        return acc;
    }, {} as Record<string, Protocol[]>);

    return (
        <div className="min-h-screen bg-slate-950 pb-32 pt-14 md:pt-0 md:pb-24">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-700 px-5 py-5 shadow-2xl">
                <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Protocol Library</span>
                </div>
                <h1 className="text-xl font-black text-white">Operational Protocols</h1>
                <p className="text-xs text-slate-400 mt-1">
                    {protocols.length} FAA Part 107-aligned SOPs — reference before every operation
                </p>
            </div>

            <div className="px-4 py-5 md:px-6 space-y-5 max-w-3xl">
                {/* Category filter chips */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setFilterCat('')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${!filterCat ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}
                    >All</button>
                    {Object.entries(CATEGORY_META).map(([cat, meta]) => (
                        <button key={cat}
                            onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${filterCat === cat ? `${meta.bg} ${meta.color} ${meta.border}` : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}
                        >
                            {meta.icon}{meta.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search protocols..."
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                </div>

                {/* Protocol groups */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(grouped).map(([cat, items]) => {
                            const meta = CATEGORY_META[cat] || CATEGORY_META.general;
                            return (
                                <div key={cat}>
                                    <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${meta.border}`}>
                                        <span className={meta.color}>{meta.icon}</span>
                                        <h2 className={`text-[10px] font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</h2>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${meta.bg} ${meta.color} border ${meta.border}`}>{items.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {items.map(p => <ProtocolCard key={p.id} protocol={p} />)}
                                    </div>
                                </div>
                            );
                        })}
                        {Object.keys(grouped).length === 0 && (
                            <div className="text-center py-16 text-slate-500">
                                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">No protocols match your search</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
