const fs = require('fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const results = { label: 'DIAGNOSTIC BROWSER SMOKE TEST ONLY, NOT AN LLM JUDGE SCORE', runs: [] };
  try {
    for (const [tag, port] of [['original',3000],['repaired',3001]]) {
      const context = await browser.newContext({ viewport: {width:1280,height:900} });
      const page = await context.newPage();
      const run = { tag, errors:[], requests:[], steps:[] };
      results.runs.push(run);
      page.on('pageerror', error => run.errors.push(error.message));
      page.on('response', async response => {
        if (response.url().includes('/api/') && response.request().method() === 'POST') {
          run.requests.push({url:response.url(),status:response.status(),body:await response.json().catch(()=>null)});
        }
      });
      try {
        await page.goto(`http://127.0.0.1:${port}/`, {waitUntil:'networkidle'});
        run.initialStatus = await page.locator('#status').innerText();
        await page.locator('#modeSelect').selectOption('practice');
        await page.locator('#practiceSelect').selectOption('pegging');
        await page.locator('#scoreAInput').fill('0');
        await page.locator('#scoreBInput').fill('0');
        const createResponse = page.waitForResponse(r => r.url().endsWith('/api/games') && r.request().method()==='POST');
        await page.locator('#createGameButton').click();
        const created = await (await createResponse).json();
        run.created = created;
        await page.waitForTimeout(700);
        run.afterCreate = { status:await page.locator('#status').innerText(), cards:await page.locator('#currentHandPanel .card-btn').count(), visibleText:await page.locator('#currentHandPanel').innerText() };
        await page.screenshot({path:`/diag/${tag}-after-create.png`,fullPage:true});
        if (tag === 'original') {
          assert.match(JSON.stringify(run),/Rules is not defined/);
          assert.equal(run.afterCreate.cards,0);
          run.steps.push('Original failure reproduced: create request succeeds, but Rules is undefined and no hand cards render.');
          continue;
        }
        assert.ok(run.afterCreate.cards>=12);
        const gameId = created.game.id;
        const readGame = async seat => (await (await page.request.get(`http://127.0.0.1:${port}/api/games/${gameId}?seat=${seat}`)).json()).game;
        for (const seat of ['A','B']) {
          await page.locator(`#seat${seat}Button`).click();
          await page.waitForTimeout(250);
          await page.locator('#useSuggestedDiscardButton').click();
          const discardResponse = page.waitForResponse(r=>r.url().endsWith(`/api/games/${gameId}/actions`) && r.request().method()==='POST');
          await page.locator('#submitDiscardButton').click();
          const response = await discardResponse;
          assert.equal(response.status(),200);
          await page.waitForTimeout(250);
          run.steps.push(`Seat ${seat} submitted two suggested discards through the browser.`);
        }
        const beforePlay=await readGame('B');
        assert.equal(beforePlay.phase,'pegging');
        assert.equal(beforePlay.pegging.count,0);
        run.beforePlay=beforePlay;
        await page.locator('#currentHandPanel button[data-card="5S"]:not([disabled])').first().click();
        await page.waitForTimeout(450);
        const afterPlay=await readGame('B');
        assert.equal(afterPlay.pegging.count,5);
        assert.equal(afterPlay.pegging.turnSeat,'A');
        run.steps.push('Seat B played 5S through the browser; fresh API read shows count 5 and turn A.');
        await page.reload({waitUntil:'networkidle'});
        const afterReload=await readGame('B');
        assert.equal(afterReload.pegging.count,5);
        assert.equal(afterReload.revision,afterPlay.revision);
        assert.match(await page.locator('#currentHandPanel').innerText(),/Count: 5/);
        run.steps.push('Reload preserved game, count, revision and rendered count 5.');
        run.afterReload=afterReload;
        await page.screenshot({path:'/diag/repaired-after-play-reload.png',fullPage:true});
        run.passed=true;
      } catch(error) { run.failure=error.stack; }
      finally { await context.close(); }
    }
  } finally {
    fs.writeFileSync('/diag/browser-results.json',JSON.stringify(results,null,2));
    console.log(JSON.stringify(results.runs.map(({tag,errors,steps,failure,passed,afterCreate})=>({tag,errors,steps,failure,passed,afterCreate})),null,2));
    await browser.close();
  }
})().catch(e=>{ console.error(e); process.exitCode=1; });
