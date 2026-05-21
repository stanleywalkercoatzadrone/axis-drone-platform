import React, { useState, useEffect, useCallback } from 'react';
import { BrainCircuit, RefreshCw, CheckCircle, XCircle, Plus, Trash2, Eye, AlertTriangle, Database, Activity, Cpu, Settings } from 'lucide-react';
import apiClient from '../services/apiClient';

const S = {
  page: { fontFamily:"'Inter',system-ui,sans-serif", color:'#e2e8f0', maxWidth:1100 },
  card: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'18px 22px', marginBottom:16 },
  row: { display:'flex', alignItems:'center', gap:12 },
  label: { fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase' as const, letterSpacing:0.6 },
  badge: (ok:boolean) => ({ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, background:ok?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', color:ok?'#4ade80':'#f87171', border:`1px solid ${ok?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}` }),
  btn: (variant:'primary'|'danger'|'ghost') => ({
    display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid',
    ...(variant==='primary' ? { background:'rgba(99,102,241,0.15)', borderColor:'rgba(99,102,241,0.4)', color:'#818cf8' }
      : variant==='danger' ? { background:'rgba(239,68,68,0.1)', borderColor:'rgba(239,68,68,0.25)', color:'#f87171' }
      : { background:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.1)', color:'#94a3b8' })
  }),
  input: { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e2e8f0', fontSize:12, padding:'8px 12px', width:'100%', outline:'none' },
  severityColor: (s:string) => s==='critical'?'#ef4444':s==='high'?'#f97316':s==='moderate'?'#f59e0b':s==='low'?'#4ade80':'#64748b',
};

interface Stats { total:string; verified:string; unverified:string; human_labeled:string; thermal:string; visual:string; lbd:string; latest_capture:string }
interface Sample { id:string; image_url:string; upload_type:string; detected_faults:any; human_verified:boolean; human_label:any; human_notes:string; mission_title:string; created_at:string }

const FAULT_TYPES = ['hot_cell','bypass_diode_failure','string_outage','connector_overheating','panel_mismatch','shading_anomaly','physical_damage','soiling','corrosion','crack','delamination','other'];
const SEVERITIES = ['low','moderate','high','critical'];

export default function SystemAIView() {
  const [tab, setTab] = useState<'queue'|'stats'|'manual'>('stats');
  const [stats, setStats] = useState<Stats|null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [pagination, setPagination] = useState({ page:1, total:0, pages:1 });
  const [filterVerified, setFilterVerified] = useState<'all'|'true'|'false'>('false');
  const [selected, setSelected] = useState<Sample|null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);

  // Edit state
  const [editFaults, setEditFaults] = useState<any[]>([]);
  const [editNotes, setEditNotes] = useState('');

  // Manual annotation state
  const [manualUrl, setManualUrl] = useState('');
  const [manualType, setManualType] = useState('images');
  const [manualNotes, setManualNotes] = useState('');
  const [manualFaults, setManualFaults] = useState<any[]>([]);

  const flash = (text:string, ok:boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),4000); };

  const loadStats = useCallback(async () => {
    try { const r = await apiClient.get('/v1/training/stats'); setStats(r.data.data); } catch {}
  }, []);

  const loadSamples = useCallback(async (page=1) => {
    setLoading(true);
    try {
      const params: any = { page, limit:12 };
      if (filterVerified !== 'all') params.verified = filterVerified;
      const r = await apiClient.get('/v1/training/flywheel', { params });
      setSamples(r.data.data || []);
      setPagination(r.data.pagination || { page:1, total:0, pages:1 });
    } catch { setSamples([]); } finally { setLoading(false); }
  }, [filterVerified]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab==='queue') loadSamples(1); }, [tab, loadSamples]);

  const openSample = (s: Sample) => {
    setSelected(s);
    const base = s.human_label || s.detected_faults || {};
    const faults = base.faults || base.anomalies || base.defects || [];
    setEditFaults(JSON.parse(JSON.stringify(faults)));
    setEditNotes(s.human_notes || '');
  };

  const saveSample = async (verified: boolean) => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.put(`/v1/training/flywheel/${selected.id}/verify`, {
        human_verified: verified,
        human_label: { faults: editFaults },
        human_notes: editNotes,
      });
      flash(`✓ Saved — marked as ${verified?'verified':'rejected'}`, true);
      setSelected(null);
      loadSamples(pagination.page);
      loadStats();
    } catch (e:any) { flash(`✗ ${e.message}`, false); }
    finally { setSaving(false); }
  };

  const deleteSample = async (id:string) => {
    if (!confirm('Remove this record from the training dataset?')) return;
    try {
      await apiClient.delete(`/v1/training/flywheel/${id}`);
      flash('✓ Record removed', true);
      setSelected(null);
      loadSamples(pagination.page);
      loadStats();
    } catch (e:any) { flash(`✗ ${e.message}`, false); }
  };

  const addFaultToEdit = () => setEditFaults(f => [...f, { type:'other', severity:'low', confidence:0.8, description:'', human_added:true }]);
  const updateFault = (i:number, field:string, val:any) => setEditFaults(f => f.map((x,idx) => idx===i ? {...x,[field]:val} : x));
  const removeFault = (i:number) => setEditFaults(f => f.filter((_,idx)=>idx!==i));

  const addManualFault = () => setManualFaults(f => [...f, { type:'other', severity:'low', confidence:0.8, description:'' }]);
  const updateManualFault = (i:number, field:string, val:any) => setManualFaults(f => f.map((x,idx) => idx===i ? {...x,[field]:val} : x));

  const submitManual = async () => {
    if (!manualUrl) { flash('✗ Image URL is required', false); return; }
    setSaving(true);
    try {
      await apiClient.post('/v1/training/flywheel/annotate', {
        image_url: manualUrl, upload_type: manualType,
        detected_faults: manualFaults, human_notes: manualNotes,
      });
      flash('✓ Manual annotation saved', true);
      setManualUrl(''); setManualNotes(''); setManualFaults([]);
      loadStats();
    } catch (e:any) { flash(`✗ ${e.message}`, false); }
    finally { setSaving(false); }
  };

  const tabBtn = (key:typeof tab, label:string) => (
    <button onClick={()=>setTab(key)} style={{ ...S.btn(tab===key?'primary':'ghost'), textTransform:'uppercase', letterSpacing:0.5 }}>{label}</button>
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ ...S.row, marginBottom:6 }}>
          <div style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:10, padding:8 }}><BrainCircuit size={18} color="#fff" /></div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'#f1f5f9', letterSpacing:-0.5 }}>Neural AI — Training Command Center</h2>
        </div>
        <p style={{ margin:0, fontSize:12, color:'#64748b' }}>Human-in-the-loop annotation layer · Review, correct & augment the proprietary training dataset</p>
      </div>

      {/* Flash message */}
      {msg && <div style={{ ...S.card, background:msg.ok?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', borderColor:msg.ok?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)', color:msg.ok?'#4ade80':'#f87171', marginBottom:12, padding:'10px 16px', fontSize:12, fontWeight:700 }}>{msg.text}</div>}

      {/* Tabs */}
      <div style={{ ...S.row, marginBottom:20, gap:8 }}>
        {tabBtn('stats','Dataset Stats')}
        {tabBtn('queue','Review Queue')}
        {tabBtn('manual','Add Manual Annotation')}
        <button onClick={()=>{loadStats();if(tab==='queue')loadSamples(1);}} style={{ ...S.btn('ghost'), marginLeft:'auto' }}><RefreshCw size={12} />Refresh</button>
      </div>

      {/* ── STATS TAB ── */}
      {tab==='stats' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
            {[
              { label:'Total Samples', value:stats?.total??'—', color:'#818cf8' },
              { label:'Verified', value:stats?.verified??'—', color:'#4ade80' },
              { label:'Needs Review', value:stats?.unverified??'—', color:'#f59e0b' },
              { label:'Human Labeled', value:stats?.human_labeled??'—', color:'#06b6d4' },
              { label:'Thermal', value:stats?.thermal??'—', color:'#f97316' },
              { label:'Visual', value:stats?.visual??'—', color:'#60a5fa' },
              { label:'LBD Scans', value:stats?.lbd??'—', color:'#a78bfa' },
            ].map(k => (
              <div key={k.label} style={S.card}>
                <div style={{ fontSize:28, fontWeight:800, color:k.color, letterSpacing:-1 }}>{k.value}</div>
                <div style={S.label}>{k.label}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={{ ...S.row, marginBottom:10 }}><Database size={14} color="#64748b" /><span style={S.label}>How the Flywheel Works</span></div>
            <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
              Every drone image processed by Gemini AI that contains detected faults is automatically saved here. As a human reviewer, you can <strong style={{color:'#e2e8f0'}}>verify AI detections</strong>, <strong style={{color:'#e2e8f0'}}>correct mislabeled faults</strong>, <strong style={{color:'#e2e8f0'}}>add missed detections</strong>, and <strong style={{color:'#e2e8f0'}}>remove false positives</strong>. Human-verified records become the ground truth dataset used to fine-tune proprietary vision models on Vertex AI.
            </div>
            <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
              {[['Phase 1','Data Flywheel','✅ LIVE'],['Phase 2','Human Annotation','🟡 IN PROGRESS'],['Phase 3','Custom Model Fine-Tune','⏳ PENDING']].map(([ph,label,status])=>(
                <div key={ph} style={{ flex:1, minWidth:160, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:0.6 }}>{ph}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#e2e8f0', marginTop:3 }}>{label}</div>
                  <div style={{ fontSize:11, marginTop:4 }}>{status}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── REVIEW QUEUE TAB ── */}
      {tab==='queue' && !selected && (
        <>
          <div style={{ ...S.row, marginBottom:14, gap:8 }}>
            <span style={S.label}>Filter:</span>
            {(['all','false','true'] as const).map(v => (
              <button key={v} onClick={()=>setFilterVerified(v)} style={{ ...S.btn(filterVerified===v?'primary':'ghost') }}>
                {v==='all'?'All':v==='false'?'Needs Review':'Verified'}
              </button>
            ))}
            <span style={{ marginLeft:'auto', fontSize:11, color:'#64748b' }}>{pagination.total} records</span>
          </div>

          {loading ? <div style={{ textAlign:'center', padding:40, color:'#64748b' }}>Loading review queue…</div>
          : samples.length===0 ? (
            <div style={{ ...S.card, textAlign:'center', padding:40 }}>
              <Activity size={28} color="#334155" style={{ marginBottom:8 }} />
              <p style={{ margin:0, fontSize:13, color:'#64748b' }}>No records in this filter. Pilot uploads will appear here automatically.</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
              {samples.map(s => {
                const base = s.detected_faults || {};
                const faults = base.faults || base.anomalies || base.defects || [];
                const critical = faults.filter((f:any)=>f.severity==='critical'||f.severity==='high').length;
                return (
                  <div key={s.id} style={{ ...S.card, cursor:'pointer', position:'relative', marginBottom:0, transition:'border-color 0.15s' }}
                    onClick={()=>openSample(s)}>
                    {/* Image preview */}
                    <div style={{ height:120, borderRadius:8, overflow:'hidden', marginBottom:12, background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {s.image_url ? <img src={s.image_url} alt="inspection" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>(e.currentTarget.style.display='none')} />
                        : <Eye size={24} color="#334155" />}
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#f1f5f9', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.mission_title || 'Unknown Mission'}
                    </div>
                    <div style={{ ...S.row, gap:6, flexWrap:'wrap' }}>
                      <span style={S.badge(s.human_verified)}>{s.human_verified?'Verified':'Needs Review'}</span>
                      <span style={{ fontSize:10, color:'#64748b' }}>{s.upload_type}</span>
                    </div>
                    <div style={{ ...S.row, marginTop:8, gap:8 }}>
                      <span style={{ fontSize:10, color:'#64748b' }}>{faults.length} fault{faults.length!==1?'s':''}</span>
                      {critical>0 && <span style={{ fontSize:10, color:'#ef4444', fontWeight:700 }}>⚠ {critical} critical</span>}
                      <span style={{ marginLeft:'auto', fontSize:10, color:'#475569' }}>{new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div style={{ ...S.row, justifyContent:'center', marginTop:16, gap:8 }}>
              {Array.from({length:pagination.pages},(_,i)=>i+1).map(p=>(
                <button key={p} onClick={()=>loadSamples(p)} style={S.btn(pagination.page===p?'primary':'ghost')}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── SAMPLE DETAIL / ANNOTATION VIEW ── */}
      {tab==='queue' && selected && (
        <div>
          <div style={{ ...S.row, marginBottom:16 }}>
            <button onClick={()=>setSelected(null)} style={S.btn('ghost')}>← Back to Queue</button>
            <span style={{ marginLeft:'auto', fontSize:11, color:'#64748b' }}>{selected.id.slice(0,12)}…</span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* Left: image */}
            <div style={S.card}>
              <div style={S.label}>Drone Image</div>
              <div style={{ marginTop:10, borderRadius:8, overflow:'hidden', background:'#0f172a', minHeight:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {selected.image_url
                  ? <img src={selected.image_url} alt="inspection" style={{ width:'100%', maxHeight:360, objectFit:'contain' }} />
                  : <Eye size={32} color="#334155" />}
              </div>
              <div style={{ marginTop:10, fontSize:11, color:'#64748b' }}>
                Type: <strong style={{color:'#94a3b8'}}>{selected.upload_type}</strong> &nbsp;·&nbsp;
                Mission: <strong style={{color:'#94a3b8'}}>{selected.mission_title||'—'}</strong>
              </div>
            </div>

            {/* Right: fault editor */}
            <div style={S.card}>
              <div style={{ ...S.row, marginBottom:12 }}>
                <span style={S.label}>Fault Annotations</span>
                <button onClick={addFaultToEdit} style={{ ...S.btn('primary'), marginLeft:'auto', padding:'4px 10px' }}>
                  <Plus size={11} /> Add Fault
                </button>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:280, overflowY:'auto' }}>
                {editFaults.length===0 && (
                  <div style={{ textAlign:'center', padding:'20px 0', color:'#475569', fontSize:12 }}>
                    No faults. AI found none, or add manually.
                  </div>
                )}
                {editFaults.map((f,i) => (
                  <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                      <div>
                        <div style={{ ...S.label, marginBottom:4 }}>Fault Type</div>
                        <select value={f.type||'other'} onChange={e=>updateFault(i,'type',e.target.value)} style={S.input}>
                          {FAULT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ ...S.label, marginBottom:4 }}>Severity</div>
                        <select value={f.severity||'low'} onChange={e=>updateFault(i,'severity',e.target.value)} style={{...S.input, color:S.severityColor(f.severity)}}>
                          {SEVERITIES.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <div style={{ ...S.label, marginBottom:4 }}>Description</div>
                      <input value={f.description||''} onChange={e=>updateFault(i,'description',e.target.value)} placeholder="Describe the fault…" style={S.input} />
                    </div>
                    <div style={{ ...S.row, justifyContent:'space-between' }}>
                      <div style={{ fontSize:10, color:'#64748b' }}>Conf: {f.confidence||0} {f.human_added&&<span style={{color:'#818cf8'}}>· Human Added</span>}</div>
                      <button onClick={()=>removeFault(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:2 }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop:12 }}>
                <div style={{ ...S.label, marginBottom:4 }}>Reviewer Notes</div>
                <textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)} placeholder="Notes about this annotation…" rows={2} style={{ ...S.input, resize:'vertical' }} />
              </div>

              <div style={{ ...S.row, marginTop:14, gap:8, flexWrap:'wrap' }}>
                <button onClick={()=>saveSample(true)} disabled={saving} style={S.btn('primary')}>
                  <CheckCircle size={12} />{saving?'Saving…':'Verify & Save'}
                </button>
                <button onClick={()=>saveSample(false)} disabled={saving} style={S.btn('ghost')}>
                  <XCircle size={12} />Mark as Rejected
                </button>
                <button onClick={()=>deleteSample(selected.id)} style={{ ...S.btn('danger'), marginLeft:'auto' }}>
                  <Trash2 size={12} />Delete Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MANUAL ANNOTATION TAB ── */}
      {tab==='manual' && (
        <div style={S.card}>
          <div style={{ ...S.row, marginBottom:16 }}><Plus size={14} color="#818cf8" /><span style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>Add Manual Annotation</span></div>
          <p style={{ margin:'0 0 20px', fontSize:12, color:'#64748b', lineHeight:1.6 }}>
            Manually annotate any drone image — even ones that Gemini didn't flag — to add missed detections or correct historical errors. These are automatically saved as human-verified ground truth.
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div>
              <div style={{ ...S.label, marginBottom:6 }}>Image URL (GCS or HTTPS)*</div>
              <input value={manualUrl} onChange={e=>setManualUrl(e.target.value)} placeholder="https://storage.googleapis.com/…" style={S.input} />
            </div>
            <div>
              <div style={{ ...S.label, marginBottom:6 }}>Upload Type</div>
              <select value={manualType} onChange={e=>setManualType(e.target.value)} style={S.input}>
                {['images','thermal','lbd','solar_panel','manual'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <div style={{ ...S.label, marginBottom:6 }}>Notes</div>
            <input value={manualNotes} onChange={e=>setManualNotes(e.target.value)} placeholder="Why is this being manually annotated?" style={S.input} />
          </div>

          <div style={{ ...S.row, marginBottom:10 }}>
            <span style={S.label}>Faults ({manualFaults.length})</span>
            <button onClick={addManualFault} style={{ ...S.btn('primary'), marginLeft:'auto', padding:'4px 10px' }}><Plus size={11} /> Add Fault</button>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
            {manualFaults.map((f,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
                  <div>
                    <div style={{ ...S.label, marginBottom:4 }}>Type</div>
                    <select value={f.type} onChange={e=>updateManualFault(i,'type',e.target.value)} style={S.input}>
                      {FAULT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ ...S.label, marginBottom:4 }}>Severity</div>
                    <select value={f.severity} onChange={e=>updateManualFault(i,'severity',e.target.value)} style={S.input}>
                      {SEVERITIES.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ ...S.label, marginBottom:4 }}>Confidence</div>
                    <input type="number" min={0} max={1} step={0.05} value={f.confidence} onChange={e=>updateManualFault(i,'confidence',parseFloat(e.target.value))} style={S.input} />
                  </div>
                </div>
                <div style={{ ...S.row }}>
                  <input value={f.description} onChange={e=>updateManualFault(i,'description',e.target.value)} placeholder="Describe the fault…" style={{ ...S.input, flex:1 }} />
                  <button onClick={()=>setManualFaults(f=>f.filter((_,idx)=>idx!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {manualFaults.length===0 && <div style={{ fontSize:12, color:'#475569', textAlign:'center', padding:'12px 0' }}>No faults added yet. Click "Add Fault" above.</div>}
          </div>

          <button onClick={submitManual} disabled={saving} style={{ ...S.btn('primary'), padding:'9px 20px', fontSize:12 }}>
            {saving ? 'Saving…' : '✓ Save Manual Annotation'}
          </button>
        </div>
      )}
    </div>
  );
}
