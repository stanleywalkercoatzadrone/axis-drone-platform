/**
 * ExpensesView.tsx — Finance Expense Sheet
 * Auto-populated from pilot mission pay + supports CSV upload + manual entries
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    Upload, Download, Plus, Trash2, RefreshCw, FileText, DollarSign,
    ChevronDown, ChevronRight, AlertCircle, CheckCircle, Loader2, X
} from 'lucide-react';
import apiClient from '../services/apiClient';

interface PilotPayRow {
    pilot_id: string;
    pilot_name: string;
    pilot_email: string;
    role: string;
    mission_id: string;
    mission_title: string;
    site_name: string;
    mission_status: string;
    mission_date: string;
    days_logged: number;
    base_pay: number;
    bonus_pay: number;
    total_pay: number;
}

interface ManualExpense {
    id: string;
    category: string;
    description: string;
    amount: number;
    expense_date: string;
    vendor: string | null;
    mission_id: string | null;
    file_name: string | null;
    notes: string | null;
    created_at: string;
}

const CATEGORIES = ['Fuel', 'Lodging', 'Equipment', 'Travel', 'Software', 'Subcontractor', 'Other'];

const statusColor = (s: string) => {
    if (!s) return 'text-slate-400';
    const l = s.toLowerCase();
    if (l.includes('complet') || l.includes('archiv')) return 'text-emerald-400';
    if (l.includes('cancel')) return 'text-slate-500';
    return 'text-amber-400';
};

export default function ExpensesView() {
    const [pilotRows, setPilotRows]       = useState<PilotPayRow[]>([]);
    const [manualRows, setManualRows]     = useState<ManualExpense[]>([]);
    const [loading, setLoading]           = useState(true);
    const [uploading, setUploading]       = useState(false);
    const [uploadResult, setUploadResult] = useState<{ inserted: number; errors: string[] } | null>(null);
    const [showAddForm, setShowAddForm]   = useState(false);
    const [expandedPilot, setExpandedPilot] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'pilot-pay' | 'manual'>('pilot-pay');
    const fileRef = useRef<HTMLInputElement>(null);

    const [newExpense, setNewExpense] = useState({
        category: 'Other', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0],
        vendor: '', notes: ''
    });

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [pp, me] = await Promise.all([
                apiClient.get('/expenses/pilot-summary'),
                apiClient.get('/expenses/manual'),
            ]);
            setPilotRows(pp.data.data || []);
            setManualRows(me.data.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, []);

    // ── Grouped pilot pay by pilot ──────────────────────────────────────────
    const pilotGroups = pilotRows.reduce<Record<string, { name: string; email: string; missions: PilotPayRow[]; total: number }>>((acc, r) => {
        if (!acc[r.pilot_id]) acc[r.pilot_id] = { name: r.pilot_name, email: r.pilot_email, missions: [], total: 0 };
        acc[r.pilot_id].missions.push(r);
        acc[r.pilot_id].total += Number(r.total_pay);
        return acc;
    }, {});

    const totalPilotPay   = pilotRows.reduce((s, r) => s + Number(r.total_pay), 0);
    const totalManual     = manualRows.reduce((s, r) => s + Number(r.amount), 0);
    const grandTotal      = totalPilotPay + totalManual;

    // ── CSV upload ──────────────────────────────────────────────────────────
    const handleCSVUpload = async (file: File) => {
        setUploading(true);
        setUploadResult(null);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await apiClient.post('/expenses/upload-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setUploadResult(res.data);
            if (res.data.inserted > 0) fetchAll();
        } catch (e: any) {
            setUploadResult({ inserted: 0, errors: [e?.response?.data?.error || e.message] });
        } finally { setUploading(false); }
    };

    // ── Export CSV ──────────────────────────────────────────────────────────
    const exportCSV = () => {
        const rows: string[][] = [
            ['Type', 'Pilot / Vendor', 'Mission', 'Site', 'Date', 'Days', 'Base Pay', 'Bonus', 'Total', 'Status', 'Category'],
        ];
        pilotRows.forEach(r => rows.push([
            'Pilot Pay', r.pilot_name, r.mission_title, r.site_name,
            String(r.mission_date).split('T')[0], String(r.days_logged),
            String(r.base_pay), String(r.bonus_pay), String(r.total_pay), r.mission_status, 'Labor'
        ]));
        manualRows.forEach(r => rows.push([
            'Expense', r.vendor || '', '', '', r.expense_date, '',
            '', '', String(r.amount), '', r.category
        ]));
        rows.push(['', '', '', '', '', '', '', 'TOTAL', String(grandTotal.toFixed(2)), '', '']);

        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `axis-expense-sheet-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // ── Add manual expense ──────────────────────────────────────────────────
    const handleAddExpense = async () => {
        if (!newExpense.description || !newExpense.amount) return;
        try {
            await apiClient.post('/expenses/manual', {
                ...newExpense, amount: parseFloat(newExpense.amount)
            });
            setShowAddForm(false);
            setNewExpense({ category: 'Other', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], vendor: '', notes: '' });
            fetchAll();
        } catch (e) { console.error(e); }
    };

    const handleDeleteManual = async (id: string) => {
        if (!confirm('Delete this expense?')) return;
        await apiClient.delete(`/expenses/manual/${id}`);
        fetchAll();
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading expense data…
        </div>
    );

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-white uppercase tracking-tight">Expense Sheet</h1>
                    <p className="text-xs text-slate-400 mt-0.5">Auto-populated from mission pilot pay · Upload expense sheets (CSV or Excel)</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-white/10 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-colors">
                        <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                    <label className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-500 transition-colors cursor-pointer">
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Upload Expense Sheet
                        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && handleCSVUpload(e.target.files[0])} />
                    </label>
                    <button onClick={() => setShowAddForm(v => !v)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add Expense
                    </button>
                </div>
            </div>

            {/* ── Upload result banner ── */}
            {uploadResult && (
                <div className={`flex items-start gap-3 p-4 rounded-xl border ${uploadResult.inserted > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    {uploadResult.inserted > 0
                        ? <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        : <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                    <div className="flex-1 text-xs">
                        {uploadResult.inserted > 0 && <p className="font-bold text-emerald-400 mb-1">{uploadResult.inserted} expense row(s) imported successfully.</p>}
                        {uploadResult.errors.map((e, i) => <p key={i} className="text-red-400">{e}</p>)}
                    </div>
                    <button onClick={() => setUploadResult(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* ── Summary cards ── */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Pilot Pay (All Missions)', value: totalPilotPay, color: 'text-amber-400', icon: <DollarSign className="w-4 h-4" />, bg: 'bg-amber-500/10 border-amber-500/20' },
                    { label: 'Other Expenses',           value: totalManual,   color: 'text-blue-400',  icon: <FileText className="w-4 h-4" />,   bg: 'bg-blue-500/10 border-blue-500/20' },
                    { label: 'Grand Total',              value: grandTotal,    color: 'text-white',     icon: <DollarSign className="w-4 h-4" />, bg: 'bg-white/5 border-white/10' },
                ].map(card => (
                    <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
                        <div className={`flex items-center gap-2 mb-2 ${card.color}`}>{card.icon}<span className="text-[10px] font-black uppercase tracking-widest">{card.label}</span></div>
                        <div className={`text-2xl font-black ${card.color}`}>${Number(card.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </div>
                ))}
            </div>

            {/* ── Add expense form ── */}
            {showAddForm && (
                <div className="bg-slate-800 border border-white/10 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white">Add Manual Expense</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                            <select value={newExpense.category} onChange={e => setNewExpense(p => ({ ...p, category: e.target.value }))} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Description *</label>
                            <input value={newExpense.description} onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Hotel — Site A" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Amount ($) *</label>
                            <input type="number" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Date</label>
                            <input type="date" value={newExpense.expense_date} onChange={e => setNewExpense(p => ({ ...p, expense_date: e.target.value }))} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Vendor</label>
                            <input value={newExpense.vendor} onChange={e => setNewExpense(p => ({ ...p, vendor: e.target.value }))} placeholder="Vendor name" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Notes</label>
                            <input value={newExpense.notes} onChange={e => setNewExpense(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleAddExpense} className="px-6 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-colors">Save Expense</button>
                    </div>
                </div>
            )}

            {/* ── Section tabs ── */}
            <div className="flex gap-1 bg-slate-800/60 p-1 rounded-xl w-fit border border-white/10">
                {(['pilot-pay', 'manual'] as const).map(s => (
                    <button key={s} onClick={() => setActiveSection(s)} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeSection === s ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                        {s === 'pilot-pay' ? `Pilot Pay (${Object.keys(pilotGroups).length} pilots)` : `Other Expenses (${manualRows.length})`}
                    </button>
                ))}
            </div>

            {/* ── Pilot Pay Section ── */}
            {activeSection === 'pilot-pay' && (
                <div className="bg-slate-800/40 border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10 bg-amber-500/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Auto-populated from Mission Daily Logs</span>
                        </div>
                        <span className="text-xs text-slate-400">{pilotRows.length} log entries across {Object.keys(pilotGroups).length} pilots</span>
                    </div>
                    {Object.keys(pilotGroups).length === 0 ? (
                        <div className="p-12 text-center text-slate-500 text-sm">No daily logs recorded yet. Log daily pay in any mission's Finance tab to see data here.</div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {Object.entries(pilotGroups).map(([pilotId, group]) => {
                                const isOpen = expandedPilot === pilotId;
                                return (
                                    <div key={pilotId}>
                                        {/* Pilot row */}
                                        <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors" onClick={() => setExpandedPilot(isOpen ? null : pilotId)}>
                                            <div className="flex items-center gap-3">
                                                <div className={`transition-transform ${isOpen ? 'rotate-90' : ''} text-slate-400`}><ChevronRight className="w-4 h-4" /></div>
                                                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-sm">
                                                    {group.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{group.name}</p>
                                                    <p className="text-xs text-slate-500">{group.email} · {group.missions.length} mission(s)</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-amber-400">${Number(group.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Earned</p>
                                            </div>
                                        </div>
                                        {/* Mission breakdown */}
                                        {isOpen && (
                                            <div className="bg-slate-900/50 px-5 pb-4">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="text-slate-500 uppercase tracking-wider border-b border-white/5">
                                                            <th className="text-left py-2 pr-4">Mission</th>
                                                            <th className="text-left py-2 pr-4">Site</th>
                                                            <th className="text-left py-2 pr-4">Date</th>
                                                            <th className="text-left py-2 pr-4">Status</th>
                                                            <th className="text-right py-2 pr-4">Days</th>
                                                            <th className="text-right py-2 pr-4">Base</th>
                                                            <th className="text-right py-2 pr-4">Bonus</th>
                                                            <th className="text-right py-2">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {group.missions.map(m => (
                                                            <tr key={m.mission_id} className="text-slate-300">
                                                                <td className="py-2 pr-4 font-medium">{m.mission_title}</td>
                                                                <td className="py-2 pr-4 text-slate-400">{m.site_name}</td>
                                                                <td className="py-2 pr-4 font-mono text-slate-400">{String(m.mission_date).split('T')[0]}</td>
                                                                <td className={`py-2 pr-4 font-bold ${statusColor(m.mission_status)}`}>{m.mission_status}</td>
                                                                <td className="py-2 pr-4 text-right">{m.days_logged}</td>
                                                                <td className="py-2 pr-4 text-right">${Number(m.base_pay).toLocaleString()}</td>
                                                                <td className="py-2 pr-4 text-right text-emerald-400">{Number(m.bonus_pay) > 0 ? `+$${Number(m.bonus_pay).toLocaleString()}` : '—'}</td>
                                                                <td className="py-2 text-right font-black text-amber-400">${Number(m.total_pay).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="border-t border-white/10 font-black text-white">
                                                            <td colSpan={7} className="py-2 text-right text-xs uppercase tracking-widest text-slate-400">Pilot Total</td>
                                                            <td className="py-2 text-right text-amber-400">${Number(group.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {/* Footer total */}
                    <div className="px-5 py-3 border-t border-white/10 bg-amber-500/5 flex justify-between items-center">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Pilot Labor Cost</span>
                        <span className="text-xl font-black text-amber-400">${totalPilotPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            )}

            {/* ── Manual Expenses Section ── */}
            {activeSection === 'manual' && (
                <div className="bg-slate-800/40 border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                        <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Manual & Uploaded Expenses</span>
                        <span className="text-xs text-slate-400">{manualRows.length} entries</span>
                    </div>
                    {manualRows.length === 0 ? (
                        <div className="p-12 text-center space-y-3">
                            <Upload className="w-8 h-8 text-slate-600 mx-auto" />
                            <p className="text-slate-500 text-sm">No manual expenses yet.</p>
                            <p className="text-slate-600 text-xs">Upload a CSV or click "Add Expense" to get started.</p>
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900/50">
                                <tr className="text-slate-500 uppercase tracking-wider">
                                    <th className="text-left px-5 py-3">Category</th>
                                    <th className="text-left px-4 py-3">Description</th>
                                    <th className="text-left px-4 py-3">Vendor</th>
                                    <th className="text-left px-4 py-3">Date</th>
                                    <th className="text-left px-4 py-3">Source</th>
                                    <th className="text-right px-4 py-3">Amount</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {manualRows.map(r => (
                                    <tr key={r.id} className="text-slate-300 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-3">
                                            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 text-[10px] font-bold">{r.category}</span>
                                        </td>
                                        <td className="px-4 py-3 font-medium">{r.description}</td>
                                        <td className="px-4 py-3 text-slate-400">{r.vendor || '—'}</td>
                                        <td className="px-4 py-3 font-mono text-slate-400">{r.expense_date}</td>
                                        <td className="px-4 py-3 text-slate-500 italic">{r.file_name ? `📄 ${r.file_name}` : 'Manual'}</td>
                                        <td className="px-4 py-3 text-right font-black text-white">${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => handleDeleteManual(r.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors rounded">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-white/10 bg-blue-500/5">
                                    <td colSpan={5} className="px-5 py-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Total Other Expenses</td>
                                    <td className="px-4 py-3 text-right text-xl font-black text-blue-400">${totalManual.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            )}

            {/* ── Upload Format Guide ── */}
            <div className="bg-slate-800/30 border border-white/5 rounded-xl p-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Upload Format — CSV or Excel (.xlsx)</p>
                <p className="text-xs text-slate-500">Both CSV and Excel files are accepted. Include a header row with these columns (order flexible):</p>
                <code className="block mt-2 text-[11px] text-amber-400/80 font-mono bg-slate-900/50 px-3 py-2 rounded-lg">
                    category, description, amount, date, vendor
                </code>
                <p className="text-[11px] text-slate-600 mt-1">Column names are flexible — e.g. "cost", "total", "price" → amount. "type" → category. Excel column headers are matched the same way.</p>
            </div>
        </div>
    );
}
