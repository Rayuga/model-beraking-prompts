// Local diagnostic of the public-runtime policy, not an LLM judge or Internet reachability test.
// Requires the unchanged golden app already running at localhost:3000. Writes JSON only to stdout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

async function main() {
  const fontCandidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
  ];
  let fontPath = fontCandidates.find(path => fs.existsSync(path));
  if (!fontPath) {
    fontPath = execFileSync('fc-match', ['-f', '%{file}', 'monospace'], {encoding:'utf8'}).trim();
  }
  assert(fontPath && fs.existsSync(fontPath), 'A valid local font fixture is required');
  const fontBytes = fs.readFileSync(fontPath), assetRequests = [];
  const assetServer = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    assetRequests.push(path);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (path === '/runtime.css') {
      res.setHeader('Content-Type', 'text/css');
      res.end('@font-face{font-family:NetworkPolicyProbe;src:url("/runtime-font.ttf") format("truetype")} #network-policy-proof{font-family:NetworkPolicyProbe;color:rgb(17,119,85)}');
    } else if (path === '/runtime.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(`document.documentElement.dataset.externalScriptLoaded='true';fetch(new URL('/runtime-config.json',document.currentScript.src)).then(r=>r.json()).then(x=>{document.documentElement.dataset.externalApiLoaded=x.status;});`);
    } else if (path === '/runtime-config.json') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({status:'ready'}));
    } else if (path === '/runtime-font.ttf') {
      res.setHeader('Content-Type', 'font/ttf');res.end(fontBytes);
    } else {res.statusCode=404;res.end('Not found');}
  });
  await new Promise((resolve, reject) => {
    assetServer.once('error', reject);assetServer.listen(0, '127.0.0.1', resolve);
  });
  const externalOrigin = `http://127.0.0.1:${assetServer.address().port}`;
  let browser, page, stage='launch';
  const errors=[], consoleErrors=[], externalResponses=[], externalBrowserRequests=[], failedRequests=[], writes=[], transformedRoots=[];
  const fixturePermission={name:'local-network-access',origin:'http://localhost:3000',granted:false,
    reason:'The second-origin asset fixture uses loopback. Chrome blocked those fixture requests before they reached its server; public Internet assets are not simulated by disabling browser security.'};
  try {
    browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
    const context = await browser.newContext({viewport:{width:1280,height:800}});
    stage='grant-loopback-fixture-permission';
    // Scoped to the temporary context's app origin, using Playwright's documented permission.
    // https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions
    await context.grantPermissions([fixturePermission.name],{origin:fixturePermission.origin});
    fixturePermission.granted=true;
    const snapshot = async() => {
      const readContext = await browser.newContext();
      try {
        const get = async path => {
          const response=await readContext.request.get('http://localhost:3000'+path);
          assert.equal(response.status(),200);return response.json();
        };
        const listing=await get('/api/documents');
        const document=await get('/api/documents/incident-alpha');
        const history=await get('/api/documents/incident-alpha/revisions');
        const contents=[];
        for(const row of history.revisions) contents.push(await get('/api/documents/incident-alpha/revisions/'+row.revision));
        return {listing,document,history,contents};
      } finally {await readContext.close();}
    };
    const baseline=await snapshot();
    page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
    page.on('requestfailed',request=>failedRequests.push({url:request.url(),type:request.resourceType(),failure:request.failure()?.errorText}));
    page.on('request',request=>{if(new URL(request.url()).origin===externalOrigin)externalBrowserRequests.push({url:request.url(),type:request.resourceType()});});
    page.on('response',response=>{
      if(new URL(response.url()).origin===externalOrigin) externalResponses.push({url:response.url(),status:response.status(),type:response.request().resourceType()});
    });
    context.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method()))writes.push({method:request.method(),url:request.url()});});
    await page.route('http://localhost:3000/',async route=>{
      const original=await route.fetch();
      let html=await original.text();
      assert.equal(original.status(),200,'Root fixture must start with a complete successful HTML response');
      assert(html.includes('</head>')&&html.includes('</body>'),'Root fixture insertion points must exist');
      html=html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']content-security-policy["'][^>]*>/gi,'');
      html=html.replace('</head>',`<link rel="stylesheet" href="${externalOrigin}/runtime.css"><script defer src="${externalOrigin}/runtime.js"></script></head>`);
      html=html.replace('</body>','<span id="network-policy-proof" aria-hidden="true" style="position:fixed;bottom:2px;right:2px;font-size:10px;pointer-events:none">Network asset proof</span></body>');
      transformedRoots.push({url:route.request().url(),status:original.status(),externalScriptInjected:html.includes(`${externalOrigin}/runtime.js`)});
      const headers={...original.headers()};
      delete headers['content-security-policy'];delete headers['content-security-policy-report-only'];delete headers['content-length'];
      await route.fulfill({response:original,headers,body:html});
    });
    const content = q=>q.locator('#editor .text').evaluateAll(nodes=>nodes.map(node=>node.dataset.lineText).join('\n'));
    const ready = q=>q.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');
    const smoke = async q=>{
      await q.locator('#find-box').fill('Timeline');await q.locator('#find-next-btn').click();
      const before=await q.locator('#cursor-label').innerText();
      await q.keyboard.press('ArrowLeft');
      const changed=(await q.locator('#cursor-label').innerText())!==before;
      await q.locator('#find-box').fill('');return changed;
    };
    const nativeSurface = q=>q.locator('#editor').evaluate(element=>
      ['TEXTAREA','INPUT'].includes(element.tagName)||element.isContentEditable);
    const verifyPositive = async()=>{
      await ready(page);
      await page.waitForFunction(()=>document.documentElement.dataset.externalScriptLoaded==='true'&&document.documentElement.dataset.externalApiLoaded==='ready',null,{timeout:10000});
      await page.evaluate(()=>document.fonts.load('12px NetworkPolicyProbe'));
      assert(await page.evaluate(()=>document.fonts.check('12px NetworkPolicyProbe')));
      assert.equal(await page.locator('#network-policy-proof').evaluate(e=>getComputedStyle(e).color),'rgb(17, 119, 85)');
      assert.equal(new URL(page.url()).origin,'http://localhost:3000');
      assert.equal(await content(page),baseline.document.document.content);
      assert.equal(await nativeSurface(page),false);
      assert(await smoke(page),'Real non-mutating document interaction must work');
      assert.equal(await content(page),baseline.document.document.content);
    };
    stage='initial-entry';await page.goto('http://localhost:3000/');await verifyPositive();
    stage='reload';await page.reload();await verifyPositive();
    for(const path of ['/runtime.css','/runtime.js','/runtime-font.ttf','/runtime-config.json']) {
      assert(assetRequests.includes(path),'Missing real external-origin request '+path);
      assert(externalResponses.some(x=>new URL(x.url).pathname===path&&x.status===200),'Missing successful response '+path);
    }
    stage='negative-controls';
    const clonedHtml=(await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    const dead=await context.newPage();await dead.setContent(clonedHtml);
    assert.equal(await content(dead),baseline.document.document.content);
    assert.equal(await nativeSurface(dead),false);
    assert.equal(await smoke(dead),false,'Static custom-looking clone must fail the working-content prerequisite');
    await dead.close();
    const prohibited=await context.newPage();await prohibited.setContent(clonedHtml);
    await prohibited.locator('#editor').evaluate((element,text)=>{
      const native=document.createElement('textarea');native.id='editor';native.value=text;native.style.cssText='width:600px;height:300px';element.replaceWith(native);
    },baseline.document.document.content);
    assert.equal(await nativeSurface(prohibited),true,'Textarea document surface remains prohibited');
    await prohibited.locator('#editor').focus();await prohibited.keyboard.press('Control+End');
    const before=await prohibited.locator('#editor').evaluate(e=>e.selectionStart);
    await prohibited.keyboard.press('ArrowLeft');
    assert.equal(await prohibited.locator('#editor').evaluate(e=>e.selectionStart),before-1,'Native negative control is actually interactive');
    assert.equal(await prohibited.locator('#editor').inputValue(),baseline.document.document.content);
    await prohibited.close();
    stage='persisted-state-comparison';
    assert.deepEqual(await snapshot(),baseline,'All local persisted content, revisions and historical contents must remain unchanged');
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
    console.log(JSON.stringify({
      passed:true,paidJudge:false,actualInternetUsed:false,fixture:'Real second-origin loopback HTTP server; rendered HTML transformed only in this browser context',
      rootOrigin:'http://localhost:3000',externalOrigin,externalResponses,fixturePermission,
      externalStylesScriptFontAndAuxiliaryApiLoaded:true,entryAndReloadWork:true,customGoldenInteractionWorks:true,
      legacyBlanketOriginRuleWouldReject:true,staticCloneFailsWorkingContent:true,interactiveTextareaFailsCustomSurface:true,
      fullPersistedSnapshotUnchanged:true,applicationWrites:writes,errors,
      limitation:'Local behavioral controls demonstrate the intended policy boundary. They do not prove an LLM judge follows the revised prompt or test public Internet availability.'
    },null,2));
  } catch(error) {
    const dom=page&&!page.isClosed()?await page.evaluate(()=>({
      url:location.href,scriptLoaded:document.documentElement.dataset.externalScriptLoaded||null,
      apiLoaded:document.documentElement.dataset.externalApiLoaded||null,
      scripts:[...document.scripts].map(script=>({src:script.src,type:script.type,defer:script.defer})),
      styles:[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.href),
      proofPresent:!!document.querySelector('#network-policy-proof')
    })).catch(observationError=>({observationError:observationError.message})):null;
    console.log(JSON.stringify({passed:false,paidJudge:false,fixtureFailure:true,stage,error:error.message,
      externalOrigin,fixturePermission,assetRequests,externalBrowserRequests,externalResponses,failedRequests,errors,consoleErrors,
      transformedRoots,dom,applicationWrites:writes},null,2));
    throw error;
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>assetServer.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
