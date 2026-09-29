const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const out='/work';fs.mkdirSync(out,{recursive:true});
const report={started_at:new Date().toISOString(),criteria:[],exchanges:[],dialogs:[],errors:[]};
let browser,context,page,accept=true,answer='';const prefix='FullQC '+Date.now();
const ed=p=>p.getByRole('textbox',{name:'Code editor',exact:true});
const field=(name,p=page)=>p.getByRole('textbox',{name,exact:true});
const frame=()=>page.frameLocator('iframe[title="Live preview"]');
const log=()=>page.getByRole('log').innerText();
async function source(code,p=page){await ed(p).click();await p.keyboard.press('Control+A');await p.keyboard.insertText(code);}
async function complete(){await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'),null,{timeout:8000});}
async function run(code,name='fullqc.js'){await field('Filename').fill(name);await source(code);await page.getByRole('button',{name:/^Run/}).click();}
async function good(marker){await run("document.body.textContent="+JSON.stringify(marker)+";console.log("+JSON.stringify(marker)+");");await complete();await frame().getByText(marker,{exact:true}).waitFor();}
function attach(p){p.on('dialog',async d=>{report.dialogs.push({type:d.type(),message:d.message(),accept});accept?await d.accept(d.type()==='prompt'?answer:undefined):await d.dismiss();});p.on('pageerror',e=>report.errors.push(e.message));}
async function write(button='Save',p=page){const wait=p.waitForResponse(r=>['POST','PUT','DELETE'].includes(r.request().method())&&r.url().includes('/api/snippets'));await p.getByRole('button',{name:button,exact:true}).click();const r=await wait,b=await r.json();const x={url:r.url(),method:r.request().method(),request:r.request().postDataJSON(),status:r.status(),body:b};report.exchanges.push(x);return x;}
async function direct(url,method='GET',body){const x=await page.evaluate(async({url,method,body})=>{const r=await fetch(url,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json()}},{url,method,body});report.exchanges.push({url,method,request:body,...x});return x;}
async function create(label,code="console.log('control');",name='control.js'){await page.getByRole('button',{name:'New',exact:true}).click();await field('Snippet title').fill(prefix+' '+label);await field('Filename').fill(name);await source(code);const r=await write();assert.equal(r.status,201);return r.body;}
async function load(record,p=page){await p.locator('.snippetlist button').filter({hasText:record.title}).first().click();assert.equal(await field('Snippet title',p).inputValue(),record.title);}
async function read(record){return(await direct('/api/snippets/'+record.id)).body;}
async function exact(record,p=page){assert.equal(await field('Snippet title',p).inputValue(),record.title);assert.equal(await field('Filename',p).inputValue(),record.filename);assert.equal(await ed(p).innerText(),record.code);}
async function check(id,fn){const details=await fn();report.criteria.push({id,passed:true,...details});console.log('PASS '+id);}
async function hoverProof(){const button=page.getByRole('button',{name:/^Run/});await button.hover();const value=await button.evaluate(e=>{const s=getComputedStyle(e);const lum=v=>{const rgb=v.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};const a=lum(s.color),b=lum(s.backgroundColor);return{color:s.color,background:s.backgroundColor,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),theme:document.documentElement.dataset.theme,width:innerWidth}});assert(value.contrast>=4.5);(report.runHover??=[]).push(value);}

async function main(){
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium'});report.browser=browser.version();
 context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();attach(page);
 await page.goto('http://localhost:3000');await ed(page).waitFor();await complete();await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();
 await check('cw_theme_switch_legibility',async()=>{
  await good('theme-control-preview');await run("document.body.textContent='theme-control-preview';console.log('theme-control-log');",'theme-proof.js');await complete();
  const state=async()=>({title:await field('Snippet title').inputValue(),filename:await field('Filename').inputValue(),code:await ed(page).innerText(),preview:await frame().locator('body').innerText(),console:await log()});
  const palette=async()=>page.evaluate(()=>Object.fromEntries(['body','.cm-editor','.entries'].map(selector=>{const e=document.querySelector(selector),s=getComputedStyle(e);return[selector,{background:s.backgroundColor,color:s.color}]})));
  const before=await state(),first=await palette();await hoverProof();await page.screenshot({path:out+'/desktop-theme-a.png',fullPage:true});await page.getByRole('button',{name:/^(Light|Dark) theme$/}).click();assert.deepEqual(await state(),before);const other=await palette();const dirtyColor=await page.locator('.paneheading .dirty').first().evaluate(e=>getComputedStyle(e).color);assert.equal(dirtyColor,'rgb(134, 88, 8)');for(const key of Object.keys(first))assert.notDeepEqual(other[key],first[key]);await hoverProof();await page.screenshot({path:out+'/desktop-theme-b.png',fullPage:true});await page.getByRole('button',{name:/^(Light|Dark) theme$/}).click();assert.deepEqual(await state(),before);assert.deepEqual(await palette(),first);return{before,firstPalette:first,otherPalette:other,restored:true};
 });
 await check('polish_all_and_rendered_visual_surfaces',async()=>{
  const labels=['Filename','Snippet title'];for(const name of labels)assert.equal(await field(name).count(),1);assert.equal(await page.getByRole('checkbox',{name:'Auto-run',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:/^Run/}).count(),1);
  const focused=[];await page.locator('body').click({position:{x:4,y:4}});for(let i=0;i<7;i++){await page.keyboard.press('Tab');const f=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return{tag:e.tagName,text:(e.getAttribute('aria-label')||e.textContent||'').slice(0,70),outline:s.outline,boxShadow:s.boxShadow,focusVisible:e.matches(':focus-visible')}});if(f.focusVisible)focused.push(f);}assert(focused.length>=3);await page.screenshot({path:out+'/keyboard-focus.png',fullPage:true});
  const mobile=[];await page.setViewportSize({width:390,height:844});
  for(let t=0;t<2;t++){await hoverProof();await page.screenshot({path:out+'/mobile-theme-'+t+'.png',fullPage:true});for(const[name,selector]of[['editor','.editor'],['library','.library'],['preview','.preview'],['console','.console']]){await page.locator(selector).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile-'+name+'-'+t+'.png'});assert(await page.locator(selector).isVisible());}await frame().getByText('theme-control-preview',{exact:true}).waitFor();mobile.push({theme:await page.locator('html').getAttribute('data-theme'),previewVisible:true,rootWidth:await page.evaluate(()=>document.documentElement.scrollWidth),viewport:390});await page.getByRole('button',{name:/^(Light|Dark) theme$/}).click();}
  await page.getByRole('button',{name:'Clear console',exact:true}).click();assert.equal(await page.locator('.entry').count(),0);assert.match(await log(),/Console is clear/);await field('Filename').fill('mobile.js');await source("document.body.textContent='mobile-reachable';console.log('mobile-reachable');");await page.getByRole('button',{name:/^Run/}).click();await complete();await frame().getByText('mobile-reachable',{exact:true}).waitFor();assert((await log()).includes('mobile-reachable'));await page.locator('.preview').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile-live-preview.png'});return{focused,mobile,runMobile:true,clearFeedback:true,labels:true,recognizableSurfaces:true};
 });
 assert.deepEqual(report.errors,[]);report.passed=true;
}
main().catch(async e=>{report.passed=false;report.error=e.stack;console.error(e);if(page)await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});process.exitCode=1}).finally(async()=>{report.finished_at=new Date().toISOString();fs.writeFileSync(out+'/presentation-results.json',JSON.stringify(report,null,2));if(browser)await browser.close()});
