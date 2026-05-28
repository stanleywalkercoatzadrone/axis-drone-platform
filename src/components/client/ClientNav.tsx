import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useGlobalContext } from '../../../context/GlobalContext';
import {
    LayoutDashboard,
    Download,
    Plane,
    LogOut,
    Menu,
    X,
    Building2,
    BrainCircuit,
    AlertTriangle,
    Radio,
    Image,
} from 'lucide-react';

const navItems = [
    { id: 'overview',     label: 'Overview',           icon: LayoutDashboard },
    { id: 'missions',     label: 'Live Missions',       icon: Plane,           live: true },
    { id: 'lbd',          label: 'Defect Tracking',    icon: AlertTriangle },
    { id: 'reports',      label: 'AI Reports',          icon: BrainCircuit },
    { id: 'deliverables', label: 'Deliverables',        icon: Download },
    { id: 'map',          label: 'Imagery',             icon: Image },
];

const ClientNav: React.FC = () => {
    const { user, logout } = useAuth();
    const { isSidebarOpen, toggleSidebar } = useGlobalContext();
    const navigate = useNavigate();
    const location = useLocation();

    if (!user) return null;

    const currentPath = location.pathname.replace('/client/', '').split('/')[0] || 'overview';
    const initials = (user.fullName || user.email || 'C').charAt(0).toUpperCase();

    return (
        <>
        {/* Desktop Sidebar */}
        <aside
            className={`hidden md:flex ${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-950 border-r border-slate-800 
                        transition-all duration-300 flex-col z-40 shadow-2xl shrink-0`}
        >
            {/* Logo */}
            <div className="h-20 flex items-center justify-center border-b border-slate-800 bg-slate-900/50 shrink-0">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 h-10 w-10 rounded-xl
                                flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]
                                border border-white/10">
                    <Building2 size={20} className="text-white" />
                </div>
                {isSidebarOpen && (
                    <div className="ml-4 flex flex-col">
                        <span className="font-black text-lg tracking-tighter uppercase text-white leading-none">Axis</span>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] mt-1">Client Portal</span>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 py-6 px-3 overflow-y-auto space-y-1.5">
                {isSidebarOpen && (
                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-3 mb-4">
                        My Portal
                    </div>
                )}
                {navItems.map(item => {
                    const isActive = currentPath === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(`/client/${item.id}`)}
                            className={`w-full flex items-center px-3 py-3.5 rounded-xl transition-all duration-200 group relative
                                ${isActive
                                    ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 shadow-inner'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                }`}
                        >
                            <item.icon
                                className={`shrink-0 transition-transform duration-300
                                    ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'group-hover:scale-105'}`}
                                size={20}
                            />
                            {isSidebarOpen && (
                                <span className={`ml-4 text-xs font-black uppercase tracking-wider flex-1 text-left
                                    ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                                    {item.label}
                                </span>
                            )}
                            {/* Live pulse dot for missions */}
                            {(item as any).live && isSidebarOpen && (
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_6px_rgba(56,189,248,0.8)] shrink-0" />
                            )}
                            {isActive && isSidebarOpen && !(item as any).live && (
                                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-emerald-500
                                                animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                            )}
                        </button>
                    );
                })}

            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/30 shrink-0 space-y-2">
                {isSidebarOpen && user && (
                    <div className="px-3 py-2 bg-slate-900 rounded-xl border border-slate-800 mb-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30
                                        flex items-center justify-center text-emerald-400 font-black text-sm">
                            {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black truncate text-white">{user.fullName}</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">Client</span>
                        </div>
                    </div>
                )}
                <button
                    onClick={logout}
                    className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'}
                                py-3 text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl
                                transition-all duration-200 border border-transparent hover:border-rose-500/20`}
                >
                    <LogOut size={18} />
                    {isSidebarOpen && <span className="ml-3 text-[10px] font-black uppercase tracking-widest">Sign Out</span>}
                </button>
                <button
                    onClick={toggleSidebar}
                    className="w-full flex items-center justify-center p-3 text-slate-600
                               hover:text-slate-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300 mt-2"
                >
                    {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
            </div>
        </aside>

        {/* Mobile Top Bar */}
        <div className="flex md:hidden fixed top-0 left-0 right-0 z-50 h-14 items-center px-4 bg-slate-950 border-b border-slate-800 gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 h-8 w-8 rounded-xl flex items-center justify-center shadow-lg border border-white/10">
                <Building2 size={16} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
                <span className="font-black text-white text-sm uppercase tracking-tight">Axis</span>
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.25em]">Client Portal</span>
            </div>
            <button
                onClick={logout}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-colors"
            >
                <LogOut size={13} /> Out
            </button>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 pb-safe">
            {navItems.map(item => {
                const isActive = currentPath === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => navigate(`/client/${item.id}`)}
                        className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 min-h-[56px] transition-colors relative
                            ${isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <div className="relative">
                            <item.icon size={20} className={isActive ? 'drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]' : ''} />
                            {(item as any).live && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.8)]" />
                            )}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider">{item.label.split(' ')[0]}</span>
                        {isActive && (
                            <div className="absolute bottom-0 w-8 h-0.5 bg-emerald-400 rounded-full" />
                        )}
                    </button>
                );
            })}
        </nav>
        </>
    );
};

export default ClientNav;
