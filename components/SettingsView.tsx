
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
  CheckCircle
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

  const [formData, setFormData] = useState({
    fullName: currentUser.fullName,
    email: currentUser.email,
    companyName: currentUser.companyName,
    title: currentUser.title || '',
    role: currentUser.role,
    driveFolder: currentUser.driveFolder || 'Axis_Enterprise_Vault',
    aiSensitivity: 50
  });

  const [teamUsers, setTeamUsers] = useState<UserAccount[]>([]);
  const [resetPasswordValues, setResetPasswordValues] = useState<{ userId: string | null, new: string }>({ userId: null, new: '' });

  useEffect(() => {
    if (activeSection === 'team' && formData.role === UserRole.ADMIN) {
      fetchUsers();
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
      // Fallback for UI demonstration if DB is down
      setTeamUsers([
        { id: '1', fullName: 'Marcus Wright', email: 'm.wright@skylens.ai', title: 'Field Lead', role: UserRole.FIELD_OPERATOR, createdAt: new Date().toISOString(), companyName: currentUser.companyName, driveLinked: false, isDriveBlocked: false },
        { id: '2', fullName: 'Sarah Chen', email: 's.chen@skylens.ai', title: 'Safety Auditor', role: UserRole.ADMIN, createdAt: new Date().toISOString(), companyName: currentUser.companyName, driveLinked: true, isDriveBlocked: true }
      ]);
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

  const handleSave = () => {
    setSaveStatus(true);
    const updatedUser: UserAccount = {
      ...currentUser,
      fullName: formData.fullName,
      email: formData.email,
      companyName: formData.companyName,
      title: formData.title,
      role: formData.role,
      driveFolder: formData.driveFolder
    };
    onUpdateUser(updatedUser);
    localStorage.setItem(`skylens_settings_${currentUser.id}`, JSON.stringify({ aiSensitivity: formData.aiSensitivity }));
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
                    <div className="font-mono text-lg font-bold text-slate-700">US-EAST-1</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">AI Model</div>
                    <div className="font-mono text-lg font-bold text-slate-700">GEMINI-PRO</div>
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

          {activeSection === 'team' && formData.role === UserRole.ADMIN && (
            <div className="bg-white border border-slate-200 rounded-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-400" /> Team Members
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">Manage user accounts and access permissions.</p>
                </div>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" /> Add User
                </button>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
