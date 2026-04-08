import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import apiClient from '../src/services/apiClient';
import { useAuth } from '../src/context/AuthContext';

const ForcePasswordReset: React.FC = () => {
    const { logout, syncProfile } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        setError(null);
        setSubmitting(true);

        try {
            await apiClient.put('/auth/password', {
                currentPassword,
                newPassword
            });
            // Update the user from backend so forcePasswordReset is cleared
            await syncProfile();
        } catch (err: any) {
            console.error('Failed to update password:', err);
            setError(err.response?.data?.message || 'Failed to update password. Please check your current password.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 py-12">
            <div className="max-w-md w-full">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500 mb-4 shadow-lg shadow-orange-500/20">
                        <Lock className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Action Required</h1>
                    <p className="text-slate-500 mt-2">You must update your temporary password to continue.</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-500 delay-100">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-600">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current Temporary Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Min. 8 characters"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="Re-enter password"
                                required
                            />
                        </div>

                        <div className="pt-2 flex flex-col gap-3">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password & Continue'}
                            </button>

                            <button
                                type="button"
                                onClick={logout}
                                className="w-full bg-slate-50 text-slate-600 font-semibold py-3.5 rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
                            >
                                Return to Login
                            </button>
                        </div>
                    </form>
                </div>

                <div className="text-center mt-8 text-sm text-slate-400">
                    &copy; {new Date().getFullYear()} Axis Drone Platform
                </div>
            </div>
        </div>
    );
};

export default ForcePasswordReset;
