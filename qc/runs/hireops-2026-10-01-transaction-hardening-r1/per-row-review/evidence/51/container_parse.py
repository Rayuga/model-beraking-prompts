"""Actual image parsers; frozen task mounted read-only, no provider or app launch."""
import ast, hashlib, json, subprocess, tomllib
from pathlib import Path

root = Path('/input')
records = []
for p in sorted(root.rglob('*')):
    if not p.is_file():
        continue
    b = p.read_bytes()
    row = {'path': p.relative_to(root).as_posix(), 'sha256': hashlib.sha256(b).hexdigest()}
    if p.suffix == '.js':
        command = ['node', '--check', str(p)]
    elif p.suffix == '.sh':
        command = ['bash', '-n', str(p)]
        row['cr_bytes'] = b.count(b'\r')
    elif p.suffix == '.toml':
        tomllib.loads(b.decode('utf-8'))
        row['parsed'] = True
        records.append(row)
        continue
    elif p.suffix == '.json':
        json.loads(b.decode('utf-8'))
        row['parsed'] = True
        records.append(row)
        continue
    elif p.suffix == '.py':
        ast.parse(b.decode('utf-8'))
        row['parsed'] = True
        records.append(row)
        continue
    else:
        continue
    r = subprocess.run(command, capture_output=True, text=True, timeout=15)
    row.update(command=command, exit_code=r.returncode, stdout=r.stdout, stderr=r.stderr)
    records.append(row)
versions = {name: subprocess.check_output([name, '--version'], text=True) for name in ['node', 'bash', 'python3']}
print(json.dumps({'scope':'Actual verifier image syntax only; no provider calls', 'versions': versions, 'records': records}, indent=2))
