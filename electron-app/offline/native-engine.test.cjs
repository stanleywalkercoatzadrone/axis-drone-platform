'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {EventEmitter} = require('node:events');
const {PassThrough} = require('node:stream');
const {NativeEngine} = require('./native-engine.cjs');
const {OrthoService} = require('./engine.cjs');

const TIFF = Buffer.from('49492a0008000000000000000000', 'hex');

async function fixture(t, {orthophoto = TIFF, checkDiskSpace} = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'axis-native-runtime-'));
  const dataDir = path.join(root, 'jobs');
  const input = path.join(root, 'flight.jpg');
  await fs.mkdir(path.join(root, 'bin'), {recursive: true});
  await fs.writeFile(path.join(root, 'bin', process.platform==='win32'?'axis-odm.exe':'axis-odm'), 'fixture');
  await fs.writeFile(input, 'image fixture');
  const calls = [];
  const fakeSpawn = (_file, args, options) => {
    calls.push({args, options});
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    setImmediate(async () => {
      try {
        const projectIndex = args.indexOf('--project-path');
        const outputRoot = path.join(args[projectIndex + 1], args[projectIndex + 2]);
        await fs.mkdir(path.join(outputRoot, 'odm_orthophoto'), {recursive: true});
        await fs.mkdir(path.join(outputRoot, 'odm_dem'), {recursive: true});
        await fs.mkdir(path.join(outputRoot, 'odm_report'), {recursive: true});
        await fs.writeFile(path.join(outputRoot, 'odm_orthophoto', 'odm_orthophoto.tif'), orthophoto);
        await fs.writeFile(path.join(outputRoot, 'odm_dem', 'dsm.tif'), TIFF);
        await fs.writeFile(path.join(outputRoot, 'odm_report', 'report.pdf'), '%PDF-1.4\nfixture');
        await fs.writeFile(path.join(outputRoot, 'odm_report', 'stats.json'), '{}');
        child.stdout.end('stage 75%\n'); child.stderr.end(); child.emit('close', 0, null);
      } catch (error) { child.emit('error', error); }
    });
    return child;
  };
  const runner = new NativeEngine({root, spawn: fakeSpawn, checkDiskSpace, inspectRaster: async()=>({driverShortName:'GTiff',size:[100,100],coordinateSystem:{wkt:'EPSG:32617'},geoTransform:[10,.05,0,20,0,-.05],bands:[{checksum:42,type:'Byte'}]})});
  const service = new OrthoService({dataDir, runner, ...runner.connection()});
  t.after(async () => { await service.shutdown(); await fs.rm(root, {recursive: true, force: true}); });
  return {runner, service, input, calls};
}

test('bundled native engine completes a job without Docker and validates outputs', async t => {
  const {runner, service, input, calls} = await fixture(t);
  assert.equal((await runner.probe()).healthy, true);
  const job = await service.create({name: 'Native survey', files: [input], preset: 'fast'});
  await service.start(job.id); await service.whenIdle(job.id);
  const saved = await service.get(job.id);
  assert.equal(saved.status, 'completed', saved.error);
  assert.deepEqual(Object.keys(saved.outputs).sort(), ['delivery', 'dsm', 'orthophoto', 'quality', 'report', 'stats']);
  assert.deepEqual(await fs.readFile(await service.getOutputPath(job.id, 'orthophoto')), TIFF);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].args.includes('--fast-orthophoto'));
  assert.equal(calls[0].args.includes('--radiometric-calibration'), false);
  assert.deepEqual(calls[0].args.slice(calls[0].args.indexOf('--pc-filter'),calls[0].args.indexOf('--pc-filter')+2),['--pc-filter','0']);
  assert.equal(calls[0].options.shell, undefined);
});

test('native engine enables camera radiometric calibration only when selected for an IR job', async t => {
  const {runner, service, input, calls} = await fixture(t);
  const job = await service.create({name: 'FLIR thermal survey', files: [input], preset: 'standard', radiometricCalibration: true});
  assert.equal(job.radiometricCalibration, true);
  await service.start(job.id); await service.whenIdle(job.id);
  const saved = await service.get(job.id);
  assert.equal(saved.status, 'completed', saved.error);
  const index = calls[0].args.indexOf('--radiometric-calibration');
  assert.deepEqual(calls[0].args.slice(index,index+2), ['--radiometric-calibration','camera']);
});

test('native engine cannot report completion for an invalid orthophoto', async t => {
  const {service, input} = await fixture(t, {orthophoto: Buffer.from('not a tiff')});
  const job = await service.create({name: 'Invalid output', files: [input], preset: 'standard'});
  await service.start(job.id); await service.whenIdle(job.id);
  const saved = await service.get(job.id);
  assert.equal(saved.status, 'failed');
  assert.match(saved.error, /invalid GeoTIFF/);
});

test('disk preflight prevents native execution and preserves existing working files', async t => {
  const {service, input, calls} = await fixture(t, {checkDiskSpace: async () => {throw Error('Not enough free disk space for processing.');}});
  const job = await service.create({name: 'Storage preflight', files: [input], preset: 'standard'});
  const jobRoot = service.store.pathFor(job.id);
  await fs.mkdir(path.join(jobRoot, 'native'), {recursive: true});
  await fs.writeFile(path.join(jobRoot, 'native', 'existing-result.txt'), 'preserved');
  await service.start(job.id); await service.whenIdle(job.id);
  const saved = await service.get(job.id);
  assert.equal(saved.status, 'failed');
  assert.match(saved.error, /Not enough free disk space/);
  assert.equal(calls.length, 0);
  assert.equal(await fs.readFile(path.join(jobRoot, 'native', 'existing-result.txt'), 'utf8'), 'preserved');
  assert.equal(await fs.readFile(service.store.pathFor(job.id, saved.inputs[0].relativePath), 'utf8'), 'image fixture');
});

test('runtime storage guard terminates native processing before retry and preserves inputs', {timeout: 15000}, async t => {
  let checks = 0, pid;
  const {runner, service, input} = await fixture(t, {checkDiskSpace: async () => {
    if (++checks > 1) throw Error('Not enough free disk space for processing.');
  }});
  runner.spawn = (_file, _args, options) => {
    const child = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], options);
    pid = child.pid;
    return child;
  };
  const job = await service.create({name: 'Runtime storage guard', files: [input], preset: 'standard'});
  await service.start(job.id); await service.whenIdle(job.id);
  const saved = await service.get(job.id);
  assert.equal(saved.status, 'failed');
  assert.match(saved.error, /Not enough free disk space/);
  assert.ok(checks >= 2);
  assert.throws(() => process.kill(pid, 0), {code: 'ESRCH'});
  assert.equal(await fs.readFile(service.store.pathFor(job.id, saved.inputs[0].relativePath), 'utf8'), 'image fixture');
});
