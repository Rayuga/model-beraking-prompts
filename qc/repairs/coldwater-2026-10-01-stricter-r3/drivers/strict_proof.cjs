const fs=require('node:fs'),{chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger}=require('./workflow_core.cjs');
const dir='/evidence',phase=process.argv[2]||'history',l=new ObservationLedger({phase,scope:'Scripted golden proof, not a configured judge run'}),facts={};
const emit=(key,pass,evidence)=>{facts[key]={passed:!!pass,evidence};fs.writeFileSync(dir+'/'+phase+'-progress.json',JSON.stringify(facts,null,2));};
async function main(){const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),d=new GoldenBrowser(p,l,'http://localhost:3000');await d.open();
 if(['history','post'].includes(phase))await require('./history_proof.cjs').runHistory(d,l,emit,phase,dir);
 else await require('./retained_proof.cjs').runRetained(d,l,emit,dir);
 await p.screenshot({path:dir+'/'+phase+'-desktop.png',fullPage:true});await p.setViewportSize({width:390,height:844});await p.screenshot({path:dir+'/'+phase+'-mobile.png',fullPage:true});
 }finally{await browser.close();}}
main().catch(e=>{l.report.fatal=String(e);l.report.stack=e.stack;process.exitCode=1;}).finally(()=>{l.finish();l.report.facts=facts;l.write(dir+'/'+phase+'-results.json');console.log(JSON.stringify({phase,observations:l.report.observations.map(x=>({id:x.id,status:x.status,error:x.error})),fatal:l.report.fatal}));});
