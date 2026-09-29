'use strict';
const assert=require('node:assert/strict');
const count=(text,marker)=>text.split(marker).length-1;
async function autoControl(d,l){
  const p=d.page,auto=p.getByRole('checkbox',{name:'Auto-run',exact:true}),source=marker=>`document.body.innerHTML='<p>${marker}</p>';console.log('${marker}');`;
  await d.disableAutoIfAvailable();await d.run(source('automatic-control-baseline'),'automatic-controls.js');
  const baseline={body:await d.body(),logs:await d.logs()};assert(baseline.body.includes('automatic-control-baseline')&&baseline.logs.includes('automatic-control-baseline'));
  await l.action('auto_run_toggle','Enable automatic execution for an actual positive control',()=>auto.check());
  await d.enter(source('auto-fired'),'automatic-controls.js');const edited=l.relative();
  let controlError=null;try{await p.waitForFunction(()=>document.querySelector('[role="log"]')?.textContent.includes('auto-fired'),null,{timeout:2200});await d.completed();}catch(error){controlError=String(error);}
  const automatic={body:await d.body(),logs:await d.logs(),enabled:await auto.isChecked(),elapsed_ms:l.relative()-edited,manual_run_actions_since_edit:0,error:controlError};
  const enabledPositive=automatic.body.includes('auto-fired')&&automatic.logs.includes('auto-fired')&&automatic.enabled&&!controlError;
  const measuredWindow=Math.max(3000,enabledPositive?automatic.elapsed_ms+1000:3000);
  await l.action('auto_run_toggle','Turn Auto-run off before the negative observation',()=>auto.uncheck());
  await d.enter(source('auto-off'),'automatic-controls.js');const offStart=l.relative(),beforeOff={body:await d.body(),logs:await d.logs()};
  await l.wait(p,measuredWindow,'Observe OFF edit for measured successful delay plus margin, minimum three seconds');
  const offObserved={body:await d.body(),logs:await d.logs(),enabled:await auto.isChecked(),elapsed_ms:l.relative()-offStart};
  const absent=!offObserved.body.includes('auto-off')&&!offObserved.logs.includes('auto-off')&&offObserved.body===beforeOff.body&&!offObserved.enabled;
  await d.run();const manual={body:await d.body(),logs:await d.logs()},manualPositive=manual.body.includes('auto-off')&&manual.logs.includes('auto-off');
  return {key:'S17.autorun_off_stays_idle',product_pass:enabledPositive&&absent&&manualPositive,enabled_positive_observed:enabledPositive,off_absence_observed:absent,manual_positive_observed:manualPositive,absence_only_would_pass:absent,baseline,automatic,before_off:beforeOff,off:offObserved,manual,minimum_window_ms:measuredWindow,observation_semantics:'Required positive auto execution is a fresh authored DOM/log observation, never inherited from another outcome verdict. A dead Auto-run cannot pass from absence alone.'};
}
async function cssControl(d,l){
  await d.disableAutoIfAvailable();
  const html='<!doctype html><html><body><style>#dispatch-mark { background-color: rgb(1, 2, 3); }</style><h1 id="dispatch-mark">html-dispatch-ok</h1><button id="dispatch-button">Try handler</button><script>window.oldGlobal=\'do-not-carry\'; console.log(\'html-once-marker\'); document.getElementById(\'dispatch-button\').addEventListener(\'click\', () => console.log(\'dispatch-handler-marker\'));</script></body></html>';
  await d.run(html,'dispatch.HTML');const scriptBefore=count(await d.logs(),'html-once-marker');assert(scriptBefore>=1);
  const oldButton=d.preview().getByRole('button',{name:'Try handler',exact:true});assert(await oldButton.isVisible()&&await oldButton.isEnabled());
  const handlerBefore=count(await d.logs(),'dispatch-handler-marker');await l.action('preview_click','Prove the old HTML handler works before CSS',()=>oldButton.click());
  await d.page.waitForFunction(previous=>(document.querySelector('[role="log"]')?.textContent.split('dispatch-handler-marker').length-1)>previous,handlerBefore);await d.completed();
  const original={body:await d.body(),script_count:scriptBefore,handler_count:count(await d.logs(),'dispatch-handler-marker')};
  await d.run('#dispatch-mark { color: rgb(255, 0, 0); }','dispatch.CSS');
  const heading=d.preview().locator('#dispatch-mark'),button=d.preview().getByRole('button',{name:'Try handler',exact:true});
  const retained={body:await d.body(),heading_count:await heading.count(),button_count:await button.count(),button_visible:false,button_enabled:false,click_attempted:false};
  if(retained.heading_count)retained.heading=await heading.evaluate(el=>({text:el.textContent,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  if(retained.button_count){retained.button_visible=await button.isVisible();retained.button_enabled=await button.isEnabled();}
  if(retained.button_visible&&retained.button_enabled){await l.action('preview_click','Ordinary click on the retained CSS-copy button',()=>button.click());retained.click_attempted=true;}
  await l.wait(d.page,150,'Check copied button does not produce a fresh old-handler marker');
  const after={script_count:count(await d.logs(),'html-once-marker'),handler_count:count(await d.logs(),'dispatch-handler-marker')};
  const positive=retained.body.includes('html-dispatch-ok')&&retained.heading?.text==='html-dispatch-ok'&&retained.button_visible&&retained.button_enabled&&retained.click_attempted;
  const absent=original.script_count===after.script_count&&original.handler_count===after.handler_count;
  return {key:'S02.css_inert_copy',product_pass:original.handler_count>handlerBefore&&positive&&absent,original_handler_positive:original.handler_count>handlerBefore,retained_document_button_positive:positive,old_markers_did_not_increase:absent,absence_only_would_pass:absent,css_style_applied:retained.heading?.color==='rgb(255, 0, 0)',prior_style_retained:retained.heading?.background==='rgb(1, 2, 3)',original,retained,after,observation_semantics:'Missing/disabled copied content does not count as a successful click with an inert old handler.'};
}
async function freshGlobalControl(d,l){
  await d.disableAutoIfAvailable();
  const aSource="window.__cancelLeak = 'A';\ndocument.body.innerHTML = '<p id=\"run-A\">candidate-A</p>';\nconsole.log('cancel-A-started');\nsetTimeout(() => console.log('cancel-A-delayed'), 4000);";
  const bSource="document.body.innerHTML = '<p id=\"run-B\">run-B-' + typeof window.__cancelLeak + '</p>';\nconsole.log('cancel-B-started');";
  const a=await d.run(aSource,'cancel-a.js',false);await d.page.waitForFunction(()=>document.querySelector('[role="log"]')?.textContent.includes('cancel-A-started'));const pending=await d.status(),aLogs=await d.logs();
  const b=await d.run(bSource,'cancel-b.js');const body=await d.body(),logs=await d.logs();
  await l.wait(d.page,Math.max(0,a.action_at_ms+6200-l.relative()),'Observe beyond old A timer while proving the B context stays fresh');
  const finalLogs=await d.logs(),finalBody=await d.body();
  return {key:'S04.fresh_global_after_pending',product_pass:aLogs.includes('cancel-A-started')&&/running|waiting/i.test(pending)&&b.action_at_ms-a.action_at_ms<4000&&body==='run-B-undefined'&&logs.includes('cancel-B-started')&&finalBody===body&&!finalLogs.includes('cancel-A-delayed'),a_source:aSource,b_source:bSource,a,b,pending,a_started_observed:true,body,logs,final_body:finalBody,old_timer_logged:finalLogs.includes('cancel-A-delayed'),observation_semantics:'A actually reached its log after the authored global assignment; B replaces that still-pending context and reads undefined. The earlier CSS reset is not used as a global positive control.'};
}
module.exports={autoControl,cssControl,freshGlobalControl};
