import fs from 'fs';
import path from 'path';

async function check() {
  const dir = './backend';
  const files = [];
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js')) files.push(p);
    }
  }
  walk(dir);
  for (const f of files) {
    try {
      await import('file://' + path.resolve(f));
    } catch (e) {
      if (e.name === 'SyntaxError' && e.message.includes('db')) {
        console.log('FOUND IT: ' + f);
      }
    }
  }
  console.log('DONE CHECKING');
}
check().catch(console.error);
