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
  ChevronRight, Clock, Users, Mail, Download, Copy, Archive,
  Radar, MapPin, CalendarDays, Plane, PlusCircle
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportSection {
  id: string;
  type: 'header' | 'text' | 'findings' | 'recommendations' | 'cost_table' | 'compliance' | 'risk_matrix' | 'image' | 'appendix' | 'mission_data';
  missionId?: string;
  missionSnapshot?: MissionSnapshot;
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

interface MissionSnapshot {
  title: string;
  type: string;
  status: string;
  siteName: string;
  date: string;
  location: string;
  daysOnSite: number;
  personnelCount: number;
  fileCount: number;
  pilotReports: PilotReportData[];
  weather?: WeatherDayData[];
  dateFrom?: string;
  dateTo?: string;
  selectedDates?: string[];
  latitude?: number;
  longitude?: number;
}

interface PilotReportData {
  id: string;
  date: string;
  pilotName: string;
  missionsFlown: number;
  blocksCompleted: number;
  hoursWorked: number;
  issuesEncountered: string;
  weatherConditionsReported: string;
  isIncident: boolean;
  incidentSeverity: string;
  incidentSummary: string;
}

interface WeatherDayData {
  date: string;
  tempMax: number;
  tempMin: number;
  precipSum: number;
  windMax: number;
  weatherCode: number;
  precipProb?: number;
  uvMax?: number;
}

const WMO_LABELS: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear', icon: '☀️' }, 1: { label: 'Mostly Clear', icon: '🌤' },
  2: { label: 'Partly Cloudy', icon: '⛅' }, 3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫' }, 48: { label: 'Rime Fog', icon: '🌫' },
  51: { label: 'Light Drizzle', icon: '🌦' }, 53: { label: 'Drizzle', icon: '🌦' },
  55: { label: 'Heavy Drizzle', icon: '🌧' }, 56: { label: 'Frzn Drizzle', icon: '🌧' },
  61: { label: 'Light Rain', icon: '🌧' }, 63: { label: 'Rain', icon: '🌧' },
  65: { label: 'Heavy Rain', icon: '🌧' }, 66: { label: 'Frzn Rain', icon: '🌧' },
  71: { label: 'Light Snow', icon: '🌨' }, 73: { label: 'Snow', icon: '❄️' },
  75: { label: 'Heavy Snow', icon: '❄️' }, 77: { label: 'Snow Grains', icon: '❄️' },
  80: { label: 'Showers', icon: '🌦' }, 81: { label: 'Mod Showers', icon: '🌧' },
  82: { label: 'Hvy Showers', icon: '🌧' }, 85: { label: 'Snow Showers', icon: '🌨' },
  95: { label: 'Thunderstorm', icon: '⛈️' }, 96: { label: 'T-storm + Hail', icon: '⛈️' },
  99: { label: 'Hvy T-storm', icon: '⛈️' },
};

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
  progress_update: {
    label: 'Progress Update',
    description: 'Periodic mission progress report with field data, weather, and status',
    icon: '📊',
    sections: [
      { id: 's1', type: 'header', title: 'Progress Update', content: '' },
      { id: 's2', type: 'mission_data', title: 'Mission Data', content: '' },
      { id: 's3', type: 'text', title: 'Summary of Work Completed', content: '<p>During the reporting period, the following work was completed:</p><ul><li>Flights conducted and areas covered</li><li>Data collected and processed</li><li>Key observations from the field</li></ul>' },
      { id: 's4', type: 'findings', title: 'Notable Findings', content: '', items: [
        { id: 'f1', severity: 'medium', title: '', description: '', location: '' },
      ]},
      { id: 's5', type: 'text', title: 'Weather Impact', content: '<p>Weather conditions during the reporting period and their impact on operations:</p><p>[Weather data will be auto-populated from mission data section]</p>' },
      { id: 's6', type: 'recommendations', title: 'Next Steps & Schedule', content: '<ol><li>Continue scheduled flight operations</li><li>Process and analyze collected data</li><li>Address any identified issues</li></ol>' },
    ],
  },
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ── API helpers ───────────────────────────────────────────────────────────────

const API = (path: string) => `/api/admin-reports${path}`;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(API(path), {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(opts?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function fetchMissions(): Promise<any[]> {
  const res = await fetch('/api/deployments', { headers: authHeaders() });
  const data = await res.json();
  return data.data || [];
}

async function fetchPilotReports(missionId: string): Promise<PilotReportData[]> {
  const res = await fetch(`/api/deployments/${missionId}/pilot-reports`, { headers: authHeaders() });
  const data = await res.json();
  return data.data || [];
}

async function fetchWeatherForRange(lat: number, lon: number, startDate: string, endDate: string): Promise<WeatherDayData[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const results: WeatherDayData[] = [];

    // Historical dates (past)
    if (startDate < today) {
      const histEnd = endDate < today ? endDate : new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&start_date=${startDate}&end_date=${histEnd}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code` +
        `&temperature_unit=fahrenheit&wind_speed_unit=kmh&timezone=auto`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.daily?.time) {
          data.daily.time.forEach((d: string, i: number) => {
            results.push({
              date: d,
              tempMax: data.daily.temperature_2m_max[i],
              tempMin: data.daily.temperature_2m_min[i],
              precipSum: data.daily.precipitation_sum[i],
              windMax: data.daily.wind_speed_10m_max[i],
              weatherCode: data.daily.weather_code[i],
            });
          });
        }
      }
    }

    // Forecast dates (today+future)
    if (endDate >= today) {
      const fcastStart = startDate >= today ? startDate : today;
      const diffDays = Math.min(Math.ceil((new Date(endDate).getTime() - new Date(fcastStart).getTime()) / 86400000) + 1, 16);
      const res = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}&forecast_days=${diffDays}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.daily?.time) {
          data.daily.time.forEach((d: string, i: number) => {
            if (d >= fcastStart && d <= endDate && !results.find(r => r.date === d)) {
              results.push({
                date: d,
                tempMax: data.daily.temperature_2m_max[i],
                tempMin: data.daily.temperature_2m_min[i],
                precipSum: data.daily.precipitation_sum[i],
                windMax: data.daily.wind_speed_10m_max[i],
                weatherCode: data.daily.weather_code[i],
                precipProb: data.daily.precipitation_probability_max?.[i],
                uvMax: data.daily.uv_index_max?.[i],
              });
            }
          });
        }
      }
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.error('[fetchWeatherForRange]', e);
    return [];
  }
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
      case 'mission_data':
        if (sec.missionSnapshot) {
          const ms = sec.missionSnapshot;
          const tFlights = ms.pilotReports.reduce((s: number, r: PilotReportData) => s + Number(r.missionsFlown || 0), 0);
          const tHours = ms.pilotReports.reduce((s: number, r: PilotReportData) => s + Number(r.hoursWorked || 0), 0);
          const tBlocks = ms.pilotReports.reduce((s: number, r: PilotReportData) => s + Number(r.blocksCompleted || 0), 0);
          inner = `<h2 class="rpt-h2">${sec.title}</h2>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
              <div style="display:flex;gap:24px;margin-bottom:12px;font-size:12px;">
                <div><strong>Site:</strong> ${ms.siteName}</div>
                <div><strong>Date:</strong> ${ms.date}</div>
                <div><strong>Location:</strong> ${ms.location || '—'}</div>
                <div><strong>Days:</strong> ${ms.daysOnSite}</div>
                <div><strong>Status:</strong> ${ms.status}</div>
              </div>
              <div style="display:flex;gap:20px;font-size:12px;color:#475569;">
                <span><strong>${tFlights}</strong> flights</span>
                <span><strong>${tBlocks}</strong> blocks</span>
                <span><strong>${tHours.toFixed(1)}</strong> hours</span>
                <span><strong>${ms.personnelCount}</strong> pilots</span>
                <span><strong>${ms.pilotReports.length}</strong> reports</span>
              </div>
            </div>` +
            (ms.pilotReports.length > 0 ?
              `<table class="rpt-table"><thead><tr><th>Pilot</th><th>Date</th><th>Flights</th><th>Blocks</th><th>Hours</th><th>Issues</th></tr></thead><tbody>` +
              ms.pilotReports.map((pr: PilotReportData) =>
                `<tr><td>${pr.pilotName}</td><td>${pr.date ? new Date(pr.date).toLocaleDateString() : ''}</td><td>${pr.missionsFlown || 0}</td><td>${pr.blocksCompleted || 0}</td><td>${pr.hoursWorked || 0}</td><td>${pr.isIncident ? '⚠ ' + (pr.incidentSummary || 'Incident') : (pr.issuesEncountered || '—')}</td></tr>`
              ).join('') +
              `</tbody></table>` : '') +
            (ms.weather && ms.weather.length > 0 ?
              `<h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:20px 0 8px;">Weather Conditions</h3>` +
              (ms.dateFrom && ms.dateTo ? `<p style="font-size:11px;color:#64748b;margin-bottom:8px;">Period: ${ms.dateFrom} to ${ms.dateTo}</p>` : '') +
              `<table class="rpt-table"><thead><tr><th>Date</th><th>Conditions</th><th>High (°F)</th><th>Low (°F)</th><th>Wind (km/h)</th><th>Precip (mm)</th></tr></thead><tbody>` +
              ms.weather.map((w: WeatherDayData) => {
                const wmo = WMO_LABELS[w.weatherCode] || { label: 'Unknown', icon: '' };
                return `<tr><td>${new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td><td>${wmo.icon} ${wmo.label}</td><td>${Math.round(w.tempMax)}</td><td>${Math.round(w.tempMin)}</td><td>${Math.round(w.windMax)}</td><td>${w.precipSum.toFixed(1)}</td></tr>`;
              }).join('') +
              `</tbody></table>` : '');
        } else {
          inner = `<h2 class="rpt-h2">${sec.title}</h2><p style="color:#94a3b8;font-size:12px;">No mission data selected</p>`;
        }
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
  mission_data:    { icon: <Radar size={13} />,          label: 'Mission Data',  color: '#06b6d4' },
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
// ── Mission Data Editor ───────────────────────────────────────────────────────

const MissionDataEditor: React.FC<{
  section: ReportSection;
  onUpdate: (patch: Partial<ReportSection>) => void;
  onAddSectionToReport: (newSection: ReportSection) => void;
}> = ({ section, onUpdate, onAddSectionToReport }) => {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMission, setSelectedMission] = useState<any | null>(null);
  const [pilotReports, setPilotReports] = useState<PilotReportData[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [dateMode, setDateMode] = useState<'range' | 'individual'>('range');
  const [addDateValue, setAddDateValue] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherDayData[]>([]);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Load missions on mount
  useEffect(() => {
    setLoading(true);
    fetchMissions().then(m => { setMissions(m); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // Load pilot reports when a mission is selected
  useEffect(() => {
    if (!selectedMission) { setPilotReports([]); return; }
    setLoadingReports(true);
    fetchPilotReports(selectedMission.id)
      .then(r => { setPilotReports(r); setLoadingReports(false); })
      .catch(() => setLoadingReports(false));

    // Auto-set date range from mission
    if (selectedMission.date) {
      const start = selectedMission.date.split('T')[0];
      setDateFrom(start);
      const days = selectedMission.daysOnSite || 7;
      const end = new Date(new Date(start).getTime() + days * 86400000).toISOString().split('T')[0];
      setDateTo(end);
    }
  }, [selectedMission?.id]);

  // Fetch weather when date range or selected dates change
  useEffect(() => {
    if (!selectedMission) { setWeatherData([]); return; }
    const lat = selectedMission.latitude ?? selectedMission.lat;
    const lon = selectedMission.longitude ?? selectedMission.lng ?? selectedMission.lon;
    if (!lat || !lon) return;

    let wFrom = '', wTo = '';
    if (dateMode === 'individual' && selectedDates.length > 0) {
      const sorted = [...selectedDates].sort();
      wFrom = sorted[0];
      wTo = sorted[sorted.length - 1];
    } else if (dateMode === 'range' && dateFrom && dateTo) {
      wFrom = dateFrom;
      wTo = dateTo;
    }
    if (!wFrom || !wTo) { setWeatherData([]); return; }

    setLoadingWeather(true);
    fetchWeatherForRange(lat, lon, wFrom, wTo)
      .then(w => {
        // If individual mode, filter to only selected dates
        if (dateMode === 'individual' && selectedDates.length > 0) {
          setWeatherData(w.filter(d => selectedDates.includes(d.date)));
        } else {
          setWeatherData(w);
        }
        setLoadingWeather(false);
      })
      .catch(() => setLoadingWeather(false));
  }, [dateFrom, dateTo, selectedDates.length, dateMode, selectedMission?.id]);

  // If the section already has a snapshot, show it
  if (section.missionSnapshot) {
    const snap = section.missionSnapshot;
    const totalFlights = snap.pilotReports.reduce((s, r) => s + Number(r.missionsFlown || 0), 0);
    const totalHours = snap.pilotReports.reduce((s, r) => s + Number(r.hoursWorked || 0), 0);
    const totalBlocks = snap.pilotReports.reduce((s, r) => s + Number(r.blocksCompleted || 0), 0);
    const incidents = snap.pilotReports.filter(r => r.isIncident);

    return (
      <div>
        {/* Mission overview card */}
        <div style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Radar size={16} color="#06b6d4" />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{snap.title}</span>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase',
              background: snap.status === 'Completed' ? 'rgba(16,185,129,0.1)' : snap.status === 'Active' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
              color: snap.status === 'Completed' ? '#10b981' : snap.status === 'Active' ? '#3b82f6' : '#f59e0b',
              border: `1px solid ${snap.status === 'Completed' ? 'rgba(16,185,129,0.3)' : snap.status === 'Active' ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}>{snap.status}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Site', value: snap.siteName, icon: <MapPin size={11} /> },
              { label: 'Date', value: snap.date, icon: <CalendarDays size={11} /> },
              { label: 'Location', value: snap.location || '—', icon: <MapPin size={11} /> },
              { label: 'Days', value: `${snap.daysOnSite}`, icon: <Clock size={11} /> },
            ].map(f => (
              <div key={f.label} style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ color: '#475569' }}>{f.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>{f.label}</span>
                </div>
                <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
          </div>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span><strong style={{ color: '#38bdf8' }}>{totalFlights}</strong> flights</span>
            <span><strong style={{ color: '#38bdf8' }}>{totalBlocks}</strong> blocks</span>
            <span><strong style={{ color: '#38bdf8' }}>{totalHours.toFixed(1)}</strong> hours</span>
            <span><strong style={{ color: '#38bdf8' }}>{snap.personnelCount}</strong> pilots</span>
            <span><strong style={{ color: '#38bdf8' }}>{snap.pilotReports.length}</strong> reports</span>
            {incidents.length > 0 && <span style={{ color: '#f87171' }}><strong>{incidents.length}</strong> incidents</span>}
          </div>
        </div>

        {/* Pilot reports */}
        {snap.pilotReports.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Pilot Field Reports ({snap.pilotReports.length})
              {snap.dateFrom && snap.dateTo && (
                <span style={{ fontWeight: 600, color: '#64748b', textTransform: 'none', letterSpacing: 'normal', marginLeft: 8 }}>
                  — {new Date(snap.dateFrom).toLocaleDateString()} to {new Date(snap.dateTo).toLocaleDateString()}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {snap.pilotReports.map(pr => (
                <div key={pr.id} style={{
                  background: pr.isIncident ? 'rgba(239,68,68,0.06)' : 'rgba(15,23,42,0.4)',
                  border: `1px solid ${pr.isIncident ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8, padding: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{pr.pilotName}</span>
                      {pr.isIncident && <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase' }}>Incident</span>}
                    </div>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{pr.date ? new Date(pr.date).toLocaleDateString() : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#94a3b8' }}>
                    {pr.missionsFlown > 0 && <span>{pr.missionsFlown} flights</span>}
                    {pr.blocksCompleted > 0 && <span>{pr.blocksCompleted} blocks</span>}
                    {pr.hoursWorked > 0 && <span>{pr.hoursWorked}h</span>}
                    {pr.weatherConditionsReported && <span>🌤 {pr.weatherConditionsReported}</span>}
                  </div>
                  {pr.issuesEncountered && (
                    <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4, fontStyle: 'italic' }}>⚠ {pr.issuesEncountered}</div>
                  )}
                  {pr.isIncident && pr.incidentSummary && (
                    <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 4 }}>🚨 {pr.incidentSummary}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weather data */}
        {snap.weather && snap.weather.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              🌤 Weather Conditions ({snap.weather.length} days)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Date', 'Conditions', 'High', 'Low', 'Wind', 'Precip'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snap.weather.map(w => {
                    const wmo = WMO_LABELS[w.weatherCode] || { label: 'Unknown', icon: '❓' };
                    const isBadWeather = w.precipSum > 5 || w.windMax > 40 || [63, 65, 66, 73, 75, 82, 95, 96, 99].includes(w.weatherCode);
                    return (
                      <tr key={w.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isBadWeather ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
                        <td style={{ padding: '5px 8px', color: '#94a3b8' }}>{new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                        <td style={{ padding: '5px 8px', color: '#e2e8f0' }}>{wmo.icon} {wmo.label}</td>
                        <td style={{ padding: '5px 8px', color: '#f87171', fontWeight: 600 }}>{Math.round(w.tempMax)}°F</td>
                        <td style={{ padding: '5px 8px', color: '#60a5fa', fontWeight: 600 }}>{Math.round(w.tempMin)}°F</td>
                        <td style={{ padding: '5px 8px', color: w.windMax > 40 ? '#f59e0b' : '#94a3b8' }}>{Math.round(w.windMax)} km/h</td>
                        <td style={{ padding: '5px 8px', color: w.precipSum > 5 ? '#3b82f6' : '#64748b' }}>{w.precipSum.toFixed(1)} mm</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Button to change mission */}
        <button
          onClick={() => onUpdate({ missionSnapshot: undefined, missionId: undefined })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginTop: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Radar size={12} /> Change Mission
        </button>
      </div>
    );
  }

  // Mission picker
  const filtered = missions.filter(m =>
    !search || m.title?.toLowerCase().includes(search.toLowerCase()) ||
    m.siteName?.toLowerCase().includes(search.toLowerCase()) ||
    m.location?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectMission = async (m: any) => {
    if (selectedMission?.id === m.id) {
      setSelectedMission(null);
      return;
    }
    setSelectedMission(m);
  };

  // Filter pilot reports by selected dates
  const getFilteredReports = (): PilotReportData[] => {
    if (dateMode === 'individual' && selectedDates.length > 0) {
      return pilotReports.filter(pr => {
        if (!pr.date) return false;
        return selectedDates.includes(pr.date.split('T')[0]);
      });
    } else if (dateMode === 'range' && dateFrom && dateTo) {
      return pilotReports.filter(pr => {
        if (!pr.date) return true;
        const d = pr.date.split('T')[0];
        return d >= dateFrom && d <= dateTo;
      });
    }
    return pilotReports;
  };

  const handleInsertMission = () => {
    if (!selectedMission) return;
    const filteredReports = getFilteredReports();
    const snapshot: MissionSnapshot = {
      title: selectedMission.title,
      type: selectedMission.type,
      status: selectedMission.status,
      siteName: selectedMission.siteName,
      date: selectedMission.date,
      location: selectedMission.location || '',
      daysOnSite: selectedMission.daysOnSite || 1,
      personnelCount: selectedMission.personnelCount || 0,
      fileCount: selectedMission.fileCount || 0,
      pilotReports: filteredReports,
      weather: weatherData,
      dateFrom: dateMode === 'range' ? dateFrom : (selectedDates.length ? [...selectedDates].sort()[0] : undefined),
      dateTo: dateMode === 'range' ? dateTo : (selectedDates.length ? [...selectedDates].sort().pop() : undefined),
      selectedDates: dateMode === 'individual' ? selectedDates : undefined,
      latitude: selectedMission.latitude ?? selectedMission.lat,
      longitude: selectedMission.longitude ?? selectedMission.lng ?? selectedMission.lon,
    };
    onUpdate({ missionId: selectedMission.id, missionSnapshot: snapshot, title: `Mission: ${selectedMission.title}` });
  };

  // Auto-populate full report from mission data
  const handleAutoPopulateReport = () => {
    if (!selectedMission) return;
    const rpts = getFilteredReports();
    const totalFlights = rpts.reduce((s, r) => s + Number(r.missionsFlown || 0), 0);
    const totalBlocks = rpts.reduce((s, r) => s + Number(r.blocksCompleted || 0), 0);
    const totalHours = rpts.reduce((s, r) => s + Number(r.hoursWorked || 0), 0);
    const incidents = rpts.filter(r => r.isIncident);
    const issues = rpts.filter(r => r.issuesEncountered);
    const dateLabel = dateMode === 'individual' && selectedDates.length
      ? selectedDates.sort().map(d => new Date(d + 'T12:00:00').toLocaleDateString()).join(', ')
      : dateFrom && dateTo ? `${new Date(dateFrom + 'T12:00:00').toLocaleDateString()} – ${new Date(dateTo + 'T12:00:00').toLocaleDateString()}` : selectedMission.date;

    // Build summary text section
    const summaryLines = [
      `<p><strong>Mission:</strong> ${selectedMission.title}</p>`,
      `<p><strong>Site:</strong> ${selectedMission.siteName} · <strong>Location:</strong> ${selectedMission.location || '—'}</p>`,
      `<p><strong>Reporting Period:</strong> ${dateLabel}</p>`,
      `<p><strong>Operations Summary:</strong></p>`,
      `<ul>`,
      `<li><strong>${totalFlights}</strong> flights conducted</li>`,
      `<li><strong>${totalBlocks}</strong> LBDs / blocks completed</li>`,
      `<li><strong>${totalHours.toFixed(1)}</strong> total field hours logged</li>`,
      `<li><strong>${rpts.length}</strong> pilot reports submitted</li>`,
      `<li><strong>${selectedMission.personnelCount || 0}</strong> personnel on site</li>`,
      incidents.length > 0 ? `<li style="color:#ef4444"><strong>${incidents.length}</strong> incident(s) reported</li>` : '',
      `</ul>`,
    ].filter(Boolean);
    const summarySection: ReportSection = {
      id: uid(), type: 'text', title: 'Operations Summary',
      content: summaryLines.join('\n'),
    };
    onAddSectionToReport(summarySection);

    // Build findings from issues/incidents
    if (issues.length > 0 || incidents.length > 0) {
      const findingItems: FindingItem[] = [
        ...incidents.map(pr => ({
          id: uid(),
          severity: 'critical' as const,
          title: `Incident: ${pr.incidentSummary || 'Reported by ' + pr.pilotName}`,
          description: `${pr.incidentSummary || ''} (${pr.incidentSeverity || 'unknown'} severity)\nReported by ${pr.pilotName} on ${pr.date ? new Date(pr.date).toLocaleDateString() : 'unknown'}`,
          location: selectedMission.siteName,
        })),
        ...issues.filter(pr => !pr.isIncident).map(pr => ({
          id: uid(),
          severity: 'medium' as const,
          title: `Field Issue: ${(pr.issuesEncountered || '').slice(0, 80)}`,
          description: `${pr.issuesEncountered}\nReported by ${pr.pilotName} on ${pr.date ? new Date(pr.date).toLocaleDateString() : 'unknown'}`,
          location: selectedMission.siteName,
        })),
      ];
      const findingsSection: ReportSection = {
        id: uid(), type: 'findings', title: 'Field Issues & Incidents',
        content: '', items: findingItems,
      };
      onAddSectionToReport(findingsSection);
    }

    // Build weather impact section if weather data available
    if (weatherData.length > 0) {
      const badDays = weatherData.filter(w => w.precipSum > 5 || w.windMax > 40 || [63, 65, 73, 75, 82, 95, 96, 99].includes(w.weatherCode));
      const avgHigh = weatherData.reduce((s, w) => s + w.tempMax, 0) / weatherData.length;
      const avgLow = weatherData.reduce((s, w) => s + w.tempMin, 0) / weatherData.length;
      const totalPrecip = weatherData.reduce((s, w) => s + w.precipSum, 0);
      const maxWind = Math.max(...weatherData.map(w => w.windMax));
      const pilotWeatherNotes = rpts.filter(r => r.weatherConditionsReported).map(r => `${r.pilotName}: ${r.weatherConditionsReported}`);

      const wxLines = [
        `<p><strong>Weather Summary (${weatherData.length} days):</strong></p>`,
        `<ul>`,
        `<li>Average High: <strong>${Math.round(avgHigh)}°F</strong> · Average Low: <strong>${Math.round(avgLow)}°F</strong></li>`,
        `<li>Total Precipitation: <strong>${totalPrecip.toFixed(1)} mm</strong></li>`,
        `<li>Max Wind Speed: <strong>${Math.round(maxWind)} km/h</strong></li>`,
        badDays.length > 0 ? `<li style="color:#f59e0b"><strong>${badDays.length}</strong> day(s) with adverse conditions (heavy rain, high wind, or storms)</li>` : `<li>No significant adverse weather days</li>`,
        `</ul>`,
        pilotWeatherNotes.length > 0 ? `<p><strong>Pilot Weather Notes:</strong></p><ul>${pilotWeatherNotes.map(n => `<li>${n}</li>`).join('')}</ul>` : '',
        badDays.length > 0 ? `<p><strong>Impacted Days:</strong></p><ul>${badDays.map(w => {
          const wmo = WMO_LABELS[w.weatherCode] || { label: 'Unknown', icon: '' };
          return `<li>${new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${wmo.icon} ${wmo.label} — ${Math.round(w.tempMax)}°F, ${w.precipSum.toFixed(1)}mm rain, ${Math.round(w.windMax)} km/h wind</li>`;
        }).join('')}</ul>` : '',
      ].filter(Boolean);
      const wxSection: ReportSection = {
        id: uid(), type: 'text', title: 'Weather Impact',
        content: wxLines.join('\n'),
      };
      onAddSectionToReport(wxSection);
    }
  };

  const handleAddPilotReportsAsFindings = () => {
    if (!pilotReports.length) return;
    const items: FindingItem[] = pilotReports
      .filter(pr => pr.issuesEncountered || pr.isIncident)
      .map(pr => ({
        id: uid(),
        severity: pr.isIncident ? 'critical' as const : 'medium' as const,
        title: pr.isIncident ? `Incident: ${pr.incidentSummary || 'Reported by ' + pr.pilotName}` : `Issue: ${pr.issuesEncountered?.slice(0, 80) || 'Reported by ' + pr.pilotName}`,
        description: [
          pr.issuesEncountered,
          pr.isIncident && pr.incidentSummary ? `Incident (${pr.incidentSeverity}): ${pr.incidentSummary}` : '',
          `Reported by ${pr.pilotName} on ${pr.date ? new Date(pr.date).toLocaleDateString() : 'unknown date'}`,
        ].filter(Boolean).join('\n'),
        location: selectedMission?.siteName || '',
      }));
    if (items.length === 0) return;
    const newSection: ReportSection = {
      id: uid(), type: 'findings', title: `Field Issues — ${selectedMission?.title || 'Mission'}`,
      content: '', items,
    };
    onAddSectionToReport(newSection);
  };

  return (
    <div>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search missions by title, site, or location..."
          style={{
            width: '100%', padding: '8px 12px 8px 32px', background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e2e8f0', fontSize: 12,
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#475569' }}>
          <Loader2 size={18} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 12 }}>Loading missions…</p>
        </div>
      ) : (
        <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 && (
            <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: 16 }}>No missions found</p>
          )}
          {filtered.slice(0, 30).map(m => {
            const isSelected = selectedMission?.id === m.id;
            const stColor = m.status === 'Completed' ? '#10b981' : m.status === 'Active' ? '#3b82f6' : '#f59e0b';
            return (
              <div key={m.id}>
                <div
                  onClick={() => handleSelectMission(m)}
                  style={{
                    background: isSelected ? 'rgba(6,182,212,0.08)' : 'rgba(15,23,42,0.4)',
                    border: `1px solid ${isSelected ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Radar size={13} color={isSelected ? '#06b6d4' : '#475569'} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{m.title}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                        background: `${stColor}15`, color: stColor, textTransform: 'uppercase',
                      }}>{m.status}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{m.date}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    <span>📍 {m.siteName}</span>
                    {m.location && <span>{m.location}</span>}
                    <span>{m.personnelCount || 0} pilots</span>
                    <span>{m.fileCount || 0} files</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isSelected && (
                  <div style={{ marginTop: 6, marginLeft: 14, padding: '12px 14px', background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: 8 }}>
                    {loadingReports ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 11 }}>
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Loading pilot reports…
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                          Pilot Reports ({pilotReports.length})
                        </div>
                        {pilotReports.length === 0 ? (
                          <p style={{ fontSize: 11, color: '#475569' }}>No pilot field reports for this mission.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto', marginBottom: 8 }}>
                            {pilotReports.map(pr => (
                              <div key={pr.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '6px 10px', background: 'rgba(15,23,42,0.4)', borderRadius: 6, fontSize: 11,
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{pr.pilotName}</span>
                                  {pr.isIncident && <span style={{ color: '#f87171', fontSize: 9, fontWeight: 800 }}>⚠ INCIDENT</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 10, color: '#64748b' }}>
                                  {pr.missionsFlown > 0 && <span>{pr.missionsFlown} flights</span>}
                                  {pr.hoursWorked > 0 && <span>{pr.hoursWorked}h</span>}
                                  <span>{pr.date ? new Date(pr.date).toLocaleDateString() : ''}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Action buttons */}
                        {/* Date Range Picker */}
                        <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(15,23,42,0.5)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                              📅 Reporting Period
                            </div>
                            <div style={{ display: 'flex', gap: 2, background: 'rgba(15,23,42,0.6)', borderRadius: 6, padding: 2 }}>
                              {(['range', 'individual'] as const).map(mode => (
                                <button key={mode} onClick={() => setDateMode(mode)} style={{
                                  padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 9, fontWeight: 700, cursor: 'pointer',
                                  background: dateMode === mode ? 'rgba(6,182,212,0.15)' : 'transparent',
                                  color: dateMode === mode ? '#06b6d4' : '#475569',
                                }}>
                                  {mode === 'range' ? 'Date Range' : 'Select Dates'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {dateMode === 'range' ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                style={{ flex: 1, padding: '5px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 11 }} />
                              <span style={{ color: '#475569', fontSize: 11, fontWeight: 600 }}>to</span>
                              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                style={{ flex: 1, padding: '5px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 11 }} />
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                                <input type="date" value={addDateValue}
                                  onChange={e => setAddDateValue(e.target.value)}
                                  style={{ flex: 1, padding: '5px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 11 }} />
                                <button
                                  onClick={() => {
                                    if (addDateValue && !selectedDates.includes(addDateValue)) {
                                      setSelectedDates(d => [...d, addDateValue].sort());
                                    }
                                    setAddDateValue('');
                                  }}
                                  disabled={!addDateValue}
                                  style={{
                                    padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 800, cursor: addDateValue ? 'pointer' : 'default',
                                    background: addDateValue ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)',
                                    color: addDateValue ? '#06b6d4' : '#475569',
                                  }}
                                >+ Add</button>
                                <span style={{ fontSize: 10, color: '#475569' }}>{selectedDates.length} selected</span>
                              </div>
                              {selectedDates.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {selectedDates.map(d => (
                                    <span key={d} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                                      background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                                      borderRadius: 4, fontSize: 10, color: '#06b6d4', fontWeight: 600,
                                    }}>
                                      {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      <button onClick={() => setSelectedDates(ds => ds.filter(x => x !== d))}
                                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                                    </span>
                                  ))}
                                  <button onClick={() => setSelectedDates([])}
                                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 9, cursor: 'pointer', fontWeight: 600 }}>Clear all</button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Filtered report count */}
                          {(dateMode === 'range' ? (dateFrom && dateTo) : selectedDates.length > 0) && (
                            <div style={{ marginTop: 6, fontSize: 10, color: '#64748b' }}>
                              {getFilteredReports().length} of {pilotReports.length} reports match selected dates ·
                              {' '}{getFilteredReports().reduce((s, r) => s + Number(r.blocksCompleted || 0), 0)} LBDs ·
                              {' '}{getFilteredReports().reduce((s, r) => s + Number(r.missionsFlown || 0), 0)} flights ·
                              {' '}{getFilteredReports().reduce((s, r) => s + Number(r.hoursWorked || 0), 0).toFixed(1)}h
                            </div>
                          )}
                        </div>

                        {/* Weather Preview */}
                        {loadingWeather && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#475569', fontSize: 11 }}>
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Loading weather data…
                          </div>
                        )}
                        {!loadingWeather && weatherData.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                              🌤 Weather ({weatherData.length} days)
                            </div>
                            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
                              {weatherData.slice(0, 14).map(w => {
                                const wmo = WMO_LABELS[w.weatherCode] || { label: '?', icon: '❓' };
                                const isBad = w.precipSum > 5 || w.windMax > 40 || [65, 75, 82, 95, 96, 99].includes(w.weatherCode);
                                return (
                                  <div key={w.date} style={{
                                    minWidth: 56, padding: '4px 6px', borderRadius: 6, textAlign: 'center', fontSize: 9,
                                    background: isBad ? 'rgba(245,158,11,0.08)' : 'rgba(15,23,42,0.4)',
                                    border: `1px solid ${isBad ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)'}`,
                                  }}>
                                    <div style={{ color: '#64748b', fontWeight: 600 }}>{new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                    <div style={{ fontSize: 14, margin: '2px 0' }}>{wmo.icon}</div>
                                    <div style={{ color: '#94a3b8' }}>{Math.round(w.tempMax)}°/{Math.round(w.tempMin)}°</div>
                                    {w.precipSum > 0.1 && <div style={{ color: '#3b82f6' }}>{w.precipSum.toFixed(1)}mm</div>}
                                    {w.windMax > 30 && <div style={{ color: '#f59e0b' }}>{Math.round(w.windMax)}km/h</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {!loadingWeather && weatherData.length === 0 && (dateMode === 'range' ? (dateFrom && dateTo) : selectedDates.length > 0) && (selectedMission.latitude || selectedMission.lat) && (
                          <div style={{ marginTop: 8, fontSize: 10, color: '#475569', fontStyle: 'italic' }}>No weather data available for selected dates.</div>
                        )}
                        {!loadingWeather && !(selectedMission.latitude || selectedMission.lat) && (
                          <div style={{ marginTop: 8, fontSize: 10, color: '#475569', fontStyle: 'italic' }}>⚠ No GPS coordinates for this mission — weather data unavailable.</div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          <button onClick={handleInsertMission} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none',
                            borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                          }}>
                            <PlusCircle size={12} /> Add Mission Data
                          </button>
                          <button onClick={handleAutoPopulateReport} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none',
                            borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                          }}>
                            <FileText size={12} /> Auto-Generate Report Sections
                          </button>
                          {pilotReports.some(pr => pr.issuesEncountered || pr.isIncident) && (
                            <button onClick={handleAddPilotReportsAsFindings} style={{
                              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                              background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.3)',
                              borderRadius: 8, color: '#fb923c', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}>
                              <AlertCircle size={12} /> Add Issues as Findings
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Add Section Menu ──────────────────────────────────────────────────────────

const AddSectionMenu: React.FC<{ onAdd: (type: ReportSection['type']) => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const types: ReportSection['type'][] = ['text', 'findings', 'recommendations', 'cost_table', 'compliance', 'risk_matrix', 'mission_data', 'appendix'];

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
  const [previewOpen, setPreviewOpen] = useState(false);
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

  // Insert a fully-formed section (e.g. from Mission Data → "Add Issues as Findings")
  const addSectionToReport = (newSection: ReportSection) => {
    setReport(r => ({ ...r, sections: [...r.sections, newSection] }));
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
          <button onClick={() => setPreviewOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 8, color: '#34d399', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            <Eye size={13} /> Preview
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

      {/* ── Preview Modal ── */}
      {previewOpen && (() => {
        const fullHTML = buildPrintHTML(report);
        // Extract the <style> and <body> content from the full HTML
        const styleMatch = fullHTML.match(/<style>([\s\S]*?)<\/style>/);
        const bodyMatch = fullHTML.match(/<body>([\s\S]*?)<\/body>/);
        const scopedCSS = styleMatch ? styleMatch[1]
          .replace(/body\s*\{/g, '.preview-body {')
          .replace(/\*/g, '.preview-body *')
          : '';
        const bodyContent = bodyMatch ? bodyMatch[1] : fullHTML;
        return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          {/* Preview toolbar */}
          <div style={{
            width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '16px 20px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Eye size={16} color="#34d399" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>Report Preview</span>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{report.title || 'Untitled'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setPreviewOpen(false); exportPDF(report); }} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 6, color: '#a78bfa', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>
                <Printer size={12} /> Print / PDF
              </button>
              <button onClick={() => setPreviewOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#94a3b8', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>
                <X size={12} /> Close
              </button>
            </div>
          </div>
          {/* Preview content */}
          <div style={{
            flex: 1, width: '100%', maxWidth: 900, overflowY: 'auto',
            borderRadius: '12px 12px 0 0', background: '#fff',
            boxShadow: '0 -4px 40px rgba(0,0,0,0.5)',
          }}>
            <style dangerouslySetInnerHTML={{ __html: scopedCSS }} />
            <div
              className="preview-body"
              style={{ color: '#1e293b', background: '#fff', padding: 40, maxWidth: 900, margin: '0 auto', fontFamily: "'Segoe UI', system-ui, Arial, sans-serif" }}
              dangerouslySetInnerHTML={{ __html: bodyContent }}
            />
          </div>
        </div>
        );
      })()}

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
            <option value="progress_update">Progress Update</option>
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
                  {sec.type === 'mission_data' && (
                    <MissionDataEditor
                      section={sec}
                      onUpdate={patch => updateSection(sec.id, patch)}
                      onAddSectionToReport={addSectionToReport}
                    />
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
