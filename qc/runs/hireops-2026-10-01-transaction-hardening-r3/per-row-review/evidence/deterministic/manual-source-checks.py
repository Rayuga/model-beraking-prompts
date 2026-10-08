"""Local reviewer observations only; this is not the private deterministic suite."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import tomllib

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
FROZEN = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r3'
TASK = FROZEN / 'task'
TEMPLATE = FROZEN / 'rules/projects/webdev-task-template'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

files = sorted(p for p in TASK.rglob('*') if p.is_file())
out = {
    'scope': 'Manual deterministic review with local syntax/schema/hash probes. No private checker runner, provider call, Docker run or configured model grade.',
    'input_sha256': 'cf784fd80eb2bbde1fc76bc223bc4dd9b75279121566847079f982e09473ca01',
    'source_sha256': {p.relative_to(TASK).as_posix(): sha(p) for p in files},
    'private_checker_available_on_path': shutil.which('check-required-files.py'),
    'syntax': [],
}
for p in files:
    relative = p.relative_to(TASK).as_posix()
    if p.suffix == '.toml':
        tomllib.loads(p.read_text(encoding='utf-8'))
        out['syntax'].append({'file': relative, 'parser': 'tomllib', 'valid': True})
    elif p.suffix == '.json':
        json.loads(p.read_text(encoding='utf-8'))
        out['syntax'].append({'file': relative, 'parser': 'json', 'valid': True})
    elif p.suffix == '.py':
        compile(p.read_text(encoding='utf-8'), relative, 'exec')
        out['syntax'].append({'file': relative, 'parser': 'compile without bytecode', 'valid': True})
    elif p.suffix in ('.sh', '.js'):
        argv = [shutil.which('bash'), '-n', str(p)] if p.suffix == '.sh' else [shutil.which('node'), '--check', str(p)]
        proc = subprocess.run(argv, capture_output=True, text=True)
        out['syntax'].append({'file': relative, 'command': argv, 'exit': proc.returncode, 'stdout': proc.stdout, 'stderr': proc.stderr, 'has_cr': b'\r' in p.read_bytes()})

canonical = ['environment/Dockerfile', 'tests/Dockerfile', 'tests/test.sh', 'tests/scoring.toml', 'tests/tools/score.py', 'tests/tools/restart_mcp.py']
out['canonical_comparisons'] = {n: {'identical': (TASK/n).read_bytes() == (TEMPLATE/n).read_bytes(), 'sha256': sha(TASK/n)} for n in canonical}
config = tomllib.loads((TASK/'task.toml').read_text())
out['verifier_env_identical'] = config['verifier']['env'] == tomllib.loads((TEMPLATE/'task.toml').read_text())['verifier']['env']
out['policy'] = tomllib.loads((TASK/'tests/scoring.toml').read_text())
out['judge_schemas'] = []
all_ids = []
for p in sorted(TASK.glob('tests/*/*/judge.toml')):
    d = tomllib.loads(p.read_text())
    j = d['judge']
    cs = d['criterion']
    prompt = p.parent/j['prompt_template']
    text = prompt.read_text()
    assert j['judge'] == config['verifier']['env']['REWARDKIT_JUDGE']
    assert {'mode', 'timeout', 'isolated', 'prompt_template'} <= j.keys()
    assert not {'model', 'reasoning_effort', 'temperature', 'weight'} & j.keys()
    assert '{criteria}' in text and '{app_context}' in text
    assert len({c['id'] for c in cs}) == len(cs)
    assert all(c['type'] in ('binary', 'likert') and c['weight'] > 0 and c['description'].strip() for c in cs)
    assert any(m['name'] == 'playwright' for m in j['mcp_servers'])
    if p.parent.parent.name == 'gates':
        assert all(c['type'] == 'binary' for c in cs)
    all_ids.extend(c['id'] for c in cs)
    out['judge_schemas'].append({'file': p.relative_to(TASK).as_posix(), 'count': len(cs), 'criterion_weight_sum': sum(c['weight'] for c in cs), 'timeout': j['timeout'], 'aggregation': d['scoring']['aggregation'], 'restart_servers': [m for m in j['mcp_servers'] if m['name'] == 'verifier'], 'prompt_resolves': True})
public = [TASK/'instruction.md', *TASK.glob('environment/instructions/*.md')]
out['instruction_words'] = len((TASK/'instruction.md').read_text().split())
patterns = {
    'draft_markers': r'CHANGE[_-]?ME|TODO|FIXME|\bXXX\b|<placeholder>|lorem ipsum',
    'host_paths': r'/Users/\w+|/home/(?!agent\b|node\b|user\b|runner\b)\w+|[A-Z]:\\Users|Documents and Settings',
    'secret_shapes': r'-----BEGIN .*PRIVATE KEY|sk-[A-Za-z0-9_-]{20,}|sk-ant-|ghp_[A-Za-z0-9]{20,}',
    'nproc': r'\bnproc\b',
    'obsolete_config': r'allow_internet|gpu_types|docker_image',
}
out['text_scans'] = {name: [{'file': p.relative_to(TASK).as_posix(), 'line': i} for p in files for i, line in enumerate(p.read_text(encoding='utf-8').splitlines(), 1) if re.search(pattern, line, re.I)] for name, pattern in patterns.items()}
out['public_ids'] = [{'file': p.relative_to(TASK).as_posix(), 'id': identifier} for p in public for identifier in all_ids if re.search(r'(?<![A-Za-z0-9_])'+re.escape(identifier)+r'(?![A-Za-z0-9_])', p.read_text())]
out['public_grader_terms'] = [{'file': p.relative_to(TASK).as_posix(), 'line': i} for p in public for i, line in enumerate(p.read_text().splitlines(), 1) if re.search(r'\bjudge\b|rubric|criteri|dimension|reward|score\.py|playwright|glm|claude|/tests', line, re.I)]
seed = json.loads((TASK/'environment/assets/seed_data.json').read_text())
out['seed_copy_identical'] = (TASK/'environment/assets/seed_data.json').read_bytes() == (TASK/'solution/app/src/seed_data.json').read_bytes()
out['account_sets'] = {
    'seed': sorted(u['email'] for u in seed['users']),
    'brief': sorted(set(re.findall(r'[\w.]+@hireops\.example', (TASK/'instruction.md').read_text()))),
    'app_context': sorted(set(re.findall(r'[\w.]+@hireops\.example', (TASK/'tests/app_context.md').read_text()))),
}
out['logical_task_name'] = config['task']['name']
out['task_file_count'] = len(files)
out['symlinks'] = [p.relative_to(TASK).as_posix() for p in TASK.rglob('*') if p.is_symlink()]
index_path = RUN/'raw-evidence-index.json'
index = json.loads(index_path.read_text())
out['raw_index'] = {'sha256': sha(index_path), 'input_sha256': index['input_sha256'], 'count': len(index['entries']), 'artifacts': []}
for entry in index['entries']:
    p = ROOT/entry['path']
    actual = sha(p) if p.is_file() else None
    bad_sources = [n for n, h in entry.get('matching_source_files', {}).items() if not (TASK/n).is_file() or sha(TASK/n) != h]
    out['raw_index']['artifacts'].append({'path': entry['path'], 'actual_sha256': actual, 'hash_matches': actual == entry['sha256'], 'mismatching_source_files': bad_sources})
assert all(r['hash_matches'] and not r['mismatching_source_files'] for r in out['raw_index']['artifacts'])
destination = Path(__file__).with_name('manual-source-checks.json')
destination.write_text(json.dumps(out, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'output': str(destination), 'files': len(files), 'index_artifacts': len(index['entries']), 'index_mismatches': 0, 'syntax_failures': [r for r in out['syntax'] if r.get('exit', 0)], 'scans': out['text_scans'], 'schemas': out['judge_schemas']}, indent=2))
