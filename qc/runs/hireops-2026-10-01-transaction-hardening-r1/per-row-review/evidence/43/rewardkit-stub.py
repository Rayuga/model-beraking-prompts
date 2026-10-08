#!/usr/local/bin/python3
"""Local synthetic transport: no provider call and no app judgment."""
import json
import os
import sys
from pathlib import Path

output = Path(sys.argv[sys.argv.index('--output') + 1])
suite = Path(sys.argv[-1]).name
case = json.loads(os.environ['ROW43_CASE'])
with (Path(os.environ['VERIFIER_LOG_DIR']) / 'suite-invocations.jsonl').open('a') as f:
    f.write(json.dumps({'suite': suite, 'argv': sys.argv[1:]}) + '\n')
output.write_text(json.dumps(case[suite]) + '\n')
