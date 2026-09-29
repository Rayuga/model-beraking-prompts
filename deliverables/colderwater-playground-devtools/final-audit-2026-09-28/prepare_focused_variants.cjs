'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const task=path.join(root,'projects/colderwater-playground-devtools');
const out=path.join(__dirname,'focused-v2');
assert(!fs.existsSync(out),'Focused evidence directory already exists; never overwrite evidence');
fs.mkdirSync(out,{recursive:true});
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const app=path.join(task,'solution/app');
const allFiles=dir=>{const rows={};const walk=(d,p='')=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name),k=p+e.name;e.isDirectory()?walk(f,k+'/'):rows[k]=sha(f);}};walk(dir);return rows;};
const manifest={scope:'Focused golden/mutant browser proof inputs; no provider or full Oracle run',task_files:{},app_files:allFiles(app)};
for(const rel of ['tests/scored/functional/prompt.md','tests/scored/functional/judge.toml','tests/scored/polish/judge.toml','tests/scored/polish/prompt.md','tests/app_context.md'])manifest.task_files[rel]=sha(path.join(task,rel));
const toolRoot=path.join(root,'deliverables/colderwater-playground-devtools/hardening-2026-09-26/build-tools/node_modules');
assert.equal(JSON.parse(fs.readFileSync(path.join(toolRoot,'vite/package.json'))).version,'7.1.7');
const variants=[
  {name:'save-conflict-loses-metadata',anchor:"log('error', [error.message]); setStatus('Save failed — your draft is kept');\n      if (error.data?.code === 'REVISION_CONFLICT') setConflict({ current: error.data.current, message: error.message });",replacement:"log('error', [error.message]); setStatus('Save failed — your source is kept');\n      if (error.data?.code === 'REVISION_CONFLICT') { setTitle(record?.title ?? ''); setFilename(record?.filename ?? ''); setConflict({ current: error.data.current, message: error.message }); }",occurrence:1},
  {name:'export-mouse-only',anchor:"h('button', { onClick: exportFile }, 'Export file')",replacement:"h('div', { onClick: exportFile }, 'Export file')",occurrence:1},
];
manifest.variants=[];
for(const spec of variants){
  const dest=path.join(out,'variants',spec.name,'app');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(app,dest,{recursive:true});
  const target=path.join(dest,'src/app.tsx');let source=fs.readFileSync(target,'utf8');
  assert.equal(source.split(spec.anchor).length-1,spec.occurrence,spec.name+' mutation anchor drift');
  const before=sha(target);source=source.replace(spec.anchor,spec.replacement);fs.writeFileSync(target,source);const after=sha(target);
  const build=cp.spawnSync(process.execPath,[path.join(toolRoot,'vite/bin/vite.js'),'build'],{cwd:dest,encoding:'utf8'});
  fs.writeFileSync(path.join(out,'variants',spec.name,'build.log'),build.stdout+build.stderr);assert.equal(build.status,0,build.stderr);
  manifest.variants.push({name:spec.name,mutated_file:'src/app.tsx',before_sha256:before,after_sha256:after,build:{vite:'7.1.7',network:false,status:build.status},files:allFiles(dest)});
}
manifest.golden_unchanged=Object.entries(manifest.app_files).every(([rel,digest])=>sha(path.join(app,rel))===digest);
fs.writeFileSync(path.join(out,'input_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({golden_files:Object.keys(manifest.app_files).length,variants:manifest.variants.map(v=>v.name),golden_unchanged:manifest.golden_unchanged},null,2));
