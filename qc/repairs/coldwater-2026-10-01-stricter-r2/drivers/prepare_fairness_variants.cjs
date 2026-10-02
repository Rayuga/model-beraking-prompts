'use strict';
// Run from repository root after prepare_golden.py, before browser execution.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {digest}=require('./workflow_core.cjs');
const root=process.cwd(),name=process.argv[2];assert(name&&/^[a-zA-Z0-9_-]+$/.test(name),'Usage: node <this script> <frozen-run-name>');
const run=path.join(root,'qc/runs',name),round=JSON.parse(fs.readFileSync(path.join(run,'manifest.json')));
const evidence=path.join(run,'golden'),manifestPath=path.join(evidence,'frozen_repair_inputs.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
const app=path.join(root,round.cache,'task/solution/app'),output=path.join(evidence,'fairness-variants');
assert.equal(round.input_sha256,manifest.round_input_sha256);assert(!fs.existsSync(output),'Never overwrite completed variant evidence');
const files=dir=>{const out={};function scan(at,prefix=''){for(const entry of fs.readdirSync(at,{withFileTypes:true})){const full=path.join(at,entry.name),rel=prefix+entry.name;if(entry.isDirectory())scan(full,rel+'/');else out[rel]=digest(fs.readFileSync(full));}}scan(dir);return out;};
const original=files(app);for(const[rel,hash]of Object.entries(original))assert.equal(hash,manifest.solution_files['app/'+rel],'Frozen app drift: '+rel);
function once(source,anchor,replacement){assert.equal(source.split(anchor).length,2,'Mutation anchor must occur once: '+anchor);return source.replace(anchor,replacement);}
const paddedGuard="\n    if (req.body.title !== req.body.title.trim()) throw problem('Padded otherwise-valid titles are refused by this disposable proof variant.');";
const variants=[
  {name:'run-duration-only',file:'src/runtime.ts',transform:source=>once(once(source,"  const send = (kind, data = {}) =>",'  let completedRunDuration = null;\n  const send = (kind, data = {}) =>'),"send('complete', { duration: now() - started });","send('complete', { duration: completedRunDuration ?? (completedRunDuration = now() - started) });")},
  ...['create','update','both'].map(kind=>({name:'padded-'+kind+'-refused',file:'server.js',transform:source=>{
    if(kind!=='update')source=once(source,'    uniqueTitle(value.title);','    uniqueTitle(value.title);'+paddedGuard);
    if(kind!=='create')source=once(source,'    uniqueTitle(value.title, current.id);','    uniqueTitle(value.title, current.id);'+paddedGuard);
    return source;
  }})),
  {name:'long-idle-handlers',file:'src/runtime.ts',transform:source=>once(source,"    if (settled) { settled = false; started = now(); deadline = started + 4900; send('interaction'); }","    if (settled && now() <= deadline) { settled = false; started = now(); deadline = started + 4900; send('interaction'); }")},
  {name:'broken-html-dispatch',file:'src/runtime.ts',transform:source=>once(source,"  const kind = language(filename);","  const kind = language(filename);\n  if (kind === 'html') throw new Error('HTML dispatch disabled by this disposable proof variant.');")},
  {name:'never-working-handlers',file:'src/runtime.ts',transform:source=>once(source,"document.addEventListener(name, () => {","document.addEventListener(name, event => {\n    event.stopImmediatePropagation(); event.preventDefault(); return;")},
  {name:'dead-writer',file:'server.js',transform:source=>once(source,"app.use(express.json({ limit: '1mb' }));","app.use(express.json({ limit: '1mb' }));\napp.use('/api', (req, res, next) => { if (['POST','PUT'].includes(req.method)) return res.status(503).json({error:'Disposable proof writer is unavailable.'}); next(); });")},
  {name:'constant-zero-duration',file:'src/runtime.ts',transform:source=>once(source,"send('complete', { duration: now() - started });","send('complete', { duration: 0 });")},
];
const report={round_input_sha256:round.input_sha256,manifest_sha256:digest(fs.readFileSync(manifestPath)),provider_or_platform:false,runtime_executed:false,variants:[]};
fs.mkdirSync(output);
for(const variant of variants){
  const dest=path.join(output,variant.name,'app');fs.mkdirSync(path.dirname(dest));fs.cpSync(app,dest,{recursive:true});
  const file=path.join(dest,variant.file),source=fs.readFileSync(file,'utf8'),changed=variant.transform(source);fs.writeFileSync(file,changed);
  const row={name:variant.name,mutated_file:variant.file,before_sha256:digest(source),after_sha256:digest(changed)};
  if(variant.file==='src/runtime.ts'){
    const toolRoot=path.join(root,'deliverables/colderwater-playground-devtools/hardening-2026-09-26/build-tools/node_modules');
    assert.equal(JSON.parse(fs.readFileSync(path.join(toolRoot,'vite/package.json'))).version,'7.1.7');
    const build=cp.spawnSync(process.execPath,[path.join(toolRoot,'vite/bin/vite.js'),'build'],{cwd:dest,encoding:'utf8'});
    fs.writeFileSync(path.join(output,variant.name,'build.log'),(build.stdout||'')+(build.stderr||''));assert.equal(build.status,0,build.stderr);
    row.build={vite:'7.1.7',network:false,returncode:build.status};
  }
  row.app_files=files(dest);report.variants.push(row);
}
assert.deepEqual(files(app),original,'Frozen app bytes changed');
fs.writeFileSync(path.join(output,'variant_binding.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,variant_count:variants.length,round_input_sha256:round.input_sha256,runtime_executed:false}));
