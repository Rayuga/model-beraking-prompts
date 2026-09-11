"""Record pre-change source and scoring contract, without modifying task files."""
from pathlib import Path
import hashlib, json, tomllib
out = Path(__file__).resolve().parent
root = next(p for p in out.parents if (p / 'projects').is_dir())
task = root / 'projects/gridforge-spreadsheet-v2'
data = {'version': tomllib.loads((task/'task.toml').read_text())['task']['version'],
        'hashes': {p.relative_to(task).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                   for p in task.rglob('*') if p.is_file()},
        'judges': {p.parent.name: tomllib.loads(p.read_text(encoding='utf-8'))
                   for p in (task/'tests').glob('*/judge.toml')}}
target = out/'baseline.json'
assert not target.exists(), 'Historical baseline must not be overwritten'
target.write_text(json.dumps(data, indent=2), encoding='utf-8')
print(data['version'], len(data['hashes']))
