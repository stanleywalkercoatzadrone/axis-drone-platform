'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {requireDiskSpace,RESERVE_BYTES}=require('./resources.cjs');
test('disk guard uses space available to the user and fails before storage exhaustion',async()=>{
 await assert.rejects(requireDiskSpace('/fixture',RESERVE_BYTES,async()=>({bavail:100,bsize:4096,bfree:999999999})),/Not enough free disk space/);
 assert.equal(await requireDiskSpace('/fixture',100,async()=>({bavail:100,bsize:4096})),409600);
 await assert.rejects(requireDiskSpace('/fixture',100,async()=>({bavail:NaN,bsize:4096})),/Not enough/);
});
