const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const mode=process.env.MOCK_MODE;
const report={kind:'Independent actual-browser negative control; not an official or paid judge result',mode,checks:[],requests:[],started_at:new Date().toISOString()};
const out='/evidence';
function check(name, passed, evidence={}){report.checks.push({name,passed:!!passed,evidence});fs.writeFileSync(out+'/'+mode+'-progress.json',JSON.stringify(report,null,2)+'\n');console.log(name+': '+passed);assert(passed,name);}
async function responseJson(response){let timer;try{return await Promise.race([response.json(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Response body timeout')),10000);})]);}finally{clearTimeout(timer);}}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 report.browser=browser.version();
 const context=await browser.newContext();context.setDefaultTimeout(10000);const page=await context.newPage();
 page.on('request',r=>{if(r.method()==='POST')report.requests.push({method:r.method(),url:r.url(),body:r.postData()});});
 try{
  const health=await page.goto('http://localhost:3000/api/health');check('old health-only constraint observation succeeds',health.status()===200,{status:health.status()});
  const list=page.waitForResponse(r=>r.url().endsWith('/api/snippets')&&r.request().method()==='GET');await page.goto('http://localhost:3000/');await list;
  check('old surface-only render observations succeed',await page.getByRole('textbox',{name:'Source code'}).isVisible()&&await page.getByRole('heading',{name:'Preview',exact:true}).isVisible()&&await page.getByRole('heading',{name:'Console',exact:true}).isVisible()&&await page.getByRole('button',{name:'Run',exact:true}).isVisible());
  const marker='QC-run-'+crypto.randomUUID();const source="document.body.textContent='"+marker+"';\nconsole.log('"+marker+"');";report.run_marker=marker;
  await page.getByRole('textbox',{name:'Source code'}).fill(source);await page.getByRole('button',{name:'Run',exact:true}).click();
  if(mode==='inert'){
   await page.waitForTimeout(500);
   const previewText=await page.frameLocator('#preview').locator('body').innerText();const consoleText=await page.locator('#console').innerText();
   check('authored Run marker is absent despite editable source and button feedback',!previewText.includes(marker)&&!consoleText.includes(marker)&&await page.locator('#status').innerText()==='Run button acknowledged',{previewText,consoleText,status:await page.locator('#status').innerText()});
   report.new_render_prerequisite_satisfied=false;
   await page.screenshot({path:out+'/inert-run-noop.png',fullPage:true});
  }else{
   await page.frameLocator('#preview').getByText(marker,{exact:true}).waitFor();await page.locator('#console').filter({hasText:marker}).waitFor();check('render positive control really executes new authored JS',true,{marker});
   const title='QC Shared '+crypto.randomUUID();report.saved_title=title;report.saved_source=source;
   await page.getByLabel('Title',{exact:true}).fill(title);await page.getByLabel('Filename',{exact:true}).fill('gate.js');
   const write=page.waitForResponse(r=>r.url().endsWith('/api/snippets')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save',exact:true}).click();const written=await write;const receipt=await responseJson(written);
   await page.getByRole('button',{name:title,exact:true}).waitFor();check('UI saved a unique snippet after a no-op successful server response',written.status()===201&&receipt.title===title,{status:written.status(),id:receipt.id,title});
   await page.reload();await page.getByRole('button',{name:title,exact:true}).click();await page.getByRole('status').filter({hasText:'Loaded '+title+' from browser memory'}).waitFor();check('original context reload and load retain exact browser-only title and source',await page.getByLabel('Title',{exact:true}).inputValue()===title&&await page.getByRole('textbox',{name:'Source code'}).inputValue()===source,{title,source});
   await page.screenshot({path:out+'/client-library-original-context.png',fullPage:true});
   const cleanContext=await browser.newContext();cleanContext.setDefaultTimeout(10000);const storage=await cleanContext.storageState();check('second context starts without copied cookies or origin storage',storage.cookies.length===0&&storage.origins.length===0,storage);
   const clean=await cleanContext.newPage();const cleanRead=clean.waitForResponse(r=>r.url().endsWith('/api/snippets')&&r.request().method()==='GET');await clean.goto('http://localhost:3000/');const readResponse=await cleanRead;const data=await responseJson(readResponse);await clean.getByText('No saved snippets',{exact:true}).waitFor();
   check('fresh context cannot retrieve the supposedly saved record from server',data.length===0&&await clean.getByRole('button',{name:title,exact:true}).count()===0,{status:readResponse.status(),serverList:data,visibleLibrary:await clean.locator('#library').innerText()});
   await clean.reload();await clean.getByText('No saved snippets',{exact:true}).waitFor();check('fresh-context reload still cannot retrieve the saved title/source',await clean.getByRole('button',{name:title,exact:true}).count()===0&&await clean.getByRole('textbox',{name:'Source code'}).inputValue()!==source);
   await clean.screenshot({path:out+'/client-library-independent-context.png',fullPage:true});await cleanContext.close();report.new_render_prerequisite_satisfied=true;report.new_server_storage_prerequisite_satisfied=false;
  }
  report.old_gate_observations_satisfied=true;report.negative_witness_passed=true;
 }catch(error){report.failure=error.stack;process.exitCode=1;}
 finally{report.finished_at=new Date().toISOString();fs.writeFileSync(out+'/'+mode+'-negative-evidence.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify(report,null,2));
})();
