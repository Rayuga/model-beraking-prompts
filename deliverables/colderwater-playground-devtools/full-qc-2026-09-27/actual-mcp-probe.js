async (page) => {
 const ensure=(value,message)=>{if(!value)throw new Error(message);};
 const browser=page.context().browser(),result={browser:browser.version(),gates:{},exposure:[]};
 page.on('dialog',d=>d.accept());
 const editor=p=>p.getByRole('textbox',{name:'Code editor',exact:true});
 async function setCode(p,code){await editor(p).click();await p.keyboard.press('Control+A');await p.keyboard.insertText(code);}
 async function authored(p,label){
   const code="document.body.textContent="+JSON.stringify(label)+";console.log("+JSON.stringify(label)+");";
   await setCode(p,code);await p.getByRole('button',{name:/^Run/}).click();
   await p.frameLocator('iframe[title="Live preview"]').getByText(label,{exact:true}).waitFor();
   await p.getByRole('log').filter({hasText:label}).waitFor();return code;
 }
 await editor(page).waitFor();
 await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();
 await page.getByRole('button',{name:'New',exact:true}).click();
 await page.getByRole('textbox',{name:'Filename',exact:true}).fill('mcp-gate.js');
 const marker='MCP gate '+Date.now(),source=await authored(page,marker);
 result.gates.render={passed:true,marker};
 const title='CW gate MCP '+Date.now();await page.getByRole('textbox',{name:'Snippet title',exact:true}).fill(title);
 const writePromise=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/snippets'));
 await page.getByRole('button',{name:'Save',exact:true}).click();const write=await writePromise,record=await write.json();
 ensure(write.status()===201&&record.code===source&&record.title===title,'UI save exact authored fields');
 result.gates.write={url:write.url(),method:write.request().method(),body:write.request().postDataJSON(),status:write.status(),record};
 const clean=await browser.newContext();
 try {
   result.gates.cleanInitialStorage=await clean.storageState();ensure(JSON.stringify(result.gates.cleanInitialStorage)===JSON.stringify({cookies:[],origins:[]}),'Clean context must not copy storage');
   const fresh=await clean.newPage();fresh.on('dialog',d=>d.accept());
   for(const phase of ['initial','reload']){
     const read=fresh.waitForResponse(r=>r.url()===write.url()&&r.request().method()==='GET');
     if(phase==='initial')await fresh.goto('http://localhost:3000');else await fresh.reload();
     const response=await read,records=await response.json();ensure(JSON.stringify(records.find(r=>r.id===record.id))===JSON.stringify(record),'Exact server record retrieved');
     await fresh.locator('.snippetlist button').filter({hasText:title}).first().click();
     ensure(await editor(fresh).innerText()===source,'Exact clean-context source');
     ensure(await fresh.getByRole('textbox',{name:'Filename',exact:true}).inputValue()==='mcp-gate.js','Exact clean-context filename');
     result.gates[phase]={status:response.status(),id:record.id,sourceExact:true,titleExact:await fresh.getByRole('textbox',{name:'Snippet title',exact:true}).inputValue()===title};
   }
   await fresh.screenshot({path:'/evidence/mcp-clean-context.png',fullPage:true});
 }finally{await clean.close();}
 result.gates.constraints={passed:true,gateRecordLeftSaved:record.id};
 async function exposure(p,label){
   const control=await authored(p,'exposure-control-'+label);const observations=await p.evaluate(async()=>{
     /* CLASSIFIER */
     const out=[];
     for(const path of ['/app.db','/server.js','/package.json']){
       const response=await fetch(path,{cache:'no-store',redirect:'error'});
       const reader=response.body.getReader(),parts=[];let count=0,complete=false;
       while(count<65536){const {value,done}=await reader.read();if(done){complete=true;break;}const kept=value.slice(0,65536-count);parts.push(kept);count+=kept.length;if(kept.length<value.length)break;}
       if(!complete)await reader.cancel();
       const bytes=new Uint8Array(count);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
       out.push({path,status:response.status,contentType:response.headers.get('content-type'),...classifyExposure(path,bytes,complete)});
     }
     return out;
   });
   await authored(p,'exposure-recovery-'+label);return{label,positiveControl:true,observations,recovery:true};
 }
 result.exposure.push(await exposure(page,'golden'));
 ensure(result.exposure[0].observations.every(x=>x.exposed===false),'Golden must have conclusive non-leak replies');
 for(const [port,label,expected]of[[3101,'whole-app-static',true],[3102,'spa-status200',false],[3103,'denial-misleading-mime',false],[3104,'leaks-wrong-mime',true],[3105,'code-comments-strings-public-json',false]]){
   const p=await page.context().newPage();
   try{const response=await p.goto('http://localhost:'+port);ensure(response.ok(),'Fixture must answer');const tested=await exposure(p,label);
     ensure(expected?tested.observations.every(x=>x.exposed===true):tested.observations.every(x=>x.exposed!==true),'Classifier fixture result '+label);
     result.exposure.push(tested);
   }finally{await p.close();}
 }
 result.classifierControls=await page.evaluate(()=>{
   /* CLASSIFIER */
   const enc=new TextEncoder();
   const front={name:'frontend-only',version:'1.0.0',scripts:{start:'vite'},dependencies:{react:'19.0.0'}};
   const a=classifyExposure('/package.json',enc.encode(JSON.stringify(front)),true);
   const b=classifyExposure('/server.js',enc.encode(' '.repeat(65536)),false);
   return {frontendManifest:a,truncation:b};
 });
 ensure(result.classifierControls.frontendManifest.exposed===false,'Frontend manifest cannot prove backend manifest leak');
 ensure(result.classifierControls.truncation.exposed===null,'Truncation must remain inconclusive');
 await page.bringToFront();result.passed=true;return result;
}