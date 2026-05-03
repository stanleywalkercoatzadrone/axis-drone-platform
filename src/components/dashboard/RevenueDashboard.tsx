import React, { useEffect, useState } from 'react';
import { DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import apiClient from '../../services/apiClient';

interface RevenueRow {
    id: string;
    tenant_name?: string;
    amount?: number;
    status?: string;
    created_at?: string;
}

export const RevenueDashboard: React.FC = () => {
    const [rows, setRows] = useState<RevenueRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/subscription-invoices');
            setRows(res.data?.data || []);
        } catch {
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const paid = rows.filter(row => String(row.status).toLowerCase() === 'paid')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Revenue</h2>
                    <p className="text-sm text-slate-400">Subscription billing and collected revenue.</p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15" onClick={load}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-slate-900 p-5">
                    <DollarSign className="mb-3 h-5 w-5 text-emerald-400" />
                    <div className="text-2xl font-black text-white">${total.toLocaleString()}</div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">Total invoiced</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900 p-5">
                    <TrendingUp className="mb-3 h-5 w-5 text-sky-400" />
                    <div className="text-2xl font-black text-white">${paid.toLocaleString()}</div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">Paid revenue</div>
                </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900">
                {rows.length === 0 ? (
                    <div className="p-8 text-sm text-slate-500">{loading ? 'Loading revenue...' : 'No revenue records found.'}</div>
                ) : rows.map(row => (
                    <div key={row.id} className="flex items-center justify-between border-b border-white/5 p-4 last:border-0">
                        <div>
                            <div className="font-semibold text-white">{row.tenant_name || 'Tenant'}</div>
                            <div className="text-xs text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleDateString() : 'No date'}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-white">${Number(row.amount || 0).toLocaleString()}</div>
                            <div className="text-xs uppercase text-slate-500">{row.status || 'draft'}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
