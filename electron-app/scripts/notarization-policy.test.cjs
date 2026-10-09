'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const hook=require('./offline-notarize.cjs');
test('notarization prefers Keychain profile without reading plaintext credentials',()=>{assert.deepEqual(hook.credentials({APPLE_KEYCHAIN_PROFILE:'Axis-Ortho'}),{keychainProfile:'Axis-Ortho'});});
test('incomplete authentication never becomes notarization credentials',()=>assert.equal(hook.credentials({APPLE_ID:'owner'}),null));
test('customer build fails when notarization credentials are missing',async()=>{const saved=process.env.AXIS_RELEASE_MODE;process.env.AXIS_RELEASE_MODE='distribution';try{await assert.rejects(hook({electronPlatformName:'darwin'}),/Distribution blocked/);}finally{if(saved===undefined)delete process.env.AXIS_RELEASE_MODE;else process.env.AXIS_RELEASE_MODE=saved;}});
