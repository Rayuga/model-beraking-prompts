const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const report={scope:'Downloaded previous Luna app: revised basic calculated-output prerequisite only; not a configured grade'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage();await page.goto('http://localhost:3000');
 if(await page.locator('#autoRun').isChecked())await page.locator('.switch-label').click();
 const marker='calculation-'+Date.now(),a=19,b=34,expected=marker+':'+(a+b);
 const source=`const marker=${JSON.stringify(marker)},a=${a},b=${b};const output=marker+':'+(a+b);document.body.textContent=output;console.log(output);`;
 await page.locator('#filenameInput').fill('calculation.js');await page.locator('#sourceInput').fill(source);await page.locator('#runBtn').click();
 const preview=page.frameLocator('#previewWrap iframe').locator('body');await preview.getByText(expected,{exact:true}).waitFor();
 report.source=source;report.expected=expected;report.preview=await preview.innerText();report.console=await page.locator('#consoleLog').innerText();
 report.passed=report.preview===expected&&report.console.includes(expected);assert(report.passed);
 }finally{await browser.close();}})().catch(error=>{report.error=String(error);process.exitCode=1;}).finally(()=>{fs.writeFileSync('/evidence/computed-luna-gate.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));});
