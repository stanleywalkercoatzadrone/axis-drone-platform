import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useGlobalContext } from '../../../context/GlobalContext';
import { getRoleDisplayName } from '../../../utils/roleUtils';
import {
    Menu, X, LayoutDashboard, CheckSquare, UploadCloud, AlertTriangle,
    CloudRain, LogOut, Wifi, WifiOff, BrainCircuit
} from 'lucide-react';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';

interface PilotNavV2Props {
    activeTab: string;
    onNavigate: (tab: string) => void;
}

const PilotNavV2: React.FC<PilotNavV2Props> = ({ activeTab, onNavigate }) => {
    const { user, logout } = useAuth();
    const { isSidebarOpen, toggleSidebar } = useGlobalContext();
    const isOnline = useOnlineStatus();
    const navigate = useNavigate();
    const location = useLocation();
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

    if (!user) return null;

    // Derive active tab from current URL path instead of relying on prop
    const currentPath = location.pathname.replace('/pilot/', '').split('/')[0] || 'dashboard';

    // PRODUCTION DIRECTIVE V2 - STRICT NAV MAPPING
    const navItems = [
        { id: 'dashboard',     label: 'Operations',      icon: LayoutDashboard },
        { id: 'weather',       label: 'Weather & Skies',  icon: CloudRain },
        { id: 'checklist',     label: 'Protocols',        icon: CheckSquare },
        { id: 'uploads',       label: 'Mission Uploads',  icon: UploadCloud },
        { id: 'upload-center', label: 'AI Upload',        icon: BrainCircuit },
        { id: 'issues',        label: 'Report Issue',     icon: AlertTriangle },
    ];

    return (
        <>
        {/* ── Desktop sidebar ─────────────────────────────────────── */}
        <aside
            className={`hidden md:flex ${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-950 border-r border-slate-800 transition-all duration-300 flex-col z-40 shadow-2xl`}
        >
            {/* Logo Area */}
            <div className="h-20 flex items-center justify-center border-b border-slate-800 shrink-0 bg-slate-900/50">
                <div className="bg-gradient-to-br from-blue-600 to-cyan-500 h-10 w-10 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.3)] border border-white/10">
                    <span className="font-black text-white text-xl">A</span>
                </div>
                {isSidebarOpen && (
                    <div className="ml-4 flex flex-col">
                        <span className="font-black text-lg tracking-tighter uppercase text-white leading-none">Axis</span>
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] mt-1">Pilot Terminal V2</span>
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
                    // Extract root path
                    const currentRoot = activeTab.split('/')[0];
                    const isActive = currentRoot === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                navigate(`/pilot/${item.id}`);
                                onNavigate(item.id);
                            }}
                            className={`w-full flex items-center px-3 py-3.5 rounded-xl transition-all duration-200 group relative ${(currentPath === item.id)
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
                            {(user.fullName || (user as any).full_name || 'P').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-col flex min-w-0">
                            <span className="text-xs font-black truncate text-white">{user.fullName || (user as any).full_name || 'Pilot'}</span>
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

        {/* ── Mobile top bar ─────────────────────────────────────────── */}
        <div style={{ display: isPWA ? 'flex' : 'none' }} className="fixed top-0 left-0 right-0 z-50 h-14 items-center px-4 bg-slate-950 border-b border-slate-800 gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-cyan-500 h-8 w-8 rounded-xl flex items-center justify-center shadow-lg border border-white/10">
                <span className="font-black text-white text-base">A</span>
            </div>
            <div className="flex flex-col leading-none">
                <span className="font-black text-white text-sm uppercase tracking-tight">Axis</span>
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.25em]">Pilot Terminal V2</span>
            </div>
            {isOnline
                ? <div className="ml-auto flex items-center gap-1.5 text-emerald-400"><Wifi size={12} className="animate-pulse" /><span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Connected</span></div>
                : <div className="ml-auto flex items-center gap-1.5 text-rose-400"><WifiOff size={12} /><span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Offline</span></div>
            }
            <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-colors"
            >
                <LogOut size={13} /> Out
            </button>
        </div>

        {/* ── Mobile bottom tab bar ────────────────────────────────── */}
        <nav style={{ display: isPWA ? 'flex' : 'none' }} className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 pb-safe">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => { navigate(`/pilot/${item.id}`); onNavigate(item.id); }}
                    className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 min-h-[56px] transition-colors ${
                        currentPath === item.id
                            ? 'text-blue-400'
                            : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <item.icon size={20} className={currentPath === item.id ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]' : ''} />
                    <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
                    {currentPath === item.id && (
                        <div className="absolute bottom-0 w-8 h-0.5 bg-blue-400 rounded-full" />
                    )}
                </button>
            ))}
        </nav>
        </>
    );
};

export default PilotNavV2;
