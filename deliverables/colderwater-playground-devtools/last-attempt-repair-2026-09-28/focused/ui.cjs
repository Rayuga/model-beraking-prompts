const fs=require('fs'),assert=require('assert/strict');
const{chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const{GoldenBrowser,ObservationLedger}=require('./workflow_core.cjs');
const result={scope:'Actual golden browser gates and usability; no judge score',checks:[],focus:[]};
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),ledger=new ObservationLedger(),d=new GoldenBrowser(page,ledger,'http://localhost:3000');
  await d.open();await d.completed();await d.disableAutoIfAvailable();
  const mark='CW browser '+Date.now(),source=`document.body.textContent=${JSON.stringify(mark)};console.log(${JSON.stringify(mark)});`;
  await d.run(source,'gate.js');assert.equal(await d.body(),mark);assert((await d.logs()).includes(mark));result.checks.push('render_authored_DOM_and_console');
  const record=(await d.create({title:'CW gate '+Date.now(),filename:'gate.js',code:source})).record;
  const clean=await browser.newContext(),other=new GoldenBrowser(await clean.newPage(),ledger,d.url);
  other.libraryUrl=d.libraryUrl;
  await other.open();await other.load(record);await other.reload();await other.load(record);assert((await other.library()).some(r=>r.id===record.id&&r.code===source));await clean.close();
  result.checks.push('constraints_independent_context_server_read_and_reload');
  const purposes=[['title',d.title()],['filename',d.filename()],['Run',page.getByRole('button',{name:/^Run /})],['Stop',page.getByRole('button',{name:'Stop',exact:true})],['Auto-run',page.getByRole('checkbox',{name:'Auto-run'})],['Clear',page.getByRole('button',{name:'Clear console'})],['theme',page.getByRole('button',{name:/^(Light|Dark) theme$/})],['examples',page.getByRole('combobox',{name:'Starter example'})],['saved',page.getByRole('button',{name:new RegExp(record.title)})],['New',page.getByRole('button',{name:'New',exact:true})],['Save',page.getByRole('button',{name:'Save',exact:true})]];
  for(const [name,loc]of purposes)assert.equal(await loc.count(),1,name);
  result.checks.push('requested_controls_named');
  await d.editor().click();await page.keyboard.press('Escape');
  async function reach(locator){for(let i=0;i<90;i++){await page.keyboard.press('Tab');if(await locator.evaluate(e=>e===document.activeElement))return; if(await d.editor().evaluate(e=>e===document.activeElement))await page.keyboard.press('Escape');}throw Error('Keyboard target not reached');}
  for(const[name,loc]of purposes){await reach(loc);const focus=await loc.evaluate(e=>({outline:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth}));result.focus.push({name,...focus});assert.notEqual(focus.outline,'none',name);}
  result.checks.push('requested_controls_keyboard_reachable','visible_focus');
  const picker=page.getByRole('combobox',{name:'Starter example'});await reach(picker);await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  const example=await d.source();assert(example&&example!==source);await reach(page.getByRole('button',{name:new RegExp(record.title)}));await page.keyboard.press('Enter');assert.equal(await d.source(),source);
  await reach(d.editor());result.checks.push('keyboard_example_saved_snippet_editor_route');
  await page.getByRole('button',{name:/^Run /}).click();await d.completed();assert(/Complete.*\d/.test(await d.status()));result.checks.push('ordinary_action_feedback');
  for(const name of ['Code editor','Live preview','Console'])assert(await page.getByRole(name==='Code editor'?'textbox':'region',{name,exact:true}).count());
  result.checks.push('workspace_surfaces_identifiable');
  await page.screenshot({path:'/work/desktop-dark.png',fullPage:true});
  await page.getByRole('button',{name:/^(Light|Dark) theme$/}).click();await page.screenshot({path:'/work/desktop-light.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  for(const[name,loc]of purposes){await loc.scrollIntoViewIfNeeded();assert(await loc.isVisible(),name);const box=await loc.boundingBox();assert(box.x>=-1&&box.x+box.width<=391,name);}
  await d.run("document.body.textContent='mobile-working';console.log('mobile-working');",'mobile.js');assert.equal(await d.body(),'mobile-working');
  result.checks.push('mobile_controls_and_execution');await page.screenshot({path:'/work/mobile.png',fullPage:true});result.passed=true;
 }finally{await browser.close();}
}
main().catch(e=>{result.passed=false;result.error=String(e);process.exitCode=1;console.error(e);}).finally(()=>{fs.writeFileSync('/work/ui-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
