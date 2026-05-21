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
import SystemAIView from '../components/SystemAIView';

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
      
      {/* BACKGROUND LAYER: Spatial Intelligence Empty State */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 60%, rgba(59,130,246,0.06) 0%, #020617 70%)' }}>
        {/* Animated grid backdrop */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)', backgroundSize: '48px 48px', opacity: 0.6 }} />
        {/* Empty state card */}
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 480, padding: '48px 40px', background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Map size={32} color="#818cf8" />
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: '#f1f5f9', letterSpacing: -0.5 }}>Mission Intelligence Console</h2>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            Select a mission from the <strong style={{ color: '#60a5fa' }}>Mission Terminal</strong> to load its spatial intelligence layer — orthomosaic maps, defect overlays, and AI thermal analysis.
          </p>
          <p style={{ margin: '0 0 28px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
            While you wait, use the <strong style={{ color: '#a78bfa' }}>Data Ingestion</strong> panel to upload new imagery, or open the <strong style={{ color: '#34d399' }}>AI Studio</strong> to review the training dataset.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#818cf8' }}>
              <Layers size={12} /> Orthomosaic Mapping
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#f87171' }}>
              <Activity size={12} /> Thermal Detection
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#4ade80' }}>
              <Box size={12} /> AI Defect Inspector
            </div>
          </div>
        </div>
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
