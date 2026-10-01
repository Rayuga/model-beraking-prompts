"""Run three isolated process-restart comparisons with the same frozen drivers."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

out = Path('/evidence')
matrix = out / ('restart-matrix-' + time.strftime('%Y%m%d-%H%M%S', time.gmtime()))
matrix.mkdir()
results = []
cases = ['restart-inventory-control', 'restart-example-duplicates', 'restart-record-corruption']
for case in cases:
    # The main launcher uses its own bounded /tmp root. Run cases in separate
    # temporary locations without deleting any app/evidence belonging to peers.
    case_script = matrix / (case + '.py')
    template = (out / 'drivers/launch_workflow.py').read_text()
    assert template.count("Path('/tmp/cw-structural-workflow')") == 1
    case_script.write_text(template.replace("Path('/tmp/cw-structural-workflow')", "Path('/tmp/" + case + "')"))
    env = dict(os.environ, CW_CASE=case, CW_MANIFEST=os.environ.get('CW_MANIFEST', 'frozen_repair_inputs.json'), PYTHONPATH=str(out / 'drivers'))
    prior_reports = set(out.glob('run-' + case + '-*/RESULTS.json'))
    started = time.monotonic()
    proc = subprocess.run(['python3', str(case_script)], env=env, text=True, capture_output=True, timeout=240)
    log = matrix / (case + '.log')
    log.write_text(proc.stdout + proc.stderr)
    reports = sorted(set(out.glob('run-' + case + '-*/RESULTS.json')) - prior_reports)
    if not reports:
        results.append({'case': case, 'returncode': proc.returncode, 'wall_seconds': time.monotonic() - started, 'passed': False,
                        'log': log.relative_to(out).as_posix(), 'error': 'Focused launcher did not produce a new report; inspect the preserved log'})
        print(json.dumps(results[-1]), flush=True)
        continue
    report_path = reports[-1]
    report = json.loads(report_path.read_text())
    results.append({'case': case, 'returncode': proc.returncode, 'wall_seconds': time.monotonic() - started, 'passed': report.get('passed', False),
                    'expected_fact_vector': report.get('expected_fact_vector'), 'observed_fact_vector': report.get('observed_fact_vector'),
                    'log': log.relative_to(out).as_posix(), 'report': report_path.relative_to(out).as_posix(), 'report_sha256': hashlib.sha256(report_path.read_bytes()).hexdigest()})
    print(json.dumps(results[-1]), flush=True)
summary = {'scope': 'Three independent local browser/MCP restart comparisons; no configured judge or provider score', 'provider_or_platform': False,
           'cases': results, 'passed': all(row['passed'] and row['returncode'] == 0 for row in results)}
(matrix / 'RESULTS.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({'matrix': matrix.name, 'passed': summary['passed']}), flush=True)
if not summary['passed']:
    raise SystemExit(1)
