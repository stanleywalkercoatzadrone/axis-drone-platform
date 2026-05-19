import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function walk(d, list=[]) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, list);
    else if (p.endsWith('.js')) list.push(p);
  }
  return list;
}

const files = walk('./backend');
for (const f of files) {
  try {
    execSync(`node -e "import('file://' + require('path').resolve('${f}'))"`, {stdio: 'pipe', encoding: 'utf8'});
  } catch (err) {
    if (err.stderr && err.stderr.includes('SyntaxError: Identifier') && err.stderr.includes('db')) {
      console.log('FOUND SYNTAX ERROR IN: ' + f);
    }
  }
}
console.log('Finished checking all files.');
