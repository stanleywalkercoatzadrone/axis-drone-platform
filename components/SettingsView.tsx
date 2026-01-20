
import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  Save,
  LogOut,
  Mail,
  ShieldAlert,
  Lock,
  ChevronDown,
  Fingerprint,
  Cpu,
  Server,
  Layers,
  Activity,
  Zap,
  Wifi,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Check,
  Cloud,
  FolderOpen,
  SearchCode,
  Users,
  UserPlus,
  UploadCloud,
  History as HistoryIcon,
  Download as DownloadIcon,
  Receipt,
  Plus,
  X,
  CheckCircle,
  Upload,
  FileText
} from 'lucide-react';
import { UserAccount, UserRole, ADMIN_PASSKEY, ROLE_DEFINITIONS, AuditLogEntry } from '../types';
import { testAIConnection } from '../geminiService';
import { googleAuthService } from '../src/services/googleAuthService';
import apiClient from '../src/services/apiClient';

interface SettingsViewProps {
  currentUser: UserAccount;
  onUpdateUser: (user: UserAccount) => void;
  onLogout: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, onUpdateUser, onLogout }) => {
  const [activeSection, setActiveSection] = useState('profile');
  const [saveStatus, setSaveStatus] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [diagResult, setDiagResult] = useState<{ status: 'ok' | 'error' | null, latency?: number, message?: string }>({ status: null });
  const [showPasskeyField, setShowPasskeyField] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState(false);
  const [isValidatingPath, setIsValidatingPath] = useState(false);
  const [pathValid, setPathValid] = useState<boolean | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [systemHealth, setSystemHealth] = useState<{ node: string, model: string, database: string, uptime: number, version: string } | null>(null);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<'file' | 'manual'>('file');
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportPreview, setBulkImportPreview] = useState<any[]>([]);
  const [bulkImportResults, setBulkImportResults] = useState<{ success: number, failed: number, errors: string[] } | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: currentUser.fullName,
    email: currentUser.email,
    companyName: currentUser.companyName,
    title: currentUser.title || '',
    role: currentUser.role,
    driveFolder: currentUser.driveFolder || 'Axis_Enterprise_Vault',
    aiSensitivity: 50
  });

  // Sync formData with currentUser prop updates
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      fullName: currentUser.fullName,
      email: currentUser.email,
      companyName: currentUser.companyName,
      title: currentUser.title || '',
      role: currentUser.role,
      driveFolder: currentUser.driveFolder || prev.driveFolder
    }));
  }, [currentUser]);

  const [teamUsers, setTeamUsers] = useState<UserAccount[]>([]);
  const [resetPasswordValues, setResetPasswordValues] = useState<{ userId: string | null, new: string }>({ userId: null, new: '' });
  const [invoiceSettings, setInvoiceSettings] = useState<{ adminEmail: string, ccEmails: string[] }>({ adminEmail: '', ccEmails: [] });

  useEffect(() => {
    if (activeSection === 'team' && formData.role === UserRole.ADMIN) {
      fetchUsers();
    }
    if (activeSection === 'invoicing' && formData.role === UserRole.ADMIN) {
      apiClient.get('/system/settings').then(res => {
        if (res.data.success) {
          const s = res.data.data;
          const ccs = s.invoice_cc_emails ? JSON.parse(s.invoice_cc_emails) : [];
          setInvoiceSettings({
            adminEmail: s.invoice_admin_email || '',
            ccEmails: ccs
          });
          if (s.ai_sensitivity_default) {
            setFormData(prev => ({ ...prev, aiSensitivity: parseInt(s.ai_sensitivity_default) }));
          }
        }
      }).catch(err => console.error(err));
    }
    if (activeSection === 'system' && formData.role === UserRole.ADMIN) {
      apiClient.get('/system/health-status').then(res => {
        if (res.data.success) setSystemHealth(res.data.data);
      }).catch(err => console.error(err));
    }
  }, [activeSection, formData.role]);

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/users');
      if (res.data.success) {
        setTeamUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem('skylens_audit_logs');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [newUserForm, setNewUserForm] = useState({ fullName: '', email: '', password: '', role: UserRole.FIELD_OPERATOR, title: '' });

  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSave = async () => {
    setSaveStatus(true);
    try {
      const promises: Promise<any>[] = [];

      // 1. Profile Update
      promises.push(apiClient.put('/auth/me', {
        fullName: formData.fullName,
        companyName: formData.companyName,
        title: formData.title,
        driveFolder: formData.driveFolder
      }));

      // 2. Admin System Settings
      if (formData.role === UserRole.ADMIN) {
        if (invoiceSettings.adminEmail) {
          promises.push(apiClient.post('/system/settings', { key: 'invoice_admin_email', value: invoiceSettings.adminEmail }));
        }
        promises.push(apiClient.post('/system/settings', { key: 'invoice_cc_emails', value: JSON.stringify(invoiceSettings.ccEmails.filter(e => e)) }));
        promises.push(apiClient.post('/system/settings', { key: 'ai_sensitivity_default', value: formData.aiSensitivity.toString() }));
      }

      const results = await Promise.all(promises);
      const profileResult = results[0];

      if (profileResult.data.success) {
        onUpdateUser(profileResult.data.data);
      }

      // Local check for AI sensitivity persistence for mission creator defaults
      localStorage.setItem(`skylens_ai_sensitivity_default`, formData.aiSensitivity.toString());

    } catch (err) {
      console.error('Failed to update settings', err);
      alert('One or more updates failed. Check logs.');
    }

    setTimeout(() => setSaveStatus(false), 2000);
  };

  const validateDrivePath = () => {
    setIsValidatingPath(true);
    setPathValid(null);
    setTimeout(() => { setIsValidatingPath(false); setPathValid(true); }, 1500);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setDiagResult({ status: null });
    const result = await testAIConnection();
    setDiagResult(result);
    setIsTesting(false);
  };

  const handleRoleChange = (newRole: UserRole) => {
    if (newRole === UserRole.ADMIN && currentUser.role !== UserRole.ADMIN) {
      setShowPasskeyField(true);
      setPasskeyInput('');
      setPasskeyError(false);
    } else {
      setFormData({ ...formData, role: newRole });
      setShowPasskeyField(false);
    }
  };

  const verifyAdminPasskey = () => {
    if (passkeyInput === ADMIN_PASSKEY) {
      setFormData({ ...formData, role: UserRole.ADMIN });
      setShowPasskeyField(false);
      setPasskeyError(false);
    } else {
      setPasskeyError(true);
    }
  };

  const handleDriveConnect = () => {
    googleAuthService.initiateGoogleAuth((updatedUser) => {
      onUpdateUser(updatedUser);
      setFormData(prev => ({
        ...prev,
        driveFolder: updatedUser.driveFolder || prev.driveFolder
      }));
    });
  };

  const disconnectDrive = async () => {
    if (confirm('Unlink Google Drive?')) {
      const updated = await googleAuthService.unlinkGoogleDrive();
      onUpdateUser(updated);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }

    if (passwordForm.new.length < 6) {
      setPasswordStatus({ type: 'error', message: 'Password must be at least 6 characters' });
      return;
    }

    setIsChangingPassword(true);
    setPasswordStatus({ type: null, message: '' });

    try {
      const response = await apiClient.put('/auth/password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.new
      });

      if (response.data.success) {
        setPasswordStatus({ type: 'success', message: 'Password updated successfully' });
        setPasswordForm({ current: '', new: '', confirm: '' });
      } else {
        setPasswordStatus({ type: 'error', message: response.data.message || 'Failed to update password' });
      }
    } catch (error: any) {
      setPasswordStatus({ type: 'error', message: error.response?.data?.message || 'An error occurred. Please try again.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) return { users: [], errors: [] };

    const users = [];
    const errors: string[] = [];

    // Skip header if it exists
    const startIndex = lines[0].toLowerCase().includes('fullname') || lines[0].toLowerCase().includes('email') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map(p => p.trim());

      if (parts.length < 3) {
        errors.push(`Line ${i + 1}: Not enough fields (need at least fullName, email, password)`);
        continue;
      }

      const [fullName, email, password, role, title] = parts;

      // Validate email
      if (!email || !email.includes('@')) {
        errors.push(`Line ${i + 1}: Invalid email format`);
        continue;
      }

      users.push({
        fullName: fullName || '',
        email,
        password,
        role: role || UserRole.FIELD_OPERATOR,
        title: title || '',
        lineNumber: i + 1,
        valid: fullName && email && password
      });
    }

    return { users, errors };
  };

  const handleBulkImportTextChange = (text: string) => {
    setBulkImportText(text);
    const { users, errors } = parseCSV(text);
    setBulkImportPreview(users);
    if (errors.length > 0) {
      console.warn('CSV parsing errors:', errors);
    }
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
      alert('No valid users to import. Please fix errors.');
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
          title: u.title
        }))
      });

      if (response.data.success) {
        const successCount = response.data.count || 0;
        const failedCount = validUsers.length - successCount;

        setBulkImportResults({
          success: successCount,
          failed: failedCount,
          errors: failedCount > 0 ? ['Some users may already exist or have invalid data'] : []
        });

        // Refresh user list
        fetchUsers();

        // Clear preview after successful import
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
    const template = 'fullName,email,password,role,title\nJohn Doe,john@example.com,password123,FIELD_OPERATOR,Drone Pilot\nJane Smith,jane@example.com,password456,ANALYST,Data Analyst';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">System Configuration</h2>
          <p className="text-slate-500 mt-1">Manage your identity, team access, and integrations.</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${saveStatus ? 'bg-green-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
        >
          {saveStatus ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saveStatus ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Nav */}
        <div className="w-64 space-y-1 shrink-0">
          {[
            { id: 'profile', label: 'My Profile', icon: User },
            { id: 'security', label: 'Security', icon: Lock },
            { id: 'integrations', label: 'Integrations', icon: Layers },
            { id: 'invoicing', label: 'Invoicing Setup', icon: Receipt, admin: true },
            { id: 'system', label: 'System Check', icon: Server, admin: true },
            { id: 'team', label: 'Team Members', icon: Users, admin: true }
          ].map(item => (
            (!item.admin || formData.role === UserRole.ADMIN) && (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeSection === item.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            )
          ))}

          <div className="pt-8 mt-8 border-t border-slate-100">
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-all">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 space-y-8">

          {activeSection === 'profile' && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-8">
              <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border border-slate-200">
                  {currentUser.googlePicture ? <img src={currentUser.googlePicture} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-slate-400" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{formData.fullName}</h3>
                  <p className="text-slate-500">{formData.email}</p>
                  <div className="mt-2 flex gap-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded uppercase tracking-wider">{formData.role}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Display Name</label>
                  <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Job Title</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Organization</label>
                  <div className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm">
                    <Building2 className="w-4 h-4" />
                    {formData.companyName}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Role Access</label>
                  <select
                    value={showPasskeyField ? UserRole.ADMIN : formData.role}
                    onChange={e => handleRoleChange(e.target.value as UserRole)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {showPasskeyField && (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 animate-in fade-in">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-500" /> Admin Authentication Required
                  </h4>
                  <div className="flex gap-4">
                    <input type="password" value={passkeyInput} onChange={e => setPasskeyInput(e.target.value)} placeholder="Enter Admin Passkey" className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm" />
                    <button onClick={verifyAdminPasskey} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">Verify</button>
                  </div>
                  {passkeyError && <p className="text-red-600 text-xs mt-2 font-medium">Invalid passkey. Access denied.</p>}
                </div>
              )}
            </div>
          )}

          {activeSection === 'integrations' && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-blue-600" /> Google Drive
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">Sync reports and assets directly to your enterprise workspace.</p>
                </div>
                {currentUser.driveLinked ? (
                  <button onClick={disconnectDrive} className="text-red-600 text-sm font-medium hover:underline">Unlink Account</button>
                ) : (
                  <button onClick={handleDriveConnect} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-500/20">Connect Drive</button>
                )}
              </div>

              {currentUser.driveLinked && (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-4 mb-6">
                    <img src={currentUser.googlePicture} className="w-12 h-12 rounded-full border border-slate-200" />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{currentUser.fullName}</p>
                      <p className="text-slate-500 text-xs">{currentUser.googleEmail}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold uppercase">
                      <CheckCircle className="w-3 h-3" /> Connected
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Target Directory</label>
                    <div className="flex gap-4">
                      <div className="relative flex-1">
                        <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={formData.driveFolder}
                          onChange={e => { setFormData({ ...formData, driveFolder: e.target.value }); setPathValid(null); }}
                          className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none transition-all ${pathValid === true ? 'border-green-500 ring-1 ring-green-500' : 'border-slate-200 focus:border-blue-500'}`}
                        />
                      </div>
                      <button
                        onClick={validateDrivePath}
                        disabled={isValidatingPath}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                      >
                        {isValidatingPath ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'security' && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-slate-400" /> Password & Security
                </h3>
                <p className="text-slate-500 text-sm mt-1">Manage your password and security settings.</p>
              </div>

              <div className="max-w-md space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.new}
                    onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                {passwordStatus.message && (
                  <div className={`p-3 rounded-lg text-sm font-medium ${passwordStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {passwordStatus.message}
                  </div>
                )}

                <button
                  onClick={handlePasswordChange}
                  disabled={isChangingPassword || !passwordForm.current || !passwordForm.new || !passwordForm.confirm}
                  className="w-full bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'system' && formData.role === UserRole.ADMIN && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-8">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-slate-400" /> Connection Diagnostics
                </h3>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">API Node</div>
                    <div className="font-mono text-lg font-bold text-slate-700">{systemHealth?.node || 'CONNECTING...'}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">AI Model</div>
                    <div className="font-mono text-lg font-bold text-slate-700">{systemHealth?.model || 'GEMINI-PRO'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Database</div>
                    <div className={`text-sm font-bold ${systemHealth?.database === 'CONNECTED' ? 'text-green-600' : 'text-amber-600'}`}>
                      {systemHealth?.database || 'CHECKING...'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Uptime</div>
                    <div className="text-sm font-bold text-slate-700">{systemHealth ? `${Math.floor(systemHealth.uptime / 3600)}h ${Math.floor((systemHealth.uptime % 3600) / 60)}m` : '--'}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Version</div>
                    <div className="text-sm font-bold text-slate-700">{systemHealth?.version || '1.2.0-AXIS'}</div>
                  </div>
                </div>

                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Test System Response
                </button>

                <div className="mt-8 pt-8 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> AI Detection Calibration
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                      <span>Standard Detection</span>
                      <span>{formData.aiSensitivity}% Precision</span>
                      <span>Maximum Depth</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={formData.aiSensitivity}
                      onChange={e => setFormData({ ...formData, aiSensitivity: parseInt(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <p className="text-xs text-slate-500">Higher sensitivity increases anomaly detection but may increase false positives in legacy systems.</p>
                  </div>
                </div>

                {diagResult.status && (
                  <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 text-sm font-medium ${diagResult.status === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {diagResult.status === 'ok' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    {diagResult.message}
                    {diagResult.latency && <span className="ml-auto font-mono opacity-75">{diagResult.latency}ms</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'invoicing' && formData.role === UserRole.ADMIN && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" /> Invoice Configuration
                </h3>
                <p className="text-slate-500 text-sm mt-1">Manage email recipients for automated invoice summaries.</p>
              </div>

              <div className="space-y-6 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Default Admin Email (To)</label>
                  <input
                    type="email"
                    placeholder="admin@coatzadroneusa.com"
                    value={invoiceSettings.adminEmail}
                    onChange={e => setInvoiceSettings({ ...invoiceSettings, adminEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">The primary recipient for all mission invoice summaries.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">CC Recipients</label>
                  <div className="space-y-2">
                    {invoiceSettings.ccEmails.map((email, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={e => {
                            const newCCs = [...invoiceSettings.ccEmails];
                            newCCs[idx] = e.target.value;
                            setInvoiceSettings({ ...invoiceSettings, ccEmails: newCCs });
                          }}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                        <button
                          onClick={() => {
                            const newCCs = invoiceSettings.ccEmails.filter((_, i) => i !== idx);
                            setInvoiceSettings({ ...invoiceSettings, ccEmails: newCCs });
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setInvoiceSettings({ ...invoiceSettings, ccEmails: [...invoiceSettings.ccEmails, ''] })}
                      className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add CC Recipient
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saveStatus}
                    className="px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    {saveStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saveStatus ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'team' && formData.role === UserRole.ADMIN && (
            <div className="bg-white border border-slate-200 rounded-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-400" /> Team Members
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">Manage user accounts and access permissions.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddUserModal(true)}
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

              <div className="space-y-3">
                {teamUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
                        {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-slate-500" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          {user.fullName}
                          {user.isDriveBlocked && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-wider font-bold">Drive Blocked</span>}
                        </p>
                        <p className="text-slate-500 text-xs">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{user.title || 'No Title'}</p>
                        <p className="text-xs text-slate-500">{user.role}</p>
                      </div>

                      {user.driveLinked && (
                        <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold">
                          <Cloud className="w-3 h-3" /> Linked
                        </div>
                      )}

                      <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                        <button
                          onClick={() => setResetPasswordValues({ userId: user.id, new: '' })}
                          className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-600"
                          title="Reset Password"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Are you sure you want to ${user.isDriveBlocked ? 'unblock' : 'block'} Drive access for ${user.fullName}?`)) return;
                            try {
                              await apiClient.put(`/users/${user.id}`, { isDriveBlocked: !user.isDriveBlocked });
                              fetchUsers();
                            } catch (e) { alert('Failed to update status'); }
                          }}
                          className={`p-1.5 hover:bg-slate-200 rounded transition-colors ${user.isDriveBlocked ? 'text-red-600 hover:text-red-700' : 'text-slate-400 hover:text-red-600'}`}
                          title={user.isDriveBlocked ? "Unblock Drive Access" : "Block Drive Access"}
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Admin Password Reset Modal */}
              {resetPasswordValues.userId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
                  <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Reset User Password</h3>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm mb-4"
                      value={resetPasswordValues.new}
                      onChange={e => setResetPasswordValues(prev => ({ ...prev, new: e.target.value }))}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setResetPasswordValues({ userId: null, new: '' })} className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                      <button
                        onClick={async () => {
                          if (resetPasswordValues.new.length < 6) return alert('Password too short');
                          try {
                            const res = await apiClient.post(`/users/${resetPasswordValues.userId}/reset-password`, {
                              newPassword: resetPasswordValues.new
                            });
                            if (res.data.success) {
                              alert('Password reset successfully');
                              setResetPasswordValues({ userId: null, new: '' });
                            } else {
                              alert(res.data.message);
                            }
                          } catch (e: any) { alert(e.response?.data?.message || 'Error resetting password'); }
                        }}
                        className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showAddUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
                  <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Add Team Member</h3>
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
                        <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                        <input
                          type="password"
                          value={newUserForm.password}
                          onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">User will use this password to log in</p>
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
                        onClick={() => setShowAddUserModal(false)}
                        className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!newUserForm.fullName || !newUserForm.email || !newUserForm.password) {
                            alert('Please fill in all required fields (Name, Email, Password)');
                            return;
                          }

                          try {
                            const res = await apiClient.post('/users', newUserForm);

                            if (res.data.success) {
                              fetchUsers();
                              setShowAddUserModal(false);
                              setNewUserForm({ fullName: '', email: '', password: '', role: UserRole.FIELD_OPERATOR, title: '' });
                            } else {
                              alert(res.data.message || 'Failed to create user');
                            }
                          } catch (error: any) {
                            console.error(error);
                            alert(error.response?.data?.message || 'An error occurred');
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        Add User
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Import Modal */}
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
                            <strong>CSV Format:</strong> fullName, email, password, role, title
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
                            placeholder="fullName,email,password,role,title&#10;John Doe,john@example.com,password123,FIELD_OPERATOR,Drone Pilot&#10;Jane Smith,jane@example.com,password456,ANALYST,Data Analyst"
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            rows={8}
                          />
                          <p className="text-xs text-slate-500 mt-2">
                            Format: fullName, email, password, role (optional), title (optional)
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
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
