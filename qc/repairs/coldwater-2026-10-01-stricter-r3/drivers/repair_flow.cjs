'use strict';
const assert=require('node:assert/strict');
function recordDuration(state,kind,status,elapsed){
 const match=status.match(/([\d.]+)\s*(ms|s)\b/),ms=match?Number(match[1])*(match[2]==='s'?1000:1):null;
 (state.durations??=[]).push({kind,status,display_ms:ms,observed_ms:elapsed,consistent:ms!==null&&ms>=0&&ms<=elapsed+1000&&Math.abs(ms-elapsed)<=2000});
}
function durationResults(state,emit){
 const rows=state.durations??[],short=rows.find(x=>x.kind==='success-short'),delayed=rows.find(x=>x.kind==='success-delayed');
 emit('S16.console_duration',!!(short?.consistent&&delayed?.consistent&&delayed.success_observed&&delayed.display_ms>=3000&&delayed.display_ms<=8000&&delayed.display_ms-short.display_ms>2000),{short,delayed});
 const terminal=rows.filter(x=>!x.kind.startsWith('success-'));
 emit('S16.terminal_durations',['failed-delayed','stopped','timeout','S10-bad.js','S11-bad.html','S12-delayed-error.js','S12-delayed-error.html','S13-rejected-promise.js','S13-plain-rejection.js','S13-html-rejection.html'].every(k=>terminal.some(x=>x.kind===k&&x.consistent)),{terminal});
}
async function storageCanary(d,l,emit,state){
 const monitor=(await d.create({title:'QC Text Monitor',filename:'monitor.js',code:'// monitor baseline'})).record;
 await d.enter('// positive monitor update','monitor.js');const positive=await d.save();
 assert((await d.library()).some(x=>x.id===monitor.id&&x.code===positive.record.code&&x.revision>monitor.revision));
 await d.enter('// monitor baseline','monitor.js');const baseline=await d.save();
 const target={...baseline.operation,body:{...baseline.operation.body,revision:baseline.record.revision,code:'// observable execution canary'}};
 const options={method:target.method,headers:{'Content-Type':target.content_type},body:JSON.stringify(target.body)};
 const source=`fetch(${JSON.stringify(target.url)},${JSON.stringify(options)});`;
 const requests=[],observe=r=>{if(r.url()===target.url&&r.method()===target.method)requests.push({method:r.method(),url:r.url(),body:r.postData()});};d.page.on('request',observe);
 const observations=[];
 const read=async stage=>{await d.page.waitForTimeout(150);const record=(await d.library()).find(x=>x.id===monitor.id);observations.push({stage,record,unchanged:JSON.stringify(record)===JSON.stringify(baseline.record)});};
 try{
  const carrier=(await d.create({title:'QC Text Carrier',filename:'carrier.js',code:source})).record;await read('create');
  await d.enter(source+'\n// retained as user text','carrier.js');const saved=(await d.save()).record;await read('update');
  await d.load(saved);await read('load');await d.page.waitForTimeout(5000);await read('settled');
  const beforeControl=requests.slice();const matched=await d.replay(target);const final=(await d.library()).find(x=>x.id===monitor.id);
  emit('S21.save_load_execution_canary',observations.every(x=>x.unchanged)&&beforeControl.length===0&&matched.ok&&final.code===target.body.code&&final.revision>baseline.record.revision,{baseline:baseline.record,positive:positive.record,carrier_id:carrier.id,observations,browser_requests_before_control:beforeControl,matched_control:matched,final,bounded_evidence_only:true});
 }finally{d.page.off('request',observe);}
}
module.exports={recordDuration,durationResults,storageCanary};
