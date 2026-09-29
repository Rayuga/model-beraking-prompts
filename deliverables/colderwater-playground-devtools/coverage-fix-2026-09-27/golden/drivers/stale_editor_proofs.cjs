'use strict';

// Focused disposable-reference evidence, not an application change or rubric scorer.
// Importing this module opens no browser and writes no files. The caller supplies
// an already running local disposable browser/app and owns final freeze binding.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {isDeepStrictEqual} = require('node:util');
const {GoldenBrowser, ObservationLedger, normalizedRecords} = require('./workflow_core.cjs');

const BASE_APP_SHA256 = '03917011ec2c4aa602ce6390a0427a32d8ff74567fc585a625fc709e583f1838';
const digest = source => crypto.createHash('sha256').update(source).digest('hex');
const fieldsOf = row => ({title:row.title, filename:row.filename, code:row.code});
const same = isDeepStrictEqual;
const sameList = (a,b) => same(normalizedRecords(a), normalizedRecords(b));
const useful = text => /conflict|changed|another.*editor|revision/i.test(text ?? '');

function replaceOnce(source, anchor, replacement, label) {
  assert(source.split(anchor).length === 2, label + ' must have exactly one anchor');
  return source.replace(anchor, replacement);
}

function mutateConflictClears(source) {
  assert(typeof source === 'string', 'Mutation accepts source text only');
  assert.equal(digest(source), BASE_APP_SHA256, 'Golden app.tsx drift: refusing conflict-clear mutation');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const oldBranch = "if (error.data?.code === 'REVISION_CONFLICT') setConflict({ current: error.data.current, message: error.message });";
  const newBranch = "if (error.status === 409 && error.data?.code === 'REVISION_CONFLICT') { setTitle(''); setFilename(''); setCode(''); setConflict({ current: error.data.current, message: error.message }); }";
  const deleteAnchor = "    } catch (error) { log('error', [error.message]); " + oldBranch + ' }';
  const renameAnchor = ['    } catch (error) {', "      log('error', [error.message]);", '      ' + oldBranch, '    } finally { setSaveBusy(false); }'].join(eol);
  const mutated = replaceOnce(replaceOnce(source, deleteAnchor, deleteAnchor.replace(oldBranch, newBranch), 'Delete conflict catch'), renameAnchor, renameAnchor.replace(oldBranch, newBranch), 'Rename conflict catch');
  assert.equal(mutated.split(newBranch).length - 1, 2, 'Only the two intended conflict branches may change');
  assert.equal(mutated.split(oldBranch).length - 1, 1, 'The ordinary Save conflict catch must stay intact');
  return mutated;
}

async function feedbackSnapshot(driver) {
  return {status:await driver.status(), alerts:await driver.page.locator('[role="alert"]:visible').allInnerTexts(), console_rows:await driver.page.getByRole('log').locator('.entry').allInnerTexts()};
}
function newFeedback(before, after) {
  // Require the old prefix to remain before taking newly appended rows. A console
  // reset cannot accidentally make earlier matching text count as new feedback.
  const prefixPreserved = before.console_rows.every((text,i) => after.console_rows[i] === text);
  return {status:after.status === before.status ? '' : after.status, alerts:after.alerts.filter(text => !before.alerts.includes(text)), console_rows:prefixPreserved ? after.console_rows.slice(before.console_rows.length) : [], console_prefix_preserved:prefixPreserved};
}
const feedbackText = feedback => [feedback.status,...feedback.alerts,...feedback.console_rows].join('\n');

async function waitNewConflictFeedback(driver, before) {
  try {
    await driver.page.waitForFunction(prior => {
      const rows = [...document.querySelectorAll('[role="log"] .entry')].map(node => node.innerText);
      const alerts = [...document.querySelectorAll('[role="alert"]')].filter(node => node.getClientRects().length).map(node => node.innerText);
      const status = document.querySelector('[role="status"]')?.innerText ?? '';
      const nextRows = prior.console_rows.every((text,index) => rows[index] === text) ? rows.slice(prior.console_rows.length) : [];
      const newText = [status === prior.status ? '' : status,...alerts.filter(text => !prior.alerts.includes(text)),...nextRows].join('\n');
      return /conflict|changed|another.*editor|revision/i.test(newText);
    }, before, {timeout:3000});
    return null;
  } catch (error) { return String(error); }
}

async function waitFields(driver, expected) {
  await driver.page.waitForFunction(expected => {
    const title = document.querySelector('[aria-label="Snippet title"]')?.value;
    const filename = document.querySelector('[aria-label="Filename"]')?.value;
    const code = [...document.querySelectorAll('[aria-label="Code editor"] .cm-line')].map(node => node.textContent).join('\n');
    return title === expected.title && filename === expected.filename && code === expected.code;
  }, expected, {timeout:4000});
}

async function runStaleEditorProofs(browser, url, logDir, {expectedConflictClears = false} = {}) {
  const parsed = new URL(url);
  assert(['localhost','127.0.0.1','[::1]'].includes(parsed.hostname) && parsed.port !== '3420', 'Only a disposable local app is allowed; user preview 3420 is excluded');
  assert(browser && typeof browser.newContext === 'function', 'Caller must supply a Playwright Browser');
  assert(typeof logDir === 'string' && logDir, 'A new evidence parent directory is required');
  const runId = Date.now().toString(36) + '-' + crypto.randomUUID().slice(0,8);
  const evidenceDir = path.join(logDir, 'stale-editor-proofs-' + runId);
  fs.mkdirSync(evidenceDir, {recursive:true});
  const ledger = new ObservationLedger({scope:'C2 live stale Rename/Delete editor proof',run_id:runId,expected_conflict_clears:expectedConflictClears});
  const report = {schema_version:1,run_id:runId,started_at:new Date().toISOString(),scope:'Local disposable reference browser observations; no provider, platform or Oracle run',expected_conflict_clears:expectedConflictClears,evidence_directory:evidenceDir,mutant_base_app_sha256:BASE_APP_SHA256,criterion_verdicts_produced:false,operations:[]};
  let snapshotIndex = 0;
  const snapshot = (label, value) => {
    const filename = String(++snapshotIndex).padStart(2,'0') + '-' + label + '.json';
    fs.writeFileSync(path.join(evidenceDir, filename), JSON.stringify(value,null,2) + '\n', {flag:'wx'});
    return filename;
  };

  for (const operation of ['rename','delete']) {
    const result = {operation,status:'running',facts:{actual_two_editors:null,positive_operation_control:null,loaded_revision_used:null,server_refusal:null,new_conflict_feedback:null,exact_draft_retained:null,server_unchanged:null,latest_load_exact:null,reapplied_save_persists:null,current_operation_recovers:null,unrelated_records_unchanged:null},raw:{},snapshots:[],errors:[]};
    report.operations.push(result);
    let contextA, contextB;
    const keep = (label,value) => { result.raw[label] = value;result.snapshots.push(snapshot(operation + '-' + label,value));return value; };
    try {
      contextA = await browser.newContext({viewport:{width:1440,height:1000}});
      contextB = await browser.newContext({viewport:{width:1440,height:1000}});
      const pageA = await contextA.newPage(), pageB = await contextB.newPage();
      const a = new GoldenBrowser(pageA,ledger,url), b = new GoldenBrowser(pageB,ledger,url);
      const label = 'QC Stale ' + (operation === 'rename' ? 'Rename' : 'Delete');
      const title = suffix => label + ' ' + suffix;
      const actualRename = async (driver,name,kind) => {
        driver.dialogPolicy.prompt = name;
        return driver.captureMutation(kind, () => driver.page.getByRole('button',{name:'Rename',exact:true}).click(), ['PUT','PATCH']);
      };
      const actualDelete = async (driver,kind) => {
        driver.dialogPolicy.accept = true;
        return driver.captureMutation(kind, () => driver.page.getByRole('button',{name:'Delete',exact:true}).click(), ['DELETE']);
      };
      await a.open();await a.disableAutoIfAvailable();
      const base = (await a.create({title:title(operation === 'rename' ? 'Base' : 'Target'),filename:'qc-stale-' + operation + '.js',code:"console.log('stale-" + operation + "-original');"})).record;
      const sibling = (await a.create({title:title('Sibling'),filename:operation === 'delete' ? 'qc-stale-sibling.js' : 'qc-stale-rename-sibling.js',code:operation === 'delete' ? "console.log('stale-delete-keep');" : "console.log('stale-rename-sibling');"})).record;
      if (operation === 'delete') {
        const control = (await a.create({title:title('Control'),filename:'qc-stale-control.js',code:"console.log('current-delete-control');"})).record;
        const before = await a.library(), actual = await actualDelete(a,'current_delete_positive_control'), after = await a.library();
        result.facts.positive_operation_control = actual.ok && sameList(after,before.filter(row => row.id !== control.id));
        keep('positive_control',{control,actual,before,after});
      }
      await a.load(base);await b.open();await b.disableAutoIfAvailable();b.libraryUrl = a.libraryUrl;await b.load(base);
      const loadedA = await a.fields(), loadedB = await b.fields();
      result.facts.actual_two_editors = pageA !== pageB && contextA !== contextB && same(loadedA,fieldsOf(base)) && same(loadedB,fieldsOf(base));
      const dirty = {title:title('Draft'),filename:'qc-stale-' + operation + '-draft.js',code:"console.log('stale-" + operation + "-unsaved');"};
      await ledger.action('edit_title','Enter distinctive unsaved B title',() => b.title().fill(dirty.title));await b.enter(dirty.code,dirty.filename);
      const beforeAdvance = await b.fields();assert(same(beforeAdvance,dirty),'Failed to establish the exact real dirty draft');
      keep('setup',{base,sibling,loaded_a:loadedA,loaded_b:loadedB,dirty,dirty_heading:await pageB.locator('.editor > .paneheading').innerText(),two_independent_browser_contexts:true});

      let winner, advance;
      if (operation === 'rename') {
        advance = await actualRename(a,title('Current'),'current_rename_positive_control');winner = advance.data;
        result.facts.positive_operation_control = advance.ok && winner?.id === base.id && winner.revision > base.revision && winner.title === title('Current') && winner.filename === base.filename && winner.code === base.code;
      } else {
        await a.enter("console.log('stale-delete-newer-work');",base.filename);advance = await a.save();winner = advance.record;
      }
      assert(winner?.id === base.id && winner.revision > base.revision,'The real A mutation did not establish a newer revision');
      const libraryBefore = await a.library();assert(same(libraryBefore.find(row => row.id === base.id),winner),'Fresh lookup did not establish A winner');
      const beforeAttempt = await b.fields(), feedbackBefore = await feedbackSnapshot(b), headingBefore = await pageB.locator('.editor > .paneheading').innerText();
      keep('newer_saved_state',{advance,winner,library_before_stale:libraryBefore,b_draft_before_stale:beforeAttempt,b_heading_before_stale:headingBefore});
      const dialogStart = ledger.report.dialogs.length;
      const refusal = operation === 'rename'
        ? await actualRename(b,dirty.title,'stale_rename_actual_dirty_ui')
        : await actualDelete(b,'stale_delete_actual_dirty_ui');
      const feedbackPollError = await waitNewConflictFeedback(b,feedbackBefore);
      const feedbackAfter = await feedbackSnapshot(b), feedback = newFeedback(feedbackBefore,feedbackAfter), retained = await b.fields(), libraryAfter = await a.library();
      result.facts.loaded_revision_used = refusal.operation.body?.revision === base.revision && refusal.operation.url === (advance.operation?.url ?? advance.url) && headingBefore.includes('revision ' + base.revision);
      result.facts.server_refusal = !refusal.ok && refusal.status === 409 && refusal.data?.code === 'REVISION_CONFLICT' && useful(refusal.data?.error);
      result.facts.new_conflict_feedback = useful(feedbackText(feedback));
      result.facts.exact_draft_retained = same(beforeAttempt,dirty) && same(retained,dirty);
      result.facts.server_unchanged = sameList(libraryBefore,libraryAfter);
      keep('stale_refusal',{refusal,dialogs:ledger.report.dialogs.slice(dialogStart),feedback_before:feedbackBefore,feedback_after:feedbackAfter,new_feedback:feedback,feedback_poll_error:feedbackPollError,expected_dirty:dirty,retained,library_before:libraryBefore,library_after:libraryAfter,facts:{...result.facts}});

      // Do not assert retention here. The controlled draft-loss mutant must still
      // reach latest-load, deliberate reapplication and current-operation recovery.
      const reloadButton = pageB.getByRole('button',{name:'Reload latest',exact:true});
      let latestLoadMethod;
      if (await reloadButton.count()) {
        latestLoadMethod = 'Actual Reload latest conflict control';
        await ledger.action('load_latest',latestLoadMethod,() => reloadButton.click());await waitFields(b,fieldsOf(winner));
      } else {
        latestLoadMethod = 'Deliberate browser reload and ordinary library load';
        await b.reload();await b.load(winner);
      }
      const loadedLatest = await b.fields(), loadedHeading = await pageB.locator('.editor > .paneheading').innerText();
      result.facts.latest_load_exact = same(loadedLatest,fieldsOf(winner)) && loadedHeading.includes('revision ' + winner.revision);
      keep('latest_loaded',{method:latestLoadMethod,winner,fields:loadedLatest,heading:loadedHeading,previous_draft_restore_control_offered:await pageB.getByRole('button',{name:'Restore previous draft',exact:true}).count() > 0});
      await ledger.action('edit_title','Deliberately reapply recorded B title after loading latest',() => b.title().fill(dirty.title));await b.enter(dirty.code,dirty.filename);
      const reapplication = await b.fields(), saved = await b.save();await b.reload();await b.load(saved.record);
      const savedLookup = (await b.library()).find(row => row.id === base.id), loadedSaved = await b.fields();
      result.facts.reapplied_save_persists = same(reapplication,dirty) && saved.record.id === base.id && saved.record.revision > winner.revision && same(fieldsOf(saved.record),dirty) && same(savedLookup,saved.record) && same(loadedSaved,dirty);
      keep('reapplied_and_saved',{reapplication,saved,reloaded_fields:loadedSaved,fresh_lookup:savedLookup});
      let recovered, finalList;
      if (operation === 'rename') {
        recovered = await actualRename(b,title('Recovered'),'current_rename_after_conflict');
        if (recovered.ok) { await b.reload();await b.load(recovered.data); }
        finalList = await b.library();
        result.facts.current_operation_recovers = recovered.ok && recovered.data?.id === base.id && recovered.data.revision > saved.record.revision && recovered.data.title === title('Recovered') && recovered.data.filename === dirty.filename && recovered.data.code === dirty.code && same(finalList.find(row => row.id === base.id),recovered.data);
      } else {
        recovered = await actualDelete(b,'current_delete_after_conflict');await b.reload();finalList = await b.library();
        result.facts.current_operation_recovers = recovered.ok && recovered.operation.body?.revision === saved.record.revision && !finalList.some(row => row.id === base.id);
      }
      result.facts.unrelated_records_unchanged = sameList(finalList.filter(row => row.id !== base.id),libraryBefore.filter(row => row.id !== base.id));
      keep('current_operation_recovered',{recovered,final_list:finalList,sibling_reference:sibling,facts:{...result.facts}});
      result.status = 'completed observations';
    } catch (error) {
      result.status = 'observation incomplete';result.errors.push({error:String(error),stack:error.stack});
      result.snapshots.push(snapshot(operation + '-incomplete',result));
    } finally {
      if (contextB) await contextB.close();if (contextA) await contextA.close();
    }
    const retentionExpected = !expectedConflictClears;
    result.product_pass = result.status === 'completed observations' ? Object.values(result.facts).every(value => value === true) : null;
    const retained = result.raw.stale_refusal?.retained;
    result.expected_defect_observed = expectedConflictClears && result.facts.server_refusal === true && result.facts.new_conflict_feedback === true && result.facts.exact_draft_retained === false && retained?.title === '' && retained?.filename === '' && retained?.code === '';
    result.expectations_matched = result.status === 'completed observations' && Object.entries(result.facts).every(([key,value]) => value === (key === 'exact_draft_retained' ? retentionExpected : true)) && (!expectedConflictClears || result.expected_defect_observed);
    result.snapshots.push(snapshot(operation + '-final',result));
  }
  report.finished_at = new Date().toISOString();report.ledger = ledger.finish();
  report.all_expectations_matched = report.operations.every(row => row.expectations_matched);
  report.expected_defect_observed = expectedConflictClears && report.operations.every(row => row.expected_defect_observed);
  report.all_product_facts_passed = report.operations.some(row => row.product_pass === null) ? null : report.operations.every(row => row.product_pass === true);
  report.status = report.operations.every(row => row.status === 'completed observations') ? 'completed observations' : 'observation incomplete';
  report.report_file = path.join(evidenceDir,'report.json');
  fs.writeFileSync(report.report_file, JSON.stringify(report,null,2) + '\n', {flag:'wx'});
  return report;
}

module.exports = {runStaleEditorProofs, mutateConflictClears, BASE_APP_SHA256};
