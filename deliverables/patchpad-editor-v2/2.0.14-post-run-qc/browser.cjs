const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1280,height:800}});
 const p=await ctx.newPage(),kind=process.argv[2],r={kind,observations:[],scope:'Unchanged exported source, local supplied dependencies, no LLM regrade'};
 async function clipboard(expected){await p.keyboard.press('Control+c');await p.waitForFunction(async x=>await navigator.clipboard.readText()===x,expected);return p.evaluate(()=>navigator.clipboard.readText());}
 try{
  await p.goto('http://localhost:3000');
  if(kind==='oracle'){
   await p.waitForFunction(()=>document.querySelector('#doc-title').textContent==='Northwind API Incident Report');
   const find=async q=>{await p.locator('#find-box').fill(q);await p.keyboard.press('Enter');await p.keyboard.press('Escape');await clipboard(q);};
   await find('OMEGA-END-ANCHOR');await p.keyboard.press('End');await p.keyboard.press('Enter');
   const sample='UNICODE-NAV:A\u{1f642}e\u0301B';await p.evaluate(s=>navigator.clipboard.writeText(s),sample);await p.keyboard.press('Control+v');
   await p.waitForFunction(s=>[...document.querySelectorAll('#editor .text')].at(-1).dataset.lineText===s,sample);
   // Establish a prior e+accent selection, matching the stale value mentioned
   // in the exported failure, then enter the complete new query afresh.
   await find('e\u0301');await find('A\u{1f642}e\u0301B');await p.keyboard.press('ArrowLeft');
   const observed=[];
   for(const s of ['A','\u{1f642}','e\u0301']){await p.keyboard.press('Shift+ArrowRight');observed.push(await clipboard(s));await p.keyboard.press('ArrowRight');}
   assert.deepEqual(observed,['A','\u{1f642}','e\u0301']);r.observations.push({case:'Full Unicode Find selection then exact grapheme navigation after prior e+accent selection',passed:true,clipboard:observed});
  }else{
   await p.waitForFunction(()=>document.querySelectorAll('.editor-line').length>0);
   const input=p.locator('#find-input');await input.fill('NEXT');
   await p.waitForTimeout(100);
   r.observations.push({case:'Find automatically selects a match on query input',count:await p.locator('#find-count').innerText(),cursor:await p.locator('#cursor-pos').innerText()});
   await p.keyboard.press('Escape');await clipboard('NEXT');
   await p.keyboard.press('Control+f');await input.fill('');await input.pressSequentially('NEXT');
   const seq=[];
   for(const key of ['Enter','Enter','Shift+Enter']){await p.keyboard.press(key);seq.push({key,count:await p.locator('#find-count').innerText(),cursor:await p.locator('#cursor-pos').innerText()});}
   r.observations.push({case:'Keyboard Find sequence under auto-select convention',sequence:seq});
   await p.keyboard.press('Escape');await p.keyboard.press('Control+End');await p.keyboard.press('End');await p.keyboard.press('Enter');await p.keyboard.type('NORTH WIND');
   await p.keyboard.press('Home');await p.keyboard.press('Control+ArrowRight');const first=await p.locator('#cursor-pos').innerText();
   await p.keyboard.press('Home');await p.keyboard.press('Control+Shift+ArrowRight');const right=await clipboard('NORTH ');
   await p.keyboard.press('End');await p.keyboard.press('Control+ArrowLeft');const left=await p.locator('#cursor-pos').innerText();
   await p.keyboard.press('End');await p.keyboard.press('Control+Shift+ArrowLeft');const back=await clipboard('WIND');
   r.observations.push({case:'Full word-navigation criterion with required second Home',passed:true,first,right,left,back});
  }
  await p.screenshot({path:'/results/browser.png'});
 }catch(e){r.error=String(e);process.exitCode=1;}finally{fs.writeFileSync('/results/browser.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));await browser.close();}
})();
