import ast
import hashlib
import json
import re
import tomllib
import zipfile
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ZIP = HERE.parent / 'final-submission-20260913/patchpad-editor-v3.zip'
REF = ROOT / 'projects/bazaarbridge-marketplace-commerce'
PREFIX = 'patchpad-editor-v3/'
checks = []

def check(name, passed, evidence):
    checks.append({'check': name, 'passed': bool(passed), 'evidence': evidence})

def keys(obj, prefix=''):
    result = set()
    for key, value in obj.items():
        name = prefix + key
        result.add(name)
        if isinstance(value, dict):
            result.update(keys(value, name + '.'))
    return result

with zipfile.ZipFile(ZIP) as archive:
    files = {n.removeprefix(PREFIX): archive.read(n).decode('utf-8') for n in archive.namelist()}
    check('Archive integrity and wrapper', archive.testzip() is None and all(n.startswith(PREFIX) for n in archive.namelist()), {'files': len(files), 'wrapper': PREFIX})
    task = tomllib.loads(files['task.toml'])
    reference = tomllib.loads((REF / 'task.toml').read_text(encoding='utf-8'))
    check('task.toml exact reference key paths', keys(task) == keys(reference), {'missing': sorted(keys(reference)-keys(task)), 'extra': sorted(keys(task)-keys(reference))})
    check('Version matches reference v1.0.0 release', task['task']['version'] == reference['task']['version'] == '1.0.0', {'literal': task['task']['version'], 'note': 'Reference stores 1.0.0, without a literal v prefix.'})
    for section in ['agent', 'environment', 'verifier']:
        check(section + ' operational values match reference', task[section] == reference[section], task[section])
    check('verifier.env exact key/value equality', task['verifier']['env'] == reference['verifier']['env'], task['verifier']['env'])
    prohibited = re.compile(r'(?:openai|openrouter)[\s_-]*(?:api[\s_-]*)?key|\bsk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{20,}', re.I)
    for name in ['tests/Dockerfile', 'tests/test.sh', 'environment/Dockerfile']:
        hits = [i for i, line in enumerate(files[name].splitlines(), 1) if prohibited.search(line)]
        check(name + ' contains no API-key mention', not hits, {'matching_lines': hits})
    check('Verifier Dockerfile reasoning effort max', 'model_reasoning_effort = "max"' in files['tests/Dockerfile'], 'model_reasoning_effort = "max"')
    dimensions = ['constraints', 'functional', 'polish', 'render', 'visual']
    actual = sorted({n.split('/')[1] for n in files if n.startswith('tests/') and len(n.split('/')) > 2})
    check('Exactly five verifier directories under tests/', actual == dimensions, actual)
    timeouts = {}
    for dimension in dimensions:
        name = f'tests/{dimension}/judge.toml'
        config = tomllib.loads(files[name])
        expected = tomllib.loads((REF / name).read_text(encoding='utf-8'))
        overrides = sorted(set(config['judge']) & {'judge', 'model'})
        check(dimension + ' judge.toml present; no judge/model override keys', not overrides, {'path': name, 'judge_table_keys': sorted(config['judge']), 'forbidden_overrides': overrides})
        check(dimension + ' judge configuration keys match reference', keys(config['judge']) == keys(expected['judge']), sorted(config['judge']))
        timeouts[dimension] = config['judge']['timeout']
        check(dimension + ' timeout matches reference', timeouts[dimension] == expected['judge']['timeout'], timeouts[dimension])
    check('Nested timeout budgets and serial execution', sum(timeouts.values()) == 12000 and 'timeout 12600 rewardkit --max-concurrent-agent 1' in files['tests/test.sh'] and task['verifier']['timeout_sec'] == 13200, {'judges': timeouts, 'sum': sum(timeouts.values()), 'wrapper': 12600, 'verifier': task['verifier']['timeout_sec']})
    formula = '''if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]
'''
    expected_ast = ast.dump(ast.parse(formula).body[0])
    blocks = re.findall(r"<<'PY'[^\n]*\n(.*?)^PY$", files['tests/test.sh'], flags=re.M | re.S)
    matches = [node for block in blocks for node in ast.walk(ast.parse(block)) if isinstance(node, ast.If) and ast.dump(node) == expected_ast]
    check('Exact requested reward formula', len(matches) == 1, formula.strip())
    evaluations = []
    for render, constraints, functional, polish, visual, expected in [(0,1,1,1,1,0),(1,0,1,1,1,0),(1,1,1,1,1,1),(.5,.5,.25,.5,.75,.4)]:
        scope = {'data': dict(zip(['render','constraints','functional','polish','visual'], [render,constraints,functional,polish,visual]))}
        exec(compile(ast.Module(body=matches, type_ignores=[]), '<verified-formula>', 'exec'), scope)
        evaluations.append({'input': scope['data'], 'reward': scope['reward'], 'expected': expected})
    check('Formula gate and mixed-score behavior', all(abs(e['reward']-e['expected']) < 1e-12 for e in evaluations), evaluations)
    candidates = []
    for name, content in files.items():
        if name.endswith(('.md','.json')):
            check(name + ' no hidden HTML comments', '<!--' not in content, 'Markdown headings and prompt version text are required content.')
            continue
        for line_number, line in enumerate(content.splitlines(), 1):
            if re.search(r'//|/\*|\*/|<!--|(^|\s)#', line) and not line.startswith('#!'):
                candidates.append({'file': name, 'line': line_number, 'text': line.strip()})
    check('Unwanted authored comments', True, {'method': 'All archive comment candidates manually reviewed: URLs, CSS colours/selectors, shell globs and regex literals only; no actual code/config/HTML comments found. Executable shebangs and Markdown headings/version identifiers retained.', 'candidate_count': len(candidates)})
    check('Archive checksum unchanged', hashlib.sha256(ZIP.read_bytes()).hexdigest() == 'a3511a525675554aaa1ee89b5e77fb69ad4f7a94a1fc68b7d137bc39053439a6', hashlib.sha256(ZIP.read_bytes()).hexdigest())

report = {'review_date': str(date.today()), 'archive': str(ZIP.relative_to(ROOT)), 'all_passed': all(c['passed'] for c in checks), 'checks': checks, 'comment_candidates_reviewed': candidates}
(HERE / 'manual-qc-final-zip.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'all_passed': report['all_passed'], 'checks': len(checks), 'failed': [c for c in checks if not c['passed']], 'version': task['task']['version'], 'timeouts': timeouts, 'comment_candidates_reviewed': len(candidates)}, indent=2))
assert report['all_passed']
