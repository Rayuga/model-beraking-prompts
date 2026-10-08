#!/usr/local/bin/python3
import json,urllib.request
from pathlib import Path
with urllib.request.urlopen('http://127.0.0.1:3000/',timeout=4) as response:
    observation=json.load(response)
Path('/probe-observation.json').write_text(json.dumps(observation))
raise SystemExit(19)
