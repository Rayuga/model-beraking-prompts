"""Read-only row 24 inspection; not a private checker or configured judge run."""
from pathlib import Path
import copy
import hashlib
import json
import math
import subprocess
import sys
import tomllib
import openpyxl

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/coldwater-2026-10-01-history-hardening-r2'
FROZEN = ROOT / '.qc-cache/coldwater-2026-10-01-history-hardening-r2'
TASK = FROZEN / 'task'
TEMPLATE = FROZEN / 'rules/projects/webdev-task-template'
OUT = Path(__file__).resolve().parent
EXPECTED = {'gates/constraints', 'gates/render', 'scored/functional', 'scored/polish', 'scored/visual'}

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def check(rel, data, prompt):
    judge = data['judge']
    assert judge['mode'] == 'batched'
    assert type(judge['timeout']) in (int, float) and judge['timeout'] > 0
    assert type(judge['isolated']) is bool
    assert judge['judge'] == 'claude-code'
    assert not {'model', 'reasoning_effort', 'temperature', 'weight'} & judge.keys()
    assert isinstance(judge['prompt_template'], str) and '{criteria}' in prompt
    assert prompt.count('{app_context}') == 1 and prompt.count('{criteria}') == 1
    assert 'http://localhost:3000' in prompt
    servers = judge['mcp_servers']
    assert len({s['name'] for s in servers}) == len(servers)
    browser = next(s for s in servers if s['name'] == 'playwright')
    assert browser == {'name': 'playwright', 'transport': 'stdio', 'command': 'playwright-mcp',
                       'args': ['--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox']}
    restart = [s for s in servers if s['name'] == 'verifier']
    assert len(restart) == int(rel == 'scored/functional')
    if restart:
        assert restart[0] == {'name': 'verifier', 'transport': 'stdio', 'command': '/usr/local/bin/python3',
                              'args': ['/tests/tools/restart_mcp.py', '$APP_RESTART_HELPER']}
    criteria = data['criterion']
    assert criteria and len({c['id'] for c in criteria}) == len(criteria)
    for c in criteria:
        assert isinstance(c['id'], str) and c['id'].strip()
        assert isinstance(c['name'], str) and c['name'].strip()
        assert c['type'] in ('binary', 'likert')
        assert type(c['weight']) in (int, float) and math.isfinite(c['weight']) and c['weight'] > 0
        assert isinstance(c['description'], str) and c['description'].strip()
        if rel.startswith('gates/'):
            assert c['type'] == 'binary'
        if c['type'] == 'likert':
            assert type(c['points']) is int and c['points'] == 5
    assert data['scoring']['aggregation'] == ('all_pass' if rel.startswith('gates/') else 'weighted_mean')

files = list((TASK / 'tests').glob('*/*/judge.toml'))
assert {str(p.parent.relative_to(TASK / 'tests')).replace('\\', '/') for p in files} == EXPECTED
scoring = tomllib.loads((TASK / 'tests/scoring.toml').read_text())
assert scoring == {'gates': {'render': 0.0, 'constraints': 0.0},
                   'weights': {'functional': 0.6, 'polish': 0.2, 'visual': 0.2},
                   'floors': {'functional': 0.05}}
assert scoring == tomllib.loads((TEMPLATE / 'tests/scoring.toml').read_text())
context = (TASK / 'tests/app_context.md').read_text().strip()
assert all(h in context for h in ['## Application', '## Accounts', '## Key screens'])
shell = (TASK / 'tests/test.sh').read_text()
assert 'export APP_RESTART_HELPER="$LOG_DIR/app-restart.sh"' in shell
assert shell.index('export APP_RESTART_HELPER=') < shell.index('if ! run_suite gates')
assert 'chmod 755 "$LOG_DIR/app-restart.sh"' in shell
assert 'prompt.write_text(prompt.read_text().replace("{app_context}", context))' in shell
assert shell.index('if ! run_suite gates 1500') < shell.index('python3 /tests/tools/score.py') < shell.index('if ! run_suite scored 11100') < shell.rindex('python3 /tests/tools/score.py')
assert 1500 + 11100 < tomllib.loads((TASK / 'task.toml').read_text())['verifier']['timeout_sec']
results = []
for p in sorted(files):
    rel = p.parent.relative_to(TASK / 'tests').as_posix()
    d = tomllib.loads(p.read_text())
    prompt_path = p.parent / d['judge']['prompt_template']
    prompt = prompt_path.read_text()
    check(rel, d, prompt)
    template_data = tomllib.loads((TEMPLATE / 'tests' / rel / 'judge.toml').read_text())
    assert d['judge'] == template_data['judge']
    assert d['scoring'] == template_data['scoring']
    assert d['judge']['timeout'] < (1500 if rel.startswith('gates/') else 11100)
    injected = prompt.replace('{app_context}', context)
    assert '{app_context}' not in injected and '{criteria}' in injected
    substituted = injected.replace('{criteria}', '\n'.join(c['id'] + '\n' + c['description'] for c in d['criterion']))
    assert '{criteria}' not in substituted
    (OUT / (rel.replace('/', '-') + '-context-injected.md')).write_text(injected, encoding='utf-8')
    mutations = []
    for label in ['missing_browser', 'duplicate_id', 'nonpositive_weight', 'missing_criteria_placeholder']:
        bad, bad_prompt = copy.deepcopy(d), prompt
        if label == 'missing_browser': bad['judge']['mcp_servers'] = [s for s in bad['judge']['mcp_servers'] if s['name'] != 'playwright']
        if label == 'duplicate_id': bad['criterion'].append(copy.deepcopy(bad['criterion'][0]))
        if label == 'nonpositive_weight': bad['criterion'][0]['weight'] = 0
        if label == 'missing_criteria_placeholder': bad_prompt = prompt.replace('{criteria}', '')
        try:
            check(rel, bad, bad_prompt)
        except (AssertionError, StopIteration): mutations.append(label)
        else: raise AssertionError('Malformed local fixture was accepted: ' + label)
    results.append({'dimension': rel, 'criteria': len(d['criterion']), 'types': sorted({c['type'] for c in d['criterion']}),
                    'total_criterion_weight': sum(c['weight'] for c in d['criterion']),
                    'schema': 'valid', 'judge_and_aggregation_equal_template': True,
                    'context_injection_and_criteria_slot': 'valid', 'rejected_in_memory_malformed_fixtures': mutations})

index_path = RUN / 'raw-evidence-index.json'
index = json.loads(index_path.read_text())
checked_artifacts = {p: sha(ROOT / p) == expected for p, expected in index['artifacts'].items()}
assert all(checked_artifacts.values())
manifest = json.loads((RUN / 'manifest.json').read_text())
for group in ['task', 'rules']:
    assert all(sha(FROZEN / group / p) == expected for p, expected in manifest['inputs'][group].items())
assert sha(ROOT / 'qc/REVIEW_POLICY.md') == manifest['engine_inputs']['qc/REVIEW_POLICY.md']
workbook_path = FROZEN / 'rules/WebDev Rubrics QC.xlsx'
enumeration = subprocess.run([sys.executable, '-B', str(FROZEN / 'rules/harbor-webdev-rubric-qc/scripts/list_checks.py'),
                              '--workbook', str(workbook_path), '--json'], capture_output=True, check=True)
(OUT / 'workbook-enumeration.json').write_bytes(enumeration.stdout)
wb = openpyxl.load_workbook(workbook_path, data_only=False)
workbook_rows = {}
for name in ['Quality Checks', 'Internal Quality Checks']:
    workbook_rows[name] = [{'cell': c.coordinate, 'value': c.value, 'comment': c.comment.text if c.comment else None}
                            for c in wb[name][25] if c.value is not None or c.comment]
source_paths = [workbook_path, TASK / 'task.toml', TASK / 'tests/scoring.toml', TASK / 'tests/test.sh',
                TASK / 'tests/tools/restart_mcp.py', TASK / 'tests/app_context.md', ROOT / 'qc/REVIEW_POLICY.md',
                FROZEN / 'rules/harbor-webdev-rubric-qc/SKILL.md']
source_paths += list((FROZEN / 'rules/harbor-webdev-rubric-qc/references').glob('*.md'))
source_paths += files + list((TASK / 'tests').glob('*/*/prompt.md'))
source_paths += [TEMPLATE / 'tests/scoring.toml'] + list((TEMPLATE / 'tests').glob('*/*/judge.toml')) + list((TEMPLATE / 'tests').glob('*/*/prompt.md'))
report = {'input_sha256': 'b10dbfae5ccc478c0bc422ac98a58494148a3c9c1df7b5b226d2b3a9a73f8863',
          'scope': 'Manual row-24 structural review with local Python assertions. No private deterministic checker, configured judge, Docker runtime, Oracle, or model grade executed.',
          'workbook_rows': workbook_rows, 'dimensions': results, 'scoring': scoring,
          'helper_export_precedes_suites': True, 'local_context_substitution': 'valid',
          'frozen_task_rules_and_current_review_policy_match_manifest': True,
          'raw_index_sha256': sha(index_path), 'raw_artifact_hashes_checked': len(checked_artifacts),
          'raw_artifact_hashes_match': all(checked_artifacts.values()),
          'source_sha256': {p.relative_to(ROOT).as_posix(): sha(p) for p in source_paths},
          'limits': ['Context insertion reproduces test.sh replacement in memory; criteria-slot replacement verifies reachability without claiming RewardKit execution.',
                     'Indexed browser artifacts are not used as grading/runtime evidence for this structural row.']}
(OUT / 'structural-review.json').write_text(json.dumps(report, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')
print(json.dumps({'dimensions': results, 'raw_artifact_hashes_checked': len(checked_artifacts), 'status': 'structural assertions passed'}, indent=2))
