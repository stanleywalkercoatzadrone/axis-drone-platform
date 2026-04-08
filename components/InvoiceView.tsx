import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../src/services/apiClient';
import { Download, CheckCircle, AlertCircle, Edit2, Save, X, Loader2, Copy, Check } from 'lucide-react';
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
    days_worked?: number;
    service_description?: string;
}

// Inline editable field component
const EditableField: React.FC<{
    label: string;
    value: string;
    isEditing: boolean;
    onChange: (val: string) => void;
    type?: 'text' | 'number' | 'textarea' | 'select';
    options?: string[];
    className?: string;
    inputClassName?: string;
}> = ({ label, value, isEditing, onChange, type = 'text', options, className = '', inputClassName = '' }) => {
    if (!isEditing) return null;
    if (type === 'textarea') {
        return (
            <div className={`mt-1 ${className}`}>
                <textarea
                    className={`w-full p-2 border border-cyan-700 rounded-lg text-sm bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 resize-none ${inputClassName}`}
                    rows={3}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={label}
                />
            </div>
        );
    }
    if (type === 'select' && options) {
        return (
            <select
                className={`w-full p-2 h-10 border border-cyan-700 rounded-lg bg-slate-800/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 mt-1 ${inputClassName}`}
                value={value}
                onChange={e => onChange(e.target.value)}
            >
                {options.map(o => <option key={o}>{o}</option>)}
            </select>
        );
    }
    return (
        <input
            type={type}
            className={`w-full p-2 border border-cyan-700 rounded-lg text-sm bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 mt-1 ${inputClassName}`}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={label}
        />
    );
};

// Copy button component
const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition-colors ml-2 focus:outline-none"
            title={`Copy ${label || value}`}
        >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied && <span className="text-xs text-emerald-400 font-bold">Copied</span>}
        </button>
    );
};

const InvoiceView = () => {
    const { token } = useParams<{ token: string }>();
    const { user } = useAuth();
    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(() => {
        return new URLSearchParams(window.location.search).get('edit') === 'true';
    });
    const [editedInvoice, setEditedInvoice] = useState<Partial<InvoiceData>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const response = await apiClient.get<any>(`/invoices/${token}`);
                const data = response.data.data;
                setInvoice(data);
                setEditedInvoice(data);
            } catch (err: any) {
                setError(err.response?.data?.message || err.message || 'Failed to load invoice');
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchInvoice();
    }, [token]);

    const handleRoutingChange = (routing: string) => {
        const bank = MAJOR_US_BANKS.find(b => b.routingNumber === routing);
        setEditedInvoice(prev => ({
            ...prev,
            routing_number: routing,
            bank_name: bank ? bank.name : prev.bank_name,
            swift_code: bank ? (bank as any).swiftCode : prev.swift_code
        }));
    };

    const field = (key: keyof InvoiceData) =>
        isEditing ? (editedInvoice[key] as string ?? '') : (invoice?.[key] as string ?? '');

    const numField = (key: keyof InvoiceData) =>
        isEditing ? (editedInvoice[key] as number ?? 0) : (invoice?.[key] as number ?? 0);

    const set = (key: keyof InvoiceData) => (val: string) =>
        setEditedInvoice(prev => ({ ...prev, [key]: val }));

    const setNum = (key: keyof InvoiceData) => (val: string) =>
        setEditedInvoice(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await apiClient.put(`/invoices/${token}`, editedInvoice);
            if (response.data.success) {
                setInvoice(response.data.data);
                setIsEditing(false);
            }
        } catch (err: any) {
            console.error('Failed to save invoice', err);
            const errMsg = err.response?.data?.error || err.response?.data?.message || err.message;
            alert('Failed to save: ' + errMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const paymentDays = numField('payment_days') || 30;
    const amount = numField('amount');
    const dailyRate = numField('daily_pay_rate');
    const daysWorked = numField('days_worked') || (dailyRate > 0 ? Math.round(amount / dailyRate) : 1);

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
        </div>
    );

    if (error) return (
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

    if (!invoice) return null;

    const bankInfo = {
        routing: field('routing_number'),
        account: field('account_number'),
        bankName: field('bank_name'),
        swift: field('swift_code'),
        accountType: field('account_type') || 'Checking',
    };

    return (
        <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-200 animate-in fade-in duration-700">
            <Card variant="glass" className="max-w-4xl mx-auto border-slate-800/50 overflow-hidden printable-invoice shadow-2xl shadow-cyan-950/10">
                <div className="bg-slate-900/40 p-12 md:p-16 print:p-0 print:bg-white print:text-slate-900">

                    {/* ── Header + Edit Toggle ── */}
                    <div className="flex justify-between items-start mb-16">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-6">
                                <Heading level={1} className="text-4xl font-black text-cyan-500 tracking-widest print:text-slate-900">INVOICE</Heading>
                                {!isEditing && (
                                    <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}
                                        className="text-slate-500 hover:text-cyan-400 rounded-lg hover:bg-slate-800 print:hidden" title="Edit Invoice">
                                        <Edit2 className="w-5 h-5" />
                                    </Button>
                                )}
                                {isEditing && (
                                    <span className="text-xs font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-800 px-3 py-1 rounded-full animate-pulse">
                                        EDIT MODE
                                    </span>
                                )}
                            </div>

                            {/* Pilot name (editable) */}
                            <div className="space-y-1">
                                {isEditing ? (
                                    <input
                                        className="text-xl font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/30 shadow-sm"
                                        value={field('pilot_name')}
                                        onChange={e => set('pilot_name')(e.target.value)}
                                        placeholder="Pilot Name"
                                    />
                                ) : (
                                    <Text className="text-xl font-bold text-white print:text-slate-900">{invoice.pilot_name}</Text>
                                )}

                                {/* Pilot address (editable) */}
                                {isEditing ? (
                                    <textarea
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 resize-none mt-1 shadow-sm"
                                        rows={3}
                                        value={field('home_address')}
                                        onChange={e => set('home_address')(e.target.value)}
                                        placeholder="Pilot Address"
                                    />
                                ) : (
                                    <p className="text-slate-400 whitespace-pre-wrap leading-relaxed max-w-sm">
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

                    {/* ── Bill To / Site Section ── */}
                    <div className="bg-slate-950/50 border-y border-slate-800/50 p-10 mb-16 grid grid-cols-1 md:grid-cols-2 gap-16 print:bg-slate-50 print:border-slate-100">
                        <div>
                            <Text variant="small" className="text-slate-500 font-black uppercase tracking-widest mb-4 block">Bill to</Text>
                            <div className="text-slate-300 space-y-1 print:text-slate-700">
                                <Text className="font-bold text-white print:text-slate-900">CoatzadroneUSA</Text>
                                {isEditing ? (
                                    <>
                                        <input className="w-full p-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900 focus:outline-none mt-1 shadow-sm"
                                            value={field('site_name')} onChange={e => set('site_name')(e.target.value)} placeholder="Site Name" />
                                    </>
                                ) : (
                                    <Text>{invoice.site_name}</Text>
                                )}
                                <Text>United States Operations</Text>
                            </div>
                        </div>
                        <div>
                            <Text variant="small" className="text-slate-500 font-black uppercase tracking-widest mb-4 block">Mission</Text>
                            <div className="text-slate-300 space-y-1 print:text-slate-700">
                                {isEditing ? (
                                    <>
                                        <input className="w-full p-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900 focus:outline-none shadow-sm"
                                            value={field('mission_title')} onChange={e => set('mission_title')(e.target.value)} placeholder="Mission Title" />
                                    </>
                                ) : (
                                    <Text className="font-bold text-white">{invoice.mission_title}</Text>
                                )}
                                <Text>
                                    {invoice.mission_date ? new Date(invoice.mission_date).toLocaleDateString() : 'On file'}
                                </Text>
                            </div>
                        </div>
                    </div>

                    {/* ── Invoice Meta ── */}
                    <div className="mb-16">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-12 gap-y-6 text-slate-300">
                            <div>
                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Invoice ID</Text>
                                <Text className="text-sm font-bold text-white">#{invoice.id.slice(0, 8).toUpperCase()}</Text>
                            </div>
                            <div>
                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Terms</Text>
                                {isEditing ? (
                                    <input type="number" min="1" max="180"
                                        className="w-20 p-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900 focus:outline-none shadow-sm"
                                        value={numField('payment_days') || 30}
                                        onChange={e => setNum('payment_days')(e.target.value)} />
                                ) : (
                                    <Text className="text-sm font-bold text-white">NET {paymentDays}</Text>
                                )}
                            </div>
                            <div>
                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Issue Date</Text>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="w-32 p-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900 focus:outline-none shadow-sm"
                                        value={new Date(editedInvoice.created_at || invoice.created_at).toISOString().split('T')[0]}
                                        onChange={e => {
                                            const newDate = new Date(e.target.value);
                                            // Ensure time is set to noon to avoid timezone shift issues on pure dates
                                            newDate.setHours(12, 0, 0, 0);
                                            setEditedInvoice(prev => ({ ...prev, created_at: newDate.toISOString() }));
                                        }}
                                    />
                                ) : (
                                    <Text className="text-sm font-bold text-white">
                                        {new Date(invoice.created_at).toLocaleDateString()}
                                    </Text>
                                )}
                            </div>
                            <div>
                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Due Date</Text>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="w-32 p-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900 focus:outline-none shadow-sm"
                                        value={new Date(new Date(editedInvoice.created_at || invoice.created_at).getTime() + paymentDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                                        onChange={e => {
                                            const newDueDate = new Date(e.target.value);
                                            newDueDate.setHours(12, 0, 0, 0);
                                            const issueDate = new Date(editedInvoice.created_at || invoice.created_at);
                                            issueDate.setHours(12, 0, 0, 0);
                                            const diffTime = Math.abs(newDueDate.getTime() - issueDate.getTime());
                                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                            setEditedInvoice(prev => ({ ...prev, payment_days: diffDays }));
                                        }}
                                    />
                                ) : (
                                    <Text className="text-sm font-bold text-white">
                                        {new Date(new Date(invoice.created_at).setDate(new Date(invoice.created_at).getDate() + paymentDays)).toLocaleDateString()}
                                    </Text>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Line Items Table ── */}
                    <div className="mb-16">
                        <table className="w-full text-left">
                            <thead className="border-b border-slate-800 bg-slate-950/30">
                                <tr>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4">#</th>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Service Description</th>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qty (Days)</th>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Daily Rate</th>
                                    <th className="py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right pr-4">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                <tr className="group hover:bg-slate-800/20 transition-colors">
                                    <td className="py-8 pl-4 text-slate-600 font-mono text-xs">01</td>
                                    <td className="py-8 px-4">
                                        {isEditing ? (
                                            <input
                                                className="w-full p-1.5 border border-cyan-700 rounded text-sm bg-white text-slate-900 focus:outline-none"
                                                value={field('service_description') || 'Drone Field Operations & Analysis'}
                                                onChange={e => set('service_description')(e.target.value)}
                                                placeholder="Service Description"
                                            />
                                        ) : (
                                            <>
                                                <Text className="font-bold text-white mb-1">{field('service_description') || 'Drone Field Operations & Analysis'}</Text>
                                                <Text variant="small" className="text-slate-500">{invoice.mission_title} • {invoice.site_name}</Text>
                                            </>
                                        )}
                                    </td>
                                    <td className="py-8 text-center">
                                        {isEditing ? (
                                            <input type="number" min="1"
                                                className="w-16 p-1.5 border border-cyan-700 rounded text-sm bg-white text-slate-900 text-center focus:outline-none"
                                                value={numField('days_worked') || daysWorked}
                                                onChange={e => setNum('days_worked')(e.target.value)} />
                                        ) : (
                                            <Text className="text-slate-300 font-bold">{daysWorked}</Text>
                                        )}
                                    </td>
                                    <td className="py-8 text-right">
                                        {isEditing ? (
                                            <input type="number" min="0"
                                                className="w-28 p-1.5 border border-cyan-700 rounded text-sm bg-white text-slate-900 text-right focus:outline-none"
                                                value={numField('daily_pay_rate')}
                                                onChange={e => setNum('daily_pay_rate')(e.target.value)} />
                                        ) : (
                                            <Text className="text-slate-300 font-bold">
                                                ${Number(dailyRate || (daysWorked > 0 ? amount / daysWorked : amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </Text>
                                        )}
                                    </td>
                                    <td className="py-8 text-right pr-4">
                                        {isEditing ? (
                                            <input type="number" min="0"
                                                className="w-32 p-1.5 border border-cyan-700 rounded text-sm bg-white text-slate-900 text-right focus:outline-none"
                                                value={numField('amount')}
                                                onChange={e => setNum('amount')(e.target.value)} />
                                        ) : (
                                            <Text className="font-black text-cyan-400 text-lg">
                                                ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </Text>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Total */}
                        <div className="flex justify-end pt-12 border-t border-slate-800/50">
                            <div className="w-full max-w-xs">
                                <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 flex justify-between items-center shadow-inner">
                                    <Text className="text-slate-500 font-black uppercase tracking-widest text-xs">Total Amount Due</Text>
                                    <Text className="text-3xl font-black text-white">
                                        ${Number(isEditing ? (editedInvoice.amount ?? 0) : invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Banking Info ── */}
                    <div className="border-t border-slate-800/50 pt-16 flex flex-col md:flex-row justify-between items-end gap-12">
                        <div className="max-w-md w-full">
                            <Heading level={4} className="text-xl font-bold text-cyan-500 mb-6 uppercase tracking-widest">Banking Info</Heading>

                            <div className="bg-slate-950/80 p-8 rounded-2xl border border-slate-800">
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <div>
                                            <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black mb-1 block">Bank Name</Text>
                                            <input
                                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 shadow-sm"
                                                value={field('bank_name')} onChange={e => set('bank_name')(e.target.value)} placeholder="Bank Name" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black mb-1 block">Routing Number</Text>
                                                <input
                                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none font-mono shadow-sm"
                                                    value={field('routing_number')}
                                                    onChange={e => handleRoutingChange(e.target.value)}
                                                    placeholder="9-digit routing" />
                                            </div>
                                            <div>
                                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black mb-1 block">Account Number</Text>
                                                <input
                                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none font-mono shadow-sm"
                                                    value={field('account_number')} onChange={e => set('account_number')(e.target.value)} placeholder="Account number" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black mb-1 block">SWIFT / BIC</Text>
                                                <input
                                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none font-mono uppercase shadow-sm"
                                                    value={field('swift_code')} onChange={e => set('swift_code')(e.target.value)} placeholder="e.g. CHASUS33" />
                                            </div>
                                            <div>
                                                <Text variant="small" className="text-[10px] text-slate-500 uppercase font-black mb-1 block">Account Type</Text>
                                                <select
                                                    className="w-full p-2 h-10 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm focus:outline-none shadow-sm"
                                                    value={field('account_type') || 'Checking'}
                                                    onChange={e => set('account_type')(e.target.value)}>
                                                    <option>Checking</option>
                                                    <option>Savings</option>
                                                    <option>Business</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Text className="font-black text-white mb-3 tracking-tight uppercase">{bankInfo.bankName || 'Direct Deposit'}</Text>
                                        <div className="space-y-2 text-sm">
                                            {/* Routing — fully visible + copy */}
                                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                                                <span className="text-slate-400">Routing number</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-bold text-white font-mono">
                                                        {bankInfo.routing || '—'}
                                                    </span>
                                                    {bankInfo.routing && <CopyButton value={bankInfo.routing} label="routing number" />}
                                                </div>
                                            </div>
                                            {/* Account — fully visible + copy */}
                                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                                                <span className="text-slate-400">Account number</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-bold text-white font-mono">
                                                        {bankInfo.account || '—'}
                                                    </span>
                                                    {bankInfo.account && <CopyButton value={bankInfo.account} label="account number" />}
                                                </div>
                                            </div>
                                            {/* SWIFT */}
                                            {bankInfo.swift && (
                                                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                                                    <span className="text-slate-400">SWIFT / BIC</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-bold text-white uppercase font-mono">{bankInfo.swift}</span>
                                                        <CopyButton value={bankInfo.swift} label="SWIFT code" />
                                                    </div>
                                                </div>
                                            )}
                                            {/* Account type */}
                                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                                                <span className="text-slate-400">Type</span>
                                                <Badge variant="secondary" className="bg-slate-800 border-none px-2 py-0 text-[10px]">{bankInfo.accountType}</Badge>
                                            </div>
                                            <Text variant="small" className="text-slate-600 font-medium italic mt-4 block">Secure ACH Transfer Authorization Active</Text>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col items-end print:hidden">
                            {isEditing ? (
                                <div className="flex gap-4">
                                    <Button variant="outline"
                                        onClick={() => { setIsEditing(false); setEditedInvoice(invoice!); }}
                                        className="px-10 py-6 border-slate-700 text-slate-400 font-bold hover:bg-slate-900 flex items-center gap-2">
                                        <X className="w-5 h-5" /> Cancel
                                    </Button>
                                    <Button onClick={handleSave} disabled={isSaving}
                                        className="bg-cyan-600 text-white px-10 py-6 font-bold hover:bg-cyan-500 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 border-none">
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        Save Invoice
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-end gap-6">
                                    <div className="flex gap-4">
                                        <Button variant="outline" onClick={() => window.print()}
                                            className="border-slate-700 text-slate-300 px-8 py-7 rounded-xl font-bold text-lg hover:bg-slate-900 transition-all flex items-center gap-3">
                                            <Download className="w-6 h-6" /> Export Document
                                        </Button>
                                    </div>
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
