"""Disposable offline golden diagnostic; no paid judge and no source changes."""
from pathlib import Path
import subprocess

for script in ('/solution/solve.sh','/tests/test.sh','/tests/app-control.sh','/tests/restart-app.sh'):
    subprocess.run(['bash','-n',script],check=True)
for path in Path('/solution/app').rglob('*.js'):
    subprocess.run(['node','--check',str(path)],check=True)
subprocess.run(['bash','/solution/solve.sh'],check=True)
subprocess.run(['chmod','-R','a+rX','/app'],check=True)
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
Path('/logs/verifier').mkdir(parents=True,exist_ok=True)
Path('/tmp/gridforge-v2-submission').mkdir(exist_ok=True)
subprocess.run(['bash','/tests/app-control.sh','start'],check=True)
try:
    subprocess.run(['node','/results/oracle-reproduction.cjs'],check=True,timeout=120)
finally:
    subprocess.run(['bash','/tests/app-control.sh','stop'],check=True)
