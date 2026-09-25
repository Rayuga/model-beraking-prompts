from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import subprocess
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = ROOT / 'reports/common-ground-ballot/2026-09-15-oracle-ready-r15'
TASK = BASE / 'frozen/common-ground-ballot'
DELIVERY = ROOT / 'deliverables/common-ground-ballot/2026-09-15-oracle-ready-r15'
ARCHIVE = DELIVERY / 'common-ground-ballot.zip'
EXPECTED = '1cfa7ce8f032883e18a54ae2975c0a05cf5cdf18c0381c466372e7f5d4ab99b2'


def run(item):
    name, command = item
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
    (OUT / (name + '.log')).write_text(result.stdout + '\n' + result.stderr, encoding='utf-8')
    assert result.returncode == 0, (name, result.stdout[-1500:], result.stderr[-1500:])
    return {'suite': name, 'passed': True, 'output': result.stdout.strip()}


actual = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
assert actual == EXPECTED
with zipfile.ZipFile(ARCHIVE) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == 37
    files = {n.split('/', 1)[1]: z.read(n) for n in z.namelist()}
    for name, data in files.items():
        assert data == (TASK / name).read_bytes()
        assert data == (ROOT / 'projects/common-ground-ballot' / name).read_bytes()
    texts = {name: data.decode('utf-8') for name, data in files.items()}
    judges = {dim: tomllib.loads(texts[f'tests/{dim}/judge.toml']) for dim in ['render', 'constraints', 'functional', 'polish', 'visual']}
    ids = {dim: {c['id'] for c in config['criterion']} for dim, config in judges.items()}
    obsolete = ['same_origin_shell', 'entrypoint_refresh_usable', 'theme_touch_and_motion_quality', 'public_page_loads']
    for old in obsolete:
        assert not any(old in text for name, text in texts.items() if name.startswith('tests/'))
    assert ids['constraints'] == {'health_endpoint', 'sqlite_persistence'}
    assert ids['render'] == {'workspace_navigation'}
    assert {'theme_switch_preserves_workspace', 'comfortable_touch_targets', 'reduced_motion_preference'} <= ids['polish']
    for dim in ['render', 'constraints']:
        assert judges[dim]['scoring']['aggregation'] == 'all_pass'
        assert judges[dim]['judge']['weight'] > 0
    reward = tomllib.loads(texts['tests/reward.toml'])
    assert reward == {'composition': {'gates': ['render', 'constraints'], 'weighted_dimensions': ['functional', 'polish', 'visual']}, 'reward': [{'name': 'reward', 'aggregation': 'weighted_mean'}]}
    assert 'Public networking is available' in texts['environment/instructions/runtime.md']
    assert 'python3 /tests/score.py' in texts['tests/test.sh']
    assert '0.6' not in texts['tests/test.sh'] and '0.2' not in texts['tests/test.sh']

commands = [
    ('standard', ['python', str(ROOT / 'references/task-templates/check-standard.py'), str(TASK), '--output', str(OUT / 'check-standard.json')]),
    ('archive', ['python', str(ROOT / 'references/task-templates/check-upload.py'), str(ARCHIVE), '--output', str(OUT / 'check-upload.json')]),
    ('scoring', ['docker', 'run', '--rm', '--network', 'none', '--mount', f'type=bind,source={TASK},target=/task,readonly', '--mount', f'type=bind,source={BASE},target=/validation,readonly', '--mount', f'type=bind,source={OUT},target=/results', 'ballot-verifier:20260915-r15-local', 'python3', '/validation/qc-score-regression.py']),
]
with ThreadPoolExecutor(max_workers=3) as pool:
    suites = list(pool.map(run, commands))
scores = json.loads((OUT / 'qc-results.json').read_text(encoding='utf-8'))['results']
assert len(scores) == 103 and all(item['passed'] for item in scores)
specific = {}
for criterion in ['health_endpoint', 'sqlite_persistence', 'workspace_navigation', 'theme_switch_preserves_workspace', 'comfortable_touch_targets', 'reduced_motion_preference']:
    row = next(r for r in scores if r['name'] == 'Individual criterion changes final score: ' + criterion)
    specific[criterion] = {key: row[key] for key in ['dimension_score', 'final_reward']}
assert all(specific[c]['final_reward'] == 0 for c in ['health_endpoint', 'sqlite_persistence', 'workspace_navigation'])
report = {'archive_sha256': actual, 'file_count': len(files), 'criterion_count': sum(map(len, ids.values())),
    'screenshot_file_count': 36, 'screenshot_platform_version': 'v8',
    'screenshot_package_matches_r15': False,
    'identity_note': 'Screenshot refers to obsolete criterion IDs absent from the byte-verified r15 archive and reports a different file count. Truncated platform digest is not treated as a ZIP SHA256.',
    'obsolete_criteria_absent': obsolete, 'source_matches_zip': True, 'suites': suites,
    'single_failure_examples': specific, 'new_task_edits_needed_for_these_findings': False,
    'platform_qc_rerun': False, 'oracle_rerun': False}
(OUT / 'recheck.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
summary = '''# Recheck of the three screenshot QC failures

The supplied screenshot shows platform v8 with 36 files and cites criterion
names that are absent from the current r15 ZIP. The actual ZIP has 37 files;
all of its bytes match the frozen and current project files. These three
source defects are already repaired in r15; no task changes or new checksum
were needed for this recheck.

| Reported issue | Verified r15 correction |
| --- | --- |
| Mandatory constraints had no effect on reward | Health and SQLite are independent all_pass gate criteria. Either failure produces final reward 0. Public networking is permitted by the current brief, so the old no-CDN criterion is removed. |
| Unrelated or duplicate observations were combined | Health and SQLite are separate; theme, touch and reduced motion are separate. The duplicate root-load criterion is gone; Render checks six-workspace navigation. |
| Dimension weights conflicted between files | Numeric dimension weights exist only in judge TOMLs. reward.toml declares the named aggregate and composition roles; score.py reads those weights. The runner contains no hardcoded 60/20/20 coefficients. |

The recheck passed 147 standard checks, 400 archive checks and 103 actual
RewardKit/scorer regressions with synthetic criterion verdicts. They include
independent failures for all six criteria relevant to this screenshot.
No platform QC, Oracle or model run was performed by this recheck.

Upload the r15 common-ground-ballot.zip as a new platform task version and run
QC there, followed by Oracle/NOP and then GPT. Use the existing r15 README for
the complete run sequence and clean-build limitations. The screenshot shows
both model and Oracle stages skipped because rubric QC failed; it does not
show a newly evaluated Oracle failure.

ZIP SHA256: `''' + actual + '''`
'''
(OUT / 'README.md').write_text(summary, encoding='utf-8')
(DELIVERY / 'QC_SCREENSHOT_RECHECK.md').write_text(summary, encoding='utf-8')
print(json.dumps(report, indent=2))
