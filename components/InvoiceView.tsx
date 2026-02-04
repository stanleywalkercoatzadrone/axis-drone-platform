import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../src/services/apiClient';
import { Download, CheckCircle, AlertCircle } from 'lucide-react';

interface InvoiceData {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    mission_title: string;
    site_name: string;
    mission_date: string;
    pilot_name: string;
    pilot_email: string;
    token_used: boolean;
    home_address?: string;
    bank_name?: string;
    routing_number?: string;
    account_number?: string;
}

const InvoiceView = () => {
    const { token } = useParams<{ token: string }>();
    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paymentDays, setPaymentDays] = useState(30);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const response = await apiClient.get<any>(`/invoices/${token}`);
                setInvoice(response.data.data);
            } catch (err: any) {
                console.error('Error fetching invoice:', err);
                setError(err.response?.data?.message || err.message || 'Failed to load invoice');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchInvoice();
        }

        // Fetch payment terms setting
        apiClient.get('/system/settings').then(res => {
            if (res.data.success) {
                const settings = res.data.data;
                if (settings.invoice_payment_days) {
                    setPaymentDays(parseInt(settings.invoice_payment_days));
                }
            }
        }).catch(err => console.error('Failed to fetch payment terms:', err));
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Invoice Unavailable</h2>
                    <p className="text-slate-500">{error}</p>
                </div>
            </div>
        );
    }

    if (!invoice) return null;

    return (
        <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto shadow-2xl border border-slate-100 rounded-lg overflow-hidden">
                <div className="bg-white p-12 md:p-16 print:p-0">
                    {/* Top Section: Branding & Pilot Info */}
                    <div className="flex justify-between items-start mb-16">
                        <div>
                            <h1 className="text-4xl font-extrabold text-[#0376b1] mb-6 tracking-tight">INVOICE</h1>
                            <div className="text-slate-800 space-y-1">
                                <p className="text-xl font-bold">{invoice.pilot_name}</p>
                                <p className="text-slate-600 whitespace-pre-wrap leading-relaxed max-w-sm">
                                    {invoice.home_address || 'Address on file (from W-9)'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="w-16 h-16 bg-[#0376b1] flex items-center justify-center rounded-lg shadow-md ml-auto mb-4">
                                <span className="text-white font-black text-2xl">C</span>
                            </div>
                            <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">Digital Auth #{invoice.id.slice(0, 8)}</p>
                        </div>
                    </div>

                    {/* Bill To / Ship To Section (Light Blue Box) */}
                    <div className="bg-[#f0f7fb] border-y border-slate-100 p-10 mb-16 grid grid-cols-1 md:grid-cols-2 gap-16">
                        <div>
                            <h3 className="text-slate-900 font-bold mb-4">Bill to</h3>
                            <div className="text-slate-700 space-y-0.5">
                                <p>CoatzadroneUSA</p>
                                <p>{invoice.site_name}</p>
                                <p>United States</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-slate-900 font-bold mb-4">Ship to</h3>
                            <div className="text-slate-700 space-y-0.5">
                                <p>Coatzadrone</p>
                                <p>501 Reforma</p>
                                <p>96510 Coatzacoalcos Mexico</p>
                            </div>
                        </div>
                    </div>

                    {/* Invoice Details Block */}
                    <div className="mb-16">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-12 gap-y-6 text-slate-700">
                            <div>
                                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Invoice details</p>
                                <p className="text-sm font-medium">Invoice no.: <span className="text-slate-900 font-bold">{invoice.id.slice(0, 4)}</span></p>
                            </div>
                            <div className="flex flex-col justify-end">
                                <p className="text-sm font-medium">Terms: <span className="text-slate-900 font-bold">Net {paymentDays}</span></p>
                            </div>
                            <div className="flex flex-col justify-end">
                                <p className="text-sm font-medium">Invoice date: <span className="text-slate-900 font-bold">{new Date(invoice.created_at).toLocaleDateString()}</span></p>
                            </div>
                            <div className="flex flex-col justify-end">
                                <p className="text-sm font-medium">Due date: <span className="text-slate-900 font-bold">{new Date(new Date(invoice.created_at).setDate(new Date(invoice.created_at).getDate() + paymentDays)).toLocaleDateString()}</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-16">
                        <table className="w-full text-left">
                            <thead className="border-b border-slate-100">
                                <tr>
                                    <th className="py-4 text-sm font-bold text-slate-600">#</th>
                                    <th className="py-4 text-sm font-bold text-slate-600 px-4">Product or service</th>
                                    <th className="py-4 text-sm font-bold text-slate-600">Description</th>
                                    <th className="py-4 text-sm font-bold text-slate-600 text-center">Qty</th>
                                    <th className="py-4 text-sm font-bold text-slate-600 text-right">Rate</th>
                                    <th className="py-4 text-sm font-bold text-slate-600 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                <tr className="group">
                                    <td className="py-6 text-slate-400">1.</td>
                                    <td className="py-6 px-4 font-bold text-slate-900 whitespace-nowrap">
                                        Solar thermal handheld scans
                                    </td>
                                    <td className="py-6 text-slate-500 max-w-[240px]">
                                        {invoice.mission_title} - {invoice.site_name} (Deployment Service)
                                    </td>
                                    <td className="py-6 text-center text-slate-700 font-medium">1</td>
                                    <td className="py-6 text-right text-slate-700 font-medium">
                                        ${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-6 text-right font-bold text-slate-900">
                                        ${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="flex justify-end pt-8 border-t border-slate-100">
                            <div className="w-64">
                                <div className="flex justify-between items-center bg-slate-50 p-6 rounded-xl">
                                    <span className="text-slate-900 font-bold text-lg">Total</span>
                                    <span className="text-3xl font-black text-slate-900">
                                        ${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ways to pay */}
                    <div className="border-t border-slate-100 pt-16 flex flex-col md:flex-row justify-between items-end gap-12">
                        <div className="max-w-md">
                            <h4 className="text-xl font-bold text-[#0376b1] mb-6">Ways to pay</h4>
                            <div className="flex gap-4 mb-8">
                                {[
                                    { label: 'VISA', color: 'text-blue-800' },
                                    { label: 'MC', color: 'text-red-600' },
                                    { label: 'AMEX', color: 'text-blue-500' },
                                    { label: 'VENMO', color: 'text-[#3d95ce]' },
                                    { label: 'PAYPAL', color: 'text-blue-900' }
                                ].map((badge) => (
                                    <div key={badge.label} className="border border-slate-200 px-3 py-1 bg-white rounded-md shadow-sm">
                                        <span className={`text-[10px] font-black italic tracking-tighter ${badge.color}`}>{badge.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                                <p className="font-black text-slate-900 mb-3 tracking-tight">{invoice.bank_name || 'Bank Account on file'}</p>
                                <div className="space-y-2 text-slate-600 text-sm">
                                    <p className="flex justify-between border-b border-slate-200 pb-2">
                                        <span>Routing number:</span>
                                        <span className="font-bold text-slate-900">{invoice.routing_number || '•••••••••'}</span>
                                    </p>
                                    <p className="flex justify-between border-b border-slate-200 pb-2">
                                        <span>Account number:</span>
                                        <span className="font-bold text-slate-900">{invoice.account_number || '•••••••••'}</span>
                                    </p>
                                    <p className="text-slate-400 text-xs mt-4">Calculated from Direct Deposit Authorization</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end print:hidden">
                            <button
                                onClick={() => window.print()}
                                className="bg-[#0376b1] text-white px-12 py-5 rounded-xl font-black text-lg hover:bg-[#025a87] transition-all shadow-xl hover:shadow-2xl active:scale-95 flex items-center gap-3"
                            >
                                <CheckCircle className="w-6 h-6" />
                                View and pay
                            </button>
                            <p className="mt-4 text-slate-400 text-xs text-right max-w-[200px]">
                                This secure link allows one-time viewing of your invoice. Please save a copy for your records.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceView;
