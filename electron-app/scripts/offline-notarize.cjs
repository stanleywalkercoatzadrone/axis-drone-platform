'use strict';
const path=require('node:path');
const {execFile}=require('node:child_process');
const execute=require('node:util').promisify(execFile);
function credentials(env){
 if(env.APPLE_KEYCHAIN_PROFILE)return {keychainProfile:env.APPLE_KEYCHAIN_PROFILE,...(env.APPLE_KEYCHAIN?{keychain:env.APPLE_KEYCHAIN}:{})};
 if(env.APPLE_API_KEY&&env.APPLE_API_KEY_ID&&env.APPLE_API_ISSUER)return {appleApiKey:env.APPLE_API_KEY,appleApiKeyId:env.APPLE_API_KEY_ID,appleApiIssuer:env.APPLE_API_ISSUER};
 if(env.APPLE_ID&&env.APPLE_APP_SPECIFIC_PASSWORD&&env.APPLE_TEAM_ID)return {appleId:env.APPLE_ID,appleIdPassword:env.APPLE_APP_SPECIFIC_PASSWORD,teamId:env.APPLE_TEAM_ID};
 return null;
}
async function hook(context){
 if(context.electronPlatformName!=='darwin')return;
 const release=process.env.AXIS_RELEASE_MODE==='distribution',auth=credentials(process.env);
 if(!auth){if(release)throw Error('Distribution blocked: configure notarization credentials or APPLE_KEYCHAIN_PROFILE.');console.log('Owner preview only: notarization is not configured.');return;}
 const appPath=path.join(context.appOutDir,context.packager.appInfo.productName+'.app');
 const signature=await execute('/usr/bin/codesign',['--display','--verbose=2',appPath]);
 if(!/Authority=Developer ID Application:/.test(signature.stderr))throw Error('Notarization requires a Developer ID Application signature.');
 await require('@electron/notarize').notarize({appPath,...auth});
 await execute('/usr/bin/xcrun',['stapler','validate',appPath]);
 await execute('/usr/sbin/spctl',['--assess','--type','execute','--verbose=2',appPath]);
}
module.exports=hook;module.exports.credentials=credentials;
