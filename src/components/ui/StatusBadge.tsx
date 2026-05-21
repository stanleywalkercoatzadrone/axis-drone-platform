/**
 * StatusBadge.tsx — Axis Enterprise Canonical Status System
 * ═══════════════════════════════════════════════════════════
 * Maps all raw DB status strings to the 11 canonical enterprise statuses.
 * Usage: <StatusBadge status="processing" />
 *        <StatusBadge status="in_flight" size="sm" />
 */
import React from 'react';

// ── Canonical status definitions ─────────────────────────────────────────────
export type CanonicalStatus =
  | 'draft'
  | 'scheduled'
  | 'assigned'
  | 'uploading'
  | 'processing'
  | 'ai-review'
  | 'verified'
  | 'delivered'
  | 'archived'
  | 'blocked'
  | 'escalated';

// ── DB value → canonical status translation layer ────────────────────────────
const STATUS_MAP: Record<string, CanonicalStatus> = {
  // Draft / initial states
  'draft':         'draft',
  'pending':       'draft',
  'queued':        'draft',
  'not_started':   'draft',
  'open':          'draft',

  // Scheduled
  'scheduled':     'scheduled',
  'planned':       'scheduled',

  // Assigned
  'assigned':      'assigned',
  'in_progress':   'assigned',
  'active':        'assigned',
  'in_flight':     'assigned',

  // Uploading
  'uploading':     'uploading',
  'uploaded':      'uploading',

  // Processing
  'processing':    'processing',
  'validating':    'processing',
  'generating_tiles': 'processing',
  'partial_failure': 'processing',

  // AI Review
  'ai_review':     'ai-review',
  'needs_review':  'ai-review',
  'review':        'ai-review',

  // Verified / completed
  'verified':      'verified',
  'completed':     'verified',
  'complete':      'verified',
  'done':          'verified',
  'human_verified': 'verified',

  // Delivered
  'delivered':     'delivered',
  'published':     'delivered',
  'sent':          'delivered',

  // Archived
  'archived':      'archived',
  'cancelled':     'archived',
  'canceled':      'archived',

  // Blocked / failed
  'blocked':       'blocked',
  'failed':        'blocked',
  'error':         'blocked',

  // Escalated
  'escalated':     'escalated',
  'critical':      'escalated',
  'flagged':       'escalated',
};

// ── Visual config per canonical status ───────────────────────────────────────
const STATUS_CONFIG: Record<CanonicalStatus, {
  label: string;
  bg: string;
  border: string;
  color: string;
  dot: string;
}> = {
  'draft':      { label: 'Draft',      bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)', color: '#94a3b8', dot: '#64748b' },
  'scheduled':  { label: 'Scheduled',  bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.25)',  color: '#60a5fa', dot: '#3b82f6' },
  'assigned':   { label: 'Assigned',   bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)',  color: '#818cf8', dot: '#6366f1' },
  'uploading':  { label: 'Uploading',  bg: 'rgba(14,165,233,0.10)',  border: 'rgba(14,165,233,0.25)',  color: '#38bdf8', dot: '#0ea5e9' },
  'processing': { label: 'Processing', bg: 'rgba(168,85,247,0.10)', border: 'rgba(168,85,247,0.25)', color: '#c084fc', dot: '#a855f7' },
  'ai-review':  { label: 'AI Review',  bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', color: '#fbbf24', dot: '#f59e0b' },
  'verified':   { label: 'Verified',   bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)',  color: '#4ade80', dot: '#22c55e' },
  'delivered':  { label: 'Delivered',  bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)', color: '#34d399', dot: '#10b981' },
  'archived':   { label: 'Archived',   bg: 'rgba(71,85,105,0.10)',  border: 'rgba(71,85,105,0.2)',   color: '#64748b', dot: '#475569' },
  'blocked':    { label: 'Blocked',    bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)',  color: '#f87171', dot: '#ef4444' },
  'escalated':  { label: 'Escalated',  bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.25)', color: '#fb923c', dot: '#f97316' },
};

// ── StatusBadge component ─────────────────────────────────────────────────────
interface StatusBadgeProps {
  status: string;
  size?: 'xs' | 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = 'sm', showDot = true, className }: StatusBadgeProps) {
  const canonical = STATUS_MAP[status?.toLowerCase()] ?? 'draft';
  const cfg = STATUS_CONFIG[canonical];

  const fontSize = size === 'xs' ? 9 : size === 'sm' ? 10 : 11;
  const padding  = size === 'xs' ? '2px 7px' : size === 'sm' ? '3px 9px' : '4px 11px';
  const dotSize  = size === 'xs' ? 4 : 5;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding,
        borderRadius: 20,
        fontSize,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {showDot && (
        <span
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: cfg.dot,
            flexShrink: 0,
            ...(canonical === 'processing' || canonical === 'uploading' ? {
              animation: 'status-pulse 1.5s ease-in-out infinite',
            } : {}),
          }}
        />
      )}
      {cfg.label}
    </span>
  );
}

// ── Helper: resolve canonical label from raw status ───────────────────────────
export function resolveStatus(raw: string): CanonicalStatus {
  return STATUS_MAP[raw?.toLowerCase()] ?? 'draft';
}

// ── Helper: get just the color for a raw status ───────────────────────────────
export function statusColor(raw: string): string {
  return STATUS_CONFIG[resolveStatus(raw)].color;
}

export default StatusBadge;
