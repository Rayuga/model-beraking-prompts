const fs = require('node:fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const observations = [];
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/usr/local/bin/chromium', args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    await page.goto('http://localhost:3000');
    await page.getByRole('status').filter({hasText:'Complete'}).waitFor();
    const take = async name => {
      const preview = page.frameLocator('iframe[title="Live preview"]');
      observations.push({name, hostTheme:await page.locator('html').getAttribute('data-theme'), body:await preview.locator('body').innerText(), visible:await preview.locator('body').isVisible(), style:await preview.locator('body').evaluate(e=>({color:getComputedStyle(e).color,visibility:getComputedStyle(e).visibility,display:getComputedStyle(e).display,opacity:getComputedStyle(e).opacity})), frame:await page.locator('iframe').boundingBox()});
      await page.screenshot({path:'/evidence/'+name+'.png',fullPage:true});
    };
    await take('initial');
    await page.getByRole('button',{name:'Light theme',exact:true}).click();
    await page.waitForTimeout(300);
    await take('light-300ms');
    await page.waitForTimeout(2000);
    await take('light-2300ms');
    await page.getByRole('button',{name:'Dark theme',exact:true}).click();
    await page.waitForTimeout(500);
    await take('dark-return');
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(1000);
    await take('mobile');
    await page.locator('iframe').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({path:'/evidence/mobile-viewport.png'});
  } finally {await browser.close();fs.writeFileSync('/evidence/observations.json',JSON.stringify(observations,null,2));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
