"""Read-only independent observations; this is not the private checker suite."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r2'
BASE = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r2'
TASK = BASE / 'task'
TEMPLATE = BASE / 'rules/projects/webdev-task-template'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
rel = lambda p: p.relative_to(ROOT).as_posix()
result = {'scope': __doc__, 'input_sha256': '7e8adb4257e0b520304b0c4c7b2d16e184c9f951d54e3b3e77345643d59023f0'}
files = sorted(p for p in TASK.rglob('*') if p.is_file())
result['task_files'] = {p.relative_to(TASK).as_posix(): sha(p) for p in files}
result['parsed'] = []
for p in files:
    if p.suffix == '.toml':
        tomllib.loads(p.read_text(encoding='utf-8'))
        result['parsed'].append(rel(p))
    elif p.suffix == '.json':
        json.loads(p.read_text(encoding='utf-8'))
        result['parsed'].append(rel(p))
result['template_byte_comparison'] = {name: (TASK/name).read_bytes() == (TEMPLATE/name).read_bytes() for name in [
    'tests/tools/score.py', 'tests/tools/restart_mcp.py', 'tests/test.sh',
    'tests/Dockerfile', 'environment/Dockerfile', 'tests/scoring.toml']}
task = tomllib.loads((TASK/'task.toml').read_text())
template = tomllib.loads((TEMPLATE/'task.toml').read_text())
result['verifier_env_matches_template'] = task['verifier']['env'] == template['verifier']['env']
result['bash_syntax'] = {}
bash = 'C:/Users/00518507/AppData/Local/Programs/Git/bin/bash.exe'
for p in TASK.rglob('*.sh'):
    proc = subprocess.run([bash, '-n', str(p)], capture_output=True, text=True)
    result['bash_syntax'][rel(p)] = {'command': [bash, '-n', str(p)], 'exit': proc.returncode,
                                  'stderr': proc.stderr, 'crlf': b'\r\n' in p.read_bytes()}
result['node_syntax'] = {}
for p in TASK.rglob('*.js'):
    proc = subprocess.run(['node', '--check', str(p)], capture_output=True, text=True)
    result['node_syntax'][rel(p)] = {'exit': proc.returncode, 'stderr': proc.stderr}
result['judges'] = {}
for p in TASK.glob('tests/*/*/judge.toml'):
    d = tomllib.loads(p.read_text()); j = d['judge']; cs = d['criterion']
    ids = [c['id'] for c in cs]
    result['judges'][rel(p)] = {'count': len(cs), 'timeout': j['timeout'],
        'types': sorted({c['type'] for c in cs}), 'ids_unique': len(ids) == len(set(ids)),
        'positive_weights': all(c['weight'] > 0 for c in cs),
        'descriptions_nonempty': all(c['description'].strip() for c in cs),
        'prohibited_judge_keys': sorted(set(j) & {'model', 'temperature', 'reasoning_effort', 'weight'}),
        'prompt_resolves': (p.parent / j['prompt_template']).is_file(),
        'criteria_placeholder_present': '{criteria}' in (p.parent/j['prompt_template']).read_text(),
        'judge': j, 'scoring': d['scoring']}
patterns = {
    'unfinished_markers': r'CHANGE[_-]?ME|TODO|FIXME|XXX|<placeholder>|lorem ipsum',
    'host_paths': r'/Users/[A-Za-z]|/home/(?!agent|node|user|runner)[A-Za-z]|C:\\Users|Documents and Settings',
    'provider_or_pem_secrets': r'-----BEGIN .{0,20}PRIVATE KEY-----|sk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}',
    'bare_nproc': r'\bnproc\b(?!\s+--all)',
}
result['scans'] = {}
for name, pattern in patterns.items():
    hits = []
    for p in files:
        for n, line in enumerate(p.read_text(encoding='utf-8').splitlines(), 1):
            if re.search(pattern, line, re.I):
                hits.append({'file': rel(p), 'line': n, 'text': line})
    result['scans'][name] = hits
index = RUN/'raw-evidence-index.json'
data = json.loads(index.read_text())
result['raw_evidence_index'] = {'path': rel(index), 'sha256': sha(index), 'entry_count': len(data['entries']), 'hash_errors': []}
for item in data['entries']:
    p = ROOT/item['path']
    actual = sha(p) if p.is_file() else 'MISSING'
    if actual != item['sha256']:
        result['raw_evidence_index']['hash_errors'].append({'path': item['path'], 'actual': actual, 'expected': item['sha256']})
    for name, expected in item.get('matching_source_files', {}).items():
        if sha(TASK/name) != expected:
            result['raw_evidence_index']['hash_errors'].append({'source': name, 'expected': expected, 'actual': sha(TASK/name)})
result['runtime_evidence_present'] = (RUN/'runtime-evidence.json').exists()
result['runtime_limits'] = 'No configured provider judge, full workload, Oracle, target-model or empirical scored-app comparison was executed by this audit. Artifact hash verification does not establish those claims.'
dest = Path(__file__).with_name('mechanical-observations.json')
dest.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'artifact': rel(dest), 'sha256': sha(dest), 'files': len(files), 'parsed': len(result['parsed']),
                  'shell_exits': [v['exit'] for v in result['bash_syntax'].values()],
                  'node_exits': [v['exit'] for v in result['node_syntax'].values()],
                  'evidence_hash_errors': result['raw_evidence_index']['hash_errors']}))
