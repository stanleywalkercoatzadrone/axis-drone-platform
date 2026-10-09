'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {NativeEngine}=require('../offline/native-engine.cjs');
const {DockerEngine}=require('./docker.cjs');
async function selectEngine({resourcesPath,runtimeDataPath,platform=process.platform,arch=process.arch}){
 const target=`${platform}-${arch}`;
 if(!['darwin-arm64','darwin-x64','win32-x64'].includes(target))throw Error('This computer is not supported by this Axis Ortho build.');
 let mode='native';
 try{const marker=JSON.parse(await fs.readFile(path.join(resourcesPath,'odm','AXIS_ENGINE.json'),'utf8'));if(marker.target!==target)throw Error('The processing bundle does not match this computer.');mode=marker.engine;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(mode==='docker'&&target==='darwin-x64'){const engine=await new DockerEngine(runtimeDataPath).init();return {engine,runner:undefined,mode};}
 if(mode!=='native'||target==='darwin-x64')throw Error('Install the Intel edition of Axis Ortho. Intel processing requires Docker Desktop.');
 const engine=new NativeEngine({resourcesPath,runtimeDataPath});return {engine,runner:engine,mode};
}
module.exports={selectEngine};
