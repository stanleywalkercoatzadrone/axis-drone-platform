import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, FileText, CheckCircle, Clock, AlertTriangle,
  Plus, Send, Trash2, Loader2, ChevronDown, ChevronUp,
  Building2, Receipt, X, Printer
} from 'lucide-react';
import apiClient from '../services/apiClient';

interface TenantBilling {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  owner_email: string;
  created_at: string;
  invoice_count: number;
  last_invoice_at: string | null;
  total_paid: number;
  total_outstanding: number;
  last_paid_at: string | null;
}

interface SubscriptionInvoice {
  id: string;
  tenant_slug: string;
  tenant_name: string;
  invoice_number: string;
  plan: string;
  amount: number;
  currency: string;
  description: string;
  period_start: string;
  period_end: string;
  status: string;
  due_date: string;
  sent_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  owner_email: string;
}

const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  free:       { monthly: 0,    annual: 0     },
  starter:    { monthly: 299,  annual: 2990  },
  pro:        { monthly: 599,  annual: 5990  },
  enterprise: { monthly: 1499, annual: 14990 },
};

const STATUS_STYLES: Record<string, string> = {
  draft:   'bg-slate-100 text-slate-600',
  sent:    'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  void:    'bg-slate-100 text-slate-400 line-through',
};

const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const ClientBillingPanel: React.FC = () => {
  const [tenants, setTenants] = useState<TenantBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [invoicesMap, setInvoicesMap] = useState<Record<string, SubscriptionInvoice[]>>({});
  const [loadingInvoices, setLoadingInvoices] = useState<string | null>(null);

  // Generate invoice state
  const [generating, setGenerating] = useState<string | null>(null);
  const [genForm, setGenForm] = useState<Record<string, { cycle: string; amount: string; notes: string }>>({});

  // Status update
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/subscription-invoices/tenants');
      setTenants(res.data.data || []);
    } catch (err) {
      console.error('[ClientBillingPanel]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const toggleExpand = async (slug: string) => {
    if (expanded === slug) { setExpanded(null); return; }
    setExpanded(slug);
    if (!invoicesMap[slug]) {
      setLoadingInvoices(slug);
      try {
        const res = await apiClient.get(`/subscription-invoices/${slug}`);
        setInvoicesMap(m => ({ ...m, [slug]: res.data.data || [] }));
      } catch (e) { console.error(e); }
      setLoadingInvoices(null);
    }
  };

  const handleGenerate = async (tenant: TenantBilling) => {
    const form = genForm[tenant.slug] || { cycle: 'monthly', amount: '', notes: '' };
    setGenerating(tenant.slug);
    try {
      const planPrice = PLAN_PRICES[tenant.plan]?.[form.cycle as 'monthly' | 'annual'];
      await apiClient.post('/subscription-invoices', {
        tenantSlug: tenant.slug,
        billingCycle: form.cycle,
        amount: form.amount ? parseFloat(form.amount) : planPrice,
        notes: form.notes || null,
      });
      // Refresh invoices + summary
      const [invRes, sumRes] = await Promise.all([
        apiClient.get(`/subscription-invoices/${tenant.slug}`),
        apiClient.get('/subscription-invoices/tenants'),
      ]);
      setInvoicesMap(m => ({ ...m, [tenant.slug]: invRes.data.data || [] }));
      setTenants(sumRes.data.data || []);
      setGenForm(f => ({ ...f, [tenant.slug]: { cycle: 'monthly', amount: '', notes: '' } }));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setGenerating(null);
    }
  };

  const handleStatus = async (invoice: SubscriptionInvoice, status: string) => {
    setUpdatingId(invoice.id);
    try {
      await apiClient.put(`/subscription-invoices/${invoice.id}/status`, { status });
      setInvoicesMap(m => ({
        ...m,
        [invoice.tenant_slug]: (m[invoice.tenant_slug] || []).map(i =>
          i.id === invoice.id ? { ...i, status, paid_at: status === 'paid' ? new Date().toISOString() : i.paid_at } : i
        ),
      }));
      loadTenants();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (invoice: SubscriptionInvoice) => {
    if (!confirm(`Delete invoice ${invoice.invoice_number}?`)) return;
    setUpdatingId(invoice.id);
    try {
      await apiClient.delete(`/subscription-invoices/${invoice.id}`);
      setInvoicesMap(m => ({
        ...m,
        [invoice.tenant_slug]: (m[invoice.tenant_slug] || []).filter(i => i.id !== invoice.id),
      }));
      loadTenants();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    } finally {
      setUpdatingId(null);
    }
  };

  const printInvoice = (inv: SubscriptionInvoice) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${inv.invoice_number}</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 60px auto; color: #0f172a; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
        .logo { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
        .logo span { color: #2563eb; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #dcfce7; color: #15803d; }
        h1 { font-size: 32px; font-weight: 900; margin: 0 0 4px; }
        .meta { color: #64748b; font-size: 14px; margin-bottom: 40px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
        th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 8px 0; border-bottom: 2px solid #e2e8f0; }
        td { padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .total-row td { font-weight: 900; font-size: 18px; border-bottom: none; padding-top: 20px; }
        .bill-to { margin-bottom: 40px; }
        .bill-to h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0 0 8px; }
        .bill-to p { margin: 2px 0; font-size: 15px; }
        .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; }
        @media print { body { margin: 20px; } }
      </style>
    </head><body>
      <div class="header">
        <div>
          <div class="logo">AXIS<span>.</span></div>
          <div style="font-size:13px;color:#64748b;margin-top:4px;">Coatzadrone USA · coatzadroneusa.com</div>
        </div>
        <span class="badge">${inv.status}</span>
      </div>
      <h1>${inv.invoice_number}</h1>
      <div class="meta">
        Issued: ${fmtDate(inv.created_at)} &nbsp;·&nbsp; Due: ${fmtDate(inv.due_date)}
      </div>
      <div class="bill-to">
        <h3>Bill To</h3>
        <p><strong>${inv.tenant_name}</strong></p>
        <p>${inv.owner_email}</p>
      </div>
      <table>
        <tr><th>Description</th><th>Period</th><th style="text-align:right">Amount</th></tr>
        <tr>
          <td>${inv.description}</td>
          <td>${fmtDate(inv.period_start)} – ${fmtDate(inv.period_end)}</td>
          <td style="text-align:right">${fmt(inv.amount)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="2">Total Due</td>
          <td style="text-align:right">${fmt(inv.amount)} ${inv.currency}</td>
        </tr>
      </table>
      ${inv.notes ? `<p style="color:#64748b;font-size:13px;">Note: ${inv.notes}</p>` : ''}
      <div class="footer">
        Thank you for your business. Payment is due by ${fmtDate(inv.due_date)}.
        Wire / ACH details available on request.
      </div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  const totalOutstanding = tenants.reduce((s, t) => s + Number(t.total_outstanding), 0);
  const totalCollected   = tenants.reduce((s, t) => s + Number(t.total_paid), 0);

  return (
    <div className="space-y-6">

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Clients', value: tenants.filter(t => t.status === 'active').length, icon: Building2, color: 'text-blue-600' },
          { label: 'Outstanding',    value: fmt(totalOutstanding), icon: Clock, color: 'text-amber-600' },
          { label: 'Total Collected',value: fmt(totalCollected),   icon: DollarSign, color: 'text-green-600' },
        ].map(item => (
          <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
            <div className={`${item.color}`}><item.icon className="w-6 h-6" /></div>
            <div>
              <div className="text-xl font-black text-slate-900">{item.value}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Client Rows */}
      {tenants.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm">
          No client organisations yet. Onboard one above to get started.
        </div>
      )}

      {tenants.map(tenant => {
        const isOpen = expanded === tenant.slug;
        const invoices = invoicesMap[tenant.slug] || [];
        const form = genForm[tenant.slug] || { cycle: 'monthly', amount: '', notes: '' };
        const defaultPrice = PLAN_PRICES[tenant.plan]?.[form.cycle as 'monthly' | 'annual'];

        return (
          <div key={tenant.slug} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Tenant Header */}
            <button
              onClick={() => toggleExpand(tenant.slug)}
              className="w-full flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-black text-white">{tenant.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">{tenant.name}</p>
                <p className="text-xs text-slate-500">{tenant.owner_email} · <span className="capitalize">{tenant.plan}</span></p>
              </div>
              <div className="hidden sm:flex items-center gap-6 mr-4">
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 uppercase">Outstanding</p>
                  <p className={`text-sm font-black ${Number(tenant.total_outstanding) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {Number(tenant.total_outstanding) > 0 ? fmt(tenant.total_outstanding) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 uppercase">Collected</p>
                  <p className="text-sm font-black text-green-600">
                    {Number(tenant.total_paid) > 0 ? fmt(tenant.total_paid) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 uppercase">Invoices</p>
                  <p className="text-sm font-black text-slate-700">{tenant.invoice_count}</p>
                </div>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
            </button>

            {/* Expanded Panel */}
            {isOpen && (
              <div className="border-t border-slate-100 p-5 space-y-5 bg-slate-50/50">

                {/* Generate Invoice Form — hidden for free plan */}
                {tenant.plan === 'free' ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Free Plan — No Invoice Required</p>
                      <p className="text-xs text-emerald-600">This organisation is on a complimentary plan. Upgrade their plan to start billing.</p>
                    </div>
                  </div>
                ) : (
                <div className="bg-white border border-indigo-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-500" /> Generate Invoice
                  </h4>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cycle</label>
                      <select
                        value={form.cycle}
                        onChange={e => setGenForm(f => ({ ...f, [tenant.slug]: { ...form, cycle: e.target.value } }))}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                      >
                        <option value="monthly">Monthly — {fmt(PLAN_PRICES[tenant.plan]?.monthly ?? 299)}</option>
                        <option value="annual">Annual — {fmt(PLAN_PRICES[tenant.plan]?.annual ?? 2990)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Override Amount</label>
                      <input
                        type="number"
                        value={form.amount}
                        onChange={e => setGenForm(f => ({ ...f, [tenant.slug]: { ...form, amount: e.target.value } }))}
                        placeholder={`${defaultPrice ?? 299}`}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-28 outline-none"
                      />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes</label>
                      <input
                        type="text"
                        value={form.notes}
                        onChange={e => setGenForm(f => ({ ...f, [tenant.slug]: { ...form, notes: e.target.value } }))}
                        placeholder="Optional note on invoice"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                      />
                    </div>
                    <button
                      onClick={() => handleGenerate(tenant)}
                      disabled={generating === tenant.slug}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                    >
                      {generating === tenant.slug ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      Generate
                    </button>
                  </div>
                </div>
                )}

                {/* Invoice List */}
                {loadingInvoices === tenant.slug ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : invoices.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No invoices yet.</p>
                ) : (
                  <div className="space-y-2">
                    {invoices.map(inv => (
                      <div key={inv.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                        <Receipt className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-slate-800">{inv.invoice_number}</span>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLES[inv.status] || STATUS_STYLES.draft}`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{inv.description}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Due: {fmtDate(inv.due_date)}
                            {inv.paid_at ? ` · Paid: ${fmtDate(inv.paid_at)}` : ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-black text-slate-900">{fmt(inv.amount)}</p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {inv.status === 'draft' && (
                            <button
                              onClick={() => handleStatus(inv, 'sent')}
                              disabled={updatingId === inv.id}
                              title="Mark Sent"
                              className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {(inv.status === 'sent' || inv.status === 'overdue') && (
                            <button
                              onClick={() => handleStatus(inv, 'paid')}
                              disabled={updatingId === inv.id}
                              title="Mark Paid"
                              className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => printInvoice(inv)}
                            title="Print / Save PDF"
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {inv.status !== 'paid' && (
                            <button
                              onClick={() => handleDelete(inv)}
                              disabled={updatingId === inv.id}
                              title="Delete"
                              className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            >
                              {updatingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ClientBillingPanel;
