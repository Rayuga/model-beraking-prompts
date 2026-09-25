const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/opt/playwright-browsers/chromium-1237/chrome-linux64/chrome', args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  await page.goto('http://127.0.0.1:3000');
  const snapshot = () => page.locator('#replayModal').evaluate(e => ({hidden:e.hidden, display:getComputedStyle(e).display, width:e.getBoundingClientRect().width, height:e.getBoundingClientRect().height, topHit:document.elementFromPoint(640,400)?.closest('#replayModal')?.id || null}));
  const result = {initial:await snapshot()};
  await page.locator('#emailInput').fill('avery@dropline.test');
  await page.locator('#passwordInput').fill('password123');
  try { await page.locator('#signInForm button[type=submit]').click({trial:true,timeout:2000}); result.signInReachable=true; }
  catch(e) {result.signInReachable=false;result.clickError=String(e);}
  await page.locator('#closeReplayButton').click();
  result.afterClose=await snapshot();
  try { await page.locator('#signInForm button[type=submit]').click({trial:true,timeout:2000}); result.signInReachableAfterClose=true; }
  catch(e) {result.signInReachableAfterClose=false;}
  await page.screenshot({path:'/tmp/gpt-gate-overlay.png',fullPage:true});
  await page.reload();
  result.afterReload=await snapshot();
  await browser.close();
  fs.writeFileSync('/tmp/gpt-gate-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
