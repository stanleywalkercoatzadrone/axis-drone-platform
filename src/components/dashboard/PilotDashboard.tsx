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
import { Card, CardHeader, CardTitle, CardContent } from '../../../stitch/components/Card';
import { Badge } from '../../../stitch/components/Badge';
import { Button } from '../../../stitch/components/Button';
import { Heading, Text } from '../../../stitch/components/Typography';

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
            <div className="flex items-center justify-center p-20 min-h-screen bg-slate-950">
                <div className="w-8 h-8 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    const primaryMission = activeMissions.length > 0 ? activeMissions[0] : null;

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8 space-y-6 pb-24 text-slate-50">
            {/* Header / Welcome */}
            <Card variant="glass" className="overflow-hidden relative border-blue-500/20 bg-slate-900/50">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <CardContent className="p-6">
                    <Heading level={1} className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 tracking-tighter uppercase mb-2">
                        Welcome, {user?.fullName.split(' ')[0]}
                    </Heading>
                    <Text variant="muted" className="font-medium">
                        You have <span className="text-blue-400 font-bold">{activeMissions.length} active mission{activeMissions.length !== 1 && 's'}</span> ready for deployment today.
                    </Text>
                </CardContent>
            </Card>

            {/* Weather Snapshot Widget */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card variant="plain" className="bg-slate-900/50 border-slate-800 p-4 flex flex-col items-center justify-center gap-2">
                    <Thermometer className="text-rose-400" size={24} />
                    <span className="text-2xl font-black text-white">{weather?.temp}°</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Temp</span>
                </Card>
                <Card variant="plain" className="bg-slate-900/50 border-slate-800 p-4 flex flex-col items-center justify-center gap-2">
                    <Wind className="text-sky-400" size={24} />
                    <span className="text-2xl font-black text-white">{weather?.wind} mph</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Wind</span>
                </Card>
                <Card variant="plain" className="bg-slate-900/50 border-slate-800 p-4 flex flex-col items-center justify-center gap-2">
                    <Droplets className="text-blue-500" size={24} />
                    <span className="text-2xl font-black text-white">{weather?.precipitation}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Precip</span>
                </Card>
                <Card variant="plain" className="bg-slate-900/50 border-slate-800 p-4 flex flex-col items-center justify-center gap-2">
                    <CloudRain className="text-indigo-400" size={24} />
                    <span className="text-lg font-black text-white text-center leading-tight mt-1">{weather?.conditions}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Status</span>
                </Card>
            </div>

            {/* Today's Primary Mission Card */}
            {primaryMission ? (
                <Card className="border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-blue-900/20 to-transparent pointer-events-none" />

                    <CardHeader className="relative z-10 pb-2">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <Badge variant="info" className="mb-3 tracking-widest">
                                    Active Deployment
                                </Badge>
                                <CardTitle className="text-2xl font-black tracking-tight uppercase">
                                    {primaryMission.type.toUpperCase().replace('_', ' ')} OPERATION
                                </CardTitle>
                                <div className="flex items-center text-slate-400 mt-2 gap-2">
                                    <MapPin size={14} className="text-slate-500" />
                                    <Text variant="small" className="font-medium">{primaryMission.id}</Text>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="relative z-10 space-y-6">
                        {/* Progress Bar placeholder */}
                        <div>
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                <span className="text-slate-400">Mission Progress</span>
                                <span className="text-blue-400">{primaryMission.progress || 0}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${primaryMission.progress || 0}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <Button
                                variant="primary"
                                className="w-full py-6 text-sm flex items-center justify-center gap-3 shadow-lg group"
                                onClick={() => { }}
                            >
                                <CloudLightning size={20} className="group-hover:scale-110 transition-transform" />
                                Start Mission
                            </Button>
                            {!isOnline && (
                                <Text variant="small" className="text-center text-rose-500 uppercase tracking-widest mt-3 font-black">
                                    Currently Offline. Sync will queue.
                                </Text>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card variant="glass" className="py-12 border-slate-800/50 bg-slate-900/30 flex flex-col items-center justify-center">
                    <CheckSquare className="text-slate-600 mb-4" size={48} />
                    <Heading level={3} className="text-slate-400 uppercase tracking-widest">No Active Missions</Heading>
                    <Text variant="muted" className="mt-2 text-center max-w-sm">You have completely cleared your deployment queue. Await new dispatch assignments.</Text>
                </Card>
            )}

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-4">
                <Card variant="plain" className="bg-slate-900/60 hover:bg-slate-800/80 cursor-pointer border-slate-800 transition-colors group">
                    <CardContent className="p-5 flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                            <UploadCloud className="text-emerald-400" size={24} />
                        </div>
                        <span className="font-bold text-white uppercase tracking-wider text-sm">Upload Data</span>
                    </CardContent>
                </Card>

                <Card variant="plain" className="bg-slate-900/60 hover:bg-slate-800/80 cursor-pointer border-slate-800 transition-colors group">
                    <CardContent className="p-5 flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                            <CheckSquare className="text-blue-400" size={24} />
                        </div>
                        <span className="font-bold text-white uppercase tracking-wider text-sm">Protocols</span>
                    </CardContent>
                </Card>

                <Card variant="plain" className="bg-slate-900/60 hover:bg-slate-800/80 cursor-pointer border-slate-800 transition-colors group col-span-2">
                    <CardContent className="p-5 flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 group-hover:scale-110 transition-transform">
                            <AlertTriangle className="text-rose-400" size={24} />
                        </div>
                        <span className="font-bold text-white uppercase tracking-wider text-sm">Report Issue</span>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
