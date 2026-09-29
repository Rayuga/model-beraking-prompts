from pathlib import Path
from decimal import Decimal
import hashlib
import json
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'deliverables/colderwater-playground-devtools/coverage-fix-2026-09-27/review-candidate/colderwater-playground-devtools.zip'
BASE = ROOT / 'deliverables/colderwater-playground-devtools/positive-controls-fix-2026-09-27/review-candidate/colderwater-playground-devtools.zip'
EXPECTED = 'f86708344b0861aad8a48049996c7b72266c29d6d68bf377358a0c5810aad6ae'
assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == EXPECTED
assert hashlib.sha256(BASE.read_bytes()).hexdigest() == '663e4d6df66f951662e13d4a365cd2c72f83fba29c9e42998b58cd2bf023013e'

def contents(path):
    prefix = 'colderwater-playground-devtools/'
    with zipfile.ZipFile(path) as z:
        return {n[len(prefix):]: z.read(n) for n in z.namelist() if n.startswith(prefix) and not n.endswith('/')}

files, prior = contents(ARCHIVE), contents(BASE)
JUDGE = 'tests/scored/functional/judge.toml'
PROMPT = 'tests/scored/functional/prompt.md'
CONTEXT = 'tests/app_context.md'
rows = tomllib.loads(files[JUDGE].decode())['criterion']
old = tomllib.loads(prior[JUDGE].decode())['criterion']

def groups(criteria):
    result = {}
    for row in criteria:
        key = row['description'].split('.', 1)[0]
        result[key] = result.get(key, Decimal(0)) + Decimal(str(row['weight']))
    return result

before, after = groups(old), groups(rows)
assert len(rows) == len({r['id'] for r in rows}) == 93
assert before == after and len(after) == 37 and sum(after.values()) == Decimal('49.50')
assert all(r['type'] == 'binary' and Decimal(str(r['weight'])) > 0 for r in rows)
changed_files = [name for name in sorted(files) if files[name] != prior.get(name)]
assert changed_files == sorted([JUDGE, PROMPT, CONTEXT])
assert set(files) == set(prior)
for name in [JUDGE, PROMPT, CONTEXT]:
    assert (ROOT / 'projects/colderwater-playground-devtools' / name).read_bytes() == files[name]

previous_review = json.loads((ROOT / 'deliverables/colderwater-playground-devtools/last-attempt-review-2026-09-27/semantics.json').read_text(encoding='utf-8'))
refs = {r['scenario']: r['public_refs'] for r in previous_review['all_88_row_ledger']}
old_by_id = {r['id']: r for r in old}
lines = files[JUDGE].decode().splitlines()
ledger = []
new_or_changed = []
for row in rows:
    scenario = row['description'].split('.', 1)[0]
    changed = old_by_id.get(row['id']) != row
    if changed:
        new_or_changed.append(row['id'])
    line = next(i + 1 for i, s in enumerate(lines) if s == 'id = ' + json.dumps(row['id']))
    ledger.append({
        'id': row['id'], 'weight': str(Decimal(str(row['weight']))), 'type': row['type'],
        'scenario': scenario, 'public_refs': refs[scenario], 'criterion_ref': JUDGE + ':' + str(line),
        'description': row['description'], 'changed_from_663e': changed,
        'source_review': 'Directly reviewed changed description and complete changed protocol' if changed else 'Unchanged description byte/content bound to cold-read 663e; checked against changed shared contract and scenario dependencies',
        'runtime_status': 'See focused proof review; no per-row provider or full-runtime verdict inferred'
    })

resolved = [
    {'id': 'C1-global', 'old_gap': 'Old global was checked only after a later JavaScript Run.', 'owners': ['cw_css_global_freshness'], 'refs': [JUDGE+':85', PROMPT+':137', PROMPT+':140', PROMPT+':150', PROMPT+':152', CONTEXT+':34'], 'new_evidence': 'Observe the assigned authored value in its actual control execution realm; during CSS, before another JS Run, observe absence in the matched current realm or destruction plus matched fresh context.', 'wrong_witness_now_distinguishable': 'Reusing the old Window while cloning DOM and dropping handlers leaves oldGlobal present in the current CSS realm, producing ordinary no.', 'valid_alternatives': 'No iframe/worker requirement; unrelated frames and failed reads do not establish absence. Genuine unmatched-realm observation is incomplete after one bounded retry, only with the real current CSS target present. Wrong colour is independent.'},
    {'id': 'C1-timer', 'old_gap': 'No timer was seeded and observed across a CSS replacement.', 'owners': ['cw_css_pending_timer_cancelled'], 'refs': [JUDGE+':92', PROMPT+':175', PROMPT+':177'], 'new_evidence': 'A button timer first actually fires and commits; a second genuinely pending timer is replaced by CSS before due, then observed beyond due with current CSS document and ordinary recovery.', 'wrong_witness_now_distinguishable': 'An old second callback that adds its scheduled DOM/log/status after CSS is observed and fails; a dead timer cannot establish suppression because the first callback must actually fire.', 'valid_alternatives': 'HTML-to-JS setup fallback, hidden pending candidate, static CSS copy and retained history are valid. First start marker is console-only; fired marker is DOM plus console.'},
    {'id': 'C2-rename', 'old_gap': 'A stale API replay had no dirty editor to preserve.', 'owners': ['cw_stale_rename_refusal', 'cw_stale_rename_draft_recovery'], 'refs': [JUDGE+':463', JUDGE+':470', PROMPT+':449', PROMPT+':451', PROMPT+':452', PROMPT+':453', PROMPT+':454'], 'new_evidence': 'Two real editors; all three dirty fields recorded before A advances revision; B actual conflict/prevention and exact retention; deliberate latest/reapply/current-Save readback. Actual server refusal/nonmutation and current Rename recovery retain their separate result.', 'wrong_witness_now_distinguishable': 'A Rename conflict handler that clears/refetches B while its server refuses loses draft credit but can retain separately proved server credit.', 'valid_alternatives': 'Proactive conflict detection or explained prevention while dirty; no forced disabled action, prescribed dialog or recovery button. User-entered rename target is recorded as the intended draft before submission.'},
    {'id': 'C2-delete', 'old_gap': 'A stale Delete replay had no dirty editor to preserve.', 'owners': ['cw_stale_delete_refusal', 'cw_stale_delete_draft_recovery'], 'refs': [JUDGE+':512', JUDGE+':519', PROMPT+':478', PROMPT+':480', PROMPT+':481', PROMPT+':482', PROMPT+':483'], 'new_evidence': 'Separate live A/B target and successful current Delete control; B conflict/prevention retains exact dirty fields and permits deliberate latest/reapply. Server replay/nonmutation/current Delete recovery are independent.', 'wrong_witness_now_distinguishable': 'A Delete conflict handler that drops B\'s draft while the server correctly refuses loses the draft row only; cancelling a confirmation does not count as stale-conflict evidence.', 'valid_alternatives': 'Explained prevention while dirty and proactive conflict detection are valid; confirmation presence is owned elsewhere. Current server recovery still proceeds if draft retention failed.'},
    {'id': 'C3-import', 'old_gap': 'Only JS/JS-uppercase was imported; HTML/CSS support could be absent.', 'owners': ['cw_supported_file_import'], 'refs': [JUDGE+':568', PROMPT+':526', PROMPT+':529', PROMPT+':530', PROMPT+':538'], 'new_evidence': 'Lowercase JS, HTML and CSS each have exact immediate import readback, a valid own-language edit, ordinary Save and reload under the recorded identity. No additional HTML/CSS execution prerequisite.', 'wrong_witness_now_distinguishable': 'The JS-only importer now fails the actual HTML/CSS upload observations, regardless of working manual language dispatch.', 'valid_alternatives': 'Actual supplied file text defines newline fidelity; no particular input element attributes, routes, line-ending convention or editor package are demanded. Continue other formats after a failure.'},
    {'id': 'N1-case', 'old_gap': 'Import-case and server-case handling shared one binary result.', 'owners': ['cw_import_extension_case', 'cw_saved_filename_extension_case'], 'refs': [JUDGE+':603', JUDGE+':610', PROMPT+':540'], 'new_evidence': 'Both layers separately observe uppercase JS, HTML and CSS. A valid independent draft supplies server-case evidence if uppercase import fails.', 'wrong_witness_now_distinguishable': 'An importer-only uppercase defect and a server-only uppercase defect receive different independent results rather than both losing the combined row.', 'valid_alternatives': 'No extra execution or special request schema; valid current writes use observed formats and revisions. Lowercase fallback prevents cascading failure.'}
]

runtime_path = OUT / 'runtime_proof_review.json'
runtime = json.loads(runtime_path.read_text(encoding='utf-8')) if runtime_path.exists() else {
    'status': 'Pending focused reference/mutant proof review', 'provider_run': False,
    'note': 'Protocol source review is complete. Runtime artifacts are not yet claimed as passes.'
}
runtime_owners = {
    'cw_css_global_freshness': 'CSS global reference/mutant comparison and exact-recipe MCP proof',
    'cw_css_pending_timer_cancelled': 'CSS pending timer reference/mutant comparison',
    'cw_stale_rename_refusal': 'Live Rename reference/mutant server refusal and nonmutation',
    'cw_stale_rename_draft_recovery': 'Live Rename reference/mutant exact dirty fields and deliberate recovery',
    'cw_stale_delete_refusal': 'Live Delete reference/mutant server refusal and nonmutation',
    'cw_stale_delete_draft_recovery': 'Live Delete reference/mutant exact dirty fields and deliberate recovery',
    'cw_supported_file_import': 'Three lowercase formats, reference and JS-only importer mutant',
    'cw_import_extension_case': 'Three uppercase imports, reference and JS-only importer mutant',
    'cw_saved_filename_extension_case': 'Three uppercase current saves including independent fallback after refused imports'
}
for item in ledger:
    item['focused_runtime_evidence'] = runtime_owners.get(item['id'])
    item['runtime_status'] = ('Focused proof artifacts independently reviewed; no provider verdict inferred' if item['id'] in runtime_owners and runtime_path.exists() else 'Not newly runtime-tested by this coverage review; no pass inferred')
result = {
    'review': 'Independent bounded semantic review of coverage repair',
    'archive_sha256': EXPECTED, 'archive': str(ARCHIVE.relative_to(ROOT)).replace('\\', '/'),
    'source_hashes': {name: hashlib.sha256(files[name]).hexdigest() for name in [JUDGE, PROMPT, CONTEXT]},
    'all_archive_file_hashes': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())},
    'baseline_archive_sha256': hashlib.sha256(BASE.read_bytes()).hexdigest(),
    'changed_files': changed_files, 'public_and_golden_files_unchanged': True,
    'rows': len(rows), 'weight': str(sum(after.values())), 'all_37_feature_budgets_unchanged': before == after,
    'feature_subtotals': {k: str(v) for k,v in sorted(after.items())},
    'new_or_changed_rows': new_or_changed, 'all_93_row_ledger': ledger,
    'source_disposition': 'The concrete C1-C3 coverage gaps and N1 case-layer bundle are addressed by actual required observations; no further concrete P1 defect found in the changed protocols.',
    'resolved_findings_source': resolved, 'runtime_proof_review': runtime,
    'corrections_during_review': [
        'Timer start-1 was ambiguous as DOM plus console; corrected to console-only, followed by fired-1 in DOM plus console, matching authored source.',
        'S02 incomplete branch now requires a real current CSS target and excludes missing action, blank/missing target and observed runtime failure. Separate colour correctness is not a prerequisite.'
    ],
    'preserved_prior_protections': [
        'Mandatory meaningful positive controls are shared facts, never inherited sibling verdicts; CSS live button and enabled Auto-run controls remain explicit.',
        'Candidate preview display remains optional; blocked/ignored pending input and static restored snapshots remain valid.',
        'S04 JS-global setter/B evidence remains separate from CSS absence and cancellation timing.',
        'Completed-preview Stop, successful-interaction latest rollback, padded title trimming and immutable built-in example copies remain intact.',
        'Conditional baselines, HTML-to-JS CSS setup, Shift+Tab manual-indent fallback and Clear-shortcut ordinary-Run fallback remain intact.',
        'Restart remains early and once; shared fixtures do not inherit verdicts or alter unrelated saved records.',
        'S06 ordered terminal privacy decisions, denial precedence, public-role exception and source/database-body ban are unchanged.',
        'All public requirements, Golden files, provider/model/timeouts, gates, dimension formula, public networking and remaining task files are byte-identical to663e.'
    ],
    'qc_26_33_scoped_review': {
        '26': 'C1 globals/timer, C2 both dirty operation flows and C3 format support now have direct required evidence. Internal-stack and invisible-backend-evaluation limits remain disclosed, not claimed proved.',
        '27': 'No new concrete hidden product obligation found after explicitly preserving alternate realms, dirty-action prevention, independent colour attribution and ordinary recovery controls.',
        '28': 'New independent outcomes have separate weights and reused setup; server/draft and import/server-case ownership are explicit. Required controls do not inherit another complete verdict.',
        '29': 'All gates and scored-dimension gate wording are preserved; no new app-wide networking or same-origin restriction.',
        '30': 'Globals have actual assigned-value control; timer fires once before suppression; each stale operation has real current acceptance plus dirty state; all imports have actual accepted file/edit/readback.',
        '31': 'Three supported lowercase and uppercase file formats are explicit; each named stale operation is independently observed. Existing whole-list and nine-path guards remain.',
        '32': 'New outcomes use authored browser state and real UI/data effects. The S02 unmatched-realm branch is a disclosed permitted-observation limit, not a platform-acceptance guarantee.',
        '33': 'The two newly found textual ambiguities are fixed. Product failure and permitted-observation incomplete branches are explicitly separated; sibling style results do not control global attribution.'
    },
    'remaining_limits': [
        'A valid virtual execution architecture can still make the authored realm unavailable to permitted browser observation. The explicit incomplete branch avoids fabricated absence or architecture-specific failure; it does not guarantee evaluation completion for every architecture.',
        'Browser traces cannot prove invisible discarded backend evaluation, every internal named technology or all private-file paths. No implementation-source inspection has been substituted.',
        'Literal-loop, callback, error, network, filename and UI probes remain finite representatives; no exhaustive syntax/attack/input guarantee follows.',
        'Approximately nine seconds of dedicated CSS timer waiting plus actions/three Runs were added. Added end-to-end UI latency, full Functional timeout fit and Oracle/provider score remain unmeasured.',
        'This review is not a prediction that the private platform checker or an LLM judge will accept the artifact.'
    ],
    'task_edits_by_reviewer': False, 'provider_calls_by_reviewer': False, 'all_qc_pass_claim': False
}

md = f'''# Coverage repair: independent semantic review

**Source review complete:** the concrete CSS-state, stale Rename/Delete draft and supported-import gaps now have direct required observations. The cross-layer uppercase bundle is split. No further concrete P1 defect was found in the changed protocols after two narrow wording corrections. This is not an all-QC-pass or provider-acceptance guarantee.

Frozen archive SHA-256: `{EXPECTED}`. There are **93 binary Functional rows**, total **49.50**, and all **37 original shared-feature subtotals are unchanged**. Only Functional `judge.toml`, Functional `prompt.md` and shared `app_context.md` differ from `663e`. Public requirements, Golden files and remaining task files are byte-identical.

The companion JSON binds all archive files, the actual three edited source files, and every one of the 93 row descriptions/weights/public mappings. Changed rows and complete changed protocols were read directly; unchanged descriptions were matched to the earlier cold-read artifact and checked against the new shared wording. No historical runtime Pass was inherited.

| Resolved source gap | Required observation and attribution |
|---|---|
'''
for item in resolved:
    md += f"| {item['id']} | {item['new_evidence']} |\n"
md += '\n## Counterexamples and valid alternatives\n'
for item in resolved:
    md += f"\n**{item['id']}.** {item['wrong_witness_now_distinguishable']} {item['valid_alternatives']} References: " + ', '.join('`'+r+'`' for r in item['refs']) + '.\n'
md += '\n## Corrections made by the task owner during review\n\n'
for s in result['corrections_during_review']:
    md += '- ' + s + '\n'
md += '\n## Preserved protections\n\n'
for s in result['preserved_prior_protections']:
    md += '- ' + s + '\n'
md += '\n## QC #26–33 scope\n\n'
for key, value in result['qc_26_33_scoped_review'].items():
    md += f'- **#{key}:** {value}\n'
md += '\n## Focused runtime evidence\n\n'
md += runtime['status'] + '.\n\n'
for summary in runtime.get('case_summaries', []):
    md += '- ' + summary + '\n'
if 'coverage_disposition' in runtime:
    md += '\n' + runtime['coverage_disposition'] + '\n\n'
for limit in runtime.get('limits', []):
    md += '- ' + limit + '\n'
md += 'The reviewer made no provider calls and does not infer an Oracle score from scripted browser or local transport fixtures. The JSON runtime section identifies any separately reviewed proof artifacts. Source remediation and runtime demonstration remain distinct claims.\n'
md += '\n## Remaining limits\n\n'
for s in result['remaining_limits']:
    md += '- ' + s + '\n'
(OUT / 'semantic_review.json').write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
(OUT / 'SEMANTIC_REVIEW.md').write_text(md, encoding='utf-8')
print(json.dumps({'archive': EXPECTED, 'rows': len(rows), 'weight': str(sum(after.values())), 'runtime': runtime['status'], 'files': ['SEMANTIC_REVIEW.md', 'semantic_review.json']}, indent=2))
