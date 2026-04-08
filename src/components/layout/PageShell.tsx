import React, { ReactNode, useState } from 'react';
import { ContextBar } from './ContextBar';
import { useGlobalContext } from '../../context/GlobalContext';
import { useAuth } from '../../context/AuthContext';
import { useIndustry } from '../../context/IndustryContext';
import { isAdmin, isPilot, isClient, isInHouse } from '../../utils/roleUtils';
import {
    Users,
    Settings,
    Menu,
    X,
    Building,
    ShieldCheck,
    BrainCircuit,
    List,
    Radar,
    ChevronDown,
    Zap,
    Sun,
    Shield,
    HardHat,
    Radio,
    Layers,
    CheckSquare,
    CloudSun,
    Upload,
    FolderOpen,
    BarChart2,
    Archive,
    LayoutDashboard,
    Flame,
    DollarSign,
    ClipboardCheck,
    Activity,
    PlayCircle,
    GitBranch,
    Thermometer,
    TrendingUp,
    CreditCard,
    Cpu,
    Trophy
} from 'lucide-react';

interface PageShellProps {
    children: ReactNode;
    title?: string;
    actions?: ReactNode;
    activeTab?: string;
    onNavigate?: (tab: string, meta?: Record<string, string>) => void;
    activeIndustry?: string;
}

// ── Industry definitions ──────────────────────────────────────────────────────
const INDUSTRIES = [
    {
        id: 'solar',
        label: 'Solar',
        emoji: '☀️',
        icon: Sun,
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-400/10',
        borderClass: 'border-amber-400/30',
        dotClass: 'bg-amber-400',
        hoverColorClass: 'hover:text-amber-400',
        hoverBgClass: 'hover:bg-amber-400/10',
        industryValue: 'Solar',
    },
    {
        id: 'insurance',
        label: 'Insurance',
        emoji: '🏠',
        icon: Shield,
        colorClass: 'text-red-400',
        bgClass: 'bg-red-400/10',
        borderClass: 'border-red-400/30',
        dotClass: 'bg-red-400',
        hoverColorClass: 'hover:text-red-400',
        hoverBgClass: 'hover:bg-red-400/10',
        industryValue: 'Insurance',
    },
    {
        id: 'construction',
        label: 'Construction',
        emoji: '🏗️',
        icon: HardHat,
        colorClass: 'text-yellow-400',
        bgClass: 'bg-yellow-400/10',
        borderClass: 'border-yellow-400/30',
        dotClass: 'bg-yellow-400',
        hoverColorClass: 'hover:text-yellow-400',
        hoverBgClass: 'hover:bg-yellow-400/10',
        industryValue: 'Construction',
    },
    {
        id: 'utilities',
        label: 'Utilities',
        emoji: '⚡',
        icon: Zap,
        colorClass: 'text-cyan-400',
        bgClass: 'bg-cyan-400/10',
        borderClass: 'border-cyan-400/30',
        dotClass: 'bg-cyan-400',
        hoverColorClass: 'hover:text-cyan-400',
        hoverBgClass: 'hover:bg-cyan-400/10',
        industryValue: 'Utilities',
    },
    {
        id: 'telecom',
        label: 'Telecom',
        emoji: '📡',
        icon: Radio,
        colorClass: 'text-violet-400',
        bgClass: 'bg-violet-400/10',
        borderClass: 'border-violet-400/30',
        dotClass: 'bg-violet-400',
        hoverColorClass: 'hover:text-violet-400',
        hoverBgClass: 'hover:bg-violet-400/10',
        industryValue: 'Telecom',
    },
] as const;

type IndustryId = typeof INDUSTRIES[number]['id'];

// ── Main Component ────────────────────────────────────────────────────────────
export const PageShell: React.FC<PageShellProps> = ({
    children, title, actions, activeTab, onNavigate, activeIndustry
}) => {
    const { user, logout } = useAuth();
    const { isSidebarOpen, toggleSidebar } = useGlobalContext();
    const { tLabel, setIndustry, currentIndustry } = useIndustry();

    const [selectedIndustry, setSelectedIndustry] = useState<IndustryId>(
        (activeIndustry as IndustryId) || (currentIndustry !== 'default' ? currentIndustry as IndustryId : 'solar')
    );

    const [isOpsOpen, setIsOpsOpen] = useState(true);

    const handleMissionsClick = (industry: typeof INDUSTRIES[number]) => {
        setSelectedIndustry(industry.id);
        setIndustry(industry.id);
        onNavigate?.('missions', { industry: industry.industryValue });
    };

    const handleWeatherClick = () => {
        const ind = INDUSTRIES.find(i => i.id === selectedIndustry) ?? INDUSTRIES[0];
        onNavigate?.('weather', { industry: ind.industryValue });
    };

    const handleUploadClick = () => { onNavigate?.('upload'); };
    const handleAssetsClick = () => { onNavigate?.('assets'); };
    const handleAnalyticsClick = () => { onNavigate?.('analytics'); };

    // Mobile bottom tab items (most-used admin sections)
    const mobileTabItems = [
        { id: 'dashboard',  label: 'Home',      icon: LayoutDashboard },
        { id: 'missions',   label: 'Missions',  icon: Radar },
        { id: 'personnel',  label: 'Pilots',    icon: Users },
        { id: 'clients',    label: 'Clients',   icon: Building },
        { id: 'settings',   label: 'Settings',  icon: Settings },
    ];

    const mobileActivePath = activeTab || 'dashboard';

    return (
        <div className="flex h-screen bg-slate-900 text-slate-50 overflow-hidden font-sans">

            {/* ── Mobile top bar (pilot-style) ───────────────────────────── */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 bg-slate-950 border-b border-slate-800 gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 h-8 w-8 rounded-xl flex items-center justify-center shadow-lg border border-white/10">
                    <span className="font-black text-white text-base">A</span>
                </div>
                <div className="flex flex-col leading-none">
                    <span className="font-black text-white text-sm uppercase tracking-tight">Axis <span className="text-blue-400">Enterprise</span></span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em]">Admin</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {user && (
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                            <div className="w-5 h-5 rounded-md bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-[10px]">
                                {((user as any).fullName || (user as any).full_name || 'A').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] font-bold text-slate-300 max-w-[80px] truncate hidden sm:block">
                                {(user as any).fullName || (user as any).full_name || 'Admin'}
                            </span>
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-colors"
                    >
                        <X className="w-3 h-3" /> Out
                    </button>
                </div>
            </div>

            {/* ── Mobile bottom tab bar (pilot-style) ───────────────────── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-slate-950 border-t border-slate-800">
                {mobileTabItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate?.(item.id)}
                        className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-1 min-h-[56px] transition-colors ${
                            mobileActivePath === item.id
                                ? 'text-blue-400'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <item.icon size={20} className={mobileActivePath === item.id ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]' : ''} />
                        <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
                        {mobileActivePath === item.id && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400 rounded-full" />
                        )}
                    </button>
                ))}
            </nav>

            {/* ── Sidebar ──────────────────────────────────────────────────── */}
            <aside
                className={`
                    hidden md:flex
                    ${isSidebarOpen ? 'w-64' : 'w-20'}
                    bg-slate-900 border-r border-slate-800 transition-all duration-300 flex-col z-40
                    md:relative
                `}
            >

                {/* Logo */}
                <div className="h-16 flex items-center justify-center border-b border-slate-800 shrink-0">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 h-8 w-8 rounded-lg flex items-center justify-center shadow-glow">
                        <span className="font-bold text-white text-lg">A</span>
                    </div>
                    {isSidebarOpen && (
                        <span className="ml-3 font-bold text-lg tracking-tight uppercase">
                            Axis <span className="text-blue-500">Enterprise</span>
                        </span>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 px-2 overflow-y-auto scrollbar-none space-y-1">

                    {/* ── INDUSTRY OPERATIONS SECTION ───────────────────── */}
                    <div className="mb-1">

                        {/* Section header */}
                        {isSidebarOpen ? (
                            <button
                                onClick={() => setIsOpsOpen(o => !o)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl mb-1 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-all duration-200 group"
                            >
                                <Layers size={15} className="text-blue-400 shrink-0" />
                                <span className="text-[9px] font-black uppercase tracking-[0.22em] flex-1 text-left opacity-70 group-hover:opacity-100 text-slate-400">
                                    Industry Operations
                                </span>
                                <ChevronDown
                                    size={12}
                                    className={`text-slate-600 transition-transform duration-300 ${isOpsOpen ? 'rotate-0' : '-rotate-90'}`}
                                />
                            </button>
                        ) : (
                            <div className="flex justify-center py-1 mb-1">
                                <Layers size={14} className="text-blue-400/60" />
                            </div>
                        )}

                        {/* Expanded content (sidebar open + ops open) */}
                        {isOpsOpen && isSidebarOpen && (() => {
                            const industry = INDUSTRIES.find(i => i.id === selectedIndustry) ?? INDUSTRIES[0];
                            const isAIActive = activeTab === 'ai-studio';
                            const isMissActive = activeTab === 'missions' && activeIndustry === industry.industryValue;

                            return (
                                <div className="px-1">
                                    {/* Industry pill switcher */}
                                    <div className="flex items-center gap-1 mb-2 px-2">
                                        {INDUSTRIES.map(ind => (
                                            <button
                                                key={ind.id}
                                                onClick={() => setSelectedIndustry(ind.id)}
                                                title={ind.label}
                                                className={`flex-1 flex items-center justify-center rounded-lg py-1.5 text-sm transition-all duration-150
                                                    ${selectedIndustry === ind.id
                                                        ? `${ind.bgClass} ${ind.borderClass} border`
                                                        : 'text-slate-500 hover:bg-slate-800/60 grayscale opacity-50 hover:opacity-100 hover:grayscale-0'
                                                    }`}
                                            >
                                                {ind.emoji}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Selected industry label */}
                                    <div className={`text-[9px] font-black uppercase tracking-widest px-2 mb-1.5 ${industry.colorClass}`}>
                                        {industry.label}
                                    </div>

                                    {/* Sub-items */}
                                    <div className="border-l border-slate-800 ml-2 pl-3 space-y-0.5 mb-1">

                                        {/* AI Studio */}
                                        {(isAdmin(user) || isInHouse(user) || isClient(user)) && (
                                            <button
                                                onClick={() => onNavigate?.('ai-studio')}
                                                className={`flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 group border
                                                    ${isAIActive
                                                        ? 'bg-blue-600/15 text-blue-400 border-blue-500/30'
                                                        : 'text-slate-500 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <BrainCircuit size={13} className={`mr-2 transition-colors ${isAIActive ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                                                <span>AI Studio</span>
                                                {isAIActive && <div className="ml-auto w-1 h-1 rounded-full bg-blue-400 animate-pulse" />}
                                            </button>
                                        )}

                                        {/* Industry Missions */}
                                        {(isAdmin(user) || isPilot(user)) && (
                                            <button
                                                onClick={() => handleMissionsClick(industry)}
                                                className={`flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 group
                                                    ${isMissActive
                                                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                                                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <Radar size={13} className={`mr-2 transition-colors ${isMissActive ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                                                <span>{industry.label} Missions</span>
                                                {isMissActive && <div className="ml-auto w-1 h-1 rounded-full bg-blue-500 animate-pulse" />}
                                            </button>
                                        )}

                                        {/* Weather */}
                                        {(isAdmin(user) || isPilot(user)) && (
                                            <button
                                                onClick={handleWeatherClick}
                                                className={`flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 group
                                                    ${activeTab === 'weather'
                                                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <CloudSun size={13} className={`mr-2 transition-colors ${activeTab === 'weather' ? 'text-sky-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                                                <span>Weather</span>
                                                {activeTab === 'weather' && <div className="ml-auto w-1 h-1 rounded-full bg-sky-400 animate-pulse" />}
                                            </button>
                                        )}

                                        {/* My Files (Pilots Only) */}
                                        {isPilot(user) && (
                                            <button
                                                onClick={() => {
                                                    // @ts-ignore
                                                    onNavigate('my-files');
                                                }}
                                                className={`flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 group
                                                    ${activeTab === 'my-files'
                                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <FolderOpen size={13} className={`mr-2 transition-colors ${activeTab === 'my-files' ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                                                <span>My Files</span>
                                                {activeTab === 'my-files' && <div className="ml-auto w-1 h-1 rounded-full bg-blue-400 animate-pulse" />}
                                            </button>
                                        )}

                                        {/* Uploads */}
                                        {(isAdmin(user) || isInHouse(user)) && (
                                            <button
                                                onClick={handleUploadClick}
                                                className={`flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 group
                                                    ${activeTab === 'upload'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <Upload size={13} className={`mr-2 transition-colors ${activeTab === 'upload' ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                                                <span>Uploads</span>
                                                {activeTab === 'upload' && <div className="ml-auto w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
                                            </button>
                                        )}

                                        {/* Assets */}
                                        {(isAdmin(user) || isInHouse(user) || isClient(user)) && (
                                            <button
                                                onClick={handleAssetsClick}
                                                className={`flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 group
                                                    ${activeTab === 'assets'
                                                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <FolderOpen size={13} className={`mr-2 transition-colors ${activeTab === 'assets' ? 'text-orange-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                                                <span>Assets</span>
                                                {activeTab === 'assets' && <div className="ml-auto w-1 h-1 rounded-full bg-orange-400 animate-pulse" />}
                                            </button>
                                        )}

                                        {/* Analytics */}
                                        {isAdmin(user) && (
                                            <button
                                                onClick={handleAnalyticsClick}
                                                className={`flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 group
                                                    ${activeTab === 'analytics'
                                                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <BarChart2 size={13} className={`mr-2 transition-colors ${activeTab === 'analytics' ? 'text-purple-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                                                <span>Analytics</span>
                                                {activeTab === 'analytics' && <div className="ml-auto w-1 h-1 rounded-full bg-purple-400 animate-pulse" />}
                                            </button>
                                        )}

                                        {/* ── Solar Intelligence (Solar industry only) ── */}
                                        {selectedIndustry === 'solar' && (isAdmin(user) || isClient(user)) && (
                                            <>
                                                <div className="text-[8px] font-black uppercase tracking-widest text-amber-400/60 px-1 pt-2 pb-0.5">Solar Intelligence</div>

                                                <button
                                                    onClick={() => onNavigate?.('solar-intel', { subTab: 'thermal' })}
                                                    className={`flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 group
                                                        ${activeTab === 'solar-intel'
                                                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                                                        }`}
                                                >
                                                    <Flame size={13} className={`mr-2 transition-colors ${activeTab === 'solar-intel' ? 'text-red-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                                                    <span>Thermal Faults</span>
                                                    {activeTab === 'solar-intel' && <div className="ml-auto w-1 h-1 rounded-full bg-red-400 animate-pulse" />}
                                                </button>

                                                <button
                                                    onClick={() => onNavigate?.('solar-intel', { subTab: 'energy' })}
                                                    className="flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 group text-slate-500 hover:text-slate-200 hover:bg-slate-800/50"
                                                >
                                                    <DollarSign size={13} className="mr-2 text-slate-600 group-hover:text-amber-400 transition-colors" />
                                                    <span>Energy Loss</span>
                                                </button>

                                                {isAdmin(user) && (
                                                    <button
                                                        onClick={() => onNavigate?.('solar-intel', { subTab: 'review' })}
                                                        className="flex items-center w-full px-2.5 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 group text-slate-500 hover:text-slate-200 hover:bg-slate-800/50"
                                                    >
                                                        <ClipboardCheck size={13} className="mr-2 text-slate-600 group-hover:text-green-400 transition-colors" />
                                                        <span>Fault Review</span>
                                                    </button>
                                                )}
                                            </>
                                        )}

                                    </div>
                                </div>
                            );
                        })()}

                        {/* Collapsed sidebar: show active industry dot */}
                        {!isSidebarOpen && (() => {
                            const industry = INDUSTRIES.find(i => i.id === selectedIndustry) ?? INDUSTRIES[0];
                            const hasActive = (activeTab === 'ai-studio' || activeTab === 'missions') && (activeIndustry === industry.id || activeIndustry === industry.industryValue);
                            return (
                                <button
                                    onClick={() => { }}
                                    title={industry.label}
                                    className="flex items-center justify-center w-full py-2.5 rounded-xl relative text-slate-400 hover:bg-slate-800/60"
                                >
                                    <span className="text-base">{industry.emoji}</span>
                                    {hasActive && (
                                        <div className={`absolute right-1 top-1 w-1.5 h-1.5 rounded-full ${industry.dotClass}`} />
                                    )}
                                </button>
                            );
                        })()}

                    </div>


                    {/* ── FINANCE ───────────────────────────────────────── */}
                    {isAdmin(user) && isSidebarOpen && (
                        <div className="pt-3 mt-2 border-t border-slate-800/60">
                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] px-3 mb-2">Finance</div>
                            <CompactNavItem
                                icon={<Archive size={16} />}
                                label="Invoices"
                                active={activeTab === 'invoices'}
                                onClick={() => onNavigate?.('invoices')}
                            />
                            <CompactNavItem
                                icon={<CreditCard size={16} />}
                                label="Pilot Payroll"
                                active={activeTab === 'payroll'}
                                onClick={() => onNavigate?.('payroll')}
                            />
                            <CompactNavItem
                                icon={<DollarSign size={16} />}
                                label="Vendor & Expenses"
                                active={activeTab === 'vendor-expenses'}
                                onClick={() => onNavigate?.('vendor-expenses')}
                            />
                            <CompactNavItem
                                icon={<TrendingUp size={16} />}
                                label="Revenue"
                                active={activeTab === 'revenue'}
                                onClick={() => onNavigate?.('revenue')}
                            />
                        </div>
                    )}

                    {/* ── OPERATIONS ────────────────────────────────────── */}
                    {(isAdmin(user) || isPilot(user)) && isSidebarOpen && (
                        <div className="pt-3 mt-2 border-t border-slate-800/60">
                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] px-3 mb-2">Operations</div>
                            <CompactNavItem
                                icon={<PlayCircle size={16} />}
                                label="Sessions"
                                active={activeTab === 'sessions'}
                                onClick={() => onNavigate?.('sessions')}
                            />
                            <CompactNavItem
                                icon={<GitBranch size={16} />}
                                label="Mission Timeline"
                                active={activeTab === 'timeline'}
                                onClick={() => onNavigate?.('timeline')}
                            />
                            <CompactNavItem
                                icon={<CloudSun size={16} />}
                                label="Weather"
                                active={activeTab === 'weather'}
                                onClick={handleWeatherClick}
                            />
                        </div>
                    )}

                    {/* ── INTELLIGENCE ──────────────────────────────────── */}
                    {(isAdmin(user) || isClient(user)) && isSidebarOpen && (
                        <div className="pt-3 mt-2 border-t border-slate-800/60">
                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] px-3 mb-2">Intelligence</div>
                            <CompactNavItem
                                icon={<Thermometer size={16} />}
                                label="Thermal Faults"
                                active={activeTab === 'thermal-faults'}
                                onClick={() => onNavigate?.('thermal-faults')}
                            />
                            <CompactNavItem
                                icon={<Sun size={16} />}
                                label="Solar Command"
                                active={activeTab === 'solar-command'}
                                onClick={() => onNavigate?.('solar-command')}
                            />
                            <CompactNavItem
                                icon={<Cpu size={16} />}
                                label="AI Studio"
                                active={activeTab === 'ai-studio'}
                                onClick={() => onNavigate?.('ai-studio')}
                            />
                        </div>
                    )}

                    {/* ── PILOTS ────────────────────────────────────────── */}
                    {isAdmin(user) && isSidebarOpen && (
                        <div className="pt-3 mt-2 border-t border-slate-800/60">
                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] px-3 mb-2">Pilots</div>
                            <CompactNavItem
                                icon={<Users size={16} />}
                                label="Pilot Directory"
                                active={activeTab === 'personnel'}
                                onClick={() => onNavigate?.('personnel')}
                            />
                            <CompactNavItem
                                icon={<Trophy size={16} />}
                                label="Performance"
                                active={activeTab === 'pilot-performance'}
                                onClick={() => onNavigate?.('pilot-performance')}
                            />
                        </div>
                    )}


                    {/* Finance section moved above — this block intentionally removed */}

                    {/* ── SETTINGS ──────────────────────────────────────── */}
                    <div className="pt-3 mt-3 border-t border-slate-800/60">
                        {isSidebarOpen && (
                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] px-3 mb-3">
                                Settings
                            </div>
                        )}
                        {user && (
                            <CompactNavItem
                                icon={<LayoutDashboard size={16} />}
                                label="Dashboard"
                                active={activeTab === 'dashboard'}
                                onClick={() => onNavigate?.('dashboard')}
                            />
                        )}
                        {user && isAdmin(user) && (
                            <CompactNavItem
                                icon={<Users size={16} />}
                                label={tLabel('stakeholder')}
                                active={activeTab === 'personnel'}
                                onClick={() => onNavigate?.('personnel')}
                            />
                        )}
                        {user && isAdmin(user) && (
                            <CompactNavItem
                                icon={<Building size={16} />}
                                label="Clients"
                                active={activeTab === 'clients'}
                                onClick={() => onNavigate?.('clients')}
                            />
                        )}
                        <CompactNavItem
                            icon={<Settings size={16} />}
                            label="System Settings"
                            active={activeTab === 'settings'}
                            onClick={() => onNavigate?.('settings')}
                        />
                        {user && isAdmin(user) && (
                            <>
                                <div className="h-px bg-slate-800/50 my-3 mx-2" />
                                <CompactNavItem
                                    icon={<ShieldCheck size={16} />}
                                    label="User IAM"
                                    active={activeTab === 'users'}
                                    onClick={() => onNavigate?.('users')}
                                />
                                <CompactNavItem
                                    icon={<BrainCircuit size={16} />}
                                    label="Neural AI"
                                    active={activeTab === 'ai'}
                                    onClick={() => onNavigate?.('ai')}
                                />
                                <CompactNavItem
                                    icon={<List size={16} />}
                                    label="Protocol Lists"
                                    active={activeTab === 'checklists'}
                                    onClick={() => onNavigate?.('checklists')}
                                />
                            </>
                        )}
                        {user && (isAdmin(user) || isPilot(user)) && (
                            <CompactNavItem
                                icon={<CheckSquare size={16} />}
                                label={`My ${tLabel('workItem')}s`}
                                active={activeTab === 'my-tasks'}
                                onClick={() => onNavigate?.('my-tasks')}
                            />
                        )}
                    </div>

                </nav>

                {/* Bottom Toggle */}
                <div className="p-4 border-t border-slate-800 shrink-0">
                    <button
                        onClick={toggleSidebar}
                        className="w-full flex items-center justify-center p-3 text-slate-500 hover:text-blue-500 hover:bg-slate-800/50 rounded-xl transition-all duration-300"
                    >
                        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-900 pt-14 md:pt-0 pb-16 md:pb-0">
                <ContextBar />

                {(title || actions) && (
                    <header className="px-4 py-4 md:px-10 md:py-8 flex items-center justify-between border-b border-slate-800/30 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-30">
                        <div>
                            <h1 className="text-xl md:text-3xl font-black text-white tracking-tighter uppercase">{title}</h1>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-1">Active Viewport Protocol</p>
                        </div>
                        <div className="flex items-center space-x-3 md:space-x-6">
                            {actions}
                        </div>
                    </header>
                )}

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-10 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

// ── Compact nav item ──────────────────────────────────────────────────────────
const CompactNavItem = ({
    icon, label, active = false, onClick
}: {
    icon: ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
}) => {
    const { isSidebarOpen } = useGlobalContext();
    return (
        <button
            onClick={onClick}
            className={`flex items-center w-full px-3 py-2.5 rounded-xl transition-all duration-200 group mb-0.5 ${active
                ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
        >
            <div className={`transition-all duration-200 shrink-0 ${active ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'}`}>
                {icon}
            </div>
            {isSidebarOpen && (
                <span className={`ml-3 text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                    {label}
                </span>
            )}
            {active && isSidebarOpen && (
                <div className="ml-auto w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
            )}
        </button>
    );
};
