import React, { useState } from 'react';
import { Sun, ChevronRight, LayoutDashboard, Map, TrendingUp, CheckSquare, Thermometer, Package, FileText, PlusCircle, BarChart3, Layers } from 'lucide-react';
import { useMediaDeliverable } from '../../src/context/MediaDeliverableContext';

import SiteListPage from './pages/SiteListPage';
import SiteDashboard from './pages/SiteDashboard';
import ProjectIntakePage from './pages/ProjectIntakePage';
import MapViewerPage from './pages/MapViewerPage';
import ConstructionProgressPage from './pages/ConstructionProgressPage';
import QAQCPage from './pages/QAQCPage';
import ThermalPage from './pages/ThermalPage';
import AssetRegistryPage from './pages/AssetRegistryPage';
import ReportGeneratorPage from './pages/ReportGeneratorPage';

type Tab = 'dashboard' | 'map' | 'progress' | 'qaqc' | 'thermal' | 'assets' | 'reports' | 'intake';

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { id: 'dashboard', label: 'Dashboard',  icon: <LayoutDashboard size={15} /> },
  { id: 'map',       label: 'Map',        icon: <Map size={15} /> },
  { id: 'progress',  label: 'Progress',   icon: <TrendingUp size={15} /> },
  { id: 'qaqc',      label: 'QA/QC',      icon: <CheckSquare size={15} /> },
  { id: 'thermal',   label: 'Thermal',    icon: <Thermometer size={15} /> },
  { id: 'assets',    label: 'Assets',     icon: <Package size={15} /> },
  { id: 'reports',   label: 'Reports',    icon: <FileText size={15} /> },
  { id: 'intake',    label: 'Intake',     icon: <PlusCircle size={15} /> },
];

const SolarIntelligenceHub: React.FC = () => {
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [activeSiteName, setActiveSiteName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { navigateToTab, setActiveSolarSite } = useMediaDeliverable();

  const handleSelectSite = (id: string, name: string) => {
    setActiveSiteId(id);
    setActiveSiteName(name);
    setActiveTab('dashboard');
  };

  const handleBackToList = () => {
    setActiveSiteId(null);
    setActiveSiteName('');
    setActiveTab('dashboard');
  };

  const handleNavigate = (tab: string) => {
    setActiveTab(tab as Tab);
  };

  const renderActivePage = () => {
    if (!activeSiteId) return null;
    switch (activeTab) {
      case 'dashboard':
        return <SiteDashboard siteId={activeSiteId} onNavigate={handleNavigate} />;
      case 'map':
        return <MapViewerPage siteId={activeSiteId} />;
      case 'progress':
        return <ConstructionProgressPage siteId={activeSiteId} />;
      case 'qaqc':
        return <QAQCPage siteId={activeSiteId} />;
      case 'thermal':
        return <ThermalPage siteId={activeSiteId} />;
      case 'assets':
        return <AssetRegistryPage siteId={activeSiteId} />;
      case 'reports':
        return <ReportGeneratorPage siteId={activeSiteId} />;
      case 'intake':
        return (
          <ProjectIntakePage
            siteId={activeSiteId}
            onSurveyCreated={() => setActiveTab('dashboard')}
          />
        );
      default:
        return <SiteDashboard siteId={activeSiteId} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* ── Header ── */}
      <header
        style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(51,65,85,0.8)',
        }}
        className="sticky top-0 z-40"
      >
        <div className="px-6 py-4 flex items-center gap-4">
          {/* Icon + Title */}
          <div className="flex items-center gap-3">
            <div
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                boxShadow: '0 0 20px rgba(245,158,11,0.4)',
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <Sun size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-tight">Solar Farm Intelligence</h1>
              <p className="text-slate-400 text-xs">Photogrammetry → Analysis → Action</p>
            </div>
          </div>

          {/* Breadcrumb when viewing a site */}
          {activeSiteId && (
            <div className="flex items-center gap-2 ml-4">
              <ChevronRight size={14} className="text-slate-600" />
              <button
                onClick={handleBackToList}
                className="text-slate-400 text-sm hover:text-white transition-colors"
              >
                Portfolio
              </button>
              <ChevronRight size={14} className="text-slate-600" />
              <span className="text-blue-400 text-sm font-medium">{activeSiteName}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Cross-module shortcuts — set solar context then navigate */}
            {activeSiteId && (
              <>
                <button
                  onClick={() => {
                    setActiveSolarSite(activeSiteId, activeSiteName);
                    navigateToTab('reports');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 rounded-lg transition-all"
                >
                  <BarChart3 size={12} /> Reports
                </button>
                <button
                  onClick={() => {
                    setActiveSolarSite(activeSiteId, activeSiteName);
                    navigateToTab('orthomosaic');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-all"
                >
                  <Layers size={12} /> Orthomosaic
                </button>
                <button
                  onClick={handleBackToList}
                  className="px-3 py-1.5 text-xs text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all"
                >
                  ← Back to Portfolio
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab bar (only when viewing a site) */}
        {activeSiteId && (
          <div
            style={{ borderTop: '1px solid rgba(51,65,85,0.5)' }}
            className="px-6 flex items-center gap-1 overflow-x-auto"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={
                    isActive
                      ? {
                          borderBottom: '2px solid #3b82f6',
                          color: '#3b82f6',
                        }
                      : { borderBottom: '2px solid transparent' }
                  }
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? ''
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto">
        {!activeSiteId ? (
          <SiteListPage onSelectSite={handleSelectSite} />
        ) : (
          <div className="p-0">{renderActivePage()}</div>
        )}
      </main>
    </div>
  );
};

export default SolarIntelligenceHub;
