from pathlib import Path
import shutil,subprocess,sys
kind=sys.argv[1]
if kind=='gemini':
    shutil.copytree('/artifact','/app',dirs_exist_ok=True)
    Path('/app/node_modules').symlink_to('/opt/patchpad-deps/node_modules')
else:subprocess.run(['bash','/solution/solve.sh'],check=True)
subprocess.run(['chmod','-R','a+rX','/app'],check=True)
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
subprocess.run(['bash','/tests/app-lifecycle.sh','start'],check=True)
try:
    subprocess.run(['node','/results/fair-find.cjs',kind],check=True,timeout=180)
    if kind=='gemini':subprocess.run(['node','/results/virtual-restart.cjs'],check=True,timeout=90)
finally:subprocess.run(['bash','/tests/app-lifecycle.sh','stop'],check=True)
