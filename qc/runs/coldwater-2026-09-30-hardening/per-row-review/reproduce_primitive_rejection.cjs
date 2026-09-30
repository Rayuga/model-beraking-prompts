const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const file = path.join(root, '.qc-cache/coldwater-2026-09-30-hardening/task/solution/app/src/runtime.ts');
const source = fs.readFileSync(file, 'utf8');
const start = source.indexOf('  function fail(error, line = 0) {');
const end = source.indexOf('  function wrap(fn)', start);
if (start < 0 || end < start) throw new Error('Runtime function boundary not found');
const exactSource = source.slice(start, end);
function run(reason) {
  const sent = [], listeners = {};
  const context = {send: (kind, payload) => sent.push({kind, payload}),
    addEventListener: (event, fn) => { listeners[event] = fn; },
    clearNative() {}, clearIntervalNative() {}, now: () => 1};
  vm.createContext(context);
  vm.runInContext('let failed=false,settleTimer=null,started=0; const timers=new Set();\n' + exactSource, context);
  listeners.unhandledrejection({reason, preventDefault() {}});
  return sent;
}
const positive = run({message:'error-object-control', stack:'Error: control\n at cw-user-0-example.js:2:1'});
const primitive = run('primitive-rejection');
if (positive[0]?.payload.line !== 2 || primitive[0]?.payload.line !== 0) throw new Error('Unexpected source-level behavior');
const result = {scope:'Exact extracted rejection/error-handler source executed with a minimal event harness. This is not a full browser, Oracle or provider run.',
  source_file:path.relative(root,file), positive_control:positive, primitive_rejection:primitive,
  implication:'Primitive rejection has no stack and produces line0; the receiving UI suppresses zero line numbers at runtime.ts message(error).'};
fs.writeFileSync(path.join(__dirname,'primitive-rejection-source-result.json'),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify(result));
