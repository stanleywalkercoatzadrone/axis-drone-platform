import assert from 'assert/strict';
import fs from 'fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const uploadProcessor = read('backend/services/uploadProcessor.js');
assert.match(uploadProcessor, /oauth2\/token\//, 'Pix4D OAuth token endpoint should be used');
assert.match(uploadProcessor, /s3_credentials/, 'Pix4D temporary S3 credentials should be requested');
assert.match(uploadProcessor, /bulk_register/, 'Pix4D inputs should be bulk registered');
assert.match(uploadProcessor, /start_processing/, 'Pix4D project should be started after upload/register');
assert.match(uploadProcessor, /pix4d_status = 'dispatching'/, 'Pix4D dispatch should be guarded by a dispatching state');

const pilotUpload = read('backend/routes/pilotUpload.js');
assert.match(pilotUpload, /verifyMissionUploadScope/, 'Pilot uploads must validate mission scope');
assert.match(pilotUpload, /dispatchPix4DForJob/, 'Pix4D should dispatch from job completion');
const perFileHandler = pilotUpload.slice(
    pilotUpload.indexOf("router.post('/:jobId/files'"),
    pilotUpload.indexOf("// ── GET /api/pilot/upload-jobs/admin/all")
);
assert.doesNotMatch(perFileHandler, /dispatchPix4DForJob/, 'Per-file processing should not trigger Pix4D before completion');

const uploadController = read('backend/controllers/uploadController.js');
assert.match(uploadController, /tenant_id::text/, 'Ingestion upload APIs should tenant-scope jobs');
assert.match(uploadController, /getScopedJob/, 'Ingestion files/exceptions should check scoped job access');

const apiClient = read('src/services/apiClient.ts');
assert.match(apiClient, /payload\.jobs \?\?= payload\.data/, 'Frontend API client should normalize data/jobs collection aliases');

const clientApp = read('src/components/client/ClientApp.tsx');
assert.doesNotMatch(clientApp, /deploymentId="latest"/, 'Client analysis views must not call APIs with fake deployment IDs');

console.log('platform stability smoke checks passed');
