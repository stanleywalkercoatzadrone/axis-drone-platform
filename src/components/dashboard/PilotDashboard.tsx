import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
    CloudLightning,
    UploadCloud,
    CheckSquare,
    AlertTriangle,
    MapPin,
    Wind,
    Thermometer,
    Droplets,
    CloudRain
} from 'lucide-react';
import apiClient from '../../services/apiClient';

interface WeatherSnapshot {
    temp: number;
    wind: number;
    precipitation: string;
    conditions: string;
}

interface ActiveMission {
    id: string;
    site_id: string;
    type: string;
    status: string;
    location: string;
    progress?: number;
}

export const PilotDashboard: React.FC = () => {
    const { user } = useAuth();
    const isOnline = useOnlineStatus();
    const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
    const [activeMissions, setActiveMissions] = useState<ActiveMission[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                // Fetch live assignments
                const res = await apiClient.get('/pilot/me');
                if (res.data.success && res.data.data.missions) {
                    setActiveMissions(res.data.data.missions);
                }

                // Temporary mock weather resolution logic 
                setTimeout(() => {
                    setWeather({
                        temp: 84,
                        wind: 12,
                        precipitation: '0%',
                        conditions: 'Clear Skies'
                    });
                    setIsLoading(false);
                }, 800);
            } catch (error) {
                console.error("Failed to load dashboard data.", error);
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20 min-h-full">
                <div className="w-10 h-10 border-4 border-slate-800/50 border-t-sky-400 rounded-full animate-spin" />
            </div>
        );
    }

    const primaryMission = activeMissions.length > 0 ? activeMissions[0] : null;

    return (
        // Replaced min-h-screen with min-h-full to fix the mobile scrolling bug within the AppShell
        <div className="min-h-full p-4 md:p-8 space-y-8 pb-24 text-slate-50 font-sans">
            
            {/* Header / Welcome - Glassmorphic Aesthetic */}
            <div className="relative overflow-hidden rounded-[24px] border border-sky-400/20 bg-slate-900/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sky-500/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none" />
                
                <div className="relative z-10 p-8 md:p-10">
                    <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400 tracking-tighter mb-3">
                        Welcome, {user?.fullName?.split(' ')[0] || 'Pilot'}
                    </h1>
                    <p className="text-lg text-slate-300 font-medium">
                        You have <span className="text-sky-400 font-black">{activeMissions.length} active mission{activeMissions.length !== 1 && 's'}</span> ready for deployment today.
                    </p>
                </div>
            </div>

            {/* Weather Snapshot Widget - Unified Environmental Bar */}
            <div className="relative rounded-2xl border border-slate-700/50 bg-slate-900/30 backdrop-blur-md overflow-hidden">
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800/50">
                    <div className="flex-1 p-5 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                                <Thermometer className="text-rose-400" size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Temperature</p>
                                <p className="text-2xl font-black text-white leading-none mt-1">{weather?.temp}°F</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 p-5 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
                                <Wind className="text-sky-400" size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Wind Speed</p>
                                <p className="text-2xl font-black text-white leading-none mt-1">{weather?.wind} mph</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 p-5 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <Droplets className="text-blue-400" size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Precipitation</p>
                                <p className="text-2xl font-black text-white leading-none mt-1">{weather?.precipitation}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 p-5 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <CloudRain className="text-indigo-400" size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Conditions</p>
                                <p className="text-lg font-black text-white leading-none mt-1">{weather?.conditions}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Today's Primary Mission Card */}
            {primaryMission ? (
                <div className="relative rounded-[24px] border border-sky-500/30 bg-slate-900/60 backdrop-blur-2xl shadow-[0_0_40px_rgba(56,189,248,0.15)] overflow-hidden group">
                    {/* Animated hover gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    
                    <div className="p-8 md:p-10 relative z-10">
                        <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest mb-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                    Active Deployment
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase text-white drop-shadow-md">
                                    {primaryMission.type.toUpperCase().replace('_', ' ')} OPERATION
                                </h2>
                                <div className="flex items-center text-slate-400 mt-3 gap-2 bg-slate-800/50 w-fit px-3 py-1.5 rounded-lg border border-slate-700/50">
                                    <MapPin size={16} className="text-sky-400" />
                                    <span className="font-mono text-xs">{primaryMission.id}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Progress Indicator */}
                            <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50">
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mission Progress</span>
                                    <span className="text-2xl font-black text-sky-400">{primaryMission.progress || 0}%</span>
                                </div>
                                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-inner">
                                    <div
                                        className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-1000 relative"
                                        style={{ width: `${primaryMission.progress || 0}%` }}
                                    >
                                        <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 blur-[2px]" />
                                    </div>
                                </div>
                            </div>

                            {/* Action Area */}
                            <div>
                                <button className="w-full relative overflow-hidden group bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-lg py-6 rounded-2xl transition-all duration-300 shadow-[0_0_30px_rgba(56,189,248,0.3)] hover:shadow-[0_0_40px_rgba(56,189,248,0.5)] hover:-translate-y-1">
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                    <span className="relative flex items-center justify-center gap-3 tracking-wide uppercase">
                                        <CloudLightning size={24} className="group-hover:scale-125 transition-transform duration-300" />
                                        Start Mission Workflow
                                    </span>
                                </button>
                                
                                {!isOnline && (
                                    <div className="mt-4 flex items-center justify-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 px-4 rounded-xl">
                                        <AlertTriangle size={16} />
                                        <span className="text-[11px] uppercase tracking-widest font-black">Currently Offline. Sync will queue.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-[24px] py-20 border border-slate-800/50 bg-slate-900/30 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-lg">
                    <div className="w-24 h-24 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-6">
                        <CheckSquare className="text-slate-500" size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest">No Active Missions</h3>
                    <p className="mt-3 text-slate-500 font-medium max-w-md">You have completely cleared your deployment queue. Await new dispatch assignments.</p>
                </div>
            )}

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="relative overflow-hidden group bg-slate-900/40 backdrop-blur-md border border-slate-700/50 hover:border-emerald-500/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg flex flex-col items-center justify-center gap-4 cursor-pointer">
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300">
                        <UploadCloud className="text-emerald-400" size={28} />
                    </div>
                    <span className="font-bold text-slate-200 group-hover:text-white uppercase tracking-wider text-sm">Upload Data</span>
                </button>

                <button className="relative overflow-hidden group bg-slate-900/40 backdrop-blur-md border border-slate-700/50 hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg flex flex-col items-center justify-center gap-4 cursor-pointer">
                    <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
                        <CheckSquare className="text-blue-400" size={28} />
                    </div>
                    <span className="font-bold text-slate-200 group-hover:text-white uppercase tracking-wider text-sm">Protocols</span>
                </button>

                <button className="relative overflow-hidden group bg-slate-900/40 backdrop-blur-md border border-slate-700/50 hover:border-rose-500/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-lg flex flex-col items-center justify-center gap-4 cursor-pointer md:col-span-1 col-span-1">
                    <div className="w-14 h-14 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 group-hover:scale-110 group-hover:bg-rose-500/20 transition-all duration-300">
                        <AlertTriangle className="text-rose-400" size={28} />
                    </div>
                    <span className="font-bold text-slate-200 group-hover:text-white uppercase tracking-wider text-sm">Report Issue</span>
                </button>
            </div>
        </div>
    );
};
