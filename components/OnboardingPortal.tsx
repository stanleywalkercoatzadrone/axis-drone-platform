
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeCheck, FileText, Upload, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import apiClient from '../src/services/apiClient';

interface OnboardingDocument {
    id: string;
    type: string;
    name: string;
    status: 'pending' | 'completed';
    completedAt?: string;
    templateUrl?: string;
}

interface OnboardingData {
    personnelName: string;
    email: string;
    role: string;
    status: string;
    documents: OnboardingDocument[];
    expiresAt: string;
}

const OnboardingPortal: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [data, setData] = useState<OnboardingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

    useEffect(() => {
        const fetchOnboardingData = async () => {
            try {
                // Determine API URL based on environment or default
                // Since this might be accessed from a public route where apiClient interceptors might fail (auth headers),
                // we should ensure apiClient handles public endpoints gracefully or use fetch.
                // However, our backend endpoint /api/onboarding/portal/:token is public.
                const response = await apiClient.get(`/onboarding/portal/${token}`);
                setData(response.data.data);
            } catch (err: any) {
                console.error('Error fetching onboarding data:', err);
                setError(err.response?.data?.message || 'Failed to load onboarding portal. The link may be invalid or expired.');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchOnboardingData();
        } else {
            setError('Invalid access link.');
            setLoading(false);
        }
    }, [token]);

    const handleFileUpload = async (documentId: string, files: FileList) => {
        if (!files || files.length === 0) return;

        try {
            setUploadingDocId(documentId);

            const formData = new FormData();
            formData.append('documentId', documentId);
            Array.from(files).forEach(file => {
                formData.append('files', file); // Use 'files' to match backend bulk
            });

            await apiClient.post(`/onboarding/portal/${token}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // Update local state (mark as completed if at least one uploaded successfully)
            if (data) {
                setData({
                    ...data,
                    documents: data.documents.map(doc =>
                        doc.id === documentId
                            ? { ...doc, status: 'completed', completedAt: new Date().toISOString() }
                            : doc
                    )
                });
            }
        } catch (err: any) {
            console.error('Error uploading documents:', err);
            alert(err.response?.data?.message || 'Failed to upload documents.');
        } finally {
            setUploadingDocId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full p-8 rounded-xl shadow-lg text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
                    <p className="text-slate-600">{error || 'Unable to access onboarding portal.'}</p>
                </div>
            </div>
        );
    }

    const allCompleted = data.documents.every(doc => doc.status === 'completed');

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center">
                    <img
                        src="/axis-logo-dark.svg"
                        alt="CoatzadroneUSA"
                        className="h-10 mx-auto mb-6"
                        onError={(e) => {
                            // Fallback if logo not found
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                    <h1 className="text-3xl font-bold text-slate-900">Welcome, {data.personnelName}!</h1>
                    <p className="mt-2 text-lg text-slate-600">
                        Please complete your onboarding documents below to get started.
                    </p>
                </div>

                {/* Progress Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 sm:p-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900">Onboarding Progress</h2>
                            <span className="text-sm font-medium text-slate-500">
                                {data.documents.filter(d => d.status === 'completed').length} of {data.documents.length} Completed
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${(data.documents.filter(d => d.status === 'completed').length / data.documents.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Documents List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-900">Required Documents</h3>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {data.documents.map((doc) => (
                            <li key={doc.id} className="p-6 transition-colors hover:bg-slate-50">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 p-2 rounded-lg ${doc.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {doc.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-slate-900">{doc.name}</h4>
                                            <p className="text-sm text-slate-500">
                                                {doc.status === 'completed'
                                                    ? `Completed on ${new Date(doc.completedAt!).toLocaleDateString()}`
                                                    : 'Please download, sign, and upload PDF'}
                                            </p>
                                            {doc.templateUrl && (
                                                <a
                                                    href={doc.templateUrl}
                                                    download={doc.name.replace(/\s+/g, '_') + '.pdf'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                                                >
                                                    <Download className="w-3 h-3" /> Download Template
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        {doc.status === 'completed' ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                <CheckCircle2 className="w-4 h-4" /> Completed
                                            </span>
                                        ) : (
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    id={`upload-${doc.id}`}
                                                    className="hidden"
                                                    multiple
                                                    onChange={(e) => {
                                                        const files = e.target.files;
                                                        if (files && files.length > 0) handleFileUpload(doc.id, files);
                                                    }}
                                                    disabled={!!uploadingDocId}
                                                />
                                                <label
                                                    htmlFor={`upload-${doc.id}`}
                                                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all cursor-pointer ${uploadingDocId === doc.id
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
                                                >
                                                    {uploadingDocId === doc.id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload className="w-4 h-4" /> Upload Signed PDF
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Completion Message */}
                {allCompleted && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center animate-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BadgeCheck className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-bold text-emerald-900 mb-2">Onboarding Complete!</h2>
                        <p className="text-emerald-700">
                            Thank you for completing all required documents. Our team has been notified and will review your information shortly.
                        </p>
                    </div>
                )}

                <div className="text-center text-sm text-slate-400">
                    &copy; {new Date().getFullYear()} CoatzadroneUSA. All rights reserved.
                </div>
            </div>
        </div>
    );
};

export default OnboardingPortal;
