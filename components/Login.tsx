
import React, { useState } from 'react';
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
import { UserAccount, UserRole, ADMIN_PASSKEY, InspectionReport, Industry, ReportTheme, Severity } from '../types';
import apiClient from '../src/services/apiClient';

interface LoginProps {
  onLogin: (user: UserAccount) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.FIELD_OPERATOR);
  const [accessToken, setAccessToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === 'signup' && (!fullName || !companyName || !accessToken || !jobTitle))) {
      setError(mode === 'signup' ? 'All mandatory enterprise fields are required.' : 'Identity credentials required.');
      return;
    }

    // Admin Passkey Validation
    if (mode === 'signup' && role === UserRole.ADMIN && accessToken !== ADMIN_PASSKEY) {
      setError('Invalid Admin Authorization Token. Access denied.');
      return;
    }

    setIsLoading(true);
    setError('');

    const loginData = { email, password };
    const signupData = { email, password, fullName, companyName, title: jobTitle };

    const attemptAuth = async () => {
      try {
        const response = await apiClient.post(
          mode === 'signin' ? '/auth/login' : '/auth/register',
          mode === 'signin' ? loginData : signupData
        );

        const { user, token, refreshToken } = response.data.data;

        localStorage.setItem('skylens_token', token);
        localStorage.setItem('skylens_refresh_token', refreshToken);
        localStorage.setItem('skylens_current_user', JSON.stringify(user));

        onLogin(user);
      } catch (err: any) {
        console.error('Auth error:', err);
        setError(err.response?.data?.message || 'Authentication failed. Please check your credentials.');
      } finally {
        setIsLoading(false);
      }
    };

    attemptAuth();
  };

  const handleDemoAccess = () => {
    setIsDemoLoading(true);
    setTimeout(() => {
      setIsDemoLoading(false);
      const demoUser: UserAccount = {
        id: 'demo-user',
        email: 'demo@axis.ai',
        fullName: 'Demo Principal',
        companyName: 'Axis Global',
        title: 'Lead Systems Architect',
        role: UserRole.ADMIN,
        driveLinked: true,
        driveFolder: 'Axis_Demo_Vault',
        googleEmail: 'demo.admin@google.com',
        accessToken: 'DEMO_TOKEN_UNRESTRICTED',
        createdAt: new Date().toISOString()
      };

      // Seed Demo Report
      const demoReport: InspectionReport = {
        id: 'rep-demo-001',
        rootId: 'root-demo-001',
        version: 1,
        history: [{
          version: 1,
          timestamp: new Date().toISOString(),
          author: 'Axis AI Core',
          summary: 'Initial Automated Audit',
          data: {}
        }],
        title: 'Solar Field Alpha - Unit 4 Inspection',
        client: 'CleanGrid Energy',
        date: new Date().toLocaleDateString(),
        industry: Industry.SOLAR,
        theme: ReportTheme.TECHNICAL,
        branding: {
          companyName: 'CleanGrid',
          primaryColor: '#f59e0b'
        },
        images: [{
          id: 'img-demo-001',
          url: '/demo-solar.png',
          annotations: [{
            id: 'anno-demo-001',
            label: 'Cell Micro-Fracture',
            description: 'Thermal anomaly detected on panel center. Likely caused by impact or thermal stress. Performance degradation: 12%.',
            severity: Severity.HIGH,
            confidence: 0.94,
            x: 43,
            y: 40,
            width: 15,
            height: 20,
            type: 'box',
            source: 'ai',
            color: '#ef4444'
          }],
          summary: 'Visual inspection reveals localized micro-fracturing on the center-right quadrant. Thermal overlay indicates localized hot-spotting exceeding 85°C.'
        }],
        config: {
          showExecutiveSummary: true,
          showSiteIntelligence: true,
          showStrategicAssessment: true,
          showCostAnalysis: true,
          showMaintenanceLog: true,
          showRiskAssessment: true
        },
        approvalStatus: 'Pending Review',
        summary: 'Critical hot-spotting detected on panel PF-42. Potential fire risk if left unaddressed. Replacement recommended.',
        recommendations: [
          'Immediate bypass of string to prevent further damage.',
          'Physical replacement of panel PF-42.',
          'Secondary drone pass under peak solar load to verify string health.'
        ],
        strategicAssessment: {
          reasoning: 'The detected micro-fracture is atypical for this site age and suggests mechanical impact. Failure to replace will lead to string-wide efficiency losses.',
          longTermRisks: ['Arc flash potential', 'Accelerated delamination'],
          operationalPriorities: ['Isolate String B', 'Inspect neighboring panels'],
          correctiveProtocols: [{
            issueType: 'Cell Micro-Fracture',
            procedure: ['Disconnect panel connectors', 'Remove mounting hardware', 'Install new OEM panel'],
            requiredHardware: ['OEM PV Module', 'MC4 Connectors'],
            safetyProtocol: 'Arc-flash rated PPE required.'
          }]
        }
      };

      const existingReports = JSON.parse(localStorage.getItem('skylens_reports') || '[]');
      if (!existingReports.find((r: any) => r.id === demoReport.id)) {
        localStorage.setItem('skylens_reports', JSON.stringify([demoReport, ...existingReports]));
      }

      onLogin(demoUser);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white flex overflow-hidden font-sans">
      {/* Visual Side Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative p-20 flex-col justify-between overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600 blur-[100px] rounded-full animate-pulse delay-700" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-16 animate-in slide-in-from-top duration-700">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-2xl shadow-blue-500/30">
              <Layout className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Axis</h1>
              <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.3em] mt-2">by CoatzadroneUSA</p>
            </div>
          </div>
          <h2 className="text-6xl font-black text-white leading-[1.05] tracking-tighter max-w-md">
            The Standard in <span className="text-blue-500">Aerial Audit</span> Intelligence.
          </h2>
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3 text-white/60 text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck className="w-5 h-5 text-blue-500" /> End-to-End Vaulting
          </div>
          <div className="flex items-center gap-3 text-white/60 text-[10px] font-black uppercase tracking-widest">
            <Zap className="w-5 h-5 text-indigo-500" /> Neural Edge Inference
          </div>
        </div>
      </div>

      {/* Identity Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50/50 overflow-y-auto">
        <div className="w-full max-w-md space-y-8 py-12 animate-in fade-in zoom-in duration-700">
          <div className="text-center lg:text-left mb-6">
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              {mode === 'signin' ? 'Secure Portal' : 'Fleet Registration'}
            </h3>
            <p className="text-slate-500 mt-3 font-medium uppercase text-[10px] tracking-widest opacity-60">
              {mode === 'signin' ? 'Verify your system access credentials.' : 'Initialize your authorized corporate identity profile.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl space-y-5 mb-6 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Enterprise Profile Data</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Entity</label>
                    <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nexus Grid" className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Clearance Tier</label>
                  <div className="relative">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="block w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                    >
                      {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                  <div className="relative"><Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Audit Lead" className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {role === UserRole.ADMIN ? 'Master Admin Passkey' : 'Master Access Token'}
                  </label>
                  <div className="relative">
                    <Key className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${role === UserRole.ADMIN ? 'text-blue-500' : 'text-slate-400'}`} />
                    <input
                      type={role === UserRole.ADMIN ? 'password' : 'text'}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder={role === UserRole.ADMIN ? '••••••••' : 'SKL-AUTH-V4'}
                      className={`block w-full pl-10 pr-4 py-3 bg-slate-50 border ${role === UserRole.ADMIN ? 'border-blue-200' : 'border-slate-200'} rounded-xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm`}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Identity</label>
                <div className="relative group"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@axis.ai" className="block w-full pl-10 pr-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Passphrase</label>
                <div className="relative group"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="block w-full pl-10 pr-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                </div>
              </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 flex items-center gap-3"><ShieldAlert className="w-4 h-4" /> {error}</div>}

            <button
              type="submit"
              disabled={isLoading || isDemoLoading}
              className="w-full bg-slate-900 text-white py-6 rounded-[2.25rem] font-black uppercase tracking-[0.2em] text-sm hover:bg-slate-800 transition-all shadow-2xl flex items-center justify-center gap-4 disabled:opacity-70 active:scale-95 mt-6 border-4 border-slate-900 hover:border-blue-600"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : mode === 'signin' ? (
                <>Enter Admin Portal <LogIn className="w-6 h-6" /></>
              ) : (
                <>Confirm Registration & Access <CheckCircle2 className="w-6 h-6" /></>
              )}
            </button>
          </form>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => window.location.href = '/api/auth/google'}
              className="w-full bg-white text-slate-700 py-4 rounded-[2.25rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-50 transition-all shadow-xl border border-slate-200 flex items-center justify-center gap-4 active:scale-95"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>
          </div>

          <div className="text-center pt-2">
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }} className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] hover:text-blue-700 transition-colors">
              {mode === 'signin' ? 'Provision New Corporate Identity' : 'Existing Operator Sign In'}
            </button>
          </div>

          <div className="relative py-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-[9px] uppercase font-black tracking-[0.5em] text-slate-400">
              <span className="bg-slate-50/50 px-4">Evaluation Bridge</span>
            </div>
          </div>
          <button onClick={handleDemoAccess} disabled={isLoading || isDemoLoading} className="w-full flex items-center justify-center gap-4 py-4 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 transition-all text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm disabled:opacity-50 active:scale-95 group">
            {isDemoLoading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Globe className="w-4 h-4 text-indigo-600 group-hover:rotate-12 transition-transform" />} Launch Evaluation Sandbox
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
