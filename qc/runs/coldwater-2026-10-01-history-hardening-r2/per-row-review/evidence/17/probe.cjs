const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const report = {input_sha256:'b10dbfae5ccc478c0bc422ac98a58494148a3c9c1df7b5b226d2b3a9a73f8863', scope:'Independent row17 isolated frozen reference browser probes; no configured judge score', cases:[]};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try {
  const page=await browser.newPage(); page.on('dialog',d=>d.accept());
  await page.goto('http://localhost:3000');
  const enter=async(code,filename)=>{await page.getByLabel('Filename',{exact:true}).fill(filename);await page.locator('.cm-content').click();await page.keyboard.press('Control+A');await page.keyboard.insertText(code);};
  const run=async(name,code,filename)=>{
   await page.getByRole('button',{name:'Clear console',exact:true}).click();await enter(code,filename);await page.getByRole('button',{name:/^Run /}).click();await page.waitForTimeout(650);
   const frame=page.frames().find(f=>f!==page.mainFrame());
   const item={name,code,filename,status:await page.getByRole('status').innerText(),console:await page.getByRole('log').innerText(),body:await frame.locator('body').innerText()}; report.cases.push(item);return {frame,item};
  };
  await run('ordinary-positive','document.body.textContent="row17-control"; console.log("row17-control");','control.js');
  const one='<html><body><button onclick="this.textContent=\'clicked\'">One handler</button></body></html>';
  let p=await run('one-inline-handler-positive',one,'one.html');await p.frame.getByRole('button',{name:'One handler'}).click();await page.waitForTimeout(100);p.item.afterClick=await p.frame.locator('body').innerText();
  await run('two-inline-handlers','<html><body><button onclick="this.textContent=\'clicked\'" onkeydown="this.textContent=\'keyed\'">Two handlers</button></body></html>','two.html');
  await run('inline-script-parser-order','<!doctype html><html><body><script>document.write("<p id=written>parser-written</p>");</script><p id=after>after-script</p><script>console.log(document.getElementById("written").textContent);</script></body></html>','write.html');
  await enter('console.log("filename exact");','  leading.js');await page.getByLabel('Snippet title',{exact:true}).fill('row17 filename');await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForTimeout(200);
  const before=await page.getByLabel('Filename',{exact:true}).inputValue();
  await page.reload();await page.locator('.snippetlist button').filter({hasText:'row17 filename'}).click();
  report.cases.push({name:'filename-fidelity',requested:'  leading.js',afterSave:before,afterReload:await page.getByLabel('Filename',{exact:true}).inputValue(),record:await page.request.get('http://localhost:3000/api/snippets').then(r=>r.json())});
 }finally{await browser.close();}
})().catch(e=>{report.error=String(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync('/evidence/probe-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));});
