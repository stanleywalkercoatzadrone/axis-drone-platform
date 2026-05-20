import React, { useState, useEffect } from 'react';
import {
  Building2, Users, UserPlus, Mail, ShieldCheck,
  Loader2, CheckCircle, AlertTriangle, Crown, Zap, Infinity,
  PlusCircle, X
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { UserAccount } from '../types';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: string;
  owner_email: string;
  plan_limits: {
    max_pilots: number;
    max_missions: number;
    ai_reports: boolean;
    white_label: boolean;
  };
  created_at: string;
}

interface TenantUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

const PLAN_META = {
  free:        { label: 'Free',       color: 'bg-emerald-100 text-emerald-700', icon: Zap },
  starter:    { label: 'Starter',    color: 'bg-slate-100 text-slate-700',   icon: Zap },
  pro:        { label: 'Pro',        color: 'bg-blue-100 text-blue-700',     icon: ShieldCheck },
  enterprise: { label: 'Enterprise', color: 'bg-purple-100 text-purple-700', icon: Crown },
};

const LimitBadge: React.FC<{ value: number | boolean; label: string }> = ({ value, label }) => (
  <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
    <div className="text-lg font-black text-slate-900">
      {typeof value === 'boolean'
        ? (value ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-slate-400" />)
        : value === -1 ? <Infinity className="w-5 h-5 text-purple-600" /> : value}
    </div>
    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{label}</div>
  </div>
);

interface OrganizationPanelProps {
  currentUser: UserAccount;
}

const OrganizationPanel: React.FC<OrganizationPanelProps> = ({ currentUser }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteForm, setInviteForm] = useState({ email: '', fullName: '', role: 'admin' });
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [showInvite, setShowInvite] = useState(false);

  // Onboard new client (Coatzadrone-only)
  const isCoatzadrone = (currentUser as any).tenantId === 'coatzadrone' || (currentUser as any).companyName?.toLowerCase().includes('coatzadrone');
  const [showOnboard, setShowOnboard] = useState(false);
  const [onboardForm, setOnboardForm] = useState({ orgName: '', slug: '', ownerEmail: '', ownerName: '', password: '', plan: 'starter' });
  const [onboarding, setOnboarding] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const [tenantRes, usersRes] = await Promise.all([
          apiClient.get('/tenants/me'),
          apiClient.get('/tenants/me/users'),
        ]);
        setTenant(tenantRes.data.data);
        setUsers(usersRes.data.data || []);
      } catch (err) {
        console.error('[OrganizationPanel] Failed to load:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.fullName) {
      setInviteStatus({ type: 'error', message: 'Email and name are required.' });
      return;
    }
    setInviting(true);
    setInviteStatus({ type: null, message: '' });
    try {
      await apiClient.post('/tenants/me/invite', inviteForm);
      setInviteStatus({ type: 'success', message: `Invitation sent to ${inviteForm.email}` });
      setInviteForm({ email: '', fullName: '', role: 'admin' });
      setShowInvite(false);
      // Refresh user list
      const usersRes = await apiClient.get('/tenants/me/users');
      setUsers(usersRes.data.data || []);
    } catch (err: any) {
      setInviteStatus({ type: 'error', message: err.response?.data?.message || 'Failed to send invite' });
    } finally {
      setInviting(false);
    }
  };

  const handleOnboard = async () => {
    const { orgName, slug, ownerEmail, ownerName, password, plan } = onboardForm;
    if (!orgName || !slug || !ownerEmail || !ownerName || !password) {
      setOnboardStatus({ type: 'error', message: 'All fields are required.' });
      return;
    }
    if (password.length < 8) {
      setOnboardStatus({ type: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }
    setOnboarding(true);
    setOnboardStatus({ type: null, message: '' });
    try {
      await apiClient.post('/tenants/register', { orgName, slug, ownerEmail, ownerName, password, plan });
      setOnboardStatus({ type: 'success', message: `✅ "${orgName}" is live! ${ownerEmail} can now log in.` });
      setOnboardForm({ orgName: '', slug: '', ownerEmail: '', ownerName: '', password: '', plan: 'starter' });
    } catch (err: any) {
      setOnboardStatus({ type: 'error', message: err.response?.data?.message || 'Failed to create organisation.' });
    } finally {
      setOnboarding(false);
    }
  };

  // Auto-generate slug from org name
  const handleOrgNameChange = (val: string) => {
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setOnboardForm(f => ({ ...f, orgName: val, slug: autoSlug }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const planMeta = PLAN_META[tenant?.plan || 'enterprise'];
  const PlanIcon = planMeta.icon;

  return (
    <div className="space-y-6">
      {/* Org Info Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">{tenant?.name || currentUser.companyName}</h3>
              <p className="text-slate-500 text-sm font-medium">{tenant?.slug || (currentUser as any).tenantId}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${planMeta.color}`}>
            <PlanIcon className="w-3 h-3" />
            {planMeta.label}
          </span>
        </div>

        {/* Plan Limits */}
        {tenant?.plan_limits && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            <LimitBadge value={tenant.plan_limits.max_pilots} label="Max Pilots" />
            <LimitBadge value={tenant.plan_limits.max_missions} label="Max Missions" />
            <LimitBadge value={tenant.plan_limits.ai_reports} label="AI Reports" />
            <LimitBadge value={tenant.plan_limits.white_label} label="White Label" />
          </div>
        )}

        {tenant?.owner_email && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Mail className="w-4 h-4" />
            <span>Owner: <span className="font-medium text-slate-700">{tenant.owner_email}</span></span>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-500" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Team Members</h3>
              <p className="text-xs text-slate-500">{users.length} user{users.length !== 1 ? 's' : ''} in your organisation</p>
            </div>
          </div>
          <button
            onClick={() => setShowInvite(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>

        {/* Invite Form */}
        {showInvite && (
          <div className="mb-6 p-5 bg-blue-50 rounded-xl border border-blue-200 space-y-4 animate-in slide-in-from-top duration-300">
            <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Invite a new team member
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Full Name</label>
                <input
                  type="text"
                  value={inviteForm.fullName}
                  onChange={e => setInviteForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@company.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="admin">Admin</option>
                  <option value="pilot_technician">Pilot / Technician</option>
                  <option value="client_user">Client Viewer</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send Invitation
                </button>
              </div>
            </div>
            {inviteStatus.message && (
              <div className={`flex items-center gap-2 text-sm font-medium ${inviteStatus.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {inviteStatus.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {inviteStatus.message}
              </div>
            )}
          </div>
        )}

        {/* User List */}
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-white">{u.full_name?.charAt(0)?.toUpperCase() || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{u.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{u.email}</p>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                u.role === 'pilot_technician' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {u.role}
              </span>
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No team members yet. Invite someone above.</div>
          )}
        </div>
      </div>

      {/* Onboard New Client — Coatzadrone only */}
      {isCoatzadrone && (
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <PlusCircle className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Onboard New Client</h3>
                <p className="text-xs text-slate-500">Provision a new organisation + admin account instantly.</p>
              </div>
            </div>
            <button
              onClick={() => { setShowOnboard(v => !v); setOnboardStatus({ type: null, message: '' }); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                showOnboard ? 'bg-slate-100 text-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {showOnboard ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
              {showOnboard ? 'Cancel' : 'New Organisation'}
            </button>
          </div>

          {showOnboard && (
            <div className="mt-6 space-y-4 animate-in slide-in-from-top duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Company Name</label>
                  <input
                    type="text"
                    value={onboardForm.orgName}
                    onChange={e => handleOrgNameChange(e.target.value)}
                    placeholder="Acme Solar"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Slug (URL handle)</label>
                  <input
                    type="text"
                    value={onboardForm.slug}
                    onChange={e => setOnboardForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    placeholder="acme-solar"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Admin Full Name</label>
                  <input
                    type="text"
                    value={onboardForm.ownerName}
                    onChange={e => setOnboardForm(f => ({ ...f, ownerName: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Admin Email</label>
                  <input
                    type="email"
                    value={onboardForm.ownerEmail}
                    onChange={e => setOnboardForm(f => ({ ...f, ownerEmail: e.target.value }))}
                    placeholder="jane@acmesolar.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Initial Password</label>
                  <input
                    type="password"
                    value={onboardForm.password}
                    onChange={e => setOnboardForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Plan</label>
                  <select
                    value={onboardForm.plan}
                    onChange={e => setOnboardForm(f => ({ ...f, plan: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="free">Free — Complimentary access</option>
                    <option value="starter">Starter — 3 pilots, 10 missions</option>
                    <option value="pro">Pro — 15 pilots, unlimited missions, AI reports</option>
                    <option value="enterprise">Enterprise — Unlimited everything</option>
                  </select>
                </div>
              </div>

              {onboardStatus.message && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm font-medium ${
                  onboardStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {onboardStatus.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                  {onboardStatus.message}
                </div>
              )}

              <button
                onClick={handleOnboard}
                disabled={onboarding}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {onboarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                {onboarding ? 'Creating Organisation…' : 'Create Organisation & Admin Account'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrganizationPanel;
