import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, Users, CreditCard, TrendingUp, Search,
    RefreshCw, Download, ChevronUp, ChevronDown,
    CheckCircle, Clock, AlertCircle, Building, Eye, EyeOff,
    Loader2
} from 'lucide-react';
import apiClient from '../services/apiClient';

interface PilotPayRow {
    id: string;
    full_name: string;
    email: string;
    daily_pay_rate: number | null;
    role: string;
    status: string;
    bank_name: string | null;
    account_number: string | null;
    routing_number: string | null;
    account_type: string;
    total_invoiced: number;
    total_paid: number;
    invoice_count: number;
}

type SortKey = 'full_name' | 'daily_pay_rate' | 'total_invoiced' | 'total_paid' | 'outstanding';
type SortDir = 'asc' | 'desc';

export default function PilotPayrollView() {
    const [pilots, setPilots] = useState<PilotPayRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('full_name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [showBanking, setShowBanking] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/invoices/payroll');
            setPilots(res.data.data || []);
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Failed to load payroll data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const sorted = useMemo(() => {
        const filtered = pilots.filter(p =>
            !search ||
            p.full_name.toLowerCase().includes(search.toLowerCase()) ||
            (p.email || '').toLowerCase().includes(search.toLowerCase())
        );
        return [...filtered].sort((a, b) => {
            let av: number | string = 0;
            let bv: number | string = 0;
            if (sortKey === 'full_name') { av = a.full_name; bv = b.full_name; }
            else if (sortKey === 'daily_pay_rate') { av = a.daily_pay_rate ?? 0; bv = b.daily_pay_rate ?? 0; }
            else if (sortKey === 'total_invoiced') { av = Number(a.total_invoiced); bv = Number(b.total_invoiced); }
            else if (sortKey === 'total_paid') { av = Number(a.total_paid); bv = Number(b.total_paid); }
            else if (sortKey === 'outstanding') { av = Number(a.total_invoiced) - Number(a.total_paid); bv = Number(b.total_invoiced) - Number(b.total_paid); }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [pilots, search, sortKey, sortDir]);

    const totals = useMemo(() => ({
        invoiced: pilots.reduce((s, p) => s + Number(p.total_invoiced), 0),
        paid:     pilots.reduce((s, p) => s + Number(p.total_paid), 0),
        outstanding: pilots.reduce((s, p) => s + (Number(p.total_invoiced) - Number(p.total_paid)), 0),
        withBanking: pilots.filter(p => p.bank_name).length,
    }), [pilots]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const exportCSV = () => {
        const header = ['Name', 'Email', 'Role', 'Daily Rate', 'Total Invoiced', 'Total Paid', 'Outstanding', 'Bank', 'Account Type'];
        const rows = sorted.map(p => [
            p.full_name, p.email, p.role,
            p.daily_pay_rate ?? '',
            Number(p.total_invoiced).toFixed(2),
            Number(p.total_paid).toFixed(2),
            (Number(p.total_invoiced) - Number(p.total_paid)).toFixed(2),
            p.bank_name || '',
            p.account_type || '',
        ]);
        const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'pilot_payroll.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const SortIcon = ({ k }: { k: SortKey }) =>
        sortKey === k
            ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
            : <ChevronDown className="w-3 h-3 opacity-20" />;

    const maskAccount = (acct: string | null) =>
        acct ? `••••${acct.slice(-4)}` : '—';

    return (
        <div className="min-h-full bg-slate-950 p-6 space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Pilot Payroll</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Pay rates, banking info, and invoice totals per pilot</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowBanking(s => !s)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${showBanking ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                    >
                        {showBanking ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {showBanking ? 'Hide Banking' : 'Show Banking'}
                    </button>
                    <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all">
                        <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                    <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all disabled:opacity-50">
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Refresh
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Pilots', value: pilots.length.toString(), icon: Users, color: 'sky', sub: `${totals.withBanking} with banking on file` },
                    { label: 'Total Invoiced', value: `$${totals.invoiced.toLocaleString()}`, icon: TrendingUp, color: 'violet', sub: 'all time across all pilots' },
                    { label: 'Total Paid', value: `$${totals.paid.toLocaleString()}`, icon: CheckCircle, color: 'emerald', sub: 'confirmed paid invoices' },
                    { label: 'Outstanding', value: `$${totals.outstanding.toLocaleString()}`, icon: Clock, color: 'amber', sub: 'unpaid balance remaining' },
                ].map(({ label, value, icon: Icon, color, sub }) => (
                    <div key={label} className={`bg-slate-900 border border-slate-700/60 rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center`}>
                                <Icon className={`w-4 h-4 text-${color}-400`} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                        </div>
                        <p className="text-2xl font-black text-white">{value}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search pilots by name or email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                />
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700/60 bg-slate-800/40">
                                <th className="px-4 py-3 text-left">
                                    <button onClick={() => handleSort('full_name')} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300">
                                        Pilot <SortIcon k="full_name" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                    <button onClick={() => handleSort('daily_pay_rate')} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300">
                                        Daily Rate <SortIcon k="daily_pay_rate" />
                                    </button>
                                </th>
                                {showBanking && (
                                    <th className="px-4 py-3 text-left">
                                        <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-widest flex items-center gap-1">
                                            <Building className="w-3 h-3" /> Banking
                                        </span>
                                    </th>
                                )}
                                <th className="px-4 py-3 text-right">
                                    <button onClick={() => handleSort('total_invoiced')} className="flex items-center gap-1 ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300">
                                        Invoiced <SortIcon k="total_invoiced" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-right">
                                    <button onClick={() => handleSort('total_paid')} className="flex items-center gap-1 ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300">
                                        Paid <SortIcon k="total_paid" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-right">
                                    <button onClick={() => handleSort('outstanding')} className="flex items-center gap-1 ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300">
                                        Outstanding <SortIcon k="outstanding" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Invoices</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading && (
                                <tr>
                                    <td colSpan={showBanking ? 7 : 6} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-500">
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            <span className="text-xs">Loading payroll data…</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && sorted.length === 0 && (
                                <tr>
                                    <td colSpan={showBanking ? 7 : 6} className="py-12 text-center text-slate-600 text-sm">
                                        {search ? 'No pilots match your search.' : 'No payroll data found.'}
                                    </td>
                                </tr>
                            )}
                            {!loading && sorted.map(p => {
                                const outstanding = Number(p.total_invoiced) - Number(p.total_paid);
                                const hasBanking = !!p.bank_name;
                                return (
                                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                                        {/* Pilot */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-600/30 to-violet-600/30 border border-sky-500/20 flex items-center justify-center text-xs font-black text-sky-400 flex-shrink-0">
                                                    {p.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-200 text-xs">{p.full_name}</p>
                                                    <p className="text-[10px] text-slate-500">{p.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Daily Rate */}
                                        <td className="px-4 py-3">
                                            {p.daily_pay_rate ? (
                                                <span className="text-emerald-400 font-bold text-xs">
                                                    ${Number(p.daily_pay_rate).toLocaleString()}<span className="text-slate-600 font-normal">/day</span>
                                                </span>
                                            ) : (
                                                <span className="text-slate-600 text-xs">Not set</span>
                                            )}
                                        </td>
                                        {/* Banking */}
                                        {showBanking && (
                                            <td className="px-4 py-3">
                                                {hasBanking ? (
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-300">{p.bank_name}</p>
                                                        <p className="text-[10px] text-slate-500">{p.account_type} · {maskAccount(p.account_number)}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-amber-500/70 font-medium flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> Not on file
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                        {/* Invoiced */}
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-xs font-semibold text-slate-300">
                                                {Number(p.total_invoiced) > 0 ? `$${Number(p.total_invoiced).toLocaleString()}` : '—'}
                                            </span>
                                        </td>
                                        {/* Paid */}
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-xs font-semibold text-emerald-400">
                                                {Number(p.total_paid) > 0 ? `$${Number(p.total_paid).toLocaleString()}` : '—'}
                                            </span>
                                        </td>
                                        {/* Outstanding */}
                                        <td className="px-4 py-3 text-right">
                                            {outstanding > 0 ? (
                                                <span className="text-xs font-bold text-amber-400">
                                                    ${outstanding.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-600">—</span>
                                            )}
                                        </td>
                                        {/* Invoice count */}
                                        <td className="px-4 py-3 text-center">
                                            {Number(p.invoice_count) > 0 ? (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                                                    {p.invoice_count}
                                                </span>
                                            ) : (
                                                <span className="text-slate-700 text-xs">0</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {/* Footer totals */}
                        {!loading && sorted.length > 0 && (
                            <tfoot>
                                <tr className="border-t border-slate-700/60 bg-slate-800/40">
                                    <td className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest" colSpan={showBanking ? 3 : 2}>
                                        {sorted.length} pilot{sorted.length !== 1 ? 's' : ''}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-black text-slate-300">
                                        ${sorted.reduce((s, p) => s + Number(p.total_invoiced), 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-black text-emerald-400">
                                        ${sorted.reduce((s, p) => s + Number(p.total_paid), 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-black text-amber-400">
                                        ${sorted.reduce((s, p) => s + (Number(p.total_invoiced) - Number(p.total_paid)), 0).toLocaleString()}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <p className="text-[10px] text-slate-700 text-center">
                Banking account numbers are masked. Only authorized payroll administrators can access full details.
            </p>
        </div>
    );
}
