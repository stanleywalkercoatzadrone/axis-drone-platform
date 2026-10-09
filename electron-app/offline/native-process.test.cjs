'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runProcess}=require('./native-process.cjs');
test('cancel kills a native process group and waits for closure before permitting retry',{skip:process.platform==='win32'},async()=>{
 const controller=new AbortController();let descendant;
 const source=`const {spawn}=require('node:child_process');process.on('SIGTERM',()=>{});const c=spawn(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit']});console.log(c.pid);setInterval(()=>{},1000)`;
 const started=Date.now();
 await assert.rejects(runProcess(process.execPath,['-e',source],{stdio:['ignore','pipe','pipe']},{signal:controller.signal,stopAfterMs:100,onData:bytes=>{descendant=Number(bytes.toString().trim());controller.abort();}}),/interrupted/);
 assert.ok(Date.now()-started<5000);
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.throws(()=>process.kill(descendant,0),{code:'ESRCH'});
});
test('an unavailable executable produces a settled error instead of hanging',async()=>{
 await assert.rejects(runProcess('/axis-missing-executable',[],{stdio:['ignore','pipe','pipe']}),/ENOENT/);
});
