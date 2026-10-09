'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {selectEngine}=require('./engine-selection.cjs');
async function fixture(t,marker){const root=await fs.mkdtemp(path.join(os.tmpdir(),'axis-platform-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'odm'));if(marker)await fs.writeFile(path.join(root,'odm','AXIS_ENGINE.json'),JSON.stringify(marker));return {resourcesPath:root,runtimeDataPath:path.join(root,'data')};}
test('Intel selects a native runner without Docker',async t=>{const f=await fixture(t,{target:'darwin-x64',engine:'native'});const s=await selectEngine({...f,platform:'darwin',arch:'x64'});assert.equal(s.mode,'native');assert.equal(s.runner,s.engine);});
test('platform mismatch is rejected before engine initialization',async t=>{const f=await fixture(t,{target:'darwin-arm64',engine:'native'});await assert.rejects(selectEngine({...f,platform:'win32',arch:'x64'}),/does not match/);});
test('native Windows edition has a native runner',async t=>{const f=await fixture(t,{target:'win32-x64',engine:'native'});const s=await selectEngine({...f,platform:'win32',arch:'x64'});assert.equal(s.mode,'native');assert.equal(s.runner,s.engine);});
test('container bundles are rejected rather than using Docker',async t=>{const f=await fixture(t,{target:'darwin-x64',engine:'docker'});await assert.rejects(selectEngine({...f,platform:'darwin',arch:'x64'}),/native Axis Ortho/);});
