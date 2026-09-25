from pathlib import Path
import copy
import json
import subprocess
import sys
import tempfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
HELPER = ROOT / 'projects/pellmoor-job-pipeline/tests/functional/receipt-ledger.py'
namespace = {'__name__': 'ledger_check'}
exec(compile(HELPER.read_text(), str(HELPER), 'exec'), namespace)
validate = namespace['validate']
base = {'actor': 'hiring@pellmoor.test', 'method': 'POST', 'url': 'http://localhost:3000/example', 'operation_id': 'synthetic-ledger-unit-only', 'request_headers': {}, 'request_body': '{"example":1}', 'status': 200, 'response_body': '{"example":true}', 'before': {'revision': 1}, 'after': {'revision': 2}}
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
with tempfile.TemporaryDirectory(prefix='pellmoor-ledger-check-') as temporary:
    temp = Path(temporary)
    capture = temp / 'capture.json'
    capture.write_text(json.dumps(base))
    command = [sys.executable, str(HELPER), '--directory', str(temp / 'ledger')]
    subprocess.run(command + ['put', 'batch_ac_success', str(capture)], check=True, capture_output=True)
    original = (temp / 'ledger/batch_ac_success.json').read_bytes()
    subprocess.run(command + ['put', 'batch_ac_success', str(capture)], check=True, capture_output=True)
    changed = {**base, 'operation_id': 'replacement-operation'}
    capture.write_text(json.dumps(changed))
    result = subprocess.run(command + ['put', 'batch_ac_success', str(capture)], capture_output=True)
    assert result.returncode != 0
    assert (temp / 'ledger/batch_ac_success.json').read_bytes() == original
    results.append({'check': 'separate-process duplicate is stable and replacement is refused', 'passed': True})
    result = subprocess.run(command + ['check'], capture_output=True, text=True)
    assert result.returncode == 1 and len(json.loads(result.stdout)['missing']) == 5
    results.append({'check': 'incomplete evidence cannot be reported complete', 'passed': True})
report = {'scope': 'Synthetic ledger validation only; no product evidence or scores', 'results': results, 'passed': True}
(OUT / 'ledger-checks.json').write_text(json.dumps(report, indent=2))
print('PASS', len(results), 'ledger validation checks')
