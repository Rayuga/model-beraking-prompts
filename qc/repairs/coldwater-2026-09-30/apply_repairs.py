from pathlib import Path
import re, shutil, tomllib

root=Path(__file__).resolve().parents[3]
task=root/'projects/colderwater-playground-devtools'
out=Path(__file__).resolve().parent
old=root/'qc/runs/coldwater-2026-09-30-hardening/golden/run-golden-20260930-070504/drivers'
shutil.copytree(old,out/'drivers',dirs_exist_ok=True)

def write(rel,text): (task/rel).write_text(text,encoding='utf-8',newline='\n')
def read(rel): return (task/rel).read_text(encoding='utf-8')
integration=read('environment/instructions/integration.md')
integration+='\nDeliver ordinary files and directories in /app. Symbolic links are unsupported except links beneath /app/node_modules whose fully resolved targets also stay beneath /app/node_modules. Broken links are unsupported.\n'
write('environment/instructions/integration.md',integration)

rel='tests/scored/functional/judge.toml'
s=read(rel)
rows=tomllib.loads(s)['criterion']
head=s[:s.index('[[criterion]]')].rstrip()+'\n\n'
changes={
'cw_preview_origin_boundary': 'S05.preview_origin_boundary: All four parent-document/storage operations are blocked, the forbidden snippet title is never applied, the otherwise-unused storage key is unchanged, and own-document execution remains usable. Legitimate app-owned title/status changes are allowed.',
'cw_literal_loop_deadline': 'S09.literal_loop_deadline: The bounded braced, unbraced and Promise-callback loop controls first complete with their computed values. Both top-level infinite literal loops and the looping Promise callback then terminate within the allowed budget margin with a time-limit reason, early logs preserved and successful recovery.',
'cw_js_error_rollback': 'S10.js_error_rollback: After successful A then distinct successful B, the JS failure restores B, not A or failed-partial-dom. Later execution is scored separately.',
'cw_html_error_rollback': 'S11.html_error_rollback: The HTML failure restores recorded currentLastGood, not Failed HTML candidate. Later execution is scored separately.',
'cw_timer_error_message': 'S12.timer_error_message: Both JS and complete-HTML timer fixtures report their own thrown error marker as a failure.',
'cw_timer_error_line': 'S12.timer_error_line: The JS timer error identifies entered line 2 and the complete-HTML timer error identifies document line 6, including markup.',
'cw_timer_error_rollback': 'S12.timer_error_rollback: Both timer failures restore recorded currentLastGood instead of the failed candidate. Later execution is scored separately.',
'cw_promise_error_message': 'S13.promise_error_message: Error-object and plain-string unhandled rejections report their own error markers as failures in the specified JS and complete-HTML fixtures.',
'cw_promise_error_line': 'S13.promise_error_line: Both JS rejection fixtures identify entered line 2, and the complete-HTML rejection identifies document line 6, including markup. Plain-string reasons must not lose their location.',
'cw_promise_error_rollback': 'S13.promise_error_rollback: Each rejection restores recorded currentLastGood instead of its failed candidate. Later execution is scored separately.',
'cw_console_duration': 'S16.console_duration: Observed successful short and delayed runs display elapsed durations consistent with their visibly measured lifetimes, allowing units, rounding and scheduling overhead. A constant numeric placeholder does not pass.',
'cw_title_collision_refusal': 'S24.title_collision_refusal: With successful valid creation/update and unused-title recovery controls, UI and observed server formats refuse exact/padded collisions for NEW creation and current-revision updates, with useful feedback and all complete records/revisions unchanged.',
'cw_title_empty_rejected': 'S24.title_empty_rejected: With successful valid creation/update and recovery controls, otherwise-valid empty and whitespace-only titles are refused for NEW creation and current-revision updates without saved-state mutation.'
}
extra=[]
for row in rows:
 if row['id'] in changes: row['description']=changes[row['id']]
 if row['id'] in ['cw_js_error_rollback','cw_html_error_rollback','cw_timer_error_rollback','cw_promise_error_rollback']:
  row['weight']=round(row['weight']-.1,2)
  kind=row['id'].split('_')[1]; protocol={'js':'S10','html':'S11','timer':'S12','promise':'S13'}[kind]
  extra.append(dict(id=f'cw_{kind}_error_recovery',name=f'cw_{kind}_error_recovery',type='binary',weight=.1,description=f'{protocol}.{kind}_error_recovery: After the observed {kind} failure, a new valid Run produces its own rendered and logged recovery markers. Do not inherit rollback, error-message or line-number verdicts.'))
 if row['id']=='cw_console_duration':row['weight']=.1
 if row['id']=='cw_saved_record_fidelity':row['weight']=.4
extra.extend([
 dict(id='cw_terminal_durations',name='cw_terminal_durations',type='binary',weight=.1,description='S16.terminal_durations: Already-observed failed, stopped and timed-out runs also show elapsed durations consistent with their recorded lifetimes. Judge the duration evidence independently of rollback or later recovery.'),
 dict(id='cw_save_load_execution_canary',name='cw_save_load_execution_canary',type='binary',weight=.2,description='S21.save_load_execution_canary: Saving, updating and loading the carrier as text cause no observable execution side effect on its dedicated monitor record, with matching successful write controls. Attribute browser-originated requests separately; this bounded canary is not proof that all server evaluation is absent.')
])
rows.extend(extra)
import json
for row in rows:
 head+='[[criterion]]\n'+'\n'.join(k+' = '+(json.dumps(v,ensure_ascii=False) if isinstance(v,str) else f'{v:.2f}') for k,v in row.items())+'\n\n'
write(rel,head)

rel='tests/scored/functional/prompt.md';s=read(rel)
def replace(a,b):
 global s
 assert a in s,a[:100]
 s=s.replace(a,b,1)
replace("All four results must be blocked. Fresh in-page reads of the playground's own title and storage show exactly their earlier values, and the app remains usable.","All four results must be blocked. Choose a forbidden-title marker different from the recorded host title (substitute a fresh suffix in the snippet if necessary). Fresh in-page reads must never show the snippet's forbidden title, and the otherwise-unused storage key stays exactly unchanged. The app may legitimately change its own title to show running/completed status; that is not parent access by the snippet. The app remains usable.")
replace('About 20 UI actions; execute once in the phase plan below.\n\n1. Reuse the actually successful S08', 'About 29 UI actions; execute once in the phase plan below.\n\nFirst establish three supported finite-loop controls, as separate .js Runs. Each must complete and log its computed value; an app that immediately aborts every loop cannot establish deadline enforcement:\n```javascript\nlet n=0; while(n<3) { n++; } console.log("finite-braced",n);\n```\n```javascript\nlet n=0; while(n++<3); console.log("finite-unbraced",n);\n```\n```javascript\nPromise.resolve().then(() => { let n=0; while(n<3) { n++; } console.log("finite-promise",n); });\n```\nExpect 3, 4 and 3 respectively. These controls may replace the current document; establish or reuse an actually completed DOM/log render afterward for the rollback observations.\n\n1. Reuse the actually successful S08')
replace('3. A new valid .js run renders and logs timer-error-recovered. The asynchronous error must not commit a half-failed preview or prevent recovery.', '''3. Before recovery, run this complete HTML source as delayed-error.html with the same last-good control. The timer error names html-async-error-marker and line 6 of the complete document; the failed candidate cannot replace the last-good render.
```html
<!doctype html>
<html>
<body>
<p>html-async-failed-candidate</p>
<script>
setTimeout(() => { throw new Error('html-async-error-marker'); }, 50);
</script>
</body>
</html>
```
4. A new valid .js run renders and logs timer-error-recovered. Record rollback and later execution as independent outcomes; no recovery verdict erases an observed rollback or vice versa.''')
replace('3. A new valid .js run renders and logs promise-error-recovered. The rejection must not be silently reported as success, clear the last-good render or prevent recovery.', '''3. Repeat with these exact two lines as plain-rejection.js. A plain-string reason is valid JavaScript and still needs its message and entered line 2:
```javascript
document.body.innerHTML='<p>primitive-failed-candidate</p>';
Promise.reject('primitive-error-marker');
```
4. Run this complete document as html-rejection.html. Its unhandled rejection must identify html-promise-error-marker and full document line 6. All three failures restore the same recorded last-good render.
```html
<!doctype html>
<html>
<body>
<p>html-promise-failed-candidate</p>
<script>
Promise.reject('html-promise-error-marker');
</script>
</body>
</html>
```
5. A new valid .js run renders and logs promise-error-recovered. Record rollback and later execution independently; a wrong error message or line does not erase directly observed recovery.''')
replace('### S12 — cw_timer_error_line_and_preview_restore\n\nAbout 10 UI actions','### S12 — cw_timer_error_line_and_preview_restore\n\nAbout 13 UI actions')
replace('### S13 — cw_promise_rejection_line_and_preview_restore\n\nAbout 10 UI actions','### S13 — cw_promise_rejection_line_and_preview_restore\n\nAbout 16 UI actions')
replace('3. Execute S34 using this actual completed state and nonempty console; do not repeat its setup Run. Then use Clear console: prior log rows disappear. Empty-state hints and unrelated status/duration labels may remain.', '''3. Execute S34 using this actual completed state and nonempty console; do not repeat its setup Run. Then use Clear console: prior log rows disappear. Empty-state hints and unrelated status/duration labels may remain.
4. Retain the short successful Run's displayed duration and browser-measured lifetime. Reuse S02's already-required four-second successful timer control as the delayed successful comparison. Read its duration immediately on completion, before editing or the next Run. Accept seconds, milliseconds or equivalent units and ordinary rounding/overhead. The delayed duration should reflect roughly four seconds (a broad 3–8 second range is acceptable) and differ meaningfully from the short execution; do not demand exact clock agreement. A fixed "0 ms" or other constant label is not a measured duration. If S02's control cannot complete, independently run a simple four-second timer once for duration evidence only; do not inherit CSS's verdict.
5. Without repeating failures or waiting again, retain durations immediately after the already-required S04 uncancelled error and Stop, S09 timeout, and S10–S13 errors. Each terminal state needs an elapsed value consistent with its observed lifetime, with coarse rounding allowed for short runs. Error, Stop and timeout duration credit is separate from successful-run measurement. Absence of a required terminal state cannot establish its duration, but preserve other duration observations.''')
replace('About 18 UI actions; execute once in the phase plan below.','About 30 UI actions; execute once in the phase plan below.')
replace('4. Reload the browser and load both again. Their identities and exact fields survive. This is a real durable save/load check, not evidence from an unsaved editor buffer.', '''4. Reload the browser and load both again. Their identities and exact fields survive. This is a real durable save/load check, not evidence from an unsaved editor buffer.
5. For the text-only storage boundary, create a separate ordinary monitor record. Demonstrate a successful update and fresh readback, then restore a baseline and capture the current revision plus that successful update's actual absolute same-origin URL, method, relevant headers and body. Build a valid update that would change only this monitor to a fresh execution marker. Do not guess routes or touch unknown records.
6. Keep Auto-run off and do not use Run. Create a separate carrier with source containing an unconditional fetch of the observed absolute monitor URL and the valid observed update options. Save it, update only its source by adding an ordinary comment, and load it again. After each operation freshly read the monitor's complete fields/revision; they must stay at the baseline. Record browser requests so accidental browser execution is distinguished from a server-originated side effect. If the UI prevents a save, attempt its observed valid format once; refusal alone does not prove text-only storage.
7. From the workspace browser, perform the exact still-current monitor update as the matching positive control; fresh readback must show the execution marker and advanced revision. Use the current revision if an earlier product defect already mutated it and retain that failure. This canary detects observable evaluation side effects with a working matching request; it does not prove the absence of every possible server evaluation. Do not inspect private source or invent further execution mechanisms. Text round-trip fidelity remains separately scored.''')
replace('About 28 UI actions; execute once. Use ordinary New and Save throughout; no separate Rename feature is required.','About 38 UI actions; execute once. Use ordinary New and Save throughout; no separate Rename feature is required.')
replace('4. Save a separate new record titled qc title sibling', '''4. Independently test NEW creation using the actually successful creation format from step 1: exact QC Title Sibling, padded "  QC Title Sibling  ", empty and whitespace-only titles, each with otherwise-valid filename/source. Attempt the exact collision through New/Save in the UI; if prevented before a request, replay the observed creation format from the app origin. Fresh reads after each attempt show no new identity and no changes to existing complete records or revisions. Update-only validation does not establish creation validation; a stale revision must never be inserted into a creation request.
5. Save a separate new record titled qc title sibling''')
replace('A new valid .js run renders and logs js-error-recovered. Judge the exact entered source lines, not injected wrapper offsets. Logging the error while committing the failed candidate, clearing the prior good render or failing recovery does not pass.','A new valid .js run renders and logs js-error-recovered. Judge entered source lines without injected wrapper offsets. Score error message, line, rollback and later recovery independently; a failure of one must not erase directly observed success of another.')
write(rel,s)
print({'rows':len(rows),'weight':round(sum(r['weight'] for r in rows),2),'drivers':str(out/'drivers')})
