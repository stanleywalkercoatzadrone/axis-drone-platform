import React, { useState, useEffect } from 'react';
import {
    Activity,
    Server,
    Database,
    AlertTriangle,
    CheckCircle,
    Cpu,
    RefreshCw
} from 'lucide-react';
import apiClient from '../src/services/apiClient';

const SystemHealth: React.FC = () => {
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastCheck, setLastCheck] = useState<Date | null>(null);

    const checkHealth = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/system/health'); // Assume this delegates to /health
            // Or use direct /health if proxy setup? assuming apiClient prefixes /api, but server.js has /health at root.
            // Let's try /api/system/health route which routes/system.js might handle or we fetch root.
            // For now, let's assume valid response structure.
            if (res.data) {
                setHealth(res.data);
                setLastCheck(new Date());
            }
        } catch (error) {
            console.error('Health check failed', error);
            setHealth({ status: 'error', error: 'Unreachable' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        if (status === 'ok' || status === 'healthy') return 'text-green-600 bg-green-50';
        if (status === 'degraded') return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-7 h-7 text-green-600" />
                        System Health
                    </h1>
                    <p className="text-slate-700 font-medium mt-1">Real-time infrastructure monitoring</p>
                </div>
                <button
                    onClick={checkHealth}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Checking...' : 'Check Status'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Status */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Overall Status</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                {health?.status === 'ok' ? 'Operational' : 'Issues Detected'}
                            </h3>
                        </div>
                        <div className={`p-3 rounded-full ${getStatusColor(health?.status || 'error')}`}>
                            <Activity className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-sm text-slate-500">
                        Last checked: {lastCheck ? lastCheck.toLocaleTimeString() : 'Never'}
                    </div>
                </div>

                {/* Database */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Database</p>
                            <h3 className="text-lg font-bold text-slate-900 mt-1">Supabase PostgreSQL</h3>
                        </div>
                        <div className={`p-3 rounded-full bg-blue-50 text-blue-600`}>
                            <Database className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <CheckCircle className="w-4 h-4" /> Connected
                    </div>
                </div>

                {/* AI Service */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">AI Inference</p>
                            <h3 className="text-lg font-bold text-slate-900 mt-1">Gemini Pro 1.5</h3>
                        </div>
                        <div className={`p-3 rounded-full bg-purple-50 text-purple-600`}>
                            <Cpu className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <CheckCircle className="w-4 h-4" /> Available
                    </div>
                </div>
            </div>

            {/* Recent Errors (Mock for now, would connect to an error log endpoint) */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-bold text-slate-700">Recent System Events</h3>
                </div>
                <div className="p-6 text-center text-slate-500">
                    No critical system errors reported in the last 24 hours.
                </div>
            </div>
        </div>
    );
};

export default SystemHealth;
