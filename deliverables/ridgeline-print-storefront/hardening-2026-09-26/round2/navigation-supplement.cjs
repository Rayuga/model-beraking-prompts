const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const evidence = {kind:'Narrow supplement for exact polish return-navigation sequence',checks:[]};
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  evidence.browserVersion=browser.version();
  try {
    for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
      const page=await browser.newPage({viewport});
      await page.goto('http://localhost:3000');
      await page.getByRole('button',{name:'View Long Field',exact:true}).click();
      await page.getByRole('heading',{name:'Long Field',exact:true}).waitFor();
      await page.getByRole('button',{name:'All prints',exact:false}).click();
      await page.locator('.print-card').first().waitFor();
      const catalogueUsable=await page.locator('.print-card').count()===8;
      evidence.checks.push({name:name+' detail returns directly to usable catalogue',passed:catalogueUsable});
      assert(catalogueUsable);
      await page.getByRole('button',{name:/Open basket,/}).click();
      await page.getByRole('heading',{name:'The basket.',exact:true}).waitFor();
      await page.getByRole('button',{name:'Continue browsing',exact:false}).click();
      await page.locator('.print-card').first().waitFor();
      const returned=await page.locator('.print-card').count()===8;
      evidence.checks.push({name:name+' basket returns directly to usable catalogue',passed:returned});
      assert(returned);
      await page.close();
    }
    evidence.passed=true;
  }catch(error){evidence.passed=false;evidence.error=error.stack;throw error;}
  finally {
    fs.writeFileSync('/evidence/round2/navigation-supplement-results.json',JSON.stringify(evidence,null,2));
    console.log(JSON.stringify(evidence,null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
