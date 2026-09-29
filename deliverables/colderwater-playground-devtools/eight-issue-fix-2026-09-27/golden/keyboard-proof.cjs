const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const undocumented = process.env.CW_UNDOCUMENTED_ESCAPE === '1';
const prefix = undocumented ? 'undocumented-' : '';
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const report = { scope:'Real key events after ordinary UI preparation; no pointer or programmatic focus in the graded route', startedAt:new Date().toISOString(), checks:[], trace:[], pageErrors:[], writes:[] };
let browser,page;
const editor=()=>page.getByRole('textbox',{name:'Code editor',exact:true});
const title=()=>page.getByRole('textbox',{name:'Snippet title',exact:true});
const filename=()=>page.getByRole('textbox',{name:'Filename',exact:true});
async function focus() {return await page.evaluate(()=>{
  const e=document.activeElement,s=getComputedStyle(e),r=e.getBoundingClientRect();
  return {tag:e.tagName,role:e.getAttribute('role'),aria:e.getAttribute('aria-label'),text:e.textContent?.trim().slice(0,150),type:e.getAttribute('type'),outline:s.outline,outlineColor:s.outlineColor,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,focusVisible:e.matches(':focus-visible'),bounds:{x:r.x,y:r.y,width:r.width,height:r.height},value:'value' in e?e.value:null};
});}
async function key(value){await page.keyboard.press(value);const state=await focus();report.trace.push({key:value,state});return state;}
async function seek(accept,direction='Tab'){
  for(let i=0;i<45;i++){
    const state=await focus();if(accept(state))return state;
    if(state.aria==='Code editor')await key('Escape');
    await key(direction);
  }
  throw new Error('Could not reach keyboard target; last '+JSON.stringify(await focus()));
}
function visibleFocus(state){assert(state.focusVisible);assert.notEqual(state.outlineStyle,'none');assert(parseFloat(state.outlineWidth)>0);assert(state.bounds.width>0&&state.bounds.height>0);}
async function check(id,fn){const detail=await fn();report.checks.push({id,passed:true,...detail});console.log('PASS '+id);}
function luminance(rgb){const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
async function main(){
  browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium'});report.chromium=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('request',r=>{if(['POST','PUT','DELETE','PATCH'].includes(r.method()))report.writes.push({method:r.method(),url:r.url(),body:r.postData()});});
  page.on('dialog',()=>{throw new Error('Golden unexpectedly requires a dialog; its real native keyboard handling needs separate observation.');});
  await page.goto('http://localhost:3000');await editor().waitFor();
  await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'));
  await check('native_escape_optional_hint_and_served_build',async()=>{
    assert.equal(await editor().getAttribute('aria-describedby'),'keyboard-help');
    if (undocumented) { await page.locator('#keyboard-help').evaluate(e => e.textContent = e.textContent.replace('Escape, then Tab Leave editor · ', '')); assert.doesNotMatch(await page.locator('#keyboard-help').innerText(), /Escape/); } else assert.match(await page.locator('#keyboard-help').innerText(),/Escape, then Tab Leave editor/);
    assert.match(await page.locator('.offline').innerText(), /Local library/);
    assert.doesNotMatch(await page.locator('.offline').innerText(), /offline/i);
    const urls=await page.evaluate(()=>[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(e=>e.src||e.href));const hashes={};
    for(const url of urls){const response=await context.request.get(url);assert(response.ok());hashes[new URL(url).pathname]=crypto.createHash('sha256').update(await response.body()).digest('hex');}
    return{hashes};
  });
  const ownTitle='Keyboard own read control '+Date.now(),ownFilename='keyboard-control.js',ownCode='document.body.textContent="Keyboard read control";\nconsole.log("Keyboard read control");';
  await check('independent_empty_library_preparation',async()=>{
    assert.equal(await page.locator('.snippetlist button').count(),0);
    await page.getByRole('button',{name:'New',exact:true}).click();
    await title().fill(ownTitle);await filename().fill(ownFilename);await editor().click();await page.keyboard.press('Control+A');await page.keyboard.insertText(ownCode);
    const saved=page.waitForResponse(r=>r.url().endsWith('/api/snippets')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save',exact:true}).click();
    const response=await saved;assert.equal(response.status(),201);const item=await response.json();
    assert.equal(item.title,ownTitle);assert.equal(item.code,ownCode);assert.equal(item.revision,1);
    await page.locator('.snippetlist button').filter({hasText:ownTitle}).waitFor();
    await editor().click();
    return{initialLibraryEmpty:true,ownTitle,ownFilename,ownCode,record:item};
  });
  const writeCount=report.writes.length;
  await check('keyboard_only_editor_examples_library_return',async()=>{
    const original=await editor().innerText();
    await key('Escape');await key('Shift+Tab');
    const mainFocus=[];
    for(const target of [s=>s.tag==='BUTTON'&&s.text==='Save',s=>s.aria==='Filename',s=>s.aria==='Snippet title',s=>s.type==='checkbox',s=>s.tag==='BUTTON'&&s.text?.startsWith('Run'),s=>s.aria==='Starter example',s=>s.tag==='BUTTON'&&s.text==='Light theme']){
      const state=await seek(target,'Shift+Tab');visibleFocus(state);mainFocus.push(state);
    }
    await page.screenshot({path:'/work/'+prefix+'keyboard-theme-focus.png',fullPage:true});
    const picker=await seek(s=>s.aria==='Starter example');visibleFocus(picker);
    await key('Alt+ArrowDown');await key('Home');await key('ArrowDown');await key('Enter');
    await page.waitForFunction(()=>document.querySelector('input[aria-label="Filename"]').value==='counter.html');
    assert.notEqual(await editor().innerText(),original);assert.match(await editor().innerText(),/button|counter/i);
    await page.screenshot({path:'/work/'+prefix+'keyboard-example-selected.png',fullPage:true});
    const libraryFocus=await seek(s=>s.tag==='BUTTON'&&s.text?.startsWith(ownTitle));visibleFocus(libraryFocus);
    await page.screenshot({path:'/work/'+prefix+'keyboard-library-focus.png',fullPage:true});
    await key('Enter');
    await page.waitForFunction(expected=>document.querySelector('input[aria-label="Snippet title"]').value===expected,ownTitle);
    assert.equal(await editor().innerText(),ownCode);assert.equal(await filename().inputValue(),ownFilename);
    const returned=await seek(s=>s.aria==='Code editor','Shift+Tab');assert.equal(returned.aria,'Code editor');
    assert.equal(await editor().innerText(),original);assert.equal(report.writes.length,writeCount);
    await page.screenshot({path:'/work/'+prefix+'keyboard-editor-return.png',fullPage:true});
    return{onlyKeyboardActions:true,mainFocus,example:'counter.html',libraryFocus,returned,originalSourceUnchanged:true,noMutationDuringRoute:true,traceLength:report.trace.length};
  });
  await check('authored_run_after_keyboard_return',async()=>{
    await page.keyboard.press('Control+Enter');
    await page.frameLocator('iframe[title="Live preview"]').getByText('Keyboard read control',{exact:true}).waitFor();
    await page.getByRole('log').getByText('Keyboard read control',{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'));
    return{previewAndConsole:true};
  });
  await check('help_text_desktop_mobile_both_themes',async()=>{
    const views=[];
    for(const width of [1440,390])for(const theme of ['dark','light']){
      await page.setViewportSize({width,height:width===390?844:1000});
      if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:theme==='light'?'Light theme':'Dark theme',exact:true}).click();
      await page.locator('#keyboard-help').scrollIntoViewIfNeeded();
      const info=await page.locator('#keyboard-help').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),b=getComputedStyle(document.documentElement);return{text:e.textContent,color:s.color,background:b.backgroundColor,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight},pageWidth:document.documentElement.scrollWidth};});
      if (undocumented) assert.doesNotMatch(info.text,/Escape/); else assert.match(info.text,/Escape, then Tab Leave editor/);assert(info.rect.left>=0&&info.rect.right<=info.viewport.width+1);assert(info.rect.top>=0&&info.rect.bottom<=info.viewport.height+1);assert(info.pageWidth<=width+1);
      const l1=luminance(info.color),l2=luminance(info.background);info.contrast=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);assert(info.contrast>=4.5);
      if(width===390)assert(info.rect.height>=25);
      await page.screenshot({path:`/work/${prefix}keyboard-help-${theme}-${width}.png`,fullPage:true});views.push({width,theme,...info});
    }
    return{views};
  });
  assert.deepEqual(report.pageErrors,[]);report.undocumentedEscapeVariant=undocumented;report.variantScope=undocumented?'Only visible hint text removed from this temporary browser DOM before actual keyboard route; application handlers unchanged':'Shipped golden';report.passed=true;report.finishedAt=new Date().toISOString();
  fs.writeFileSync('/work/'+prefix+'keyboard-proof-results.json',JSON.stringify(report,null,2)+'\n');await browser.close();
}
main().catch(async e=>{report.passed=false;report.error=e.stack;fs.writeFileSync('/work/'+prefix+'keyboard-proof-results.json',JSON.stringify(report,null,2)+'\n');console.error(e);await browser?.close();process.exit(1);});
