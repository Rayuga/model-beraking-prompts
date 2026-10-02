const assert=require('node:assert/strict');
const {recordDuration}=require('./repair_flow.cjs');
async function runCurrent(id,d,l,inputs,emit,state){
 if(['S02','S36'].includes(id))return require('./lifecycle_flow.cjs').runLifecycle(id,d,l,inputs,emit,state);
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
 }else if(id==='S24'){
  await require('./fairness_flow.cjs').runTitleRules(d,l,inputs,emit,state);
 }else throw Error('Unsupported current scenario '+id);
}
module.exports={runCurrent};
