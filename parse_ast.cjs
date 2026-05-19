const fs = require('fs');
const acorn = require('acorn');
const code = fs.readFileSync('backend/controllers/personnelController.js', 'utf8');

const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

function getTopLevelDeclNames(ast) {
  const names = [];
  ast.body.forEach(node => {
    if (node.type === 'ImportDeclaration') {
      node.specifiers.forEach(spec => names.push(spec.local.name));
    } else if (node.type === 'VariableDeclaration') {
      node.declarations.forEach(decl => {
        if (decl.id.type === 'Identifier') names.push(decl.id.name);
      });
    } else if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      if (node.id) names.push(node.id.name);
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      if (node.declaration.type === 'VariableDeclaration') {
        node.declaration.declarations.forEach(decl => {
          if (decl.id.type === 'Identifier') names.push(decl.id.name);
        });
      } else if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
        if (node.declaration.id) names.push(node.declaration.id.name);
      }
    }
  });
  return names;
}

const names = getTopLevelDeclNames(ast);
const duplicates = names.filter((item, index) => names.indexOf(item) !== index);
console.log('Top level duplicates in acorn:', duplicates);
console.log('Does acorn see multiple db declarations?', names.filter(n => n === 'db').length);
