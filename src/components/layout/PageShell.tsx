import React, { ReactNode } from 'react';
import { ContextBar } from './ContextBar';
import { useGlobalContext } from '../../context/GlobalContext';
import { useAuth } from '../../context/AuthContext';
import { isAdmin, isPilot } from '../../utils/roleUtils';
import { LayoutDashboard, UploadCloud, Database, Users, Settings, Menu, X, Building, TrendingUp, Plus, Calendar, CheckSquare, ShieldCheck, BrainCircuit, List, LayoutGrid } from 'lucide-react';

interface PageShellProps {
    children: ReactNode;
    title?: string;
    actions?: ReactNode;
    activeTab?: string;
    onNavigate?: (tab: string) => void;
}

export const PageShell: React.FC<PageShellProps> = ({ children, title, actions, activeTab, onNavigate }) => {
    const { user } = useAuth();
    const { isSidebarOpen, toggleSidebar } = useGlobalContext();

    return (
        <div className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside
                className={`${isSidebarOpen ? 'w-64' : 'w-20'
                    } bg-slate-950 border-r border-slate-800 transition-all duration-300 flex flex-col z-40`}
            >
                {/* Logo Area */}
                <div className="h-16 flex items-center justify-center border-b border-slate-800">
                    <div className="bg-gradient-to-br from-cyan-500 to-blue-600 h-8 w-8 rounded-lg flex items-center justify-center shadow-glow">
                        <span className="font-bold text-white text-lg">A</span>
                    </div>
                    {isSidebarOpen && (
                        <span className="ml-3 font-bold text-lg tracking-tight">AXIS <span className="text-cyan-400">ENTERPRISE</span></span>
                    )}
                </div>

                {/* Nav Items */}
                <nav className="flex-1 py-6 space-y-1 px-3 overflow-y-auto">
                    {/* Main Section */}
                    <div className="mb-6">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Main</div>
                        <NavItem
                            icon={<LayoutDashboard />}
                            label="Mission Control"
                            active={activeTab === 'dashboard'}
                            onClick={() => onNavigate?.('dashboard')}
                        />
                        <NavItem
                            icon={<LayoutGrid />}
                            label="Asset Grid"
                            active={activeTab === 'assets'}
                            onClick={() => onNavigate?.('assets')}
                        />
                        <NavItem
                            icon={<TrendingUp />}
                            label="Analytics Suite"
                            active={activeTab === 'analytics'}
                            onClick={() => onNavigate?.('analytics')}
                        />
                        <NavItem
                            icon={<Plus />}
                            label="New Inspection"
                            active={activeTab === 'create'}
                            onClick={() => onNavigate?.('create')}
                        />
                        <NavItem
                            icon={<Database />}
                            label="Inspection Reports"
                            active={activeTab === 'archives'}
                            onClick={() => onNavigate?.('archives')}
                        />
                        <NavItem
                            icon={<Calendar />}
                            label="Mission Terminal"
                            active={activeTab === 'deployments'}
                            onClick={() => onNavigate?.('deployments')}
                        />
                        {(user && (isAdmin(user) || isPilot(user))) && (
                            <NavItem
                                icon={<CheckSquare />}
                                label="My Tasks"
                                active={activeTab === 'my-tasks'}
                                onClick={() => onNavigate?.('my-tasks')}
                            />
                        )}
                    </div>

                    {/* System Section */}
                    <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">System</div>
                        <NavItem
                            icon={<UploadCloud />}
                            label="Ingestion"
                            active={activeTab === 'ingestion'}
                            onClick={() => onNavigate?.('ingestion')}
                        />
                        <NavItem
                            icon={<Users />}
                            label="Stakeholders"
                            active={activeTab === 'personnel'}
                            onClick={() => onNavigate?.('personnel')}
                        />
                        <NavItem
                            icon={<Building />}
                            label="Clients"
                            active={activeTab === 'clients'}
                            onClick={() => onNavigate?.('clients')}
                        />
                        <NavItem
                            icon={<Settings />}
                            label="Settings"
                            active={activeTab === 'settings'}
                            onClick={() => onNavigate?.('settings')}
                        />
                        {user && isAdmin(user) && (
                            <>
                                <NavItem
                                    icon={<ShieldCheck />}
                                    label="User Management"
                                    active={activeTab === 'users'}
                                    onClick={() => onNavigate?.('users')}
                                />
                                <NavItem
                                    icon={<BrainCircuit />}
                                    label="AI Intelligence"
                                    active={activeTab === 'ai'}
                                    onClick={() => onNavigate?.('ai')}
                                />
                                <NavItem
                                    icon={<List />}
                                    label="Work Checklists"
                                    active={activeTab === 'checklists'}
                                    onClick={() => onNavigate?.('checklists')}
                                />
                            </>
                        )}
                    </div>
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={toggleSidebar}
                        className="mt-4 w-full flex items-center justify-center p-2 text-slate-500 hover:text-white transition-colors"
                    >
                        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
                {/* Global Context Bar */}
                <ContextBar />

                {/* Page Header (Optional) */}
                {(title || actions) && (
                    <header className="px-8 py-6 flex items-center justify-between border-b border-slate-900/50 bg-slate-950/50 backdrop-blur-sm sticky top-16 z-30">
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            {actions}
                        </div>
                    </header>
                )}

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

const NavItem = ({ icon, label, active = false, onClick }: { icon: ReactNode, label: string, active?: boolean, onClick?: () => void }) => {
    const { isSidebarOpen } = useGlobalContext();
    return (
        <button
            onClick={onClick}
            className={`flex items-center w-full p-3 rounded-lg transition-all duration-200 group ${active
                ? 'bg-slate-800/80 text-cyan-400 shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
        >
            <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
            </div>

            {isSidebarOpen && (
                <span className="ml-3 font-medium text-sm">{label}</span>
            )}

            {active && isSidebarOpen && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"></div>
            )}
        </button>
    );
};
