'use strict';
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {NativeEngine} = require('../offline/native-engine.cjs');
const {OrthoService} = require('../offline/engine.cjs');

async function main() {
  const source = path.resolve(process.argv[2] || path.join(os.homedir(), 'Pictures'));
  const root = path.resolve(process.env.AXIS_ODM_ROOT || path.join(__dirname, '..', 'native-runtime'));
  const entries = await fs.readdir(source, {withFileTypes: true});
  const files = entries.filter(entry => entry.isFile() && /\.(?:jpe?g|png|tiff?)$/i.test(entry.name)).map(entry => path.join(source, entry.name)).sort().slice(0, Number(process.env.AXIS_VALIDATE_IMAGE_LIMIT || 12));
  if (files.length < 5) throw Error(`Expected at least five visual survey images in ${source}.`);
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'axis-ortho-native-validation-'));
  const engine = new NativeEngine({root, runtimeDataPath: path.join(dataDir,'runtime')});
  const service = new OrthoService({dataDir, runner: engine, ...engine.connection()});
  let last = '';
  service.on('change', job => {
    const message = `${job.status} ${job.progress}% ${job.phase}`;
    if (message !== last) { console.log(message); last = message; }
  });
  try {
    const job = await service.create({name: 'Axis native validation', files, preset: 'fast'});
    await service.start(job.id); await service.whenIdle(job.id);
    const saved = await service.get(job.id);
    if (saved.status !== 'completed') throw Error(saved.error || `Validation ended as ${saved.status}.`);
    const orthophoto = await service.getOutputPath(job.id, 'orthophoto');
    if(process.env.AXIS_VALIDATION_REPORT) await fs.writeFile(path.resolve(process.env.AXIS_VALIDATION_REPORT),JSON.stringify({status:'completed',platform:process.platform,architecture:process.arch,images:files.length,version:JSON.parse(await fs.readFile(path.join(__dirname,'..','.offline-build','app','package.json'),'utf8')).version,outputs:saved.outputs},null,2));
    console.log(JSON.stringify({jobId: job.id, images: files.length, dataDir, orthophoto, outputs: saved.outputs}));
  } finally { await service.shutdown(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

