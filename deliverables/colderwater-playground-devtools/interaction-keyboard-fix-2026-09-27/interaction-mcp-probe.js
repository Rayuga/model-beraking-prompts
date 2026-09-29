async (page) => {
  page.setDefaultTimeout(8000);
  const observations = [];
  page.__interactionProof = {running: true, observations};
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const editor = page.getByRole('textbox', {name: 'Code editor', exact: true});
  const status = () => page.getByRole('status').innerText();
  const logs = () => page.getByRole('log').innerText();
  const preview = () => page.frameLocator('iframe[title="Live preview"]');
  const body = () => preview().locator('body').innerText();
  const complete = async () => {
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.startsWith('Complete'), null, {timeout: 8000});
  };
  const enter = async (code, filename) => {
    await page.getByRole('textbox', {name: 'Filename', exact: true}).fill(filename);
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(code);
    assert(await editor.innerText() === code, 'Entered source differs');
  };
  const run = async (code, filename = 'proof.js', wait = true) => {
    await enter(code, filename);
    const started = Date.now();
    await page.getByRole('button', {name: /^Run /}).click();
    if (wait) await complete();
    return started;
  };
  const test = async (name, action) => {
    const started = Date.now();
    try { observations.push({name, passed: true, ...await action(), duration_ms: Date.now() - started}); }
    catch (error) { observations.push({name, passed: false, error: String(error), duration_ms: Date.now() - started}); }
  };
  await complete();
  await page.getByRole('checkbox', {name: 'Auto-run', exact: true}).uncheck();
  await test('language_dispatch_late_click_and_css_handler_removal', async () => {
    await page.getByRole('button', {name: 'Clear console', exact: true}).click();
    await run("document.body.innerHTML = '<p id=\"dispatch-mark\">js-dispatch-ok</p>';\nconsole.log('js-dispatch-log');", 'dispatch.JS');
    assert((await body()).includes('js-dispatch-ok') && (await logs()).includes('js-dispatch-log'), 'JS positive control');
    const html = `<!doctype html><html><body><h1 id="dispatch-mark">html-dispatch-ok</h1><button id="dispatch-button">Try handler</button><input id="dispatch-input" aria-label="Handler input"><script>window.oldGlobal='do-not-carry'; console.log('html-once-marker'); document.getElementById('dispatch-button').addEventListener('click', () => console.log('dispatch-handler-marker')); document.getElementById('dispatch-input').addEventListener('keydown', () => console.log('dispatch-keyboard-marker')); document.getElementById('dispatch-input').addEventListener('input', () => console.log('dispatch-input-marker'));</script></body></html>`;
    await run(html, 'dispatch.html');
    const completed = Date.now();
    await page.waitForTimeout(6100);
    const clicked = Date.now();
    await preview().getByRole('button', {name: 'Try handler'}).click();
    await page.waitForFunction(() => document.querySelector('[role="log"]').textContent.includes('dispatch-handler-marker'));
    await complete();
    await preview().getByRole('textbox', {name: 'Handler input'}).click();
    await complete();
    const keyboardReady = Date.now();
    await page.waitForTimeout(6100);
    const typed = Date.now();
    await preview().getByRole('textbox', {name: 'Handler input'}).press('a');
    await complete();
    assert((await logs()).includes('dispatch-keyboard-marker') && (await logs()).includes('dispatch-input-marker'), 'Late keyboard/input handlers did not both execute');
    const count = text => (text.match(/dispatch-handler-marker/g) || []).length;
    const before = await logs();
    assert(count(before) === 1, 'Late handler must execute exactly once');
    await run('#dispatch-mark { color: rgb(255, 0, 0); }', 'dispatch.CSS');
    assert(await preview().locator('#dispatch-mark').evaluate(el => getComputedStyle(el).color) === 'rgb(255, 0, 0)', 'CSS did not style retained heading');
    await preview().getByRole('button', {name: 'Try handler'}).click();
    await preview().getByRole('textbox', {name: 'Handler input'}).press('b');
    await page.waitForTimeout(200);
    const after = await logs();
    assert(count(after) === 1, 'CSS copied old live handler');
    assert((after.match(/dispatch-keyboard-marker/g) || []).length === 1 && (after.match(/dispatch-input-marker/g) || []).length === 1, 'CSS copied old keyboard/input handlers');
    assert((after.match(/html-once-marker/g) || []).length === 1, 'CSS reran old script');
    await run("document.body.innerHTML = '<p>fresh-' + typeof window.oldGlobal + '</p>';console.log('fresh-js-log');", 'dispatch.js');
    assert((await body()).includes('fresh-undefined') && !(await body()).includes('html-dispatch-ok'), 'JS carried old document/global');
    return {wait_after_observed_completion_ms: clicked - completed, focused_input_wait_before_typing_ms: typed - keyboardReady, late_handler_entries: {click: 1, keyboard: 1, input: 1}, css_preserved_handler: false, new_js_global: 'undefined'};
  });
  const savedSource = "document.body.innerHTML='<p>recovery-marker-Q7</p>';\nconsole.log('recovery-marker-Q7-log');";
  const loadSaved = async () => {
    await page.getByRole('button', {name: /^QC Recovery Check/}).click();
    assert(await editor.innerText() === savedSource, 'Saved recovery source changed');
    assert(await page.getByRole('textbox', {name: 'Filename', exact: true}).inputValue() === 'qc-recovery.js', 'Saved filename changed');
    await page.getByRole('button', {name: /^Run /}).click();
    await complete();
    assert((await body()).includes('recovery-marker-Q7'), 'Saved recovery run missing');
  };
  await test('recovery_initial_run_shared_timer_budget_and_saved_record', async () => {
    await page.getByRole('button', {name: 'New', exact: true}).click();
    await run(savedSource, 'qc-recovery.js');
    await page.getByRole('textbox', {name: 'Snippet title', exact: true}).fill('QC Recovery Check');
    await page.getByRole('button', {name: 'Save', exact: true}).click();
    await page.getByRole('button', {name: /^QC Recovery Check/}).waitFor();
    await page.reload();
    await complete();
    await loadSaved();
    const started = await run("document.body.innerHTML='<p>failed-loop-candidate</p>';\nsetTimeout(() => { console.log('late-callback-entered'); while (true) {} }, 4000);", 'qc-recovery.js', false);
    assert((await body()).includes('failed-loop-candidate'), 'Initial candidate did not render');
    await page.waitForFunction(() => document.querySelector('[role="log"]').textContent.includes('late-callback-entered'), null, {timeout: 7000});
    await page.waitForFunction(() => /time limit/i.test(document.querySelector('[role="log"]').textContent), null, {timeout: 8000});
    const elapsed = Date.now() - started;
    assert(elapsed < 8000, 'Original run budget extended at timer entry');
    assert((await body()).includes('recovery-marker-Q7') && !(await body()).includes('failed-loop-candidate'), 'Initial run rollback failed');
    await loadSaved();
    return {run_action_to_timeout_ms: elapsed, candidate_rendered: true, callback_entered: true, saved_record_unchanged: true};
  });
  await test('recovery_completed_preview_interaction_shared_timer_budget', async () => {
    await page.getByRole('button', {name: 'Clear console', exact: true}).click();
    const html = '<!doctype html><html><body><p id="mark">interaction-good</p><button id="start">Start work</button><button id="poke">Still waiting</button><script>document.getElementById("start").onclick=()=>{document.getElementById("mark").textContent="interaction-candidate";console.log("interaction-started");setTimeout(()=>{document.getElementById("mark").textContent="interaction-late";console.log("interaction-late")},6000)};document.getElementById("poke").onclick=()=>console.log("interaction-still-waiting");</script></body></html>';
    await run(html, 'interaction.html');
    const initialStatus = await status();
    const started = Date.now();
    await preview().getByRole('button', {name: 'Start work'}).click();
    assert((await body()).includes('interaction-candidate'), 'First interaction candidate missing');
    assert((await logs()).includes('interaction-started'), 'First interaction log missing');
    await page.waitForTimeout(2100);
    const pendingStatus = await status();
    assert(/Waiting|Running/.test(pendingStatus), 'Second click setup missed pending interaction');
    const secondClick = Date.now();
    await preview().getByRole('button', {name: 'Still waiting'}).click();
    assert((await logs()).includes('interaction-still-waiting'), 'Second interaction did not occur');
    await page.waitForFunction(() => /time limit/i.test(document.querySelector('[role="log"]').textContent), null, {timeout: 8000});
    const timeoutAt = Date.now();
    assert(timeoutAt - started < 8000, 'Interaction did not stop within scheduling allowance');
    await page.waitForTimeout(Math.max(0, started + 6800 - Date.now()));
    const finalLogs = await logs(), finalBody = await body();
    assert(!finalLogs.includes('interaction-late') && !finalBody.includes('interaction-late'), 'Second interaction unlocked six-second callback');
    assert(finalBody.includes('interaction-good') && !finalBody.includes('interaction-candidate'), 'Interaction failed to roll back');
    await loadSaved();
    return {initial_status: initialStatus, pending_status_before_second_click: pendingStatus, second_click_from_first_ms: secondClick - started, timeout_from_first_ms: timeoutAt - started, observed_until_from_first_ms: Date.now() - started, late_callback_logged: false, rolled_back: true, fresh_saved_run_passed: true};
  });
  await test('later_keyboard_and_input_actions', async () => {
    await page.getByRole('button', {name: 'Clear console', exact: true}).click();
    await run('<!doctype html><html><body><input aria-label="Late text"><script>const f=document.querySelector("input");f.onkeydown=()=>console.log("late-keyboard");f.oninput=()=>console.log("late-input");</script></body></html>', 'late-fields.html');
    const completed = Date.now();
    await page.waitForTimeout(6100);
    await preview().getByRole('textbox', {name: 'Late text'}).press('a');
    await complete();
    const output = await logs();
    assert(output.includes('late-keyboard') && output.includes('late-input') && !/time limit/i.test(output), 'Later keyboard/input did not start valid interaction');
    return {wait_after_completion_ms: Date.now() - completed, keyboard_observed: true, input_observed: true};
  });
  await test('stopped_and_replaced_interaction_callbacks_cannot_resume', async () => {
    const html = '<!doctype html><html><body><p>cancel-good</p><button>Schedule</button><script>document.querySelector("button").onclick=()=>{console.log("interaction-cancel-start");setTimeout(()=>console.log("interaction-cancel-late"),4000)};</script></body></html>';
    const outcomes = [];
    for (const mode of ['stop', 'replace']) {
      await page.getByRole('button', {name: 'Clear console', exact: true}).click();
      await run(html, 'cancel-interaction.html');
      const started = Date.now();
      await preview().getByRole('button', {name: 'Schedule'}).click();
      assert(/Waiting|Running/.test(await status()), 'Cancellation setup not pending');
      if (mode === 'stop') await page.getByRole('button', {name: 'Stop', exact: true}).click();
      else await run("document.body.innerHTML='<p>replacement-good</p>';console.log('replacement-good');", 'replacement.js');
      await page.waitForTimeout(Math.max(0, started + 4600 - Date.now()));
      assert(!(await logs()).includes('interaction-cancel-late'), 'Cancelled context emitted late output');
      assert((await body()).includes(mode === 'stop' ? 'cancel-good' : 'replacement-good'), 'Cancellation current preview wrong');
      outcomes.push({mode, observed_from_first_click_ms: Date.now() - started, no_late_output: true});
    }
    return {outcomes};
  });
  page.__interactionProof = {running: false, passed: observations.every(item => item.passed), observations};
  return page.__interactionProof;
}
