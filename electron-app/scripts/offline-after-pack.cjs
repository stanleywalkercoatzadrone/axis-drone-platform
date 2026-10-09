'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),execute=require('node:util').promisify(require('node:child_process').execFile);
// Keep quarantine and security attributes; remove only Finder decoration from newly built bundles.
module.exports=async context=>{
 if(context.electronPlatformName!=='darwin')return;
 const root=path.join(context.appOutDir,context.packager.appInfo.productName+'.app');
 async function visit(file){const stat=await fs.lstat(file);if(stat.isSymbolicLink())return;const {stdout}=await execute('/usr/bin/xattr',[file]);for(const name of stdout.trim().split('\n'))if(['com.apple.FinderInfo','com.apple.ResourceFork'].includes(name))await execute('/usr/bin/xattr',['-d',name,file]);if(stat.isDirectory())for(const name of await fs.readdir(file))await visit(path.join(file,name));}
 await visit(root);
};
