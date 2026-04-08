/**
 * InvoicesDashboard.tsx
 * Admin invoice management dashboard — lists all invoices across all missions.
 * Uses Stitch design system.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../stitch/components/Card';
import { Badge } from '../../stitch/components/Badge';
import { Button } from '../../stitch/components/Button';
import { Heading, Text } from '../../stitch/components/Typography';
import apiClient from '../../services/apiClient';
import { FileText, ExternalLink, RefreshCw, Filter, DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';

type InvoiceStatus = 'SENT' | 'VIEWED' | 'PAID' | 'OVERDUE';

interface Invoice {
    id: string;
    amount: number;
    status: InvoiceStatus;
    created_at: string;
    payment_days: number;
    token: string;
    mission_title: string;
    site_name: string;
    location: string;
    pilot_name: string;
    pilot_email: string;
}

const statusBadge = (status: string): 'info' | 'warning' | 'success' | 'destructive' => {
    if (status === 'PAID') return 'success';
    if (status === 'VIEWED') return 'info';
    if (status === 'OVERDUE') return 'destructive';
    return 'warning';
};

const statusIcon = (status: string) => {
    if (status === 'PAID') return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    if (status === 'VIEWED') return <Clock className="w-3.5 h-3.5 text-blue-400" />;
    if (status === 'OVERDUE') return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    return <Clock className="w-3.5 h-3.5 text-amber-400" />;
};

export const InvoicesDashboard: React.FC = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('');

    const load = useCallback(async (statusFilter = filter) => {
        setLoading(true);
        setError(null);
        try {
            const params: any = { limit: 200 };
            if (statusFilter) params.status = statusFilter;
            const r = await apiClient.get('/invoices/all', { params });
            if (r.data.success) {
                setInvoices(r.data.data);
                setTotal(r.data.total);
            }
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to load invoices');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { load(); }, []);

    const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.amount), 0);
    const totalPending = invoices.filter(i => i.status !== 'PAID').reduce((s, i) => s + Number(i.amount), 0);

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <Heading level={2}>Invoice Management</Heading>
                <Button variant="secondary" size="sm" onClick={() => load(filter)} disabled={loading}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                {[
                    { label: 'Total Invoices', value: total, icon: <FileText className="w-5 h-5 text-blue-400" />, color: '#1d4ed8' },
                    { label: 'Total Paid', value: `$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: <CheckCircle className="w-5 h-5 text-emerald-400" />, color: '#059669' },
                    { label: 'Outstanding', value: `$${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: <DollarSign className="w-5 h-5 text-amber-400" />, color: '#d97706' },
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

            {/* Filter Row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['', 'SENT', 'VIEWED', 'PAID'].map(s => (
                    <button key={s} onClick={() => { setFilter(s); load(s); }}
                        style={{
                            padding: '6px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.07em', border: 'none', cursor: 'pointer',
                            background: filter === s ? '#1e40af' : '#1e293b',
                            color: filter === s ? '#fff' : '#94a3b8', transition: 'all 0.15s',
                        }}>
                        {s || 'All'}
                    </button>
                ))}
            </div>

            {/* Invoice List */}
            <Card style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
                <CardContent style={{ padding: 0 }}>
                    {loading ? (
                        <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
                            <Text size="sm">Loading invoices…</Text>
                        </div>
                    ) : error ? (
                        <div style={{ padding: '60px 0', textAlign: 'center', color: '#ef4444' }}>
                            <AlertCircle className="w-6 h-6 mx-auto mb-3" />
                            <Text size="sm">{error}</Text>
                        </div>
                    ) : invoices.length === 0 ? (
                        <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
                            <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
                            <Text size="sm">No invoices found</Text>
                        </div>
                    ) : (
                        <div>
                            {/* Table Header */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr auto', gap: 16, padding: '12px 24px', borderBottom: '1px solid #1e293b', color: '#475569', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                <span>Pilot</span><span>Mission</span><span>Amount</span><span>Status</span><span>Date</span><span>Link</span>
                            </div>
                            {invoices.map((inv, idx) => (
                                <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr auto', gap: 16, padding: '14px 24px', borderBottom: idx < invoices.length - 1 ? '1px solid #0f172a' : 'none', alignItems: 'center', background: idx % 2 === 0 ? 'transparent' : '#0a0f1a' }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{inv.pilot_name}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>{inv.pilot_email}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, color: '#cbd5e1' }}>{inv.mission_title}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>{inv.site_name || inv.location || '—'}</div>
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: inv.status === 'PAID' ? '#4ade80' : '#fbbf24' }}>
                                        ${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {statusIcon(inv.status)}
                                        <Badge variant={statusBadge(inv.status)} size="sm">{inv.status}</Badge>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>
                                        {new Date(inv.created_at).toLocaleDateString()}
                                    </div>
                                    <a href={`/invoice/${inv.token}`} target="_blank" rel="noopener noreferrer"
                                        style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, textDecoration: 'none' }}>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
