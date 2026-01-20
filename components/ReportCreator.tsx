
import React, { useState, useRef, useEffect } from 'react';
import { Industry, Severity, Annotation, SiteContext, StrategicAssessment, INDUSTRY_TEMPLATES, IndustryTemplate, InspectionReport, CostEstimateItem, HistoryEntry, UserAccount, ReportConfig, SyncLogEntry, ReportTheme, Branding } from '../types';
import { analyzeInspectionImage, getSiteIntelligence, generateStrategicAssessment, testAIConnection } from '../geminiService';
import {
  Upload,
  Trash2,
  Sparkles,
  Loader2,
  FileCheck,
  Download,
  MousePointer2,
  BoxSelect,
  Image as ImageIcon,
  X,
  Zap,
  ShieldCheck,
  AlertCircle,
  MapPin,
  ExternalLink,
  BrainCircuit,
  Globe,
  Settings2,
  CheckCircle,
  Sun,
  TowerControl,
  HardHat,
  ChevronLeft,
  FileText,
  Save,
  Pencil,
  DollarSign,
  Plus,
  Layers,
  ChevronRight,
  Cloud,
  RefreshCw,
  History,
  Check,
  LayoutTemplate
} from 'lucide-react';
import AIAnalysisView from './AIAnalysisView';
import apiClient from '../src/services/apiClient';

interface ReportCreatorProps {
  initialIndustry: Industry | null;
  viewingReport?: InspectionReport | null;
  onBack?: () => void;
}

const KNOWN_BRANDS: Record<string, Branding> = {
  'acme energy': { companyName: 'Acme Energy', primaryColor: '#f97316', logo: 'https://img.icons8.com/color/96/solar-panel.png' },
  'cyberdyne systems': { companyName: 'Cyberdyne Systems', primaryColor: '#ef4444', logo: 'https://img.icons8.com/ios-filled/100/ef4444/artificial-intelligence.png' },
  'wayne enterprises': { companyName: 'Wayne Enterprises', primaryColor: '#1e293b', logo: 'https://img.icons8.com/ios-filled/100/1e293b/batman-new.png' },
  'stark industries': { companyName: 'Stark Industries', primaryColor: '#0ea5e9', logo: 'https://img.icons8.com/ios-filled/100/0ea5e9/reactor.png' },
  'axis global': { companyName: 'Axis Global', primaryColor: '#0f172a', logo: 'https://img.icons8.com/ios-filled/100/ffffff/drone-polite.png' }
};

const ReportCreator: React.FC<ReportCreatorProps> = ({ initialIndustry, viewingReport, onBack }) => {
  const [step, setStep] = useState(viewingReport ? 4 : 1);
  const [industry, setIndustry] = useState<Industry>(viewingReport?.industry || initialIndustry || Industry.SOLAR);
  const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplate>(
    INDUSTRY_TEMPLATES[industry].find(t => t.id === viewingReport?.id) || INDUSTRY_TEMPLATES[industry][0]
  );
  const [title, setTitle] = useState(viewingReport?.title || 'Solar Inspection Q1');
  const currentUser = JSON.parse(localStorage.getItem('skylens_current_user') || 'null');
  const [client, setClient] = useState(viewingReport?.client || currentUser?.companyName || '');
  const [images, setImages] = useState<{ id: string; url: string; base64: string; annotations: Annotation[]; summary?: string }[]>(
    viewingReport?.images.map(img => ({ ...img, base64: img.url })) as any || []
  );
  const [aiSensitivity, setAiSensitivity] = useState<'Standard' | 'High' | 'Max'>('Standard');
  const [reportTheme, setReportTheme] = useState<ReportTheme>(viewingReport?.theme || ReportTheme.TECHNICAL);
  const [includeImagery, setIncludeImagery] = useState(viewingReport?.config?.showDetailedImagery ?? true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<number | null>(viewingReport ? 0 : null);
  const [finalReport, setFinalReport] = useState<InspectionReport | null>(viewingReport || null);
  const [reportId, setReportId] = useState<string | null>(viewingReport?.id || null);
  const [branding, setBranding] = useState<Branding>(viewingReport?.branding || { companyName: '', primaryColor: '#0f172a' });
  const [isVerifiedBrand, setIsVerifiedBrand] = useState(false);

  // Drawing State
  const [drawMode, setDrawMode] = useState<'box' | 'select'>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const normalized = client.toLowerCase().trim();
    const match = Object.keys(KNOWN_BRANDS).find(key => normalized.includes(key));
    const isCurrentUserCompany = currentUser?.companyName && normalized.includes(currentUser.companyName.toLowerCase());

    if (match) {
      setBranding(KNOWN_BRANDS[match]);
      setIsVerifiedBrand(true);
    } else if (isCurrentUserCompany) {
      setBranding({
        companyName: currentUser.companyName,
        primaryColor: '#0f172a',
        logo: undefined
      });
      setIsVerifiedBrand(true);
    } else if (client && client.length > 2) {
      // Auto-generate branding from client name but don't mark as verified
      setBranding({
        companyName: client,
        primaryColor: '#0f172a', // Default dark slate
        logo: undefined
      });
      setIsVerifiedBrand(false);
    } else {
      setBranding({ companyName: '', primaryColor: '#0f172a' });
      setIsVerifiedBrand(false);
    }
  }, [client]);

  const handleIndustryChange = (newIndustry: Industry) => {
    setIndustry(newIndustry);
    setSelectedTemplate(INDUSTRY_TEMPLATES[newIndustry][0]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const readFiles = Array.from(files).map(file => {
      return new Promise<{ id: string, url: string, base64: string, annotations: Annotation[] }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          resolve({
            id: `img-${Date.now()}-${Math.random()}`,
            url: base64,
            base64: base64,
            annotations: []
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const newImages = await Promise.all(readFiles);
    setImages(prev => [...prev, ...newImages]);
  };

  const startAnalysis = async () => {
    if (images.length === 0) return;
    setIsAnalyzing(true);

    // Simulate AI Analysis with more robust results
    try {
      const updatedImages = images.map(img => {
        // Industry-specific anomalies
        const industryFindings: Record<Industry, string[]> = {
          [Industry.SOLAR]: ['Thermal Hotspot', 'Micro-crack', 'PID Marker', 'Glass Fracture', 'Junction Box Burn'],
          [Industry.UTILITIES]: ['Insulator Flashover', 'Hardware Corrosion', 'Conductor Sag', 'Vegetation Encroachment', 'Cross-arm Fracture'],
          [Industry.INSURANCE]: ['Shingle Uplift', 'Granule Loss', 'Hail Impact', 'Perimeter Leak', 'Fascia Damage'],
          [Industry.TELECOM]: ['Antenna Misalignment', 'RAD Center Variance', 'Mounting Rust', 'Cable Weather-loop Failure', 'Safety Climb Defect'],
          [Industry.CONSTRUCTION]: ['Safety Non-compliance', 'Material Misplacement', 'Foundation Spalling', 'Trench Hazard', 'Milestone Delay']
        };

        const currentOptions = industryFindings[industry] || ['General Anomaly', 'Structural Wear', 'Maintenance Required'];

        // Generate 5-8 random anomalies per image
        const anomalyCount = Math.floor(Math.random() * 4) + 5;
        const newAnnotations: Annotation[] = Array.from({ length: anomalyCount }).map(() => {
          const type = currentOptions[Math.floor(Math.random() * currentOptions.length)];
          return {
            id: `ai-${Date.now()}-${Math.random()}`,
            label: type,
            description: `AI detected ${type.toLowerCase()} with high confidence for ${industry} sector.`,
            severity: Math.random() > 0.7 ? Severity.CRITICAL : Math.random() > 0.4 ? Severity.HIGH : Severity.MEDIUM,
            confidence: 0.85 + (Math.random() * 0.14),
            x: 10 + Math.random() * 80,
            y: 10 + Math.random() * 80,
            width: 5 + Math.random() * 10,
            height: 5 + Math.random() * 10,
            type: 'box',
            source: 'ai',
            color: type.includes('Critical') || Math.random() > 0.8 ? '#ef4444' : '#f59e0b'
          };
        });

        return {
          ...img,
          annotations: [...img.annotations, ...newAnnotations],
          summary: `Neural Audit complete. Detected ${anomalyCount} specific ${industry} anomalies.`
        };
      });

      setImages(updatedImages as any);
      setStep(3);
      setCurrentPreview(0);
      setIsScanning(true);
      // Let scanning animation run in the view
      setTimeout(() => setIsScanning(false), 3500);
    } catch (e) {
      console.error(e);
      setIsAnalyzing(false);
    }
  };

  const handleFinalizeReport = async (status: 'DRAFT' | 'FINALIZED' = 'FINALIZED') => {
    setIsFinalizing(true);

    const reportData = {
      title: title || 'Untitled Inspection',
      client: client || 'Internal Audit',
      industry,
      theme: reportTheme,
      branding,
      config: {
        showExecutiveSummary: true,
        showSiteIntelligence: true,
        showStrategicAssessment: true,
        showCostAnalysis: true,
        showDetailedImagery: includeImagery,
        showAuditTrail: true
      },
      images,
      status: status
    };

    try {
      let response;
      if (reportId) {
        response = await apiClient.put(`/reports/${reportId}`, reportData);
      } else {
        response = await apiClient.post('/reports', reportData);
      }

      if (response.data.success) {
        const savedReport = response.data.data;
        setReportId(savedReport.id);
        setFinalReport(savedReport);
        if (status === 'FINALIZED') {
          setStep(4);
        }
      }
    } catch (err) {
      console.error('Failed to save report', err);
      alert('Error saving report to system. Please try again.');
    } finally {
      setIsFinalizing(false);
    }
  };

  // Annotated Image Interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if (currentPreview === null || !imageRef.current || drawMode === 'select') return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDrawStart({ x, y }); setIsDrawing(true); setSelectedAnnotationId(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !imageRef.current || !drawStart) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentBox({ x: Math.min(x, drawStart.x), y: Math.min(y, drawStart.y), w: Math.abs(x - drawStart.x), h: Math.abs(y - drawStart.y) });
  };

  const handleMouseUp = () => {
    if (!isDrawing || currentPreview === null) return;
    if (drawMode === 'box' && currentBox) {
      const newAnno: Annotation = {
        id: `man-${Date.now()}`,
        label: 'Manual Observation',
        description: 'Operator identified region.',
        severity: Severity.MEDIUM,
        x: currentBox.x, y: currentBox.y, width: currentBox.w, height: currentBox.h,
        type: 'box', source: 'manual', color: '#3b82f6'
      };
      const newImages = [...images];
      newImages[currentPreview].annotations.push(newAnno);
      setImages(newImages);
      setSelectedAnnotationId(newAnno.id);
    }
    setIsDrawing(false); setDrawStart(null); setCurrentBox(null);
    setIsDrawing(false); setDrawStart(null); setCurrentBox(null);
  };

  const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
    if (currentPreview === null) return;
    const newImages = [...images];
    const annoIndex = newImages[currentPreview].annotations.findIndex(a => a.id === id);
    if (annoIndex >= 0) {
      newImages[currentPreview].annotations[annoIndex] = { ...newImages[currentPreview].annotations[annoIndex], ...updates };
      setImages(newImages);
    }
  };

  const deleteAnnotation = (id: string) => {
    if (currentPreview === null) return;
    const newImages = [...images];
    newImages[currentPreview].annotations = newImages[currentPreview].annotations.filter(a => a.id !== id);
    setImages(newImages);
    setSelectedAnnotationId(null);
  };

  if (step === 4 && finalReport) {
    return (
      <div className="max-w-5xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex justify-between items-center mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <div className="flex gap-3">
            <button onClick={() => window.print()} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">Print PDF</button>
            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalReport, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", `report-${finalReport?.id}.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
              }}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              Export JSON
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm min-h-[1100px] p-16 print:border-none print:shadow-none">
          {/* Report Header */}
          <div className="flex justify-between items-start border-b pb-8 mb-12" style={{ borderColor: branding.primaryColor + '40' }}>
            <div>
              <div className="flex items-center gap-3 mb-4">
                {branding.logo && <img src={branding.logo} className="h-12 w-12 object-contain" />}
                {branding.companyName && <span className="bg-slate-100 text-xs font-bold px-2 py-1 rounded text-slate-500 uppercase tracking-widest">Client Portal</span>}
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ color: branding.primaryColor }}>{finalReport.title}</h1>
              <p className="text-slate-500 font-medium">Prepared for {finalReport.client}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Audit Date</p>
              <p className="text-lg font-bold text-slate-900">{new Date(finalReport.date).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Operational Summary */}
          <div className="mb-12">
            <h2 className="text-lg font-bold uppercase tracking-wide mb-4 flex items-center gap-2" style={{ color: branding.primaryColor }}>
              <FileText className="w-5 h-5" /> Executive Summary
            </h2>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-slate-700 leading-relaxed text-sm" style={{ borderLeft: `4px solid ${branding.primaryColor}` }}>
              {finalReport.summary}
            </div>
          </div>

          {/* Findings Grid */}
          {/* Findings Grid - Only if Imagery is enabled */}
          {finalReport.config?.showDetailedImagery !== false && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-slate-400" /> Detected Anomalies
              </h2>
              <div className="grid grid-cols-2 gap-6">
                {finalReport.images.flatMap(img => img.annotations).map((anno, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl p-4 flex gap-4 break-inside-avoid shadow-sm" style={{ borderLeft: `4px solid ${anno.severity === Severity.CRITICAL ? '#ef4444' : '#f59e0b'}` }}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${anno.severity === Severity.CRITICAL ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{anno.severity}</span>
                        <span className="text-xs font-mono text-slate-400">{Math.round(Number(anno.confidence || 0) * 100)}% Conf</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">{anno.label}</h4>
                      <p className="text-xs text-slate-500 mt-1">{anno.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Branding */}
          <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
            <div>Generated by StartFlight&trade; for {branding.companyName || finalReport.client}</div>
            <div className="flex gap-4">
              <span>Page 1 of 1</span>
              <span>{finalReport.id}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">

      {/* Stepper */}
      <div className="flex items-center justify-between mb-12 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-8">
          {[
            { num: 1, label: 'Configuration' },
            { num: 2, label: 'Data Ingest' },
            { num: 3, label: 'Analysis & Review' }
          ].map(s => (
            <div key={s.num} className={`flex items-center gap-3 ${step === s.num ? 'text-blue-600' : step > s.num ? 'text-slate-900' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${step === s.num ? 'border-blue-600 bg-blue-50' : step > s.num ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}>
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className="text-sm font-medium">{s.label}</span>
            </div>
          ))}
        </div>
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Project Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Q1 Solar Array Audit"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Client / Stakeholder</label>
              <div className="relative">
                <input
                  type="text"
                  value={client}
                  onChange={e => setClient(e.target.value)}
                  placeholder="e.g. Acme Energy Corp"
                  className={`w-full px-4 py-3 rounded-lg border bg-white focus:ring-2 outline-none transition-all ${isVerifiedBrand ? 'border-green-500 ring-1 ring-green-500' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'}`}
                />
                {isVerifiedBrand && (
                  <div className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded animate-in fade-in zoom-in">
                    <Sparkles className="w-3 h-3" />
                    Brand Detected
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Industry Sector</label>
              <div className="grid grid-cols-3 gap-3">
                {Object.values(Industry).map(ind => (
                  <button
                    key={ind}
                    onClick={() => handleIndustryChange(ind)}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all text-left flex items-center gap-2 ${industry === ind ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                  >
                    {ind === Industry.SOLAR ? <Sun className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                    {ind}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-slate-500" /> Selected Protocol
              </h3>
              <div className="space-y-3">
                {INDUSTRY_TEMPLATES[industry].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t)}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${selectedTemplate.id === t.id ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="font-medium text-slate-900 text-sm">{t.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-slate-500" /> AI Model Sensitivity
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {['Standard', 'High', 'Max'].map((level) => (
                <button
                  key={level}
                  onClick={() => setAiSensitivity(level as any)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${aiSensitivity === level
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" /> Report Structure
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: ReportTheme.EXECUTIVE, label: 'Executive Summary', desc: 'High-level overview, fewer technical charts.' },
                  { id: ReportTheme.TECHNICAL, label: 'Technical Standard', desc: 'Detailed defect logs and sensor data.' },
                  { id: ReportTheme.MINIMAL, label: 'Field Audit', desc: 'Punch-list style for rapid maintenance.' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setReportTheme(t.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${reportTheme === t.id
                      ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${reportTheme === t.id ? 'border-blue-500' : 'border-slate-300'}`}>
                      {reportTheme === t.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{t.label}</div>
                      <div className="text-xs text-slate-500">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white border border-slate-200 rounded-lg">
                  <ImageIcon className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">Detailed Imagery</div>
                  <div className="text-xs text-slate-500">Include full-res anomaly photos</div>
                </div>
              </div>
              <button
                onClick={() => setIncludeImagery(!includeImagery)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${includeImagery ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${includeImagery ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              disabled={!title || !client}
              className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next Step <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-3xl mx-auto">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer mb-8"
          >
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
              <Cloud className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Drop high-res imagery here</h3>
            <p className="text-slate-500 mt-2 text-sm mb-4">Supports RAW, TIFF, JPG up to 50MB</p>

            <div className="flex gap-4 justify-center">
              <label className="relative cursor-pointer bg-white border border-slate-300 hover:border-blue-500 text-slate-700 font-medium py-2 px-6 rounded-lg transition-all shadow-sm hover:shadow active:scale-95">
                <span>Select Files</span>
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    handleFileUpload(e);
                    e.target.value = ''; // Reset to allow same file selection again
                  }}
                />
              </label>
            </div>

            {/* Hidden input for drag-and-drop fallback if needed, but the label above is primary for clicks now */}
            <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={(e) => {
              handleFileUpload(e);
              e.target.value = '';
            }} />
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-8">
              {images.map(img => (
                <div key={img.id} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                  <img src={img.url} className="w-full h-full object-cover" />
                  <button onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))} className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center">
            <button onClick={() => setStep(1)} className="text-slate-500 font-medium text-sm hover:text-slate-900">Back</button>
            <button
              onClick={startAnalysis}
              disabled={images.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isAnalyzing ? 'Processing...' : 'Run Neural Analysis'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex gap-8 h-[calc(100vh-200px)]">
          <div className="w-64 flex flex-col gap-3 overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Source Vectors</h3>
            {images.map((img, idx) => (
              <div
                key={img.id}
                onClick={() => setCurrentPreview(idx)}
                className={`p-2 rounded-lg border cursor-pointer transition-all ${currentPreview === idx ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="aspect-video bg-slate-100 rounded mb-2 overflow-hidden"><img src={img.url} className="w-full h-full object-cover" /></div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700">IMG-{idx + 1}</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{img.annotations.length}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1 flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <div className="h-14 border-b border-slate-200 bg-white flex justify-between items-center px-6">
              <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setDrawMode('select')} className={`p-1.5 rounded ${drawMode === 'select' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}><MousePointer2 className="w-4 h-4" /></button>
                <button onClick={() => setDrawMode('box')} className={`p-1.5 rounded ${drawMode === 'box' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}><BoxSelect className="w-4 h-4" /></button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleFinalizeReport('DRAFT')}
                  disabled={isFinalizing}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-600"
                >
                  {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>
                <button
                  onClick={() => handleFinalizeReport('FINALIZED')}
                  disabled={isFinalizing}
                  className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800"
                >
                  {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                  Finalize Report
                </button>
              </div>
            </div>

            <div className="flex-1 relative flex flex-col overflow-hidden select-none">
              {currentPreview !== null && (
                <AIAnalysisView
                  imageUrl={images[currentPreview].url}
                  annotations={images[currentPreview].annotations}
                  isScanning={isScanning}
                  onScanComplete={() => { }} // Could trigger auto-advance or notification
                  onAnnotationSelect={(id) => setSelectedAnnotationId(id)}
                  selectedAnnotationId={selectedAnnotationId}
                />
              )}
            </div>
          </div>

          {selectedAnnotationId && currentPreview !== null && (
            <div className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col gap-4 animate-in slide-in-from-right-10">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 text-sm">Annotation Details</h4>
                <button onClick={() => setSelectedAnnotationId(null)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              {/* ... Inputs for editing annotation ... */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Label</label>
                  <input
                    type="text"
                    value={images[currentPreview].annotations.find(a => a.id === selectedAnnotationId)?.label || ''}
                    onChange={(e) => updateAnnotation(selectedAnnotationId, { label: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="Issue Label"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Severity</label>
                  <select
                    value={images[currentPreview].annotations.find(a => a.id === selectedAnnotationId)?.severity || Severity.MEDIUM}
                    onChange={(e) => updateAnnotation(selectedAnnotationId, { severity: e.target.value as Severity })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value={Severity.CRITICAL}>Critical</option>
                    <option value={Severity.HIGH}>High</option>
                    <option value={Severity.MEDIUM}>Medium</option>
                    <option value={Severity.LOW}>Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                  <textarea
                    value={images[currentPreview].annotations.find(a => a.id === selectedAnnotationId)?.description || ''}
                    onChange={(e) => updateAnnotation(selectedAnnotationId, { description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-32 resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="Add observations..."
                  />
                </div>
              </div>
              <button className="text-red-600 text-sm font-medium hover:text-red-700 mt-auto flex items-center gap-2" onClick={() => deleteAnnotation(selectedAnnotationId)}>
                <Trash2 className="w-4 h-4" /> Delete Vector
              </button>
            </div>
          )}
        </div>
      )}
    </div >
  );
};

export default ReportCreator;
