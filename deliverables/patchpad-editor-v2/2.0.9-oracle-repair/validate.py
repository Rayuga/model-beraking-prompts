import json
from pathlib import Path
import subprocess
subprocess.run(['python3','/hardening/validate-release.py'],check=True)
subprocess.run(['python3','/results/targeted.py'],check=True)
assert all(c['passed'] for c in json.loads(Path('/results/targeted-after.json').read_text())['results'])
print('PASS final-source regression suites and targeted Oracle reproduction; no model calls')
