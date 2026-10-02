const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const assert = require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:3000');
  await page.locator('.cm-editor').waitFor();
  await page.getByRole('button',{name:/^Run\b/}).waitFor();
  assert.equal(errors.length,0);
  const result={title:await page.title(),editorCount:await page.locator('.cm-editor').count(),buttons:await page.getByRole('button').allTextContents(),pageErrors:errors};
  console.log(JSON.stringify(result));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
