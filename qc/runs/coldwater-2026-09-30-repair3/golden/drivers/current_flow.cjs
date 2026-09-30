const assert=require('node:assert/strict');
const {recordDuration}=require('./repair_flow.cjs');
async function runCurrent(id,d,l,inputs,emit,state){
 const p=d.page,say=(key,passed,evidence)=>emit(id+'.'+key,passed,evidence);
 const waitLog=text=>p.waitForFunction(text=>document.querySelector('[role=log]')?.textContent.includes(text),text,{timeout:8500});
 if(id==='S16'){
  if(inputs.stage==='history'){
   const clock=await d.run("console.log('history-first');",'history.js');recordDuration(state,'success-short',await d.status(),clock.observed_at_ms-clock.action_at_ms);const first=await d.logs();
   await d.run("document.body.innerHTML='<p>theme-shared-preview</p>';console.log('history-second');",'history.js');
   const second=await d.logs(),status=await d.status();
   say('console_history',first.includes('history-first')&&second.indexOf('history-first')<second.indexOf('history-second'),{first,second});
   state.initial_duration_status=status;
  }else{
   const before=await d.logs();await p.getByRole('button',{name:/Clear console/}).click();
   say('console_clear_control',before.includes('history-second')&&!/history-(first|second)/.test(await d.logs()),{before,after:await d.logs()});
  }
 }else if(id==='S02'){
  const code=inputs.scenarios.S02.protocol.split('\n').find(x=>x.startsWith('<!doctype html>')&&x.includes('css-timer-state'));assert(code);
  await d.run(code,'css-timer.html');const timerStart=l.relative();await d.preview().getByRole('button',{name:'Queue timer'}).click();await waitLog('css-timer-fired-1');await d.completed();recordDuration(state,'success-delayed',await d.status(),l.relative()-timerStart);
  const good=await d.body();await d.enter('#css-timer-state { color: rgb(255, 0, 0); }','timer.css');
  await d.preview().getByRole('button',{name:'Queue timer'}).click();await waitLog('css-timer-start-2');await d.run();await p.waitForTimeout(5100);
  const after=await d.body(),logs=await d.logs();await d.run("document.body.innerHTML='<p>css-timer-recovered</p>';console.log('css-timer-recovered');",'recovery.js');
  say('css_pending_timer_cancelled',after===good&&!logs.includes('css-timer-fired-2')&&(await d.body())==='css-timer-recovered',{good,after,logs});
 }else if(id==='S24'){
  let createOperation;const create=async(title,filename,code)=>{const result=await d.create({title,filename,code});createOperation=result.operation;return result.record;};
  const source=await create('  QC Title Source  ','title-a.js',"console.log('title-a');"),sibling=await create('QC Title Sibling','title-b.js',"console.log('title-b');");
  await d.load(source);await d.title().fill('  QC Title Updated  ');const update=await d.save(),current=update.record;
  say('title_trimming',source.title==='QC Title Source'&&current.title==='QC Title Updated'&&source.id===current.id,{source,current});
  const before=await d.library(),attempts=[];
  for(const title of ['QC Title Sibling','  QC Title Sibling  ','','   ']){
   let response;
   if(title==='QC Title Sibling'){
    await d.title().fill(title);response=await d.captureMutation('collision_ui',()=>p.getByRole('button',{name:'Save',exact:true}).click(),['PUT']);
   }else response=await d.replay({...update.operation,body:{...update.operation.body,...current,title}});
   attempts.push({title,refused:!response.ok,useful:!!response.data?.error,unchanged:JSON.stringify(await d.library())===JSON.stringify(before)});
  }
  const newAttempts=[];
  for(const title of ['QC Title Sibling','  QC Title Sibling  ','','   ']){
   let response;
   if(title==='QC Title Sibling'){await d.newDraft();await d.title().fill(title);await d.enter(createOperation.body.code,createOperation.body.filename);response=await d.captureMutation('new_collision_ui',()=>p.getByRole('button',{name:'Save',exact:true}).click(),['POST']);}
   else response=await d.replay({...createOperation,body:{...createOperation.body,title}});
   newAttempts.push({title,refused:!response.ok,useful:!!response.data?.error,unchanged:JSON.stringify(await d.library())===JSON.stringify(before)});
  }
  const lower=await create('qc title sibling','case.js',"console.log('case');");await d.load(sibling);await d.load(lower);
  await d.load(current);await d.title().fill('QC Title Recovered');const recovered=(await d.save()).record;
  say('title_collision_refusal',[...attempts.slice(0,2),...newAttempts.slice(0,2)].every(x=>x.refused&&x.useful&&x.unchanged)&&recovered.id===current.id,{update_attempts:attempts.slice(0,2),create_attempts:newAttempts.slice(0,2),recovered});
  say('title_empty_rejected',[...attempts.slice(2),...newAttempts.slice(2)].every(x=>x.refused&&x.useful&&x.unchanged)&&recovered.id===current.id,{update_attempts:attempts.slice(2),create_attempts:newAttempts.slice(2),recovered});
  const records=await d.library();say('title_case_sensitive',lower.id!==sibling.id&&records.some(x=>x.id===sibling.id&&x.title===sibling.title)&&records.some(x=>x.id===lower.id&&x.title===lower.title),{sibling,lower});
 }else if(id==='S36'){
  await d.run("document.body.innerHTML='<p>nested-control-ready</p>';setTimeout(() => { console.log('nested-control-entered'); setTimeout(() => { document.body.innerHTML='<p>nested-control-done</p>'; console.log('nested-control-done'); }, 200); }, 200);",'nested.js');
  const good=await d.body();assert.equal(good,'nested-control-done');assert((await d.logs()).includes('nested-control-done'));
  await d.run("document.body.innerHTML='<p>failed-loop-candidate</p>';setTimeout(() => { console.log('late-callback-entered'); setTimeout(() => { document.body.innerHTML='<p>forbidden-nested-completion</p>'; console.log('forbidden-nested-completion'); }, 3000); }, 3000);",'nested.js',false);
  await p.waitForTimeout(10000);const logs=await d.logs(),body=await d.body();
  await d.run("document.body.innerHTML='<p>shared-deadline-recovered</p>';console.log('shared-deadline-recovered-log');",'recovery.js');
  say('callback_shared_run_deadline',logs.includes('late-callback-entered')&&!logs.includes('forbidden-nested-completion')&&/time limit/i.test(logs)&&(await d.body())==='shared-deadline-recovered',{good,body,logs,recovered:await d.body()});
  say('callback_timeout_rollback',body===good,{good,body});
 }else throw Error('Unsupported current scenario '+id);
}
module.exports={runCurrent};
