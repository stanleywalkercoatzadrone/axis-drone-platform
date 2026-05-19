/**
 * Solar Report Generator
 * Handles all 6 solar inspection report sections with a unified AI-powered wizard.
 */
import React, { useState, useRef, useCallback } from 'react';
import { 
    ChevronRight, 
    ChevronLeft, 
    Zap, 
    Sun, 
    ThermometerSun, 
    Thermometer, 
    MapPin, 
    FileText, 
    X, 
    Download, 
    Eye, 
    TrendingUp, 
    CheckCircle2, 
    Loader2, 
    Sparkles, 
    Cpu, 
    Trash2, 
    History,
    FolderUp,
    Edit3,
    Settings
} from 'lucide-react';
import { ReportSection } from '../config/industryReportSections';
import apiClient from '../../../src/services/apiClient';
import { saveReport, ReportMeta, downloadReport, saveReportToMission } from '../utils/reportStorage';
import { PDFViewer } from '../components/AIReportArchive';
import { exportSolarReportPDF } from '../components/exportSolarReportPDF';
import FaultTaggingModal from '../components/FaultTaggingModal';
import { Fault, Severity as GlobalSeverity } from '../../../src/types';

// ── WMO weather code → human-readable label ──────────────────────────────────
function wmoToLabel(code: number, windMph: number): string {
    const windDesc = windMph < 5 ? 'calm winds' : windMph < 12 ? `${Math.round(windMph)} mph wind` : windMph < 20 ? `${Math.round(windMph)} mph moderate wind` : `${Math.round(windMph)} mph strong wind`;
    if (code === 0) return `Clear, ${windDesc}`;
    if (code <= 2) return `Partly cloudy, ${windDesc}`;
    if (code <= 3) return `Overcast, ${windDesc}`;
    if (code <= 48) return `Foggy, ${windDesc}`;
    if (code <= 57) return `Light drizzle, ${windDesc}`;
    if (code <= 67) return `Rain, ${windDesc}`;
    if (code <= 77) return `Snow, ${windDesc}`;
    if (code <= 82) return `Rain showers, ${windDesc}`;
    if (code >= 95) return `Thunderstorm, ${windDesc}`;
    return `Cloudy, ${windDesc}`;
}

// ── Read GPS Altitude from JPEG EXIF (no external lib needed) ────────────────
async function readExifAltitude(file: File): Promise<number | null> {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const buf = e.target?.result as ArrayBuffer;
                const view = new DataView(buf);
                // Validate JPEG SOI marker
                if (view.getUint16(0) !== 0xFFD8) { resolve(null); return; }
                let offset = 2;
                while (offset < view.byteLength - 4) {
                    const marker = view.getUint16(offset);
                    const length = view.getUint16(offset + 2);
                    if (marker === 0xFFE1) { // APP1 / EXIF block
                        const exifHeader = String.fromCharCode(...new Uint8Array(buf, offset + 4, 6));
                        if (exifHeader.startsWith('Exif')) {
                            const tiffStart = offset + 10;
                            const endian = view.getUint16(tiffStart) === 0x4949 ? true : false; // little endian
                            const getU16 = (o: number) => view.getUint16(tiffStart + o, endian);
                            const getU32 = (o: number) => view.getUint32(tiffStart + o, endian);
                            const ifd0 = getU32(4);
                            const entries = getU16(ifd0);
                            for (let i = 0; i < entries; i++) {
                                const eOff = ifd0 + 2 + i * 12;
                                const tag = getU16(eOff);
                                if (tag === 0x8825) { // GPSInfoIFDPointer
                                    const gpsOffset = getU32(eOff + 8);
                                    const gpsEntries = getU16(gpsOffset);
                                    let altVal: number | null = null;
                                    let altRef = 0;
                                    for (let j = 0; j < gpsEntries; j++) {
                                        const gOff = gpsOffset + 2 + j * 12;
                                        const gTag = getU16(gOff);
                                        if (gTag === 0x0005) altRef = view.getUint8(tiffStart + getU32(gOff + 8)); // 0=above sea, 1=below
                                        if (gTag === 0x0006) { // GPSAltitude rational
                                            const rOff = getU32(gOff + 8);
                                            const num = getU32(rOff);
                                            const den = getU32(rOff + 4);
                                            altVal = den > 0 ? num / den : null;
                                        }
                                    }
                                    if (altVal !== null) {
                                        const meters = altRef === 1 ? -altVal : altVal;
                                        resolve(Math.round(meters * 3.28084)); // → feet
                                        return;
                                    }
                                }
                            }
                        }
                    }
                    offset += 2 + length;
                }
            } catch { /* EXIF parse failed */ }
            resolve(null);
        };
        reader.readAsArrayBuffer(file.slice(0, 65536)); // Read only first 64KB
    });
}

// ── Read GPS Coordinates from JPEG EXIF ──────────────────────────────────────
async function readExifCoordinates(file: File): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const buf = e.target?.result as ArrayBuffer;
                const view = new DataView(buf);
                if (view.getUint16(0) !== 0xFFD8) { resolve(null); return; }
                let offset = 2;
                while (offset < view.byteLength - 4) {
                    const marker = view.getUint16(offset);
                    const length = view.getUint16(offset + 2);
                    if (marker === 0xFFE1) {
                        const exifHeader = String.fromCharCode(...new Uint8Array(buf, offset + 4, 6));
                        if (exifHeader.startsWith('Exif')) {
                            const tiffStart = offset + 10;
                            const endian = view.getUint16(tiffStart) === 0x4949;
                            const getU16 = (o: number) => view.getUint16(tiffStart + o, endian);
                            const getU32 = (o: number) => view.getUint32(tiffStart + o, endian);
                            const ifd0 = getU32(4);
                            const entries = getU16(ifd0);
                            for (let i = 0; i < entries; i++) {
                                const eOff = ifd0 + 2 + i * 12;
                                if (getU16(eOff) === 0x8825) {
                                    const gpsOffset = getU32(eOff + 8);
                                    const gpsEntries = getU16(gpsOffset);
                                    let latDeg, latMin, latSec, latRef;
                                    let lngDeg, lngMin, lngSec, lngRef;

                                    for (let j = 0; j < gpsEntries; j++) {
                                        const gOff = gpsOffset + 2 + j * 12;
                                        const gTag = getU16(gOff);
                                        const rOff = getU32(gOff + 8);
                                        const getRational = (o: number) => getU32(o) / getU32(o + 4);

                                        if (gTag === 0x0001) latRef = String.fromCharCode(view.getUint8(tiffStart + rOff));
                                        if (gTag === 0x0002) {
                                            latDeg = getRational(tiffStart + rOff);
                                            latMin = getRational(tiffStart + rOff + 8);
                                            latSec = getRational(tiffStart + rOff + 16);
                                        }
                                        if (gTag === 0x0003) lngRef = String.fromCharCode(view.getUint8(tiffStart + rOff));
                                        if (gTag === 0x0004) {
                                            lngDeg = getRational(tiffStart + rOff);
                                            lngMin = getRational(tiffStart + rOff + 8);
                                            lngSec = getRational(tiffStart + rOff + 16);
                                        }
                                    }

                                    if (latDeg != null && lngDeg != null) {
                                        let lat = latDeg + latMin / 60 + latSec / 3600;
                                        if (latRef === 'S') lat = -lat;
                                        let lng = lngDeg + lngMin / 60 + lngSec / 3600;
                                        if (lngRef === 'W') lng = -lng;
                                        resolve({ lat, lng });
                                        return;
                                    }
                                }
                            }
                        }
                    }
                    offset += 2 + length;
                }
            } catch { /* EXIF fail */ }
            resolve(null);
        };
        reader.readAsArrayBuffer(file.slice(0, 65536));
    });
}

interface SolarReportGeneratorProps {
    missionId?: string;
    section: ReportSection;
    initialSiteName?: string;
    initialClientName?: string;
    initialFlightAltitude?: string;
    onShowArchive?: (search?: string) => void;
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
    imageIndex?: number;
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

const SolarReportGenerator: React.FC<SolarReportGeneratorProps> = ({ 
    missionId,
    section, 
    initialSiteName, 
    initialClientName, 
    initialFlightAltitude, 
    onShowArchive 
}) => {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState<SolarForm>({
        siteName: initialSiteName || '',
        siteId: '',
        clientName: initialClientName || '',
        installedKw: '',
        panelCount: '',
        panelMake: '',
        inspectionDate: new Date().toISOString().slice(0, 10),
        pilotName: '',
        flightAltitude: initialFlightAltitude || '',
        weatherConditions: '',
        notes: ''
    });
    const [uploadedImages, setUploadedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [findings, setFindings] = useState<SolarFinding[]>([]);
    const [aiSummary, setAiSummary] = useState('');
    const [exporting, setExporting] = useState(false);
    const [savingToMission, setSavingToMission] = useState(false);
    const [savedToMissionId, setSavedToMissionId] = useState<string | null>(null);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [altitudeDetected, setAltitudeDetected] = useState(false);
    const [pilots, setPilots] = useState<string[]>([]);
    const [allPilots, setAllPilots] = useState<string[]>([]);
    const [missions, setMissions] = useState<any[]>([]);
    const [selectedMissionId, setSelectedMissionId] = useState('');
    const [generatedReport, setGeneratedReport] = useState<ReportMeta | null>(null);
    const [isViewingFull, setIsViewingFull] = useState(false);
    const [isProcessingMedia, setIsProcessingMedia] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    // Fault Tagging Extensions
    const [faults, setFaults] = useState<Fault[]>([]);
    const [selectedImageForFault, setSelectedImageForFault] = useState<any>(null);
    const [imageMetadata, setImageMetadata] = useState<Record<number, { lat: number, lng: number }>>({});
    
    const fileRef = useRef<HTMLInputElement>(null);
    const folderRef = useRef<HTMLInputElement>(null);

    // Fetch missions list on mount for the Mission Selector
    React.useEffect(() => {
        apiClient.get('/deployments')
            .then(res => {
                const list: any[] = res.data?.data || res.data?.missions || [];
                setMissions(list);
            })
            .catch(() => { /* missions list optional */ });

        // General pilot fetch — ensure dropdown is never empty
        apiClient.get('/personnel?role=pilot_technician')
            .then(res => {
                const list: any[] = res.data?.data || [];
                const names = list.map((p: any) => p.fullName || p.full_name || p.name || p.email).filter(Boolean);
                if (names.length > 0) {
                    setAllPilots(names);
                }
            })
            .catch(() => { /* personnel list optional */ });
    }, []);

    // When a mission is selected, fetch its detail and auto-populate form + pilots
    const handleMissionSelect = async (missionId: string) => {
        if (!missionId) {
            setSelectedMissionId('');
            setPilots([]);
            return;
        }
        setSelectedMissionId(missionId);
        try {
            // Use the standardized intelligence endpoint for rich data
            const res = await apiClient.get(`/v1/missions/${missionId}/intelligence`);
            const intel = res.data?.data;
            if (!intel) return;

            // Auto-populate form fields from intelligence data
            setForm(prev => ({
                ...prev,
                siteName:   intel.siteName   || intel.title || prev.siteName,
                siteId:     intel.siteId     || prev.siteId,
                clientName: intel.clientName || prev.clientName,
                inspectionDate: intel.scheduledDate ? intel.scheduledDate.slice(0, 10) : prev.inspectionDate,
                installedKw: intel.installedKw ? String(intel.installedKw) : prev.installedKw,
                panelCount: intel.panelCount ? String(intel.panelCount) : prev.panelCount,
                panelMake: intel.panelModel || prev.panelMake,
                flightAltitude: intel.altitude ? String(Math.round(intel.altitude * 3.28084)) : prev.flightAltitude,
                weatherConditions: intel.weather ? `Temp: ${intel.weather.temperature}°C, Wind: ${intel.weather.windSpeed} km/h` : prev.weatherConditions
            }));

            if (intel.altitude) setAltitudeDetected(true);

            // Populate pilots from the intelligence assignedPersonnel
            const personnel: any[] = intel.assignedPersonnel || [];
            const names = personnel
                .map((p: any) => p.fullName || p.name || p.email)
                .filter((n: string) => n && n.trim().length > 0);
            
            // Strictly show only assigned personnel for the selected mission
            setPilots(names);
            
            // If only one pilot assigned, auto-select them
            if (names.length === 1) setForm(prev => ({ ...prev, pilotName: names[0] }));
            else if (names.length === 0) setForm(prev => ({ ...prev, pilotName: '' }));
        } catch (err) {
            console.error('[SolarReportGenerator] handleMissionSelect failed', err);
        }
    };


    const f = (k: keyof SolarForm, v: string) => setForm(p => ({ ...p, [k]: v }));

    // ── Auto-fetch weather for a given date using browser geolocation ─────────
    const autoFetchWeather = useCallback(async (date: string) => {
        setWeatherLoading(true);
        try {
            const pos = await new Promise<GeolocationPosition>((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
            );
            const { latitude: lat, longitude: lon } = pos.coords;
            const today = new Date().toISOString().slice(0, 10);
            const isPast = date < today;
            // Use historical API for past dates, forecast for today/future
            const baseUrl = isPast
                ? 'https://archive-api.open-meteo.com/v1/archive'
                : 'https://api.open-meteo.com/v1/forecast';
            const url = new URL(baseUrl);
            url.searchParams.set('latitude', lat.toString());
            url.searchParams.set('longitude', lon.toString());
            url.searchParams.set('daily', 'weather_code,wind_speed_10m_max');
            url.searchParams.set('start_date', date);
            url.searchParams.set('end_date', date);
            url.searchParams.set('wind_speed_unit', 'mph');
            url.searchParams.set('timezone', 'auto');
            const res = await fetch(url.toString());
            const data = await res.json();
            if (data.daily?.weather_code?.[0] != null) {
                const code = data.daily.weather_code[0];
                const wind = data.daily.wind_speed_10m_max?.[0] ?? 0;
                f('weatherConditions', wmoToLabel(code, wind));
            }
        } catch {
            // geolocation denied or API failed — leave field as-is
        } finally {
            setWeatherLoading(false);
        }
    }, []);

    // ── Helper: Client-side Image Compression (max 1600px) ────────────────────
    const compressImage = (dataUrl: string, maxWidth = 1600, quality = 0.82): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > maxWidth || height > maxWidth) {
                    if (width > height) {
                        height = (height / width) * maxWidth;
                        width = maxWidth;
                    } else {
                        width = (width / height) * maxWidth;
                        height = maxWidth;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            // Error fallback: if image failing to load (unsupported format), return original
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
            // Timeout fallback: don't hang if image takes > 8s
            setTimeout(() => resolve(dataUrl), 8000);
        });
    };

    // Auto-trigger weather fetch when date changes
    const handleDateChange = (date: string) => {
        f('inspectionDate', date);
        if (date) autoFetchWeather(date);
    };

    const updateFinding = (id: string, updates: Partial<SolarFinding>) => {
        setFindings(prev => prev.map(fnd => fnd.id === id ? { ...fnd, ...updates } : fnd));
    };

    const handleImageDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        addImages(files);
    };

    const addImages = async (files: File[]) => {
        setIsProcessingMedia(true);
        try {
            setUploadedImages(prev => [...prev, ...files]);
            
            // Process and generate previews in parallel batches to be faster and show progress
            const newPreviews = await Promise.all(
                files.map(file => new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                }))
            );
            
            setImagePreviews(prev => [...prev, ...newPreviews]);

            // Extract Metadata In Parallel
            files.forEach(async (file, idx) => {
                const absoluteIdx = uploadedImages.length + idx;
                const coords = await readExifCoordinates(file);
                if (coords) {
                    setImageMetadata(prev => ({ ...prev, [absoluteIdx]: coords }));
                }
            });

            // Auto-populate flight altitude from EXIF if not already set
            if (!altitudeDetected) {
                for (const file of files) {
                    const alt = await readExifAltitude(file);
                    if (alt !== null && alt > 0 && alt < 1500) {
                        f('flightAltitude', String(alt));
                        setAltitudeDetected(true);
                        break;
                    }
                }
            }
        } catch (err) {
            console.error('[SolarReportGenerator] addImages error', err);
        } finally {
            setIsProcessingMedia(false);
        }
    };

    const removeImage = (i: number) => {
        setUploadedImages(p => p.filter((_, idx) => idx !== i));
        setImagePreviews(p => p.filter((_, idx) => idx !== i));
    };

    const runAnalysis = async () => {
        setAnalyzing(true);
        try {
            // Fix for 413 Payload Too Large:
            // 1. Calculate sampling rate if batch is huge (max 60 images for analysis)
            const MAX_ANALYSIS_IMAGES = 60;
            let sampledPreviews = [...imagePreviews];
            let sampledFiles = [...uploadedImages];
            
            if (imagePreviews.length > MAX_ANALYSIS_IMAGES) {
                const step = Math.ceil(imagePreviews.length / MAX_ANALYSIS_IMAGES);
                sampledPreviews = imagePreviews.filter((_, i) => i % step === 0).slice(0, MAX_ANALYSIS_IMAGES);
                sampledFiles = uploadedImages.filter((_, i) => i % step === 0).slice(0, MAX_ANALYSIS_IMAGES);
            }

            // 2. Apply more aggressive compression for large batches
            const isLargeBatch = sampledPreviews.length > 20;
            const maxWidth = isLargeBatch ? 800 : 1200; // Reduced from 1024/1600
            const quality = isLargeBatch ? 0.65 : 0.78; // Reduced from 0.75/0.82

            const compressed = await Promise.all(
                sampledPreviews.map(url => compressImage(url, maxWidth, quality))
            );

            const res = await apiClient.post('/ai/solar-analyze', {
                form,
                images: compressed.map((dataUrl, i) => ({
                    name: sampledFiles[i]?.name || `image-${i}`,
                    dataUrl,
                })),
                isSampled: imagePreviews.length !== sampledPreviews.length,
                totalImages: imagePreviews.length
            });

            if (res.data.success) {
                const aiFindings: SolarFinding[] = (res.data.findings || []).map((f: any, idx: number) => ({
                    id: f.id ?? String(idx + 1),
                    type: f.type ?? 'Unknown',
                    severity: f.severity ?? 'Medium',
                    location: f.location ?? '—',
                    panelId: f.panelId || undefined,
                    stringId: f.stringId || undefined,
                    temperature: f.temperature ?? undefined,
                    efficiency: f.efficiency ?? undefined,
                    description: f.description ?? '',
                    recommendation: f.recommendation ?? '',
                    estimatedKwhLoss: f.estimatedKwhLoss ?? 0,
                    estimatedCostMin: f.estimatedCostMin ?? 0,
                    estimatedCostMax: f.estimatedCostMax ?? 0,
                    imageIndex: f.imageIndex ?? (compressed.length > 0 ? 0 : undefined),
                }));
                setFindings(aiFindings);
                setAiSummary(res.data.aiSummary || `AI inspection of ${form.siteName || 'this solar site'} identified ${aiFindings.length} findings.`);
                setAnalysisComplete(true);
                setStep(3);

                // Auto-generate real report
                try {
                    const reportId = await exportSolarReportPDF({ 
                        form, 
                        findings: aiFindings, 
                        faults,
                        aiSummary: res.data.aiSummary || '', 
                        section, 
                        images: imagePreviews 
                    });
                    
                    if (reportId) {
                        const slug = (form.siteName || 'solar').replace(/[^a-z0-9]/gi, '-').toLowerCase();
                        setGeneratedReport({
                            id: reportId as string,
                            industry: 'solar',
                            title: form.siteName || 'Solar Inspection',
                            filename: `solar-report-${slug}.pdf`,
                            sizeBytes: 0, // estimate or fetch
                            createdAt: new Date().toISOString()
                        });
                        setIsViewingFull(true);
                    }
                } catch (e) {
                    console.error('Auto-report generation failed', e);
                }
            } else {
                throw new Error(res.data.message || 'AI analysis failed');
            }
        } catch (e: any) {
            console.error('AI analysis error:', e);
            alert(`AI analysis failed: ${e?.response?.data?.message || e?.message || 'Unknown error'}. Please try again.`);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const { exportSolarReportPDF } = await import('../components/exportSolarReportPDF');
            await exportSolarReportPDF({ form, findings, faults, aiSummary, section, images: imagePreviews });
        } catch (e) {
            console.error(e);
        } finally {
            setExporting(false);
        }
    };

    const handleSaveToMission = async () => {
        if (!missionId || findings.length === 0) return;
        setSavingToMission(true);
        try {
            const id = await saveReportToMission(
                missionId,
                {
                    industry: 'solar',
                    title: `Solar Inspection: ${form.siteName || initialSiteName || 'Plant'}`,
                    filename: `axis_solar_report_${Date.now()}.pdf`,
                    sizeBytes: 0,
                },
                {
                    form,
                    findings,
                    faults, // Include manual faults to persist them
                    aiSummary,
                    // Note: weatherData variable does not exist, passing form.weatherConditions instead. Wait, it used weatherData. I'll pass it if it existed, or remove it. Let me just add faults.
                    stats: {
                        criticals,
                        totalKwhLoss,
                        totalMin,
                        totalMax
                    }
                }
            );
            setSavedToMissionId(id);
        } catch (err) {
            console.error('[SolarReportGenerator] Save to mission failed:', err);
            alert('Failed to save report to mission archive. Please try again.');
        } finally {
            setSavingToMission(false);
        }
    };

    const totalKwhLoss = findings.reduce((s, f) => s + (Number(f.estimatedKwhLoss) || 0), 0);
    const totalMin = findings.reduce((s, f) => s + (Number(f.estimatedCostMin) || 0), 0);
    const totalMax = findings.reduce((s, f) => s + (Number(f.estimatedCostMax) || 0), 0);
    const criticals = findings.filter(f => f.severity === 'Critical').length;

    const sevColor = (s: string) => ({ Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a' }[s] || '#6b7280');
    const sevBg = (s: string) => ({ Critical: 'rgba(220,38,38,0.12)', High: 'rgba(234,88,12,0.12)', Medium: 'rgba(202,138,4,0.12)', Low: 'rgba(22,163,74,0.12)' }[s] || 'rgba(107,114,128,0.12)');

    return (
        <div className="min-h-[calc(100vh-120px)] bg-slate-950 text-white">
            {/* Full Report Viewer Overlay */}
            {isViewingFull && generatedReport && (
                <PDFViewer 
                    meta={generatedReport} 
                    onClose={() => setIsViewingFull(false)} 
                    onDownload={() => downloadReport(generatedReport)}
                />
            )}

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
                        <h2 className="text-lg font-black mb-4 text-white">Site & Inspection Details</h2>

                        {/* Mission Selector — auto-populates everything */}
                        <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                            <label className="block text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                                <Zap className="w-3 h-3" /> Link to Mission (auto-populates site + assigned pilots)
                            </label>
                            <select
                                value={selectedMissionId}
                                onChange={e => handleMissionSelect(e.target.value)}
                                className={inputCls}
                                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                            >
                                <option value="">Select a mission to auto-populate...</option>
                                {missions.map((m: any) => (
                                    <option key={m.id} value={m.id}>
                                        {m.mission_name || m.siteName || m.site_name || m.title || 'Unnamed Mission'} {m.date || m.scheduledDate ? `· ${(m.date || m.scheduledDate).slice(0, 10)}` : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedMissionId && pilots.length > 0 && (
                                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> {pilots.length} assigned pilot{pilots.length > 1 ? 's' : ''} loaded from mission
                                </p>
                            )}
                            {selectedMissionId && pilots.length === 0 && (
                                <p className="text-xs text-amber-500/70 mt-2">No pilots assigned to this mission — enter manually below</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {[
                                { label: 'Site Name', key: 'siteName', type: 'text', placeholder: 'e.g. Mojave Solar Farm — Block C' },
                                { label: 'Site / Asset ID', key: 'siteId', type: 'text', placeholder: 'e.g. SITE-0042' },
                                { label: 'Client / Portfolio', key: 'clientName', type: 'select', options: ['SunPeak Energy LLC', 'Nextera Energy', 'Duke Energy', 'Enel Green Power', 'Dominion Energy', 'Orsted'] },
                                { label: 'Installed Capacity (kW)', key: 'installedKw', type: 'text', placeholder: 'e.g. 2400' },
                                { label: 'Panel Count', key: 'panelCount', type: 'text', placeholder: 'e.g. 4800' },
                                { label: 'Panel Make & Model', key: 'panelMake', type: 'select', options: ['LONGi Hi-MO 6 500W', 'Canadian Solar 550W', 'Jinko Solar 400W', 'First Solar Series 6', 'Trina Solar Vertex 670W', 'SunPower Maxeon 400W', 'Other / Various'] },
                                { 
                                    label: 'Pilot / Technician', 
                                    key: 'pilotName', 
                                    type: 'select', 
                                    options: pilots 
                                },
                            ].map((field: any) => (
                                <div key={field.key}>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{field.label}</label>
                                    {field.type === 'select' ? (
                                        <select
                                            value={form[field.key as keyof SolarForm]}
                                            onChange={e => f(field.key as keyof SolarForm, e.target.value)}
                                            className={inputCls}
                                            style={{ ...inputStyle, appearance: 'auto', cursor: 'pointer' }}
                                        >
                                            <option value="">
                                                {field.options && field.options.length > 0 
                                                    ? (field.key === 'pilotName' ? 'Select assigned pilot...' : `Select ${field.label}...`)
                                                    : 'No assigned pilots available...'}
                                            </option>
                                            {field.options && field.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type={field.type}
                                            value={form[field.key as keyof SolarForm]}
                                            onChange={e => f(field.key as keyof SolarForm, e.target.value)}
                                            placeholder={field.placeholder}
                                            className={inputCls}
                                            style={inputStyle}
                                        />
                                    )}
                                </div>
                            ))}

                            {/* Inspection Date — triggers weather auto-fetch */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Inspection Date</label>
                                <input
                                    type="date"
                                    value={form.inspectionDate}
                                    onChange={e => handleDateChange(e.target.value)}
                                    className={inputCls}
                                    style={inputStyle}
                                />
                            </div>

                            {/* Flight Altitude — auto-filled from EXIF on image upload */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                                    Flight Altitude (ft)
                                    {altitudeDetected && <span className="text-emerald-400 text-xs font-bold normal-case flex items-center gap-1"><Sparkles className="w-3 h-3" /> EXIF detected</span>}
                                </label>
                                <input
                                    type="number"
                                    value={form.flightAltitude}
                                    onChange={e => { f('flightAltitude', e.target.value); setAltitudeDetected(false); }}
                                    placeholder="Upload imagery to auto-detect"
                                    className={inputCls}
                                    style={inputStyle}
                                />
                            </div>

                            {/* Weather Conditions — auto-fetched from Open-Meteo based on date */}
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                                    Weather Conditions
                                    {weatherLoading && <span className="text-amber-400 text-xs font-bold normal-case flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Fetching from Open-Meteo...</span>}
                                    {!weatherLoading && form.weatherConditions && <span className="text-emerald-400 text-xs font-bold normal-case flex items-center gap-1"><Sparkles className="w-3 h-3" /> Auto-populated</span>}
                                </label>
                                <input
                                    type="text"
                                    value={form.weatherConditions}
                                    onChange={e => f('weatherConditions', e.target.value)}
                                    placeholder="Select inspection date above to auto-populate"
                                    className={inputCls}
                                    style={inputStyle}
                                />
                            </div>
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
                        <p className="text-slate-400 text-sm mb-4">Upload thermal, RGB, or multispectral imagery for AI analysis</p>

                        {/* Navigation controls at the top for better UX */}
                        <div className="flex items-center gap-3 mb-6 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                            <button onClick={() => setStep(0)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all flex items-center gap-2">
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                            <button
                                onClick={() => setStep(2)}
                                disabled={imagePreviews.length === 0 || isProcessingMedia}
                                className="flex-1 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                            >
                                Next: Run AI Analysis <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Processing notification */}
                        {isProcessingMedia && (
                            <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 animate-pulse">
                                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Processing Imagery & Metadata...</span>
                            </div>
                        )}

                        <div
                            onDrop={handleImageDrop}
                            onDragOver={e => e.preventDefault()}
                            className="border-2 border-dashed border-slate-600 hover:border-amber-500/50 rounded-2xl p-10 text-center transition-all hover:bg-amber-500/5 mb-6"
                        >
                            <ThermometerSun className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                            <p className="text-white font-semibold mb-1">Drop images or folders here</p>
                            <p className="text-slate-400 text-sm mb-6">Supports RGB, thermal (.jpg, .png, .tiff)</p>
                            
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={() => fileRef.current?.click()}
                                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-slate-700/50"
                                >
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    Choose Files
                                </button>
                                <span className="text-slate-600 font-black uppercase text-[10px] tracking-widest">or</span>
                                <button
                                    onClick={() => folderRef.current?.click()}
                                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-slate-700/50"
                                >
                                    <FolderUp className="w-4 h-4 text-emerald-400" />
                                    Choose Folder
                                </button>
                            </div>

                            <input
                                ref={fileRef}
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={e => addImages(Array.from(e.target.files || []))}
                            />
                            <input
                                ref={folderRef}
                                type="file"
                                // @ts-ignore - webkitdirectory is non-standard but supported
                                webkitdirectory=""
                                directory=""
                                className="hidden"
                                onChange={e => addImages(Array.from(e.target.files || []))}
                            />
                        </div>

                        {imagePreviews.length > 0 && (
                            <div className="grid grid-cols-5 gap-2 mb-6">
                                {imagePreviews.map((src, i) => (
                                    <div key={i} className="relative group cursor-pointer" onClick={() => setSelectedImageForFault({ id: `img-${i}`, url: src, latitude: imageMetadata[i]?.lat, longitude: imageMetadata[i]?.lng })}>
                                        <img src={src} alt="" className="w-full aspect-square object-cover rounded-xl border border-slate-700 hover:border-blue-500 transition-all" />
                                        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 rounded-xl flex items-center justify-center transition-all">
                                            <Edit3 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100" />
                                        </div>
                                        {faults.some(f => f.imageId === `img-${i}`) && (
                                            <div className="absolute top-1 left-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center animate-in zoom-in">
                                                <AlertTriangle className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3 text-white" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <FaultTaggingModal 
                            isOpen={!!selectedImageForFault}
                            onClose={() => setSelectedImageForFault(null)}
                            image={selectedImageForFault || { id: '', url: '' }}
                            onSaveFault={(f) => {
                                setFaults(prev => [...prev, f]);
                                setSelectedImageForFault(null);
                            }}
                            existingFaults={faults.filter(f => f.imageId === selectedImageForFault?.id)}
                        />

                        {imagePreviews.length > 0 && (
                            <div className="flex items-center justify-between mb-2 px-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selected Assets ({imagePreviews.length})</span>
                                <button onClick={() => { setUploadedImages([]); setImagePreviews([]); }} className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-300">Clear All</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 2: AI Analysis ── */}
                {step === 2 && (
                    <div className="max-w-3xl text-center py-12 px-6">
                        {analyzing ? (
                            <div className="relative isolate">
                                <div className="absolute inset-0 bg-amber-500/10 blur-[100px] -z-10 rounded-full" />
                                <div className="relative w-32 h-32 mx-auto mb-8 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.2)] animate-pulse" />
                                    <div className="absolute inset-4 rounded-full border-t-2 border-amber-400 border-r-2 border-transparent animate-spin duration-1000" />
                                    <div className="absolute inset-8 rounded-full border-b-2 border-orange-500 border-l-2 border-transparent animate-[spin_1.5s_linear_reverse]" />
                                    <Zap className="w-8 h-8 text-amber-400 animate-pulse" />
                                </div>
                                <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Neural Analysis Running...</h2>
                                <p className="text-amber-500/80 font-mono text-sm tracking-widest uppercase mb-8 animate-pulse">
                                    Processing {uploadedImages.length || 0} Radiometric Datasets
                                </p>
                                
                                {/* Mock scan feed */}
                                <div className="max-w-md mx-auto text-left bg-slate-950/80 border border-slate-800/80 rounded-xl p-5 shadow-inner backdrop-blur-sm overflow-hidden relative">
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent animate-[shimmer_2s_infinite]" />
                                    <div className="space-y-3 font-mono text-[10px] text-slate-400 uppercase">
                                        <div className="flex justify-between items-center"><span className="text-amber-500">_sys.ingest:</span> <span>Aligning geospatial coordinates...</span></div>
                                        <div className="flex justify-between items-center"><span className="text-amber-500">_vision.ai:</span> <span>Isolating irradiance values...</span></div>
                                        <div className="flex justify-between items-center"><span className="text-amber-500">_diag.net:</span> <span className="text-white animate-pulse">Scanning for thermal anomalies...</span></div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[#0B1121] border border-slate-800/80 rounded-3xl p-10 shadow-2xl relative overflow-hidden isolate max-w-2xl mx-auto">
                                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-30" />
                                <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/5 border border-amber-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                                    <Sun className="w-12 h-12 text-amber-400" />
                                </div>
                                <h2 className="text-2xl font-black text-white mb-3 tracking-tight drop-shadow-md">Awaiting Neural Pipeline</h2>
                                <p className="text-slate-400 mb-6 font-medium text-[15px]">
                                    {uploadedImages.length > 0
                                        ? `${uploadedImages.length} dataset${uploadedImages.length !== 1 ? 's' : ''} successfully queued in the ingestion buffer.`
                                        : 'No raw datasets provided. System will default to a structural template generation.'}
                                </p>
                                <div className="bg-slate-900/50 rounded-xl p-4 mb-10 text-left border border-slate-800/50">
                                    <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Cpu className="w-3.5 h-3.5" /> Pipeline Objectives
                                    </p>
                                    <p className="text-slate-500 text-[13px] leading-relaxed font-medium">
                                        The convolutional neural network will immediately scan for sub-module defects, diode failures, severe soiling, micro-cracks, and aggregate estimated kWh loss and financial impact.
                                    </p>
                                </div>
                                <div className="flex gap-4 justify-center">
                                    <button onClick={() => setStep(1)} className="px-6 py-3.5 bg-[#111827] hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm">
                                        <ChevronLeft className="w-4 h-4" /> Go Back
                                    </button>
                                    <button
                                        onClick={runAnalysis}
                                        className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black rounded-xl transition-all flex items-center gap-2 text-[15px] shadow-[0_10px_20px_rgba(245,158,11,0.3)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.4)] hover:-translate-y-0.5 border border-white/10"
                                    >
                                        <Zap className="w-5 h-5" /> Execute AI Pipeline
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 3: Review & Export ── */}
                {step === 3 && (
                    <div className="max-w-4xl pb-16">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-black text-white">Inspection Results — {form.siteName}</h2>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                                        isEditing 
                                            ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/20' 
                                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                    }`}
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    {isEditing ? 'Finish Editing' : 'Edit Findings'}
                                </button>
                                
                                <button
                                    onClick={() => {
                                        const mockMeta = {
                                            id: `PREVIEW-${Date.now()}`,
                                            industry: 'solar',
                                            title: form.siteName || 'Solar Inspection Preview',
                                            filename: 'preview.pdf',
                                            createdAt: new Date().toISOString(),
                                            data: { form, findings, aiSummary }
                                        };
                                        setGeneratedReport(mockMeta as any);
                                        setIsViewingFull(true);
                                    }}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold rounded-xl border border-indigo-500/20 transition-all"
                                >
                                    <Eye className="w-4 h-4" />
                                    View Full Report
                                </button>

                                {generatedReport && generatedReport.id.indexOf('PREVIEW') === -1 && (
                                    <button
                                        onClick={() => setIsViewingFull(true)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 font-bold rounded-xl border border-indigo-500/30 transition-all"
                                    >
                                        <Eye className="w-4 h-4" />
                                        View Full Report
                                    </button>
                                )}
                                <button
                                    onClick={handleExport}
                                    disabled={exporting}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all"
                                >
                                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    Download PDF
                                </button>

                                {missionId && (
                                    <button
                                        onClick={handleSaveToMission}
                                        disabled={savingToMission || !!savedToMissionId || findings.length === 0}
                                        className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl border transition-all ${
                                            savedToMissionId 
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-lg shadow-indigo-500/20'
                                        }`}
                                    >
                                        {savingToMission ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : savedToMissionId ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : (
                                            <Sparkles className="w-4 h-4" />
                                        )}
                                        {savedToMissionId ? 'Archived in Mission' : 'Save to Mission Archive'}
                                    </button>
                                )}

                                {onShowArchive && (
                                    <button
                                        onClick={() => onShowArchive(form.siteName || initialSiteName)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700/50 transition-all"
                                    >
                                        <History size={16} className="text-indigo-400" />
                                        View Mission History
                                    </button>
                                )}
                            </div>
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
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Sparkles className="w-3 h-3 text-amber-500/50" />
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI Generated</span>
                            </div>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">AI Intelligence Summary</p>
                            
                            {isEditing ? (
                                <textarea
                                    value={aiSummary}
                                    onChange={e => setAiSummary(e.target.value)}
                                    rows={8}
                                    className="w-full bg-slate-950/50 text-sm text-slate-300 leading-relaxed focus:outline-none resize-none scrollbar-hide border border-slate-800 rounded-xl p-4 transition-all"
                                    placeholder="Refine the AI technical synthesis..."
                                />
                            ) : (
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                    {aiSummary || 'Analysis complete. The AI model is still synthesizing the tactical summary...'}
                                </p>
                            )}
                        </div>

                        {/* Metadata Review */}
                        <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-5 mb-6 shadow-xl">
                            <div className="flex items-center gap-2 mb-4">
                                <Settings className="w-4 h-4 text-emerald-400" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Site Metadata Overview</h3>
                            </div>
                            <div className="grid grid-cols-4 gap-6">
                                <div><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Company</p><p className="text-sm text-white font-bold">{form.clientName || '—'}</p></div>
                                <div><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Asset ID</p><p className="text-sm text-white font-mono">{form.siteId || '—'}</p></div>
                                <div><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Capacity</p><p className="text-sm text-white font-bold">{form.installedKw ? `${form.installedKw} kW` : '—'}</p></div>
                                <div><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Panel Model</p><p className="text-sm text-white font-medium">{form.panelMake || '—'}</p></div>
                                <div><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Date</p><p className="text-sm text-white font-bold">{form.inspectionDate || '—'}</p></div>
                                <div><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Pilot</p><p className="text-sm text-white font-bold">{form.pilotName || '—'}</p></div>
                                <div><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Altitude</p><p className="text-sm text-white font-bold">{form.flightAltitude ? `${form.flightAltitude} ft` : '—'}</p></div>
                                <div><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Weather</p><p className="text-sm text-white font-medium">{form.weatherConditions || '—'}</p></div>
                            </div>
                        </div>

                        {/* Findings list */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    {isEditing ? 'Defect Registry (Interactive Edit)' : 'Detected Anomalies & Findings'}
                                </p>
                                {isEditing && (
                                    <button 
                                        onClick={() => setFindings([...findings, { id: Date.now().toString(), type: 'New Finding', severity: 'Medium', location: 'TBD', description: '', recommendation: '' }])}
                                        className="text-[10px] font-bold text-amber-500 hover:text-amber-400 uppercase flex items-center gap-1"
                                    >
                                        + Add Manual Finding
                                    </button>
                                )}
                            </div>

                            {findings.length === 0 && (
                                <div className="py-12 text-center bg-slate-900/40 border border-slate-800 border-dashed rounded-2xl">
                                    <p className="text-slate-500 text-sm">No specific defects identified in this analysis.</p>
                                </div>
                            )}

                            {findings.map((fnd, i) => (
                                <div
                                    key={fnd.id}
                                    className={`transition-all rounded-2xl p-5 ${
                                        isEditing 
                                            ? 'bg-slate-800/40 border border-amber-500/20 shadow-lg shadow-amber-500/5' 
                                            : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
                                    }`}
                                    style={{ borderLeft: `4px solid ${sevColor(fnd.severity)}` }}
                                >
                                    {isEditing ? (
                                        // ── EDITABLE FINDING ──
                                        <div>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1 flex items-center gap-3">
                                                    <span className="text-[11px] font-black text-slate-600 font-mono">#{String(i + 1).padStart(2, '0')}</span>
                                                    <input
                                                        value={fnd.type}
                                                        onChange={e => updateFinding(fnd.id, { type: e.target.value })}
                                                        className="bg-transparent border-none text-md font-black text-white p-0 focus:ring-0 w-full"
                                                        placeholder="Finding Title"
                                                    />
                                                    <select
                                                        value={fnd.severity}
                                                        onChange={e => updateFinding(fnd.id, { severity: e.target.value as any })}
                                                        className="text-[10px] font-black px-2 py-1 rounded bg-slate-950 border border-slate-800 text-white cursor-pointer uppercase tracking-wider"
                                                        style={{ color: sevColor(fnd.severity) }}
                                                    >
                                                        {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <input
                                                            type="number"
                                                            value={fnd.estimatedCostMin || ''}
                                                            onChange={e => updateFinding(fnd.id, { estimatedCostMin: Number(e.target.value) || 0 })}
                                                            className="bg-transparent border-none text-sm font-black text-emerald-400 p-0 focus:ring-0 text-right w-20"
                                                            placeholder="$Min"
                                                        />
                                                        <p className="text-[9px] text-slate-600 font-bold uppercase">Rep. Cost Min</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <input
                                                            type="number"
                                                            value={fnd.estimatedCostMax || ''}
                                                            onChange={e => updateFinding(fnd.id, { estimatedCostMax: Number(e.target.value) || 0 })}
                                                            className="bg-transparent border-none text-sm font-black text-emerald-500 p-0 focus:ring-0 text-right w-24"
                                                            placeholder="$Max"
                                                        />
                                                        <p className="text-[9px] text-slate-600 font-bold uppercase">Rep. Cost Max</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => setFindings(p => p.filter(f => f.id !== fnd.id))}
                                                        className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-5 gap-4 mb-4 bg-slate-950/30 rounded-xl p-3 border border-slate-800/50">
                                                <div className="col-span-2">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-wider">Location / POI</p>
                                                    <input
                                                        value={fnd.location}
                                                        onChange={e => updateFinding(fnd.id, { location: e.target.value })}
                                                        className="w-full bg-transparent border-none text-[11px] text-white p-0 focus:ring-0 font-medium"
                                                        placeholder="e.g. Inverter 4, String 12"
                                                    />
                                                </div>
                                                {fnd.temperature !== undefined && (
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-wider">Temp Delta</p>
                                                        <input
                                                            type="number"
                                                            value={fnd.temperature || ''}
                                                            onChange={e => updateFinding(fnd.id, { temperature: Number(e.target.value) || 0 })}
                                                            className="w-full bg-transparent border-none text-[11px] text-red-400 p-0 focus:ring-0 font-bold"
                                                        />
                                                    </div>
                                                )}
                                                {fnd.estimatedKwhLoss !== undefined && (
                                                    <div className="col-span-2">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-wider">kWh/yr Loss</p>
                                                        <input
                                                            type="number"
                                                            value={fnd.estimatedKwhLoss || ''}
                                                            onChange={e => updateFinding(fnd.id, { estimatedKwhLoss: Number(e.target.value) || 0 })}
                                                            className="w-full bg-transparent border-none text-[11px] text-amber-500 p-0 focus:ring-0 font-bold"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Observations</label>
                                                    <textarea
                                                        value={fnd.description}
                                                        onChange={e => updateFinding(fnd.id, { description: e.target.value })}
                                                        className="w-full bg-slate-950/40 border border-slate-800/50 text-[13px] text-slate-100 p-3 rounded-xl focus:ring-1 focus:ring-amber-500/30 resize-none h-20"
                                                    />
                                                </div>
                                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                                                    <label className="text-[9px] font-black text-amber-500 uppercase block mb-1 tracking-widest">Mitigation Strategy</label>
                                                    <input
                                                        value={fnd.recommendation}
                                                        onChange={e => updateFinding(fnd.id, { recommendation: e.target.value })}
                                                        className="w-full bg-transparent border-none text-[12px] text-white p-0 focus:ring-0 font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // ── STATIC DASHBOARD FINDING ──
                                        <div>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-slate-600 font-mono">#{String(i + 1).padStart(2, '0')}</span>
                                                    <h3 className="text-sm font-bold text-white tracking-tight">{fnd.type}</h3>
                                                    <span
                                                        className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                                                        style={{ background: sevBg(fnd.severity), color: sevColor(fnd.severity) }}
                                                    >
                                                        {fnd.severity}
                                                    </span>
                                                </div>
                                                {(fnd.estimatedCostMin || 0) > 0 && (
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-white">
                                                            ${fnd.estimatedCostMin?.toLocaleString()}
                                                            {fnd.estimatedCostMax ? ` – $${fnd.estimatedCostMax.toLocaleString()}` : ''}
                                                        </p>
                                                        <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Est. Remediation</p>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="grid grid-cols-4 gap-4 mb-4 py-2 border-y border-slate-800/50">
                                                <div className="flex items-center gap-2">
                                                     <MapPin size={10} className="text-slate-600" />
                                                     <span className="text-[11px] text-slate-400 font-medium truncate">{fnd.location}</span>
                                                </div>
                                                {fnd.temperature && (
                                                    <div className="flex items-center gap-2">
                                                        <Thermometer size={10} className="text-red-400" />
                                                        <span className="text-[11px] text-red-400 font-bold">{fnd.temperature}°C Δ</span>
                                                    </div>
                                                )}
                                                {fnd.estimatedKwhLoss && (
                                                    <div className="flex items-center gap-2">
                                                        <Zap size={10} className="text-amber-500" />
                                                        <span className="text-[11px] text-amber-500 font-bold">{fnd.estimatedKwhLoss.toLocaleString()} kWh/y</span>
                                                    </div>
                                                )}
                                                {fnd.panelId && (
                                                    <div className="flex items-center gap-2">
                                                        <Cpu size={10} className="text-slate-600" />
                                                        <span className="text-[11px] text-slate-500">{fnd.panelId}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <p className="text-sm text-slate-400 leading-relaxed mb-3">{fnd.description}</p>
                                            
                                            <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
                                                <Sparkles size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                                <p className="text-xs text-slate-300">
                                                    <span className="font-black text-amber-500 uppercase text-[9px] tracking-widest mr-2">Recommendation</span>
                                                    {fnd.recommendation}
                                                </p>
                                            </div>
                                        </div>
                                    )}
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
