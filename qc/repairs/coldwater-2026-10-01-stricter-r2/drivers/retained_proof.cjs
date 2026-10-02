const fs=require('node:fs'),assert=require('node:assert/strict');
async function runRetained(d,l,emit,dir){
 const inputs=JSON.parse(fs.readFileSync(dir+'/proof-inputs.json')),state={},p=d.page;
 const attempt=async(id,fn)=>l.observe({id},fn);
 const runtime=require('./runtime_flow.cjs').runRuntimeScenario,workspace=require('./workspace_flow.cjs').runWorkspaceScenario;
 for(const id of ['S14','S15','S19'])await attempt(id,()=>workspace(id,d,l,inputs,emit,state));
 for(const stage of ['history','clear'])await attempt('S16.'+stage,()=>require('./current_flow.cjs').runCurrent('S16',d,l,{...inputs,stage},emit,state));
 for(const id of ['S21','S23'])await attempt(id,()=>require('./library_flow.cjs').runLibraryScenario(id,d,l,inputs,emit,state));
 await attempt('S21.canary',()=>require('./repair_flow.cjs').storageCanary(d,l,emit,state));
 await attempt('S02',async()=>{
  const source="document.body.innerHTML = '<p id=\"dispatch-mark\">js-dispatch-ok</p>';\nconsole.log('js-dispatch-log');\nconst scriptText = '</script><script>not executable</script>';\nconst dataNode = document.createElement('pre'); dataNode.textContent = scriptText; document.body.append(dataNode);";
  await d.run(source,'dispatch.js');const js={body:await d.body(),logs:await d.logs()};
  await d.run(inputs.scenarios.S02.protocol.split('\n').find(x=>x.startsWith('<!doctype html>')),'dispatch.html');const html={body:await d.body(),logs:await d.logs()};
  emit('S02.js_html_filename_dispatch',js.body.includes('</script><script>not executable</script>')&&js.logs.includes('js-dispatch-log')&&html.body.includes('html-dispatch-ok')&&html.logs.includes('html-dispatch-log'),{js,html});
  await d.run("document.body.innerHTML='<p>fresh-'+typeof window.oldGlobal+'</p>';console.log('fresh-js-log');",'dispatch.js');
  state.round3FreshJS={body:await d.body(),logs:await d.logs(),passed:(await d.body()).includes('fresh-undefined')};
 });
 for(const id of ['S03','S04','S08','S09','S10','S11','S12','S13','S05'])await attempt(id,()=>runtime(id,d,l,inputs,emit,state));
 await attempt('S36',()=>require('./lifecycle_flow.cjs').runLifecycle('S36',d,l,inputs,emit,state));
 await attempt('S07',()=>require('./boundary_flow.cjs').runBoundaryScenario('S07',d,l,inputs,emit,state));
 await attempt('S17',()=>workspace('S17',d,l,inputs,emit,state));
 const auto=p.getByRole('checkbox',{name:'Auto-run',exact:true});
 const src=marker=>`document.body.innerHTML='<p>${marker}</p>';console.log('${marker}');`;
 await attempt('S17.manual_consumes_queue',async()=>{await auto.check();await d.enter(src('manual-queue-proof'),'auto.js');await d.run();await l.wait(p,3100,'Observe through the cancelled debounce');const logs=await d.logs();assert.equal(logs.split('manual-queue-proof').length-1,1);emit('S17.manual_consumes_queue',true,{logs});});
 await attempt('S17.document_switch_cancels_queue',async()=>{
  const saved=(await d.create({title:'Queue Target',filename:'queue-target.js',code:src('must-not-load-run')})).record;
  await auto.check();await d.enter(src('must-not-new-run'),'auto.js');await d.newDraft();await l.wait(p,3100,'Observe queued edit cancelled by New');assert(!(await d.logs()).includes('must-not-new-run'));
  await d.enter(src('after-new-edit'),'auto.js');await l.wait(p,1000,'Positive automatic run after New');assert((await d.logs()).includes('after-new-edit'));
  await d.enter(src('must-not-old-run'),'auto.js');await d.load(saved);await l.wait(p,3100,'Observe queued edit cancelled by load');const logs=await d.logs();assert(!logs.includes('must-not-old-run'));assert(!logs.includes('must-not-load-run'));
  await d.enter(src('after-load-edit'),'auto.js');await l.wait(p,1000,'Positive automatic run after load');assert((await d.logs()).includes('after-load-edit'));emit('S17.document_switch_cancels_queue',true,{logs:await d.logs()});await auto.uncheck();
 });
 await attempt('S03.completed_error',async()=>{
  const source=inputs.scenarios.S03.protocol.match(/```javascript\n([\s\S]*?)\n```/)[1];await d.run(source,'recovery.js');await d.preview().getByRole('button',{name:'Commit picture',exact:true}).click();await d.completed();const before=await d.body();await l.wait(p,6100,'Delayed handler failure');await d.preview().getByRole('button',{name:'Fail later action',exact:true}).click();await p.getByRole('status').filter({hasText:/Error/}).waitFor();const logs=await d.logs();emit('S03.completed_error_message',logs.includes('late-interaction-failure'),{logs});emit('S03.completed_error_line',/late-interaction-failure.*line 5/.test(logs),{logs});emit('S03.completed_error_rollback',await d.body()===before,{before,after:await d.body()});
 });
 await attempt('S04.pending_html_supersession',async()=>{
  await d.run("console.log('html-old-start');setTimeout(()=>{console.log('html-old-late');throw Error('html-old-error');},4000);",'old.js',false);await p.getByRole('log').filter({hasText:'html-old-start'}).waitFor();await d.run('<html><body><p>replacement-html-current</p></body></html>','replacement.html');await l.wait(p,6100,'Observe old timer after HTML replacement');const logs=await d.logs(),body=await d.body();emit('S04.pending_html_supersession',!logs.includes('html-old-late')&&!logs.includes('html-old-error')&&body.includes('replacement-html-current'),{logs,body,positive_control:'S04 uncancelled callback above'});
 });
 require('./repair_flow.cjs').durationResults(state,emit);
}
module.exports={runRetained};
