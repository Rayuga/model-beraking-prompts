'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {digest}=require('./workflow_core.cjs');
const {mutateConflictClears}=require('./stale_editor_proofs.cjs');
const root=path.resolve(__dirname,'../../../../..');
assert(process.argv[2]==='--freeze','Use only after parent source freeze');
const manifestPath=path.resolve(__dirname,'..',process.argv[3]||'frozen_inputs.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));assert(manifest.freeze_confirmed);
const app=path.join(root,process.argv[4]||'projects/colderwater-playground-devtools','solution/app');
const variantsDir=path.resolve(__dirname,'../variants');assert(!fs.existsSync(variantsDir),'Never overwrite prior evidence');
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'Mutation anchor is not unique: '+a);return s.replace(a,b);};
const baseline=Object.fromEntries(Object.keys(manifest.solution_files).filter(key=>key.startsWith('app/')).map(key=>[key.slice(4),digest(fs.readFileSync(path.join(app,key.slice(4))))]));
for(const[rel,hash]of Object.entries(baseline))assert.equal(hash,manifest.solution_files['app/'+rel]);
function cssLeaks(s){
  assert.equal(digest(s),'d2fc0471003dd6a2107918be7a2d69f3a96027ec4c56266e6dd9b035a30efd86');
  s=replace(s,"  send('started');",`  // Disposable mutant: CSS keeps the old live realm, including globals/timers/handlers.
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.token !== token || event.data?.kind !== 'cw-proof-css-live') return;
    if (failed) return;
    settled = false; started = now(); deadline = started + 4900;
    const style = document.createElement('style');style.textContent = event.data.code;document.head.append(style);
    send('started'); snapshot(); settleSoon();
  });
  send('started');`);
  return replace(s,'  run(code, filename) {',`  run(code, filename) {
    if (language(filename) === 'css' && this.token && this.frame?.contentWindow) {
      this.clearTimer(); this.started = performance.now(); this.active = true;
      this.rollback = this.lastGood; this.candidate = this.lastGood;
      this.onStatus('Running CSS...', null); this.watchdog();
      this.frame.contentWindow.postMessage({ token: this.token, kind: 'cw-proof-css-live', code }, '*');return;
    }`);
}
function jsOnly(s){assert.equal(digest(s),'03917011ec2c4aa602ce6390a0427a32d8ff74567fc585a625fc709e583f1838');return replace(s,"if (!language(file.name)) { log('error', ['Import a .js, .html or .css file.']); return; }","if (language(file.name) !== 'js') { log('error', ['Import a .js file.']); return; }");}
const report={manifest_sha256:digest(fs.readFileSync(manifestPath)),runtime_executed:false,variants:[]};
for(const[name,rel,transform]of [['css-live-context-leaks','src/runtime.ts',cssLeaks],['conflict-ui-clears','src/app.tsx',mutateConflictClears],['js-only-importer','src/app.tsx',jsOnly]]){
  const dest=path.join(variantsDir,name,'app');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(app,dest,{recursive:true});
  const original=fs.readFileSync(path.join(dest,rel),'utf8'),changed=transform(original);fs.writeFileSync(path.join(dest,rel),changed);
  const toolRoot=path.join(root,'deliverables/colderwater-playground-devtools/hardening-2026-09-26/build-tools/node_modules');assert.equal(JSON.parse(fs.readFileSync(path.join(toolRoot,'vite/package.json'))).version,'7.1.7');
  const build=cp.spawnSync(process.execPath,[path.join(toolRoot,'vite/bin/vite.js'),'build'],{cwd:dest,encoding:'utf8'});fs.writeFileSync(path.join(variantsDir,name,'build.log'),build.stdout+build.stderr);assert.equal(build.status,0,build.stderr);
  const files={};const scan=(dir,prefix='')=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,ent.name),key=prefix+ent.name;if(ent.isDirectory())scan(full,key+'/');else files[key]=digest(fs.readFileSync(full));}};scan(dest);
  report.variants.push({name,mutated_file:rel,before_sha256:digest(original),after_sha256:digest(changed),build:{vite:'7.1.7',network:false,status:build.status},app_files:files});
}
for(const[rel,hash]of Object.entries(baseline))assert.equal(digest(fs.readFileSync(path.join(app,rel))),hash,'Task source changed');
fs.writeFileSync(path.join(variantsDir,'variant_binding.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.variants.map(({name,mutated_file,before_sha256,after_sha256})=>({name,mutated_file,before_sha256,after_sha256})),null,2));
