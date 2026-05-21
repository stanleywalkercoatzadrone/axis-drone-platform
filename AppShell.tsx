/**
 * AppShell.tsx — antiGravity Axis UI shell
 * Authenticated admin shell with full nav wiring to existing components.
 * Replaces the layout layer of App.tsx for admin/in-house users.
 * Mobile: pilot-style fixed top bar + bottom tab bar (md:hidden).
 * Desktop: full sidebar layout (hidden md:flex).
 */
import React, { useState, Component, useEffect } from 'react';
import {
  LayoutDashboard, Radar, Users, Building,
  Settings as SettingsIcon, Bell, LogOut, ImageIcon, Menu, X, ChevronRight, ChevronDown,
  PanelLeftClose, PanelLeftOpen, BrainCircuit, Zap, Sun, Thermometer, Image, ChevronLeft,
  Map as MapIcon, Box, Globe, MapPin
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ── Per-view error boundary — isolates crashes without killing the shell nav ──
interface EBState { hasError: boolean; error?: Error }
class ViewErrorBoundary extends Component<{ viewKey: string; children: React.ReactNode }, EBState> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ViewErrorBoundary] Crash in view "${this.props.viewKey}":`, error);
    console.error('[ViewErrorBoundary] Component stack:', info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem 2rem', textAlign: 'center', marginTop: '2rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
            Something went wrong in <strong>{this.props.viewKey}</strong>
          </p>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.1em'
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import './src/styles/shell.css';
import { useAuth } from './context/AuthContext';
import { useIndustry } from './context/IndustryContext';
import { useMission } from './src/context/MissionContext';

// ── Existing view components ────────────────────────────────────────────────
import DeploymentTracker from './src/components/DeploymentTracker';
import { MissionControl } from './src/components/dashboard/MissionControl';

import { useCountry } from './context/CountryContext';
import { isoToFlag } from './src/utils/countryFlag';
import WeatherDashboard from './src/components/WeatherDashboard';
import { InvoicesDashboard } from './src/components/dashboard/InvoicesDashboard';
import { ThermalFaultsView } from './src/components/dashboard/ThermalFaultsView';
import { SolarCommandCenter } from './src/components/dashboard/SolarCommandCenter';
import SystemAIView from './src/components/SystemAIView';
import UploadCenter from './src/components/UploadCenter';
import AIUploadsAdmin from './src/components/AIUploadsAdmin';
import PersonnelTracker from './src/components/PersonnelTracker';
import { PilotPerformanceView } from './src/components/dashboard/PilotPerformanceView';
import ClientList from './src/components/ClientList';
import ClientDetail from './src/components/ClientDetail';
import SettingsView from './src/components/SettingsView';
import UserManagement from './src/components/UserManagement';
import WorkItemsDashboard from './src/components/WorkItemsDashboard';
import MyWorkItems from './src/components/MyWorkItems';
import OperationalProtocolsView from './src/components/OperationalProtocolsView';
import MediaGallery from './src/components/MediaGallery';
import OrgOnboardingView from './src/components/OrgOnboardingView';
import MissionIntelligenceWorkspace from './src/pages/MissionIntelligenceWorkspace';
import IntelligenceHub from './src/components/IntelligenceHub';
import ExpensesView from './src/components/ExpensesView';
import PilotPayrollView from './src/components/PilotPayrollView';
import PilotApplications from './src/components/PilotApplications';
import { PilotNetworkAdmin } from './src/components/PilotNetworkAdmin';
import ConstructionDashboard from './modules/construction-monitoring/ConstructionDashboard';
import OrthomosaicView from './src/components/OrthomosaicView';
import PilotInterestInquiry from './src/components/PilotInterestInquiry';

// ── Types ───────────────────────────────────────────────────────────────────
type NavKey =
  | 'dashboard' | 'weather'
  | 'intelligence' | 'mission-intelligence'
  | 'pilot-directory' | 'performance'
  | 'payroll' | 'vendor-expenses'
  | 'clients' | 'org-onboarding' | 'system-settings' | 'user-iam' | 'neural-ai'
  | 'protocol-lists' | 'checklist-items'
  | 'media' | 'uploads' | 'pilot-applications' | 'pilot-network-admin' | 'construction' | 'orthomosaic' | 'interest-inquiry';

type NavItem = { key: NavKey; label: string; badge?: string; icon?: React.ElementType; adminOnly?: boolean };
type NavGroup = { title: string; items: NavItem[] }

// ── Navigation definition ───────────────────────────────────────────────────
const NAV: NavGroup[] = [
  {
    title: 'nav.operations',
    items: [
      { key: 'dashboard',  label: 'nav.missionTerminal' },
      { key: 'weather',    label: 'nav.weather' },
    ],
  },
  {
    title: 'nav.intelligenceGroup',
    items: [
      { key: 'mission-intelligence', label: 'nav.missionIntelligence', icon: BrainCircuit },
      { key: 'intelligence',         label: 'nav.intelligence',         icon: BrainCircuit },
      { key: 'neural-ai',            label: 'nav.neuralAI' },
    ],
  },
  {
    title: 'nav.pilots',
    items: [
      { key: 'pilot-network-admin',  label: 'nav.pilotNetworkAdmin' },
      { key: 'pilot-applications',   label: 'nav.applicationPackets', adminOnly: true },
      { key: 'pilot-directory',      label: 'nav.pilotRoster' },
      { key: 'performance',          label: 'nav.performance' },
      { key: 'interest-inquiry',     label: 'nav.interestInquiry', adminOnly: true },
    ],
  },
  {
    title: 'nav.mediaUploads',
    items: [
      { key: 'uploads',      label: 'nav.pilotUploadsLabel' },
      { key: 'orthomosaic',  label: 'nav.orthomosaic' },
      { key: 'media',        label: 'nav.mediaGallery' },
    ],
  },
  {
    title: 'nav.finance',
    items: [
      { key: 'payroll',         label: 'nav.pilotPayroll',   adminOnly: true },
      { key: 'vendor-expenses', label: 'nav.expenses',       adminOnly: true },
    ],
  },
  {
    title: 'nav.administration',
    items: [
      { key: 'clients',         label: 'nav.clients' },
      { key: 'org-onboarding',  label: 'nav.onboardOrg' },
      { key: 'user-iam',        label: 'nav.userIAM' },
      { key: 'protocol-lists',  label: 'nav.operationalProtocols', adminOnly: true },
      { key: 'checklist-items', label: 'nav.myChecklist' },
      { key: 'system-settings', label: 'nav.systemSettings' },
    ],
  },
];

// Keys of groups that contain the active nav key (for auto-expand on load)
const getGroupTitleForKey = (key: NavKey): string | null => {
  for (const g of NAV) {
    if (g.items.some(i => i.key === key)) return g.title;
  }
  return null;
};

// ── Mobile bottom tabs ───────────────────────────────────────────────────────
const MOBILE_TABS: { key: NavKey; label: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }> }[] = [
  { key: 'dashboard',       label: 'Home',         Icon: LayoutDashboard },
  { key: 'intelligence',    label: 'Intelligence', Icon: BrainCircuit },
  { key: 'pilot-directory', label: 'Pilots',       Icon: Users },
  { key: 'clients',         label: 'Clients',      Icon: Building },
  { key: 'media',           label: 'Media',        Icon: ImageIcon },
];

const LANGUAGES = [
  { code:'en', label:'English', flag:'🇺🇸' },
  { code:'es', label:'Español', flag:'🇲🇽' },
  { code:'pt', label:'Português', flag:'🇧🇷' },
  { code:'fr', label:'Français', flag:'🇫🇷' },
  { code:'de', label:'Deutsch', flag:'🇩🇪' },
  { code:'ja', label:'日本語', flag:'🇯🇵' },
  { code:'zh', label:'中文', flag:'🇨🇳' },
  { code:'ar', label:'العربية', flag:'🇸🇦' },
  { code:'hi', label:'हिंदी', flag:'🇮🇳' },
  { code:'ko', label:'한국어', flag:'🇰🇷' },
];

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ── AppShell ────────────────────────────────────────────────────────────────
export default function AppShell() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user, logout } = useAuth();
  const { tLabel } = useIndustry();
  const { countries, activeCountryId, setActiveCountryId, activeCountry } = useCountry();
  const { activeMission, clearActiveMission } = useMission();
  const userRole = (user?.role || '').toLowerCase();
  const userIsAdmin = userRole.includes('admin') || userRole.includes('superadmin');
  const [langOpen, setLangOpen] = useState(false);

  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const countryDropdownRef = React.useRef<HTMLDivElement>(null);

  const [activeKey, setActiveKey] = useState<NavKey>(() => {
    const saved = localStorage.getItem('axis_active_nav');
    const validKeys: NavKey[] = [
      'dashboard', 'weather', 'media',
      'intelligence', 'mission-intelligence',
      'pilot-directory', 'performance',
      'payroll', 'vendor-expenses',
      'clients', 'org-onboarding', 'system-settings',
      'user-iam', 'neural-ai', 'protocol-lists', 'checklist-items',
      'pilot-applications', 'pilot-network-admin', 'uploads', 'construction', 'orthomosaic', 'interest-inquiry'
    ];
    return (saved && validKeys.includes(saved as NavKey)) ? (saved as NavKey) : 'dashboard';
  });
  const [clientFilter, setClientFilter] = useState('All Clients');
  const [site, setSite]                 = useState('All Sites');
  const [search, setSearch]             = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Collapsible group state — default all collapsed, auto-expand active group ─
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('axis-nav-expanded');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    // Default: expand only the group containing the active key
    const saved = localStorage.getItem('axis_active_nav') as NavKey | null;
    const activeGroup = saved ? getGroupTitleForKey(saved as NavKey) : getGroupTitleForKey('dashboard');
    return activeGroup ? new Set([activeGroup]) : new Set();
  });

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      localStorage.setItem('axis-nav-expanded', JSON.stringify([...next]));
      return next;
    });
  };

  // ── Global glassmorphism injection ──────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'ag-glassmorphism';
    style.textContent = `
      @keyframes ag-mesh-drift {
        0%   { background-position: 0% 0%; }
        50%  { background-position: 100% 100%; }
        100% { background-position: 0% 0%; }
      }

      html, body, #root {
        background-color: #020617 !important;
        background-image:
          radial-gradient(at 0% 0%, rgba(14, 165, 233, 0.18) 0px, transparent 50%),
          radial-gradient(at 100% 0%, rgba(79, 70, 229, 0.18) 0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(14, 165, 233, 0.12) 0px, transparent 50%),
          radial-gradient(at 0% 100%, rgba(79, 70, 229, 0.12) 0px, transparent 50%) !important;
        background-size: 200% 200% !important;
        animation: ag-mesh-drift 30s ease infinite !important;
        background-attachment: fixed !important;
      }

      /* Sidebar glass */
      .ag .ag-sidebar {
        background: rgba(10, 16, 33, 0.55) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        border-right: 1px solid rgba(255,255,255,0.06) !important;
      }

      /* All panels — apply backdrop blur only to top-level panels, not deeply nested divs */
      .ag-content > div > div[class*="bg-slate-900"],
      .ag-content > div > div[class*="bg-slate-800"],
      .ag-content > div[class*="bg-slate-900"],
      .ag-content > div[class*="bg-slate-800"],
      .ag-content-inner > div[class*="bg-slate-900"],
      .ag-content-inner > div[class*="bg-slate-800"],
      .ag-content-inner > section[class*="bg-slate-900"],
      .ag-content-inner > section[class*="bg-slate-800"] {
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.04) !important;
      }

      /* Translate solid background-colors to semi-transparent */
      div.bg-slate-900, section.bg-slate-900 { background-color: rgba(15,23,42,0.45) !important; }
      div.bg-slate-800, section.bg-slate-800 { background-color: rgba(30,41,59,0.55) !important; }
      /* NOTE: bg-slate-950 is intentionally excluded — it wraps the scroll container */

      /* Opacity variants */
      [class$="bg-slate-900\/80"], [class*="bg-slate-900\/80 "] { background-color: rgba(15,23,42,0.65) !important; }
      [class$="bg-slate-800\/80"], [class*="bg-slate-800\/80 "] { background-color: rgba(30,41,59,0.72) !important; }
      [class$="bg-slate-900\/60"], [class*="bg-slate-900\/60 "] { background-color: rgba(15,23,42,0.40) !important; }
      [class$="bg-slate-800\/60"], [class*="bg-slate-800\/60 "] { background-color: rgba(30,41,59,0.50) !important; }
      [class$="bg-slate-900\/50"], [class*="bg-slate-900\/50 "] { background-color: rgba(15,23,42,0.30) !important; }
      [class$="bg-slate-800\/50"], [class*="bg-slate-800\/50 "] { background-color: rgba(30,41,59,0.38) !important; }
      [class$="bg-slate-800\/40"], [class*="bg-slate-800\/40 "] { background-color: rgba(30,41,59,0.28) !important; }

      /* Glass borders */
      [class*="border-slate-700"], [class*="border-slate-800"] {
        border-color: rgba(255,255,255,0.07) !important;
      }
    `;
    if (!document.getElementById('ag-glassmorphism')) {
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById('ag-glassmorphism');
      if (el) el.remove();
    };
  }, []);

  // Detect PWA standalone mode — only show mobile bars when installed as PWA
  const [isPWA] = useState(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
     (window.navigator as any).standalone === true)
  );

  const handleClientSelect = (id: string) => {
    setSelectedClientId(id);
    setActiveKey('clients');
  };

  const navigate = (key: NavKey) => {
    setActiveKey(key);
    localStorage.setItem('axis_active_nav', key);
    setMobileDrawerOpen(false);
    if (key !== 'clients') setSelectedClientId(null);
    // Auto-expand the group containing the target key
    const groupTitle = getGroupTitleForKey(key);
    if (groupTitle) {
      setExpandedGroups(prev => {
        if (prev.has(groupTitle)) return prev;
        const next = new Set(prev);
        next.add(groupTitle);
        localStorage.setItem('axis-nav-expanded', JSON.stringify([...next]));
        return next;
      });
    }
  };

  const handleCountrySelect = (id: string | null) => {
    setActiveCountryId(id);
    setIsCountryDropdownOpen(false);
    // Stay on current view — country is a filter, not a nav action
  };

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pageLabel: Record<NavKey, string> = {
    'dashboard':             'Mission Terminal',
    'weather':               'Weather',
    'media':                 'Media Gallery',
    'uploads':               'Pilot Uploads',
    'pilot-applications':    'Pilot Applications',
    'pilot-network-admin':   'Pilot Network Applications',
    'intelligence':          'AI Intelligence Hub',
    'mission-intelligence':  'Mission Intelligence',
    'pilot-directory':       'Pilot Roster',
    'performance':           'Performance',
    'payroll':               'Pilot Payroll',
    'vendor-expenses':       'Vendor & Expenses',
    'clients':               'Clients',
    'org-onboarding':        'Onboard Organization',
    'system-settings':       'System Settings',
    'user-iam':              'User IAM',
    'neural-ai':             'Neural AI',
    'protocol-lists':        'Operational Protocols',
    'checklist-items':       'My Checklist Items',
    'construction':          'Construction Monitoring',
    'orthomosaic':           'Orthomosaic',
    'interest-inquiry':     'Interest Inquiry',
  };

  function renderView() {
    switch (activeKey) {
      case 'dashboard':            return <DeploymentTracker countryFilter={activeCountryId} countryIsoCode={activeCountry?.iso_code ?? null} />;
      case 'weather':              return <WeatherDashboard />;
      case 'construction':         return <ConstructionDashboard />;
      case 'media':                return <MediaGallery />;
      case 'intelligence':         return <IntelligenceHub />;
      case 'mission-intelligence': return <MissionIntelligenceWorkspace />;
      case 'pilot-directory':      return <PersonnelTracker />;
      case 'performance':          return <PilotPerformanceView />;
      case 'payroll':              return <PilotPayrollView />;
      case 'vendor-expenses':      return <ExpensesView />;
      case 'pilot-applications':   return <PilotApplications />;
      case 'pilot-network-admin':  return <PilotNetworkAdmin />;
      case 'uploads':             return <AIUploadsAdmin />;
      case 'orthomosaic':         return <OrthomosaicView />;
      case 'interest-inquiry':    return <PilotInterestInquiry />;
      case 'neural-ai':         return <SystemAIView />;
      case 'clients':
        if (selectedClientId) {
          return <ClientDetail clientId={selectedClientId} onBack={() => setSelectedClientId(null)} />;
        }
        return <ClientList onSelectClient={handleClientSelect} />;
      case 'org-onboarding':   return <OrgOnboardingView />;
      case 'protocol-lists':
        if (!userIsAdmin) return (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>Admin Access Required</p>
            <p style={{ fontSize: 12, color: '#64748b', maxWidth: 280, margin: '0 auto' }}>
              Managing operational protocols is restricted to admin users.
            </p>
          </div>
        );
        return <OperationalProtocolsView />;
      case 'checklist-items':  return <MyWorkItems />;
      case 'system-settings':  return <SettingsView />;
      case 'user-iam':         return <UserManagement />;
      default:
        return (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>No Data Yet</p>
            <p style={{ fontSize: 12, color: '#64748b', maxWidth: 280, margin: '0 auto' }}>
              This section will populate as your team logs activity. Check back after your first mission.
            </p>
          </div>
        );
    }
  }

  function renderContent() {
    return (
      <ViewErrorBoundary key={activeKey} viewKey={pageLabel[activeKey] ?? activeKey}>
        {renderView()}
      </ViewErrorBoundary>
    );
  }

  return (
    <div className="ag">
      <a href="#ag-main" className="ag-skip">Skip to content</a>

      {/* ── Mobile top bar ────────────────────────────────── */}
      <div className="ag-mobile-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 56,
        alignItems: 'center', padding: '0 16px', gap: 12,
        background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        {/* Hamburger — opens full nav drawer */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open navigation"
          style={{
            background: 'none', border: 'none', padding: 6, cursor: 'pointer',
            color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0
          }}
        >
          <Menu size={22} />
        </button>
        <div style={{
          background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', borderRadius: 12, width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0
        }}>
          <span style={{ fontWeight: 900, color: '#fff', fontSize: 16 }}>A</span>
        </div>
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontWeight: 900, color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Axis <span style={{ color: '#60a5fa' }}>Enterprise</span>
          </span>
          <span style={{ fontWeight: 700, color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Admin</span>
        </div>
        {/* Right side: user chip + logout */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {user && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
              background: '#1e293b', border: '1px solid #334155', borderRadius: 8
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, background: 'rgba(59,130,246,0.2)',
                border: '1px solid rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 900, color: '#60a5fa', fontSize: 10
              }}>
                {(user.email || 'A').charAt(0).toUpperCase()}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#cbd5e1', maxWidth: 70,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {user.email?.split('@')[0] || 'Admin'}
              </span>
            </div>
          )}
          <button onClick={logout} aria-label="Log out" style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8, color: '#f87171', fontSize: 10, fontWeight: 900,
            textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer'
          }}>
            <LogOut size={13} /> Out
          </button>
        </div>
      </div>

      {/* ── Mobile bottom tab bar (pilot-style) ─────────────────────────── */}
      <nav className="ag-mobile-bottombar" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        {MOBILE_TABS.map(({ key, label, Icon }) => {
          const isActive = activeKey === key;
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, padding: '8px 0', minHeight: 56,
                background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
                color: isActive ? '#60a5fa' : '#64748b', transition: 'color 0.15s'
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 32, height: 2, background: '#60a5fa', borderRadius: 999
                }} />
              )}
              <Icon size={20} style={{ filter: isActive ? 'drop-shadow(0 0 6px rgba(96,165,250,0.6))' : 'none' }} />
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Mobile full-nav drawer ───────────────────────── */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, left: 0, bottom: 0, width: 280,
              background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(24px)', borderRight: '1px solid rgba(255,255,255,0.05)',
              overflowY: 'auto', display: 'flex', flexDirection: 'column',
              animation: 'slideInLeft 0.2s ease'
            }}
          >
            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px', borderBottom: '1px solid #1e293b' }}>
              <span style={{ fontWeight: 900, color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Navigation</span>
              <button onClick={() => setMobileDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            {/* All nav groups */}
            <div style={{ flex: 1, padding: '12px 8px' }}>
              {NAV.map(group => (
                <div key={group.title} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.2em', padding: '0 8px', marginBottom: 4 }}>
                    {group.title}
                  </div>
                  {group.items.map(item => {
                    const isActive = item.key === activeKey;
                    return (
                      <button
                        key={item.key}
                        onClick={() => navigate(item.key)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', background: isActive ? 'rgba(59,130,246,0.15)' : 'none',
                          border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                          borderRadius: 10, cursor: 'pointer', color: isActive ? '#60a5fa' : '#94a3b8',
                          fontSize: 13, fontWeight: isActive ? 700 : 500, textAlign: 'left', marginBottom: 2
                        }}
                      >
                        {item.label}
                        {isActive && <ChevronRight size={14} />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* Drawer footer */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b' }}>
              <button onClick={logout} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10,
                color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.1em'
              }}>
                <LogOut size={14} /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}


      <div className={`ag-grid${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>

        {/* Sidebar — hidden on mobile, collapsible on desktop */}
        <aside
          className={`ag-sidebar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
          aria-label="Axis navigation"
        >
          {/* Logo row + collapse toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: sidebarCollapsed ? '0 0 12px' : '0 var(--space-sm) 12px', marginBottom: 4 }}>
            {!sidebarCollapsed && (
              <div className="ag-logo" aria-label="Axis Enterprise" style={{ padding: 0 }}>
                <div className="ag-logo-mark" aria-hidden="true" />
                <div>
                  <div className="ag-logo-title">Axis Enterprise</div>
                  <div className="ag-logo-sub">Inspection Platform</div>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand' : 'Collapse'}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)',
                flexShrink: 0, marginLeft: sidebarCollapsed ? 0 : 'auto',
                transition: 'background 0.15s'
              }}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
            </button>
          </div>

          {/* Country Selector */}
          {!sidebarCollapsed && (
            <div className="px-3 pb-4" ref={countryDropdownRef}>
              <div className="relative">
                <button
                  onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                  className="w-full flex items-center justify-between bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80 hover:border-slate-600 transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  aria-haspopup="listbox"
                  aria-expanded={isCountryDropdownOpen}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-base leading-none">
                      {activeCountryId
                        ? isoToFlag(countries.find(c => c.id === activeCountryId)?.iso_code)
                        : '🌍'}
                    </span>
                    <span className="truncate">
                      {activeCountryId 
                        ? (countries.find(c => c.id === activeCountryId)?.name || 'Global Overview') 
                        : 'Global Overview'}
                    </span>
                  </span>
                  <svg 
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isCountryDropdownOpen ? 'rotate-180' : ''}`} 
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isCountryDropdownOpen && (
                  <div 
                    className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl shadow-black/40 outline-none"
                    role="listbox"
                  >
                    <button
                      onClick={() => handleCountrySelect(null)}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                        !activeCountryId ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700/80 hover:text-white'
                      }`}
                      role="option"
                      aria-selected={!activeCountryId}
                    >
                      Global Overview
                    </button>
                    {countries.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleCountrySelect(c.id)}
                        className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-t border-slate-700/30 ${
                          activeCountryId === c.id ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700/80 hover:text-white'
                        }`}
                        role="option"
                        aria-selected={activeCountryId === c.id}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base leading-none">{isoToFlag(c.iso_code)}</span>
                          <span>{c.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nav — collapsed shows icon dots, expanded shows full labels */}
          {sidebarCollapsed ? (
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', paddingTop: 4 }}>
              {NAV.flatMap(g => g.items).filter(item => !item.adminOnly || userIsAdmin).map((item) => {
                const isActive = item.key === activeKey;
                const Icon = (item as any).icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key as NavKey)}
                    title={t(item.label)}
                    aria-label={t(item.label)}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      width: '100%', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? 'rgba(96,165,250,0.15)' : 'transparent',
                      border: isActive ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
                      borderRadius: 8, cursor: 'pointer',
                      color: isActive ? 'var(--brand)' : 'var(--muted)',
                      transition: 'background 0.15s, color 0.15s'
                    }}
                  >
                    {Icon ? <Icon size={15} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? 'var(--brand)' : 'var(--muted)', display: 'block' }} />}
                  </button>
                );
              })}
            </nav>
          ) : (
            <nav className="ag-nav">
              {NAV.map((group) => {
                const visibleItems = group.items.filter(item => !item.adminOnly || userIsAdmin);
                if (visibleItems.length === 0) return null;
                const isExpanded = expandedGroups.has(group.title);
                const hasActive = visibleItems.some(item => item.key === activeKey);
                return (
                  <div key={group.title} className="ag-nav-group">
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className="ag-nav-group-header"
                      aria-expanded={isExpanded}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px 4px', background: 'none', border: 'none',
                        cursor: 'pointer', borderRadius: 6,
                      }}
                    >
                      <span className="ag-nav-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {hasActive && !isExpanded && (
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block', flexShrink: 0 }} />
                        )}
                        {t(group.title)}
                      </span>
                      <ChevronDown
                        size={12}
                        style={{
                          color: 'var(--muted)', flexShrink: 0,
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease'
                        }}
                      />
                    </button>
                    {isExpanded && (
                      <div className="ag-nav-list" role="group" aria-label={t(group.title)}>
                        {visibleItems.map((item) => {
                          const isActive = item.key === activeKey;
                          return (
                            <button
                              key={item.key}
                              className={cn('ag-nav-btn', isActive && 'ag-nav-btn-active')}
                              onClick={() => navigate(item.key as NavKey)}
                              aria-current={isActive ? 'page' : undefined}
                            >
                              <span className="ag-nav-left">
                                <span className={cn('ag-nav-dot', isActive && 'ag-nav-dot-active')} aria-hidden="true" />
                                {t(item.label)}
                              </span>
                              {item.badge && <span className="ag-badge">{item.badge}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          )}

          {/* User footer + Language picker */}
          {!sidebarCollapsed && (
            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--stroke)' }}>
              {/* Active Mission Context Indicator */}
              {activeMission.id && (
                <div style={{ padding: '0 var(--space-sm)', marginBottom: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 10px',
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 8,
                  }}>
                    <MapPin size={11} color="#60a5fa" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {activeMission.title || 'Active Mission'}
                    </span>
                    <button
                      onClick={clearActiveMission}
                      title="Clear mission context"
                      style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#475569', lineHeight: 1, flexShrink: 0 }}
                    >✕</button>
                  </div>
                </div>
              )}
              {/* Language selector */}
              <div style={{ padding: '0 var(--space-sm)', marginBottom: 10, position: 'relative' }}>
                <button
                  onClick={() => setLangOpen(o => !o)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 10px', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8,
                    color: '#94a3b8', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.08em'
                  }}
                >
                  <Globe size={12} />
                  {LANGUAGES.find(l => l.code === i18n.language)?.flag || '🌐'}&nbsp;
                  {LANGUAGES.find(l => l.code === i18n.language)?.label || 'Language'}
                  <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.5 }}>▾</span>
                </button>
                {langOpen && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0,
                    background: 'rgba(30, 41, 59, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                    overflow: 'hidden', zIndex: 100, marginBottom: 4,
                    boxShadow: '0 -8px 24px rgba(0,0,0,0.4)'
                  }}>
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => { i18n.changeLanguage(lang.code); setLangOpen(false); localStorage.setItem('i18nextLng', lang.code); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', background: i18n.language === lang.code ? 'rgba(96,165,250,0.12)' : 'none',
                          border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                          color: i18n.language === lang.code ? '#60a5fa' : '#94a3b8',
                          fontSize: 12, fontWeight: i18n.language === lang.code ? 700 : 500,
                          cursor: 'pointer', textAlign: 'left'
                        }}
                      >
                        <span>{lang.flag}</span> {lang.label}
                        {i18n.language === lang.code && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-sm)' }}>
                <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email || 'Admin'}
                </div>
                <button
                  className="ag-icon-btn"
                  onClick={logout}
                  aria-label={t('common.logOut')}
                  title={t('common.logOut')}
                  style={{ width: 32, height: 32, borderRadius: 8 }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 text-slate-100" style={{ minHeight: 0 }}>
          {/* Desktop topbar REMOVED from browser — page title bar below provides context */}


          {/* Page content — add top/bottom padding on mobile for bars */}


          <main id="ag-main" className="ag-content ag-content-mobile-padding" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div className="ag-content-inner">
              {renderContent()}
            </div>
          </main>
        </div>

      </div>
    </div>
  );
}
