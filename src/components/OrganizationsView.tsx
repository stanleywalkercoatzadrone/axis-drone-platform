/**
 * OrganizationsView.tsx — Axis Enterprise Organization Management
 * ═══════════════════════════════════════════════════════════════
 * View and manage all onboarded organizations (tenants).
 * Separate from the Onboard Organization (registration) flow.
 */
import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { Building2, Users, Calendar, Search, CheckCircle2, XCircle, Loader2, RefreshCw, ChevronRight, Globe } from 'lucide-react';

interface Tenant {
  id: string;
  name?: string;
  company_name?: string;
  email?: string;
  plan?: string;
  status?: string;
  created_at?: string;
  industry_key?: string;
  user_count?: number;
  mission_count?: number;
}

const PLAN_COLORS: Record<string, string> = {
  enterprise: '#a78bfa',
  pro: '#60a5fa',
  starter: '#34d399',
  free: '#94a3b8',
};

export default function OrganizationsView() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      // Try the me endpoint first (current tenant), fall back to general admin endpoint
      const res = await apiClient.get('/tenants/me');
      // Wrap single tenant in array for consistent render
      const data = res.data.data;
      setTenants(data ? (Array.isArray(data) ? data : [data]) : []);
      setError(null);
    } catch (err: any) {
      // Try admin endpoint if available
      try {
        const res2 = await apiClient.get('/admin/tenants');
        setTenants(res2.data.data || []);
        setError(null);
      } catch {
        setError('Organization data unavailable. Admin access may be required.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const filtered = tenants.filter(t => {
    const name = (t.name || t.company_name || '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || (t.status || 'active') === statusFilter;
    return matchSearch && matchStatus;
  });

  const orgName = (t: Tenant) => t.company_name || t.name || 'Unknown Organization';

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Globe size={18} color="#818cf8" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: -0.4 }}>
              Organizations
            </h1>
            <p style={{ fontSize: 12, color: '#475569', margin: 0, marginTop: 2 }}>
              Onboarded tenants · Platform organizations
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchTenants(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
            color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={12} color="#475569" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search organizations..."
            style={{
              width: '100%', padding: '8px 12px 8px 30px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        {(['all', 'active', 'inactive'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: '1px solid',
              borderColor: statusFilter === s ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)',
              background: statusFilter === s ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: statusFilter === s ? '#818cf8' : '#475569',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
          <Loader2 size={28} color="#475569" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{
          textAlign: 'center', padding: '3rem 2rem',
          background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 12,
        }}>
          <XCircle size={28} color="#ef4444" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f87171', margin: 0 }}>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 2rem',
          background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
        }}>
          <Building2 size={28} color="#334155" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', margin: 0 }}>No organizations onboarded yet</p>
          <p style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>
            Use <strong style={{ color: '#64748b' }}>Onboard Organization</strong> to register a new tenant
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filtered.map(tenant => (
            <div
              key={tenant.id}
              style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14,
                padding: '18px 20px',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              {/* Org header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Building2 size={18} color="#818cf8" />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', margin: 0, lineHeight: 1.2 }}>
                      {orgName(tenant)}
                    </p>
                    {tenant.email && (
                      <p style={{ fontSize: 11, color: '#475569', margin: '3px 0 0' }}>{tenant.email}</p>
                    )}
                  </div>
                </div>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
                  color: (tenant.status || 'active') === 'active' ? '#22c55e' : '#64748b',
                }}>
                  {(tenant.status || 'active') === 'active'
                    ? <CheckCircle2 size={11} />
                    : <XCircle size={11} />}
                  {tenant.status || 'Active'}
                </span>
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {tenant.plan && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    textTransform: 'capitalize', letterSpacing: 0.4,
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    color: PLAN_COLORS[tenant.plan] || '#94a3b8',
                  }}>
                    {tenant.plan}
                  </span>
                )}
                {tenant.industry_key && (
                  <span style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
                    {tenant.industry_key.replace(/_/g, ' ')}
                  </span>
                )}
                {tenant.created_at && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#475569', marginLeft: 'auto' }}>
                    <Calendar size={10} />
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Stats row */}
              {(tenant.user_count != null || tenant.mission_count != null) && (
                <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {tenant.user_count != null && (
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{tenant.user_count}</p>
                      <p style={{ fontSize: 10, color: '#475569', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Users</p>
                    </div>
                  )}
                  {tenant.mission_count != null && (
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{tenant.mission_count}</p>
                      <p style={{ fontSize: 10, color: '#475569', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Missions</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
