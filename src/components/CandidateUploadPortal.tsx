import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { Card, CardContent } from '../stitch/components/Card';
import { Heading, Text } from '../stitch/components/Typography';
import { Button } from '../stitch/components/Button';
import { Upload, FileText, CheckCircle2, Loader2, Send } from 'lucide-react';
import axios from 'axios';

// Unauthenticated public route
const CandidateUploadPortal: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [packet, setPacket] = useState<any>(null);

    // File upload state for License and W9
    const [licenseFile, setLicenseFile] = useState<File | null>(null);
    const [w9File, setW9File] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const fetchPacket = async () => {
            try {
                const res = await apiClient.get(`/candidates/public/${token}`);
                if (res.data.success) {
                    setPacket(res.data.data);
                }
            } catch (err: any) {
                setError(err.response?.data?.message || 'Invalid or expired secure link.');
            } finally {
                setLoading(false);
            }
        };
        fetchPacket();
    }, [token]);

    const uploadFileToGCS = async (file: File) => {
        // 1. Get signed URL
        const res = await apiClient.post(`/candidates/public/${token}/upload-url`, {
            filename: file.name,
            contentType: file.type
        });
        const { uploadUrl, publicUrl, gcsPath } = res.data.data;

        // 2. Put file to GCS
        await axios.put(uploadUrl, file, {
            headers: {
                'Content-Type': file.type
            }
        });

        return { filename: file.name, url: publicUrl, path: gcsPath };
    };

    const handleSubmit = async () => {
        if (!licenseFile || !w9File) {
            alert('Please upload both your License and W9 before submitting.');
            return;
        }

        setIsSubmitting(true);
        try {
            const licenseDoc = await uploadFileToGCS(licenseFile);
            const w9Doc = await uploadFileToGCS(w9File);

            const res = await apiClient.post(`/candidates/public/${token}/submit`, {
                documents: [
                    { type: 'License', ...licenseDoc },
                    { type: 'W9', ...w9Doc }
                ],
                metadata: {} // any extra form fields we might want to collect
            });

            if (res.data.success) {
                setSuccessMessage('Your documents have been successfully securely submitted! Our team will review them shortly.');
            }
        } catch (err: any) {
            console.error('Submit error:', err);
            alert(err.response?.data?.message || 'Failed to submit documents. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-8 max-w-md text-center">
                    <Heading level={3} className="text-red-400 mb-2">Access Denied</Heading>
                    <Text className="text-slate-400">{error}</Text>
                </div>
            </div>
        );
    }

    if (packet && (packet.status === 'submitted' || packet.status === 'reviewed')) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-8 max-w-md text-center shadow-2xl shadow-emerald-500/10">
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    <Heading level={3} className="text-white mb-2">Packet Submitted</Heading>
                    <Text className="text-slate-400">You have already submitted your onboarding documents. We will be in touch soon.</Text>
                </div>
            </div>
        );
    }

    if (successMessage) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-10 max-w-lg text-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
                    <Heading level={2} className="text-white mb-3">Submission Complete</Heading>
                    <Text className="text-slate-400 mb-8">{successMessage}</Text>
                    <Text className="text-slate-500 text-sm">You may safely close this window.</Text>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 flex items-center justify-center font-sans tracking-wide">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="bg-slate-800/50 p-6 md:p-8 border-b border-slate-800 text-center">
                    <Heading level={2} className="text-white mb-2 tracking-widest uppercase">Secure Upload Portal</Heading>
                    <Text className="text-slate-400 text-sm">Please upload your required personnel documents to complete your onboarding process.</Text>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                    <div className="space-y-6">
                        {/* Part 107 License Upload */}
                        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full bg-cyan-900/30 flex items-center justify-center text-cyan-400">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <Heading level={4} className="text-slate-200">1. Part 107 / Technician License</Heading>
                            </div>
                            <label className="block border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-900/50 group">
                                <input type="file" className="hidden" onChange={(e) => e.target.files && setLicenseFile(e.target.files[0])} accept="image/*,.pdf" />
                                {licenseFile ? (
                                    <div className="flex flex-col items-center">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                                        <Text className="text-emerald-300 font-medium">{licenseFile.name}</Text>
                                        <Text className="text-slate-500 text-xs mt-1">Click to change file</Text>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <Upload className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 transition-colors mb-3" />
                                        <Text className="text-slate-300 font-medium mb-1">Click to upload license</Text>
                                        <Text className="text-slate-500 text-xs">PDF, JPG, or PNG</Text>
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* W9 Upload */}
                        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full bg-emerald-900/30 flex items-center justify-center text-emerald-400">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <Heading level={4} className="text-slate-200">2. W-9 Tax Form</Heading>
                            </div>
                            <label className="block border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-900/50 group">
                                <input type="file" className="hidden" onChange={(e) => e.target.files && setW9File(e.target.files[0])} accept="image/*,.pdf" />
                                {w9File ? (
                                    <div className="flex flex-col items-center">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                                        <Text className="text-emerald-300 font-medium">{w9File.name}</Text>
                                        <Text className="text-slate-500 text-xs mt-1">Click to change file</Text>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 transition-colors mb-3" />
                                        <Text className="text-slate-300 font-medium mb-1">Click to upload W-9</Text>
                                        <Text className="text-slate-500 text-xs">PDF, JPG, or PNG</Text>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button
                            onClick={handleSubmit}
                            disabled={!licenseFile || !w9File || isSubmitting}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white border-none px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm disabled:opacity-50 transition-all flex items-center shadow-lg shadow-cyan-500/20"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> SECURELY SUBMITTING...</>
                            ) : (
                                <><Send className="w-4 h-4 mr-2" /> SUBMIT DOCUMENTS</>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CandidateUploadPortal;
