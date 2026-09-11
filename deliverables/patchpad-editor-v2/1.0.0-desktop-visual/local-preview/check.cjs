const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');
    await page.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');
    assert.equal(await page.locator('#editor').isVisible(),true);
    assert.equal(await page.locator('#revision-label').innerText(),'Revision 1');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:'/preview/desktop.png'});
    const result={url:'http://localhost:3034',version:JSON.parse(fs.readFileSync('/app/package.json')).version,title:await page.title(),editorVisible:true,revision:1,browserErrors:errors};
    fs.writeFileSync('/preview/check.json',JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
