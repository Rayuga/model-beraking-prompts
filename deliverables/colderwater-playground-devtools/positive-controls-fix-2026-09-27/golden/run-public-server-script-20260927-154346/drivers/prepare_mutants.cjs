'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {digest}=require('./workflow_core.cjs');
const root=path.resolve(__dirname,'../../../../..'),app=path.join(root,'projects/colderwater-playground-devtools/solution/app'),out=path.resolve(__dirname,'../variants');
const prior=JSON.parse(fs.readFileSync(path.join(root,'deliverables/colderwater-playground-devtools/structural-review-2026-09-27/golden/frozen_final_inputs.json')));
for(const[rel,hash]of Object.entries(prior.solution_files).filter(([r])=>r.startsWith('app/')))assert.equal(digest(fs.readFileSync(path.join(app,rel.slice(4)))),hash);
assert(!fs.existsSync(out),'Preserve prior variant builds');
const definitions=[
  {name:'dead-auto-run',file:'src/app.tsx',from:'useEffect(() => { if (!auto) return; const timer = setTimeout(run, 500); return () => clearTimeout(timer); }, [code, filename, auto]);',to:'useEffect(() => { /* Disposable proof defect: automatic scheduling does nothing. */ }, [code, filename, auto]);'},
  {name:'css-wipes-preview',file:'src/runtime.ts',from:"kind === 'html' ? code : kind === 'css' ? lastDocument : emptyDocument",to:"kind === 'html' ? code : emptyDocument"},
];
const toolRoot=path.join(root,'deliverables/colderwater-playground-devtools/hardening-2026-09-26/build-tools/node_modules');assert.equal(JSON.parse(fs.readFileSync(path.join(toolRoot,'vite/package.json'))).version,'7.1.7');
const report={created_at:new Date().toISOString(),scope:'Two source mutants in disposable copies only; no task source change',prior_golden_source_binding:'structural-review-2026-09-27/golden/frozen_final_inputs.json',variants:[]};
for(const def of definitions){
  const dest=path.join(out,def.name,'app');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(app,dest,{recursive:true});
  const file=path.join(dest,def.file),source=fs.readFileSync(file,'utf8');assert.equal(source.split(def.from).length,2);const changed=source.replace(def.from,def.to);fs.writeFileSync(file,changed);
  const build=cp.spawnSync(process.execPath,[path.join(toolRoot,'vite/bin/vite.js'),'build'],{cwd:dest,encoding:'utf8'});fs.writeFileSync(path.join(out,def.name,'build.log'),build.stdout+build.stderr);assert.equal(build.status,0);
  const files={};function scan(dir,prefix=''){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,ent.name),rel=prefix+ent.name;if(ent.isDirectory())scan(full,rel+'/');else files[rel]=digest(fs.readFileSync(full));}}scan(dest);
  report.variants.push({name:def.name,mutated_file:def.file,before_sha256:digest(source),after_sha256:digest(changed),app_files:files,vite_version:'7.1.7',network_during_build:false});
}
for(const[rel,hash]of Object.entries(prior.solution_files).filter(([r])=>r.startsWith('app/')))assert.equal(digest(fs.readFileSync(path.join(app,rel.slice(4)))),hash);
fs.writeFileSync(path.join(out,'variant_binding.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.variants.map(({name,mutated_file,before_sha256,after_sha256})=>({name,mutated_file,before_sha256,after_sha256})),null,2));
