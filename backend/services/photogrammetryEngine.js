/**
 * photogrammetryEngine.js — stub
 *
 * This module is imported by jobAdvancer.js. The full orthomosaic processing
 * engine is not yet deployed; this stub returns a no-op mock engine so the
 * backend starts successfully without it.
 */

const mockEngine = {
    async getTaskStatus(engineJobId) {
        return { status: 'unknown', progressPct: 0, stage: null };
    },
    async getTaskOutputs(engineJobId) {
        return [];
    },
    async createTask(options) {
        return { engineJobId: `mock-${Date.now()}` };
    },
};

export function getEngine() {
    return mockEngine;
}

export default mockEngine;
