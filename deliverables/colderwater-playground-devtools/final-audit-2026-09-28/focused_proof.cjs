'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const mode=process.env.CW_CASE||'golden',out=process.env.CW_RESULT;
const url='http://localhost:3000';
const report={scope:'Focused direct Playwright observations; no LLM/provider/platform or full Oracle run',case:mode,started_at:new Date().toISOString(),observations:{},expected_behavior_observed:false};
const fields=async p=>({title:await p.getByRole('textbox',{name:'Snippet title',exact:true}).inputValue(),filename:await p.getByRole('textbox',{name:'Filename',exact:true}).inputValue(),code:(await p.getByRole('textbox',{name:'Code editor',exact:true}).locator('.cm-line').allTextContents()).join('\n')});
async function edit(p,record){await p.getByRole('textbox',{name:'Snippet title',exact:true}).fill(record.title);await p.getByRole('textbox',{name:'Filename',exact:true}).fill(record.filename);const e=p.getByRole('textbox',{name:'Code editor',exact:true});await e.click();await p.keyboard.press('Control+A');await p.keyboard.insertText(record.code);assert.deepEqual(await fields(p),record);}
async function save(p){const pending=p.waitForResponse(r=>['POST','PUT'].includes(r.request().method())&&new URL(r.url()).origin===url);await p.getByRole('button',{name:'Save',exact:true}).click();const response=await pending;let data=null;try{data=await response.json();}catch{}return{ok:response.ok(),status:response.status(),data};}
async function load(p,title){await p.locator('.snippetlist button').filter({hasText:title}).click();}
async function staleSave(browser){
  const aContext=await browser.newContext({viewport:{width:1440,height:1000}}),bContext=await browser.newContext({viewport:{width:1440,height:1000}}),a=await aContext.newPage(),b=await bContext.newPage();
  try{
    await a.goto(url);await a.getByRole('textbox',{name:'Code editor',exact:true}).waitFor();const auto=a.getByRole('checkbox',{name:'Auto-run',exact:true});if(await auto.isChecked())await auto.uncheck();
    await a.getByRole('button',{name:'New',exact:true}).click();const base={title:'QC Focus Save Base',filename:'qc-focus-save.js',code:"console.log('base');"};await edit(a,base);const created=await save(a);assert(created.ok);
    await b.goto(url);await b.getByRole('textbox',{name:'Code editor',exact:true}).waitFor();const autoB=b.getByRole('checkbox',{name:'Auto-run',exact:true});if(await autoB.isChecked())await autoB.uncheck();await load(b,base.title);
    const dirty={title:'QC Focus Save Draft',filename:'qc-focus-save-draft.js',code:"console.log('stale-draft');"};await edit(b,dirty);const dirtyBefore=await fields(b);
    await load(a,base.title);const winner={title:'QC Focus Save Current',filename:'qc-focus-save-current.html',code:'<!doctype html><html><body>winner</body></html>'};await edit(a,winner);const advanced=await save(a);assert(advanced.ok);
    const stale=await save(b);assert(!stale.ok&&stale.status===409,'Expected actual stale Save refusal');await b.getByRole('alert').waitFor();const retained=await fields(b);const exactRetained=JSON.stringify(retained)===JSON.stringify(dirtyBefore);
    const reload=b.getByRole('button',{name:'Reload latest',exact:true});await reload.click();const latest=await fields(b);const restore=b.getByRole('button',{name:'Restore previous draft',exact:true});const restoreOffered=await restore.count()===1;if(restoreOffered)await restore.click();if(JSON.stringify(await fields(b))!==JSON.stringify(dirty))await edit(b,dirty);const reapplied=await fields(b);const recovered=await save(b);await b.reload();await load(b,dirty.title);const loaded=await fields(b);
    const recoveryPass=recovered.ok&&recovered.data.id===created.data.id&&JSON.stringify(reapplied)===JSON.stringify(dirty)&&JSON.stringify(loaded)===JSON.stringify(dirty);
    return{server_refusal:true,dirty_before:dirtyBefore,retained,exact_all_three_retained:exactRetained,latest_loaded:latest,restore_control_offered:restoreOffered,recovery_pass:recoveryPass,identity_preserved:recovered.data?.id===created.data.id,product_pass:exactRetained&&recoveryPass};
  }finally{await aContext.close();await bContext.close();}
}
const keyOf=async p=>p.evaluate(()=>{const e=document.activeElement;if(!e)return null;const text=(e.getAttribute('aria-label')||e.innerText||e.value||e.getAttribute('title')||'').trim().replace(/\s+/g,' ');const style=getComputedStyle(e);return{tag:e.tagName.toLowerCase(),type:e.getAttribute('type'),name:text,role:e.getAttribute('role'),focus_visible:e.matches(':focus-visible'),outline:style.outlineStyle+' '+style.outlineWidth};});
async function keyboard(browser){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage();
  try{
    await p.goto(url);await p.getByRole('textbox',{name:'Code editor',exact:true}).waitFor();const auto=p.getByRole('checkbox',{name:'Auto-run',exact:true});if(await auto.isChecked())await auto.uncheck();
    await p.getByRole('button',{name:'New',exact:true}).click();const own={title:'QC Keyboard Focus Record',filename:'qc-keyboard-focus.js',code:"console.log('keyboard-focus');"};await edit(p,own);assert((await save(p)).ok);
    await p.getByRole('textbox',{name:'Code editor',exact:true}).click();await p.keyboard.press('Escape');await p.keyboard.press('Tab');
    const seen=[];let exampleActivated=false,recordActivated=false;
    for(let i=0;i<45;i++){
      const current=await keyOf(p);if(current)seen.push(current);
      if(!exampleActivated&&current?.tag==='select'){await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');exampleActivated=true;}
      if(exampleActivated&&!recordActivated&&current?.tag==='button'&&current.name.includes(own.title)){await p.keyboard.press('Enter');recordActivated=true;}
      await p.keyboard.press('Tab');
    }
    const controls=seen.filter(x=>['button','input','select','a'].includes(x.tag)||['button','menuitem'].includes(x.role));const labels=controls.map(x=>x.name.toLowerCase());const has=s=>labels.some(x=>x.includes(s));
    const expected={title:has('snippet title')||has('title'),filename:has('filename'),run:has('run'),stop:has('stop'),auto_run:controls.some(x=>x.type==='checkbox'),clear:has('clear console'),theme:has('theme'),examples:controls.some(x=>x.tag==='select'),saved_loading:has(own.title.toLowerCase()),new:labels.some(x=>x==='new'),save:labels.some(x=>x==='save'),rename:labels.some(x=>x==='rename'),duplicate:labels.some(x=>x==='duplicate'),delete:labels.some(x=>x==='delete'),import:has('import file'),export:has('export file')};
    const allReachable=Object.values(expected).every(Boolean),visibleFocus=seen.filter(x=>Object.values(expected).some(Boolean)).some(x=>x.focus_visible&&x.outline!=='none 0px');
    return{expected,all_requested_controls_keyboard_reachable:allReachable,example_activated:exampleActivated,saved_record_activated:recordActivated,loaded_fields:await fields(p),visible_focus_observed:visibleFocus,focus_sequence:seen,product_pass:allReachable&&exampleActivated&&recordActivated&&visibleFocus};
  }finally{await context.close();}
}
async function main(){const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});try{report.observations.stale_save=await staleSave(browser);report.observations.keyboard=await keyboard(browser);const s=report.observations.stale_save,k=report.observations.keyboard;if(mode==='golden')report.expected_behavior_observed=s.product_pass&&k.product_pass;else if(mode==='save-conflict-loses-metadata')report.expected_behavior_observed=s.server_refusal&&!s.exact_all_three_retained&&s.retained.code===s.dirty_before.code&&k.product_pass;else if(mode==='export-mouse-only')report.expected_behavior_observed=s.product_pass&&!k.expected.export&&!k.product_pass;else throw Error('unknown mode '+mode);}finally{await browser.close();}}
main().catch(e=>{report.error=String(e);report.stack=e.stack;process.exitCode=1;}).finally(()=>{report.finished_at=new Date().toISOString();fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({case:mode,expected:report.expected_behavior_observed,stale_save:report.observations.stale_save?.product_pass,keyboard:report.observations.keyboard?.product_pass,error:report.error}));if(!report.expected_behavior_observed)process.exitCode=1;});
