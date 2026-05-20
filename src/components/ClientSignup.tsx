import React, { useState } from 'react';
import { Building2, Mail, Lock, User, Phone, Globe, ArrowRight, Loader2, CheckCircle2, ChevronDown, Eye, EyeOff, Layout } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const PLANS = [
  { id: 'free',       label: 'Basic — Free',          price: '$0/mo' },
  { id: 'growth',     label: 'Starter — Growth',       price: '$149/mo' },
  { id: 'pro',        label: 'Pro — Professional',     price: '$399/mo' },
  { id: 'enterprise', label: 'Elite — Enterprise',     price: 'Custom' },
];

const ClientSignup: React.FC = () => {
  const urlPlan = new URLSearchParams(window.location.search).get('plan') || 'free';

  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    fullName:    '',
    email:       '',
    password:    '',
    companyName: '',
    phone:       '',
    country:     'US',
    plan:        urlPlan,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.fullName || !form.email || !form.password || !form.companyName) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post('/api/auth/client-register', {
        fullName:    form.fullName,
        email:       form.email,
        password:    form.password,
        companyName: form.companyName,
        phone:       form.phone,
        country:     form.country,
        plan:        form.plan,
        role:        'client',
      });
      const { user, token, refreshToken } = res.data.data;
      // Store in sessionStorage then redirect into the authenticated app
      sessionStorage.setItem('skylens_token', token);
      sessionStorage.setItem('skylens_refresh_token', refreshToken);
      sessionStorage.setItem('skylens_current_user', JSON.stringify(user));
      window.location.href = '/client/overview';
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex overflow-hidden font-sans">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 relative p-16 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-blue-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[100px] rounded-full" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/30">
              <Layout className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tighter uppercase">Axis</h1>
              <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.3em]">by CoatzaDrone</p>
            </div>
          </div>

          <h2 className="text-4xl font-black text-white leading-tight tracking-tight mb-6">
            Welcome to<br /><span className="text-blue-400">Axis Platform</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-10">
            Enterprise drone operations, AI-powered inspections, and real-time analytics — all in one platform.
          </p>

          <div className="space-y-4">
            {[
              { icon: '🗺️', title: 'Mission Management', desc: 'Plan and track operations globally' },
              { icon: '🧠', title: 'AI Analysis', desc: 'Automated defect detection & reporting' },
              { icon: '📊', title: 'Client Portal', desc: 'Share reports with your clients instantly' },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-800/40">
                <span className="text-xl">{f.icon}</span>
                <div>
                  <p className="text-xs font-bold text-white">{f.title}</p>
                  <p className="text-xs text-slate-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold">Sign in →</Link>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-start justify-center p-8 pt-12 overflow-y-auto bg-slate-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Layout className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-black text-sm uppercase tracking-widest">Axis</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">Create your account</h2>
            <p className="text-slate-400 text-sm mt-1">Get started — no credit card required for the free plan.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Plan selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <select
                  value={form.plan}
                  onChange={set('plan')}
                  className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  {PLANS.map(p => (
                    <option key={p.id} value={p.id}>{p.label} — {p.price}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Name + Company */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={set('fullName')}
                    placeholder="Jane Smith"
                    required
                    className="w-full pl-10 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Company *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={set('companyName')}
                    placeholder="Acme Corp"
                    required
                    className="w-full pl-10 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Work Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="jane@company.com"
                  required
                  className="w-full pl-10 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min. 8 characters"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Phone + Country */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="+1 555 000 0000"
                    className="w-full pl-10 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Country</label>
                <select
                  value={form.country}
                  onChange={set('country')}
                  className="w-full px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  {[['US','🇺🇸 United States'],['MX','🇲🇽 Mexico'],['CA','🇨🇦 Canada'],['BR','🇧🇷 Brazil'],['GB','🇬🇧 United Kingdom'],['AU','🇦🇺 Australia'],['FR','🇫🇷 France'],['DE','🇩🇪 Germany'],['ES','🇪🇸 Spain'],['JP','🇯🇵 Japan'],['KR','🇰🇷 South Korea'],['IN','🇮🇳 India'],['AE','🇦🇪 UAE'],['SG','🇸🇬 Singapore'],['ZA','🇿🇦 South Africa']].map(([iso, label]) => (
                    <option key={iso} value={iso}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold">Sign in</Link>
          </p>

          <p className="text-center text-[10px] text-slate-600 mt-4 leading-relaxed">
            By creating an account you agree to our{' '}
            <a href="https://axisplatform.app/terms" className="underline hover:text-slate-400">Terms</a> and{' '}
            <a href="https://axisplatform.app/privacy" className="underline hover:text-slate-400">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClientSignup;
