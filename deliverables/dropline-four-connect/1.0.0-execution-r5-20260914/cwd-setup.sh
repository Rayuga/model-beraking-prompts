#!/bin/bash
set -euo pipefail
mkdir -p /tests /app /local-bin
cp -a /source/tests/. /tests/
if [[ ! -e /app/server.js ]]; then cp -a /evidence/cwd-fixture/. /app/; fi
cp /evidence/cwd-rewardkit /local-bin/rewardkit
chmod +x /local-bin/rewardkit
cd /tests
PATH="/local-bin:$PATH" bash /tests/test.sh
python3 - <<'PY'
import json
from pathlib import Path
assert json.loads(Path('/logs/verifier/reward.json').read_text())['reward']==.58
print('PASS real runner and two restarts with relative-path app; synthetic reward only')
PY
