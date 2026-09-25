#!/bin/bash
set -euo pipefail
mkdir -p /app /tests /logs/verifier /local-bin /recruitment/records
cp -a /source/tests/. /tests/
cp /source/environment/assets/recruitment/records/pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json
chmod -R a+rX /recruitment
python3 /tests/rewardkit-compat.py
bash /source/solution/solve.sh
cp /evidence/rewardkit /local-bin/rewardkit
chmod +x /local-bin/rewardkit
for script in /tests/test.sh /tests/app-lifecycle.sh /source/solution/solve.sh; do bash -n "$script"; done
node --check /app/backend/server.js
node --check /app/backend/rules.js
node --check /evidence/golden-evidence-workflows.cjs
PATH="/local-bin:$PATH" bash /tests/test.sh
mkdir -p /evidence/runner-logs
cp -a /logs/verifier/. /evidence/runner-logs/
python3 - <<'PY'
import json
from pathlib import Path
assert json.loads(Path('/logs/verifier/reward.json').read_text())['reward'] == .58
assert json.loads(Path('/logs/verifier/ctrf.json').read_text())['summary']['total'] == 5
print('PASS synthetic runner formula = 0.58 and CTRF five dimensions; NOT an Oracle score')
PY
