
import React, { useState, useEffect } from 'react';
import {
  Layout,
  Mail,
  Lock,
  ShieldCheck,
  Zap,
  Globe,
  Loader2,
  UserPlus,
  LogIn,
  Key,
  ShieldAlert,
  Briefcase,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { UserAccount, UserRole, InspectionReport, Industry, ReportTheme, Severity } from '../types';
import apiClient from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { initializeDemoSession } from '../services/demoService';

interface LoginProps {
  onLogin: (user: UserAccount) => void;
  defaultMode?: 'signin' | 'signup';
}

const Login: React.FC<LoginProps> = ({ onLogin, defaultMode = 'signin' }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('admin@coatzadroneusa.com');
  const [password, setPassword] = useState('password123');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.FIELD_OPERATOR);
  const [accessToken, setAccessToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  // CRITICAL: Force clear fields on mount to prevent malformed pre-population
  useEffect(() => {
    // Clear any potential browser auto-fill with empty string explicitly
    setEmail('');
    setPassword('');
    // SECURITY: Tokens are stored exclusively in httpOnly cookies (set by backend).
    // Do NOT store or read JWT tokens from localStorage — XSS vulnerability.
    // If legacy localStorage keys exist from an older version, clear them once on mount.
    try {
      localStorage.removeItem('axis_token');
      localStorage.removeItem('axis_refresh_token');
      localStorage.removeItem('axis_user');
    } catch (_) { /* storage may be unavailable in sandboxed contexts */ }
  }, []);
   const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === 'signup' && (!fullName || !companyName || !accessToken || !jobTitle))) {
      setError(mode === 'signup' ? 'All mandatory enterprise fields are required.' : 'Identity credentials required.');
      return;
    }

    // Client-side Admin Check REMOVED.
    // We send the 'adminSecret' (mapped from accessToken field) to the backend.
    // The backend validates it and returns 403 if invalid.

    setIsLoading(true);
    setError('');

    const loginData = { email, password };
    const signupData = {
      email,
      password,
      fullName,
      companyName,
      title: jobTitle,
      role,
      adminSecret: accessToken // In the form we use 'accessToken' field for the passkey input
    };

    const attemptAuth = async () => {
      try {
        console.log('DEBUG: Sending Signup Payload:', signupData);
        const response = await apiClient.post(
          mode === 'signin' ? '/auth/login' : '/auth/register',
          mode === 'signin' ? loginData : signupData
        );

        const { user: userData, token, refreshToken } = response.data.data;

        // Use Context for State Update (it handles localStorage)
        login(userData, token, refreshToken);

        onLogin(userData);
      } catch (err: any) {
        console.error('Auth error:', err);
        // Sanitize error message
        const message = err.response?.data?.error?.message || 'Authentication failed. Please verify credentials.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    attemptAuth();
  };

  const handleDemoAccess = async () => {
    setIsDemoLoading(true);
    try {
      const demoUser = await initializeDemoSession();
      // Dummy tokens for demo
      login(demoUser, 'DEMO_TOKEN', 'DEMO_REFRESH_TOKEN');
      onLogin(demoUser);
    } catch (error) {
      console.error('Demo initialization failed', error);
      setError('Failed to initialize demo session.');
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden font-sans" style={{ background: '#020617' }}>
      {/* Visual Side Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative p-20 flex-col justify-between overflow-hidden" style={{ background: 'rgba(15,23,42,0.8)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Ambient glow orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none" style={{ background: 'rgba(14,165,233,0.18)', filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none" style={{ background: 'rgba(99,102,241,0.15)', filter: 'blur(100px)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-16" style={{ animation: 'fadeIn 0.7s ease' }}>
            <div className="p-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)', boxShadow: '0 0 40px rgba(37,99,235,0.4)' }}>
              <Layout className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Axis</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2" style={{ color: '#38bdf8' }}>by CoatzadroneUSA</p>
            </div>
          </div>
          <h2 className="text-6xl font-black text-white leading-[1.05] tracking-tighter max-w-md">
            The Standard in <span style={{ color: '#3b82f6' }}>Aerial Audit</span> Intelligence.
          </h2>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <ShieldCheck className="w-5 h-5" style={{ color: '#3b82f6' }} /> End-to-End Vaulting
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Zap className="w-5 h-5" style={{ color: '#818cf8' }} /> Neural Edge Inference
          </div>
        </div>
      </div>

      {/* Identity Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 overflow-y-auto" style={{ background: 'rgba(2,6,23,0.6)' }}>
        <div className="w-full max-w-md space-y-8 py-12">
          <div className="text-center lg:text-left mb-6">
            <h3 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
              {mode === 'signin' ? 'Secure Portal' : 'Fleet Registration'}
            </h3>
            <p className="mt-3 font-medium uppercase text-[10px] tracking-widest" style={{ color: 'rgba(148,163,184,0.6)' }}>
              {mode === 'signin' ? 'Verify your system access credentials.' : 'Initialize your authorized corporate identity profile.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="p-6 rounded-[2rem] space-y-5 mb-6" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.2)' }}>
                    <UserPlus className="w-4 h-4" style={{ color: '#60a5fa' }} />
                  </div>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Enterprise Profile Data</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: 'rgba(148,163,184,0.6)' }}>Full Name</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe"
                      className="block w-full px-4 py-3 rounded-xl font-bold text-white text-sm outline-none transition-all"
                      style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: 'rgba(148,163,184,0.6)' }}>Company Entity</label>
                    <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nexus Grid"
                      className="block w-full px-4 py-3 rounded-xl font-bold text-white text-sm outline-none transition-all"
                      style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: 'rgba(148,163,184,0.6)' }}>Clearance Tier</label>
                  <div className="relative">
                    <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                      className="block w-full appearance-none px-4 py-3 rounded-xl font-bold text-white text-sm outline-none transition-all"
                      style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {Object.values(UserRole).map(r => <option key={r} value={r} style={{ background: '#0f172a' }}>{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#64748b' }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: 'rgba(148,163,184,0.6)' }}>Designation</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#64748b' }} />
                    <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Audit Lead"
                      className="block w-full pl-10 pr-4 py-3 rounded-xl font-bold text-white text-sm outline-none transition-all"
                      style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    {role === UserRole.ADMIN ? 'Master Admin Passkey' : 'Master Access Token'}
                  </label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: role === UserRole.ADMIN ? '#60a5fa' : '#64748b' }} />
                    <input
                      type={role === UserRole.ADMIN ? 'password' : 'text'}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder={role === UserRole.ADMIN ? '••••••••' : 'SKL-AUTH-V4'}
                      className="block w-full pl-10 pr-4 py-3 rounded-xl font-bold text-white text-sm outline-none transition-all"
                      style={{ background: 'rgba(30,41,59,0.6)', border: `1px solid ${role === UserRole.ADMIN ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.08)'}` }} />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: 'rgba(148,163,184,0.6)' }}>Email Identity</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#64748b' }} />
                  <input type="email" value={email || ''} onChange={(e) => setEmail(e.target.value)} placeholder="operator@axis.ai"
                    className="block w-full pl-10 pr-4 py-4 rounded-2xl font-bold text-white outline-none transition-all"
                    style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: 'rgba(148,163,184,0.6)' }}>Access Passphrase</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#64748b' }} />
                  <input type="password" value={password || ''} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    className="block w-full pl-10 pr-4 py-4 rounded-2xl font-bold text-white outline-none transition-all"
                    style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3"
                style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}>
                <ShieldAlert className="w-4 h-4" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isDemoLoading}
              className="w-full py-6 rounded-[2.25rem] font-black uppercase tracking-[0.2em] text-sm transition-all flex items-center justify-center gap-4 disabled:opacity-70 active:scale-95 mt-6"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)', color: 'white', boxShadow: '0 0 40px rgba(37,99,235,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : mode === 'signin' ? (
                <>Enter Admin Portal <LogIn className="w-6 h-6" /></>
              ) : (
                <>Confirm Registration &amp; Access <CheckCircle2 className="w-6 h-6" /></>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
              style={{ color: '#60a5fa' }}
            >
              {mode === 'signin' ? 'Provision New Corporate Identity' : 'Existing Operator Sign In'}
            </button>
          </div>

          <div className="relative py-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            </div>
            <div className="relative flex justify-center text-[9px] uppercase font-black tracking-[0.5em]" style={{ color: 'rgba(148,163,184,0.4)' }}>
              <span className="px-4" style={{ background: 'rgba(2,6,23,0.6)' }}>Evaluation Bridge</span>
            </div>
          </div>

          <button
            onClick={handleDemoAccess}
            disabled={isLoading || isDemoLoading}
            className="w-full flex items-center justify-center gap-4 py-4 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 active:scale-95 group"
            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.8)' }}
          >
            {isDemoLoading
              ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#818cf8' }} />
              : <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform" style={{ color: '#818cf8' }} />}
            Launch Evaluation Sandbox
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
