'use strict';
const assert=require('node:assert/strict');
const {recordDuration}=require('./repair_flow.cjs');
const count=(text,marker)=>text.split(marker).length-1;

async function runRuntimeScenario(id,d,l,inputs,emit,state={}){
  if(['S04','S05','S09'].includes(id))return require('./lifecycle_flow.cjs').runLifecycle(id,d,l,inputs,emit,state);
  const p=d.page,protocol=inputs.scenarios[id].protocol;
  const say=(key,pass,evidence)=>emit(id+'.'+key,Boolean(pass),evidence);
  const good=async(marker,logMarker=marker)=>{const source=marker==='latest-good-B'?inputs.scenarios.S10.protocol.match(/```javascript\n([\s\S]*?)\n```/)[1]:`document.body.innerHTML='<p>${marker}</p>';console.log('${logMarker}');`;await d.run(source,'proof.js');const body=await d.body(),logs=await d.logs();assert(body.includes(marker)&&logs.includes(logMarker));const observed={body,marker,log_marker:logMarker};if(marker==='latest-good-B'){const note=d.preview().getByRole('textbox',{name:'Preview note'});await note.fill('user-edited-preview-741');await d.completed();observed.preview_note=await note.inputValue();observed.preview_note_visible=await note.isVisible();assert.equal(observed.preview_note,'user-edited-preview-741');assert(observed.preview_note_visible,'Completed Preview note must be visible');await d.preview().getByRole('button',{name:'Paint picture',exact:true}).click();await d.completed();observed.canvas_pixel=await d.preview().locator('#saved-picture').evaluate(c=>[...c.getContext('2d').getImageData(50,30,1,1).data]);assert.deepEqual(observed.canvas_pixel,[224,36,36,255]);}state.runtimeLastGood=observed;return observed;};
  const reuseGood=async(marker,logMarker=marker)=>{if(state.runtimeLastGood&&await d.body()===state.runtimeLastGood.body)return state.runtimeLastGood;return good(marker,logMarker);};
  const logUntil=async needle=>p.waitForFunction(needle=>document.querySelector('[role="log"]')?.textContent.includes(needle),needle,{timeout:8500});
  const failure=async(code,file,marker)=>{
    const clock=await d.run(code,file,false);if(marker)await logUntil(marker);
    await p.waitForFunction(()=>/error|time limit|unsupported|refused|outside/i.test(document.querySelector('[role="status"]')?.textContent??''),null,{timeout:8500});
    const note=d.preview().getByRole('textbox',{name:'Preview note'}),hasNote=await note.count();return{clock,elapsed_ms:l.relative()-clock.action_at_ms,logs:await d.logs(),body:await d.body(),status:await d.status(),preview_note:hasNote?await note.inputValue():null,preview_note_visible:hasNote?await note.isVisible():false,canvas_pixel:await d.preview().locator('#saved-picture').count()?await d.preview().locator('#saved-picture').evaluate(c=>[...c.getContext('2d').getImageData(50,30,1,1).data]):null};
  };
  const recovery=async(marker,logMarker=marker)=>{await good(marker,logMarker);return true;};
  const firstHTML=()=>{const line=protocol.split('\n').find(line=>line.startsWith('<!doctype html>'));assert(line,'Exact HTML fixture missing');return line;};
  const completeHTML=()=>{const matches=[...protocol.matchAll(/^<!doctype html>[\s\S]*?<\/html>/gim)];assert.equal(matches.length,1,'Expected one complete exact frozen HTML fixture');return matches[0][0];};

  if(id==='S02'){
    await d.run("document.body.innerHTML = '<p id=\"dispatch-mark\">js-dispatch-ok</p>';\nconsole.log('js-dispatch-log');",'dispatch.JS');
    const js={body:await d.body(),logs:await d.logs()};
    await d.run(firstHTML(),'dispatch.HTML');const html={body:await d.body(),logs:await d.logs()};
    await d.run('body { color: rgb(255, 0, 0); background-color: rgb(1, 2, 3); }','dispatch.CSS');
    const css={body:await d.body(),styles:await d.preview().locator('body').evaluate(e=>({color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}))};
    say('js_html_filename_dispatch',js.body.includes('js-dispatch-ok')&&js.logs.includes('js-dispatch-log')&&html.body.includes('html-dispatch-ok')&&!html.body.includes('js-dispatch-ok'),{js,html});
    say('css_builtin_preview',Boolean(css.body.trim())&&!/js-dispatch-ok|html-dispatch-ok/.test(css.body)&&css.styles.color==='rgb(255, 0, 0)'&&css.styles.background==='rgb(1, 2, 3)',css);
    say('extension_case',js.body.includes('js-dispatch-ok')&&html.body.includes('html-dispatch-ok')&&css.styles.color==='rgb(255, 0, 0)',{filenames:['dispatch.JS','dispatch.HTML','dispatch.CSS'],actual_outputs:[js.body,html.body,css.styles]});
    await d.run("document.body.innerHTML = '<p id=\"fresh-js\">fresh-' + typeof window.oldGlobal + '</p>';\nconsole.log('fresh-js-log');",'dispatch.js');
    const fresh=await d.body();state.round3FreshJS={body:fresh,logs:await d.logs(),passed:fresh.includes('fresh-undefined')&&!fresh.includes('html-dispatch-ok')&&(await d.logs()).includes('fresh-js-log')};say('js_fresh_document',fresh.includes('fresh-undefined')&&!fresh.includes('html-dispatch-ok'),{body:fresh});
  }else if(id==='S03'){
    await require('./fairness_flow.cjs').runCompletedStop(d,l,inputs,emit,state);
  }else if(id==='S08'){
    await require('./refusal_flow.cjs').runRefusalScenario(d,l,inputs,emit,state);
  }else if(['S10','S11','S12','S13'].includes(id)){
    const configs={
      S10:{kind:'js',file:'bad.js',code:"document.body.innerHTML='<p>failed-partial-dom</p>';\nconst marker = 1;\nconst items = [1, 2, 3];\nitems.forEeach((n) => n);",needle:'forEeach',line:4,candidate:'failed-partial-dom'},
      S11:{kind:'html',file:'bad.html',code:id==='S11'?completeHTML():null,needle:'undefinedFunctionCall',line:6,candidate:'Failed HTML candidate'},
      S12:{kind:'timer',file:'delayed-error.js',code:"document.body.innerHTML='<p>async-failed-candidate</p>';\nsetTimeout(() => { throw new Error('async-error-marker'); }, 50);",needle:'async-error-marker',line:2,candidate:'async-failed-candidate'},
      S13:{kind:'promise',file:'rejected-promise.js',code:"document.body.innerHTML='<p>promise-failed-candidate</p>';\nPromise.reject(new Error('promise-error-marker'));",needle:'promise-error-marker',line:2,candidate:'promise-failed-candidate'}
    },c=configs[id];let priorGood=null,lastGood=null;const setupErrors=[];
    try{priorGood=await reuseGood(c.kind+'-good-preview',c.kind+'-good-log');}catch(error){setupErrors.push({stage:'successful A',error:String(error)});}
    if(id==='S10'){try{lastGood=await good('latest-good-B','latest-good-B-completed');}catch(error){setupErrors.push({stage:'successful B',error:String(error)});}}
    else lastGood=priorGood;
    const cases=[c];
    if(id==='S12')cases.push({kind:'timer',file:'delayed-error.html',code:"<!doctype html>\n<html>\n<body>\n<p>html-async-failed-candidate</p>\n<script>\nsetTimeout(() => { throw new Error('html-async-error-marker'); }, 50);\n</script>\n</body>\n</html>",needle:'html-async-error-marker',line:6,candidate:'html-async-failed-candidate'});
    if(id==='S13')cases.push(
      {kind:'promise',file:'plain-rejection.js',code:"document.body.innerHTML='<p>primitive-failed-candidate</p>';\nPromise.reject('primitive-error-marker');",needle:'primitive-error-marker',line:2,candidate:'primitive-failed-candidate'},
      {kind:'promise',file:'html-rejection.html',code:"<!doctype html>\n<html>\n<body>\n<p>html-promise-failed-candidate</p>\n<script>\nPromise.reject('html-promise-error-marker');\n</script>\n</body>\n</html>",needle:'html-promise-error-marker',line:6,candidate:'html-promise-failed-candidate'});
    const results=[];
    for(const fixture of cases){const priorLogs=await d.logs(),observed=await failure(fixture.code,fixture.file,fixture.needle);const newLogs=observed.logs.slice(priorLogs.length);recordDuration(state,id+'-'+fixture.file,observed.status,observed.elapsed_ms);results.push({...fixture,...observed,newLogs});}
    const failed=results[0];
    say(c.kind+'_error_message',results.every(x=>x.newLogs.includes(x.needle)&&!/^Complete/.test(x.status)),{results});
    say(c.kind+'_error_line',results.every(x=>new RegExp('line\\s+'+x.line+'(?:\\D|$)','i').test(x.newLogs)),{results});
    say(c.kind+'_error_rollback',setupErrors.length===0&&Boolean(lastGood)&&results.every(x=>x.body===lastGood.body&&!x.body.includes(x.candidate)&&(id!=='S10'||x.preview_note===lastGood.preview_note&&x.preview_note_visible&&JSON.stringify(x.canvas_pixel)===JSON.stringify(lastGood.canvas_pixel))),{prior_good:priorGood,last_good:lastGood,setup_errors:setupErrors,results});
    let recovered=false,recoveryError=null,recoveryBody=null,recoveryLogs=null;
    try{recovered=await recovery(c.kind+'-error-recovered');recoveryBody=await d.body();recoveryLogs=await d.logs();}catch(error){recoveryError=String(error);}
    say(c.kind+'_error_recovery',recovered&&!recoveryError,{recovered,body:recoveryBody,logs:recoveryLogs,error:recoveryError});
  }else if(id==='S36'){
    const lastGood=await reuseGood('recovery-marker-Q7','recovery-marker-Q7-log');
    const timed=await failure("document.body.innerHTML='<p>failed-loop-candidate</p>';\nsetTimeout(() => { console.log('late-callback-entered'); while (true) {} }, 4000);",'shared-deadline.js','late-callback-entered');const recovered=await recovery('shared-deadline-recovered','shared-deadline-recovered-log');
    say('callback_shared_run_deadline',timed.elapsed_ms<8000&&/time limit/i.test(timed.status+' '+timed.logs)&&timed.logs.includes('late-callback-entered'),{elapsed_ms:timed.elapsed_ms,status:timed.status,callback_delay_ms:4000});
    say('callback_timeout_rollback',timed.body===lastGood.body&&!timed.body.includes('failed-loop-candidate')&&recovered,{last_good:lastGood,restored:timed.body,recovered});
  }else if(id==='S37'){
    await d.run(firstHTML(),'pending-interaction.html');
    await l.action('preview_click','Commit a successful interaction before failure',()=>d.preview().getByRole('button',{name:'Commit change',exact:true}).click());await logUntil('interaction-committed-log');await d.completed();const committed=await d.body();assert(committed.includes('interaction-committed'));
    const start=l.relative();await l.action('preview_click','Start pending interaction work',()=>d.preview().getByRole('button',{name:'Start work',exact:true}).click());await logUntil('interaction-started');const pending=await d.status();await l.wait(p,2100,'Attempt second input inside original pending interaction');
    const secondAt=l.relative(),button=d.preview().getByRole('button',{name:'Still waiting',exact:true});let dispatched=false;
    if(await button.count()&&await button.isVisible()&&await button.isEnabled()){await l.action('preview_click','Attempt ordinary second input without resetting deadline',()=>button.click());dispatched=true;}
    await p.waitForFunction(()=>/time limit/i.test(document.querySelector('[role="log"]')?.textContent??''),null,{timeout:8000});const timeoutAt=l.relative();
    await l.wait(p,Math.max(0,start+6700-l.relative()),'Observe beyond the original six-second timer');const restored=await d.body(),logs=await d.logs();const recovered=await recovery('interaction-budget-recovered','interaction-budget-recovered-log');
    say('interaction_latest_rollback',restored.includes('interaction-committed')&&!restored.includes('interaction-good')&&recovered,{committed,restored,recovered});
    say('interaction_budget_no_extension',/running|waiting/i.test(pending)&&timeoutAt-start<8000&&!logs.includes('interaction-late')&&!restored.includes('interaction-late'),{pending,second_input_at_ms:secondAt-start,second_input_dispatched:dispatched,timeout_at_ms:timeoutAt-start,observed_until_ms:l.relative()-start,late_callback:false});
  }else throw Error('Unsupported runtime scenario '+id);
}

module.exports={runRuntimeScenario};
