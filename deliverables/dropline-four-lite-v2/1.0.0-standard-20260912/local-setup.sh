#!/bin/bash
set -euo pipefail
mkdir -p /app /tests /logs/verifier /local-bin
cp -a /source/solution/app/. /app/
cp -a /source/tests/. /tests/
cp /source/environment/assets/artifacts/dropline_seed.xlsx /app/seed_data.xlsx
cp /evidence/rewardkit /local-bin/rewardkit
chmod +x /local-bin/rewardkit
for script in /tests/test.sh /tests/app-lifecycle.sh /source/solution/solve.sh; do bash -n "$script"; done
node --check /app/server.js
node --check /evidence/regressions.cjs
PATH="/local-bin:$PATH" bash /tests/test.sh
cp -a /logs/verifier/. /evidence/runner-logs/
python3 - <<'PY'
import json
from pathlib import Path
assert json.loads(Path('/logs/verifier/reward.json').read_text())['reward'] == .58
assert json.loads(Path('/logs/verifier/ctrf.json').read_text())['summary']['total'] == 5
print('PASS synthetic runner formula = 0.58 and CTRF has five dimensions; NOT an Oracle score')
PY
