/**
 * EmptyState.tsx — Axis Enterprise Contextual Empty States
 * ═══════════════════════════════════════════════════════════
 * Replace raw "no data" renders with informative, branded empty states.
 *
 * Usage:
 *   <EmptyState icon={Upload} title="Awaiting ingestion" subtitle="Upload imagery to begin" />
 *   <EmptyState icon={Radar} title="Pipeline active" pulse />
 *   <EmptyState icon={Database} title="No verified data yet" action={{ label: "Create Mission", onClick: fn }} />
 */
import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** If true, animates icon to indicate active processing */
  pulse?: boolean;
  /** Render a loading spinner instead of icon */
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  secondaryAction,
  pulse = false,
  loading = false,
  size = 'md',
  className,
}: EmptyStateProps) {
  const iconSizes = { sm: 20, md: 28, lg: 36 };
  const containerPad = { sm: '2rem 1.5rem', md: '3rem 2rem', lg: '4rem 2.5rem' };
  const iconSize = iconSizes[size];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: containerPad[size],
        textAlign: 'center',
        gap: 0,
      }}
    >
      {/* Icon container */}
      <div
        style={{
          width: iconSize + 24,
          height: iconSize + 24,
          borderRadius: '50%',
          background: 'rgba(100,116,139,0.08)',
          border: '1px solid rgba(100,116,139,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          flexShrink: 0,
          ...(pulse ? { animation: 'status-pulse 2s ease-in-out infinite' } : {}),
        }}
      >
        {loading ? (
          <Loader2
            size={iconSize}
            color="#475569"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        ) : Icon ? (
          <Icon size={iconSize} color="#475569" strokeWidth={1.5} />
        ) : (
          <span style={{ fontSize: iconSize, color: '#475569' }}>○</span>
        )}
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: size === 'sm' ? 12 : size === 'md' ? 13 : 15,
          fontWeight: 700,
          color: '#cbd5e1',
          margin: 0,
          marginBottom: subtitle ? 6 : action ? 16 : 0,
        }}
      >
        {title}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p
          style={{
            fontSize: size === 'sm' ? 11 : 12,
            fontWeight: 500,
            color: '#475569',
            margin: 0,
            marginBottom: action ? 20 : 0,
            maxWidth: 280,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {action && (
            <button
              onClick={action.onClick}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: '1px solid rgba(96,165,250,0.4)',
                background: action.variant === 'ghost' ? 'transparent' : 'rgba(59,130,246,0.15)',
                color: '#60a5fa',
                transition: 'background 0.15s',
              }}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: '1px solid rgba(100,116,139,0.2)',
                background: 'transparent',
                color: '#64748b',
                transition: 'background 0.15s',
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader — uniform loading placeholder ──────────────────────────────
interface SkeletonProps {
  rows?: number;
  height?: number;
  gap?: number;
}

export function SkeletonList({ rows = 3, height = 64, gap = 8 }: SkeletonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: 10,
            background: 'rgba(100,116,139,0.08)',
            border: '1px solid rgba(100,116,139,0.1)',
            animation: 'skeleton-pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 12,
        background: 'rgba(100,116,139,0.08)',
        border: '1px solid rgba(100,116,139,0.1)',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

export default EmptyState;
