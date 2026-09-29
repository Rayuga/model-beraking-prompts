import json
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
root = Path.cwd()
out = Path(__file__).resolve().parent
sys.path.insert(0, str(root / 'scripts'))
from check_public_network_policy import scan_task

cases = [
    ('current template', root / 'projects/webdev-task-template', True),
    ('corrected Ridgeline', root / 'projects/ridgeline-print-storefront', True),
    ('corrected Colderwater', root / 'projects/colderwater-playground-devtools', True),
    ('old Ridgeline', root / 'deliverables/ridgeline-print-storefront/rubric-fix-2026-09-26/archive-check-f8a9b605699d/ridgeline-print-storefront', False),
    ('old Colderwater', root / 'deliverables/colderwater-playground-devtools/rubric-fix-2026-09-26/archive-check-76ab7fb11195/colderwater-playground-devtools', False),
]
results = []
for label, task, expected in cases:
    observed = scan_task(task)
    results.append({'case': label, 'passed': observed['passed'] == expected,
                    'expected_policy_pass': expected, 'observed': observed})
    if not expected:
        forbidden_output = out / ('must-not-package-' + task.name)
        assert not forbidden_output.exists(), forbidden_output
        run = subprocess.run([sys.executable, '-B', str(root / 'deliverables/package_staged_candidates.py'),
                              str(task), '--out', str(forbidden_output)], text=True, capture_output=True)
        results.append({'case': label + ' packager refuses before writing',
                        'passed': run.returncode != 0 and not forbidden_output.exists()
                                  and 'public network profile' in run.stderr,
                        'returncode': run.returncode, 'stderr': run.stderr.strip()})
report = {'scope': 'Narrow public-network regression guard, not complete semantic QC',
          'passed': all(row['passed'] for row in results), 'checks': results}
(out / 'network-regression-results.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': report['passed'], 'checks': len(results)}, indent=2))
raise SystemExit(0 if report['passed'] else 1)
