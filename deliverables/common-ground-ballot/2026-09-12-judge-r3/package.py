import difflib
import hashlib
import json
from pathlib import Path
import re
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
task = root / 'projects/common-ground-ballot'
previous = out.parent / '2026-09-12-rubric-r2'
sha = lambda data: hashlib.sha256(data).hexdigest()
read = lambda name: json.loads((out / name).read_text(encoding='utf-8'))


def write(name, value):
    (out / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def leaves(value, prefix=''):
    return {path for k, v in value.items() for path in
            (leaves(v, prefix + k + '.') if isinstance(v, dict) else [prefix + k])}


files = {p.relative_to(task).as_posix(): p.read_bytes() for p in sorted(task.rglob('*')) if p.is_file()}
prefix = 'common-ground-ballot/'
old_zip = previous / 'common-ground-ballot.zip'
with zipfile.ZipFile(old_zip) as archive:
    assert all(name.startswith(prefix) for name in archive.namelist())
    before = {name[len(prefix):]: archive.read(name) for name in archive.namelist()}
assert set(files) == set(before) and len(files) == 36
changed = [name for name in files if files[name] != before[name]]
assert changed == ['tests/functional/prompt.md'], changed
checks = {}


def check(name, condition):
    checks[name] = bool(condition)
    assert condition, name


for name, content in files.items():
    check('root/' + name, name.split('/')[0] in {'README.md','environment','instruction.md','rubrics','solution','task.toml','tests'})
    check('clean/' + name, not set(Path(name).parts) & {'.git','node_modules','__pycache__','reports','jobs'}
          and not name.endswith(('.db','.sqlite','.pyc','.zip')))
    check('no-secret/' + name, not re.search(rb'sk-(?:or-v1-|proj-)[A-Za-z0-9_-]{16,}', content))
    if name.endswith(('.sh', '.py')):
        check('lf/' + name, b'\r\n' not in content)
ref = tomllib.loads((root / 'projects/bazaarbridge-marketplace-commerce/task.toml').read_text(encoding='utf-8'))
config = tomllib.loads(files['task.toml'].decode())
check('reference-task-key-set', leaves(config) == leaves(ref))
for key in ('schema_version', 'artifacts', 'agent', 'environment', 'verifier'):
    check('reference-operational/' + key, config[key] == ref[key])
check('task-version', config['task']['version'] == '1.0.0')
for name in ('environment/Dockerfile', 'tests/Dockerfile', 'tests/test.sh'):
    check('provider-keys-absent/' + name, not re.search(rb'OPEN(?:AI|ROUTER)_API_KEY', files[name], re.I))
check('max-judge-effort', b'model_reasoning_effort = "max"' in files['tests/Dockerfile'])

dimensions = ['render', 'constraints', 'functional', 'polish', 'visual']
counts = {}
provenance = read('prompt-provenance.json')
for dimension in dimensions:
    name = f'tests/{dimension}/judge.toml'
    judge = tomllib.loads(files[name].decode())
    counts[dimension] = len(judge['criterion'])
    check('unchanged-criteria/' + dimension, files[name] == before[name])
    check('central-model/' + dimension, not {'judge','model','reasoning_effort'} & judge['judge'].keys())
    check('dimension-weight/' + dimension, judge['judge']['weight'] == {'functional':.6,'polish':.2,'visual':.2,'render':1,'constraints':1}[dimension])
    prompt = files[f'tests/{dimension}/prompt.md'].decode()
    check('prompt-identification/' + dimension, len(re.findall('^Prompt version: ', prompt, re.M)) == 1)
    check('prompt-self-contained/' + dimension, not re.search(r'Bazaarbridge|Docketlight|Torquebay|Boardloom|GridForge|PatchPad', prompt, re.I))
    check('independent-scoring/' + dimension, 'Independent criterion scoring:' in prompt)
    check('global-gate/' + dimension, 'Global browser gate:' in prompt)
    check('prompt-provenance/' + dimension, provenance['judges'][dimension]['prompt_sha256'] == sha(files[f'tests/{dimension}/prompt.md']))
    check('judge-provenance/' + dimension, provenance['judges'][dimension]['judge_sha256'] == sha(files[name]))
check('all-33-criteria', counts == dict(render=2,constraints=2,functional=19,polish=4,visual=6))
check('functional-prompt-r5', provenance['judges']['functional']['prompt_version'] == 'common-ground-ballot-functional-v1.0.0-r5')
check('runner-provenance', provenance['runner_sha256'] == sha(files['tests/test.sh']))
check('reward-provenance', provenance['reward_sha256'] == sha(files['tests/reward.toml']))
for name in ('runtime-results.json', 'browser-results.json', 'harness-results.json', 'negative-control-results.json'):
    check('local/' + name, all(r['passed'] for r in read(name)['results']))
check('no-browser-errors', not read('browser-results.json')['errors'])
for kind in ('builds', 'local_runs'):
    check('validation/' + kind, all(r['exit_code'] == 0 for r in read('validation.json')[kind]))
coverage = json.loads((previous / 'coverage.json').read_text(encoding='utf-8'))
ids = {c['id'] for d in dimensions for c in tomllib.loads(files[f'tests/{d}/judge.toml'].decode())['criterion']}
check('coverage-map-preserved', {c for group in coverage['requirements'] for c in group['criteria']} == ids)
write('coverage.json', coverage)
write('standard-checks.json', {'passed': all(checks.values()), 'scope': 'Local mechanical and test-evidence checks; not platform QC or a full LLM Oracle.', 'checks': checks})
write('before-after.json', {
    'previous_zip_sha256': sha(old_zip.read_bytes()), 'changed_task_files': changed,
    'all_criteria_and_weights_unchanged': True, 'golden_solution_instructions_seeds_runtime_unchanged': True,
    'prompt_before': 'common-ground-ballot-functional-v1.0.0-r4',
    'prompt_after': 'common-ground-ballot-functional-v1.0.0-r5',
    'fixes': ['Capture request and response before navigation; retain private judge evidence.',
              'Sequence Draft/Open/Closed/Published checks with explicit independent verdict checkpoints.',
              'Use valid-state stale-only, current-revision eligibility/input and duplicate-participation controls.',
              'Read back the original success request and receipt for both Open and post-restart replay.'],
    'historical_oracle_score': .8928, 'new_oracle_run': False, 'new_platform_qc_run': False,
    'local_golden_groups': 13, 'negative_controls_detected': 4,
})
(out / 'prompt-changes.diff').write_text(''.join(difflib.unified_diff(
    before[changed[0]].decode().splitlines(keepends=True), files[changed[0]].decode().splitlines(keepends=True),
    fromfile='r4/tests/functional/prompt.md', tofile='r5/tests/functional/prompt.md')), encoding='utf-8')
destination = out / 'common-ground-ballot.zip'
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, content in files.items():
        info = zipfile.ZipInfo(prefix + name, (2026,9,12,0,0,0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        archive.writestr(info, content)
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None and len(archive.namelist()) == len(files)
    assert all(archive.read(prefix + name) == content for name, content in files.items())
digest = sha(destination.read_bytes())
write('source-hashes.json', {name: sha(content) for name, content in files.items()})
write('package-audit.json', {'passed': True, 'files': len(files), 'criteria': counts,
                           'only_functional_prompt_changed': True, 'zip_sha256': digest,
                           'oracle_run': False, 'platform_qc_run': False})
(out / 'SHA256SUMS.txt').write_text(digest + '  ' + destination.name + '\n')
print('PASS package: 36 files, 33 unchanged criteria; SHA256 ' + digest)
