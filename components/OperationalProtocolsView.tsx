/**
 * OperationalProtocolsView.tsx — Admin Protocol Library
 * Browse, create, edit, and attach protocols to missions
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, ChevronRight, ChevronDown, Shield, AlertTriangle, CheckCircle,
  Edit3, Trash2, X, Save, Search, CheckSquare, Link2, Loader2, Layers
} from 'lucide-react';
import apiClient from '../services/apiClient';

interface Protocol {
  id: string;
  title: string;
  description: string;
  category: 'pre_flight' | 'mission' | 'post_flight' | 'emergency' | 'general';
  mission_type: string;
  steps: ProtocolStep[];
  version: string;
  is_required: boolean;
  is_active: boolean;
  step_count: number;
  created_at: string;
}

interface ProtocolStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type: 'check' | 'sign' | 'input' | 'photo';
  required: boolean;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  pre_flight:  { label: 'Pre-Flight',  icon: <Shield className="w-3.5 h-3.5" />,       color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  mission:     { label: 'Mission',     icon: <CheckSquare className="w-3.5 h-3.5" />,   color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
  post_flight: { label: 'Post-Flight', icon: <CheckCircle className="w-3.5 h-3.5" />,   color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  emergency:   { label: 'Emergency',   icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200' },
  general:     { label: 'General',     icon: <BookOpen className="w-3.5 h-3.5" />,      color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200' },
};

const MISSION_TYPE_LABELS: Record<string, string> = {
  all: 'All Types', solar: '☀️ Solar', insurance: '🏠 Insurance',
  utilities: '⚡ Utilities', telecom: '📡 Telecom', construction: '🏗️ Construction',
};

const STEP_TYPE_COLORS: Record<string, string> = {
  check: 'bg-blue-100 text-blue-700', sign: 'bg-violet-100 text-violet-700',
  input: 'bg-amber-100 text-amber-700', photo: 'bg-emerald-100 text-emerald-700',
};

// ── Attach to Mission Modal ───────────────────────────────────────────────────
interface Mission { id: string; title: string; status: string; industry_key?: string; location?: string; }

const AttachMissionModal: React.FC<{
  protocol: Protocol;
  onClose: () => void;
}> = ({ protocol, onClose }) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.get('/deployments?status=active&limit=100'),
      apiClient.get(`/protocols/${protocol.id}/acknowledgments`).catch(() => ({ data: { data: [] } })),
    ]).then(([mRes]) => {
      setMissions(mRes.data?.data || mRes.data?.deployments || []);
    }).catch(() => setMissions([])).finally(() => setLoading(false));
    // Also fetch which missions currently have this protocol attached
    apiClient.get(`/protocols/mission-list/${protocol.id}`).then(r => {
      if (r.data?.data) setAttached(new Set(r.data.data.map((m: any) => m.mission_id)));
    }).catch(() => {});
  }, [protocol.id]);

  const toggle = async (missionId: string) => {
    setSaving(missionId);
    try {
      if (attached.has(missionId)) {
        await apiClient.delete(`/protocols/${protocol.id}/detach/${missionId}`);
        setAttached(s => { const n = new Set(s); n.delete(missionId); return n; });
      } else {
        await apiClient.post(`/protocols/${protocol.id}/attach/${missionId}`);
        setAttached(s => new Set([...s, missionId]));
      }
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Action failed');
    } finally {
      setSaving(null);
    }
  };

  const filtered = missions.filter(m =>
    !search || m.title?.toLowerCase().includes(search.toLowerCase()) || m.location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Attach Protocol</p>
            <h3 className="text-sm font-black text-slate-800 leading-tight mt-0.5">{protocol.title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xl w-7 h-7 flex items-center justify-center">×</button>
        </div>
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search missions..."
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No active missions found</p>
          ) : filtered.map(m => {
            const isLinked = attached.has(m.id);
            const isSaving = saving === m.id;
            return (
              <div key={m.id} className={`flex items-center justify-between px-4 py-3 border rounded-xl transition-all ${
                isLinked ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{m.title}</p>
                  <p className="text-[10px] text-slate-400">{m.location || '—'} · {m.industry_key || m.status}</p>
                </div>
                <button onClick={() => toggle(m.id)} disabled={isSaving}
                  className={`flex-shrink-0 ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isLinked ? 'bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  } border ${ isLinked ? 'border-emerald-200' : 'border-blue-200'}`}>
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : isLinked ? '✓ Attached' : '+ Attach'}
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
};

// ── Assign Protocols to a Mission (Mission-first flow) ───────────────────────
const MissionProtocolAssign: React.FC<{ protocols: Protocol[] }> = ({ protocols }) => {
  const [missions, setMissions] = useState<{ id: string; title: string; industry_key?: string; project_name?: string }[]>([]);
  const [missionId, setMissionId] = useState('');
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [loadingAttached, setLoadingAttached] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [applyingStandards, setApplyingStandards] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoadingMissions(true);
    apiClient.get('/deployments?limit=500')
      .then(r => {
        const rows = r.data?.data || r.data?.deployments || [];
        // Normalize both camelCase and snake_case shapes from API
        setMissions(rows.map((m: any) => ({
          id: m.id,
          title: m.title,
          industry_key: m.industryKey || m.industry_key || null,
          project_name: m.siteName || m.site_name || null,
        })));
      })
      .catch(() => setMissions([]))
      .finally(() => setLoadingMissions(false));
  }, []);

  useEffect(() => {
    if (!missionId) { setAttached(new Set()); return; }
    setLoadingAttached(true);
    apiClient.get(`/protocols/mission/${missionId}`)
      .then(r => {
        const rows: any[] = r.data?.data || [];
        setAttached(new Set(rows.filter((p: any) => p.source === 'attached').map((p: any) => p.id)));
      })
      .catch(() => setAttached(new Set()))
      .finally(() => setLoadingAttached(false));
  }, [missionId]);

  const toggle = async (protocolId: string) => {
    if (!missionId) return;
    setSaving(protocolId);
    try {
      if (attached.has(protocolId)) {
        await apiClient.delete(`/protocols/${protocolId}/detach/${missionId}`);
        setAttached(s => { const n = new Set(s); n.delete(protocolId); return n; });
      } else {
        await apiClient.post(`/protocols/${protocolId}/attach/${missionId}`);
        setAttached(s => new Set([...s, protocolId]));
      }
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed');
    } finally {
      setSaving(null);
    }
  };

  const applyStandards = async () => {
    if (!missionId) return;
    setApplyingStandards(true);
    try {
      const r = await apiClient.post(`/protocols/apply-standards/${missionId}`);
      const r2 = await apiClient.get(`/protocols/mission/${missionId}`);
      setAttached(new Set((r2.data?.data || []).filter((p: any) => p.source === 'attached').map((p: any) => p.id)));
      alert(`Applied ${r.data.attached} standard protocols for ${r.data.industry} missions.`);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed');
    } finally {
      setApplyingStandards(false);
    }
  };

  const filtered = protocols.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()));
  const selectedMission = missions.find(m => m.id === missionId);

  return (
    <div className="space-y-5">
      {/* Mission selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Select Mission</label>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex-1 min-w-[240px]">
            {loadingMissions ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading missions...</div>
            ) : (
              <select
                value={missionId}
                onChange={e => setMissionId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">— Select a mission —</option>
                {missions.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.project_name ? `${m.project_name} — ${m.title}` : m.title}
                    {m.industry_key ? ` (${m.industry_key})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          {missionId && (
            <button
              onClick={applyStandards}
              disabled={applyingStandards}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-60"
            >
              {applyingStandards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
              Apply Standard Protocols
            </button>
          )}
        </div>
        {selectedMission && (
          <p className="text-[10px] text-slate-400 mt-2">
            {attached.size} protocol{attached.size !== 1 ? 's' : ''} explicitly attached · standard protocols auto-apply by industry type
          </p>
        )}
      </div>

      {missionId && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter protocols..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          {loadingAttached ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => {
                const meta = CATEGORY_META[p.category] || CATEGORY_META.general;
                const isAttached = attached.has(p.id);
                const isSaving = saving === p.id;
                return (
                  <div key={p.id} className={`flex items-center justify-between px-4 py-3 border rounded-xl transition-all ${isAttached ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${meta.color} ${meta.bg} ${meta.border}`}>
                        {meta.icon}{meta.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{p.title}</p>
                        <p className="text-[10px] text-slate-400">{p.step_count} steps · {MISSION_TYPE_LABELS[p.mission_type] || p.mission_type}{p.is_required && <span className="ml-1 text-red-500 font-bold"> · Required</span>}</p>
                      </div>
                    </div>
                    <button onClick={() => toggle(p.id)} disabled={isSaving}
                      className={`flex-shrink-0 ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isAttached ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : isAttached ? '✓ Attached' : '+ Attach'}
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-center text-xs text-slate-400 py-8">No protocols found</p>}
            </div>
          )}
        </>
      )}
      {!missionId && !loadingMissions && (
        <div className="text-center py-16 text-slate-400">
          <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Select a mission above to manage its protocols</p>
          <p className="text-xs mt-1">Attach or detach protocols — pilots see them immediately</p>
        </div>
      )}
    </div>
  );
};

// ── Protocol Card ─────────────────────────────────────────────────────────────
const ProtocolCard: React.FC<{
  protocol: Protocol;
  onEdit: (p: Protocol) => void;
  onDelete: (id: string) => void;
  onAttach: (p: Protocol) => void;
}> = ({ protocol, onEdit, onDelete, onAttach }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[protocol.category] || CATEGORY_META.general;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all shadow-sm hover:shadow-md ${expanded ? `border-slate-300` : 'border-slate-200'}`}>
      {/* Header */}
      <div className="px-5 py-4 cursor-pointer hover:bg-slate-50/70 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color} ${meta.bg} ${meta.border}`}>
                {meta.icon}{meta.label}
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                {MISSION_TYPE_LABELS[protocol.mission_type] || protocol.mission_type}
              </span>
              {protocol.is_required && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Required</span>
              )}
              <span className="text-[10px] text-slate-400 ml-auto">v{protocol.version}</span>
            </div>
            <h3 className="font-bold text-slate-800 text-sm leading-tight">{protocol.title}</h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{protocol.description}</p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 whitespace-nowrap">{protocol.step_count} steps</span>
            {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </div>
      </div>

      {/* Expanded steps */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4 space-y-3">
          <div className="space-y-2">
            {(protocol.steps || []).map((step, i) => (
              <div key={step.id || i} className="flex gap-3 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">{step.title}</span>
                    {step.required && <span className="text-[9px] text-red-500 font-bold uppercase">Required</span>}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest ${STEP_TYPE_COLORS[step.type] || 'bg-slate-100 text-slate-600'}`}>
                      {step.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Admin actions */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button onClick={() => onAttach(protocol)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <Link2 className="w-3 h-3" /> Attach to Mission
            </button>
            <button onClick={() => onEdit(protocol)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
              <Edit3 className="w-3 h-3" /> Edit
            </button>
            <button onClick={() => onDelete(protocol.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 className="w-3 h-3" /> Deactivate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Protocol Form Modal ───────────────────────────────────────────────────────
const ProtocolFormModal: React.FC<{
  protocol?: Protocol | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ protocol, onClose, onSaved }) => {
  const isEdit = !!protocol;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: protocol?.title || '',
    description: protocol?.description || '',
    category: protocol?.category || 'pre_flight',
    mission_type: protocol?.mission_type || 'all',
    version: protocol?.version || '1.0',
    is_required: protocol?.is_required || false,
    steps: protocol?.steps || [] as ProtocolStep[],
  });

  const addStep = () => {
    const newStep: ProtocolStep = {
      id: `step_${Date.now()}`, order: form.steps.length + 1,
      title: '', description: '', type: 'check', required: false,
    };
    setForm(f => ({ ...f, steps: [...f.steps, newStep] }));
  };

  const updateStep = (idx: number, field: string, value: any) => {
    setForm(f => {
      const steps = [...f.steps];
      steps[idx] = { ...steps[idx], [field]: value };
      return { ...f, steps };
    });
  };

  const removeStep = (idx: number) => {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEdit) {
        await apiClient.put(`/protocols/${protocol!.id}`, form);
      } else {
        await apiClient.post('/protocols', form);
      }
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 rounded-lg"><BookOpen className="w-4 h-4 text-blue-600" /></div>
            <h3 className="text-sm font-bold text-slate-800">{isEdit ? 'Edit Protocol' : 'New Protocol'}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Metadata */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Protocol Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="e.g. Pre-Flight Safety Checklist" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Description</label>
              <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none">
                  <option value="pre_flight">Pre-Flight</option>
                  <option value="mission">Mission</option>
                  <option value="post_flight">Post-Flight</option>
                  <option value="emergency">Emergency</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Mission Type</label>
                <select value={form.mission_type} onChange={e => setForm(f => ({ ...f, mission_type: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none">
                  {Object.entries(MISSION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Version</label>
                <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none" placeholder="1.0" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_required} onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-blue-600" />
              <span className="text-xs font-semibold text-slate-700">Required — pilots must complete before mission actions unlock</span>
            </label>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Checklist Steps ({form.steps.length})</label>
              <button onClick={addStep} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Step
              </button>
            </div>
            <div className="space-y-2">
              {form.steps.map((step, idx) => (
                <div key={step.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 text-[10px] font-black flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                    <input value={step.title} onChange={e => updateStep(idx, 'title', e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="Step title..." />
                    <select value={step.type} onChange={e => updateStep(idx, 'type', e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none">
                      <option value="check">✓ Check</option>
                      <option value="sign">✍ Sign</option>
                      <option value="input">📝 Input</option>
                      <option value="photo">📷 Photo</option>
                    </select>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={step.required} onChange={e => updateStep(idx, 'required', e.target.checked)} className="w-3 h-3" />
                      <span className="text-[10px] text-slate-500 font-medium">Req</span>
                    </label>
                    <button onClick={() => removeStep(idx)} className="text-slate-400 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <textarea rows={2} value={step.description} onChange={e => updateStep(idx, 'description', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Step instructions visible to pilot/technician..." />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-60 transition-all flex items-center justify-center gap-2">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Protocol'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main View ─────────────────────────────────────────────────────────────────
const OperationalProtocolsView: React.FC = () => {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const [attachingProtocol, setAttachingProtocol] = useState<Protocol | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'assign'>('library');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/protocols');
      if (res.data.success) setProtocols(res.data.data || []);
    } catch (e) {
      console.error('Failed to load protocols', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this protocol? It will no longer appear for pilots.')) return;
    try {
      await apiClient.delete(`/protocols/${id}`);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed');
    }
  };

  const filtered = protocols.filter(p => {
    if (filterCat && p.category !== filterCat) return false;
    if (filterType && p.mission_type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.title.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s);
    }
    return true;
  });

  const grouped = (['pre_flight', 'mission', 'post_flight', 'emergency', 'general'] as const).reduce((acc, cat) => {
    const items = filtered.filter(p => p.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, Protocol[]>);

  const totalSteps = protocols.reduce((sum, p) => sum + (p.step_count || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Axis Operations</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Operational Protocols</h1>
          <p className="text-xs text-slate-500 mt-1">
            FAA Part 107-aligned SOPs — {protocols.length} protocols · {totalSteps} total checklist steps
          </p>
        </div>
        <button onClick={() => { setEditingProtocol(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-sm transition-all">
          <Plus className="w-4 h-4" /> New Protocol
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('library')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'library' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />Protocol Library
        </button>
        <button
          onClick={() => setActiveTab('assign')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'assign' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Link2 className="w-3.5 h-3.5 inline mr-1.5" />Assign to Mission
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'assign' ? (
        <MissionProtocolAssign protocols={protocols} />
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-5 gap-3">
            {Object.entries(CATEGORY_META).map(([cat, meta]) => {
              const count = protocols.filter(p => p.category === cat).length;
              return (
                <button key={cat} onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
                  className={`rounded-xl border p-3 text-left transition-all ${filterCat === cat ? `${meta.bg} ${meta.border} shadow-sm` : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                  <div className={`flex items-center gap-1.5 mb-1.5 ${filterCat === cat ? meta.color : 'text-slate-500'}`}>
                    {meta.icon}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{meta.label}</span>
                  </div>
                  <span className={`text-xl font-black ${filterCat === cat ? meta.color : 'text-slate-800'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search & Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search protocols..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none">
              <option value="">All Mission Types</option>
              {Object.entries(MISSION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Protocol Groups */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([cat, items]) => {
                const meta = CATEGORY_META[cat] || CATEGORY_META.general;
                return (
                  <div key={cat}>
                    <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${meta.border}`}>
                      <span className={meta.color}>{meta.icon}</span>
                      <h2 className={`text-xs font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</h2>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${meta.bg} ${meta.color}`}>{items.length}</span>
                    </div>
                    <div className="space-y-3">
                      {items.map(p => (
                        <ProtocolCard key={p.id} protocol={p}
                          onEdit={p => { setEditingProtocol(p); setShowForm(true); }}
                          onDelete={handleDelete}
                          onAttach={p => setAttachingProtocol(p)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {Object.keys(grouped).length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No protocols match your filters</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showForm && (
        <ProtocolFormModal
          protocol={editingProtocol}
          onClose={() => { setShowForm(false); setEditingProtocol(null); }}
          onSaved={() => { setShowForm(false); setEditingProtocol(null); load(); }}
        />
      )}
      {attachingProtocol && (
        <AttachMissionModal
          protocol={attachingProtocol}
          onClose={() => setAttachingProtocol(null)}
        />
      )}
    </div>
  );
};

export default OperationalProtocolsView;
