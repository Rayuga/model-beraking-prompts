'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger,digest}=require('./workflow_core.cjs');
const {runRefusalScenario,runNetworkScenario}=require('./refusal_flow.cjs');
const {definitions}=require('./prepare_refusal_variants.cjs');
const file=process.env.CW_INPUTS,log=process.env.CW_LOG_DIR,mode=process.env.CW_CASE;assert(file&&log&&mode);
const manifest=JSON.parse(fs.readFileSync(file)),inputs={...manifest,scenarios:Object.fromEntries(Object.entries(manifest.scenarios).map(([id,row])=>[id,{...row,protocol:row.protocol.replace(/\r\n/g,'\n')}]))};
assert(manifest.freeze_confirmed&&manifest.criteria.length===74);
const ledger=new ObservationLedger({manifest_sha256:digest(fs.readFileSync(file)),round_input_sha256:manifest.round_input_sha256,mode,scope:'Independent scripted refusal facts; no full judge or Oracle result'}),facts={},state={};
const expected={},emit=(key,pass,evidence)=>{
  assert(!facts[key],'Fact emitted twice: '+key);
  facts[key]={product_pass:Boolean(pass),evidence,criterion_ids:manifest.criteria.filter(c=>c.evidence_keys.includes(key)).map(c=>c.id)};
  fs.writeFileSync(path.join(log,'focused-progress.json'),JSON.stringify({facts},null,2)+'\n');
};
async function main(){
 const definition=definitions.find(row=>row.name===mode);assert(mode==='golden'||definition,'Unknown case');
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),d=new GoldenBrowser(page,ledger,'http://localhost:3000');
  await d.open();await d.completed();await d.disableAutoIfAvailable();
  if(mode==='golden'||definition.scenario==='S08'){
   await ledger.observe({id:'S08'},()=>runRefusalScenario(d,ledger,inputs,emit,state));
   Object.assign(expected,{'S08.harmless_scope_words':mode!=='unsupported-harmless-refused','S08.unsupported_execution_refused':true,'S08.unsupported_refusal_preview':mode!=='unsupported-drop-preview','S08.unsupported_execution_recovery':mode!=='unsupported-no-recovery'});
  }
  if(mode==='golden'||definition.scenario==='S07'){
   await ledger.observe({id:'S07'},()=>runNetworkScenario(d,ledger,inputs,emit,state));
   Object.assign(expected,{'S07.snippet_network_boundary':true,'S07.network_refusal_preview':mode!=='network-drop-preview','S07.network_recovery':mode!=='network-no-recovery'});
  }
  ledger.report.expected=expected;ledger.report.facts=facts;
  ledger.report.expectations=Object.entries(expected).map(([key,value])=>({key,expected:value,actual:facts[key]?.product_pass??null,matched:facts[key]?.product_pass===value}));
  ledger.report.passed=ledger.report.expectations.every(row=>row.matched)&&ledger.report.observations.every(row=>row.status==='observed pass');
 }finally{await browser.close();}
}
main().catch(error=>{ledger.report.fatal_error=String(error);ledger.report.fatal_stack=error.stack;ledger.report.passed=false;}).finally(()=>{
 ledger.finish();ledger.write(path.join(log,'focused-results.json'));
 console.log(JSON.stringify({mode,passed:ledger.report.passed,wall_ms:ledger.report.wall_ms,expectations:ledger.report.expectations,fatal_error:ledger.report.fatal_error}));
 if(!ledger.report.passed)process.exitCode=1;
});
