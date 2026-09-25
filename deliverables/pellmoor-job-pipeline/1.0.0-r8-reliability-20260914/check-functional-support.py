from pathlib import Path
import copy
import hashlib
import json
import subprocess
import sys
import tempfile
import tomllib

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
SOURCE = ROOT / 'projects/pellmoor-job-pipeline/tests/functional'
BASELINE = OUT.parent / '1.0.0-evidence-reliability-20260914/task/pellmoor-job-pipeline/tests/functional/judge.toml'
namespace = {'__name__': 'ledger_check'}
ledger = SOURCE / 'receipt-ledger.py'
exec(compile(ledger.read_text(), str(ledger), 'exec'), namespace)
validate = namespace['validate']
base = {'actor': 'hiring@pellmoor.test', 'method': 'POST', 'url': 'http://localhost:3000/example', 'operation_id': 'synthetic-validation-only', 'request_headers': {}, 'request_body': '{"example":1}', 'status': 200, 'response_body': '{"example":true}', 'before': {'revision': 1}, 'after': {'revision': 2}}
results = []
for name, changes in [('wrong actor', {'actor': 'coord@pellmoor.test'}), ('boolean status', {'status': True}), ('wrong status class', {'status': 409}), ('malformed request', {'request_body': '{'}), ('missing checkpoint', {'before': {}}), ('missing headers', {'request_headers': None})]:
    record = copy.deepcopy(base)
    record.update(changes)
    try:
        validate('batch_ac_success', record)
    except (ValueError, TypeError):
        results.append({'check': name, 'passed': True})
    else:
        raise AssertionError(name)
for actor in namespace['ACTORS']:
    validate('legacy_note_success', {**base, 'actor': actor})
try:
    validate('legacy_note_success', {**base, 'actor': 'forged@example.test'})
except ValueError:
    results.append({'check': 'legacy note accepts genuine documented actors only', 'passed': True})
else:
    raise AssertionError('Forged legacy actor')
with tempfile.TemporaryDirectory(prefix='pellmoor-r8-ledger-') as temporary:
    temp = Path(temporary)
    capture = temp / 'capture.json'
    command = [sys.executable, str(ledger), '--directory', str(temp / 'ledger')]
    for label, (actor, success) in namespace['LABELS'].items():
        if label.startswith('legacy_'):
            continue
        record = {**base, 'actor': actor, 'status': 200 if success else 409, 'operation_id': label}
        if not success:
            record['after'] = record['before']
        capture.write_text(json.dumps(record))
        subprocess.run(command + ['put', label, str(capture)], check=True, capture_output=True)
    result = subprocess.run(command + ['check'], check=True, capture_output=True, text=True)
    parsed = json.loads(result.stdout)
    assert parsed['scope'] == 'persistence' and parsed['complete'] and len(parsed['saved']) == 6
    results.append({'check': 'six original persistence receipts remain independently complete', 'passed': True})
    result = subprocess.run(command + ['check', '--scope', 'legacy'], capture_output=True, text=True)
    assert result.returncode == 1 and len(json.loads(result.stdout)['missing']) == 3
    results.append({'check': 'missing legacy checkpoint cannot be credited by persistence files', 'passed': True})
    for label, (actor, success) in namespace['LABELS'].items():
        if not label.startswith('legacy_'):
            continue
        record = {**base, 'actor': actor or 'panel2@pellmoor.test', 'status': 200 if success else 409, 'operation_id': label}
        if not success:
            record['after'] = record['before']
        capture.write_text(json.dumps(record))
        subprocess.run(command + ['put', label, str(capture)], check=True, capture_output=True)
    result = subprocess.run(command + ['check', '--scope', 'all'], check=True, capture_output=True, text=True)
    assert len(json.loads(result.stdout)['saved']) == 9
    results.append({'check': 'all nine distinct original receipts can be recorded', 'passed': True})
    original = (temp / 'ledger/legacy_stage_rejection.json').read_bytes()
    subprocess.run(command + ['put', 'legacy_stage_rejection', str(capture)], check=True, capture_output=True)
    capture.write_text(json.dumps({**record, 'operation_id': 'replacement-operation'}))
    result = subprocess.run(command + ['put', 'legacy_stage_rejection', str(capture)], capture_output=True)
    assert result.returncode != 0
    assert (temp / 'ledger/legacy_stage_rejection.json').read_bytes() == original
    results.append({'check': 'same legacy capture stable and replacement refused', 'passed': True})
before = tomllib.loads(BASELINE.read_text())['criterion']
after = tomllib.loads((SOURCE / 'judge.toml').read_text())['criterion']
identity = lambda rows: [(row['id'], row['name'], row['type'], row['weight']) for row in rows]
assert identity(before) == identity(after)
assert len(after) == 40 and sum(row['weight'] for row in after) == 98
results.append({'check': 'all 40 Functional criteria identities, types and total 98 weight unchanged', 'passed': True})
report = {'scope': 'Synthetic ledger validation and criterion-contract comparison only; no product scoring', 'passed': True, 'results': results, 'files': {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() for name in ('prompt.md', 'judge.toml', 'receipt-ledger.py', 'preserve-primary.js', 'capture-loss.js')}}
(OUT / 'functional-support-checks.json').write_text(json.dumps(report, indent=2))
print('PASS', len(results), 'functional support checks')
