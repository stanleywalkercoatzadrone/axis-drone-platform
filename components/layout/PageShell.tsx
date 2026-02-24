import React, { ReactNode } from 'react';
import { ContextBar } from './ContextBar';
import { useGlobalContext } from '../../context/GlobalContext';
import { useAuth } from '../../context/AuthContext';
import { useIndustry } from '../../context/IndustryContext';
import { isAdmin, isPilot, isMissionControl } from '../../utils/roleUtils';
import {
    LayoutDashboard,
    UploadCloud,
    Database,
    Users,
    Settings,
    Menu,
    X,
    Building,
    TrendingUp,
    Plus,
    Calendar,
    CheckSquare,
    ShieldCheck,
    BrainCircuit,
    List,
    LayoutGrid,
    Radar,
    Crosshair
} from 'lucide-react';

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
    const { tLabel } = useIndustry();

    return (
        <div className="flex h-screen bg-slate-900 text-slate-50 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside
                className={`${isSidebarOpen ? 'w-64' : 'w-20'
                    } bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col z-40`}
            >
                {/* Logo Area */}
                <div className="h-16 flex items-center justify-center border-b border-slate-800">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 h-8 w-8 rounded-lg flex items-center justify-center shadow-glow">
                        <span className="font-bold text-white text-lg">A</span>
                    </div>
                    {isSidebarOpen && (
                        <span className="ml-3 font-bold text-lg tracking-tight uppercase">Axis <span className="text-blue-500">Enterprise</span></span>
                    )}
                </div>

                {/* Nav Items */}
                <nav className="flex-1 py-6 space-y-1 px-3 overflow-y-auto scrollbar-none">
                    {/* Main Section */}
                    <div className="mb-6">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-3 mb-4 opacity-50">Operations</div>
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
                        {(user && (isAdmin(user) || isMissionControl(user) || isPilot(user))) && (
                            <NavItem
                                icon={<Radar />}
                                label="Missions"
                                active={activeTab === 'active-missions'}
                                onClick={() => onNavigate?.('active-missions')}
                            />
                        )}
                        <NavItem
                            icon={<TrendingUp />}
                            label="Analytics Suite"
                            active={activeTab === 'analytics'}
                            onClick={() => onNavigate?.('analytics')}
                        />
                        <NavItem
                            icon={<Plus />}
                            label={`New ${tLabel('mission')}`}
                            active={activeTab === 'create'}
                            onClick={() => onNavigate?.('create')}
                        />
                        <NavItem
                            icon={<Database />}
                            label={`${tLabel('report')} Archives`}
                            active={activeTab === 'archives'}
                            onClick={() => onNavigate?.('archives')}
                        />
                        <NavItem
                            icon={<Calendar />}
                            label={`${tLabel('mission')} Terminal`}
                            active={activeTab === 'deployments'}
                            onClick={() => onNavigate?.('deployments')}
                        />
                        <NavItem
                            icon={<UploadCloud />}
                            label="Uploads"
                            active={activeTab === 'upload'}
                            onClick={() => onNavigate?.('upload')}
                        />
                        {(user && (isAdmin(user) || isPilot(user))) && (
                            <NavItem
                                icon={<CheckSquare />}
                                label={`My ${tLabel('workItem')}s`}
                                active={activeTab === 'my-tasks'}
                                onClick={() => onNavigate?.('my-tasks')}
                            />
                        )}
                    </div>

                    {/* System Section */}
                    <div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-3 mb-4 opacity-50">Settings</div>
                        <NavItem
                            icon={<Users />}
                            label={tLabel('stakeholder')}
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
                            label="System Settings"
                            active={activeTab === 'settings'}
                            onClick={() => onNavigate?.('settings')}
                        />
                        {user && isAdmin(user) && (
                            <>
                                <div className="h-px bg-slate-800/50 my-6 mx-3" />
                                <NavItem
                                    icon={<ShieldCheck />}
                                    label="User IAM"
                                    active={activeTab === 'users'}
                                    onClick={() => onNavigate?.('users')}
                                />
                                <NavItem
                                    icon={<BrainCircuit />}
                                    label="Neural AI"
                                    active={activeTab === 'ai'}
                                    onClick={() => onNavigate?.('ai')}
                                />
                                <NavItem
                                    icon={<List />}
                                    label="Protocol Lists"
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
                        className="w-full flex items-center justify-center p-3 text-slate-500 hover:text-blue-500 hover:bg-slate-900 rounded-xl transition-all duration-300"
                    >
                        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-900">
                {/* Global Context Bar */}
                <ContextBar />

                {/* Page Header (Optional) */}
                {(title || actions) && (
                    <header className="px-10 py-8 flex items-center justify-between border-b border-slate-800/30 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-30">
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">{title}</h1>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1 opacity-50">Active Viewport Protocol</p>
                        </div>
                        <div className="flex items-center space-x-6">
                            {actions}
                        </div>
                    </header>
                )}

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-10 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
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
            className={`flex items-center w-full p-4 rounded-xl transition-all duration-300 group mb-1 ${active
                ? 'bg-blue-600/10 text-blue-500 shadow-[inset_0_0_20px_rgba(37,99,235,0.1)] border border-blue-500/20'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
        >
            <div className={`transition-all duration-300 ${active ? 'scale-110 text-blue-500' : 'group-hover:scale-110 group-hover:text-blue-400'}`}>
                {React.cloneElement(icon as React.ReactElement<any>, { size: 18, strokeWidth: active ? 2.5 : 2 })}
            </div>

            {isSidebarOpen && (
                <span className={`ml-4 text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                    {label}
                </span>
            )}

            {active && isSidebarOpen && (
                <div className="ml-auto w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-pulse" />
            )}
        </button>
    );
};
