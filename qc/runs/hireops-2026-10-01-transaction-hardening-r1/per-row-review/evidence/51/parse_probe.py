"""Read-only frozen-input parsing and artifact binding for quality row 51."""
import ast
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r1'
CACHE = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r1'
TASK = CACHE / 'task'
OUT = Path(__file__).resolve().parent
manifest = json.loads((RUN / 'manifest.json').read_text())
result = {'input_sha256': manifest['input_sha256'], 'scope': 'Local parser and exact-byte evidence checks only; no private deterministic suite or provider grading.'}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def call(args, **kwargs):
    p = subprocess.run(args, text=True, capture_output=True, timeout=20, **kwargs)
    return {'command': args, 'exit_code': p.returncode, 'stdout': p.stdout, 'stderr': p.stderr}

bound = {}
for group in ['task', 'rules']:
    mismatches = []
    for relative, expected in manifest['inputs'][group].items():
        p = CACHE / group / relative
        actual = sha(p) if p.is_file() else None
        if actual != expected:
            mismatches.append({'path': relative, 'expected': expected, 'actual': actual})
    bound[group] = {'checked_files': len(manifest['inputs'][group]), 'mismatches': mismatches}
result['frozen_hashes'] = bound
result['engine_drift'] = [
    {'path': p, 'expected': expected, 'actual': sha(ROOT / p)}
    for p, expected in manifest['engine_inputs'].items() if sha(ROOT / p) != expected
]
result['versions'] = [call([sys.executable, '--version']), call([shutil.which('node'), '--version']), call([shutil.which('bash'), '--version'])]
result['toml'] = []
for p in sorted(TASK.rglob('*.toml')):
    record = {'path': p.relative_to(TASK).as_posix(), 'sha256': sha(p)}
    try:
        parsed = tomllib.loads(p.read_text('utf-8'))
        record.update(parsed=True, tables=list(parsed))
        if p.name == 'judge.toml':
            prompt = p.parent / parsed['judge']['prompt_template']
            record.update(criteria=len(parsed['criterion']), prompt_exists=prompt.is_file(), prompt_has_criteria='{criteria}' in prompt.read_text('utf-8'))
    except Exception as e:
        record.update(parsed=False, error=repr(e))
    result['toml'].append(record)
result['json'] = []
for p in sorted(TASK.rglob('*.json')):
    record = {'path': p.relative_to(TASK).as_posix(), 'sha256': sha(p)}
    try:
        json.loads(p.read_text('utf-8'))
        record['parsed'] = True
    except Exception as e:
        record.update(parsed=False, error=repr(e))
    result['json'].append(record)
result['shell'] = []
for p in sorted(TASK.rglob('*.sh')):
    b = p.read_bytes()
    record = call([shutil.which('bash'), '-n', p.as_posix()])
    record.update(path=p.relative_to(TASK).as_posix(), sha256=sha(p), cr_bytes=b.count(b'\r'), shebang=b.split(b'\n')[0].decode())
    result['shell'].append(record)
result['javascript'] = []
for p in sorted(TASK.rglob('*.js')):
    record = call([shutil.which('node'), '--check', str(p)])
    record.update(path=p.relative_to(TASK).as_posix(), sha256=sha(p))
    result['javascript'].append(record)
result['python'] = []
for p in sorted(TASK.rglob('*.py')):
    ast.parse(p.read_text('utf-8'), filename=str(p))
    result['python'].append({'path': p.relative_to(TASK).as_posix(), 'sha256': sha(p), 'parsed': True})

# Validate syntax of generated shell/Python/JS bodies too, without writing inputs.
result['embedded'] = []
test_sh = (TASK / 'tests/test.sh').read_text('utf-8')
helper = test_sh.split("<<'SH'\n", 1)[1].split('\nSH\n', 1)[0] + '\n'
result['embedded'].append({'kind': 'restart helper bash -n', **call([shutil.which('bash'), '-n'], input=helper)})
parts = test_sh.split("<<'PY'")
for i, part in enumerate(parts[1:]):
    body = part.split('\n', 1)[1].split('\nPY\n', 1)[0]
    ast.parse(body)
    result['embedded'].append({'kind': 'Python heredoc', 'index': i, 'parsed': True})
solve_sh = (TASK / 'solution/solve.sh').read_text('utf-8')
js_body = solve_sh.split("<<'JS'\n", 1)[1].split('\nJS\n', 1)[0]
result['embedded'].append({'kind': 'installer JS node --check', **call([shutil.which('node'), '--check'], input=js_body)})

# Finite negative and conforming controls: parser success is not execution success.
result['controls'] = []
with tempfile.TemporaryDirectory(prefix='hireops-row51-') as temp:
    d = Path(temp)
    broken = d / 'missing-dependency.cjs'
    broken.write_text("require('./missing-module.cjs');\n", encoding='utf-8')
    result['controls'].append({'name': 'syntactically valid broken entry parses', **call([shutil.which('node'), '--check', str(broken)])})
    result['controls'].append({'name': 'missing dependency fails at runtime', **call([shutil.which('node'), str(broken)])})
    invalid = d / 'invalid.cjs'
    invalid.write_text('const incomplete = ;\n', encoding='utf-8')
    result['controls'].append({'name': 'invalid JS rejected', **call([shutil.which('node'), '--check', str(invalid)])})
    (d / 'entry.cjs').write_text("require(require('node:path').join(__dirname, 'main.cjs'));\n", encoding='utf-8')
    (d / 'main.cjs').write_text("process.stdout.write('alternative entry resolved\\n');\n", encoding='utf-8')
    result['controls'].append({'name': 'conforming relocated CommonJS entry loads from unrelated cwd', **call([shutil.which('node'), str(d / 'entry.cjs')], cwd=str(OUT))})
    try:
        tomllib.loads('[judge]\ntimeout=1\ntimeout=2\n')
        result['controls'].append({'name': 'duplicate TOML key', 'rejected': False})
    except tomllib.TOMLDecodeError as e:
        result['controls'].append({'name': 'duplicate TOML key', 'rejected': True, 'error': str(e)})
    result['controls'].append({'name': 'CRLF caught independently of bash parser', 'cr_bytes': b'#!/bin/bash\r\necho ok\r\n'.count(b'\r')})

index = json.loads((RUN / 'raw-evidence-index.json').read_text())
by_path = {e['path']: e for e in index['entries']}
cited = [
    'verification-local.json',
    'local/inspect-configured.py',
    'local/configured-inspection/results.json',
    'local/configured-inspection.log',
    'local/install-lifecycle.py',
    'local/install-lifecycle/results.json',
    'local/install-lifecycle/app.log',
    'local/install-lifecycle/restart/app-restart.log',
]
result['evidence_hashes'] = []
for relative in cited:
    p = RUN / relative
    rel = p.relative_to(ROOT).as_posix()
    expected = by_path[rel]['sha256']
    result['evidence_hashes'].append({'path': rel, 'expected': expected, 'actual': sha(p), 'matches': expected == sha(p)})
inspection = json.loads((RUN / 'local/configured-inspection/results.json').read_text())
result['inspection_source_binding'] = [{'path': p, 'matches': sha(TASK / 'tests' / p) == h} for p, h in inspection['tests_sha256'].items()]
lifecycle = json.loads((RUN / 'local/install-lifecycle/results.json').read_text())
result['lifecycle_source_binding'] = [{'path': p, 'matches': sha(TASK / 'solution/app' / p) == h} for p, h in lifecycle['solution_app_sha256'].items()]
result['frozen_pycache'] = [p.relative_to(CACHE).as_posix() for p in CACHE.rglob('__pycache__')]
out = OUT / 'parse-results.json'
out.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({'output': out.relative_to(ROOT).as_posix(), 'sha256': sha(out), 'frozen_hashes': bound, 'engine_drift': result['engine_drift'], 'counts': {k: len(result[k]) for k in ['toml','json','shell','javascript','python','embedded']}, 'failed_checks': [r for k in ['toml','json','shell','javascript','python','embedded'] for r in result[k] if r.get('parsed') is False or r.get('exit_code', 0) != 0], 'evidence_hashes_match': all(r['matches'] for r in result['evidence_hashes']), 'frozen_pycache': result['frozen_pycache']}, indent=2))
