"""Unpaid v3 renamed-runtime smoke in cached GridForge tools."""
from pathlib import Path
import json, subprocess
for p in [*Path('/tests').glob('*.sh'),Path('/solution/solve.sh')]:
    subprocess.run(['bash','-n',str(p)],check=True)
for p in Path('/solution/app').rglob('*.js'):
    subprocess.run(['node','--check',str(p)],check=True)
subprocess.run(['bash','/solution/solve.sh'],check=True)
Path('/logs/verifier').mkdir(parents=True,exist_ok=True)
Path('/tmp/gridforge-v3-submission').mkdir(exist_ok=True)
subprocess.run(['chown','-R','65534:65534','/app','/tmp/gridforge-v3-submission'],check=True)
subprocess.run(['bash','/tests/app-control.sh','start'],check=True)
try:
    subprocess.run(['node','/results/runtime-smoke.cjs'],check=True,timeout=90)
finally:
    subprocess.run(['bash','/tests/app-control.sh','stop'],check=True)
