'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger,digest}=require('./workflow_core.cjs');
const {autoControl,cssControl,freshGlobalControl}=require('./positive_controls.cjs');
const logDir=process.env.CW_LOG_DIR,mode=process.env.CW_CASE||'golden';
const manifest=JSON.parse(fs.readFileSync('/evidence/frozen_inputs.json'));assert(manifest.freeze_confirmed);
const ledger=new ObservationLedger({mode,manifest_sha256:digest(fs.readFileSync('/evidence/frozen_inputs.json')),functional_sha256:manifest.functional_sha256,prompt_sha256:manifest.prompt_sha256});
const report={case:mode,paid_provider:false,oracle_score_claimed:false,observations:[],binding:ledger.report.binding};
async function main(){
  const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),driver=new GoldenBrowser(page,ledger,'http://localhost:3000');
    await driver.open();await driver.completed();
    if(['golden','dead-auto-run'].includes(mode))report.observations.push(await autoControl(driver,ledger));
    if(['golden','css-wipes-preview'].includes(mode))report.observations.push(await cssControl(driver,ledger));
    if(mode==='golden'){
      await driver.run("document.body.innerHTML = '<p id=\"fresh-js\">fresh-' + typeof window.oldGlobal + '</p>';\nconsole.log('fresh-js-log');",'dispatch.js');
      const body=await driver.body(),logs=await driver.logs();report.observations.push({key:'S02.js_fresh_document',product_pass:body==='fresh-undefined'&&logs.includes('fresh-js-log')&&!body.includes('html-dispatch-ok'),body,logs,global_positive_control:'Provided separately by S04, since CSS already resets oldGlobal.'});
      report.observations.push(await freshGlobalControl(driver,ledger));
    }
    await context.close();
    if(mode==='golden'){
      const {runS06Observer}=require('./s06_privacy_observer.cjs');
      for(const variant of ['golden','public-server-script']){
        const privacyContext=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),privacyPage=await privacyContext.newPage();
        try{report.observations.push(await runS06Observer({page:privacyPage,GoldenBrowser,ledger,url:'http://localhost:3000',variant,freezeBinding:{confirmed:true,prompt_sha256:manifest.prompt_sha256,judge_sha256:manifest.functional_sha256}}));}finally{await privacyContext.close();}
      }
    }
    if(mode==='golden')report.expected_behavior_observed=report.observations.every(row=>row.product_pass===true||row.status==='pass');
    else if(mode==='dead-auto-run')report.expected_behavior_observed=report.observations.length===1&&report.observations[0].product_pass===false&&!report.observations[0].enabled_positive_observed&&report.observations[0].off_absence_observed&&report.observations[0].manual_positive_observed;
    else if(mode==='css-wipes-preview')report.expected_behavior_observed=report.observations.length===1&&report.observations[0].product_pass===false&&report.observations[0].original_handler_positive&&!report.observations[0].retained_document_button_positive&&report.observations[0].old_markers_did_not_increase;
    else throw Error('Unknown proof case');
  }finally{await browser.close();}
}
main().catch(error=>{report.expected_behavior_observed=false;report.error=String(error);report.stack=error.stack;process.exitCode=1;}).finally(()=>{ledger.finish();report.ledger=ledger.report;fs.writeFileSync(path.join(logDir,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({case:mode,expected_behavior_observed:report.expected_behavior_observed,observations:report.observations.map(row=>({key:row.key,variant:row.variant,status:row.status,product_pass:row.product_pass})),error:report.error}));if(!report.expected_behavior_observed)process.exitCode=1;});
