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
}

const InvoiceView = () => {
    const { token } = useParams<{ token: string }>();
    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white shadow-xl rounded-2xl overflow-hidden print:shadow-none">
                    {/* Header */}
                    <div className="bg-slate-900 px-8 py-10 text-white">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-bold">INVOICE</h1>
                                <p className="text-slate-400 mt-1">#{invoice.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-semibold">Axis by CoatzadroneUSA</h2>
                                <p className="text-slate-400 text-sm mt-1">Enterprise Drone Solutions</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 md:p-12 space-y-8">
                        {/* Status Banner for One-Time Link */}
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-blue-900">Secure One-Time View</h4>
                                <p className="text-sm text-blue-700 mt-1">
                                    You are viewing a secure, one-time link for your invoice. Please save or print this page now, as this link will expire.
                                </p>
                            </div>
                        </div>

                        {/* Bill To & Details */}
                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To</h3>
                                <p className="font-bold text-slate-900 text-lg">{invoice.pilot_name}</p>
                                <p className="text-slate-500">{invoice.pilot_email}</p>
                            </div>
                            <div className="text-right">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date Issued</h3>
                                <p className="font-medium text-slate-900">{new Date(invoice.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="border rounded-lg border-slate-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr>
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-slate-900">Mission Payment: {invoice.mission_title}</p>
                                            <p className="text-sm text-slate-500 mt-1">
                                                Site: {invoice.site_name} | Date: {new Date(invoice.mission_date).toLocaleDateString()}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                                            ${Number(invoice.amount).toLocaleString()}
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-200">
                                    <tr>
                                        <td className="px-6 py-4 font-bold text-slate-900 text-right">Total</td>
                                        <td className="px-6 py-4 font-bold text-slate-900 text-right text-lg">
                                            ${Number(invoice.amount).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Footer / Actions */}
                        <div className="flex justify-between items-center pt-8 border-t border-slate-100 print:hidden">
                            <p className="text-slate-500 text-sm">Thank you for your service.</p>
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 transition-colors font-medium"
                            >
                                <Download className="w-4 h-4" /> Download / Print PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceView;
