/**
 * PayrollView.tsx
 * Admin pilot payroll & banking information dashboard.
 * Shows each pilot's pay rate, total invoiced, paid, and banking details.
 * Uses Stitch design system.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../stitch/components/Card';
import { Badge } from '../../stitch/components/Badge';
import { Button } from '../../stitch/components/Button';
import { Heading, Text } from '../../stitch/components/Typography';
import apiClient from '../../services/apiClient';
import { User, DollarSign, CreditCard, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface PilotPayroll {
    id: string;
    full_name: string;
    email: string;
    daily_pay_rate: number;
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

export const PayrollView: React.FC = () => {
    const [pilots, setPilots] = useState<PilotPayroll[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await apiClient.get('/invoices/payroll');
            if (r.data.success) setPilots(r.data.data);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to load payroll data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, []);

    const filtered = pilots.filter(p =>
        search === '' ||
        p.full_name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase())
    );

    const totalInvoiced = pilots.reduce((s, p) => s + Number(p.total_invoiced), 0);
    const totalPaid = pilots.reduce((s, p) => s + Number(p.total_paid), 0);
    const outstanding = totalInvoiced - totalPaid;

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <Heading level={2}>Pilot Payroll</Heading>
                <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {/* Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                {[
                    { label: 'Total Personnel', value: pilots.length, icon: <User className="w-5 h-5 text-blue-400" />, color: '#1d4ed8' },
                    { label: 'Total Paid Out', value: `$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: <CheckCircle className="w-5 h-5 text-emerald-400" />, color: '#059669' },
                    { label: 'Outstanding', value: `$${outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: <DollarSign className="w-5 h-5 text-amber-400" />, color: '#d97706' },
                ].map(card => (
                    <Card key={card.label} style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
                        <CardContent style={{ padding: '20px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${card.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {card.icon}
                                </div>
                                <div>
                                    <Text size="xs" className="text-slate-400 uppercase tracking-wider">{card.label}</Text>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>{card.value}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search pilot by name or email…"
                    style={{
                        width: '100%', maxWidth: 360, padding: '9px 16px', borderRadius: 10,
                        background: '#0f172a', border: '1px solid #1e293b', color: '#e2e8f0',
                        fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* Pilot List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loading ? (
                    <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
                        <Text size="sm">Loading payroll data…</Text>
                    </div>
                ) : error ? (
                    <div style={{ padding: '60px 0', textAlign: 'center', color: '#ef4444' }}>
                        <AlertCircle className="w-6 h-6 mx-auto mb-3" />
                        <Text size="sm">{error}</Text>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
                        <User className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <Text size="sm">No pilots found</Text>
                    </div>
                ) : filtered.map(p => {
                    const outstanding = Number(p.total_invoiced) - Number(p.total_paid);
                    const hasBanking = p.bank_name || p.account_number;
                    return (
                        <Card key={p.id} style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
                            <CardContent style={{ padding: '18px 24px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr', gap: 20, alignItems: 'center' }}>
                                    {/* Pilot Info */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <User className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{p.full_name}</div>
                                            <div style={{ fontSize: 11, color: '#64748b' }}>{p.email}</div>
                                        </div>
                                    </div>
                                    {/* Daily Rate */}
                                    <div>
                                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Daily Rate</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}>
                                            ${Number(p.daily_pay_rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    {/* Total Paid */}
                                    <div>
                                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Total Paid</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>
                                            ${Number(p.total_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    {/* Outstanding */}
                                    <div>
                                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Outstanding</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: outstanding > 0 ? '#f59e0b' : '#4ade80' }}>
                                            ${outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    {/* Banking Info */}
                                    <div>
                                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Banking</div>
                                        {hasBanking ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <div style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                                    {p.bank_name || '—'} · {p.account_type}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                                                    ···· {p.account_number?.slice(-4) || '????'}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <AlertCircle className="w-3 h-3" /> No banking on file
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
