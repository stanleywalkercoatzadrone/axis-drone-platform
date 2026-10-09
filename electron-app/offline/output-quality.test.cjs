'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {rasterSummary,qualitySummary} = require('./output-quality.cjs');
const valid = () => ({driverShortName:'GTiff',size:[200,300],coordinateSystem:{wkt:'UTM'},geoTransform:[1,.05,0,2,0,-.05],bands:[{checksum:42,type:'Byte'}],stac:{'proj:epsg':32617},metadata:{IMAGE_STRUCTURE:{LAYOUT:'COG'}}});
test('rejects missing CRS, singular geometry and rasters that were not decoded',()=>{
 for(const change of [{coordinateSystem:{}},{geoTransform:[0,0,0,0,0,0]},{bands:[{type:'Byte'}]},{size:[0,20]},{driverShortName:'PNG'}])assert.throws(()=>rasterSummary({...valid(),...change}),/readable GeoTIFF/);
 assert.deepEqual(rasterSummary(valid()).pixelSize,[.05,.05]);
});
test('alignment gaps, disconnected models, preview and thermal uncertainty require review',()=>{
 const q=qualitySummary({id:'job',preset:'fast',inputs:new Array(100),radiometricCalibration:true},rasterSummary(valid()),{reconstruction_statistics:{reconstructed_shots_count:70,components:2,reprojection_error_pixels:3,has_gcp:false}});
 assert.equal(q.status,'review_required');assert.equal(q.independentAccuracyVerified,false);assert.equal(q.reconstructionRatio,.7);
 for(const phrase of ['Fast preview','90%','disconnected','2 pixels','ground control','Temperature'])assert.ok(q.warnings.some(w=>w.includes(phrase)));
});
test('ground control and complete camera alignment never silently certify independent accuracy',()=>{
 const q=qualitySummary({id:'job',preset:'standard',inputs:[1,2]},rasterSummary(valid()),{reconstruction_statistics:{reconstructed_shots_count:2,components:1,reprojection_error_pixels:.8,has_gcp:true}});
 assert.equal(q.groundControlRecorded,true);assert.equal(q.independentAccuracyVerified,false);assert.equal(q.status,'review_required');
});
