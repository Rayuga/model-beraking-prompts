#!/bin/bash
set -euo pipefail
cp -a /source-task/tests/. /tests/
cp /local-evidence/harness_rewardkit_stub.py /usr/local/bin/rewardkit
chmod +x /usr/local/bin/rewardkit
mkdir -p /app/public
if [[ "$HARNESS_CASE" == "golden" ]]; then
  cp -a /source-task/solution/app/. /app/
elif [[ "$HARNESS_CASE" != "missing_app" ]]; then
  cp /local-evidence/relative_server.js /app/server.js
  printf '%s\n' '<html><title>Relative CWD fixture</title>relative-path-proof</html>' >/app/public/index.html
fi
cd /tests
bash -n /tests/test.sh
bash /tests/test.sh
python3 - <<'PY'
import json,os
from pathlib import Path
root=Path('/logs/verifier')
result=json.loads((root/'reward.json').read_text())
case=os.environ['HARNESS_CASE']
print((root/'scored/rewardkit.log').read_text() if (root/'scored/rewardkit.log').exists() else 'No scored log')
assert result['reward']==(0 if case in ('missing_app','gate_failure') else 1),result
if case=='missing_app': assert result['graded']==0 and result['no_op']==1
if case=='gate_failure': assert not (root/'scored').exists()
for f in root.glob('*/local-stub-evidence.json'): print(f.read_text())
print(json.dumps({'case':case,'harness_passed':True,'synthetic_reward':result,'paid_judge_exercised':False}))
PY
