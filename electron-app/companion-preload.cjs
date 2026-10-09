'use strict';
const {contextBridge, ipcRenderer} = require('electron');
const invoke = (name, ...args) => ipcRenderer.invoke('ortho:' + name, ...args);
contextBridge.exposeInMainWorld('axisOrtho', Object.freeze({
  isElectron: true,
  getStatus: () => invoke('status'),
  chooseImages: () => invoke('choose-images'),
  chooseFolder: () => invoke('choose-folder'),
  createJob: input => invoke('create-job', input),
  startJob: id => invoke('start-job', id),
  retryJob: id => invoke('start-job', id),
  cancelJob: id => invoke('cancel-job', id),
  listJobs: () => invoke('list-jobs'),
  getJob: id => invoke('get-job', id),
  openOutputDir: id => invoke('open-output', id),
  exportOutput: (id, key) => invoke('export-output', id, key),
  startEngine: () => invoke('start-engine'),
  linkCloud: input => invoke('link-cloud', input),
  linkOwner: () => invoke('link-owner'),
  unlinkCloud: () => invoke('unlink-cloud'),
  getCloudMissions: () => invoke('cloud-missions'),
  getCloudStatus: () => invoke('cloud-status'),
  setJobMission: (id, missionId) => invoke('job-mission', id, missionId),
  onJobsChanged: callback => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('ortho:jobs-changed', handler);
    return () => ipcRenderer.removeListener('ortho:jobs-changed', handler);
  },
  onCloudChanged: callback => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('ortho:cloud-changed', handler);
    return () => ipcRenderer.removeListener('ortho:cloud-changed', handler);
  }
}));
