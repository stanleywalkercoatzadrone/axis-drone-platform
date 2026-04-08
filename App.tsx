import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Settings,
  Archive,
  BarChart3,
  Calendar,
  Layers,
  ChevronRight,
  User,
  LogOut,
  PlusCircle,
  Search,
  Bell,
  Users,
  ShieldCheck,
  BrainCircuit,
  TrendingUp,
  Plus,
  FileText,
  List,
  CheckSquare
} from 'lucide-react';
import { MissionControl } from './src/components/dashboard/MissionControl';
import { PilotDashboard } from './components/dashboard/PilotDashboard';
import { WeatherWidget } from './src/components/widgets/WeatherWidget';
import WeatherDashboard from './components/WeatherDashboard';
import { UploadCenter } from './src/components/upload/UploadCenter';
import Dashboard from './components/Dashboard'; // Archive view
import ReportCreator from './components/ReportCreator';
import SettingsView from './components/SettingsView';
import Login from './components/Login';
import PersonnelTracker from './components/PersonnelTracker';
import AssetTracker from './components/AssetTracker';
import DeploymentTracker from './components/DeploymentTracker';
import ReportingSuite from './components/ReportingSuite';
import InvoiceView from './components/InvoiceView';
import OnboardingPortal from './components/OnboardingPortal';
import CandidateUploadPortal from './src/components/CandidateUploadPortal';
import UserManagement from './components/UserManagement';
import SetPassword from './components/SetPassword';
import ForcePasswordReset from './components/ForcePasswordReset';
import SystemAIView from './components/SystemAIView';
import WorkItemsDashboard from './components/WorkItemsDashboard';
import MyWorkItems from './components/MyWorkItems';
import { PilotFiles } from './components/PilotFiles';
import ClientList from './components/ClientList';
import ClientDetail from './components/ClientDetail';
import AssetDashboard from './components/AssetGrid/AssetDashboard';
import AssetGrid from './components/AssetGrid/AssetGrid';

// Solar Intelligence Dashboards
import { ThermalFaultDashboard } from './src/components/client/ThermalFaultDashboard';
import { EnergyLossDashboard } from './src/components/client/EnergyLossDashboard';
import { FaultReviewPanel } from './src/components/admin/FaultReviewPanel';
import { FaultReviewCenter } from './src/components/admin/FaultReviewCenter';

// Enterprise Phase 8+ Views
import { SessionsView } from './src/components/dashboard/SessionsView';
import { MissionTimelineView } from './src/components/dashboard/MissionTimelineView';
import { ThermalFaultsView } from './src/components/dashboard/ThermalFaultsView';
import { SolarCommandCenter } from './src/components/dashboard/SolarCommandCenter';
import { PilotPerformanceView } from './src/components/dashboard/PilotPerformanceView';
import { InvoicesDashboard } from './src/components/dashboard/InvoicesDashboard';
import { PayrollView } from './src/components/dashboard/PayrollView';
import { RevenueDashboard } from './src/components/dashboard/RevenueDashboard';
import { VendorExpensesDashboard } from './src/components/dashboard/VendorExpensesDashboard';


import OnboardingStart from './components/onboarding/OnboardingStart';
import OnboardingSetup from './components/onboarding/OnboardingSetup';
import OnboardingStep1 from './components/onboarding/OnboardingStep1';
import OnboardingStep2 from './components/onboarding/OnboardingStep2';

import { Industry, InspectionReport, UserAccount, UserRole } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IndustryProvider, useIndustry } from './context/IndustryContext';
import { MissionProvider } from './src/context/MissionContext';
import { GlobalProvider } from './src/context/GlobalContext';
import { CountryProvider } from './context/CountryContext';
import IndustrySwitcher from './components/IndustrySwitcher';
import { isAdmin, isPilot, isClient, isInHouse } from './src/utils/roleUtils';

// PRODUCTION DIRECTIVE V2 - STRICT PILOT COMPONENTS
import PilotDashboardV2 from './src/components/dashboard/v2/PilotDashboardV2';
import PilotUploadV2 from './src/components/dashboard/v2/PilotUploadV2';
import PilotWeatherV2 from './src/components/dashboard/v2/PilotWeatherV2';
import PilotIssuesV2 from './src/components/dashboard/v2/PilotIssuesV2';
import PilotChecklistV2 from './src/components/dashboard/v2/PilotChecklistV2';
import PilotNavV2 from './src/components/layout/v2/PilotNavV2';
import AIUploadCenter from './components/UploadCenter';
import ClientApp from './src/components/client/ClientApp';

import apiClient from './services/apiClient';
import { RequireRole } from './src/components/auth/RequireRole';
import { PageShell } from './src/components/layout/PageShell';
import AppShell from './AppShell';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const PilotAppV2: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pilot-dashboard' | 'pilot-checklists' | 'pilot-uploads' | 'weather' | 'pilot-issues'>('pilot-dashboard');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <PilotNavV2 activeTab={activeTab} onNavigate={(tab: any) => setActiveTab(tab)} />
      <main className="flex-1 overflow-y-auto w-full relative pt-14 md:pt-0 pb-16 md:pb-0">
        <div className="animate-in fade-in duration-500 slide-in-from-bottom-2 h-full">
          <Routes>
            <Route path="dashboard" element={<PilotDashboardV2 />} />
            <Route path="checklist/:id" element={<PilotChecklistV2 />} />
            <Route path="uploads/:id" element={<PilotUploadV2 />} />
            <Route path="upload-center" element={
              <div style={{ padding: '24px' }}><AIUploadCenter /></div>
            } />
            <Route path="weather/:id" element={<PilotWeatherV2 />} />
            <Route path="issues/:id" element={<PilotIssuesV2 />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, login, logout, updateUser, isLoading } = useAuth();
  const { currentIndustry, availableIndustries, tLabel } = useIndustry();
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'ai-studio' | 'ai-reports' | 'settings' | 'personnel' | 'analytics' |
    'missions' | 'users' | 'ai' | 'checklists' | 'my-tasks' | 'clients' | 'upload' |
    'assets' | 'weather' | 'my-files' | 'solar-intel' |
    // Enterprise Phase 8+ tabs
    'sessions' | 'timeline' | 'thermal-faults' | 'solar-command' | 'pilot-performance' |
    // Finance tabs
    'invoices' | 'payroll' | 'revenue' | 'vendor-expenses'
  >('dashboard');

  const [aiStudioSubTab, setAiStudioSubTab] = useState<'new' | 'archive'>('new');
  const [solarIntelSubTab, setSolarIntelSubTab] = useState<'thermal' | 'energy' | 'review'>('thermal');
  const [viewingReport, setViewingReport] = useState<InspectionReport | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);


  // Map IndustryKey ('solar', 'insurance', etc.) → Industry enum ('Solar', 'Insurance', etc.)
  const INDUSTRY_KEY_TO_ENUM: Record<string, Industry> = {
    solar: Industry.SOLAR,
    insurance: Industry.INSURANCE,
    utilities: Industry.UTILITIES,
    telecom: Industry.TELECOM,
    construction: Industry.CONSTRUCTION,
  };
  const activeIndustryEnum: Industry = (currentIndustry && INDUSTRY_KEY_TO_ENUM[currentIndustry]) || Industry.SOLAR;

  useEffect(() => {
    async function handleAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const refreshToken = params.get('refreshToken');

      // Only handle if tokens are present in URL (OAuth callback)
      if (token && refreshToken) {
        // Always clean the URL first to prevent tokens lingering in browser history
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          const response = await apiClient.get('/auth/me');
          if (response.data.success) {
            const userData = response.data.data;
            login(userData, token, refreshToken);
          }
        } catch (error) {
          console.error('Error handling auth callback:', error);
        }
      }
    }

    handleAuthCallback();
  }, [login]);

  const handleLogin = (newUser: UserAccount) => {
    // State is handled by AuthContext
    console.log('Login successful for:', newUser.email);
  };

  const handleLogout = () => {
    logout();
    setActiveTab('dashboard');
  };

  const startNewReport = (industry: Industry) => {
    setSelectedIndustry(industry);
    setViewingReport(null);
    setAiStudioSubTab('new');
    setActiveTab('ai-studio');
  };

  const onViewReport = (report: InspectionReport) => {
    setViewingReport(report);
    setAiStudioSubTab('new');
    setActiveTab('ai-studio');
  };

  // Show a full-screen loader while auth is initializing — prevents white flash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Initializing Axis Platform...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.forcePasswordReset) {
    return <ForcePasswordReset />;
  }

  // Pilots always route to the isolated V2 platform
  if (isPilot(user)) {
    return <Navigate to="/pilot/dashboard" replace />;
  }

  // Clients always route to the isolated Client Portal
  if (isClient(user)) {
    return <Navigate to="/client/overview" replace />;
  }

  return <AppShell />;
};



const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CountryProvider>
          <IndustryProvider>
            <MissionProvider>
              <GlobalProvider>
                <Routes>
                  {/* Specific route for secure guest view of invoices */}
                  <Route path="/invoice/:token" element={<InvoiceView />} />

                  {/* Candidate Upload Portal Route */}
                  <Route path="/candidate-portal/:token" element={<CandidateUploadPortal />} />

                  {/* Onboarding Portal Route */}
                  <Route path="/onboarding/:token" element={<OnboardingPortal />} />

                  {/* User Invitation / Password Set Route */}
                  <Route path="/set-password/:token" element={<SetPassword />} />

                  {/* Asset Grid Direct Route */}
                  <Route path="/sites/:siteId/assets" element={
                    <PageShell activeTab="assets" title="Asset Grid">
                      <AssetGrid />
                    </PageShell>
                  } />

                  {/* Client Onboarding Wizard */}
                  <Route path="/clients/new/start" element={<PageShell activeTab="clients" title="Client Onboarding"><OnboardingStart /></PageShell>} />
                  <Route path="/clients/new/setup" element={<PageShell activeTab="clients" title="Onboarding Setup"><OnboardingSetup /></PageShell>} />
                  <Route path="/clients/new/step-1" element={<PageShell activeTab="clients" title="Client Onboarding — Step 1"><OnboardingStep1 /></PageShell>} />
                  <Route path="/clients/new/step-2" element={<PageShell activeTab="clients" title="Client Onboarding — Step 2"><OnboardingStep2 /></PageShell>} />
                  <Route path="/clients/new/step-3" element={
                    <PageShell activeTab="clients" title="Client Onboarding — Step 3">
                      <div className="p-8 max-w-xl mx-auto mt-8">
                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-6">
                          <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider mb-1">Stakeholders & Permissions</h2>
                            <p className="text-slate-400 text-sm">Configure who can view this client's reports and data.</p>
                          </div>
                          <div className="space-y-4">
                            <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                              <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Primary Contact</p>
                              <input type="email" placeholder="contact@client.com" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                              <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Access Level</p>
                              <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                                <option>View Reports Only</option>
                                <option>View + Download Reports</option>
                                <option>Full Portal Access</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-3 pt-2">
                            <button onClick={() => window.history.back()} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all">Back</button>
                            <button className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all">Save & Finish</button>
                          </div>
                        </div>
                      </div>
                    </PageShell>
                  } />

                  {/* Pilot Isolated Platform — always active for pilot_technician role */}
                  <Route
                    path="/pilot/*"
                    element={
                      <RequireRole allowedRoles={['pilot_technician', 'pilot', 'field_operator', 'senior_inspector']}>
                        <PilotAppV2 />
                      </RequireRole>
                    }
                  />

                  {/* Client Isolated Portal */}
                  <Route
                    path="/client/*"
                    element={
                      <RequireRole allowedRoles={['client', 'client_user', 'customer', 'admin']}>
                        <ClientApp />
                      </RequireRole>
                    }
                  />

                  {/* Unauthorized fallback */}
                  <Route path="/unauthorized" element={
                    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white gap-4">
                      <div className="text-6xl">🔒</div>
                      <h1 className="text-2xl font-black uppercase tracking-widest">Access Denied</h1>
                      <p className="text-slate-500 text-sm">You do not have permission to view this page.</p>
                      <button onClick={() => window.location.href = '/'}
                        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm
                                   font-black uppercase tracking-widest transition-all">
                        Return Home
                      </button>
                    </div>
                  } />

                  {/* Explicit /login route — redirects to root if already logged in */}
                  <Route path="/login" element={<AppContent />} />

                  {/* Main platform routes */}
                  <Route path="/*" element={<AppContent />} />

                  {/* Generic catch-all */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </GlobalProvider>
            </MissionProvider>
          </IndustryProvider>
        </CountryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
