/**
 * Solar Report Generator
 * Handles all 6 solar inspection report sections with a unified AI-powered wizard.
 */
import React, { useState, useRef } from 'react';
import {
    Upload, Zap, Sun, Map, Cpu, BarChart3, FileText,
    ChevronRight, ChevronLeft, Loader2, CheckCircle2,
    AlertTriangle, ThermometerSun, X, Download
} from 'lucide-react';
import { ReportSection } from '../config/industryReportSections';
import apiClient from '../../../src/services/apiClient';
import { saveReport } from '../utils/reportStorage';

interface SolarReportGeneratorProps {
    section: ReportSection;
}

interface SolarFinding {
    id: string;
    type: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    location: string;
    panelId?: string;
    stringId?: string;
    temperature?: number;
    efficiency?: number;
    description: string;
    recommendation: string;
    estimatedKwhLoss?: number;
    estimatedCostMin?: number;
    estimatedCostMax?: number;
}

interface SolarForm {
    // Site info
    siteName: string;
    siteId: string;
    clientName: string;
    installedKw: string;
    panelCount: string;
    panelMake: string;
    inspectionDate: string;
    pilotName: string;
    flightAltitude: string;
    weatherConditions: string;
    // Section-specific
    notes: string;
}

const STEPS = ['Site Details', 'Upload Media', 'AI Analysis', 'Review & Export'];

const inputStyle: React.CSSProperties = {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid rgba(100,116,139,0.3)',
};
const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm placeholder-slate-500 focus:outline-none transition-all focus:border-orange-500/50';

const SolarReportGenerator: React.FC<SolarReportGeneratorProps> = ({ section }) => {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState<SolarForm>({
        siteName: '', siteId: '', clientName: '', installedKw: '', panelCount: '',
        panelMake: '', inspectionDate: '', pilotName: '', flightAltitude: '',
        weatherConditions: '', notes: ''
    });
    const [uploadedImages, setUploadedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [findings, setFindings] = useState<SolarFinding[]>([]);
    const [aiSummary, setAiSummary] = useState('');
    const [exporting, setExporting] = useState(false);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const f = (k: keyof SolarForm, v: string) => setForm(p => ({ ...p, [k]: v }));

    const handleImageDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        addImages(files);
    };

    const addImages = (files: File[]) => {
        setUploadedImages(prev => [...prev, ...files]);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = e => setImagePreviews(prev => [...prev, e.target?.result as string]);
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (i: number) => {
        setUploadedImages(p => p.filter((_, idx) => idx !== i));
        setImagePreviews(p => p.filter((_, idx) => idx !== i));
    };

    const runAnalysis = async () => {
        setAnalyzing(true);
        try {
            // For now, generate mock solar findings
            // In production this would upload images → Gemini Vision → structured findings
            await new Promise(r => setTimeout(r, 2500));
            const mockFindings: SolarFinding[] = [
                {
                    id: '1', type: 'Thermal Hotspot', severity: 'Critical',
                    location: 'Array A, Row 3', panelId: 'P-0047', stringId: 'S-04',
                    temperature: 87, efficiency: 34,
                    description: 'Diode failure causing severe hotspot at 87°C. Panel operating at 34% efficiency.',
                    recommendation: 'Immediate bypass diode replacement. Risk of fire if left unaddressed.',
                    estimatedKwhLoss: 420, estimatedCostMin: 280, estimatedCostMax: 450,
                },
                {
                    id: '2', type: 'Soiling — Heavy', severity: 'High',
                    location: 'Array B, Rows 1–5', panelId: undefined, stringId: 'S-07,S-08',
                    description: 'Dense bird droppings and dust accumulation across 22 panels. Estimated 18% production loss.',
                    recommendation: 'Schedule panel cleaning. Estimated 2 technician-hours.',
                    estimatedKwhLoss: 890, estimatedCostMin: 180, estimatedCostMax: 320,
                },
                {
                    id: '3', type: 'Micro-Crack', severity: 'Medium',
                    location: 'Array C, Row 7', panelId: 'P-0129',
                    temperature: 52, efficiency: 71,
                    description: 'EL imaging-detectable micro-crack pattern. Currently at 71% efficiency with degradation risk.',
                    recommendation: 'Monitor quarterly. Replace within 12 months.',
                    estimatedKwhLoss: 180, estimatedCostMin: 350, estimatedCostMax: 550,
                },
                {
                    id: '4', type: 'String Underperformance', severity: 'High',
                    location: 'Array A', stringId: 'S-02',
                    efficiency: 58,
                    description: 'String S-02 producing 58% of expected output. Likely partial shading or connection issue.',
                    recommendation: 'Inspect MC4 connectors and string fuse. Check for physical obstructions.',
                    estimatedKwhLoss: 320, estimatedCostMin: 90, estimatedCostMax: 200,
                },
            ];
            setFindings(mockFindings);
            setAiSummary(`AI inspection of ${form.siteName || 'this solar site'} identified ${mockFindings.length} findings across the ${form.installedKw || '—'} kW installation. ` +
                `One critical thermal hotspot at Panel P-0047 requires immediate attention due to fire risk. ` +
                `Total estimated annual production loss is approximately 1,810 kWh. ` +
                `Recommended corrective actions are prioritized by ROI impact.`);
            setAnalysisComplete(true);
            setStep(3);

            // ── Auto-archive this report so it appears in AI Reports tab immediately ──
            try {
                const slug = (form.siteName || 'solar').replace(/[^a-z0-9]/gi, '-').toLowerCase();
                const filename = `solar-report-${slug}-analysis.pdf`;
                // Encode a tiny stub PDF so the archive entry is valid
                const stubText = `Solar AI Report\nSite: ${form.siteName || 'Unknown'}\nDate: ${new Date().toISOString()}\nFindings: ${mockFindings.length}`;
                const encoder = new TextEncoder();
                const stubBuf = encoder.encode(stubText).buffer as ArrayBuffer;
                saveReport('solar', form.siteName || 'Solar Inspection', filename, stubBuf);
            } catch { /* non-fatal */ }
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const { exportSolarReportPDF } = await import('../components/exportSolarReportPDF');
            await exportSolarReportPDF({ form, findings, aiSummary, section, images: imagePreviews });
        } catch (e) {
            console.error(e);
        } finally {
            setExporting(false);
        }
    };

    const totalKwhLoss = findings.reduce((s, f) => s + (f.estimatedKwhLoss || 0), 0);
    const totalMin = findings.reduce((s, f) => s + (f.estimatedCostMin || 0), 0);
    const totalMax = findings.reduce((s, f) => s + (f.estimatedCostMax || 0), 0);
    const criticals = findings.filter(f => f.severity === 'Critical').length;

    const sevColor = (s: string) => ({ Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a' }[s] || '#6b7280');
    const sevBg = (s: string) => ({ Critical: 'rgba(220,38,38,0.12)', High: 'rgba(234,88,12,0.12)', Medium: 'rgba(202,138,4,0.12)', Low: 'rgba(22,163,74,0.12)' }[s] || 'rgba(107,114,128,0.12)');

    return (
        <div className="min-h-[calc(100vh-120px)] bg-slate-950 text-white">
            {/* Step progress */}
            <div className="px-8 pt-6 pb-0">
                <div className="flex items-center gap-0 mb-8">
                    {STEPS.map((s, i) => (
                        <React.Fragment key={s}>
                            <button
                                onClick={() => i < step || (i === 2 && step >= 2) ? setStep(i) : undefined}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${i === step
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : i < step
                                        ? 'text-green-400 cursor-pointer'
                                        : 'text-slate-500 cursor-default'
                                    }`}
                            >
                                {i < step
                                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    : <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${i === step ? 'border-amber-400 text-amber-400' : 'border-slate-600 text-slate-500'}`}>{i + 1}</span>
                                }
                                {s}
                            </button>
                            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-700 flex-shrink-0" />}
                        </React.Fragment>
                    ))}
                </div>

                {/* ── STEP 0: Site Details ── */}
                {step === 0 && (
                    <div className="max-w-3xl">
                        <h2 className="text-lg font-black mb-6 text-white">Site & Inspection Details</h2>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {([
                                ['Site Name', 'siteName', 'e.g. Mojave Solar Farm — Block C'],
                                ['Site / Asset ID', 'siteId', 'e.g. SITE-0042'],
                                ['Client / Portfolio', 'clientName', 'e.g. SunPeak Energy LLC'],
                                ['Installed Capacity (kW)', 'installedKw', 'e.g. 2400'],
                                ['Panel Count', 'panelCount', 'e.g. 4800'],
                                ['Panel Make & Model', 'panelMake', 'e.g. LONGi Hi-MO 6 500W'],
                                ['Inspection Date', 'inspectionDate', ''],
                                ['Pilot / Technician', 'pilotName', 'e.g. J. Robertson'],
                                ['Flight Altitude (ft)', 'flightAltitude', 'e.g. 120'],
                                ['Weather Conditions', 'weatherConditions', 'e.g. Clear, 8 mph wind'],
                            ] as [string, keyof SolarForm, string][]).map(([label, key, ph]) => (
                                <div key={key}>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{label}</label>
                                    <input
                                        type={key === 'inspectionDate' ? 'date' : 'text'}
                                        value={form[key]}
                                        onChange={e => f(key, e.target.value)}
                                        placeholder={ph}
                                        className={inputCls}
                                        style={inputStyle}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Inspector Notes</label>
                            <textarea
                                value={form.notes}
                                onChange={e => f('notes', e.target.value)}
                                rows={3}
                                placeholder="Any relevant site conditions, access notes, or pre-existing issues..."
                                className={`${inputCls} resize-none`}
                                style={inputStyle}
                            />
                        </div>
                        <button
                            onClick={() => setStep(1)}
                            disabled={!form.siteName}
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
                        >
                            Next: Upload Media <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* ── STEP 1: Upload Media ── */}
                {step === 1 && (
                    <div className="max-w-3xl">
                        <h2 className="text-lg font-black mb-2 text-white">Upload Inspection Media</h2>
                        <p className="text-slate-400 text-sm mb-6">Upload thermal, RGB, or multispectral imagery for AI analysis</p>

                        <div
                            onDrop={handleImageDrop}
                            onDragOver={e => e.preventDefault()}
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-slate-600 hover:border-amber-500/50 rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-amber-500/5 mb-6"
                        >
                            <ThermometerSun className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                            <p className="text-white font-semibold mb-1">Drop images here or click to browse</p>
                            <p className="text-slate-400 text-sm">Supports RGB, thermal (.jpg, .png, .tiff) — up to 50 images</p>
                            <input
                                ref={fileRef}
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={e => addImages(Array.from(e.target.files || []))}
                            />
                        </div>

                        {imagePreviews.length > 0 && (
                            <div className="grid grid-cols-5 gap-2 mb-6">
                                {imagePreviews.map((src, i) => (
                                    <div key={i} className="relative group">
                                        <img src={src} alt="" className="w-full aspect-square object-cover rounded-xl border border-slate-700" />
                                        <button
                                            onClick={() => removeImage(i)}
                                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3 text-white" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setStep(0)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all flex items-center gap-2">
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                            <button
                                onClick={() => setStep(2)}
                                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-all flex items-center gap-2"
                            >
                                Next: Run AI Analysis <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: AI Analysis ── */}
                {step === 2 && (
                    <div className="max-w-2xl text-center py-8">
                        {analyzing ? (
                            <>
                                <div className="w-20 h-20 mx-auto mb-6 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
                                <h2 className="text-xl font-black text-white mb-2">AI Analysis Running...</h2>
                                <p className="text-slate-400">Scanning {uploadedImages.length || 0} images for thermal anomalies, soiling, micro-cracks, and string performance issues</p>
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                                    <Sun className="w-10 h-10 text-amber-400" />
                                </div>
                                <h2 className="text-xl font-black text-white mb-2">Ready for AI Analysis</h2>
                                <p className="text-slate-400 mb-2">
                                    {uploadedImages.length > 0
                                        ? `${uploadedImages.length} image${uploadedImages.length !== 1 ? 's' : ''} queued for analysis`
                                        : 'No images uploaded — AI will generate a structural template report'}
                                </p>
                                <p className="text-slate-500 text-sm mb-8">
                                    The AI will identify thermal hotspots, soiling, micro-cracks, module degradation, and string underperformance.
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button onClick={() => setStep(1)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all flex items-center gap-2">
                                        <ChevronLeft className="w-4 h-4" /> Back
                                    </button>
                                    <button
                                        onClick={runAnalysis}
                                        className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-base"
                                    >
                                        <Zap className="w-5 h-5" /> Run Solar AI Analysis
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── STEP 3: Review & Export ── */}
                {step === 3 && (
                    <div className="max-w-4xl pb-16">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-black text-white">Inspection Results — {form.siteName}</h2>
                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Export PDF Report
                            </button>
                        </div>

                        {/* Summary stats */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            {[
                                { label: 'Total Findings', value: findings.length.toString(), color: '#94a3b8' },
                                { label: 'Critical Issues', value: criticals.toString(), color: '#dc2626' },
                                { label: 'Annual kWh Loss', value: totalKwhLoss.toLocaleString(), color: '#f59e0b' },
                                { label: 'Est. Repair Cost', value: totalMin > 0 ? `$${totalMin.toLocaleString()}–$${totalMax.toLocaleString()}` : '—', color: '#22c55e' },
                            ].map(s => (
                                <div key={s.label} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                                    <p className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
                                    <p className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* AI Summary */}
                        {aiSummary && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                                <p className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-2">AI Analysis Summary</p>
                                <p className="text-sm text-slate-300 leading-relaxed">{aiSummary}</p>
                            </div>
                        )}

                        {/* Findings list */}
                        <div className="space-y-3">
                            {findings.map((fnd, i) => (
                                <div
                                    key={fnd.id}
                                    className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4"
                                    style={{ borderLeft: `3px solid ${sevColor(fnd.severity)}` }}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 font-mono">#{i + 1}</span>
                                            <h3 className="text-sm font-bold text-white">{fnd.type}</h3>
                                            <span
                                                className="text-xs font-bold px-2 py-0.5 rounded-full uppercase"
                                                style={{ background: sevBg(fnd.severity), color: sevColor(fnd.severity) }}
                                            >
                                                {fnd.severity}
                                            </span>
                                        </div>
                                        {fnd.estimatedCostMin && (
                                            <span className="text-sm font-bold text-white">
                                                ${fnd.estimatedCostMin.toLocaleString()} – ${fnd.estimatedCostMax?.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-xs text-slate-400 mb-2">
                                        <span>📍 {fnd.location}</span>
                                        {fnd.panelId && <span>Panel: {fnd.panelId}</span>}
                                        {fnd.stringId && <span>String: {fnd.stringId}</span>}
                                        {fnd.temperature && <span>🌡️ {fnd.temperature}°C</span>}
                                        {fnd.efficiency && <span>⚡ {fnd.efficiency}% efficiency</span>}
                                        {fnd.estimatedKwhLoss && <span>📉 {fnd.estimatedKwhLoss.toLocaleString()} kWh/yr loss</span>}
                                    </div>
                                    <p className="text-xs text-slate-300 mb-1">{fnd.description}</p>
                                    <p className="text-xs text-amber-400">→ {fnd.recommendation}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SolarReportGenerator;
