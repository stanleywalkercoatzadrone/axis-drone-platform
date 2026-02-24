import React, { useState } from 'react';
import apiClient from '../src/services/apiClient';
import { useIndustry } from '../src/context/IndustryContext';
import { X, Save, User, Mail, Lock } from 'lucide-react';
import { Input } from '../src/stitch/components/Input';

interface StakeholderFormProps {
    clientId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const StakeholderForm: React.FC<StakeholderFormProps> = ({ clientId, onClose, onSuccess }) => {
    const { tLabel } = useIndustry();

    // Form State
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [title, setTitle] = useState('');
    const [phone, setPhone] = useState('');
    const [type, setType] = useState('client'); // client, vendor, internal
    const [createUser, setCreateUser] = useState(true);
    const [sendInvite, setSendInvite] = useState(true);
    const [password, setPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (createUser && !sendInvite && (!email || !password)) {
            setError('Email and Password are required to create a user account.');
            setIsLoading(false);
            return;
        }

        try {
            await apiClient.post(`/clients/${clientId}/stakeholders`, {
                full_name: fullName,
                email,
                title,
                phone,
                type,
                createUser,
                sendInvite,
                password
            });
            onSuccess();
        } catch (err: any) {
            console.error('Error adding stakeholder:', err);
            setError(err.response?.data?.message || `Failed to add ${tLabel('stakeholder')}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                                <User className="w-5 h-5 text-white" />
                            </div>
                            Add {tLabel('stakeholder')}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 ml-11">Corporate Identity Provisioning</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="p-4 text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-in shake duration-300">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <Input
                            label="Full Legal Name"
                            placeholder="e.g. Alexander Pierce"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="rounded-2xl border-slate-200 focus:ring-blue-500/10"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Professional Title"
                                placeholder="Audit Lead"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="rounded-2xl border-slate-200 focus:ring-blue-500/10"
                            />
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none text-slate-400">Relationship Type</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="flex h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                                >
                                    <option value="client">Client Representative</option>
                                    <option value="vendor">Vendor / Contractor</option>
                                    <option value="internal">Internal Contact</option>
                                </select>
                            </div>
                        </div>

                        <Input
                            label="Communication Email"
                            type="email"
                            placeholder="ops@client.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="rounded-2xl border-slate-200 focus:ring-blue-500/10"
                        />

                        <Input
                            label="Contact Phone"
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="rounded-2xl border-slate-200 focus:ring-blue-500/10"
                        />
                    </div>

                    {email && (
                        <div className="pt-6 border-t border-slate-100">
                            <div className="bg-slate-50/50 p-6 rounded-[1.5rem] border border-slate-100 space-y-4">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="createUser"
                                        checked={createUser}
                                        onChange={(e) => setCreateUser(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 border-slate-300 rounded-lg focus:ring-blue-500 transition-all cursor-pointer"
                                    />
                                    <label htmlFor="createUser" className="text-[11px] font-black text-slate-900 uppercase tracking-widest cursor-pointer">
                                        Provision Access Portal
                                    </label>
                                </div>

                                {createUser && (
                                    <div className="space-y-4 animate-in slide-in-from-top-4 duration-300 ml-8">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="sendInvite"
                                                checked={sendInvite}
                                                onChange={(e) => setSendInvite(e.target.checked)}
                                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 transition-all cursor-pointer"
                                            />
                                            <label htmlFor="sendInvite" className="text-[10px] font-bold text-slate-600 uppercase tracking-wider cursor-pointer">
                                                Send encrypted email invitation
                                            </label>
                                        </div>

                                        {!sendInvite && (
                                            <div className="animate-in fade-in slide-in-from-top-2">
                                                <Input
                                                    label="Initial Access Passphrase"
                                                    type="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="Minimum 8 characters"
                                                    required={!sendInvite}
                                                    className="rounded-2xl border-slate-200 focus:ring-blue-500/10"
                                                />
                                            </div>
                                        )}

                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest italic flex items-center gap-2">
                                            <Lock className="w-3 h-3" /> Default Permission Tier: Client Operator
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-8 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50 flex items-center gap-3 active:scale-95"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Confirm Profile
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StakeholderForm;
