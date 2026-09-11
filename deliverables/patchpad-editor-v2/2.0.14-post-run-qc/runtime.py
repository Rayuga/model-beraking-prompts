from pathlib import Path
import subprocess,shutil,sys
shutil.copytree('/artifact','/app',dirs_exist_ok=True)
# Exports omit node_modules. Supply the exact task-provided Express tree;
# do not install or change application source or pretend this is a regrade.
Path('/app/node_modules').symlink_to('/opt/patchpad-deps/node_modules')
subprocess.run(['chmod','700','/results'],check=True)
subprocess.run(['chmod','-R','a+rX','/app'],check=True)
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
subprocess.run(['bash','/tests/app-lifecycle.sh','start'],check=True)
try:subprocess.run(['node','/review/browser.cjs',sys.argv[1]],check=True,timeout=180)
finally:subprocess.run(['bash','/tests/app-lifecycle.sh','stop'],check=True)
