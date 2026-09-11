import subprocess
subprocess.run(['bash','/solution/solve.sh'],check=True)
subprocess.run(['chmod','-R','a+rX','/app'],check=True)
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
subprocess.run(['bash','/tests/app-lifecycle.sh','start'],check=True)
try:
    # Historical script, rerun against current source with outputs in this new folder.
    first=subprocess.run(['node','/results/current-failures.cjs'],timeout=180)
    second=subprocess.run(['node','/results/reproduce.cjs'],timeout=180)
    raise SystemExit(first.returncode or second.returncode)
finally:
    subprocess.run(['bash','/tests/app-lifecycle.sh','stop'],check=True)
