/**
 * PilotProtocolsPanel.tsx — Pilot/Technician Protocol Acknowledgment UI
 * Shown in the pilot terminal for a selected mission
 * Step-by-step walkthrough with digital sign-off
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, CheckCircle, Clock, AlertTriangle, ChevronRight, ChevronDown,
  FileText, CheckSquare, Edit3, PenLine, ArrowRight, Loader2, BookOpen
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

interface ProtocolStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type: 'check' | 'sign' | 'input' | 'photo';
  required: boolean;
}

interface Protocol {
  id: string;
  title: string;
  description: string;
  category: 'pre_flight' | 'mission' | 'post_flight' | 'emergency' | 'general';
  mission_type: string;
  steps: ProtocolStep[];
  version: string;
  is_required: boolean;
  step_count: number;
  acknowledged_at?: string;
  step_responses?: Record<string, any>;
  signature?: string;
}

const CATEGORY_META = {
  pre_flight:  { label: 'Pre-Flight',  icon: '🛡️', color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   ring: 'ring-blue-500' },
  mission:     { label: 'Mission',     icon: '📋', color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200', ring: 'ring-violet-500' },
  post_flight: { label: 'Post-Flight', icon: '✅', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-500' },
  emergency:   { label: 'Emergency',   icon: '⚠️', color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    ring: 'ring-red-500' },
  general:     { label: 'General',     icon: '📖', color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200',  ring: 'ring-slate-500' },
};

// ── Protocol Walkthrough Modal ─────────────────────────────────────────────────
const ProtocolWalkthrough: React.FC<{
  protocol: Protocol;
  missionId: string;
  onClose: () => void;
  onAcknowledged: () => void;
}> = ({ protocol, missionId, onClose, onAcknowledged }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, { completed: boolean; value: string }>>(() => {
    if (protocol.step_responses) {
      return Object.fromEntries(
        Object.entries(protocol.step_responses).map(([k, v]: [string, any]) => [k, { completed: v.completed || false, value: v.value || '' }])
      );
    }
    return {};
  });
  const [signature, setSignature] = useState(protocol.signature || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = protocol.steps || [];
  const step = steps[currentStep];
  const total = steps.length;
  const resp = step ? (responses[step.id] || { completed: false, value: '' }) : { completed: false, value: '' };
  const allRequiredDone = steps.every(s => !s.required || (responses[s.id]?.completed));
  const isLast = currentStep === total - 1;

  const toggleStep = (completed: boolean) => {
    if (!step) return;
    setResponses(r => ({ ...r, [step.id]: { ...resp, completed } }));
  };

  const updateValue = (value: string) => {
    if (!step) return;
    setResponses(r => ({ ...r, [step.id]: { completed: !!value, value } }));
  };

  const handleSubmit = async () => {
    if (!signature.trim()) { setError('Please type your name as a digital signature to complete this protocol.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/protocols/${protocol.id}/acknowledge`, {
        missionId, stepResponses: responses, signature,
      });
      onAcknowledged();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const meta = CATEGORY_META[protocol.category] || CATEGORY_META.general;
  const progress = total > 0 ? Math.round((Object.values(responses).filter(r => r.completed).length / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{meta.icon}</span>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${meta.color}`}>{meta.label} Protocol</p>
                <h3 className="text-sm font-black text-slate-800 leading-tight">{protocol.title}</h3>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xl w-7 h-7 flex items-center justify-center">×</button>
          </div>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span>Step {currentStep + 1} of {total}</span>
              <span className="font-bold">{progress}% complete</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${meta.color.includes('blue') ? 'bg-blue-500' : meta.color.includes('violet') ? 'bg-violet-500' : meta.color.includes('emerald') ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Step navigation dots */}
        <div className="px-6 pt-4 flex gap-1.5 flex-wrap">
          {steps.map((s, i) => (
            <button key={s.id} onClick={() => setCurrentStep(i)}
              className={`w-6 h-6 rounded-full text-[9px] font-black transition-all flex items-center justify-center
                ${i === currentStep ? `${meta.bg.replace('bg-', 'bg-')} ${meta.color} ring-2 ${meta.ring}/40` :
                  responses[s.id]?.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              {responses[s.id]?.completed ? '✓' : i + 1}
            </button>
          ))}
        </div>

        {/* Current Step */}
        {step && (
          <div className="p-6 space-y-4">
            <div className={`border-l-4 ${meta.border.replace('border-', 'border-l-4 border-')} pl-4`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                  step.type === 'check' ? 'bg-blue-100 text-blue-700' :
                  step.type === 'sign'  ? 'bg-violet-100 text-violet-700' :
                  step.type === 'input' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>{step.type}</span>
                {step.required && <span className="text-[9px] font-bold text-red-500 uppercase">Required</span>}
              </div>
              <h4 className="text-base font-black text-slate-800 mb-1">{step.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
            </div>

            {/* Step response UI */}
            {step.type === 'check' && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => toggleStep(true)}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${resp.completed ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                  ✓ Confirmed
                </button>
                <button onClick={() => toggleStep(false)}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${!resp.completed && resp.value !== undefined ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                  Skip / N/A
                </button>
              </div>
            )}

            {step.type === 'sign' && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Type your full name to confirm this step</label>
                <input value={resp.value} onChange={e => updateValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 italic"
                  placeholder="Type your name..." />
                {resp.completed && <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Signed</p>}
              </div>
            )}

            {step.type === 'input' && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Enter value or observation</label>
                <textarea rows={3} value={resp.value} onChange={e => updateValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Enter your reading or observation..." />
                <button onClick={() => toggleStep(!!resp.value)}
                  className={`mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${resp.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {resp.completed ? '✓ Recorded' : 'Mark Recorded'}
                </button>
              </div>
            )}

            {step.type === 'photo' && (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-2">Take or upload a photo for this step</p>
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${resp.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                  📷 {resp.completed ? 'Photo Captured' : 'Capture / Upload'}
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { if (e.target.files?.length) updateValue(e.target.files[0].name); }} />
                </label>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-2 pt-2">
              {currentStep > 0 && (
                <button onClick={() => setCurrentStep(i => i - 1)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">← Back</button>
              )}
              {!isLast ? (
                <button onClick={() => setCurrentStep(i => i + 1)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2">
                  Next Step <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Digital Signature — Type your full name to finalize</label>
                    <input value={signature} onChange={e => setSignature(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold italic text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="Full name signature..." />
                  </div>
                  {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2">{error}</p>}
                  {!allRequiredDone && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-2">⚠️ Some required steps are not yet completed. Please go back and confirm them.</p>
                  )}
                  <button onClick={handleSubmit} disabled={submitting || !allRequiredDone || !signature.trim()}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {submitting ? 'Submitting…' : '✓ Complete & Sign Protocol'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Pilot Protocols Panel — main component ────────────────────────────────────
const PilotProtocolsPanel: React.FC<{ missionId: string }> = ({ missionId }) => {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProtocol, setActiveProtocol] = useState<Protocol | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/protocols/mission/${missionId}`);
      if (res.data.success) setProtocols(res.data.data || []);
    } catch {
      setProtocols([]);
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-slate-400 text-xs">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading protocols...
    </div>
  );

  if (protocols.length === 0) return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
      <BookOpen className="w-6 h-6 text-slate-300 mx-auto mb-2" />
      <p className="text-xs text-slate-400">No protocols assigned to this mission yet.</p>
      <p className="text-[10px] text-slate-400 mt-0.5">Contact your admin to assign protocols.</p>
    </div>
  );

  const grouped = (['pre_flight', 'mission', 'post_flight', 'emergency', 'general'] as const)
    .reduce((acc, cat) => {
      const items = protocols.filter(p => p.category === cat);
      if (items.length) acc[cat] = items;
      return acc;
    }, {} as Record<string, Protocol[]>);

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mission Protocols</h4>
      {Object.entries(grouped).map(([cat, items]) => {
        const meta = CATEGORY_META[cat as keyof typeof CATEGORY_META] || CATEGORY_META.general;
        return (
          <div key={cat} className="space-y-2">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${meta.color} flex items-center gap-1`}>
              <span>{meta.icon}</span> {meta.label}
            </p>
            {items.map(p => {
              const isAcked = !!p.acknowledged_at;
              const isExpanded = expanded === p.id;
              return (
                <div key={p.id} className={`border rounded-xl overflow-hidden transition-all ${isAcked ? 'border-emerald-200 bg-emerald-50/30' : `border-slate-200 bg-white`}`}>
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isAcked ? 'bg-emerald-100' : `${meta.bg}`}`}>
                        {isAcked ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <span className="text-sm">{meta.icon}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{p.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {p.step_count} steps · v{p.version}
                          {p.is_required && <span className="ml-1 text-red-500 font-bold">· Required</span>}
                          {isAcked && <span className="ml-1 text-emerald-600 font-bold">· Signed {new Date(p.acknowledged_at!).toLocaleDateString()}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setExpanded(isExpanded ? null : p.id)}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setActiveProtocol(p)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${isAcked ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : `${meta.bg} ${meta.color} hover:opacity-80`}`}>
                        {isAcked ? 'Review' : 'Start →'}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{p.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {activeProtocol && (
        <ProtocolWalkthrough
          protocol={activeProtocol}
          missionId={missionId}
          onClose={() => setActiveProtocol(null)}
          onAcknowledged={() => { setActiveProtocol(null); load(); }}
        />
      )}
    </div>
  );
};

export default PilotProtocolsPanel;
