/**
 * MissionIntelligenceWorkspace.tsx
 * ═══════════════════════════════════════════════════════════════════════════════
 * TRUE SPATIAL INTELLIGENCE CONSOLE
 * - Background: Seamless Orthomosaic SiteMapViewer.
 * - Left Drawer: Data Ingestion (Upload Engine).
 * - Right Drawer: AI Studio / Defect Inspector.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useState } from 'react';
import { Layers, BrainCircuit, Upload, Map, ChevronRight, ChevronLeft, Activity, Box } from 'lucide-react';
import MissionUploadEngine from '../components/MissionUploadEngine';
import SystemAIView from '../../components/SystemAIView';
import { SiteMapViewer } from '../../components/orthomosaic/SiteMapViewer';
import IndustryReportsHub from '../../modules/ai-reporting/IndustryReportsHub';

const MissionIntelligenceWorkspace: React.FC = () => {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'analyst' | 'reports'>('analyst');

  // Default to a placeholder job ID unless the user selects a specific mission.
  // The SiteMapViewer handles unknown IDs gracefully by showing a placeholder map.
  const activeMissionOrthoId = 'global-workspace-view';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#020617' }}>
      
      {/* BACKGROUND LAYER: The Geospatial Map */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {/* Pass a fixed height to ensure Leaflet renders correctly before fullscreen trigger */}
        <SiteMapViewer jobId={activeMissionOrthoId} />
      </div>

      {/* GLOBAL HEADER CONTROLS (Floating Top Left) */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        {/* Main Title Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
          padding: '12px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', padding: 8, borderRadius: 10 }}>
            <Activity color="#fff" size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#f8fafc', letterSpacing: -0.5 }}>Axis Command</h1>
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>Integrated Systems</p>
          </div>
        </div>

        {/* Global Toolbar Toggle Buttons */}
        <button
          onClick={() => setLeftOpen(!leftOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: leftOpen ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.85)',
            border: leftOpen ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.1)',
            color: leftOpen ? '#60a5fa' : '#e2e8f0', borderRadius: 12, padding: '12px 18px',
            backdropFilter: 'blur(12px)', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontWeight: 700, fontSize: 13
          }}>
          <Upload size={16} /> Data Ingestion
        </button>

        <button
          onClick={() => {
            if (rightOpen && rightTab === 'analyst') setRightOpen(false);
            else { setRightOpen(true); setRightTab('analyst'); }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: rightOpen && rightTab === 'analyst' ? 'rgba(139,92,246,0.15)' : 'rgba(15,23,42,0.85)',
            border: rightOpen && rightTab === 'analyst' ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.1)',
            color: rightOpen && rightTab === 'analyst' ? '#a78bfa' : '#e2e8f0', borderRadius: 12, padding: '12px 18px',
            backdropFilter: 'blur(12px)', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontWeight: 700, fontSize: 13
          }}>
          <BrainCircuit size={16} /> AI Studio
        </button>

        <button
          onClick={() => {
            if (rightOpen && rightTab === 'reports') setRightOpen(false);
            else { setRightOpen(true); setRightTab('reports'); }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: rightOpen && rightTab === 'reports' ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.85)',
            border: rightOpen && rightTab === 'reports' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.1)',
            color: rightOpen && rightTab === 'reports' ? '#34d399' : '#e2e8f0', borderRadius: 12, padding: '12px 18px',
            backdropFilter: 'blur(12px)', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontWeight: 700, fontSize: 13
          }}>
          <Box size={16} /> Reports
        </button>
      </div>

      {/* LEFT DRAWER: Data Ingestion (Upload Engine) */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 40,
        width: 600, background: 'rgba(2,6,23,0.95)', borderRight: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)', transform: leftOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex', flexDirection: 'column'
      }}>
        {/* Safe Area Offset for Header */}
        <div style={{ height: 100, flexShrink: 0 }} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px' }}>
          <MissionUploadEngine />
        </div>
        {/* Toggle nub */}
        <button onClick={() => setLeftOpen(!leftOpen)} style={{
          position: 'absolute', top: '50%', right: -28, width: 28, height: 64,
          background: 'rgba(2,6,23,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: 'none',
          borderRadius: '0 8px 8px 0', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {leftOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* RIGHT DRAWER: AI Inspection Studio */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: 0, zIndex: 40,
        width: 1000, background: 'rgba(2,6,23,0.95)', borderLeft: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)', transform: rightOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex', flexDirection: 'column'
      }}>
        {/* Drawer Header & Tabs */}
        <div style={{ padding: '30px 40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 8 }}>
            <button
              onClick={() => setRightTab('analyst')}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: rightTab === 'analyst' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: rightTab === 'analyst' ? '#fff' : '#64748b'
              }}
            >
              AI Analyst
            </button>
            <button
              onClick={() => setRightTab('reports')}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: rightTab === 'reports' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: rightTab === 'reports' ? '#fff' : '#64748b'
              }}
            >
              Report Generator
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 40px 40px' }}>
          {/* Note: since SystemAIView is originally meant for full page width, this 1000px drawer handles it comfortably without breaking its internal flex griding */}
          {rightTab === 'reports' ? <IndustryReportsHub /> : <SystemAIView />}
        </div>
        {/* Toggle nub */}
        <button onClick={() => setRightOpen(!rightOpen)} style={{
          position: 'absolute', top: '50%', left: -28, width: 28, height: 64,
          background: 'rgba(2,6,23,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRight: 'none',
          borderRadius: '8px 0 0 8px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {rightOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      
    </div>
  );
};

export default MissionIntelligenceWorkspace;
