#!/bin/bash
set -euo pipefail
mkdir -p /tests /logs/verifier
cp -a /source/tests/. /tests/
bash /tests/test.sh
mkdir -p /evidence/noop-logs
cp -a /logs/verifier/. /evidence/noop-logs/
python3 - <<'PY'
import json
from pathlib import Path
data=json.loads(Path('/logs/verifier/reward.json').read_text())
assert data['reward']==0 and data['no_op']==1 and data['graded']==0
assert all(data[k]==0 for k in ['render','constraints','functional','polish','visual'])
print('PASS no-op: reward 0, graded 0, no_op 1')
PY
