'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=path.join(root,'native-runtime','ODM'),destination=path.join(root,'.offline-build','native-runtime');
async function copy(a,b){await fs.cp(a,b,{recursive:true,force:true,filter:f=>!path.relative(a,f).split(path.sep).some(p=>['.git','__pycache__'].includes(p))&&!/\.(pyc|DS_Store)$/.test(f)});}
async function portableLinks(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await portableLinks(f);if(e.isSymbolicLink()){const link=await fs.readlink(f);if(path.isAbsolute(link)){const sibling=path.join(path.dirname(f),path.basename(link));await fs.access(sibling);await fs.unlink(f);await fs.symlink(path.basename(link),f);}}}}
async function main(){
 const target=process.env.AXIS_BUILD_TARGET||`${process.platform}-${process.arch}`;
 if(!['darwin-arm64','darwin-x64','win32-x64'].includes(target))throw Error('Unsupported build target.');
 if(target!==`${process.platform}-${process.arch}`&&!(target==='darwin-x64'&&process.platform==='darwin'))throw Error('Prepare the processing engine on the target platform.');
 await fs.rm(destination,{recursive:true,force:true});await fs.mkdir(destination,{recursive:true});
 await fs.writeFile(path.join(destination,'AXIS_ENGINE.json'),JSON.stringify({target,engine:target==='darwin-x64'?'docker':'native'}));
 if(target==='darwin-x64'){await fs.writeFile(path.join(destination,'README.txt'),'Intel Mac processing uses a local Docker Desktop NodeODM engine. Docker Desktop is required; no ARM native binaries are packaged.');return;}
 const win=target==='win32-x64',pack=win?'odm-env-win-x64.tar':'odm-env-osx-arm64.sh';
 await fs.access(path.join(source,'SuperBuild','install'));await fs.access(path.join(root,'native-runtime','packed',pack));
 await fs.mkdir(path.join(destination,'env'));await fs.copyFile(path.join(root,'native-runtime','packed',pack),path.join(destination,'env',pack));if(!win)await fs.chmod(path.join(destination,'env',pack),0o755);else await fs.copyFile(path.join(root,'native-runtime','packed','pixi-unpack.exe'),path.join(destination,'env','pixi-unpack.exe'));
 await fs.copyFile(path.join(source,'LICENSE'),path.join(destination,'LICENSE'));
 await fs.writeFile(path.join(destination,'AXIS_RUNTIME_VERSION'),`axis-ortho-native-v2-${target}\n`);
 const odm=path.join(destination,'ODM');await fs.mkdir(odm);for(const f of ['run.py','settings.yaml','VERSION','LICENSE'])await fs.copyFile(path.join(source,f),path.join(odm,f));
 for(const d of ['opendm','stages','licenses'])await copy(path.join(source,d),path.join(odm,d));
 const env=path.join(source,'.pixi','envs','default');await copy(path.join(env,...(win?['Lib','site-packages','vmem']:['lib','python3.12','site-packages','vmem'])),path.join(odm,'vmem'));
 await copy(path.join(source,'SuperBuild','install'),path.join(odm,'SuperBuild','install'));await portableLinks(path.join(odm,'SuperBuild','install'));console.log('Prepared native runtime: '+target);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
