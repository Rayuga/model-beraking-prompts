"""Audit the task bytes inside the delivered bundle against the user's checklist."""
from pathlib import Path
import hashlib
import io
import json
import random
import re
import tempfile
import tomllib
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SLUG = 'common-ground-ballot'
BUNDLE = HERE.parent / f'{SLUG}-final-deliverables.zip'
REF = ROOT / 'projects/bazaarbridge-marketplace-commerce/task.toml'
checks = []


def check(name, condition, detail=None):
    checks.append(dict(name=name, passed=bool(condition), detail=detail))


def paths(obj, prefix=''):
    result = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            path = prefix + key
            result.add(path)
            if isinstance(value, dict):
                result.update(paths(value, path + '.'))
    return result


with zipfile.ZipFile(BUNDLE) as outer:
    check('Bundle CRC and seven-file layout', outer.testzip() is None and len(outer.namelist()) == 7)
    nested = outer.read(f'{SLUG}-final-deliverables/{SLUG}.zip')
with zipfile.ZipFile(io.BytesIO(nested)) as task:
    check('Task ZIP CRC', task.testzip() is None)
    check('Task ZIP wrapper and 29 files', len(task.namelist()) == 29 and all(n.startswith(SLUG + '/') for n in task.namelist()))
    files = {n.split('/', 1)[1]: task.read(n) for n in task.namelist()}
text = {name: data.decode('utf-8') for name, data in files.items()}
config = tomllib.loads(text['task.toml'])
reference = tomllib.loads(REF.read_text(encoding='utf-8'))
check('Identical task.toml table and key structure', paths(config) == paths(reference))
for section, key in [('agent', 'timeout_sec'), ('environment', 'build_timeout_sec'), ('verifier', 'timeout_sec')]:
    check(f'Reference timeout: {section}.{key}', config[section][key] == reference[section][key], config[section][key])
check('Reference literal version', config['task']['version'] == reference['task']['version'] == '1.0.0', 'The reference stores 1.0.0 without a v prefix.')
check('Identical verifier.env keys and values', config['verifier']['env'] == reference['verifier']['env'])
check('Credential remains a template', config['verifier']['env']['OPENAI_API_KEY'] == '${OPENAI_API_KEY}')
for name in ['tests/Dockerfile', 'tests/test.sh', 'environment/Dockerfile']:
    check('No provider API key mentions: ' + name, not re.search(r'(?:openai|openrouter)[ _-]*api[ _-]*key', text[name], re.I))
check('Verifier Dockerfile max reasoning', 'model_reasoning_effort = "max"' in text['tests/Dockerfile'])
dimensions = ['constraints', 'functional', 'polish', 'render', 'visual']
check('Exactly five verifier folders under tests/', {Path(n).parts[1] for n in files if n.startswith('tests/') and len(Path(n).parts) > 2} == set(dimensions))
judges = {}
for dim in dimensions:
    name = f'tests/{dim}/judge.toml'
    check('judge.toml exists: ' + dim, name in files)
    judges[dim] = tomllib.loads(text[name])
    forbidden = [p for p in paths(judges[dim]) if p != 'judge' and p.rsplit('.', 1)[-1] in ('judge', 'model')]
    check('No judge/model override keys: ' + dim, not forbidden, forbidden)
    check('Prompt file present: ' + dim, f'tests/{dim}/prompt.md' in files)
check('Reference spelling is tests/, not test/', not any(n.startswith('test/') for n in files))
weights = {d: judges[d]['judge']['weight'] for d in ['functional', 'polish', 'visual']}
check('Final weights are 0.6/0.2/0.2', weights == {'functional': .6, 'polish': .2, 'visual': .2}, weights)

required = '''if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]'''
literal = required in text['tests/test.sh']
check('Requested literal reward block is present', literal, 'The current scorer reads authoritative judge weights and computes the gated normalized weighted mean.')
source = re.search(r"cat > /opt/common-ground-verifier/score <<'COMMON_GROUND_HELPER_3'\n(.*?)\nCOMMON_GROUND_HELPER_3", text['tests/test.sh'], re.S).group(1)
namespace = {'__name__': '__manual_qc_audit__'}
exec(compile(source, 'delivered-private-score-helper', 'exec'), namespace)
check('Generated scorer is invoked by tests/test.sh', 'if ! /opt/common-ground-verifier/score "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" "$LOG_DIR/ctrf.json"' in text['tests/test.sh'])
rng = random.Random(20260917)
cases = [dict(render=r, constraints=c, functional=f, polish=p, visual=v)
         for r in (0., 1.) for c in (0., 1.) for f in (0., .5, 1.) for p in (0., .5, 1.) for v in (0., .5, 1.)]
cases += [{d: rng.random() for d in dimensions} for _ in range(1000)]
cases.append(dict(render=1., constraints=1., functional=.3357, polish=.9286, visual=.9583))
with tempfile.TemporaryDirectory(prefix='common-ground-manual-qc-') as temporary:
    root = Path(temporary)
    (root / 'reward.toml').write_bytes(files['tests/reward.toml'])
    for dim in dimensions:
        (root / dim).mkdir()
        (root / dim / 'judge.toml').write_bytes(files[f'tests/{dim}/judge.toml'])
    mismatches = []
    for data in cases:
        expected = 0. if data['render'] <= 0 or data['constraints'] <= 0 else round(.6*data['functional'] + .2*data['polish'] + .2*data['visual'], 4)
        actual = namespace['compose'](dict(data), root)
        if actual != expected:
            mismatches.append(dict(data=data, expected=expected, actual=actual))
    check('Runtime reward equals requested formula at output precision', not mismatches, {'cases': len(cases), 'mismatches': len(mismatches)})

comments = []
for name, content in text.items():
    if name.endswith(('.md', '.toml', '.json')):
        continue
    for line_number, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()
        is_comment = (stripped.startswith(('#', '//', '/*', '<!--')) and not stripped.startswith('#!'))
        if name.endswith('.css') and stripped.startswith('#'):
            is_comment = False
        if is_comment:
            comments.append(dict(file=name, line=line_number, text=line))
check('No TODO/FIXME/HACK/debugger markers in task code', not any(re.search(r'\b(?:TODO|FIXME|HACK)\b|\bdebugger\s*;', s) for name, s in text.items() if not name.endswith('.md')))
historical = []
for line_number, line in enumerate(text['README.md'].splitlines(), 1):
    if re.search(r'^## .*\(r2[567]\)|0\.9521|0\.7885|57 Functional|77 total', line):
        historical.append(dict(file='README.md', line=line_number, text=line))
check('No historical release commentary in README', not historical, historical)
check('No added helper/report/cache files inside task', not any(any(part in {'__pycache__', 'node_modules', '.git', 'reports'} for part in Path(name).parts) or name.endswith(('.docx', '.zip', '.pdf', '.pyc', '.db')) for name in files))

audit = dict(bundle_sha256=hashlib.sha256(BUNDLE.read_bytes()).hexdigest(), task_zip_sha256=hashlib.sha256(nested).hexdigest(), reference=str(REF.relative_to(ROOT)), passed=sum(c['passed'] for c in checks), findings=[c for c in checks if not c['passed']], checks=checks, code_comment_inventory=comments, existing_code_comments_are_operational=True, literal_version_note='User says v1.0.0; the reference and final task both store version="1.0.0".', verifier_folder_note='Reference and final task use tests/.', platform_qc=False, deliverables_modified=False)
(HERE / 'manual-qc-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps({key: audit[key] for key in ['task_zip_sha256', 'passed', 'findings', 'literal_version_note', 'verifier_folder_note', 'deliverables_modified']}, indent=2))
