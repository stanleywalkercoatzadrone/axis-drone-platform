/**
 * Enterprise AI Insurance Report Generator
 * Module: /modules/ai-reporting
 * 
 * Additive only — does not modify any existing components.
 */

import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../src/services/apiClient';
import { useAuth } from '../../src/context/AuthContext';
import ClaimsReportList from './components/ClaimsReportList';
import ClaimsReportWizard from './components/ClaimsReportWizard';
import ClaimsPortfolioDashboard from './components/ClaimsPortfolioDashboard';
import {
    FileText, Plus, BarChart3, ArrowLeft, RefreshCw,
    Shield, Zap, AlertTriangle
} from 'lucide-react';

type View = 'dashboard' | 'list' | 'wizard' | 'report';

export interface ClaimsReport {
    id: string;
    title: string;
    claimNumber?: string;
    policyNumber?: string;
    propertyAddress?: string;
    propertyType?: string;
    inspectionType?: string;
    industry?: string;
    carrier?: string;
    adjusterName?: string;
    adjusterEmail?: string;
    status: string;
    approvalStatus: string;
    riskScore: number;
    totalDamageEstimate: number;
    executiveSummary?: string;
    recommendations?: string[];
    weatherData?: any;
    images?: ClaimsImage[];
    comments?: any[];
    history?: any[];
    authorName?: string;
    imageCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface ClaimsImage {
    id: string;
    url: string;
    originalName?: string;
    imageType?: string;
    annotations?: ClaimsAnnotation[];
    aiSummary?: string;
    damageScore?: number;
    uploadedAt?: string;
}

export interface ClaimsAnnotation {
    id: string;
    label: string;
    description?: string;
    location?: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    confidence: number;
    isStormRelated?: string;
    estimatedCostMin?: number;
    estimatedCostMax?: number;
    xactimateCode?: string;
    recommendedAction?: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

const EnterpriseAIReporting: React.FC = () => {
    const { user } = useAuth();
    const [view, setView] = useState<View>('dashboard');
    const [reports, setReports] = useState<ClaimsReport[]>([]);
    const [selectedReport, setSelectedReport] = useState<ClaimsReport | null>(null);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await apiClient.get('/claims-reports/dashboard');
            setDashboardData(res.data.data);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadReports = useCallback(async () => {
        try {
            const res = await apiClient.get('/claims-reports');
            setReports(res.data.data || []);
        } catch (err: any) {
            console.error('Failed to load reports:', err);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
        loadReports();
    }, [loadDashboard, loadReports]);

    const handleReportCreated = (report: ClaimsReport) => {
        setSelectedReport(report);
        setView('wizard');
        loadReports();
    };

    const handleReportSelect = async (report: ClaimsReport) => {
        try {
            const res = await apiClient.get(`/claims-reports/${report.id}`);
            setSelectedReport(res.data.data);
            setView('wizard');
        } catch {
            setSelectedReport(report);
            setView('wizard');
        }
    };

    const handleBack = () => {
        setSelectedReport(null);
        setView('dashboard');
        loadDashboard();
        loadReports();
    };

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Module Header */}
            <div className="border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {view !== 'dashboard' && (
                            <button
                                onClick={handleBack}
                                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-base font-black text-white tracking-tight">
                                    AI Claims Intelligence
                                </h1>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                    Prism Axis Claims Solutions
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {view === 'dashboard' && (
                            <>
                                <button
                                    onClick={() => { loadDashboard(); loadReports(); }}
                                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setView('list')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    All Reports
                                </button>
                                <button
                                    onClick={() => setView('wizard')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-orange-500/25"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    New Claim Report
                                </button>
                            </>
                        )}
                        {view === 'list' && (
                            <button
                                onClick={() => setView('wizard')}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-orange-500/25"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                New Claim Report
                            </button>
                        )}
                    </div>
                </div>

                {/* Sub-nav */}
                {view === 'dashboard' && (
                    <div className="max-w-[1600px] mx-auto px-8 pb-0 flex gap-1">
                        {[
                            { id: 'dashboard', label: 'Portfolio Overview', icon: BarChart3 },
                            { id: 'list', label: 'All Reports', icon: FileText },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setView(tab.id as View)}
                                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${view === tab.id
                                    ? 'border-orange-500 text-orange-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="max-w-[1600px] mx-auto px-8 py-8">
                {error && (
                    <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {view === 'dashboard' && (
                    <ClaimsPortfolioDashboard
                        data={dashboardData}
                        loading={loading}
                        reports={reports}
                        onNewReport={() => setView('wizard')}
                        onSelectReport={handleReportSelect}
                    />
                )}

                {view === 'list' && (
                    <ClaimsReportList
                        reports={reports}
                        loading={loading}
                        onSelect={handleReportSelect}
                        onNew={() => setView('wizard')}
                        onRefresh={loadReports}
                    />
                )}

                {view === 'wizard' && (
                    <ClaimsReportWizard
                        initialReport={selectedReport}
                        onBack={handleBack}
                        onSaved={(report) => {
                            setSelectedReport(report);
                            loadReports();
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default EnterpriseAIReporting;
