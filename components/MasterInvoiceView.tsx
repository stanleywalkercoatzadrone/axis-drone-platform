import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../src/services/apiClient';
import { AlertCircle, Printer, Download } from 'lucide-react';

interface MasterInvoiceItem {
    id: string;
    personnel_id: string;
    amount: number;
    pilot_name: string;
    pilot_email: string;
}

interface MasterInvoiceData {
    id: string;
    token: string;
    amount: number;
    status: string;
    created_at: string;
    mission_title: string;
    site_name: string;
    mission_date: string;
    items: MasterInvoiceItem[];
}

const MasterInvoiceView = () => {
    const { token } = useParams<{ token: string }>();
    const [invoice, setInvoice] = useState<MasterInvoiceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const response = await apiClient.get<any>(`/invoices/master/${token}`);
                setInvoice(response.data.data);
            } catch (err: any) {
                console.error('Error fetching master invoice:', err);
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
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Unavailable</h2>
                    <p className="text-gray-500">{error || 'Invoice not found'}</p>
                </div>
            </div>
        );
    }

    const dueDate = new Date(invoice.created_at);
    dueDate.setDate(dueDate.getDate() + 30); // Default Net 30 for Master

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-sm overflow-hidden border border-gray-200 print:shadow-none print:border-0">

                {/* Header */}
                <div className="p-8 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-1">MASTER INVOICE</h1>
                            <p className="text-gray-500 font-medium">#{invoice.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold text-gray-800">Axis Drone Platform</h2>
                            <p className="text-sm text-gray-500 mt-1">Project Consolidation</p>
                        </div>
                    </div>
                </div>

                {/* Bill To / Details */}
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bill To</h3>
                        <div className="text-gray-800 font-medium">
                            <p className="font-bold">CoatzadroneUSA</p>
                            <p>{invoice.site_name}</p>
                            <p>United States</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-right md:text-right">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date</p>
                            <p className="font-medium text-gray-900">{new Date(invoice.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Due Date</p>
                            <p className="font-medium text-gray-900">{dueDate.toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Terms</p>
                            <p className="font-medium text-gray-900">Net 30</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {invoice.status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div className="px-8 pb-8 min-h-[300px]">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Consolidated Pilot Services</h3>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-800">
                                <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Pilot</th>
                                <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Service Description</th>
                                <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {invoice.items.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="py-4 text-sm font-bold text-gray-900">
                                        {item.pilot_name}
                                        <div className="text-xs text-gray-400 font-normal">{item.pilot_email}</div>
                                    </td>
                                    <td className="py-4 text-sm text-gray-600 text-right">
                                        {invoice.mission_title} - {invoice.site_name}
                                    </td>
                                    <td className="py-4 text-sm font-bold text-gray-900 text-right">
                                        ${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div className="bg-gray-50 p-8 border-t border-gray-200">
                    <div className="flex flex-col items-end">
                        <div className="w-full md:w-1/2 lg:w-1/3 space-y-3">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Subtotal</span>
                                <span>${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold text-gray-900 border-t border-gray-300 pt-3">
                                <span>Total</span>
                                <span>${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-200 text-sm text-gray-500">
                    <div className="mt-8 flex justify-center print:hidden">
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-md transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Print / Save as PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="text-center mt-8 text-gray-400 text-xs print:hidden">
                <p>Master Invoice &bull; Consolidated Project Billing</p>
            </div>
        </div>
    );
};

export default MasterInvoiceView;
