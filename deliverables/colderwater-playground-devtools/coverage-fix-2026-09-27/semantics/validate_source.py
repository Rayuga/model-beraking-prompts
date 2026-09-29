from pathlib import Path
from decimal import Decimal
import hashlib
import json
import re
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / 'projects/colderwater-playground-devtools'
BASE = ROOT / 'deliverables/colderwater-playground-devtools/positive-controls-fix-2026-09-27/review-candidate/colderwater-playground-devtools.zip'
assert hashlib.sha256(BASE.read_bytes()).hexdigest() == '663e4d6df66f951662e13d4a365cd2c72f83fba29c9e42998b58cd2bf023013e'
FILES = ['tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md', 'tests/app_context.md']
prefix = 'colderwater-playground-devtools/'
with zipfile.ZipFile(BASE) as z:
    prior = {n[len(prefix):]: z.read(n) for n in z.namelist() if n.startswith(prefix) and not n.endswith('/')}
before = tomllib.loads(prior[FILES[0]].decode())['criterion']
after = tomllib.loads((SOURCE / FILES[0]).read_text(encoding='utf-8'))['criterion']

def groups(rows):
    d = {}
    for row in rows:
        scenario = row['description'].split('.', 1)[0]
        d[scenario] = d.get(scenario, Decimal(0)) + Decimal(str(row['weight']))
    return d

bg, ag = groups(before), groups(after)
assert len(after) == 93
assert len({r['id'] for r in after}) == 93
assert all(r['type'] == 'binary' and Decimal(str(r['weight'])) > 0 for r in after)
assert sum(ag.values()) == Decimal('49.50')
assert bg == ag
assert len(bg) == 37
old = {r['id']: r for r in before}
new = {r['id']: r for r in after}
changed = [r['id'] for r in after if r['id'] in old and r != old[r['id']]]
added = [r['id'] for r in after if r['id'] not in old]
removed = [r['id'] for r in before if r['id'] not in new]
changed_files = [n for n, data in prior.items() if (SOURCE / n).exists() and (SOURCE / n).read_bytes() != data]
missing = [n for n in prior if not (SOURCE / n).exists()]
result = {
    'status': 'Static inventory checks pass; semantic review and runtime evidence separately scoped',
    'baseline_archive_sha256': hashlib.sha256(BASE.read_bytes()).hexdigest(),
    'source_hashes': {n: hashlib.sha256((SOURCE / n).read_bytes()).hexdigest() for n in FILES},
    'rows': len(after), 'weight': str(sum(ag.values())), 'all_37_feature_budgets_equal': bg == ag,
    'feature_subtotals': {k: str(v) for k, v in sorted(ag.items())},
    'changed_existing_criteria': changed, 'added_ids': added, 'removed_ids': removed,
    'changed_files_against_663e': changed_files, 'missing_files_against_663e': missing,
    'claims': {'runtime_test': False, 'provider_test': False, 'full_run_timing_fit': 'Not exercised', 'all_qc_pass': False}
}
(OUT / 'source_inventory.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
