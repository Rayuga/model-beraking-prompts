"""Create hash-bound scripted proof inputs for the repaired candidate."""
from pathlib import Path
import hashlib
import json
import re
import sys
import tomllib

root = Path.cwd()
here = Path(__file__).resolve().parent
task = root/'projects/colderwater-playground-devtools'
sys.path.insert(0, str(root/'scripts'))
from check_colderwater_current import check_task
from qc_pipeline import preflight

prompt = (task/'tests/scored/functional/prompt.md').read_text(encoding='utf-8')
criteria = tomllib.loads((task/'tests/scored/functional/judge.toml').read_text(encoding='utf-8'))['criterion']
scenarios = {
    m[1]: {'protocol': m[0]}
    for m in re.finditer(r'^### (S\d+)\b.*?(?=^### S|^## Binary outcome)', prompt, re.S|re.M)
}
inputs = {
    'binding_note': 'Current full-install scripted proof inputs; not configured judge evidence',
    'criteria': criteria,
    'scenarios': scenarios,
    'source_hashes': {
        f.relative_to(task).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest()
        for f in task.rglob('*') if f.is_file()
    },
}
guards = check_task(task)
preflight_result = preflight(task, root/'projects/webdev-task-template')
inputs['freeze_confirmed'] = guards['passed'] and preflight_result['passed']
for name, value in [
    ('proof-inputs.json', inputs),
    ('source-guards.json', guards),
    ('preflight.json', preflight_result),
]:
    (here/name).write_text(json.dumps(value, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'criteria': len(criteria), 'source_guards': guards['passed'], 'preflight': preflight_result}))
