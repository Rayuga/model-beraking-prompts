'use strict';
const assert=require('node:assert/strict');
const count=(text,marker)=>text.split(marker).length-1;

async function runRuntimeScenario(id,d,l,inputs,emit,state={}){
  const p=d.page,protocol=inputs.scenarios[id].protocol;
  const say=(key,pass,evidence)=>emit(id+'.'+key,Boolean(pass),evidence);
  const good=async(marker,logMarker=marker)=>{await d.run(`document.body.innerHTML='<p>${marker}</p>';console.log('${logMarker}');`,'proof.js');const body=await d.body(),logs=await d.logs();assert(body.includes(marker)&&logs.includes(logMarker));state.runtimeLastGood={body,marker,log_marker:logMarker};return state.runtimeLastGood;};
  const reuseGood=async(marker,logMarker=marker)=>{if(state.runtimeLastGood&&await d.body()===state.runtimeLastGood.body)return state.runtimeLastGood;return good(marker,logMarker);};
  const logUntil=async needle=>p.waitForFunction(needle=>document.querySelector('[role="log"]')?.textContent.includes(needle),needle,{timeout:8500});
  const failure=async(code,file,marker)=>{
    const clock=await d.run(code,file,false);if(marker)await logUntil(marker);
    await p.waitForFunction(()=>/error|time limit|unsupported|refused|outside/i.test(document.querySelector('[role="status"]')?.textContent??''),null,{timeout:8500});
    return{clock,elapsed_ms:l.relative()-clock.action_at_ms,logs:await d.logs(),body:await d.body(),status:await d.status()};
  };
  const recovery=async(marker,logMarker=marker)=>{await good(marker,logMarker);return true;};
  const firstHTML=()=>{const line=protocol.split('\n').find(line=>line.startsWith('<!doctype html>'));assert(line,'Exact HTML fixture missing');return line;};

  if(id==='S02'){
    await d.run("document.body.innerHTML = '<p id=\"dispatch-mark\">js-dispatch-ok</p>';\nconsole.log('js-dispatch-log');",'dispatch.JS');
    const js={body:await d.body(),logs:await d.logs()};
    await d.run(firstHTML(),'dispatch.HTML');const html={body:await d.body(),logs:await d.logs()};
    await l.action('preview_click','Establish actual pre-CSS live handler',()=>d.preview().getByRole('button',{name:'Try handler',exact:true}).click());await logUntil('dispatch-handler-marker');await d.completed();
    const before={script:count(await d.logs(),'html-once-marker'),handler:count(await d.logs(),'dispatch-handler-marker')};
    await d.run('#dispatch-mark { color: rgb(255, 0, 0); }','dispatch.CSS');
    const css={body:await d.body(),styles:await d.preview().locator('#dispatch-mark').evaluate(e=>({color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}))};
    await l.action('preview_click','Attempt retained button after CSS copy',()=>d.preview().getByRole('button',{name:'Try handler',exact:true}).click());await l.wait(p,150,'Observe any inherited CSS handler output');
    const after={script:count(await d.logs(),'html-once-marker'),handler:count(await d.logs(),'dispatch-handler-marker')};
    say('js_html_filename_dispatch',js.body.includes('js-dispatch-ok')&&js.logs.includes('js-dispatch-log')&&html.body.includes('html-dispatch-ok')&&!html.body.includes('js-dispatch-ok'),{js,html});
    say('css_apply_snapshot',css.body.includes('html-dispatch-ok')&&css.styles.color==='rgb(255, 0, 0)'&&css.styles.background==='rgb(1, 2, 3)',css);
    say('extension_case',js.body.includes('js-dispatch-ok')&&html.body.includes('html-dispatch-ok')&&css.styles.color==='rgb(255, 0, 0)',{filenames:['dispatch.JS','dispatch.HTML','dispatch.CSS'],actual_outputs:[js.body,html.body,css.styles]});
    say('css_inert_copy',before.script===after.script&&before.handler===after.handler,{before,after});
    await d.run("document.body.innerHTML = '<p id=\"fresh-js\">fresh-' + typeof window.oldGlobal + '</p>';\nconsole.log('fresh-js-log');",'dispatch.js');
    const fresh=await d.body();state.round2FreshJS={body:fresh,logs:await d.logs(),passed:fresh.includes('fresh-undefined')&&!fresh.includes('html-dispatch-ok')&&(await d.logs()).includes('fresh-js-log')};say('js_fresh_document',fresh.includes('fresh-undefined')&&!fresh.includes('html-dispatch-ok'),{body:fresh});
  }else if(id==='S03'){
    await d.run(firstHTML(),'interaction.html');const completed=l.relative();
    await l.wait(p,6100,'Completed preview must remain untouched beyond initial budget');const clicked=l.relative();
    await l.action('preview_click','Genuine delayed click',()=>d.preview().getByRole('button',{name:'Try later action',exact:true}).click());await logUntil('completed-interaction-click');await d.completed();
    await l.action('preview_focus','Focus later interaction input',()=>d.preview().getByRole('textbox',{name:'Later interaction input',exact:true}).click());await d.completed();const focused=l.relative();
    await l.wait(p,6100,'Focused input remains untouched beyond prior interaction budget');const typed=l.relative();
    await l.action('preview_type','Ordinary delayed key and input',()=>d.preview().getByRole('textbox',{name:'Later interaction input',exact:true}).press('a'));await logUntil('completed-interaction-input');await d.completed();
    const counts=async()=>Object.fromEntries(['click','key','input'].map(key=>[key,count(awaitedLogs,'completed-interaction-'+key)]));
    let awaitedLogs=await d.logs();const before=await counts();
    say('later_interactions',Object.values(before).every(value=>value>=1)&&clicked-completed>=6000&&typed-focused>=6000,{before,wait_before_click_ms:clicked-completed,wait_before_key_ms:typed-focused});
    await l.action('stop','Stop completed preview',()=>p.getByRole('button',{name:'Stop',exact:true}).click());const feedback=await d.status();
    const button=d.preview().getByRole('button',{name:'Try later action',exact:true}),input=d.preview().getByRole('textbox',{name:'Later interaction input',exact:true});
    const attempted={button:false,input:false};if(await button.count()&&await button.isVisible()&&await button.isEnabled()){await button.click();attempted.button=true;}if(await input.count()&&await input.isVisible()&&await input.isEnabled()){await input.press('b');attempted.input=true;}
    await l.wait(p,150,'Check stopped handlers remain inert');awaitedLogs=await d.logs();const after=await counts();const recovered=await recovery('completed-stop-recovered','completed-stop-recovered-log');
    say('completed_stop',JSON.stringify(before)===JSON.stringify(after)&&/stop|cancel/i.test(feedback)&&recovered,{before,after,feedback,attempted,recovered});
  }else if(id==='S04'){
    const previousGood=await reuseGood('cancel-good');
    const aSource="window.__cancelLeak = 'A';\ndocument.body.innerHTML = '<p id=\"run-A\">candidate-A</p>';\nconsole.log('cancel-A-started');\nsetTimeout(() => console.log('cancel-A-delayed'), 4000);";
    const beforeControl={started:count(await d.logs(),'cancel-A-started'),delayed:count(await d.logs(),'cancel-A-delayed')};
    const controlClock=await d.run(aSource,'cancel-a.js');
    const positive={clock:controlClock,body:await d.body(),started:count(await d.logs(),'cancel-A-started'),delayed:count(await d.logs(),'cancel-A-delayed')};
    assert(positive.started===beforeControl.started+1&&positive.delayed===beforeControl.delayed+1,'S04 matching four-second callback positive control did not run');
    const baseline=positive.delayed;
    await good(previousGood.marker,previousGood.log_marker);
    const a=await d.run(aSource,'cancel-a.js',false);
    await p.waitForFunction(n=>document.querySelector('[role="log"]')?.textContent.split('cancel-A-started').length-1>n,positive.started,{timeout:8500});
    const pending=await d.status();
    const b=await d.run("document.body.innerHTML = '<p id=\"run-B\">run-B-' + typeof window.__cancelLeak + '</p>';\nconsole.log('cancel-B-started');",'cancel-b.js');
    assert(b.action_at_ms-a.action_at_ms<4000,'Cancellation setup missed pending window');
    await l.wait(p,Math.max(0,a.action_at_ms+6200-l.relative()),'Observe beyond superseded timer deadline against positive-control baseline');
    const bBody=await d.body(),bLogs=await d.logs(),afterSupersede=count(bLogs,'cancel-A-delayed');
    say('supersede_pending',/running|waiting/i.test(pending)&&afterSupersede===baseline&&bBody.includes('run-B-'),{positive_control:positive,pending,a,b,body:bBody,delayed_baseline:baseline,delayed_after:afterSupersede});
    emit('S02.js_fresh_document',Boolean(state.round2FreshJS?.passed&&bBody.includes('run-B-undefined')&&bLogs.includes('cancel-B-started')&&count(bLogs,'cancel-A-started')>positive.started),{first_fresh_JS:state.round2FreshJS,executed_A_started_count:count(bLogs,'cancel-A-started'),positive_control_started:positive.started,B_body:bBody,B_log_observed:bLogs.includes('cancel-B-started'),cancellation_verdict_not_inherited:true});
    const stopBaseline=count(bLogs,'stop-delayed'),startBaseline=count(bLogs,'stop-started');
    const stop=await d.run("console.log('stop-started');document.body.innerHTML='<p>stop-candidate</p>';setTimeout(()=>console.log('stop-delayed'),4000);",'stop.js',false);
    await p.waitForFunction(n=>document.querySelector('[role="log"]')?.textContent.split('stop-started').length-1>n,startBaseline,{timeout:8500});
    const active=await d.status();
    await l.action('stop','Stop active timer run',()=>p.getByRole('button',{name:'Stop',exact:true}).click());const feedback=await d.status();
    await l.wait(p,Math.max(0,stop.action_at_ms+4300-l.relative()),'Observe beyond stopped timer scheduled time');
    const restored=await d.body(),logs=await d.logs(),stopAfter=count(logs,'stop-delayed');const recovered=await recovery('stop-recovered');
    say('stop_pending_execution',/running|waiting/i.test(active)&&/stop|cancel/i.test(feedback)&&stopAfter===stopBaseline&&recovered,{matching_positive_control:positive,active,feedback,delayed_baseline:stopBaseline,delayed_after:stopAfter,recovered});
    say('stop_pending_rollback',restored===bBody,{last_good:bBody,restored});
  }else if(id==='S05'){
    await good('isolation-control','isolation-control-log');const before=await p.evaluate(()=>({title:document.title,storage:localStorage.getItem('cw-isolation-probe')}));
    const source="let docRead='not-blocked', docWrite='not-blocked', storageRead='not-blocked', storageWrite='not-blocked';\ntry { const value=parent.document.title; } catch (error) { docRead='blocked'; }\ntry { parent.document.title='cw-forbidden-title'; } catch (error) { docWrite='blocked'; }\ntry { const value=parent.localStorage.getItem('cw-isolation-probe'); } catch (error) { storageRead='blocked'; }\ntry { parent.localStorage.setItem('cw-isolation-probe','changed'); } catch (error) { storageWrite='blocked'; }\ndocument.body.innerHTML='<p>isolation-'+docRead+'-'+docWrite+'-'+storageRead+'-'+storageWrite+'</p>';\nconsole.log('isolation-results',docRead,docWrite,storageRead,storageWrite);";
    await d.run(source,'isolation.js');const result={body:await d.body(),logs:await d.logs()},after=await p.evaluate(()=>({title:document.title,storage:localStorage.getItem('cw-isolation-probe')}));const recovered=await recovery('isolation-recovered');
    say('preview_origin_boundary',result.body.includes('isolation-blocked-blocked-blocked-blocked')&&JSON.stringify(before)===JSON.stringify(after)&&recovered,{before,after,result,recovered});
  }else if(id==='S08'){
    const source="<!doctype html><html><body><p>scope-control: eval Function WebAssembly Worker import</p><script>\n// eval Function WebAssembly Worker import are ordinary comment words\nconsole.log('scope-control-log', 'eval Function WebAssembly Worker import');\n</script></body></html>";
    await d.run(source,'scope-control.html');const control={body:await d.body(),logs:await d.logs()};say('harmless_scope_words',control.body.includes('scope-control: eval Function WebAssembly Worker import')&&control.logs.includes('scope-control-log'),control);
    const payloads=[['eval',"eval('1 + 1');"],['Function',"new Function('return 2')();"],['WebAssembly','new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));'],['Worker',"new Worker('data:text/javascript,postMessage(1)');"],['import',"import('data:text/javascript,export const answer = 1');"]],observations=[];
    for(const[family,code]of payloads){const row=await failure(code,'scope.js');observations.push({family,...row,refused:/unsupported|not supported|disabled|refus|outside|not available|not permitted/i.test(row.status+' '+row.logs),retained:row.body===control.body});}
    const recovered=await recovery('scope-recovered');say('unsupported_execution_refused',observations.every(row=>row.refused&&row.retained)&&recovered,{observations,recovered});
  }else if(id==='S09'){
    const lastGood=await reuseGood('timeout-control');const loops=[];
    for(const[marker,loop]of [['before-braced-hang','while (true) {}'],['before-unbraced-hang','while (true);'],['before-promise-hang',"Promise.resolve().then(() => { console.log('promise-loop-entered'); while (true) {} });"]])loops.push({marker,...await failure(`console.log('${marker}');\n${loop}`,'timeout.js',marker)});
    const recovered=await recovery('timeout-recovered');
    say('literal_loop_deadline',loops.every(row=>row.elapsed_ms<8000&&/time limit/i.test(row.status+' '+row.logs)&&row.logs.includes(row.marker))&&recovered,{loops:loops.map(row=>({marker:row.marker,elapsed_ms:row.elapsed_ms,status:row.status})),recovered});
    say('literal_loop_rollback',loops.every(row=>row.body===lastGood.body),{last_good:lastGood,bodies:loops.map(row=>row.body)});
  }else if(['S10','S11','S12','S13'].includes(id)){
    const configs={
      S10:{kind:'js',file:'bad.js',code:"document.body.innerHTML='<p>failed-partial-dom</p>';\nconst marker = 1;\nconst items = [1, 2, 3];\nitems.forEeach((n) => n);",needle:'forEeach',line:4,candidate:'failed-partial-dom'},
      S11:{kind:'html',file:'bad.html',code:'<!doctype html>\n<html>\n<body>\n<h1>Failed HTML candidate</h1>\n<script>\nundefinedFunctionCall();\n</script>\n</body>\n</html>',needle:'undefinedFunctionCall',line:6,candidate:'Failed HTML candidate'},
      S12:{kind:'timer',file:'delayed-error.js',code:"document.body.innerHTML='<p>async-failed-candidate</p>';\nsetTimeout(() => { throw new Error('async-error-marker'); }, 50);",needle:'async-error-marker',line:2,candidate:'async-failed-candidate'},
      S13:{kind:'promise',file:'rejected-promise.js',code:"document.body.innerHTML='<p>promise-failed-candidate</p>';\nPromise.reject(new Error('promise-error-marker'));",needle:'promise-error-marker',line:2,candidate:'promise-failed-candidate'}
    },c=configs[id];const lastGood=await reuseGood(c.kind+'-good-preview',c.kind+'-good-log');const failed=await failure(c.code,c.file,c.needle);
    say(c.kind+'_error_message',failed.logs.includes(c.needle)&&!/^(Complete)/.test(failed.status),{logs:failed.logs,status:failed.status});
    say(c.kind+'_error_line',new RegExp('line\\s+'+c.line+'(?:\\D|$)','i').test(failed.logs),{filename:c.file,entered_source:c.code,expected_line:c.line,logs:failed.logs});
    const recovered=await recovery(c.kind+'-error-recovered');say(c.kind+'_error_rollback',failed.body===lastGood.body&&!failed.body.includes(c.candidate)&&recovered,{last_good:lastGood,restored:failed.body,recovered});
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
