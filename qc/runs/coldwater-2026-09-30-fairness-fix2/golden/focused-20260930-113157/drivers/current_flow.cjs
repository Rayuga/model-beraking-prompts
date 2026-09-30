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
   const delayed=await d.run("console.log('duration-run-start'); setTimeout(() => { document.body.innerHTML='<p>duration-run-finished</p>'; console.log('duration-run-finished'); }, 4000);",'duration.js');
   recordDuration(state,'success-delayed',await d.status(),delayed.observed_at_ms-delayed.action_at_ms);
   const observed=state.durations.at(-1);observed.fixture='top-level Run schedules 4000ms timer';observed.body=await d.body();observed.logs=await d.logs();
   observed.success_observed=observed.body.includes('duration-run-finished')&&observed.logs.includes('duration-run-start')&&observed.logs.includes('duration-run-finished');
  }
 }else if(id==='S02'){
  const code=inputs.scenarios.S02.protocol.split('\n').find(x=>x.startsWith('<!doctype html>')&&x.includes('css-timer-state'));assert(code);
  await d.run(code,'css-timer.html');await d.preview().getByRole('button',{name:'Queue timer'}).click();await waitLog('css-timer-fired-1');await d.completed();
  const good=await d.body();await d.enter('#css-timer-state { color: rgb(255, 0, 0); }','timer.css');
  await d.preview().getByRole('button',{name:'Queue timer'}).click();await waitLog('css-timer-start-2');await d.run();await p.waitForTimeout(5100);
  const after=await d.body(),logs=await d.logs();await d.run("document.body.innerHTML='<p>css-timer-recovered</p>';console.log('css-timer-recovered');",'recovery.js');
  say('css_pending_timer_cancelled',after===good&&!logs.includes('css-timer-fired-2')&&(await d.body())==='css-timer-recovered',{good,after,logs});
 }else if(id==='S24'){
  await require('./fairness_flow.cjs').runTitleRules(d,l,inputs,emit,state);
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
