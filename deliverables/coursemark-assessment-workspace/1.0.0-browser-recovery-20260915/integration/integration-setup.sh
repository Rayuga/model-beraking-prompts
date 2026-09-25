#!/bin/bash
set -euo pipefail
mkdir -p /app /tests /assets/artifacts /logs/verifier /transport-bin
cp -a /source/tests/. /tests/
cp /source/environment/assets/artifacts/coursemark_seed.json /assets/artifacts/coursemark_seed.json
bash /source/solution/solve.sh
cp /evidence/fake-codex-integration.py /transport-bin/codex
chmod +x /transport-bin/codex
REWARDKIT_JUDGE=codex REWARDKIT_MODEL=gpt-5.6-luna REWARDKIT_REASONING_EFFORT=max PATH="/transport-bin:$PATH" bash /tests/test.sh
cp -a /logs/verifier/. /evidence/integration-logs/
python3 - <<'PY'
import json
from pathlib import Path
root = Path('/logs/verifier')
reward = json.loads((root / 'reward.json').read_text())
assert reward['graded'] == 1 and reward['no_op'] == 0
dimensions = {'render', 'constraints', 'functional', 'polish', 'visual'}
assert {json.loads(line)['dimension'] for line in (root / 'evidence/checkpoints.jsonl').read_text().splitlines()} == dimensions
metadata = [json.loads(path.read_text()) for path in (root / 'judge-traces').glob('*.json') if path.name not in ('started.json', 'session-export.json')]
assert {record['dimension'] for record in metadata} == dimensions
stdout = list((root / 'judge-traces').glob('*.stdout.log'))
stderr = list((root / 'judge-traces').glob('*.stderr.log'))
assert len(stdout) == len(stderr) == 5
assert all('Synthetic schema transport validation only' in path.read_text() for path in stdout)
assert all('Synthetic tool checkpoint:' in path.read_text() for path in stderr)
assert json.loads((root / 'judge-traces/session-export.json').read_text())['exported'] == 5
assert len(json.loads((root / 'ctrf.json').read_text())['tests']) == 5
provenance = json.loads((root / 'prompt-provenance.json').read_text())
assert len(provenance['evidence_helper_sha256']) == 64
report = {'passed': True, 'scope': 'Real RewardKit discover/judge/postprocessor with a synthetic Codex schema fixture; no product observations or model scores', 'dimensions': sorted(dimensions), 'stdout_streams': len(stdout), 'stderr_streams': len(stderr), 'exported_session_fixtures': 5, 'provenance': provenance}
Path('/evidence/integration-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('PASS real RewardKit integration with synthetic transport fixture; no model evaluation')
PY
