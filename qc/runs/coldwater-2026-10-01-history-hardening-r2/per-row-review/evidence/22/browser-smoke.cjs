const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const fs = require('node:fs');
(async () => {
  console.log(JSON.stringify({ express: require('express/package.json').version, sqlite: require('better-sqlite3/package.json').version, playwright: require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright/package.json').version, chromiumPath: fs.realpathSync('/usr/local/bin/chromium') }));
  const db = new (require('better-sqlite3'))(':memory:');
  console.log('native_sqlite', JSON.stringify(db.prepare('select 22 as probe').get()));
  db.close();
  for(let i=0;i<60;i++) { try { const r=await fetch('http://localhost:3000/api/health'); if(r.ok) { console.log('health',r.status,await r.text()); break; } } catch {} await new Promise(r=>setTimeout(r,100)); }
  const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  try { const page=await browser.newPage(); const response=await page.goto('http://localhost:3000'); console.log('browser',JSON.stringify({version:browser.version(),http:response.status(),title:await page.title(),body:(await page.locator('body').innerText()).slice(0,1000)})); } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
