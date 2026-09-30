from pathlib import Path
p=Path(__file__).parent/'drivers'
def edit(name,changes):
 s=(p/name).read_text(encoding='utf-8')
 for a,b in changes:
  assert a in s,(name,a[:80]);s=s.replace(a,b,1)
 (p/name).write_text(s,encoding='utf-8',newline='\n')

edit('runtime_flow.cjs',[
 ("const assert=require('node:assert/strict');","const assert=require('node:assert/strict');\nconst {recordDuration}=require('./repair_flow.cjs');"),
 ("const positive={clock:controlResult.clock", "recordDuration(state,'failed-delayed',controlResult.status,controlResult.elapsed_ms);\n    const positive={clock:controlResult.clock"),
 ("const feedback=await d.status();\n    await l.wait(p,Math.max(0,stop.action_at_ms", "const feedback=await d.status();recordDuration(state,'stopped',feedback,l.relative()-stop.action_at_ms);\n    await l.wait(p,Math.max(0,stop.action_at_ms"),
 ("&&JSON.stringify(before)===JSON.stringify(after)&&recovered", "&&after.title!=='cw-forbidden-title'&&before.storage===after.storage&&recovered"),
 ("const lastGood=await reuseGood('timeout-control');const loops=[];", """const controls=[];
    for(const [source,marker,value] of [
      ['let n=0; while(n<3) { n++; } console.log("finite-braced",n);','finite-braced',3],
      ['let n=0; while(n++<3); console.log("finite-unbraced",n);','finite-unbraced',4],
      ['Promise.resolve().then(() => { let n=0; while(n<3) { n++; } console.log("finite-promise",n); });','finite-promise',3]]) {
      await d.run(source,'finite.js'); const logs=await d.logs();controls.push({source,marker,value,logs,passed:new RegExp(marker+'\\\\s*'+value).test(logs)});
    }
    const lastGood=await good('timeout-control');const loops=[];"""),
 ("say('literal_loop_deadline',loops.every", "recordDuration(state,'timeout',loops[0].status,loops[0].elapsed_ms);\n    say('literal_loop_deadline',controls.every(x=>x.passed)&&loops.every"),
 ("{loops:loops.map(row=>", "{finite_controls:controls,loops:loops.map(row=>"),
 ("const failed=await failure(c.code,c.file,c.needle);\n    say(c.kind+'_error_message'", """const cases=[c];
    if(id==='S12')cases.push({kind:'timer',file:'delayed-error.html',code:"<!doctype html>\\n<html>\\n<body>\\n<p>html-async-failed-candidate</p>\\n<script>\\nsetTimeout(() => { throw new Error('html-async-error-marker'); }, 50);\\n</script>\\n</body>\\n</html>",needle:'html-async-error-marker',line:6,candidate:'html-async-failed-candidate'});
    if(id==='S13')cases.push(
      {kind:'promise',file:'plain-rejection.js',code:"document.body.innerHTML='<p>primitive-failed-candidate</p>';\\nPromise.reject('primitive-error-marker');",needle:'primitive-error-marker',line:2,candidate:'primitive-failed-candidate'},
      {kind:'promise',file:'html-rejection.html',code:"<!doctype html>\\n<html>\\n<body>\\n<p>html-promise-failed-candidate</p>\\n<script>\\nPromise.reject('html-promise-error-marker');\\n</script>\\n</body>\\n</html>",needle:'html-promise-error-marker',line:6,candidate:'html-promise-failed-candidate'});
    const results=[];
    for(const fixture of cases){const priorLogs=await d.logs(),observed=await failure(fixture.code,fixture.file,fixture.needle);const newLogs=observed.logs.slice(priorLogs.length);recordDuration(state,id+'-'+fixture.file,observed.status,observed.elapsed_ms);results.push({...fixture,...observed,newLogs});}
    const failed=results[0];
    say(c.kind+'_error_message'"""),
 ("failed.logs.includes(c.needle)&&!/^(Complete)/.test(failed.status),{logs:failed.logs,status:failed.status}", "results.every(x=>x.newLogs.includes(x.needle)&&!/^Complete/.test(x.status)),{results}"),
 ("new RegExp('line\\\\s+'+c.line+'(?:\\\\D|$)','i').test(failed.logs),{filename:c.file,entered_source:c.code,expected_line:c.line,logs:failed.logs}", "results.every(x=>new RegExp('line\\\\s+'+x.line+'(?:\\\\D|$)','i').test(x.newLogs)),{results}"),
 ("failed.body===lastGood.body&&!failed.body.includes(c.candidate)&&recovered,{prior_good:priorGood,last_good:lastGood,restored:failed.body,recovered}", "results.every(x=>x.body===lastGood.body&&!x.body.includes(x.candidate)),{prior_good:priorGood,last_good:lastGood,results});say(c.kind+'_error_recovery',recovered,{recovered,body:await d.body(),logs:await d.logs()}"),
])

edit('current_flow.cjs',[
 ("const assert=require('node:assert/strict');", "const assert=require('node:assert/strict');\nconst {recordDuration}=require('./repair_flow.cjs');"),
 ("await d.run(\"console.log('history-first');\",'history.js');const first=await d.logs();", "const clock=await d.run(\"console.log('history-first');\",'history.js');recordDuration(state,'success-short',await d.status(),clock.observed_at_ms-clock.action_at_ms);const first=await d.logs();"),
 ("   say('console_duration',/\\d.*ms/.test(status),{status});", "   state.initial_duration_status=status;"),
 ("await d.run(code,'css-timer.html');await d.preview().getByRole('button',{name:'Queue timer'}).click();await waitLog('css-timer-fired-1');await d.completed();", "await d.run(code,'css-timer.html');const timerStart=l.relative();await d.preview().getByRole('button',{name:'Queue timer'}).click();await waitLog('css-timer-fired-1');await d.completed();recordDuration(state,'success-delayed',await d.status(),l.relative()-timerStart);"),
 ("const create=async(title,filename,code)=>(await d.create({title,filename,code})).record;", "let createOperation;const create=async(title,filename,code)=>{const result=await d.create({title,filename,code});createOperation=result.operation;return result.record;};"),
 ("const lower=await create('qc title sibling'", """const newAttempts=[];
  for(const title of ['QC Title Sibling','  QC Title Sibling  ','','   ']){
   let response;
   if(title==='QC Title Sibling'){await d.newDraft();await d.title().fill(title);await d.enter(createOperation.body.code,createOperation.body.filename);response=await d.captureMutation('new_collision_ui',()=>p.getByRole('button',{name:'Save',exact:true}).click(),['POST']);}
   else response=await d.replay({...createOperation,body:{...createOperation.body,title}});
   newAttempts.push({title,refused:!response.ok,useful:!!response.data?.error,unchanged:JSON.stringify(await d.library())===JSON.stringify(before)});
  }
  const lower=await create('qc title sibling'"""),
 ("attempts.slice(0,2).every(x=>", "[...attempts.slice(0,2),...newAttempts.slice(0,2)].every(x=>"),
 ("{attempts:attempts.slice(0,2),recovered}", "{update_attempts:attempts.slice(0,2),create_attempts:newAttempts.slice(0,2),recovered}"),
 ("attempts.slice(2).every(x=>", "[...attempts.slice(2),...newAttempts.slice(2)].every(x=>"),
 ("{attempts:attempts.slice(2),recovered}", "{update_attempts:attempts.slice(2),create_attempts:newAttempts.slice(2),recovered}"),
])
edit('run_workflow.cjs',[
 ("if(id==='S02')await require('./current_flow.cjs').runCurrent(id,driver,ledger,callInputs,emit,state);", "if(id==='S02')await require('./current_flow.cjs').runCurrent(id,driver,ledger,callInputs,emit,state);\n        if(id==='S21')await require('./repair_flow.cjs').storageCanary(driver,ledger,emit,state);"),
 ("state.library_url=driver.libraryUrl;", "if(mode==='golden'&&phase==='post')require('./repair_flow.cjs').durationResults(state,emit);\n    state.library_url=driver.libraryUrl;"),
])
