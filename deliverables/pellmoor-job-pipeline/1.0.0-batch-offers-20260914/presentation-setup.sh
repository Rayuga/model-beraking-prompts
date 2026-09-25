#!/bin/bash
set -euo pipefail
mkdir -p /app /tests /logs/verifier /local-bin /recruitment/records
cp -a /source/tests/. /tests/
cp /source/tests/pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json
chmod -R a+rX /recruitment
bash /source/solution/solve.sh
cat > /local-bin/rewardkit <<'SH'
#!/bin/bash
set -euo pipefail
node /evidence/batch-presentation.cjs
python3 - <<'PY'
import json
from pathlib import Path
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1,constraints=1,functional=.5,polish=.8,visual=.6)))
PY
SH
chmod +x /local-bin/rewardkit
PATH="/local-bin:$PATH" bash /tests/test.sh
mkdir -p /evidence/presentation-logs
cp -a /logs/verifier/. /evidence/presentation-logs/
python3 - <<'PY'
import json
from pathlib import Path
assert json.loads(Path('/logs/verifier/reward.json').read_text())['reward']==.58
print('PASS read-only batch presentation; synthetic reward is not an Oracle score')
PY
