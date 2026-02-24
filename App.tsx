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
import { UploadCenter } from './src/components/upload/UploadCenter';
import Dashboard from './components/Dashboard'; // Legacy Dashboard (kept for Archives)
import ReportCreator from './components/ReportCreator';
import SettingsView from './components/SettingsView';
import Login from './components/Login';
import PersonnelTracker from './components/PersonnelTracker';
import AssetTracker from './components/AssetTracker';
import DeploymentTracker from './components/DeploymentTracker';
import ReportingSuite from './components/ReportingSuite';
import InvoiceView from './components/InvoiceView';
import OnboardingPortal from './components/OnboardingPortal';
import UserManagement from './components/UserManagement';
import SetPassword from './components/SetPassword';
import SystemAIView from './components/SystemAIView';
import WorkItemsDashboard from './components/WorkItemsDashboard';
import MyWorkItems from './components/MyWorkItems';
import ClientList from './components/ClientList';
import ClientDetail from './components/ClientDetail';
import AssetDashboard from './components/AssetGrid/AssetDashboard';
import AssetGrid from './components/AssetGrid/AssetGrid';

import OnboardingStart from './components/onboarding/OnboardingStart';
import OnboardingSetup from './components/onboarding/OnboardingSetup';
import OnboardingStep1 from './components/onboarding/OnboardingStep1';
import OnboardingStep2 from './components/onboarding/OnboardingStep2';

import { Industry, InspectionReport, UserAccount, UserRole } from './types';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { IndustryProvider, useIndustry } from './src/context/IndustryContext';
import { MissionProvider } from './src/context/MissionContext';
import { GlobalProvider } from './src/context/GlobalContext';
import { CountryProvider } from './src/context/CountryContext';
import IndustrySwitcher from './components/IndustrySwitcher';
import { isAdmin, isPilot } from './src/utils/roleUtils';

import apiClient from './src/services/apiClient';
import { PageShell } from './src/components/layout/PageShell';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const AppContent: React.FC = () => {
  const { user, login, logout, updateUser, isLoading } = useAuth();
  const { tLabel } = useIndustry();
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'ai-engine' | 'view' | 'ai-reports' | 'settings' | 'personnel' | 'analytics' | 'missions' | 'users' | 'ai' | 'checklists' | 'my-tasks' | 'clients' | 'upload' | 'assets' | 'weather'>('dashboard');
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [activeReport, setActiveReport] = useState<InspectionReport | null>(null);

  useEffect(() => {
    async function handleAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const refreshToken = params.get('refreshToken');

      // Only handle if tokens are present in URL (OAuth callback)
      if (token && refreshToken) {
        try {
          const response = await apiClient.get('/auth/me');
          if (response.data.success) {
            const userData = response.data.data;
            login(userData, token, refreshToken);
          }
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
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
    setActiveReport(null);
    setActiveTab('ai-engine');
  };

  const onViewReport = (report: InspectionReport) => {
    setActiveReport(report);
    setActiveTab('view');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Navigation Item Component (Legacy support for PageShell internal nav)
  // Note: PageShell now handles the sidebar navigation visually.

  return (
    <PageShell
      activeTab={activeTab}
      onNavigate={(tab) => {
        if (tab === 'clients') setSelectedClient(null);
        // @ts-ignore - loose typing for now
        setActiveTab(tab);
      }}
      title={
        activeTab === 'dashboard' ? 'Mission Control' :
          activeTab === 'upload' ? 'Enterprise Upload' :
            activeTab === 'analytics' ? 'Analytics Suite' :
              activeTab === 'ai-engine' ? `New ${tLabel('mission')}` :
                activeTab === 'ai-reports' ? `${tLabel('report')} Archive` :
                  activeTab === 'missions' ? `${tLabel('mission')} Terminal` :
                    activeTab === 'personnel' ? `${tLabel('stakeholder')}s` :
                      activeTab === 'users' ? 'User Management' :
                        activeTab === 'checklists' ? `${tLabel('workItem')}s` :
                          activeTab === 'clients' ? `${tLabel('client')} Management` :
                            activeTab === 'my-tasks' ? `My ${tLabel('workItem')}s` :
                              activeTab === 'assets' ? 'Asset Grid' :
                                activeTab === 'weather' ? 'Weather & Skies' :
                                  activeTab === 'settings' ? 'Configuration' : 'Viewer'
      }
    >
      <div className="animate-in fade-in duration-500 slide-in-from-bottom-2">
        {/* Dynamic Content */}
        {(activeTab === 'dashboard') && (
          <MissionControl />
        )}
        {activeTab === 'ai-reports' && (
          <Dashboard onNewReport={startNewReport} onViewReport={onViewReport} isArchiveView={true} />
        )}
        {activeTab === 'upload' && (
          <UploadCenter />
        )}
        {activeTab === 'ai-engine' && (
          <ReportCreator initialIndustry={selectedIndustry} />
        )}
        {activeTab === 'view' && activeReport && (
          <ReportCreator initialIndustry={activeReport.industry} viewingReport={activeReport} onBack={() => setActiveTab('dashboard')} />
        )}
        {activeTab === 'settings' && user && (
          <SettingsView currentUser={user} onUpdateUser={updateUser} onLogout={handleLogout} />
        )}
        {activeTab === 'analytics' && <ReportingSuite />}
        {activeTab === 'weather' && (
          <div className="p-20 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl mx-20 mt-10">
            Weather & Forecasting (Integration Coming Soon)
          </div>
        )}
        {activeTab === 'missions' && <DeploymentTracker />}
        {activeTab === 'clients' && (
          selectedClient ? (
            <ClientDetail clientId={selectedClient} onBack={() => setSelectedClient(null)} />
          ) : (
            <ClientList onSelectClient={setSelectedClient} />
          )
        )}
        {activeTab === 'personnel' && isAdmin(user) && <PersonnelTracker />}
        {activeTab === 'users' && isAdmin(user) && <UserManagement currentUser={user} />}
        {activeTab === 'ai' && isAdmin(user) && (
          <div className="p-8">
            <SystemAIView aiSensitivity={50} onSensitivityChange={() => { }} />
          </div>
        )}
        {activeTab === 'checklists' && isAdmin(user) && <WorkItemsDashboard />}
        {activeTab === 'my-tasks' && <MyWorkItems />}
        {activeTab === 'assets' && <AssetDashboard />}
      </div>
    </PageShell>
  );
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
                  <Route path="/clients/new/step-3" element={<PageShell activeTab="clients" title="Client Onboarding — Step 3"><div className="p-20 text-center text-slate-500">Step 3: Stakeholders & Permissions (Coming Soon)</div></PageShell>} />

                  <Route path="/clients/new/step-3" element={<PageShell activeTab="clients" title="Step 3"><div className="p-20 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl mx-20 mt-10">Step 3: Stakeholders & Permissions (Coming Next)</div></PageShell>} />
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
