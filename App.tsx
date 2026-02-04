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
import { Industry, InspectionReport, UserAccount, UserRole } from './types';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { IndustryProvider, useIndustry } from './src/context/IndustryContext';
import IndustrySwitcher from './components/IndustrySwitcher';
import { isAdmin, isPilot } from './src/utils/roleUtils';

import apiClient from './src/services/apiClient';
import { PageShell } from './src/components/layout/PageShell';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const AppContent: React.FC = () => {
  const { user, login, logout, updateUser, isLoading } = useAuth();
  const { tLabel } = useIndustry();
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'view' | 'archives' | 'settings' | 'personnel' | 'analytics' | 'deployments' | 'users' | 'ai' | 'checklists' | 'my-tasks' | 'clients' | 'ingestion' | 'assets'>('dashboard');
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
          activeTab === 'ingestion' ? 'Enterprise Upload' :
            activeTab === 'analytics' ? 'Analytics Suite' :
              activeTab === 'create' ? `New ${tLabel('mission')}` :
                activeTab === 'archives' ? `${tLabel('report')}s` :
                  activeTab === 'deployments' ? `${tLabel('mission')} Terminal` :
                    activeTab === 'personnel' ? `${tLabel('stakeholder')}s` :
                      activeTab === 'users' ? 'User Management' :
                        activeTab === 'checklists' ? `${tLabel('workItem')}s` :
                          activeTab === 'clients' ? `${tLabel('client')} Management` :
                            activeTab === 'my-tasks' ? `My ${tLabel('workItem')}s` :
                              activeTab === 'assets' ? 'Asset Grid' :
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
        {activeTab === 'ingestion' && (
          <UploadCenter />
        )}
        {activeTab === 'create' && (
          <ReportCreator initialIndustry={selectedIndustry} />
        )}
        {activeTab === 'view' && activeReport && (
          <ReportCreator initialIndustry={activeReport.industry} viewingReport={activeReport} onBack={() => setActiveTab('dashboard')} />
        )}
        {activeTab === 'settings' && user && (
          <SettingsView currentUser={user} onUpdateUser={updateUser} onLogout={handleLogout} />
        )}
        {activeTab === 'analytics' && <ReportingSuite />}
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
      </div>
    </PageShell>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <IndustryProvider>
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

            {/* Main platform routes */}
            <Route path="/*" element={<AppContent />} />

            {/* Generic catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </IndustryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
