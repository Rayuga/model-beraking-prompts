const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const phase = process.argv[2];
const snapshot = process.env.CW_RESTART_LOG_DIR+'/browser-state-before.json';
async function main() {
  const browser = await chromium.launch({headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox']});
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  const page = await context.newPage();
  const report = {phase, checks: [], writes: [], browserErrors: []};
  let promptAnswer = '';
  const prep = p => {
    p.on('dialog', d => d.accept(d.type() === 'prompt' ? promptAnswer : undefined));
    p.on('pageerror', e => report.browserErrors.push(String(e)));
    p.on('request', r => { if (['POST','PUT','DELETE'].includes(r.method())) report.writes.push({method:r.method(),url:r.url(),body:r.postData()}); });
  };
  prep(page);
  const editor = p => p.getByRole('textbox', {name:'Code editor',exact:true});
  const editorText = async p => (await editor(p).locator('.cm-line').allTextContents()).join('\n');
  const title = p => p.getByRole('textbox', {name:'Snippet title',exact:true});
  const filename = p => p.getByRole('textbox', {name:'Filename',exact:true});
  const saved = p => p.evaluate(async () => (await fetch('/api/snippets')).json());
  async function enter(p, code, file) {
    await filename(p).fill(file); await editor(p).click(); await p.keyboard.press('Control+A'); await p.keyboard.insertText(code);
    assert.equal(await editorText(p), code);
  }
  async function save(p) {
    const pending = p.waitForResponse(r => /\/api\/snippets(?:\/\d+)?$/.test(r.url()) && ['POST','PUT'].includes(r.request().method()));
    await p.getByRole('button',{name:'Save',exact:true}).click();
    const response = await pending; const record = await response.json(); assert(response.ok(), JSON.stringify(record));
    await p.getByRole('status').filter({hasText:/Saved.*revision/}).waitFor();
    return record;
  }
  async function create(p, name, file, code) {
    await p.getByRole('button',{name:'New',exact:true}).click(); await title(p).fill(name); await enter(p, code, file); return save(p);
  }
  async function load(p, record) {
    await p.locator('.snippetlist button').filter({hasText:record.title}).click();
    assert.equal(await title(p).inputValue(),record.title); assert.equal(await filename(p).inputValue(),record.filename); assert.equal(await editorText(p),record.code);
    assert((await p.locator('.editor > .paneheading').innerText()).includes(`revision ${record.revision}`));
  }
  async function open(p) {
    await p.goto('http://localhost:3000'); await editor(p).waitFor();
    await p.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Complete'));
    await p.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();
  }
  try {
    await open(page);
    if (phase === 'prepare') {
      const gate = await create(page,'CW gate final-sequence','gate.js',"document.body.textContent='gate-final-sequence';console.log('gate-final-sequence');");
      const clean = await browser.newContext(); const cleanPage = await clean.newPage(); prep(cleanPage); await open(cleanPage); await load(cleanPage,gate); await cleanPage.reload(); await load(cleanPage,gate);
      assert.deepEqual((await saved(cleanPage)).find(x=>x.id===gate.id),gate); await clean.close();
      report.checks.push({name:'gate_record_shared_and_retained',passed:true,record:gate});
      await page.getByRole('combobox',{name:'Starter example',exact:true}).selectOption('hello.js');
      await page.waitForFunction(()=>document.querySelector('input[aria-label="Filename"]').value==='hello.js');
      const exampleOriginal=await editorText(page);await title(page).fill('QC Example Saved Copy');await enter(page,exampleOriginal+'\n// early-restart-example-copy','hello.js');const example=await save(page);
      const alpha = await create(page,'QC Save Alpha','qc-alpha.js',"console.log('alpha-body');");
      const beta = await create(page,'QC Save Beta','qc-beta.html','<!doctype html><html><body><p>beta-body</p></body></html>');
      for (const record of [alpha,beta]) await load(page,record);
      await page.reload(); for (const record of [alpha,beta]) await load(page,record);
      assert.deepEqual((await saved(page)).find(x=>x.id===alpha.id),alpha); assert.deepEqual((await saved(page)).find(x=>x.id===beta.id),beta);
      report.checks.push({name:'save_load_immediately_before_restart_criterion',passed:true,alpha,beta});
      const primary = await create(page,'QC Restart Primary','qc-restart.js',"console.log('restart-original');");
      promptAnswer='QC Restart Copy'; const duplicate=page.waitForResponse(r=>r.url().endsWith('/api/snippets')&&r.request().method()==='POST');
      await page.getByRole('button',{name:'Duplicate',exact:true}).click(); const duplicated=await(await duplicate).json();
      await page.getByRole('status').filter({hasText:'QC Restart Copy'}).waitFor();
      assert.notEqual(primary.id,duplicated.id); assert.equal(duplicated.code,primary.code); assert.equal(duplicated.filename,primary.filename);
      await enter(page,"console.log('restart-copy-edited');",'qc-restart.js'); const copy=await save(page);
      const deleted=await create(page,'QC Restart Deleted','qc-restart.js',"console.log('restart-deleted');");
      const deletion=page.waitForResponse(r=>r.request().method()==='DELETE'); await page.getByRole('button',{name:'Delete',exact:true}).click(); assert((await deletion).ok());
      await page.getByRole('status').filter({hasText:'Deleted'}).waitFor();
      const records=await saved(page); assert.equal(records.length,6);
      for(const item of [gate,example,alpha,beta,primary,copy]) assert.deepEqual(records.find(x=>x.id===item.id),item);
      assert(!records.some(x=>x.id===deleted.id));
      fs.writeFileSync(snapshot,JSON.stringify({gate,example,alpha,beta,primary,copy,deleted,records},null,2));
      report.checks.push({name:'early_restart_own_controls_with_prior_gate_and_save_load_records',passed:true,records,deleted});
    } else {
      const before=JSON.parse(fs.readFileSync(snapshot)); assert.deepEqual(await saved(page),before.records);
      for(const record of [before.gate,before.example,before.alpha,before.beta,before.primary,before.copy]) await load(page,record);
      for(const [record,marker] of [[before.primary,'restart-original'],[before.copy,'restart-copy-edited']]) {
        await load(page,record); await page.getByRole('button',{name:'Clear console',exact:true}).click(); await page.getByRole('button',{name:/^Run /}).click(); await page.getByRole('log').getByText(marker,{exact:true}).waitFor();
      }
      await load(page,before.primary); await enter(page,"console.log('restart-after-save');",'qc-restart.js'); const updated=await save(page);
      assert.equal(updated.id,before.primary.id); assert.equal(updated.revision,before.primary.revision+1); assert.equal(updated.code,"console.log('restart-after-save');");
      const after=await saved(page); assert.deepEqual(after.find(x=>x.id===updated.id),updated);
      for(const record of [before.gate,before.example,before.alpha,before.beta,before.copy]) assert.deepEqual(after.find(x=>x.id===record.id),record);
      assert.equal(after.length,before.records.length); assert(!after.some(x=>x.id===before.deleted.id));
      report.checks.push({name:'fresh_browser_after_real_restart_exact_list_sources_runs_and_revision_save',passed:true,updated,untouched_records:5});
      const initial=await create(page,'QC Concurrent Save','qc-concurrent.js',"console.log('base-version');");
      const other=await browser.newContext(); const b=await other.newPage(); prep(b); await open(b); await load(b,initial);
      await enter(b,"console.log('stale-overwrite');",'qc-concurrent.js');
      const fields=async p=>({title:await title(p).inputValue(),filename:await filename(p).inputValue(),code:await editorText(p)});
      const dirty=await fields(b); await title(page).fill('QC Concurrent Save Updated'); await enter(page,'<!doctype html><html><body>first-editor-won</body></html>','qc-concurrent.html'); const winner=await save(page);
      const refusal=b.waitForResponse(r=>r.url().endsWith('/api/snippets/'+initial.id)&&r.request().method()==='PUT'); await b.getByRole('button',{name:'Save',exact:true}).click(); const rejected=await refusal; assert.equal(rejected.status(),409);
      await b.getByRole('button',{name:'Reload latest',exact:true}).waitFor(); assert.deepEqual(await fields(b),dirty); assert.deepEqual((await saved(b)).find(x=>x.id===initial.id),winner);
      await b.getByRole('button',{name:'Reload latest',exact:true}).click(); await b.waitForFunction(expected=>document.querySelector('input[aria-label="Snippet title"]').value===expected,winner.title);
      await enter(b,'<!doctype html><html><body>reapplied-after-reload</body></html>','qc-concurrent.html'); const recovered=await save(b); assert.equal(recovered.revision,winner.revision+1); await b.reload(); await load(b,recovered);
      const finalRecords=await saved(b); for(const record of after) assert.deepEqual(finalRecords.find(x=>x.id===record.id),record); await other.close();
      report.checks.push({name:'actual_dirty_second_editor_and_recovery_after_early_restart',passed:true,dirty,winner,recovered,stale_status:rejected.status(),previous_records_preserved:after.length});
    }
    assert.deepEqual(report.browserErrors,[]); report.passed=true; console.log(JSON.stringify(report));
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
