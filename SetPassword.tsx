import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import apiClient from '../src/services/apiClient';

const SetPassword: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [userData, setUserData] = useState<{ email: string; fullName: string; role: string } | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const verifyToken = async () => {
            try {
                const response = await apiClient.get(`/auth/invitation/${token}`);
                setUserData(response.data.data);
            } catch (err: any) {
                console.error('Token verification failed:', err);
                setError(err.response?.data?.message || 'The invitation link is invalid or has expired.');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            verifyToken();
        } else {
            setError('Missing invitation token.');
            setLoading(false);
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setError(null);
        setSubmitting(true);

        try {
            await apiClient.post('/auth/set-password-with-token', {
                token,
                password
            });
            setSuccess(true);
        } catch (err: any) {
            console.error('Failed to set password:', err);
            setError(err.response?.data?.message || 'Failed to set password. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-200 text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Ready!</h2>
                    <p className="text-slate-600 mb-8">Your password has been successfully set. You can now access your dashboard.</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group"
                    >
                        Continue to Login
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 py-12">
            <div className="max-w-md w-full">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4 shadow-lg shadow-blue-500/20">
                        <Lock className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Create Password</h1>
                    <p className="text-slate-500 mt-2">Set up your secure credentials for Axis Platform</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-600 animate-in slide-in-from-top-2 duration-200">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {userData && (
                        <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Account Details</h3>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-900">{userData.fullName}</p>
                                <p className="text-sm text-slate-500">{userData.email}</p>
                                <p className="text-xs font-medium text-blue-600 mt-1 uppercase tracking-tight">{userData.role.replace(/_/g, ' ')}</p>
                            </div>
                        </div>
                    )}

                    {!userData && error ? (
                        <button
                            onClick={() => window.location.href = '/'}
                            className="w-full bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-black transition-all"
                        >
                            Return Home
                        </button>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
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
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Re-enter password"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Setting Password...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </form>
                    )}
                </div>

                <div className="text-center mt-8 text-sm text-slate-500">
                    &copy; {new Date().getFullYear()} Axis Drone Platform. All rights reserved.
                </div>
            </div>
        </div>
    );
};

export default SetPassword;
