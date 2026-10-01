'use strict';
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const report={scope:'Focused visual discrepancy diagnostic; no Oracle or visual grade',actions:[],captures:[],started_at:new Date().toISOString()};
const out='/evidence';
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);
  page.on('dialog',d=>d.accept());
  await page.goto('http://localhost:3000');await page.getByRole('textbox',{name:'Code editor',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'));
  await page.getByRole('checkbox',{name:'Auto-run'}).uncheck();
  const code="document.body.innerHTML='<h1>Preview ready</h1><p>Your code runs here.</p>';console.log('Visible action feedback');";
  await page.getByRole('textbox',{name:'Filename',exact:true}).fill('presentation.js');
  await page.getByRole('textbox',{name:'Code editor',exact:true}).click();await page.keyboard.press('Control+A');await page.keyboard.insertText(code);
  await page.getByRole('button',{name:/^Run(?:\s|$)/}).click();
  await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'));
  const frame=()=>page.frameLocator('iframe[title="Live preview"]');
  async function observation(){
   return {
    viewport:page.viewportSize(),status:await page.getByRole('status').innerText(),logs:await page.getByRole('log').innerText(),
    frame:await page.locator('iframe[title="Live preview"]').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {bounds:{x:r.x,y:r.y,width:r.width,height:r.height},visibility:s.visibility,display:s.display,opacity:s.opacity,background:s.background,color:s.color,colorScheme:s.colorScheme};}),
    body:await frame().locator('body').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {text:e.innerText,bounds:{x:r.x,y:r.y,width:r.width,height:r.height},visibility:s.visibility,display:s.display,opacity:s.opacity,background:s.background,color:s.color,colorScheme:s.colorScheme,children:Array.from(e.children).filter(x=>x.tagName!=='SCRIPT').map(x=>{const c=getComputedStyle(x),b=x.getBoundingClientRect();return {tag:x.tagName,text:x.innerText,color:c.color,visibility:c.visibility,display:c.display,opacity:c.opacity,bounds:{x:b.x,y:b.y,width:b.width,height:b.height}}})};})
   };
  }
  async function capture(label){
   const row={label,before:await observation()};
   await page.screenshot({path:path.join(out,label+'-viewport.png'),fullPage:false});
   await page.screenshot({path:path.join(out,label+'-full.png'),fullPage:true});
   await page.locator('iframe[title="Live preview"]').screenshot({path:path.join(out,label+'-frame.png')});
   row.after=await observation();report.captures.push(row);
  }
  await capture('dark');
  await page.getByRole('button',{name:'Light theme',exact:true}).click();await page.waitForTimeout(300);report.actions.push('Switch dark to light using normal theme control; wait 300 ms');
  await capture('light');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);report.actions.push('Resize to 390 by 844; wait 300 ms');
  await capture('mobile');
  report.completed=true;
 }finally{await browser.close();}
}
main().catch(e=>{report.error=e.stack;process.exitCode=1;}).finally(()=>{report.finished_at=new Date().toISOString();fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(report,null,2)+'\n');});
