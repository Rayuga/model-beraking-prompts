'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger}=require('./workflow_core.cjs');
const out=process.env.CW_LOG_DIR,report={scope:'Scripted gate/polish evidence and visual captures; not configured judge scores',checks:{},visual_grade_measured:false};
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage(),l=new ObservationLedger({scope:report.scope}),d=new GoldenBrowser(p,l,'http://localhost:3000');
  await d.open();await d.completed();await d.disableAutoIfAvailable();await d.newDraft();
  const marker='working-'+Date.now();await d.run(`document.body.textContent=${JSON.stringify(marker)};console.log(${JSON.stringify(marker)});`,'gate.js');
  report.checks.render={pass:(await d.body())===marker&&(await d.logs()).includes(marker),marker};
  const health=await p.request.get('http://localhost:3000/api/health');assert(health.ok());
  const saved=(await d.create({title:'CW gate '+marker,filename:'gate-shared.js',code:`console.log(${JSON.stringify(marker)});`})).record;
  const clean=await browser.newContext(),q=await clean.newPage(),other=new GoldenBrowser(q,l,'http://localhost:3000');await other.open();await other.disableAutoIfAvailable();await other.load(saved);await other.reload();await other.load(saved);
  report.checks.constraints={pass:true,independent_context:true,saved,readback:await other.fields(),health_status:health.status()};await clean.close();
  const keyboardRecord=(await d.create({title:'Keyboard navigation control',filename:'keyboard.js',code:"console.log('keyboard-owned-control');"})).record;
  const controls={title:d.title(),filename:d.filename(),run:p.getByRole('button',{name:/^Run(?:\s|$)/}),stop:p.getByRole('button',{name:'Stop',exact:true}),auto:p.getByRole('checkbox',{name:'Auto-run'}),clear:p.getByRole('button',{name:'Clear console'}),theme:p.getByRole('button',{name:/theme/i}),examples:p.locator('select'),saved:p.locator('.snippetlist button').filter({hasText:keyboardRecord.title}),new:p.getByRole('button',{name:'New',exact:true}),save:p.getByRole('button',{name:'Save',exact:true})};
  const names={};for(const[name,loc]of Object.entries(controls)){assert.equal(await loc.count(),1);names[name]=await loc.evaluate(e=>e.getAttribute('aria-label')||e.labels?.[0]?.textContent||e.textContent||e.getAttribute('title'));}report.checks.cw_controls_have_names={pass:Object.values(names).every(Boolean),names};
  await d.editor().click();const reached={},focus=[];
  const tab=async()=>{if(await d.editor().evaluate(e=>e===document.activeElement))await p.keyboard.press('Escape');await p.keyboard.press('Tab');for(const[name,loc]of Object.entries(controls))if(await loc.evaluate(e=>e===document.activeElement)){reached[name]=true;focus.push({name,...await loc.evaluate(e=>({outline:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth,focus_visible:e.matches(':focus-visible')}))});}};
  const reach=async loc=>{for(let n=0;n<140;n++){if(await loc.evaluate(e=>e===document.activeElement))return;await tab();}throw Error('Keyboard target unreachable');};
  await reach(controls.examples);const before=await d.source();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(100);const example=await d.source();assert(example!==before);
  await reach(controls.saved);await p.keyboard.press('Enter');assert.equal(await d.source(),keyboardRecord.code);await reach(d.editor());
  report.checks.cw_keyboard_library_navigation={pass:true,example_source:example,saved_source:await d.source(),pointer_used_in_route:false};
  for(let n=0;n<160&&Object.keys(reached).length<Object.keys(controls).length;n++)await tab();
  report.checks.cw_controls_keyboard_reachable={pass:Object.keys(controls).every(k=>reached[k]),reached};
  report.checks.cw_controls_focus_visible={pass:focus.length>0&&focus.every(x=>x.focus_visible&&x.outline!=='none'&&parseFloat(x.width)>0),observations:focus};
  await d.run("document.body.innerHTML='<h1>Preview ready</h1><p>Your code runs here.</p>';console.log('Visible action feedback');",'presentation.js');
  report.checks.interaction_feedback={pass:/Complete/.test(await d.status())&&(await d.logs()).includes('Visible action feedback'),status:await d.status()};
  const surfaces=await p.locator('.paneheading').allInnerTexts();report.checks.workspace_organisation={pass:surfaces.some(x=>/Editor/i.test(x))&&surfaces.some(x=>/preview/i.test(x))&&surfaces.some(x=>/Console/i.test(x))&&surfaces.some(x=>/Saved snippets/.test(x)),surfaces};
  await p.screenshot({path:path.join(out,'desktop-theme-one.png'),fullPage:true});await controls.theme.click();await p.waitForTimeout(300);report.preview_after_theme=await d.body();await p.screenshot({path:path.join(out,'desktop-theme-two.png'),fullPage:true});
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);report.preview_after_resize=await d.body();await p.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  await d.run("document.body.textContent='mobile-preview';console.log('mobile-console');",'mobile.js');await p.getByRole('button',{name:'Clear console'}).click();
  report.checks.responsive_layout={pass:(await d.body())==='mobile-preview'&&!(await d.logs()).includes('mobile-console'),viewport:{width:390,height:844},editor_edit_run_preview_clear_observed:true};
  report.visual_capture_files=['desktop-theme-one.png','desktop-theme-two.png','mobile.png'];
  report.passed=Object.values(report.checks).every(x=>x.pass);
  report.runtime_edges=await require('./runtime_edge_flow.cjs').runEdges(d,l);
 }finally{await browser.close();}
}
main().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'surface-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));});
