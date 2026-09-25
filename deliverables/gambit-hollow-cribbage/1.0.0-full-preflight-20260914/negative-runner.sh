#!/bin/bash
set -euo pipefail
mkdir -p /evidence/negative-stub
cat > /evidence/negative-stub/rewardkit <<'SH'
#!/bin/bash
set -euo pipefail
if [[ "$LOCAL_TEST_CASE" == failure ]]; then exit 7; fi
case "$LOCAL_TEST_CASE" in
  missing) value='{"render":1,"constraints":1}' ;;
  nan) value='{"render":1,"constraints":1,"functional":NaN,"polish":1,"visual":1}' ;;
  boolean) value='{"render":1,"constraints":1,"functional":true,"polish":1,"visual":1}' ;;
  render_gate) value='{"render":0,"constraints":1,"functional":1,"polish":1,"visual":1}' ;;
  constraints_gate) value='{"render":1,"constraints":0,"functional":1,"polish":1,"visual":1}' ;;
  weighted) value='{"render":1,"constraints":1,"functional":0.5,"polish":0.8,"visual":0.3}' ;;
esac
printf '%s\n' "$value" > "$VERIFIER_LOG_DIR/reward.json"
SH
chmod +x /evidence/negative-stub/rewardkit
for probe in failure missing nan boolean render_gate constraints_gate weighted; do
  LOCAL_TEST_CASE="$probe" VERIFIER_LOG_DIR="/logs/$probe" PATH="/evidence/negative-stub:$PATH" bash /tests/test.sh > "/evidence/negative-$probe.log" 2>&1
done
python3 - <<'PY'
import json
from pathlib import Path
out=[]
for name in ('failure','missing','nan','boolean','render_gate','constraints_gate','weighted'):
    value=json.loads(Path('/logs',name,'reward.json').read_text())
    expected=.52 if name=='weighted' else 0
    assert value['reward']==expected,(name,value)
    assert float(Path('/logs',name,'reward.txt').read_text())==expected
    out.append({'case':name,'expected_reward':expected,'actual_reward':value['reward'],'passed':True})
Path('/evidence/negative-runner-results.json').write_text(json.dumps({'kind':'injected judge outputs for orchestration checks, not Oracle scores','results':out},indent=2))
print('PASS seven runner failure, validation, gate and weighting cases')
PY
