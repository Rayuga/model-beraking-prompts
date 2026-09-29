async(page)=>{
 const context=page.context(),result={browser:context.browser().version(),controls:[],deliveries:[]};
 const fixtures=[
 {port:3110,label:'large-benign-client-javascript',body:"const publicValues = ["+Array(40000).fill("0").join(",")+"];\nconsole.log(publicValues.length);",type:'application/javascript'},
 {port:3111,label:'ambiguous-public-text-prefix',body:'Public presentation asset data without a private-file signature. '.repeat(2000),type:'text/plain'}
 ];
 for(const fixture of fixtures){
  const pattern='http://localhost:'+fixture.port+'/**';
  const handler=async route=>{const isSource=route.request().url().replace(/^https?:\/\/[^/]+/, '').split('?')[0]==='/server.js';result.deliveries.push({label:fixture.label,path:route.request().url().replace(/^https?:\/\/[^/]+/, '').split('?')[0]});await route.fulfill({status:200,contentType:isSource?fixture.type:'text/html',body:isSource?fixture.body:'<!doctype html><title>Harmless classification control</title><p>Control</p>'});};
  await context.route(pattern,handler);const p=await context.newPage();
  try{await p.goto('http://localhost:'+fixture.port);
   const observation=await p.evaluate(async()=>{
    /* CLASSIFIER */
    const response=await fetch('/server.js',{redirect:'error',cache:'no-store'}),reader=response.body.getReader(),parts=[];let n=0,complete=false;
    while(n<65536){const part=await reader.read();if(part.done){complete=true;break;}const bytes=part.value.slice(0,65536-n);parts.push(bytes);n+=bytes.length;if(bytes.length<part.value.length)break;}if(!complete)await reader.cancel();
    const bytes=new Uint8Array(n);let pos=0;for(const chunk of parts){bytes.set(chunk,pos);pos+=chunk.length;}
    return{status:response.status,contentType:response.headers.get('content-type'),...classifyExposure('/server.js',bytes,complete)};
   });
   if(observation.bytesExamined!==65536||observation.complete||observation.exposed===true)throw new Error('Benign bounded prefix falsely failed');
   result.controls.push({label:fixture.label,fixtureBytes:fixture.body.length,...observation,boundedCriterionSatisfied:true,scope:'No recognizable private content in examined prefix; not proof of whole-response secrecy.'});
  }finally{await p.close();await context.unroute(pattern,handler);}
 }
 result.passed=true;return result;
}