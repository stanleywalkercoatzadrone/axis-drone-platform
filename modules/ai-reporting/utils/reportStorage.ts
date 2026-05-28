/**
 * reportStorage — persists generated AI PDF reports to localStorage.
 *
 * Each report is stored as:
 *   key:  `axis_ai_report_<id>`   → base64-encoded PDF data
 *   key:  `axis_ai_reports_index` → JSON array of ReportMeta (lightweight list)
 */

import apiClient from '../../../src/services/apiClient';

export type ReportIndustry =
    | 'insurance'
    | 'solar'
    | 'utilities'
    | 'construction'
    | 'telecom'
    | 'orthomosaic';

export interface ReportMeta {
    id: string;
    industry: ReportIndustry;
    title: string;
    filename: string;
    sizeBytes: number;
    createdAt: string; // ISO string
    rawData?: any;     // Optional JSON payload for rich dashboard viewing
    missionId?: string;
    missionTitle?: string;
    siteName?: string;
    clientName?: string;
}

const INDEX_KEY = 'axis_ai_reports_index';
const dataKey = (id: string) => `axis_ai_report_${id}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function readIndex(): ReportMeta[] {
    try {
        return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    } catch {
        return [];
    }
}

function writeIndex(index: ReportMeta[]) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save a PDF (as ArrayBuffer) to localStorage. Returns the generated report ID.
 */
export function saveReport(
    industry: ReportIndustry,
    title: string,
    filename: string,
    pdfArrayBuffer: ArrayBuffer,
    rawData?: any
): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const b64 = arrayBufferToBase64(pdfArrayBuffer);

    try {
        localStorage.setItem(dataKey(id), b64);
    } catch (e) {
        // Storage quota exceeded — prune oldest report and retry once
        const index = readIndex();
        if (index.length > 0) {
            const oldest = index[index.length - 1];
            localStorage.removeItem(dataKey(oldest.id));
            index.pop();
            writeIndex(index);
            localStorage.setItem(dataKey(id), b64);
        } else {
            throw e;
        }
    }

    const meta: ReportMeta = {
        id,
        industry,
        title,
        filename,
        sizeBytes: pdfArrayBuffer.byteLength,
        createdAt: new Date().toISOString(),
        rawData
    };

    const index = readIndex();
    index.unshift(meta); // newest first
    writeIndex(index);

    // Notify same-tab listeners (StorageEvent only fires cross-tab)
    window.dispatchEvent(new CustomEvent('axis-report-saved', { detail: meta }));

    return id;
}

/** List all saved reports (metadata only, newest first). */
export function listReports(): ReportMeta[] {
    return readIndex();
}

/**
 * Fetch all AI reports across the entire platform.
 */
export async function listAllGlobalReports(): Promise<ReportMeta[]> {
    try {
        const response = await apiClient.get('/ai/reports');
        if (response.data.success) {
            return response.data.data.map((r: any) => ({
                id: r.id,
                industry: r.industry,
                title: r.report_data?.title || r.report_type || 'AI Report',
                filename: r.report_data?.filename || 'report.pdf',
                createdAt: r.created_at,
                rawData: r.report_data,
                sizeBytes: 0,
                missionId: r.mission_id,
                missionTitle: r.mission_title,
                siteName: r.site_name,
                clientName: r.client_name
            }));
        }
        return [];
    } catch (err) {
        console.error('[listAllGlobalReports] Failed:', err);
        return [];
    }
}

/** Get a blob URL for inline viewing. Caller must revoke when done. */
export function getBlobUrl(id: string): string | null {
    const b64 = localStorage.getItem(dataKey(id));
    if (!b64) return null;
    const bytes = base64ToUint8Array(b64);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
}

/** Download a saved report. */
export function downloadReport(meta: ReportMeta) {
    const url = getBlobUrl(meta.id);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Delete a saved report. */
export function deleteReport(id: string) {
    localStorage.removeItem(dataKey(id));
    const index = readIndex().filter(m => m.id !== id);
    writeIndex(index);
}

/**
 * Save a report directly to the Mission database archive.
 */
export async function saveReportToMission(
    missionId: string,
    meta: Omit<ReportMeta, 'id' | 'createdAt'>,
    rawData: any // Can contain form, findings, aiSummary, faults
): Promise<string> {
    try {
        const response = await apiClient.post('/ai/reports/save', {
            missionId,
            industry: meta.industry,
            reportType: meta.industry === 'insurance' ? 'Claim Analysis' : 'Industrial Inspection',
            title: meta.title,
            filename: meta.filename,
            reportData: rawData
        });

        if (response.data.success) {
            // Also notify local listeners so the UI refreshes
            window.dispatchEvent(new CustomEvent('axis-report-saved', { 
                detail: { ...meta, id: response.data.data.id, createdAt: response.data.data.created_at, rawData } 
            }));
            return response.data.data.id;
        }
        throw new Error(response.data.message || 'Failed to save to mission');
    } catch (err: any) {
        console.error('[saveReportToMission] Failed:', err);
        throw err;
    }
}

/**
 * Fetch all reports saved for a specific mission.
 */
export async function listMissionReports(missionId: string): Promise<ReportMeta[]> {
    try {
        const response = await apiClient.get(`/ai/reports/mission/${missionId}`);
        if (response.data.success) {
            return response.data.data.map((r: any) => ({
                id: r.id,
                industry: r.industry,
                title: r.report_data?.title || `${r.industry} Report`,
                filename: r.report_data?.filename || 'report.pdf',
                createdAt: r.created_at,
                rawData: r.report_data,
                sizeBytes: 0,
                missionId: missionId,
                rawData_extracted: !!r.report_data // helper flag
            }));
        }
        return [];
    } catch (err) {
        console.error('[listMissionReports] Failed:', err);
        return [];
    }
}

/** Format bytes as human-readable size string. */
export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
