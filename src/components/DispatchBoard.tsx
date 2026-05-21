/**
 * DispatchBoard.tsx — Axis Enterprise Dispatch Operations Center
 * ═══════════════════════════════════════════════════════════════
 * Real-time mission dispatch + pilot availability grid.
 * Left column: active/scheduled missions
 * Right column: available pilot pool + one-click assignment
 */
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import {
  Radar, User, MapPin, Calendar, Clock, CheckCircle2,
  AlertCircle, Users, Zap, RefreshCw, ChevronRight,
  Send, X, Search, Loader2, Radio
} from 'lucide-react';
import { StatusBadge } from './ui/StatusBadge';

interface Mission {
  id: string;
  title?: string;
  name?: string;
  status: string;
  mission_status_v2?: string;
  site_name?: string;
  date?: string;
  due_date?: string;
  technicianIds?: string[];
  clientName?: string;
  type?: string;
}

interface Pilot {
  id: string;
  fullName?: string;
  full_name?: string;
  email?: string;
  status?: string;
  assignedMissions?: number;
  specializations?: string[];
}

const DISPATCH_STATUSES = ['All', 'scheduled', 'assigned', 'in_progress', 'active'];
const ACTIVE_FILTER = ['scheduled', 'assigned', 'in_progress', 'in-progress', 'active', 'in_flight'];

export default function DispatchBoard() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [missionFilter, setMissionFilter] = useState('All');
  const [pilotSearch, setPilotSearch] = useState('');
  const [assigningMission, setAssigningMission] = useState<string | null>(null);
  const [selectedPilot, setSelectedPilot] = useState<Pilot | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [mRes, pRes] = await Promise.all([
        apiClient.get('/deployments'),
        apiClient.get('/personnel'),
      ]);
      setMissions(mRes.data.data || []);
      setPilots(pRes.data.data || []);
    } catch (err) {
      console.error('[DispatchBoard] fetch error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter missions for dispatch (active/scheduled)
  const activeMissions = missions.filter(m => {
    const s = (m.mission_status_v2 || m.status || '').toLowerCase();
    const matchStatus = missionFilter === 'All' || s === missionFilter.toLowerCase();
    const isActive = ACTIVE_FILTER.some(f => s.includes(f));
    return matchStatus ? isActive || missionFilter !== 'All' : false;
  }).filter(m => {
    if (missionFilter === 'All') {
      const s = (m.mission_status_v2 || m.status || '').toLowerCase();
      return ACTIVE_FILTER.some(f => s.includes(f));
    }
    return true;
  });

  // Filter pilots
  const filteredPilots = pilots.filter(p => {
    const name = (p.fullName || p.full_name || '').toLowerCase();
    return name.includes(pilotSearch.toLowerCase());
  });

  const handleAssign = async () => {
    if (!selectedPilot || !assigningMission) return;
    setAssignLoading(true);
    try {
      await apiClient.post(`/deployments/${assigningMission}/personnel`, {
        personnelId: selectedPilot.id,
      });
      setAssignSuccess(`${selectedPilot.fullName || selectedPilot.full_name} assigned`);
      setTimeout(() => {
        setAssignSuccess(null);
        setAssigningMission(null);
        setSelectedPilot(null);
      }, 2000);
      fetchData(true);
    } catch (err: any) {
      alert('Assignment failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setAssignLoading(false);
    }
  };

  const pilotName = (p: Pilot) => p.fullName || p.full_name || 'Unknown Pilot';
  const missionTitle = (m: Mission) => m.title || m.name || `Mission ${m.id?.slice(0, 8)}`;

  const cardStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 8,
    transition: 'border-color 0.15s',
    cursor: 'default',
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Radio size={18} color="#38bdf8" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: -0.4 }}>
              Dispatch Center
            </h1>
            <p style={{ fontSize: 12, color: '#475569', margin: 0, marginTop: 2 }}>
              Mission status overview · Pilot assignment grid
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
            color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
          <Loader2 size={28} color="#475569" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── LEFT: Active Missions ─────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                Active Missions <span style={{ color: '#3b82f6', marginLeft: 6 }}>{activeMissions.length}</span>
              </h2>
              {/* Status filter pills */}
              <div style={{ display: 'flex', gap: 4 }}>
                {['All', 'scheduled', 'assigned', 'in_progress'].map(f => (
                  <button
                    key={f}
                    onClick={() => setMissionFilter(f)}
                    style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      border: '1px solid',
                      borderColor: missionFilter === f ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.06)',
                      background: missionFilter === f ? 'rgba(59,130,246,0.12)' : 'transparent',
                      color: missionFilter === f ? '#60a5fa' : '#475569',
                      cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {f === 'in_progress' ? 'In Progress' : f}
                  </button>
                ))}
              </div>
            </div>

            {activeMissions.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem 2rem' }}>
                <Radar size={28} color="#334155" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', margin: 0 }}>No active missions</p>
                <p style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Scheduled and in-progress missions appear here</p>
              </div>
            ) : (
              activeMissions.map(mission => (
                <div key={mission.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {missionTitle(mission)}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                        {mission.site_name && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748b' }}>
                            <MapPin size={10} /> {mission.site_name}
                          </span>
                        )}
                        {mission.due_date && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748b' }}>
                            <Calendar size={10} /> {new Date(mission.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {mission.technicianIds && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748b' }}>
                            <Users size={10} /> {mission.technicianIds.length} pilot{mission.technicianIds.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <StatusBadge status={mission.mission_status_v2 || mission.status} size="xs" />
                      <button
                        onClick={() => setAssigningMission(mission.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', background: 'rgba(59,130,246,0.1)',
                          border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6,
                          color: '#60a5fa', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          textTransform: 'uppercase', letterSpacing: 0.4,
                        }}
                      >
                        <Send size={9} /> Assign
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── RIGHT: Pilot Pool ─────────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                Pilot Pool <span style={{ color: '#3b82f6', marginLeft: 6 }}>{filteredPilots.length}</span>
              </h2>
            </div>

            {/* Pilot search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={12} color="#475569" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={pilotSearch}
                onChange={e => setPilotSearch(e.target.value)}
                placeholder="Search pilots..."
                style={{
                  width: '100%', padding: '8px 12px 8px 30px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, color: '#e2e8f0', fontSize: 12,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {filteredPilots.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem 2rem' }}>
                <User size={28} color="#334155" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', margin: 0 }}>No pilots available</p>
                <p style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Add pilots via the Pilot Network admin</p>
              </div>
            ) : (
              filteredPilots.map(pilot => (
                <div
                  key={pilot.id}
                  style={{
                    ...cardStyle,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: assigningMission ? 'pointer' : 'default',
                    borderColor: selectedPilot?.id === pilot.id ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)',
                  }}
                  onClick={() => assigningMission && setSelectedPilot(pilot)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <User size={14} color="#60a5fa" />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                        {pilotName(pilot)}
                      </p>
                      {pilot.email && (
                        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{pilot.email}</p>
                      )}
                    </div>
                  </div>
                  {selectedPilot?.id === pilot.id && assigningMission && (
                    <CheckCircle2 size={16} color="#22c55e" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Assignment Confirmation Modal ──────────────────────────── */}
      {assigningMission && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => { setAssigningMission(null); setSelectedPilot(null); }}>
          <div
            style={{
              background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, padding: 28, width: '100%', maxWidth: 440,
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {assignSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle2 size={36} color="#22c55e" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 700, color: '#4ade80', margin: 0 }}>{assignSuccess}</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Assign Pilot</p>
                    <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>
                      Mission: <strong style={{ color: '#93c5fd' }}>
                        {missionTitle(missions.find(m => m.id === assigningMission)!)}
                      </strong>
                    </p>
                  </div>
                  <button onClick={() => { setAssigningMission(null); setSelectedPilot(null); }}
                    style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
                    <X size={16} />
                  </button>
                </div>

                <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                  Select from Pilot Pool →
                </p>
                {selectedPilot ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', marginBottom: 20 }}>
                    <User size={16} color="#60a5fa" />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd', margin: 0 }}>{pilotName(selectedPilot)}</p>
                      <p style={{ fontSize: 11, color: '#3b82f6', margin: 0 }}>Selected for assignment</p>
                    </div>
                    <button onClick={() => setSelectedPilot(null)}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', marginBottom: 20, textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Click a pilot in the pool to select them</p>
                  </div>
                )}

                <button
                  onClick={handleAssign}
                  disabled={!selectedPilot || assignLoading}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 10,
                    background: selectedPilot ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                    border: selectedPilot ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    color: selectedPilot ? '#60a5fa' : '#475569',
                    fontSize: 12, fontWeight: 800, cursor: selectedPilot ? 'pointer' : 'not-allowed',
                    textTransform: 'uppercase', letterSpacing: 0.6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {assignLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
                  Confirm Assignment
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
