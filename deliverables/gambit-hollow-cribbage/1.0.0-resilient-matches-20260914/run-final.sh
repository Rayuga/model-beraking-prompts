#!/bin/bash
set -euo pipefail
cp -a /solution/. /app/
cp -a /packed-tests/. /tests/
node /evidence/unit.cjs
mkdir -p /evidence/final-stub
cat > /evidence/final-stub/rewardkit <<'SH'
#!/bin/bash
set -euo pipefail
node /evidence/browser.cjs
node /evidence/resilience.cjs
printf '{"render":1,"constraints":1,"functional":1,"polish":1,"visual":1,"LOCAL_STUB_ONLY":true}\n' > /logs/verifier/reward.json
SH
chmod +x /evidence/final-stub/rewardkit
PATH="/evidence/final-stub:$PATH" bash /tests/test.sh > /evidence/final-runner.log 2>&1
cp -a /logs/verifier/. /evidence/final-runner-logs/
bash /evidence/negative-runner.sh
python3 - <<'PY'
import json, hashlib
from pathlib import Path
for name, count in [('browser-results.json',22),('resilience-results.json',9),('unit-results.json',11),('negative-runner-results.json',7)]:
    result=json.loads(Path('/evidence',name).read_text())
    rows=result['results'] if isinstance(result,dict) else result
    assert len(rows)==count and all(r['passed'] for r in rows),(name,result)
expected=json.loads(Path('/evidence/source-sha256.json').read_text())
for name,sha in expected.items():
    if name.startswith('solution/'):
        path=Path('/solution',name.removeprefix('solution/'))
    elif name.startswith('tests/'):
        path=Path('/packed-tests',name.removeprefix('tests/'))
    else:
        continue
    assert hashlib.sha256(path.read_bytes()).hexdigest()==sha,name
print('PASS frozen source verification; all deterministic groups passed. No LLM Oracle score was generated.')
PY
