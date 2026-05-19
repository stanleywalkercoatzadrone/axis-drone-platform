import vm from 'node:vm';
export async function resolve(specifier, context, nextResolve) {
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (result.format === 'module' && result.source) {
    try {
      new vm.SourceTextModule(result.source.toString());
    } catch (e) {
      if (e.name === 'SyntaxError' && e.message.includes('db')) {
        console.error('>>> SYNTAX ERROR FILE:', url);
      }
    }
  }
  return result;
}
