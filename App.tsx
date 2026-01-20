
import React, { useState, useEffect } from 'react';
import {
  Layout,
  LayoutDashboard,
  FileText,
  Settings,
  Plus,
  LogOut,
  User,
  ShieldCheck,
  Command,
  Search,
  Bell,
  Users,
  TowerControl,
  TrendingUp,
  Calendar
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import ReportCreator from './components/ReportCreator';
import SettingsView from './components/SettingsView';
import Login from './components/Login';
import PersonnelTracker from './components/PersonnelTracker';
import AssetTracker from './components/AssetTracker';
import DeploymentTracker from './components/DeploymentTracker';
import ReportingSuite from './components/ReportingSuite';
import InvoiceView from './components/InvoiceView';
import UserManagement from './components/UserManagement';
import { Industry, InspectionReport, UserAccount, UserRole } from './types';

import apiClient from './src/services/apiClient';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<UserAccount | null>(() => {
    const savedUser = localStorage.getItem('skylens_current_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'view' | 'archives' | 'settings' | 'personnel' | 'analytics' | 'deployments' | 'users'>('dashboard');
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [activeReport, setActiveReport] = useState<InspectionReport | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const refreshToken = params.get('refreshToken');

      if (token && refreshToken) {
        localStorage.setItem('skylens_token', token);
        localStorage.setItem('skylens_refresh_token', refreshToken);

        try {
          const response = await apiClient.get('/auth/me');
          const userData = response.data.data;
          setUser(userData);
          localStorage.setItem('skylens_current_user', JSON.stringify(userData));

          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      }
    };

    handleAuthCallback();
  }, []);

  const handleLogin = (newUser: UserAccount) => {
    setUser(newUser);
    localStorage.setItem('skylens_current_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('skylens_current_user');
    setActiveTab('dashboard');
  };

  const updateUser = (updatedUser: UserAccount) => {
    setUser(updatedUser);
    localStorage.setItem('skylens_current_user', JSON.stringify(updatedUser));
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

  // Navigation Item Component
  const NavItem = ({ id, icon: Icon, label, onClick }: { id: string, icon: any, label: string, onClick: () => void }) => (
    <button
      data-tab={id}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id
        ? 'bg-slate-100 text-slate-900 border border-slate-200/50'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }`}
    >
      <Icon className={`w-4 h-4 ${activeTab === id ? 'text-blue-600' : 'text-slate-400'}`} />
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-white font-sans text-slate-900 overflow-hidden">
      {/* Refined Navigation Rail */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0 z-20">
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-8 px-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">AXIS</h1>
              <p className="text-[10px] font-medium text-slate-500">by Coatzadrone</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="px-2 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Main</div>
            <NavItem id="dashboard" icon={LayoutDashboard} label="Overview" onClick={() => setActiveTab('dashboard')} />
            <NavItem id="analytics" icon={TrendingUp} label="Analytics Suite" onClick={() => setActiveTab('analytics')} />
            <NavItem id="create" icon={Plus} label="New Inspection" onClick={() => { setSelectedIndustry(null); setActiveReport(null); setActiveTab('create'); }} />
            <NavItem id="archives" icon={FileText} label="Reports" onClick={() => setActiveTab('archives')} />
            <NavItem id="deployments" icon={Calendar} label="Mission Terminal" onClick={() => setActiveTab('deployments')} />
            <NavItem id="personnel" icon={Users} label="Personnel Registry" onClick={() => setActiveTab('personnel')} />
          </div>

          <div className="mt-8 space-y-1">
            <div className="px-2 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">System</div>
            {(user.role === UserRole.ADMIN || user.role === 'ADMIN') && (
              <NavItem id="users" icon={Users} label="User Management" onClick={() => setActiveTab('users')} />
            )}
            <NavItem id="settings" icon={Settings} label="Configuration" onClick={() => setActiveTab('settings')} />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/30">
          <div className="flex items-center gap-3 px-2 py-1 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-white shadow-sm overflow-hidden">
              {user.googlePicture ? (
                <img src={user.googlePicture} className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-1.5 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user.fullName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.title ? `${user.title} @ ` : ''}{user.companyName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-red-600 hover:border-red-100 hover:bg-red-50/50 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center text-sm font-medium text-slate-500">
              <span className="hover:text-slate-900 cursor-pointer transition-colors">Platform</span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-slate-900">
                {activeTab === 'dashboard' ? 'Overview' :
                  activeTab === 'analytics' ? 'Analytics Suite' :
                    activeTab === 'create' ? 'New Inspection' :
                      activeTab === 'archives' ? 'Reports' :
                        activeTab === 'deployments' ? 'Mission Terminal' :
                          activeTab === 'personnel' ? 'Personnel Registry' :
                            activeTab === 'users' ? 'User Management' :
                              activeTab === 'settings' ? 'Configuration' : 'Viewer'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search assets..."
                className="pl-9 pr-4 py-1.5 text-sm bg-slate-100 border-none rounded-md w-64 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">⌘K</span>
              </div>
            </div>

            <div className="w-px h-6 bg-slate-200 mx-1"></div>

            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500 slide-in-from-bottom-2">
            {/* Dynamic Content */}
            {(activeTab === 'dashboard' || activeTab === 'archives') && (
              <Dashboard onNewReport={startNewReport} onViewReport={onViewReport} isArchiveView={activeTab === 'archives'} />
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
            {activeTab === 'users' && user && (user.role === UserRole.ADMIN || user.role === 'ADMIN') && (
              <UserManagement currentUser={user} />
            )}
            {activeTab === 'deployments' && <DeploymentTracker />}
            {activeTab === 'personnel' && <PersonnelTracker />}
            {activeTab === 'analytics' && <ReportingSuite />}
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Specific route for secure guest view of invoices */}
        <Route path="/invoice/:token" element={<InvoiceView />} />

        {/* Main platform routes */}
        <Route path="/*" element={<AppContent />} />

        {/* Generic catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
