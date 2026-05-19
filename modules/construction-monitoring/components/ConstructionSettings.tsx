import React, { useState } from 'react';
import { Settings, Bell, Shield, Database, Trash2, Save, Users, Zap } from 'lucide-react';
import apiClient from '../../../src/services/apiClient';

export default function ConstructionSettings({ project, initialSettings, onSettingsSaved }) {
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        dailyDigestEnabled: initialSettings?.daily_digest_enabled ?? true,
        criticalRiskAlertsEnabled: initialSettings?.critical_risk_alerts_enabled ?? true,
        aiVerbosity: initialSettings?.ai_verbosity || 'Concise (Executive Level)',
        autoPublishThreshold: initialSettings?.auto_publish_threshold || 'Require Manual Approval (Draft Only)'
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiClient.put(`/construction/projects/${project.id}/settings`, settings);
            setSaved(true);
            if (onSettingsSaved) onSettingsSaved();
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Failed to save settings', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 animate-fade-in text-slate-200 max-w-4xl">
            <h2 className="text-2xl font-black text-white tracking-tight mb-8 flex items-center gap-3">
                <Settings className="w-6 h-6 text-slate-400" />
                Construction Settings
            </h2>

            <div className="space-y-8">
                {/* Notification Preferences */}
                <section className="bg-slate-900/60 border border-slate-800/60 rounded-3xl p-8 shadow-xl">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-400" /> Notification Preferences
                    </h3>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                            <div>
                                <div className="text-sm font-bold text-slate-200">Daily Digest Report</div>
                                <div className="text-xs text-slate-500 mt-1">Receive a summary of all construction progress at 5:00 PM local time.</div>
                            </div>
                            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                <input type="checkbox" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-slate-800 appearance-none cursor-pointer transition-transform duration-200 ease-in-out" checked={settings.dailyDigestEnabled} onChange={e => setSettings({...settings, dailyDigestEnabled: e.target.checked})} />
                                <label className="toggle-label block overflow-hidden h-6 rounded-full bg-blue-500 cursor-pointer"></label>
                            </div>
                        </label>

                        <label className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                            <div>
                                <div className="text-sm font-bold text-slate-200">Critical Risk Alerts</div>
                                <div className="text-xs text-slate-500 mt-1">Instant notification when a High or Critical risk is logged.</div>
                            </div>
                            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                <input type="checkbox" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-slate-800 appearance-none cursor-pointer transition-transform duration-200 ease-in-out" checked={settings.criticalRiskAlertsEnabled} onChange={e => setSettings({...settings, criticalRiskAlertsEnabled: e.target.checked})} />
                                <label className="toggle-label block overflow-hidden h-6 rounded-full bg-blue-500 cursor-pointer"></label>
                            </div>
                        </label>
                    </div>
                </section>

                {/* AI Configuration */}
                <section className="bg-slate-900/60 border border-slate-800/60 rounded-3xl p-8 shadow-xl">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-400" /> AI Report Generation
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Summary Verbosity</label>
                            <select className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none" value={settings.aiVerbosity} onChange={e => setSettings({...settings, aiVerbosity: e.target.value})}>
                                <option>Concise (Executive Level)</option>
                                <option>Standard</option>
                                <option>Detailed (Engineering Level)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Auto-Publish Threshold</label>
                            <select className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500 outline-none" value={settings.autoPublishThreshold} onChange={e => setSettings({...settings, autoPublishThreshold: e.target.value})}>
                                <option>Require Manual Approval (Draft Only)</option>
                                <option>Auto-Publish if Confidence &gt; 95%</option>
                            </select>
                        </div>
                    </div>
                </section>

                <div className="flex justify-end gap-4 mt-8">
                    <button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex items-center gap-2">
                        {saved ? <CheckSquare className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : saved ? 'Settings Saved' : 'Save Configuration'}
                    </button>
                </div>

                {/* Danger Zone */}
                <section className="mt-16 pt-8 border-t border-red-500/20">
                    <h3 className="text-sm font-black text-red-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Danger Zone
                    </h3>
                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-red-200">Archive Project Data</div>
                            <div className="text-xs text-red-200/60 mt-1 max-w-lg">This will archive all construction observations, issues, and reports. They will no longer be visible in the active dashboard.</div>
                        </div>
                        <button className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2">
                            <Trash2 className="w-4 h-4" /> Archive Data
                        </button>
                    </div>
                </section>
            </div>
            
            {/* Custom Toggle Styles */}
            <style dangerouslySetInnerHTML={{__html: `
                .toggle-checkbox:checked {
                    right: 0;
                    border-color: #3b82f6;
                }
                .toggle-checkbox:checked + .toggle-label {
                    background-color: #3b82f6;
                }
                .toggle-checkbox {
                    right: 24px;
                    z-index: 1;
                    border-color: #1e293b;
                }
                .toggle-label {
                    width: 48px;
                    background-color: #1e293b;
                }
            `}} />
        </div>
    );
}
