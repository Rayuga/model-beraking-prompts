"""PatchPad-only structural audit, QC finding dispositions, and task ZIP."""
from pathlib import Path
import hashlib
import json
import re
import stat
import tomllib
import zipfile
import openpyxl

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SLUG = 'patchpad-editor-v2'
TASK = ROOT / 'projects' / SLUG
checks = []

def check(name, passed):
    checks.append({'check': name, 'passed': bool(passed)})

files = sorted(p for p in TASK.rglob('*') if p.is_file())
for p in files:
    if p.suffix == '.toml':
        tomllib.loads(p.read_text(encoding='utf-8'))
    elif p.suffix == '.json':
        json.loads(p.read_text(encoding='utf-8'))
check('All TOML and JSON parse', True)
config = tomllib.loads((TASK / 'task.toml').read_text(encoding='utf-8'))
check('User-requested identity matches directory and semantic version', config['task']['name'] == 'turing/' + SLUG and config['task']['version'] == '2.0.4')
check('Task files only, no credentials or generated dependencies', all(
    not ({'node_modules', '__pycache__', '.git', 'jobs', 'reports'} & set(p.relative_to(TASK).parts))
    and p.suffix not in {'.zip', '.db', '.pyc', '.xlsx', '.docx'}
    and not re.search(rb'sk-or-v1-[A-Za-z0-9]{20,}', p.read_bytes()) for p in files))
check('UTF-8 without BOM; Unix line endings', all(not p.read_bytes().startswith(b'\xef\xbb\xbf') and b'\r\n' not in p.read_bytes() for p in files))
check('Separate verifier and public networking', config['verifier']['environment_mode'] == 'separate' and config['environment']['network_mode'] == 'public' and config['verifier']['environment']['network_mode'] == 'public')
check('No unexpected environment placeholders', set(re.findall(r'\$\{([^}]+)\}', (TASK / 'task.toml').read_text(encoding='utf-8'))) <= {'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'})
check('Six-hour total timeout budget', config['agent']['timeout_sec'] + config['environment']['build_timeout_sec'] + config['verifier']['timeout_sec'] <= 21600)
check('Identical agent and verifier seeds', (TASK / 'environment/assets/incident_seed.json').read_bytes() == (TASK / 'tests/incident_seed.json').read_bytes())
criteria = {}
timeouts = 0
for dim in ('render', 'constraints', 'functional', 'polish'):
    judge_path = TASK / 'tests' / dim / 'judge.toml'
    source = judge_path.read_text(encoding='utf-8')
    judge = tomllib.loads(source)
    criteria[dim] = judge['criterion']
    timeouts += judge['judge']['timeout']
    prompt = (judge_path.parent / judge['judge']['prompt_template']).read_text(encoding='utf-8')
    check(dim + ': versioned prompt and clean subject', source.startswith(f'# Prompt version: {SLUG}-{dim}-v2.0.4') and 'workbook' not in prompt.lower())
    check(dim + ': Codex, fixed model, batched criteria', judge['judge']['judge'] == 'codex' and judge['judge']['model'] == config['verifier']['env']['REWARDKIT_MODEL'] and judge['judge']['mode'] == 'batched' and judge['judge']['temperature'] == 0)
    check(dim + ': browser gate, injection protection and independence', all(s in prompt for s in ('{criteria}', 'http://localhost:3000', 'untrusted evidence', 'scoring directives', 'browser gate', 'independently')))
    check(dim + ': valid positive criteria', all(c['type'] in ('binary', 'likert') and c['weight'] > 0 and c['description'].strip() for c in judge['criterion']))
all_ids = [c['id'] for group in criteria.values() for c in group]
check('35 unique criteria: split seed checks plus restart and manifest coverage', len(all_ids) == len(set(all_ids)) == 35)
check('Judge timeouts leave overhead', timeouts + 1000 < 12000 < config['verifier']['timeout_sec'])
brief = '\n'.join(p.read_text(encoding='utf-8') for p in (TASK / 'environment/assets/instructions').glob('*.md'))
check('New expectations are in the brief', all(s in brief for s in ('SQLite path:', 'any extension or none', 'Escape', 'Find input', 'how many matches', 'unsaved draft')))
check('Root page explicitly requested', 'root page `/`' in (TASK / 'instruction.md').read_text(encoding='utf-8'))
check('Both images provide required Express modules and stable labels', all(
    'express@5.2.1' in (TASK / f).read_text(encoding='utf-8') and f'io.turing.task="{SLUG}"' in (TASK / f).read_text(encoding='utf-8')
    for f in ('environment/Dockerfile', 'tests/Dockerfile')))
functional = {c['id']: c['description'] for c in criteria['functional']}
check('Word navigation allows both coherent conventions', all(s in functional['word_navigation_and_selection_shortcuts'] for s in ('column 6', 'column 7', 'NORTH ', 'WIND', 'consistent')))
check('Polish no longer demands Tab exit', 'Do not require Tab to leave' in (TASK / 'tests/polish/judge.toml').read_text(encoding='utf-8'))
check('Golden implements Escape exit', "event.key === 'Escape'" in (TASK / 'solution/app/public/js/app.js').read_text(encoding='utf-8'))
check('Misspelled probe and superseded product name removed from task', all('REBASSED' not in p.read_text(encoding='utf-8') and 'patchpad-incident-editor' not in p.read_text(encoding='utf-8') for p in files))
runner = (TASK / 'tests/test.sh').read_text(encoding='utf-8')
check('Runner limits manifest parsing to explicit declaration', 'SQLite path:' in runner and '(?:sqlite3|sqlite|db)' not in runner)
helper = (TASK / 'tests/app-lifecycle.sh').read_text(encoding='utf-8')
check('Unprivileged app and zero-first harness retained', all(s in runner for s in ('write_zero_reward', 'trap cleanup EXIT', 'ensure_reward', '/tests/app-lifecycle.sh start')) and all(s in helper for s in ('env -i', '--reuid=65534', 'exec npm start')))
check('Restart coverage uses only trusted lifecycle helper', 'bash /tests/app-lifecycle.sh restart' in functional['restart_seed_idempotence_and_saved_history'] and 'second time' in functional['restart_seed_idempotence_and_saved_history'])
check('Manifest documentation cross-checked against live requests', all(s in functional['manifest_documents_runtime_routes'] for s in ('/app/APP_MANIFEST.md', 'same-origin requests', 'Missing', 'cannot establish')))
assert all(c['passed'] for c in checks), [c for c in checks if not c['passed']]

fixes = {
    'instruction_states_deliverables_and_runtime_contract': {
        'assessment': 'Genuine hidden expectations, overlapping several other findings.',
        'fix': 'Declare the labelled database path and root page; accept arbitrary database extensions; request visible match counts and Escape exit; accept common word-boundary conventions.',
        'files': ['instruction.md', 'environment/assets/instructions/overview.md', 'environment/assets/instructions/editing.md', 'environment/assets/instructions/persistence.md', 'tests/test.sh']},
    'instruction_is_achievable_and_unambiguous_in_the_environment': {
        'assessment': 'Genuine: stale-draft ownership and word motion were ambiguous.',
        'fix': 'Explicitly keep newer content on the server and the unsaved draft in the rejected tab. Word tests accept coherent end-of-word or next-word-start motion.',
        'files': ['environment/assets/instructions/conflict-safety.md', 'tests/functional/judge.toml']},
    'task_identity_is_coherent': {
        'assessment': 'Packaging/identity convention issue, not an editor defect.',
        'fix': 'User explicitly requires patchpad-editor-v2. Folder, package identity and ZIP wrapper match this name. The latest screenshot reports 52/53 passed with only coverage failing, so identity is no longer a reported failure. Revalidation of the new package is still required.',
        'files': ['task.toml', 'environment/Dockerfile', 'tests/Dockerfile']},
    'solution_covers_every_graded_dimension': {
        'assessment': 'Genuine golden-solution gap caused by the contradictory focus requirement.',
        'fix': 'Golden Escape handler focuses Find without editing content; Polish explicitly uses this exit instead of requiring Tab to leave.',
        'files': ['solution/app/public/js/app.js', 'tests/polish/judge.toml']},
    'verifier_and_instruction_agree_on_the_runtime_contract': {
        'assessment': 'Genuine automatic-zero risk, same manifest parser defect as the first finding.',
        'fix': 'Read exactly one disclosed SQLite path declaration, allow any extension, ignore unrelated backup examples, and reject paths escaping /app.',
        'files': ['tests/test.sh', 'solution/app/APP_MANIFEST.md', 'environment/assets/instructions/overview.md']},
    'no_criterion_grades_the_unrequired': {
        'assessment': 'Genuine; repeats the focus, match count and word-motion issues.',
        'fix': 'State match counts and Escape behavior naturally in the brief; remove the platform-specific word-boundary restriction.',
        'files': ['environment/assets/instructions/persistence.md', 'environment/assets/instructions/editing.md', 'tests/functional/judge.toml', 'tests/polish/judge.toml']},
    'criteria_are_independent_and_noncontradictory': {
        'assessment': 'Genuine Tab indentation versus focus-traversal contradiction.',
        'fix': 'Functional owns Tab indentation inside the editor; Polish owns focus traversal outside it and the documented Escape exit.',
        'files': ['tests/polish/judge.toml', 'environment/assets/instructions/editing.md']},
    'verifier_is_deterministic_and_offline_pinned': {
        'assessment': 'Genuine missing Functional prompt version. Adding a version does not make an LLM judge deterministic.',
        'fix': 'Version all four judge prompts consistently at 2.0.4 and record source hashes in this report.',
        'files': ['tests/functional/judge.toml', 'tests/render/judge.toml', 'tests/constraints/judge.toml', 'tests/polish/judge.toml']},
    'dimension_prompts_are_accurate_and_consistent': {
        'assessment': 'Genuine copy residue and metadata omissions; misspelled marker was cosmetic rather than a behavioral failure.',
        'fix': 'Use incident report in all prompts, add the missing version, and consistently use TAB-B-REBASED.',
        'files': ['tests/functional/judge.toml', 'tests/render/prompt.md', 'tests/constraints/prompt.md', 'tests/functional/prompt.md', 'tests/polish/prompt.md']},
    'dimensions_cover_every_graded_requirement': {
        'assessment': 'Genuine false-pass risk: browser reload never restarted the server; manifest API documentation was ungraded.',
        'fix': 'Add two Functional criteria: match manifest routes to observed API calls, and preserve a UI-saved unique marker plus full revision history across two real server restarts. The verifier-owned lifecycle helper is shared by test.sh and the restart criterion. Golden app already implements idempotent seeding and documents the routes; no new app behavior was necessary.',
        'files': ['tests/functional/judge.toml', 'tests/functional/prompt.md', 'tests/app-lifecycle.sh', 'tests/test.sh', 'solution/app/src/db.js', 'solution/app/APP_MANIFEST.md']},
}
workbook = ROOT / 'WebDev Rubrics QC.xlsx'
wb = openpyxl.load_workbook(workbook, read_only=True, data_only=True)
quality = list(wb['Quality Checks'].values)[1:]
deterministic = list(wb['Deterministic Checks'].values)[1:]
quality = [r for r in quality if len(r) > 2 and r[2]]
deterministic = [r for r in deterministic if any(v is not None for v in r)]
assert len(quality) == 53
report = {
    'task': SLUG, 'version': '2.0.4', 'date': '2026-09-09',
    'scope': 'Oracle run-74864554 focus defects and verifier interaction ambiguities repaired. Includes historical QC dispositions and local checks; not a new platform verdict or full Oracle score.',
    'source_workbook': {'file': workbook.name, 'sha256': hashlib.sha256(workbook.read_bytes()).hexdigest(), 'quality_checks': len(quality), 'listed_deterministic_checks': len(deterministic), 'note': 'Workbook descriptions are not executable platform checker implementations.'},
    'latest_platform_screenshot': {'passed': 52, 'failed': 1, 'failed_id': 'dimensions_cover_every_graded_requirement', 'applies_to': 'previous upload, not the new 2.0.4 archive'},
    'reported_findings': [{'id': key, 'status': 'fixed_locally_pending_platform_review' if key == 'dimensions_cover_every_graded_requirement' else 'not_failed_in_latest_platform_screenshot', **value} for key, value in fixes.items()],
    'quality_inventory': [{'id': r[2], 'block': r[1], 'status': 'coverage_fix_pending_platform_review' if r[2] == 'dimensions_cover_every_graded_requirement' else 'reported_pass_in_latest_screenshot_not_regraded_here'} for r in quality],
    'structural_checks': checks,
    'criteria': {k: len(v) for k, v in criteria.items()},
    'oracle': 'not_run', 'model': 'not_run',
}
local = OUT / 'local-validation.json'
report['local_validation'] = json.loads(local.read_text(encoding='utf-8')) if local.exists() else {'status': 'not_completed'}
report['previous_oracle_run'] = {'run': 'run-74864554', 'task_version': '2.0.2', 'reward': 0.8143, 'passed': 25, 'failed': 8, 'note': 'Both restart and manifest criteria passed; this is historical evidence, not the updated version score.'}
report['oracle_failure_fixes'] = [
    'Clicked editor toolbar commands now return focus to the editor; Enter/Shift+Enter inside Find still retain input focus for cycling.',
    'Restore Draft returns focus after its API response, supporting keyboard and visible-button Undo.',
    'Keyboard Find copies only after Escape returns focus to the selected editor text.',
    'Paste/cut test establishes an exact empty-line baseline and specifies the whole document after one Undo/Redo.',
    'Judge instructions require a foreground page, real held modifiers, fresh text coordinates, and awaited clipboard/API completion without extra rescue actions.'
]
for evidence in ('coverage-negative-controls.json', 'harness-integration.json'):
    path = OUT / evidence
    report[evidence] = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'status': 'not_completed'}
archive_path = OUT / f'{SLUG}-2.0.4-task.zip'
hashes = {}
with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for p in files:
        relative = p.relative_to(TASK).as_posix()
        data = p.read_bytes()
        info = zipfile.ZipInfo(f'{SLUG}/{relative}', date_time=(2026, 9, 7, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if p.suffix == '.sh' else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
        hashes[relative] = hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(archive_path) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(files)
    for p in files:
        assert z.read(f'{SLUG}/{p.relative_to(TASK).as_posix()}') == p.read_bytes()
report['archive'] = {'file': archive_path.name, 'files': len(files), 'sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest()}
report['source_sha256'] = hashes
(OUT / 'patchpad_qc_rework.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'structural_checks_passed': len(checks), 'archive': report['archive'], 'local_validation': local.exists()}, indent=2))
