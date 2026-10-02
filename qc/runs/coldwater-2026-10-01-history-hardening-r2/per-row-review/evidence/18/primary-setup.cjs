const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger}=require('./drivers/workflow_core.cjs');
const report={scope:'Reviewer 18 independent S22 Primary fixture and complete pre-restart collection',checks:{}};
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});try{
const context=await browser.newContext(),page=await context.newPage(),ledger=new ObservationLedger({scope:report.scope}),d=new GoldenBrowser(page,ledger,'http://localhost:3000');await d.open();
const primary=(await d.create({title:'QC Restart Primary',filename:'restart.js',code:"console.log('restart-original');"})).record;
await d.enter("console.log('restart-before-restart');",'restart.js');const updated=(await d.save()).record;assert(updated.revision>primary.revision);
const state=JSON.parse(fs.readFileSync('/evidence/history-state.json'));state.library=await(await page.request.get(d.origin+'/api/snippets')).json();state.histories={};for(const r of state.library)state.histories[r.id]=await(await page.request.get(d.origin+'/api/snippets/'+r.id+'/history')).json();
assert(state.library.some(x=>x.title==='QC Save Beta'&&x.filename==='qc-beta.html'&&x.code==='<!doctype html><html><body><p>beta-body</p></body></html>'));assert(state.library.some(x=>x.title==='QC Save Alpha'&&x.filename==='qc-alpha.js'));assert(state.library.some(x=>x.title.startsWith('CW gate ')));state.primary=updated;
fs.writeFileSync('/evidence/history-state.json',JSON.stringify(state,null,2));report.checks={created:primary,updated,record_count:state.library.length,html_beta_present:true,alpha_present:true,gate_present:true};report.passed=true;
}finally{await browser.close();}})().catch(e=>{report.error=e.stack;process.exitCode=1;}).finally(()=>{fs.writeFileSync('/evidence/primary-setup.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));});