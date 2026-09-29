async (page) => {
  page.setDefaultTimeout(10000);
  const observations=[]; page.__interactionProof={running:true,observations};
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const editor=p=>p.getByRole('textbox',{name:'Code editor',exact:true});
  const title=p=>p.getByRole('textbox',{name:'Snippet title',exact:true});
  const file=p=>p.getByRole('textbox',{name:'Filename',exact:true});
  const preview=()=>page.frameLocator('iframe[title="Live preview"]');
  const body=()=>preview().locator('body').innerText();
  const logs=()=>page.getByRole('log').innerText();
  const complete=()=>page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'),null,{timeout:10000});
  const enter=async(code,filename,p=page)=>{await file(p).fill(filename);await editor(p).click();await p.keyboard.press('Control+A');await p.keyboard.insertText(code);assert(await editor(p).innerText()===code,'Exact entered source');};
  const run=async(code,filename='proof.js',wait=true)=>{await enter(code,filename);const started=Date.now();await page.getByRole('button',{name:/^Run /}).click();if(wait)await complete();return started;};
  const clear=()=>page.getByRole('button',{name:'Clear console',exact:true}).click();
  const test=async(name,fn)=>{const start=Date.now();try{observations.push({name,passed:true,...await fn(),duration_ms:Date.now()-start});}catch(e){observations.push({name,passed:false,error:String(e),duration_ms:Date.now()-start});}};
  await complete();await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();
  await test('language_dispatch_independent',async()=>{
    await clear();
    await run("document.body.innerHTML = '<p id=\"dispatch-mark\">js-dispatch-ok</p>';\nconsole.log('js-dispatch-log');",'dispatch.JS');
    assert((await body()).includes('js-dispatch-ok')&&(await logs()).includes('js-dispatch-log'),'JS output');
    await run('<!doctype html><html><body><h1 id="dispatch-mark">html-dispatch-ok</h1><button id="dispatch-button">Try handler</button><script>window.oldGlobal=\'do-not-carry\'; console.log(\'html-once-marker\'); document.getElementById(\'dispatch-button\').addEventListener(\'click\', () => console.log(\'dispatch-handler-marker\'));</script></body></html>','dispatch.html');
    assert(!(await body()).includes('js-dispatch-ok'),'HTML replaced JS');
    await preview().getByRole('button',{name:'Try handler'}).click();await complete();
    assert((await logs()).includes('dispatch-handler-marker'),'Control handler ran');
    await run('#dispatch-mark { color: rgb(255, 0, 0); }','dispatch.CSS');
    assert(await preview().locator('#dispatch-mark').evaluate(e=>getComputedStyle(e).color)==='rgb(255, 0, 0)','CSS retained and styled HTML');
    await preview().getByRole('button',{name:'Try handler'}).click();await page.waitForTimeout(200);
    assert((await logs()).match(/dispatch-handler-marker/g)?.length===1,'No old handlers');
    assert((await logs()).match(/html-once-marker/g)?.length===1,'No old script rerun');
    await run("document.body.innerHTML = '<p id=\"fresh-js\">fresh-' + typeof window.oldGlobal + '</p>';\nconsole.log('fresh-js-log');",'dispatch.js');
    assert((await body()).includes('fresh-undefined')&&!(await body()).includes('html-dispatch-ok'),'Fresh JS document/global');
    return{delayed_interaction_not_regraded:true,css_static_copy:true};
  });
  await test('completed_preview_interactions_independent',async()=>{
    await clear();
    await run('<!doctype html><html><body><p>completed-interaction-ready</p><button id="interaction-button">Try later action</button><input id="interaction-input" aria-label="Later interaction input"><script>console.log(\'completed-interaction-ready-log\'); document.getElementById(\'interaction-button\').addEventListener(\'click\', () => console.log(\'completed-interaction-click\')); document.getElementById(\'interaction-input\').addEventListener(\'keydown\', () => console.log(\'completed-interaction-key\')); document.getElementById(\'interaction-input\').addEventListener(\'input\', () => console.log(\'completed-interaction-input\'));</script></body></html>','interaction.html');
    assert((await body()).includes('completed-interaction-ready')&&(await logs()).includes('completed-interaction-ready-log'),'Own initial control');
    const finished=Date.now();await page.waitForTimeout(6100);const click=Date.now();await preview().getByRole('button',{name:'Try later action'}).click();await complete();
    assert((await logs()).includes('completed-interaction-click'),'Late real click');
    await preview().getByRole('textbox',{name:'Later interaction input'}).click();await complete();const focused=Date.now();await page.waitForTimeout(6100);const key=Date.now();await preview().getByRole('textbox',{name:'Later interaction input'}).press('a');await complete();
    assert((await logs()).includes('completed-interaction-key')&&(await logs()).includes('completed-interaction-input'),'Late key and input');
    return{wait_before_click_ms:click-finished,wait_before_key_ms:key-focused,own_fixture:true};
  });
  await test('shared_original_run_deadline_independent',async()=>{
    await clear();await run("document.body.innerHTML='<p>recovery-marker-Q7</p>';\nconsole.log('recovery-marker-Q7-log');");
    const started=await run("document.body.innerHTML='<p>failed-loop-candidate</p>';\nsetTimeout(() => { console.log('late-callback-entered'); while (true) {} }, 4000);",'proof.js',false);
    assert((await body()).includes('failed-loop-candidate'),'Pending candidate');
    await page.waitForFunction(()=>document.querySelector('[role=log]').textContent.includes('late-callback-entered'));
    await page.waitForFunction(()=>/time limit/i.test(document.querySelector('[role=log]').textContent));const elapsed=Date.now()-started;
    assert(elapsed<8000,'Original deadline no timer refresh');assert((await body()).includes('recovery-marker-Q7'),'Rollback own control');
    await run("document.body.innerHTML='<p>shared-deadline-recovered</p>';console.log('shared-deadline-recovered-log');");assert((await body()).includes('shared-deadline-recovered')&&(await logs()).includes('shared-deadline-recovered-log'),'Recovery');
    return{original_run_to_timeout_ms:elapsed,no_library_dependency:true,no_active_loop_ui_requirement:true};
  });
  await test('pending_interaction_budget_independent',async()=>{
    await clear();await run('<!doctype html><html><body><p id="interaction-state">interaction-good</p><button id="start-work">Start work</button><button id="still-waiting">Still waiting</button><script>console.log(\'interaction-initial-ready\'); document.getElementById(\'start-work\').addEventListener(\'click\', () => { document.getElementById(\'interaction-state\').textContent=\'interaction-candidate\'; console.log(\'interaction-started\'); setTimeout(() => { document.getElementById(\'interaction-state\').textContent=\'interaction-late\'; console.log(\'interaction-late\'); }, 6000); }); document.getElementById(\'still-waiting\').addEventListener(\'click\', () => console.log(\'interaction-still-waiting\'));</script></body></html>','pending-interaction.html');
    assert((await body()).includes('interaction-good')&&(await logs()).includes('interaction-initial-ready'),'Own good control');
    const started=Date.now();await preview().getByRole('button',{name:'Start work'}).click();assert((await body()).includes('interaction-candidate')&&(await logs()).includes('interaction-started'),'Pending first action');await page.waitForTimeout(2100);const second=Date.now();await preview().getByRole('button',{name:'Still waiting'}).click();assert((await logs()).includes('interaction-still-waiting'),'Real second action');
    await page.waitForFunction(()=>/time limit/i.test(document.querySelector('[role=log]').textContent));const timeout=Date.now();assert(timeout-started<8000,'No extended deadline');
    await page.waitForTimeout(Math.max(0,started+6700-Date.now()));assert(!(await logs()).includes('interaction-late')&&!(await body()).includes('interaction-late'),'No late callback');assert((await body()).includes('interaction-good'),'Own rollback');
    await run("document.body.innerHTML='<p>interaction-budget-recovered</p>';console.log('interaction-budget-recovered-log');");assert((await body()).includes('interaction-budget-recovered')&&(await logs()).includes('interaction-budget-recovered-log'),'Recovery');
    return{second_click_ms:second-started,timeout_ms:timeout-started,no_library_dependency:true};
  });
  await test('auto_run_measured_negative_windows',async()=>{
    await clear();await file(page).fill('auto.js');await page.getByRole('checkbox',{name:'Auto-run',exact:true}).check();
    const code=marker=>`document.body.innerHTML='<p>${marker}</p>';console.log('${marker}');`;
    await enter(code('auto-fired'),'auto.js');const firstEdit=Date.now();await page.waitForFunction(()=>document.querySelector('[role=log]').textContent.includes('auto-fired'));await complete();const firstDelay=Date.now()-firstEdit;
    const timings=[];const gap=Math.max(30,Math.floor(firstDelay/4));
    const seriesStart=Date.now();let finalEdit;
    for(let index=0;index<6;index++){const marker=index===5?'auto-final':'auto-intermediate-'+index;await editor(page).click();await page.keyboard.press('Control+A');await page.keyboard.insertText(code(marker));timings.push({index,at_ms:Date.now()-seriesStart});finalEdit=Date.now();if(index<5)await page.waitForTimeout(gap);}
    await page.waitForFunction(()=>document.querySelector('[role=log]').textContent.includes('auto-final'));await complete();const finalDelay=Date.now()-finalEdit;
    assert(!(await logs()).includes('auto-intermediate-'),'Intermediate source did not run');assert(Date.now()-seriesStart>firstDelay,'Editing lasted beyond first deadline');
    const window=Math.max(3000,Math.max(firstDelay,finalDelay)+1000);
    await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();await enter(code('auto-off'),'auto.js');await page.waitForTimeout(window);assert(!(await logs()).includes('auto-off'),'Off did not run');await page.getByRole('button',{name:/^Run /}).click();await complete();assert((await logs()).includes('auto-off'),'Manual off control');
    await page.getByRole('checkbox',{name:'Auto-run',exact:true}).check();await editor(page).click();await page.keyboard.press('Control+A');await page.keyboard.insertText(code('auto-queued'));const queued=Date.now();await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();const disabled=Date.now();assert(disabled-queued<firstDelay,'Disable before debounce');await page.waitForTimeout(window);assert(!(await logs()).includes('auto-queued'),'Queued run cancelled');
    await page.getByRole('button',{name:/^Run /}).click();await complete();assert((await logs()).includes('auto-queued'),'Manual queued control');
    return{first_delay_ms:firstDelay,final_delay_ms:finalDelay,negative_window_ms:window,disable_after_edit_ms:disabled-queued,edit_timings:timings};
  });
  await test('persistent_snippets_actual_dirty_editor',async()=>{
    await page.getByRole('button',{name:'New',exact:true}).click();await title(page).fill('QC Concurrent Save');await enter("console.log('base-version');",'qc-concurrent.js');
    const initialResponse=page.waitForResponse(r=>r.url().endsWith('/api/snippets')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save',exact:true}).click();const initial=await(await initialResponse).json();
    const b=await page.context().newPage();b.on('dialog',dialog=>dialog.accept());await b.goto('http://localhost:3000');await b.getByRole('button',{name:/^QC Concurrent Save/}).waitFor();await b.getByRole('button',{name:/^QC Concurrent Save/}).click();
    await enter("console.log('stale-overwrite');",'qc-concurrent.js',b);const dirty={title:await title(b).inputValue(),filename:await file(b).inputValue(),code:await editor(b).innerText()};
    await title(page).fill('QC Concurrent Save Updated');await enter('<!doctype html><html><body>first-editor-won</body></html>','qc-concurrent.html');const aResponse=page.waitForResponse(r=>r.url().endsWith('/api/snippets/'+initial.id)&&r.request().method()==='PUT');await page.getByRole('button',{name:'Save',exact:true}).click();const winner=await(await aResponse).json();assert(winner.revision>initial.revision,'Advanced revision');
    const staleResponse=b.waitForResponse(r=>r.url().endsWith('/api/snippets/'+initial.id)&&r.request().method()==='PUT');await b.getByRole('button',{name:'Save',exact:true}).click();const stale=await staleResponse;assert(stale.status()===409,'Actual UI stale rejection');await b.getByRole('button',{name:'Reload latest',exact:true}).waitFor();
    const retained={title:await title(b).inputValue(),filename:await file(b).inputValue(),code:await editor(b).innerText()};assert(JSON.stringify(retained)===JSON.stringify(dirty),'Exact dirty title/filename/code retained');
    const observedUrl=stale.url();const fresh=await b.evaluate(async url=>await(await fetch(url)).json(),observedUrl);assert(JSON.stringify(fresh)===JSON.stringify(winner),'Fresh server unchanged');
    await b.getByRole('button',{name:'Reload latest',exact:true}).click();await b.waitForFunction(expected=>document.querySelector('input[aria-label="Snippet title"]').value===expected.title&&document.querySelector('input[aria-label="Filename"]').value===expected.filename,winner);assert(await title(b).inputValue()===winner.title&&await file(b).inputValue()===winner.filename,'Deliberate latest fields');await enter('<!doctype html><html><body>reapplied-after-reload</body></html>','qc-concurrent.html',b);
    const recoverResponse=b.waitForResponse(r=>r.url().endsWith('/api/snippets/'+initial.id)&&r.request().method()==='PUT');await b.getByRole('button',{name:'Save',exact:true}).click();const recovered=await(await recoverResponse).json();assert(recovered.revision>winner.revision,'Recovery advanced revision');await b.reload();await b.getByRole('button',{name:/^QC Concurrent Save Updated/}).click();assert(await editor(b).innerText()===recovered.code,'Recovered saved draft survives reload');await b.close();
    return{dirty_before_A_saved:dirty,retained_after_rejection:retained,old_revision:initial.revision,winner_revision:winner.revision,recovered_revision:recovered.revision,actual_UI_stale_status:stale.status(),server_record_unchanged:true};
  });
  page.__interactionProof={running:false,passed:observations.every(item=>item.passed),observations};return page.__interactionProof;
}
