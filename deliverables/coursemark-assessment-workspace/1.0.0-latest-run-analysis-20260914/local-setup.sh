#!/bin/bash
set -euo pipefail
mkdir -p /app /tests /assets/artifacts /logs/verifier /local-bin
cp -a /source/tests/. /tests/
cp /source/environment/assets/artifacts/coursemark_seed.json /assets/artifacts/coursemark_seed.json
mkdir -p /app/public
cp -a /oracle-artifact/. /app/
cp /assets/artifacts/coursemark_seed.json /app/seed_data.json
cp /evidence/rewardkit /local-bin/rewardkit
chmod +x /local-bin/rewardkit
if [[ ! -x /usr/local/bin/chromium ]]; then
  browser_path="$(find /opt/playwright-browsers -type f -name chrome | head -n 1)"
  test -n "$browser_path"
  ln -s "$browser_path" /usr/local/bin/chromium
fi
for script in /tests/test.sh /tests/app-lifecycle.sh /source/solution/solve.sh; do bash -n "$script"; done
for script in /app/server.js /app/outcomes.js /app/public/app.js /app/public/outcomes.js /evidence/regressions.cjs /evidence/outcome-regressions.cjs; do node --check "$script"; done
PATH="/local-bin:$PATH" bash /tests/test.sh
cp -a /logs/verifier/. /evidence/runner-logs/
python3 - <<'PY'
import json
from pathlib import Path
assert json.loads(Path('/logs/verifier/reward.json').read_text())['reward'] == .58
assert json.loads(Path('/logs/verifier/ctrf.json').read_text())['summary']['total'] == 5
print('PASS syntax and actual runner synthetic reward/CTRF; not an Oracle score')
PY
