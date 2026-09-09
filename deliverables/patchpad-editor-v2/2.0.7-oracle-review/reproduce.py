"""Fresh targeted regression evidence. No LLM invocation or source repairs."""
import json
import subprocess
from pathlib import Path

for script in ('/validation/oracle-failures-regression.cjs','/previous/additional-regression.cjs'):
    subprocess.run(['bash','/solution/solve.sh'],check=True)
    subprocess.run(['chmod','-R','a+rX','/app'],check=True)
    subprocess.run(['chown','-R','65534:65534','/app'],check=True)
    subprocess.run(['bash','/tests/app-lifecycle.sh','start'],check=True)
    try:
        subprocess.run(['node',script],check=True,timeout=420)
    finally:
        subprocess.run(['bash','/tests/app-lifecycle.sh','stop'],check=True)
for name in ('oracle-failures-regression.json','additional-regression.json'):
    report=json.loads((Path('/results')/name).read_text())
    assert all(item['passed'] for item in report['results']), name
print('PASS fresh 8 failure-path and 14 additional regression groups; not an Oracle grade')
