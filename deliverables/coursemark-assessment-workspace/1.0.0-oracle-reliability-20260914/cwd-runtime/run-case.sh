#!/bin/bash
set -euo pipefail
MODE="${1:?app or relocated}"
export VERIFIER_LOG_DIR="/evidence/cwd-runtime/$MODE-logs"
export COURSEMARK_CWD_CASE="$MODE"
mkdir -p "$VERIFIER_LOG_DIR" /tmp/cwd-fixture-bin /tmp/verifier-cwd /tests
cp -a /source/tests/. /tests/
cp /evidence/cwd-runtime/rewardkit /tmp/cwd-fixture-bin/rewardkit
chmod 755 /tmp/cwd-fixture-bin/rewardkit
if [[ "$MODE" == "app" ]]; then
  mkdir -p /app
  cp -a /evidence/cwd-runtime/fixture/. /app/
fi
cd /tmp/verifier-cwd
export PATH="/tmp/cwd-fixture-bin:$PATH"
bash /tests/test.sh > "$VERIFIER_LOG_DIR/runner.log" 2>&1
python3 - <<'PY'
import json, os
from pathlib import Path
mode=os.environ['COURSEMARK_CWD_CASE']
result=json.loads(Path('/evidence/cwd-runtime/'+mode+'-result.json').read_text())
assert result['passed'], result
assert len(result['assertions']) == 11, result
print(json.dumps(result, indent=2))
PY
