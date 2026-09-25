#!/usr/bin/env python3
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

arguments = sys.argv[1:]
if not arguments or arguments[0] != 'exec':
    print('synthetic Codex transport fixture')
    raise SystemExit(0)
prompt = arguments[1]
dimension = re.search(r'Prompt version: coursemark-assessment-workspace-(render|constraints|functional|polish|visual)-', prompt).group(1)
schema = json.loads(Path(arguments[arguments.index('--output-schema') + 1]).read_text())
result = {}
for name, entry in schema['properties'].items():
    score = entry['properties']['score']
    value = max(score['enum']) if 'enum' in score else score.get('maximum', 1)
    result[name] = {'score': value, 'reasoning': 'Synthetic schema transport validation only; no product observation or model grade.'}
payload = {'outcome': 'incomplete', 'fixture': True, 'note': 'Actual RewardKit invocation reached a synthetic CLI fixture; no product evidence is claimed.'}
record = subprocess.run([sys.executable, '/tests/evidence.py', 'record', dimension, '_gate', 'transport-fixture'], input=json.dumps(payload), text=True, capture_output=True, check=True)
print('Synthetic tool checkpoint: ' + record.stdout.strip(), file=sys.stderr, flush=True)
sessions = Path.home() / '.codex' / 'sessions' / 'transport-fixture'
sessions.mkdir(parents=True, exist_ok=True)
(sessions / f'rollout-{dimension}-{time.time_ns()}.jsonl').write_text(json.dumps({'type': 'response_item', 'payload': {'type': 'function_call_output', 'output': record.stdout, 'synthetic_fixture': True}}) + '\n')
print(json.dumps(result), flush=True)
