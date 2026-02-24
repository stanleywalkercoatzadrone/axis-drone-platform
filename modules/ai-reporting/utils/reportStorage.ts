/**
 * reportStorage — persists generated AI PDF reports to localStorage.
 *
 * Each report is stored as:
 *   key:  `axis_ai_report_<id>`   → base64-encoded PDF data
 *   key:  `axis_ai_reports_index` → JSON array of ReportMeta (lightweight list)
 */

export type ReportIndustry =
    | 'insurance'
    | 'solar'
    | 'utilities'
    | 'construction'
    | 'telecom';

export interface ReportMeta {
    id: string;
    industry: ReportIndustry;
    title: string;
    filename: string;
    sizeBytes: number;
    createdAt: string; // ISO string
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
    pdfArrayBuffer: ArrayBuffer
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

/** Format bytes as human-readable size string. */
export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
