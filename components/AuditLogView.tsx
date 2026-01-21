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
    Eye
} from 'lucide-react';
import { AuditLogEntry, UserRole } from '../types';
import apiClient from '../src/services/apiClient';

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
            <div className="flex flex-col items-center justify-center h-96">
                <Shield className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-700">Access Restricted</h3>
                <p className="text-slate-500">Only Admins and Auditors can view the audit trail.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="w-7 h-7 text-indigo-600" />
                        Audit Trail
                    </h1>
                    <p className="text-slate-500 mt-1">Immutable record of all critical system actions</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                    <Clock className="w-4 h-4" /> Refresh
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter by User ID..."
                            value={filterUser}
                            onChange={(e) => setFilterUser(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <select
                        value={filterResource}
                        onChange={(e) => setFilterResource(e.target.value)}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    >
                        <option value="all">All Resources</option>
                        <option value="report">Reports</option>
                        <option value="deployment">Deployments</option>
                        <option value="user">Users</option>
                        <option value="system">System</option>
                    </select>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Resource</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Metadata</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        Loading records...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        No audit records found matching your filters
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm font-medium text-slate-700">{log.userName || log.userId}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-bold rounded uppercase ${log.action.includes('DELETE') ? 'bg-red-50 text-red-700' :
                                                    log.action.includes('CREATE') ? 'bg-green-50 text-green-700' :
                                                        log.action.includes('UPDATE') ? 'bg-blue-50 text-blue-700' :
                                                            log.action.includes('FINALIZED') ? 'bg-purple-50 text-purple-700' :
                                                                'bg-slate-100 text-slate-700'
                                                }`}>
                                                {log.action.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            <span className="capitalize">{log.resource_type || 'System'}</span>
                                            <span className="text-slate-400 ml-1 text-xs">{log.resource_id?.substring(0, 8)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                                            {log.metadata ? JSON.stringify(log.metadata) : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuditLogView;
