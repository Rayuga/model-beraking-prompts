'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {digest}=require('./workflow_core.cjs');
const definitions=[
 ...[['completed-stop','S03'],['pending-stop','S04'],['origin','S05'],['loop','S09'],['callback','S36']].flatMap(([family,scenario])=>[
  {name:family+'-no-recovery',family,scenario,defect:'recovery'},
  {name:family+'-earlier-failure',family,scenario,defect:'earlier'},
  ...(['completed-stop','pending-stop','loop','callback'].includes(family)?[{name:family+'-drop-preview',family,scenario,defect:'preview'}]:[])]),
 {name:'supersession-b-fails',family:'supersession',scenario:'S04',defect:'earlier'},
 {name:'stale-no-reapply',family:'stale',scenario:'S23',defect:'recovery'},
 {name:'stale-drop-draft',family:'stale',scenario:'S23',defect:'preview'},
 {name:'stale-accepted',family:'stale',scenario:'S23',defect:'earlier'},
 {name:'title-no-recovery',family:'title',scenario:'S24',defect:'recovery'},
 {name:'title-empty-accepted',family:'title',scenario:'S24',defect:'earlier'}
];
function once(s,a,b){assert.equal(s.split(a).length,2,'Unique mutation anchor: '+a);return s.replace(a,b);}
function mutate(source,def,file){
 const {family,defect}=def;
 if(file==='src/runtime.ts'){
  if(['stale','title'].includes(family))return source;
  const run='  run(code, filename) {',stop="  stop(reason = 'Run cancelled', level = 'info') {",error="if (data.kind === 'error') {",build='    try { this.html = buildRun(code, filename, this.token); }';
  if(defect==='recovery'){
   let trigger='';
   if(family==='css')trigger="    if (this.active && language(filename) === 'css') this.__proofBlockNext = true;\n";
   if(family==='origin')trigger="    if (/\\bparent\\.(document|localStorage)/.test(code)) this.__proofBlockNext = true;\n";
   const allowLoop=family==='loop'?" && !/while\\s*\\(\\s*true\\s*\\)/.test(code)":'';
   source=once(source,run,run+"\n    if (this.__proofBlockNext"+allowLoop+") { this.onEntry('error',['Disposable subsequent executor unavailable']); this.onStatus('Error: ordinary execution unavailable',0); return; }\n"+trigger);
   if(['completed-stop','pending-stop'].includes(family))source=once(source,stop,stop+"\n    if (reason === 'Run cancelled') this.__proofBlockNext = true;");
   if(['loop','callback'].includes(family)){
    source=once(source,stop,stop+"\n    if (/time limit/.test(reason)) this.__proofBlockNext = true;");
    source=once(source,error,error+" if (/time limit/.test(data.message)) this.__proofBlockNext = true;");
   }
  }else if(defect==='preview'){
   if(family==='completed-stop')source=once(source,stop,stop+"\n    if (!this.active && reason==='Run cancelled') { this.lastGood=emptyDocument; this.lastGoodForms=[]; }");
   if(family==='css')source=once(source,run,run+"\n    if (this.active && language(filename)==='css') this.lastGood = emptyDocument;");
   if(family==='pending-stop')source=once(source,'    if (this.active) { this.lastGood = this.rollback; this.lastGoodForms = this.rollbackForms; }',"    if (this.active) { this.lastGood = emptyDocument; this.lastGoodForms = []; }");
   if(['loop','callback'].includes(family)){
    source=once(source,'    if (this.active) { this.lastGood = this.rollback; this.lastGoodForms = this.rollbackForms; }',"    if (this.active) { this.lastGood = /time limit/.test(reason) ? emptyDocument : this.rollback; this.lastGoodForms = /time limit/.test(reason) ? [] : this.rollbackForms; }");
    source=once(source,'this.lastGood = this.rollback; this.lastGoodForms = this.rollbackForms; this.restore(); this.onEntry(\'error\'',"this.lastGood = /time limit/.test(data.message) ? emptyDocument : this.rollback; this.restore(); this.onEntry('error'");
   }
  }else{
   if(family==='css')source=once(source,run,run+"\n    if (this.active && language(filename)==='css') return;");
   if(['completed-stop','pending-stop'].includes(family))source=once(source,stop,stop+"\n    if (reason==='Run cancelled') return;");
   if(family==='origin')source=once(source,build,"    try { if (/\\bparent\\.(document|localStorage)/.test(code)) throw new Error('Disposable execution unavailable for parent-access source'); this.html = buildRun(code,filename,this.token); }");
   if(family==='supersession')source=once(source,build,"    try { if (/typeof\\s+window\\./.test(code)) throw new Error('Disposable global-inspection expression unavailable'); this.html = buildRun(code,filename,this.token); }");
   if(family==='loop')source=once(source,build,"    try { if (/while\\s*\\(\\s*true\\s*\\)/.test(code)) throw new Error('Disposable loop execution unavailable'); this.html=buildRun(code,filename,this.token); }");
   if(family==='callback')source=source.replaceAll('started + 4900','started + 8900').replace("'error'), 5100)","'error'), 9100)");
  }
 }else if(file==='src/App.tsx'&&family==='stale'&&defect==='preview'){
  const anchor="      if (error.data?.code === 'REVISION_CONFLICT') setConflict({ current: error.data.current, message: error.message });";
  assert.equal(source.split(anchor).length,3);source=source.replace(anchor,"      if (error.data?.code === 'REVISION_CONFLICT') { openRecord(error.data.current,true); setConflict({ current: error.data.current, message: error.message }); }");
 }else if(file==='server.js'){
  if(family==='stale'&&defect==='recovery'){
   source=once(source,'function matchingRevision(body, current) {','let proofRecoveryRejectedId = null;\nfunction matchingRevision(body, current) {');
   source=once(source,'  if (body.revision !== current.revision) {','  if (body.revision === current.revision && proofRecoveryRejectedId === current.id) { proofRecoveryRejectedId=null; throw problem("Disposable first current write after conflict rejected",409); }\n  if (body.revision !== current.revision) {\n    proofRecoveryRejectedId=current.id;');
  }
  if(family==='stale'&&defect==='earlier')source=once(source,'  if (body.revision !== current.revision) {','  if (false) {');
  if(family==='title'&&defect==='earlier')source=once(source,'  if (!title || title.length > 120)','  if (title.length > 120)');
  if(family==='title'&&defect==='recovery'){
   source=once(source,'function problem(message, status = 400, code = \'INVALID_SNIPPET\', current) {',"let proofInvalidWriteSeen = false;\nfunction problem(message, status = 400, code = 'INVALID_SNIPPET', current) {\n  if (code === 'TITLE_CONFLICT' || /title of/.test(message)) proofInvalidWriteSeen=true;");
   source=once(source,'    uniqueTitle(value.title, current.id);','    uniqueTitle(value.title, current.id);\n    if (proofInvalidWriteSeen) { proofInvalidWriteSeen=false; throw problem("Disposable first valid update after invalid title rejected",409); }');
  }
 }
 return source;
}
function files(dir){const out={};function scan(at,prefix=''){for(const e of fs.readdirSync(at,{withFileTypes:true})){const f=path.join(at,e.name),rel=prefix+e.name;if(e.isDirectory())scan(f,rel+'/');else out[rel]=digest(fs.readFileSync(f));}}scan(dir);return out;}
function main(){
 assert.equal(process.argv[2],'--freeze');const root=path.resolve(__dirname,'../../../..'),evidence=path.resolve(process.argv[3]),manifestPath=path.join(evidence,'frozen_repair_inputs.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
 assert(manifest.freeze_confirmed&&manifest.criteria.length===74);assert(evidence.startsWith(path.join(root,'qc')+path.sep));
 const app=path.resolve(root,manifest.frozen_task,'solution/app'),out=path.join(evidence,'lifecycle-variants');assert(!fs.existsSync(out));
 const original=files(app);for(const[rel,hash]of Object.entries(original))assert.equal(hash,manifest.solution_files['app/'+rel]);
 const toolRoot=path.join(root,'deliverables/colderwater-playground-devtools/hardening-2026-09-26/build-tools/node_modules');assert.equal(JSON.parse(fs.readFileSync(path.join(toolRoot,'vite/package.json'))).version,'7.1.7');
 const report={round_input_sha256:manifest.round_input_sha256,manifest_sha256:digest(fs.readFileSync(manifestPath)),provider_or_platform:false,runtime_executed:false,variants:[]};fs.mkdirSync(out);
 const selected=process.argv[4]==='--runtime-only'?definitions.filter(def=>!['stale','title'].includes(def.family)):definitions;
 assert(!process.argv[4]||process.argv[4]==='--runtime-only','Unknown variant subset');
 for(const def of selected){
  const dest=path.join(out,def.name,'app');fs.mkdirSync(path.dirname(dest));fs.cpSync(app,dest,{recursive:true});const mutations=[];
  for(const rel of ['src/runtime.ts','src/App.tsx','server.js']){const f=path.join(dest,rel),before=fs.readFileSync(f,'utf8'),after=mutate(before,def,rel);if(before!==after){fs.writeFileSync(f,after);mutations.push({file:rel,before_sha256:digest(before),after_sha256:digest(after)});}}
  assert(mutations.length,'Mutation absent: '+def.name);let build=null;
  if(mutations.some(x=>x.file.startsWith('src/'))){build=cp.spawnSync(process.execPath,[path.join(toolRoot,'vite/bin/vite.js'),'build'],{cwd:dest,encoding:'utf8'});fs.writeFileSync(path.join(out,def.name,'build.log'),(build.stdout||'')+(build.stderr||''));assert.equal(build.status,0,build.stderr);}
  report.variants.push({...def,mutations,build:{vite:'7.1.7',network:false,returncode:build?.status??null},app_files:files(dest)});
 }
 assert.deepEqual(files(app),original);fs.writeFileSync(path.join(out,'variant_binding.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,variants:report.variants.length,runtime_executed:false}));
}
if(require.main===module)main();module.exports={definitions,mutate};
