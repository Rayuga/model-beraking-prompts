'use strict';
const assert = require('node:assert/strict');
const { normalizedRecords } = require('./workflow_core.cjs');

// No launcher, file output or browser startup. Execution requires a frozen input.
// Ledger "observed pass" means observation completed, never that the app passed.
const VARIANTS = Object.freeze({
  serverExtensionValidationBypass: 'import', import: 'import', 'server-extension': 'import',
  serverCaseInsensitiveUniqueness: 'titles', titles: 'titles', 'title-nocase': 'titles',
  cssLiveContextInheritance: 'css', css: 'css', 'css-handlers': 'css',
});
// Supporting observations bind to final 9bec05c2155f owners; multiple facts may
// be needed for an owner. These bindings do not create criterion verdicts.
const FINAL_FACT_BINDINGS = Object.freeze({
  import_off_stays_unrun: ['cw_import_off_no_execution'], import_manual_run: ['cw_import_off_no_execution'],
  supported_file_import: ['cw_supported_file_import'], import_unsupported_extension: ['cw_import_unsupported_extension'],
  source_file_extension_case: ['cw_source_file_extension_case'], server_filename_validation: ['cw_saved_filename_extension_rejection'],
  server_filename_path_rejection: ['cw_saved_filename_path_rejection'],
  padded_title_create_trim: ['cw_title_trimming'], padded_title_rename_trim: ['cw_title_trimming'], case_distinct_titles_coexist: ['cw_title_case_sensitive'],
  js_extension_dispatch: ['cw_js_html_filename_dispatch', 'cw_extension_case'], html_extension_dispatch: ['cw_js_html_filename_dispatch', 'cw_extension_case'],
  css_extension_and_style: ['cw_css_apply_snapshot', 'cw_extension_case'], css_prior_style_preserved: ['cw_css_apply_snapshot'],
  css_does_not_rerun_script: ['cw_css_inert_copy'], css_removes_old_handler: ['cw_css_inert_copy'], fresh_js_globals_and_document: ['cw_js_fresh_document'],
});
class MissingSetup extends Error { constructor(message) { super(message); this.name = 'MissingSetup'; } }
const same = (a, b) => { try { assert.deepEqual(a, b); return true; } catch { return false; } };
const fieldsOf = row => ({ title: row.title, filename: row.filename, code: row.code });
const count = (text, marker) => text.split(marker).length - 1;

function defaults(token) {
  const title = `QC Partial ${token}`;
  return {
    import: {
      control: { filename: 'partial-control.js', code: `document.body.textContent='${token}-import-control';console.log('${token}-import-control-log');`, preview: `${token}-import-control`, log: `${token}-import-control-log` },
      filename: 'import-me.JS', source: `document.body.innerHTML='<p>${token}-import-executed</p>';\nconsole.log('${token}-import-log');`, preview: `${token}-import-executed`, log: `${token}-import-log`,
      server: { title: `${title} Filename Server`, filename: 'partial-server.js', code: "console.log('valid-filename-control');" },
      invalidFilename: 'unsupported.txt',
    },
    titles: { paddedTitle: `  ${title} Trim Base  `, paddedRename: `  ${title} Trim Renamed  `, caseTitle: `${title} Case Sample`, recoveryTitle: `${title} Unused Recovery`, filename: 'partial-title.js', code: "console.log('title-fields-preserved');" },
    css: { jsFilename: 'dispatch.JS', htmlFilename: 'dispatch.HTML', cssFilename: 'dispatch.CSS', freshFilename: 'dispatch.js',
      jsPreview: `${token}-js-dispatch`, jsLog: `${token}-js-log`, htmlPreview: `${token}-html-dispatch`, scriptLog: `${token}-html-once`, handlerLog: `${token}-handler`, freshLog: `${token}-fresh-log`,
      headingId: 'dispatch-mark', buttonId: 'dispatch-button', buttonLabel: 'Try handler', background: 'rgb(1, 2, 3)', color: 'rgb(255, 0, 0)' },
  };
}

async function waitFields(driver, expected) {
  await driver.page.waitForFunction(expected => {
    const source = [...document.querySelectorAll('[aria-label="Code editor"] .cm-line')].map(row => row.textContent).join('\n');
    return Object.entries(expected).every(([key, value]) => key === 'code' ? source === value : document.querySelector(`input[aria-label="${key === 'title' ? 'Snippet title' : 'Filename'}"]`)?.value === value);
  }, expected);
}
async function waitCount(driver, marker, minimum, timeout = 2000) {
  try {
    await driver.page.waitForFunction(({ marker, minimum }) => (document.querySelector('[role="log"]')?.textContent || '').split(marker).length - 1 >= minimum, { marker, minimum }, { timeout });
    return true;
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    return false;
  }
}
async function runResult(driver, code, filename, preview, log) {
  const clock = await driver.run(code, filename, false);
  let completionError = null;
  try { await driver.completed(); } catch (error) { completionError = String(error); }
  const body = await driver.body(), logs = await driver.logs(), status = await driver.status();
  return { product_pass: !completionError && body.includes(preview) && logs.includes(log), clock, body, logs, status, completionError };
}
async function freshRecord(driver, id) { return (await driver.library()).find(row => row.id === id); }
async function rename(driver, record, title) {
  await driver.load(record);
  const prior = { ...driver.dialogPolicy };
  driver.dialogPolicy = { accept: true, prompt: title };
  try {
    const response = await driver.captureMutation('rename', () => driver.page.getByRole('button', { name: 'Rename', exact: true }).click(), ['PUT']);
    if (response.ok) await waitFields(driver, { title: response.data.title });
    return response;
  } finally { driver.dialogPolicy = prior; }
}

async function runVariant(driver, ledger, variant, fixtures = {}) {
  assert(fixtures.freeze_confirmed === true, 'Variant execution is forbidden before the parent confirms fixture freeze.');
  const kind = VARIANTS[variant];
  assert(kind, `Unsupported partial variant: ${variant}`);
  const token = fixtures.token || `pv-${Date.now().toString(36)}`;
  assert(/^[a-z0-9_-]+$/i.test(token), 'Fixture token must be safe plain marker text.');
  const base = defaults(token), input = { ...base[kind], ...(fixtures[kind] || {}) };
  const rows = [], state = {};
  const summary = { variant, kind, token, scope: 'Local disposable reference observations; no Oracle/current score', criterion_verdicts_produced: false, observations: rows };
  (ledger.report.partial_variants ||= []).push(summary);
  async function fact(key, expectedProductPass, work) {
    const id = `partial.${kind}.${key}`;
    const mapping = fixtures.criterion_map?.[id] || fixtures.criterion_map?.[key] || FINAL_FACT_BINDINGS[key] || [];
    const row = await ledger.observe({ id, criterion_ids: mapping, provisional: mapping.length === 0, fact_key: key, expected_product_pass: expectedProductPass,
      supporting_fact_only: true,
      observation_semantics: 'Probe completion is distinct from product correctness; expected defects must have product_pass=false.' }, work);
    row.probe_completed = row.status === 'observed pass';
    row.product_pass = row.probe_completed ? row.evidence.product_pass : null;
    row.expectation_matched = row.probe_completed && row.product_pass === expectedProductPass && (expectedProductPass !== false || row.evidence.expected_defect_observed === true);
    if (!row.probe_completed && row.error?.includes('MissingSetup')) row.status = 'setup unavailable';
    rows.push(row);
    return row;
  }
  await fact('workspace_ready', true, async () => {
    await driver.open();
    const automatic = await driver.disableAutoIfAvailable();
    return { product_pass: await driver.editor().isVisible(), automatic, fields: await driver.fields() };
  });

  if (kind === 'import') {
    input.control = { ...base.import.control, ...(fixtures.import?.control || {}) };
    input.server = { ...base.import.server, ...(fixtures.import?.server || {}) };
    async function upload(filename = input.filename, source = input.source) {
      await driver.disableAutoIfAvailable();
      state.beforeImport = { body: await driver.body(), logs: await driver.logs() };
      await ledger.action('import', `Import actual source file ${filename}`, () => driver.page.getByLabel('Import file', { exact: true }).setInputFiles({ name: filename, mimeType: 'text/javascript', buffer: Buffer.from(source, 'utf8') }));
      await waitFields(driver, { filename, code: source });
      return driver.fields();
    }
    await fact('import_working_control', true, async () => {
      await driver.newDraft();
      state.control = await runResult(driver, input.control.code, input.control.filename, input.control.preview, input.control.log);
      return state.control;
    });
    await fact('import_exact_editable_source', true, async () => {
      const actual = await upload();
      return { product_pass: actual.filename === input.filename && actual.code === input.source, expected: { filename: input.filename, code: input.source }, actual };
    });
    await fact('import_off_stays_unrun', true, async () => {
      if (!state.control?.product_pass) {
        state.control = await runResult(driver, input.control.code, input.control.filename, input.control.preview, input.control.log);
        if (!state.control.product_pass) throw new MissingSetup('A working preview control could not be established for import nonexecution.');
        await upload();
      }
      const current = await driver.fields();
      if (current.filename !== input.filename || current.code !== input.source || !state.beforeImport) await upload();
      const before = state.beforeImport;
      await ledger.wait(driver.page, 2000, 'Required two-second imported-source nonexecution window');
      const after = { body: await driver.body(), logs: await driver.logs() };
      return { product_pass: after.body === before.body && count(after.logs, input.log) === count(before.logs, input.log) && !after.body.includes(input.preview), before, after, observation_ms: 2000 };
    });
    await fact('import_manual_run', true, async () => {
      const current = await driver.fields();
      if (current.filename !== input.filename || current.code !== input.source) await upload();
      // Never substitute editor insertion for the real import in this fact.
      return runResult(driver, undefined, undefined, input.preview, input.log);
    });
    await fact('supported_file_import', true, async () => {
      const filename = input.filename.replace(/\.JS$/, '.js'), title = `${input.server.title} Imported Lowercase`;
      const imported = await upload(filename);
      await ledger.action('edit_title', 'Title actual imported draft', () => driver.title().fill(title));
      const firstSave = await driver.save();
      const editedCode = "console.log('import-edited-body');";
      await driver.enter(editedCode, filename);const edited = await driver.save();
      await driver.reload();await driver.load(edited.record);
      const loaded = await driver.fields(), fresh = await freshRecord(driver, edited.record.id);
      return { product_pass: imported.filename === filename && imported.code === input.source && firstSave.record.filename === filename && firstSave.record.code === input.source &&
        edited.record.id === firstSave.record.id && same(loaded, { title, filename, code: editedCode }) && fresh?.code === editedCode,
        imported, first_save: firstSave, edited, loaded, fresh };
    });
    await fact('import_unsupported_extension', true, async () => {
      const before = await driver.fields(), marker = 'Import a .js, .html or .css file.', beforeCount = count(await driver.logs(), marker);
      await ledger.action('import', 'Attempt unsupported file through actual input', () => driver.page.getByLabel('Import file', { exact: true }).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('unrelated unsupported source', 'utf8') }));
      const feedback = await waitCount(driver, marker, beforeCount + 1), after = await driver.fields();
      return { product_pass: feedback && same(before, after), before, after, visible_feedback: await driver.logs() };
    });
    await fact('source_file_extension_case', true, async () => {
      const imported = await upload(), title = `${input.server.title} Imported Uppercase`;
      await ledger.action('edit_title', 'Title uppercase-extension imported draft', () => driver.title().fill(title));
      const saved = await driver.save();await driver.reload();await driver.load(saved.record);
      const loaded = await driver.fields(), fresh = await freshRecord(driver, saved.record.id);
      return { product_pass: imported.filename === input.filename && imported.code === input.source && same(loaded, { title, filename: input.filename, code: input.source }) && fresh?.filename === input.filename,
        imported, saved, loaded, fresh };
    });
    await fact('server_filename_validation', false, async () => {
      // Independent New/Save control: no imported record or import verdict used.
      const created = await driver.create(input.server);
      await driver.enter(input.server.code + '\n// observed valid update', input.server.filename);
      const update = await driver.save();
      const before = await freshRecord(driver, update.record.id);
      if (!before || update.operation.method !== 'PUT') throw new MissingSetup('Actual successful current-record update shape was not established.');
      const fullBefore = await driver.library();
      const operation = { ...update.operation, body: { ...update.operation.body, revision: before.revision, filename: input.invalidFilename } };
      const response = await driver.replay(operation), fullAfter = await driver.library(), after = fullAfter.find(row => row.id === before.id);
      state.serverRecordId = before.id;
      const refusedIntact = !response.ok && same(after, before) && same(normalizedRecords(fullAfter), normalizedRecords(fullBefore));
      const acceptedDefect = response.ok && after?.filename === input.invalidFilename && after.id === before.id && after.title === before.title && after.code === before.code && after.revision > before.revision;
      return { product_pass: refusedIntact, expected_defect_observed: acceptedDefect, created, positive_update: update, before, operation, response, after,
        unrelated_unchanged: same(normalizedRecords(fullBefore.filter(row => row.id !== before.id)), normalizedRecords(fullAfter.filter(row => row.id !== before.id))) };
    });
    await fact('server_filename_path_rejection', true, async () => {
      // Refresh and restore valid fields after the intended extension mutation.
      // If that branch lacked setup, establish an independent valid record.
      let current = state.serverRecordId ? await freshRecord(driver, state.serverRecordId) : null;
      if (current) { await driver.reload();await driver.load(current); }
      else current = (await driver.create({ ...input.server, title: `${input.server.title} Independent Path` })).record;
      await driver.enter(current.code, input.server.filename);const validUpdate = await driver.save();
      const before = await freshRecord(driver, validUpdate.record.id), fullBefore = await driver.library();
      if (!before || before.filename !== input.server.filename || validUpdate.operation.method !== 'PUT') throw new MissingSetup('Refreshed valid filename/update control unavailable for path refusal.');
      const operation = { ...validUpdate.operation, body: { ...validUpdate.operation.body, revision: before.revision, filename: 'nested/demo.js' } };
      const response = await driver.replay(operation), fullAfter = await driver.library(), after = fullAfter.find(row => row.id === before.id);
      return { product_pass: !response.ok && Boolean(response.data?.error) && same(after, before) && same(normalizedRecords(fullAfter), normalizedRecords(fullBefore)),
        valid_update: validUpdate, before, operation, response, after, full_before: fullBefore, full_after: fullAfter };
    });
  }

  if (kind === 'titles') {
    async function target() {
      if (state.trimRecord) {
        const current = await freshRecord(driver, state.trimRecord.id);
        if (current) return current;
      }
      return (await driver.create({ title: `QC Partial ${token} Independent Rename`, filename: input.filename, code: input.code })).record;
    }
    await fact('padded_title_create_trim', true, async () => {
      const saved = await driver.create({ title: input.paddedTitle, filename: input.filename, code: input.code });
      state.trimRecord = saved.record;
      const fresh = await freshRecord(driver, saved.record.id), visible = await driver.fields();
      return { product_pass: fresh?.title === input.paddedTitle.trim() && visible.title === input.paddedTitle.trim() && fresh.filename === input.filename && fresh.code === input.code, saved, fresh, visible };
    });
    await fact('padded_title_rename_trim', true, async () => {
      const before = await target(), response = await rename(driver, before, input.paddedRename), after = await freshRecord(driver, before.id), visible = await driver.fields();
      state.trimRecord = after || before;
      return { product_pass: response.ok && after?.title === input.paddedRename.trim() && visible.title === input.paddedRename.trim() && after.filename === before.filename && after.code === before.code && after.revision > before.revision, before, response, after, visible };
    });
    await fact('case_distinct_titles_coexist', false, async () => {
      // This independent pair does not depend on successful padding/rename.
      const control = await driver.create({ title: input.caseTitle, filename: input.filename, code: input.code });
      state.caseRecord = control.record;
      const lower = input.caseTitle.toLowerCase();
      if (lower === input.caseTitle) throw new MissingSetup('Case probe requires two different ASCII-case spellings.');
      const before = await driver.library();
      await driver.newDraft();await ledger.action('edit_title', 'Enter case-distinct title', () => driver.title().fill(lower));await driver.enter(input.code, input.filename);
      const response = await driver.captureMutation('case_distinct_save', () => driver.page.getByRole('button', { name: 'Save', exact: true }).click(), ['POST']);
      const after = await driver.library(), original = after.find(row => row.id === control.record.id), created = after.find(row => row.title === lower);
      const coexist = response.ok && created && created.id !== control.record.id && same(original, control.record) && created.filename === input.filename && created.code === input.code;
      const expectedDefect = !response.ok && /title|already exists/i.test(response.data?.error || '') && same(normalizedRecords(after), normalizedRecords(before));
      return { product_pass: Boolean(coexist), expected_defect_observed: expectedDefect, control, attempted_title: lower, response, before, after, visible_feedback: { status: await driver.status(), logs: await driver.logs() } };
    });
    await fact('unused_title_rename_recovers', true, async () => {
      const before = await target(), response = await rename(driver, before, input.recoveryTitle), after = await freshRecord(driver, before.id);
      return { product_pass: response.ok && after?.title === input.recoveryTitle && after.filename === before.filename && after.code === before.code && after.revision > before.revision, before, response, after };
    });
  }

  if (kind === 'css') {
    const js = `document.body.innerHTML='<p>${input.jsPreview}</p>';console.log('${input.jsLog}');`;
    const html = `<!doctype html><html><body><style>#${input.headingId}{background-color:rgb(1,2,3)}</style><h1 id="${input.headingId}">${input.htmlPreview}</h1><button id="${input.buttonId}">${input.buttonLabel}</button><script>window.oldGlobal='do-not-carry';console.log('${input.scriptLog}');document.getElementById('${input.buttonId}').addEventListener('click',()=>console.log('${input.handlerLog}'));</script></body></html>`;
    const css = `#${input.headingId}{color:rgb(255,0,0)}`;
    async function htmlControl() { state.html = await runResult(driver, html, input.htmlFilename, input.htmlPreview, input.scriptLog); return state.html; }
    await fact('js_extension_dispatch', true, () => runResult(driver, js, input.jsFilename, input.jsPreview, input.jsLog));
    await fact('html_extension_dispatch', true, htmlControl);
    await fact('handler_positive_control', true, async () => {
      if (!state.html?.product_pass) await htmlControl();
      const before = count(await driver.logs(), input.handlerLog);
      await ledger.action('preview_click', 'Establish installed HTML handler', () => driver.preview().getByRole('button', { name: input.buttonLabel, exact: true }).click());
      await waitCount(driver, input.handlerLog, before + 1);await driver.completed();
      const after = count(await driver.logs(), input.handlerLog);
      state.handlerProven = after > before;
      return { product_pass: state.handlerProven, before, after, marker: input.handlerLog };
    });
    await fact('css_extension_and_style', true, async () => {
      if (!state.html?.product_pass) await htmlControl();
      state.beforeCss = { scripts: count(await driver.logs(), input.scriptLog), handlers: count(await driver.logs(), input.handlerLog), body: await driver.body() };
      const clock = await driver.run(css, input.cssFilename);
      const heading = driver.preview().locator(`#${input.headingId}`), body = await driver.body();
      const color = await heading.evaluate(element => getComputedStyle(element).color);
      state.css = { clock, body, color, scripts: count(await driver.logs(), input.scriptLog), handlers: count(await driver.logs(), input.handlerLog) };
      return { product_pass: body.includes(input.htmlPreview) && color === input.color, before: state.beforeCss, after: state.css };
    });
    await fact('css_prior_style_preserved', true, async () => {
      if (!state.css) throw new MissingSetup('No completed CSS application is available for retained-background observation.');
      const background = await driver.preview().locator(`#${input.headingId}`).evaluate(element => getComputedStyle(element).backgroundColor);
      return { product_pass: background === input.background, background, expected: input.background };
    });
    await fact('css_does_not_rerun_script', true, async () => {
      if (!state.beforeCss || !state.css) throw new MissingSetup('Before/after CSS observations are unavailable.');
      const after = count(await driver.logs(), input.scriptLog);
      return { product_pass: after === state.beforeCss.scripts, before: state.beforeCss.scripts, after, marker: input.scriptLog };
    });
    await fact('css_removes_old_handler', false, async () => {
      if (!state.handlerProven || !state.css) throw new MissingSetup('A live pre-CSS handler and completed CSS run are both required.');
      const before = count(await driver.logs(), input.handlerLog);
      await ledger.action('preview_click', 'Attempt inherited handler after CSS', () => driver.preview().getByRole('button', { name: input.buttonLabel, exact: true }).click());
      const fired = await waitCount(driver, input.handlerLog, before + 1);
      const after = count(await driver.logs(), input.handlerLog);
      return { product_pass: after === before, expected_defect_observed: fired && after > before, before, after, marker: input.handlerLog,
        polling_note: 'At most 2 s to observe a posted console event; not a five-second behavioral budget.' };
    });
    await fact('fresh_js_globals_and_document', true, async () => {
      const code = `document.body.innerHTML='<p>fresh-'+typeof window.oldGlobal+'</p>';console.log('${input.freshLog}');`;
      const result = await runResult(driver, code, input.freshFilename, 'fresh-undefined', input.freshLog);
      return { ...result, product_pass: result.product_pass && !(await driver.preview().locator(`#${input.headingId}`).count()), old_heading_absent: !(await driver.preview().locator(`#${input.headingId}`).count()) };
    });
  }
  summary.expected_defect_observed = rows.some(row => row.evidence?.expected_defect_observed === true);
  summary.all_expectations_matched = rows.length > 0 && rows.every(row => row.expectation_matched);
  summary.completed = true;
  return summary;
}

module.exports = { runVariant, VARIANTS, FINAL_FACT_BINDINGS };
