import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../src/services/apiClient';
import { Download, CheckCircle, AlertCircle, Edit2, Save, X, Loader2 } from 'lucide-react';
import { useAuth } from '../src/context/AuthContext';
import { MAJOR_US_BANKS } from '../src/utils/bankData';
import { isAdmin } from '../src/utils/roleUtils';
import { Button } from '../src/stitch/components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../src/stitch/components/Card';
import { Input } from '../src/stitch/components/Input';
import { Badge } from '../src/stitch/components/Badge';
import { Heading, Text } from '../src/stitch/components/Typography';

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
    swift_code?: string;
    account_type?: string;
    payment_days?: number;
    daily_pay_rate?: number;
}

const InvoiceView = () => {
    const { token } = useParams<{ token: string }>();
    const { user, hasRole } = useAuth();
    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paymentDays, setPaymentDays] = useState(30);
    const [isEditing, setIsEditing] = useState(false);
    const [editedInvoice, setEditedInvoice] = useState<Partial<InvoiceData>>({});
    const [isSaving, setIsSaving] = useState(false);

    const isUserAdmin = isAdmin(user);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const response = await apiClient.get<any>(`/invoices/${token}`);
                const data = response.data.data;
                setInvoice(data);
                setEditedInvoice(data);
                if (data.payment_days) {
                    setPaymentDays(data.payment_days);
                }
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

    const handleRoutingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const routing = e.target.value;
        const bank = MAJOR_US_BANKS.find(b => b.routingNumber === routing);
        setEditedInvoice(prev => ({
            ...prev,
            routing_number: routing,
            bank_name: bank ? bank.name : prev.bank_name
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Send the entire editedInvoice object
            const response = await apiClient.put(`/invoices/${token}`, editedInvoice);
            if (response.data.success) {
                const updated = response.data.data;
                setInvoice(updated);
                setIsEditing(false);
                if (updated.payment_days) {
                    setPaymentDays(updated.payment_days);
                }
            }
        } catch (err: any) {
            console.error('Failed to update invoice:', err);
            alert('Failed to update invoice: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card variant="glass" className="max-w-md w-full p-8 text-center border-red-900/30">
                    <div className="w-16 h-16 bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <Heading level={2} className="text-white mb-2">Invoice Unavailable</Heading>
                    <Text className="text-slate-400">{error}</Text>
                    <Button variant="outline" className="mt-8 border-slate-800" onClick={() => window.history.back()}>Go Back</Button>
                </Card>
            </div>
        );
    }

    if (!invoice) return null;

    return (
        <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-200 animate-in fade-in duration-700">
            <Card variant="glass" className="max-w-4xl mx-auto border-slate-800/50 overflow-hidden printable-invoice shadow-2xl shadow-cyan-950/10">
                <div className="bg-slate-900/40 p-12 md:p-16 print:p-0 print:bg-white print:text-slate-900">
                    {/* Top Section: Branding & Pilot Info */}
                    <div className="flex justify-between items-start mb-16">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-6">
                                <Heading level={1} className="text-4xl font-black text-cyan-500 tracking-widest print:text-slate-900">INVOICE</Heading>
                                {isUserAdmin && !isEditing && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsEditing(true)}
                                        className="text-slate-500 hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-800 print:hidden"
                                        title="Edit Invoice"
                                    >
                                        <Edit2 className="w-5 h-5" />
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Text className="text-xl font-bold text-white print:text-slate-900">{invoice.pilot_name}</Text>
                                {isEditing ? (
                                    <textarea
                                        className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-blue-50/30"
                                        rows={3}
                                        value={editedInvoice.home_address || ''}
                                        onChange={e => setEditedInvoice({ ...editedInvoice, home_address: e.target.value })}
                                        placeholder="Pilot Address"
                                    />
                                ) : (
                                    <p className="text-slate-600 whitespace-pre-wrap leading-relaxed max-w-sm">
                                        {invoice.home_address || 'Address on file (from W-9)'}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="w-16 h-16 bg-cyan-600 flex items-center justify-center rounded-xl shadow-lg shadow-cyan-900/20 ml-auto mb-4 border border-cyan-400/30">
                                <span className="text-white font-black text-3xl">A</span>
                            </div>
                            <Text variant="small" className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.2em]">Auth Ref: {invoice.id.slice(0, 8)}</Text>
                        </div>
                    </div>

                    {/* Bill To / Ship To Section */}
                    <div className="bg-slate-950/50 border-y border-slate-800/50 p-10 mb-16 grid grid-cols-1 md:grid-cols-2 gap-16 print:bg-slate-50 print:border-slate-100">
                        <div>
                            <Text variant="small" className="text-slate-500 font-black uppercase tracking-widest mb-4 block">Bill to</Text>
                            <div className="text-slate-300 space-y-1 print:text-slate-700">
                                <Text className="font-bold text-white print:text-slate-900">Axis Drone Platform</Text>
                                <Text>{invoice.site_name}</Text>
                                <Text>United States Operations</Text>
                            </div>
                        </div>
                        <div>
                            <Text variant="small" className="text-slate-500 font-black uppercase tracking-widest mb-4 block">Ship to</Text>
                            <div className="text-slate-300 space-y-1 print:text-slate-700">
                                <Text className="font-bold text-white print:text-slate-900">Coatzadrone Tech</Text>
                                <Text>501 Reforma - Logistics Central</Text>
                                <Text>96510 Mexico</Text>
                            </div>
                        </div>
                    </div>

                    {/* Invoice Details Block */}
                    <div className="mb-16">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-12 gap-y-6 text-slate-300 print:text-slate-700">
                            <div>
                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Invoice ID</Text>
                                <Text className="text-sm font-bold text-white print:text-slate-900">#{invoice.id.slice(0, 8).toUpperCase()}</Text>
                            </div>
                            <div>
                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Terms</Text>
                                {isEditing ? (
                                    <Input
                                        type="number"
                                        className="h-8 py-0 bg-slate-800/50"
                                        value={editedInvoice.payment_days || 30}
                                        onChange={e => setEditedInvoice({ ...editedInvoice, payment_days: parseInt(e.target.value) })}
                                    />
                                ) : (
                                    <Text className="text-sm font-bold text-white print:text-slate-900">NET {paymentDays}</Text>
                                )}
                            </div>
                            <div>
                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Issue Date</Text>
                                <Text className="text-sm font-bold text-white print:text-slate-900">{new Date(invoice.created_at).toLocaleDateString()}</Text>
                            </div>
                            <div>
                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Due Date</Text>
                                <Text className="text-sm font-bold text-white print:text-slate-900">{new Date(new Date(invoice.created_at).setDate(new Date(invoice.created_at).getDate() + paymentDays)).toLocaleDateString()}</Text>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-16">
                        <table className="w-full text-left">
                            <thead className="border-b border-slate-800 bg-slate-950/30">
                                <tr>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4">#</th>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Service Description</th>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qty</th>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Rate</th>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right pr-4">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                <tr className="group hover:bg-slate-800/20 transition-colors">
                                    <td className="py-8 pl-4 text-slate-600 font-mono text-xs">01</td>
                                    <td className="py-8 px-4">
                                        <Text className="font-bold text-white mb-1">Solar Thermal Analysis & Field Ops</Text>
                                        <Text variant="small" className="text-slate-500">{invoice.mission_title} • {invoice.site_name}</Text>
                                    </td>
                                    <td className="py-8 text-center">
                                        <Text className="text-slate-300 font-bold">
                                            {invoice.daily_pay_rate && Number(invoice.daily_pay_rate) > 0
                                                ? Math.round((Number(invoice.amount) / Number(invoice.daily_pay_rate)) * 100) / 100
                                                : 1}
                                        </Text>
                                    </td>
                                    <td className="py-8 text-right">
                                        {isEditing ? (
                                            <div className="flex items-center justify-end">
                                                <Input
                                                    type="number"
                                                    className="w-28 h-9 bg-slate-800/50 border-slate-700 text-right pr-2"
                                                    value={editedInvoice.daily_pay_rate || 0}
                                                    onChange={e => setEditedInvoice({ ...editedInvoice, daily_pay_rate: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                        ) : (
                                            <Text className="text-slate-300 font-bold">${Number(invoice.daily_pay_rate || invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                        )}
                                    </td>
                                    <td className="py-8 text-right pr-4">
                                        <Text className="font-black text-cyan-400 text-lg">
                                            ${Number(isEditing ? editedInvoice.amount : invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Text>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="flex justify-end pt-12 border-t border-slate-800/50">
                            <div className="w-full max-w-xs">
                                <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 flex justify-between items-center shadow-inner">
                                    <Text className="text-slate-500 font-black uppercase tracking-widest text-xs">Total Amount Due</Text>
                                    <Text className="text-3xl font-black text-white">
                                        ${Number(isEditing ? editedInvoice.amount : invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ways to pay */}
                    <div className="border-t border-slate-800/50 pt-16 flex flex-col md:flex-row justify-between items-end gap-12">
                        <div className="max-w-md w-full">
                            <Heading level={4} className="text-xl font-bold text-cyan-500 mb-6 uppercase tracking-widest">Ways to pay</Heading>
                            <div className="flex gap-4 mb-8">
                                {[
                                    { label: 'VISA', color: 'text-white' },
                                    { label: 'MC', color: 'text-white' },
                                    { label: 'AMEX', color: 'text-white' },
                                    { label: 'ZELLE', color: 'text-white' },
                                    { label: 'PAYPAL', color: 'text-white' }
                                ].map((badge) => (
                                    <div key={badge.label} className="border border-slate-800 px-3 py-1.5 bg-slate-900 rounded-md shadow-inner">
                                        <span className={`text-[10px] font-black italic tracking-tighter ${badge.color}`}>{badge.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-slate-950/80 p-8 rounded-2xl border border-slate-800">
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <Input
                                            className="bg-slate-900/50 border-slate-700"
                                            value={editedInvoice.bank_name || ''}
                                            onChange={e => setEditedInvoice({ ...editedInvoice, bank_name: e.target.value })}
                                            placeholder="Bank Name"
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                className="bg-slate-900/50 border-slate-700"
                                                value={editedInvoice.routing_number || ''}
                                                onChange={handleRoutingChange}
                                                placeholder="Routing Number"
                                            />
                                            <Input
                                                className="bg-slate-900/50 border-slate-700"
                                                value={editedInvoice.account_number || ''}
                                                onChange={e => setEditedInvoice({ ...editedInvoice, account_number: e.target.value })}
                                                placeholder="Account Number"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                className="bg-slate-900/50 border-slate-700"
                                                value={editedInvoice.swift_code || ''}
                                                onChange={e => setEditedInvoice({ ...editedInvoice, swift_code: e.target.value })}
                                                placeholder="SWIFT Code (Optional)"
                                            />
                                            <div className="space-y-1">
                                                <Text variant="small" className="text-[10px] text-slate-500 font-bold uppercase ml-1">Account Type</Text>
                                                <select
                                                    className="w-full p-2 h-10 border border-slate-700 rounded-lg bg-slate-900/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                                    value={editedInvoice.account_type || 'Checking'}
                                                    onChange={e => setEditedInvoice({ ...editedInvoice, account_type: e.target.value })}
                                                >
                                                    <option>Checking</option>
                                                    <option>Savings</option>
                                                    <option>Business</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Text className="font-black text-white mb-2 tracking-tight uppercase">{invoice.bank_name || 'Direct Deposit Enrollment'}</Text>
                                        <div className="space-y-2 text-slate-400 text-sm">
                                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                                <span>Routing number</span>
                                                <span className="font-bold text-white font-mono">{invoice.routing_number ? String(invoice.routing_number).replace(/\D/g, '') : '•••••••••'}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                                <span>Account number</span>
                                                <span className="font-bold text-white font-mono">{invoice.account_number ? String(invoice.account_number).replace(/\D/g, '') : '•••••••••'}</span>
                                            </div>
                                            {invoice.swift_code && (
                                                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                                    <span>SWIFT/BIC</span>
                                                    <span className="font-bold text-white uppercase font-mono">{String(invoice.swift_code).replace(/[^a-zA-Z0-9]/g, '')}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                                <span>Type</span>
                                                <Badge variant="secondary" className="bg-slate-800 border-none px-2 py-0 text-[10px]">{invoice.account_type || 'Checking'}</Badge>
                                            </div>
                                            <Text variant="small" className="text-slate-600 font-medium italic mt-4 block">Secure ACH Transfer Authorization Active</Text>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col items-end print:hidden">
                            {isEditing ? (
                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditedInvoice(invoice);
                                        }}
                                        className="px-10 py-6 border-slate-700 text-slate-400 font-bold hover:bg-slate-900 flex items-center gap-2"
                                    >
                                        <X className="w-5 h-5" /> Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="bg-cyan-600 text-white px-10 py-6 font-bold hover:bg-cyan-500 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 border-none"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        Initialize Settlement
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-end gap-6">
                                    <div className="flex gap-4">
                                        <Button
                                            variant="outline"
                                            onClick={() => window.print()}
                                            className="border-slate-700 text-slate-300 px-8 py-7 rounded-xl font-bold text-lg hover:bg-slate-900 transition-all flex items-center gap-3"
                                        >
                                            <Download className="w-6 h-6" /> Export Document
                                        </Button>
                                        <Button
                                            className="bg-cyan-600 text-white px-12 py-7 rounded-xl font-black text-lg hover:bg-cyan-500 transition-all shadow-xl hover:shadow-cyan-950/50 active:scale-95 flex items-center gap-3 border-none"
                                        >
                                            <CheckCircle className="w-6 h-6" /> Authenticate & Process
                                        </Button>
                                    </div>
                                    <Text variant="small" className="text-slate-500 text-right max-w-[280px] italic">
                                        This provides a secure, single-use encrypted link. Processing requires institutional verification of the above banking details.
                                    </Text>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default InvoiceView;
