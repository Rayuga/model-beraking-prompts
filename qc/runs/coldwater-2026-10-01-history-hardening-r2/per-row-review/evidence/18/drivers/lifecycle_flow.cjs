'use strict';
// The real browser supplies separate facts. A failed product action is retained
// as evidence, and cannot throw across the next independently useful attempt.
const assert=require('node:assert/strict');
const {snapshot,attempt,successful,ordinary,currentGood}=require('./refusal_flow.cjs');
const {recordDuration}=require('./repair_flow.cjs');
const count=(text,marker)=>text.split(marker).length-1;
async function capture(fn){try{return{ok:true,value:await fn()};}catch(error){return{ok:false,error:String(error)};}}
async function runLifecycle(id,d,l,inputs,emit,state={}){
 const p=d.page,say=(key,pass,evidence)=>emit(id+'.'+key,Boolean(pass),evidence);
 const recover=async(marker,log=marker)=>{
  const row=await attempt(d,l,`document.body.innerHTML='<p>${marker}</p>';console.log('${log}');`,'recovery.js');
  currentGood(state,row,marker,log);return {passed:successful(row,marker,log),observation:row};
 };
 const waitLog=async(marker,baseline=0)=>capture(()=>p.waitForFunction(({marker,baseline})=>(document.querySelector('[role="log"]')?.textContent.split(marker).length??1)-1>baseline,{marker,baseline},{timeout:8500}));
 const start=async(code,file,marker)=>{
  const before=await snapshot(d),clock=l.relative(),action=await capture(()=>d.run(code,file,false));
  const marker_observation=action.ok?await waitLog(marker,count(before.logs,marker)):{ok:false,reason:'Run action failed'};
  return {before,action,marker_observation,action_at_ms:action.value?.action_at_ms??clock,after:await snapshot(d)};
 };
 if(id==='S02'){
  const source=inputs.scenarios.S02.protocol.split('\n').find(x=>x.startsWith('<!doctype html>')&&x.includes('css-timer-state'));assert(source);
  const initial=await attempt(d,l,source,'css-timer.html');
  const firstClick=await capture(()=>d.preview().getByRole('button',{name:'Queue timer'}).click());
  const firstMarker=await waitLog('css-timer-fired-1');const completed=await capture(()=>d.completed());const good=await snapshot(d);
  const control=firstClick.ok&&firstMarker.ok&&completed.ok&&good.body?.includes('css-timer-fired-1');
  const edit=await capture(()=>d.enter('#css-timer-state { color: rgb(255, 0, 0); }','timer.css'));
  const secondClick=await capture(()=>d.preview().getByRole('button',{name:'Queue timer'}).click());const secondMarker=await waitLog('css-timer-start-2');
  const pending=await snapshot(d),run=await capture(()=>d.run(undefined,undefined,false));
  await l.wait(p,5100,'Observe pending CSS replacement through original timer and watchdog window');const after=await snapshot(d);
  const observedPending=control&&edit.ok&&secondClick.ok&&secondMarker.ok&&/running|waiting/i.test(pending.status);
  say('css_pending_timer_cancelled',observedPending&&run.ok&&!after.logs.includes('css-timer-fired-2')&&!after.body?.includes('css-timer-fired-2'),{initial,matching_timer_control:{firstClick,firstMarker,completed,good},pending,run,after});
  say('css_pending_preview',observedPending&&run.ok&&after.body===good.body&&after.body?.includes('Queue timer'),{good,pending,after});
  const recovery=await recover('css-timer-recovered');say('css_timer_recovery',recovery.passed,recovery);
 }else if(id==='S04'){
  let prior=null;
  if(state.runtimeLastGood&&(await snapshot(d)).body===state.runtimeLastGood.body)prior={reused_actual_control:state.runtimeLastGood,body:state.runtimeLastGood.body};
  else{const r=await ordinary(d,l,'cancel-good');prior={observation:r,body:r.after.body,control:successful(r,'cancel-good','cancel-good-log')};}
  const aSource="window.__cancelLeak='A';document.body.innerHTML='<p id=\"run-A\">candidate-A</p>';console.log('cancel-A-started');setTimeout(()=>{document.body.innerHTML='<p>cancel-A-late-dom</p>';console.log('cancel-A-delayed');throw new Error('cancel-A-error');},4000);";
  const positive=await attempt(d,l,aSource,'cancel-a.js');recordDuration(state,'failed-delayed',positive.after.status,positive.elapsed_ms);
  const working=!positive.action_error&&!positive.wait_error&&positive.new_logs?.includes('cancel-A-delayed')&&positive.new_logs?.includes('cancel-A-error')&&/error/i.test(positive.after.status);
  const renewed=await ordinary(d,l,'cancel-good');
  const a=await start(aSource,'cancel-a.js','cancel-A-started');
  const b=await attempt(d,l,"document.body.innerHTML='<p id=\"run-B\">run-B-'+typeof window.__cancelLeak+'</p>';console.log('cancel-B-started');",'cancel-b.js');
  await l.wait(p,Math.max(0,a.action_at_ms+6200-l.relative()),'Observe superseded timer after original callback deadline');const after=await snapshot(d);
  say('supersede_pending',working&&a.marker_observation.ok&&/running|waiting/i.test(a.after.status)&&b.elapsed_ms<4000&&count(after.logs,'cancel-A-delayed')===count(a.before.logs,'cancel-A-delayed')&&count(after.logs,'cancel-A-error')===count(a.before.logs,'cancel-A-error')&&after.body?.includes('run-B-')&&!after.body?.includes('cancel-A-late-dom')&&/^Complete/.test(after.status),{prior,positive,renewed,a,b,after});
  if(state.round3FreshJS)emit('S02.js_fresh_document',Boolean(state.round3FreshJS.passed&&b.after.body?.includes('run-B-undefined')&&b.new_logs?.includes('cancel-B-started')&&a.marker_observation.ok),{first_fresh_JS:state.round3FreshJS,a,b,cancellation_verdict_not_inherited:true});
  let stopLastGood=b,stopControl=successful(b,'run-B-','cancel-B-started'),fallback=null;
  if(!stopControl){fallback=await ordinary(d,l,'stop-independent-good');stopLastGood=fallback;stopControl=successful(fallback,'stop-independent-good','stop-independent-good-log');}
  const stop=await start("console.log('stop-started');document.body.innerHTML='<p>stop-candidate</p>';setTimeout(()=>{document.body.innerHTML='<p>stop-late-dom</p>';console.log('stop-delayed');throw new Error('stop-error');},4000);",'stop.js','stop-started');
  const stopped=await capture(()=>l.action('stop','Stop active timer run',()=>p.getByRole('button',{name:'Stop',exact:true}).click()));const feedback=await d.status();recordDuration(state,'stopped',feedback,l.relative()-stop.action_at_ms);
  await l.wait(p,Math.max(0,stop.action_at_ms+4300-l.relative()),'Observe stopped timer beyond due time');const restored=await snapshot(d);
  say('stop_pending_execution',working&&stop.marker_observation.ok&&/running|waiting/i.test(stop.after.status)&&stopped.ok&&/stop|cancel/i.test(feedback)&&count(restored.logs,'stop-delayed')===count(stop.before.logs,'stop-delayed')&&count(restored.logs,'stop-error')===count(stop.before.logs,'stop-error')&&!restored.body?.includes('stop-late-dom'),{positive,stop,stopped,feedback,restored});
  say('stop_pending_rollback',stopControl&&restored.body===stopLastGood.after.body,{last_good:stopLastGood,fallback,restored});
  const recovery=await recover('stop-recovered');say('pending_stop_recovery',recovery.passed,recovery);
 }else if(id==='S05'){
  const control=await ordinary(d,l,'isolation-control'),before=await p.evaluate(()=>({title:document.title,storage:localStorage.getItem('cw-isolation-probe')}));
  const source="let docRead='not-blocked',docWrite='not-blocked',storageRead='not-blocked',storageWrite='not-blocked';try{const value=parent.document.title;}catch(error){docRead='blocked';}try{parent.document.title='cw-forbidden-title';}catch(error){docWrite='blocked';}try{const value=parent.localStorage.getItem('cw-isolation-probe');}catch(error){storageRead='blocked';}try{parent.localStorage.setItem('cw-isolation-probe','changed');}catch(error){storageWrite='blocked';}document.body.innerHTML='<p>isolation-'+docRead+'-'+docWrite+'-'+storageRead+'-'+storageWrite+'</p>';console.log('isolation-results',docRead,docWrite,storageRead,storageWrite);";
  const result=await attempt(d,l,source,'isolation.js'),after=await p.evaluate(()=>({title:document.title,storage:localStorage.getItem('cw-isolation-probe')}));
  say('preview_origin_boundary',successful(control,'isolation-control','isolation-control-log')&&result.after.body?.includes('isolation-blocked-blocked-blocked-blocked')&&result.new_logs?.includes('isolation-results')&&after.title!=='cw-forbidden-title'&&before.storage===after.storage,{control,before,after,result});
  const recovery=await recover('isolation-recovered');say('origin_boundary_recovery',recovery.passed,recovery);
 }else if(id==='S09'){
  const controls=[];for(const[source,marker,value]of [['let n=0;while(n<3){n++;}console.log("finite-braced",n);','finite-braced',3],['let n=0;while(n++<3);console.log("finite-unbraced",n);','finite-unbraced',4],['Promise.resolve().then(()=>{let n=0;while(n<3){n++;}console.log("finite-promise",n);});','finite-promise',3]]){
   const row=await attempt(d,l,source,'finite.js');controls.push({...row,marker,value,working:!row.action_error&&!row.wait_error&&/^Complete/.test(row.after.status)&&new RegExp(marker+'\\s*'+value).test(row.new_logs??'')});
  }
  const good=await ordinary(d,l,'timeout-control'),loops=[];
  for(const[marker,loop]of [['before-braced-hang','while(true){}'],['before-unbraced-hang','while(true);'],['before-promise-hang',"Promise.resolve().then(()=>{console.log('promise-loop-entered');while(true){}});"]])loops.push({marker,...await attempt(d,l,`console.log('${marker}');${loop}`,'timeout.js')});
  recordDuration(state,'timeout',loops[0].after.status,loops[0].elapsed_ms);
  say('literal_loop_deadline',controls.every(x=>x.working)&&loops.every(x=>!x.action_error&&!x.wait_error&&x.elapsed_ms<8000&&/time limit/i.test(x.after.status+' '+x.new_logs)&&x.new_logs?.includes(x.marker)),{controls,loops});
  say('literal_loop_rollback',successful(good,'timeout-control','timeout-control-log')&&loops.every(x=>!x.action_error&&!x.wait_error&&/time limit/i.test(x.after.status+' '+x.new_logs)&&x.new_logs?.includes(x.marker)&&x.after.body===good.after.body),{good,loops});
  const recovery=await recover('timeout-recovered');say('literal_loop_recovery',recovery.passed,recovery);
 }else if(id==='S36'){
  const control=await attempt(d,l,"document.body.innerHTML='<p>nested-control-ready</p>';setTimeout(()=>{console.log('nested-control-entered');setTimeout(()=>{document.body.innerHTML='<p>nested-control-done</p>';console.log('nested-control-done');},200);},200);",'nested.js');
  const pending=await start("document.body.innerHTML='<p>failed-loop-candidate</p>';setTimeout(()=>{console.log('late-callback-entered');setTimeout(()=>{document.body.innerHTML='<p>forbidden-nested-completion</p>';console.log('forbidden-nested-completion');},3000);},3000);",'nested.js','late-callback-entered');
  await l.wait(p,Math.max(0,pending.action_at_ms+10000-l.relative()),'Batched nested-callback observation through both delays');const after=await snapshot(d),newLogs=after.logs.slice(pending.before.logs.length);
  say('callback_shared_run_deadline',successful(control,'nested-control-done','nested-control-done')&&pending.marker_observation.ok&&newLogs.includes('late-callback-entered')&&!newLogs.includes('forbidden-nested-completion')&&/time limit/i.test(newLogs+' '+after.status),{control,pending,after,new_logs:newLogs});
  say('callback_timeout_rollback',successful(control,'nested-control-done','nested-control-done')&&after.body===control.after.body,{control,after});
  const recovery=await recover('shared-deadline-recovered','shared-deadline-recovered-log');say('callback_deadline_recovery',recovery.passed,recovery);
 }else throw Error('Unknown lifecycle '+id);
}
module.exports={runLifecycle,capture};
