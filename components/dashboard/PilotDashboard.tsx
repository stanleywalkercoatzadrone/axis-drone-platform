import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useIndustry } from '../../context/IndustryContext';
import { KPIBar } from '../widgets/KPIBar';
import { WeatherWidget } from '../widgets/WeatherWidget';
import { AxisPerformanceTab } from '../personnel/AxisPerformanceTab';
import apiClient from '../../src/services/apiClient';
import { WorkItem } from '../../types';
import {
    Activity, ArrowRight, Clock, AlertCircle, CheckCircle2, CheckSquare, BarChart3, CloudSun, Calendar
} from 'lucide-react';
import { format } from 'date-fns';

export const PilotDashboard: React.FC = () => {
    const { user } = useAuth();
    const { tLabel } = useIndustry();
    const [stats, setStats] = useState({
        pendingTasks: 0,
        inProgressTasks: 0,
        completedThisWeek: 0,
    });
    const [recentTasks, setRecentTasks] = useState<WorkItem[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);

    useEffect(() => {
        fetchPilotData();
    }, []);

    const fetchPilotData = async () => {
        try {
            setLoadingTasks(true);
            const response = await apiClient.get('/work-items?assignedTo=me');
            if (response.data.success) {
                const items: WorkItem[] = response.data.data;
                const now = new Date();
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                const pending = items.filter(i => i.status === 'open' || i.status === 'blocked').length;
                const inProgress = items.filter(i => i.status === 'in_progress').length;
                const completed = items.filter(i => i.status === 'done' && i.completedAt && new Date(i.completedAt) > oneWeekAgo).length;

                setStats({
                    pendingTasks: pending,
                    inProgressTasks: inProgress,
                    completedThisWeek: completed
                });

                // Top 3 most urgent/recent open tasks
                const active = items.filter(i => i.status !== 'done')
                    .sort((a, b) => new Date(a.dueDate || '2099-01-01').getTime() - new Date(b.dueDate || '2099-01-01').getTime())
                    .slice(0, 3);
                setRecentTasks(active);
            }
        } catch (error) {
            console.error('Error fetching pilot data:', error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'done': return <CheckCircle2 size={16} className="text-emerald-500" />;
            case 'in_progress': return <Clock size={16} className="text-blue-500" />;
            case 'blocked': return <AlertCircle size={16} className="text-red-500" />;
            default: return <CheckSquare size={16} className="text-slate-400" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Welcome, {user?.fullName?.split(' ')[0] || 'Pilot'}</h2>
                    <p className="text-sm text-slate-400 mt-1">Here is your {tLabel('mission')} summary for {format(new Date(), 'EEEE, MMMM do')}.</p>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 transition-all flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">To Do</p>
                        <h3 className="text-3xl font-black text-white">{stats.pendingTasks}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                        <CheckSquare className="w-6 h-6 text-slate-400" />
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-blue-500 rounded-xl p-5 hover:border-blue-500/50 transition-all flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Active</p>
                        <h3 className="text-3xl font-black text-white">{stats.inProgressTasks}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-blue-500" />
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-emerald-500 rounded-xl p-5 hover:border-emerald-500/50 transition-all flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Done (7d)</p>
                        <h3 className="text-3xl font-black text-white">{stats.completedThisWeek}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Column (Weather & Tasks) */}
                <div className="xl:col-span-1 space-y-6">
                    <WeatherWidget />

                    {/* Pending Tasks Snippet */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-blue-400" />
                                Upcoming {tLabel('workItem')}s
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-800">
                            {loadingTasks ? (
                                <div className="p-8 text-center text-slate-500">
                                    <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-600" />
                                    Loading items...
                                </div>
                            ) : recentTasks.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                                    <p className="text-sm">You have no pending assignments.</p>
                                </div>
                            ) : (
                                recentTasks.map(task => (
                                    <div key={task.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    {getStatusIcon(task.status)}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-200 line-clamp-1">{task.title}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {task.dueDate && (
                                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" /> {format(new Date(task.dueDate), 'MMM d')}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
                                                            {task.priority || 'Normal'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {recentTasks.length > 0 && (
                            <div className="p-3 border-t border-slate-800 bg-slate-900/30 text-center">
                                <button className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 w-full mx-auto uppercase tracking-wide">
                                    View All Tasks <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Column (Performance) */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 flex justify-between items-center bg-slate-900/50">
                            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-emerald-400" />
                                Axis Performance Index
                            </h3>
                        </div>
                        <div className="p-6">
                            {user?.id ? (
                                <AxisPerformanceTab pilotId={user.id} />
                            ) : (
                                <div className="text-slate-500 text-center p-8">Unable to load performance metrics...</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PilotDashboard;
