// Focused source-helper experiment. This is not a browser, verifier, or Oracle run.
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const {performance} = require('node:perf_hooks');
const esbuild = require('C:/Users/00518507/AppData/Roaming/npm/node_modules/tsx/node_modules/esbuild');
const {parse} = require('C:/Users/00518507/AppData/Roaming/npm/node_modules/@google/gemini-cli/node_modules/acorn');
const root = path.resolve(__dirname, '../../..');
const candidate = process.argv[2] || 'coldwater-2026-09-30-repair2';
const input = path.join(root, '.qc-cache', candidate, 'task/solution/app/src/runtime.ts');
const source = fs.readFileSync(input, 'utf8');
const helpers = source.slice(source.indexOf('function instrument('), source.indexOf('\nexport function buildRun'));
const js = esbuild.transformSync(helpers, {loader:'ts',target:'es2022'}).code;
// Acorn child-first traversal suffices for these literal expression/function fixtures;
// actual runtime helper bodies are extracted unchanged, with TypeScript types erased.
function fullWalk(node, visit) {
  for(const value of Object.values(node)) {
    if(Array.isArray(value)) { for(const child of value) if(child && typeof child.type === 'string') fullWalk(child,visit); }
    else if(value && typeof value.type === 'string') fullWalk(value,visit);
  }
  visit(node);
}
async function run(code) {
  const events=[], listeners={};
  const copy={outerHTML:'<html><body>mock snapshot</body></html>',querySelectorAll:()=>[]};
  const sandbox={parse,fullWalk,performance,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,
    parent:{postMessage:e=>events.push(e)}, console:{}, Element:class {},
    document:{documentElement:{cloneNode:()=>copy},addEventListener(){}},
    MutationObserver:class {observe(){}}, addEventListener:(type,fn)=>listeners[type]=fn};
  sandbox.window=sandbox;
  const context=vm.createContext(sandbox);
  vm.runInContext(js+'\nsandboxBootstrap("probe","__guard");',context,{filename:'bootstrap-runtime.js'});
  const instrumented=vm.runInContext('instrument('+JSON.stringify(code)+',"__guard")',context);
  const unhandled=(reason,promise)=>listeners.unhandledrejection({reason,promise,preventDefault(){}});
  process.on('unhandledRejection',unhandled);
  try {
    vm.runInContext(instrumented,context,{filename:'cw-user-0-probe.js'});
    await new Promise(resolve=>setTimeout(resolve,50));
  } finally { process.off('unhandledRejection',unhandled); }
  return {source:code,instrumented,events};
}
(async()=>{
  const fixtures={
    promise_caught_then_async_same: "Promise.resolve().then(() => { throw 'same'; }).catch(() => {\n  (async () => {\n    throw 'same';\n  })();\n});"
  };
  const report={scope:'Extracted runtime helper with Node VM browser stubs; not browser evidence',input_sha256:JSON.parse(fs.readFileSync(path.join(root,'qc/runs',candidate,'manifest.json'))).input_sha256,
    runtime_sha256:crypto.createHash('sha256').update(source).digest('hex'),node:process.version,
    source_helpers_extracted:true,typescript_transformer:require('C:/Users/00518507/AppData/Roaming/npm/node_modules/tsx/node_modules/esbuild/package.json').version,
    parser:require('C:/Users/00518507/AppData/Roaming/npm/node_modules/@google/gemini-cli/node_modules/acorn/package.json').version,results:{}};
  for(const [name,code] of Object.entries(fixtures)) report.results[name]=await run(code);
  fs.writeFileSync(path.join(__dirname,'targeted-runtime-catch-'+candidate+'-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
