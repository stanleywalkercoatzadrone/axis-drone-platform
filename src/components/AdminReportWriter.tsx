/**
 * AdminReportWriter.tsx — Full-featured admin report authoring tool
 *
 * Features:
 * - Section-based editor (Header, Exec Summary, Findings, Recommendations, Appendix)
 * - Pre-built templates (Inspection Summary, Client Deliverable, Incident Report)
 * - Rich-text formatting toolbar (bold, italic, lists)
 * - Cost analysis tables
 * - Compliance checklist with pass/fail
 * - Risk assessment matrix
 * - PDF export via print
 * - Email send to clients/pilots/custom
 * - Draft save/load
 * - Report history list
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Plus, Save, Send, Printer, Trash2, ChevronDown, ChevronUp,
  Edit3, Eye, ArrowLeft, Search, X, CheckCircle, AlertCircle, Loader2,
  LayoutTemplate, Bold, Italic, List, ListOrdered, Type, Table,
  ClipboardCheck, ShieldAlert, Image as ImageIcon, GripVertical,
  ChevronRight, Clock, Users, Mail, Download, Copy, Archive
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportSection {
  id: string;
  type: 'header' | 'text' | 'findings' | 'recommendations' | 'cost_table' | 'compliance' | 'risk_matrix' | 'image' | 'appendix';
  title: string;
  content: string;
  // For findings
  items?: FindingItem[];
  // For cost table
  rows?: CostRow[];
  // For compliance
  checks?: ComplianceCheck[];
  // For risk matrix
  risks?: RiskItem[];
  collapsed?: boolean;
}

interface FindingItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location?: string;
}

interface CostRow {
  id: string;
  item: string;
  description: string;
  quantity: number;
  unitCost: number;
}

interface ComplianceCheck {
  id: string;
  standard: string;
  requirement: string;
  status: 'pass' | 'fail' | 'na' | 'pending';
  notes: string;
}

interface RiskItem {
  id: string;
  risk: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  severity: 1 | 2 | 3 | 4 | 5;
  mitigation: string;
}

interface AdminReport {
  id?: string;
  title: string;
  report_type: string;
  sections: ReportSection[];
  status: 'draft' | 'sent' | 'archived';
  recipients?: Recipient[];
  sent_at?: string;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface Recipient {
  email: string;
  name: string;
  type: 'client' | 'pilot' | 'user' | 'custom';
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: Record<string, { label: string; description: string; icon: string; sections: ReportSection[] }> = {
  inspection_summary: {
    label: 'Inspection Summary',
    description: 'Standard post-inspection report with findings, recommendations, and cost analysis',
    icon: '🔍',
    sections: [
      { id: 's1', type: 'header', title: 'Inspection Summary', content: '' },
      { id: 's2', type: 'text', title: 'Executive Summary', content: '<p>This report summarizes the findings from the inspection conducted on [DATE] at [SITE]. The inspection covered [SCOPE] and identified [N] findings requiring attention.</p>' },
      { id: 's3', type: 'findings', title: 'Key Findings', content: '', items: [
        { id: 'f1', severity: 'high', title: '', description: '', location: '' },
      ]},
      { id: 's4', type: 'cost_table', title: 'Cost Analysis', content: '', rows: [
        { id: 'c1', item: '', description: '', quantity: 1, unitCost: 0 },
      ]},
      { id: 's5', type: 'recommendations', title: 'Recommendations', content: '<ol><li>Address all critical and high-severity findings within 30 days</li><li>Schedule follow-up inspection within 90 days</li><li>Document all remediation actions for compliance records</li></ol>' },
      { id: 's6', type: 'compliance', title: 'Compliance Status', content: '', checks: [
        { id: 'ck1', standard: 'OSHA 29 CFR 1910', requirement: 'General electrical safety', status: 'pending', notes: '' },
        { id: 'ck2', standard: 'NEC 2023 Art. 690', requirement: 'Solar PV systems', status: 'pending', notes: '' },
      ]},
    ],
  },
  client_deliverable: {
    label: 'Client Deliverable',
    description: 'Professional client-facing report with branded layout',
    icon: '📋',
    sections: [
      { id: 's1', type: 'header', title: 'Client Inspection Report', content: '' },
      { id: 's2', type: 'text', title: 'Executive Summary', content: '<p>Dear [CLIENT],</p><p>Please find enclosed the results of the aerial inspection conducted at your facility. Our team utilized advanced drone technology and AI-powered analysis to provide a comprehensive assessment of your infrastructure.</p>' },
      { id: 's3', type: 'findings', title: 'Inspection Findings', content: '', items: [
        { id: 'f1', severity: 'medium', title: '', description: '', location: '' },
      ]},
      { id: 's4', type: 'risk_matrix', title: 'Risk Assessment', content: '', risks: [
        { id: 'r1', risk: '', likelihood: 3, severity: 3, mitigation: '' },
      ]},
      { id: 's5', type: 'recommendations', title: 'Action Items', content: '<ol><li></li></ol>' },
      { id: 's6', type: 'cost_table', title: 'Estimated Remediation Costs', content: '', rows: [
        { id: 'c1', item: '', description: '', quantity: 1, unitCost: 0 },
      ]},
      { id: 's7', type: 'text', title: 'Next Steps', content: '<p>We recommend scheduling a follow-up review to discuss these findings and agree on a remediation timeline. Our team is available to provide additional support as needed.</p>' },
    ],
  },
  incident_report: {
    label: 'Incident Report',
    description: 'Document and report safety incidents with severity classification',
    icon: '⚠️',
    sections: [
      { id: 's1', type: 'header', title: 'Incident Report', content: '' },
      { id: 's2', type: 'text', title: 'Incident Overview', content: '<p><strong>Date of Incident:</strong> [DATE]<br/><strong>Location:</strong> [LOCATION]<br/><strong>Reported By:</strong> [NAME]<br/><strong>Incident Type:</strong> [TYPE]</p><p><strong>Description:</strong></p><p>[Provide detailed description of the incident]</p>' },
      { id: 's3', type: 'findings', title: 'Root Cause Analysis', content: '', items: [
        { id: 'f1', severity: 'critical', title: '', description: '' },
      ]},
      { id: 's4', type: 'compliance', title: 'Regulatory Impact', content: '', checks: [
        { id: 'ck1', standard: '', requirement: '', status: 'pending', notes: '' },
      ]},
      { id: 's5', type: 'risk_matrix', title: 'Risk Assessment', content: '', risks: [
        { id: 'r1', risk: '', likelihood: 4, severity: 4, mitigation: '' },
      ]},
      { id: 's6', type: 'recommendations', title: 'Corrective Actions', content: '<ol><li>Immediate corrective action: [ACTION]</li><li>Preventive measure: [MEASURE]</li><li>Follow-up inspection date: [DATE]</li></ol>' },
    ],
  },
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ── API helpers ───────────────────────────────────────────────────────────────

const API = (path: string) => `/api/admin-reports${path}`;

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  const res = await fetch(API(path), {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEV_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  critical: { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#f87171', label: 'CRITICAL' },
  high:     { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#fb923c', label: 'HIGH' },
  medium:   { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24', label: 'MEDIUM' },
  low:      { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  text: '#4ade80', label: 'LOW' },
};

const RISK_COLORS = ['', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];

const COMPLIANCE_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  pass:    { bg: 'rgba(16,185,129,0.1)', text: '#10b981', label: '✓ PASS' },
  fail:    { bg: 'rgba(239,68,68,0.1)',  text: '#ef4444', label: '✕ FAIL' },
  na:      { bg: 'rgba(100,116,139,0.1)',text: '#64748b', label: 'N/A' },
  pending: { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', label: '⏳ PENDING' },
};

// ── Print / PDF export ────────────────────────────────────────────────────────

function buildPrintHTML(report: AdminReport): string {
  const sectionHTML = report.sections.map(sec => {
    let inner = '';
    switch (sec.type) {
      case 'header':
        inner = `<h1 class="rpt-h1">${report.title || sec.title}</h1>
                  <div class="rpt-meta">Type: ${report.report_type.replace(/_/g, ' ')} · Status: ${report.status} · ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</div>`;
        break;
      case 'text':
      case 'recommendations':
      case 'appendix':
        inner = `<h2 class="rpt-h2">${sec.title}</h2><div class="rpt-content">${sec.content}</div>`;
        break;
      case 'findings':
        inner = `<h2 class="rpt-h2">${sec.title}</h2>` +
          (sec.items || []).filter(f => f.title).map(f =>
            `<div class="finding-card sev-${f.severity}">
              <span class="sev-badge">${f.severity.toUpperCase()}</span>
              <strong>${f.title}</strong>${f.location ? ` — <em>${f.location}</em>` : ''}
              <p>${f.description}</p>
            </div>`
          ).join('');
        break;
      case 'cost_table':
        const total = (sec.rows || []).reduce((s, r) => s + r.quantity * r.unitCost, 0);
        inner = `<h2 class="rpt-h2">${sec.title}</h2>
          <table class="rpt-table"><thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr></thead><tbody>` +
          (sec.rows || []).filter(r => r.item).map(r =>
            `<tr><td>${r.item}</td><td>${r.description}</td><td>${r.quantity}</td><td>$${r.unitCost.toLocaleString()}</td><td>$${(r.quantity * r.unitCost).toLocaleString()}</td></tr>`
          ).join('') +
          `</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:700">Grand Total</td><td style="font-weight:700">$${total.toLocaleString()}</td></tr></tfoot></table>`;
        break;
      case 'compliance':
        inner = `<h2 class="rpt-h2">${sec.title}</h2>
          <table class="rpt-table"><thead><tr><th>Standard</th><th>Requirement</th><th>Status</th><th>Notes</th></tr></thead><tbody>` +
          (sec.checks || []).filter(c => c.standard).map(c =>
            `<tr><td>${c.standard}</td><td>${c.requirement}</td><td class="status-${c.status}">${COMPLIANCE_STATUS[c.status]?.label || c.status}</td><td>${c.notes}</td></tr>`
          ).join('') +
          `</tbody></table>`;
        break;
      case 'risk_matrix':
        inner = `<h2 class="rpt-h2">${sec.title}</h2>
          <table class="rpt-table"><thead><tr><th>Risk</th><th>Likelihood (1-5)</th><th>Severity (1-5)</th><th>Score</th><th>Mitigation</th></tr></thead><tbody>` +
          (sec.risks || []).filter(r => r.risk).map(r => {
            const score = r.likelihood * r.severity;
            return `<tr><td>${r.risk}</td><td>${r.likelihood}</td><td>${r.severity}</td><td style="font-weight:700;color:${score >= 16 ? '#ef4444' : score >= 9 ? '#f97316' : score >= 4 ? '#f59e0b' : '#22c55e'}">${score}</td><td>${r.mitigation}</td></tr>`;
          }).join('') +
          `</tbody></table>`;
        break;
      default:
        inner = `<h2 class="rpt-h2">${sec.title}</h2><div class="rpt-content">${sec.content}</div>`;
    }
    return `<div class="rpt-section">${inner}</div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${report.title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI',system-ui,Arial,sans-serif; }
    body { color:#1e293b; background:#fff; padding:40px; max-width:900px; margin:0 auto; }
    .rpt-h1 { font-size:24px; font-weight:800; color:#0f172a; border-bottom:3px solid #0ea5e9; padding-bottom:12px; margin-bottom:4px; }
    .rpt-meta { font-size:11px; color:#64748b; margin-bottom:28px; text-transform:uppercase; letter-spacing:0.1em; }
    .rpt-h2 { font-size:16px; font-weight:700; color:#0f172a; margin:24px 0 12px; padding-bottom:6px; border-bottom:1px solid #e2e8f0; }
    .rpt-content { font-size:13px; color:#334155; line-height:1.7; }
    .rpt-content p { margin-bottom:10px; }
    .rpt-content ol, .rpt-content ul { padding-left:24px; margin-bottom:10px; }
    .rpt-content li { margin-bottom:4px; }
    .finding-card { border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:10px; page-break-inside:avoid; }
    .finding-card.sev-critical { border-color:#fca5a5; background:#fef2f2; }
    .finding-card.sev-high { border-color:#fdba74; background:#fff7ed; }
    .finding-card.sev-medium { border-color:#fde68a; background:#fffbeb; }
    .finding-card.sev-low { border-color:#86efac; background:#f0fdf4; }
    .sev-badge { display:inline-block; font-size:9px; font-weight:800; padding:2px 8px; border-radius:4px; margin-right:8px; text-transform:uppercase; letter-spacing:0.1em; }
    .sev-critical .sev-badge { background:#fca5a5; color:#991b1b; }
    .sev-high .sev-badge { background:#fdba74; color:#9a3412; }
    .sev-medium .sev-badge { background:#fde68a; color:#92400e; }
    .sev-low .sev-badge { background:#86efac; color:#166534; }
    .finding-card p { font-size:12px; color:#475569; margin-top:6px; }
    .rpt-table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px; }
    .rpt-table th { background:#f1f5f9; padding:8px 12px; text-align:left; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#475569; border-bottom:2px solid #e2e8f0; }
    .rpt-table td { padding:8px 12px; border-bottom:1px solid #f1f5f9; }
    .rpt-table tfoot td { border-top:2px solid #e2e8f0; padding-top:10px; }
    .status-pass { color:#059669; font-weight:700; }
    .status-fail { color:#dc2626; font-weight:700; }
    .status-pending { color:#2563eb; }
    .status-na { color:#64748b; }
    .rpt-footer { margin-top:40px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:10px; color:#94a3b8; text-align:center; }
    @media print { @page { margin:0.75in; } }
  </style></head><body>
  ${sectionHTML}
  <div class="rpt-footer">Generated by Axis Enterprise Drone Platform · ${new Date().toLocaleString()} · Confidential</div>
  </body></html>`;
}

function exportPDF(report: AdminReport) {
  const html = buildPrintHTML(report);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.addEventListener('load', () => win.print());
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ── Section Editor Components ─────────────────────────────────────────────────

const SectionToolbar: React.FC<{ onFormat: (cmd: string, val?: string) => void }> = ({ onFormat }) => (
  <div style={{ display: 'flex', gap: 2, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
    {[
      { cmd: 'bold', icon: <Bold size={12} />, tip: 'Bold' },
      { cmd: 'italic', icon: <Italic size={12} />, tip: 'Italic' },
      { cmd: 'insertUnorderedList', icon: <List size={12} />, tip: 'Bullet list' },
      { cmd: 'insertOrderedList', icon: <ListOrdered size={12} />, tip: 'Numbered list' },
    ].map(b => (
      <button
        key={b.cmd}
        onMouseDown={e => { e.preventDefault(); onFormat(b.cmd); }}
        title={b.tip}
        style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6, padding: '4px 8px', color: '#94a3b8', cursor: 'pointer',
          display: 'flex', alignItems: 'center', transition: 'all 0.15s',
        }}
      >
        {b.icon}
      </button>
    ))}
  </div>
);

const RichEditor: React.FC<{ html: string; onChange: (html: string) => void; placeholder?: string }> = ({ html, onChange, placeholder }) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef(html);

  useEffect(() => {
    if (ref.current && html !== lastHtml.current) {
      ref.current.innerHTML = html;
      lastHtml.current = html;
    }
  }, [html]);

  const handleFormat = (cmd: string) => {
    document.execCommand(cmd, false);
    if (ref.current) {
      const newHtml = ref.current.innerHTML;
      lastHtml.current = newHtml;
      onChange(newHtml);
    }
  };

  return (
    <div>
      <SectionToolbar onFormat={handleFormat} />
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: html }}
        onInput={() => {
          if (ref.current) {
            const newHtml = ref.current.innerHTML;
            lastHtml.current = newHtml;
            onChange(newHtml);
          }
        }}
        data-placeholder={placeholder || 'Start typing...'}
        style={{
          minHeight: 100, padding: 12, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, color: '#e2e8f0', fontSize: 13, lineHeight: 1.7, outline: 'none',
        }}
      />
    </div>
  );
};

// ── Findings Editor ───────────────────────────────────────────────────────────

const FindingsEditor: React.FC<{ items: FindingItem[]; onChange: (items: FindingItem[]) => void }> = ({ items, onChange }) => {
  const update = (id: string, patch: Partial<FindingItem>) =>
    onChange(items.map(f => f.id === id ? { ...f, ...patch } : f));
  const add = () => onChange([...items, { id: uid(), severity: 'medium', title: '', description: '', location: '' }]);
  const remove = (id: string) => onChange(items.filter(f => f.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(f => {
        const s = SEV_STYLES[f.severity];
        return (
          <div key={f.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select
                value={f.severity}
                onChange={e => update(f.id, { severity: e.target.value as FindingItem['severity'] })}
                style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: s.text, fontSize: 10, fontWeight: 800, padding: '4px 8px', textTransform: 'uppercase' }}
              >
                {Object.keys(SEV_STYLES).map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
              </select>
              <input
                value={f.title} onChange={e => update(f.id, { title: e.target.value })}
                placeholder="Finding title..."
                style={{ flex: 1, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}
              />
              <input
                value={f.location || ''} onChange={e => update(f.id, { location: e.target.value })}
                placeholder="Location"
                style={{ width: 140, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 10px', color: '#94a3b8', fontSize: 12 }}
              />
              <button onClick={() => remove(f.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}><Trash2 size={13} /></button>
            </div>
            <textarea
              value={f.description} onChange={e => update(f.id, { description: e.target.value })}
              placeholder="Describe the finding..."
              rows={2}
              style={{ width: '100%', background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '8px 10px', color: '#cbd5e1', fontSize: 12, resize: 'vertical' }}
            />
          </div>
        );
      })}
      <button onClick={add} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
        background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
        borderRadius: 8, color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>
        <Plus size={13} /> Add Finding
      </button>
    </div>
  );
};

// ── Cost Table Editor ─────────────────────────────────────────────────────────

const CostTableEditor: React.FC<{ rows: CostRow[]; onChange: (rows: CostRow[]) => void }> = ({ rows, onChange }) => {
  const update = (id: string, patch: Partial<CostRow>) =>
    onChange(rows.map(r => r.id === id ? { ...r, ...patch } : r));
  const add = () => onChange([...rows, { id: uid(), item: '', description: '', quantity: 1, unitCost: 0 }]);
  const remove = (id: string) => onChange(rows.filter(r => r.id !== id));
  const total = rows.reduce((s, r) => s + r.quantity * r.unitCost, 0);

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Item', 'Description', 'Qty', 'Unit Cost', 'Total', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '6px 4px' }}>
                  <input value={r.item} onChange={e => update(r.id, { item: e.target.value })} placeholder="Item name"
                    style={{ width: '100%', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px', color: '#e2e8f0', fontSize: 12 }} />
                </td>
                <td style={{ padding: '6px 4px' }}>
                  <input value={r.description} onChange={e => update(r.id, { description: e.target.value })} placeholder="Description"
                    style={{ width: '100%', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px', color: '#cbd5e1', fontSize: 12 }} />
                </td>
                <td style={{ padding: '6px 4px', width: 70 }}>
                  <input type="number" value={r.quantity} onChange={e => update(r.id, { quantity: Number(e.target.value) || 0 })}
                    style={{ width: 60, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px', color: '#e2e8f0', fontSize: 12, textAlign: 'center' }} />
                </td>
                <td style={{ padding: '6px 4px', width: 110 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', marginRight: 2 }}>$</span>
                    <input type="number" value={r.unitCost} onChange={e => update(r.id, { unitCost: Number(e.target.value) || 0 })}
                      style={{ width: 90, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px', color: '#e2e8f0', fontSize: 12 }} />
                  </div>
                </td>
                <td style={{ padding: '6px 10px', color: '#38bdf8', fontWeight: 700, fontSize: 12 }}>
                  ${(r.quantity * r.unitCost).toLocaleString()}
                </td>
                <td style={{ padding: '6px 4px', width: 30 }}>
                  <button onClick={() => remove(r.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <button onClick={add} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 6, color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={12} /> Add Row
        </button>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8' }}>
          Total: ${total.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

// ── Compliance Editor ─────────────────────────────────────────────────────────

const ComplianceEditor: React.FC<{ checks: ComplianceCheck[]; onChange: (checks: ComplianceCheck[]) => void }> = ({ checks, onChange }) => {
  const update = (id: string, patch: Partial<ComplianceCheck>) =>
    onChange(checks.map(c => c.id === id ? { ...c, ...patch } : c));
  const add = () => onChange([...checks, { id: uid(), standard: '', requirement: '', status: 'pending', notes: '' }]);
  const remove = (id: string) => onChange(checks.filter(c => c.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {checks.map(c => {
        const st = COMPLIANCE_STATUS[c.status];
        return (
          <div key={c.id} style={{ background: st.bg, border: `1px solid ${st.text}33`, borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <select value={c.status} onChange={e => update(c.id, { status: e.target.value as ComplianceCheck['status'] })}
                style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: st.text, fontSize: 10, fontWeight: 800, padding: '4px 8px' }}>
                {Object.entries(COMPLIANCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input value={c.standard} onChange={e => update(c.id, { standard: e.target.value })} placeholder="Standard (e.g., OSHA 29 CFR 1910)"
                style={{ flex: 1, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 12, fontWeight: 600 }} />
              <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Trash2 size={12} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={c.requirement} onChange={e => update(c.id, { requirement: e.target.value })} placeholder="Requirement"
                style={{ flex: 1, background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 10px', color: '#cbd5e1', fontSize: 12 }} />
              <input value={c.notes} onChange={e => update(c.id, { notes: e.target.value })} placeholder="Notes"
                style={{ flex: 1, background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 10px', color: '#94a3b8', fontSize: 12 }} />
            </div>
          </div>
        );
      })}
      <button onClick={add} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
        borderRadius: 6, color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
      }}>
        <Plus size={12} /> Add Compliance Check
      </button>
    </div>
  );
};

// ── Risk Matrix Editor ────────────────────────────────────────────────────────

const RiskMatrixEditor: React.FC<{ risks: RiskItem[]; onChange: (risks: RiskItem[]) => void }> = ({ risks, onChange }) => {
  const update = (id: string, patch: Partial<RiskItem>) =>
    onChange(risks.map(r => r.id === id ? { ...r, ...patch } : r));
  const add = () => onChange([...risks, { id: uid(), risk: '', likelihood: 3, severity: 3, mitigation: '' }]);
  const remove = (id: string) => onChange(risks.filter(r => r.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {risks.map(r => {
        const score = r.likelihood * r.severity;
        const scoreColor = score >= 16 ? '#ef4444' : score >= 9 ? '#f97316' : score >= 4 ? '#f59e0b' : '#22c55e';
        return (
          <div key={r.id} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input value={r.risk} onChange={e => update(r.id, { risk: e.target.value })} placeholder="Risk description..."
                style={{ flex: 1, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 13, fontWeight: 600 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 9, color: '#64748b', display: 'block', fontWeight: 700 }}>LIKELY</span>
                  <select value={r.likelihood} onChange={e => update(r.id, { likelihood: Number(e.target.value) as RiskItem['likelihood'] })}
                    style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: RISK_COLORS[r.likelihood], fontSize: 12, fontWeight: 800, padding: '3px 6px', width: 46, textAlign: 'center' }}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <span style={{ color: '#475569', fontSize: 12 }}>×</span>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 9, color: '#64748b', display: 'block', fontWeight: 700 }}>IMPACT</span>
                  <select value={r.severity} onChange={e => update(r.id, { severity: Number(e.target.value) as RiskItem['severity'] })}
                    style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: RISK_COLORS[r.severity], fontSize: 12, fontWeight: 800, padding: '3px 6px', width: 46, textAlign: 'center' }}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <span style={{ color: '#475569', fontSize: 12 }}>=</span>
                <div style={{ background: `${scoreColor}20`, border: `1px solid ${scoreColor}40`, borderRadius: 8, padding: '4px 10px', minWidth: 38, textAlign: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: scoreColor }}>{score}</span>
                </div>
              </div>
              <button onClick={() => remove(r.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Trash2 size={13} /></button>
            </div>
            <input value={r.mitigation} onChange={e => update(r.id, { mitigation: e.target.value })} placeholder="Mitigation strategy..."
              style={{ width: '100%', background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 10px', color: '#94a3b8', fontSize: 12 }} />
          </div>
        );
      })}
      <button onClick={add} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
        borderRadius: 6, color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
      }}>
        <Plus size={12} /> Add Risk
      </button>
    </div>
  );
};

// ── Section renderer ──────────────────────────────────────────────────────────

const SECTION_TYPE_LABELS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  header:          { icon: <Type size={13} />,           label: 'Header',        color: '#38bdf8' },
  text:            { icon: <FileText size={13} />,       label: 'Rich Text',     color: '#818cf8' },
  findings:        { icon: <AlertCircle size={13} />,    label: 'Findings',      color: '#fb923c' },
  recommendations: { icon: <CheckCircle size={13} />,    label: 'Actions',       color: '#4ade80' },
  cost_table:      { icon: <Table size={13} />,          label: 'Cost Table',    color: '#38bdf8' },
  compliance:      { icon: <ClipboardCheck size={13} />, label: 'Compliance',    color: '#a78bfa' },
  risk_matrix:     { icon: <ShieldAlert size={13} />,    label: 'Risk Matrix',   color: '#f87171' },
  appendix:        { icon: <FileText size={13} />,       label: 'Appendix',      color: '#64748b' },
};

// ── Email Send Modal ──────────────────────────────────────────────────────────

const SendModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSend: (recipients: Recipient[]) => Promise<void>;
  sending: boolean;
}> = ({ open, onClose, onSend, sending }) => {
  const [recipients, setRecipients] = useState<Recipient[]>([{ email: '', name: '', type: 'client' }]);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const updateRecip = (i: number, patch: Partial<Recipient>) =>
    setRecipients(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const addRecip = () => setRecipients(rs => [...rs, { email: '', name: '', type: 'custom' }]);
  const removeRecip = (i: number) => setRecipients(rs => rs.filter((_, j) => j !== i));

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, maxHeight: '80vh', overflow: 'auto',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={18} color="#38bdf8" />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>Send Report</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {recipients.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={r.type} onChange={e => updateRecip(i, { type: e.target.value as Recipient['type'] })}
                style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 11, fontWeight: 700, padding: '6px 8px', width: 80 }}>
                <option value="client">Client</option>
                <option value="pilot">Pilot</option>
                <option value="user">User</option>
                <option value="custom">Custom</option>
              </select>
              <input value={r.name} onChange={e => updateRecip(i, { name: e.target.value })} placeholder="Name"
                style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 12 }} />
              <input value={r.email} onChange={e => updateRecip(i, { email: e.target.value })} placeholder="email@example.com" type="email"
                style={{ flex: 1.5, background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontSize: 12 }} />
              {recipients.length > 1 && (
                <button onClick={() => removeRecip(i)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={13} /></button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addRecip} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 16,
          background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 6, color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={12} /> Add Recipient
        </button>

        {sendResult && (
          <div style={{
            padding: '10px 12px', borderRadius: 8, marginBottom: 12,
            background: sendResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${sendResult.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {sendResult.ok ? <CheckCircle size={14} color="#10b981" /> : <AlertCircle size={14} color="#ef4444" />}
            <span style={{ fontSize: 12, color: sendResult.ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>{sendResult.msg}</span>
          </div>
        )}

        <button
          onClick={async () => {
            const valid = recipients.filter(r => r.email.includes('@'));
            if (valid.length === 0) { setSendResult({ ok: false, msg: 'Add at least one valid email' }); return; }
            try {
              await onSend(valid);
              setSendResult({ ok: true, msg: `Report sent to ${valid.length} recipient(s)` });
            } catch (e: any) {
              setSendResult({ ok: false, msg: e.message });
            }
          }}
          disabled={sending}
          style={{
            width: '100%', padding: '12px 16px', fontWeight: 800, fontSize: 13,
            background: !sending ? 'linear-gradient(135deg, #0ea5e9, #2563eb)' : 'rgba(30,41,59,0.8)',
            color: !sending ? '#fff' : '#475569',
            border: 'none', borderRadius: 10, cursor: !sending ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Report</>}
        </button>
      </div>
    </div>
  );
};

// ── Add Section Menu ──────────────────────────────────────────────────────────

const AddSectionMenu: React.FC<{ onAdd: (type: ReportSection['type']) => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const types: ReportSection['type'][] = ['text', 'findings', 'recommendations', 'cost_table', 'compliance', 'risk_matrix', 'appendix'];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
        background: 'rgba(56,189,248,0.08)', border: '1px dashed rgba(56,189,248,0.3)',
        borderRadius: 10, color: '#38bdf8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        width: '100%', justifyContent: 'center',
      }}>
        <Plus size={14} /> Add Section
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4,
          background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden',
        }}>
          {types.map(t => {
            const meta = SECTION_TYPE_LABELS[t];
            return (
              <button key={t} onClick={() => { onAdd(t); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: 'none', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  color: '#cbd5e1', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ color: meta.color }}>{meta.icon}</span>
                <span style={{ fontWeight: 700 }}>{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminReportWriter() {
  // ── View state ────────────────────────────────────────────────────────────
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Editor state ──────────────────────────────────────────────────────────
  const [report, setReport] = useState<AdminReport>({
    title: '', report_type: 'custom', sections: [], status: 'draft',
  });

  // ── Load reports ──────────────────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('');
      setReports(res.data || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  // ── Toast auto-dismiss ────────────────────────────────────────────────────
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      if (report.id) {
        await apiFetch(`/${report.id}`, { method: 'PUT', body: JSON.stringify(report) });
        setToast({ ok: true, msg: 'Report saved' });
      } else {
        const res = await apiFetch('', { method: 'POST', body: JSON.stringify(report) });
        setReport(r => ({ ...r, id: res.data?.id }));
        setToast({ ok: true, msg: 'Draft created' });
      }
      loadReports();
    } catch (e: any) {
      setToast({ ok: false, msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (recipients: Recipient[]) => {
    setSending(true);
    try {
      // Save first
      if (!report.id) {
        const res = await apiFetch('', { method: 'POST', body: JSON.stringify(report) });
        setReport(r => ({ ...r, id: res.data?.id }));
        report.id = res.data?.id;
      } else {
        await apiFetch(`/${report.id}`, { method: 'PUT', body: JSON.stringify(report) });
      }
      // Send
      await apiFetch(`/${report.id}/send`, { method: 'POST', body: JSON.stringify({ recipients }) });
      setReport(r => ({ ...r, status: 'sent', recipients }));
      loadReports();
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' });
      setReports(rs => rs.filter(r => r.id !== id));
      if (report.id === id) { setView('list'); }
      setToast({ ok: true, msg: 'Report deleted' });
    } catch (e: any) {
      setToast({ ok: false, msg: e.message });
    }
  };

  const openReport = (r: AdminReport) => {
    setReport(r);
    setView('editor');
  };

  const newFromTemplate = (templateKey: string) => {
    const tmpl = TEMPLATES[templateKey];
    setReport({
      title: tmpl.label,
      report_type: templateKey,
      sections: tmpl.sections.map(s => ({ ...s, id: uid() })),
      status: 'draft',
    });
    setView('editor');
  };

  const newBlank = () => {
    setReport({
      title: 'Untitled Report',
      report_type: 'custom',
      sections: [
        { id: uid(), type: 'header', title: 'Report', content: '' },
        { id: uid(), type: 'text', title: 'Content', content: '<p></p>' },
      ],
      status: 'draft',
    });
    setView('editor');
  };

  // ── Section management ────────────────────────────────────────────────────
  const updateSection = (id: string, patch: Partial<ReportSection>) =>
    setReport(r => ({ ...r, sections: r.sections.map(s => s.id === id ? { ...s, ...patch } : s) }));

  const removeSection = (id: string) =>
    setReport(r => ({ ...r, sections: r.sections.filter(s => s.id !== id) }));

  const addSection = (type: ReportSection['type']) => {
    const base: ReportSection = { id: uid(), type, title: SECTION_TYPE_LABELS[type]?.label || 'Section', content: '' };
    if (type === 'findings') base.items = [{ id: uid(), severity: 'medium', title: '', description: '' }];
    if (type === 'cost_table') base.rows = [{ id: uid(), item: '', description: '', quantity: 1, unitCost: 0 }];
    if (type === 'compliance') base.checks = [{ id: uid(), standard: '', requirement: '', status: 'pending', notes: '' }];
    if (type === 'risk_matrix') base.risks = [{ id: uid(), risk: '', likelihood: 3, severity: 3, mitigation: '' }];
    if (type === 'text' || type === 'recommendations' || type === 'appendix') base.content = '<p></p>';
    setReport(r => ({ ...r, sections: [...r.sections, base] }));
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    setReport(r => {
      const idx = r.sections.findIndex(s => s.id === id);
      if (idx < 0) return r;
      const next = idx + dir;
      if (next < 0 || next >= r.sections.length) return r;
      const sections = [...r.sections];
      [sections[idx], sections[next]] = [sections[next], sections[idx]];
      return { ...r, sections };
    });
  };

  // ── Card style ────────────────────────────────────────────────────────────
  const cardStyle = {
    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, overflow: 'hidden' as const,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'list') {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px', color: '#e2e8f0' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', margin: 0 }}>Report Writer</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Create, edit, and send professional reports</p>
          </div>
          <button onClick={newBlank} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', border: 'none',
            borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          }}>
            <Plus size={15} /> New Report
          </button>
        </div>

        {/* Templates */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
            Start from Template
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {Object.entries(TEMPLATES).map(([key, tmpl]) => (
              <button key={key} onClick={() => newFromTemplate(key)} style={{
                ...cardStyle, padding: 20, cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s, transform 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>{tmpl.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>{tmpl.label}</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{tmpl.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Reports list */}
        <div>
          <h2 style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
            Your Reports ({reports.length})
          </h2>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <Loader2 size={24} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 13 }}>Loading reports…</p>
            </div>
          ) : reports.length === 0 ? (
            <div style={{ ...cardStyle, padding: 40, textAlign: 'center' }}>
              <FileText size={32} style={{ margin: '0 auto 12px', color: '#334155' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>No reports yet</p>
              <p style={{ fontSize: 12, color: '#475569' }}>Create a new report or start from a template above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reports.map(r => (
                <div key={r.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', padding: '14px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onClick={() => openReport(r)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(56,189,248,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{r.title || 'Untitled'}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.1em',
                        background: r.status === 'sent' ? 'rgba(16,185,129,0.1)' : r.status === 'archived' ? 'rgba(100,116,139,0.1)' : 'rgba(59,130,246,0.1)',
                        color: r.status === 'sent' ? '#10b981' : r.status === 'archived' ? '#64748b' : '#3b82f6',
                        border: `1px solid ${r.status === 'sent' ? 'rgba(16,185,129,0.3)' : r.status === 'archived' ? 'rgba(100,116,139,0.3)' : 'rgba(59,130,246,0.3)'}`,
                      }}>{r.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b' }}>
                      <span>{r.report_type.replace(/_/g, ' ')}</span>
                      {r.updated_at && <span>{new Date(r.updated_at).toLocaleDateString()}</span>}
                      {r.created_by_name && <span>by {r.created_by_name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); exportPDF(r); }} title="Export PDF"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px', color: '#94a3b8', cursor: 'pointer' }}>
                      <Download size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(r.id!); }} title="Delete"
                      style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '6px 8px', color: '#f87171', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <ChevronRight size={14} style={{ marginLeft: 8, color: '#475569' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 100, padding: '12px 20px', borderRadius: 10,
            background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
            color: toast.ok ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 700, backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── EDITOR VIEW ───────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 80px', color: '#e2e8f0' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => setView('list')} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <ArrowLeft size={13} /> Back to Reports
        </button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleSave} disabled={saving} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)',
            borderRadius: 8, color: '#38bdf8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={() => exportPDF(report)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 8, color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            <Printer size={13} /> Export PDF
          </button>
          <button onClick={() => setSendModalOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', border: 'none',
            borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}>
            <Send size={13} /> Send
          </button>
        </div>
      </div>

      {/* Report title */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={report.title}
          onChange={e => setReport(r => ({ ...r, title: e.target.value }))}
          placeholder="Report Title..."
          style={{
            width: '100%', background: 'none', border: 'none', borderBottom: '2px solid rgba(255,255,255,0.08)',
            padding: '8px 0', color: '#f8fafc', fontSize: 24, fontWeight: 900, outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
          <select value={report.report_type} onChange={e => setReport(r => ({ ...r, report_type: e.target.value }))}
            style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 11, fontWeight: 700, padding: '4px 10px' }}>
            <option value="custom">Custom</option>
            <option value="inspection_summary">Inspection Summary</option>
            <option value="client_deliverable">Client Deliverable</option>
            <option value="incident_report">Incident Report</option>
            <option value="operations_brief">Operations Brief</option>
            <option value="monthly_progress">Monthly Progress</option>
          </select>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {report.status} {report.id ? `· ID: ${report.id.slice(0, 8)}` : '· Unsaved'}
          </span>
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {report.sections.map((sec, idx) => {
          const meta = SECTION_TYPE_LABELS[sec.type] || SECTION_TYPE_LABELS.text;
          return (
            <div key={sec.id} style={cardStyle}>
              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                borderBottom: sec.collapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
              }}
                onClick={() => updateSection(sec.id, { collapsed: !sec.collapsed })}
              >
                <span style={{ color: meta.color, display: 'flex' }}>{meta.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{meta.label}</span>
                <input
                  value={sec.title}
                  onChange={e => { e.stopPropagation(); updateSection(sec.id, { title: e.target.value }); }}
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', fontSize: 14, fontWeight: 700, outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  {idx > 0 && (
                    <button onClick={e => { e.stopPropagation(); moveSection(sec.id, -1); }}
                      style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}><ChevronUp size={13} /></button>
                  )}
                  {idx < report.sections.length - 1 && (
                    <button onClick={e => { e.stopPropagation(); moveSection(sec.id, 1); }}
                      style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}><ChevronDown size={13} /></button>
                  )}
                  <button onClick={e => { e.stopPropagation(); removeSection(sec.id); }}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
                </div>
                <span style={{ color: '#475569' }}>{sec.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</span>
              </div>

              {/* Section body */}
              {!sec.collapsed && (
                <div style={{ padding: 16 }}>
                  {(sec.type === 'text' || sec.type === 'recommendations' || sec.type === 'appendix' || sec.type === 'header') && (
                    sec.type === 'header' ? (
                      <p style={{ fontSize: 12, color: '#64748b' }}>This section auto-generates a header from the report title and metadata.</p>
                    ) : (
                      <RichEditor html={sec.content} onChange={html => updateSection(sec.id, { content: html })} />
                    )
                  )}
                  {sec.type === 'findings' && (
                    <FindingsEditor items={sec.items || []} onChange={items => updateSection(sec.id, { items })} />
                  )}
                  {sec.type === 'cost_table' && (
                    <CostTableEditor rows={sec.rows || []} onChange={rows => updateSection(sec.id, { rows })} />
                  )}
                  {sec.type === 'compliance' && (
                    <ComplianceEditor checks={sec.checks || []} onChange={checks => updateSection(sec.id, { checks })} />
                  )}
                  {sec.type === 'risk_matrix' && (
                    <RiskMatrixEditor risks={sec.risks || []} onChange={risks => updateSection(sec.id, { risks })} />
                  )}
                </div>
              )}
            </div>
          );
        })}

        <AddSectionMenu onAdd={addSection} />
      </div>

      {/* Send modal */}
      <SendModal open={sendModalOpen} onClose={() => setSendModalOpen(false)} onSend={handleSend} sending={sending} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100, padding: '12px 20px', borderRadius: 10,
          background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: toast.ok ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 700, backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        [data-placeholder]:empty:before { content: attr(data-placeholder); color: #475569; pointer-events: none; }
      `}</style>
    </div>
  );
}
