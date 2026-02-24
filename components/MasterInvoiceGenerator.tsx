import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../src/services/apiClient';
import { CheckCircle, Download, FileText, CheckSquare, Square } from 'lucide-react';

interface InvoiceSummary {
    id: string;
    personnel_id: string;
    pilot_name: string;
    pilot_email: string;
    amount: string;
    status: string;
    created_at: string;
    token: string;
}

const MasterInvoiceGenerator = () => {
    const { deploymentId } = useParams<{ deploymentId: string }>();
    const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [generatedMaster, setGeneratedMaster] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoices = async () => {
            if (!deploymentId) return;
            try {
                const res = await apiClient.get(`/invoices/deployment/${deploymentId}`);
                if (res.data.success) {
                    setInvoices(res.data.data);
                }
            } catch (err: any) {
                console.error('Failed to fetch invoices:', err);
                setError(err.message || 'Failed to load invoices');
            } finally {
                setLoading(false);
            }
        };
        fetchInvoices();
    }, [deploymentId]);

    const toggleSelection = (invoiceId: string) => {
        const newSet = new Set(selectedInvoiceIds);
        if (newSet.has(invoiceId)) newSet.delete(invoiceId);
        else newSet.add(invoiceId);
        setSelectedInvoiceIds(newSet);
    };

    const selectAll = () => {
        if (selectedInvoiceIds.size === invoices.length) {
            setSelectedInvoiceIds(new Set());
        } else {
            setSelectedInvoiceIds(new Set(invoices.map(i => i.id)));
        }
    };

    const handleGenerate = async () => {
        try {
            const res = await apiClient.post('/invoices/master', {
                deploymentId,
                invoiceIds: Array.from(selectedInvoiceIds)
            });
            setGeneratedMaster(res.data.data);
        } catch (err) {
            console.error('Failed to generate master invoice', err);
            alert('Failed to generate master invoice');
        }
    };

    const handleSendToCoatzadrone = async () => {
        if (!deploymentId) return;
        if (!confirm(`Send ${selectedInvoiceIds.size} individual invoices to CoatzadroneUSA?\n(Pilots will NOT be emailed)`)) return;

        try {
            // Bulk send might still need personnel IDs or handles it differently?
            // backend/controllers/invoiceController.js:155: const { personnelIds, sendToPilots = true } = req.body;
            // Yes, bulk send expects personnelIds.
            const pIds = invoices.filter(i => selectedInvoiceIds.has(i.id)).map(i => i.personnel_id);

            const res = await apiClient.post(`/deployments/${deploymentId}/invoices/send`, {
                personnelIds: pIds,
                sendToPilots: false
            });

            if (res.data.emailStatus === 'MOCK') {
                alert('Success (MOCK MODE): Invoices sent to Coatzadrone Admin.');
            } else {
                alert('Success: Individual invoices sent to CoatzadroneUSA.');
            }
        } catch (err: any) {
            console.error('Failed to send invoices:', err);
            alert('Failed to send invoices: ' + (err.response?.data?.message || err.message));
        }
    };

    if (loading) return <div className="p-12 text-center">Loading invoices...</div>;
    if (error) return <div className="p-12 text-center text-red-600">Error: {error}</div>;

    if (generatedMaster) {
        // Render the Master Invoice View (Stitch Design)
        return (
            <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8 font-sans">
                <div className="max-w-4xl mx-auto shadow-2xl border border-slate-100 rounded-lg overflow-hidden">
                    <div className="bg-white p-12 md:p-16 print:p-0">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-16">
                            <div>
                                <h1 className="text-4xl font-extrabold text-[#0376b1] mb-6 tracking-tight">MASTER INVOICE</h1>
                                <div className="text-slate-800 space-y-1">
                                    <p className="text-xl font-bold">CoatzadroneUSA</p>
                                    <p className="text-slate-600 whitespace-pre-wrap leading-relaxed max-w-sm">
                                        aggregated@coatzadroneusa.com
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="w-16 h-16 bg-[#0376b1] flex items-center justify-center rounded-lg shadow-md ml-auto mb-4">
                                    <span className="text-white font-black text-2xl">C</span>
                                </div>
                                <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">Master Ref #{generatedMaster.deployment.id.slice(0, 8)}</p>
                            </div>
                        </div>

                        {/* Bill To */}
                        <div className="bg-[#f0f7fb] border-y border-slate-100 p-10 mb-16 grid grid-cols-1 md:grid-cols-2 gap-16">
                            <div>
                                <h3 className="text-slate-900 font-bold mb-4">Bill to</h3>
                                <div className="text-slate-700 space-y-0.5">
                                    <p>{generatedMaster.deployment.site_name || 'Client Site'}</p>
                                    <p>Attn: Accounts Payable</p>
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

                        {/* Invoice Details */}
                        <div className="mb-16">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-12 gap-y-6 text-slate-700">
                                <div>
                                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Date</p>
                                    <p className="text-sm font-medium"><span className="text-slate-900 font-bold">{new Date().toLocaleDateString()}</span></p>
                                </div>
                                <div className="flex flex-col justify-end">
                                    <p className="text-sm font-medium">Terms: <span className="text-slate-900 font-bold">Net 30</span></p>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="mb-16">
                            <table className="w-full text-left">
                                <thead className="border-b border-slate-100">
                                    <tr>
                                        <th className="py-4 text-sm font-bold text-slate-600">#</th>
                                        <th className="py-4 text-sm font-bold text-slate-600 px-4">Pilot / Service</th>
                                        <th className="py-4 text-sm font-bold text-slate-600">Description</th>
                                        <th className="py-4 text-sm font-bold text-slate-600 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {generatedMaster.invoices.map((inv: any, idx: number) => (
                                        <tr key={inv.id} className="group">
                                            <td className="py-6 text-slate-400">{idx + 1}.</td>
                                            <td className="py-6 px-4 font-bold text-slate-900">
                                                <div>{inv.pilot_name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-1 uppercase">
                                                    {inv.bank_name || 'Bank on file'} • {inv.account_type || 'Checking'}
                                                    <br />
                                                    R: {inv.routing_number ? String(inv.routing_number).replace(/\D/g, '') : '••••'} • A: {inv.account_number ? String(inv.account_number).replace(/\D/g, '') : '••••'}
                                                    {inv.swift_code ? ` • S: ${String(inv.swift_code).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}` : ''}
                                                </div>
                                            </td>
                                            <td className="py-6 text-slate-500">
                                                Drone Services - {generatedMaster.deployment.title}
                                            </td>
                                            <td className="py-6 text-right font-bold text-slate-900">
                                                ${Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* Total */}
                            <div className="flex justify-end pt-8 border-t border-slate-100">
                                <div className="w-64">
                                    <div className="flex justify-between items-center bg-slate-50 p-6 rounded-xl">
                                        <span className="text-slate-900 font-bold text-lg">Total</span>
                                        <span className="text-3xl font-black text-slate-900">
                                            ${Number(generatedMaster.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ways to pay */}
                        <div className="border-t border-slate-100 pt-16 flex flex-col md:flex-row justify-between items-end gap-12 mb-16">
                            <div className="max-w-md w-full">
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
                                <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 text-left">
                                    <p className="font-black text-slate-900 mb-3 tracking-tight">CoatzadroneUSA Aggregated Account</p>
                                    <div className="space-y-2 text-slate-600 text-sm">
                                        <p className="flex justify-between border-b border-slate-200 pb-2">
                                            <span>Master Ref:</span>
                                            <span className="font-bold text-slate-900">{generatedMaster.deployment.id.slice(0, 8)}</span>
                                        </p>
                                        <p className="flex justify-between border-b border-slate-200 pb-2">
                                            <span>Account Type:</span>
                                            <span className="font-bold text-slate-900">Commercial Payout</span>
                                        </p>
                                        <p className="text-slate-400 text-xs mt-4 italic">Individual pilot bank details are securely stored and referenced for internal distribution.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-16 flex justify-end print:hidden gap-4">
                            <button
                                onClick={() => window.print()}
                                className="bg-slate-100 text-slate-700 px-8 py-5 rounded-xl font-bold text-lg hover:bg-slate-200 transition-all flex items-center gap-3"
                            >
                                <Download className="w-6 h-6" />
                                Download PDF
                            </button>
                            <button
                                onClick={() => setGeneratedMaster(null)}
                                className="text-slate-500 hover:text-slate-800 font-bold px-4 py-5"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-[#0376b1] mb-6">Master Invoice Builder</h1>
            <p className="mb-4 text-slate-600">Select pilot invoices to include in the Master Invoice for CoatzadroneUSA.</p>

            <div className="bg-white shadow-sm p-8 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg">Available Invoices</h3>
                    <button onClick={selectAll} className="text-sm text-[#0376b1] font-medium hover:underline">Select All</button>
                </div>

                {invoices.length === 0 ? (
                    <p className="text-slate-400 italic text-center py-8">No invoices found for this deployment. Please generate pilot invoices first.</p>
                ) : (
                    <div className="space-y-3">
                        {invoices.map(inv => (
                            <div key={inv.id}
                                className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all ${selectedInvoiceIds.has(inv.id) ? 'border-[#0376b1] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                                onClick={() => toggleSelection(inv.id)}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center mr-4 ${selectedInvoiceIds.has(inv.id) ? 'bg-[#0376b1] border-[#0376b1]' : 'border-slate-300'}`}>
                                    {selectedInvoiceIds.has(inv.id) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-900">{inv.pilot_name}</span>
                                        <span className="font-bold text-slate-900">${Number(inv.amount).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>Status: {inv.status}</span>
                                        <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4 mt-6">
                <button
                    onClick={handleGenerate}
                    className={`w-full py-4 rounded-xl font-black text-lg shadow-xl flex items-center justify-center gap-3 transition-all ${selectedInvoiceIds.size === 0 ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-[#0376b1] text-white hover:bg-[#025a87] hover:shadow-2xl'}`}
                    disabled={selectedInvoiceIds.size === 0}
                >
                    <FileText className="w-5 h-5" />
                    Generate Master Invoice ({selectedInvoiceIds.size})
                </button>

                <button
                    onClick={handleSendToCoatzadrone}
                    className={`w-full py-4 rounded-xl font-bold text-lg border-2 flex items-center justify-center gap-3 transition-all ${selectedInvoiceIds.size === 0 ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-[#0376b1] text-[#0376b1] hover:bg-blue-50'}`}
                    disabled={selectedInvoiceIds.size === 0}
                >
                    <CheckCircle className="w-5 h-5" />
                    Send Individual Invoices to Coatzadrone ({selectedInvoiceIds.size})
                </button>
            </div>
        </div>
    );
};

export default MasterInvoiceGenerator;
