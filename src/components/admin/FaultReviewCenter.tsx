/**
 * FaultReviewCenter.tsx
 * Enterprise AI Fault Review Workspace
 * Additive replacement for FaultReviewPanel — preserves all existing API calls.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    CheckCircle2, XCircle, RotateCcw, Search, SlidersHorizontal,
    Download, UserPlus, AlertTriangle, Thermometer, Zap, Eye,
    ChevronRight, RefreshCcw, Building2, MapPin, Calendar,
    Layers, Activity, Clock, FileText, BarChart3, Shield,
    ArrowUpRight, Crosshair, Filter, CheckSquare, Square
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type IndustryType =
    | 'solar' | 'telecom' | 'utilities' | 'insurance' | 'construction' | 'general';

export type FaultStatus = 'pending' | 'verified' | 'false_positive' | 'needs_reinspection';

interface FaultRecord {
    id: string;
    deployment_id?: string;
    missionId?: string;
    siteName?: string;
    industryType?: IndustryType;
    assetName?: string;
    assetType?: string;
    block_name?: string;
    blockName?: string;
    severity?: 'low' | 'medium' | 'moderate' | 'high' | 'critical';
    confidence?: number;
    confidence_score?: number;
    anomalyMetricValue?: number;
    temperature_delta?: number;
    anomalyMetricLabel?: string;
    estimatedAnnualLoss?: number;
    review_status?: FaultStatus | string;
    status?: string;
    fault_type?: string;
    faultType?: string;
    thermalImageUrl?: string;
    rgbImageUrl?: string;
    latitude?: number | null;
    longitude?: number | null;
    inspectionDate?: string;
    detected_at?: string;
    createdAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    aiNotes?: string;
    ai_detected?: boolean;
}

interface MissionContext {
    siteName?: string;
    missionId?: string;
    inspectionDate?: string;
    assetCount?: number;
    industry?: IndustryType;
}

interface Props {
    deploymentId: string;
    deploymentTitle?: string;
    industryType?: IndustryType;
    missionContext?: MissionContext;
}

// ─────────────────────────────────────────────────────────────
// INDUSTRY HELPERS
// ─────────────────────────────────────────────────────────────
function getAssetLabel(ind?: IndustryType) {
    const map: Record<IndustryType, string> = {
        solar: 'Panel / Block / String',
        telecom: 'Tower / Antenna / Mount',
        utilities: 'Pole / Span / Insulator',
        insurance: 'Roof Section / Slope',
        construction: 'Zone / Structure / Phase',
        general: 'Asset',
    };
    return map[ind ?? 'general'] ?? 'Asset';
}

function getFaultMetricLabel(ind?: IndustryType) {
    const map: Record<IndustryType, string> = {
        solar: 'Temp. Delta',
        telecom: 'Defect Severity',
        utilities: 'Condition Delta',
        insurance: 'Damage Score',
        construction: 'Progress Risk',
        general: 'Anomaly Value',
    };
    return map[ind ?? 'solar'] ?? 'Temp. Delta';
}

function getMetricUnit(ind?: IndustryType) {
    return ind === 'solar' || ind === 'utilities' ? '°C' : '';
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const FAULT_TYPES = [
    'hot_cell', 'bypass_diode_failure', 'string_outage',
    'connector_overheating', 'panel_mismatch', 'shading_anomaly',
    'minor_thermal_deviation',
];
const FAULT_LABELS: Record<string, string> = {
    hot_cell: 'Hot Cell', bypass_diode_failure: 'Bypass Diode',
    string_outage: 'String Outage', connector_overheating: 'Connector Overheat',
    panel_mismatch: 'Panel Mismatch', shading_anomaly: 'Shading Anomaly',
    minor_thermal_deviation: 'Minor Deviation',
};
const SEV_COLORS: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', moderate: '#f59e0b', medium: '#f59e0b', low: '#eab308',
};
const SEV_BG: Record<string, string> = {
    critical: 'rgba(239,68,68,0.12)', high: 'rgba(249,115,22,0.12)',
    moderate: 'rgba(245,158,11,0.12)', medium: 'rgba(245,158,11,0.12)', low: 'rgba(234,179,8,0.10)',
};
const STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b', verified: '#22c55e', false_positive: '#6b7280', needs_reinspection: '#818cf8',
};
const STATUS_BG: Record<string, string> = {
    pending: 'rgba(245,158,11,0.10)', verified: 'rgba(34,197,94,0.10)',
    false_positive: 'rgba(107,114,128,0.10)', needs_reinspection: 'rgba(129,140,248,0.10)',
};

// ─────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────
const Badge: React.FC<{ color: string; bg: string; label: string }> = ({ color, bg, label }) => (
    <span style={{
        background: bg, color, border: `1px solid ${color}44`,
        borderRadius: 5, padding: '2px 8px', fontSize: 9,
        fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
    }}>{label}</span>
);

const KpiCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode }> = ({ label, value, sub, color = '#818cf8', icon }) => (
    <div style={{
        background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.8)',
        borderRadius: 12, padding: '16px 18px', flex: 1, minWidth: 140,
        display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
        <div style={{ background: `${color}18`, borderRadius: 8, padding: 8, color, flexShrink: 0 }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{sub}</div>}
        </div>
    </div>
);

const ContextPill: React.FC<{ label: string; value?: string | number; icon?: React.ReactNode }> = ({ label, value, icon }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 8 }}>
        {icon && <span style={{ color: '#475569' }}>{icon}</span>}
        <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}:</span>
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{value ?? '—'}</span>
    </div>
);

// Empty state component
const EmptyState: React.FC<{ type: 'queue_empty' | 'no_detections' | 'no_mission' | 'filtered'; stats?: { verified: number; false_positive: number; total: number } }> = ({ type, stats }) => {
    if (type === 'no_mission') return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Crosshair size={28} color="#818cf8" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>Select a Mission to Begin Review</div>
            <div style={{ fontSize: 12, color: '#475569', maxWidth: 320 }}>Choose a mission from the Mission Terminal to load its fault detection queue here.</div>
        </div>
    );
    if (type === 'no_detections') return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Shield size={28} color="#22c55e" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>No Faults Detected</div>
            <div style={{ fontSize: 12, color: '#475569', maxWidth: 320 }}>No anomalies were detected for this inspection. System is ready for new analysis uploads.</div>
        </div>
    );
    if (type === 'queue_empty') return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <CheckCircle2 size={28} color="#22c55e" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>All Detected Faults Reviewed</div>
            <div style={{ fontSize: 12, color: '#475569', maxWidth: 340, marginBottom: 20 }}>Every detection in this queue has been reviewed. Excellent work.</div>
            <div style={{ display: 'flex', gap: 16 }}>
                {[
                    { label: 'Total Reviewed', value: stats?.total ?? 0, color: '#94a3b8' },
                    { label: 'Verified', value: stats?.verified ?? 0, color: '#22c55e' },
                    { label: 'False Positives', value: stats?.false_positive ?? 0, color: '#6b7280' },
                ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
    return (
        <div style={{ textAlign: 'center', padding: '48px 32px', color: '#475569', fontSize: 12 }}>
            No faults match the current filters.
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// QUEUE ROW
// ─────────────────────────────────────────────────────────────
const QueueRow: React.FC<{
    fault: FaultRecord;
    isSelected: boolean;
    isChecked: boolean;
    isActive: boolean;
    onClick: () => void;
    onCheck: () => void;
    metricLabel: string;
    metricUnit: string;
}> = ({ fault, isSelected, isChecked, isActive, onClick, onCheck, metricLabel, metricUnit }) => {
    const sev = fault.severity || 'low';
    const stat = (fault.review_status || 'pending') as string;
    const conf = fault.confidence_score ?? fault.confidence ?? 0;
    const delta = fault.temperature_delta ?? fault.anomalyMetricValue ?? 0;
    const blockName = fault.block_name ?? fault.blockName ?? fault.assetName;

    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                borderBottom: '1px solid rgba(30,41,59,0.8)',
                background: isActive ? 'rgba(99,102,241,0.08)' : isSelected ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'rgba(255,255,255,0.02)' : 'transparent'; }}
        >
            {/* Checkbox */}
            <div onClick={e => { e.stopPropagation(); onCheck(); }} style={{ paddingTop: 2, flexShrink: 0, color: isChecked ? '#818cf8' : '#334155', cursor: 'pointer' }}>
                {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <Badge color={SEV_COLORS[sev] || '#6b7280'} bg={SEV_BG[sev] || 'rgba(107,114,128,0.1)'} label={sev} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {FAULT_LABELS[fault.fault_type || ''] || fault.fault_type || fault.faultType || 'Unknown Fault'}
                    </span>
                    {fault.ai_detected && <Badge color="#818cf8" bg="rgba(129,140,248,0.1)" label="AI" />}
                </div>

                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#64748b', flexWrap: 'wrap' }}>
                    {blockName && <span>📍 {blockName}</span>}
                    {delta > 0 && <span style={{ color: SEV_COLORS[sev] }}>Δ{delta}{metricUnit}</span>}
                    {conf > 0 && <span>{conf}% conf.</span>}
                    {fault.estimatedAnnualLoss && <span style={{ color: '#22c55e' }}>${fault.estimatedAnnualLoss.toLocaleString()}/yr</span>}
                </div>
            </div>

            <Badge
                color={STATUS_COLORS[stat] || '#6b7280'}
                bg={STATUS_BG[stat] || 'rgba(107,114,128,0.1)'}
                label={stat.replace('_', ' ')}
            />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// FAULT DETAIL PANEL
// ─────────────────────────────────────────────────────────────
const FaultDetailPanel: React.FC<{
    fault: FaultRecord | null;
    saving: string | null;
    editDraft: { fault_type: string; severity: string };
    onEditDraft: (field: string, value: string) => void;
    onReview: (faultId: string, status: string) => void;
    industryType?: IndustryType;
}> = ({ fault, saving, editDraft, onEditDraft, onReview, industryType }) => {
    if (!fault) return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 16 }}>
            <div style={{ width: 56, height: 56, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Eye size={24} color="#6366f1" strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>Select a Fault to Review</div>
                <div style={{ fontSize: 12, color: '#475569', maxWidth: 240 }}>Click any row in the queue to load full fault details and review options.</div>
            </div>
        </div>
    );

    const sev = fault.severity || 'low';
    const stat = (fault.review_status || 'pending') as string;
    const conf = fault.confidence_score ?? fault.confidence ?? 0;
    const delta = fault.temperature_delta ?? fault.anomalyMetricValue ?? 0;
    const metricLabel = getFaultMetricLabel(industryType);
    const metricUnit = getMetricUnit(industryType);

    const sectionTitle = (label: string, icon: React.ReactNode) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(30,41,59,0.8)' }}>
            <span style={{ color: '#475569' }}>{icon}</span>
            <span style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
        </div>
    );

    const fieldRow = (label: string, value?: string | number | null, color?: string) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 11, color: color || '#94a3b8', fontWeight: 700 }}>{value ?? '—'}</span>
        </div>
    );

    const section = (content: React.ReactNode) => (
        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.8)', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
            {content}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            {/* Detail Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(30,41,59,0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
                        {FAULT_LABELS[fault.fault_type || ''] || fault.fault_type || 'Unknown Fault'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Badge color={SEV_COLORS[sev] || '#6b7280'} bg={SEV_BG[sev] || ''} label={sev} />
                        <Badge color={STATUS_COLORS[stat] || '#6b7280'} bg={STATUS_BG[stat] || ''} label={stat.replace('_', ' ')} />
                        {fault.ai_detected && <Badge color="#818cf8" bg="rgba(129,140,248,0.1)" label="AI Detected" />}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button title="Open Mission" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.7)', color: '#64748b', borderRadius: 7, padding: '5px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                        <ArrowUpRight size={12} /> Mission
                    </button>
                    <button title="Export Record" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.7)', color: '#64748b', borderRadius: 7, padding: '5px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                        <Download size={12} /> Export
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {/* PREVIEW */}
                {section(<>
                    {sectionTitle('Preview', <Eye size={13} />)}
                    {fault.thermalImageUrl ? (
                        <img src={fault.thermalImageUrl} alt="Thermal" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 200 }} />
                    ) : (
                        <div style={{
                            height: 160, background: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(249,115,22,0.04) 50%, rgba(15,23,42,0.8) 100%)',
                            border: '1px solid rgba(239,68,68,0.12)', borderRadius: 10,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                        }}>
                            <Thermometer size={32} color="#ef444440" strokeWidth={1} />
                            <div style={{ fontSize: 10, color: '#334155', fontWeight: 600 }}>No thermal image available</div>
                        </div>
                    )}
                </>)}

                {/* AI ANALYSIS */}
                {section(<>
                    {sectionTitle('AI Analysis', <Activity size={13} />)}
                    {fieldRow('Fault Type', FAULT_LABELS[fault.fault_type || ''] || fault.fault_type)}
                    {fieldRow('Severity', sev.toUpperCase(), SEV_COLORS[sev])}
                    {fieldRow('AI Confidence', conf > 0 ? `${conf}%` : '—', conf > 80 ? '#22c55e' : conf > 60 ? '#f59e0b' : '#ef4444')}
                    {fieldRow(metricLabel, delta > 0 ? `${delta}${metricUnit}` : '—', SEV_COLORS[sev])}
                    {fieldRow('Detection Time', fault.detected_at ? new Date(fault.detected_at).toLocaleString() : '—')}
                    {fault.aiNotes && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, padding: '10px 12px', background: 'rgba(129,140,248,0.05)', border: '1px solid rgba(129,140,248,0.12)', borderRadius: 8, fontStyle: 'italic' }}>{fault.aiNotes}</div>}
                </>)}

                {/* ASSET CONTEXT */}
                {section(<>
                    {sectionTitle('Asset Context', <Building2 size={13} />)}
                    {fieldRow('Site', fault.siteName)}
                    {fieldRow(getAssetLabel(industryType).split('/')[0].trim(), fault.block_name ?? fault.blockName ?? fault.assetName)}
                    {fieldRow('Mission ID', fault.deployment_id ?? fault.missionId)}
                    {(fault.latitude || fault.longitude) && fieldRow('Coordinates', `${fault.latitude?.toFixed(4)}, ${fault.longitude?.toFixed(4)}`)}
                    {fieldRow('Inspection Date', fault.inspectionDate ?? (fault.detected_at ? new Date(fault.detected_at).toLocaleDateString() : undefined))}
                </>)}

                {/* FINANCIAL IMPACT */}
                {section(<>
                    {sectionTitle('Financial & Operational Impact', <BarChart3 size={13} />)}
                    {fieldRow('Est. Annual Loss', fault.estimatedAnnualLoss ? `$${fault.estimatedAnnualLoss.toLocaleString()}` : '$0', '#22c55e')}
                    {fieldRow('Priority Level', sev === 'critical' ? 'P1 — Immediate' : sev === 'high' ? 'P2 — Urgent' : sev === 'moderate' || sev === 'medium' ? 'P3 — Schedule' : 'P4 — Monitor', SEV_COLORS[sev])}
                    {fieldRow('Recommended Action', sev === 'critical' || sev === 'high' ? 'Dispatch field crew immediately' : 'Schedule follow-up inspection')}
                </>)}

                {/* RECLASSIFY */}
                {stat !== 'false_positive' && section(<>
                    {sectionTitle('Reclassify', <SlidersHorizontal size={13} />)}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Fault Type</div>
                            <select
                                value={editDraft.fault_type || fault.fault_type || ''}
                                onChange={e => onEditDraft('fault_type', e.target.value)}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(51,65,85,0.8)', color: '#e2e8f0', fontSize: 11, padding: '7px 10px', borderRadius: 7, outline: 'none' }}
                            >
                                {FAULT_TYPES.map(t => <option key={t} value={t}>{FAULT_LABELS[t] || t}</option>)}
                            </select>
                        </div>
                        <div>
                            <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Severity</div>
                            <select
                                value={editDraft.severity || fault.severity || 'low'}
                                onChange={e => onEditDraft('severity', e.target.value)}
                                style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(51,65,85,0.8)', color: '#e2e8f0', fontSize: 11, padding: '7px 10px', borderRadius: 7, outline: 'none' }}
                            >
                                {['critical', 'high', 'moderate', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </>)}

                {/* REVIEW ACTIONS */}
                {section(<>
                    {sectionTitle('Review Actions', <Shield size={13} />)}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {stat !== 'verified' && (
                            <button
                                onClick={() => onReview(fault.id, 'verified')}
                                disabled={saving === fault.id}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '10px 16px', background: 'rgba(34,197,94,0.12)',
                                    border: '1px solid rgba(34,197,94,0.3)', borderRadius: 9,
                                    color: '#22c55e', fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                <CheckCircle2 size={15} />
                                {saving === fault.id ? 'Saving...' : 'Verify Fault'}
                            </button>
                        )}
                        {stat !== 'false_positive' && (
                            <button
                                onClick={() => onReview(fault.id, 'false_positive')}
                                disabled={saving === fault.id}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '10px 16px', background: 'rgba(107,114,128,0.10)',
                                    border: '1px solid rgba(107,114,128,0.25)', borderRadius: 9,
                                    color: '#9ca3af', fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                <XCircle size={15} />
                                Mark False Positive
                            </button>
                        )}
                        {stat !== 'needs_reinspection' && (
                            <button
                                onClick={() => onReview(fault.id, 'needs_reinspection')}
                                disabled={saving === fault.id}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '10px 16px', background: 'rgba(129,140,248,0.08)',
                                    border: '1px solid rgba(129,140,248,0.20)', borderRadius: 9,
                                    color: '#818cf8', fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                <RotateCcw size={15} />
                                Needs Reinspection
                            </button>
                        )}
                        {stat !== 'pending' && (
                            <button
                                onClick={() => onReview(fault.id, 'pending')}
                                disabled={saving === fault.id}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '8px 16px', background: 'rgba(245,158,11,0.08)',
                                    border: '1px solid rgba(245,158,11,0.18)', borderRadius: 9,
                                    color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                <RotateCcw size={14} />
                                Re-queue to Pending
                            </button>
                        )}
                    </div>
                </>)}

                {/* REVIEW HISTORY */}
                {section(<>
                    {sectionTitle('Review History', <Clock size={13} />)}
                    {fieldRow('Created by', fault.ai_detected ? 'AI Detection System' : 'Manual Entry')}
                    {fieldRow('Detected', fault.detected_at ? new Date(fault.detected_at).toLocaleString() : '—')}
                    {fieldRow('Reviewed by', fault.reviewedBy ?? (fault.review_status !== 'pending' ? 'Admin' : 'Pending'))}
                    {fieldRow('Reviewed at', fault.reviewedAt ? new Date(fault.reviewedAt).toLocaleString() : '—')}
                    {fieldRow('Final Status', stat.replace('_', ' ').toUpperCase(), STATUS_COLORS[stat])}
                </>)}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export const FaultReviewCenter: React.FC<Props> = ({
    deploymentId,
    deploymentTitle,
    industryType = 'solar',
    missionContext,
}) => {
    const [faults, setFaults] = useState<FaultRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<FaultStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFault, setSelectedFault] = useState<FaultRecord | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [editDrafts, setEditDrafts] = useState<Record<string, { fault_type: string; severity: string }>>({});
    const [bulkNotice, setBulkNotice] = useState<string | null>(null);

    const stats = {
        total: faults.length,
        pending: faults.filter(f => f.review_status === 'pending').length,
        verified: faults.filter(f => f.review_status === 'verified').length,
        false_positive: faults.filter(f => f.review_status === 'false_positive').length,
        needs_reinspection: faults.filter(f => f.review_status === 'needs_reinspection').length,
        estimated_loss: faults.reduce((sum, f) => sum + (f.estimatedAnnualLoss || 0), 0),
    };

    const reviewPct = stats.total > 0
        ? Math.round(((stats.verified + stats.false_positive) / stats.total) * 100)
        : 0;

    const fetchFaults = useCallback(async () => {
        if (!deploymentId) { setLoading(false); return; }
        setLoading(true);
        try {
            const r = await fetch(`/api/faults/deployment/${deploymentId}?limit=200`, { credentials: 'include' });
            const data = await r.json();
            if (data.success) setFaults(data.data as FaultRecord[]);
        } catch { /* no-op */ }
        finally { setLoading(false); }
    }, [deploymentId]);

    useEffect(() => { fetchFaults(); }, [fetchFaults]);

    const handleReview = async (faultId: string, reviewStatus: string) => {
        setSaving(faultId);
        const edits = editDrafts[faultId] || {};
        try {
            await fetch(`/api/thermal/faults/${faultId}/review`, {
                method: 'PATCH', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ review_status: reviewStatus, ...edits }),
            });
            setFaults(prev => prev.map(f => f.id === faultId ? { ...f, review_status: reviewStatus as any, ...edits } : f));
            if (selectedFault?.id === faultId) setSelectedFault(prev => prev ? { ...prev, review_status: reviewStatus as any } : prev);
            setEditDrafts(prev => { const n = { ...prev }; delete n[faultId]; return n; });
        } catch { /* no-op */ }
        finally { setSaving(null); }
    };

    const handleBulkAction = (action: string) => {
        const ids = Array.from(checkedIds);
        if (ids.length === 0) return;
        // TODO: wire to real bulk endpoints when available
        setBulkNotice(`${action} applied to ${ids.length} fault(s). Backend endpoint pending.`);
        setTimeout(() => setBulkNotice(null), 3500);
        setCheckedIds(new Set());
    };

    const setEditDraft = (faultId: string, field: string, value: string) => {
        setEditDrafts(prev => ({
            ...prev,
            [faultId]: { ...(prev[faultId] || {}), [field]: value } as any,
        }));
    };

    const filtered = faults
        .filter(f => statusFilter === 'all' || f.review_status === statusFilter)
        .filter(f => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                (f.fault_type || '').toLowerCase().includes(q) ||
                (f.block_name || '').toLowerCase().includes(q) ||
                (f.blockName || '').toLowerCase().includes(q) ||
                (f.assetName || '').toLowerCase().includes(q) ||
                (f.siteName || '').toLowerCase().includes(q)
            );
        });

    const metricLabel = getFaultMetricLabel(industryType);
    const metricUnit = getMetricUnit(industryType);
    const assetLabel = getAssetLabel(industryType);

    const font = "'Inter', system-ui, sans-serif";

    const filterBtnStyle = (active: boolean, color: string) => ({
        padding: '6px 14px', borderRadius: 8, fontSize: 10, fontWeight: 800,
        textTransform: 'uppercase' as const, letterSpacing: '0.06em',
        border: `1px solid ${active ? `${color}55` : 'rgba(51,65,85,0.7)'}`,
        background: active ? `${color}14` : 'transparent',
        color: active ? color : '#475569', cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: font,
    });

    return (
        <div style={{ fontFamily: font, color: '#e2e8f0', display: 'flex', flexDirection: 'column', height: '100%', background: '#020817' }}>

            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                            <div style={{ width: 6, height: 6, background: '#6366f1', borderRadius: '50%', boxShadow: '0 0 8px #6366f188' }} />
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                                FAULT REVIEW CENTER
                            </h2>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.02em' }}>
                            AI Detection Verification and Operational Review
                        </p>
                    </div>
                    <button
                        onClick={fetchFaults}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 9, color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font }}
                    >
                        <RefreshCcw size={12} /> Refresh
                    </button>
                </div>

                {/* ── CONTEXT BAR ── */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    <ContextPill label="Industry" value={(industryType || 'Solar').charAt(0).toUpperCase() + (industryType || 'solar').slice(1)} icon={<Layers size={10} />} />
                    <ContextPill label="Site" value={missionContext?.siteName ?? deploymentTitle ?? '—'} icon={<MapPin size={10} />} />
                    <ContextPill label="Mission" value={missionContext?.missionId ?? (deploymentId ? deploymentId.slice(0, 8).toUpperCase() : '—')} icon={<Building2 size={10} />} />
                    <ContextPill label="Inspection" value={missionContext?.inspectionDate ?? new Date().toISOString().split('T')[0]} icon={<Calendar size={10} />} />
                    <ContextPill label="Detected" value={stats.total} icon={<AlertTriangle size={10} />} />
                    <ContextPill label="Pending" value={stats.pending} icon={<Clock size={10} />} />
                    <ContextPill label="Reviewed" value={`${reviewPct}%`} icon={<CheckCircle2 size={10} />} />
                </div>

                {/* ── KPI STRIP ── */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                    <KpiCard label="Total Detections" value={stats.total} icon={<Crosshair size={16} />} color="#818cf8" sub="all faults" />
                    <KpiCard label="Pending Review" value={stats.pending} icon={<Clock size={16} />} color="#f59e0b" sub="awaiting review" />
                    <KpiCard label="Verified" value={stats.verified} icon={<CheckCircle2 size={16} />} color="#22c55e" sub="confirmed faults" />
                    <KpiCard label="False Positives" value={stats.false_positive} icon={<XCircle size={16} />} color="#6b7280" sub="dismissed" />
                    <KpiCard
                        label="Est. Annual Loss"
                        value={stats.estimated_loss > 0 ? `$${(stats.estimated_loss / 1000).toFixed(1)}K` : '$0'}
                        icon={<Zap size={16} />}
                        color="#ef4444"
                        sub="from verified faults"
                    />
                </div>

                {/* ── FILTER CHIPS ── */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    <button onClick={() => setStatusFilter('all')} style={filterBtnStyle(statusFilter === 'all', '#818cf8')}>All ({stats.total})</button>
                    <button onClick={() => setStatusFilter('pending')} style={filterBtnStyle(statusFilter === 'pending', '#f59e0b')}>Pending ({stats.pending})</button>
                    <button onClick={() => setStatusFilter('verified')} style={filterBtnStyle(statusFilter === 'verified', '#22c55e')}>Verified ({stats.verified})</button>
                    <button onClick={() => setStatusFilter('false_positive')} style={filterBtnStyle(statusFilter === 'false_positive', '#6b7280')}>False Positive ({stats.false_positive})</button>
                    {stats.needs_reinspection > 0 && (
                        <button onClick={() => setStatusFilter('needs_reinspection')} style={filterBtnStyle(statusFilter === 'needs_reinspection', '#818cf8')}>Reinspect ({stats.needs_reinspection})</button>
                    )}
                </div>
            </div>

            {/* ── WORKSPACE ──────────────────────────────────────────────── */}
            {!deploymentId ? (
                <EmptyState type="no_mission" />
            ) : loading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, color: '#475569' }}>
                    <div style={{ width: 36, height: 36, border: '2px solid #1e293b', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Loading fault queue...</div>
                </div>
            ) : faults.length === 0 ? (
                <EmptyState type="no_detections" />
            ) : (
                <div style={{ flex: 1, display: 'flex', minHeight: 0, gap: 1 }}>

                    {/* LEFT — QUEUE */}
                    <div style={{ width: '38%', minWidth: 280, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(30,41,59,0.8)' }}>
                        {/* Search + bulk actions */}
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(30,41,59,0.8)', flexShrink: 0 }}>
                            <div style={{ position: 'relative', marginBottom: checkedIds.size > 0 ? 10 : 0 }}>
                                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#334155' }} />
                                <input
                                    type="text"
                                    placeholder="Search faults..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.7)',
                                        borderRadius: 8, color: '#94a3b8', fontSize: 11, padding: '7px 10px 7px 30px',
                                        outline: 'none', fontFamily: font,
                                    }}
                                />
                            </div>

                            {/* Bulk actions */}
                            {checkedIds.size > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, alignSelf: 'center' }}>{checkedIds.size} selected</span>
                                    {[
                                        { label: 'Verify All', action: 'bulk_verify', color: '#22c55e' },
                                        { label: 'False Positive', action: 'bulk_false_positive', color: '#6b7280' },
                                        { label: 'Export', action: 'bulk_export', color: '#818cf8' },
                                    ].map(b => (
                                        <button key={b.action} onClick={() => handleBulkAction(b.action)} style={{
                                            padding: '4px 10px', background: `${b.color}12`, border: `1px solid ${b.color}30`,
                                            borderRadius: 6, color: b.color, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: font,
                                        }}>{b.label}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {filtered.length === 0 ? (
                                statusFilter === 'pending' && stats.pending === 0 ? (
                                    <EmptyState type="queue_empty" stats={stats} />
                                ) : (
                                    <EmptyState type="filtered" />
                                )
                            ) : filtered.map(fault => (
                                <QueueRow
                                    key={fault.id}
                                    fault={fault}
                                    isSelected={checkedIds.has(fault.id)}
                                    isChecked={checkedIds.has(fault.id)}
                                    isActive={selectedFault?.id === fault.id}
                                    onClick={() => {
                                        setSelectedFault(fault);
                                        setEditDrafts(prev => ({
                                            ...prev,
                                            [fault.id]: { fault_type: fault.fault_type || '', severity: fault.severity || 'low' },
                                        }));
                                    }}
                                    onCheck={() => setCheckedIds(prev => {
                                        const n = new Set(prev);
                                        n.has(fault.id) ? n.delete(fault.id) : n.add(fault.id);
                                        return n;
                                    })}
                                    metricLabel={metricLabel}
                                    metricUnit={metricUnit}
                                />
                            ))}
                        </div>

                        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(30,41,59,0.8)', fontSize: 10, color: '#334155', fontWeight: 600, flexShrink: 0 }}>
                            {filtered.length} of {faults.length} faults · {assetLabel}
                        </div>
                    </div>

                    {/* RIGHT — DETAIL */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <FaultDetailPanel
                            fault={selectedFault}
                            saving={saving}
                            editDraft={selectedFault ? (editDrafts[selectedFault.id] || { fault_type: selectedFault.fault_type || '', severity: selectedFault.severity || 'low' }) : { fault_type: '', severity: 'low' }}
                            onEditDraft={(field, value) => selectedFault && setEditDraft(selectedFault.id, field, value)}
                            onReview={handleReview}
                            industryType={industryType}
                        />
                    </div>
                </div>
            )}

            {/* Bulk notice toast */}
            {bulkNotice && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, background: '#1e293b',
                    border: '1px solid #334155', borderRadius: 10, padding: '12px 18px',
                    fontSize: 12, color: '#94a3b8', fontFamily: font, zIndex: 9999,
                    display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                    ℹ️ {bulkNotice}
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default FaultReviewCenter;
