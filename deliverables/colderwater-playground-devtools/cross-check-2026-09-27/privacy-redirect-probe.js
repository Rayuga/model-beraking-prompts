async (page) => {
  const result={browser:page.context().browser().version(),fixtures:[],oldPolicy:[]};
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const namedPaths=['/app.db','/server.js','/package.json'];
  async function authored(p,marker){
    await p.getByRole('textbox',{name:'Code editor',exact:true}).fill('document.body.textContent='+JSON.stringify(marker)+';console.log('+JSON.stringify(marker)+');');
    await p.getByRole('button',{name:'Run',exact:true}).click();
    await p.frameLocator('iframe[title="Live preview"]').getByText(marker,{exact:true}).waitFor();
    await p.getByRole('log').filter({hasText:marker}).waitFor();
  }
  async function bounded(p,namedPath){
    const origin=await p.evaluate(()=>location.origin);
    let current=origin+namedPath;
    const chain=[],visited=new Set();
    for(let hop=0;hop<=3;hop++){
      if(visited.has(current))return{path:namedPath,classification:'redirect-loop-unfollowed',exposed:false,coverage:'destination-not-inspected',chain};
      visited.add(current);
      const metadata=p.waitForResponse(r=>r.url()===current,{timeout:4000}).then(async r=>({status:r.status(),location:(await r.allHeaders()).location||null})).catch(()=>null);
      const body=p.evaluate(async ({url,namedPath})=>{
        /* CLASSIFIER */
        try{
          const response=await fetch(url,{cache:'no-store',redirect:'manual'});
          if(response.type==='opaqueredirect')return{kind:'redirect',fetchType:response.type};
          const reader=response.body?.getReader(),parts=[];let count=0,complete=!reader;
          while(reader && count<65536){const next=await reader.read();if(next.done){complete=true;break;}const keep=next.value.slice(0,65536-count);parts.push(keep);count+=keep.length;if(keep.length<next.value.length)break;}
          if(reader && !complete)await reader.cancel();
          const bytes=new Uint8Array(count);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
          return{kind:'body',...classifyExposure(namedPath,bytes,complete)};
        }catch(error){return{kind:'transport-error',errorName:error.name};}
      },{url:current,namedPath});
      const [meta,observation]=await Promise.all([metadata,body]);
      if(observation.kind==='transport-error'||!meta)return{path:namedPath,classification:'transport-incomplete',exposed:null,coverage:'incomplete',chain};
      chain.push({hop,status:meta.status,fetchType:observation.fetchType||'basic'});
      if(observation.kind==='body')return{path:namedPath,status:meta.status,chain,...observation,coverage:observation.complete?'complete-observed-response':'bounded-prefix'};
      if(!meta.location)return{path:namedPath,classification:'redirect-destination-unavailable',exposed:false,coverage:'destination-not-inspected',chain};
      const target=await p.evaluate(({location,current})=>{const u=new URL(location,current);return{href:u.href,origin:u.origin};},{location:meta.location,current});
      if(target.origin!==origin)return{path:namedPath,classification:'off-origin-redirect-unfollowed',exposed:false,coverage:'destination-not-inspected',chain};
      if(hop===3)return{path:namedPath,classification:'redirect-limit-unfollowed',exposed:false,coverage:'destination-not-inspected',chain};
      current=target.href;
    }
  }
  for(const [port,mode,expected] of [[3201,'same-origin-safe',false],[3202,'same-origin-leak',true],[3203,'off-origin-safe',false],[3204,'redirect-loop',false],[3205,'transport-failure',null],[3206,'direct-leak',true],[3207,'redirect-hop-limit',false]]){
    await page.goto('http://localhost:'+port);
    await authored(page,'control-'+mode);
    const publicResponse=await page.evaluate(async()=>{const r=await fetch('/');return{status:r.status,ok:r.ok};});
    assert(publicResponse.ok,'Working public HTTP control '+mode);
    if(port===3201 || port===3203){
      const old=await page.evaluate(async()=>{try{const r=await fetch('/server.js',{redirect:'error'});return{rejected:false,status:r.status};}catch(error){return{rejected:true,errorName:error.name};}});
      assert(old.rejected,'Old proof must reproduce false failure '+mode);
      result.oldPolicy.push({mode,...old});
    }
    const observations=[];for(const path of namedPaths)observations.push(await bounded(page,path));
    await authored(page,'recovery-'+mode);
    if(expected===true)assert(observations.every(o=>o.exposed===true),'Positive exposure '+mode);
    if(expected===false)assert(observations.every(o=>o.exposed!==true && o.coverage!=='incomplete'),'Benign route '+mode);
    if(expected===null)assert(observations.find(o=>o.path==='/server.js').coverage==='incomplete','Actual transport error remains incomplete');
    if(mode==='redirect-hop-limit')assert(observations.every(o=>o.classification==='redirect-limit-unfollowed' && o.chain.length===4),'Exactly three followed hops, no fifth request');
    result.fixtures.push({mode,workingControls:true,recovery:true,observations});
  }
  const external=await page.evaluate(async()=>await(await fetch('/observations')).json());
  assert(external.externalHits===0,'Never follow an off-origin redirect');
  result.offOriginRequests=external.externalHits;
  result.passed=true;
  return result;
}
