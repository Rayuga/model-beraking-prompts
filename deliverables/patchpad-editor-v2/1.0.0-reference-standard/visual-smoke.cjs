const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const page = await browser.newPage();
  const observations = [];
  try {
    for (const [name, width, height] of [['desktop',1280,800],['mobile',390,844]]) {
      await page.setViewportSize({width,height});
      await page.goto('http://localhost:3000');
      await page.waitForFunction(() => document.querySelector('#doc-title')?.textContent === 'Northwind API Incident Report');
      await page.screenshot({path:`/results/visual-${name}.png`,fullPage:true});
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        toolbar: [...document.querySelectorAll('.toolbar button,.toolbar input')].map(e => {
          const r=e.getBoundingClientRect();return {name:e.textContent||e.getAttribute('aria-label'),left:r.left,right:r.right};
        }),
        editorScrolls: document.querySelector('#editor').scrollWidth > document.querySelector('#editor').clientWidth,
      }));
      observations.push({name,...layout});
      assert.ok(layout.pageWidth <= width + 1, `${name}: page-wide overflow ${layout.pageWidth} > ${width}`);
      assert.ok(layout.toolbar.every(x=>x.left>=0&&x.right<=width+1), `${name}: clipped toolbar`);
      const preview = page.getByRole('button',{name:/preview/i}).first();
      if(await preview.count()) {
        await preview.click();
        await page.locator('aside').scrollIntoViewIfNeeded();
        await page.screenshot({path:`/results/visual-${name}-history.png`,fullPage:true});
      }
    }
  } finally {
    fs.writeFileSync('/results/visual-layout.json',JSON.stringify({scope:'Local layout/screenshot inspection, not a visual judge score',observations},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
