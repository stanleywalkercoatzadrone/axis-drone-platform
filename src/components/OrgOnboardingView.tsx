import React, { useState } from 'react';
import {
    Building2, User, Mail, Lock, ChevronRight,
    Check, AlertCircle, Zap, ShieldCheck, Crown, Infinity
} from 'lucide-react';
import apiClient from '../services/apiClient';

type Plan = 'free' | 'starter' | 'pro' | 'enterprise';

const PLANS: { id: Plan; label: string; icon: React.ElementType; color: string; border: string; price: string; billing: string; limits: string[] }[] = [
    {
        id: 'free',
        label: 'Free',
        icon: Zap,
        color: 'text-slate-400',
        border: 'border-slate-500/25 hover:border-slate-400/50',
        price: '$0',
        billing: 'forever',
        limits: ['1 pilot', '5 missions', 'No AI reports', 'No white-label'],
    },
    {
        id: 'starter',
        label: 'Starter',
        icon: Zap,
        color: 'text-emerald-400',
        border: 'border-emerald-500/25 hover:border-emerald-400/50',
        price: '$149',
        billing: '/ month',
        limits: ['3 pilots', '10 missions', 'No AI reports', 'No white-label'],
    },
    {
        id: 'pro',
        label: 'Pro',
        icon: ShieldCheck,
        color: 'text-blue-400',
        border: 'border-blue-500/25 hover:border-blue-400/50',
        price: '$399',
        billing: '/ month',
        limits: ['15 pilots', 'Unlimited missions', 'AI reports included', 'No white-label'],
    },
    {
        id: 'enterprise',
        label: 'Enterprise',
        icon: Crown,
        color: 'text-violet-400',
        border: 'border-violet-500/25 hover:border-violet-400/50',
        price: 'Custom',
        billing: 'contact us',
        limits: ['Unlimited pilots', 'Unlimited missions', 'AI reports included', 'White-label enabled'],
    },
];

function slugify(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const OrgOnboardingView: React.FC = () => {
    const [form, setForm] = useState({
        orgName: '',
        slug: '',
        ownerName: '',
        ownerEmail: '',
        password: '',
        plan: 'free' as Plan,
    });
    const [slugEdited, setSlugEdited] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; tenantSlug?: string } | null>(null);

    const update = (key: keyof typeof form, value: string) => {
        setForm(prev => {
            const next = { ...prev, [key]: value };
            if (key === 'orgName' && !slugEdited) {
                next.slug = slugify(value);
            }
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setResult(null);
        try {
            const res = await apiClient.post('/tenants/register', {
                orgName: form.orgName,
                slug: form.slug,
                ownerEmail: form.ownerEmail,
                ownerName: form.ownerName,
                password: form.password,
                plan: form.plan,
            });
            if (res.data.success) {
                setResult({ success: true, message: res.data.message, tenantSlug: res.data.data.tenantSlug });
                setForm({ orgName: '', slug: '', ownerName: '', ownerEmail: '', password: '', plan: 'starter' });
                setSlugEdited(false);
            } else {
                setResult({ success: false, message: res.data.message || 'Something went wrong.' });
            }
        } catch (err: any) {
            setResult({ success: false, message: err.response?.data?.message || 'Registration failed. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-8">
            {/* Header */}
            <div className="space-y-1">
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Organization Management
                </div>
                <h1 className="text-2xl font-bold text-white">Onboard New Organization</h1>
                <p className="text-sm text-slate-400">
                    Provision a new tenant on the Axis platform. The owner will be able to log in immediately.
                </p>
            </div>

            {/* Success banner */}
            {result?.success && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex items-start gap-3 animate-in fade-in duration-300">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <p className="font-bold text-emerald-300 text-sm">Organization created successfully</p>
                        <p className="text-xs text-emerald-400/70 mt-0.5">{result.message}</p>
                        {result.tenantSlug && (
                            <p className="text-xs text-slate-400 mt-2">
                                Tenant slug: <span className="font-mono text-white bg-white/5 px-1.5 py-0.5 rounded">{result.tenantSlug}</span>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Error banner */}
            {result && !result.success && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 flex items-start gap-3 animate-in fade-in duration-300">
                    <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-300">{result.message}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Org details card */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm p-6 space-y-5">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Organization Details</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Org Name */}
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Organization Name <span className="text-rose-400">*</span>
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                <input
                                    required
                                    type="text"
                                    placeholder="Acme Drone Services"
                                    value={form.orgName}
                                    onChange={e => update('orgName', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition"
                                />
                            </div>
                        </div>

                        {/* Slug */}
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Slug / Tenant ID <span className="text-rose-400">*</span>
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="acme-drone"
                                value={form.slug}
                                onChange={e => { setSlugEdited(true); update('slug', slugify(e.target.value)); }}
                                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-600 font-mono focus:outline-none focus:border-blue-500/50 transition"
                            />
                            <p className="text-[10px] text-slate-600 mt-1">Auto-generated from name. Lower-case letters, numbers and hyphens only.</p>
                        </div>
                    </div>
                </div>

                {/* Admin user card */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm p-6 space-y-5">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">First Admin Account</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Full Name <span className="text-rose-400">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                <input
                                    required
                                    type="text"
                                    placeholder="Jane Smith"
                                    value={form.ownerName}
                                    onChange={e => update('ownerName', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Email <span className="text-rose-400">*</span>
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                <input
                                    required
                                    type="email"
                                    placeholder="jane@acme.com"
                                    value={form.ownerEmail}
                                    onChange={e => update('ownerEmail', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition"
                                />
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Initial Password <span className="text-rose-400">*</span>
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                <input
                                    required
                                    type="password"
                                    placeholder="Min 8 characters"
                                    value={form.password}
                                    onChange={e => update('password', e.target.value)}
                                    minLength={8}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition"
                                />
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1">Share this with the admin — they can change it after first login.</p>
                        </div>
                    </div>
                </div>

                {/* Plan selector */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm p-6 space-y-4">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Plan</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {PLANS.map(plan => {
                            const selected = form.plan === plan.id;
                            return (
                                <button
                                    key={plan.id}
                                    type="button"
                                    onClick={() => update('plan', plan.id)}
                                    className={`relative rounded-xl border p-4 text-left transition-all ${selected
                                        ? `${plan.border} bg-white/5 ring-1 ring-offset-0`
                                        : 'border-white/10 bg-transparent hover:bg-white/3'
                                        }`}
                                >
                                    {selected && (
                                        <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                                            <Check className="w-2.5 h-2.5 text-white" />
                                        </div>
                                    )}
                                    <plan.icon className={`w-5 h-5 mb-2 ${plan.color}`} />
                                    <p className="font-bold text-white text-sm">{plan.label}</p>
                                    <div className="mt-1 mb-3">
                                        <span className={`text-2xl font-black ${plan.color}`}>{plan.price}</span>
                                        <span className="text-[10px] text-slate-500 ml-1">{plan.billing}</span>
                                    </div>
                                    <ul className="space-y-1">
                                        {plan.limits.map(l => (
                                            <li key={l} className="text-[10px] text-slate-500">{l}</li>
                                        ))}
                                    </ul>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creating Organization…
                            </>
                        ) : (
                            <>
                                Create Organization <ChevronRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default OrgOnboardingView;
