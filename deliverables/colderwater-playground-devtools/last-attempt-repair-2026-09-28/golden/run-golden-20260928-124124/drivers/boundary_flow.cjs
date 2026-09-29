'use strict';
const assert=require('node:assert/strict');

async function runBoundaryScenario(id,d,l,inputs,emit,state){
  const p=d.page,say=(key,pass,evidence)=>emit(id+'.'+key,Boolean(pass),evidence);
  const good=async marker=>{await d.run(`document.body.textContent='${marker}';console.log('${marker}-log');`,'boundary-control.js');const body=await d.body(),logs=await d.logs();assert(body.includes(marker)&&logs.includes(marker+'-log'));state.runtimeLastGood={body,marker,log_marker:marker+'-log'};return state.runtimeLastGood;};
  d.stopListDiscovery();
  if(id==='S06'){
    const control=state.runtimeLastGood&&await d.body()===state.runtimeLastGood.body?state.runtimeLastGood:await good('privacy-control');
    const paths=['/app.db','/app.db-wal','/app.db-shm','/server.js','/package.json','/package-lock.json','/npm-shrinkwrap.json','/.git/config','/.git/HEAD'];
    const priorUrls=new Set(l.report.network.map(row=>row.url)),rows=[];
    for(const candidate of paths){
      const probe=await p.context().newPage();let downloads=0;probe.on('download',()=>downloads++);
      let response=null,error=null;try{response=await l.action('privacy_navigation','Navigate representative working-file path '+candidate,()=>probe.goto(new URL(candidate,d.url).toString(),{timeout:8000,waitUntil:'domcontentloaded'}));}catch(caught){error=String(caught);}
      const status=response?.status()??null,url=response?.url()??probe.url(),headers=response?.headers()??{};
      const denial=status!==null&&[401,403,404,410].includes(status),noContent=status===204||status===205;
      let workspace=false;if(!denial&&!noContent&&!downloads){workspace=await probe.getByRole('textbox',{name:'Code editor',exact:true}).count()>0&&await probe.getByRole('log').count()>0&&await probe.locator('iframe[title="Live preview"]').count()>0;}
      const intendedPublic=priorUrls.has(new URL(candidate,d.url).toString());
      rows.push({candidate,status,final_url:url,headers:{content_type:headers['content-type']??null,content_disposition:headers['content-disposition']??null},download_events:downloads,denial,no_content:noContent,working_workspace:workspace,observed_prior_public_request:intendedPublic,navigation_error:error,accepted:denial||noContent||workspace||intendedPublic});
      await probe.close();
    }
    await good('privacy-recovered');say('working_files_private',rows.every(row=>row.accepted),{control,probes:rows,recovery:true,response_bodies_read:false,download_contents_read:false,bounded_sample_only:true});
  }else if(id==='S07'){
    const context=p.context(),nonce=String(Date.now()),urls=['text','image'].map(kind=>'https://cw-qc-network.invalid/'+kind+'?n='+nonce),token='network-control-'+nonce;
    const instrument={deliveries:0};const handler=async route=>{instrument.deliveries++;const image=route.request().url()===urls[1];await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','cache-control':'no-store','content-type':image?'image/svg+xml':'text/plain'},body:image?'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>':token});};
    for(const url of urls)await context.route(url,handler);
    try{
      const controlPage=await context.newPage();let observed;
      try{observed=await controlPage.evaluate(async({urls})=>{const text=await(await fetch(urls[0],{signal:AbortSignal.timeout(5000)})).text();const width=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('image control timeout')),5000),image=new Image();image.onload=()=>{clearTimeout(timer);resolve(image.naturalWidth);};image.onerror=()=>{clearTimeout(timer);reject(Error('image control failed'));};image.src=urls[1];});return{text,width};},{urls});}finally{await controlPage.close();}
      assert(observed.text===token&&observed.width===2&&instrument.deliveries===2,'Local network instrumentation control failed');const baseline=instrument.deliveries;
      const control=state.runtimeLastGood&&await d.body()===state.runtimeLastGood.body?state.runtimeLastGood:await good('network-control');
      const payloads=[['fetch',`fetch(${JSON.stringify(urls[0])}).then(r=>r.text()).then(x=>console.log('EXTERNAL_FETCH_LOADED',x)).catch(()=>console.warn('network fetch refused'));`],['image',`const image=new Image();image.onload=()=>console.log('EXTERNAL_IMAGE_LOADED',image.naturalWidth);image.onerror=()=>console.warn('network image refused');image.src=${JSON.stringify(urls[1])};document.body.appendChild(image);`]],rows=[];
      for(const[family,code]of payloads){const before=await d.logs();await d.run(code,'network-'+family+'.js',false);await p.waitForFunction(()=>/complete|error|refus|unsupported|outside/i.test(document.querySelector('[role="status"]')?.textContent??''),null,{timeout:8000});const logs=(await d.logs()).slice(before.length),status=await d.status();rows.push({family,logs,status,deliveries:instrument.deliveries,loaded:/EXTERNAL_(FETCH|IMAGE)_LOADED/.test(logs),feedback:/refus|block|network|csp|outside|disabled|unsupported/i.test(logs+' '+status)});}
      await good('network-recovered');say('snippet_network_boundary',rows.every(row=>!row.loaded&&row.feedback&&row.deliveries===baseline)&&instrument.deliveries===baseline,{instrumentation_control:observed,baseline,control,rows,recovery:true,final_deliveries:instrument.deliveries,fulfilled_locally:true});
    }finally{for(const url of urls)await context.unroute(url,handler);}
  }else throw Error('Unsupported boundary scenario '+id);
}
module.exports={runBoundaryScenario};
