from pathlib import Path
import re

task = Path('projects/colderwater-playground-devtools')
prompt_path = task / 'tests/scored/functional/prompt.md'
prompt = prompt_path.read_text(encoding='utf-8')

def replace_once(old, new):
    global prompt
    assert prompt.count(old) == 1, old[:120]
    prompt = prompt.replace(old, new, 1)

replace_once('S23 requires two live editors and the real dirty conflict flow:',
             'S23, S25 and S28 require two live editors and the real dirty conflict/prevention flow:')
replace_once("attempt B's Save when enabled, or observe proactive prevention with useful feedback and exact dirty-field retention.",
             "attempt B's relevant Save, Rename or Delete when enabled, or observe proactive prevention with useful feedback and exact dirty-field retention. Deliberately preventing Rename/Delete on unsaved work is also valid if the reason is clear and a usable latest/reapply route preserves that draft; an unexplained missing feature is not prevention.")

replace_once('About 26 UI actions; execute once in the phase plan below.',
             'About 39 UI actions and nine seconds of dedicated timer observation; execute once in the phase plan below.')
replace_once('Note the current counts of html-once-marker and dispatch-handler-marker.',
             'Note the current counts of html-once-marker and dispatch-handler-marker. Before CSS, use the authored-realm observation below to confirm oldGlobal actually equals do-not-carry in the execution realm that produced this control.')
replace_once('CSS must neither rerun the old script nor preserve its installed event handler.',
             'CSS must neither rerun the old script nor preserve its installed event handler. Before any later JavaScript Run, separately observe that oldGlobal is absent/undefined in the matched current CSS execution state. A later fresh JS Run is not evidence about the preceding CSS state. Follow the authored-realm observation rule below; this global outcome is independent of the script/handler outcome.')
needle = 'If it succeeds, CSS outcomes remain independently observable even though HTML mode failed; do not inherit a dispatch verdict or accept a missing CSS target.'
replace_once(needle, needle + '''

Authored-realm observation: inspect only the known authored oldGlobal property and authored DOM markers through normal browser frame/worker state, never app scripts, bundles or implementation internals. Positively match the realm before CSS by observing its assigned do-not-carry value together with the working authored control. During CSS, identify the current matching preview state from actual browser lifecycle/render observations; read the same authored property there before a later Run replaces it. A destroyed old realm plus a demonstrably fresh matched current realm is also valid. Do not inspect a convenient unrelated frame, mistake an inaccessible read for undefined, or demand an iframe/worker architecture. A retained authored value in the current CSS state is an ordinary failure. A retired hidden realm is not automatically the current state.

For a native-frame implementation this bounded browser recipe returns only authored facts. Run it before and during CSS and correlate the visible authored control and realm identity; it does not decide the verdict. Cross-origin frames can be evaluated through Playwright without requiring parent-page script access. If the app uses a worker/virtual execution context, use the equivalent permitted authored-state/lifecycle observation rather than requiring this particular recipe. If one bounded matching retry still cannot identify the actual authored execution realm through permitted browser observations, use S02's named permitted-observation EVALUATION_INCOMPLETE branch. This exception requires the actual intended current CSS preview/target to exist; a missing CSS action, blank/missing target or observed runtime failure is an ordinary local product failure. Correct colour is separately scored and is not a prerequisite for observing globals. Do not classify an otherwise unobservable architecture as a product defect or silently award absence credit.

```javascript
async (page) => {
  const context = page.context();
  const state = context.__cwAuthoredRealmProbe ||= {ids: new WeakMap(), next: 1};
  const facts = [];
  for (const frame of page.frames()) {
    if (!state.ids.has(frame)) state.ids.set(frame, state.next++);
    try {
      const visible = await frame.locator('#dispatch-mark').isVisible();
      const authored = await frame.evaluate(() => ({
        assigned: typeof globalThis.oldGlobal === 'string' && globalThis.oldGlobal === 'do-not-carry',
        absent: typeof globalThis.oldGlobal === 'undefined',
        marker: document.getElementById('dispatch-mark')?.textContent ?? null
      }));
      facts.push({realm: state.ids.get(frame), visible, ...authored});
    } catch { facts.push({realm: state.ids.get(frame), unavailable: true}); }
  }
  return facts;
}
```

5. Separately establish a dedicated CSS timer control with a normal supported HTML Run (or the equivalent ordinary JS-created document if HTML mode failed):
<!doctype html><html><body><p id="css-timer-state">css-timer-ready</p><button id="css-timer-button">Queue timer</button><script>let n=0; console.log('css-timer-control'); document.getElementById('css-timer-button').addEventListener('click',()=>{const turn=++n; console.log('css-timer-start-'+turn); setTimeout(()=>{document.getElementById('css-timer-state').textContent='css-timer-fired-'+turn; console.log('css-timer-fired-'+turn);},4000);});</script></body></html>
Click once and actually observe css-timer-start-1 in the console, then css-timer-fired-1 in both DOM and console after the callback completes. This is the successful matching timer control and last-good document; mere absence from a timer that never fired cannot prove cancellation. Prepare supported CSS source #css-timer-state { color: rgb(255, 0, 0); } in the editor without running it, then batch a second ordinary click with Run while that four-second callback is genuinely pending. Confirm css-timer-start-2 before replacement. A demonstrably missed setup window may be retried once. The current CSS result has the last successful css-timer-fired-1 paragraph and retained button; ordinary CSS styling establishes this is the intended current document, without demanding live handlers in its fresh copy. Observe until at least five seconds from the second click: css-timer-fired-2 must not arrive as a new console entry, DOM change or later success. Pending candidate display before replacement is optional. Finally run a short ordinary JS source producing its own unique DOM/log marker. This timer outcome uses its own working control and does not erase already observed basic CSS, global or script/handler results if it fails. It does not require unrelated host controls to respond during a loop.
''')

def replace_protocol(number, next_number, text):
    global prompt
    start = prompt.index(f'### S{number:02d} ')
    end = prompt.index(f'### S{next_number:02d} ', start)
    prompt = prompt[:start] + text.strip() + '\n\n' + prompt[end:]

replace_protocol(25, 26, '''### S25 — cw_stale_rename_preserves_newer_record

About 34 UI actions; execute once in the phase plan below. Server refusal and dirty-editor recovery have separate evidence keys.

1. Create a dedicated saved snippet QC Stale Rename Base, filename qc-stale-rename.js, source console.log('stale-rename-original');. Record its identity, exact fields and current revision. Load this same revision in live editors A and B using the two-editor setup above. In B enter a distinct valid unsaved title QC Stale Rename Draft, filename qc-stale-rename-draft.js and source console.log('stale-rename-unsaved');. Record all three exact fields and keep B dirty. Its intended rename target is this same unused dirty title.
2. In A, rename the saved record normally to QC Stale Rename Current. Capture the actual successful rename/write method, path, body and revision mechanism. Fresh lookup confirms the new title and advanced revision, with filename/source unchanged. This is the current-rename positive control; keep B at its older revision.
3. From B's real UI attempt Rename to the recorded dirty title, completing a normal title dialog if offered. Record the latest intended draft before submitting if that deliberate dialog entry updates a field. Alternatively, observe clear proactive conflict prevention, or deliberate prevention of Rename on unsaved work, that keeps all three exact draft fields and offers a usable route to latest/reapply. Do not force a disabled control. A missing action or unexplained refusal is not that alternative. Observe useful conflict/prevention feedback and exact retention of B's title, filename and source. Replay alone cannot establish this UI outcome.
4. Independently establish the server result: observe B's actual otherwise-valid old-revision rename request and refusal. If UI prevention suppressed it, replay that old revision in the successful observed rename shape. The valid unused title avoids collision errors. Fresh read must retain A's newer title, filename, source and revision exactly. An unrelated validation error, nonexistent route or transport failure is not stale protection. Server refusal can pass even if the UI lost its draft; draft retention can be observed even if a separate replay exposes a server defect.
5. After recording B's retained draft, deliberately load latest, handling any normal dirty warning. Reapply the retained fields using ordinary editing or an optional recovery control; neither a particular Restore button nor automatic reapplication is required. Save at the current revision and reload the exact intended title/filename/source. This is deliberate draft recovery, not credit for an automatic refresh that already discarded it. A valid current Save may establish this draft outcome even if Rename is broken.
6. Separately establish the server row's current-rename recovery: using the actual latest revision, rename to QC Stale Rename Recovered, then fresh-read the title with the immediately preceding saved filename/source intact and an advanced revision. Do this even if the dirty-editor outcome failed, using the current saved record as fallback. Close only the extra editor/context created here. Do not borrow another scenario's record or verdict.
''')

replace_protocol(28, 29, '''### S28 — cw_stale_delete_preserves_newer_record

About 36 UI actions; execute once in the phase plan below. Server refusal and dirty-editor recovery have separate evidence keys.

1. Create this scenario's own QC Stale Delete Target (qc-stale-delete.js, console.log('stale-delete-original');), QC Stale Delete Sibling (qc-stale-sibling.js, console.log('stale-delete-keep');) and QC Stale Delete Control (qc-stale-control.js, console.log('current-delete-control');). Record their exact fields/revisions and the library list.
2. Successfully delete Control through the normal UI and capture the actual request method, path, body and revision mechanism. Complete any confirmation offered without grading confirmation here. A current deletion must really succeed; a guessed route is not a control.
3. Load Target's same old revision in live editors A and B. In B enter and record valid unsaved title QC Stale Delete Draft, filename qc-stale-delete-draft.js and source console.log('stale-delete-unsaved');. Keep B dirty. In A update Target through normal Save to source console.log('stale-delete-newer-work');. Fresh lookup establishes the newer exact saved fields and advanced revision.
4. Attempt Delete from B's actual UI, completing a normal confirmation when offered; simply cancelling confirmation is not a stale test. Clear proactive conflict prevention, or deliberate prevention of Delete on unsaved work, is valid with exact draft retention and a usable latest/reapply route. Do not force disabled controls or treat a missing feature as prevention. Observe useful feedback and unchanged B title, filename and source. Independently observe or replay the valid old-revision Delete in the successful operation shape. Fresh reads must show the newer Target, Sibling and unrelated records/revisions unchanged. Replay establishes server refusal only, never the dirty-editor result.
5. After observing retention, deliberately reload latest in B, handling ordinary warnings, reapply the retained fields through normal editing or an optional recovery action, and perform a current Save. Reload and verify the exact intended fields. No particular recovery button is required. An automatic draft-destroying reload is not deliberate recovery.
6. Independently complete the server row's current-delete recovery using Target's actual latest revision. Only Target disappears, including after browser reload. Use the current saved record even if the dirty-editor outcome failed. Close only this scenario's extra editor/context. Confirmation availability and updates to already-deleted identities belong to their own separate outcomes.
''')

replace_protocol(33, 34, '''### S33 — cw_supported_source_file_import

About 64 UI actions; execute once in the phase plan below. Exact supported imports, off-state execution, invalid imports, invalid saved filenames and the two uppercase layers have independent evidence keys.

1. With Auto-run off, reuse S17's actually successful final manual Run as currentLastGood; if unavailable, run one ordinary DOM/log control now. Save that source as QC Import Preview Control so the workspace is clean, and record actual preview/log baseline.
2. Import import-me.js with exactly these two lines through the real file input (in-memory named bytes are valid):
document.body.innerHTML='<p>import-executed-marker</p>';
console.log('import-executed-log');
Verify the exact filename/source in an editable draft. Wait two seconds with Auto-run off: the prior successful preview remains and neither imported output has executed. Click Run and observe both imported DOM/log markers from that actual source. This deliberate execution is the matching control for the off-state result. Append a new-line // js-import-edited comment; record the exact edited text, Save as QC Imported JS and reload it from the library to verify filename/source and actual saved identity. Do not require another Run for edit/save fidelity.
3. Using the same actual importer and ordinary dirty-work handling, import these other supported lowercase files separately. For each, compare the immediate exact filename/source, append the specified own-language comment, Save under its distinct title, reload the workspace and load that saved identity with exact edited filename/source. Do not substitute a JS-only test for these formats, and do not require additional preview execution here.
HTML file import-me.html, title QC Imported HTML, initial text:
<!doctype html>
<html><body><p>html-import-original</p></body></html>
Append a new-line <!-- html-import-edited --> comment.
CSS file import-me.css, title QC Imported CSS, initial text:
p { color: rgb(1, 2, 3); }
Append a new-line /* css-import-edited */ comment.
Use the exact supplied text as the comparison, recording whether its final newline was included; no line-ending convention beyond fidelity to the actual uploaded fixture is imposed. If a format fails, record that support failure and continue the others. Their simple valid source and ordinary current Save are sufficient; dispatch/autorun verdicts are not prerequisites.
4. After any actual accepted supported import, attempt notes.txt containing unrelated text. Useful refusal must leave current title, filename and source exactly unchanged. A never-working importer cannot establish rejection merely by doing nothing. Record a valid imported draft's actual successful current save/update. If supported import failed, use the independently saved QC Import Preview Control for server-filename probes, first observing a successful current update and its actual request shape. With CURRENT revision and otherwise valid fields, separately attempt unsupported.txt and nested/demo.js in an in-page request using that shape. Each server refusal leaves title, filename, source and revision unchanged on a fresh read. Refresh actual state/revision before the second probe if the first unexpectedly mutated it. Finish with a supported lowercase filename/current Save and exact readback. UI filtering, unrelated stale errors or guessed fields cannot prove these server refusals.
5. Independently check extension case at each layer for .JS, .HTML and .CSS, using the corresponding short supported sources above. Import each uppercase filename through the same actual importer and compare exact filename/source: these three observations belong only to import_extension_case. Separately Save the matching uppercase filename with an otherwise valid unique title/source and current revision, then reload and verify it unchanged: these belong only to saved_filename_extension_case. If uppercase import fails, set that uppercase filename on an independently working lowercased/imported or ordinary draft before the current Save. If uppercase Save fails, restore lowercase before any further supported-import edit/save observation. Do not infer one layer from the other or erase its working result. No extra execution is required for case checks. Export and dirty-import warning behavior remain separately scored.
''')
prompt_path.write_text(prompt, encoding='utf-8', newline='\n')

judge_path = task / 'tests/scored/functional/judge.toml'
judge = judge_path.read_text(encoding='utf-8')
def row(cid, key, weight, description):
    return f'[[criterion]]\nid = "{cid}"\nname = "{cid}"\ntype = "binary"\nweight = {weight}\ndescription = "{key}: {description}"\n\n'
def replace_row(cid, replacement):
    global judge
    pattern = r'\[\[criterion\]\]\nid = "' + re.escape(cid) + r'"\n.*?(?=\[\[criterion\]\]|\Z)'
    judge, count = re.subn(pattern, lambda _: replacement, judge, count=1, flags=re.S)
    assert count == 1, cid

old = re.search(r'\[\[criterion\]\]\nid = "cw_css_inert_copy"\n.*?(?=\[\[criterion\]\])', judge, re.S).group()
replace_row('cw_css_inert_copy', old.replace('weight = 0.40', 'weight = 0.20') +
    row('cw_css_global_freshness', 'S02.css_global_freshness', '0.10', 'The positively observed authored oldGlobal is absent in the matched current CSS execution state, before any later JS Run. Use the actual realm/lifecycle rule; unavailable matching is the named permitted-observation incomplete branch, never assumed absence or an architecture defect.') +
    row('cw_css_pending_timer_cancelled', 'S02.css_pending_timer_cancelled', '0.10', 'After the matching button timer really fires once, a second observed pending timer is replaced by CSS before due. The last-good CSS document remains and no second callback DOM/log/success arrives through the stated window; ordinary execution recovers. Other CSS outcome verdicts are not prerequisites.'))
replace_row('cw_stale_rename_refusal',
    row('cw_stale_rename_refusal', 'S25.stale_rename_refusal', '0.75', 'An otherwise-valid stale rename is usefully refused without newer-record mutation; actual current renames before/after work. A request replay can establish this server outcome independently of dirty-editor retention.') +
    row('cw_stale_rename_draft_recovery', 'S25.stale_rename_draft_recovery', '0.75', 'The actual old-revision editor retains its exact dirty title/filename/source with useful conflict or deliberate prevention feedback, then supports deliberate latest/reapply/current-Save readback. Replay alone cannot prove retention; no particular recovery control is required.'))
replace_row('cw_stale_delete_refusal',
    row('cw_stale_delete_refusal', 'S28.stale_delete_refusal', '0.50', 'An otherwise-valid stale delete is usefully refused without newer-record mutation; actual current deletes before/after work. Replay can establish this server outcome independently of dirty-editor retention. Confirmation is not scored here.') +
    row('cw_stale_delete_draft_recovery', 'S28.stale_delete_draft_recovery', '0.50', 'The actual old-revision editor retains its exact dirty title/filename/source with useful conflict or deliberate prevention feedback, then supports deliberate latest/reapply/current-Save readback. Replay alone cannot prove retention; no particular recovery control is required.'))
replace_row('cw_supported_file_import', row('cw_supported_file_import', 'S33.supported_file_import', '0.60', 'Each lowercase .js, .html and .css import supplies its exact filename/source in an editable draft; its own-language edit is saved and reloaded under the recorded identity. Execution and case-handling verdicts are separate.'))
replace_row('cw_source_file_extension_case',
    row('cw_import_extension_case', 'S33.import_extension_case', '0.10', 'The actual importer accepts supported .JS, .HTML and .CSS files with exact filename/source. Server acceptance is independently scored.') +
    row('cw_saved_filename_extension_case', 'S33.saved_filename_extension_case', '0.10', 'Otherwise-valid current writes accept and persist .JS, .HTML and .CSS filenames unchanged. Use an independent lowercased/imported or ordinary draft if uppercase import failed.'))
judge_path.write_text(judge, encoding='utf-8', newline='\n')

context_path = task / 'tests/app_context.md'
context = context_path.read_text(encoding='utf-8')
start = context.index('Server-only stale rename/delete')
end = context.index('\n\n', start)
context = context[:start] + 'Stale Save, Rename and Delete each have independent server-refusal and real dirty-editor outcomes. Use two actual editors with recorded dirty title, filename and source. An enabled UI attempt or clear proactive conflict prevention with exact draft retention is valid; Rename/Delete may also deliberately prevent acting on unsaved work if a usable latest/reapply route preserves it. Do not force disabled controls. A request replay alone cannot prove dirty-editor behavior; separately replay the observed old-revision request when UI prevention suppresses it. No specific recovery control is required.' + context[end:]
context = context.replace('without rerunning its old script or keeping its handlers.', 'without rerunning its old script or keeping its globals, timers or handlers.')
context += '\nFunctional S02 has a separate narrow permitted-observation limitation: after a real authored control, the actual execution realm cannot be matched through allowed browser frame/worker/state/lifecycle observations even after one bounded setup retry. That unavailable evidence uses EVALUATION_INCOMPLETE, not an architecture-specific failure or an assumed absence. The actual intended current CSS preview/target must exist. A missing CSS action, blank/missing target or observed runtime failure is an ordinary local product failure; a separately wrong colour need not prevent observing globals. Observed old authored state in the matched current CSS realm is an ordinary local failure. A later fresh JS Run or an unrelated frame never proves CSS global freshness. This rule permits observing known authored properties only, not reading app implementation or adding inspection hooks.\n'
context_path.write_text(context, encoding='utf-8', newline='\n')

print('Updated three task files; planned 93 binary outcomes, original feature budgets unchanged.')
