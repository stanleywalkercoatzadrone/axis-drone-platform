import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Building2, Upload, Brain, FileText, CheckCircle2,
    ChevronRight, ChevronLeft, Loader2, AlertTriangle,
    X, ZoomIn, MessageSquare, Send, ThumbsUp, ThumbsDown,
    Sparkles, Download, Shield, DollarSign, BarChart3,
    Camera, MapPin, User, Phone, Mail, Hash, Zap,
    RefreshCw, Eye, Edit3, Save, Check, Clock, Info,
    FolderUp
} from 'lucide-react';
import { exportReportPDF } from './exportReportPDF';
import apiClient from '../../../src/services/apiClient';
import { ClaimsReport, ClaimsImage, ClaimsAnnotation } from '../EnterpriseAIReporting';
import { useAuth } from '../../../src/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../../src/stitch/components/Card';
import { saveReport, ReportMeta, downloadReport, saveReportToMission } from '../utils/reportStorage';
import { PDFViewer } from './AIReportArchive';
import { Button } from '../../../src/stitch/components/Button';
import { Input } from '../../../src/stitch/components/Input';
import { Badge } from '../../../src/stitch/components/Badge';
import { Heading, Text } from '../../../src/stitch/components/Typography';

const inputCls = "w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-slate-600";
const inputStyle = { backdropFilter: 'blur(12px)' };

interface Props {
    initialReport: ClaimsReport | null;
    onBack: () => void;
    onSaved: (report: ClaimsReport) => void;
}

type WizardStep = 'intake' | 'upload' | 'analysis' | 'pricing' | 'narrative' | 'review';

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
    { id: 'intake', label: 'Claim Intake', icon: <Building2 className="w-4 h-4" /> },
    { id: 'upload', label: 'Evidence Upload', icon: <Upload className="w-4 h-4" /> },
    { id: 'analysis', label: 'AI Analysis', icon: <Brain className="w-4 h-4" /> },
    { id: 'pricing', label: 'Pricing Estimate', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'narrative', label: 'Report Build', icon: <FileText className="w-4 h-4" /> },
    { id: 'review', label: 'Review & Submit', icon: <CheckCircle2 className="w-4 h-4" /> },
];

const SEVERITY_COLORS: Record<string, string> = {
    Critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    High: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    Medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    Low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const ClaimsReportWizard: React.FC<Props> = ({ initialReport, onBack, onSaved }) => {
    const { user } = useAuth();
    const [step, setStep] = useState<WizardStep>(initialReport ? 'upload' : 'intake');
    const [report, setReport] = useState<ClaimsReport | null>(initialReport);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Intake form state
    const [form, setForm] = useState({
        title: initialReport?.title || '',
        claimNumber: initialReport?.claimNumber || '',
        policyNumber: initialReport?.policyNumber || '',
        propertyAddress: initialReport?.propertyAddress || '',
        propertyType: initialReport?.propertyType || 'Residential',
        inspectionType: initialReport?.inspectionType || 'Post-Loss',
        carrier: initialReport?.carrier || '',
        adjusterName: initialReport?.adjusterName || '',
        adjusterEmail: initialReport?.adjusterEmail || '',
        pilotName: initialReport?.pilotName || '',
    });

    const [missions, setMissions] = useState<any[]>([]);
    const [selectedMissionId, setSelectedMissionId] = useState('');
    const [pilots, setPilots] = useState<string[]>([]);
    const [allPilots, setAllPilots] = useState<string[]>([]);

    // Images state
    const [images, setImages] = useState<ClaimsImage[]>(initialReport?.images || []);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Analysis state
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, currentName: '' });
    const [lightboxImage, setLightboxImage] = useState<ClaimsImage | null>(null);

    // Pricing state
    const [pricingCategories, setPricingCategories] = useState<any[]>([]);
    const [pricingItems, setPricingItems] = useState<any[]>([]);
    const [reportLineItems, setReportLineItems] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [pricingSearch, setPricingSearch] = useState('');
    const [loadingPricing, setLoadingPricing] = useState(false);

    // Narrative state
    const [narrative, setNarrative] = useState({
        executiveSummary: initialReport?.executiveSummary || '',
        recommendations: initialReport?.recommendations || [],
        riskScore: initialReport?.riskScore || 0,
    });
    const [generatingNarrative, setGeneratingNarrative] = useState(false);
    const [newRec, setNewRec] = useState('');

    // Comments
    const [comments, setComments] = useState<any[]>(initialReport?.comments || []);
    const [newComment, setNewComment] = useState('');
    const [addingComment, setAddingComment] = useState(false);
    const [exportingPDF, setExportingPDF] = useState(false);
    const [generatedReport, setGeneratedReport] = useState<ReportMeta | null>(null);
    const [isViewingFull, setIsViewingFull] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [savingToMission, setSavingToMission] = useState(false);
    const [savedToMissionId, setSavedToMissionId] = useState<string | null>(null);

    // Sync images from report
    useEffect(() => {
        if (initialReport?.images) setImages(initialReport.images);
        if (initialReport?.executiveSummary) setNarrative(n => ({ ...n, executiveSummary: initialReport.executiveSummary || '' }));
        if (initialReport?.recommendations) setNarrative(n => ({ ...n, recommendations: initialReport.recommendations || [] }));
        if (initialReport?.riskScore) setNarrative(n => ({ ...n, riskScore: initialReport.riskScore }));
        if (initialReport?.comments) setComments(initialReport.comments);

        if (initialReport?.id) {
            loadPricingData(initialReport.id);
        }

        // Load standardized missions and pilots
        apiClient.get('/deployments')
            .then(res => setMissions(res.data?.data || res.data?.missions || []))
            .catch(() => {});
        
        apiClient.get('/personnel?role=pilot_technician')
            .then(res => {
                const list = res.data?.data || [];
                const names = list.map((p: any) => p.fullName || p.full_name || p.name || p.email).filter(Boolean);
                if (names.length > 0) {
                    setAllPilots(names);
                }
            })
            .catch(() => {});
    }, [initialReport]);

    const handleMissionSelect = async (missionId: string) => {
        if (!missionId) {
            setSelectedMissionId('');
            setPilots([]);
            return;
        }
        setSelectedMissionId(missionId);
        try {
            const res = await apiClient.get(`/v1/missions/${missionId}/intelligence`);
            const intel = res.data?.data;
            if (!intel) return;

            setForm(prev => ({
                ...prev,
                title: intel.title || intel.siteName || prev.title,
                propertyAddress: intel.location || prev.propertyAddress,
                carrier: intel.clientName || prev.carrier
            }));

            const personnel: any[] = intel.assignedPersonnel || [];
            const names = personnel
                .map((p: any) => p.fullName || p.name || p.email)
                .filter((n: string) => n && n.trim().length > 0);
            
            // Strictly show only assigned personnel for the selected mission
            setPilots(names);
            
            if (names.length === 1) setForm(prev => ({ ...prev, pilotName: names[0] }));
            else if (names.length === 0) setForm(prev => ({ ...prev, pilotName: '' }));
        } catch (err) {
            console.error('handleMissionSelect failed', err);
        }
    };

    const loadPricingData = async (reportId: string, search?: string, categoryCode?: string) => {
        setLoadingPricing(true);
        try {
            const [categoriesRes, itemsRes, lineItemsRes] = await Promise.all([
                apiClient.get('/claims-pricing/categories'),
                apiClient.get('/claims-pricing/items', { params: { search, categoryCode } }),
                apiClient.get(`/claims-pricing/reports/${reportId}/items`)
            ]);
            setPricingCategories(categoriesRes.data.data);
            setPricingItems(itemsRes.data.data);
            setReportLineItems(lineItemsRes.data.data);
        } catch (err) {
            console.error('Failed to load pricing data:', err);
        } finally {
            setLoadingPricing(false);
        }
    };

    const handleAddLineItem = async (itemId: string) => {
        if (!report?.id) return;
        setSaving(true);
        try {
            await apiClient.post(`/claims-pricing/reports/${report.id}/items`, {
                pricingItemId: itemId,
                quantity: 1
            });
            await loadPricingData(report.id, pricingSearch, selectedCategory);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to add line item');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateQuantity = async (reportItemId: string, quantity: number) => {
        setSaving(true);
        try {
            await apiClient.put(`/claims-pricing/reports/items/${reportItemId}`, { quantity });
            // Optimistic update
            setReportLineItems(prev => prev.map(item =>
                item.id === reportItemId
                    ? { ...item, quantity, totalCost: 1 * quantity * item.unitCost } // Approximation
                    : item
            ));
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to update quantity');
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveLineItem = async (reportItemId: string) => {
        setSaving(true);
        try {
            await apiClient.delete(`/claims-pricing/reports/items/${reportItemId}`);
            setReportLineItems(prev => prev.filter(item => item.id !== reportItemId));
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to remove line item');
        } finally {
            setSaving(false);
        }
    };

    // ─── INTAKE ──────────────────────────────────────────────────────────────

    const handleCreateReport = async () => {
        if (!form.title.trim()) { setError('Report title is required'); return; }
        setSaving(true); setError(null);
        try {
            const res = await apiClient.post('/claims-reports', form);
            const created = res.data.data;
            setReport(created);
            onSaved(created);
            setStep('upload');
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to create report');
        } finally { setSaving(false); }
    };

    const handleSaveIntake = async () => {
        if (!report) { await handleCreateReport(); return; }
        setSaving(true); setError(null);
        try {
            const res = await apiClient.put(`/claims-reports/${report.id}`, form);
            setReport(res.data.data);
            onSaved(res.data.data);
            setStep('upload');
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to save');
        } finally { setSaving(false); }
    };

    // ─── UPLOAD ───────────────────────────────────────────────────────────────

    const handleFileUpload = useCallback(async (files: File[]) => {
        if (!report?.id) { setError('Save claim details first'); return; }
        setUploading(true);
        const formData = new FormData();
        files.forEach(f => formData.append('images', f));
        formData.append('reportId', report.id);
        formData.append('imageType', 'drone');

        try {
            const res = await apiClient.post(`/claims-reports/${report.id}/images`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (e) => {
                    const pct = Math.round((e.loaded / (e.total || 1)) * 100);
                    files.forEach(f => setUploadProgress(p => ({ ...p, [f.name]: pct })));
                }
            });

            const newImgs: ClaimsImage[] = (res.data.data || []).map((img: any) => ({
                id: img.id,
                url: img.storage_url,
                originalName: img.original_name,
                imageType: img.image_type,
                annotations: [],
                damageScore: 0,
                uploadedAt: img.uploaded_at
            }));

            setImages(prev => [...prev, ...newImgs]);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            setUploadProgress({});
        }
    }, [report]);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length) await handleFileUpload(files);
    };

    // ─── ANALYSIS ────────────────────────────────────────────────────────────

    const handleAnalyzeAll = async () => {
        if (!images.length) return;
        setAnalyzing(true);
        setAnalysisProgress({ current: 0, total: images.length, currentName: '' });

        const updatedImages = [...images];
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            setAnalysisProgress({ current: i + 1, total: images.length, currentName: img.originalName || `Image ${i + 1}` });
            try {
                const res = await apiClient.post(`/claims-reports/images/${img.id}/analyze`, {
                    inspectionType: form.inspectionType,
                    sensitivity: 65
                });
                updatedImages[i] = {
                    ...img,
                    annotations: res.data.data.annotations,
                    aiSummary: res.data.data.summary,
                    damageScore: res.data.data.damageScore
                };
                setImages([...updatedImages]);
            } catch (err) {
                console.error(`Analysis failed for image ${img.id}:`, err);
            }
        }

        setAnalyzing(false);
    };

    // ─── NARRATIVE ────────────────────────────────────────────────────────────

    const handleGenerateNarrative = async () => {
        if (!report?.id) return;
        setGeneratingNarrative(true); setError(null);
        try {
            const res = await apiClient.post(`/claims-reports/${report.id}/generate-narrative`);
            const data = res.data.data;
            setNarrative({
                executiveSummary: data.executiveSummary || '',
                recommendations: data.recommendations || [],
                riskScore: data.riskScore || 0,
            });
        } catch (err: any) {
            setError(err?.response?.data?.message || 'AI generation failed');
        } finally { setGeneratingNarrative(false); }
    };

    const handleSaveNarrative = async () => {
        if (!report?.id) return;
        setSaving(true);
        try {
            const res = await apiClient.put(`/claims-reports/${report.id}`, {
                executiveSummary: narrative.executiveSummary,
                recommendations: narrative.recommendations,
            });
            setReport(res.data.data);
            onSaved(res.data.data);
            setStep('review');
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    // ─── FINALIZE ─────────────────────────────────────────────────────────────

    const handleFinalize = async () => {
        if (!report?.id) return;
        setSaving(true);
        try {
            const res = await apiClient.post(`/claims-reports/${report.id}/finalize`);
            setReport(res.data.data);
            onSaved(res.data.data);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Finalization failed');
        } finally { setSaving(false); }
    };

    const handleExportPDF = async () => {
        if (!report) return;
        setExportingPDF(true);
        try {
            // Merge current form state into report for export
            const exportData = {
                ...report,
                title: form.title,
                claimNumber: form.claimNumber,
                policyNumber: form.policyNumber,
                propertyAddress: form.propertyAddress,
                propertyType: form.propertyType,
                inspectionType: form.inspectionType,
                carrier: form.carrier,
                adjusterName: form.adjusterName,
                adjusterEmail: form.adjusterEmail,
                executiveSummary: narrative.executiveSummary,
                recommendations: narrative.recommendations,
                riskScore: narrative.riskScore,
                images,
            };
            const id = await exportReportPDF(exportData);
            if (id) {
                const slug = (report.claimNumber || report.id || 'report')
                    .replace(/[^a-z0-9]/gi, '-').toLowerCase();
                setGeneratedReport({
                    id: id as string,
                    industry: 'insurance',
                    title: form.title || `Claim ${id}`,
                    filename: `claims-report-${slug}.pdf`,
                    sizeBytes: 0,
                    createdAt: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error('PDF export failed:', err);
            setError('PDF export failed. Please try again.');
        } finally { setExportingPDF(false); }
    };

    const handleSaveToMission = async () => {
        if (!generatedReport || !selectedMissionId) return;
        setSavingToMission(true);
        try {
            const savedId = await saveReportToMission(selectedMissionId, generatedReport, {});
            if (savedId) {
                setSavedToMissionId(savedId);
            }
        } catch (err) {
            console.error('Save to mission failed', err);
        } finally {
            setSavingToMission(false);
        }
    };

    // ─── COMMENTS ────────────────────────────────────────────────────────────

    const handleAddComment = async () => {
        if (!report?.id || !newComment.trim()) return;
        setAddingComment(true);
        try {
            const res = await apiClient.post(`/claims-reports/${report.id}/comments`, {
                content: newComment.trim(),
                commentType: 'note'
            });
            setComments(prev => [res.data.data, ...prev]);
            setNewComment('');
        } catch (err) {
            console.error('Comment failed:', err);
        } finally { setAddingComment(false); }
    };

    // ─── COMPUTED ─────────────────────────────────────────────────────────────

    const allAnnotations = images.flatMap(img => img.annotations || []);
    const criticals = allAnnotations.filter(a => a.severity === 'Critical').length;
    const highs = allAnnotations.filter(a => a.severity === 'High').length;
    const totalCostMin = allAnnotations.reduce((s, a) => s + (a.estimatedCostMin || 0), 0);
    const totalCostMax = allAnnotations.reduce((s, a) => s + (a.estimatedCostMax || 0), 0);
    const analyzedCount = images.filter(img => (img.annotations?.length || 0) > 0).length;

    const stepIndex = STEPS.findIndex(s => s.id === step);

    // ─── RENDER ───────────────────────────────────────────────────────────────

    return (
        <div className="flex gap-6">
            {/* Left: Step Content */}
            <div className="flex-1 min-w-0">
                {/* Step Progress */}
                <div className="flex items-center gap-2 mb-8">
                    {STEPS.map((s, i) => {
                        const isActive = s.id === step;
                        const isDone = i < stepIndex;
                        return (
                            <React.Fragment key={s.id}>
                                <button
                                    onClick={() => isDone && setStep(s.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${isActive ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' :
                                        isDone ? 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 cursor-pointer' :
                                            'text-slate-600 cursor-default'
                                        }`}
                                >
                                    {isDone ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : s.icon}
                                    {s.label}
                                </button>
                                {i < STEPS.length - 1 && (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {error && (
                    <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {error}
                        <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* ── STEP: INTAKE ── */}
                {step === 'intake' && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Hash className="w-4 h-4" />
                                    <CardTitle>Claim Details</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Mission Selector Overlay */}
                                <div className="mb-6 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
                                    <label className="block text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                        <Zap className="w-3 h-3 text-orange-500" /> Link Drone Mission Data
                                    </label>
                                    <select
                                        value={selectedMissionId}
                                        onChange={e => handleMissionSelect(e.target.value)}
                                        className={inputCls}
                                        style={inputStyle}
                                    >
                                        <option value="">Select mission to auto-populate claim details...</option>
                                        {missions.map((m: any) => (
                                            <option key={m.id} value={m.id}>
                                                {m.mission_name || m.siteName || m.site_name || m.title || 'Mission'} {m.date || m.scheduledDate ? `· ${(m.date || m.scheduledDate).slice(0, 10)}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedMissionId && pilots.length > 0 && (
                                        <p className="text-[10px] text-emerald-400 font-bold mt-2 flex items-center gap-1.5 uppercase tracking-wider">
                                            <CheckCircle2 className="w-3 h-3" /> {pilots.length} Mission Pilot{pilots.length > 1 ? 's' : ''} Synced
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Report Title *</label>
                                        <Input
                                            value={form.title}
                                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                            placeholder="e.g. 123 Oak Street — Hail Damage Assessment"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Claim Number</label>
                                        <Input value={form.claimNumber} onChange={e => setForm(f => ({ ...f, claimNumber: e.target.value }))} placeholder="CLM-2024-001" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Policy Number</label>
                                        <Input value={form.policyNumber} onChange={e => setForm(f => ({ ...f, policyNumber: e.target.value }))} placeholder="POL-123456" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Insurance Carrier</label>
                                        <Input value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} placeholder="State Farm, Allstate..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Inspection Type</label>
                                        <select value={form.inspectionType} onChange={e => setForm(f => ({ ...f, inspectionType: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option>Post-Loss</option>
                                            <option>Pre-Loss</option>
                                            <option>Underwriting</option>
                                            <option>Compliance</option>
                                            <option>Risk Survey</option>
                                            <option>Catastrophe Response</option>
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    <CardTitle>Property Information</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Property Address</label>
                                        <Input value={form.propertyAddress} onChange={e => setForm(f => ({ ...f, propertyAddress: e.target.value }))} placeholder="123 Main St, City, State 12345" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Property Type</label>
                                        <select value={form.propertyType} onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))} className={inputCls} style={inputStyle}>
                                            <option>Residential</option>
                                            <option>Commercial</option>
                                            <option>Industrial</option>
                                            <option>Multi-Family</option>
                                            <option>Agricultural</option>
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    <CardTitle>Adjuster Information</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Adjuster Name</label>
                                        <Input value={form.adjusterName} onChange={e => setForm(f => ({ ...f, adjusterName: e.target.value }))} placeholder="John Smith" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Adjuster Email</label>
                                        <Input type="email" value={form.adjusterEmail} onChange={e => setForm(f => ({ ...f, adjusterEmail: e.target.value }))} placeholder="adjuster@carrier.com" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Pilot / Technician</label>
                                        <select
                                            value={form.pilotName}
                                            onChange={e => setForm(f => ({ ...f, pilotName: e.target.value }))}
                                            className={inputCls}
                                            style={{ ...inputStyle, appearance: 'auto', cursor: 'pointer' }}
                                        >
                                            <option value="">{pilots.length > 0 ? 'Select Assigned Pilot...' : 'No pilots assigned to mission'}</option>
                                            {pilots.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end">
                            <Button
                                onClick={handleSaveIntake}
                                disabled={saving || !form.title.trim()}
                                isLoading={saving}
                                size="lg"
                            >
                                {report ? 'Save & Continue' : 'Create Report'}
                                <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP: UPLOAD ── */}
                {step === 'upload' && (
                    <div className="space-y-6">
                        {/* Drop Zone */}
                        <div
                            onDrop={handleDrop}
                            onDragOver={e => e.preventDefault()}
                            className="border-2 border-dashed border-slate-700 hover:border-orange-500/50 rounded-2xl p-12 text-center transition-all bg-slate-900/40 hover:bg-orange-500/5 group"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-slate-800 group-hover:bg-orange-500/10 flex items-center justify-center mx-auto mb-4 transition-all">
                                {uploading ? <Loader2 className="w-8 h-8 text-orange-400 animate-spin" /> : <Camera className="w-8 h-8 text-slate-500 group-hover:text-orange-400 transition-colors" />}
                            </div>
                            <p className="text-base font-bold text-slate-300 mb-1">
                                {uploading ? 'Uploading...' : 'Drop images or folders here'}
                            </p>
                            <p className="text-sm text-slate-500 mb-6">Drone photos, ground images, thermal scans, orthomosaics</p>
                            
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-slate-700/50"
                                >
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    Choose Files
                                </button>
                                <span className="text-slate-600 font-black uppercase text-[10px] tracking-widest">or</span>
                                <button
                                    onClick={() => folderInputRef.current?.click()}
                                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-slate-700/50"
                                >
                                    <FolderUp className="w-4 h-4 text-emerald-400" />
                                    Choose Folder
                                </button>
                            </div>

                            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
                                onChange={e => { const f = Array.from(e.target.files || []); if (f.length) handleFileUpload(f); e.target.value = ''; }} />
                            <input ref={folderInputRef} type="file" {...{ webkitdirectory: '', directory: '' } as any} className="hidden"
                                onChange={e => { const f = Array.from(e.target.files || []); if (f.length) handleFileUpload(f); e.target.value = ''; }} />
                        </div>

                        {/* Image Grid */}
                        {images.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm font-bold text-slate-300">{images.length} image{images.length !== 1 ? 's' : ''} uploaded</p>
                                    {analyzedCount > 0 && (
                                        <span className="text-xs text-emerald-400 font-bold">{analyzedCount} analyzed</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                                    {images.map(img => (
                                        <div key={img.id} className="relative group aspect-square">
                                            <div
                                                className="w-full h-full rounded-xl overflow-hidden bg-slate-800 border border-slate-700 cursor-pointer"
                                                onClick={() => setLightboxImage(img)}
                                            >
                                                <img src={img.url} className="w-full h-full object-cover" alt="" />
                                                {(img.annotations?.length || 0) > 0 && (
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1.5">
                                                        <span className="text-[10px] font-black text-white bg-orange-500 px-1.5 py-0.5 rounded-md">
                                                            {img.annotations!.length} findings
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep('intake')}>
                                <ChevronLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                            <Button
                                onClick={() => {
                                    setStep('analysis');
                                    if (report?.id) loadPricingData(report.id);
                                }}
                                disabled={images.length === 0}
                                size="lg"
                            >
                                Run AI Analysis
                                <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP: ANALYSIS ── */}
                {step === 'analysis' && (
                    <div className="space-y-6">
                        {/* Analysis Control */}
                        <div className="rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-600/5 border border-orange-500/20 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-black text-white">AI Damage Assessment Engine</h3>
                                    <p className="text-sm text-slate-400 mt-1">
                                        Gemini Vision analyzes each image for {form.inspectionType} damage indicators
                                    </p>
                                </div>
                                <button
                                    onClick={handleAnalyzeAll}
                                    disabled={analyzing || images.length === 0}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-sm uppercase tracking-wider disabled:opacity-50 transition-all shadow-lg shadow-orange-500/20"
                                >
                                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                                    {analyzing ? `Analyzing ${analysisProgress.current}/${analysisProgress.total}` : 'Start Analysis'}
                                </button>
                            </div>

                            {analyzing && (
                                <div>
                                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                                        <span className="truncate max-w-xs">{analysisProgress.currentName}</span>
                                        <span>{analysisProgress.current} / {analysisProgress.total}</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
                                            style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Summary Stats */}
                        {allAnnotations.length > 0 && (
                            <div className="grid grid-cols-4 gap-4">
                                <StatCard label="Total Findings" value={allAnnotations.length} color="blue" />
                                <StatCard label="Critical" value={criticals} color="red" />
                                <StatCard label="High Severity" value={highs} color="orange" />
                                <StatCard label="Est. Damage" value={`$${Math.round((totalCostMin + totalCostMax) / 2).toLocaleString()}`} color="yellow" />
                            </div>
                        )}

                        {/* Image Results Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {images.map((img, idx) => {
                                const isAnalyzing = analyzing && analysisProgress.current === idx + 1;
                                const isDone = (img.annotations?.length || 0) > 0;
                                return (
                                    <div key={img.id} className={`rounded-2xl border overflow-hidden transition-all ${isAnalyzing ? 'border-orange-500/50 shadow-lg shadow-orange-500/10' :
                                        isDone ? 'border-emerald-500/30' : 'border-slate-800/60'
                                        } bg-slate-900/60`}>
                                        <div className="flex gap-4 p-4">
                                            <div
                                                className="w-24 h-24 rounded-xl overflow-hidden bg-slate-800 shrink-0 cursor-pointer relative"
                                                onClick={() => setLightboxImage(img)}
                                            >
                                                <img src={img.url} className="w-full h-full object-cover" alt="" />
                                                {isAnalyzing && (
                                                    <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                                                        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                                                    </div>
                                                )}
                                                {isDone && !isAnalyzing && (
                                                    <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-300 truncate mb-1">{img.originalName || `Image ${idx + 1}`}</p>
                                                {isAnalyzing && <p className="text-xs text-orange-400 animate-pulse">Analyzing with Gemini Vision...</p>}
                                                {isDone && (
                                                    <>
                                                        <p className="text-xs text-slate-400 line-clamp-2 mb-2">{img.aiSummary}</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {img.annotations?.slice(0, 3).map(a => (
                                                                <span key={a.id} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${SEVERITY_COLORS[a.severity]}`}>
                                                                    {a.label}
                                                                </span>
                                                            ))}
                                                            {(img.annotations?.length || 0) > 3 && (
                                                                <span className="text-[10px] text-slate-500">+{img.annotations!.length - 3} more</span>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                                {!isDone && !isAnalyzing && (
                                                    <p className="text-xs text-slate-600">Awaiting analysis</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep('upload')}>
                                <ChevronLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                            <Button
                                onClick={() => setStep('pricing')}
                                disabled={analyzing}
                                size="lg"
                            >
                                Continue to Pricing
                                <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP: PRICING ── */}
                {step === 'pricing' && (
                    <div className="space-y-6">
                        <div className="rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-600/5 border border-orange-500/20 p-6 flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-black text-white">Xactimate Engine Estimates</h3>
                                <p className="text-sm text-slate-400 mt-1">Review AI findings and attach precise line item pricing</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Line Items Total</p>
                                <p className="text-2xl font-black text-emerald-400">
                                    ${reportLineItems.reduce((acc, curr) => acc + Number(curr.totalCost || 0), 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-5 gap-6">
                            {/* Left: AI Hints & Summary */}
                            <div className="col-span-2 space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>AI Damage Identified</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {analyzedCount === 0 && (
                                            <p className="text-sm text-slate-500 text-center py-4">Run analysis to see AI damage clues here.</p>
                                        )}
                                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                            {allAnnotations.map((a, i) => (
                                                <div key={a.id || i} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <Badge variant="outline" className={SEVERITY_COLORS[a.severity]}>
                                                            {a.severity} Severity
                                                        </Badge>
                                                        {(a.estimatedCostMin || 0) > 0 && (
                                                            <span className="text-xs font-mono text-slate-400">
                                                                Est: ${a.estimatedCostMin?.toLocaleString()} - ${a.estimatedCostMax?.toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Text variant="small" className="font-medium text-slate-300">
                                                        {a.label}
                                                    </Text>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right: Pricing Catalog & Line Items */}
                            <div className="col-span-3 space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Current Line Items</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {reportLineItems.length === 0 ? (
                                            <p className="text-sm text-slate-500 text-center py-6">No line items added yet. Select items from the catalog below.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {reportLineItems.map(item => (
                                                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                                                                    {item.itemCode}
                                                                </span>
                                                                <Text variant="small" className="font-semibold">{item.itemDescription}</Text>
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                ${Number(item.unitCost).toLocaleString()} per {item.unitType}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => handleUpdateQuantity(item.id, Number(e.target.value))}
                                                                className="w-20 text-right h-8"
                                                                min="0.1"
                                                            />
                                                        </div>
                                                        <div className="w-24 text-right">
                                                            <Text className="font-mono text-emerald-400">
                                                                ${Number(item.totalCost).toLocaleString()}
                                                            </Text>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveLineItem(item.id)}
                                                            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Pricing Catalog</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-2 mb-4">
                                            <Input
                                                placeholder="Search codes or descriptions..."
                                                value={pricingSearch}
                                                onChange={(e) => {
                                                    setPricingSearch(e.target.value);
                                                    if (report?.id) loadPricingData(report.id, e.target.value, selectedCategory);
                                                }}
                                                className="flex-1"
                                            />
                                            <select
                                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 text-sm focus:outline-none focus:border-orange-500"
                                                value={selectedCategory}
                                                onChange={(e) => {
                                                    setSelectedCategory(e.target.value);
                                                    if (report?.id) loadPricingData(report.id, pricingSearch, e.target.value);
                                                }}
                                            >
                                                <option value="">All Categories</option>
                                                {pricingCategories.map(cat => (
                                                    <option key={cat.code} value={cat.code}>{cat.code} - {cat.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                                            {loadingPricing ? (
                                                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
                                            ) : pricingItems.length === 0 ? (
                                                <p className="text-center text-sm text-slate-500 py-8">No matching items found</p>
                                            ) : (
                                                pricingItems.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 border border-slate-800 transition-colors group">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="font-mono text-[10px] uppercase">{item.categoryCode}</Badge>
                                                                <span className="text-sm font-mono text-slate-300">{item.code}</span>
                                                            </div>
                                                            <Text variant="small" className="mt-1">{item.description}</Text>
                                                            <p className="text-xs text-slate-500 mt-0.5">${Number(item.baseUnitCost).toLocaleString()} / {item.unitType}</p>
                                                        </div>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => handleAddLineItem(item.id)}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <div className="flex justify-between mt-6">
                            <Button variant="outline" onClick={() => setStep('analysis')}>
                                <ChevronLeft className="w-4 h-4 mr-2" />
                                Back to Analysis
                            </Button>
                            <Button
                                onClick={() => setStep('narrative')}
                                disabled={saving}
                                size="lg"
                            >
                                Continue to Narrative
                                <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── STEP: NARRATIVE ── */}
                {step === 'narrative' && (
                    <div className="space-y-6">
                        <SectionCard title="Executive Summary" icon={<FileText className="w-4 h-4" />}
                            action={
                                <button
                                    onClick={handleGenerateNarrative}
                                    disabled={generatingNarrative}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold border border-orange-500/20 transition-all"
                                >
                                    {generatingNarrative ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    AI Generate
                                </button>
                            }
                        >
                            {generatingNarrative ? (
                                <div className="flex items-center gap-3 py-8 justify-center text-slate-500">
                                    <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                                    <span className="text-sm">Generating professional narrative...</span>
                                </div>
                            ) : (
                                <textarea
                                    value={narrative.executiveSummary}
                                    onChange={e => setNarrative(n => ({ ...n, executiveSummary: e.target.value }))}
                                    rows={6}
                                    placeholder="Click 'AI Generate' to automatically write a professional executive summary based on all findings, or type manually..."
                                    className={`${inputCls} resize-none`}
                                    style={inputStyle}
                                />
                            )}
                        </SectionCard>

                        <SectionCard title="Recommendations" icon={<Zap className="w-4 h-4" />}>
                            <div className="space-y-2 mb-3">
                                {narrative.recommendations.map((rec, i) => (
                                    <div key={i} className="flex items-start gap-2 group">
                                        <div className="w-5 h-5 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-[10px] font-black text-orange-400">{i + 1}</span>
                                        </div>
                                        <input
                                            value={rec}
                                            onChange={e => {
                                                const updated = [...narrative.recommendations];
                                                updated[i] = e.target.value;
                                                setNarrative(n => ({ ...n, recommendations: updated }));
                                            }}
                                            className="flex-1 bg-transparent text-sm text-slate-300 focus:outline-none border-b border-transparent focus:border-slate-600 pb-1 transition-all"
                                        />
                                        <button
                                            onClick={() => setNarrative(n => ({ ...n, recommendations: n.recommendations.filter((_, j) => j !== i) }))}
                                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={newRec}
                                    onChange={e => setNewRec(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && newRec.trim()) {
                                            setNarrative(n => ({ ...n, recommendations: [...n.recommendations, newRec.trim()] }));
                                            setNewRec('');
                                        }
                                    }}
                                    placeholder="Add recommendation and press Enter..."
                                    className={`${inputCls} flex-1`}
                                    style={inputStyle}
                                />
                            </div>
                        </SectionCard>

                        {/* Risk Score */}
                        <SectionCard title="Risk Assessment" icon={<Shield className="w-4 h-4" />}>
                            <div className="flex items-center gap-6">
                                <div className="flex-1">
                                    <input
                                        type="range" min={0} max={100}
                                        value={narrative.riskScore}
                                        onChange={e => setNarrative(n => ({ ...n, riskScore: parseInt(e.target.value) }))}
                                        className="w-full accent-orange-500"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>Low Risk</span><span>Moderate</span><span>High</span><span>Severe</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className={`text-3xl font-black ${narrative.riskScore >= 75 ? 'text-red-400' :
                                        narrative.riskScore >= 50 ? 'text-orange-400' :
                                            narrative.riskScore >= 25 ? 'text-yellow-400' : 'text-emerald-400'
                                        }`}>{narrative.riskScore}</p>
                                    <p className="text-xs text-slate-500">/ 100</p>
                                </div>
                            </div>
                        </SectionCard>

                        <div className="flex justify-between">
                            <button onClick={() => setStep('analysis')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all">
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                            <button
                                onClick={handleSaveNarrative}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-sm uppercase tracking-wider disabled:opacity-50 transition-all shadow-lg shadow-orange-500/20"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save & Review
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP: REVIEW ── */}
                {step === 'review' && (
                    <div className="space-y-6">
                        {/* Dashboard Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">Claim Intelligence Synthesis</h1>
                                <p className="text-slate-500 text-sm">Reviewing AI-detected anomalies and financial exposure for {form.claimNumber || 'New Claim'}</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                                        isEditing 
                                            ? 'bg-orange-500 text-white border-orange-600 shadow-lg shadow-orange-500/20' 
                                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                    }`}
                                >
                                    {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                                    {isEditing ? 'Finish Editing' : 'Edit Findings'}
                                </button>
                                {generatedReport && (
                                    <button
                                        onClick={() => setIsViewingFull(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-700 hover:bg-slate-700 transition-all"
                                    >
                                        <Eye className="w-3.5 h-3.5" /> View Live Dashboard
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Top KPI Row */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <DollarSign className="w-8 h-8 text-emerald-400" />
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Est. Exposure</p>
                                <p className="text-2xl font-black text-white">
                                    {reportLineItems.length > 0
                                        ? `$${reportLineItems.reduce((sum, item) => sum + Number(item.totalCost), 0).toLocaleString()}`
                                        : `$${totalCostMin.toLocaleString()}`
                                    }
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">Market Rate</span>
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <Zap className="w-8 h-8 text-orange-400" />
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Prism Risk Score</p>
                                <p className={`text-2xl font-black ${narrative.riskScore >= 75 ? 'text-red-400' : narrative.riskScore >= 50 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                    {narrative.riskScore} / 100
                                </p>
                                <div className="mt-2">
                                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden w-24">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${narrative.riskScore >= 75 ? 'bg-red-400' : narrative.riskScore >= 50 ? 'bg-orange-400' : 'bg-emerald-400'}`} 
                                            style={{ width: `${narrative.riskScore}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <Brain className="w-8 h-8 text-blue-400" />
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">AI Anomalies Found</p>
                                <p className="text-2xl font-black text-white">{allAnnotations.length}</p>
                                <p className="text-[9px] text-slate-500 mt-2 flex items-center gap-1 font-bold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Neural Scan Verified
                                </p>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <Shield className="w-8 h-8 text-purple-400" />
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Carrier Status</p>
                                <p className="text-2xl font-black text-white">{form.carrier || 'Unspecified'}</p>
                                <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">Policy: {form.policyNumber || '—'}</p>
                            </div>
                        </div>

                        {/* Main Summary Panel */}
                        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Intelligence Synthesis</span>
                             </div>

                             {isEditing ? (
                                <textarea
                                    value={narrative.executiveSummary}
                                    onChange={e => setNarrative(n => ({ ...n, executiveSummary: e.target.value }))}
                                    className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-5 text-sm text-slate-300 leading-relaxed min-h-[160px] focus:ring-1 focus:ring-orange-500/30 transition-all resize-none"
                                />
                             ) : (
                                <p className="text-base text-slate-300 leading-relaxed font-inter">
                                    {narrative.executiveSummary || "Analysis complete. Awaiting tactical synthesis from the neural engine..."}
                                </p>
                             )}
                        </div>

                        {/* Property & Claim Metadata */}
                        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6">
                            <div className="grid grid-cols-3 gap-8">
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <MapPin className="w-3 h-3" /> Property Details
                                    </p>
                                    <p className="text-sm font-bold text-white">{form.propertyAddress || '—'}</p>
                                    <p className="text-[11px] text-slate-500 mt-1">{form.propertyType} Infrastructure</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <User className="w-3 h-3" /> Lead Adjuster
                                    </p>
                                    <p className="text-sm font-bold text-white">{form.adjusterName || user?.fullName || 'System Auto-Agent'}</p>
                                    <p className="text-[11px] text-slate-500 mt-1">{form.adjusterEmail || user?.email}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Clock className="w-3 h-3" /> Mission Context
                                    </p>
                                    <p className="text-sm font-bold text-white">{form.inspectionType}</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Inspection Timestamp: {new Date().toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Registry of Findings */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Anomalies Detected ({allAnnotations.length})</h3>
                                {isEditing && (
                                    <button 
                                        className="text-[10px] font-black text-orange-400 uppercase tracking-widest hover:text-orange-300"
                                        onClick={() => {
                                            // Redirecting to analysis for deeper edits could be an option, 
                                            // but for now we'll just show the static findings.
                                            setStep('analysis');
                                        }}
                                    >
                                        + Modify Anomaly Registry
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {allAnnotations.length === 0 ? (
                                    <div className="col-span-2 py-10 bg-slate-900/30 border border-slate-800 border-dashed rounded-3xl text-center">
                                        <p className="text-slate-600 text-sm">No critical anomalies identified across dataset</p>
                                    </div>
                                ) : allAnnotations.map((a, i) => (
                                    <div key={a.id || i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 group hover:border-slate-700 transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-slate-600 font-mono">#{String(i+1).padStart(2, '0')}</span>
                                                <h4 className="text-sm font-bold text-white">{a.label}</h4>
                                            </div>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${SEVERITY_COLORS[a.severity]}`}>
                                                {a.severity}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">{a.description}</p>
                                        <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                                            <div className="flex items-center gap-1.5 text-orange-400/80">
                                                <DollarSign className="w-3 h-3" />
                                                <span className="text-[11px] font-black font-mono">
                                                    {a.estimatedCostMin ? `$${a.estimatedCostMin.toLocaleString()}` : 'No Estimate'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                                                <MapPin className="w-2.5 h-2.5" /> {a.location || 'POI'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tactical Recommendations */}
                        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8">
                             <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-orange-400" /> Adjuster Action Recommendations
                             </h3>
                             
                             {isEditing ? (
                                <div className="space-y-3 mb-6">
                                    {narrative.recommendations.map((r, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input 
                                                value={r} 
                                                onChange={e => {
                                                    const newRecs = [...narrative.recommendations];
                                                    newRecs[i] = e.target.value;
                                                    setNarrative(n => ({ ...n, recommendations: newRecs }));
                                                }}
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-300"
                                            />
                                            <button 
                                                onClick={() => setNarrative(n => ({ ...n, recommendations: n.recommendations.filter((_, idx) => idx !== i) }))}
                                                className="p-2 text-slate-500 hover:text-red-400"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <input 
                                            value={newRec} 
                                            onChange={e => setNewRec(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && newRec.trim()) {
                                                    setNarrative(n => ({ ...n, recommendations: [...n.recommendations, newRec.trim()] }));
                                                    setNewRec('');
                                                }
                                            }}
                                            placeholder="Add custom recommendation..."
                                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-300"
                                        />
                                        <button 
                                            onClick={() => {
                                                if (newRec.trim()) {
                                                    setNarrative(n => ({ ...n, recommendations: [...n.recommendations, newRec.trim()] }));
                                                    setNewRec('');
                                                }
                                            }}
                                            className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                             ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {narrative.recommendations.length === 0 ? (
                                        <p className="text-sm text-slate-600 italic">No specific recommendations formulated yet.</p>
                                    ) : narrative.recommendations.map((r, i) => (
                                        <div key={i} className="flex items-start gap-3 p-4 bg-slate-950/40 rounded-2xl border border-slate-800/40">
                                            <span className="w-5 h-5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 text-[10px] font-black mt-0.5">{i+1}</span>
                                            <p className="text-sm text-slate-400 font-medium leading-relaxed">{r}</p>
                                        </div>
                                    ))}
                                </div>
                             )}
                        </div>

                        {/* Submission Bar */}
                        <div className="flex justify-between items-center pt-8 border-t border-slate-800 pb-16">
                            <button 
                                onClick={() => setStep('narrative')} 
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" /> Back to Build
                            </button>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        const mockMeta = {
                                            id: `PREVIEW-${Date.now()}`,
                                            industry: 'insurance',
                                            title: report?.title || 'Draft Claim Report',
                                            filename: 'preview.pdf',
                                            createdAt: new Date().toISOString(),
                                            data: { form: { ...form, ...narrative }, images, allAnnotations }
                                        };
                                        setGeneratedReport(mockMeta as any);
                                        setIsViewingFull(true);
                                    }}
                                    className="flex items-center gap-3 px-8 py-4 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-2xl text-indigo-400 font-black text-sm uppercase tracking-widest transition-all"
                                >
                                    <Eye size={20} />
                                    View Full Report
                                </button>

                                <button
                                    onClick={handleExportPDF}
                                    disabled={exportingPDF || !report}
                                    className="flex items-center gap-3 px-8 py-4 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-2xl text-slate-300 font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {exportingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                    {exportingPDF ? 'Generating...' : 'Export Intelligence'}
                                </button>

                                {selectedMissionId && (
                                    <button
                                        onClick={handleSaveToMission}
                                        disabled={savingToMission || !!savedToMissionId || !generatedReport}
                                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border ${
                                            savedToMissionId 
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default' 
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-xl shadow-indigo-500/20'
                                        }`}
                                    >
                                        {savingToMission ? <Loader2 className="w-5 h-5 animate-spin" /> : savedToMissionId ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                                        {savedToMissionId ? 'Saved to Mission' : 'Save to Mission'}
                                    </button>
                                )}
                                
                                <button
                                    onClick={handleFinalize}
                                    disabled={saving || report?.status === 'FINALIZED'}
                                    className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-xl shadow-emerald-500/20 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                    {report?.status === 'FINALIZED' ? 'Submission Complete' : 'Submit Final Report'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Final Report Viewer Overlay */}
                {isViewingFull && generatedReport && (
                    <PDFViewer 
                        meta={generatedReport} 
                        onClose={() => setIsViewingFull(false)} 
                        onDownload={() => downloadReport(generatedReport)}
                    />
                )}
            </div>

            {/* Right: Sidebar */}
            <div className="w-80 shrink-0 space-y-4">
                {/* Report Status Card */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800/60 p-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Report Status</p>
                    <div className="space-y-2">
                        <StatusRow label="Status" value={report?.status || 'Not Created'} />
                        <StatusRow label="Approval" value={report?.approvalStatus || '—'} />
                        <StatusRow label="Images" value={`${images.length} uploaded`} />
                        <StatusRow label="Findings" value={`${allAnnotations.length} detected`} />
                        <StatusRow label="Risk Score" value={`${narrative.riskScore} / 100`} />
                        {(totalCostMin + totalCostMax) > 0 && (
                            <StatusRow label="Est. Damage" value={`$${Math.round((totalCostMin + totalCostMax) / 2).toLocaleString()}`} />
                        )}
                    </div>
                </div>

                {/* Checklist */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800/60 p-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Completion</p>
                    <div className="space-y-2">
                        {[
                            { label: 'Claim details', done: !!form.title },
                            { label: 'Property address', done: !!form.propertyAddress },
                            { label: 'Images uploaded', done: images.length > 0 },
                            { label: 'AI analysis run', done: analyzedCount > 0 },
                            { label: 'Executive summary', done: !!narrative.executiveSummary },
                            { label: 'Recommendations', done: narrative.recommendations.length > 0 },
                        ].map(item => (
                            <div key={item.label} className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.done ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-slate-800 border border-slate-700'}`}>
                                    {item.done && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                                </div>
                                <span className={`text-xs ${item.done ? 'text-slate-300' : 'text-slate-600'}`}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Comments */}
                {report?.id && (
                    <div className="rounded-2xl bg-slate-900/60 border border-slate-800/60 p-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Collaboration</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                            {comments.length === 0 ? (
                                <p className="text-xs text-slate-600 text-center py-3">No comments yet</p>
                            ) : comments.map((c: any) => (
                                <div key={c.id} className="bg-slate-800/60 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-slate-400">{c.author_name}</span>
                                        <span className="text-[10px] text-slate-600">{new Date(c.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-300">{c.content}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                placeholder="Add note..."
                                className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-orange-500/40 transition-all"
                            />
                            <button
                                onClick={handleAddComment}
                                disabled={addingComment || !newComment.trim()}
                                className="w-8 h-8 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 flex items-center justify-center disabled:opacity-50 transition-all"
                            >
                                {addingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8"
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                        onClick={() => setLightboxImage(null)}
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
                        <img src={lightboxImage.url} className="max-w-full max-h-[80vh] rounded-2xl object-contain" alt="" />
                        {lightboxImage.aiSummary && (
                            <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-slate-700/60">
                                <p className="text-xs text-slate-300">{lightboxImage.aiSummary}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {lightboxImage.annotations?.map(a => (
                                        <span key={a.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${SEVERITY_COLORS[a.severity]}`}>
                                            {a.label} ({Math.round(a.confidence * 100)}%)
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }> = ({ title, icon, children, action }) => (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800/60 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                {icon} {title}
            </div>
            {action}
        </div>
        <div className="p-5">{children}</div>
    </div>
);

const FormField: React.FC<{ label: string; children: React.ReactNode; span?: number }> = ({ label, children, span }) => (
    <div className={span === 2 ? 'col-span-2' : ''}>
        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
        {children}
    </div>
);

const StatCard: React.FC<{ label: string; value: string | number; color: 'blue' | 'red' | 'orange' | 'yellow' }> = ({ label, value, color }) => {
    const colors = {
        blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400',
        red: 'from-red-500/10 to-red-600/5 border-red-500/20 text-red-400',
        orange: 'from-orange-500/10 to-orange-600/5 border-orange-500/20 text-orange-400',
        yellow: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 text-yellow-400',
    };
    return (
        <div className={`rounded-xl bg-gradient-to-br ${colors[color]} border p-4`}>
            <p className="text-xl font-black text-white">{value}</p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{label}</p>
        </div>
    );
};

const StatusRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-bold text-slate-300">{value}</span>
    </div>
);

export default ClaimsReportWizard;
