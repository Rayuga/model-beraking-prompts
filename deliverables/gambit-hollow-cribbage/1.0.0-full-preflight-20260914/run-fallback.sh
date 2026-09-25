#!/bin/bash
set -euo pipefail
cp -a /packed-tests/. /tests/
mkdir -p /evidence/fallback-stub
cat > /evidence/fallback-stub/rewardkit <<'SH'
#!/bin/bash
set -euo pipefail
node /evidence/fallback-probe.cjs
printf '{"render":1,"constraints":1,"functional":1,"polish":1,"visual":1,"LOCAL_STUB_ONLY":true}\n' > /logs/verifier/reward.json
SH
chmod +x /evidence/fallback-stub/rewardkit
PATH="/evidence/fallback-stub:$PATH" bash /tests/test.sh > /evidence/readonly-fallback-runner.log 2>&1
cp -a /logs/verifier/. /evidence/readonly-fallback-logs/
python3 - <<'PY'
import json
assert json.load(open('/evidence/readonly-fallback-results.json'))['passed']
assert json.load(open('/logs/verifier/reward.json'))['LOCAL_STUB_ONLY']
print('Read-only fallback checks passed; injected dimensions are not Oracle results.')
PY
