/**
 * BlockReportForm.tsx
 * Phase 7 – Pilot Block Progress Reporting Form
 *
 * Pilot submits block inspection progress:
 * - Block selection
 * - Acres completed
 * - Flight hours
 * - Images captured
 * - Inspection type
 * - Notes
 */
import React, { useEffect, useState } from 'react';

interface Block {
    id: string;
    block_name: string;
    block_number: number | null;
    acreage: number | null;
    status: string;
}

interface BlockReportFormProps {
    missionId: string;
    missionTitle?: string;
    onSubmitted?: () => void;
}

const INSPECTION_TYPES = [
    { value: 'visual', label: 'Visual (RGB)' },
    { value: 'thermal', label: 'Thermal' },
    { value: 'multispectral', label: 'Multispectral' },
    { value: 'lidar', label: 'LiDAR' },
    { value: 'combined', label: 'Combined' },
];

const STATUS_COLORS: Record<string, string> = {
    pending: '#6b7280',
    in_progress: '#f59e0b',
    completed: '#22c55e',
    skipped: '#94a3b8',
};

export const BlockReportForm: React.FC<BlockReportFormProps> = ({ missionId, missionTitle, onSubmitted }) => {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState('');
    const [form, setForm] = useState({
        acres_completed: '',
        flight_hours: '',
        images_collected: '',
        inspection_type: 'visual',
        data_uploaded: false,
    });
    const [loading, setLoading] = useState(false);
    const [blocksLoading, setBlocksLoading] = useState(true);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!missionId) return;
        setBlocksLoading(true);
        fetch(`/api/blocks/${missionId}`, { credentials: 'include' })
            .then(r => r.json())
            .then(d => setBlocks((d.data || []).filter((b: Block) => b.status !== 'completed')))
            .catch(() => setBlocks([]))
            .finally(() => setBlocksLoading(false));
    }, [missionId]);

    const selectedBlock = blocks.find(b => b.id === selectedBlockId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBlockId) { setMsg({ type: 'error', text: 'Please select a block' }); return; }
        if (!form.acres_completed) { setMsg({ type: 'error', text: 'Acres completed required' }); return; }

        setLoading(true);
        setMsg(null);
        try {
            const r = await fetch(`/api/blocks/${selectedBlockId}/progress`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    acres_completed: parseFloat(form.acres_completed),
                    flight_hours: parseFloat(form.flight_hours) || 0,
                    images_collected: parseInt(form.images_collected) || 0,
                    inspection_type: form.inspection_type,
                    data_uploaded: form.data_uploaded,
                }),
            });
            const data = await r.json();
            if (data.success) {
                setMsg({ type: 'success', text: '✅ Progress submitted successfully' });
                setForm({ acres_completed: '', flight_hours: '', images_collected: '', inspection_type: 'visual', data_uploaded: false });
                setSelectedBlockId('');
                // Refresh blocks
                const refreshed = await fetch(`/api/blocks/${missionId}`, { credentials: 'include' }).then(r => r.json());
                setBlocks((refreshed.data || []).filter((b: Block) => b.status !== 'completed'));
                onSubmitted?.();
            } else {
                setMsg({ type: 'error', text: `❌ ${data.message}` });
            }
        } catch {
            setMsg({ type: 'error', text: '❌ Submission failed — please try again' });
        } finally {
            setLoading(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, color: '#f1f5f9', fontSize: 13, padding: '9px 12px',
        outline: 'none', boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: 11, color: '#64748b',
        marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
    };

    if (blocksLoading) return (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 32, fontFamily: "'Inter', system-ui, sans-serif" }}>
            Loading blocks...
        </div>
    );

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
            <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>📋 Submit Block Progress</h4>
                {missionTitle && <div style={{ fontSize: 12, color: '#64748b' }}>{missionTitle}</div>}
            </div>

            {msg && (
                <div style={{
                    background: msg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
                }}>
                    {msg.text}
                </div>
            )}

            {blocks.length === 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    No pending blocks found for this mission. All blocks may be completed, or blocks haven't been configured yet.
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {/* Block selector */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Select Block *</label>
                        <select value={selectedBlockId} onChange={e => setSelectedBlockId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                            <option value="">— Choose a block —</option>
                            {blocks.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.block_name || `Block ${b.block_number}`}
                                    {b.acreage ? ` (${b.acreage} ac)` : ''}
                                    {` · ${b.status}`}
                                </option>
                            ))}
                        </select>
                        {selectedBlock && (
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94a3b8' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[selectedBlock.status] || '#6b7280' }} />
                                {selectedBlock.acreage ? `${selectedBlock.acreage} total acres` : 'Acreage not set'}
                            </div>
                        )}
                    </div>

                    {/* Two-column grid for numeric inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                        <div>
                            <label style={labelStyle}>Acres Completed *</label>
                            <input
                                type="number" step="0.01" min="0" max={selectedBlock?.acreage || 99999}
                                value={form.acres_completed}
                                onChange={e => setForm(f => ({ ...f, acres_completed: e.target.value }))}
                                placeholder="e.g. 45.5"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Flight Hours</label>
                            <input
                                type="number" step="0.1" min="0"
                                value={form.flight_hours}
                                onChange={e => setForm(f => ({ ...f, flight_hours: e.target.value }))}
                                placeholder="e.g. 3.5"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Images Captured</label>
                            <input
                                type="number" min="0"
                                value={form.images_collected}
                                onChange={e => setForm(f => ({ ...f, images_collected: e.target.value }))}
                                placeholder="e.g. 2400"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Inspection Type</label>
                            <select value={form.inspection_type} onChange={e => setForm(f => ({ ...f, inspection_type: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                                {INSPECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Data uploaded toggle */}
                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="checkbox" id="data_uploaded" checked={form.data_uploaded}
                            onChange={e => setForm(f => ({ ...f, data_uploaded: e.target.checked }))}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <label htmlFor="data_uploaded" style={{ fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
                            Data has been uploaded to the system
                        </label>
                    </div>

                    <button type="submit" disabled={loading || !selectedBlockId} style={{
                        width: '100%',
                        background: loading || !selectedBlockId ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.15)',
                        border: `1px solid ${!selectedBlockId ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.3)'}`,
                        borderRadius: 9, color: !selectedBlockId ? '#475569' : '#818cf8',
                        fontSize: 13, fontWeight: 700, padding: '12px',
                        cursor: loading || !selectedBlockId ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                    }}>
                        {loading ? '⏳ Submitting...' : '✅ Submit Progress'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default BlockReportForm;
