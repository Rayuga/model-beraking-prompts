const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger}=require('./workflow_core.cjs');
const l=new ObservationLedger({scope:'Focused scripted regression evidence, not configured Oracle grading'});
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage(),d=new GoldenBrowser(p,l,'http://localhost:3000');await d.open();await d.disableAutoIfAvailable();
  await l.observe({id:'multiple_inline_handlers'},async()=>{
   await d.run('<html><body><button onclick="this.textContent=\'clicked\'" onkeydown="this.textContent=\'keyed\'">Two handlers</button></body></html>','two.html');
   const b=d.preview().getByRole('button');await b.click();assert.equal(await b.innerText(),'clicked');
   await b.press('a');assert.equal(await b.innerText(),'keyed');
   await b.click();assert.equal(await b.innerText(),'clicked');
   return {click:'clicked',keydown:'keyed',clickAgain:'clicked',status:await d.status()};
  });
  await l.observe({id:'filename_exact_roundtrip'},async()=>{
   const desired={title:'Filename roundtrip regression',filename:'  leading.js',code:'console.log("filename exact");'};
   const saved=(await d.create(desired)).record;assert.equal(saved.filename,desired.filename);
   await d.reload();await d.load(saved);assert.deepEqual(await d.fields(),desired);
   const history=await (await p.request.get(d.origin+'/api/snippets/'+saved.id+'/history')).json();
   assert.equal(history[0].filename,desired.filename);return {desired,loaded:await d.fields(),history};
  });
 }finally{await browser.close();}
}
main().catch(e=>{l.report.fatal=String(e);process.exitCode=1;}).finally(()=>{
 l.finish();l.report.passed=!l.report.fatal&&l.report.observations.every(x=>x.status==='observed pass');
 l.write('/evidence/golden-regressions.json');console.log(JSON.stringify(l.report));
});
