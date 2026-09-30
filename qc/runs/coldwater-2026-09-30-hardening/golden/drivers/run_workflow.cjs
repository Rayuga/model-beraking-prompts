'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger,digest}=require('./workflow_core.cjs');
const {runRuntimeScenario}=require('./runtime_flow.cjs'),{runLibraryScenario}=require('./library_flow.cjs'),{runBoundaryScenario}=require('./boundary_flow.cjs');
const {runWorkspaceScenario}=require('./workspace_flow.cjs'),{runVariant}=require('./partial_variant_flow.cjs');
const logDir=process.env.CW_LOG_DIR,mode=process.env.CW_CASE||'golden',phase=process.argv[2];assert(logDir&&['pre','post','variant'].includes(phase));
const manifestFile=process.env.CW_INPUTS||'/evidence/frozen_inputs.json',manifest=JSON.parse(fs.readFileSync(manifestFile));assert(manifest.freeze_confirmed);
// Preserve raw-file hashes, but authored multiline fixtures use ordinary LF
// lines; CRLF storage of the evaluator prompt is not a source-code requirement.
const inputs={...manifest,scenarios:Object.fromEntries(Object.entries(manifest.scenarios).map(([id,value])=>[id,{...value,protocol:value.protocol.replace(/\r\n/g,'\n')}])),phase};if(phase==='post')inputs.actual_restart=JSON.parse(fs.readFileSync(path.join(logDir,'actual-restart.json')));
const ledger=new ObservationLedger({manifest_sha256:digest(fs.readFileSync(manifestFile)),functional_sha256:manifest.functional_sha256,prompt_sha256:manifest.prompt_sha256,mode,phase});
const state=phase==='post'?JSON.parse(fs.readFileSync(path.join(logDir,'workflow-state.json'))):{},facts={};
function emit(key,productPass,evidence){
  const previous=facts[key];facts[key]={key,product_pass:Boolean(productPass),status:productPass?'observed pass':'observed product defect',source:'fresh local browser observation',at_ms:ledger.relative(),evidence,previous_observation:previous??undefined,criterion_ids:manifest.criteria.filter(c=>c.evidence_keys.includes(key)).map(c=>c.id)};
  fs.writeFileSync(path.join(logDir,phase+'-progress.json'),JSON.stringify({facts,observations:ledger.report.observations},null,2)+'\n');
  return facts[key];
}
async function overlay(page,kind){return page.evaluate(kind=>{const enforce=()=>{for(const button of document.querySelectorAll('button'))if(['Duplicate','Delete'].includes(button.textContent.trim())){if(kind==='removed')button.remove();else if(!button.disabled)button.disabled=true;}};enforce();const observer=new MutationObserver(enforce);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});window.__cwProofCapabilityObserver=observer;return{mode:kind,controls:['Duplicate','Delete'].map(name=>{const found=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name);return{name,present:Boolean(found),disabled:found?.disabled??null};})};},kind);}
async function main(){
  const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),driver=new GoldenBrowser(page,ledger,'http://localhost:3000');
    await driver.open();await driver.completed();await driver.disableAutoIfAvailable();if(state.library_url)driver.libraryUrl=state.library_url;
    if(mode==='restart-no-duplicate-delete'){
      ledger.report.capability_overlay=await overlay(page,phase==='pre'?'removed':'disabled');
      await page.evaluate(()=>{window.__cwProofClicks={run:0,duplicate:0,delete:0};document.addEventListener('click',event=>{const text=event.target.closest('button')?.textContent.trim()??'';if(/^Run(?:\s|$)/.test(text))window.__cwProofClicks.run++;if(text==='Duplicate')window.__cwProofClicks.duplicate++;if(text==='Delete')window.__cwProofClicks.delete++;},true);});
    }
    const workspace=new Set(['S01','S14','S15','S16','S17','S18','S19','S20','S34','S35']);
    const library=new Set(Array.from({length:13},(_,i)=>'S'+String(i+21).padStart(2,'0')));
    async function scenario(id,stage){
      const callInputs={...inputs,stage};const observationId=id+(stage?'.'+stage:phase==='pre'&&id==='S22'?'.prepare':'');
      return ledger.observe({id:observationId,protocol_sha256:manifest.scenarios[id].protocol_sha256},async()=>{
        if(['S16','S24','S36'].includes(id))await require('./current_flow.cjs').runCurrent(id,driver,ledger,callInputs,emit,state);
        else if(workspace.has(id))await runWorkspaceScenario(id,driver,ledger,callInputs,emit,state);
        else if(library.has(id))await runLibraryScenario(id,driver,ledger,callInputs,emit,state);
        else if(['S06','S07'].includes(id))await runBoundaryScenario(id,driver,ledger,callInputs,emit,state);
        else await runRuntimeScenario(id,driver,ledger,callInputs,emit,state);
        if(id==='S02')await require('./current_flow.cjs').runCurrent(id,driver,ledger,callInputs,emit,state);
        return {fact_keys:Object.keys(facts).filter(key=>key.startsWith(id+'.'))};
      });
    }
    if(mode==='golden-feedback'&&phase==='pre'){
      for(const id of ['S21','S22'])await scenario(id);
    }else if(mode==='golden-feedback'&&phase==='post'){
      for(const id of ['S22','S23','S33'])await scenario(id);
    }else if(mode==='golden'&&phase==='pre'){
      for(const[id,stage]of [['S01','initial'],['S14'],['S15'],['S16','history'],['S34'],['S16','clear'],['S19'],['S21'],['S22']])await scenario(id,stage);
    }else if(mode==='golden'&&phase==='post'){
      for(const[id,stage]of [['S22'],['S23'],['S02'],['S03'],['S04'],['S08'],['S09'],['S10'],['S11'],['S12'],['S13'],['S36'],['S17'],['S01','deferred'],['S24'],['S05'],['S07']])await scenario(id,stage);
    }else if(mode==='restart-no-duplicate-delete'){
      await scenario('S22');const observed=await page.evaluate(()=>window.__cwProofClicks);ledger.report.capability_action_counts=observed;assert.deepEqual(observed,{run:0,duplicate:0,delete:0});
    }else if(phase==='variant'){
      ledger.report.variant_results=await runVariant(driver,ledger,mode,{freeze_confirmed:true,token:'structural-'+mode,criterion_map:{}});
    }else throw Error('Unsupported mode/phase');
    state.library_url=driver.libraryUrl;fs.writeFileSync(path.join(logDir,'workflow-state.json'),JSON.stringify(state,null,2)+'\n');
    ledger.report.facts=facts;ledger.finish();ledger.report.full_current_criterion_run_claimed=false;ledger.report.own_browser_errors=ledger.report.browser_errors;
  }finally{await browser.close();}
}
main().catch(error=>{ledger.report.fatal_error=String(error);ledger.report.fatal_stack=error.stack;ledger.finish();process.exitCode=1;}).finally(()=>{
  ledger.write(path.join(logDir,phase+'-results.json'));
  console.log(JSON.stringify({phase,mode,status:ledger.report.status,wall_ms:ledger.report.wall_ms,facts:Object.keys(facts).length,observations:ledger.report.observations.map(row=>({id:row.id,status:row.status,error:row.error})),fatal_error:ledger.report.fatal_error,variant:ledger.report.variant_results?{expectations_matched:ledger.report.variant_results.expectations_matched,expected_defect_observed:ledger.report.variant_results.expected_defect_observed}:null}));
});
