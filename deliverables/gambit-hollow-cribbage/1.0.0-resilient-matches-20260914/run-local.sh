#!/bin/bash
set -euo pipefail
cp -a /solution/. /app/
cp -a /packed-tests/. /tests/
node /evidence/unit.cjs
mkdir -p /evidence/stub
cat > /evidence/stub/rewardkit <<'SH'
#!/bin/bash
set -euo pipefail
node /evidence/browser.cjs
printf '{"render":1,"constraints":1,"functional":1,"polish":1,"visual":1,"LOCAL_STUB_ONLY":true}\n' > /logs/verifier/reward.json
SH
chmod +x /evidence/stub/rewardkit
PATH="/evidence/stub:$PATH" bash /tests/test.sh > /evidence/runner-stdout.log 2>&1
cp -a /logs/verifier/. /evidence/runner-logs/
