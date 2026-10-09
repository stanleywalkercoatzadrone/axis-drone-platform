'use strict';
const fs = require('node:fs/promises');
const RESERVE_BYTES = 1024 ** 3;
async function requireDiskSpace(directory,required=RESERVE_BYTES,statfs=fs.statfs){
 const space=await statfs(directory),available=Number(space.bavail)*Number(space.bsize);
 if(!Number.isFinite(available)||available<required)throw Error('Not enough free disk space for processing. Free space or choose a computer with more storage, then retry. Copied inputs and existing results are preserved.');
 return available;
}
module.exports={requireDiskSpace,RESERVE_BYTES};
