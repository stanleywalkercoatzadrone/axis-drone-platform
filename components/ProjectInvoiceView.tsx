import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Deployment, DailyLog, Personnel } from '../types';
import apiClient from '../src/services/apiClient';

interface ProjectInvoiceViewProps {
    deployment: Deployment;
    logs: DailyLog[];
    personnel: Personnel[];
    paymentTerms?: number;
}

const ProjectInvoiceView: React.FC<ProjectInvoiceViewProps> = ({ deployment, logs, personnel, paymentTerms }) => {
    const [paymentDays, setPaymentDays] = useState(paymentTerms || 30);

    useEffect(() => {
        if (paymentTerms) {
            setPaymentDays(paymentTerms);
            return;
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
    }, []);

    // Calculate totals
    const totalAmount = logs.reduce((sum, log) => sum + (log.dailyPay || 0) + (log.bonusPay || 0), 0);

    // Group by service type or just aggregate as one line item since it's a project summary?
    // User asked for "master invoice for project". Usually this means the invoice TO the client.
    // BUT the current context is "Financials & Pay" which tracks PAYOUTS to pilots.
    // However, the "CoatzadroneUSA" row in the tracker usually implies the TOTAL COST or BILLABLE.
    // If this is the "Invoice" to the CLIENT (Site Asset Owner), it should sum up the billables.
    // If it's the "Master Invoice" of what Coatzadrone owes its pilots, then it's a "Payout Report".
    // Given the "Bill To: CoatzadroneUSA" in the individual invoices, Coatzadrone is the PAYER.
    // So a "Master Invoice" for the project might be the invoice FROM Coatzadrone TO the Client?
    // OR it's just a summary of all pilot invoices.
    // The user said "make master invoice for project look like the other invoices".
    // Let's assume it's an aggregation of costs.

    // Let's structure it as an Invoice from "Coatzadrone" (or the pilots collectively?) to "Client" if it was billable?
    // OR more likely, it's the Project Cost Report styled as an invoice.
    // Let's stick to the current data: It shows "CoatzadroneUSA" which seems to be the Tenant/Payer.
    // Let's make it look like an internal Pay sheet or Client Invoice depending on interpretation.
    // Looking at InvoiceView: Bill To: CoatzadroneUSA. Ship To: Coatzadrone.
    // This implies Coatzadrone is paying users.
    // So the Master Invoice is likely the total amount Coatzadrone is paying out.

    const invoiceDate = deployment.date ? new Date(deployment.date).toLocaleDateString() : new Date().toLocaleDateString();

    return (
        <div className="bg-white p-8 md:p-12 print:p-0 border border-slate-200 rounded-lg shadow-sm">
            {/* Top Section: Branding & Project Info */}
            <div className="flex justify-between items-start mb-12">
                <div>
                    <h1 className="text-4xl font-extrabold text-[#0376b1] mb-6 tracking-tight">MASTER INVOICE</h1>
                    <div className="text-slate-800 space-y-1">
                        <p className="text-xl font-bold">{deployment.title}</p>
                        <p className="text-slate-600 whitespace-pre-wrap leading-relaxed max-w-sm">
                            {deployment.siteName}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="w-16 h-16 bg-[#0376b1] flex items-center justify-center rounded-lg shadow-md ml-auto mb-4">
                        <span className="text-white font-black text-2xl">C</span>
                    </div>
                    <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">Project #{deployment.id.slice(0, 8)}</p>
                </div>
            </div>

            {/* Bill To / Ship To Section */}
            <div className="bg-[#f0f7fb] border-y border-slate-100 p-8 mb-12 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                    <h3 className="text-slate-900 font-bold mb-4">Bill to</h3>
                    <div className="text-slate-700 space-y-0.5">
                        <p>CoatzadroneUSA</p>
                        <p>{deployment.siteName}</p>
                        <p>United States</p>
                    </div>
                </div>
                <div>
                    <h3 className="text-slate-900 font-bold mb-4">Project Details</h3>
                    <div className="text-slate-700 space-y-0.5">
                        <p>Status: {deployment.status}</p>
                        <p>Total Personnel: {new Set(logs.map(l => l.technicianId)).size}</p>
                        <p>Total Days: {new Set(logs.map(l => String(l.date).split('T')[0])).size}</p>
                    </div>
                </div>
            </div>

            {/* Invoice Details Block */}
            <div className="mb-12">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-12 gap-y-6 text-slate-700">
                    <div>
                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Invoice details</p>
                        <p className="text-sm font-medium">Ref no.: <span className="text-slate-900 font-bold">{deployment.id.slice(0, 8)}</span></p>
                    </div>
                    <div className="flex flex-col justify-end">
                        {/* Terms using dynamic payment days */}
                        <p className="text-sm font-medium">Terms: <span className="text-slate-900 font-bold">Net {paymentDays}</span></p>
                    </div>
                    <div className="flex flex-col justify-end">
                        <p className="text-sm font-medium">Start date: <span className="text-slate-900 font-bold">{invoiceDate}</span></p>
                    </div>
                    <div className="flex flex-col justify-end">
                        <p className="text-sm font-medium">Due date: <span className="text-slate-900 font-bold">{new Date(new Date(deployment.date || new Date()).setDate(new Date(deployment.date || new Date()).getDate() + paymentDays)).toLocaleDateString()}</span></p>
                    </div>
                </div>
            </div>

            {/* Items Table - Aggregated by Pilot? or just one line item? */}
            {/* Let's aggregate by Pilot to show breakdown */}
            <div className="mb-12">
                <table className="w-full text-left">
                    <thead className="border-b border-slate-100">
                        <tr>
                            <th className="py-4 text-sm font-bold text-slate-600">#</th>
                            <th className="py-4 text-sm font-bold text-slate-600 px-4">Personnel</th>
                            <th className="py-4 text-sm font-bold text-slate-600">Service Description</th>
                            <th className="py-4 text-sm font-bold text-slate-600 text-center">Days</th>
                            <th className="py-4 text-sm font-bold text-slate-600 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {Array.from(new Set(logs.map(l => l.technicianId))).map((techId, index) => {
                            const techLogs = logs.filter(l => l.technicianId === techId);
                            // Need name. logs might not have it if it's just ID. 
                            // DeploymentTracker usually fetches logs with expanded info or we have to find it.
                            // The log object in prop usually has `technician` object if joined, or just ID.
                            // Let's check `types.ts` later properly, but usually we iterate over a summary in parent.
                            // Actually `logs` passed here should ideally be the full log objects.
                            // If `logs` has `technician` (UserAccount), we use it.
                            // Failing that, we successfully used `l.technician.full_name` in DeploymentTracker?
                            // Let's assume logs are populated.

                            // Checking `DeploymentTracker.tsx` in my memory, it calculates costs based on `logs`.
                            // It iterates `deployment.dailyLogs`.
                            // Let's look at `types.ts` or just safe check.

                            const techName = (techLogs[0] as any).technician?.full_name ||
                                (techLogs[0] as any).technician?.fullName ||
                                personnel.find(p => p.id === techId)?.fullName ||
                                'Pilot';
                            const techTotal = techLogs.reduce((sum, l) => sum + (l.dailyPay || 0) + (l.bonusPay || 0), 0);

                            return (
                                <tr key={techId} className="group">
                                    <td className="py-4 text-slate-400">{index + 1}.</td>
                                    <td className="py-4 px-4 font-bold text-slate-900">
                                        <div>{techName}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">
                                            {personnel.find(p => p.id === techId)?.bankName || 'Bank on file'}
                                            <br />
                                            R: {personnel.find(p => p.id === techId)?.routingNumber ? String(personnel.find(p => p.id === techId)?.routingNumber).replace(/\D/g, '') : '••••'} • A: {personnel.find(p => p.id === techId)?.accountNumber ? String(personnel.find(p => p.id === techId)?.accountNumber).replace(/\D/g, '') : '••••'}
                                        </div>
                                    </td>
                                    <td className="py-4 text-slate-500">
                                        Drone Inspection Services
                                        {personnel.find(p => p.id === techId)?.swiftCode && (
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase italic">
                                                SWIFT: {String(personnel.find(p => p.id === techId)?.swiftCode).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4 text-center text-slate-700 font-medium">{techLogs.length}</td>
                                    <td className="py-4 text-right font-bold text-slate-900">
                                        ${techTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="flex justify-end pt-8 border-t border-slate-100">
                    <div className="w-64">
                        <div className="flex justify-between items-center bg-slate-50 p-6 rounded-xl">
                            <span className="text-slate-900 font-bold text-lg">Total</span>
                            <span className="text-3xl font-black text-slate-900">
                                ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ways to pay */}
            <div className="border-t border-slate-100 pt-12 flex flex-col md:flex-row justify-between items-end gap-8">
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
                    <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                        <p className="font-black text-slate-900 mb-3 tracking-tight">CoatzadroneUSA Project Account</p>
                        <div className="space-y-2 text-slate-600 text-sm">
                            <p className="flex justify-between border-b border-slate-200 pb-2">
                                <span>Reference:</span>
                                <span className="font-bold text-slate-900">{deployment.title}</span>
                            </p>
                            <p className="flex justify-between border-b border-slate-200 pb-2">
                                <span>Payment Portal:</span>
                                <span className="font-bold text-[#0376b1]">finance.coatzadroneusa.com</span>
                            </p>
                            <p className="text-slate-400 text-xs mt-4 italic">Individual pilot payouts are processed separately via Axis Direct Deposit.</p>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-xs">Generated automatically by Axis Platform</p>
                </div>
            </div>
        </div>
    );
};

export default ProjectInvoiceView;
