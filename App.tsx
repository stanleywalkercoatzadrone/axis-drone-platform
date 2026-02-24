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
import MasterInvoiceGenerator from './components/MasterInvoiceGenerator';
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
import AuditLogView from './components/AuditLogView';
import WeatherDashboard from './components/WeatherDashboard';
import IndustryReportsHub from './modules/ai-reporting/IndustryReportsHub';
import EnterpriseAIReporting from './modules/ai-reporting/EnterpriseAIReporting';

import OnboardingStart from './components/onboarding/OnboardingStart';
import OnboardingSetup from './components/onboarding/OnboardingSetup';
import OnboardingStep1 from './components/onboarding/OnboardingStep1';
import OnboardingStep2 from './components/onboarding/OnboardingStep2';
import OnboardingStep3 from './components/onboarding/OnboardingStep3';

import { Industry, InspectionReport, UserAccount, UserRole, DeploymentStatus } from './types';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { IndustryProvider, useIndustry } from './src/context/IndustryContext';
import { CountryProvider } from './src/context/CountryContext';
import { MissionProvider } from './src/context/MissionContext';
import { GlobalProvider } from './src/context/GlobalContext';
import IndustrySwitcher from './components/IndustrySwitcher';
import { isAdmin, isPilot } from './src/utils/roleUtils';

import apiClient from './src/services/apiClient';
import { PageShell } from './src/components/layout/PageShell';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const AppContent: React.FC = () => {
  const { user, login, logout, updateUser, isLoading } = useAuth();
  const { tLabel } = useIndustry();
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'view' | 'archives' | 'settings' | 'personnel' | 'analytics' | 'deployments' | 'users' | 'ai' | 'checklists' | 'my-tasks' | 'clients' | 'upload' | 'assets' | 'missions' | 'weather' | 'ai-engine' | 'ai-reports'>('dashboard');
  const [activeIndustry, setActiveIndustry] = useState<string>('solar');
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
    setActiveTab('create');
  };

  const onViewReport = (report: InspectionReport) => {
    setActiveReport(report);
    setActiveTab('view');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      <PageShell
        activeTab={activeTab}
        onNavigate={(tab, meta) => {
          if (tab === 'clients') setSelectedClient(null);
          if (tab === 'weather' && meta?.industry) setActiveIndustry(meta.industry.toLowerCase());
          if (tab === 'ai-engine' && meta?.industry) {
            // Map industry id → Industry enum value
            const industryMap: Record<string, any> = {
              solar: 'Solar', insurance: 'Insurance', construction: 'Construction',
              utilities: 'Utilities', telecom: 'Telecom'
            };
            setSelectedIndustry(industryMap[meta.industry] ?? null);
            setActiveReport(null);
          }
          // @ts-ignore - loose typing for now
          setActiveTab(tab as any);
        }}
        title={
          activeTab === 'dashboard' ? 'Mission Control' :
            activeTab === 'upload' ? 'Upload Center' :
              activeTab === 'analytics' ? 'Analytics Suite' :
                activeTab === 'ai-reports' ? 'AI Claims Intelligence' :
                  activeTab === 'create' || activeTab === 'ai-engine' ? `AI Report Generator` :
                    activeTab === 'archives' ? `${tLabel('report')}s` :
                      activeTab === 'deployments' ? `${tLabel('mission')} Terminal` :
                        activeTab === 'personnel' ? `${tLabel('stakeholder')}s` :
                          activeTab === 'users' ? 'User Management' :
                            activeTab === 'checklists' ? `${tLabel('workItem')}s` :
                              activeTab === 'clients' ? `${tLabel('client')} Management` :
                                activeTab === 'my-tasks' ? `My ${tLabel('workItem')}s` :
                                  activeTab === 'assets' ? 'Asset Grid' :
                                    activeTab === 'missions' ? `${tLabel('mission')}s` :
                                      activeTab === 'weather' ? 'Weather' :
                                        activeTab === 'settings' ? 'Configuration' : 'Viewer'
        }
      >
        <div className="animate-in fade-in duration-500 slide-in-from-bottom-2">
          {/* Dynamic Content */}
          {(activeTab === 'dashboard') && (
            <MissionControl />
          )}
          {activeTab === 'archives' && (
            <Dashboard onNewReport={startNewReport} onViewReport={onViewReport} isArchiveView={true} />
          )}
          {activeTab === 'upload' && (
            <UploadCenter />
          )}
          {activeTab === 'create' && (
            <ReportCreator initialIndustry={selectedIndustry} />
          )}
          {activeTab === 'ai-engine' && (
            <IndustryReportsHub
              key={`ai-engine-${activeIndustry}`}
              defaultIndustry={activeIndustry as any}
              singleIndustry={true}
            />
          )}
          {activeTab === 'view' && activeReport && (
            <ReportCreator initialIndustry={activeReport.industry} viewingReport={activeReport} onBack={() => setActiveTab('dashboard')} />
          )}
          {activeTab === 'settings' && user && (
            <SettingsView currentUser={user} onUpdateUser={updateUser} onLogout={handleLogout} />
          )}
          {activeTab === 'analytics' && <ReportingSuite />}
          {activeTab === 'ai-reports' && (
            <EnterpriseAIReporting />
          )}
          {activeTab === 'deployments' && <DeploymentTracker />}
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
          {activeTab === 'missions' && (
            <DeploymentTracker />
          )}
          {activeTab === 'weather' && (
            <WeatherDashboard
              key={`weather-${activeIndustry}`}
              industry={activeIndustry as any}
            />
          )}
        </div>
      </PageShell>
    </>
  );
};

const AppContentWrapper: React.FC<{ initialTab: any }> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  return (
    <PageShell
      activeTab={activeTab}
      onNavigate={(tab) => setActiveTab(tab)}
      title={activeTab === 'missions' ? 'Missions' : 'Viewer'}
    >
      <div className="animate-in fade-in duration-500 slide-in-from-bottom-2">
        {activeTab === 'missions' && (
          <DeploymentTracker />
        )}
      </div>
    </PageShell>
  );
};

const AuditLogRoute: React.FC = () => {
  const { user } = useAuth();
  return (
    <PageShell activeTab="settings" title="Audit Log">
      <AuditLogView currentUserRole={user?.role as any} />
    </PageShell>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MissionProvider>
          <GlobalProvider>
            <CountryProvider>
              <IndustryProvider>
                <Routes>
                  <Route path="/invoices/master/:deploymentId" element={<PageShell activeTab="deployments" title="Master Invoice Builder"><MasterInvoiceGenerator /></PageShell>} />
                  <Route path="/invoice/:token" element={<InvoiceView />} />
                  <Route path="/onboarding/:token" element={<OnboardingPortal />} />
                  <Route path="/set-password/:token" element={<SetPassword />} />
                  <Route path="/sites/:siteId/assets" element={
                    <PageShell activeTab="assets" title="Asset Grid">
                      <AssetGrid />
                    </PageShell>
                  } />
                  <Route path="/clients/new/start" element={<PageShell activeTab="clients" title="Client Onboarding"><OnboardingStart /></PageShell>} />
                  <Route path="/clients/new/setup" element={<PageShell activeTab="clients" title="Onboarding Setup"><OnboardingSetup /></PageShell>} />
                  <Route path="/clients/new/step-1" element={<PageShell activeTab="clients" title="Client Onboarding — Step 1"><OnboardingStep1 /></PageShell>} />
                  <Route path="/clients/new/step-2" element={<PageShell activeTab="clients" title="Client Onboarding — Step 2"><OnboardingStep2 /></PageShell>} />
                  <Route path="/clients/new/step-3" element={<PageShell activeTab="clients" title="Client Onboarding — Step 3"><OnboardingStep3 /></PageShell>} />
                  <Route path="/missions/active" element={<AppContentWrapper initialTab="missions" />} />
                  <Route path="/audit-log" element={<AuditLogRoute />} />
                  <Route path="/*" element={<AppContent />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </IndustryProvider>
            </CountryProvider>
          </GlobalProvider>
        </MissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
