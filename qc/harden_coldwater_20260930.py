from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
task = root / 'projects/colderwater-playground-devtools'

def edit(rel, replacements):
    p = task / rel
    text = p.read_text(encoding='utf-8')
    for old, new in replacements:
        assert text.count(old) == 1, (rel, old[:90], text.count(old))
        text = text.replace(old, new)
    p.write_text(text, encoding='utf-8', newline='\n')

edit('environment/instructions/behaviour.md', [
    ("Old work mustn't come back later with a log entry, replace the current preview or claim to be the current success.", "Old work mustn't come back later with a log entry, replace the current preview or claim to be the current success. An error from that cancelled work shouldn't spoil the newer run either."),
    ("I don't want half of the failed attempt left behind.", "I don't want half of the failed attempt left behind. If I've had several successful runs, bring back the most recent one, not an earlier snapshot."),
    ("Keep my unsaved work so I can compare it with the latest copy, reload that copy and deliberately reapply my edit.", "Keep my unsaved work so I can compare it with the latest copy, reload that copy and deliberately reapply my edit. We may keep editing from both windows, so this needs to keep working whichever editor saves first next time.")
])

edit('tests/scored/functional/prompt.md', [
    ("This successful callback is the positive control", "Its delayed callback must change its own document, emit cancel-A-delayed and report the thrown cancel-A-error. The mutation followed by the error may be too brief to see; do not require a snapshot between those synchronous statements. This observed callback/error is the positive control"),
    ("Record the delayed marker count.", "Record the delayed marker and cancel-A-error counts."),
    ("setTimeout(() => console.log('cancel-A-delayed'), 4000);", "setTimeout(() => { document.body.innerHTML = '<p>cancel-A-late-dom</p>'; console.log('cancel-A-delayed'); throw new Error('cancel-A-error'); }, 4000);"),
    ("and A cannot replace B's DOM or report itself as the current success.", "the cancel-A-error count also cannot increase, and A cannot replace B's DOM, turn B into an error or report itself as the current success. Record B's completed status and retained render."),
    ("Start a separate timer run whose authored source logs stop-started, mutates its own document to a candidate and schedules stop-delayed after four seconds.", "Start a separate timer run using the same callback structure as A: log stop-started, show a candidate, then after four seconds replace its document with stop-late-dom, log stop-delayed and throw stop-error."),
    ("and stop-delayed never appears after waiting past its scheduled time.", "and neither stop-delayed nor stop-error appears after waiting past its scheduled time; stop-late-dom cannot replace the restored render."),
    ("About 10 UI actions; execute once in the phase plan below.\n\n1. Reuse the actually successful S09 recovery DOM/log as currentLastGood; if unavailable, run one ordinary DOM/log control. Record its actual completed render.", "About 14 UI actions; execute once in the phase plan below.\n\n1. Reuse the actually successful S09 recovery DOM/log as successful A; if unavailable, run one ordinary DOM/log control. Record its actual completed render. Then run a distinct successful B that renders latest-good-B and logs latest-good-B-completed; observe normal completion and record B as currentLastGood. If either setup fails, still collect the independent error-message and line observations below; do not infer their verdicts from rollback."),
    ("The preview returns to recorded currentLastGood, not failed-partial-dom.", "The preview returns to the most recent successful B (latest-good-B), not earlier A or failed-partial-dom."),
    ("About 29 UI actions; execute once in the phase plan below.\n\n1. Create a dedicated saved snippet QC Concurrent Save", "About 51 UI actions; execute once in the phase plan below.\n\n1. Create a dedicated saved snippet QC Concurrent Save"),
    ("Close the extra editor after collecting evidence. The stale rejection must not permanently prevent valid saving.", "The stale rejection must not permanently prevent valid saving.\n5. Repeat the same conflict once with the roles reversed, keeping the same two editors and saved identity. Load the recovered current record in both. Keep A dirty with title QC Reverse Draft, filename qc-reverse-draft.js and source console.log('reverse-unsaved');. B now successfully saves title QC Reverse Winner, filename qc-reverse-winner.html and source <!doctype html><html><body>second-editor-won</body></html>. Observe B's advanced revision, then attempt A's old-revision Save or its clearly explained proactive prevention. Apply step 3's request/refusal observation to A: all of B's fields and revision must stay unchanged. Independently observe that A retains its exact dirty fields with useful conflict feedback. Finally load the latest record in A, deliberately reapply A's recorded draft and save; fresh readback must show its exact fields under the same identity with an advanced revision. If first-cycle recovery failed, establish a valid current baseline using an ordinary load and Save before this second trial; keep the two outcome verdicts independent. Close the extra editor after both trials. This repeats the same refusal and recovery properties, not a new product feature.")
])

p = task / 'tests/scored/functional/judge.toml'
text = p.read_text(encoding='utf-8')
weights = {'cw_console_level_stream':.60, 'cw_console_value_inspection':.80,
 'cw_editor_syntax_colouring':.25, 'cw_saved_record_fidelity':.60,
 'cw_theme_actual_switch':.20, 'cw_console_duration':.20, 'cw_console_clear_control':.20,
 'cw_supersede_pending':1.40, 'cw_stop_pending_execution':1.20,
 'cw_js_error_rollback':.90, 'cw_stale_save_server_refusal':1.80, 'cw_stale_save_draft_recovery':2.00}
for key, value in weights.items():
    text, n = re.subn(r'(id = "'+re.escape(key)+r'"\n.*?\nweight = )[\d.]+', lambda m: m[1]+f'{value:.2f}', text, count=1, flags=re.S)
    assert n == 1
text = text.replace('no additional A delayed output, DOM or success becomes current.', 'no additional A delayed log or thrown error appears, B stays completed, and no late A DOM or success becomes current.')
text = text.replace("prevents the active timer's late output and permits a new Run.", "prevents the active timer's late log, thrown error and DOM replacement, and permits a new Run.")
text = text.replace('The JS failure restores recorded currentLastGood, not failed-partial-dom;', 'After successful A then distinct successful B, the JS failure restores B, not A or failed-partial-dom;')
text = text.replace('An otherwise-valid stale Save is refused with newer fields/revision unchanged.', 'In both successive trials with editor roles reversed, an otherwise-valid stale Save is refused with newer fields/revision unchanged.')
text = text.replace('The actual dirty editor gets useful conflict feedback, retains all unsaved fields and supports deliberate latest-revision recovery;', 'In both successive trials with editor roles reversed, the actual dirty editor gets useful conflict feedback, retains all unsaved fields and supports deliberate latest-revision recovery;')
p.write_text(text, encoding='utf-8', newline='\n')
print('Updated public behavior, three existing protocols, and 12 weights; total preserved.')
