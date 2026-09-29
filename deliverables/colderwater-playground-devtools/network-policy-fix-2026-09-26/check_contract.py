"""Read-only contract audit for the frozen Colderwater rubric revision.

This checks authoring invariants, not the private platform rubric or an Oracle.
Run from any directory with the repository's Python 3.11+ interpreter.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import tomllib


OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/colderwater-playground-devtools'
TEMPLATE = ROOT / 'projects/webdev-task-template'
checks = []


def read(path):
    return path.read_text(encoding='utf-8')


def toml(path):
    return tomllib.loads(read(path))


def check(name, passed, detail):
    checks.append({'name': name, 'passed': bool(passed), 'detail': detail})


def scan_module(filename):
    path = ROOT / 'scripts' / filename
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.scan_task(TASK)


functional = toml(TASK / 'tests/scored/functional/judge.toml')
criteria = functional['criterion']
by_id = {entry['id']: entry for entry in criteria}
descriptions = {key: value['description'] for key, value in by_id.items()}
crosswalk = json.loads(read(OUT / 'criterion-crosswalk.json'))
config = toml(TASK / 'task.toml')
template = toml(TEMPLATE / 'task.toml')
public = [TASK / 'instruction.md', *sorted((TASK / 'environment/instructions').glob('*.md'))]
all_judges = list((TASK / 'tests').rglob('judge.toml'))
all_criteria = [c for path in all_judges for c in toml(path)['criterion']]

check('functional_count_and_weight', len(criteria) == 32 and sum(c['weight'] for c in criteria) == 49.5,
      {'count': len(criteria), 'weight': sum(c['weight'] for c in criteria)})
check('functional_binary_unique', len(by_id) == len(criteria) and all(c['type'] == 'binary' and c['weight'] > 0 for c in criteria),
      '32 distinct positive-weight binary outcomes')
check('all_dimensions_and_criterion_count', len(all_judges) == 5 and len(all_criteria) == 44 and len({c['id'] for c in all_criteria}) == 44,
      {'dimensions': len(all_judges), 'criteria': len(all_criteria)})
cross_new = [item for group in crosswalk['groups'] for item in group['new']]
check('crosswalk_weights_and_partition',
      all(sum(c['weight'] for c in group['new']) == group['old_weight'] for group in crosswalk['groups'])
      and all(by_id[item['id']]['weight'] == item['weight'] for item in cross_new)
      and {item['id'] for item in cross_new}.isdisjoint(crosswalk['unchanged_weight_ids'])
      and {item['id'] for item in cross_new} | set(crosswalk['unchanged_weight_ids']) == set(by_id),
      'Five split groups partition all final criteria with the 19 unchanged-weight IDs')
check('crosswalk_totals', crosswalk['old_functional_count'] == 24 and crosswalk['new_functional_count'] == 32
      and crosswalk['old_functional_weight'] == crosswalk['new_functional_weight'] == 49.5,
      '24 -> 32; 49.5 -> 49.5')
check('canonical_task_profile', set(config) == set(template)
      and all(set(config[section]) == set(template[section]) for section in ('task', 'metadata'))
      and all(config[section] == template[section] for section in ('agent', 'environment', 'verifier'))
      and config['schema_version'] == template['schema_version'] and config['artifacts'] == template['artifacts'],
      'Task/metadata keys and frozen runtime, timeout and verifier environment profile match current template')
policy = toml(TASK / 'tests/scoring.toml')
check('canonical_score_policy', policy == {'gates': {'render': 0.0, 'constraints': 0.0},
      'weights': {'functional': 0.6, 'polish': 0.2, 'visual': 0.2}, 'floors': {'functional': 0.05}}, policy)
check('judge_budget_and_metadata', functional['judge']['timeout'] == 9000
      and '32 binary functional criteria' in config['metadata']['difficulty_explanation']
      and '49.5' in config['metadata']['difficulty_explanation'], '9000-second budget unchanged; metadata agrees')
check('public_scope_and_seed', len(public) == 7 and (TASK / 'environment/assets/seed_data.json').is_file(),
      {'public_files': len(public), 'canonical_seed_exists': True})
for filename, output in [('check_public_criterion_ids.py', 'public-id-check.json'),
                         ('check_public_grader_terms.py', 'public-grader-term-check.json')]:
    result = scan_module(filename)
    (OUT / output).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    check(filename, result['passed'], {key: value for key, value in result.items() if key != 'matches'})
initial = descriptions['initial_examples']
overview = read(TASK / 'environment/instructions/overview.md')
check('startup_and_gate_state', 'automatically' in initial and 'gate may already have saved a record' in initial
      and 'do not require an empty library' in initial and "library doesn't have to be empty" in overview,
      'Useful automatic startup without an empty-library premise; existing gate record preserved')
unsupported = descriptions['cw_unsupported_execution_refusal']
check('all_unsupported_families_with_control', all(s in unsupported for s in ["eval('1 + 1');", "new Function('return 2')();",
      'new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]))', "new Worker('data:text/javascript,postMessage(1)')",
      "import('data:text/javascript,export const answer = 1')", 'strings, comments and HTML text', 'separate probe', 'recovery']),
      'Five bounded families, legitimate-text control and normal recovery; no generated runaway code')
network = descriptions['cw_preview_network_requests_blocked']
check('network_probe_independent_control_and_operations', all(s in network for s in ['about:blank', 'Access-Control-Allow-Origin: *',
      'handler deliveries', 'SEPARATE authored run', 'EXACT text URL', 'EXACT SVG URL', 'must not increase',
      'Caught errors need not roll back', 'Remove the exact browser route handler', 'representative fetch and image']),
      'Locally routed known-good resources; two independent authored negative runs; visible outcome and recovery')
origin = descriptions['cw_preview_origin_isolation']
check('origin_reads_and_writes', all(s in origin for s in ['parent.document.title;', "parent.document.title='cw-forbidden-title'",
      'parent.localStorage.getItem', 'parent.localStorage.setItem', 'All four results must be blocked', 'exactly their earlier values']),
      'Read/write document and origin storage with observed host values')
expected_errors = {'cw_js_error_line_and_preview_restore': ('line 4', 'forEeach', 'js-good-preview', 'js-error-recovered'),
    'cw_html_error_document_line_and_preview_restore': ('line 6', 'undefinedFunctionCall', 'html-good-preview', 'html-error-recovered'),
    'cw_timer_error_line_and_preview_restore': ('line 2', 'async-error-marker', 'timer-good-preview', 'timer-error-recovered'),
    'cw_promise_rejection_line_and_preview_restore': ('line 2', 'promise-error-marker', 'promise-good-preview', 'promise-error-recovered')}
check('independent_exact_error_fixtures', all(all(s in descriptions[key] for s in values) and by_id[key]['weight'] == 1
      for key, values in expected_errors.items()), 'Four independently controlled error paths; authored source lines 4/6/2/2')
rename = descriptions['cw_title_change_uniqueness']
stale = descriptions['cw_stale_rename_preserves_newer_record']
check('title_boundary_and_stale_rename_controls', all(s in rename for s in ['CURRENT revision', 'empty title', 'whitespace-only title',
      'qc rename sibling', 'QC Rename Recovered']) and all(s in stale for s in ['advanced revision', 'old snapshot/revision',
      'otherwise valid data', 'QC Stale Rename Recovered', "criterion's own record"]),
      'Current-revision title validation and case-only acceptance; separate stale-rename chain')
dirty = descriptions['cw_dirty_workspace_transition_warnings']
check('all_dirty_workspace_replacements', all(s in dirty for s in ['load QC Dirty Destination', 'choose an app example',
      'start a new draft', 'import a valid source file', 'Cancel', 'Repeat it and accept', 'QC Dirty Title Only',
      'qc-dirty-filename-only.js', 'independently reload Base']), 'Four cancel/accept actions plus title-only and filename-only dirty state')
native = descriptions['cw_native_dirty_leave_warning']
check('native_leave_control_and_branches', all(s in native for s in ['no unsaved change', 'without a dirty-work leave warning',
      'real keyboard edit', 'native leave-page warning', 'Dismiss', 'accept the native warning']),
      'Independent clean control, user interaction, cancel retention and accepted reload')
imported = descriptions['cw_supported_source_file_import']
check('import_execution_and_filename_boundaries', all(s in imported for s in ['import-me.JS', 'Wait two seconds',
      'neither imported marker nor log has executed', 'Click ordinary Run', 'CURRENT revision', 'unsupported.txt',
      'nested/demo.js', 'console.log(\'import-edited-body\');']), 'No execution with auto-run off; supported case; two server filename refusals; recovery')
timer = descriptions['recovery_persistence_chain']
check('shared_budget_distinguishes_reset_bug', all(s in timer for s in ["late-callback-entered", '}, 4000);',
      'eight seconds of the ORIGINAL Run', 'roughly nine seconds', 'do not start the clock at the callback log']),
      'Four seconds pending plus runaway callback; clock begins at Run, not callback')
restart = descriptions['cw_process_restart_durability']
check('restart_independent_setup', all(s.lower() in restart.lower() for s in ["criterion's own durable controls", 'restart_app exactly once',
      'current full list', 'no resurrected QC Restart Deleted', 'advanced revision', 'do not depend on another criterion']),
      'Own primary/copy/deleted setup; one real restart and later mutation; unrelated records retained')
runtime = read(TASK / 'environment/instructions/integration.md')
check('published_runtime_contract', all(s in runtime for s in ['TypeScript, React and Vite', 'Node.js, Express and SQLite',
      'node /app/server.js', '0.0.0.0:3000', '/app/public/index.html', 'GET /api/health', '/app/app.db', 'DB_PATH',
      'complete process restart', "can't depend on /assets or /instructions", 'compiled application scripts and styles']),
      'All setup requirements live in integration; architecture claims need structural checks, not browser inference')

owned_sources = [*public, TASK / 'tests/scored/functional/judge.toml', TASK / 'task.toml']
hashes = {path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in owned_sources}
result = {'task': TASK.name, 'scope': 'Read-only frozen-contract regression audit, not complete platform QC or a paid Oracle',
          'passed': all(c['passed'] for c in checks), 'check_count': len(checks), 'checks': checks,
          'owned_source_sha256': hashes}
(OUT / 'contract-checks.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': result['passed'], 'checks': len(checks), 'failed': [c for c in checks if not c['passed']],
                  'source_files_hashed': len(hashes)}, indent=2))
raise SystemExit(0 if result['passed'] else 1)
