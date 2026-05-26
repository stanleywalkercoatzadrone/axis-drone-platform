/**
 * UploadCenterHub.tsx
 *
 * Unified entry point for the "Pilot Uploads" nav item.
 *
 * — Pilots see: Upload Center (file submission form)
 * — Admins see: Upload Center (default) + "AI Monitor" tab (AIUploadsAdmin)
 *
 * This replaces the previous direct routing of `uploads` → AIUploadsAdmin.
 */
import React, { useState } from 'react';
import { Upload, Activity, Image, Layers } from 'lucide-react';
import UploadCenter from './UploadCenter';
import AIUploadsAdmin from './AIUploadsAdmin';
import { useAuth } from '../../context/AuthContext';
import { useMediaDeliverable } from '../../context/MediaDeliverableContext';

type Tab = 'upload' | 'monitor';

const UploadCenterHub: React.FC = () => {
  const { user } = useAuth();
  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole.includes('admin') || userRole.includes('superadmin');
  const { navigateToTab } = useMediaDeliverable();

  const [tab, setTab] = useState<Tab>('upload');

  // Non-admin users go straight to the uploader with no tab bar
  if (!isAdmin) {
    return <UploadCenter />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 16px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(2,6,23,0.6)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <button
          onClick={() => setTab('upload')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: tab === 'upload' ? 'rgba(99,102,241,0.15)' : 'none',
            border: tab === 'upload' ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
            borderBottom: tab === 'upload' ? '1px solid transparent' : '1px solid transparent',
            borderRadius: '10px 10px 0 0',
            cursor: 'pointer',
            color: tab === 'upload' ? '#a5b4fc' : '#64748b',
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            transition: 'all 0.15s',
          }}
        >
          <Upload size={12} />
          Upload Center
        </button>

        <button
          onClick={() => setTab('monitor')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: tab === 'monitor' ? 'rgba(99,102,241,0.15)' : 'none',
            border: tab === 'monitor' ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
            borderRadius: '10px 10px 0 0',
            cursor: 'pointer',
            color: tab === 'monitor' ? '#a5b4fc' : '#64748b',
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            transition: 'all 0.15s',
          }}
        >
          <Activity size={12} />
          AI Monitor
        </button>
        <button
          onClick={() => navigateToTab('media')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: 'none',
            border: '1px solid rgba(14,165,233,0.25)',
            borderRadius: 10,
            cursor: 'pointer',
            color: '#38bdf8',
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            transition: 'all 0.15s',
            marginLeft: 'auto',
          }}
        >
          <Image size={12} />
          Media Gallery
        </button>

        <button
          onClick={() => navigateToTab('orthomosaic')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: 'none',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 10,
            cursor: 'pointer',
            color: '#a78bfa',
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            transition: 'all 0.15s',
          }}
        >
          <Layers size={12} />
          Orthomosaic
        </button>
      </div>

      {/* Tab content */}
      {tab === 'upload'  && <UploadCenter />}
      {tab === 'monitor' && <AIUploadsAdmin />}
    </div>
  );
};

export default UploadCenterHub;
