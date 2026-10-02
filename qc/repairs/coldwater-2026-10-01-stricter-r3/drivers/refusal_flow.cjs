'use strict';
// Local reference-proof observations. No import-time browser or filesystem work.
const assert=require('node:assert/strict');
const REFUSED=/unsupported|not supported|disabled|refus|outside|not available|not permitted|Content Security Policy|shared workers.*denied/i;
const COMPLETE=/^Complete\b/i;
const TERMINAL=/complete|error|refus|unsupported|outside|not supported|disabled|not available|not permitted/i;

async function snapshot(d){
  const result={status:await d.status(),logs:await d.logs()};
  try{result.body=await d.body();}catch(error){result.body=null;result.body_error=String(error);}
  return result;
}
async function attempt(d,l,code,filename){
  const before=await snapshot(d),started=l.relative();let action=null,actionError=null,waitError=null;
  try{action=await d.run(code,filename,false);}catch(error){actionError=String(error);}
  if(!actionError)try{
    await d.page.waitForFunction(pattern=>new RegExp(pattern,'i').test(document.querySelector('[role="status"]')?.textContent??''),TERMINAL.source,{timeout:8500});
  }catch(error){waitError=String(error);}
  const after=await snapshot(d),logsAppend=after.logs.startsWith(before.logs);
  return{filename,code,before,after,action,action_error:actionError,wait_error:waitError,elapsed_ms:l.relative()-started,
    logs_append_only:logsAppend,new_logs:logsAppend?after.logs.slice(before.logs.length):null};
}
const completed=row=>!row.action_error&&!row.wait_error&&COMPLETE.test(row.after.status)&&typeof row.after.body==='string';
const successful=(row,marker,logMarker)=>completed(row)&&row.after.body.includes(marker)&&row.new_logs!==null&&row.new_logs.includes(logMarker);
const refused=row=>!row.action_error&&!row.wait_error&&!COMPLETE.test(row.after.status)&&row.new_logs!==null&&REFUSED.test(row.after.status+' '+row.new_logs);
const baseline=row=>({body:row.after.body,status:row.after.status,log_evidence:row.new_logs,filename:row.filename,observed_completed:completed(row)});
const currentGood=(state,row,marker,logMarker)=>{if(successful(row,marker,logMarker))state.runtimeLastGood={body:row.after.body,marker,log_marker:logMarker};};

async function ordinary(d,l,marker){
  return attempt(d,l,`document.body.innerHTML='<p>${marker}</p>';console.log('${marker}-log');`,'proof.js');
}

async function runRefusalScenario(d,l,inputs,emit,state={}){
  assert(inputs.scenarios.S08,'S08 frozen protocol absent');
  const fixtures=[...inputs.scenarios.S08.protocol.matchAll(/<!doctype html>[\s\S]*?<\/html>/gi)];
  assert.equal(fixtures.length,1,'Exactly one frozen S08 harmless HTML fixture is required');
  const source=fixtures[0][0];
  const harmless=await attempt(d,l,source,'scope-control.html');
  const normalizedHarmlessLogs=(harmless.new_logs??'').replace(/\s+/g,' ');
  const harmlessWorking=successful(harmless,'scope-control: eval Function WebAssembly Worker import','scope-control-log')&&/scope-control-log\s+eval Function WebAssembly Worker import/.test(normalizedHarmlessLogs)&&/scope-local-control\s+ordinary-binding ordinary-function/.test(normalizedHarmlessLogs);
  emit('S08.harmless_scope_words',harmlessWorking,{observation:harmless});
  // Read actual control observations, never another row's verdict. The fallback
  // is already in the shipped protocol and runs only when harmless text fails.
  const fallback=harmlessWorking?null:await ordinary(d,l,'supported-control');
  const supportedWorking=harmlessWorking||successful(fallback,'supported-control','supported-control-log');
  const control=supportedWorking?baseline(harmlessWorking?harmless:fallback):null;
  const payloads=[['eval',"eval('1 + 1');"],['Function',"new Function('return 2')();"],['WebAssembly','new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));'],['Worker',"new Worker('data:text/javascript,postMessage(1)');"],['import',"import('data:text/javascript,export const answer = 1');"]];
  const observations=[];let lastCompleted=control;
  for(const[family,code]of payloads){
    const beforeGood=lastCompleted,observed=await attempt(d,l,code,'scope.js');
    const refusalObserved=refused(observed);
    observations.push({family,last_completed_before:beforeGood,...observed,refusal_observed:refusalObserved,
      retained_last_completed:Boolean(beforeGood&&refusalObserved&&observed.after.body===beforeGood.body)});
    // An incorrect successful unsupported execution can still become the real
    // last completed render. Keep that state without crediting its refusal.
    if(completed(observed))lastCompleted=baseline(observed);
  }
  // Emit both earlier outcomes before attempting recovery; its product/tool
  // failure must not erase independently observed refusals or preservation.
  emit('S08.unsupported_execution_refused',supportedWorking&&observations.every(row=>row.refusal_observed),{harmless_control:harmless,fallback_control:fallback,supported_control:control,observations});
  emit('S08.unsupported_refusal_preview',supportedWorking&&observations.every(row=>row.retained_last_completed),{supported_control:control,observations});
  const recovery=await ordinary(d,l,'scope-recovered');
  emit('S08.unsupported_execution_recovery',successful(recovery,'scope-recovered','scope-recovered-log'),{observation:recovery,prior_refusal_verdict_not_inherited:true});
  currentGood(state,recovery,'scope-recovered','scope-recovered-log');
}

async function runNetworkScenario(d,l,inputs,emit,state={}){
  assert(inputs.scenarios.S07,'S07 frozen protocol absent');
  const p=d.page,context=p.context(),nonce=String(Date.now()),urls=['text','image'].map(kind=>'https://cw-qc-network.invalid/'+kind+'?n='+nonce),token='network-control-'+nonce;
  const instrument={deliveries:0},handler=async route=>{instrument.deliveries++;const image=route.request().url()===urls[1];await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','cache-control':'no-store','content-type':image?'image/svg+xml':'text/plain'},body:image?'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>':token});};
  d.stopListDiscovery();
  for(const url of urls)await context.route(url,handler);
  let setup=null,setupError=null;
  try{
    const controlPage=await context.newPage();
    try{setup=await controlPage.evaluate(async({urls})=>{
      const text=await(await fetch(urls[0],{signal:AbortSignal.timeout(5000)})).text();
      const width=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('image control timeout')),5000),image=new Image();image.onload=()=>{clearTimeout(timer);resolve(image.naturalWidth);};image.onerror=()=>{clearTimeout(timer);reject(Error('image control failed'));};image.src=urls[1];});return{text,width};
    },{urls});}catch(error){setupError=String(error);}finally{await controlPage.close();}
    const transportWorking=setup?.text===token&&setup?.width===2&&instrument.deliveries===2;
    l.report.network_refusal_setup={observed:setup,error:setupError,delivered:instrument.deliveries,transport_working:transportWorking};
    assert(transportWorking,'Local network instrumentation setup unavailable; no product verdict fabricated');
    const deliveryBaseline=instrument.deliveries;
    let control=null,ownControl=null;
    const pre=await snapshot(d);
    if(state.runtimeLastGood&&pre.body===state.runtimeLastGood.body&&pre.logs.includes(state.runtimeLastGood.log_marker)){
      control={body:pre.body,status:pre.status,log_evidence:state.runtimeLastGood.log_marker,observed_completed:true,reused_actual_control:state.runtimeLastGood};
    }else{
      ownControl=await ordinary(d,l,'network-control');
      if(successful(ownControl,'network-control','network-control-log'))control=baseline(ownControl);
    }
    const payloads=[['fetch',`fetch(${JSON.stringify(urls[0])}).then(r=>r.text()).then(x=>console.log('EXTERNAL_FETCH_LOADED',x)).catch(()=>console.warn('network fetch refused'));`],['image',`const image=new Image();image.onload=()=>console.log('EXTERNAL_IMAGE_LOADED',image.naturalWidth);image.onerror=()=>console.warn('network image refused');image.src=${JSON.stringify(urls[1])};document.body.appendChild(image);`]];
    const observations=[];let lastCompleted=control;
    for(const[family,code]of payloads){
      const beforeGood=lastCompleted,observed=await attempt(d,l,code,'network-'+family+'.js');
      const freshLogs=observed.new_logs??'',earlyRefusal=refused(observed),caughtCompletion=completed(observed)&&freshLogs.includes('network '+family+' refused');
      observations.push({family,last_completed_before:beforeGood,...observed,deliveries:instrument.deliveries,
        external_loaded:/EXTERNAL_(FETCH|IMAGE)_LOADED/.test(freshLogs)||freshLogs.includes(token),early_refusal:earlyRefusal,caught_completion:caughtCompletion,
        preview_allowed:Boolean(caughtCompletion||beforeGood&&earlyRefusal&&observed.after.body===beforeGood.body)});
      if(completed(observed))lastCompleted=baseline(observed);
    }
    const noDelivery=row=>row.deliveries===deliveryBaseline&&!row.external_loaded;
    emit('S07.snippet_network_boundary',Boolean(control)&&observations.every(row=>noDelivery(row)&&(row.early_refusal||row.caught_completion)),{transport_control:setup,delivery_baseline:deliveryBaseline,own_control:control,own_control_attempt:ownControl,observations,fulfilled_locally:true});
    emit('S07.network_refusal_preview',Boolean(control)&&observations.every(row=>row.preview_allowed),{transport_control:setup,own_control:control,observations});
    const beforeRecoveryDeliveries=instrument.deliveries,recovery=await ordinary(d,l,'network-recovered');
    emit('S07.network_recovery',successful(recovery,'network-recovered','network-recovered-log')&&instrument.deliveries===beforeRecoveryDeliveries,{observation:recovery,deliveries_before:beforeRecoveryDeliveries,deliveries_after:instrument.deliveries,prior_boundary_verdict_not_inherited:true});
    currentGood(state,recovery,'network-recovered','network-recovered-log');
  }finally{for(const url of urls)await context.unroute(url,handler);}
}
module.exports={runRefusalScenario,runNetworkScenario,snapshot,attempt,successful,completed,ordinary,currentGood};
