async (page) => {
  const seed=__SEED_JSON__;
  const report={scope:'Fresh continuous golden boundary supplement, with exact gate and keyboard observations',startedAt:new Date().toISOString(),browserVersion:page.context().browser().version(),checks:[],network:[],keyboard:[],pageErrors:[]};
  const require=(ok,message)=>{if(!ok)throw new Error(message);};
  const equal=(a,b,message)=>require(JSON.stringify(a)===JSON.stringify(b),message+'; actual '+JSON.stringify(a)+' expected '+JSON.stringify(b));
  const money=n=>(n/100).toFixed(2),lines=(...rows)=>rows.map(([sku,size,qty])=>({sku,size,qty}));
  const title=sku=>seed.variants.find(v=>v.sku===sku).title;
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  async function request(url,body,p=page){const result=await p.evaluate(async({url,body})=>{const r=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};},{url,body});report.network.push({url,request:body,...result});return result;}
  const stocks=async()=>Object.fromEntries((await request('/api/prints')).body.prints.flatMap(p=>p.sizes.map(v=>[p.sku+':'+v.size,v.in_stock])));
  const order=async ref=>(await request('/api/orders/'+ref)).body;
  const fresh=body=>({...JSON.parse(JSON.stringify(body)),checkout_id:'second-'+Date.now()+'-'+Math.random().toString(16).slice(2)});
  function figures(entries){let gross=0,saving=0,grams=0;for(const l of entries){const v=seed.variants.find(v=>v.sku===l.sku&&v.size===l.size);gross+=v.price_pence*l.qty;saving+=(v.price_pence-(l.qty>=v.tier_qty?v.tier_price_pence:v.price_pence))*l.qty;grams+=seed.size_weights.find(w=>w.size===l.size).grams*l.qty;}const band=seed.postage_bands.find(b=>b.up_to_grams>0&&grams<=b.up_to_grams);const postage=entries.length?(band?.price_pence||0):0;return[gross,saving,postage,gross-saving+postage];}
  async function summary(expected,p=page){await p.waitForFunction(values=>JSON.stringify([...document.querySelectorAll('.summary dd')].map(e=>Number(e.textContent.replace(/[^0-9.]/g,''))))===JSON.stringify(values.map(v=>v/100)),expected,{timeout:8000});}
  async function grid(p=page){await p.getByRole('button',{name:'The prints',exact:true}).click();await p.locator('.print-card').first().waitFor();}
  async function clear(p=page){await p.getByRole('button',{name:/Open basket,/}).click();while(await p.getByRole('button',{name:/^Remove /}).count())await p.getByRole('button',{name:/^Remove /}).first().click();require(await p.locator('.basket-line').count()===0,'basket cleanup');}
  async function add(sku,size,qty,p=page){await grid(p);await p.getByRole('button',{name:'View '+title(sku),exact:true}).click();await p.getByRole('button',{name:new RegExp('^'+size)}).click();const q=p.getByRole('spinbutton',{name:'Quantity for '+title(sku)+' '+size+' to add',exact:true});await q.fill(String(qty));await q.blur();await p.getByRole('button',{name:'Add to basket',exact:true}).click();await p.getByRole('status').filter({hasText:'added to your basket'}).waitFor();}
  async function basket(entries){await clear();for(const l of entries)await add(l.sku,l.size,l.qty);await page.getByRole('button',{name:/Open basket,/}).click();await summary(figures(entries));}
  async function prepare(entries,label){await basket(entries);await page.getByRole('button',{name:'Continue to checkout',exact:true}).click();const address={name:'Second '+label+' '+Date.now(),line1:'48 Paper Street',line2:'Studio 2',city:'York',postcode:'YO1 7AA',country:'United Kingdom'};for(const[key,value]of[['Full name',address.name],['Address line 1',address.line1],['Address line 2 (optional)',address.line2],['Town or city',address.city],['Postcode',address.postcode]])await page.getByLabel(key,{exact:true}).fill(value);await page.getByRole('button',{name:'Review order',exact:true}).click();await summary(figures(entries));for(const value of Object.values(address))require((await page.locator('address').innerText()).includes(value),'complete review address '+value);return address;}
  async function buy(entries,label){const address=await prepare(entries,label);const promise=page.waitForResponse(r=>r.url().endsWith('/api/orders')&&r.request().method()==='POST');await page.getByRole('button',{name:'Place order',exact:true}).click();const response=await promise;require(response.status()===201,'fresh UI checkout succeeds');const saved=await response.json(),body=response.request().postDataJSON();report.network.push({purpose:'actual UI checkout',url:response.url(),request:body,status:response.status(),body:saved});await page.getByText(saved.reference,{exact:true}).waitFor();await summary(figures(entries));for(const[k,v]of Object.entries(address))equal(saved['address_'+k],v,'stored address '+k);equal(await order(saved.reference),saved,'fresh server receipt');return{saved,body};}
  async function lookup(p,ref){await p.getByRole('button',{name:'Track an order',exact:true}).click();await p.getByLabel('Order reference',{exact:true}).fill(ref);await p.getByRole('button',{name:'Find order',exact:true}).click();await p.getByText(ref,{exact:true}).waitFor();}
  async function cancel(p=page){
    async function activate(name){for(let i=0;i<80;i++){await p.keyboard.press('Tab');if(await p.evaluate(n=>document.activeElement.tagName==='BUTTON'&&document.activeElement.textContent.trim()===n,name)){await p.keyboard.press('Enter');return;}}throw new Error('keyboard cancellation control unreachable: '+name);}
    await activate('Cancel order');await p.getByRole('alertdialog').waitFor();await activate('Confirm cancellation');await p.getByRole('heading',{name:'Order cancelled.',exact:true}).waitFor();
  }
  async function check(id,fn){const detail=await fn();report.checks.push({id,passed:true,...detail});}
  async function fitScreenshot(name,p=page){require(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page fits '+name);await p.screenshot({path:'/work/'+name+'.png',fullPage:true});}

  try{
    await page.setViewportSize({width:1440,height:1000});await page.locator('.print-card').first().waitFor();
    const control=await buy(lines(['RP-103','A3',1]),'Independent quantity control');
    const before=(await stocks())['RP-103:A3'];equal(before,19,'one control deducted');
    await basket(lines(['RP-103','A3',3]));await add('RP-103','A3',2);await page.getByRole('button',{name:/Open basket,/}).click();
    const uiMerge=await page.locator('.basket-line').count()===1&&await page.getByRole('spinbutton',{name:'Quantity for Nine Windows A3',exact:true}).inputValue()==='5';
    const duplicate=fresh(control.body);duplicate.lines=lines(['RP-103','A3',3],['RP-103','A3',2]);
    const dupResult=await request('/api/orders',duplicate);const duplicatePass=dupResult.status===201&&dupResult.body.lines.length===1&&dupResult.body.lines[0].qty===5&&dupResult.body.total_pence===18445;
    const current=(await stocks())['RP-103:A3'];equal(current,19,'observed stock after duplicate request');
    const bad=[];
    for(const qty of [0,-1,1.5]){
      const input=fresh(control.body);input.lines=lines(['RP-103','A3',qty]);const r=await request('/api/orders',input);
      require(r.status>=400&&!r.body.reference,'invalid quantity refused');equal((await stocks())['RP-103:A3'],current,'invalid quantity leaves stock');equal(await order(control.saved.reference),control.saved,'control receipt retained');bad.push({qty,status:r.status});
    }
    const over=fresh(control.body);over.lines=lines(['RP-103','A3',current],['RP-103','A3',1]);
    const overResult=await request('/api/orders',over);require(overResult.status>=400&&!overResult.body.reference,'combined overstock refuses');equal((await stocks())['RP-103:A3'],current,'overstock leaves stock');
    const unknown=fresh(control.body);unknown.lines=lines(['RP-103','A3',1],['RP-999','A3',1]);const unknownResult=await request('/api/orders',unknown);require(unknownResult.status>=400&&!unknownResult.body.reference,'unknown mixed line refused');equal((await stocks())['RP-103:A3'],current,'unknown line deducts nothing');
    report.outcomes={ui_merge:uiMerge,server_duplicate_merge:duplicatePass,combined_overstock:true,invalid_quantities:true,unknown_variant:true};
    require(uiMerge,'UI positive merge control');equal(duplicatePass,false,'intended duplicate outcome');
    report.checks.push({id:'independent_partial_failure',passed:true,invalidResponses:bad,duplicateStatus:dupResult.status,stockAfterDuplicate:current});
    report.passed=true;
  }catch(e){report.passed=false;report.error=e.stack||String(e);}
  report.finishedAt=new Date().toISOString();return report;
}
