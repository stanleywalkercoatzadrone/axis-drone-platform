import React, { useState, useEffect } from 'react';
import {
    Shield,
    Search,
    Filter,
    Clock,
    User,
    FileText,
    AlertCircle,
    Download,
    Eye,
    Loader2
} from 'lucide-react';
import { AuditLogEntry, UserRole } from '../types';
import apiClient from '../src/services/apiClient';
import { Button } from '../src/stitch/components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../src/stitch/components/Card';
import { Input } from '../src/stitch/components/Input';
import { Badge } from '../src/stitch/components/Badge';
import { Heading, Text } from '../src/stitch/components/Typography';

interface AuditLogViewProps {
    currentUserRole: UserRole;
}

const AuditLogView: React.FC<AuditLogViewProps> = ({ currentUserRole }) => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterUser, setFilterUser] = useState('');
    const [filterResource, setFilterResource] = useState('all');

    useEffect(() => {
        fetchLogs();
    }, [filterUser, filterResource]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterUser) params.append('userId', filterUser);
            if (filterResource !== 'all') params.append('resourceType', filterResource);

            const res = await apiClient.get(`/audit?${params.toString()}`);
            if (res.data.success) {
                setLogs(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch audit logs', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    if (currentUserRole !== UserRole.ADMIN && currentUserRole !== UserRole.AUDITOR) {
        return (
            <div className="flex flex-col items-center justify-center h-96 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Card variant="glass" className="p-12 flex flex-col items-center max-w-md border-red-900/20">
                    <div className="w-20 h-20 bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mb-6 ring-8 ring-red-950/10">
                        <Shield className="w-10 h-10" />
                    </div>
                    <Heading level={2} className="text-white mb-2">Access Restricted</Heading>
                    <Text className="text-slate-400 text-center">Only authorized administrators and auditors can access the secure system logs.</Text>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 text-slate-200">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <Heading level={2} className="text-white tracking-widest flex items-center gap-3">
                        <Shield className="w-8 h-8 text-cyan-500" />
                        AUDIT TRAIL
                    </Heading>
                    <Text variant="small" className="text-slate-500 font-mono mt-1 uppercase tracking-tighter">SECURE CRYPTOGRAPHIC LEDGER OF SYSTEM EVENTS</Text>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchLogs}
                    className="border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-900/50 bg-slate-900/50 backdrop-blur-sm self-start md:self-auto"
                >
                    <Clock className="w-4 h-4 mr-2" /> REFRESH LEDGER
                </Button>
            </div>

            <Card variant="glass" className="p-1.5 border-slate-800/50 shadow-2xl">
                <div className="flex flex-col md:flex-row gap-4 p-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                            placeholder="Search by Investigator or Entity ID..."
                            value={filterUser}
                            onChange={(e) => setFilterUser(e.target.value)}
                            className="pl-10 bg-slate-950/50 border-slate-800 focus:border-cyan-500/50 transition-all"
                        />
                    </div>
                    <div className="relative md:w-64">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        <select
                            value={filterResource}
                            onChange={(e) => setFilterResource(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-sm text-slate-300 appearance-none focus:outline-none focus:border-cyan-500/50 transition-all font-bold"
                        >
                            <option value="all">ALL EVENT STREAMS</option>
                            <option value="report">INSPECTION REPORTS</option>
                            <option value="deployment">FLIGHT MISSIONS</option>
                            <option value="user">AUTHENTICATION</option>
                            <option value="system">CORE SYSTEM</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-y border-slate-800 bg-slate-950/30">
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest pl-8">TIMESTAMP</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">ACTOR</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">PROTOCOL</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">OBJECT</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest pr-8">METADATA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                                            <Text variant="small" className="text-slate-500 font-mono tracking-widest">SYNCHRONIZING SECURE STREAM...</Text>
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-24 text-center text-slate-500 italic">
                                        No cryptographic records found matching current query.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-cyan-500/[0.02] transition-colors group">
                                        <td className="px-6 py-5 whitespace-nowrap text-xs text-slate-400 font-mono pl-8">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 group-hover:border-cyan-500/30 transition-all">
                                                    <User className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                                                    {log.userName || log.userId}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <Badge
                                                variant={
                                                    log.action.includes('DELETE') ? 'destructive' :
                                                        log.action.includes('CREATE') ? 'success' :
                                                            log.action.includes('UPDATE') ? 'warning' :
                                                                'secondary'
                                                }
                                                className="font-black text-[9px] tracking-widest italic px-2 py-0.5"
                                            >
                                                {log.action.replace(/_/g, ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-xs text-slate-400">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-300 uppercase tracking-tighter">{log.resource_type || 'SYSTEM'}</span>
                                                <span className="text-slate-600 font-mono text-[10px]">{log.resource_id?.substring(0, 8)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 pr-8">
                                            <div className="max-w-[200px] lg:max-w-xs overflow-hidden">
                                                <Text variant="small" className="text-slate-500 font-mono text-[10px] truncate leading-none">
                                                    {log.metadata ? JSON.stringify(log.metadata) : 'No payload'}
                                                </Text>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default AuditLogView;
