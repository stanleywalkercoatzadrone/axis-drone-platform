/**
 * AppShell.tsx — antiGravity Axis UI shell
 * Authenticated admin shell with full nav wiring to existing components.
 * Replaces the layout layer of App.tsx for admin/in-house users.
 * Mobile: pilot-style fixed top bar + bottom tab bar (md:hidden).
 * Desktop: full sidebar layout (hidden md:flex).
 */
import React, { useState, Component } from 'react';
import {
  LayoutDashboard, Radar, Users, Building,
  Settings as SettingsIcon, Bell, LogOut, ImageIcon, Menu, X, ChevronRight,
  PanelLeftClose, PanelLeftOpen, BrainCircuit, Zap, Sun, Thermometer, Image, ChevronLeft,
  Map as MapIcon, Box
} from 'lucide-react';

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

// ── Existing view components ────────────────────────────────────────────────
import DeploymentTracker from './components/DeploymentTracker';
import { MissionControl } from './src/components/dashboard/MissionControl';
import { SessionsView } from './src/components/dashboard/SessionsView';
import { MissionTimelineView } from './src/components/dashboard/MissionTimelineView';
import { useCountry } from './context/CountryContext';
import { isoToFlag } from './src/utils/countryFlag';
import WeatherDashboard from './components/WeatherDashboard';
import { ThermalFaultsView } from './src/components/dashboard/ThermalFaultsView';
import { SolarCommandCenter } from './src/components/dashboard/SolarCommandCenter';
import SystemAIView from './components/SystemAIView';
import Pix4DView from './components/Pix4DView';
import OrthomosaicView from './components/OrthomosaicView';
import UploadCenter from './components/UploadCenter';
import AIUploadsAdmin from './components/AIUploadsAdmin';
import PersonnelTracker from './components/PersonnelTracker';
import { PilotPerformanceView } from './src/components/dashboard/PilotPerformanceView';
import ClientList from './components/ClientList';
import ClientDetail from './components/ClientDetail';
import SettingsView from './components/SettingsView';
import UserManagement from './components/UserManagement';
import WorkItemsDashboard from './components/WorkItemsDashboard';
import MyWorkItems from './components/MyWorkItems';
import { InvoicesDashboard } from './src/components/dashboard/InvoicesDashboard';
import { VendorExpensesDashboard } from './src/components/dashboard/VendorExpensesDashboard';
import { RevenueDashboard } from './src/components/dashboard/RevenueDashboard';
import OperationalProtocolsView from './components/OperationalProtocolsView';
import MediaGallery from './components/MediaGallery';
import OrgOnboardingView from './components/OrgOnboardingView';
import MissionIntelligenceWorkspace from './src/pages/MissionIntelligenceWorkspace';
import IndustryReportsHub from './modules/ai-reporting/IndustryReportsHub';

// ── Types ───────────────────────────────────────────────────────────────────
type NavKey =
  | 'dashboard' | 'sessions' | 'mission-timeline' | 'weather' | 'upload-center'
  | 'thermal-faults' | 'solar-command' | 'ai-studio' | 'pix4d'
  | 'pilot-directory' | 'performance'
  | 'clients' | 'org-onboarding' | 'system-settings' | 'user-iam' | 'neural-ai'
  | 'protocol-lists' | 'checklist-items'
  | 'invoices' | 'vendor-expenses' | 'revenue'
  | 'media' | 'ai-uploads' | 'orthomosaic'
  | 'mission-intelligence' | 'reports';

type NavItem = { key: NavKey; label: string; badge?: string; icon?: React.ElementType };
type NavGroup = { title: string; items: NavItem[] }

// ── Navigation definition ───────────────────────────────────────────────────
const NAV: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { key: 'dashboard',               label: 'Mission Terminal' },
      { key: 'sessions',                label: 'Sessions' },
      { key: 'mission-timeline',        label: 'Mission Timeline' },
      { key: 'weather',                 label: 'Weather' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { key: 'mission-intelligence',     label: 'Intelligence Hub', icon: BrainCircuit },
      { key: 'reports',          label: 'Enterprise Reports', icon: Box },
      { key: 'thermal-faults',   label: 'Thermal Analysis', icon: Thermometer },
      { key: 'solar-command',    label: 'Solar Command',    icon: Sun },
    ],
  },
  {
    title: 'Pilots',
    items: [
      { key: 'pilot-directory',  label: 'Pilot Directory' },
      { key: 'performance',      label: 'Performance' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { key: 'invoices',         label: 'Invoices' },
      { key: 'vendor-expenses',  label: 'Vendor Expenses' },
      { key: 'revenue',          label: 'Revenue' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { key: 'clients',          label: 'Clients' },
      { key: 'org-onboarding',   label: 'Onboard Organization' },
      { key: 'user-iam',         label: 'User IAM' },
      { key: 'neural-ai',        label: 'Neural AI' },
      { key: 'protocol-lists',   label: 'Operational Protocols' },
      { key: 'checklist-items',  label: 'My Checklist Items' },
      { key: 'system-settings',  label: 'System Settings' },
    ],
  },
];

// ── Mobile bottom tabs (5 primary sections) ─────────────────────────────────
const MOBILE_TABS: { key: NavKey; label: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }> }[] = [
  { key: 'dashboard',       label: 'Home',    Icon: LayoutDashboard },
  { key: 'sessions',        label: 'Sessions',Icon: Radar },
  { key: 'pilot-directory', label: 'Pilots',  Icon: Users },
  { key: 'clients',         label: 'Clients', Icon: Building },
  { key: 'media',           label: 'Media',   Icon: ImageIcon },
];

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ── AppShell ────────────────────────────────────────────────────────────────
export default function AppShell() {
  const { user, logout } = useAuth();
  const { tLabel, currentIndustry } = useIndustry();
  const { countries, activeCountryId, setActiveCountryId, activeCountry } = useCountry();

  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const countryDropdownRef = React.useRef<HTMLDivElement>(null);

  const [activeKey, setActiveKey]       = useState<NavKey>('dashboard');
  const [clientFilter, setClientFilter] = useState('All Clients');
  const [site, setSite]                 = useState('All Sites');
  const [search, setSearch]             = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    setMobileDrawerOpen(false);
    if (key !== 'clients') setSelectedClientId(null);
  };

  const handleCountrySelect = (id: string | null) => {
    setActiveCountryId(id);
    setIsCountryDropdownOpen(false);
    navigate('dashboard');
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
    'upload-center':         'Upload Center',
    'ai-uploads':            'AI Uploads Monitor',
    'media':                 'Media Gallery',
    'dashboard':             'Mission Terminal',
    'mission-intelligence':  'Mission Intelligence',
    'reports':               'Enterprise Reports',
    'sessions':              'Sessions',
    'mission-timeline':      'Mission Timeline',
    'weather':               'Weather',
    'thermal-faults':        'Thermal Faults',
    'solar-command':         'Solar Command',
    'ai-studio':             'AI Studio',
    'pilot-directory':       'Pilot Directory',
    'performance':           'Performance',
    'clients':               'Clients',
    'org-onboarding':        'Onboard Organization',
    'system-settings':       'System Settings',
    'user-iam':              'User IAM',
    'neural-ai':             'Neural AI',
    'protocol-lists':        'Operational Protocols',
    'checklist-items':       'My Checklist Items',
    'invoices':              'Invoices',
    'vendor-expenses':       'Vendor Expenses',
    'revenue':               'Revenue',
    'pix4d':                 '3D Engine',
    'orthomosaic':           'Orthomosaic Processing',
  };

  function renderView() {
    switch (activeKey) {
      case 'mission-intelligence': return <MissionIntelligenceWorkspace />;
      case 'reports':              return <IndustryReportsHub />;
      case 'upload-center':  return <UploadCenter />;  /* deprecated — kept for deep links */
      case 'ai-uploads':      return <AIUploadsAdmin />;  /* deprecated — kept for deep links */
      case 'media':           return <MediaGallery />;
      case 'dashboard':        return <DeploymentTracker countryFilter={activeCountryId} countryIsoCode={activeCountry?.iso_code ?? null} />;
      case 'sessions':         return <SessionsView />;
      case 'mission-timeline': return <MissionTimelineView />;
      case 'weather':          return <WeatherDashboard industry={(currentIndustry || 'solar') as any} />;
      case 'thermal-faults':   return <ThermalFaultsView />;
      case 'solar-command':    return <SolarCommandCenter />;
      case 'ai-studio':        return <SystemAIView />;
      case 'pix4d':            return <Pix4DView />;
      case 'orthomosaic':      return <OrthomosaicView />;

      case 'neural-ai':
        return (
          <div style={{ padding: '2rem', color: '#94a3b8', textAlign: 'center', marginTop: '4rem' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Neural AI</p>
            <p style={{ fontSize: 12, color: '#64748b' }}>Neural inference module — coming soon. Use AI Studio for current AI analysis.</p>
          </div>
        );
      case 'pilot-directory':  return <PersonnelTracker />;
      case 'performance':      return <PilotPerformanceView />;
      case 'clients':
        if (selectedClientId) {
          return <ClientDetail clientId={selectedClientId} onBack={() => setSelectedClientId(null)} />;
        }
        return <ClientList onSelectClient={handleClientSelect} />;
      case 'org-onboarding':   return <OrgOnboardingView />;
      case 'invoices':         return <InvoicesDashboard />;
      case 'vendor-expenses':  return <VendorExpensesDashboard />;
      case 'revenue':          return <RevenueDashboard />;
      case 'protocol-lists':   return <OperationalProtocolsView />;
      case 'checklist-items':  return <MyWorkItems />;
      case 'system-settings':  return <SettingsView />;
      case 'user-iam':         return user ? <UserManagement currentUser={user} /> : null;
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
      <div style={{
        display: isPWA ? 'flex' : 'none',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 56,
        alignItems: 'center', padding: '0 16px', gap: 12,
        background: '#0f172a', borderBottom: '1px solid #1e293b'
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
      <nav style={{
        display: isPWA ? 'flex' : 'none',
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: '#0f172a', borderTop: '1px solid #1e293b'
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
              background: '#0f172a', borderRight: '1px solid #1e293b',
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
              {NAV.flatMap(g => g.items).map((item) => {
                const isActive = item.key === activeKey;
                const Icon = (item as any).icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key as NavKey)}
                    title={item.label}
                    aria-label={item.label}
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
              {NAV.map((group) => (
                <div key={group.title} className="ag-nav-group">
                  <div className="ag-nav-title">{group.title}</div>
                  <div className="ag-nav-list" role="group" aria-label={group.title}>
                    {group.items.map((item) => {
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
                            {item.label}
                          </span>
                          {item.badge && <span className="ag-badge">{item.badge}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          )}

          {/* User footer */}
          {!sidebarCollapsed && (
            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--stroke)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-sm)' }}>
                <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email || 'Admin'}
                </div>
                <button
                  className="ag-icon-btn"
                  onClick={logout}
                  aria-label="Log out"
                  title="Log out"
                  style={{ width: 32, height: 32, borderRadius: 8 }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="ag-main">
          {/* Desktop topbar REMOVED from browser — page title bar below provides context */}


          {/* Page content — add top/bottom padding on mobile for bars */}


          <main id="ag-main" className={`ag-content ${isPWA ? 'pt-14 pb-16 md:pt-0 md:pb-0' : ''}`} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div className="ag-content-inner">
              {renderContent()}
            </div>
          </main>
        </div>

      </div>
    </div>
  );
}
