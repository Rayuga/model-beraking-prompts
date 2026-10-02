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
    await require('./refusal_flow.cjs').runNetworkScenario(d,l,inputs,emit,state);
  }else throw Error('Unsupported boundary scenario '+id);
}
module.exports={runBoundaryScenario};
