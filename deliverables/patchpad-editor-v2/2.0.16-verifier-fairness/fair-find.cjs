// Real browser execution of both revised Find criteria; no model handlers/state.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const kind=process.argv[2],auto=kind==='gemini';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1280,height:800}});
 const p=await ctx.newPage(),result={kind,passed:[],observations:[],errors:[],paid_run:false};
 const find=p.locator(auto?'#find-input':'#find-box'),editor=p.locator(auto?'.patchpad-viewport':'#editor');
 const selection=p.locator(auto?'.patchpad-selection-layer > *':'#editor .selection');
 const cursor=p.locator(auto?'#cursor-pos':'#cursor-label');
 const next=p.locator(auto?'#btn-find-next':'#find-next-btn');
 const replace=p.locator(auto?'#replace-input':'#replace-box');
 const count=p.locator(auto?'#find-count':'#save-state');
 const line=async()=>Number((await cursor.innerText()).match(/Ln\s+(\d+)/)[1]);
 const successor=n=>18+(n-18+1)%3;
 const ready=async()=>{await p.waitForFunction(auto=>auto?document.querySelectorAll('.editor-line').length>0:document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report',auto);};
 const restoreFocus=async()=>{if(!(await editor.evaluate(e=>e===document.activeElement||e.contains(document.activeElement)))){await find.click();await p.keyboard.press('Escape');}};
 const copy=async expected=>{await p.keyboard.press('Control+c');await p.waitForFunction(async x=>(await navigator.clipboard.readText())===x,expected);};
 const allText=async()=>{await restoreFocus();await p.keyboard.press('Control+a');await p.keyboard.press('Control+c');await p.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('OMEGA-END-ANCHOR'));return p.evaluate(()=>navigator.clipboard.readText());};
 try {
  if(kind.startsWith('mutant-'))await p.route('**/js/app.js',async route=>{
   const response=await route.fetch(),original=await response.text();
   const old='state.activeMatch = (state.activeMatch + 1) % state.matches.length;';
   assert(original.includes(old));
   const replacement=kind==='mutant-skip'?'state.activeMatch = (state.activeMatch + 2) % state.matches.length;':'state.activeMatch = Math.min(state.activeMatch + 1, state.matches.length - 1);';
   await route.fulfill({response,body:original.replace(old,replacement)});
  });
  await p.goto('http://localhost:3000');await ready();await editor.click();
  await p.keyboard.press('Control+f');assert(await find.evaluate(e=>e===document.activeElement));
  await find.pressSequentially('NEXT');
  const initial=(await selection.count())?await line():null;
  if(initial!==null)assert([18,19,20].includes(initial));
  await p.keyboard.press('Enter');const first=await line();
  assert([18,19,20].includes(first));if(initial!==null)assert.equal(first,successor(initial));
  await p.keyboard.press('Enter');const second=await line();assert.equal(second,successor(first));
  await p.keyboard.press('Shift+Enter');const back=await line();assert.equal(back,first);
  await p.keyboard.press('Escape');assert(await editor.evaluate(e=>e===document.activeElement||e.contains(document.activeElement)));await copy('NEXT');
  result.observations.push({criterion:'keyboard_find_focus_and_cycle',initial,first,second,back,copied:'NEXT'});
  result.passed.push('Relative keyboard Find forward/backward, Escape focus and exact copy');
  await p.reload();await ready();await editor.click();const baseline=await allText();await p.reload();await ready();
  await find.fill('NEXT');assert(/\b3\b/.test(await count.innerText()));
  if(!(await selection.count()))await next.click();
  await restoreFocus();await copy('NEXT');const start=await line();assert([18,19,20].includes(start));
  let current=start;const cycle=[];
  for(let i=0;i<3;i++){await next.click();await restoreFocus();await copy('NEXT');const got=await line();assert.equal(got,successor(current));cycle.push(got);current=got;}
  assert.equal(current,start);assert.equal(new Set(cycle).size,3);
  for(let i=0;current!==18&&i<2;i++){await next.click();await restoreFocus();await copy('NEXT');current=await line();}
  assert.equal(current,18);await replace.fill('FOLLOWUP');await p.locator(auto?'#btn-replace-current':'#replace-current-btn').click();
  const afterOne=(await allText()).split('\n'),before=baseline.split('\n');
  assert.equal(afterOne[17],'FOLLOWUP: Replace temporary dashboard link before publishing.');
  assert.equal(afterOne[18],before[18]);assert.equal(afterOne[19],before[19]);
  await find.fill('ALPHA-00');assert(/\b99\b/.test(await count.innerText()));await replace.fill('INCIDENT-MARKER-00');
  assert.equal(await find.inputValue(),'ALPHA-00');assert.equal(await replace.inputValue(),'INCIDENT-MARKER-00');
  await p.locator(auto?'#btn-replace-all':'#replace-all-btn').click();
  const full=await allText(),lines=full.split('\n');
  assert.equal(full.split('INCIDENT-MARKER-00').length-1,99);
  assert(lines[23].includes('INCIDENT-MARKER-0001'));assert(lines[121].includes('INCIDENT-MARKER-0099'));
  assert(full.includes('ALPHA-0100'));assert(full.includes('ALPHA-1200'));assert.equal(full.split('OMEGA-END-ANCHOR').length-1,1);
  await p.reload();await ready();await editor.click();assert.equal(await allText(),baseline);
  result.observations.push({criterion:'find_replace_exact_counts_and_offsets',start,cycle,replaceTarget:current,replacements:99});
  result.passed.push('All three matches, exact wrap, line-18 Replace Current, exact 99 replacements and unchanged unsaved reload');
 }catch(e){result.errors.push(String(e));process.exitCode=1;}
 finally{fs.writeFileSync('/results/fair-find-'+kind+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await browser.close();}
})();
