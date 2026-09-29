import json
import subprocess
import sys
from pathlib import Path

root = Path.cwd()
out = Path(__file__).resolve().parent
old = root / 'deliverables/colderwater-playground-devtools/instruction-hygiene-fix-2026-09-26/archive-check-d250db516a70/colderwater-playground-devtools'
destination = out / 'known-bad-package-attempt'
assert not destination.exists(), 'Use a fresh attempt path; do not overwrite evidence'
result = subprocess.run([sys.executable, '-X', 'utf8', str(root / 'deliverables/package_staged_candidates.py'), str(old), '--out', str(destination)], text=True, capture_output=True)
expected = 'Packaging blocked: inspect internal grading terms in public instructions: verifier'
passed = result.returncode != 0 and expected in result.stderr and not destination.exists()
report = {'scope': 'Known-bad prior uploaded archive must be rejected before an output directory or ZIP is created.',
          'passed': passed, 'returncode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr,
          'output_created': destination.exists(), 'old_task_path': str(old.relative_to(root))}
(out / 'packaging_guard_regression.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
if not passed:
    raise SystemExit(1)
