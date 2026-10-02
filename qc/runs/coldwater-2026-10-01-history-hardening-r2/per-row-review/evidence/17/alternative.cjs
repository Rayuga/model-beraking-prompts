const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const result={scope:'Ordinary HTML behavior control and equivalent supported-source alternative; not a judge run'};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const native=await browser.newPage();
  await native.setContent('<html><body><button onclick="this.textContent=\'clicked\'" onkeydown="this.textContent=\'keyed\'">Two handlers</button></body></html>');
  await native.getByRole('button').click();result.nativeAfterClick=await native.getByRole('button').innerText();
  await native.getByRole('button').press('a');result.nativeAfterKey=await native.getByRole('button').innerText();
  const page=await browser.newPage();await page.goto('http://localhost:3000');
  const source='<html><body><button id="b">Two listeners</button><script>const b=document.getElementById("b");b.addEventListener("click",()=>b.textContent="clicked");b.addEventListener("keydown",()=>b.textContent="keyed");</script></body></html>';
  await page.getByLabel('Filename',{exact:true}).fill('listeners.html');await page.locator('.cm-content').click();await page.keyboard.insertText(source);await page.getByRole('button',{name:/^Run /}).click();await page.waitForTimeout(500);
  const frame=page.frames().find(f=>f!==page.mainFrame());await frame.getByRole('button').click();await page.waitForTimeout(100);result.alternativeAfterClick=await frame.getByRole('button').innerText();await frame.getByRole('button').press('a');await page.waitForTimeout(100);result.alternativeAfterKey=await frame.getByRole('button').innerText();result.alternativeStatus=await page.getByRole('status').innerText();result.source=source;
 }finally{await browser.close();}
})().catch(e=>{result.error=String(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync('/evidence/alternative-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
