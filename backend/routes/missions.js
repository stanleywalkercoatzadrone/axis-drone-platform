// Mission routes are currently implemented by the deployment controller.
// Keep this compatibility mount for frontend code that calls /api/missions.
export { default } from './deployments.js';
