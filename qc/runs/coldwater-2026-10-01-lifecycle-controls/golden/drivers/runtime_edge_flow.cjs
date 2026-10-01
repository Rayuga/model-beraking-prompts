'use strict';
const assert=require('node:assert/strict');
async function runEdges(d,l){
 const results=[];
 const successful=[
  {name:'caught sequence retains value',code:"try { throw (1, 'expected'); } catch(e) { console.log('caught-sequence',e); }",marker:'caught-sequence expected'},
  {name:'handled rejection stays successful',code:"Promise.reject('handled-value').catch(e=>console.log('handled-result',e));",marker:'handled-result handled-value'},
  {name:'optional catch binding',code:"try { throw 'ignored'; } catch { console.log('optional-catch-ok'); }",marker:'optional-catch-ok'}
 ];
 for(const item of successful){const before=await d.page.getByRole('log').locator('.entry').count();await d.run(item.code,'edge.js');const logs=(await d.page.getByRole('log').locator('.entry').allInnerTexts()).slice(before).join('\n');results.push({name:item.name,code:item.code,logs,status:await d.status(),passed:logs.replace(/\s+/g,' ').includes(item.marker)});}
 const failures=[
  {name:'forwarded primitive',code:"console.log('forward-start');\nPromise.reject('forwarded-rejection').then(()=>{});",marker:'forwarded-rejection',line:2},
  {name:'adopted primitive',code:"console.log('adopt-start');\nPromise.resolve().then(()=>Promise.reject('adopted-rejection'));",marker:'adopted-rejection',line:2},
  {name:'constructor primitive',code:"console.log('constructor-start');\nnew Promise((resolve,reject)=>reject('constructor-rejection'));",marker:'constructor-rejection',line:2},
  {name:'first rejection wins',code:"new Promise((resolve,reject)=>{\nreject('first-rejection');\nreject('ignored-rejection');\n});",marker:'first-rejection',line:2},
  {name:'adoption through constructor',code:"console.log('adoption-start');\nnew Promise(resolve=>resolve(Promise.reject('constructor-adopted')));",marker:'constructor-adopted',line:2},
  {name:'async same primitive later caught',code:"(async()=>{throw 'same-primitive';})();\ntry {\nthrow 'same-primitive';\n} catch(e) {console.log('caught-later',e);}",marker:'same-primitive',line:1},
  {name:'handled old rejection cannot supply later line',code:"Promise.resolve().then(()=>{throw 'handled-then-new';}).catch(()=>{\n(async()=>{\nthrow 'handled-then-new';\n})();\n});",marker:'handled-then-new',line:3}
 ];
 for(const item of failures){await d.run("document.body.textContent='edge-last-good';console.log('edge-control');",'control.js');const before=await d.logs();await d.run(item.code,'edge.js',false);await d.page.waitForFunction(()=>/^Error/.test(document.querySelector('[role=status]')?.textContent||''),null,{timeout:5000});const logs=(await d.logs()).slice(before.length);results.push({...item,logs,status:await d.status(),body:await d.body(),passed:new RegExp(item.marker+'[^\\n]*line\\s+'+item.line+'(?:\\D|$)').test(logs)&&(await d.body())==='edge-last-good'});}
 await d.page.evaluate(()=>{const status=document.querySelector('[role=status]');window.__titleReviewObserver=new MutationObserver(()=>{document.title='Status: '+status.textContent;});window.__titleReviewObserver.observe(status,{childList:true,subtree:true,characterData:true});});
 const facts={};await require('./runtime_flow.cjs').runRuntimeScenario('S05',d,l,{scenarios:{S05:{protocol:''}}},(key,pass,evidence)=>{facts[key]={pass,evidence};},{});
 await d.page.evaluate(()=>window.__titleReviewObserver.disconnect());results.push({name:'legitimate host title changes',passed:facts['S05.preview_origin_boundary'].pass,...facts['S05.preview_origin_boundary']});
 return {scope:'Additional golden compatibility regressions; no scored criteria added',passed:results.every(x=>x.passed),results};
}
module.exports={runEdges};
