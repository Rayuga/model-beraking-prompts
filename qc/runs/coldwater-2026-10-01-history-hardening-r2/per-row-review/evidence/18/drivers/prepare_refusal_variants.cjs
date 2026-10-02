'use strict';
// Build disposable app copies only after the parent freezes the repaired rubric.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {digest}=require('./workflow_core.cjs');
const definitions=[
  {name:'unsupported-drop-preview',scenario:'S08',preview:false,recovery:true,kind:'unsupported',defect:'preview'},
  {name:'unsupported-no-recovery',scenario:'S08',preview:true,recovery:false,kind:'unsupported',defect:'recovery'},
  {name:'unsupported-harmless-refused',scenario:'S08',preview:true,recovery:true,kind:'harmless',defect:'harmless'},
  {name:'network-early-control',scenario:'S07',preview:true,recovery:true,kind:'network',defect:null},
  {name:'network-drop-preview',scenario:'S07',preview:false,recovery:true,kind:'network',defect:'preview'},
  {name:'network-no-recovery',scenario:'S07',preview:true,recovery:false,kind:'network',defect:'recovery'},
];
function once(source,anchor,replacement){assert.equal(source.split(anchor).length,2,'Mutation anchor must occur once: '+anchor);return source.replace(anchor,replacement);}
function transform(source,definition){
  const runStart='  run(code, filename) {',build='    try { this.html = buildRun(code, filename, this.token); }';
  const catchStart="    catch (error) { this.active = false; this.token = ''; this.restore();";
  const unsupportedPattern='/Dynamic evaluation, imports, WebAssembly and workers|Content Security Policy|worker-src|shared workers.*denied/i';
  const unsupported=unsupportedPattern+'.test(String(error.message))';
  const network="/Disposable network access refused/.test(String(error.message))";
  if(definition.kind==='harmless')return once(source,build,"    try { if (/\\b(eval|Function|WebAssembly|Worker|import)\\b/.test(code)) throw new Error('Unsupported execution refused by disposable blanket word filter.'); this.html = buildRun(code, filename, this.token); }");
  if(definition.kind==='network')source=once(source,build,"    try { if (/\\bfetch\\s*\\(|new\\s+Image\\s*\\(/.test(code)) throw new Error('Disposable network access refused.'); this.html = buildRun(code, filename, this.token); }");
  const match=definition.kind==='network'?network:unsupported;
  if(definition.defect==='preview'){
    source=once(source,catchStart,`    catch (error) { this.active = false; this.token = ''; if (${match}) this.lastGood = emptyDocument; this.restore();`);
    if(definition.kind==='unsupported')source=once(source,"this.lastGood = this.rollback; this.lastGoodForms = this.rollbackForms; this.restore(); this.onEntry('error'",`this.lastGood = ${unsupportedPattern}.test(String(data.message)) ? emptyDocument : this.rollback; this.restore(); this.onEntry('error'`);
  }
  if(definition.defect==='recovery'){
    source=once(source,catchStart,`    catch (error) { this.active = false; this.token = ''; if (${match}) this.__proofRefusalLatch = true; this.restore();`);
    if(definition.kind==='unsupported'){
      // Lexical-name support moves actual forbidden execution into the real
      // runtime error/CSP path. Model a publication latch left closed after
      // refusal: later attempted execution still reaches genuine restrictions,
      // but successful output/completion cannot be published. No fixture text,
      // probe counter or assertion outcome controls this mutation.
      source=once(source,"if (data.kind === 'error') {",`if (data.kind === 'error') { if (${unsupportedPattern}.test(String(data.message))) this.__proofRefusalLatch = true;`);
      source=once(source,"if (data.kind === 'console') {", "if (data.kind === 'console') { if (this.__proofRefusalLatch) return;");
      source=once(source,"if (data.kind === 'complete') { this.clearTimer();", "if (data.kind === 'complete') { if (this.__proofRefusalLatch) { this.clearTimer(); this.active=false; this.token=''; this.restore(); this.onEntry('error',['Disposable completed execution cannot be published after refusal']); this.onStatus('Error: completed execution unavailable',performance.now()-this.started); return; } this.clearTimer();");
    }else{
      // The network variant retains its explicit early policy rejection path.
      const frame="    this.frame?.remove(); this.frame = document.createElement('iframe'); this.frame.title = 'Live preview'; this.frame.sandbox = 'allow-scripts';\n    const runnerURL";
      source=once(source,frame,"    if (this.__proofRefusalLatch) { this.active = false; this.token = ''; this.onEntry('error', ['Disposable executor remains unavailable after refusal.']); this.onStatus('Error: ordinary execution unavailable', performance.now() - this.started); return; }\n"+frame);
    }
  }
  assert(source.includes(runStart));return source;
}
function files(dir){const out={};function scan(at,prefix=''){for(const entry of fs.readdirSync(at,{withFileTypes:true})){const full=path.join(at,entry.name),rel=prefix+entry.name;if(entry.isDirectory())scan(full,rel+'/');else out[rel]=digest(fs.readFileSync(full));}}scan(dir);return out;}
function main(){
  assert.equal(process.argv[2],'--freeze','Explicit --freeze after parent authorization required');
  const evidence=path.resolve(process.argv[3]||''),owner=path.resolve(__dirname,'..');
  const root=path.resolve(__dirname,'../../../..');
  assert(evidence.startsWith(owner+path.sep)||evidence===path.join(root,'qc/runs/coldwater-2026-10-01-css-fresh/golden'),'Use owned repair evidence or authorized new run golden folder');
  const manifestPath=path.join(evidence,'frozen_repair_inputs.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
  assert(manifest.freeze_confirmed&&manifest.criteria.length===75,'Expected repaired frozen 75-row candidate');
  const app=path.resolve(root,manifest.frozen_task,'solution/app');
  assert(app.startsWith(root+path.sep));
  const output=path.join(evidence,'refusal-variants');assert(!fs.existsSync(output),'Never overwrite evidence');
  const original=files(app);for(const[rel,hash]of Object.entries(original))assert.equal(hash,manifest.solution_files['app/'+rel],'Frozen app drift: '+rel);
  const toolRoot=path.join(root,'deliverables/colderwater-playground-devtools/hardening-2026-09-26/build-tools/node_modules');
  assert.equal(JSON.parse(fs.readFileSync(path.join(toolRoot,'vite/package.json'))).version,'7.1.7');
  const report={round_input_sha256:manifest.round_input_sha256,manifest_sha256:digest(fs.readFileSync(manifestPath)),provider_or_platform:false,runtime_executed:false,variants:[]};
  fs.mkdirSync(output);
  for(const definition of definitions){
    const dest=path.join(output,definition.name,'app');fs.mkdirSync(path.dirname(dest));fs.cpSync(app,dest,{recursive:true});
    const file=path.join(dest,'src/runtime.ts'),source=fs.readFileSync(file,'utf8'),changed=transform(source,definition);fs.writeFileSync(file,changed);
    const build=cp.spawnSync(process.execPath,[path.join(toolRoot,'vite/bin/vite.js'),'build'],{cwd:dest,encoding:'utf8'});
    fs.writeFileSync(path.join(output,definition.name,'build.log'),(build.stdout||'')+(build.stderr||''));assert.equal(build.status,0,build.stderr);
    report.variants.push({...definition,mutated_file:'src/runtime.ts',before_sha256:digest(source),after_sha256:digest(changed),build:{vite:'7.1.7',network:false,returncode:build.status},app_files:files(dest)});
  }
  assert.deepEqual(files(app),original,'Frozen app bytes changed');
  fs.writeFileSync(path.join(output,'variant_binding.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({output,variants:report.variants.length,runtime_executed:false}));
}
if(require.main===module)main();
module.exports={definitions,transform};
