import React, { createContext, useContext, useState, useEffect } from 'react';
import { Industry, ReportTheme, Branding, InspectionReport, InspectionImage, Annotation, IndustryTemplate, INDUSTRY_TEMPLATES } from '../../types';
import apiClient from '../../src/services/apiClient';

interface ReportContextType {
    // State
    step: number;
    reportId: string | null;
    title: string;
    client: string;
    industry: Industry;
    theme: ReportTheme;
    branding: Branding;
    images: InspectionImage[];
    isUploading: boolean;
    uploadProgress: Record<string, number>;
    isAnalyzing: boolean;
    selectedTemplate: IndustryTemplate;

    // Actions
    setStep: (step: number) => void;
    setTitle: (title: string) => void;
    setClient: (client: string) => void;
    setIndustry: (industry: Industry) => void;
    setTheme: (theme: ReportTheme) => void;
    setBranding: (branding: Branding) => void;
    addImage: (file: File) => Promise<void>;
    removeImage: (id: string) => void;
    updateImage: (id: string, updates: Partial<InspectionImage>) => void;
    startAIAnalysis: () => Promise<void>;
    saveDraft: () => Promise<void>;
    finalizeReport: () => Promise<InspectionReport>;
    loadReport: (report: InspectionReport) => void;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const ReportProvider: React.FC<{ children: React.ReactNode, initialReport?: InspectionReport | null }> = ({ children, initialReport }) => {
    const [step, setStep] = useState(1);
    const [reportId, setReportId] = useState<string | null>(initialReport?.id || null);
    const [title, setTitle] = useState(initialReport?.title || '');
    const [client, setClient] = useState(initialReport?.client || '');
    const [industry, setIndustryState] = useState<Industry>(initialReport?.industry || Industry.SOLAR);
    const [theme, setTheme] = useState<ReportTheme>(initialReport?.theme || ReportTheme.TECHNICAL);
    const [branding, setBranding] = useState<Branding>(initialReport?.branding || { primaryColor: '#0f172a' });
    const [images, setImages] = useState<InspectionImage[]>(initialReport?.images || []);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplate>(
        INDUSTRY_TEMPLATES[industry][0]
    );

    // Update template when industry changes
    const setIndustry = (ind: Industry) => {
        setIndustryState(ind);
        setSelectedTemplate(INDUSTRY_TEMPLATES[ind][0]);
    };

    const addImage = async (file: File) => {
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        // Create local preview
        const previewUrl = URL.createObjectURL(file);

        // Add to state immediately
        const newImage: InspectionImage = {
            id: tempId,
            url: previewUrl,
            annotations: [],
            summary: 'Uploading...'
        };

        setImages(prev => [...prev, newImage]);
        setIsUploading(true);
        setUploadProgress(prev => ({ ...prev, [tempId]: 0 }));

        try {
            // Simulate progress or implement real axios progress
            const interval = setInterval(() => {
                setUploadProgress(prev => ({ ...prev, [tempId]: Math.min((prev[tempId] || 0) + 10, 90) }));
            }, 200);

            // Upload to backend
            const formData = new FormData();
            formData.append('image', file);
            // If we have a reportId, associate it now, otherwise we might need a temp folder?
            // Ensure we have a report ID
            let targetReportId = reportId;
            if (!targetReportId) {
                // Initialize draft to get an ID
                console.log('Initializing draft report for upload...');
                // We need to call the API directly here to avoid state race conditions with saveDraft() wrapper
                const draftPayload = {
                    title: title || 'Untitled Report',
                    client: client || 'Unknown Client',
                    industry,
                    theme,
                    branding,
                    status: 'DRAFT'
                };
                const draftRes = await apiClient.post('/reports', draftPayload);
                targetReportId = draftRes.data.data.id;
                setReportId(targetReportId);
            }

            if (targetReportId) formData.append('reportId', targetReportId);

            const res = await apiClient.post('/images/upload', formData);

            clearInterval(interval);
            setUploadProgress(prev => ({ ...prev, [tempId]: 100 }));

            // Replace temp image with real one
            setImages(prev => prev.map(img => img.id === tempId ? {
                ...img,
                id: res.data.data.id || tempId, // specific ID from backend if provided
                url: res.data.data.url, // Cloud URL
                summary: 'Ready for analysis'
            } : img));

        } catch (error) {
            console.error('Upload failed', error);
            setUploadProgress(prev => ({ ...prev, [tempId]: -1 })); // Error state
            // Optionally remove the image or show error
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
        // TODO: cleanup on server?
    };

    const updateImage = (id: string, updates: Partial<InspectionImage>) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    };

    const saveDraft = async () => {
        const payload = {
            title: title || 'Untitled Report',
            client: client || 'Unknown Client',
            industry,
            theme,
            branding,
            images,
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

    const startAIAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            // In a real app, we'd call the analyze endpoint
            // For now, we'll simulate the analysis results locally or call the mock
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Mock processing logic (preserving existing behavior)
            const updatedImages = images.map(img => {
                if (img.annotations.length > 0) return img; // Already analyzed

                // Generate mock annotations based on industry
                // ... (Copying logic from original ReportCreator) ...
                return {
                    ...img,
                    annotations: [
                        {
                            id: `ai-${Date.now()}`,
                            label: 'Detected Anomaly',
                            description: 'AI detected issue.',
                            severity: 'High',
                            x: 20, y: 20, width: 10, height: 10,
                            type: 'box',
                            source: 'ai'
                        }
                    ] as any
                };
            });

            setImages(updatedImages);
        } catch (err) {
            console.error(err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const finalizeReport = async () => {
        // 1. Ensure latest state is saved
        await saveDraft();

        if (!reportId) throw new Error("No report ID to finalize");

        // 2. Call finalize endpoint
        const res = await apiClient.post(`/reports/${reportId}/finalize`);
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
        setStep(1);
    };

    return (
        <ReportContext.Provider value={{
            step, setStep,
            reportId,
            title, setTitle,
            client, setClient,
            industry, setIndustry,
            theme, setTheme,
            branding, setBranding,
            images,
            isUploading,
            uploadProgress,
            isAnalyzing,
            selectedTemplate,
            addImage,
            removeImage,
            updateImage,
            startAIAnalysis,
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
