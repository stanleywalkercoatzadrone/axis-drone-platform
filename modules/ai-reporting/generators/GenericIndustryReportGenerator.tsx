/**
 * GenericIndustryReportGenerator
 * Powers Construction, Utilities, and Telecom report sections
 * via the /api/ai/report-generate Gemini endpoint.
 */
import React, { useState } from 'react';
import { ReportSection } from '../config/industryReportSections';
import apiClient from '../../../src/services/apiClient';
import { saveReport, ReportMeta, downloadReport, saveReportToMission } from '../utils/reportStorage';
import { PDFViewer } from '../components/AIReportArchive';
import { exportGenericReportPDF } from '../components/exportGenericReportPDF';
import { 
    Eye, Download, Sparkles, CheckCircle, RefreshCw, 
    Loader2, ChevronRight, AlertCircle, Edit3, History, Save,
    Plus, X, MapPin, Camera
} from 'lucide-react';

interface Finding {
    id: string;
    title: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
}

interface Props {
    section: ReportSection;
    industryLabel: string;
    colorHex: string;
    initialSiteName?: string;
    initialClientName?: string;
    initialFlightAltitude?: string;
    initialPilotName?: string;
    onShowArchive?: (search?: string) => void;
    missionId?: string;
}

const GenericIndustryReportGenerator: React.FC<Props> = ({
    section, industryLabel, colorHex, initialSiteName = '', initialClientName = '', initialPilotName = '', onShowArchive, missionId
}) => {
    const [siteName, setSiteName] = useState(initialSiteName);
    const [clientName, setClientName] = useState(initialClientName);
    const [location, setLocation] = useState('');
    const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [pilotName, setPilotName] = useState(initialPilotName || '');
    const [missions, setMissions] = useState<any[]>([]);
    const [selectedMissionId, setSelectedMissionId] = useState('');
    const [pilots, setPilots] = useState<string[]>([]);
    const [allPilots, setAllPilots] = useState<string[]>([]);
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generatedReport, setGeneratedReport] = useState<ReportMeta | null>(null);
    const [isViewingFull, setIsViewingFull] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [savingToMission, setSavingToMission] = useState(false);
    const [savedToMissionId, setSavedToMissionId] = useState<string | null>(null);
    const [orthomosaicUrl, setOrthomosaicUrl] = useState('');

    // Findings & Faults State
    const [findings, setFindings] = useState<Finding[]>([]);
    const [isAddingFinding, setIsAddingFinding] = useState(false);
    const [newFinding, setNewFinding] = useState<Partial<Finding>>({
        severity: 'Medium'
    });
    const [fetchingMetadata, setFetchingMetadata] = useState(false);

    const fetchMetadataForImage = async (url: string) => {
        if (!url) return;
        setFetchingMetadata(true);
        try {
            const res = await apiClient.get('/images/metadata', { params: { url } });
            if (res.data.success && res.data.data) {
                const meta = res.data.data;
                setNewFinding(prev => ({
                    ...prev,
                    latitude: meta.latitude,
                    longitude: meta.longitude,
                    altitude: meta.altitude
                }));
            }
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        } finally {
            setFetchingMetadata(false);
        }
    };

    const addFinding = () => {
        if (!newFinding.title) return;
        const finding: Finding = {
            id: `find-${Date.now()}`,
            title: newFinding.title || '',
            description: newFinding.description || '',
            severity: (newFinding.severity as any) || 'Medium',
            imageUrl: newFinding.imageUrl,
            latitude: newFinding.latitude,
            longitude: newFinding.longitude,
            altitude: newFinding.altitude
        };
        setFindings(prev => [...prev, finding]);
        setNewFinding({ severity: 'Medium' });
        setIsAddingFinding(false);
    };

    const removeFinding = (id: string) => {
        setFindings(prev => prev.filter(f => f.id !== id));
    };

    // Fetch missions and pilots on mount
    React.useEffect(() => {
        apiClient.get('/deployments')
            .then(res => {
                const list = res.data?.data || res.data?.missions || [];
                setMissions(list);
                if (missionId) {
                    handleMissionSelect(missionId);
                }
            })
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
    }, []);

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

            if (intel.siteName || intel.title) setSiteName(intel.siteName || intel.title);
            if (intel.clientName) setClientName(intel.clientName);
            if (intel.location) setLocation(intel.location);
            if (intel.scheduledDate) setInspectionDate(intel.scheduledDate.slice(0, 10));

            const personnel: any[] = intel.assignedPersonnel || [];
            const names = personnel
                .map((p: any) => p.fullName || p.name || p.email)
                .filter((n: string) => n && n.trim().length > 0);
            
            // Sync pilots to mission-specific personnel
            setPilots(names);
            
            if (names.length === 1) setPilotName(names[0]);
            else if (names.length === 0) setPilotName('');
        } catch (err) {
            console.error('handleMissionSelect failed', err);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        setResult(null);
        try {
            const prompt = `You are a professional drone inspection AI specializing in ${industryLabel} operations.

Generate a comprehensive, detailed "${section.title}" inspection report.

Context:
- Industry: ${industryLabel}
- Report Type: ${section.title}
- Site/Asset Name: ${siteName || 'Not specified'}
- Client/Owner: ${clientName || 'Not specified'}
- Location: ${location || 'Not specified'}
- Inspection Date: ${inspectionDate}
- Pilot / Technician: ${pilotName || 'Not specified'}
- Scope: ${section.description}
- Additional Notes: ${notes || 'None'}

Generate a professional report with:
1. Executive Summary (2-3 sentences)
2. Key Findings (4-6 specific, realistic findings with severity ratings)
3. Risk Assessment (overall risk level with justification)
4. Recommended Actions (prioritized, numbered list)
5. Estimated Costs (realistic ranges per action item)
6. Compliance Notes (any relevant regulatory considerations)

Write in a professional, technical tone suitable for enterprise clients. Include specific measurements, percentages, and industry-standard terminology where appropriate.`;

            const res = await apiClient.post('/ai/report-generate', {
                prompt,
                context: `${industryLabel} drone inspection AI report generation system`,
            });

            if (res.data.success) {
                const content = res.data.result || '';
                setResult(content);
                
                // Auto-generate PDF
                try {
                    const reportId = await exportGenericReportPDF({
                        industry: section.id as any,
                        title: section.title,
                        siteName,
                        clientName,
                        location,
                        date: inspectionDate,
                        pilotName,
                        content: content,
                        findings, // Pass down the manually added faults
                        accentColor: colorHex,
                        orthomosaicUrl
                    });

                    if (reportId) {
                        const slug = (siteName || 'report').replace(/[^a-z0-9]/gi, '-').toLowerCase();
                        setGeneratedReport({
                            id: reportId as string,
                            industry: section.id as any,
                            title: section.title,
                            filename: `${section.id}-report-${slug}.pdf`,
                            sizeBytes: 0,
                            createdAt: new Date().toISOString()
                        });
                        setIsViewingFull(true);
                    }
                } catch (e) {
                    console.error('Auto PDF generation failed', e);
                }
            } else {
                throw new Error(res.data.message || 'Generation failed');
            }
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || 'Unknown error');
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveToMissionEnhanced = async () => {
        if (!result || !missionId) return;
        setSavingToMission(true);
        try {
            // Generate TOC from markdown-ish headers
            const toc = result.split('\n')
                .filter(l => l.match(/^[0-9]\.|^#{1,3}\s/))
                .map(l => l.replace(/^[0-9]\.\s|^#{1,3}\s/, '').trim());

            const fullData = {
                title: section.title,
                siteName,
                clientName,
                location,
                inspectionDate,
                pilotName,
                content: result,
                findings,
                toc,
                industry: section.id,
                generatedAt: new Date().toISOString()
            };

            const reportId = await saveReportToMission(missionId, {
                industry: section.id as any,
                title: section.title,
                filename: `${section.id}-report-${Date.now()}.pdf`,
                sizeBytes: 0,
            }, fullData);

            if (reportId) {
                setSavedToMissionId(reportId);
            }
        } catch (err) {
            console.error('Save to mission failed:', err);
        } finally {
            setSavingToMission(false);
        }
    };
    
    const handleSaveToMission = async () => {
        if (!generatedReport || !missionId) return;
        setSavingToMission(true);
        try {
            const savedId = await saveReportToMission(missionId, generatedReport, {});
            if (savedId) {
                setSavedToMissionId(savedId);
            }
        } catch (err) {
            console.error('Save to mission failed', err);
        } finally {
            setSavingToMission(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-120px)] bg-slate-950 text-white">
            {/* Progress steps */}
            <div className="px-8 pt-6 pb-0">
                <div className="flex items-center gap-2 mb-6">
                    {['Site Details', 'Generate Report', 'Review & Export'].map((step, i) => {
                        const active = result ? i === 2 : i === 0;
                        const done = result ? i < 2 : false;
                        return (
                            <React.Fragment key={step}>
                                {i > 0 && <div className={`flex-1 h-px ${done || active ? '' : 'bg-slate-700'}`} style={{ background: done ? colorHex : undefined }} />}
                                <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full shrink-0 transition-all`}
                                    style={{
                                        background: done ? colorHex + '90' : active ? colorHex + '20' : 'transparent',
                                        color: done ? '#fff' : active ? colorHex : '#475569',
                                        border: `1px solid ${done || active ? colorHex + '50' : '#334155'}`,
                                    }}>
                                    {done ? <CheckCircle className="w-3 h-3" /> : <span>{i + 1}</span>}
                                    {step}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            <div className="px-8 pb-8">
                {!result ? (
                    <div className="max-w-2xl space-y-6">
                        {/* Header */}
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
                                    style={{ background: section.accentHex + '20', border: `1px solid ${section.accentHex}30`, color: section.accentHex }}>
                                    {section.icon}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white">{section.title}</h2>
                                    <p className="text-xs text-slate-500">{industryLabel} · {section.badge}</p>
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm mt-3">{section.description}</p>
                        </div>

                        {/* Mission Selector */}
                        <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                            <label className="block text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <RefreshCw className="w-3 h-3" /> Mission Intelligence Link
                            </label>
                            <select
                                value={selectedMissionId}
                                onChange={e => handleMissionSelect(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all cursor-pointer"
                                style={{ appearance: 'none' }}
                            >
                                <option value="">Link to existing mission (auto-populates)...</option>
                                {missions.map((m: any) => (
                                    <option key={m.id} value={m.id}>
                                        {m.mission_name || m.siteName || m.site_name || m.title || 'Mission'} {m.date || m.scheduledDate ? `· ${(m.date || m.scheduledDate).slice(0, 10)}` : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedMissionId && pilots.length > 0 && (
                                <p className="text-[10px] text-emerald-400 font-bold mt-2 flex items-center gap-1.5 uppercase tracking-wider">
                                    <CheckCircle className="w-3 h-3" /> {pilots.length} Assigned Pilot{pilots.length > 1 ? 's' : ''} Synced
                                </p>
                            )}
                        </div>

                        {/* Form */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Site & Inspection Details</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1.5">Site / Asset Name</label>
                                    <input
                                        value={siteName}
                                        onChange={e => setSiteName(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
                                        placeholder="e.g. Tower #12, Substation Alpha"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1.5">Client / Owner</label>
                                    <select
                                        value={clientName}
                                        onChange={e => setClientName(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-slate-500"
                                        style={{ appearance: 'none', cursor: 'pointer' }}
                                    >
                                        <option value="" disabled>Select Client...</option>
                                        {['SunPeak Energy LLC', 'Nextera Energy', 'Duke Energy', 'Enel Green Power', 'Dominion Energy', 'Orsted', 'Verizon Wireless', 'AT&T', 'T-Mobile', 'American Tower', 'Crown Castle', 'Other'].map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1.5">Location</label>
                                    <input
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
                                        placeholder="City, State or coordinates"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1.5">Inspection Date</label>
                                    <input
                                        type="date"
                                        value={inspectionDate}
                                        onChange={e => setInspectionDate(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-slate-500"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-xs font-bold text-slate-400 block mb-1.5 uppercase tracking-wide">Pilot / Technician</label>
                                    <select
                                        value={pilotName}
                                        onChange={e => setPilotName(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-slate-500 transition-all cursor-pointer"
                                        style={{ appearance: 'auto' }}
                                    >
                                        <option value="">{pilots.length > 0 ? 'Select Assigned Pilot...' : 'No pilots assigned to mission'}</option>
                                        {pilots.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1.5">Additional Notes / Context</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={3}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
                                    placeholder="Any specific concerns, prior inspection history, or scope restrictions..."
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1.5 flex items-center justify-between">
                                    Orthomosaic Map Asset URL
                                    <span className="text-[10px] text-slate-500 font-normal uppercase tracking-wider">Optional Embed</span>
                                </label>
                                <input
                                    value={orthomosaicUrl}
                                    onChange={e => setOrthomosaicUrl(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
                                    placeholder="Paste output URL to embed the generated digital twin map into the final report..."
                                />
                            </div>

                        {/* Findings & Fault Intelligence Section */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                        <Camera className="w-4 h-4 text-indigo-400" /> Fault Intelligence
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Link specific image findings with GPS precision</p>
                                </div>
                                <button
                                    onClick={() => setIsAddingFinding(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700"
                                >
                                    <Plus className="w-3 h-3" /> Add Fault
                                </button>
                            </div>

                            {findings.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {findings.map(f => (
                                        <div key={f.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 relative group">
                                            <button 
                                                onClick={() => removeFinding(f.id)}
                                                className="absolute top-3 right-3 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <div className="flex items-start gap-3">
                                                {f.imageUrl && (
                                                    <img src={f.imageUrl} className="w-16 h-16 rounded-lg object-cover bg-slate-800 shrink-0" alt="finding" />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{f.severity} Severity</p>
                                                    <h4 className="text-sm font-bold text-white truncate">{f.title}</h4>
                                                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{f.description}</p>
                                                    {(f.latitude || f.longitude) && (
                                                        <div className="flex items-center gap-1 mt-2 text-[10px] font-mono text-slate-600">
                                                            <MapPin className="w-2.5 h-2.5" />
                                                            {f.latitude?.toFixed(6)}, {f.longitude?.toFixed(6)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isAddingFinding && (
                                <div className="p-6 bg-slate-950 border border-indigo-500/30 rounded-3xl space-y-4 animate-in fade-in zoom-in duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fault Title</label>
                                            <input 
                                                type="text" 
                                                value={newFinding.title || ''} 
                                                onChange={e => setNewFinding(p => ({ ...p, title: e.target.value }))}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="e.g. Structural Corrosion"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Severity</label>
                                            <select 
                                                value={newFinding.severity}
                                                onChange={e => setNewFinding(p => ({ ...p, severity: e.target.value as any }))}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option>Low</option>
                                                <option>Medium</option>
                                                <option>High</option>
                                                <option>Critical</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Evidence Image URL</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={newFinding.imageUrl || ''} 
                                                onChange={e => setNewFinding(p => ({ ...p, imageUrl: e.target.value }))}
                                                onBlur={e => fetchMetadataForImage(e.target.value)}
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="https://..."
                                            />
                                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center">
                                                {fetchingMetadata ? (
                                                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                                                ) : newFinding.imageUrl ? (
                                                    <MapPin className="w-4 h-4 text-emerald-400" />
                                                ) : (
                                                    <Camera className="w-4 h-4 text-slate-700" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Latitude</label>
                                            <input 
                                                type="number" 
                                                step="any"
                                                value={newFinding.latitude || ''} 
                                                onChange={e => setNewFinding(p => ({ ...p, latitude: parseFloat(e.target.value) }))}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Metadata auto-fill..."
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Longitude</label>
                                            <input 
                                                type="number" 
                                                step="any"
                                                value={newFinding.longitude || ''} 
                                                onChange={e => setNewFinding(p => ({ ...p, longitude: parseFloat(e.target.value) }))}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                placeholder="Metadata auto-fill..."
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button 
                                            onClick={() => setIsAddingFinding(false)}
                                            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={addFinding}
                                            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                                        >
                                            Link Fault
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
                            style={{ background: colorHex }}
                        >
                            {generating ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Generating Report…</>
                            ) : (
                                <><Sparkles className="w-4 h-4" /> Generate AI Report <ChevronRight className="w-4 h-4" /></>
                            )}
                        </button>

                        {generating && (
                            <div className="flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
                                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: colorHex, borderTopColor: 'transparent' }} />
                                <div>
                                    <p className="text-sm text-white font-semibold">Gemini AI is generating your report…</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Analyzing {industryLabel.toLowerCase()} parameters for {section.title}</p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="max-w-3xl space-y-4">
                        {/* Report Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-white">{section.title}</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {siteName && `${siteName} · `}{inspectionDate} · AI-Generated
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all ${
                                        isEditing 
                                            ? 'bg-amber-500 text-white border-amber-600' 
                                            : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                                    }`}
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    {isEditing ? 'Finish' : 'Edit'}
                                </button>
                                <button
                                    onClick={() => setResult(null)}
                                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                                </button>
                                 <button
                                    onClick={() => {
                                        if (generatedReport) {
                                            setIsViewingFull(true);
                                        } else {
                                            const shadowMeta = {
                                                id: `PREVIEW-${Date.now()}`,
                                                industry: section.id as any,
                                                title: section.title,
                                                filename: 'preview.pdf',
                                                createdAt: new Date().toISOString(),
                                                data: { content: result, form: { siteName, clientName, location, inspectionDate, pilotName } }
                                            };
                                            setGeneratedReport(shadowMeta as any);
                                            setIsViewingFull(true);
                                        }
                                    }}
                                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 transition-colors"
                                >
                                    <Eye className="w-3.5 h-3.5" /> View Final Report
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!result) return;
                                        setExporting(true);
                                        try {
                                            await exportGenericReportPDF({
                                                industry: section.id as any,
                                                title: section.title,
                                                siteName,
                                                clientName,
                                                location,
                                                date: inspectionDate,
                                                pilotName,
                                                content: result,
                                                findings, // Pass down the manually added faults
                                                accentColor: colorHex,
                                                orthomosaicUrl
                                            });
                                        } finally {
                                            setExporting(false);
                                        }
                                    }}
                                    disabled={exporting}
                                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-white font-bold border transition-colors shadow-lg"
                                    style={{ background: colorHex, borderColor: colorHex + '40' }}
                                >
                                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                    Download PDF
                                </button>
                                {onShowArchive && (
                                    <button
                                        onClick={() => onShowArchive(siteName || initialSiteName)}
                                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                                    >
                                        <History size={14} className="text-indigo-400" />
                                    </button>
                                )}
                                 {missionId && (
                                    <button
                                        onClick={handleSaveToMissionEnhanced}
                                        disabled={savingToMission || !!savedToMissionId || !result}
                                        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all ${
                                            savedToMissionId 
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent'
                                        }`}
                                    >
                                        {savingToMission ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedToMissionId ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                                        {savedToMissionId ? 'Saved to Mission' : 'Save to Mission Archive'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Full Report Viewer Overlay */}
                        {isViewingFull && generatedReport && (
                            <PDFViewer 
                                meta={generatedReport} 
                                onClose={() => setIsViewingFull(false)} 
                                onDownload={() => downloadReport(generatedReport)}
                            />
                        )}

                        {/* Report content */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-800">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                                    style={{ background: colorHex + '20', color: colorHex }}>
                                    {section.icon}
                                </div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{section.badge} · {industryLabel}</span>
                                <div className="ml-auto flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                    <Sparkles className="w-3 h-3 text-amber-500/50" />
                                    AI Generated · Editable
                                </div>
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={result || ''}
                                    onChange={e => setResult(e.target.value)}
                                    rows={18}
                                    className="w-full bg-slate-950/50 border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono focus:outline-none resize-none scrollbar-hide rounded-xl p-4 transition-all"
                                    placeholder="Edit report content here..."
                                />
                            ) : (
                                <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed px-2">
                                    {result || 'Report generation complete. Finalizing content...'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GenericIndustryReportGenerator;
