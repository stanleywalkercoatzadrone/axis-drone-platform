import React, { useState, useEffect } from 'react';
import {
  CheckCircle, ChevronRight, Loader2, Plus, Calendar, Cpu,
  Image, MapPin, Hash, Layers, AlertCircle
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Step1Data {
  flight_date: string;
  survey_date: string;
  processing_engine: string;
  data_quality: string;
  notes: string;
}

interface Step2Data {
  gsd_cm: string;
  area_hectares: string;
  total_images: string;
  images_reconstructed: string;
  reprojection_error_px: string;
  has_gps: boolean;
  spatial_reference: string;
  orthomosaic_job_id: string;
}

interface Step3Data {
  piles_planned: string;
  tracker_rows_planned: string;
  modules_planned: string;
  inverter_pads_planned: string;
  roads_planned_m: string;
  blocks_planned: string;
}

interface Props {
  siteId: string;
  onSurveyCreated: () => void;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const steps = [
  { label: 'Survey Type' },
  { label: 'Photogrammetry' },
  { label: 'Quantities' },
  { label: 'Review' },
];

interface StepIndicatorProps { current: number }

const StepIndicator: React.FC<StepIndicatorProps> = ({ current }) => (
  <div className="flex items-center justify-center gap-0 mb-8">
    {steps.map((s, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center">
            <div
              style={{
                width: 32, height: 32,
                background: done
                  ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                  : active
                    ? 'linear-gradient(135deg,#3b82f6,#2563eb)'
                    : 'rgba(51,65,85,0.8)',
                border: active ? '2px solid rgba(59,130,246,0.5)' : '2px solid transparent',
                boxShadow: active ? '0 0 12px rgba(59,130,246,0.4)' : 'none',
                transition: 'all 0.3s',
              }}
              className="rounded-full flex items-center justify-center"
            >
              {done ? (
                <CheckCircle size={16} className="text-white" />
              ) : (
                <span className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{i + 1}</span>
              )}
            </div>
            <span className={`text-xs mt-1.5 font-medium ${active ? 'text-white' : done ? 'text-green-400' : 'text-slate-500'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              style={{ width: 60, height: 2, background: done ? '#22c55e' : 'rgba(51,65,85,0.8)', transition: 'background 0.3s', marginBottom: 20 }}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Field wrapper ────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div>
    <label className="block text-slate-400 text-xs font-medium mb-1.5">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
const selectCls = inputCls;

// ─── Summary Row ──────────────────────────────────────────────────────────────

const SummaryRow: React.FC<{ label: string; value: string | number | boolean | undefined; unit?: string }> = ({ label, value, unit }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-slate-700/40 last:border-0">
    <span className="text-slate-400 text-sm">{label}</span>
    <span className="text-white text-sm font-medium">
      {value === true ? '✓ Yes' : value === false ? '✗ No' : (value ?? '—')}{unit ? ` ${unit}` : ''}
    </span>
  </div>
);

// ─── Component ───────────────────────────────────────────────────────────────

const ProjectIntakePage: React.FC<Props> = ({ siteId, onSurveyCreated }) => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [step1, setStep1] = useState<Step1Data>({
    flight_date: '',
    survey_date: new Date().toISOString().split('T')[0],
    processing_engine: 'OpenDroneMap',
    data_quality: 'good',
    notes: '',
  });

  const [step2, setStep2] = useState<Step2Data>({
    gsd_cm: '',
    area_hectares: '',
    total_images: '',
    images_reconstructed: '',
    reprojection_error_px: '',
    has_gps: true,
    spatial_reference: 'WGS84/UTM',
    orthomosaic_job_id: '',
  });

  const [step3, setStep3] = useState<Step3Data>({
    piles_planned: '',
    tracker_rows_planned: '',
    modules_planned: '',
    inverter_pads_planned: '',
    roads_planned_m: '',
    blocks_planned: '',
  });

  // Prefill from site data
  useEffect(() => {
    apiClient.get(`/api/solar-farm/sites/${siteId}/surveys`)
      .then(res => {
        const surveys: any[] = res.data ?? [];
        if (surveys.length > 0) {
          const latest = surveys[surveys.length - 1];
          if (latest.piles_planned) setStep3(s => ({ ...s, piles_planned: String(latest.piles_planned) }));
        }
      })
      .catch(() => {});
  }, [siteId]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      // 1. Create survey
      const surveyPayload = {
        site_id: siteId,
        flight_date: step1.flight_date || null,
        survey_date: step1.survey_date,
        processing_engine: step1.processing_engine,
        data_quality: step1.data_quality,
        notes: step1.notes,
        gsd_cm: step2.gsd_cm ? parseFloat(step2.gsd_cm) : null,
        area_hectares: step2.area_hectares ? parseFloat(step2.area_hectares) : null,
        total_images: step2.total_images ? parseInt(step2.total_images) : null,
        images_reconstructed: step2.images_reconstructed ? parseInt(step2.images_reconstructed) : null,
        reprojection_error_px: step2.reprojection_error_px ? parseFloat(step2.reprojection_error_px) : null,
        has_gps: step2.has_gps,
        spatial_reference: step2.spatial_reference,
        orthomosaic_job_id: step2.orthomosaic_job_id || null,
      };

      const surveyRes = await apiClient.post(`/api/solar-farm/sites/${siteId}/surveys`, surveyPayload);
      const newSurveyId = surveyRes.data?.id ?? surveyRes.data?.survey_id;

      // 2. Create progress snapshot if quantities entered
      const hasQty = Object.values(step3).some(v => v !== '');
      if (newSurveyId && hasQty) {
        await apiClient.post(`/api/solar-farm/surveys/${newSurveyId}/progress`, {
          piles_planned: step3.piles_planned ? parseInt(step3.piles_planned) : null,
          piles_installed: 0,
          tracker_rows_planned: step3.tracker_rows_planned ? parseInt(step3.tracker_rows_planned) : null,
          tracker_rows_installed: 0,
          modules_planned: step3.modules_planned ? parseInt(step3.modules_planned) : null,
          modules_installed: 0,
          inverter_pads_planned: step3.inverter_pads_planned ? parseInt(step3.inverter_pads_planned) : null,
          inverter_pads_installed: 0,
          roads_planned_m: step3.roads_planned_m ? parseFloat(step3.roads_planned_m) : null,
          roads_installed_m: 0,
          blocks_planned: step3.blocks_planned ? parseInt(step3.blocks_planned) : null,
          blocks_installed: 0,
        });
      }

      setSuccess(true);
      setTimeout(() => onSurveyCreated(), 1500);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create survey');
    } finally {
      setSubmitting(false);
    }
  };

  const cardStyle = {
    background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.8) 100%)',
    border: '1px solid rgba(51,65,85,0.8)',
    backdropFilter: 'blur(12px)',
  };

  if (success) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div
            style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle size={40} className="text-green-400" />
          </div>
          <h3 className="text-white font-bold text-xl mb-2">Survey Created!</h3>
          <p className="text-slate-400 text-sm">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plus size={22} className="text-blue-400" /> New Survey Intake
        </h2>
        <p className="text-slate-400 text-sm mt-1">Register a drone survey for this solar site</p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step panels ── */}
      <div style={cardStyle} className="rounded-2xl p-6 shadow-2xl">

        {/* Step 0: Survey Type */}
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-base flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-blue-400" /> Survey Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Survey Date" required>
                <input type="date" value={step1.survey_date}
                  onChange={e => setStep1(s => ({ ...s, survey_date: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Flight Date">
                <input type="date" value={step1.flight_date}
                  onChange={e => setStep1(s => ({ ...s, flight_date: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Processing Engine">
                <select value={step1.processing_engine}
                  onChange={e => setStep1(s => ({ ...s, processing_engine: e.target.value }))}
                  className={selectCls}>
                  <option>OpenDroneMap</option>
                  <option>Pix4D</option>
                  <option>DJI Terra</option>
                  <option>Agisoft Metashape</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Data Quality">
                <select value={step1.data_quality}
                  onChange={e => setStep1(s => ({ ...s, data_quality: e.target.value }))}
                  className={selectCls}>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="acceptable">Acceptable</option>
                  <option value="poor">Poor</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea value={step1.notes}
                    onChange={e => setStep1(s => ({ ...s, notes: e.target.value }))}
                    rows={3} className={`${inputCls} resize-none`}
                    placeholder="Additional survey notes…" />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Photogrammetry */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-base flex items-center gap-2 mb-4">
              <Cpu size={18} className="text-purple-400" /> Photogrammetry Metrics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="GSD (cm)">
                <input type="number" step="0.01" min="0" placeholder="2.5"
                  value={step2.gsd_cm}
                  onChange={e => setStep2(s => ({ ...s, gsd_cm: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Area (hectares)">
                <input type="number" step="0.1" min="0" placeholder="150.0"
                  value={step2.area_hectares}
                  onChange={e => setStep2(s => ({ ...s, area_hectares: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Total Images">
                <input type="number" min="0" placeholder="4200"
                  value={step2.total_images}
                  onChange={e => setStep2(s => ({ ...s, total_images: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Images Reconstructed">
                <input type="number" min="0" placeholder="4180"
                  value={step2.images_reconstructed}
                  onChange={e => setStep2(s => ({ ...s, images_reconstructed: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Reprojection Error (px)">
                <input type="number" step="0.01" min="0" placeholder="0.35"
                  value={step2.reprojection_error_px}
                  onChange={e => setStep2(s => ({ ...s, reprojection_error_px: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Spatial Reference">
                <input type="text" placeholder="WGS84/UTM"
                  value={step2.spatial_reference}
                  onChange={e => setStep2(s => ({ ...s, spatial_reference: e.target.value }))}
                  className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Orthomosaic Job ID (optional)">
                  <input type="text" placeholder="Link to existing processing job…"
                    value={step2.orthomosaic_job_id}
                    onChange={e => setStep2(s => ({ ...s, orthomosaic_job_id: e.target.value }))}
                    className={inputCls} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setStep2(s => ({ ...s, has_gps: !s.has_gps }))}
                    style={{
                      width: 40, height: 22,
                      background: step2.has_gps ? '#3b82f6' : 'rgba(51,65,85,0.8)',
                      borderRadius: 11,
                      position: 'relative',
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3,
                      left: step2.has_gps ? 21 : 3,
                      width: 16, height: 16,
                      background: 'white', borderRadius: 8,
                      transition: 'left 0.2s',
                    }} />
                  </div>
                  <span className="text-slate-300 text-sm">Has GPS / RTK positioning</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Planned Quantities */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-white font-bold text-base flex items-center gap-2 mb-2">
              <Layers size={18} className="text-amber-400" /> Planned Quantities
            </h3>
            <p className="text-slate-400 text-xs mb-4">Enter design quantities for progress tracking. Leave blank if not applicable.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Piles Planned">
                <input type="number" min="0" placeholder="4200"
                  value={step3.piles_planned}
                  onChange={e => setStep3(s => ({ ...s, piles_planned: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Tracker Rows Planned">
                <input type="number" min="0" placeholder="680"
                  value={step3.tracker_rows_planned}
                  onChange={e => setStep3(s => ({ ...s, tracker_rows_planned: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Modules Planned">
                <input type="number" min="0" placeholder="28000"
                  value={step3.modules_planned}
                  onChange={e => setStep3(s => ({ ...s, modules_planned: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Inverter Pads Planned">
                <input type="number" min="0" placeholder="8"
                  value={step3.inverter_pads_planned}
                  onChange={e => setStep3(s => ({ ...s, inverter_pads_planned: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Roads Planned (meters)">
                <input type="number" min="0" placeholder="12000"
                  value={step3.roads_planned_m}
                  onChange={e => setStep3(s => ({ ...s, roads_planned_m: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Blocks Planned">
                <input type="number" min="0" placeholder="24"
                  value={step3.blocks_planned}
                  onChange={e => setStep3(s => ({ ...s, blocks_planned: e.target.value }))}
                  className={inputCls} />
              </Field>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2 mb-4">
              <CheckCircle size={18} className="text-green-400" /> Review & Submit
            </h3>

            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Survey Info */}
              <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.5)' }} className="rounded-xl p-4">
                <p className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1">
                  <Calendar size={12} /> Survey Information
                </p>
                <SummaryRow label="Survey Date" value={step1.survey_date} />
                <SummaryRow label="Flight Date" value={step1.flight_date || '—'} />
                <SummaryRow label="Processing Engine" value={step1.processing_engine} />
                <SummaryRow label="Data Quality" value={step1.data_quality} />
                {step1.notes && <SummaryRow label="Notes" value={step1.notes} />}
              </div>

              {/* Photogrammetry */}
              <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.5)' }} className="rounded-xl p-4">
                <p className="text-purple-400 text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1">
                  <Cpu size={12} /> Photogrammetry Metrics
                </p>
                <SummaryRow label="GSD" value={step2.gsd_cm} unit="cm" />
                <SummaryRow label="Area" value={step2.area_hectares} unit="ha" />
                <SummaryRow label="Total Images" value={step2.total_images} />
                <SummaryRow label="Reconstructed" value={step2.images_reconstructed} />
                <SummaryRow label="Reprojection Error" value={step2.reprojection_error_px} unit="px" />
                <SummaryRow label="Has GPS" value={step2.has_gps} />
                <SummaryRow label="Spatial Ref." value={step2.spatial_reference} />
              </div>

              {/* Quantities */}
              <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.5)' }} className="rounded-xl p-4">
                <p className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1">
                  <Layers size={12} /> Planned Quantities
                </p>
                <SummaryRow label="Piles" value={step3.piles_planned} />
                <SummaryRow label="Tracker Rows" value={step3.tracker_rows_planned} />
                <SummaryRow label="Modules" value={step3.modules_planned} />
                <SummaryRow label="Inverter Pads" value={step3.inverter_pads_planned} />
                <SummaryRow label="Roads" value={step3.roads_planned_m} unit="m" />
                <SummaryRow label="Blocks" value={step3.blocks_planned} />
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
            >
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Continue <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              Create Survey
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectIntakePage;
