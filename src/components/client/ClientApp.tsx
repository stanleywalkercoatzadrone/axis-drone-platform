import React, { useState } from 'react';
import ClientOverview from './overview/ClientOverview';
import ClientMissions from './missions/ClientMissions';
import ClientDeliverables from './deliverables/ClientDeliverables';
import ClientLBD from './lbd/ClientLBD';
import ClientMapViewer from './map/ClientMapViewer';
import { ThermalFaultDashboard } from './ThermalFaultDashboard';
import { EnergyLossDashboard } from './EnergyLossDashboard';
import { Activity, AlertTriangle, BarChart3, FileText, Map, Plane, Zap } from 'lucide-react';

type Tab = 'overview' | 'missions' | 'deliverables' | 'lbd' | 'map' | 'thermal' | 'energy';

const TABS: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'missions', label: 'Missions', icon: Plane },
    { key: 'deliverables', label: 'Deliverables', icon: FileText },
    { key: 'lbd', label: 'LBD', icon: AlertTriangle },
    { key: 'map', label: 'Map', icon: Map },
    { key: 'thermal', label: 'Thermal', icon: BarChart3 },
    { key: 'energy', label: 'Energy', icon: Zap },
];

const ClientApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const deploymentId = new URLSearchParams(window.location.search).get('deploymentId');

    const renderDeploymentRequired = () => (
        <div className="p-8 text-slate-400">
            Select a mission with a deployment ID to view this analysis.
        </div>
    );

    const renderTab = () => {
        switch (activeTab) {
            case 'missions':
                return <ClientMissions />;
            case 'deliverables':
                return <ClientDeliverables />;
            case 'lbd':
                return <ClientLBD />;
            case 'map':
                return <ClientMapViewer />;
            case 'thermal':
                return deploymentId ? <ThermalFaultDashboard deploymentId={deploymentId} /> : renderDeploymentRequired();
            case 'energy':
                return deploymentId ? <EnergyLossDashboard deploymentId={deploymentId} /> : renderDeploymentRequired();
            default:
                return <ClientOverview />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <div className="border-b border-white/10 bg-slate-900/80 px-6 py-3">
                <div className="flex flex-wrap gap-2">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = tab.key === activeTab;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                    active ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            {renderTab()}
        </div>
    );
};

export default ClientApp;
