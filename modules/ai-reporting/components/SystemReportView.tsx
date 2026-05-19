/**
 * SystemReportView.tsx — High-fidelity in-app report viewer.
 * Renders when a ReportMeta has structured rawData (toc, findings, content).
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    X, Download, ChevronRight, AlertTriangle, CheckCircle,
    Info, FileText, Thermometer, Zap, Shield, HardHat,
    Radio, Sun, List, BarChart2, MapPin, Calendar, User,
    Clock, ArrowRight, AlertCircle, TrendingUp, Activity,
} from 'lucide-react';
import { ReportMeta } from '../utils/reportStorage';

interface SystemReportViewProps {
    report: ReportMeta;
    onClose: () => void;
    onDownload?: () => void;
    embedded?: boolean; // when true, renders inline (no fixed overlay)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityColor(s?: string) {
    const l = (s || '').toLowerCase();
    if (l === 'critical') return { bg: 'rgba(239,68,68,0.1)', text: '#f87171', border: 'rgba(239,68,68,0.25)' };
    if (l === 'high')     return { bg: 'rgba(249,115,22,0.1)', text: '#fb923c', border: 'rgba(249,115,22,0.25)' };
    if (l === 'medium')   return { bg: 'rgba(234,179,8,0.1)',  text: '#facc15', border: 'rgba(234,179,8,0.25)' };
    return                       { bg: 'rgba(34,197,94,0.1)',  text: '#4ade80', border: 'rgba(34,197,94,0.25)' };
}

function industryColor(ind?: string) {
    switch (ind) {
        case 'solar':        return '#f59e0b';
        case 'insurance':    return '#ef4444';
        case 'utilities':    return '#8b5cf6';
        case 'construction': return '#06b6d4';
        case 'telecom':      return '#10b981';
        default:             return '#6366f1';
    }
}

function industryEmoji(ind?: string) {
    switch (ind) {
        case 'solar':        return '☀️';
        case 'insurance':    return '🛡️';
        case 'utilities':    return '⚡';
        case 'construction': return '🏗️';
        case 'telecom':      return '📡';
        default:             return '📋';
    }
}

const SeverityBadge: React.FC<{ severity?: string }> = ({ severity }) => {
    const c = severityColor(severity);
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: 0.6,
            background: c.bg, color: c.text, border: `1px solid ${c.border}`,
        }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.text, display: 'inline-block' }} />
            {severity || 'Low'}
        </span>
    );
};

const Section: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; accent?: string }> = ({ title, icon: Icon, children, accent = '#6366f1' }) => (
    <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ background: `${accent}18`, border: `1px solid ${accent}30`, borderRadius: 8, padding: 6 }}>
                <Icon size={14} color={accent} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</span>
        </div>
        {children}
    </div>
);

const KPI: React.FC<{ label: string; value: string | number; color: string; icon?: React.ElementType }> = ({ label, value, color, icon: Icon }) => (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
        {Icon && <Icon size={14} color={color} style={{ marginBottom: 6, opacity: 0.7 }} />}
        <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}>{label}</div>
    </div>
);

// ── TOC Sidebar ───────────────────────────────────────────────────────────────

const TocSidebar: React.FC<{ toc: any[]; active: string; onSelect: (id: string) => void; accent: string }> = ({ toc, active, onSelect, accent }) => (
    <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', padding: '20px 0', overflowY: 'auto' }}>
        <div style={{ padding: '0 16px 12px', fontSize: 9, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: 1 }}>Contents</div>
        {toc.map((entry: any) => {
            const isActive = active === (entry.id || entry.label);
            const level = entry.level || 1;
            return (
                <button
                    key={entry.id || entry.label}
                    onClick={() => onSelect(entry.id || entry.label)}
                    style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: `7px ${16 + (level - 1) * 12}px`,
                        fontSize: 11 - (level - 1),
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? accent : '#64748b',
                        background: isActive ? `${accent}0c` : 'transparent',
                        borderLeft: `2px solid ${isActive ? accent : 'transparent'}`,
                        cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                    }}
                >
                    {entry.label}
                </button>
            );
        })}
    </div>
);

// ── Findings List ─────────────────────────────────────────────────────────────

const FindingsList: React.FC<{ findings: any[]; accent: string }> = ({ findings, accent }) => {
    if (!findings?.length) return (
        <div style={{ padding: '24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
            <CheckCircle size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>No findings recorded</div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {findings.map((f: any, i: number) => {
                const c = severityColor(f.severity);
                return (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.06)`,
                        borderLeft: `3px solid ${c.text}`,
                        borderRadius: 10, padding: '14px 16px',
                        display: 'flex', gap: 14, alignItems: 'flex-start',
                    }}>
                        <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: c.text }}>
                            {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                                    {f.anomalyType || f.type || f.title || f.label || `Finding ${i + 1}`}
                                </span>
                                <SeverityBadge severity={f.severity} />
                            </div>
                            {(f.description || f.details) && (
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                                    {f.description || f.details}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                                {f.location && <span style={{ fontSize: 10, color: '#475569' }}>📍 {f.location}</span>}
                                {f.confidence && <span style={{ fontSize: 10, color: '#475569' }}>Confidence: {f.confidence}%</span>}
                                {f.remediation && <span style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>→ {f.remediation}</span>}
                                {(f.estimatedCost || f.estimatedCostMin) && (
                                    <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>
                                        Est. ${Number(f.estimatedCost || f.estimatedCostMin || 0).toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ── Content Renderer ──────────────────────────────────────────────────────────

const ContentBlock: React.FC<{ block: any; accent: string }> = ({ block, accent }) => {
    if (!block) return null;
    const type = block.type || 'text';

    if (type === 'heading') return (
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', marginBottom: 8, marginTop: 16 }}>{block.text}</h3>
    );
    if (type === 'text' || type === 'paragraph') return (
        <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 12 }}>{block.text || block.content}</p>
    );
    if (type === 'metric') return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${accent}0e`, border: `1px solid ${accent}25`, borderRadius: 8, padding: '6px 12px', margin: '4px 4px 4px 0' }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: accent }}>{block.value}</span>
            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{block.label}</span>
        </div>
    );
    if (type === 'list') return (
        <ul style={{ padding: '0 0 0 16px', marginBottom: 12 }}>
            {(block.items || []).map((item: string, i: number) => (
                <li key={i} style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, lineHeight: 1.6 }}>{item}</li>
            ))}
        </ul>
    );
    if (type === 'table') return (
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                {block.headers && (
                    <thead>
                        <tr>
                            {block.headers.map((h: string, i: number) => (
                                <th key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10, fontWeight: 800, textAlign: 'left' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {(block.rows || []).map((row: string[], i: number) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={j} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    // Fallback: render as text
    const text = block.text || block.content || block.value || JSON.stringify(block);
    return <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7, marginBottom: 8 }}>{text}</p>;
};

// ── Main View ─────────────────────────────────────────────────────────────────

export const SystemReportView: React.FC<SystemReportViewProps> = ({ report, onClose, onDownload, embedded = false }) => {
    const accent = industryColor(report.industry);
    const data = report.rawData || {};

    // Normalise data fields
    const toc: any[]     = data.toc || [];
    const findings: any[] = data.findings || data.faults || data.defects || data.anomalies || data.issues || [];
    const content: any[] = data.content || [];
    const recommendations: string[] = data.recommendations || [];
    const form = data.form || {};
    const aiSummary = data.aiSummary || data.summary || data.executiveSummary || '';

    const [activeToc, setActiveToc] = useState(toc[0]?.id || toc[0]?.label || 'summary');
    const contentRef = useRef<HTMLDivElement>(null);

    // Count severity
    const critCount = findings.filter((f: any) => (f.severity || '').toLowerCase() === 'critical').length;
    const highCount  = findings.filter((f: any) => (f.severity || '').toLowerCase() === 'high').length;

    // Compute risk score if not in data
    const riskScore = data.riskScore ?? data.overallRisk ?? Math.min(100, critCount * 20 + highCount * 8 + (findings.length - critCount - highCount) * 2);

    const scrollToSection = (id: string) => {
        setActiveToc(id);
        const el = contentRef.current?.querySelector(`[data-section="${id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const siteName = report.siteName || form.siteName || data.siteName || '';
    const clientName = report.clientName || form.clientName || data.clientName || '';
    const pilotName = form.pilotName || form.technician || data.pilotName || '';
    const inspDate = new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const wrapperStyle: React.CSSProperties = embedded
        ? { display: 'flex', flexDirection: 'column', height: '100%', background: '#060d1a', fontFamily: "'Inter','SF Pro',system-ui,sans-serif", color: '#e2e8f0', overflow: 'hidden' }
        : { position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#060d1a', fontFamily: "'Inter','SF Pro',system-ui,sans-serif", color: '#e2e8f0' };

    return (
        <div style={wrapperStyle}>

            {/* ── Topbar — only shown when NOT embedded (standalone mode) ── */}
            {!embedded && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#080f1e', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${accent}0e`, border: `1px solid ${accent}30`, borderRadius: 10, padding: '6px 14px' }}>
                        <span style={{ fontSize: 14 }}>{industryEmoji(report.industry)}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 0.8 }}>{report.industry} Report</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.title}</div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                            {siteName && <span style={{ fontSize: 10, color: '#475569' }}>📍 {siteName}</span>}
                            {clientName && <span style={{ fontSize: 10, color: '#475569' }}>🏢 {clientName}</span>}
                            <span style={{ fontSize: 10, color: '#475569' }}>📅 {inspDate}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {onDownload && (
                            <button onClick={onDownload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: `${accent}18`, border: `1px solid ${accent}35`, borderRadius: 9, color: accent, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                <Download size={13} /> Download PDF
                            </button>
                        )}
                        <button onClick={onClose} style={{ padding: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#64748b', cursor: 'pointer', display: 'flex' }}>
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Body ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* TOC sidebar — only show if there are TOC entries */}
                {toc.length > 0 && (
                    <TocSidebar toc={toc} active={activeToc} onSelect={scrollToSection} accent={accent} />
                )}

                {/* Main scroll area */}
                <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>

                    {/* ── Executive Summary ── */}
                    <div data-section="summary" style={{ marginBottom: 32 }}>
                        {/* Risk score + KPIs row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                            <KPI label="Risk Score" value={`${Math.round(riskScore)}/100`} color={riskScore >= 60 ? '#ef4444' : riskScore >= 30 ? '#f59e0b' : '#4ade80'} icon={Activity} />
                            <KPI label="Total Findings" value={findings.length} color={accent} icon={AlertCircle} />
                            {critCount > 0 && <KPI label="Critical" value={critCount} color="#ef4444" icon={AlertTriangle} />}
                            {highCount > 0 && <KPI label="High Priority" value={highCount} color="#fb923c" icon={TrendingUp} />}
                            {pilotName && <KPI label="Technician" value={pilotName} color="#818cf8" icon={User} />}
                        </div>

                        {/* AI Summary */}
                        {aiSummary && (
                            <Section title="Executive Summary" icon={FileText} accent={accent}>
                                <div style={{ background: `${accent}08`, border: `1px solid ${accent}20`, borderRadius: 12, padding: '18px 20px' }}>
                                    <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.8, margin: 0 }}>{aiSummary}</p>
                                </div>
                            </Section>
                        )}
                    </div>

                    {/* ── Findings ── */}
                    {findings.length > 0 && (
                        <div data-section="findings" style={{ marginBottom: 32 }}>
                            <Section title={`Findings (${findings.length})`} icon={AlertTriangle} accent={accent}>
                                <FindingsList findings={findings} accent={accent} />
                            </Section>
                        </div>
                    )}

                    {/* ── Recommendations ── */}
                    {recommendations.length > 0 && (
                        <div data-section="recommendations" style={{ marginBottom: 32 }}>
                            <Section title="Recommendations" icon={CheckCircle} accent="#4ade80">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {recommendations.map((rec: string, i: number) => (
                                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 10, padding: '10px 14px' }}>
                                            <ArrowRight size={13} color="#4ade80" style={{ marginTop: 2, flexShrink: 0 }} />
                                            <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{rec}</span>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        </div>
                    )}

                    {/* ── Structured content blocks ── */}
                    {content.length > 0 && (
                        <div data-section="content" style={{ marginBottom: 32 }}>
                            {content.map((block: any, i: number) => (
                                <div key={i} data-section={block.id || block.sectionId || ''}>
                                    <ContentBlock block={block} accent={accent} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Form metadata ── */}
                    {Object.keys(form).length > 0 && (
                        <div data-section="metadata" style={{ marginBottom: 32 }}>
                            <Section title="Inspection Details" icon={Info} accent="#64748b">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                                    {Object.entries(form)
                                        .filter(([, v]) => v && typeof v === 'string' || typeof v === 'number')
                                        .map(([k, v]) => (
                                            <div key={k} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 14px' }}>
                                                <div style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 }}>
                                                    {k.replace(/([A-Z])/g, ' $1').trim()}
                                                </div>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{String(v)}</div>
                                            </div>
                                        ))}
                                </div>
                            </Section>
                        </div>
                    )}

                    {/* Empty state */}
                    {findings.length === 0 && !aiSummary && content.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
                            <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Report data loaded</div>
                            <div style={{ fontSize: 12 }}>Use the PDF download option to view the full formatted report.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemReportView;
