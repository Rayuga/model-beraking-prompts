async (page) => {
  const config = CONFIG;
  const observed = [];
  const requests = [];
  const main = await page.context().newPage();
  main.setDefaultTimeout(7000);
  main.on('response', r=>{if (r.request().resourceType()==='script') requests.push({url:r.url(),status:r.status(),resourceType:'script'});});
  main.on('dialog', d=>d.dismiss());
  const marker='privacy-proof-'+config.name;
  async function control(target, tag) {
    const code="document.body.innerHTML='<p>"+tag+"</p>';console.log('"+tag+"-log');";
    const editor=target.getByRole('textbox',{name:'Code editor',exact:true});
    await editor.waitFor({state:'visible'});
    const auto=target.getByRole('checkbox',{name:'Auto-run',exact:true});
    if (await auto.count()) await auto.uncheck();
    const filename=target.getByRole('textbox',{name:'Filename',exact:true});
    if (await filename.count()) await filename.fill('privacy-control.js');
    const isTextarea=await editor.evaluate(e=>e.tagName==='TEXTAREA');
    if (isTextarea) await editor.fill(code);
    else {await editor.click();await target.keyboard.press('Control+A');await target.keyboard.insertText(code);}
    await target.getByRole('button',{name:/^Run(?: |$)/}).click();
    await target.frameLocator('iframe[title="Live preview"]').getByText(tag,{exact:true}).waitFor();
    await target.getByRole('log').filter({hasText:tag+'-log'}).waitFor();
    return {preview:true,console:true,marker:tag};
  }
  try {
    await main.goto(config.base,{waitUntil:'domcontentloaded'});
    const initial=await control(main,marker+'-before');
    const publicAssets = requests.filter(r=>r.status>=200&&r.status<300).map(r=>r.url.split('?')[0].replace(/^https?:\/\/[^/]+/,''));
    for (const candidate of config.paths) {
      const probe=await main.context().newPage();
      probe.setDefaultTimeout(5000);
      const downloads=[];
      const navigationResponses=[];
      probe.on('download',d=>downloads.push({url:d.url(),suggestedFilename:d.suggestedFilename()}));
      probe.on('response',r=>{if(r.request().isNavigationRequest()&&r.frame()===probe.mainFrame())navigationResponses.push({url:r.url(),status:r.status()});});
      let response=null, navigationError=null;
      try {response=await probe.goto(config.base+candidate,{waitUntil:'domcontentloaded',timeout:10000});}
      catch(error){navigationError=String(error).split('\n')[0];}
      await probe.waitForTimeout(75);
      const status=response?.status()??navigationResponses.at(-1)?.status??null;
      const assetOverlap=publicAssets.includes(candidate);
      let fallback=false, fallbackControl=null;
      if (!downloads.length && status>=200 && status<300 && await probe.getByRole('textbox',{name:'Code editor',exact:true}).count() && await probe.locator('iframe[title="Live preview"]').count() && await probe.getByRole('log').count()) {
        fallbackControl=await control(probe,marker+'-fallback-'+observed.length);
        fallback=true;
      }
      // No body/source/database access. Only response/download metadata, working
      // UI controls, and observed requests made by that working UI are examined.
      const outcome=status>=400?'denied_or_missing':[204,205].includes(status)?'no_content':assetOverlap?'observed_public_browser_asset':downloads.length?'file_download':fallback?'working_playground_fallback':'other_successful_resource_or_unavailable_observation';
      observed.push({candidate,status,finalUrl:probe.url(),downloads,navigationResponses,navigationError,observedAsBrowserAsset:assetOverlap,fallbackControl,outcome});
      await probe.close();
    }
    const final=await control(main,marker+'-after');
    return {name:config.name,initialControl:initial,finalControl:final,observedWorkingPageScriptRequests:requests,observations:observed};
  } finally {await main.close();}
}
