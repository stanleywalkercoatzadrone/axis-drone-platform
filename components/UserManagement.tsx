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
    UserX
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import apiClient from '../src/services/apiClient';

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
    const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
    const [resetPasswordUser, setResetPasswordUser] = useState<{ userId: string | null, newPassword: string }>({ userId: null, newPassword: '' });
    const [isLoading, setIsLoading] = useState(true);

    const [newUserForm, setNewUserForm] = useState({
        fullName: '',
        email: '',
        password: '',
        role: UserRole.FIELD_OPERATOR,
        title: '',
        companyName: currentUser.companyName
    });

    useEffect(() => {
        fetchUsers();
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

    const handleAddUser = async () => {
        if (!newUserForm.fullName || !newUserForm.email) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            console.log('DEBUG: Sending User Creation Payload:', JSON.stringify(newUserForm, null, 2));
            const res = await apiClient.post('/users', newUserForm);
            if (res.data.success) {
                fetchUsers();
                setShowAddModal(false);
                setNewUserForm({
                    fullName: '',
                    email: '',
                    password: '',
                    role: UserRole.FIELD_OPERATOR,
                    title: '',
                    companyName: currentUser.companyName
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
                setResetPasswordUser({ userId: null, newPassword: '' });
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

            const [fullName, email, password, role, title] = parts;

            if (!email || !email.includes('@')) {
                errors.push(`Line ${i + 1}: Invalid email`);
                continue;
            }

            users.push({
                fullName: fullName || '',
                email,
                password,
                role: role || UserRole.FIELD_OPERATOR,
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
        const template = 'fullName,email,role,title\nJohn Doe,john@example.com,Field Operator,Drone Pilot\nJane Smith,jane@example.com,Senior Inspector,Data Analyst';
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-7 h-7 text-blue-600" />
                        User Management
                    </h1>
                    <p className="text-slate-500 mt-1">Manage platform users and permissions</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                    >
                        <UserPlus className="w-4 h-4" /> Add User
                    </button>
                    <button
                        onClick={() => {
                            setShowBulkImportModal(true);
                            setBulkImportResults(null);
                            setBulkImportText('');
                            setBulkImportPreview([]);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm"
                    >
                        <Upload className="w-4 h-4" /> Bulk Import
                    </button>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Users</p>
                        <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{totalUsers}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Drive Linked</p>
                        <Cloud className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{activeUsers}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admins</p>
                        <ShieldAlert className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{roleDistribution[UserRole.ADMIN] || 0}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Field Ops</p>
                        <UserCheck className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{roleDistribution[UserRole.FIELD_OPERATOR] || 0}</p>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search users by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    >
                        <option value="all">All Roles</option>
                        {Object.values(UserRole).map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* User Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">No users found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Title</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-sm">
                                                            {user.fullName.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{user.fullName}</p>
                                                    <p className="text-xs text-slate-500">{user.companyName}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-slate-700 font-mono">{user.email}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded uppercase">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-slate-600">{user.title || '-'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {user.driveLinked && (
                                                    <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                                        <Cloud className="w-3 h-3" /> Linked
                                                    </span>
                                                )}
                                                {user.isDriveBlocked && (
                                                    <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                                                        <ShieldAlert className="w-3 h-3" /> Blocked
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setResetPasswordUser({ userId: user.id, newPassword: '' })}
                                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                                                    title="Reset Password"
                                                >
                                                    <Lock className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600"
                                                    title="Delete User"
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
                    <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Add New User</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                                <input
                                    type="text"
                                    value={newUserForm.fullName}
                                    onChange={e => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={newUserForm.email}
                                    onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                    New users will receive an email invitation to set up their own password and access the platform.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                                <select
                                    value={newUserForm.role}
                                    onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                >
                                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Job Title</label>
                                <input
                                    type="text"
                                    value={newUserForm.title}
                                    onChange={e => setNewUserForm({ ...newUserForm, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddUser}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                            >
                                Add User
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetPasswordUser.userId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
                    <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Reset User Password</h3>
                        <input
                            type="password"
                            placeholder="Enter new password"
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm mb-4"
                            value={resetPasswordUser.newPassword}
                            onChange={e => setResetPasswordUser(prev => ({ ...prev, newPassword: e.target.value }))}
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setResetPasswordUser({ userId: null, newPassword: '' })}
                                className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResetPassword}
                                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal - Reusing from SettingsView */}
            {showBulkImportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in p-4">
                    <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 shadow-2xl animate-in zoom-in max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-blue-600" /> Bulk Import Users
                            </h3>
                            <button
                                onClick={() => setShowBulkImportModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Mode Tabs */}
                        <div className="flex gap-2 mb-6 border-b border-slate-200">
                            <button
                                onClick={() => setBulkImportMode('file')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${bulkImportMode === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <FileText className="w-4 h-4 inline mr-2" />
                                Upload CSV
                            </button>
                            <button
                                onClick={() => setBulkImportMode('manual')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${bulkImportMode === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <FileText className="w-4 h-4 inline mr-2" />
                                Manual Entry
                            </button>
                        </div>

                        {/* File Upload Mode */}
                        {bulkImportMode === 'file' && (
                            <div className="space-y-4 mb-6">
                                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="csv-upload"
                                    />
                                    <label htmlFor="csv-upload" className="cursor-pointer">
                                        <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-slate-700 mb-1">Click to upload CSV file</p>
                                        <p className="text-xs text-slate-500">or drag and drop</p>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                                    <p className="text-xs text-slate-600">
                                        <strong>CSV Format:</strong> fullName, email, role, title
                                    </p>
                                    <button
                                        onClick={downloadCSVTemplate}
                                        className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <DownloadIcon className="w-3 h-3" /> Download Template
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Manual Entry Mode */}
                        {bulkImportMode === 'manual' && (
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Paste CSV Data
                                    </label>
                                    <textarea
                                        value={bulkImportText}
                                        onChange={(e) => handleBulkImportTextChange(e.target.value)}
                                        placeholder="fullName,email,password,role,title&#10;John Doe,john@example.com,password123,FIELD_OPERATOR,Drone Pilot"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        rows={8}
                                    />
                                    <p className="text-xs text-slate-500 mt-2">
                                        Format: fullName, email, role (optional), title (optional)
                                    </p>
                                </div>
                                <button
                                    onClick={downloadCSVTemplate}
                                    className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                                >
                                    <DownloadIcon className="w-3 h-3" /> Download Template
                                </button>
                            </div>
                        )}

                        {/* Preview Table */}
                        {bulkImportPreview.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-slate-900 mb-3">
                                    Preview ({bulkImportPreview.length} users)
                                </h4>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto max-h-64">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">#</th>
                                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Name</th>
                                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Email</th>
                                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Title</th>
                                                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bulkImportPreview.map((user, idx) => (
                                                    <tr key={idx} className={`border-b border-slate-100 ${!user.valid ? 'bg-red-50' : ''}`}>
                                                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                                                        <td className="px-3 py-2 text-slate-900">{user.fullName || '-'}</td>
                                                        <td className="px-3 py-2 text-slate-700 font-mono text-xs">{user.email}</td>
                                                        <td className="px-3 py-2">
                                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded uppercase">
                                                                {user.role}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600">{user.title || '-'}</td>
                                                        <td className="px-3 py-2">
                                                            {user.valid ? (
                                                                <span className="text-green-600 text-xs font-medium flex items-center gap-1">
                                                                    <CheckCircle className="w-3 h-3" /> Valid
                                                                </span>
                                                            ) : (
                                                                <span className="text-red-600 text-xs font-medium flex items-center gap-1">
                                                                    <AlertTriangle className="w-3 h-3" /> Invalid
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

                        {/* Results Display */}
                        {bulkImportResults && (
                            <div className={`mb-6 p-4 rounded-lg ${bulkImportResults.success > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {bulkImportResults.success > 0 ? (
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                    )}
                                    <h4 className={`font-bold text-sm ${bulkImportResults.success > 0 ? 'text-green-900' : 'text-red-900'}`}>
                                        Import Results
                                    </h4>
                                </div>
                                <p className={`text-sm ${bulkImportResults.success > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    Successfully imported: <strong>{bulkImportResults.success}</strong> users
                                    {bulkImportResults.failed > 0 && (
                                        <> | Failed: <strong>{bulkImportResults.failed}</strong> users</>
                                    )}
                                </p>
                                {bulkImportResults.errors.length > 0 && (
                                    <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
                                        {bulkImportResults.errors.map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowBulkImportModal(false)}
                                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkImport}
                                disabled={isBulkImporting || bulkImportPreview.length === 0}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isBulkImporting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Importing...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" /> Import {bulkImportPreview.length} Users
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
