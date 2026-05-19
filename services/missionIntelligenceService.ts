/**
 * missionIntelligenceService.ts
 * Data layer for the Mission Intelligence Workspace.
 * Fetches mission datasets, pipeline jobs, and provides polling-based real-time updates.
 */
import apiClient from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MissionDataset {
  id: string;
  mission_id: string;
  tenant_id: string;
  status: string;
  pipeline_status: string;
  pipeline_progress: number;
  total_files: number;
  uploaded_files: number;
  failed_files: number;
  result_url?: string;
  ai_summary?: Record<string, any>;
  error_message?: string;
  dataset_type?: string;
  gcs_raw_prefix?: string;
  gcs_processed_prefix?: string;
  ai_analysis_path?: string;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  // Joined from pipeline_jobs
  job_id?: string;
  job_status?: string;
  job_progress?: number;
  job_type?: string;
  priority?: string;
  image_count?: number;
  ai_result?: Record<string, any>;
  // Joined from deployments
  mission_title?: string;
  site_name?: string;
}

export interface PipelineJob {
  id: string;
  dataset_id: string;
  mission_id: string;
  tenant_id: string;
  job_type: string;
  priority: string;
  status: string;
  progress: number;
  worker_id?: string;
  error_message?: string;
  odm_cmd?: string;
  odm_output?: string;
  ai_result?: Record<string, any>;
  image_count: number;
  started_at?: string;
  completed_at?: string;
  mission_title?: string;
  site_name?: string;
  total_files?: number;
  uploaded_files?: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** Fetch all pipeline jobs (admin view) */
export async function getMissions(): Promise<PipelineJob[]> {
  try {
    const res = await apiClient.get('/mission-uploads/admin/pipeline', {
      params: { limit: 100 },
    });
    return res.data?.data || [];
  } catch (err) {
    console.warn('[MissionIntel] Failed to fetch pipeline:', err);
    return [];
  }
}

/** Fetch dataset status for a specific dataset */
export async function getDatasetStatus(datasetId: string): Promise<any> {
  try {
    const res = await apiClient.get(`/mission-uploads/status/${datasetId}`);
    return res.data?.data || null;
  } catch {
    return null;
  }
}

/** Fetch pipeline status for a specific dataset */
export async function getPipelineStatus(datasetId: string): Promise<any> {
  try {
    const res = await apiClient.get(`/mission-uploads/pipeline/status/${datasetId}`);
    return res.data?.data || null;
  } catch {
    return null;
  }
}

/** Fetch all deployments (missions) for the mission selector */
export async function getDeployments(): Promise<any[]> {
  try {
    const res = await apiClient.get('/deployments', { params: { limit: 200 } });
    return res.data?.data || res.data?.deployments || [];
  } catch {
    return [];
  }
}

// ─── Polling subscription ─────────────────────────────────────────────────────

/**
 * Subscribe to real-time pipeline updates via polling.
 * Returns an unsubscribe function.
 */
export function subscribeToUpdates(
  callback: (jobs: PipelineJob[]) => void,
  intervalMs = 5000
): () => void {
  let active = true;

  const poll = async () => {
    if (!active) return;
    const data = await getMissions();
    if (active) callback(data);
  };

  // Initial fetch
  poll();

  const timer = setInterval(poll, intervalMs);

  return () => {
    active = false;
    clearInterval(timer);
  };
}
