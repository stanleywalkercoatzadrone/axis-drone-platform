import React, { createContext, useContext, useState } from 'react';
import { Industry, ReportTheme, Branding, InspectionReport, InspectionImage, IndustryTemplate, INDUSTRY_TEMPLATES } from '../../types';
import apiClient from '../../src/services/apiClient';

interface ReportContextType {
    // State
    step: number;
    reportId: string | null;
    reportStatus: string | null;
    title: string;
    client: string;
    industry: Industry;
    theme: ReportTheme;
    branding: Branding;
    images: InspectionImage[];
    summary: string;
    recommendations: string[];
    isUploading: boolean;
    uploadProgress: Record<string, number>;
    isAnalyzing: boolean;
    analysisProgress: { current: number; total: number; currentImageName: string };
    selectedTemplate: IndustryTemplate;
    setSelectedTemplate: (template: IndustryTemplate) => void;

    // Actions
    setStep: (step: number) => void;
    setTitle: (title: string) => void;
    setClient: (client: string) => void;
    setIndustry: (industry: Industry) => void;
    setTheme: (theme: ReportTheme) => void;
    setBranding: (branding: Branding) => void;
    setSummary: (summary: string) => void;
    setRecommendations: (recs: string[]) => void;
    addImage: (file: File) => Promise<void>;
    addImages: (files: File[]) => Promise<void>;
    removeImage: (id: string) => void;
    updateImage: (id: string, updates: Partial<InspectionImage>) => void;
    analyzeAllImages: () => Promise<void>;
    generateReportNarrative: () => Promise<void>;
    saveDraft: () => Promise<void>;
    finalizeReport: () => Promise<InspectionReport>;
    loadReport: (report: InspectionReport) => void;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const ReportProvider: React.FC<{ children: React.ReactNode, initialReport?: InspectionReport | null, initialIndustry?: Industry | null }> = ({ children, initialReport, initialIndustry }) => {
    // Start at step 4 (Review/Edit) when viewing an existing report, step 1 for new ones
    const [step, setStep] = useState(initialReport ? 4 : 1);
    const [reportId, setReportId] = useState<string | null>(initialReport?.id || null);
    const [reportStatus, setReportStatus] = useState<string | null>(initialReport?.status || null);
    const [title, setTitle] = useState(initialReport?.title || '');
    const [client, setClient] = useState(initialReport?.client || '');
    const [industry, setIndustryState] = useState<Industry>(initialReport?.industry || initialIndustry || Industry.SOLAR);
    const [theme, setTheme] = useState<ReportTheme>(initialReport?.theme || ReportTheme.TECHNICAL);
    const [branding, setBranding] = useState<Branding>(initialReport?.branding || { primaryColor: '#0f172a' });
    const [images, setImages] = useState<InspectionImage[]>(initialReport?.images || []);
    const [summary, setSummary] = useState(initialReport?.summary || '');
    const [recommendations, setRecommendations] = useState<string[]>(initialReport?.recommendations || []);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, currentImageName: '' });

    const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplate>(
        (INDUSTRY_TEMPLATES[industry] || INDUSTRY_TEMPLATES[Industry.SOLAR])[0]
    );

    const setIndustry = (ind: Industry) => {
        setIndustryState(ind);
        setSelectedTemplate((INDUSTRY_TEMPLATES[ind] || INDUSTRY_TEMPLATES[Industry.SOLAR])[0]);
    };

    const addImages = async (files: File[]) => {
        setIsUploading(true);

        // 1. Ensure we have a report ID
        let targetReportId = reportId;
        if (!targetReportId) {
            try {
                const draftPayload = {
                    title: title || 'Untitled Report',
                    client: client || 'Unknown Client',
                    industry,
                    theme: theme.toUpperCase(),
                    branding,
                    status: 'DRAFT'
                };
                const draftRes = await apiClient.post('/reports', draftPayload);
                targetReportId = draftRes.data.data.id;
                setReportId(targetReportId);
            } catch (err: any) {
                console.error('Failed to initialize report for upload:', err?.response?.data || err?.message || err);
                setIsUploading(false);
                return;
            }
        }

        // 2. Upload files in parallel
        await Promise.all(files.map(async (file) => {
            const tempId = `temp-${Date.now()}-${Math.random()}`;
            const previewUrl = URL.createObjectURL(file);

            const newImage: InspectionImage = {
                id: tempId,
                url: previewUrl,
                annotations: [],
                summary: 'Uploading...'
            };

            setImages(prev => [...prev, newImage]);
            setUploadProgress(prev => ({ ...prev, [tempId]: 0 }));

            try {
                const formData = new FormData();
                formData.append('files', file);
                if (targetReportId) formData.append('reportId', targetReportId);

                const res = await apiClient.post('/images/upload', formData, {
                    headers: { 'Content-Type': undefined }
                });

                const uploaded = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;

                setUploadProgress(prev => ({ ...prev, [tempId]: 100 }));
                setImages(prev => prev.map(img => img.id === tempId ? {
                    ...img,
                    id: uploaded?.id || tempId,
                    url: uploaded?.storage_url || uploaded?.url || previewUrl,
                    summary: 'Ready for analysis'
                } : img));
            } catch (error: any) {
                console.error('Upload failed for file', file.name, error?.response?.data || error?.message || error);
                setUploadProgress(prev => ({ ...prev, [tempId]: -1 }));
            }
        }));

        setIsUploading(false);
    };

    const addImage = async (file: File) => {
        await addImages([file]);
    };

    const removeImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    const updateImage = (id: string, updates: Partial<InspectionImage>) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    };

    // Real AI analysis — calls backend Gemini endpoint per image
    const analyzeAllImages = async () => {
        const analyzableImages = images.filter(img => !img.id.startsWith('temp-'));
        if (analyzableImages.length === 0) return;

        setIsAnalyzing(true);
        setAnalysisProgress({ current: 0, total: analyzableImages.length, currentImageName: '' });

        for (let i = 0; i < analyzableImages.length; i++) {
            const img = analyzableImages[i];
            setAnalysisProgress({ current: i + 1, total: analyzableImages.length, currentImageName: `Image ${i + 1}` });

            try {
                const res = await apiClient.post(`/images/${img.id}/analyze`, {
                    industry,
                    sensitivity: 50
                });

                if (res.data.success) {
                    const { annotations, summary: imgSummary } = res.data.data;
                    setImages(prev => prev.map(im => im.id === img.id ? {
                        ...im,
                        annotations: annotations || [],
                        summary: imgSummary || im.summary
                    } : im));
                }
            } catch (err: any) {
                console.error(`Failed to analyze image ${img.id}:`, err?.response?.data || err?.message);
            }
        }

        setIsAnalyzing(false);
    };

    // AI writes the report narrative based on all findings
    const generateReportNarrative = async () => {
        const allFindings = images.flatMap(img => img.annotations.map(a => ({
            label: a.label,
            description: a.description,
            severity: a.severity,
            imageId: img.id
        })));

        const prompt = `You are a professional drone inspection report writer for the ${industry} industry.
Based on the following inspection findings from ${images.length} drone images, write:
1. An executive summary paragraph (3-5 sentences) describing the overall inspection results
2. A list of 3-6 specific actionable recommendations

Findings:
${allFindings.map((f, i) => `${i + 1}. [${f.severity}] ${f.label}: ${f.description}`).join('\n')}

Report title: ${title}
Client: ${client}

Respond in JSON: { "summary": "...", "recommendations": ["...", "..."] }`;

        try {
            const res = await apiClient.post('/ai/generate-text', { prompt });
            if (res.data.success && res.data.data) {
                const parsed = typeof res.data.data === 'string' ? JSON.parse(res.data.data) : res.data.data;
                if (parsed.summary) setSummary(parsed.summary);
                if (parsed.recommendations) setRecommendations(parsed.recommendations);
            }
        } catch (err: any) {
            console.error('Failed to generate narrative:', err?.response?.data || err?.message);
            // Fallback: generate a basic summary from findings
            const criticals = allFindings.filter(f => f.severity === 'Critical').length;
            const highs = allFindings.filter(f => f.severity === 'High').length;
            setSummary(`This ${industry} inspection of ${client}'s infrastructure identified ${allFindings.length} total findings across ${images.length} drone images. ${criticals > 0 ? `${criticals} critical issue(s) require immediate attention.` : ''} ${highs > 0 ? `${highs} high-severity finding(s) should be addressed within 30 days.` : ''} A comprehensive remediation plan is recommended.`);
            setRecommendations([
                'Prioritize repair of all critical findings immediately',
                'Schedule follow-up inspection within 90 days',
                'Document all remediation actions for compliance records'
            ]);
        }
    };

    const saveDraft = async () => {
        const payload = {
            title: title || 'Untitled Report',
            client: client || 'Unknown Client',
            industry,
            theme: theme.toUpperCase(),
            branding,
            summary,
            recommendations,
            status: 'DRAFT'
        };

        try {
            if (reportId) {
                await apiClient.put(`/reports/${reportId}`, payload);
            } else {
                const res = await apiClient.post('/reports', payload);
                setReportId(res.data.data.id);
            }
        } catch (err) {
            console.error('Failed to save draft', err);
            throw err;
        }
    };

    const finalizeReport = async () => {
        await saveDraft();
        if (!reportId) throw new Error("No report ID to finalize");
        const res = await apiClient.post(`/reports/${reportId}/finalize`);
        setReportStatus('FINALIZED');
        return res.data.data;
    };

    const loadReport = (report: InspectionReport) => {
        setReportId(report.id);
        setTitle(report.title);
        setClient(report.client);
        setIndustry(report.industry);
        setTheme(report.theme);
        setBranding(report.branding);
        setImages(report.images);
        setSummary(report.summary || '');
        setRecommendations(report.recommendations || []);
        setStep(1);
    };

    return (
        <ReportContext.Provider value={{
            step, setStep,
            reportId,
            reportStatus,
            title, setTitle,
            client, setClient,
            industry, setIndustry,
            theme, setTheme,
            branding, setBranding,
            summary, setSummary,
            recommendations, setRecommendations,
            images,
            isUploading,
            uploadProgress,
            isAnalyzing,
            analysisProgress,
            selectedTemplate,
            setSelectedTemplate,
            addImage,
            addImages,
            removeImage,
            updateImage,
            analyzeAllImages,
            generateReportNarrative,
            saveDraft,
            finalizeReport,
            loadReport
        }}>
            {children}
        </ReportContext.Provider>
    );
};

export const useReport = () => {
    const context = useContext(ReportContext);
    if (!context) throw new Error('useReport must be used within a ReportProvider');
    return context;
};
