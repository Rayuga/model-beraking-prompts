'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger,digest}=require('./workflow_core.cjs');
const {cssGlobalProof,cssTimerProof,importMatrixProof}=require('./css_import_proofs.cjs');
const {runStaleEditorProofs}=require('./stale_editor_proofs.cjs');
const logDir=process.env.CW_LOG_DIR,mode=process.env.CW_CASE||'golden';
const manifestPath='/evidence/'+(process.env.CW_MANIFEST||'frozen_inputs.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));assert(manifest.freeze_confirmed);
const ledger=new ObservationLedger({mode,manifest_sha256:digest(fs.readFileSync(manifestPath)),functional_sha256:manifest.functional_sha256,prompt_sha256:manifest.prompt_sha256});
const report={case:mode,paid_provider:false,oracle_score_claimed:false,observations:[],binding:ledger.report.binding};
async function main(){
  const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),d=new GoldenBrowser(page,ledger,'http://localhost:3000');
    await d.open();await d.completed();
    if(['golden','css-live-context-leaks'].includes(mode)){
      report.observations.push(await cssGlobalProof(d,ledger));
      report.observations.push(await cssTimerProof(d,ledger));
    }
    if(['golden','js-only-importer'].includes(mode))report.observations.push(await importMatrixProof(d,ledger));
    await context.close();
    if(['golden','conflict-ui-clears'].includes(mode)){
      report.stale_editors=await runStaleEditorProofs(browser,'http://localhost:3000',logDir,{expectedConflictClears:mode==='conflict-ui-clears'});
    }
    if(mode==='golden')report.expected_behavior_observed=report.observations.every(row=>row.product_pass)&&report.stale_editors.all_expectations_matched;
    else if(mode==='css-live-context-leaks')report.expected_behavior_observed=report.observations.length===2&&report.observations.every(row=>row.product_pass===false&&row.css_continuation)&&report.observations[0].positive_authored_global&&!report.observations[0].global_absent_during_css&&report.observations[1].timer_positive_observed&&report.observations[1].css_superseded_before_due&&!report.observations[1].no_fresh_old_timer;
    else if(mode==='js-only-importer'){const items=report.observations[0].items;report.expected_behavior_observed=items.length===6&&items.every(row=>row.extension.toLowerCase()==='js'?row.product_pass:!row.import_exact&&!row.product_pass);}
    else if(mode==='conflict-ui-clears')report.expected_behavior_observed=report.stale_editors.all_expectations_matched;
    else throw Error('Unknown case '+mode);
  }finally{await browser.close();}
}
main().catch(error=>{report.expected_behavior_observed=false;report.error=String(error);report.stack=error.stack;process.exitCode=1;}).finally(()=>{ledger.finish();report.ledger=ledger.report;fs.writeFileSync(path.join(logDir,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({case:mode,expected_behavior_observed:report.expected_behavior_observed,observations:report.observations.map(row=>({key:row.key,product_pass:row.product_pass})),stale_editor_expected:report.stale_editors?.expected_behavior_observed,error:report.error}));if(!report.expected_behavior_observed)process.exitCode=1;});
