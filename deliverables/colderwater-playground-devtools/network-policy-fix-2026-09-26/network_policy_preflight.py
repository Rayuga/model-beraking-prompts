import argparse
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
import difflib
import json
import sys
import tomllib
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--task', type=Path, default=Path('projects/colderwater-playground-devtools'))
parser.add_argument('--output', type=Path)
args = parser.parse_args()
out = Path(__file__).resolve().parent
task = args.task
old_dir = out.parent / 'rubric-fix-2026-09-26'
old_zip = old_dir / 'colderwater-playground-devtools.zip'
baseline_sha = '76ab7fb11195aa564b1ac5647439cc34be4b8c00fd28918f95b06ed286fd6d4d'
assert sha256(old_zip.read_bytes()).hexdigest() == baseline_sha
with zipfile.ZipFile(old_zip) as bundle:
    old = {name.split('/', 1)[1]: bundle.read(name) for name in bundle.namelist() if not name.endswith('/')}
new = {p.relative_to(task).as_posix(): p.read_bytes() for p in task.rglob('*') if p.is_file()}
checks = []

def check(name, passed, evidence=''):
    checks.append({'name': name, 'passed': bool(passed), 'evidence': evidence})

expected = {
    'instruction.md', 'environment/instructions/integration.md',
    'environment/instructions/policy.md', 'environment/instructions/security.md',
    'task.toml', 'tests/app_context.md', 'tests/scored/functional/judge.toml',
}
changed = sorted(p for p in new if p in old and new[p] != old[p])
check('same 50-file inventory', set(new) == set(old) and len(new) == 50)
check('only seven authorized files changed', set(changed) == expected, changed)
for prefix in ['solution/', 'tests/gates/', 'tests/tools/']:
    check(prefix + ' bytes unchanged', all(new[p] == old[p] for p in old if p.startswith(prefix)))
for rel in ['tests/Dockerfile', 'environment/Dockerfile', 'tests/test.sh', 'tests/scoring.toml', 'tests/scored/polish/judge.toml', 'tests/scored/visual/judge.toml']:
    check(rel + ' bytes unchanged', new[rel] == old[rel])
before = tomllib.loads(old['task.toml'].decode())
after = tomllib.loads(new['task.toml'].decode())
before['task']['description'] = after['task']['description']
before['metadata']['provenance'] = after['metadata']['provenance']
check('only description/provenance metadata changed', before == after)
old_f = tomllib.loads(old['tests/scored/functional/judge.toml'].decode())
new_f = tomllib.loads(new['tests/scored/functional/judge.toml'].decode())
check('32 functional criteria retain weight 49.5', len(new_f['criterion']) == 32 and sum(c['weight'] for c in new_f['criterion']) == 49.5)
check('first criterion remains initial_examples at weight 0.5', new_f['criterion'][0]['id'] == 'initial_examples' and new_f['criterion'][0]['weight'] == 0.5)
old_f['criterion'][0]['description'] = new_f['criterion'][0]['description']
check('only first criterion description changed', old_f == new_f)
f01 = new_f['criterion'][0]['description']
check('F01 explicitly allows browser CDN assets', 'CDN assets are allowed and must not fail this criterion' in f01)
check('F01 retains authored run/automatic startup/example observations', all(x in f01 for x in ['automatically produced', "one of the app's examples", 'distinctive paragraph', 'Do not inspect submitted scripts/bundles or save']))
integration = new['environment/instructions/integration.md'].decode()
security = new['environment/instructions/security.md'].decode()
check('integration matches public browser asset profile', 'may load external fonts' in integration and 'CDN assets' in integration and 'without an external backend or database service' in integration)
check('snippet security boundary explicitly retained', "snippets can't fetch external resources or use network services" in security and 'app itself may load external fonts' in security)
check('app context distinguishes both scopes', 'not an app-wide network restriction' in new['tests/app_context.md'].decode())
check('offline app description removed', all('offline' not in new[p].decode().lower() for p in expected))
check('every judge prompt unchanged', all(new[p] == old[p] for p in old if p.startswith('tests/') and p.endswith('/prompt.md')))

remaining = [Decimal(str(c['weight'])) for c in new_f['criterion'][1:]]
possible = {Decimal(0)}
for weight in remaining:
    possible |= {value + weight for value in possible}
total, delta = Decimal('49.5'), Decimal('.5')
def reward(raw):
    return Decimal(0) if raw / total <= Decimal('.05') else Decimal('.4') + Decimal('.6') * raw / total
clear = max(round(reward(x + delta), 4) - round(reward(x), 4) for x in possible if x / total > Decimal('.05'))
cross = max((reward(x + delta), x) for x in possible if x / total <= Decimal('.05') and (x + delta) / total > Decimal('.05'))
diff = []
for rel in changed:
    diff.extend(difflib.unified_diff(old[rel].decode().splitlines(True), new[rel].decode().splitlines(True), fromfile='76ab7fb1/' + rel, tofile='corrected/' + rel))
report = {
    'scope': 'Executed narrow network-policy correction audit; no model, Oracle or platform judgment.',
    'baseline_sha256': baseline_sha,
    'passed': sum(c['passed'] for c in checks), 'failed': sum(not c['passed'] for c in checks),
    'checks': checks, 'changed_files': changed,
    'source_hashes': {p: sha256(blob).hexdigest() for p, blob in sorted(new.items())},
    'score_scope': 'Only a formerly disallowed app CDN dependency can change F01 from fail to pass; all other verdicts, passed gates and presentation assumed fixed. These abstract bounds are not actual model predictions or guarantees that every Boolean combination is feasible.',
    'score_effects': {'max_unrounded_above_floor': float(Decimal('.6') * delta / total), 'max_published_above_floor': float(clear), 'max_floor_crossing_reward': float(round(cross[0], 4)), 'floor_crossing_old_raw': float(cross[1]), 'floor_crossing_new_raw': float(cross[1] + delta)},
}
target = args.output or out / 'network_policy_preflight.json'
target.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
if not args.output:
    (out / 'network_policy_changes.diff').write_text(''.join(diff), encoding='utf-8')
print(json.dumps({k: report[k] for k in ['passed', 'failed', 'changed_files', 'score_effects']}, indent=2))
if report['failed']:
    sys.exit(1)
