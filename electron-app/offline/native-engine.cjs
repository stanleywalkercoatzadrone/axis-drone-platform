'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {randomUUID} = require('node:crypto');
const os = require('node:os');
const {runProcess} = require('./native-process.cjs');
const {inspectRaster, rasterSummary, qualitySummary, sha256} = require('./output-quality.cjs');
const {requireDiskSpace, RESERVE_BYTES} = require('./resources.cjs');

const OUTPUTS = {
  orthophoto: ['odm_orthophoto/odm_orthophoto.tif', 'orthophoto.tif'],
  dsm: ['odm_dem/dsm.tif', 'dsm.tif'],
  report: ['odm_report/report.pdf', 'report.pdf'],
  stats: ['odm_report/stats.json', 'stats.json'],
};
function safeRoot(value){if(typeof value!=='string'||!path.isAbsolute(value)||value.includes('\0'))throw Error('The bundled ODM runtime path is invalid.');return path.resolve(value)}
async function exists(file){try{const s=await fsp.stat(file);return s.isFile()}catch{return false}}
async function tiff(file){const h=await fsp.open(file,'r'),b=Buffer.alloc(4);try{await h.read(b,0,4,0)}finally{await h.close()}if(!['49492a00','4d4d002a','49492b00','4d4d002b'].includes(b.toString('hex')))throw Error('ODM produced an invalid GeoTIFF.')}
class NativeEngine {
  constructor(options={}) {
    const resources = options.resourcesPath || process.resourcesPath || path.resolve(__dirname, '..');
    this.root = safeRoot(options.root || process.env.AXIS_ODM_ROOT || path.join(resources, 'odm'));
    this.runtimeDataPath = safeRoot(options.runtimeDataPath || process.env.AXIS_ODM_DATA_ROOT || path.join(this.root, '.runtime'));
    this.spawn = options.spawn || spawn;
    this.inspectRaster = options.inspectRaster || inspectRaster;
    this.checkDiskSpace = options.checkDiskSpace || requireDiskSpace;
    this.active = new Map();
    this._preparePromise = null;
  }
  async preparePackagedRuntime(environment){
    const odm=path.join(this.runtimeDataPath,'ODM'),run=path.join(odm,'run.py');
    const expected=(await fsp.readFile(path.join(this.root,'AXIS_RUNTIME_VERSION'),'utf8')).trim(),marker=path.join(odm,'AXIS_RUNTIME_VERSION');
    let current='';try{current=(await fsp.readFile(marker,'utf8')).trim()}catch{}
    if(await exists(run)&&current===expected)return odm;
    if(!this._preparePromise)this._preparePromise=(async()=>{
      const temporary=path.join(this.runtimeDataPath,`.ODM-${randomUUID()}.tmp`);
      await fsp.rm(temporary,{recursive:true,force:true});
      await fsp.cp(path.join(this.root,'ODM'),temporary,{recursive:true,force:true});
      await fsp.copyFile(path.join(this.root,'AXIS_RUNTIME_VERSION'),path.join(temporary,'AXIS_RUNTIME_VERSION'));
      const link=path.join(temporary,'.pixi','envs','default');await fsp.mkdir(path.dirname(link),{recursive:true});
      await fsp.symlink(process.platform==='win32'?environment:'../../../env',link,process.platform==='win32'?'junction':'dir');
      await fsp.rm(odm,{recursive:true,force:true});
      await fsp.rename(temporary,odm);
    })().finally(()=>{this._preparePromise=null});
    await this._preparePromise;
    if(!(await exists(run)))throw Error('The bundled processing runtime could not be prepared.');
    return odm;
  }
  command(){
    if(!this._commandPromise)this._commandPromise=this._command().finally(()=>{this._commandPromise=null});
    return this._commandPromise;
  }
  async _command(){
    const win=process.platform==='win32';
    const packaged=win?path.join(this.root,'bin','axis-odm.exe'):path.join(this.root,'bin','axis-odm');
    if(await exists(packaged))return {file:packaged,args:[]};
    const packedEnvironment=path.join(this.root,'env',win?'odm-env-win-x64.tar':`odm-env-${process.platform==='darwin'?'osx':'linux'}-${process.arch}.sh`);
    const environment=path.join(this.runtimeDataPath,'env');
    const python=path.join(environment,win?'python.exe':'bin/python');
    const bundledRun=path.join(this.root,'ODM','run.py');
    if(await exists(packedEnvironment)&&await exists(bundledRun)){
      if(!(await exists(python))){
        await fsp.mkdir(this.runtimeDataPath,{recursive:true,mode:0o700});
        await new Promise((resolve,reject)=>{
          const unpackArgs=['--output-directory',this.runtimeDataPath,'--env-name','env','--quiet'];
          const unpacker=win?path.join(this.root,'env','pixi-unpack.exe'):packedEnvironment;
          const child=this.spawn(unpacker,win?[packedEnvironment,...unpackArgs]:unpackArgs,{cwd:this.runtimeDataPath,stdio:['ignore','pipe','pipe'],windowsHide:true});
          let tail='';
          child.stdout.on('data',chunk=>{tail=(tail+chunk.toString()).slice(-4000)});
          child.stderr.on('data',chunk=>{tail=(tail+chunk.toString()).slice(-4000)});
          child.once('error',reject);
          child.once('exit',code=>code===0?resolve():reject(Error(`The bundled processing environment could not be installed. ${tail.slice(-800)}`)));
        });
      }
      if(!(await exists(python)))throw Error('The bundled processing environment is incomplete.');
      const odmRoot=await this.preparePackagedRuntime(environment);
      return {file:python,args:[path.join(odmRoot,'run.py')],environment,odmRoot};
    }
    const pixi=process.env.AXIS_PIXI_BIN||path.join(this.root,'bin',win?'pixi.exe':'pixi');
    const manifest=path.join(this.root,'ODM','pixi.toml');
    if(await exists(pixi)&&await exists(manifest))return {file:pixi,args:['run','--manifest-path',manifest,'odm','--']};
    throw Error('The native ODM processing runtime is missing from this Axis Ortho build.');
  }
  async probe(){try{await this.command();return {available:true,healthy:true,message:'Native processing engine is ready.',version:'Bundled ODM'}}catch(error){return {available:false,healthy:false,message:error.message}}}
  async start(){const state=await this.probe();if(!state.healthy)throw Error(state.message);return state}
  connection(){return {endpoint:'http://127.0.0.1:58000',token:''}}
  async run({job,store,signal,onProgress}){
    const command=await this.command(),jobRoot=store.pathFor(job.id),projectRoot=path.join(jobRoot,'native'),project='project',images=path.join(projectRoot,project,'images');
    await this.checkDiskSpace(jobRoot,job.inputs.reduce((n,i)=>n+i.size,0)*4+RESERVE_BYTES);
    await fsp.rm(projectRoot,{recursive:true,force:true});await fsp.mkdir(images,{recursive:true,mode:0o700});
    let copied=0;for(const input of job.inputs){const source=store.pathFor(job.id,input.relativePath),target=path.join(images,input.storedName);try{await fsp.link(source,target)}catch{await fsp.copyFile(source,target)}await onProgress(2+Math.round(++copied/job.inputs.length*8),`Preparing ${copied}/${job.inputs.length} images`)}
    const workers=Math.max(1,Math.min(4,os.availableParallelism(),Math.floor(os.totalmem()/(4*1024**3))));
    const args=[...command.args,'--max-concurrency',String(workers),'--project-path',projectRoot,project,'--auto-boundary','--dsm','--cog',...(job.radiometricCalibration?['--radiometric-calibration','camera']:[]),'--feature-quality',job.preset==='fast'?'low':'high','--min-num-features',job.preset==='fast'?'4000':'8000',...(job.preset==='fast'?['--fast-orthophoto','--pc-filter','0']:[])];
    let progressUpdates = Promise.resolve(), tail = '', pct = 10, phase='Processing images with native ODM', lastPhase='', lastProgress=-1;
    const stages={dataset:12,split:14,merge:16,opensfm:20,openmvs:45,odm_filterpoints:65,odm_meshing:70,odm_texturing:75,odm_georeferencing:80,odm_dem:86,odm_orthophoto:90,odm_report:94,odm_postprocess:94};
    const odmRoot=command.odmRoot||path.join(this.root,'ODM'),environment=command.environment||path.join(odmRoot,'.pixi','envs','default');
    const nativeBins=[path.join(odmRoot,'SuperBuild','install','bin'),...(process.platform==='win32'?[environment,path.join(environment,'Scripts'),path.join(environment,'Library','bin'),path.join(environment,'Library','usr','bin')]:[path.join(environment,'bin')])];
    const nativeEnv={...process.env,PYTHONUNBUFFERED:'1',PYTHONDONTWRITEBYTECODE:'1',CONDA_PREFIX:environment,PATH:[...nativeBins,process.env.PATH].filter(Boolean).join(path.delimiter),PYTHONPATH:odmRoot};
    delete nativeEnv.DYLD_LIBRARY_PATH;
    const resourceController=new AbortController(),processingSignal=signal?AbortSignal.any([signal,resourceController.signal]):resourceController.signal;
    let resourceFailure,checking=false;
    const monitor=setInterval(async()=>{
      if(checking)return;checking=true;
      try{await this.checkDiskSpace(jobRoot);}catch(error){resourceFailure=error;resourceController.abort();}finally{checking=false;}
    },5000);
    monitor.unref?.();
    try {
      await runProcess(command.file, args, {cwd:this.root,env:nativeEnv,stdio:['ignore','pipe','pipe'],windowsHide:true}, {
        spawnProcess:this.spawn, signal:processingSignal, onData:chunk=>{
          tail=(tail+chunk.toString()).slice(-20000);
          const found=[...tail.matchAll(/(?:progress|stage)[^0-9]{0,12}(\d{1,3})%?/ig)].at(-1);
          if(found)pct=Math.max(pct,Math.min(94,10+Number(found[1])*.84));
          const stage=[...tail.replace(/\x1b\[[0-9;]*m/g,'').matchAll(/Running ([a-z_]+) stage/ig)].at(-1)?.[1]?.toLowerCase();
          if(stage&&Object.hasOwn(stages,stage)){pct=Math.max(pct,stages[stage]);phase='Processing: '+stage.replaceAll('_',' ');}
          if(phase!==lastPhase||pct!==lastProgress){
            lastPhase=phase;lastProgress=pct;progressUpdates=progressUpdates.then(()=>onProgress(pct,phase));progressUpdates.catch(()=>{});
          }
        },
      });
      await progressUpdates;
    } catch(error) {
      await progressUpdates.catch(()=>{});
      throw Error(resourceFailure?.message||(signal?.aborted?'Native processing interrupted.':`${error.message} ${tail.slice(-1200)}`));
    } finally {
      clearInterval(monitor);
      await fsp.writeFile(path.join(projectRoot,'processing-tail.log'),tail,{mode:0o600});
    }
    const outputs={};await fsp.mkdir(path.join(jobRoot,'output'),{recursive:true,mode:0o700});
    for(const [key,[relative,name]] of Object.entries(OUTPUTS)){const source=path.join(projectRoot,project,relative);if(!(await exists(source)))continue;const destination=path.join(jobRoot,'output',name);await fsp.copyFile(source,destination);if(key==='orthophoto'||key==='dsm')await tiff(destination);const stat=await fsp.stat(destination);if(!stat.size)throw Error(`ODM produced an empty ${key} output.`);outputs[key]={relativePath:'output/'+name,size:stat.size}}
    if (!outputs.orthophoto || !outputs.dsm || !outputs.report || !outputs.stats) throw Error('Processing did not produce the orthophoto, surface model, quality report and reconstruction statistics.');
    const report = await fsp.open(path.join(jobRoot,outputs.report.relativePath),'r');
    try {const signature=Buffer.alloc(5);await report.read(signature,0,5,0);if(signature.toString()!=='%PDF-')throw Error('The generated processing report is not a PDF.');} finally {await report.close();}
    await onProgress(95, 'Validating raster geometry and preparing delivery checksums');
    const raster = rasterSummary(await this.inspectRaster(path.join(jobRoot, outputs.orthophoto.relativePath), environment, signal));
    const stats = JSON.parse(await fsp.readFile(path.join(jobRoot, outputs.stats.relativePath), 'utf8'));
    const quality = qualitySummary(job, raster, stats);
    quality.surfaceModel = rasterSummary(await this.inspectRaster(path.join(jobRoot,outputs.dsm.relativePath),environment,signal));
    const qualityPath = path.join(jobRoot, 'output', 'quality.json');
    await fsp.writeFile(qualityPath, JSON.stringify(quality,null,2)+'\n', {mode:0o600});
    outputs.quality = {relativePath:'output/quality.json',size:(await fsp.stat(qualityPath)).size};
    const files=[];
    for(const [key,output] of Object.entries(outputs)) {
      signal?.throwIfAborted();
      files.push({key,name:path.basename(output.relativePath),bytes:output.size,sha256:await sha256(path.join(jobRoot,output.relativePath))});
    }
    const manifestPath=path.join(jobRoot,'output','delivery.json');
    await fsp.writeFile(manifestPath, JSON.stringify({schemaVersion:1,jobId:job.id,createdAt:new Date().toISOString(),engine:'OpenDroneMap',status:'review_required',files},null,2)+'\n',{mode:0o600});
    outputs.delivery={relativePath:'output/delivery.json',size:(await fsp.stat(manifestPath)).size};
    return outputs;
  }
}
module.exports={NativeEngine,OUTPUTS};
