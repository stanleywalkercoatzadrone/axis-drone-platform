/**
 * mappingController.js — stub
 *
 * The full Axis Mapping Engine™ controller is not yet deployed.
 * This stub satisfies the import in routes/v1/mapping.js so the backend
 * starts correctly. Each endpoint returns a 503 "not yet available" response.
 */

const notAvailable = (res) =>
    res.status(503).json({ success: false, message: 'Mapping engine not yet available on this deployment.' });

export const initUpload   = (req, res) => notAvailable(res);
export const uploadChunk  = (req, res) => notAvailable(res);
export const commitUpload = (req, res) => notAvailable(res);
export const getStatus    = (req, res) => notAvailable(res);
export const getAssets    = (req, res) => notAvailable(res);
export const getImages    = (req, res) => notAvailable(res);
export const getActiveJobs = (req, res) => notAvailable(res);
