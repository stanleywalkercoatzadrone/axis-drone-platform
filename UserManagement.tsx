import React, { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Upload,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Lock,
    ShieldAlert,
    Cloud,
    CheckCircle,
    AlertTriangle,
    X,
    Loader2,
    DownloadCloud,
    FileText,
    UploadCloud,
    Download as DownloadIcon,
    TrendingUp,
    UserCheck,
    UserX,
    Shield,
    Briefcase,
    Building2,
    Mail
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import apiClient from '../src/services/apiClient';
import { Input } from '../src/stitch/components/Input';
import { cn } from '../src/stitch/utils/cn';

interface UserManagementProps {
    currentUser: UserAccount;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<UserAccount[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserAccount[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBulkImportModal, setShowBulkImportModal] = useState(false);
    const [bulkImportMode, setBulkImportMode] = useState<'file' | 'manual'>('file');
    const [bulkImportText, setBulkImportText] = useState('');
    const [bulkImportPreview, setBulkImportPreview] = useState<any[]>([]);
    const [bulkImportResults, setBulkImportResults] = useState<{ success: number, failed: number, errors: string[] } | null>(null);
    const [isBulkImporting, setIsBulkImporting] = useState(false);
    const [bulkImportClientId, setBulkImportClientId] = useState<string>('');
    const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
    const [resetPasswordUser, setResetPasswordUser] = useState<{ userId: string | null, userName: string | null, newPassword: string }>({ userId: null, userName: null, newPassword: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [clients, setClients] = useState<{ id: string, name: string }[]>([]);

    const [newUserForm, setNewUserForm] = useState({
        fullName: '',
        email: '',
        role: UserRole.FIELD_OPERATOR,
        title: '',
        companyName: currentUser.companyName,
        clientId: ''
    });

    useEffect(() => {
        fetchUsers();
        fetchClients();
    }, []);

    useEffect(() => {
        let filtered = users;

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(u =>
                u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.email.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Role filter
        if (roleFilter !== 'all') {
            filtered = filtered.filter(u => u.role === roleFilter);
        }

        setFilteredUsers(filtered);
    }, [users, searchQuery, roleFilter]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/users');
            if (res.data.success) {
                setUsers(res.data.data);
                setFilteredUsers(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch users', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchClients = async () => {
        try {
            const res = await apiClient.get('/clients');
            if (res.data.success) {
                setClients(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch clients', err);
        }
    };

    const handleAddUser = async () => {
        if (!newUserForm.fullName || !newUserForm.email) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const res = await apiClient.post('/users', newUserForm);
            if (res.data.success) {
                fetchUsers();
                setShowAddModal(false);
                setNewUserForm({
                    fullName: '',
                    email: '',
                    role: UserRole.FIELD_OPERATOR,
                    title: '',
                    companyName: currentUser.companyName,
                    clientId: ''
                });
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to create user');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            await apiClient.delete(`/users/${userId}`);
            fetchUsers();
        } catch (error) {
            alert('Failed to delete user');
        }
    };

    const handleResetPassword = async () => {
        if (!resetPasswordUser.userId || resetPasswordUser.newPassword.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }

        try {
            const res = await apiClient.post(`/users/${resetPasswordUser.userId}/reset-password`, {
                newPassword: resetPasswordUser.newPassword
            });
            if (res.data.success) {
                alert('Password reset successfully');
                setResetPasswordUser({ userId: null, userName: null, newPassword: '' });
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to reset password');
        }
    };

    const parseCSV = (text: string) => {
        const lines = text.trim().split('\n').filter(line => line.trim());
        if (lines.length === 0) return { users: [], errors: [] };

        const users = [];
        const errors: string[] = [];
        const startIndex = lines[0].toLowerCase().includes('fullname') || lines[0].toLowerCase().includes('email') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',').map(p => p.trim());

            if (parts.length < 2) {
                errors.push(`Line ${i + 1}: Not enough fields`);
                continue;
            }

            const [fullName, email, role, title] = parts;

            if (!email || !email.includes('@')) {
                errors.push(`Line ${i + 1}: Invalid email`);
                continue;
            }

            users.push({
                fullName: fullName || '',
                email,
                role: (role?.toLowerCase() === 'client_user' || role?.toLowerCase() === 'client user') ? 'client_user' : (role || UserRole.FIELD_OPERATOR),
                title: title || '',
                lineNumber: i + 1,
                valid: fullName && email
            });
        }

        return { users, errors };
    };

    const handleBulkImportTextChange = (text: string) => {
        setBulkImportText(text);
        const { users } = parseCSV(text);
        setBulkImportPreview(users);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            handleBulkImportTextChange(text);
            setBulkImportMode('file');
        };
        reader.readAsText(file);
    };

    const handleBulkImport = async () => {
        if (bulkImportPreview.length === 0) {
            alert('No users to import');
            return;
        }

        const validUsers = bulkImportPreview.filter(u => u.valid);
        if (validUsers.length === 0) {
            alert('No valid users to import');
            return;
        }

        setIsBulkImporting(true);
        setBulkImportResults(null);

        try {
            const response = await apiClient.post('/users/batch', {
                clientId: bulkImportClientId || undefined,
                users: validUsers.map(u => ({
                    fullName: u.fullName,
                    email: u.email,
                    password: u.password,
                    role: u.role,
                    title: u.title,
                    companyName: currentUser.companyName
                }))
            });

            if (response.data.success) {
                const successCount = response.data.count || 0;
                const failedCount = validUsers.length - successCount;

                setBulkImportResults({
                    success: successCount,
                    failed: failedCount,
                    errors: failedCount > 0 ? ['Some users may already exist'] : []
                });

                fetchUsers();

                if (failedCount === 0) {
                    setTimeout(() => {
                        setBulkImportText('');
                        setBulkImportPreview([]);
                        setShowBulkImportModal(false);
                        setBulkImportResults(null);
                    }, 3000);
                }
            }
        } catch (error: any) {
            setBulkImportResults({
                success: 0,
                failed: validUsers.length,
                errors: [error.response?.data?.message || 'Failed to import users']
            });
        } finally {
            setIsBulkImporting(false);
        }
    };

    const downloadCSVTemplate = () => {
        const template = 'fullName,email,role,title\nJohn Doe,john@example.com,pilot_technician,Drone Pilot\nJane Smith,jane@example.com,senior_inspector,Data Analyst';
        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'user_import_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Calculate stats
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.driveLinked).length;
    const roleDistribution = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-[1.25rem] shadow-xl shadow-blue-500/20">
                            <Users className="w-8 h-8 text-white" />
                        </div>
                        IAM CONTROL HUB
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2 ml-1">Identity & Access Management Node</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-2xl shadow-slate-900/10 active:scale-95"
                    >
                        <UserPlus className="w-4 h-4" /> Provision User
                    </button>
                    <button
                        onClick={() => {
                            setShowBulkImportModal(true);
                            setBulkImportResults(null);
                            setBulkImportText('');
                            setBulkImportPreview([]);
                        }}
                        className="flex items-center gap-3 px-6 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                    >
                        <Upload className="w-4 h-4" /> Batch Import
                    </button>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Network Total', value: totalUsers, icon: Users, color: 'blue' },
                    { label: 'Vault Linked', value: activeUsers, icon: Cloud, color: 'green' },
                    { label: 'Privileged Nodes', value: roleDistribution[UserRole.ADMIN] || 0, icon: Shield, color: 'purple' },
                    { label: 'Field Assets', value: roleDistribution[UserRole.FIELD_OPERATOR] || 0, icon: Briefcase, color: 'orange' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all duration-500 group">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                            <div className={cn("p-2 rounded-xl bg-slate-50 group-hover:bg-white transition-colors duration-500", `text-${stat.color}-600`)}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Search and Filters */}
            <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 backdrop-blur-sm">
                <div className="flex gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter registry by name, email, or identifier..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-14 pr-8 py-5 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/50 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-8 py-5 bg-white border border-slate-200 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/50 outline-none transition-all shadow-sm appearance-none cursor-pointer pr-12 text-slate-600"
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center', backgroundSize: '1rem' }}
                    >
                        <option value="all">ALL PRIVILEGE TIERS</option>
                        {Object.values(UserRole).map(role => (
                            <option key={role} value={role}>{role.toUpperCase().replace('_', ' ')}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* User Table */}
            <div className="bg-white border border-slate-100 rounded-[3rem] shadow-2xl shadow-slate-200/50 overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Identity Matrix...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-32 space-y-4">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto">
                            <Users className="w-10 h-10 text-slate-200" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No matching identities found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity Node</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Email</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Privilege Tier</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Provisioned Role</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Interface Status</th>
                                    <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Operations</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-all duration-300 group">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm transition-transform duration-500 group-hover:scale-110">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-900 font-black text-lg">
                                                            {user.fullName.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 tracking-tight">{user.fullName}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{user.companyName}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <p className="text-xs text-slate-600 font-bold font-mono group-hover:text-blue-600 transition-colors">{user.email}</p>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className={cn(
                                                "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                                user.role === UserRole.ADMIN ? "bg-purple-50 text-purple-700" :
                                                    (user.role === UserRole.FIELD_OPERATOR || (user.role as string) === 'pilot_technician') ? "bg-orange-50 text-orange-700" :
                                                        "bg-blue-50 text-blue-700"
                                            )}>
                                                {(user.role as string).replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8">
                                            <p className="text-xs font-bold text-slate-500">{user.title || '-'}</p>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col gap-1.5">
                                                {user.driveLinked ? (
                                                    <span className="inline-flex items-center gap-2 text-green-600 text-[9px] font-black uppercase tracking-widest">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                        Vault Synchronized
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-2 text-slate-300 text-[9px] font-black uppercase tracking-widest">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                                        Direct Only
                                                    </span>
                                                )}
                                                {user.isDriveBlocked && (
                                                    <span className="inline-flex items-center gap-2 text-red-600 text-[9px] font-black uppercase tracking-widest">
                                                        <ShieldAlert className="w-3 h-3" /> Integrity Lock
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => setResetPasswordUser({ userId: user.id, userName: user.fullName, newPassword: '' })}
                                                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
                                                    title="Security Reset"
                                                >
                                                    <Lock className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-red-600 hover:border-red-100 hover:shadow-lg hover:shadow-red-500/10 transition-all"
                                                    title="Permanently Expunge"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] p-10 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100 overflow-hidden">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Provision Node</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Identity Gateway Interface</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <Input
                                label="Legal Full Name"
                                placeholder="Provisioning Target Name..."
                                value={newUserForm.fullName}
                                onChange={e => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                                className="rounded-[1.25rem] py-6"
                            />

                            <Input
                                label="Endpoint Email"
                                type="email"
                                placeholder="node@protocol.com"
                                value={newUserForm.email}
                                onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                className="rounded-[1.25rem] py-6"
                            />

                            <div className="bg-blue-50/50 p-6 rounded-[1.5rem] border border-blue-100/50 flex gap-4">
                                <Shield className="w-6 h-6 text-blue-600 flex-shrink-0" />
                                <p className="text-[10px] font-bold text-blue-900 uppercase tracking-widest leading-relaxed">
                                    Protocol: Auto-Provisioning. Targeted node will receive an encrypted downlink to establish secure credentials.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Privilege Authorization</label>
                                <select
                                    value={newUserForm.role}
                                    onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[1.25rem] text-xs font-bold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center', backgroundSize: '1rem' }}
                                >
                                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r.toUpperCase().replace('_', ' ')}</option>)}
                                </select>
                            </div>

                            {/* Client Selection - Only for CLIENT_USER */}
                            {newUserForm.role === UserRole.CLIENT_USER && (
                                <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                                    <label className="text-[11px] font-black text-slate-900 uppercase tracking-widest ml-1">Affiliation Mapping</label>
                                    <select
                                        value={newUserForm.clientId}
                                        onChange={e => setNewUserForm({ ...newUserForm, clientId: e.target.value })}
                                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[1.25rem] text-xs font-bold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/50 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center', backgroundSize: '1rem' }}
                                    >
                                        <option value="">Select Organization Node</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <Input
                                label="Designated Title"
                                placeholder="Operational Designation..."
                                value={newUserForm.title}
                                onChange={e => setNewUserForm({ ...newUserForm, title: e.target.value })}
                                className="rounded-[1.25rem] py-6"
                            />
                        </div>

                        <div className="flex gap-4 mt-12">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-8 py-5 border border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                            >
                                Abort
                            </button>
                            <button
                                onClick={handleAddUser}
                                className="flex-1 px-8 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 shadow-2xl shadow-slate-900/10 transition-all active:scale-95"
                            >
                                Authorize Provision
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetPasswordUser.userId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                                <Lock className="w-8 h-8 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Security Reset</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Node: {resetPasswordUser.userName}</p>
                        </div>

                        <div className="space-y-6">
                            <Input
                                type="password"
                                label="New Access Key"
                                placeholder="••••••••••••"
                                className="rounded-2xl py-6 text-center text-lg"
                                value={resetPasswordUser.newPassword}
                                onChange={e => setResetPasswordUser(prev => ({ ...prev, newPassword: e.target.value }))}
                                autoFocus
                            />

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setResetPasswordUser({ userId: null, userName: null, newPassword: '' })}
                                    className="flex-1 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResetPassword}
                                    className="flex-1 px-4 py-4 bg-slate-900 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                                >
                                    Reset Access
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkImportModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-500 overflow-y-auto">
                    <div className="bg-white rounded-[3.5rem] p-12 max-w-5xl w-full mx-auto shadow-[0_0_100px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-500 border border-slate-100">
                        <div className="flex items-center justify-between mb-12">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-4">
                                    <div className="p-3 bg-blue-600 rounded-2xl shadow-lg">
                                        <Upload className="w-6 h-6 text-white" />
                                    </div>
                                    Neural Batch Ingress
                                </h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 ml-1">Identity Matrix Bulk Provisioning</p>
                            </div>
                            <button
                                onClick={() => setShowBulkImportModal(false)}
                                className="p-4 hover:bg-slate-100 rounded-full text-slate-400 transition-all active:rotate-90 duration-300"
                            >
                                <X className="w-8 h-8" />
                            </button>
                        </div>

                        {/* Mode Tabs */}
                        <div className="flex gap-8 mb-12 border-b-2 border-slate-50">
                            {[
                                { id: 'file', label: 'CSV Downlink', icon: FileText },
                                { id: 'manual', label: 'Manual Sequence', icon: Edit }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setBulkImportMode(tab.id as any)}
                                    className={cn(
                                        "pb-6 text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all relative",
                                        bulkImportMode === tab.id ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                    {bulkImportMode === tab.id && <div className="absolute bottom-[-2px] left-0 right-0 h-1 bg-blue-600 rounded-full animate-in fade-in slide-in-from-left duration-300" />}
                                </button>
                            ))}
                        </div>

                        {/* Client Selection for Bulk Import */}
                        <div className="mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-4">Associate with Organization (Optional)</label>
                            <select
                                value={bulkImportClientId}
                                onChange={(e) => setBulkImportClientId(e.target.value)}
                                className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/50 outline-none transition-all shadow-sm"
                            >
                                <option value="">NO CLIENT ASSOCIATION (INTERNAL ONLY)</option>
                                {clients.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {client.name.toUpperCase()} ({client.industry_name})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* File Upload Mode */}
                        {bulkImportMode === 'file' && (
                            <div className="space-y-8 mb-12">
                                <div className="border-[3px] border-dashed border-slate-100 rounded-[3rem] p-20 text-center hover:border-blue-200 transition-all bg-slate-50/30 group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-[0.02] transition-opacity" />
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="csv-upload"
                                    />
                                    <label htmlFor="csv-upload" className="cursor-pointer block">
                                        <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 flex items-center justify-center mx-auto mb-8 transition-transform group-hover:scale-110 duration-500">
                                            <UploadCloud className="w-10 h-10 text-blue-600" />
                                        </div>
                                        <p className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Initialize Downlink</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Awaiting CSV Protocol Injection</p>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between bg-slate-900 p-6 rounded-[2rem] shadow-2xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 font-black text-xs">CSV</div>
                                        <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                                            Schema: <span className="text-blue-400">fullName, email, role, title</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={downloadCSVTemplate}
                                        className="px-6 py-3 bg-white/10 text-white hover:bg-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-3 transition-all"
                                    >
                                        <DownloadIcon className="w-4 h-4" /> Protocol Template
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Manual Entry Mode */}
                        {bulkImportMode === 'manual' && (
                            <div className="space-y-4 mb-12">
                                <div className="relative">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest p-4 block">Manual Data Injection</label>
                                    <textarea
                                        value={bulkImportText}
                                        onChange={(e) => handleBulkImportTextChange(e.target.value)}
                                        placeholder="fullName,email,role,title&#10;John Smith,john@protocol.net,pilot_technician,Operations Lead"
                                        className="w-full px-10 py-10 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-mono font-bold focus:ring-[12px] focus:ring-blue-500/5 focus:border-blue-500/50 outline-none transition-all min-h-[300px] shadow-inner"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Preview Table */}
                        {bulkImportPreview.length > 0 && (
                            <div className="mb-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                <div className="flex items-center justify-between mb-6 px-4">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Identity Buffer ({bulkImportPreview.length} Nodes)</h4>
                                    <div className="h-px flex-1 bg-slate-50 mx-8" />
                                </div>
                                <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden">
                                    <div className="overflow-x-auto max-h-[400px]">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 sticky top-0 z-10">
                                                <tr className="border-b border-slate-100">
                                                    <th className="px-8 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">#</th>
                                                    <th className="px-8 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Node Name</th>
                                                    <th className="px-8 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Endpoint</th>
                                                    <th className="px-8 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Tier</th>
                                                    <th className="px-8 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {bulkImportPreview.map((user, idx) => (
                                                    <tr key={idx} className={cn("hover:bg-slate-50 transition-colors", !user.valid ? 'bg-red-50/50' : '')}>
                                                        <td className="px-8 py-4 font-mono text-[10px] text-slate-400">{String(idx + 1).padStart(2, '0')}</td>
                                                        <td className="px-8 py-4 font-black text-slate-900">{user.fullName || '-'}</td>
                                                        <td className="px-8 py-4 font-bold text-slate-500 font-mono text-xs">{user.email}</td>
                                                        <td className="px-8 py-4">
                                                            <span className="px-3 py-1 bg-slate-900 text-white text-[8px] font-black rounded-full uppercase tracking-widest">
                                                                {(user.role as string).replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            {user.valid ? (
                                                                <span className="text-green-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Integrity Confirmed
                                                                </span>
                                                            ) : (
                                                                <span className="text-red-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                                                    <AlertTriangle className="w-3 h-3" /> Schema Violation
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-6 mt-12">
                            <button
                                onClick={() => setShowBulkImportModal(false)}
                                className="flex-1 py-6 border-2 border-slate-100 text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 rounded-[2rem] transition-all"
                            >
                                Terminate Session
                            </button>
                            <button
                                onClick={handleBulkImport}
                                disabled={isBulkImporting || bulkImportPreview.length === 0}
                                className="flex-[2] py-6 bg-slate-900 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-4 shadow-2xl shadow-slate-900/20 active:scale-95 transition-all"
                            >
                                {isBulkImporting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Injecting Matrix...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        Authorize Ingress ({bulkImportPreview.length} Nodes)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
