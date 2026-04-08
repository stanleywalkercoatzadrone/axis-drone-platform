/**
 * GenericIndustryReportGenerator
 * Powers Construction, Utilities, and Telecom report sections
 * via the /api/ai/report-generate Gemini endpoint.
 */
import React, { useState } from 'react';
import { ChevronRight, Loader2, FileText, Sparkles, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { ReportSection } from '../config/industryReportSections';
import apiClient from '../../../src/services/apiClient';

interface Props {
    section: ReportSection;
    industryLabel: string;
    colorHex: string;
    initialSiteName?: string;
    initialClientName?: string;
}

const GenericIndustryReportGenerator: React.FC<Props> = ({
    section, industryLabel, colorHex, initialSiteName = '', initialClientName = ''
}) => {
    const [siteName, setSiteName] = useState(initialSiteName);
    const [clientName, setClientName] = useState(initialClientName);
    const [location, setLocation] = useState('');
    const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

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
                setResult(res.data.result || '');
            } else {
                throw new Error(res.data.message || 'Generation failed');
            }
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || 'Unknown error');
        } finally {
            setGenerating(false);
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
                                    <input
                                        value={clientName}
                                        onChange={e => setClientName(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
                                        placeholder="Client name"
                                    />
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
                                    onClick={() => setResult(null)}
                                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                                </button>
                                <button
                                    onClick={() => {
                                        const blob = new Blob([result], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${section.id}-${inspectionDate}.txt`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-white font-bold border transition-colors"
                                    style={{ background: colorHex + '20', borderColor: colorHex + '40', color: colorHex }}
                                >
                                    <FileText className="w-3.5 h-3.5" /> Export
                                </button>
                            </div>
                        </div>

                        {/* Report content */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-800">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                                    style={{ background: colorHex + '20', color: colorHex }}>
                                    {section.icon}
                                </div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{section.badge} · {industryLabel}</span>
                                <div className="ml-auto flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                    <CheckCircle className="w-3.5 h-3.5" /> AI Generated
                                </div>
                            </div>
                            <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                                {result}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GenericIndustryReportGenerator;
