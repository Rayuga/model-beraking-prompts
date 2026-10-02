"""Apply the R2 union only after its complete independent round has reconciled."""
from pathlib import Path
import json

root = Path.cwd()
reports = root/'qc/runs/coldwater-2026-10-01-history-hardening-r2/per-row-review/rows'
assert all((reports/f'{n:02}.json').is_file() for n in range(1,54)), 'Finish the independent round first'
assert (reports.parent/'deterministic.json').is_file()
summary = reports.parent.parent/'summary.json'
assert summary.is_file(), 'Reconcile the union first'
assert json.loads(summary.read_text(encoding='utf-8'))['valid_reviews'] == 54
task = root/'projects/colderwater-playground-devtools'
unused_assets_dir = task/'environment/assets/artifacts'
if unused_assets_dir.exists():
    assert unused_assets_dir.is_dir() and not any(unused_assets_dir.iterdir()), 'Review contents before removing a nonempty asset directory'
    unused_assets_dir.rmdir()

def replace(path, old, new):
    file=task/path
    text=file.read_text(encoding='utf-8')
    assert text.count(old)==1, (path, old[:100], text.count(old))
    file.write_text(text.replace(old,new),encoding='utf-8',newline='\n')

replace('solution/app/server.js',
        "const filename = typeof body.filename === 'string' ? body.filename.trim() : '';",
        "const filename = typeof body.filename === 'string' ? body.filename : '';")
replace('solution/app/src/runtime.ts',
        "for (const element of doc.querySelectorAll('*')) for (const attribute of Array.from(element.attributes)) {\n    if (attribute.name.toLowerCase().startsWith('on')) {\n      const id = 'handler-' + crypto.randomUUID(); element.setAttribute('data-cw-handler', id);",
        "for (const element of doc.querySelectorAll('*')) {\n    const handlerId = 'handler-' + crypto.randomUUID();\n    for (const attribute of Array.from(element.attributes)) {\n    if (attribute.name.toLowerCase().startsWith('on')) {\n      const id = handlerId; element.setAttribute('data-cw-handler', id);")
replace('solution/app/src/runtime.ts',
        "  }\n  const clearLocations = root => {", "    }\n  }\n  const clearLocations = root => {")

replace('environment/instructions/behaviour.md',
        'Titles are just display names; records have their own identities.',
        'Titles are just display names; two saved snippets can share one. Each record has its own identity.')

path='tests/scored/functional/prompt.md'
replace(path,
        'Capture actual successful UI request method/path/headers/body; replay only that observed shape in-page using the actual local backend URL and its observed credential policy. Never guess revision fields or IDs.',
        'Capture actual successful UI request method/path/headers/body; replay only that observed shape in-page using the actual local backend URL and its observed credential policy. Preserve the logical operation, target, payload and loaded revision. Incidental transport metadata such as a one-use CSRF token may be refreshed through the observed application mechanism or valid UI retry path; do not require stale transport bytes to be accepted. An authentication or transport-token refusal does not establish a stale-revision conflict or a retry defect. Never guess revision fields or IDs.')
replace(path,
        '2. Start another new draft and save title QC Save Beta, filename qc-beta.html, source <!doctype html><html><body><p>beta-body</p></body></html>.',
        '2. Start another new draft and save the same display title QC Save Alpha, filename qc-beta.html, source <!doctype html><html><body><p>beta-body</p></body></html>. Call this second identity Beta in the observations; the first is Alpha. Their titles may match without merging their identities.')
replace(path,
        'Replay S37\'s exact successful restore request once with the same attempt identity after restart.',
        'Retry S37\'s successful logical restore once with the same attempt identity, target and original loaded revision after restart, allowing refreshed incidental transport metadata under the shared replay guidance.')
replace(path,
        'Record history_inspection_draft from the actual editor and current-record observation.',
        'Record history_inspection_draft from the actual dirty editor and history_inspection_saved_head from the fresh saved-record observation independently; a failure of one protection does not erase the other.')
replace(path,
        'Record document_switch_cancels_queue. Keep previously observed results if either trial fails, and leave Auto-run off afterwards.',
        'Record document_switch_cancels_queue for the abandoned pending edits and document_switch_open_does_not_run for execution caused only by opening New or the saved source. These outcomes use the same positive Auto-run control but retain independent credit. After the queued trials, with Auto-run still on and no pending edit, repeat a quiet New and a quiet Load of the saved source. Compare authored log/preview markers before and after the observed debounce window: neither opening by itself executes; a later edit or explicit Run still works. A blank New draft may have no executable marker, so use the known saved-source marker and visible run/console state as the distinguishing control. Keep previously observed results if either trial fails, and leave Auto-run off afterwards.')
replace(path,
        'Repeat that exact captured restore request once, without changing its attempt identity or loaded revision.',
        'Retry that captured logical restore once, without changing its attempt identity, target or original loaded revision. Refreshed incidental transport metadata is allowed under the shared replay guidance.')
replace(path,
        'On the now-known restore URL, install a one-request Playwright route that forwards the next deliberate UI restore with route.fetch(), records its actual successful response, then aborts only delivery of that response.',
        'Before another deliberate restore to the same historical target used in step 4, record the current head and complete history. On the now-known restore URL, install a one-request Playwright route that forwards that fresh UI restore with route.fetch(), records its actual successful response, then aborts only delivery of that response. Before judging its retry, verify from a fresh read that this new deliberate attempt advanced the head once, appended one snapshot with the selected historical fields and retained the previous history. This fresh-attempt evidence belongs to history_restore: returning an earlier cached result for a new deliberate restore is not a successful control.')
replace(path,
        'This supplies the same restore_retry outcome\'s user-facing path; it does not regrade ordinary restored-field fidelity.',
        'The subsequent retry acknowledgement and absence of an additional write supply restore_retry\'s user-facing path; fresh deliberate restoration remains owned separately by history_restore.')
replace(path,
        'Entered snippet text, saved records and imported/exported user files are product data and may be compared.',
        'Entered snippet text and saved records are product data and may be compared.')
replace(path,
        'One action is a field edit, activation, upload, navigation, scroll or resize, not a keystroke;',
        'One action is a field edit, activation, navigation, scroll or resize, not a keystroke;')

replace('tests/scored/visual/prompt.md',
        'Do not require a new save, code execution, import or destructive action to earn visual credit.',
        'Do not require a new save, code execution or destructive action to earn visual credit.')

path='tests/scored/functional/judge.toml'
replace(path,
        'weight = 0.6\ndescription = "S37.history_inspection_draft: Inspecting an older revision leaves the actual three-field dirty draft and current saved record unchanged. Read-only inspection must not act as restore."',
        'weight = 0.3\ndescription = "S37.history_inspection_draft: Inspecting an older revision leaves the actual three-field dirty draft unchanged. Judge the editor independently of whether the saved head also remains unchanged."\n\n[[criterion]]\nid = "cw_history_inspection_saved_head"\nname = "cw_history_inspection_saved_head"\ntype = "binary"\nweight = 0.3\ndescription = "S37.history_inspection_saved_head: A fresh saved-record read after inspecting an older revision still matches the last accepted Save. Read-only inspection must not restore or otherwise change the saved head; dirty-editor retention has separate credit."')
replace(path,
        'weight = 0.7\ndescription = "S17.document_switch_cancels_queue: New and saved-record loading cancel genuinely queued edits without executing either abandoned or merely loaded source; a subsequent actual edit still executes automatically. Use successful controls, not silence from a dead feature."',
        'weight = 0.4\ndescription = "S17.document_switch_cancels_queue: With positively observed Auto-run, pending edited source markers do not run after New or loading a saved source. Preserve this result independently of whether opening the new source itself executes."\n\n[[criterion]]\nid = "cw_document_switch_open_does_not_run"\nname = "cw_document_switch_open_does_not_run"\ntype = "binary"\nweight = 0.3\ndescription = "S17.document_switch_open_does_not_run: Opening New or a known saved source does not itself execute that source with Auto-run enabled, both during the queued trials and when no edit is pending. A later real edit can still auto-execute. Preserve this result independently of cancellation of older queued work."')
replace(path,
        'S37.history_restore: A deliberate restore copies all historical fields into a new advanced current revision of the same identity, retaining the intervening snapshots unchanged.',
        'S37.history_restore: Each observed deliberate restore, including another fresh attempt to the same historical target, copies all historical fields into a new advanced current revision of the same identity, retaining intervening snapshots unchanged. A prior attempt\'s cached result is not a fresh restore.')
replace(path,
        'the captured-request replays acknowledge',
        'the logical-request retries acknowledge')
replace(path,
        'S22.restore_retry_restart: After the same completed process restart, the captured previously committed restore attempt still returns its original result',
        'S22.restore_retry_restart: After the same completed process restart, the same logical previously committed restore attempt, with fresh incidental transport metadata if needed, still returns its original result')
print('Applied reviewed golden, coverage, retry-transport and inspection-credit repairs. Review remaining union findings before freezing.')
