'use strict';
const assert=require('node:assert/strict');
const count=(text,marker)=>text.split(marker).length-1;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

async function cssGlobalProof(d,l){
  await d.disableAutoIfAvailable();
  const sentinel='oldGlobal',value='do-not-carry';
  const source=`<!doctype html><html><body><style>#dispatch-mark { background-color: rgb(1, 2, 3); }</style><h1 id="dispatch-mark">html-dispatch-ok</h1><button id="dispatch-button">Try handler</button><script>window.oldGlobal='do-not-carry'; console.log('html-once-marker'); document.getElementById('dispatch-button').addEventListener('click', () => console.log('dispatch-handler-marker'));</script></body></html>`;
  await d.run(source,'dispatch.HTML');
  const handlerBefore=count(await d.logs(),'dispatch-handler-marker');
  await l.action('preview_click','Establish actual working handler in authored global realm',()=>d.preview().getByRole('button',{name:'Try handler',exact:true}).click());
  await d.page.waitForFunction(n=>(document.querySelector('[role="log"]')?.textContent.split('dispatch-handler-marker').length-1)>n,handlerBefore);await d.completed();
  const before={body:await d.body(),logs:await d.logs(),global:await d.preview().locator('body').evaluate((_,key)=>({type:typeof window[key],value:window[key]}),sentinel)};
  const positive=before.global.type==='string'&&before.global.value===value&&before.body.includes('html-dispatch-ok')&&before.logs.includes('html-once-marker')&&count(before.logs,'dispatch-handler-marker')===handlerBefore+1;
  assert(positive,'Native frame inspection did not positively match the authored execution global; cannot infer cleanup from native absence.');
  const beforeFrame=await (await d.page.locator('iframe[title="Live preview"]').elementHandle()).contentFrame();
  await d.run('#dispatch-mark { color: rgb(255, 0, 0); }','dispatch.CSS');
  const currentFrame=await (await d.page.locator('iframe[title="Live preview"]').elementHandle()).contentFrame();
  const duringCss={body:await d.body(),status:await d.status(),global:await d.preview().locator('body').evaluate((_,key)=>({type:typeof window[key],value:window[key]}),sentinel),heading:await d.preview().locator('#dispatch-mark').evaluate(el=>({text:el.textContent,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor})),previous_frame_detached:beforeFrame.isDetached(),same_browser_frame_identity:beforeFrame===currentFrame};
  const continuation=duringCss.body.includes('html-dispatch-ok')&&duringCss.heading.color==='rgb(255, 0, 0)'&&duringCss.heading.background==='rgb(1, 2, 3)';
  const absent=duringCss.global.type==='undefined';
  return {key:'C1.css_global_during_css',product_pass:positive&&continuation&&absent,positive_authored_global:positive,css_continuation:continuation,global_absent_during_css:absent,before,during_css:duringCss,source,observation:'Passive native-frame property read of one authored sentinel, positively matched before CSS and repeated in the current CSS context before any later JavaScript Run. No app source, private store, or internal runtime state read. A virtual realm with no matching native positive would require another supported browser context inspection, not receive a pass/fail from native absence.'};
}

async function cssTimerProof(d,l){
  await d.disableAutoIfAvailable();
  const source=`<!doctype html><html><body><p id="css-timer-state">css-timer-ready</p><button id="css-timer-button">Queue timer</button><script>let n=0; console.log('css-timer-control'); document.getElementById('css-timer-button').addEventListener('click',()=>{const turn=++n; console.log('css-timer-start-'+turn); setTimeout(()=>{document.getElementById('css-timer-state').textContent='css-timer-fired-'+turn; console.log('css-timer-fired-'+turn);},4000);});</script></body></html>`;
  await d.run(source,'css-timer-control.html');
  const button=()=>d.preview().getByRole('button',{name:'Queue timer',exact:true});
  const initialFired=count(await d.logs(),'css-timer-fired-1');
  await l.action('preview_click','Positive control: actually let the authored old timer fire',()=>button().click());
  await d.page.waitForFunction(n=>(document.querySelector('[role="log"]')?.textContent.split('css-timer-fired-1').length-1)>n,initialFired,{timeout:4700});await d.completed();
  const control={fired_count:count(await d.logs(),'css-timer-fired-1'),pending_count:count(await d.logs(),'css-timer-start-1'),body:await d.body(),status:await d.status()};
  assert(control.fired_count===initialFired+1&&control.body.includes('css-timer-fired-1'),'Timer positive control did not really fire in DOM and log');
  await d.enter('#css-timer-state { color: rgb(255, 0, 0); }','css-timer-control.css');
  const beforePending=count(await d.logs(),'css-timer-start-2'),queuedAt=l.relative();
  await l.action('preview_click','Queue the same proven old timer again before CSS supersession',()=>button().click());
  await d.page.waitForFunction(n=>(document.querySelector('[role="log"]')?.textContent.split('css-timer-start-2').length-1)>n,beforePending);
  const pending={status:await d.status(),pending_count:count(await d.logs(),'css-timer-start-2'),at_ms:l.relative()};
  const cssRun=await d.run(undefined,undefined,false);
  await d.preview().locator('#css-timer-state').waitFor();
  for(let attempt=0;attempt<75;attempt++){if(await d.preview().locator('#css-timer-state').evaluate(el=>getComputedStyle(el).color)==='rgb(255, 0, 0)')break;await new Promise(resolve=>setTimeout(resolve,20));}
  const cssEarly={body:await d.body(),style:await d.preview().locator('#css-timer-state').evaluate(el=>getComputedStyle(el).color),at_ms:l.relative()};
  await l.wait(d.page,Math.max(0,queuedAt+5200-l.relative()),'Observe beyond the actual second old timer deadline while retaining valid CSS');
  const after={fired_count:count(await d.logs(),'css-timer-fired-2'),pending_count:count(await d.logs(),'css-timer-start-2'),body:await d.body(),status:await d.status(),color:await d.preview().locator('#css-timer-state').evaluate(el=>getComputedStyle(el).color),observed_at_ms:l.relative()};
  const positive=control.fired_count===initialFired+1&&pending.pending_count===beforePending+1;
  const supersededInTime=cssRun.action_at_ms-queuedAt<4000;
  const continuation=after.body.includes('Queue timer')&&after.color==='rgb(255, 0, 0)';
  const stopped=after.fired_count===0&&!after.body.includes('css-timer-fired-2')&&after.body.includes('css-timer-fired-1');
  await d.run("document.body.textContent='css-timer-recovered';console.log('css-timer-recovery-log');",'css-timer-recovery.js');
  const recovery={body:await d.body(),logs:await d.logs(),status:await d.status()},recovered=recovery.body==='css-timer-recovered'&&recovery.logs.includes('css-timer-recovery-log');
  return {key:'C1.css_old_timer_cancelled',product_pass:positive&&supersededInTime&&continuation&&stopped&&recovered,timer_positive_observed:positive,css_superseded_before_due:supersededInTime,css_continuation:continuation,no_fresh_old_timer:stopped,recovery_pass:recovered,source,initial_fired_count:initialFired,control,pending,queued_at_ms:queuedAt,css_run:cssRun,css_early:cssEarly,after,recovery};
}

async function importMatrixProof(d,l){
  await d.disableAutoIfAvailable();
  const items=[];
  for(const extension of ['js','html','css','JS','HTML','CSS']){
    const lower=extension.toLowerCase();
    const source=lower==='js'?"document.body.innerHTML='<p>import-executed-marker</p>';\nconsole.log('import-executed-log');":lower==='html'?"<!doctype html>\n<html><body><p>html-import-original</p></body></html>":'p { color: rgb(1, 2, 3); }';
    const comment=lower==='html'?'\n<!-- html-import-edited -->':lower==='css'?'\n/* css-import-edited */':'\n// js-import-edited';
    const filename='import-me.'+extension,title='QC Imported '+(extension===lower?'':'Upper ')+extension.toUpperCase();
    await d.newDraft();
    const before=await d.fields(),logsBefore=await d.logs(),bodyBefore=await d.body();
    await l.action('import_file','Import exact '+extension+' file',()=>d.page.getByLabel('Import file',{exact:true}).setInputFiles({name:filename,mimeType:'text/plain',buffer:Buffer.from(source)}));
    let acceptError=null;try{await d.page.waitForFunction(({name,text})=>document.querySelector('[aria-label="Filename"]')?.value===name&&Array.from(document.querySelectorAll('[aria-label="Code editor"] .cm-line')).map(el=>el.textContent).join('\n')===text,{name:filename,text:source},{timeout:1300});}catch(error){acceptError=String(error);}
    const imported={fields:await d.fields(),status:await d.status(),logs:await d.logs(),body:await d.body()};
    const importExact=imported.fields.filename===filename&&imported.fields.code===source;
    const noExecution=imported.body===bodyBefore&&imported.logs===logsBefore;
    const row={extension,filename,source,before,imported,import_exact:importExact,import_no_execution:noExecution,accept_error:acceptError,edit_exact:false,save_exact:false,load_exact:false};
    if(importExact||extension!==lower){
      row.independent_uppercase_save_fallback=!importExact;
      await l.action('edit_title','Name exact imported or independent case-check draft',()=>d.title().fill(title));
      await d.enter(source+comment,filename);row.edited=await d.fields();row.edit_exact=importExact&&equal(row.edited,{title,filename,code:source+comment});
      const saved=await d.save();row.saved=saved.record;row.save_exact=saved.record.title===title&&saved.record.filename===filename&&saved.record.code===source+comment;
      await d.reload();await d.page.getByRole('button',{name:'New',exact:true}).waitFor();await d.newDraft();await d.load(saved.record);row.loaded=await d.fields();row.load_exact=equal(row.loaded,{title,filename,code:source+comment});
    }
    row.save_layer_pass=row.save_exact&&row.load_exact;row.product_pass=row.import_exact&&row.edit_exact&&row.save_exact&&row.load_exact;items.push(row);
  }
  return {key:'C3.supported_import_edit_save_load',product_pass:items.every(row=>row.product_pass),items,all_six_supported:items.every(row=>row.product_pass),lowercase_types:items.filter(row=>row.extension===row.extension.toLowerCase()).map(row=>({extension:row.extension,pass:row.product_pass})),uppercase_types:items.filter(row=>row.extension===row.extension.toUpperCase()).map(row=>({extension:row.extension,pass:row.product_pass})),observation:'All files enter through the actual file input, source changes through the editor, writes through Save, and durable reload through the visible saved library. No alternate editor injection or API substitute for import.'};
}
module.exports={cssGlobalProof,cssTimerProof,importMatrixProof};
