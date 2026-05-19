const fs = require('fs');
const acorn = require('acorn');
const code = fs.readFileSync('backend/controllers/personnelController.js', 'utf8');

try {
  acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  console.log('Acorn passed.');
} catch (e) {
  console.error('Acorn parsing failed:', e.message);
}
