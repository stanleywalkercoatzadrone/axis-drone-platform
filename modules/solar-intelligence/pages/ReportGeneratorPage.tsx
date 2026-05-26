import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Download, Loader2, CheckSquare, Square, Printer, Save,
  Calendar, Building2, Zap, AlertTriangle, Thermometer, TrendingUp, Package
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SolarSite {
  id: string; site_name: string; client_name?: string; location_description?: string;
  capacity_mw?: number; status: string; epc_contractor?: string; owner_name?: string; cod_target?: string;
}
interface Survey { id: string; survey_date: string; gsd_cm?: number; area_hectares?: number; data_quality?: string; total_images?: number; }
interface Issue { id: string; title: string; severity: string; status: string; issue_type?: string; created_at: string; }
interface ThermalFinding { id: string; finding_type: string; severity: string; delta_t_celsius?: number; module_id?: string; status: string; }
interface ProgressSnapshot { modules_planned?: number; modules_installed?: number; piles_planned?: number; piles_installed?: number; tracker_rows_planned?: number; tracker_rows_installed?: number; overall_progress_pct?: number; }

type ReportType = 'full' | 'progress' | 'qaqc' | 'thermal';

interface ContentToggles {
  executive_summary: boolean;
  survey_metrics: boolean;
  construction_progress: boolean;
  qaqc_issues: boolean;
  thermal_findings: boolean;
  asset_summary: boolean;
}

interface Props { siteId: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e',
};

const pct = (inst?: number, plan?: number): number => {
  if (!plan || plan === 0) return 0;
  return Math.min(100, ((inst ?? 0) / plan) * 100);
};

// ─── Print styles injected once ───────────────────────────────────────────────

const PRINT_STYLES = `
@media print {
  body > * { display: none !important; }
  #solar-report-print { display: block !important; }
  #solar-report-print { color: #000; background: #fff; }
}
`;

// ─── Component ───────────────────────────────────────────────────────────────

const ReportGeneratorPage: React.FC<Props> = ({ siteId }) => {
  const [site, setSite]           = useState<SolarSite | null>(null);
  const [surveys, setSurveys]     = useState<Survey[]>([]);
  const [issues, setIssues]       = useState<Issue[]>([]);
  const [thermal, setThermal]     = useState<ThermalFinding[]>([]);
  const [progress, setProgress]   = useState<ProgressSnapshot | null>(null);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('full');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [reportTitle, setReportTitle] = useState('');
  const [toggles, setToggles]     = useState<ContentToggles>({
    executive_summary: true, survey_metrics: true, construction_progress: true,
    qaqc_issues: true, thermal_findings: true, asset_summary: false,
  });

  const printRef = useRef<HTMLDivElement>(null);

  // Inject print styles once
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = PRINT_STYLES;
    style.id = 'solar-report-print-styles';
    if (!document.getElementById('solar-report-print-styles')) {
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById('solar-report-print-styles');
      if (el) el.remove();
    };
  }, []);

  const fetchBase = useCallback(async () => {
    try {
      setLoading(true);
      const [siteRes, surveysRes] = await Promise.allSettled([
        apiClient.get(`/api/solar-farm/sites/${siteId}`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/surveys`),
      ]);
      if (siteRes.status === 'fulfilled') setSite(siteRes.value.data);
      if (surveysRes.status === 'fulfilled') {
        const s: Survey[] = surveysRes.value.data ?? [];
        setSurveys(s);
        if (s.length > 0) setSelectedSurveyId(s[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchBase(); }, [fetchBase]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const [issuesRes, thermalRes, progressRes] = await Promise.allSettled([
        apiClient.get(`/api/solar-farm/sites/${siteId}/issues`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/thermal`),
        apiClient.get(`/api/solar-farm/sites/${siteId}/progress`),
      ]);
      if (issuesRes.status === 'fulfilled') setIssues(issuesRes.value.data ?? []);
      if (thermalRes.status === 'fulfilled') setThermal(thermalRes.value.data ?? []);
      if (progressRes.status === 'fulfilled') {
        const d = progressRes.value.data;
        setProgress(Array.isArray(d) ? d[0] ?? null : d ?? null);
      }
      setPreviewReady(true);
    } catch {
      // Use demo data
      setIssues([
        { id: 'i1', title: 'Module misalignment Block 4A', severity: 'high', status: 'open', issue_type: 'misalignment', created_at: new Date().toISOString() },
        { id: 'i2', title: 'Missing module Row 22', severity: 'critical', status: 'open', issue_type: 'missing_module', created_at: new Date().toISOString() },
      ]);
      setThermal([
        { id: 't1', finding_type: 'hotspot', severity: 'critical', delta_t_celsius: 42.5, module_id: 'B4-R22-M14', status: 'open' },
      ]);
      setProgress({ modules_planned: 28000, modules_installed: 17500, piles_planned: 4200, piles_installed: 3100, tracker_rows_planned: 680, tracker_rows_installed: 510, overall_progress_pct: 62 });
      setPreviewReady(true);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      printRef.current.id = 'solar-report-print';
    }
    window.print();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const title = reportTitle || `${site?.site_name ?? 'Site'} — ${reportType.toUpperCase()} Report — ${new Date().toLocaleDateString()}`;
      await apiClient.post(`/api/solar-farm/sites/${siteId}/reports`, {
        report_type: reportType,
        title,
        survey_id: selectedSurveyId || null,
        content_summary: {
          toggles,
          issues_count: issues.length,
          thermal_count: thermal.length,
          generated_at: new Date().toISOString(),
        },
      });
      alert('Report record saved!');
    } catch {
      alert('Failed to save report record');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof ContentToggles) =>
    setToggles(t => ({ ...t, [key]: !t[key] }));

  const selectedSurvey = surveys.find(s => s.id === selectedSurveyId);

  const openIssues = issues.filter(i => i.status === 'open');
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const criticalThermal = thermal.filter(f => f.severity === 'critical');
  const overallPct = progress?.overall_progress_pct ?? pct(progress?.modules_installed, progress?.modules_planned);

  const cardStyle = {
    background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.8) 100%)',
    border: '1px solid rgba(51,65,85,0.7)',
    backdropFilter: 'blur(12px)',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText size={22} className="text-purple-400" /> Report Generator
        </h2>
        <p className="text-slate-400 text-sm mt-0.5">Generate and export professional site reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left panel: settings ── */}
        <div className="space-y-4">
          <div style={cardStyle} className="rounded-2xl p-5">
            <h3 className="text-white font-bold mb-4 text-sm">Report Settings</h3>

            {/* Report type */}
            <div className="mb-4">
              <label className="block text-slate-400 text-xs font-medium mb-2">Report Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['full', 'progress', 'qaqc', 'thermal'] as ReportType[]).map(rt => (
                  <button key={rt} onClick={() => setReportType(rt)}
                    style={reportType === rt ? { background: '#3b82f6', borderColor: '#3b82f6' } : { borderColor: 'rgba(51,65,85,0.8)' }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-all ${reportType === rt ? 'text-white' : 'text-slate-400 hover:text-white hover:border-slate-500'}`}>
                    {rt === 'full' ? 'Full Survey' : rt === 'qaqc' ? 'QA/QC' : rt.charAt(0).toUpperCase() + rt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Survey selector */}
            {surveys.length > 0 && (
              <div className="mb-4">
                <label className="block text-slate-400 text-xs font-medium mb-2">Survey</label>
                <select value={selectedSurveyId} onChange={e => setSelectedSurveyId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500">
                  <option value="">All Surveys</option>
                  {surveys.map(s => (
                    <option key={s.id} value={s.id}>{new Date(s.survey_date).toLocaleDateString()}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Report title */}
            <div className="mb-4">
              <label className="block text-slate-400 text-xs font-medium mb-2">Report Title (optional)</label>
              <input type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                placeholder="Auto-generated if empty" />
            </div>

            {/* Content toggles */}
            <div className="mb-5">
              <label className="block text-slate-400 text-xs font-medium mb-3">Include Sections</label>
              <div className="space-y-2">
                {(Object.keys(toggles) as (keyof ContentToggles)[]).map(key => (
                  <button key={key} onClick={() => toggle(key)}
                    className="w-full flex items-center gap-3 py-1.5 text-sm text-left hover:text-white transition-colors">
                    {toggles[key]
                      ? <CheckSquare size={16} className="text-blue-400 flex-shrink-0" />
                      : <Square size={16} className="text-slate-600 flex-shrink-0" />}
                    <span className={toggles[key] ? 'text-slate-200' : 'text-slate-500'}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button onClick={handleGenerate} disabled={generating || loading}
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity">
                {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Generate Preview
              </button>
              <button onClick={handlePrint} disabled={!previewReady}
                style={{ border: '1px solid rgba(51,65,85,0.8)' }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-slate-400 rounded-lg hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <Printer size={14} /> Print / Download PDF
              </button>
              <button onClick={handleSave} disabled={!previewReady || saving}
                style={{ border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7' }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg hover:bg-purple-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Report Record
              </button>
            </div>
          </div>
        </div>

        {/* ── Right panel: preview ── */}
        <div className="lg:col-span-2">
          {!previewReady ? (
            <div style={cardStyle} className="rounded-2xl p-10 flex flex-col items-center justify-center min-h-[500px]">
              {loading ? (
                <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
              ) : (
                <>
                  <FileText size={48} className="text-slate-600 mb-4" />
                  <p className="text-white font-semibold">Configure and generate your report</p>
                  <p className="text-slate-400 text-sm mt-1">Click "Generate Preview" to render the report</p>
                </>
              )}
            </div>
          ) : (
            /* White page preview */
            <div ref={printRef}
              style={{
                background: '#ffffff', color: '#1e293b',
                borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                minHeight: 900,
              }}
              className="overflow-hidden"
            >
              {/* Report header */}
              <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: '32px 40px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
                      {site?.site_name ?? 'Solar Farm'} — {reportType === 'full' ? 'Full Survey Report' : reportType === 'qaqc' ? 'QA/QC Report' : reportType === 'thermal' ? 'Thermal Analysis Report' : 'Progress Report'}
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>
                      Generated {new Date().toLocaleDateString()} · {selectedSurvey ? `Survey ${new Date(selectedSurvey.survey_date).toLocaleDateString()}` : 'All Surveys'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#3b82f6', fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>AXIS SOLAR INTELLIGENCE</p>
                    <p style={{ color: '#475569', fontSize: 11 }}>Drone Inspection Platform</p>
                  </div>
                </div>
              </div>

              <div style={{ padding: '32px 40px' }}>
                {/* Site meta */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32, padding: '16px 20px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  {[
                    { icon: '🏗', label: 'Client', value: site?.client_name ?? '—' },
                    { icon: '⚡', label: 'Capacity', value: `${site?.capacity_mw ?? '—'} MW` },
                    { icon: '📍', label: 'Location', value: site?.location_description ?? '—' },
                    { icon: '🔧', label: 'EPC', value: site?.epc_contractor ?? '—' },
                    { icon: '👤', label: 'Owner', value: site?.owner_name ?? '—' },
                    { icon: '📅', label: 'COD Target', value: site?.cod_target ? new Date(site.cod_target).toLocaleDateString() : '—' },
                  ].map(({ icon, label, value }) => (
                    <div key={label}>
                      <p style={{ color: '#64748b', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{icon} {label}</p>
                      <p style={{ color: '#1e293b', fontSize: 13, fontWeight: 600 }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Executive Summary */}
                {toggles.executive_summary && (
                  <section style={{ marginBottom: 28 }}>
                    <h2 style={{ color: '#1e293b', fontSize: 16, fontWeight: 700, borderBottom: '2px solid #3b82f6', paddingBottom: 8, marginBottom: 16 }}>
                      Executive Summary
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                      {[
                        { label: 'Overall Progress', value: `${overallPct.toFixed(0)}%`, color: '#3b82f6' },
                        { label: 'Open Issues', value: openIssues.length, color: openIssues.length > 0 ? '#ef4444' : '#22c55e' },
                        { label: 'Critical Issues', value: criticalIssues.length, color: criticalIssues.length > 0 ? '#ef4444' : '#22c55e' },
                        { label: 'Critical Thermal', value: criticalThermal.length, color: criticalThermal.length > 0 ? '#f97316' : '#22c55e' },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <p style={{ color, fontSize: 24, fontWeight: 800 }}>{value}</p>
                          <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Survey Metrics */}
                {toggles.survey_metrics && selectedSurvey && (
                  <section style={{ marginBottom: 28 }}>
                    <h2 style={{ color: '#1e293b', fontSize: 16, fontWeight: 700, borderBottom: '2px solid #22c55e', paddingBottom: 8, marginBottom: 16 }}>
                      Survey Metrics
                    </h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <tbody>
                        {[
                          { label: 'Survey Date', value: new Date(selectedSurvey.survey_date).toLocaleDateString() },
                          { label: 'GSD', value: selectedSurvey.gsd_cm ? `${selectedSurvey.gsd_cm} cm` : '—' },
                          { label: 'Area', value: selectedSurvey.area_hectares ? `${selectedSurvey.area_hectares} ha` : '—' },
                          { label: 'Images', value: selectedSurvey.total_images?.toLocaleString() ?? '—' },
                          { label: 'Data Quality', value: selectedSurvey.data_quality ?? '—' },
                        ].map(({ label, value }) => (
                          <tr key={label} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', fontWeight: 600, width: '40%' }}>{label}</td>
                            <td style={{ padding: '8px 12px', color: '#1e293b' }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}

                {/* Construction Progress */}
                {toggles.construction_progress && progress && (
                  <section style={{ marginBottom: 28 }}>
                    <h2 style={{ color: '#1e293b', fontSize: 16, fontWeight: 700, borderBottom: '2px solid #f59e0b', paddingBottom: 8, marginBottom: 16 }}>
                      Construction Progress
                    </h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Category', 'Planned', 'Installed', '% Complete'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Category' ? 'left' : 'right', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Piles', inst: progress.piles_installed, plan: progress.piles_planned },
                          { label: 'Tracker Rows', inst: progress.tracker_rows_installed, plan: progress.tracker_rows_planned },
                          { label: 'Modules', inst: progress.modules_installed, plan: progress.modules_planned },
                        ].map(({ label, inst, plan }) => {
                          const p = pct(inst, plan);
                          return (
                            <tr key={label} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 600 }}>{label}</td>
                              <td style={{ padding: '8px 12px', color: '#64748b', textAlign: 'right' }}>{(plan ?? 0).toLocaleString()}</td>
                              <td style={{ padding: '8px 12px', color: '#1e293b', textAlign: 'right', fontWeight: 600 }}>{(inst ?? 0).toLocaleString()}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: p >= 75 ? '#22c55e' : p >= 40 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{p.toFixed(0)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                )}

                {/* QA/QC Issues */}
                {toggles.qaqc_issues && issues.length > 0 && (
                  <section style={{ marginBottom: 28 }}>
                    <h2 style={{ color: '#1e293b', fontSize: 16, fontWeight: 700, borderBottom: '2px solid #ef4444', paddingBottom: 8, marginBottom: 16 }}>
                      QA/QC Issues ({issues.length} total, {openIssues.length} open)
                    </h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Title', 'Type', 'Severity', 'Status', 'Date'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {issues.slice(0, 10).map(issue => (
                          <tr key={issue.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>{issue.title}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b', textTransform: 'capitalize' }}>{issue.issue_type?.replace('_', ' ') ?? '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ color: SEV_COLOR[issue.severity] ?? '#64748b', fontWeight: 700, textTransform: 'capitalize', fontSize: 11 }}>{issue.severity}</span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b', textTransform: 'capitalize' }}>{issue.status.replace('_', ' ')}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{issue.created_at && new Date(issue.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {issues.length > 10 && (
                      <p style={{ color: '#64748b', fontSize: 11, marginTop: 8, textAlign: 'center' }}>… and {issues.length - 10} more issues</p>
                    )}
                  </section>
                )}

                {/* Thermal */}
                {toggles.thermal_findings && thermal.length > 0 && (
                  <section style={{ marginBottom: 28 }}>
                    <h2 style={{ color: '#1e293b', fontSize: 16, fontWeight: 700, borderBottom: '2px solid #f97316', paddingBottom: 8, marginBottom: 16 }}>
                      Thermal Findings ({thermal.length} total)
                    </h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Type', 'Module', 'ΔT°C', 'Severity', 'Status'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {thermal.slice(0, 10).map(f => (
                          <tr key={f.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', color: '#1e293b', textTransform: 'capitalize' }}>{f.finding_type.replace('_', ' ')}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace' }}>{f.module_id ?? '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#f97316', fontWeight: 700 }}>{f.delta_t_celsius != null ? `+${f.delta_t_celsius}` : '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ color: SEV_COLOR[f.severity] ?? '#64748b', fontWeight: 700, textTransform: 'capitalize', fontSize: 11 }}>{f.severity}</span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b', textTransform: 'capitalize' }}>{f.status.replace('_', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}

                {/* Footer */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, textAlign: 'center', color: '#94a3b8', fontSize: 10 }}>
                  Generated by AXIS Solar Farm Intelligence Platform · {new Date().toLocaleString()} · Confidential
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportGeneratorPage;
