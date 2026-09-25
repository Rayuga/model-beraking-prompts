#!/bin/bash
set -euo pipefail
cp -a /packed-tests/. /tests/
if [[ "$CWD_CASE" != readonly ]]; then cp -a /solution/. /app/; fi
mkdir -p /tmp/cwd-stub
cat > /tmp/cwd-stub/rewardkit <<'SH'
#!/bin/bash
set -euo pipefail
node /evidence/cwd-probe.cjs
printf '{"render":1,"constraints":1,"functional":1,"polish":1,"visual":1,"LOCAL_STUB_ONLY":true}\n' > /logs/verifier/reward.json
SH
chmod +x /tmp/cwd-stub/rewardkit
cd /tests
PATH="/tmp/cwd-stub:$PATH" bash /tests/test.sh > "/evidence/cwd-$CWD_CASE-runner.log" 2>&1
cp -a /logs/verifier/. "/evidence/cwd-$CWD_CASE-logs/"
python3 - <<'PY'
import json,os
assert json.load(open('/evidence/cwd-'+os.environ['CWD_CASE']+'-results.json'))['passed']
assert json.load(open('/logs/verifier/reward.json'))['LOCAL_STUB_ONLY']
print('PASS '+os.environ['CWD_CASE']+' runtime contract regression (injected judge inputs only)')
PY
