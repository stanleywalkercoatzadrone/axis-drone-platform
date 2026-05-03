import React, { useEffect, useState } from 'react';
import { Receipt, RefreshCw } from 'lucide-react';
import apiClient from '../../services/apiClient';

interface VendorExpense {
    id: string;
    vendor_name: string;
    project_name: string;
    inv_status: string;
    inv_date: string;
    invoice_amount: number;
    paid_to_vendor: number;
}

export const VendorExpensesDashboard: React.FC = () => {
    const [expenses, setExpenses] = useState<VendorExpense[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/vendor-expenses');
            setExpenses(res.data?.data || []);
        } catch {
            setExpenses([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const invoiced = expenses.reduce((sum, expense) => sum + Number(expense.invoice_amount || 0), 0);
    const paid = expenses.reduce((sum, expense) => sum + Number(expense.paid_to_vendor || 0), 0);

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Vendor Expenses</h2>
                    <p className="text-sm text-slate-400">Track vendor invoices, payments, and outstanding balances.</p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15" onClick={load}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {[
                    ['Invoices', expenses.length],
                    ['Invoiced', `$${invoiced.toLocaleString()}`],
                    ['Paid', `$${paid.toLocaleString()}`],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-slate-900 p-5">
                        <Receipt className="mb-3 h-5 w-5 text-amber-400" />
                        <div className="text-2xl font-black text-white">{value}</div>
                        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
                    </div>
                ))}
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900">
                {expenses.length === 0 ? (
                    <div className="p-8 text-sm text-slate-500">{loading ? 'Loading vendor expenses...' : 'No vendor expenses found.'}</div>
                ) : expenses.map(expense => (
                    <div key={expense.id} className="grid gap-3 border-b border-white/5 p-4 last:border-0 md:grid-cols-4">
                        <div className="font-semibold text-white">{expense.vendor_name}</div>
                        <div className="text-sm text-slate-300">{expense.project_name}</div>
                        <div className="text-sm text-slate-400">{expense.inv_date ? new Date(expense.inv_date).toLocaleDateString() : 'No date'}</div>
                        <div className="text-right">
                            <div className="font-bold text-white">${Number(expense.invoice_amount || 0).toLocaleString()}</div>
                            <div className="text-xs uppercase text-slate-500">{expense.inv_status || 'Unpaid'}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
