const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const report = {scope: 'Local browser diagnostic of the unmodified uploaded GPT application with cached dependencies and a fresh isolated database; not a platform rescore', errors: [], checks: {}};
async function main() {
  const browser = await chromium.launch({headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto('http://localhost:3000');
    await page.locator('input[name=email]').fill('coord@pellmoor.test');
    await page.locator('input[name=password]').fill('password123');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await page.locator('[data-action=select-vacancy]').first().waitFor();
    await page.locator('[data-action=select-vacancy][data-vacancy-code="ROLE-014"]').click();
    report.checks.funnel_after_vacancy_selection = await page.locator('.funnel-chart').evaluate(el => ({svg: el.querySelectorAll('svg').length, canvas: el.querySelectorAll('canvas').length, text: el.textContent}));
    await page.locator('[data-action=select-candidate]').first().click();
    report.checks.funnel_after_candidate_selection = await page.locator('.funnel-chart').evaluate(el => ({svg: el.querySelectorAll('svg').length, canvas: el.querySelectorAll('canvas').length, text: el.textContent}));
    await page.screenshot({path: '/evidence/gpt-after-candidate.png', fullPage: true});
    await page.locator('[data-action=select-vacancy][data-vacancy-code="ROLE-017"]').click();
    const observed = [];
    page.on('request', req => {if(req.method() === 'POST' && req.url().includes('/candidates')) observed.push({url:req.url(),body:req.postData()});});
    const before = await page.evaluate(() => fetch('/api/workspace').then(r => r.json()));
    await page.getByRole('textbox', {name:'New applicant name'}).fill('Ilse Vandal');
    await page.getByRole('button', {name:'Add candidate', exact:true}).click();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => fetch('/api/workspace').then(r => r.json()));
    report.checks.empty_vacancy_creation = {requests:observed,before:before.vacancies.find(v => v.code==='ROLE-017'),after:after.vacancies.find(v=>v.code==='ROLE-017')};
    await page.screenshot({path:'/evidence/gpt-empty-vacancy.png',fullPage:true});
    assert.equal(report.checks.funnel_after_vacancy_selection.svg,1);
    assert.equal(report.checks.funnel_after_candidate_selection.svg,0);
    assert.equal(observed.length,0);
    assert.deepEqual(report.checks.empty_vacancy_creation.before,report.checks.empty_vacancy_creation.after);
    assert.equal(report.checks.empty_vacancy_creation.after.applications.length,0);
    report.confirmed = ['Funnel SVG appears on vacancy selection but is erased by candidate selection', 'Empty-vacancy add form sends no request and leaves state unchanged'];
    report.passed = true;
  } finally {await browser.close();}
}
main().catch(e=>{report.error=e.stack;process.exitCode=1;console.error(e);}).finally(()=>fs.writeFileSync('/evidence/gpt-browser-probe.json',JSON.stringify(report,null,2)));
