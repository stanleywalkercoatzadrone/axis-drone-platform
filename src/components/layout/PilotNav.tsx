import React, { ReactNode } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useGlobalContext } from '../../../context/GlobalContext';
import { getRoleDisplayName } from '../../utils/roleUtils';
import {
    Menu,
    X,
    LayoutDashboard,
    CheckSquare,
    UploadCloud,
    AlertTriangle,
    CloudLightning,
    LogOut,
    Wifi,
    WifiOff,
    CloudRain
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface PilotNavProps {
    activeTab: string;
    onNavigate: (tab: string) => void;
}

export const PilotNav: React.FC<PilotNavProps> = ({ activeTab, onNavigate }) => {
    const { user, logout } = useAuth();
    const { isSidebarOpen, toggleSidebar } = useGlobalContext();
    const isOnline = useOnlineStatus(); // We will create this hook next

    if (!user) return null;

    const navItems = [
        { id: 'pilot-dashboard', label: 'Operations', icon: LayoutDashboard },
        { id: 'pilot-missions', label: 'Active Missions', icon: CloudLightning },
        { id: 'weather', label: 'Weather & Skies', icon: CloudRain },
        { id: 'pilot-checklists', label: 'Protocols', icon: CheckSquare },
        { id: 'pilot-uploads', label: 'Mission Uploads', icon: UploadCloud },
        { id: 'pilot-issues', label: 'Report Issue', icon: AlertTriangle },
    ];

    return (
        <aside
            className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-950 border-r border-slate-800 transition-all duration-300 flex flex-col z-40 shadow-2xl`}
        >
            {/* Logo Area */}
            <div className="h-20 flex items-center justify-center border-b border-slate-800 shrink-0 bg-slate-900/50">
                <div className="bg-gradient-to-br from-blue-600 to-cyan-500 h-10 w-10 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.3)] border border-white/10">
                    <span className="font-black text-white text-xl">A</span>
                </div>
                {isSidebarOpen && (
                    <div className="ml-4 flex flex-col">
                        <span className="font-black text-lg tracking-tighter uppercase text-white leading-none">Axis</span>
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] mt-1">Pilot Terminal</span>
                    </div>
                )}
            </div>

            {/* Network Status indicator */}
            <div className={`p-0 transition-all duration-300 ${isSidebarOpen ? 'h-12 border-b border-slate-800/50' : 'h-0 overflow-hidden'}`}>
                {isSidebarOpen && (
                    <div className="flex items-center justify-between px-6 h-full bg-slate-900/10">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Uplink Status</span>
                        {isOnline ? (
                            <div className="flex items-center gap-2 text-emerald-500">
                                <Wifi size={12} className="animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Connected</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-rose-500">
                                <WifiOff size={12} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Offline Mode</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Primary Navigation */}
            <nav className="flex-1 py-6 px-3 overflow-y-auto space-y-2">
                {isSidebarOpen && (
                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-3 mb-4">
                        Primary Systems
                    </div>
                )}

                {navItems.map(item => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`w-full flex items-center px-3 py-3.5 rounded-xl transition-all duration-200 group relative ${isActive
                                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                }`}
                        >
                            <item.icon className={`shrink-0 transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'group-hover:scale-110'}`} size={20} />

                            {isSidebarOpen && (
                                <span className={`ml-4 text-xs font-black uppercase tracking-wider ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                                    {item.label}
                                </span>
                            )}

                            {isActive && isSidebarOpen && (
                                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Profile / Logout Section */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/30 shrink-0 space-y-2">
                {isSidebarOpen && (
                    <div className="px-3 py-2 bg-slate-900 rounded-xl border border-slate-800 mb-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black">
                            {user.fullName.charAt(0)}
                        </div>
                        <div className="flex-col flex min-w-0">
                            <span className="text-xs font-black truncate text-white">{user.fullName}</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{getRoleDisplayName(user.role)}</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={logout}
                    className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'} py-3 text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all duration-200 border border-transparent hover:border-rose-500/20`}
                >
                    <LogOut size={18} />
                    {isSidebarOpen && <span className="ml-3 text-[10px] font-black uppercase tracking-widest">End Session</span>}
                </button>

                <button
                    onClick={toggleSidebar}
                    className="w-full flex items-center justify-center p-3 text-slate-600 hover:text-slate-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300 mt-2"
                >
                    {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
            </div>
        </aside>
    );
};
