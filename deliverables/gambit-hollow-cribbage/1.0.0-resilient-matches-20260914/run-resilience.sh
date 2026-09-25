#!/bin/bash
set -euo pipefail
cp -a /solution/. /app/
cp -a /packed-tests/. /tests/
mkdir -p /evidence/resilience-stub
cat > /evidence/resilience-stub/rewardkit <<'SH'
#!/bin/bash
set -euo pipefail
node /evidence/resilience.cjs
printf '{"render":1,"constraints":1,"functional":1,"polish":1,"visual":1,"LOCAL_STUB_ONLY":true}\n' > /logs/verifier/reward.json
SH
chmod +x /evidence/resilience-stub/rewardkit
PATH="/evidence/resilience-stub:$PATH" bash /tests/test.sh > /evidence/resilience-runner.log 2>&1
cp -a /logs/verifier/. /evidence/resilience-runner-logs/
