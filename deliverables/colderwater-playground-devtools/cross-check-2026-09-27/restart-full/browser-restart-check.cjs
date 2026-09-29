const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const phase = process.argv[2];
const snapshotPath = '/logs/verifier/local-persistence-before.json';
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const results = [];
  let promptAnswer = '';
  page.on('dialog', dialog => dialog.accept(dialog.type() === 'prompt' ? promptAnswer : undefined));
  const editor = page.getByRole('textbox', { name: 'Code editor', exact: true });
  const saved = () => page.evaluate(async () => (await fetch('/api/snippets')).json());
  async function source(text) {
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(text);
  }
  async function save() {
    const response = page.waitForResponse(r => /\/api\/snippets(?:\/\d+)?$/.test(r.url()) && ['POST', 'PUT'].includes(r.request().method()));
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const value = await response;
    assert(value.ok(), await value.text());
    await page.getByRole('status').filter({ hasText: /Saved.*revision/ }).waitFor();
    return value.json();
  }
  async function load(title) {
    await page.locator('.snippetlist button').filter({ hasText: title }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Snippet title', exact: true }).inputValue(), title);
  }
  async function create(title, text) {
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByRole('textbox', { name: 'Snippet title', exact: true }).fill(title);
    await page.getByRole('textbox', { name: 'Filename', exact: true }).fill('qc-restart.js');
    await source(text);
    return save();
  }
  try {
    await page.goto('http://localhost:3000');
    await editor.waitFor();
    if (phase === 'prepare') {
      const primary = await create('QC Restart Primary', "console.log('restart-original');");
      promptAnswer = 'QC Restart Copy';
      const duplication = page.waitForResponse(r => r.url().endsWith('/api/snippets') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
      assert((await duplication).ok());
      await page.getByRole('status').filter({ hasText: 'QC Restart Copy' }).waitFor();
      await source("console.log('restart-copy-edited');");
      const copy = await save();
      assert.notEqual(primary.id, copy.id);
      const deleted = await create('QC Restart Deleted', "console.log('delete-control');");
      const deletion = page.waitForResponse(r => r.request().method() === 'DELETE');
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      assert((await deletion).ok());
      await page.getByRole('status').filter({ hasText: 'Deleted' }).waitFor();
      const records = await saved();
      assert.equal(records.length, 2);
      assert(!records.some(row => row.id === deleted.id));
      assert.deepEqual(records.find(row => row.id === primary.id), primary);
      assert.deepEqual(records.find(row => row.id === copy.id), copy);
      fs.writeFileSync(snapshotPath, JSON.stringify({ primary, copy, deleted, records }, null, 2));
      results.push('UI-created primary, independently edited duplicate, and confirmed deletion');
    } else {
      const before = JSON.parse(fs.readFileSync(snapshotPath));
      assert.deepEqual(await saved(), before.records);
      for (const [record, marker] of [[before.primary, 'restart-original'], [before.copy, 'restart-copy-edited']]) {
        await load(record.title);
        assert.equal(await page.getByRole('textbox', { name: 'Filename', exact: true }).inputValue(), record.filename);
        assert.equal(await editor.innerText(), record.code);
        await page.getByRole('button', { name: 'Clear console', exact: true }).click();
        await page.getByRole('button', { name: /^Run/ }).click();
        await page.getByRole('log').getByText(marker, { exact: true }).waitFor();
      }
      await load(before.primary.title);
      await source("console.log('restart-after-save');");
      const updated = await save();
      assert.equal(updated.revision, before.primary.revision + 1);
      assert.equal(updated.code, "console.log('restart-after-save');");
      const after = await saved();
      assert.deepEqual(after.find(row => row.id === before.primary.id), updated);
      assert.deepEqual(after.find(row => row.id === before.copy.id), before.copy);
      assert(!after.some(row => row.id === before.deleted.id));
      results.push('Fresh browser after real restart loads exact records/revisions, runs both, and saves a new revision with the new primary confirmed by a fresh read and without altering the sibling');
    }
    console.log(JSON.stringify({ phase, passed: true, results, browser: await page.evaluate(() => navigator.userAgent) }));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
