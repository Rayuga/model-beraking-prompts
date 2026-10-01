'use strict';
// Scenario implementation shared by the complete golden and focused witnesses.
// Decisions use UI output and ordinary app-origin requests, never app internals.
const assert=require('node:assert/strict');
const markers=['click','key','input'];
const counts=logs=>Object.fromEntries(markers.map(key=>[key,logs.split('completed-interaction-'+key).length-1]));

async function runCompletedStop(d,l,inputs,emit,state={}){
  const p=d.page,protocol=inputs.scenarios.S03.protocol;
  let source=protocol.split('\n').find(line=>line.startsWith('<!doctype html>')&&line.includes('completed-interaction-ready')),filename='interaction.html';
  assert(source,'Frozen S03 fixture absent');
  const say=(key,pass,evidence)=>emit('S03.'+key,Boolean(pass),evidence);
  const attempt=async(label,fn)=>{try{return {ok:true,value:await fn()};}catch(error){return {ok:false,error:String(error),status:await d.status()};}};
  const button=()=>d.preview().getByRole('button',{name:'Try later action',exact:true});
  const input=()=>d.preview().getByRole('textbox',{name:'Later interaction input',exact:true});
  const sample=async()=>({counts:counts(await d.logs()),status:await d.status(),at_ms:l.relative()});
  const actionControl=async(kind,action,required)=>{
    const before=await sample();
    const actionResult=await attempt(kind,()=>l.action('preview_'+kind,kind,action));
    // These authored handlers are synchronous. A bounded wait permits rendering
    // latency, and a missing marker remains an observation rather than aborting
    // the separately credited Stop trial.
    const observed=await attempt(kind+' marker',()=>p.waitForFunction(({before,required})=>{
      const logs=document.querySelector('[role="log"]')?.textContent||'';
      return required.every(key=>logs.split('completed-interaction-'+key).length-1>before[key]);
    },{before:before.counts,required},{timeout:1800}));
    const complete=observed.ok?await attempt(kind+' completion',()=>d.completed()):{ok:false,reason:'No working handler observed'};
    const after=await sample();
    return {passed:actionResult.ok&&observed.ok&&complete.ok,before,after,action:actionResult,completion:complete,marker_observation:observed};
  };
  const establish=async()=>{
    const prior=(await d.logs()).split('completed-interaction-ready-log').length;
    await d.run(source,filename,false);
    await p.waitForFunction(()=>/^(Complete|Error|Execution stopped)/.test(document.querySelector('[role="status"]')?.textContent||''),null,{timeout:10000});
    const body=await d.body(),logs=await d.logs();
    assert(/^Complete/.test(await d.status())&&body.includes('completed-interaction-ready')&&logs.split('completed-interaction-ready-log').length>prior);
    return {body,filename,status:await d.status(),completed_ms:l.relative()};
  };
  const htmlInitial=await attempt('initial HTML fixture',establish);let initial=htmlInitial;
  if(!initial.ok){
    const lines=protocol.split('\n'),start=lines.findIndex(line=>line.startsWith("document.body.innerHTML = '<p>completed-interaction-ready</p>"));
    assert(start>=0,'Frozen S03 equivalent JS fixture absent');source=lines.slice(start,start+5).join('\n');filename='interaction.js';
    initial=await attempt('equivalent JS fixture after failed HTML setup',establish);
  }
  let click=null,typing=null,focus=null,clickWait=null,keyWait=null;
  if(initial.ok){
    await l.wait(p,6100,'Completed preview untouched beyond initial budget');clickWait=l.relative()-initial.value.completed_ms;
    click=await actionControl('delayed_click',()=>button().click(),['click']);
    focus=await attempt('focus input',async()=>{await input().click();return l.relative();});
    if(focus.ok){
      await l.wait(p,6100,'Focused input untouched beyond prior interaction budget');keyWait=l.relative()-focus.value;
      typing=await actionControl('delayed_type',()=>input().press('a'),['key','input']);
    }
  }
  const later=Boolean(initial.ok&&click?.passed&&typing?.passed&&clickWait>=6000&&keyWait>=6000);
  say('later_interactions',later,{html_initial:htmlInitial,initial,click,focus,typing,wait_before_click_ms:clickWait,wait_before_key_ms:keyWait,dispatch_verdict_not_inherited:true});

  // Reuse only a currently live, observed completed handler. A failed delayed
  // click can leave an inert rollback document, so old marker counts do not
  // establish this positive control.
  let control=typing?.passed?{passed:true,origin:'just-observed delayed typing on current completed preview',observation:typing}:null;
  if(!control&&initial.ok){
    const current=await actionControl('immediate_current_click',()=>button().click(),['click']);
    control={passed:current.passed,origin:'immediate current-preview click',observation:current};
  }
  if(!control)control={passed:false,origin:'Neither initial fixture established a completed preview'};
  if(!control.passed&&initial.ok){
    const fresh=await attempt('fresh same fixture',()=>d.run(source,filename));
    const immediate=fresh.ok?await actionControl('immediate_fresh_click',()=>button().click(),['click']):null;
    control={passed:Boolean(immediate?.passed),origin:'fresh same fixture Run and immediate click',fresh,observation:immediate};
  }
  const completedPicture=await d.body();
  const completedValues=await d.preview().locator('input').evaluateAll(nodes=>nodes.map(node=>node.value));
  const before=await sample();
  const stopped=await attempt('Stop completed preview',()=>l.action('stop','Stop promptly after live completed handler control',()=>p.getByRole('button',{name:'Stop',exact:true}).click()));
  const feedback=await d.status(),attempted={button:false,input:false},actionErrors=[];
  const retainedPicture=await d.body();
  const retainedValues=await d.preview().locator('input').evaluateAll(nodes=>nodes.map(node=>node.value));
  say('completed_stop_preview',stopped.ok&&/^Complete/.test(before.status)&&completedPicture.includes('completed-interaction-ready')&&retainedPicture===completedPicture&&JSON.stringify(retainedValues)===JSON.stringify(completedValues),
    {before:completedPicture,after:retainedPicture,before_values:completedValues,after_values:retainedValues,before_status:before.status,stopped,cancellation_and_recovery_verdicts_not_inherited:true});
  for(const [key,locator,act]of [['button',button,loc=>loc.click()],['input',input,loc=>loc.press('b')]]){
    try{const loc=locator();if(await loc.count()&&await loc.isVisible()&&await loc.isEnabled()){await act(loc);attempted[key]=true;}}
    catch(error){actionErrors.push({key,error:String(error)});}
  }
  await l.wait(p,200,'Observe stopped handler markers after ordinary attempted actions');
  const after=await sample();
  say('completed_stop',control.passed&&stopped.ok&&JSON.stringify(before.counts)===JSON.stringify(after.counts)&&/stop|cancel/i.test(feedback)&&actionErrors.length===0,
    {matching_live_handler_control:control,before,after,feedback,stopped,attempted,action_errors:actionErrors,delayed_verdict_not_inherited:true});
  const recoverySource=protocol.match(/```javascript\n([\s\S]*?)\n```/)[1];
  assert.equal(recoverySource.split('\n').length,6,'Six entered-source lines required');
  const recovery=await attempt('fresh Run after Stop',async()=>{
    await d.run(recoverySource,'recovery.js');
    const body=await d.body(),logs=await d.logs();assert(body.includes('completed-stop-recovered')&&logs.includes('completed-stop-recovered-log'));
    state.runtimeLastGood={body,marker:'completed-stop-recovered',log_marker:'completed-stop-recovered-log'};
    return {body,logs,status:await d.status()};
  });
  say('completed_stop_recovery',recovery.ok,{recovery,stop_verdict_not_inherited:true});
  const committed=await attempt('successful later picture action',async()=>{
    await d.preview().getByRole('button',{name:'Commit picture',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('[role="log"]')?.textContent.includes('interaction-commit-log'));
    await d.completed();
    const body=await d.body();assert(body.includes('interaction-latest-good'));
    return {body,logs:await d.logs(),status:await d.status()};
  });
  const lastGood=committed.ok?committed.value:recovery.ok?recovery.value:null;
  await l.wait(p,6100,'Completed preview idle before later failing action');
  const beforeFailure=await d.logs();
  const failedAction=await attempt('later button throws entered-source error',async()=>{
    await d.preview().getByRole('button',{name:'Fail later action',exact:true}).click();
    await p.waitForFunction(()=>/error/i.test(document.querySelector('[role="status"]')?.textContent||''),null,{timeout:8500});
    return {body:await d.body(),new_logs:(await d.logs()).slice(beforeFailure.length),status:await d.status()};
  });
  say('completed_error_message',failedAction.ok&&failedAction.value.new_logs.includes('late-interaction-failure'),{failed_action:failedAction,committed,recovery});
  say('completed_error_line',failedAction.ok&&/line\s+5\b/i.test(failedAction.value.new_logs),{failed_action:failedAction,source:recoverySource});
  say('completed_error_rollback',Boolean(lastGood)&&failedAction.ok&&failedAction.value.body===lastGood.body&&!failedAction.value.body.includes('failed-partial-picture'),{last_good:lastGood,failed_action:failedAction});
  if(lastGood&&failedAction.ok&&failedAction.value.body===lastGood.body)state.runtimeLastGood={body:lastGood.body,marker:committed.ok?'interaction-latest-good':'completed-stop-recovered',log_marker:committed.ok?'interaction-commit-log':'completed-stop-recovered-log'};
}

async function runTitleRules(d,l,inputs,emit,state={}){
  const p=d.page,say=(key,pass,evidence)=>emit('S24.'+key,Boolean(pass),evidence),writes=[];
  const attempt=async(label,fn)=>{
    try{const value=await fn();const result={label,ok:true,...value};writes.push(result);return result;}
    catch(error){const result={label,ok:false,error:String(error),visible_status:await d.status()};writes.push(result);return result;}
  };
  const create=(label,title,filename,code)=>attempt(label,()=>d.create({title,filename,code}));
  const paddedCreate=await create('padded source create','  QC Title Source  ','title-a.js',"console.log('title-a');");
  const source=paddedCreate.ok?paddedCreate:await create('ordinary source create fallback','QC Title Source Control','title-a.js',"console.log('title-a');");
  const sibling=await create('independent sibling create','QC Title Sibling','title-b.js',"console.log('title-b');");
  let paddedUpdate={ok:false,reason:'No successful Source identity'},update=paddedUpdate;
  if(source.ok){
    paddedUpdate=await attempt('padded Source update',async()=>{await d.load(source.record);await d.title().fill('  QC Title Updated  ');return d.save();});
    update=paddedUpdate.ok?paddedUpdate:await attempt('ordinary Source update fallback',async()=>{
      const current=(await d.library()).find(row=>row.id===source.record.id);assert(current,'Source identity unavailable in fresh library read');
      await d.load(current);await d.title().fill('QC Title Updated Control');return d.save();
    });
  }
  say('title_trimming',paddedCreate.ok&&paddedUpdate.ok&&paddedCreate.record.title==='QC Title Source'&&paddedUpdate.record.title==='QC Title Updated'&&paddedCreate.record.id===paddedUpdate.record.id,
    {padded_create:paddedCreate,padded_update:paddedUpdate,fallbacks:writes.filter(row=>row.label.includes('fallback')),fallback_does_not_replace_trimming_result:true});

  const createControl=source.ok?source:sibling.ok?sibling:null,attempts=[],newAttempts=[];
  const shapeCurrent=(operation,current)=>({...operation,body:Object.fromEntries(Object.entries(operation.body).map(([key,value])=>[key,Object.hasOwn(current,key)?current[key]:value]))});
  // Refresh before every probe. A faulty previous write must not turn a later
  // title test into an accidental stale-revision test.
  if(update.ok&&sibling.ok&&createControl){
    for(const title of ['QC Title Sibling','  QC Title Sibling  ','','   ']){
      const before=await d.library(),current=before.find(row=>row.id===update.record.id);
      const observation={title,current_revision:current?.revision,before};
      try{
        assert(current,'Source missing after preceding attempted write');let response;
        const operation=shapeCurrent(update.operation,current);operation.body.title=title;
        if(title==='QC Title Sibling'){
          await d.load(current);await d.title().fill(title);
          try{response=await d.captureMutation('collision_ui',()=>p.getByRole('button',{name:'Save',exact:true}).click(),['PUT']);}
          catch(error){observation.ui_request_absent=String(error);response=await d.replay(operation);}
        }else response=await d.replay(operation);
        const after=await d.library();Object.assign(observation,{response,after,refused:!response.ok,useful:Boolean(response.data?.error),unchanged:JSON.stringify(before)===JSON.stringify(after)});
      }catch(error){observation.error=String(error);}
      attempts.push(observation);
    }
    for(const title of ['QC Title Sibling','  QC Title Sibling  ','','   ']){
      const before=await d.library(),observation={title,before};
      try{
        const operation={...createControl.operation,body:{...createControl.operation.body,title}};let response;
        if(title==='QC Title Sibling'){
          await d.newDraft();await d.title().fill(title);await d.enter(operation.body.code,operation.body.filename);
          try{response=await d.captureMutation('new_collision_ui',()=>p.getByRole('button',{name:'Save',exact:true}).click(),['POST']);}
          catch(error){observation.ui_request_absent=String(error);response=await d.replay(operation);}
        }else response=await d.replay(operation);
        const after=await d.library();Object.assign(observation,{response,after,refused:!response.ok,useful:Boolean(response.data?.error),unchanged:JSON.stringify(before)===JSON.stringify(after)});
      }catch(error){observation.error=String(error);}
      newAttempts.push(observation);
    }
  }
  // A broken Source writer must not prevent independent case-sensitive creation.
  const lower=await create('independent lowercase sibling create','qc title sibling','case.js',"console.log('case');");
  const caseReadback=await attempt('independent case-sensitive readback',async()=>{
    assert(sibling.ok&&lower.ok,'Both successful case-distinct identities required');
    await d.load(sibling.record);await d.load(lower.record);const records=await d.library();
    assert(lower.record.id!==sibling.record.id&&records.some(row=>row.id===sibling.record.id&&row.title===sibling.record.title)&&records.some(row=>row.id===lower.record.id&&row.title===lower.record.title));
    return {records};
  });
  const passes=rows=>rows.length===4&&rows.every(row=>row.refused&&row.useful&&row.unchanged);
  const controls={successful_create:createControl,successful_update:update,valid_write_controls_observed:Boolean(createControl&&update.ok)};
  say('title_collision_refusal',controls.valid_write_controls_observed&&passes([...attempts.slice(0,2),...newAttempts.slice(0,2)]),{...controls,update_attempts:attempts.slice(0,2),create_attempts:newAttempts.slice(0,2),trimming_verdict_not_inherited:true});
  say('title_empty_rejected',controls.valid_write_controls_observed&&passes([...attempts.slice(2),...newAttempts.slice(2)]),{...controls,update_attempts:attempts.slice(2),create_attempts:newAttempts.slice(2),trimming_verdict_not_inherited:true});
  say('title_case_sensitive',caseReadback.ok,{sibling,lower,readback:caseReadback});
  const recovery=await attempt('ordinary Source recovery update',async()=>{
    assert(source.ok,'No Source identity exists for later recovery');
    const before=await d.library(),current=before.find(row=>row.id===source.record.id);assert(current);
    await d.load(current);await d.title().fill('QC Title Recovered');const result=await d.save(),after=await d.library();
    assert(result.record.id===current.id&&result.record.revision>current.revision);
    assert(JSON.stringify(before.filter(row=>row.id!==current.id))===JSON.stringify(after.filter(row=>row.id!==current.id)),'Recovery changed a sibling');
    assert(after.some(row=>row.id===result.record.id&&row.title==='QC Title Recovered'&&row.revision===result.record.revision));
    return {...result,before,after};
  });
  say('title_refusal_recovery',recovery.ok,{recovery,earlier_verdicts_not_inherited:true});
}

module.exports={runCompletedStop,runTitleRules};
