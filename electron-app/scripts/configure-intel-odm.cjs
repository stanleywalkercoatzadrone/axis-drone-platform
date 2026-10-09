'use strict';
const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../native-runtime/ODM/pixi.toml');
let text=fs.readFileSync(file,'utf8');
if(!text.includes('platform = "osx-64"'))text=text.replace('platforms = ["linux-64", "win-64", "linux-aarch64",','platforms = ["linux-64", "win-64", "linux-aarch64",\n    { platform = "osx-64", macos = "14.0" },');
text=text.replace('"osx-arm64-macos-14-0"]','"osx-arm64-macos-14-0", "osx-64-macos-14-0"]');
if(!text.includes('"osx-64-macos-14-0"'))throw Error('Intel ODM manifest patch did not apply.');
fs.writeFileSync(file,text);console.log('Prepared experimental Intel dependency target. Solving/building/processing still must pass.');
